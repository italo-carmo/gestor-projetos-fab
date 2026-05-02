export type BiSurveyQuestionItem = {
  id: string;
  label: string;
  group?: string;
  kind?: string;
};

export type BiSurveyColumnMeta = {
  key?: string | null;
  label?: string | null;
  type?: string | null;
  questionNumber?: number | null;
};

const PROFILE_TERMS = [
  "idade",
  "organizacao militar",
  "om",
  "om observada",
  "estado civil",
  "escolaridade",
  "naturalidade",
  "vinculo institucional",
  "posto",
  "graduacao",
  "genero",
  "especialidade",
  "identificacao",
];

const METADATA_KEYS = new Set([
  "id",
  "api_id",
  "aba",
  "linha",
  "submitted_at",
  "submittedat",
  "carimbo_de_data_hora",
]);

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isMetadataColumn(key: string, label: string) {
  const normalizedKey = normalizeForMatch(key).replace(/\s+/g, "_");
  const normalizedLabel = normalizeForMatch(label);

  return (
    METADATA_KEYS.has(normalizedKey) ||
    normalizedLabel === "timestamp" ||
    normalizedLabel === "carimbo de data/hora" ||
    normalizedLabel === "carimbo de data hora"
  );
}

function includesProfileTerm(value: string, term: string) {
  if (term.length <= 2) {
    return value.split(" ").includes(term);
  }

  return value.includes(term);
}

function resolveQuestionKind(column: BiSurveyColumnMeta) {
  const key = String(column.key ?? "");
  const label = String(column.label ?? "");
  const normalized = normalizeForMatch(`${key} ${label}`);

  if (PROFILE_TERMS.some((term) => includesProfileTerm(normalized, term))) {
    return "Perfil";
  }

  switch (column.type) {
    case "FREE_TEXT":
      return "Texto livre";
    case "MULTI_SELECT":
      return "Múltipla escolha";
    case "CATEGORICAL":
      return "Alternativa";
    default:
      return "Pergunta";
  }
}

function resolveQuestionGroup(column: BiSurveyColumnMeta, index: number) {
  if (typeof column.questionNumber === "number") {
    return `Q${column.questionNumber}`;
  }

  const kind = resolveQuestionKind(column);
  if (kind === "Perfil") return "Perfil";
  if (kind === "Texto livre") return "Texto";

  return `Campo ${index + 1}`;
}

export function buildBiSurveyQuestionsFromColumnsMeta(
  columnsMeta: BiSurveyColumnMeta[] | null | undefined,
  fallback: BiSurveyQuestionItem[] = [],
): BiSurveyQuestionItem[] {
  const questions = (columnsMeta ?? []).reduce<BiSurveyQuestionItem[]>(
    (items, column, index) => {
      const key = String(column.key ?? "").trim();
      const label = String(column.label ?? "").trim();

      if (!label || isMetadataColumn(key, label)) return items;

      items.push({
        id: key || `column-${index}`,
        label,
        group: resolveQuestionGroup(column, index),
        kind: resolveQuestionKind(column),
      });

      return items;
    },
    [],
  );

  return questions.length > 0 ? questions : fallback;
}

