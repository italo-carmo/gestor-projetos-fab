import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BiImportFormat, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parsePagination } from '../common/pagination';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';

type SurveyFilters = {
  from?: string;
  to?: string;
  mission?: string;
  om?: string;
  posto?: string;
  postoGraduacao?: string;
  autodeclara?: string;
  suffered?: string;
  violenceType?: string;
  q?: string;
  combineMode?: string;
};

type ImportSurveyOptions = {
  replaceAll?: boolean;
};

type SurveyCardSettingInput = {
  title?: string;
  description?: string | null;
};

type ParsedSurveyRow = {
  submittedAt: Date | null;
  sufferedViolenceRaw: string | null;
  sufferedViolence: boolean | null;
  violenceTypes: string[];
  postoGraduacao: string | null;
  om: string | null;
  posto: string | null;
  autodeclara: string | null;
  extraColumn: string | null;
  rawPayload: Prisma.InputJsonValue;
  sourceRow: number;
  sourceHash: string;
};

type CorrelatedViolenceSummary = {
  sheetName: string;
  totalRows: number;
  mentionRows: number;
  byType: Array<{
    type: string;
    count: number;
    percent: number;
  }>;
};

const KNOWN_VIOLENCE_TYPES = [
  'Violência Patrimonial',
  'Violência Física',
  'Violência Sexual',
  'Violência Moral',
  'Violência Psicológica',
] as const;

const VIOLENCE_TYPE_ALIASES: Array<{
  match: string;
  label: (typeof KNOWN_VIOLENCE_TYPES)[number];
}> = [
  { match: 'patrimonial', label: 'Violência Patrimonial' },
  { match: 'fisica', label: 'Violência Física' },
  { match: 'sexual', label: 'Violência Sexual' },
  { match: 'moral', label: 'Violência Moral' },
  { match: 'psicologica', label: 'Violência Psicológica' },
];

const OM_PRIORITY: Record<string, number> = {
  COMGEP: 1,
  CIAAR: 2,
  AFA: 3,
  EEAR: 4,
};

type SurveyQuestionDefinition = {
  id: string;
  label: string;
  extractValues: (row: {
    sufferedViolenceRaw: string | null;
    violenceTypes: string[];
    postoGraduacao: string | null;
    om: string | null;
    posto: string | null;
    autodeclara: string | null;
  }) => string[];
};

const SURVEY_QUESTION_DEFINITIONS: SurveyQuestionDefinition[] = [
  {
    id: 'suffered',
    label: 'Você já sofreu violência?',
    extractValues: (row) =>
      row.sufferedViolenceRaw ? [row.sufferedViolenceRaw] : [],
  },
  {
    id: 'violenceTypes',
    label: 'Qual tipo de violência você sofreu?',
    extractValues: (row) => row.violenceTypes ?? [],
  },
  {
    id: 'postoGraduacao',
    label: 'Posto / Graduação',
    extractValues: (row) => (row.postoGraduacao ? [row.postoGraduacao] : []),
  },
  {
    id: 'mission',
    label: 'OM / Missão',
    extractValues: (row) => (row.om ? [row.om] : []),
  },
  {
    id: 'posto',
    label: 'Perfil funcional',
    extractValues: (row) => (row.posto ? [row.posto] : []),
  },
];

const SURVEY_CARD_IDS = new Set([
  'page-header',
  'context-mission',
  'kpi-total-responses',
  'kpi-violence-rate',
  'kpi-violence-mentions',
  'kpi-quick-insight',
  'chart-mission-percent',
  'chart-yes-no',
  'chart-violence-type',
  'chart-violence-by-mission',
  'chart-mission-distribution',
  'chart-profile-types',
  'chart-monthly-trend',
  'list-responses',
  'list-imports',
]);

@Injectable()
export class BiService {
  constructor(private readonly prisma: PrismaService) {}

  async importSurvey(
    file: Express.Multer.File,
    user?: RbacUser,
    options: ImportSurveyOptions = {},
  ) {
    const extension = this.fileExtension(file.originalname);
    const format =
      extension === 'csv' ? BiImportFormat.CSV : BiImportFormat.XLSX;
    const replaceAll = options.replaceAll === true;
    const { sheetName, rows, correlatedViolence } = this.extractRows(
      file.buffer,
      format,
    );

    if (rows.length === 0) {
      throwError('VALIDATION_ERROR', { reason: 'empty_file' });
    }

    const [headerRow, ...dataRows] = rows;
    const headerMap = this.resolveHeaderMap(headerRow);

    const parsed: ParsedSurveyRow[] = [];
    let invalidRows = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      const parsedRow = this.parseDataRow(row, headerMap, index + 2);
      if (parsedRow.skip) continue;
      if (!parsedRow.value) {
        invalidRows += 1;
        continue;
      }
      parsed.push(parsedRow.value);
    }

