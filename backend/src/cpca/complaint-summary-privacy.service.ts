import { Injectable, Logger } from '@nestjs/common';
import { sanitizeText } from '../common/sanitize';
import { LitellmService } from '../llm/litellm.service';
import { PrismaService } from '../prisma/prisma.service';

export type ComplaintSummaryPrivacyFindingCategory =
  | 'RANK_PLUS_NAME'
  | 'POSSIBLE_PERSON_NAME';

export type ComplaintSummaryPrivacyFindingConfidence = 'HIGH' | 'MEDIUM';

export type ComplaintSummaryPrivacyFinding = {
  excerpt: string;
  start: number;
  end: number;
  category: ComplaintSummaryPrivacyFindingCategory;
  confidence: ComplaintSummaryPrivacyFindingConfidence;
  explanation: string;
  source: 'heuristic' | 'llm';
};

export type ComplaintSummaryPrivacyReview = {
  status: 'clear' | 'flagged';
  checkedText: string;
  findings: ComplaintSummaryPrivacyFinding[];
  engine: 'heuristic' | 'llm' | 'hybrid';
  model: string | null;
  userMessage: string;
};

type LlmReviewShape = {
  hasPossibleMilitaryNames: boolean;
  findings: Array<{
    excerpt?: unknown;
    start?: unknown;
    end?: unknown;
    category?: unknown;
    confidence?: unknown;
    explanation?: unknown;
  }>;
};

const RANK_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_LLM_ATTEMPTS = 2;

const BUILTIN_RANK_GROUPS = [
  ['ALUNO'],
  ['SD', 'SOLDADO'],
  ['CB', 'CABO'],
  ['3S', '3 SARGENTO', '3O SARGENTO', '3º SARGENTO', 'TERCEIRO SARGENTO'],
  ['2S', '2 SARGENTO', '2O SARGENTO', '2º SARGENTO', 'SEGUNDO SARGENTO'],
  ['1S', '1 SARGENTO', '1O SARGENTO', '1º SARGENTO', 'PRIMEIRO SARGENTO'],
  ['SO', 'SUBOFICIAL'],
  ['ASP', 'ASPIRANTE'],
  ['CP', 'CAP', 'CAPITAO', 'CAPITÃO'],
  ['CL', 'CAPELAO', 'CAPELÃO'],
  ['MJ', 'MAJ', 'MAJOR'],
  ['TB'],
  ['2T', '2 TENENTE', '2O TENENTE', '2º TENENTE', 'SEGUNDO TENENTE'],
  ['1T', '1 TENENTE', '1O TENENTE', '1º TENENTE', 'PRIMEIRO TENENTE'],
  ['TCEL', 'TEN CEL', 'TENENTE CORONEL'],
  ['CEL', 'CORONEL'],
  ['BRIG', 'BRIGADEIRO'],
  ['GEN', 'GENERAL'],
] as const;

const CATEGORY_EXPLANATION: Record<
  ComplaintSummaryPrivacyFindingCategory,
  string