export const BI_DOMESTIC_VIOLENCE_QUESTIONS: BiSurveyQuestionItem[] = [
  { id: "idade", group: "Perfil", kind: "Perfil", label: "Idade" },
  {
    id: "organizacao_militar",
    group: "Perfil",
    kind: "Perfil",
    label: "Organização Militar",
  },
  {
    id: "estado_civil",
    group: "Perfil",
    kind: "Perfil",
    label: "Estado civil",
  },
  {
    id: "escolaridade",
    group: "Perfil",
    kind: "Perfil",
    label: "Escolaridade",
  },
  {
    id: "naturalidade",
    group: "Perfil",
    kind: "Perfil",
    label: "Naturalidade",
  },
  {
    id: "vinculo_fab",
    group: "Perfil",
    kind: "Perfil",
    label: "Vínculo institucional com a FAB",
  },
  {
    id: "posto_graduacao",
    group: "Perfil",
    kind: "Perfil",
    label: "Caso seja militar, indique o posto ou graduação",
  },
  {
    id: "sofreu_vida",
    group: "Q1",
    kind: "Alternativa",
    label:
      "Você sofreu algum tipo de violência doméstica no decorrer de sua vida?",
  },
  {
    id: "sofreu_12_meses",
    group: "Q2",
    kind: "Alternativa",
    label:
      "Nos últimos 12 meses, você sofreu algum tipo de violência doméstica?",
  },
  {
    id: "situacao_relatada",
    group: "Q3",
    kind: "Alternativa",
    label: "Indique qual situação você deseja relatar",
  },
  {
    id: "frequencia",
    group: "Q4",
    kind: "Alternativa",
    label: "Frequência da ocorrência",
  },
  {
    id: "vinculo_afetivo",
    group: "Q5",
    kind: "Alternativa",
    label: "Tipo de vínculo afetivo com o autor",
  },
  {
    id: "tipos_violencia",
    group: "Q6",
    kind: "Múltipla escolha",
    label: "Se sofreu violência, qual(is) tipo(s)?",
  },
  {
    id: "vinculo_autor",
    group: "Q7",
    kind: "Alternativa",
    label: "Qual é o tipo de vínculo com o autor do fato?",
  },
  {
    id: "autor_vinculo_militar",
    group: "Q8",
    kind: "Alternativa",
    label: "O autor da violência possui vínculo com instituição militar?",
  },
  {
    id: "local_fato",
    group: "Q9",
    kind: "Alternativa",
    label: "Onde ocorreu o fato?",
  },
  {
    id: "estado_fato",
    group: "Q10",
    kind: "Perfil",
    label: "Estado onde ocorreu o fato",
  },
  {
    id: "municipio_fato",
    group: "Q11",
    kind: "Perfil",
    label: "Município onde ocorreu o fato",
  },
  {
    id: "testemunhas",
    group: "Q12",
    kind: "Alternativa",
    label: "Houve testemunhas?",
  },
  {
    id: "impacto_intensidade",
    group: "Q13",
    kind: "Alternativa",
    label:
      "Em que intensidade você percebe o impacto da violência na sua vida?",
  },
  {
    id: "impacto_areas",
    group: "Q14",
    kind: "Múltipla escolha",
    label: "Em quais áreas você percebe maior impacto?",
  },
  {
    id: "canal_denuncia",
    group: "Q15",
    kind: "Alternativa",
    label: "Você procurou algum canal de denúncia?",
  },
  {
    id: "qual_canal",
    group: "Q16",
    kind: "Múltipla escolha",
    label: "Se sim, qual?",
  },
  {
    id: "motivos_nao_registrar",
    group: "Q17",
    kind: "Texto livre",
    label:
      "Se não procurou, quais foram os principais motivos para não registrar a ocorrência?",
  },
];

export const BI_RECRUITS_QUESTIONS: BiSurveyQuestionItem[] = [
  {
    id: "education",
    group: "Perfil",
    kind: "Perfil",
    label: "Perfil do entrevistado(a): escolaridade",
  },
  {
    id: "gender",
    group: "Perfil",
    kind: "Perfil",
    label: "Perfil do entrevistado(a): gênero",
  },
  {
    id: "identifyHarassment",
    group: "1.1",
    kind: "Alternativa",
    label:
      "Você consegue identificar situações de assédio no ambiente militar?",
  },
  {
    id: "conductLimits",
    group: "1.2",
    kind: "Alternativa",
    label: "Você compreende os limites de conduta no ambiente militar?",
  },
  {
    id: "knowOrientation",
    group: "2.1",
    kind: "Alternativa",
    label:
      "Você sabe a quem recorrer caso precise de orientação relacionada ao assédio?",
  },
  {
    id: "knowReportProcess",
    group: "2.2",
    kind: "Alternativa",
    label:
      "Você sabe como registrar formalmente uma ocorrência relacionada ao assédio?",
  },
  {
    id: "willingnessOrientation",
    group: "3.1",
    kind: "Alternativa",
    label:
      "Caso precisasse procurar orientação institucional sobre assédio, como avaliaria sua disposição?",
  },
  {
    id: "willingnessReport",
    group: "3.2",
    kind: "Alternativa",
    label:
      "Caso precisasse registrar uma ocorrência relacionada ao assédio, como avaliaria sua disposição?",
  },
  {
    id: "enlistmentDecisionInfluenceText",
    group: "Q4",
    kind: "Alternativa",
    label: "Ao ingressar na FAB, o que mais influenciou sua decisão?",
  },
  {
    id: "suggestionComment",
    group: "Q5",
    kind: "Texto livre",
    label: "Se desejar, registre sugestão ou comentário",
  },
];

export const BI_BEST_PRACTICES_CYCLE_QUESTIONS: BiSurveyQuestionItem[] = [
  {
    id: "technicalRigorPerception",
    group: "Q1",
    kind: "Alternativa",
    label:
      "É possível manter o rigor técnico-militar na formação de turmas mistas?",
  },
  {
    id: "preparednessToLeadMixedClass",
    group: "Q2",
    kind: "Alternativa",
    label: "Sinto-me preparado para conduzir a formação de turmas mistas",
  },
  {
    id: "genderBiasImpact",
    group: "Q3",
    kind: "Alternativa",
    label:
      "Vieses de gênero podem influenciar decisões e práticas no contexto da instrução militar?",
  },
  {
    id: "interactionDifference",
    group: "Q4",
    kind: "Alternativa",
    label: "Há diferença na forma como os recrutas interagem em turmas mistas?",
  },
  {
    id: "interactionDifferenceComment",
    group: "Q5",
    kind: "Texto livre",
    label: "Caso tenha assinalado sim, descreva brevemente essa diferença",
  },
  {
    id: "supportNeedRecognition",
    group: "Q6",
    kind: "Alternativa",
    label:
      "Consigo identificar situações que demandam apoio do Assistente Social e/ou Psicólogo",
  },
  {
    id: "mainChallengeOptions",
    group: "Q7",
    kind: "Múltipla escolha",
    label: "Qual é o principal desafio na condução da primeira turma feminina?",
  },
  {
    id: "identification",
    group: "Perfil",
    kind: "Perfil",
    label: "Identificação",
  },
  {
    id: "specialty",
    group: "Perfil",
    kind: "Perfil",
    label: "Qual sua especialidade?",
  },
];