    if (replaceAll) {
      await this.prisma.$transaction([
        this.prisma.biSurveyResponse.deleteMany(),
        this.prisma.biSurveyImportBatch.deleteMany(),
      ]);
    }

    const batch = await this.prisma.biSurveyImportBatch.create({
      data: {
        fileName: file.originalname,
        format,
        sheetName,
        totalRows: parsed.length,
        insertedRows: 0,
        duplicateRows: 0,
        invalidRows,
        importedById: user?.id ?? null,
      },
    });

    let insertedRows = 0;

    if (parsed.length > 0) {
      const created = await this.prisma.biSurveyResponse.createMany({
        data: parsed.map((item) => ({
          batchId: batch.id,
          submittedAt: item.submittedAt,
          sufferedViolenceRaw: item.sufferedViolenceRaw,
          sufferedViolence: item.sufferedViolence,
          violenceTypes: item.violenceTypes,
          postoGraduacao: item.postoGraduacao,
          om: item.om,
          posto: item.posto,
          autodeclara: item.autodeclara,
          extraColumn: item.extraColumn,
          rawPayload: item.rawPayload,
          sourceRow: item.sourceRow,
          sourceHash: item.sourceHash,
        })),
        skipDuplicates: true,
      });
      insertedRows = created.count;
    }

    const duplicateRows = parsed.length - insertedRows;