> = {
  RANK_PLUS_NAME:
    'Possível identificação de militar por posto/graduação associado a nome ou sobrenome.',
  POSSIBLE_PERSON_NAME: 'Possível nome próprio de pessoa no texto do fato.',
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeRankVariant(value: string) {
  return removeDiacritics(String(value ?? ''))
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeExcerpt(value: string) {
  return sanitizeText(String(value ?? ''));
}

function normalizeCategory(
  value: unknown,
): ComplaintSummaryPrivacyFindingCategory {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  if (normalized === 'POSSIBLE_PERSON_NAME') return 'POSSIBLE_PERSON_NAME';
  return 'RANK_PLUS_NAME';
}

function normalizeConfidence(
  value: unknown,
): ComplaintSummaryPrivacyFindingConfidence {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return normalized === 'MEDIUM' ? 'MEDIUM' : 'HIGH';
}

function isRankOnlyExcerpt(excerpt: string, rankCatalog: Set<string>) {
  return rankCatalog.has(normalizeRankVariant(excerpt));
}

function extractJsonObject(content: string) {
  const trimmed = String(content ?? '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    /* noop */
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function sortAndDedupeFindings(
  findings: ComplaintSummaryPrivacyFinding[],
): ComplaintSummaryPrivacyFinding[] {
  const sorted = [...findings].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return a.end - b.end;
    return a.excerpt.localeCompare(b.excerpt, 'pt-BR');
  });

  const deduped: ComplaintSummaryPrivacyFinding[] = [];
  for (const finding of sorted) {
    const duplicate = deduped.find(
      (entry) =>
        entry.start === finding.start &&
        entry.end === finding.end &&
        entry.excerpt === finding.excerpt,
    );
    if (!duplicate) {
      deduped.push(finding);
      continue;
    }
    if (
      duplicate.source === 'llm' &&
      finding.source === 'heuristic' &&
      duplicate.confidence !== 'HIGH'
    ) {
      duplicate.confidence = finding.confidence;
      duplicate.explanation = finding.explanation;
    }
  }

  return deduped;
}

export function detectHeuristicComplaintSummaryFindings(
  text: string,
  rankVariants: string[],
): ComplaintSummaryPrivacyFinding[] {
  const checkedText = sanitizeText(text);
  if (!checkedText) return [];

  const pattern = rankVariants
    .map((variant) => escapeRegExp(variant).replace(/\s+/g, '\\s+'))
    .sort((a, b) => b.length - a.length)
    .join('|');
  if (!pattern) return [];

  const rankRegex = new RegExp(`\\b(?:${pattern})\\b`, 'giu');
  const findings: ComplaintSummaryPrivacyFinding[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = rankRegex.exec(checkedText)) !== null) {
    const rankText = String(match[0] ?? '');
    if (!rankText.trim()) continue;
    const start = Number(match.index ?? -1);
    if (start < 0) continue;

    const afterRank = checkedText.slice(start + rankText.length);
    const nameMatch = afterRank.match(
      /^[\s,:;()\-–—]*((?:[A-ZÀ-ÖØ-Ý]{2,}|[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]{1,})(?:\s+(?:[A-ZÀ-ÖØ-Ý]{2,}|[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]{1,})){0,2})/u,
    );
    const namePart = String(nameMatch?.[1] ?? '').trim();
    if (!namePart) continue;

    const excerpt = `${rankText} ${namePart}`.trim();
    findings.push({
      excerpt,
      start,
      end: start + excerpt.length,
      category: 'RANK_PLUS_NAME',
      confidence: 'HIGH',
      explanation: CATEGORY_EXPLANATION.RANK_PLUS_NAME,
      source: 'heuristic',
    });
  }

  return sortAndDedupeFindings(findings);
}

@Injectable()
export class ComplaintSummaryPrivacyService {
  private readonly logger = new Logger(ComplaintSummaryPrivacyService.name);
  private rankCache:
    | {
        values: string[];
        normalizedSet: Set<string>;
        expiresAt: number;
      }
    | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly litellm: LitellmService,
  ) {}

  async reviewSummary(text: string): Promise<ComplaintSummaryPrivacyReview> {
    const checkedText = sanitizeText(text);
    if (!checkedText) {
      return {
        status: 'clear',
        checkedText: '',
        findings: [],
        engine: 'heuristic',
        model: null,
        userMessage:
          'Nenhum indício de nome de militar foi identificado no resumo do fato.',
      };
    }

    const rankCatalog = await this.loadRankCatalog();
    const heuristicFindings = detectHeuristicComplaintSummaryFindings(
      checkedText,
      rankCatalog.values,
    );

    let llmFindings: ComplaintSummaryPrivacyFinding[] = [];
    let llmModel: string | null = null;

    if (this.litellm.isConfigured()) {
      const llmResult = await this.reviewWithLlm(
        checkedText,
        rankCatalog,
      ).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Falha na revisão IA do resumo do fato; usando heurística local. Motivo: ${message}`,
        );
        return null;
      });
      if (llmResult) {
        llmFindings = llmResult.findings;
        llmModel = llmResult.model;
      }
    }

    const findings = sortAndDedupeFindings([
      ...heuristicFindings,
      ...llmFindings,
    ]);
    const engine: ComplaintSummaryPrivacyReview['engine'] =
      heuristicFindings.length > 0 && llmFindings.length > 0
        ? 'hybrid'
        : llmFindings.length > 0
          ? 'llm'
          : 'heuristic';

    return {
      status: findings.length > 0 ? 'flagged' : 'clear',
      checkedText,
      findings,
      engine,
      model: llmModel,
      userMessage:
        findings.length > 0
          ? 'A Inteligência Artificial identificou a presença de possíveis nomes no texto.'
          : 'Nenhum indício de nome de militar foi identificado no resumo do fato.',
    };
  }

  private async loadRankCatalog() {
    const now = Date.now();
    if (this.rankCache && this.rankCache.expiresAt > now) {
      return this.rankCache;
    }

    const rankValues = new Set<string>();
    BUILTIN_RANK_GROUPS.flat().forEach((variant) => {
      const normalized = normalizeRankVariant(variant);
      if (normalized) rankValues.add(normalized);
    });

    const rows = await this.prisma.posto.findMany({
      select: { code: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    for (const row of rows) {
      const code = normalizeRankVariant(row.code);
      const name = normalizeRankVariant(row.name);
      if (code) rankValues.add(code);
      if (name) rankValues.add(name);
    }

    const values = Array.from(rankValues).sort((a, b) => b.length - a.length);
    const normalizedSet = new Set(
      values.map((item) => normalizeRankVariant(item)),
    );
    this.rankCache = {
      values,
      normalizedSet,
      expiresAt: now + RANK_CACHE_TTL_MS,
    };
    return this.rankCache;
  }

  private async reviewWithLlm(
    checkedText: string,
    rankCatalog: { values: string[]; normalizedSet: Set<string> },
  ) {
    let previousResponse = '';
    let validationIssue = '';

    for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt += 1) {
      const response = await this.litellm.chatCompletion({
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: [
              'Você é um validador de privacidade para denúncias institucionais.',
              'Objetivo: identificar apenas trechos que possam expor nomes de militares no "Resumo do Fato".',
              'Regras obrigatórias:',
              '- posto/graduação sozinho NÃO é erro;',
              '- sinalize quando houver posto/graduação junto de nome, sobrenome, nome de guerra ou outra identificação pessoal;',
              '- também sinalize nomes próprios completos quando estiverem claramente se referindo a pessoa;',
              '- nunca invente trechos; cada excerpt deve existir literalmente no texto;',
              '- start é índice inicial inclusivo e end é índice final exclusivo;',
              '- se não houver risco, retorne hasPossibleMilitaryNames=false e findings=[];',
              '- responda SOMENTE JSON válido, sem markdown e sem texto fora do JSON.',
              'Formato exato:',
              '{"hasPossibleMilitaryNames":true,"findings":[{"excerpt":"Capitão Silva","start":10,"end":24,"category":"RANK_PLUS_NAME","confidence":"HIGH","explanation":"posto junto de sobrenome"}]}',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Texto a revisar: ${JSON.stringify(checkedText)}`,
              `Catálogo de postos/graduações relevantes: ${rankCatalog.values.join(', ')}`,
              attempt > 1 && previousResponse
                ? `Resposta anterior inválida: ${previousResponse}`
                : null,
              attempt > 1 && validationIssue
                ? `Corrija estes problemas e responda novamente em JSON válido: ${validationIssue}`
                : null,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
      });

      previousResponse = response.content;
      const parsed = this.parseLlmResponse(
        response.content,
        checkedText,
        rankCatalog.normalizedSet,
      );
      if (parsed) {
        return { ...parsed, model: response.model ?? null };
      }
      validationIssue =
        'Use JSON objeto válido com hasPossibleMilitaryNames e findings coerentes com o texto original.';
    }

    return null;
  }

  private parseLlmResponse(
    content: string,
    checkedText: string,
    rankCatalog: Set<string>,
  ) {
    const json = extractJsonObject(content);
    if (!json) return null;

    const parsed = json as unknown as LlmReviewShape;
    const findingsRaw = Array.isArray(parsed.findings) ? parsed.findings : [];
    const findings: ComplaintSummaryPrivacyFinding[] = [];

    for (const item of findingsRaw) {
      const repaired = this.repairLlmFinding(item, checkedText, rankCatalog);
      if (repaired) {
        findings.push(repaired);
      }
    }

    const deduped = sortAndDedupeFindings(findings);
    const hasPossibleMilitaryNames = Boolean(parsed.hasPossibleMilitaryNames);
    if (!hasPossibleMilitaryNames && deduped.length === 0) {
      return { findings: [] as ComplaintSummaryPrivacyFinding[] };
    }
    if (deduped.length === 0) return null;
    return { findings: deduped };
  }

  private repairLlmFinding(
    raw: LlmReviewShape['findings'][number],
    checkedText: string,
    rankCatalog: Set<string>,
  ): ComplaintSummaryPrivacyFinding | null {
    const explicitStart = Number(raw.start);
    const explicitEnd = Number(raw.end);
    const excerptRaw = normalizeExcerpt(String(raw.excerpt ?? ''));
    let excerpt = excerptRaw;
    let start = Number.isFinite(explicitStart) ? explicitStart : -1;
    let end = Number.isFinite(explicitEnd) ? explicitEnd : -1;

    if (
      start >= 0 &&
      end > start &&
      end <= checkedText.length &&
      checkedText.slice(start, end) === excerpt
    ) {
      /* use exact indices */
    } else if (excerpt) {
      const foundAt = checkedText.indexOf(excerpt);
      if (foundAt >= 0) {
        start = foundAt;
        end = foundAt + excerpt.length;
      }
    } else if (start >= 0 && end > start && end <= checkedText.length) {
      excerpt = checkedText.slice(start, end);
    }

    if (start < 0 || end <= start || end > checkedText.length) {
      return null;
    }

    excerpt = checkedText.slice(start, end);
    if (!excerpt || isRankOnlyExcerpt(excerpt, rankCatalog)) {
      return null;
    }

    const category = normalizeCategory(raw.category);
    return {
      excerpt,
      start,
      end,
      category,
      confidence: normalizeConfidence(raw.confidence),
      explanation:
        sanitizeText(String(raw.explanation ?? '')) ||
        CATEGORY_EXPLANATION[category],
      source: 'llm',
    };
  }
}
