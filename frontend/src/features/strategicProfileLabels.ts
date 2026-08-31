const STRATEGIC_PROFILE_LABELS: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  NAO_INFORMADO: "Não informado",
  "NAO INFORMADO": "Não informado",

  "15_18": "15 a 18 anos",
  "19_25": "19 a 25 anos",
  "26_30": "26 a 30 anos",
  "31_35": "31 a 35 anos",
  "36_40": "36 a 40 anos",
  "41_45": "41 a 45 anos",
  "46_50": "46 a 50 anos",
  "51_55": "51 a 55 anos",
  MAIOR_55: "Mais de 55 anos",

  ASSEDIO_MORAL: "Assédio moral",
  ASSEDIO_SEXUAL: "Assédio sexual",
  VIOLENCIA_DOMESTICA_FISICA: "Violência doméstica física",
  VIOLENCIA_DOMESTICA_PSICOLOGICA: "Violência doméstica psicológica",
  VIOLENCIA_DOMESTICA_MORAL: "Violência doméstica moral",
  VIOLENCIA_DOMESTICA_PATRIMONIAL: "Violência doméstica patrimonial",
  VIOLENCIA_DOMESTICA_SEXUAL: "Violência doméstica sexual",
  VIOLENCIA_DOMESTICA_VICARIA: "Violência doméstica vicária",
  IMPORTUNACAO_SEXUAL: "Importunação sexual",
  INJURIA_RACIAL: "Injúria racial",
  INJURIA: "Injúria",
  CALUNIA: "Calúnia",
  DIFAMACAO: "Difamação",
  DISCRIMINACAO: "Discriminação",
  DENUNCIACAO_CALUNIOSA: "Denunciação caluniosa",
  ATO_DE_LIBIDINAGEM: "Ato de libidinagem",
  PRESUNCAO_DE_VIOLENCIA: "Presunção de violência",
  CORRUPCAO_DE_MENORES: "Corrupção de menores",
  ESTUPRO_DE_VULNERAVEL: "Estupro de vulnerável",
  SEDUCAO: "Sedução",
  REGISTRO_NAO_AUTORIZADO_DE_INTIMIDADE_SEXUAL:
    "Registro não autorizado de intimidade sexual",
  VIOLACAO_SEXUAL_MEDIANTE_FRAUDE: "Violação sexual mediante fraude",
  ESTUPRO: "Estupro",

  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",

  INTERIOR_OM: "Interior da OM",
  EVENTO_EXTERNO_RELACIONADO_TRABALHO: "Evento externo relacionado ao trabalho",
  EVENTO_EXTERNO_NAO_RELACIONADO_TRABALHO:
    "Evento externo não relacionado ao trabalho",
  AMBIENTE_PESSOAL: "Ambiente pessoal",
  VIA_PUBLICA: "Via pública",
  TRANSPORTE_PUBLICO: "Transporte público",
  TRANSPORTE_INSTITUCIONAL: "Transporte institucional",
  RESIDENCIA_ACUSADOR: "Residência do acusador",
  APLICATIVOS_MENSAGERIA: "Aplicativos de mensagens instantâneas",
  EMAIL: "E-mail",
  REUNIAO_ONLINE_TRABALHO: "Reunião on-line de trabalho",
  REDES_SOCIAIS: "Redes sociais",
  RESIDENCIA_VITIMA_NOTICIANTE: "Residência da vítima ou noticiante",

  UMA_VEZ: "Uma vez",
  DUAS_VEZES: "Duas vezes",
  TRES_VEZES: "Três vezes",
  QUATRO_VEZES: "Quatro vezes",
  CINCO_VEZES: "Cinco vezes",
  MAIOR_CINCO: "Maior que cinco vezes",

  HUMILHACAO_PUBLICA: "Humilhação pública",
  EXCLUSAO_ISOLAMENTO: "Exclusão/Isolamento",
  AMEACAS_INTIMIDACAO: "Ameaças/Intimidação",
  CRITICAS_EXCESSIVAS: "Críticas excessivas",
  INJUSTICAS: "Injustiças",
  COMENTARIOS_SEXISTAS: "Comentários sexistas",
  CONTATO_FISICO_INDESEJADO: "Contato físico indesejado",
  TENTATIVA_CONTATO_FISICO_INDEVIDO: "Tentativa de contato físico indevido",
  CHANTAGEM_INTIMIDACAO_FAVOR_SEXUAL:
    "Chantagem ou intimidação para obter favores sexuais",
  VIOLENCIA_FISICA: "Violência física",
  VIOLENCIA_PSICOLOGICA: "Violência psicológica",
  VIOLENCIA_PATRIMONIAL: "Violência patrimonial",
  OUTROS: "Outros",
  VIOLENCIA_SEXUAL: "Violência sexual",
  VIOLENCIA_MORAL: "Violência moral",
  VIGILANCIA_EXCESSIVA: "Vigilância excessiva",
  EXIBICAO_MATERIAL_PORNOGRAFICO: "Exibição de material pornográfico",
};

const PROFILE_ACRONYMS = new Set(["CPCA", "FAB", "OM", "SMIF"]);

export function formatStrategicProfileLabel(value: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Não informado";

  const knownLabel = STRATEGIC_PROFILE_LABELS[normalized.toUpperCase()];
  if (knownLabel) return knownLabel;

  const withoutTechnicalSeparators = normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (PROFILE_ACRONYMS.has(withoutTechnicalSeparators)) {
    return withoutTechnicalSeparators;
  }

  const looksLikeCode =
    withoutTechnicalSeparators === withoutTechnicalSeparators.toUpperCase() &&
    /[A-ZÀ-Ý]/.test(withoutTechnicalSeparators);

  if (!looksLikeCode) return withoutTechnicalSeparators;

  const lowerCaseLabel = withoutTechnicalSeparators.toLocaleLowerCase("pt-BR");
  return (
    lowerCaseLabel.charAt(0).toLocaleUpperCase("pt-BR") +
    lowerCaseLabel.slice(1)
  );
}