export const BI_CPCA_MEETING_QUESTIONS: BiSurveyQuestionItem[] = [
  {
    id: "q01_qual_a_sua_especialidade",
    group: "Perfil",
    kind: "Perfil",
    label: "Qual a sua especialidade?",
  },
  {
    id: "q02_procedimentos_administrativos",
    group: "Q2",
    kind: "Alternativa",
    label:
      "Você se sente confiante para aplicar corretamente os procedimentos administrativos de apuração?",
  },
  {
    id: "q03_ica_30_13",
    group: "Q3",
    kind: "Alternativa",
    label: "Você compreende os aspectos jurídicos presentes na ICA 30-13/2024?",
  },
  {
    id: "q04_escuta_ativa",
    group: "Q4",
    kind: "Alternativa",
    label:
      "Você se sente preparado para aplicar técnicas de escuta ativa e empática?",
  },
  {
    id: "q05_crises_emocionais",
    group: "Q5",
    kind: "Alternativa",
    label:
      "Você se sente confiante para lidar com manejo imediato de crises emocionais?",
  },
  {
    id: "q06_rede_protecao",
    group: "Q6",
    kind: "Alternativa",
    label: "Sua CPCA possui conhecimento detalhado da rede de proteção local?",
  },
  {
    id: "q07_recursos_logisticos",
    group: "Q7",
    kind: "Alternativa",
    label: "A CPCA dispõe de recursos logísticos adequados?",
  },
  {
    id: "q08_confianca_efetivo",
    group: "Q8",
    kind: "Alternativa",
    label:
      "Os militares da sua OM demonstram confiança e segurança para procurar a CPCA?",
  },
  {
    id: "q09_preparacao_pos_palestra",
    group: "Q9",
    kind: "Alternativa",
    label:
      "Após a palestra, você se sente mais preparado(a) para identificar e prevenir situações?",
  },
  {
    id: "q10_maior_obstaculo",
    group: "Q10",
    kind: "Texto livre",
    label: "Qual é o maior obstáculo prático?",
  },
  {
    id: "comentarios_e_sugestoes",
    group: "Texto",
    kind: "Texto livre",
    label: "Comentários e sugestões",
  },
  {
    id: "organizacao_militar",
    group: "Perfil",
    kind: "Perfil",
    label: "Organização Militar",
  },
];

export const BI_GSD_EVALUATION_QUESTIONS: BiSurveyQuestionItem[] = [
  {
    id: "om_observada",
    group: "Perfil",
    kind: "Perfil",
    label: "OM observada",
  },
  {
    id: "item_observado_1",
    group: "Q1",
    kind: "Alternativa",
    label:
      "Existem materiais informativos visíveis sobre prevenção ao assédio?",
  },
  {
    id: "item_observado_2",
    group: "Q2",
    kind: "Alternativa",
    label: "Existem materiais informativos visíveis sobre violência doméstica?",
  },
  {
    id: "item_observado_3",
    group: "Q3",
    kind: "Alternativa",
    label:
      "Os canais de denúncia estão visíveis em locais acessíveis ao efetivo?",
  },
  {
    id: "item_observado_4",
    group: "Q4",
    kind: "Alternativa",
    label:
      "Há sala ou espaço reservado que garanta sigilo e privacidade para atendimento?",
  },
  {
    id: "item_observado_5",
    group: "Q5",
    kind: "Alternativa",
    label: "A identificação dos membros da CPCA está acessível ao efetivo?",
  },
  {
    id: "item_observado_6",
    group: "Q6",
    kind: "Alternativa",
    label:
      "Os contatos dos canais de denúncia estão atualizados e em perfeito estado de leitura?",
  },
  {
    id: "item_observado_7",
    group: "Q7",
    kind: "Alternativa",
    label: "Há local adequado para realizar palestras e capacitações?",
  },
  {
    id: "item_observado_8",
    group: "Q8",
    kind: "Alternativa",
    label:
      "Há evidências de ações prévias de prevenção ao assédio realizadas pela OM?",
  },
  {
    id: "item_observado_9",
    group: "Q9",
    kind: "Alternativa",
    label:
      "O ambiente demonstra abertura e respeito à diversidade durante a visita?",
  },
  {
    id: "observacoes_complementares",
    group: "Texto",
    kind: "Texto livre",
    label: "Observações complementares",
  },
];