    const updatedBatch = await this.prisma.biSurveyImportBatch.update({
      where: { id: batch.id },
      data: {
        insertedRows,
        duplicateRows,
      },
      include: {
        importedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      batch: updatedBatch,
      preview: parsed.slice(0, 5).map((item) => ({
        submittedAt: item.submittedAt,
        sufferedViolenceRaw: item.sufferedViolenceRaw,
        violenceTypes: item.violenceTypes,
        postoGraduacao: item.postoGraduacao,
        om: item.om,
        posto: item.posto,
        autodeclara: item.autodeclara,
      })),
      importMode: replaceAll ? 'REPLACE' : 'APPEND',
      correlatedViolence,
    };
  }

  async listImports(filters: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.biSurveyImportBatch.findMany({
        include: {
          importedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ importedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.biSurveyImportBatch.count(),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async listResponses(
    filters: SurveyFilters & {
      page?: string;
      pageSize?: string;
    },
  ) {
    const where = this.buildWhere(filters);

    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.biSurveyResponse.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.biSurveyResponse.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async listQuestions(filters: SurveyFilters) {
    const mission = filters.mission?.trim() || filters.om?.trim() || null;
    const baseWhere = this.buildWhere(filters);
    const where: Prisma.BiSurveyResponseWhereInput = mission
      ? Object.keys(baseWhere).length > 0
        ? { AND: [baseWhere, { om: mission }] }
        : { om: mission }
      : baseWhere;

    const rows = await this.prisma.biSurveyResponse.findMany({
      where,
      select: {
        sufferedViolenceRaw: true,
        violenceTypes: true,
        postoGraduacao: true,
        om: true,
        posto: true,
        autodeclara: true,
      },
    });

    const totalResponses = rows.length;

    const items = SURVEY_QUESTION_DEFINITIONS.map((question) => {
      const normalizedValuesByRow = rows.map((row) =>
        question
          .extractValues(row)
          .map((value) => this.normalizeQuestionAnswer(question.id, value)),
      );

      const answeredCount = normalizedValuesByRow.reduce((acc, rowValues) => {
        const hasValue = rowValues.some((value) => value.length > 0);
        return hasValue ? acc + 1 : acc;
      }, 0);
      const emptyCount = totalResponses - answeredCount;
      const answerRatePercent =
        totalResponses > 0
          ? Number(((answeredCount / totalResponses) * 100).toFixed(2))
          : 0;

      const counter = new Map<string, number>();
      for (const rowValues of normalizedValuesByRow) {
        for (const value of rowValues) {
          if (!value) continue;
          counter.set(value, (counter.get(value) ?? 0) + 1);
        }
      }

      const topAnswers = [...counter.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0], 'pt-BR');
        })
        .slice(0, 5)
        .map(([label, count]) => ({
          label,
          count,
          percent:
            answeredCount > 0
              ? Number(((count / answeredCount) * 100).toFixed(2))
              : 0,
        }));

      return {
        id: question.id,
        label: question.label,
        answeredCount,
        emptyCount,
        answerRatePercent,
        topAnswers,
      };
    });

    return {
      mission,
      totalResponses,
      items,
    };
  }

  async deleteResponses(
    payload: SurveyFilters & {
      ids?: string[];
      allFiltered?: boolean;
    },
  ) {
    const ids = (payload.ids ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    const allFiltered = Boolean(payload.allFiltered);

    if (!allFiltered && uniqueIds.length === 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'delete_requires_ids_or_filtered',
      });
    }

    if (allFiltered) {
      const where = this.buildWhere(payload);
      const deleted = await this.prisma.biSurveyResponse.deleteMany({ where });
      return {
        mode: 'FILTERED',
        deletedCount: deleted.count,
      };
    }

    const deleted = await this.prisma.biSurveyResponse.deleteMany({
      where: {
        id: { in: uniqueIds },
      },
    });

    return {
      mode: 'IDS',
      deletedCount: deleted.count,
    };
  }

  async listCardSettings() {
    const cardSettingModel = (this.prisma as any).biSurveyCardSetting;
    const items = await cardSettingModel.findMany({
      orderBy: { cardId: 'asc' },
      select: {
        cardId: true,
        title: true,
        description: true,
        updatedAt: true,
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      items,
    };
  }

  async updateCardSetting(
    cardIdRaw: string,
    payload: SurveyCardSettingInput,
    user?: RbacUser,
  ) {
    const cardId = String(cardIdRaw ?? '').trim();
    if (!SURVEY_CARD_IDS.has(cardId)) {
      throwError('VALIDATION_ERROR', {
        field: 'cardId',
        reason: 'invalid_card_id',
      });
    }

    const title = String(payload.title ?? '').trim();
    if (!title) {
      throwError('VALIDATION_ERROR', {
        field: 'title',
        reason: 'required',
      });
    }

    const descriptionRaw = payload.description;
    const description =
      descriptionRaw === undefined || descriptionRaw === null
        ? null
        : String(descriptionRaw).trim() || null;

    const cardSettingModel = (this.prisma as any).biSurveyCardSetting;

    const updated = await cardSettingModel.upsert({
      where: { cardId },
      create: {
        cardId,
        title,
        description,
        updatedById: user?.id ?? null,
      },
      update: {
        title,
        description,
        updatedById: user?.id ?? null,
      },
      select: {
        cardId: true,
        title: true,
        description: true,
        updatedAt: true,
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return updated;
  }

  async dashboard(filters: SurveyFilters) {
    const where = this.buildWhere(filters);
    const cardSettingModel = (this.prisma as any).biSurveyCardSetting;

    const [rows, allRowsForFilters, totalRowsInDb, latestImport, cardSettings] =
      await this.prisma.$transaction([
        this.prisma.biSurveyResponse.findMany({
          where,
          select: {
            id: true,
            submittedAt: true,
            sufferedViolence: true,
            sufferedViolenceRaw: true,
            violenceTypes: true,
            om: true,
            posto: true,
            postoGraduacao: true,
            autodeclara: true,
          },
        }),
        this.prisma.biSurveyResponse.findMany({
          select: {
            sufferedViolence: true,
            violenceTypes: true,
            om: true,
            posto: true,
            postoGraduacao: true,
            autodeclara: true,
          },
        }),
        this.prisma.biSurveyResponse.count(),
        this.prisma.biSurveyImportBatch.findFirst({
          orderBy: { importedAt: 'desc' },
          include: {
            importedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        cardSettingModel.findMany({
          orderBy: { cardId: 'asc' },
          select: {
            cardId: true,
            title: true,
            description: true,
            updatedAt: true,
            updatedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);

    const total = rows.length;
    const yesCount = rows.filter((row) => row.sufferedViolence === true).length;
    const noCount = rows.filter((row) => row.sufferedViolence === false).length;
    const unknownCount = total - yesCount - noCount;

    const totalMentions = rows.reduce(
      (sum, row) => sum + row.violenceTypes.length,
      0,
    );
    const averageTypesPerVictim =
      yesCount > 0 ? Number((totalMentions / yesCount).toFixed(2)) : 0;

    const omViolence = this.buildOmViolenceChart(rows);
    const omDistribution = this.buildDistribution(
      rows,
      (row) => row.om ?? 'Não informado',
      'om',
    );
    const postoDistribution = this.buildDistribution(
      rows,
      (row) => row.posto ?? 'Não informado',
      'posto',
    );
    const postoGraduacaoDistribution = this.buildDistribution(
      rows,
      (row) => row.postoGraduacao ?? 'Não informado',
      'postoGraduacao',
    );
    const autodeclaraDistribution = this.buildDistribution(
      rows,
      (row) => row.autodeclara ?? 'Não informado',
      'autodeclara',
    );

    const violenceTypePercent = this.buildViolenceTypeChart(rows);
    const violenceTypeByOmPercent = this.buildViolenceTypeByOmChart(rows);
    const violenceTypeByPostoPercent = this.buildViolenceTypeByPostoChart(rows);
    const monthlyTrend = this.buildMonthlyTrend(rows);

    const typeCounter = new Map<string, number>();
    for (const row of rows) {
      for (const type of row.violenceTypes) {
        typeCounter.set(type, (typeCounter.get(type) ?? 0) + 1);
      }
    }

    const mostCommonType =
      [...typeCounter.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const riskiestOm =
      [...omViolence]
        .filter((item) => item.total >= 5)
        .sort((a, b) => b.simPercent - a.simPercent)[0] ?? null;
    const topMissionByMentions =
      [...violenceTypeByOmPercent.items].sort(
        (a, b) => Number(b.total) - Number(a.total),
      )[0] ?? null;
    const topProfileByMentions =
      [...violenceTypeByPostoPercent.items].sort(
        (a, b) => Number(b.total) - Number(a.total),
      )[0] ?? null;

    return {
      kpis: {
        totalResponses: total,
        totalRowsInDb,
        yesCount,
        noCount,
        unknownCount,
        violenceRatePercent:
          total > 0 ? Number(((yesCount / total) * 100).toFixed(2)) : 0,
        totalViolenceMentions: totalMentions,
        averageTypesPerVictim,
      },
      filters: this.buildAvailableFilters(allRowsForFilters),
      charts: {
        omViolencePercent: omViolence,
        omDistribution,
        postoDistribution,
        postoGraduacaoDistribution,
        autodeclaraDistribution,
        yesNoDonut: [
          {
            label: 'Não',
            count: noCount,
            percent:
              total > 0 ? Number(((noCount / total) * 100).toFixed(2)) : 0,
          },
          {
            label: 'Sim',
            count: yesCount,
            percent:
              total > 0 ? Number(((yesCount / total) * 100).toFixed(2)) : 0,
          },
          {
            label: 'Não informado',
            count: unknownCount,
            percent:
              total > 0 ? Number(((unknownCount / total) * 100).toFixed(2)) : 0,
          },
        ],
        violenceTypePercent,
        violenceTypeByOmPercent,
        violenceTypeByPostoPercent,
        monthlyTrend,
      },
      insights: {
        mostCommonType: mostCommonType
          ? {
              type: mostCommonType[0],
              mentions: mostCommonType[1],
            }
          : null,
        riskiestOm: riskiestOm
          ? {
              om: riskiestOm.om,
              simPercent: riskiestOm.simPercent,
              total: riskiestOm.total,
            }
          : null,
        topMissionByMentions: topMissionByMentions
          ? {
              om: String(topMissionByMentions.om),
              mentions: Number(topMissionByMentions.total),
              sharePercent:
                totalMentions > 0
                  ? Number(
                      (
                        (Number(topMissionByMentions.total) / totalMentions) *
                        100
                      ).toFixed(2),
                    )
                  : 0,
            }
          : null,
        topProfileByMentions: topProfileByMentions
          ? {
              posto: String(topProfileByMentions.posto),
              mentions: Number(topProfileByMentions.total),
              sharePercent:
                totalMentions > 0
                  ? Number(
                      (
                        (Number(topProfileByMentions.total) / totalMentions) *
                        100
                      ).toFixed(2),
                    )
                  : 0,
            }
          : null,
      },
      cardSettings,
      latestImport,
    };
  }

  private buildAvailableFilters(
    rows: Array<{
      sufferedViolence: boolean | null;
      violenceTypes: string[];
      om: string | null;
      posto: string | null;
      postoGraduacao: string | null;
      autodeclara: string | null;
    }>,
  ) {
    const om = new Set<string>();
    const posto = new Set<string>();
    const postoGraduacao = new Set<string>();
    const autodeclara = new Set<string>();
    const violenceTypes = new Set<string>();

    for (const row of rows) {
      if (row.om?.trim()) om.add(row.om.trim());
      if (row.posto?.trim()) posto.add(row.posto.trim());
      if (row.postoGraduacao?.trim())
        postoGraduacao.add(row.postoGraduacao.trim());
      if (row.autodeclara?.trim()) autodeclara.add(row.autodeclara.trim());
      for (const type of row.violenceTypes) {
        if (type.trim()) violenceTypes.add(type.trim());
      }
    }

    const missionSorted = [...om].sort((a, b) => this.sortOm(a, b));

    return {
      mission: missionSorted,
      om: missionSorted,
      posto: [...posto].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      postoGraduacao: [...postoGraduacao].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      autodeclara: [...autodeclara].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      violenceTypes: [...violenceTypes].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      suffered: [
        { value: 'SIM', label: 'Sim' },
        { value: 'NAO', label: 'Não' },
      ],
    };
  }

  private buildOmViolenceChart(
    rows: Array<{ om: string | null; sufferedViolence: boolean | null }>,
  ) {
    const map = new Map<
      string,
      {
        simCount: number;
        naoCount: number;
        unknownCount: number;
        total: number;
      }
    >();

    for (const row of rows) {
      const key = row.om?.trim() || 'Não informado';
      const current = map.get(key) ?? {
        simCount: 0,
        naoCount: 0,
        unknownCount: 0,
        total: 0,
      };

      current.total += 1;
      if (row.sufferedViolence === true) current.simCount += 1;
      else if (row.sufferedViolence === false) current.naoCount += 1;
      else current.unknownCount += 1;

      map.set(key, current);
    }

    return [...map.entries()]
      .map(([om, value]) => ({
        om,
        ...value,
        simPercent:
          value.total > 0
            ? Number(((value.simCount / value.total) * 100).toFixed(2))
            : 0,
        naoPercent:
          value.total > 0
            ? Number(((value.naoCount / value.total) * 100).toFixed(2))
            : 0,
        unknownPercent:
          value.total > 0
            ? Number(((value.unknownCount / value.total) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => this.sortOm(a.om, b.om));
  }

  private buildDistribution<T>(
    rows: T[],
    keySelector: (row: T) => string,
    keyName: string,
  ) {
    const map = new Map<string, number>();

    for (const row of rows) {
      const key = keySelector(row);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const total = rows.length;

    return [...map.entries()]
      .map(([label, count]) => ({
        [keyName]: label,
        label,
        count,
        percent: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private buildViolenceTypeChart(rows: Array<{ violenceTypes: string[] }>) {
    const map = new Map<string, number>();

    for (const row of rows) {
      for (const type of row.violenceTypes) {
        map.set(type, (map.get(type) ?? 0) + 1);
      }
    }

    const totalMentions = [...map.values()].reduce(
      (sum, current) => sum + current,
      0,
    );

    return [...map.entries()]
      .map(([type, count]) => ({
        type,
        count,
        percent:
          totalMentions > 0
            ? Number(((count / totalMentions) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private buildViolenceTypeByOmChart(
    rows: Array<{ om: string | null; violenceTypes: string[] }>,
  ) {
    const map = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const om = row.om?.trim() || 'Não informado';
      const counters = map.get(om) ?? {};
      for (const type of row.violenceTypes) {
        counters[type] = (counters[type] ?? 0) + 1;
      }
      map.set(om, counters);
    }

    const seenTypes = new Set<string>();
    for (const counters of map.values()) {
      for (const type of Object.keys(counters)) {
        seenTypes.add(type);
      }
    }

    const allTypes = [...seenTypes].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const items = [...map.entries()]
      .map(([om, counters]) => {
        const total = allTypes.reduce(
          (sum, type) => sum + (counters[type] ?? 0),
          0,
        );
        const row: Record<string, number | string> = {
          om,
          total,
        };

        for (const type of allTypes) {
          const count = counters[type] ?? 0;
          row[`${type}__count`] = count;
          row[`${type}__percent`] =
            total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
        }

        return row;
      })
      .sort((a, b) => this.sortOm(String(a.om), String(b.om)));

    return {
      types: allTypes,
      items,
    };
  }

  private buildViolenceTypeByPostoChart(
    rows: Array<{ posto: string | null; violenceTypes: string[] }>,
  ) {
    const map = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const posto = row.posto?.trim() || 'Não informado';
      const counters = map.get(posto) ?? {};
      for (const type of row.violenceTypes) {
        counters[type] = (counters[type] ?? 0) + 1;
      }
      map.set(posto, counters);
    }

    const seenTypes = new Set<string>();
    for (const counters of map.values()) {
      for (const type of Object.keys(counters)) {
        seenTypes.add(type);
      }
    }

    const allTypes = [...seenTypes].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const items = [...map.entries()]
      .map(([posto, counters]) => {
        const total = allTypes.reduce(
          (sum, type) => sum + (counters[type] ?? 0),
          0,
        );
        const row: Record<string, number | string> = {
          posto,
          total,
        };

        for (const type of allTypes) {
          const count = counters[type] ?? 0;
          row[`${type}__count`] = count;
          row[`${type}__percent`] =
            total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
        }

        return row;
      })
      .sort((a, b) => String(a.posto).localeCompare(String(b.posto), 'pt-BR'));

    return {
      types: allTypes,
      items,
    };
  }

  private buildMonthlyTrend(
    rows: Array<{ submittedAt: Date | null; sufferedViolence: boolean | null }>,
  ) {
    const map = new Map<
      string,
      { total: number; yesCount: number; noCount: number; unknownCount: number }
    >();

    for (const row of rows) {
      const month = row.submittedAt
        ? `${row.submittedAt.getFullYear()}-${String(
            row.submittedAt.getMonth() + 1,
          ).padStart(2, '0')}`
        : 'Sem data';
      const current = map.get(month) ?? {
        total: 0,
        yesCount: 0,
        noCount: 0,
        unknownCount: 0,
      };
      current.total += 1;
      if (row.sufferedViolence === true) current.yesCount += 1;
      else if (row.sufferedViolence === false) current.noCount += 1;
      else current.unknownCount += 1;
      map.set(month, current);
    }

    return [...map.entries()]
      .map(([month, value]) => ({
        month,
        ...value,
        yesRatePercent:
          value.total > 0
            ? Number(((value.yesCount / value.total) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month, 'pt-BR'));
  }

  private sortOm(a: string, b: string) {
    const na = OM_PRIORITY[a.toUpperCase()] ?? 999;
    const nb = OM_PRIORITY[b.toUpperCase()] ?? 999;
    if (na !== nb) return na - nb;
    return a.localeCompare(b, 'pt-BR');
  }

  private buildWhere(
    filters: SurveyFilters,
  ): Prisma.BiSurveyResponseWhereInput {
    const mode = this.parseCombineMode(filters.combineMode);
    const conditions: Prisma.BiSurveyResponseWhereInput[] = [];
    const from = this.parseDate(filters.from);
    const to = this.parseDate(filters.to);

    if (from || to) {
      const dateFilter: Prisma.DateTimeNullableFilter = {};
      if (from) dateFilter.gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      conditions.push({ submittedAt: dateFilter });
    }

    const mission = filters.mission?.trim() || filters.om?.trim();
    if (mission) conditions.push({ om: mission });
    if (filters.posto?.trim()) conditions.push({ posto: filters.posto.trim() });
    if (filters.postoGraduacao?.trim()) {
      conditions.push({ postoGraduacao: filters.postoGraduacao.trim() });
    }
    if (filters.autodeclara?.trim()) {
      conditions.push({ autodeclara: filters.autodeclara.trim() });
    }

    if (filters.suffered?.trim()) {
      const normalized = this.normalize(filters.suffered);
      if (normalized === 'SIM' || normalized === 'TRUE') {
        conditions.push({ sufferedViolence: true });
      }
      if (
        normalized === 'NAO' ||
        normalized === 'NÃO' ||
        normalized === 'FALSE'
      ) {
        conditions.push({ sufferedViolence: false });
      }
    }

    if (filters.violenceType?.trim()) {
      conditions.push({
        violenceTypes: {
          has: filters.violenceType.trim(),
        },
      });
    }

    if (filters.q?.trim()) {
      const query = filters.q.trim();
      conditions.push({
        OR: [
          { om: { contains: query, mode: 'insensitive' } },
          { posto: { contains: query, mode: 'insensitive' } },
          { postoGraduacao: { contains: query, mode: 'insensitive' } },
          { autodeclara: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];

    if (mode === 'OR') {
      return { OR: conditions };
    }

    return { AND: conditions };
  }

  private parseCombineMode(value?: string): 'AND' | 'OR' {
    const normalized = this.normalize(value ?? 'AND');
    if (normalized === 'OR') return 'OR';
    return 'AND';
  }

  private normalizeQuestionAnswer(questionId: string, rawValue: string) {
    const value = String(rawValue ?? '').trim();
    if (!value) return '';

    if (questionId === 'suffered') {
      const normalized = this.normalize(value);
      if (['SIM', 'S', 'TRUE', 'YES'].includes(normalized)) return 'Sim';
      if (['NAO', 'NÃO', 'N', 'FALSE', 'NO'].includes(normalized)) return 'Não';
    }

    return value;
  }

  private extractRows(buffer: Buffer, format: BiImportFormat) {
    const workbook = this.readWorkbook(buffer);
    const sheetNames = workbook.SheetNames ?? [];

    if (sheetNames.length === 0) {
      throwError('VALIDATION_ERROR', { reason: 'empty_workbook' });
    }

    const selectedName = this.findPreferredSheetName(sheetNames, [
      'BANCO_DADOS',
      'BANCO DE DADOS',
      'BD VIOLENCIA',
    ]);
    const sheet = workbook.Sheets[selectedName];

    if (!sheet) {
      throwError('VALIDATION_ERROR', { reason: 'missing_sheet' });
    }

    const rows = this.sheetToMatrix(sheet);

    return {
      sheetName: format === BiImportFormat.CSV ? 'CSV' : selectedName,
      rows,
      correlatedViolence:
        format === BiImportFormat.XLSX
          ? this.extractCorrelatedViolenceSummary(workbook)
          : null,
    };
  }

  private readWorkbook(buffer: Buffer): XLSX.WorkBook {
    try {
      return XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false,
        raw: false,
      });
    } catch {
      throwError('VALIDATION_ERROR', { reason: 'invalid_spreadsheet' });
    }
  }

  private findPreferredSheetName(
    sheetNames: string[],
    preferredNames: string[],
  ) {
    const preferredNormalized = preferredNames.map((name) =>
      this.normalize(name),
    );
    const selected = sheetNames.find((name) =>
      preferredNormalized.includes(this.normalize(name)),
    );
    return selected ?? sheetNames[0];
  }

  private sheetToMatrix(sheet: XLSX.WorkSheet) {
    const matrix = XLSX.utils.sheet_to_json<
      Array<string | number | boolean | Date | null>
    >(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });

    return matrix.map((row) => row.map((cell) => this.cleanCell(cell) ?? ''));
  }

  private extractCorrelatedViolenceSummary(
    workbook: XLSX.WorkBook,
  ): CorrelatedViolenceSummary | null {
    const selectedName = this.findPreferredSheetName(
      workbook.SheetNames ?? [],
      ['BANCO_DADOS_VIOLENCIA'],
    );

    if (
      this.normalize(selectedName) !== this.normalize('BANCO_DADOS_VIOLENCIA')
    ) {
      return null;
    }

    const sheet = workbook.Sheets[selectedName];
    if (!sheet) return null;

    const rows = this.sheetToMatrix(sheet);
    if (rows.length <= 1) return null;

    const [headerRow, ...dataRows] = rows;
    const map = this.resolveCorrelatedViolenceHeaderMap(headerRow);
    if (map.typeDerived < 0 && map.violenceRaw < 0) return null;

    const typeCounter = new Map<string, number>();
    let mentionRows = 0;

    for (const row of dataRows) {
      const derived = this.getCell(row, map.typeDerived);
      const fallback = this.getCell(row, map.violenceRaw);
      const types = this.parseViolenceTypes(derived ?? fallback);
      if (types.length === 0) continue;
      mentionRows += types.length;
      for (const type of types) {
        typeCounter.set(type, (typeCounter.get(type) ?? 0) + 1);
      }
    }

    const byType = [...typeCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        count,
        percent:
          mentionRows > 0
            ? Number(((count / mentionRows) * 100).toFixed(2))
            : 0,
      }));

    return {
      sheetName: selectedName,
      totalRows: dataRows.length,
      mentionRows,
      byType,
    };
  }

  private resolveCorrelatedViolenceHeaderMap(headerRow: string[]) {
    const normalizedHeaders = headerRow.map((value) => this.normalize(value));
    const findIndex = (predicates: string[]) => {
      const needles = predicates
        .map((item) => this.normalize(item))
        .filter(Boolean);
      return normalizedHeaders.findIndex((header) =>
        needles.some((needle) => header.includes(needle)),
      );
    };

    return {
      typeDerived: findIndex(['Variavel derivada']),
      violenceRaw: findIndex(['3Qual tipo de violencia voce sofreu']),
    };
  }

  private resolveHeaderMap(headerRow: string[]) {
    const normalizedHeaders = headerRow.map((value) => this.normalize(value));

    const findIndex = (predicates: string[]) => {
      const needles = predicates
        .map((item) => this.normalize(item))
        .filter(Boolean);
      return normalizedHeaders.findIndex((header) =>
        needles.some((needle) => header.includes(needle)),
      );
    };

    const map = {
      recordId: normalizedHeaders.findIndex(
        (header) => header === this.normalize('N'),
      ),
      submittedAt: findIndex([
        '1Carimbo de data/hora',
        'Carimbo de data/hora',
        'Timestamp',
      ]),
      sufferedViolence: findIndex([
        '2Voce ja sofreu violencia',
        'Ja sofreu violencia',
      ]),
      violenceTypes: findIndex([
        '3Qual tipo de violencia voce sofreu',
        'Tipo de violencia',
      ]),
      postoGraduacao: findIndex(['4POSTO / GRADUACAO', 'POSTO / GRADUACAO']),
      postoPadronizado: findIndex([
        '4POSTO / GRADUACAO_PADRONIZADO',
        '4POSTO / GRADUACAO2',
      ]),
      om: findIndex(['5OM']),
      posto: findIndex(['6POSTO']),
      autodeclara: findIndex(['7Como voce se autodeclara', 'Autodeclara']),
      extraColumn: findIndex(['coluna1']),
    };

    if (map.sufferedViolence < 0 || map.violenceTypes < 0 || map.om < 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'missing_required_columns',
        required: [
          '2Você já sofreu violência?',
          '3Qual tipo de violência você sofreu?',
          '5OM',
        ],
      });
    }

    return {
      ...map,
      submittedAt: map.submittedAt >= 0 ? map.submittedAt : -1,
      postoGraduacao: map.postoGraduacao >= 0 ? map.postoGraduacao : -1,
      postoPadronizado: map.postoPadronizado >= 0 ? map.postoPadronizado : -1,
      posto: map.posto >= 0 ? map.posto : -1,
      autodeclara: map.autodeclara >= 0 ? map.autodeclara : -1,
      extraColumn: map.extraColumn >= 0 ? map.extraColumn : -1,
    };
  }

  private parseDataRow(
    row: string[],
    map: {
      recordId: number;
      submittedAt: number;
      sufferedViolence: number;
      violenceTypes: number;
      postoGraduacao: number;
      postoPadronizado: number;
      om: number;
      posto: number;
      autodeclara: number;
      extraColumn: number;
    },
    sourceRow: number,
  ):
    | { skip: true; value?: undefined }
    | { skip: false; value: ParsedSurveyRow | null } {
    const recordId = this.getCell(row, map.recordId);
    const submittedAtRaw = this.getCell(row, map.submittedAt);
    const sufferedRaw = this.getCell(row, map.sufferedViolence);
    const violenceRaw = this.getCell(row, map.violenceTypes);
    const postoGraduacao = this.getCell(row, map.postoGraduacao);
    const postoPadronizado = this.getCell(row, map.postoPadronizado);
    const om = this.getCell(row, map.om);
    const posto = postoPadronizado ?? this.getCell(row, map.posto);
    const autodeclara = this.getCell(row, map.autodeclara);
    const extraColumn = this.getCell(row, map.extraColumn);

    const hasAnyValue = [
      recordId,
      submittedAtRaw,
      sufferedRaw,
      violenceRaw,
      postoGraduacao,
      om,
      posto,
      autodeclara,
      extraColumn,
    ].some((value) => Boolean(value && value.trim()));

    if (!hasAnyValue) {
      return { skip: true };
    }

    const submittedAt = this.parseSubmittedAt(submittedAtRaw);
    const sufferedViolence = this.parseSufferedViolence(sufferedRaw);
    const violenceTypes = this.parseViolenceTypes(violenceRaw);

    const payload = {
      recordId,
      submittedAtRaw,
      sufferedRaw,
      violenceRaw,
      postoGraduacao,
      postoPadronizado,
      om,
      posto,
      autodeclara,
      extraColumn,
    };

    const sourceHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          sourceRow,
          submittedAt: submittedAt?.toISOString() ?? null,
          sufferedViolenceRaw: sufferedRaw,
          sufferedViolence,
          violenceTypes: [...violenceTypes].sort(),
          postoGraduacao,
          om,
          posto,
          autodeclara,
          extraColumn,
        }),
      )
      .digest('hex');

    return {
      skip: false,
      value: {
        submittedAt,
        sufferedViolenceRaw: sufferedRaw,
        sufferedViolence,
        violenceTypes,
        postoGraduacao,
        om,
        posto,
        autodeclara,
        extraColumn,
        rawPayload: payload,
        sourceRow,
        sourceHash,
      },
    };
  }

  private fileExtension(fileName: string) {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(ext)) {
      throwError('BI_FILE_TYPE_INVALID');
    }
    return ext;
  }

  private parseDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private parseSubmittedAt(raw: string | null) {
    if (!raw) return null;

    const normalized = raw.replace(',', '.').trim();
    const numeric = Number(normalized);

    if (Number.isFinite(numeric) && numeric > 25000 && numeric < 70000) {
      const excelEpochUtc = Date.UTC(1899, 11, 30);
      return new Date(excelEpochUtc + numeric * 24 * 60 * 60 * 1000);
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;

    const brPattern = raw.match(
      /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );

    if (brPattern) {
      const day = Number(brPattern[1]);
      const month = Number(brPattern[2]) - 1;
      const year = Number(
        brPattern[3].length === 2 ? `20${brPattern[3]}` : brPattern[3],
      );
      const hour = Number(brPattern[4] ?? 0);
      const minute = Number(brPattern[5] ?? 0);
      const second = Number(brPattern[6] ?? 0);
      const parsed = new Date(year, month, day, hour, minute, second);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
  }

  private parseSufferedViolence(raw: string | null): boolean | null {
    if (!raw) return null;
    const normalized = this.normalize(raw);

    if (['SIM', 'S', 'TRUE', 'YES'].includes(normalized)) return true;
    if (['NAO', 'NÃO', 'N', 'FALSE', 'NO'].includes(normalized)) return false;
    return null;
  }

  private parseViolenceTypes(raw: string | null): string[] {
    if (!raw) return [];

    const tokens = raw
      .split(/[,;|\n]+/)
      .map((token) => token.trim())
      .filter((token) => Boolean(token) && this.normalize(token) !== '0');

    if (tokens.length === 0) return [];

    const normalized = new Set<string>();

    for (const token of tokens) {
      const normalizedToken = this.normalize(token);
      const alias = VIOLENCE_TYPE_ALIASES.find((item) =>
        normalizedToken.includes(this.normalize(item.match)),
      );
      if (alias) {
        normalized.add(alias.label);
        continue;
      }
      normalized.add(this.toTitleCaseWithAccents(token));
    }

    const ordered = [...normalized];
    ordered.sort((a, b) => {
      const ia = KNOWN_VIOLENCE_TYPES.indexOf(
        a as (typeof KNOWN_VIOLENCE_TYPES)[number],
      );
      const ib = KNOWN_VIOLENCE_TYPES.indexOf(
        b as (typeof KNOWN_VIOLENCE_TYPES)[number],
      );
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b, 'pt-BR');
    });

    return ordered;
  }

  private toTitleCaseWithAccents(value: string) {
    return value
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((chunk) => `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`)
      .join(' ')
      .trim();
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toUpperCase();
  }

  private cleanCell(value: string | number | boolean | Date | null) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 'SIM' : 'NAO';
    return String(value).trim() || null;
  }

  private getCell(row: string[], index: number) {
    if (index < 0 || index >= row.length) return null;
    const value = row[index] ?? '';
    return String(value).trim() || null;
  }
}
