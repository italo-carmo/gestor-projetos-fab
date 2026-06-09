import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  MenuItem,
  Popover,
  Stack,
  Step,
  StepButton,
  Stepper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useCpcaCase,
  useCpcaCases,
  useCpcaCaseHistory,
  useCpcaCaseLocalityOptions,
  useCpcaCasePendingSummary,
  useCpcaCaseValidationSummary,
  useCreateCpcaCaseCipavdThread,
  useCreateCpcaCase,
  useDeleteCpcaCase,
  useFinalizeCpcaCaseCipavdThread,
  useLocalities,
  useMarkCpcaCaseSeen,
  useMarkSmifComplaintSeen,
  useMe,
  usePostoOptions,
  useReopenCpcaCaseCipavdThread,
  useResolveCpcaCaseCipavdThread,
  useRemoveCpcaCaseCipavdThread,
  useSmifComplaintCase,
  useSmifComplaintCases,
  useSmifComplaintPendingSummary,
  useCreateSmifComplaintCaseCipavdThread,
  useCreateSmifComplaintCase,
  useDeleteSmifComplaintCase,
  useFinalizeSmifComplaintCaseCipavdThread,
  useReopenSmifComplaintCaseCipavdThread,
  useResolveSmifComplaintCaseCipavdThread,
  useRemoveSmifComplaintCaseCipavdThread,
  useUpdateSmifComplaintCase,
  useUpdateCpcaCaseCipavdThread,
  useUpdateCpcaCase,
  useUpdateSmifComplaintCaseCipavdThread,
  useValidateCpcaCase,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from "../app/roleAccess";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import {
  getCpcaCaseInconsistencies,
  syncCpcaWorkflowStatus,
  type CpcaCaseInconsistency,
} from "../features/cpcaCaseConsistency";
import {
  formatComplaintCaseNumberForDisplay,
  getComplaintPendingKpiLabel,
  getComplaintPendingStatusTone,
  getComplaintPendencyBadge,
  normalizeComplaintCipavdSummary,
  sortComplaintPendingItems,
} from "../features/cpcaCipavdThreads";
import {
  buildComplaintSummaryHighlightSegments,
  extractComplaintSummaryPrivacyReview,
  hasComplaintSummaryChanged,
  type ComplaintSummaryPrivacyReview,
} from "../features/complaintSummaryPrivacy";
import {
  getComplaintArchiveReasonMeta,
  isComplaintArchiveReasonRequired,
} from "../features/complaintArchiveReason";

const STATUS_OPTIONS = [
  { value: "RECEIVED", label: "Recebida" },
  { value: "PROTECTION_MEASURES", label: "Acolhimento e proteção" },
  { value: "PRELIMINARY_ANALYSIS", label: "Análise preliminar" },
  { value: "PROCEDURE_DEFINED", label: "Procedimento instaurado" },
  { value: "INVESTIGATION", label: "Em apuração" },
  { value: "CONCLUDED", label: "Concluída" },
  { value: "ARCHIVED", label: "Arquivada" },
];

const CPCA_HISTORY_ACTION_OPTIONS = [
  { value: "create", label: "Criação" },
  { value: "update", label: "Atualização" },
  { value: "delete", label: "Exclusão" },
  { value: "comment", label: "Comentário" },
  { value: "cipavd_pendency_create", label: "Pendência registrada" },
  { value: "cipavd_pendency_update", label: "Pendência modificada" },
  { value: "cipavd_pendency_resolve", label: "Pendência respondida" },
  { value: "cipavd_pendency_reopen", label: "Pendência reaberta" },
  { value: "cipavd_pendency_finalize", label: "Pendência finalizada" },
  { value: "cipavd_pendency_delete", label: "Pendência excluída" },
  { value: "cipavd_comment_create", label: "Comentário da gestão" },
  { value: "validation", label: "Validação da comissão" },
];

const STATUS_CHIP_STYLES: Record<
  string,
  { bgcolor: string; color: string; borderColor: string }
> = {
  RECEIVED: {
    bgcolor: "rgba(30, 136, 229, 0.14)",
    color: "#0D47A1",
    borderColor: "rgba(30, 136, 229, 0.3)",
  },
  PROTECTION_MEASURES: {
    bgcolor: "rgba(0, 121, 107, 0.14)",
    color: "#00695C",
    borderColor: "rgba(0, 121, 107, 0.3)",
  },
  PRELIMINARY_ANALYSIS: {
    bgcolor: "rgba(251, 140, 0, 0.14)",
    color: "#E65100",
    borderColor: "rgba(251, 140, 0, 0.3)",
  },
  PROCEDURE_DEFINED: {
    bgcolor: "rgba(142, 36, 170, 0.14)",
    color: "#6A1B9A",
    borderColor: "rgba(142, 36, 170, 0.3)",
  },
  INVESTIGATION: {
    bgcolor: "rgba(94, 53, 177, 0.14)",
    color: "#4527A0",
    borderColor: "rgba(94, 53, 177, 0.3)",
  },
  CONCLUDED: {
    bgcolor: "rgba(46, 125, 50, 0.14)",
    color: "#1B5E20",
    borderColor: "rgba(46, 125, 50, 0.3)",
  },
  ARCHIVED: {
    bgcolor: "rgba(84, 110, 122, 0.16)",
    color: "#37474F",
    borderColor: "rgba(84, 110, 122, 0.3)",
  },
};

const COMPLAINT_TYPE_OPTIONS = [
  { value: "MORAL", label: "Assédio moral" },
  { value: "SEXUAL", label: "Assédio sexual" },
];

const NOTIFIER_TYPE_OPTIONS = [
  { value: "VITIMA", label: "Vítima" },
  { value: "TESTEMUNHA", label: "Testemunha" },
  { value: "TERCEIRO", label: "Terceiro" },
];

const PROCEDURE_OPTIONS = [
  { value: "NOT_DEFINED", label: "Não definido" },
  { value: "PATD", label: "PATD" },
  { value: "APF", label: "APF" },
  { value: "SINDICANCIA", label: "Sindicância" },
  { value: "PAD", label: "PAD" },
  { value: "IPM", label: "IPM" },
  { value: "BOLETIM_OCORRENCIA", label: "Boletim de ocorrência" },
  { value: "INQUERITO_CIVIL", label: "Inquérito civil" },
  { value: "NAO_HOUVE", label: "Não houve" },
  { value: "INQUERITO_POLICIAL_COMUM", label: "Inquérito Policial Comum" },
  { value: "NOTICIA_FATO", label: "Notícia de Fato" },
  { value: "CONSELHO_DISCIPLINA", label: "Conselho de Disciplina" },
  { value: "CONSELHO_JUSTIFICACAO", label: "Conselho de Justificação" },
];

const GENDER_OPTIONS = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMININO", label: "Feminino" },
  { value: "NAO_INFORMADO", label: "Não informado" },
];

const DETAILED_VIOLENCE_TYPE_OPTIONS: Array<{
  value: string;
  label: string;
  macroComplaintType: "MORAL" | "SEXUAL";
}> = [
  {
    value: "ASSEDIO_MORAL",
    label: "Assédio Moral",
    macroComplaintType: "MORAL",
  },
  {
    value: "ASSEDIO_SEXUAL",
    label: "Assédio Sexual",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "VIOLENCIA_DOMESTICA_FISICA",
    label: "Violência doméstica - Física",
    macroComplaintType: "MORAL",
  },
  {
    value: "VIOLENCIA_DOMESTICA_PSICOLOGICA",
    label: "Violência doméstica - Psicológica",
    macroComplaintType: "MORAL",
  },
  {
    value: "VIOLENCIA_DOMESTICA_MORAL",
    label: "Violência doméstica - Moral",
    macroComplaintType: "MORAL",
  },
  {
    value: "VIOLENCIA_DOMESTICA_PATRIMONIAL",
    label: "Violência doméstica - Patrimonial",
    macroComplaintType: "MORAL",
  },
  {
    value: "VIOLENCIA_DOMESTICA_SEXUAL",
    label: "Violência doméstica - Sexual",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "VIOLENCIA_DOMESTICA_VICARIA",
    label: "Violência doméstica - Vicária",
    macroComplaintType: "MORAL",
  },
  {
    value: "IMPORTUNACAO_SEXUAL",
    label: "Importunação sexual",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "INJURIA_RACIAL",
    label: "Injúria racial",
    macroComplaintType: "MORAL",
  },
  {
    value: "INJURIA",
    label: "Injúria",
    macroComplaintType: "MORAL",
  },
  {
    value: "CALUNIA",
    label: "Calúnia",
    macroComplaintType: "MORAL",
  },
  {
    value: "DIFAMACAO",
    label: "Difamação",
    macroComplaintType: "MORAL",
  },
  {
    value: "DISCRIMINACAO",
    label: "Discriminação",
    macroComplaintType: "MORAL",
  },
  {
    value: "DENUNCIACAO_CALUNIOSA",
    label: "Denunciação caluniosa",
    macroComplaintType: "MORAL",
  },
  {
    value: "ATO_DE_LIBIDINAGEM",
    label: "Ato de libidinagem",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "PRESUNCAO_DE_VIOLENCIA",
    label: "Presunção de violência",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "CORRUPCAO_DE_MENORES",
    label: "Corrupção de menores",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "ESTUPRO_DE_VULNERAVEL",
    label: "Estupro de vulnerável",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "SEDUCAO",
    label: "Sedução",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "REGISTRO_NAO_AUTORIZADO_DE_INTIMIDADE_SEXUAL",
    label: "Registro não autorizado de intimidade sexual",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "VIOLACAO_SEXUAL_MEDIANTE_FRAUDE",
    label: "Violação sexual mediante fraude",
    macroComplaintType: "SEXUAL",
  },
  {
    value: "ESTUPRO",
    label: "Estupro",
    macroComplaintType: "SEXUAL",
  },
];

const HARASSMENT_CONTEXT_OPTIONS = [
  { value: "PRESENCIAL", label: "Presencial" },
  { value: "VIRTUAL", label: "Virtual" },
];

const OCCURRENCE_LOCATION_OPTIONS = [
  { value: "INTERIOR_OM", label: "Interior da OM" },
  {
    value: "EVENTO_EXTERNO_RELACIONADO_TRABALHO",
    label: "Eventos externos relacionados ao trabalho",
  },
  {
    value: "EVENTO_EXTERNO_NAO_RELACIONADO_TRABALHO",
    label: "Eventos externos não relacionados ao trabalho",
  },
  { value: "AMBIENTE_PESSOAL", label: "Ambiente pessoal" },
  { value: "VIA_PUBLICA", label: "Via pública" },
  { value: "TRANSPORTE_PUBLICO", label: "Transporte Público" },
  { value: "TRANSPORTE_INSTITUCIONAL", label: "Transporte Institucional" },
  { value: "RESIDENCIA_ACUSADOR", label: "Residência do acusador" },
  {
    value: "APLICATIVOS_MENSAGERIA",
    label: "Aplicativos de mensagens instantâneas (ex.: WhatsApp, Telegram)",
  },
  { value: "EMAIL", label: "E-mail (institucional ou pessoal)" },
  {
    value: "REUNIAO_ONLINE_TRABALHO",
    label: "Reuniões online de trabalho (ex.: Webex, Teams, Zoom, Meet)",
  },
  {
    value: "REDES_SOCIAIS",
    label: "Redes sociais (posts, comentários ou mensagens privadas)",
  },
  {
    value: "RESIDENCIA_VITIMA_NOTICIANTE",
    label: "Residência da vítima e/ou noticiante",
  },
];

const AGE_RANGE_OPTIONS = [
  { value: "15_18", label: "15 a 18 anos" },
  { value: "19_25", label: "19 a 25 anos" },
  { value: "26_30", label: "26 a 30 anos" },
  { value: "31_35", label: "31 a 35 anos" },
  { value: "36_40", label: "36 a 40 anos" },
  { value: "41_45", label: "41 a 45 anos" },
  { value: "46_50", label: "46 a 50 anos" },
  { value: "51_55", label: "51 a 55 anos" },
  { value: "MAIOR_55", label: "Mais de 55 anos" },
];

const INCIDENT_FREQUENCY_OPTIONS = [
  { value: "UMA_VEZ", label: "Uma vez" },
  { value: "DUAS_VEZES", label: "Duas vezes" },
  { value: "TRES_VEZES", label: "Três vezes" },
  { value: "QUATRO_VEZES", label: "Quatro vezes" },
  { value: "CINCO_VEZES", label: "Cinco vezes" },
  { value: "MAIOR_CINCO", label: "Maior que cinco vezes" },
];

const FUNCTIONAL_RELATION_OPTIONS = [
  { value: "SUPERIOR_HIERARQUICO", label: "Superior hierárquico" },
  { value: "CHEFE_IMEDIATO", label: "Chefe imediato" },
  { value: "SUBORDINADO", label: "Subordinado" },
  { value: "SUBORDINADO_DIRETO", label: "Subordinado direto" },
  { value: "MESMA_GRADUACAO", label: "Mesma Graduação" },
  { value: "INSTRUTOR_PROFESSOR", label: "Instrutor/Professor" },
  { value: "ALUNO", label: "Aluno" },
  { value: "PRESTADOR_SERVICO", label: "Prestador de serviço" },
  { value: "CONJUGE", label: "Cônjuge" },
  { value: "OUTROS", label: "Outros" },
  { value: "CIVIL", label: "Civil" },
  { value: "CONJUGE_MILITAR", label: "Cônjuge militar" },
  { value: "FAMILIAR", label: "Familiar" },
];

const OCCURRENCE_FORM_OPTIONS = [
  { value: "HUMILHACAO_PUBLICA", label: "Humilhação Pública" },
  { value: "EXCLUSAO_ISOLAMENTO", label: "Exclusão/Isolamento" },
  { value: "AMEACAS_INTIMIDACAO", label: "Ameaças/Intimidação" },
  { value: "CRITICAS_EXCESSIVAS", label: "Críticas excessivas" },
  { value: "INJUSTICAS", label: "Injustiças" },
  { value: "COMENTARIOS_SEXISTAS", label: "Comentários sexistas" },
  { value: "CONTATO_FISICO_INDESEJADO", label: "Contato físico indesejado" },
  {
    value: "TENTATIVA_CONTATO_FISICO_INDEVIDO",
    label: "Tentativa de contato físico indevido",
  },
  {
    value: "CHANTAGEM_INTIMIDACAO_FAVOR_SEXUAL",
    label: "Chantagem ou intimidação para obter favores sexuais",
  },
  { value: "VIOLENCIA_FISICA", label: "Violência física" },
  { value: "VIOLENCIA_PSICOLOGICA", label: "Violência psicológica" },
  { value: "VIOLENCIA_PATRIMONIAL", label: "Violência patrimonial" },
  { value: "OUTROS", label: "Outros" },
  { value: "VIOLENCIA_SEXUAL", label: "Violência Sexual" },
  { value: "VIOLENCIA_MORAL", label: "Violência Moral" },
  { value: "VIGILANCIA_EXCESSIVA", label: "Vigilância Excessiva" },
  {
    value: "EXIBICAO_MATERIAL_PORNOGRAFICO",
    label: "Exibição de Material Pornográfico",
  },
];

const NOT_INFORMED_RANK_VALUE = "NAO INFORMADO";
const NOT_INFORMED_RANK_LABEL = "Não informado";
const LONG_SELECT_MENU_PROPS = {
  PaperProps: {
    sx: {
      maxHeight: 360,
    },
  },
  MenuListProps: {
    dense: true,
  },
};
const RANK_SELECT_MENU_PROPS = {
  ...LONG_SELECT_MENU_PROPS,
  PaperProps: {
    sx: {
      maxHeight: 300,
    },
  },
};
const MULTI_SELECT_CHECKBOX_SX = {
  p: 0,
  mr: 1,
  color: "text.secondary",
  "&.Mui-checked": {
    color: "primary.main",
  },
};

const PROCEDURE_CURRENT_SITUATION_OPTIONS = [
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  {
    value: "MEDIDA_DISCIPLINAR_APLICADA",
    label: "Medida disciplinar aplicada",
  },
  { value: "OFERECIDA_DENUNCIA", label: "Oferecida a denúncia" },
  { value: "ARQUIVADO_PELA_JUSTICA", label: "Arquivado pela justiça" },
  { value: "CONDENADO_PELA_JUSTICA", label: "Condenado pela Justiça" },
  { value: "TRANSFERENCIA_ACUSADO", label: "Transferência do acusado" },
  { value: "TRANSFERENCIA_ACUSADOR", label: "Transferência do acusador" },
  { value: "MEDIDA_PROTETIVA", label: "Medida Protetiva" },
  { value: "OUTROS", label: "Outros" },
  { value: "NAO_APLICAVEL", label: "Não aplicável" },
];

const RETALIATION_REPORTED_OPTIONS = [
  { value: "SIM", label: "Sim" },
  { value: "NAO", label: "Não" },
  { value: "NAO_INFORMADO", label: "Não informado" },
];

const RETALIATION_TARGET_OPTIONS = [
  { value: "VITIMA", label: "Vítima" },
  { value: "TESTEMUNHAS", label: "Testemunhas" },
  { value: "SINDICANTE", label: "Sindicante" },
  { value: "ENCARREGADO_INQUERITO", label: "Encarregado de inquérito" },
  { value: "NAO_OCORREU_RETALIACAO", label: "Não ocorreu retaliação" },
];

const STEP_STATUS_OPTIONS: Record<number, string[]> = {
  0: ["RECEIVED", "PROTECTION_MEASURES"],
  1: ["PROTECTION_MEASURES", "PRELIMINARY_ANALYSIS"],
  2: ["PRELIMINARY_ANALYSIS", "PROCEDURE_DEFINED", "INVESTIGATION"],
  3: ["INVESTIGATION", "CONCLUDED", "ARCHIVED"],
};

const SEPARATION_OPTIONS = [
  { value: "NAO_AVALIADA", label: "Não avaliada" },
  { value: "AVALIADA_NAO_APLICADA", label: "Avaliada e não aplicada" },
  { value: "APLICADA", label: "Aplicada" },
];

const STEP_DEFS = [
  {
    title: "1) Notificação e fato",
    subtitle:
      "ICA Art. 47: registro inicial, dados genéricos e resumo do fato.",
  },
  {
    title: "2) Acolhimento e proteção",
    subtitle: "ICA Arts. 48 a 50: medidas imediatas e suporte à vítima.",
  },
  {
    title: "3) Triagem e apuração",
    subtitle: "ICA Art. 51: análise preliminar e procedimento cabível.",
  },
  {
    title: "4) Condução e encerramento",
    subtitle: "ICA Arts. 52 a 57: devolutivas, retaliação, defesa e conclusão.",
  },
];

const FORM_SECTION_HEADER_SX = {
  gridColumn: "1 / -1",
  display: "flex",
  flexDirection: "column",
  gap: 0.75,
} as const;

const FORM_SECTION_HEADER_WITH_SPACING_SX = {
  ...FORM_SECTION_HEADER_SX,
  mt: { xs: 1.75, md: 2.5 },
  pt: { xs: 0.25, md: 0.5 },
} as const;

const ACTIVE_STEP_HEADER_SX = {
  mt: { xs: 2, md: 2.75 },
  mb: { xs: 2, md: 2.5 },
  pt: { xs: 1.5, md: 2 },
  borderTop: "1px solid",
  borderColor: "divider",
  display: "flex",
  flexDirection: "column",
  gap: 0.75,
} as const;

function formatDateInputValue(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateInputValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDateInputValue(parsed);
}

function createDefaultForm() {
  return {
    localityId: "",
    complaintType: "MORAL",
    notifierType: "VITIMA",
    status: "RECEIVED",
    procedureType: "NOT_DEFINED",
    reportedAt: formatDateInputValue(new Date()),
    incidentDate: "",
    aggressorRank: "",
    aggressorGender: "NAO_INFORMADO",
    aggressorAgeRange: "",
    victimRank: "",
    victimGender: "NAO_INFORMADO",
    victimAgeRange: "",
    victimIsNotifier: true,
    notifierRank: "",
    notifierGender: "NAO_INFORMADO",
    notifierAgeRange: "",
    detailedViolenceType: "",
    harassmentContext: "",
    occurrenceLocation: "",
    incidentFrequency: "",
    hierarchicalFunctionalRelation: "",
    occurrenceForms: [] as string[],
    procedureCurrentSituation: "",
    evidenceSummary: "",
    confidentialityTermSigned: false,
    confidentialityHandlingNotes: "",
    cpcaMembersExcludedFromInquiry: true,
    immediateProtectionMeasures: "",
    privateSupportActions: "",
    psychologicalSupportProvided: false,
    medicalSupportProvided: false,
    socialSupportProvided: false,
    legalSupportProvided: false,
    contactRestrictionApplied: false,
    preliminaryReportGenerated: false,
    preliminaryReportDate: "",
    procedureReference: "",
    womenLedHandlingPrioritized: false,
    victimAccusedSeparationEvaluated: false,
    victimAccusedSeparationApplied: false,
    accusedDefenseEnsured: false,
    outcomeSummary: "",
    archiveReason: "",
    notifierFeedbackSummary: "",
    victimFeedbackSummary: "",
    notifierFeedbackDate: "",
    victimFeedbackDate: "",
    retaliationRisk: false,
    retaliationReported: "NAO_INFORMADO",
    retaliationAgainst: "",
    retaliationNotes: "",
    outsourcedAccused: false,
    contractorReferralDate: "",
    contractorFollowUpNotes: "",
    statusChangeNote: "",
  };
}

function formatOmLabel(locality: any) {
  const code = String(locality?.code ?? "").trim();
  const name = String(locality?.name ?? "").trim();
  if (
    code &&
    name &&
    code.localeCompare(name, "pt-BR", { sensitivity: "accent" }) === 0
  ) {
    return code;
  }
  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
}

function toNullable(value: string) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function inferMacroComplaintTypeFromDetailed(
  detailedViolenceType: string,
): "MORAL" | "SEXUAL" | null {
  const normalized = String(detailedViolenceType ?? "").trim();
  if (!normalized) return null;
  return (
    DETAILED_VIOLENCE_TYPE_OPTIONS.find((item) => item.value === normalized)
      ?.macroComplaintType ?? null
  );
}

function getDetailedViolenceTypeLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return (
    DETAILED_VIOLENCE_TYPE_OPTIONS.find((item) => item.value === normalized)
      ?.label ?? normalized
  );
}

function getComplaintTypeLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return (
    COMPLAINT_TYPE_OPTIONS.find((item) => item.value === normalized)?.label ??
    normalized
  );
}

function formatHistoryValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) {
    return value.length ? value.map(formatHistoryValue).join(", ") : "-";
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const raw = String(value);
  const parsedDate = /^\d{4}-\d{2}-\d{2}T/.test(raw) ? new Date(raw) : null;
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleString("pt-BR");
  }
  return raw;
}

function formatHistoryActor(actor: any) {
  const name = String(actor?.name ?? "").trim();
  const email = String(actor?.email ?? "").trim();
  if (name && email) return `${name} (${email})`;
  return name || email || "Sistema";
}

function formatHistoryOm(om: any) {
  const code = String(om?.code ?? "").trim();
  const name = String(om?.name ?? "").trim();
  return code && name ? `${code} - ${name}` : code || name || "-";
}

function formatDateTimePtBr(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function getValidationActorName(validation: any) {
  return (
    String(validation?.validatedByName ?? "").trim() ||
    String(validation?.validatedBy?.name ?? "").trim() ||
    "Militar não informado"
  );
}

function getValidationTooltip(validation: any) {
  if (!validation?.isValidated) return "Denúncia aguardando validação";
  return `Validada por ${getValidationActorName(validation)} em ${formatDateTimePtBr(
    validation.validatedAt,
  )}`;
}

function statusOptionsForStep(step: number, currentStatus: string) {
  const allowed = new Set(STEP_STATUS_OPTIONS[step] ?? []);
  if (currentStatus) allowed.add(currentStatus);
  return STATUS_OPTIONS.filter((item) => allowed.has(item.value));
}

type CpcaCasesPageProps = {
  workflow?: "CPCA" | "SMIF";
};

export function CpcaCasesPage({ workflow = "CPCA" }: CpcaCasesPageProps) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: me, isLoading: meLoading } = useMe();
  const isSmifWorkflow = workflow === "SMIF";
  const resourceKey = isSmifWorkflow ? "smif_complaints" : "cpca_cases";
  const canAccessByRole = can(me, resourceKey, "view");
  const canCreateCase = can(me, resourceKey, "create");
  const canUpdateCase = can(me, resourceKey, "update");
  const canDeleteCase = can(me, resourceKey, "delete");
  const canValidateCpcaCaseByProfile =
    !isSmifWorkflow &&
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP]);
  const canValidateCpcaCase = canValidateCpcaCaseByProfile && canUpdateCase;

  const q = params.get("q") ?? "";
  const localityId = params.get("localityId") ?? "";
  const status = params.get("status") ?? "";
  const detailedViolenceType = params.get("detailedViolenceType") ?? "";
  const procedureType = params.get("procedureType") ?? "";
  const validationStatus = isSmifWorkflow
    ? ""
    : (params.get("validationStatus") ?? "");
  const pageSizeParam = String(params.get("pageSize") ?? "20")
    .trim()
    .toLowerCase();
  const showAllRows = pageSizeParam === "all";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = showAllRows
    ? -1
    : Math.min(100, Math.max(10, Number(params.get("pageSize") ?? 20) || 20));

  const filters = useMemo(
    () => ({
      q: q || undefined,
      localityId: localityId || undefined,
      status: status || undefined,
      detailedViolenceType: detailedViolenceType || undefined,
      procedureType: procedureType || undefined,
      validationStatus:
        !isSmifWorkflow && validationStatus ? validationStatus : undefined,
      page,
      pageSize: showAllRows ? "all" : pageSize,
    }),
    [
      q,
      localityId,
      status,
      detailedViolenceType,
      procedureType,
      validationStatus,
      isSmifWorkflow,
      page,
      pageSize,
      showAllRows,
    ],
  );

  const cpcaCasesQuery = useCpcaCases(
    filters,
    canAccessByRole && !isSmifWorkflow,
  );
  const smifCasesQuery = useSmifComplaintCases(
    filters,
    canAccessByRole && isSmifWorkflow,
  );
  const casesQuery = isSmifWorkflow ? smifCasesQuery : cpcaCasesQuery;
  const cpcaPendingSummaryQuery = useCpcaCasePendingSummary(
    filters,
    canAccessByRole && !isSmifWorkflow,
  );
  const smifPendingSummaryQuery = useSmifComplaintPendingSummary(
    filters,
    canAccessByRole && isSmifWorkflow,
  );
  const pendingSummaryQuery = isSmifWorkflow
    ? smifPendingSummaryQuery
    : cpcaPendingSummaryQuery;
  const validationSummaryQuery = useCpcaCaseValidationSummary(
    filters,
    canAccessByRole && canValidateCpcaCase,
  );
  const cpcaLocalityOptionsQuery = useCpcaCaseLocalityOptions(
    canAccessByRole && !isSmifWorkflow,
  );
  const smifLocalitiesQuery = useLocalities(canAccessByRole && isSmifWorkflow);
  const localitiesQuery = isSmifWorkflow
    ? smifLocalitiesQuery
    : cpcaLocalityOptionsQuery;
  const postosQuery = usePostoOptions(canAccessByRole);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyAction, setHistoryAction] = useState("");
  const [historyActor, setHistoryActor] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const historyFilters = useMemo(
    () => ({
      q: q || undefined,
      localityId: localityId || undefined,
      status: status || undefined,
      detailedViolenceType: detailedViolenceType || undefined,
      procedureType: procedureType || undefined,
      action: historyAction || undefined,
      actor: historyActor.trim() || undefined,
      from: historyFrom || undefined,
      to: historyTo ? `${historyTo}T23:59:59` : undefined,
      page: historyPage + 1,
      pageSize: historyPageSize,
    }),
    [
      q,
      localityId,
      status,
      detailedViolenceType,
      procedureType,
      historyAction,
      historyActor,
      historyFrom,
      historyTo,
      historyPage,
      historyPageSize,
    ],
  );
  const historyQuery = useCpcaCaseHistory(
    historyFilters,
    canAccessByRole && !isSmifWorkflow,
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmThreadDeleteTarget, setConfirmThreadDeleteTarget] = useState<{
    id: string;
    label?: string;
  } | null>(null);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [form, setForm] = useState(() => createDefaultForm());
  const [cipavdDraft, setCipavdDraft] = useState("");
  const [cipavdDraftIsPending, setCipavdDraftIsPending] = useState(true);
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [editingThreadId, setEditingThreadId] = useState("");
  const [focusedThreadId, setFocusedThreadId] = useState("");
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [consistencyPopover, setConsistencyPopover] = useState<{
    anchorEl: HTMLElement | null;
    inconsistency: CpcaCaseInconsistency | null;
  }>({
    anchorEl: null,
    inconsistency: null,
  });
  const [summarySaveState, setSummarySaveState] = useState<
    "idle" | "analyzing" | "saving"
  >("idle");
  const [summaryPrivacyReview, setSummaryPrivacyReview] =
    useState<ComplaintSummaryPrivacyReview | null>(null);
  const [archiveReasonDialog, setArchiveReasonDialog] = useState<{
    caseNumber?: string | null;
    archiveReason?: string | null;
    archivedAt?: string | null;
    isMissingReason?: boolean;
  } | null>(null);

  const selectedCpcaCaseQuery = useCpcaCase(
    selectedId,
    canAccessByRole && drawerOpen && Boolean(selectedId) && !isSmifWorkflow,
  );
  const selectedSmifCaseQuery = useSmifComplaintCase(
    selectedId,
    canAccessByRole && drawerOpen && Boolean(selectedId) && isSmifWorkflow,
  );
  const selectedCaseQuery = isSmifWorkflow
    ? selectedSmifCaseQuery
    : selectedCpcaCaseQuery;
  const initialEvidenceSummary = isCreateMode
    ? ""
    : String(selectedCaseQuery.data?.evidenceSummary ?? "");
  const evidenceSummaryChanged = hasComplaintSummaryChanged(
    initialEvidenceSummary,
    form.evidenceSummary,
  );
  const shouldRunSummaryPrivacyReview =
    evidenceSummaryChanged && Boolean(form.evidenceSummary.trim());
  const createCpcaCase = useCreateCpcaCase();
  const updateCpcaCase = useUpdateCpcaCase();
  const deleteCpcaCase = useDeleteCpcaCase();
  const validateCpcaCase = useValidateCpcaCase();
  const markCpcaCaseSeen = useMarkCpcaCaseSeen();
  const createCpcaCipavdThread = useCreateCpcaCaseCipavdThread();
  const updateCpcaCipavdThread = useUpdateCpcaCaseCipavdThread();
  const removeCpcaCipavdThread = useRemoveCpcaCaseCipavdThread();
  const resolveCpcaCipavdThread = useResolveCpcaCaseCipavdThread();
  const reopenCpcaCipavdThread = useReopenCpcaCaseCipavdThread();
  const finalizeCpcaCipavdThread = useFinalizeCpcaCaseCipavdThread();
  const createSmifCase = useCreateSmifComplaintCase();
  const updateSmifCase = useUpdateSmifComplaintCase();
  const deleteSmifCase = useDeleteSmifComplaintCase();
  const markSmifCaseSeen = useMarkSmifComplaintSeen();
  const createSmifCipavdThread = useCreateSmifComplaintCaseCipavdThread();
  const updateSmifCipavdThread = useUpdateSmifComplaintCaseCipavdThread();
  const removeSmifCipavdThread = useRemoveSmifComplaintCaseCipavdThread();
  const resolveSmifCipavdThread = useResolveSmifComplaintCaseCipavdThread();
  const reopenSmifCipavdThread = useReopenSmifComplaintCaseCipavdThread();
  const finalizeSmifCipavdThread = useFinalizeSmifComplaintCaseCipavdThread();
  const createCase = isSmifWorkflow ? createSmifCase : createCpcaCase;
  const updateCase = isSmifWorkflow ? updateSmifCase : updateCpcaCase;
  const deleteCase = isSmifWorkflow ? deleteSmifCase : deleteCpcaCase;
  const markCaseSeen = isSmifWorkflow ? markSmifCaseSeen : markCpcaCaseSeen;
  const createCipavdThread = isSmifWorkflow
    ? createSmifCipavdThread
    : createCpcaCipavdThread;
  const updateCipavdThread = isSmifWorkflow
    ? updateSmifCipavdThread
    : updateCpcaCipavdThread;
  const removeCipavdThread = isSmifWorkflow
    ? removeSmifCipavdThread
    : removeCpcaCipavdThread;
  const resolveCipavdThread = isSmifWorkflow
    ? resolveSmifCipavdThread
    : resolveCpcaCipavdThread;
  const reopenCipavdThread = isSmifWorkflow
    ? reopenSmifCipavdThread
    : reopenCpcaCipavdThread;
  const finalizeCipavdThread = isSmifWorkflow
    ? finalizeSmifCipavdThread
    : finalizeCpcaCipavdThread;
  const workflowLabel = isSmifWorkflow ? "SMIF" : "CPCA";

  const isNationalScope = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
    ROLE_TI,
  ]);
  const cipavdAccess = (selectedCaseQuery.data as any)?.cipavdComments
    ?.access as
    | {
        canCreateThread?: boolean;
        canResolvePending?: boolean;
        canReviewResolvedPendencies?: boolean;
      }
    | undefined;
  const selectedCipavdThreads = (
    ((selectedCaseQuery.data as any)?.cipavdComments?.threads ?? []) as any[]
  ).slice();
  const selectedCipavdSummary = normalizeComplaintCipavdSummary(
    ((selectedCaseQuery.data as any)?.cipavdComments?.summary ?? null) as any,
  );
  const selectedLegacyComments = (
    ((selectedCaseQuery.data as any)?.comments ?? []) as any[]
  ).slice();
  const archiveReasonRequired = isComplaintArchiveReasonRequired({
    status: form.status,
    procedureCurrentSituation: form.procedureCurrentSituation,
  });
  const archiveReasonMeta = getComplaintArchiveReasonMeta({
    status: form.status,
    procedureCurrentSituation: form.procedureCurrentSituation,
    archiveReason: form.archiveReason,
  });
  const selectedArchiveReasonMeta = getComplaintArchiveReasonMeta({
    status: (selectedCaseQuery.data as any)?.status,
    procedureCurrentSituation: (selectedCaseQuery.data as any)
      ?.procedureCurrentSituation,
    archiveReason: (selectedCaseQuery.data as any)?.archiveReason,
  });
  const canCreateCipavdThread = Boolean(cipavdAccess?.canCreateThread);
  const canResolveCipavdPending = Boolean(cipavdAccess?.canResolvePending);
  const canReviewResolvedPendencies = Boolean(
    cipavdAccess?.canReviewResolvedPendencies,
  );

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page" && key !== "pageSize") {
      next.set("page", "1");
    }
    if (key === "detailedViolenceType") {
      next.delete("complaintType");
    }
    setParams(next, { replace: true });
  };

  const clearFilters = () => setParams({}, { replace: true });

  const items = casesQuery.data?.items ?? [];
  const totalItems = Number(casesQuery.data?.total ?? 0);
  const historyItems = ((historyQuery.data as any)?.items ?? []) as any[];
  const historyTotalItems = Number((historyQuery.data as any)?.total ?? 0);
  const pendingSummaryData = pendingSummaryQuery.data as
    | {
        summary?: {
          openPendingCount?: number | null;
          resolvedPendingCount?: number | null;
          totalPendingCount?: number | null;
        };
        openItems?: any[];
        resolvedItems?: any[];
      }
    | undefined;
  const openPendingItems = sortComplaintPendingItems(
    (pendingSummaryData?.openItems ?? []) as any[],
  );
  const resolvedPendingItems = sortComplaintPendingItems(
    (pendingSummaryData?.resolvedItems ?? []) as any[],
  );
  const openPendingCount = Math.max(
    0,
    Number(pendingSummaryData?.summary?.openPendingCount ?? 0) || 0,
  );
  const resolvedPendingCount = Math.max(
    0,
    Number(pendingSummaryData?.summary?.resolvedPendingCount ?? 0) || 0,
  );
  const validationSummaryData = validationSummaryQuery.data as
    | {
        summary?: {
          pendingValidationCount?: number | null;
          validatedCount?: number | null;
          totalCount?: number | null;
        };
        pendingItems?: any[];
      }
    | undefined;
  const pendingValidationItems = (validationSummaryData?.pendingItems ??
    []) as any[];
  const pendingValidationCount = Math.max(
    0,
    Number(validationSummaryData?.summary?.pendingValidationCount ?? 0) || 0,
  );
  const validatedCount = Math.max(
    0,
    Number(validationSummaryData?.summary?.validatedCount ?? 0) || 0,
  );
  const selectedValidation = ((selectedCaseQuery.data as any)?.validation ??
    null) as any;
  const summaryPrivacyHighlightSegments = useMemo(
    () =>
      summaryPrivacyReview
        ? buildComplaintSummaryHighlightSegments(
            summaryPrivacyReview.checkedText,
            summaryPrivacyReview.findings,
          )
        : [],
    [summaryPrivacyReview],
  );
  const isSavingCase =
    createCase.isPending ||
    updateCase.isPending ||
    deleteCase.isPending ||
    summarySaveState !== "idle";
  const saveCaseLabel =
    summarySaveState === "analyzing"
      ? "Analisando resumo com IA..."
      : summarySaveState === "saving"
        ? isCreateMode
          ? "Criando notificação..."
          : "Salvando alterações..."
        : isCreateMode
          ? "Criar notificação"
          : "Salvar alterações";

  const handlePageChange = (_event: unknown, nextPage: number) => {
    updateParam("page", String(nextPage + 1));
  };

  const handlePageSizeChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const next = new URLSearchParams(params);
    next.set("page", "1");
    if (String(event.target.value ?? "").trim() === "-1") {
      next.set("pageSize", "all");
    } else {
      const nextSize = Math.min(
        100,
        Math.max(10, Number(event.target.value ?? 20) || 20),
      );
      next.set("pageSize", String(nextSize));
    }
    setParams(next, { replace: true });
  };

  const handleHistoryPageChange = (_event: unknown, nextPage: number) => {
    setHistoryPage(nextPage);
  };

  const handleHistoryPageSizeChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setHistoryPage(0);
    setHistoryPageSize(
      Math.min(50, Math.max(10, Number(event.target.value ?? 10) || 10)),
    );
  };

  const localities = useMemo(
    () =>
      [...(localitiesQuery.data?.items ?? [])].sort((a: any, b: any) =>
        formatOmLabel(a).localeCompare(formatOmLabel(b), "pt-BR"),
      ),
    [localitiesQuery.data?.items],
  );
  const rankOptions: string[] = (postosQuery.data?.items ?? []).map(
    (item: any) => String(item.name),
  );
  const rankOptionsWithUnknown = useMemo(
    () =>
      Array.from(
        new Set(
          [NOT_INFORMED_RANK_VALUE, ...rankOptions]
            .map((item) => String(item ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [rankOptions],
  );
  const occurrenceFormLabelByValue = useMemo(
    () =>
      new Map(
        OCCURRENCE_FORM_OPTIONS.map(
          (item) => [item.value, item.label] as const,
        ),
      ),
    [],
  );
  const notifierIsVictim = form.notifierType === "VITIMA";
  const hasStep1Progress = Boolean(
    toNullable(form.incidentDate) ||
    toNullable(form.aggressorRank) ||
    toNullable(form.victimRank) ||
    toNullable(form.detailedViolenceType) ||
    toNullable(form.harassmentContext) ||
    toNullable(form.occurrenceLocation) ||
    toNullable(form.aggressorAgeRange) ||
    toNullable(form.victimAgeRange) ||
    (!notifierIsVictim &&
      (toNullable(form.notifierRank) ||
        toNullable(form.notifierAgeRange) ||
        form.notifierGender !== "NAO_INFORMADO")) ||
    toNullable(form.incidentFrequency) ||
    toNullable(form.hierarchicalFunctionalRelation) ||
    form.occurrenceForms.length > 0 ||
    toNullable(form.evidenceSummary),
  );
  const hasStep2Progress = Boolean(
    toNullable(form.immediateProtectionMeasures) ||
    form.psychologicalSupportProvided ||
    form.medicalSupportProvided ||
    form.socialSupportProvided ||
    form.legalSupportProvided ||
    form.contactRestrictionApplied ||
    form.confidentialityTermSigned,
  );
  const hasStep3Progress = Boolean(
    toNullable(form.procedureReference) ||
    toNullable(form.preliminaryReportDate) ||
    toNullable(form.procedureCurrentSituation) ||
    form.procedureType !== "NOT_DEFINED",
  );
  const dataUnlockedStep = hasStep3Progress
    ? 3
    : hasStep2Progress
      ? 2
      : hasStep1Progress
        ? 1
        : 0;
  const statusUnlockedStep = (() => {
    if (["INVESTIGATION", "CONCLUDED", "ARCHIVED"].includes(form.status))
      return 3;
    if (["PRELIMINARY_ANALYSIS", "PROCEDURE_DEFINED"].includes(form.status))
      return 2;
    if (form.status === "PROTECTION_MEASURES") return 1;
    return 0;
  })();
  const maxUnlockedStep = Math.max(dataUnlockedStep, statusUnlockedStep);

  useEffect(() => {
    setHistoryPage(0);
  }, [
    q,
    localityId,
    status,
    detailedViolenceType,
    procedureType,
    validationStatus,
    historyAction,
    historyActor,
    historyFrom,
    historyTo,
  ]);

  useEffect(() => {
    if (!isCreateMode || !drawerOpen) return;
    setForm((prev) => ({
      ...prev,
      localityId:
        isNationalScope || !isSmifWorkflow
          ? prev.localityId
          : String(me?.omId ?? ""),
    }));
  }, [drawerOpen, isCreateMode, isNationalScope, isSmifWorkflow, me?.omId]);

  useEffect(() => {
    if (!selectedCaseQuery.data || isCreateMode) return;
    const item = selectedCaseQuery.data;
    const inferredComplaintType = inferMacroComplaintTypeFromDetailed(
      item.detailedViolenceType ?? "",
    );
    const notifierType = item.notifierType ?? "VITIMA";
    const nextNotifierIsVictim = notifierType === "VITIMA";
    setForm({
      reportedAt: toDateInputValue(item.reportedAt),
      localityId: item.localityId ?? "",
      complaintType: inferredComplaintType ?? item.complaintType ?? "MORAL",
      notifierType,
      status: syncCpcaWorkflowStatus(
        item.status ?? "RECEIVED",
        item.procedureCurrentSituation ?? "",
      ),
      procedureType: item.procedureType ?? "NOT_DEFINED",
      incidentDate: toDateInputValue(item.incidentDate),
      aggressorRank: item.aggressorRank ?? "",
      aggressorGender: item.aggressorGender ?? "NAO_INFORMADO",
      aggressorAgeRange: item.aggressorAgeRange ?? "",
      victimRank: item.victimRank ?? "",
      victimGender: item.victimGender ?? "NAO_INFORMADO",
      victimAgeRange: item.victimAgeRange ?? "",
      victimIsNotifier: nextNotifierIsVictim,
      notifierRank: item.notifierRank ?? item.victimRank ?? "",
      notifierGender:
        item.notifierGender ?? item.victimGender ?? "NAO_INFORMADO",
      notifierAgeRange: item.notifierAgeRange ?? item.victimAgeRange ?? "",
      detailedViolenceType: item.detailedViolenceType ?? "",
      harassmentContext: item.harassmentContext ?? "",
      occurrenceLocation: item.occurrenceLocation ?? "",
      incidentFrequency: item.incidentFrequency ?? "",
      hierarchicalFunctionalRelation: item.hierarchicalFunctionalRelation ?? "",
      occurrenceForms:
        Array.isArray(item.occurrenceForms) && item.occurrenceForms.length > 0
          ? item.occurrenceForms.map((value: any) => String(value))
          : item.occurrenceForm
            ? [String(item.occurrenceForm)]
            : [],
      procedureCurrentSituation: item.procedureCurrentSituation ?? "",
      evidenceSummary: item.evidenceSummary ?? "",
      confidentialityTermSigned: Boolean(item.confidentialityTermSigned),
      confidentialityHandlingNotes: item.confidentialityHandlingNotes ?? "",
      cpcaMembersExcludedFromInquiry: Boolean(
        item.cpcaMembersExcludedFromInquiry ?? true,
      ),
      immediateProtectionMeasures: item.immediateProtectionMeasures ?? "",
      privateSupportActions: item.privateSupportActions ?? "",
      psychologicalSupportProvided: Boolean(item.psychologicalSupportProvided),
      medicalSupportProvided: Boolean(item.medicalSupportProvided),
      socialSupportProvided: Boolean(item.socialSupportProvided),
      legalSupportProvided: Boolean(item.legalSupportProvided),
      contactRestrictionApplied: Boolean(item.contactRestrictionApplied),
      preliminaryReportGenerated: Boolean(item.preliminaryReportGenerated),
      preliminaryReportDate: item.preliminaryReportDate
        ? String(item.preliminaryReportDate).slice(0, 10)
        : "",
      procedureReference: item.procedureReference ?? "",
      womenLedHandlingPrioritized: Boolean(item.womenLedHandlingPrioritized),
      victimAccusedSeparationEvaluated: Boolean(
        item.victimAccusedSeparationEvaluated,
      ),
      victimAccusedSeparationApplied: Boolean(
        item.victimAccusedSeparationApplied,
      ),
      accusedDefenseEnsured: Boolean(item.accusedDefenseEnsured),
      outcomeSummary: item.outcomeSummary ?? "",
      archiveReason: item.archiveReason ?? "",
      notifierFeedbackSummary: item.notifierFeedbackSummary ?? "",
      victimFeedbackSummary: item.victimFeedbackSummary ?? "",
      notifierFeedbackDate: item.notifierFeedbackDate
        ? String(item.notifierFeedbackDate).slice(0, 10)
        : "",
      victimFeedbackDate: item.victimFeedbackDate
        ? String(item.victimFeedbackDate).slice(0, 10)
        : "",
      retaliationRisk: Boolean(item.retaliationRisk),
      retaliationReported:
        item.retaliationReported ?? (item.retaliationRisk ? "SIM" : "NAO"),
      retaliationAgainst: item.retaliationAgainst ?? "",
      retaliationNotes: item.retaliationNotes ?? "",
      outsourcedAccused: Boolean(item.outsourcedAccused),
      contractorReferralDate: item.contractorReferralDate
        ? String(item.contractorReferralDate).slice(0, 10)
        : "",
      contractorFollowUpNotes: item.contractorFollowUpNotes ?? "",
      statusChangeNote: "",
    });
  }, [isCreateMode, selectedCaseQuery.data]);

  useEffect(() => {
    if (!drawerOpen) return;

    setActiveStep((prev) => Math.min(prev, maxUnlockedStep));

    if (!isCreateMode) return;

    const autoStatusByStep = [
      "RECEIVED",
      "PROTECTION_MEASURES",
      "PRELIMINARY_ANALYSIS",
      "INVESTIGATION",
    ] as const;
    const targetStatus = autoStatusByStep[dataUnlockedStep];

    setForm((prev) => {
      if (prev.status === "CONCLUDED" || prev.status === "ARCHIVED") {
        return prev;
      }
      const rank: Record<string, number> = {
        RECEIVED: 0,
        PROTECTION_MEASURES: 1,
        PRELIMINARY_ANALYSIS: 2,
        PROCEDURE_DEFINED: 2,
        INVESTIGATION: 3,
        CONCLUDED: 4,
        ARCHIVED: 5,
      };
      if ((rank[targetStatus] ?? 0) > (rank[prev.status] ?? 0)) {
        return { ...prev, status: targetStatus };
      }
      return prev;
    });
  }, [dataUnlockedStep, drawerOpen, isCreateMode, maxUnlockedStep]);

  if (meLoading) return <SkeletonState />;
  if (!canAccessByRole) {
    return (
      <ErrorState
        error={{ message: `Acesso negado ao fluxo ${workflowLabel}.` }}
      />
    );
  }
  if (casesQuery.isLoading) return <SkeletonState />;
  if (casesQuery.isError) {
    return (
      <ErrorState
        error={casesQuery.error}
        onRetry={() => casesQuery.refetch()}
      />
    );
  }

  const openCreate = () => {
    if (!canCreateCase) return;
    setIsCreateMode(true);
    setSelectedId("");
    setConfirmDeleteOpen(false);
    setSummarySaveState("idle");
    setSummaryPrivacyReview(null);
    setForm({
      ...createDefaultForm(),
      localityId: isNationalScope ? "" : String(me?.omId ?? ""),
    });
    setCipavdDraft("");
    setCipavdDraftIsPending(true);
    setThreadDrafts({});
    setEditingThreadId("");
    setFocusedThreadId("");
    setActiveStep(0);
    setArchiveReasonDialog(null);
    setDrawerOpen(true);
  };

  const openDetails = (id: string, threadId?: string) => {
    const normalizedId = String(id ?? "").trim();
    if (!normalizedId) return;
    setIsCreateMode(false);
    setSelectedId(normalizedId);
    setConfirmDeleteOpen(false);
    setSummarySaveState("idle");
    setSummaryPrivacyReview(null);
    setCipavdDraft("");
    setCipavdDraftIsPending(true);
    setThreadDrafts({});
    setEditingThreadId("");
    setFocusedThreadId(threadId ?? "");
    setActiveStep(0);
    setArchiveReasonDialog(null);
    setDrawerOpen(true);
    if (isNationalScope) {
      markCaseSeen.mutate(normalizedId);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedId("");
    setIsCreateMode(false);
    setConfirmDeleteOpen(false);
    setSummarySaveState("idle");
    setSummaryPrivacyReview(null);
    setConfirmThreadDeleteTarget(null);
    setConsistencyPopover({ anchorEl: null, inconsistency: null });
    setForm(createDefaultForm());
    setCipavdDraft("");
    setCipavdDraftIsPending(true);
    setThreadDrafts({});
    setEditingThreadId("");
    setFocusedThreadId("");
    setActiveStep(0);
    setArchiveReasonDialog(null);
  };

  const openArchiveReasonDetails = (item: {
    caseNumber?: string | null;
    archiveReason?: string | null;
    archivedAt?: string | null;
    status?: string | null;
    procedureCurrentSituation?: string | null;
  }) => {
    const meta = getComplaintArchiveReasonMeta(item);
    if (!meta.isArchived) return;
    setArchiveReasonDialog({
      caseNumber: item.caseNumber ?? null,
      archiveReason: meta.archiveReason,
      archivedAt: item.archivedAt ?? null,
      isMissingReason: meta.isMissingReason,
    });
  };

  const setThreadDraftValue = (threadId: string, value: string) => {
    setThreadDrafts((current) => ({
      ...current,
      [threadId]: value,
    }));
  };

  const clearThreadDraftValue = (threadId: string) => {
    setThreadDrafts((current) => {
      if (!(threadId in current)) return current;
      const next = { ...current };
      delete next[threadId];
      return next;
    });
  };

  const getActiveManagementThreadMessage = (thread: any) =>
    [...(thread?.messages ?? [])]
      .reverse()
      .find((message: any) => message?.authorKind === "MANAGEMENT");

  const canDeletePendingThread = (thread: any) =>
    thread?.type === "PENDENCY" &&
    thread?.status === "OPEN" &&
    Number(thread?.reopenedCount ?? 0) === 0 &&
    !(thread?.messages ?? []).some(
      (message: any) => message?.authorKind === "PRESIDENT",
    );

  const startEditingPendingThread = (thread: any) => {
    const activeMessage = getActiveManagementThreadMessage(thread);
    setThreadDraftValue(thread.id, String(activeMessage?.body ?? ""));
    setEditingThreadId(thread.id);
    setFocusedThreadId(thread.id);
  };

  const stopEditingPendingThread = (threadId: string) => {
    clearThreadDraftValue(threadId);
    setEditingThreadId((current) => (current === threadId ? "" : current));
  };

  const saveCase = async (options?: {
    allowSummaryPrivacyOverride?: boolean;
  }) => {
    const allowSummaryPrivacyOverride = Boolean(
      options?.allowSummaryPrivacyOverride,
    );
    if (isCreateMode && !canCreateCase) {
      toast.push({
        message: "Seu perfil nao possui permissao para criar notificações.",
        severity: "warning",
      });
      return;
    }
    if (!isCreateMode && !canUpdateCase) {
      toast.push({
        message: "Seu perfil nao possui permissao para editar notificações.",
        severity: "warning",
      });
      return;
    }
    if (
      (isNationalScope || (!isSmifWorkflow && isCreateMode)) &&
      !form.localityId
    ) {
      toast.push({
        message: "Selecione a OM da ocorrência.",
        severity: "warning",
      });
      return;
    }
    if (!form.reportedAt) {
      toast.push({
        message: "Informe a data da notificação.",
        severity: "warning",
      });
      return;
    }
    if (!form.aggressorRank || !form.victimRank) {
      toast.push({
        message: "Informe posto/graduação do acusado e da vítima.",
        severity: "warning",
      });
      return;
    }
    if (!notifierIsVictim && !form.notifierRank) {
      toast.push({
        message:
          "Quando vítima e noticiante forem pessoas diferentes, informe o posto/graduação do noticiante.",
        severity: "warning",
      });
      return;
    }

    const inferredComplaintType = inferMacroComplaintTypeFromDetailed(
      form.detailedViolenceType,
    );
    const macroComplaintType = inferredComplaintType ?? form.complaintType;
    const syncedStatus = syncCpcaWorkflowStatus(
      form.status,
      form.procedureCurrentSituation,
    );
    const nextArchiveReasonRequired = isComplaintArchiveReasonRequired({
      status: syncedStatus,
      procedureCurrentSituation: form.procedureCurrentSituation,
    });

    if (nextArchiveReasonRequired && !toNullable(form.archiveReason)) {
      setActiveStep(2);
      toast.push({
        message:
          "Preencha o motivo do arquivamento antes de salvar a denúncia arquivada.",
        severity: "warning",
      });
      return;
    }

    if (macroComplaintType === "SEXUAL" && !form.confidentialityTermSigned) {
      setActiveStep(1);
      toast.push({
        message:
          "Para casos de assédio sexual, o Termo de Sigilo deve ser marcado na etapa 2 (Acolhimento e proteção).",
        severity: "warning",
      });
      return;
    }

    const retaliationRisk =
      form.retaliationReported === "SIM"
        ? true
        : form.retaliationReported === "NAO"
          ? false
          : Boolean(form.retaliationRisk);

    const payload: Record<string, any> = {
      omId: form.localityId || undefined,
      complaintType: macroComplaintType,
      notifierType: form.notifierType,
      status: syncedStatus,
      procedureType: form.procedureType,
      reportedAt: toNullable(form.reportedAt),
      incidentDate: toNullable(form.incidentDate),
      aggressorRank: form.aggressorRank,
      aggressorGender: form.aggressorGender,
      aggressorAgeRange: toNullable(form.aggressorAgeRange),
      victimRank: form.victimRank,
      victimGender: form.victimGender,
      victimAgeRange: toNullable(form.victimAgeRange),
      victimIsNotifier: notifierIsVictim,
      notifierRank: notifierIsVictim ? form.victimRank : form.notifierRank,
      notifierGender: notifierIsVictim
        ? form.victimGender
        : form.notifierGender,
      notifierAgeRange: notifierIsVictim
        ? toNullable(form.victimAgeRange)
        : toNullable(form.notifierAgeRange),
      detailedViolenceType: toNullable(form.detailedViolenceType),
      harassmentContext: toNullable(form.harassmentContext),
      occurrenceLocation: toNullable(form.occurrenceLocation),
      incidentFrequency: toNullable(form.incidentFrequency),
      hierarchicalFunctionalRelation: toNullable(
        form.hierarchicalFunctionalRelation,
      ),
      occurrenceForms: form.occurrenceForms,
      procedureCurrentSituation: toNullable(form.procedureCurrentSituation),
      evidenceSummary: toNullable(form.evidenceSummary),
      confidentialityTermSigned: Boolean(form.confidentialityTermSigned),
      confidentialityHandlingNotes: toNullable(
        form.confidentialityHandlingNotes,
      ),
      cpcaMembersExcludedFromInquiry: Boolean(
        form.cpcaMembersExcludedFromInquiry,
      ),
      immediateProtectionMeasures: toNullable(form.immediateProtectionMeasures),
      privateSupportActions: toNullable(form.privateSupportActions),
      psychologicalSupportProvided: Boolean(form.psychologicalSupportProvided),
      medicalSupportProvided: Boolean(form.medicalSupportProvided),
      socialSupportProvided: Boolean(form.socialSupportProvided),
      legalSupportProvided: Boolean(form.legalSupportProvided),
      contactRestrictionApplied: Boolean(form.contactRestrictionApplied),
      preliminaryReportGenerated: Boolean(
        toNullable(form.preliminaryReportDate),
      ),
      preliminaryReportDate: toNullable(form.preliminaryReportDate),
      procedureReference: toNullable(form.procedureReference),
      victimAccusedSeparationEvaluated: Boolean(
        form.victimAccusedSeparationEvaluated,
      ),
      victimAccusedSeparationApplied: Boolean(
        form.victimAccusedSeparationApplied,
      ),
      accusedDefenseEnsured: Boolean(form.accusedDefenseEnsured),
      outcomeSummary: toNullable(form.outcomeSummary),
      archiveReason: toNullable(form.archiveReason),
      notifierFeedbackSummary: toNullable(form.notifierFeedbackSummary),
      victimFeedbackSummary: toNullable(form.victimFeedbackSummary),
      notifierFeedbackDate: toNullable(form.notifierFeedbackDate),
      victimFeedbackDate: toNullable(form.victimFeedbackDate),
      retaliationRisk,
      retaliationReported: toNullable(form.retaliationReported),
      retaliationAgainst: toNullable(form.retaliationAgainst),
      retaliationNotes: toNullable(form.retaliationNotes),
      outsourcedAccused: Boolean(form.outsourcedAccused),
      contractorReferralDate: toNullable(form.contractorReferralDate),
      contractorFollowUpNotes: toNullable(form.contractorFollowUpNotes),
    };

    if (allowSummaryPrivacyOverride) {
      payload.evidenceSummaryPrivacyOverride = true;
    }

    if (!isCreateMode) {
      payload.statusChangeNote = toNullable(form.statusChangeNote);
    }

    const nextSummarySaveState =
      shouldRunSummaryPrivacyReview && !allowSummaryPrivacyOverride
        ? "analyzing"
        : "saving";

    try {
      setSummarySaveState(nextSummarySaveState);
      if (isCreateMode) {
        const created = await createCase.mutateAsync(payload);
        toast.push({
          message: `Caso ${created.caseNumber} criado.`,
          severity: "success",
        });
        setIsCreateMode(false);
        setSelectedId(created.id);
        setSummaryPrivacyReview(null);
      } else if (selectedId) {
        await updateCase.mutateAsync({ id: selectedId, payload });
        toast.push({
          message: "Caso atualizado com sucesso.",
          severity: "success",
        });
        setSummaryPrivacyReview(null);
      }
    } catch (error) {
      const parsedError = parseApiError(error);
      if (parsedError.details?.field === "archiveReason") {
        setActiveStep(2);
      }
      const review = allowSummaryPrivacyOverride
        ? null
        : extractComplaintSummaryPrivacyReview(error);
      if (review?.status === "flagged" && review.findings.length > 0) {
        setSummaryPrivacyReview(review);
        return;
      }
      toast.push({
        message: parsedError.message ?? `Erro ao salvar caso ${workflowLabel}.`,
        severity: "error",
      });
    } finally {
      setSummarySaveState("idle");
    }
  };

  const validateSelectedCase = async () => {
    if (!selectedId || !canValidateCpcaCase || isSmifWorkflow) {
      toast.push({
        message:
          "Seu perfil ativo não possui permissão para validar denúncias.",
        severity: "warning",
      });
      return;
    }

    try {
      const result = await validateCpcaCase.mutateAsync(selectedId);
      toast.push({
        message: result?.alreadyValidated
          ? "Denúncia já estava validada."
          : "Denúncia validada pela comissão.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao validar a denúncia.",
        severity: "error",
      });
    }
  };

  const saveCipavdThread = async () => {
    if (!selectedId || !cipavdDraft.trim()) return;
    try {
      await createCipavdThread.mutateAsync({
        id: selectedId,
        text: cipavdDraft.trim(),
        isPending: cipavdDraftIsPending,
      });
      setCipavdDraft("");
      setCipavdDraftIsPending(true);
      toast.push({
        message: cipavdDraftIsPending
          ? "Pendência registrada."
          : "Comentário da CIPAVD registrado.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          "Erro ao registrar comentário da CIPAVD.",
        severity: "error",
      });
    }
  };

  const resolvePendingThread = async (threadId: string) => {
    const text = String(threadDrafts[threadId] ?? "").trim();
    if (!selectedId || !text) return;
    try {
      await resolveCipavdThread.mutateAsync({ id: selectedId, threadId, text });
      setThreadDraftValue(threadId, "");
      toast.push({
        message: "Pendência resolvida e enviada para validação.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao resolver a pendência.",
        severity: "error",
      });
    }
  };

  const saveEditedPendingThread = async (threadId: string) => {
    const text = String(threadDrafts[threadId] ?? "").trim();
    if (!selectedId || !text) return;
    try {
      await updateCipavdThread.mutateAsync({ id: selectedId, threadId, text });
      stopEditingPendingThread(threadId);
      toast.push({
        message: "Pendência atualizada.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao editar a pendência.",
        severity: "error",
      });
    }
  };

  const reopenPendingThread = async (threadId: string) => {
    const text = String(threadDrafts[threadId] ?? "").trim();
    if (!selectedId || !text) return;
    try {
      await reopenCipavdThread.mutateAsync({ id: selectedId, threadId, text });
      setThreadDraftValue(threadId, "");
      toast.push({
        message: "Pendência reaberta com nova orientação.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao reabrir a pendência.",
        severity: "error",
      });
    }
  };

  const finalizePendingThread = async (threadId: string) => {
    const text = String(threadDrafts[threadId] ?? "").trim();
    if (!selectedId || !text) return;
    try {
      await finalizeCipavdThread.mutateAsync({
        id: selectedId,
        threadId,
        text,
      });
      clearThreadDraftValue(threadId);
      toast.push({
        message: "Pendência validada e finalizada.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao finalizar a pendência.",
        severity: "error",
      });
    }
  };

  const handleConfirmDeleteThread = async () => {
    if (!selectedId || !confirmThreadDeleteTarget?.id) return;
    try {
      await removeCipavdThread.mutateAsync({
        id: selectedId,
        threadId: confirmThreadDeleteTarget.id,
      });
      clearThreadDraftValue(confirmThreadDeleteTarget.id);
      setEditingThreadId((current) =>
        current === confirmThreadDeleteTarget.id ? "" : current,
      );
      setConfirmThreadDeleteTarget(null);
      toast.push({
        message: "Pendência excluída.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao excluir a pendência.",
        severity: "error",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteCase.mutateAsync(selectedId);
      toast.push({ message: "Denúncia excluída.", severity: "success" });
      setConfirmDeleteOpen(false);
      closeDrawer();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao excluir denúncia.",
        severity: "error",
      });
    }
  };

  const renderStepContent = () => {
    const complaintTypeForValidation =
      inferMacroComplaintTypeFromDetailed(form.detailedViolenceType) ??
      form.complaintType;

    if (activeStep === 0) {
      return (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.4,
          }}
        >
          <Box sx={FORM_SECTION_HEADER_SX}>
            <Typography variant="subtitle2" fontWeight={700}>
              Dados gerais da ocorrência
            </Typography>
            <Divider />
          </Box>

          <TextField
            select
            size="small"
            label="OM"
            value={form.localityId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, localityId: e.target.value }))
            }
            disabled={!isNationalScope && (isSmifWorkflow || !isCreateMode)}
            SelectProps={{ MenuProps: LONG_SELECT_MENU_PROPS }}
          >
            {(isNationalScope || (!isSmifWorkflow && isCreateMode)) && (
              <MenuItem value="">Selecionar</MenuItem>
            )}
            {localities.map((loc: any) => (
              <MenuItem key={loc.id} value={loc.id}>
                {formatOmLabel(loc)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Tipo de assédio ou violência"
            value={form.detailedViolenceType}
            onChange={(e) => {
              const nextDetailedType = e.target.value;
              const inferred =
                inferMacroComplaintTypeFromDetailed(nextDetailedType);
              setForm((prev) => ({
                ...prev,
                detailedViolenceType: nextDetailedType,
                complaintType: inferred ?? prev.complaintType,
              }));
            }}
            SelectProps={{ MenuProps: LONG_SELECT_MENU_PROPS }}
          >
            <MenuItem value="">Selecionar</MenuItem>
            {DETAILED_VIOLENCE_TYPE_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Noticiante"
            value={form.notifierType}
            onChange={(e) =>
              setForm((prev) => {
                const nextNotifierType = e.target.value;
                const nextNotifierIsVictim = nextNotifierType === "VITIMA";
                return {
                  ...prev,
                  notifierType: nextNotifierType,
                  victimIsNotifier: nextNotifierIsVictim,
                  notifierRank: nextNotifierIsVictim
                    ? prev.victimRank
                    : prev.notifierRank,
                  notifierGender: nextNotifierIsVictim
                    ? prev.victimGender
                    : prev.notifierGender,
                  notifierAgeRange: nextNotifierIsVictim
                    ? prev.victimAgeRange
                    : prev.notifierAgeRange,
                };
              })
            }
          >
            {NOTIFIER_TYPE_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Contexto do assédio"
            value={form.harassmentContext}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                harassmentContext: e.target.value,
              }))
            }
          >
            <MenuItem value="">Selecionar</MenuItem>
            {HARASSMENT_CONTEXT_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            type="date"
            label="Data da notificação"
            InputLabelProps={{ shrink: true }}
            value={form.reportedAt}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, reportedAt: e.target.value }))
            }
          />

          <TextField
            size="small"
            type="date"
            label="Data do fato"
            InputLabelProps={{ shrink: true }}
            value={form.incidentDate}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, incidentDate: e.target.value }))
            }
          />

          <TextField
            select
            size="small"
            label="Local da ocorrência"
            value={form.occurrenceLocation}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                occurrenceLocation: e.target.value,
              }))
            }
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
            SelectProps={{ MenuProps: LONG_SELECT_MENU_PROPS }}
          >
            <MenuItem value="">Selecionar</MenuItem>
            {OCCURRENCE_LOCATION_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={FORM_SECTION_HEADER_WITH_SPACING_SX}>
            <Typography variant="subtitle2" fontWeight={700}>
              Dados do acusado
            </Typography>
            <Divider />
          </Box>

          <TextField
            select
            size="small"
            label="Posto/grad. acusado"
            value={form.aggressorRank}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, aggressorRank: e.target.value }))
            }
            SelectProps={{ MenuProps: RANK_SELECT_MENU_PROPS }}
          >
            {rankOptionsWithUnknown.map((rank: string) => (
              <MenuItem key={rank} value={rank}>
                {rank === NOT_INFORMED_RANK_VALUE
                  ? NOT_INFORMED_RANK_LABEL
                  : rank}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Sexo do acusado"
            value={form.aggressorGender}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, aggressorGender: e.target.value }))
            }
          >
            {GENDER_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Faixa etária do acusado"
            value={form.aggressorAgeRange}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                aggressorAgeRange: e.target.value,
              }))
            }
          >
            <MenuItem value="">Selecionar</MenuItem>
            {AGE_RANGE_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={FORM_SECTION_HEADER_WITH_SPACING_SX}>
            <Typography variant="subtitle2" fontWeight={700}>
              Dados da vítima
            </Typography>
            <Divider />
          </Box>

          <TextField
            select
            size="small"
            label="Posto/grad. vítima"
            value={form.victimRank}
            onChange={(e) =>
              setForm((prev) => {
                const nextVictimRank = e.target.value;
                return {
                  ...prev,
                  victimRank: nextVictimRank,
                  notifierRank:
                    prev.notifierType === "VITIMA"
                      ? nextVictimRank
                      : prev.notifierRank,
                };
              })
            }
            SelectProps={{ MenuProps: RANK_SELECT_MENU_PROPS }}
          >
            {rankOptionsWithUnknown.map((rank: string) => (
              <MenuItem key={rank} value={rank}>
                {rank === NOT_INFORMED_RANK_VALUE
                  ? NOT_INFORMED_RANK_LABEL
                  : rank}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Sexo da vítima"
            value={form.victimGender}
            onChange={(e) =>
              setForm((prev) => {
                const nextVictimGender = e.target.value;
                return {
                  ...prev,
                  victimGender: nextVictimGender,
                  notifierGender:
                    prev.notifierType === "VITIMA"
                      ? nextVictimGender
                      : prev.notifierGender,
                };
              })
            }
          >
            {GENDER_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Faixa etária da vítima"
            value={form.victimAgeRange}
            onChange={(e) =>
              setForm((prev) => {
                const nextVictimAgeRange = e.target.value;
                return {
                  ...prev,
                  victimAgeRange: nextVictimAgeRange,
                  notifierAgeRange:
                    prev.notifierType === "VITIMA"
                      ? nextVictimAgeRange
                      : prev.notifierAgeRange,
                };
              })
            }
          >
            <MenuItem value="">Selecionar</MenuItem>
            {AGE_RANGE_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          {!notifierIsVictim && (
            <Box sx={FORM_SECTION_HEADER_WITH_SPACING_SX}>
              <Typography variant="subtitle2" fontWeight={700}>
                Dados do noticiante
              </Typography>
              <Divider />
            </Box>
          )}

          {!notifierIsVictim && (
            <TextField
              select
              size="small"
              label="Posto/grad. noticiante"
              value={form.notifierRank}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notifierRank: e.target.value }))
              }
              SelectProps={{ MenuProps: RANK_SELECT_MENU_PROPS }}
            >
              {rankOptionsWithUnknown.map((rank: string) => (
                <MenuItem key={`notifier-rank-${rank}`} value={rank}>
                  {rank === NOT_INFORMED_RANK_VALUE
                    ? NOT_INFORMED_RANK_LABEL
                    : rank}
                </MenuItem>
              ))}
            </TextField>
          )}

          {!notifierIsVictim && (
            <TextField
              select
              size="small"
              label="Sexo do noticiante"
              value={form.notifierGender}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notifierGender: e.target.value }))
              }
            >
              {GENDER_OPTIONS.map((item) => (
                <MenuItem
                  key={`notifier-gender-${item.value}`}
                  value={item.value}
                >
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          {!notifierIsVictim && (
            <TextField
              select
              size="small"
              label="Faixa etária do noticiante"
              value={form.notifierAgeRange}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  notifierAgeRange: e.target.value,
                }))
              }
            >
              <MenuItem value="">Selecionar</MenuItem>
              {AGE_RANGE_OPTIONS.map((item) => (
                <MenuItem key={`notifier-age-${item.value}`} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Box sx={FORM_SECTION_HEADER_WITH_SPACING_SX}>
            <Typography variant="subtitle2" fontWeight={700}>
              Dados complementares da ocorrência
            </Typography>
            <Divider />
          </Box>

          <TextField
            select
            size="small"
            label="Frequência dos fatos"
            value={form.incidentFrequency}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                incidentFrequency: e.target.value,
              }))
            }
          >
            <MenuItem value="">Selecionar</MenuItem>
            {INCIDENT_FREQUENCY_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Relação hierárquica/funcional"
            value={form.hierarchicalFunctionalRelation}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                hierarchicalFunctionalRelation: e.target.value,
              }))
            }
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
          >
            <MenuItem value="">Selecionar</MenuItem>
            {FUNCTIONAL_RELATION_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Forma de ocorrência"
            InputLabelProps={{ shrink: true }}
            value={form.occurrenceForms}
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({
                ...prev,
                occurrenceForms: Array.isArray(value)
                  ? value.map((item) => String(item))
                  : [String(value)],
              }));
            }}
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
            SelectProps={{
              multiple: true,
              displayEmpty: true,
              MenuProps: LONG_SELECT_MENU_PROPS,
              renderValue: (selected) => {
                const selectedValues = Array.isArray(selected)
                  ? selected.map((item) => String(item).trim()).filter(Boolean)
                  : [];
                if (!selectedValues.length) return "Selecionar";
                return selectedValues
                  .map(
                    (value) => occurrenceFormLabelByValue.get(value) ?? value,
                  )
                  .join(", ");
              },
            }}
          >
            {OCCURRENCE_FORM_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                <Checkbox
                  size="small"
                  disableRipple
                  checked={form.occurrenceForms.includes(item.value)}
                  sx={MULTI_SELECT_CHECKBOX_SX}
                />
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={FORM_SECTION_HEADER_WITH_SPACING_SX}>
            <Typography variant="subtitle2" fontWeight={700}>
              Fato
            </Typography>
            <Divider />
          </Box>

          <TextField
            size="small"
            label="Resumo do Fato"
            value={form.evidenceSummary}
            onChange={(e) => {
              const nextValue = e.target.value;
              setSummaryPrivacyReview(null);
              setForm((prev) => ({ ...prev, evidenceSummary: nextValue }));
            }}
            multiline
            minRows={6}
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
            helperText="Descreva o contexto, o canal, as datas e o fato relatado (sem nomes)."
          />
        </Box>
      );
    }

    if (activeStep === 1) {
      return (
        <Stack spacing={1.2}>
          <TextField
            size="small"
            label="Ações imediatas de acolhimento e proteção"
            value={form.immediateProtectionMeasures}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                immediateProtectionMeasures: e.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={4}
          />

          {complaintTypeForValidation === "SEXUAL" &&
            !form.confidentialityTermSigned && (
              <Alert severity="warning">
                Em assédio sexual, o termo de sigilo deve ser marcado na etapa 2
                para concluir o salvamento.
              </Alert>
            )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 0.8,
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={form.psychologicalSupportProvided}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      psychologicalSupportProvided: e.target.checked,
                    }))
                  }
                />
              }
              label="Suporte psicológico"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.medicalSupportProvided}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      medicalSupportProvided: e.target.checked,
                    }))
                  }
                />
              }
              label="Suporte médico"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.socialSupportProvided}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      socialSupportProvided: e.target.checked,
                    }))
                  }
                />
              }
              label="Assistência do Serviço Social"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.legalSupportProvided}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      legalSupportProvided: e.target.checked,
                    }))
                  }
                />
              }
              label="Assistência jurídica"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.contactRestrictionApplied}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      contactRestrictionApplied: e.target.checked,
                    }))
                  }
                />
              }
              label="Restrição de contato"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.confidentialityTermSigned}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      confidentialityTermSigned: e.target.checked,
                    }))
                  }
                />
              }
              label="Termo de sigilo assinado"
            />
          </Box>
        </Stack>
      );
    }

    if (activeStep === 2) {
      return (
        <Stack spacing={1.2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1.2,
            }}
          >
            <TextField
              select
              size="small"
              label="Status da triagem/apuração"
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: syncCpcaWorkflowStatus(
                    e.target.value,
                    prev.procedureCurrentSituation,
                  ),
                }))
              }
            >
              {statusOptionsForStep(2, form.status).map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Procedimento administrativo"
              value={form.procedureType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, procedureType: e.target.value }))
              }
            >
              {PROCEDURE_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Situação atual do procedimento"
              value={form.procedureCurrentSituation}
              onChange={(e) => {
                const nextProcedureCurrentSituation = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  procedureCurrentSituation: nextProcedureCurrentSituation,
                  status: syncCpcaWorkflowStatus(
                    prev.status,
                    nextProcedureCurrentSituation,
                  ),
                }));
              }}
            >
              <MenuItem value="">Selecionar</MenuItem>
              {PROCEDURE_CURRENT_SITUATION_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <TextField
            size="small"
            label="Referência do processo"
            value={form.procedureReference}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                procedureReference: e.target.value,
              }))
            }
            fullWidth
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              size="small"
              type="date"
              label="Data do relatório"
              InputLabelProps={{ shrink: true }}
              value={form.preliminaryReportDate}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  preliminaryReportDate: e.target.value,
                  preliminaryReportGenerated: Boolean(e.target.value),
                }))
              }
              sx={{ minWidth: 220 }}
            />
          </Stack>

          {archiveReasonRequired && (
            <TextField
              size="small"
              label="Motivo do arquivamento"
              value={form.archiveReason}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  archiveReason: e.target.value,
                }))
              }
              error={archiveReasonMeta.isMissingReason}
              helperText={
                archiveReasonMeta.isMissingReason
                  ? "Preencha o motivo do arquivamento para salvar a denúncia como arquivada."
                  : "Explique de forma objetiva o fundamento do arquivamento."
              }
              fullWidth
              multiline
              minRows={3}
            />
          )}
        </Stack>
      );
    }

    return (
      <Stack spacing={1.2}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.2,
          }}
        >
          <TextField
            select
            size="small"
            label="Status de conclusão"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                status: syncCpcaWorkflowStatus(
                  e.target.value,
                  prev.procedureCurrentSituation,
                ),
              }))
            }
          >
            {statusOptionsForStep(3, form.status)
              .filter(
                (item) =>
                  !isCreateMode ||
                  !["CONCLUDED", "ARCHIVED"].includes(item.value),
              )
              .map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Medida de separação vítima/acusado"
            value={
              form.victimAccusedSeparationApplied
                ? "APLICADA"
                : form.victimAccusedSeparationEvaluated
                  ? "AVALIADA_NAO_APLICADA"
                  : "NAO_AVALIADA"
            }
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({
                ...prev,
                victimAccusedSeparationEvaluated:
                  value === "AVALIADA_NAO_APLICADA" || value === "APLICADA",
                victimAccusedSeparationApplied: value === "APLICADA",
              }));
            }}
          >
            {SEPARATION_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 0.8,
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={form.accusedDefenseEnsured}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    accusedDefenseEnsured: e.target.checked,
                  }))
                }
              />
            }
            label="Ampla defesa e contraditório assegurados"
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.2,
          }}
        >
          <TextField
            select
            size="small"
            label="Houve relatos de retaliação?"
            value={form.retaliationReported}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                retaliationReported: e.target.value,
                retaliationAgainst:
                  e.target.value === "NAO"
                    ? "NAO_OCORREU_RETALIACAO"
                    : prev.retaliationAgainst,
              }))
            }
          >
            {RETALIATION_REPORTED_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Ocorreu retaliação contra quem?"
            value={form.retaliationAgainst}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                retaliationAgainst: e.target.value,
              }))
            }
          >
            <MenuItem value="">Selecionar</MenuItem>
            {RETALIATION_TARGET_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {form.retaliationReported === "SIM" && (
          <TextField
            size="small"
            label="Observações sobre retaliação"
            value={form.retaliationNotes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, retaliationNotes: e.target.value }))
            }
            fullWidth
            multiline
            minRows={2}
          />
        )}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <FormControlLabel
            control={
              <Switch
                checked={form.outsourcedAccused}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    outsourcedAccused: e.target.checked,
                    contractorReferralDate: e.target.checked
                      ? prev.contractorReferralDate
                      : "",
                    contractorFollowUpNotes: e.target.checked
                      ? prev.contractorFollowUpNotes
                      : "",
                  }))
                }
              />
            }
            label="Acusado terceirizado"
          />

          <TextField
            size="small"
            type="date"
            label="Encaminhamento à contratante"
            InputLabelProps={{ shrink: true }}
            value={form.contractorReferralDate}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                contractorReferralDate: e.target.value,
              }))
            }
            disabled={!form.outsourcedAccused}
            sx={{ minWidth: 240 }}
          />
        </Stack>

        {form.outsourcedAccused && (
          <TextField
            size="small"
            label="Acompanhamento do trâmite com contratante"
            value={form.contractorFollowUpNotes}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                contractorFollowUpNotes: e.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={2}
          />
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.2,
          }}
        >
          <TextField
            size="small"
            type="date"
            label="Retorno ao noticiante"
            InputLabelProps={{ shrink: true }}
            value={form.notifierFeedbackDate}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                notifierFeedbackDate: e.target.value,
              }))
            }
          />
          <TextField
            size="small"
            type="date"
            label="Retorno à vítima"
            InputLabelProps={{ shrink: true }}
            value={form.victimFeedbackDate}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                victimFeedbackDate: e.target.value,
              }))
            }
          />
        </Box>

        <TextField
          size="small"
          label="Síntese do resultado"
          value={form.outcomeSummary}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, outcomeSummary: e.target.value }))
          }
          fullWidth
          multiline
          minRows={4}
        />

        {!isCreateMode && (
          <TextField
            size="small"
            label="Justificativa da mudança de status/procedimento"
            value={form.statusChangeNote}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, statusChangeNote: e.target.value }))
            }
            fullWidth
            multiline
            minRows={2}
          />
        )}
      </Stack>
    );
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        mb={2}
        gap={1.2}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {workflowLabel} - Denúncias
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fluxo sigiloso em etapas, conforme ICA 30-13 (Arts. 47 a 57).
          </Typography>
        </Box>
        {canCreateCase && (
          <Button variant="contained" onClick={openCreate}>
            Nova notificação
          </Button>
        )}
      </Stack>

      <Card
        sx={{
          mb: 2,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.035), rgba(148,163,184,0.08))",
          cursor: "pointer",
        }}
        role="button"
        tabIndex={0}
        onClick={() => setPendingModalOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setPendingModalOpen(true);
          }
        }}
      >
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="overline" color="text.secondary">
                Comentários da CIPAVD
              </Typography>
              <Typography variant="h4" fontWeight={800} lineHeight={1}>
                {openPendingCount}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {getComplaintPendingKpiLabel(openPendingCount)}
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              {resolvedPendingCount > 0 && (
                <Chip
                  size="small"
                  label={`${resolvedPendingCount} resolvida${resolvedPendingCount > 1 ? "s" : ""}`}
                  sx={{
                    fontWeight: 700,
                    color: "#166534",
                    bgcolor: "rgba(34, 197, 94, 0.12)",
                    border: "1px solid rgba(34, 197, 94, 0.24)",
                  }}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                Clique para listar as pendências do filtro atual.
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {canValidateCpcaCase && (
        <Card
          sx={{
            mb: 2,
            borderRadius: 4,
            border: "1px solid",
            borderColor:
              pendingValidationCount > 0
                ? "rgba(217, 119, 6, 0.35)"
                : "rgba(22, 163, 74, 0.28)",
            bgcolor:
              pendingValidationCount > 0
                ? "rgba(245, 158, 11, 0.06)"
                : "rgba(34, 197, 94, 0.05)",
            cursor: "pointer",
          }}
          role="button"
          tabIndex={0}
          onClick={() => setValidationModalOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setValidationModalOpen(true);
            }
          }}
        >
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor:
                      pendingValidationCount > 0
                        ? "rgba(245, 158, 11, 0.16)"
                        : "rgba(34, 197, 94, 0.14)",
                    color:
                      pendingValidationCount > 0 ? "#B45309" : "#166534",
                  }}
                >
                  {pendingValidationCount > 0 ? (
                    <PendingActionsIcon fontSize="small" />
                  ) : (
                    <FactCheckIcon fontSize="small" />
                  )}
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Validação da comissão
                  </Typography>
                  <Typography variant="h4" fontWeight={800} lineHeight={1}>
                    {validationSummaryQuery.isLoading
                      ? "..."
                      : pendingValidationCount}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {pendingValidationCount === 1
                      ? "denúncia aguardando validação"
                      : "denúncias aguardando validação"}
                  </Typography>
                </Box>
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Chip
                  size="small"
                  label={`${validatedCount} validada${validatedCount === 1 ? "" : "s"}`}
                  sx={{
                    fontWeight: 700,
                    color: "#166534",
                    bgcolor: "rgba(34, 197, 94, 0.12)",
                    border: "1px solid rgba(34, 197, 94, 0.24)",
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Clique para revisar a fila do filtro atual.
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            flexWrap="wrap"
          >
            <TextField
              size="small"
              label="Número do caso"
              value={q}
              onChange={(e) => updateParam("q", e.target.value)}
              sx={{ minWidth: 200 }}
            />
            {isNationalScope && (
              <TextField
                select
                size="small"
                label="OM"
                value={localityId}
                onChange={(e) => updateParam("localityId", e.target.value)}
                sx={{ minWidth: 220 }}
                SelectProps={{ MenuProps: LONG_SELECT_MENU_PROPS }}
              >
                <MenuItem value="">Todas</MenuItem>
                {localities.map((loc: any) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {formatOmLabel(loc)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              size="small"
              label="Tipo de assédio ou violência"
              value={detailedViolenceType}
              onChange={(e) =>
                updateParam("detailedViolenceType", e.target.value)
              }
              sx={{ minWidth: 280 }}
              SelectProps={{ MenuProps: LONG_SELECT_MENU_PROPS }}
            >
              <MenuItem value="">Todos</MenuItem>
              {DETAILED_VIOLENCE_TYPE_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => updateParam("status", e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {STATUS_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Procedimento administrativo"
              value={procedureType}
              onChange={(e) => updateParam("procedureType", e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {PROCEDURE_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            {!isSmifWorkflow && (
              <TextField
                select
                size="small"
                label="Validação"
                value={validationStatus}
                onChange={(e) =>
                  updateParam("validationStatus", e.target.value)
                }
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="">Todas</MenuItem>
                <MenuItem value="PENDING">A validar</MenuItem>
                <MenuItem value="VALIDATED">Validadas</MenuItem>
              </TextField>
            )}
            <Button variant="text" onClick={clearFilters}>
              Limpar
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma notificação"
              description={`Registre a primeira ocorrência de ${workflowLabel} para iniciar o acompanhamento.`}
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                    Caso
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                    OM
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                    Tipo
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                    Procedimento administrativo
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                    Recebimento
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => {
                  const inconsistencies = isSmifWorkflow
                    ? []
                    : Array.isArray(item.inconsistencies)
                      ? item.inconsistencies
                      : getCpcaCaseInconsistencies(item);
                  const archiveBadge = getComplaintArchiveReasonMeta({
                    status: item.status,
                    procedureCurrentSituation: item.procedureCurrentSituation,
                    archiveReason: item.archiveReason,
                  });
                  const cipavdSummary = normalizeComplaintCipavdSummary(
                    item.cipavdCommentsSummary,
                  );
                  const pendencyBadge = getComplaintPendencyBadge(
                    cipavdSummary,
                    {
                      showResolved: isNationalScope,
                    },
                  );
                  const validation = item.validation ?? null;

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetails(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDetails(item.id);
                        }
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ minWidth: 320, maxWidth: 440 }}>
                        <Stack spacing={0.6}>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            useFlexGap
                            flexWrap="wrap"
                            alignItems="center"
                          >
                            <Typography
                              fontWeight={700}
                              sx={{
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            >
                              {formatComplaintCaseNumberForDisplay(
                                item.caseNumber,
                              )}
                            </Typography>
                            {!isSmifWorkflow && validation?.isValidated && (
                              <Tooltip title={getValidationTooltip(validation)}>
                                <CheckCircleIcon
                                  color="success"
                                  fontSize="small"
                                  aria-label="Denúncia validada"
                                />
                              </Tooltip>
                            )}
                            {item.isNewForViewer && (
                              <Chip
                                size="small"
                                label="Novo"
                                sx={{
                                  height: 22,
                                  fontWeight: 800,
                                  color: "#075985",
                                  bgcolor: "rgba(14, 165, 233, 0.14)",
                                  border: "1px solid rgba(14, 165, 233, 0.28)",
                                }}
                              />
                            )}
                            {inconsistencies.map(
                              (inconsistency: CpcaCaseInconsistency) => (
                                <Chip
                                  key={`${item.id}-${inconsistency.code}`}
                                  size="small"
                                  variant="outlined"
                                  clickable
                                  label={inconsistency.badgeLabel}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setConsistencyPopover({
                                      anchorEl: event.currentTarget,
                                      inconsistency,
                                    });
                                  }}
                                  sx={{
                                    fontWeight: 700,
                                    borderStyle: "dashed",
                                    borderColor:
                                      inconsistency.tone === "warning"
                                        ? "rgba(245, 124, 0, 0.4)"
                                        : "rgba(2, 136, 209, 0.35)",
                                    bgcolor:
                                      inconsistency.tone === "warning"
                                        ? "rgba(245, 124, 0, 0.08)"
                                        : "rgba(2, 136, 209, 0.08)",
                                    color:
                                      inconsistency.tone === "warning"
                                        ? "#B45309"
                                        : "#0C4A6E",
                                  }}
                                />
                              ),
                            )}
                            {!isSmifWorkflow &&
                              canValidateCpcaCase &&
                              !validation?.isValidated && (
                                <Chip
                                  size="small"
                                  label="A validar"
                                  sx={{
                                    fontWeight: 700,
                                    color: "#B45309",
                                    bgcolor: "rgba(245, 158, 11, 0.12)",
                                    border:
                                      "1px solid rgba(245, 158, 11, 0.24)",
                                  }}
                                />
                              )}
                            {pendencyBadge && (
                              <Chip
                                size="small"
                                label={pendencyBadge.label}
                                sx={{
                                  fontWeight: 700,
                                  color:
                                    pendencyBadge.tone === "error"
                                      ? "#B91C1C"
                                      : "#166534",
                                  bgcolor:
                                    pendencyBadge.tone === "error"
                                      ? "rgba(239, 68, 68, 0.12)"
                                      : "rgba(34, 197, 94, 0.12)",
                                  border: "1px solid",
                                  borderColor:
                                    pendencyBadge.tone === "error"
                                      ? "rgba(239, 68, 68, 0.24)"
                                      : "rgba(34, 197, 94, 0.24)",
                                }}
                              />
                            )}
                            {archiveBadge.isArchived &&
                              archiveBadge.badgeLabel && (
                                <Chip
                                  size="small"
                                  clickable
                                  label={archiveBadge.badgeLabel}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openArchiveReasonDetails(item);
                                  }}
                                  sx={{
                                    fontWeight: 700,
                                    color: "#B91C1C",
                                    bgcolor: "rgba(239, 68, 68, 0.12)",
                                    border: "1px solid rgba(239, 68, 68, 0.28)",
                                  }}
                                />
                              )}
                          </Stack>
                          {(item.lastCommentAt ||
                            cipavdSummary.lastActivityAt) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Última movimentação:{" "}
                              {new Date(
                                cipavdSummary.lastActivityAt ??
                                  item.lastCommentAt,
                              ).toLocaleString("pt-BR")}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>{formatOmLabel(item.locality)}</TableCell>
                      <TableCell>
                        {getDetailedViolenceTypeLabel(
                          item.detailedViolenceType,
                        ) ??
                          getComplaintTypeLabel(item.complaintType) ??
                          "-"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            STATUS_OPTIONS.find(
                              (entry) => entry.value === item.status,
                            )?.label ?? item.status
                          }
                          sx={{
                            fontWeight: 700,
                            bgcolor:
                              STATUS_CHIP_STYLES[String(item.status)]
                                ?.bgcolor ?? "rgba(17, 24, 39, 0.08)",
                            color:
                              STATUS_CHIP_STYLES[String(item.status)]?.color ??
                              "#111827",
                            border: "1px solid",
                            borderColor:
                              STATUS_CHIP_STYLES[String(item.status)]
                                ?.borderColor ?? "rgba(17, 24, 39, 0.14)",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {PROCEDURE_OPTIONS.find(
                          (entry) => entry.value === item.procedureType,
                        )?.label ?? item.procedureType}
                      </TableCell>
                      <TableCell>
                        {item.reportedAt
                          ? new Date(item.reportedAt).toLocaleDateString(
                              "pt-BR",
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {totalItems > 0 && (
          <TablePagination
            component="div"
            count={totalItems}
            page={showAllRows ? 0 : Math.max(0, page - 1)}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handlePageSizeChange}
            rowsPerPageOptions={[20, 50, 100, { label: "Todas", value: -1 }]}
            labelRowsPerPage="Denúncias por página"
            labelDisplayedRows={({ from, to, count }) =>
              showAllRows
                ? `1-${count} de ${count}`
                : `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
            }
          />
        )}
      </Card>

      {!isSmifWorkflow && (
        <Card sx={{ mt: 2, mb: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={1.5}
              >
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Histórico de modificações
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {historyTotalItems} registro
                    {historyTotalItems === 1 ? "" : "s"}
                  </Typography>
                </Box>
                {historyQuery.isFetching && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Atualizando
                    </Typography>
                  </Stack>
                )}
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                flexWrap="wrap"
              >
                <TextField
                  select
                  size="small"
                  label="Movimento"
                  value={historyAction}
                  onChange={(event) => setHistoryAction(event.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {CPCA_HISTORY_ACTION_OPTIONS.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Usuário"
                  value={historyActor}
                  onChange={(event) => setHistoryActor(event.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  size="small"
                  label="De"
                  type="date"
                  value={historyFrom}
                  onChange={(event) => setHistoryFrom(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
                <TextField
                  size="small"
                  label="Até"
                  type="date"
                  value={historyTo}
                  onChange={(event) => setHistoryTo(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
                <Button
                  variant="text"
                  onClick={() => {
                    setHistoryAction("");
                    setHistoryActor("");
                    setHistoryFrom("");
                    setHistoryTo("");
                  }}
                >
                  Limpar histórico
                </Button>
              </Stack>

              {historyQuery.isError ? (
                <Alert severity="error">
                  Não foi possível carregar o histórico.
                </Alert>
              ) : historyItems.length === 0 && !historyQuery.isLoading ? (
                <EmptyState
                  title="Nenhuma modificação encontrada"
                  description="Sem registros para os critérios atuais."
                />
              ) : (
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small" sx={{ minWidth: 980 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "primary.main" }}>
                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                          Data e hora
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                          Denúncia
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                          OM
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                          Usuário
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                          Movimento
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>
                          O que mudou
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historyItems.map((entry: any) => {
                        const changes = Array.isArray(entry.changes)
                          ? entry.changes
                          : [];
                        return (
                          <TableRow key={entry.id} hover>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>
                              {entry.createdAt
                                ? new Date(entry.createdAt).toLocaleString(
                                    "pt-BR",
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell sx={{ minWidth: 180 }}>
                              <Typography fontWeight={700} variant="body2">
                                {formatComplaintCaseNumberForDisplay(
                                  entry.case?.caseNumber,
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 180 }}>
                              {formatHistoryOm(entry.om)}
                            </TableCell>
                            <TableCell sx={{ minWidth: 220 }}>
                              {formatHistoryActor(entry.actor)}
                            </TableCell>
                            <TableCell sx={{ minWidth: 190 }}>
                              <Chip
                                size="small"
                                label={entry.actionLabel ?? entry.action}
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 320 }}>
                              <Stack spacing={0.7}>
                                <Typography variant="body2">
                                  {entry.summary}
                                </Typography>
                                {changes.slice(0, 4).map((change: any) => {
                                  const label = String(
                                    change.label ?? change.field ?? "",
                                  );
                                  const previous = formatHistoryValue(
                                    change.previous,
                                  );
                                  const next = formatHistoryValue(change.next);
                                  const type = String(change.type ?? "");
                                  const valueText =
                                    type === "inserted"
                                      ? `Inserido: ${next}`
                                      : type === "removed"
                                        ? `Removido: ${previous}`
                                        : `${previous} -> ${next}`;
                                  return (
                                    <Typography
                                      key={`${entry.id}-${change.field}-${label}`}
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        display: "block",
                                        overflowWrap: "anywhere",
                                      }}
                                    >
                                      <Box
                                        component="span"
                                        sx={{ fontWeight: 700 }}
                                      >
                                        {label}
                                      </Box>
                                      : {valueText}
                                    </Typography>
                                  );
                                })}
                                {changes.length > 4 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    +{changes.length - 4} alteração
                                    {changes.length - 4 === 1 ? "" : "es"}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Stack>
          </CardContent>
          {historyTotalItems > 0 && (
            <TablePagination
              component="div"
              count={historyTotalItems}
              page={historyPage}
              onPageChange={handleHistoryPageChange}
              rowsPerPage={historyPageSize}
              onRowsPerPageChange={handleHistoryPageSizeChange}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Registros por página"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
              }
            />
          )}
        </Card>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 900 },
            top: 76,
            height: "calc(100% - 76px)",
          },
        }}
      >
        <Box
          sx={{
            height: "100%",
            overflowY: "auto",
            px: { xs: 2, md: 3 },
            pt: { xs: 2.25, md: 3.25 },
            pb: 3,
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={1.5}
            sx={{
              pb: 2,
              mb: 2.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                minWidth: 0,
                pr: { xs: 0, md: 2 },
                lineHeight: 1.25,
                overflowWrap: "anywhere",
              }}
            >
              {isCreateMode
                ? `Nova notificação ${workflowLabel}`
                : `Caso ${selectedCaseQuery.data?.caseNumber ?? ""}`}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              {!isCreateMode && canDeleteCase && (
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleteCase.isPending || !selectedId}
                >
                  Excluir denúncia
                </Button>
              )}
              <Button variant="text" onClick={closeDrawer}>
                Fechar
              </Button>
            </Stack>
          </Stack>

          <Alert severity="warning" sx={{ mb: 2.5 }}>
            Registrar apenas dados genéricos (sem nomes). Acesso restrito a
            {isSmifWorkflow
              ? " perfis CPCA autorizados e à gestão nacional."
              : " CPCA e gestão nacional."}
          </Alert>

          {!isCreateMode &&
            selectedArchiveReasonMeta.isArchived &&
            selectedArchiveReasonMeta.badgeLabel && (
              <Box sx={{ mb: 2 }}>
                <Chip
                  clickable
                  label={selectedArchiveReasonMeta.badgeLabel}
                  onClick={() =>
                    openArchiveReasonDetails(selectedCaseQuery.data as any)
                  }
                  sx={{
                    fontWeight: 700,
                    color: "#B91C1C",
                    bgcolor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.28)",
                  }}
                />
              </Box>
            )}

          {!isCreateMode && selectedCaseQuery.isLoading && <SkeletonState />}
          {!isCreateMode && selectedCaseQuery.isError && (
            <ErrorState
              error={selectedCaseQuery.error}
              onRetry={() => selectedCaseQuery.refetch()}
            />
          )}

          {(isCreateMode || selectedCaseQuery.data) && (
            <Stack spacing={2}>
              {!isCreateMode && !isSmifWorkflow && selectedCaseQuery.data && (
                <Card
                  sx={{
                    border: "1px solid",
                    borderColor: selectedValidation?.isValidated
                      ? "rgba(34, 197, 94, 0.28)"
                      : "rgba(245, 158, 11, 0.32)",
                    bgcolor: selectedValidation?.isValidated
                      ? "rgba(34, 197, 94, 0.04)"
                      : "rgba(245, 158, 11, 0.05)",
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.25}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          {selectedValidation?.isValidated ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <PendingActionsIcon sx={{ color: "#B45309" }} />
                          )}
                          <Box>
                            <Typography variant="subtitle1" fontWeight={800}>
                              Validação da comissão
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {selectedValidation?.isValidated
                                ? getValidationTooltip(selectedValidation)
                                : "Esta denúncia precisa de validação após a última atualização."}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={
                              selectedValidation?.isValidated
                                ? "Validada"
                                : "A validar"
                            }
                            sx={{
                              fontWeight: 700,
                              color: selectedValidation?.isValidated
                                ? "#166534"
                                : "#B45309",
                              bgcolor: selectedValidation?.isValidated
                                ? "rgba(34, 197, 94, 0.12)"
                                : "rgba(245, 158, 11, 0.12)",
                              border: "1px solid",
                              borderColor: selectedValidation?.isValidated
                                ? "rgba(34, 197, 94, 0.24)"
                                : "rgba(245, 158, 11, 0.24)",
                            }}
                          />
                          {canValidateCpcaCase &&
                            !selectedValidation?.isValidated && (
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={
                                  validateCpcaCase.isPending ? (
                                    <CircularProgress
                                      size={16}
                                      color="inherit"
                                    />
                                  ) : (
                                    <FactCheckIcon fontSize="small" />
                                  )
                                }
                                onClick={() => {
                                  void validateSelectedCase();
                                }}
                                disabled={validateCpcaCase.isPending}
                              >
                                Validar denúncia
                              </Button>
                            )}
                        </Stack>
                      </Stack>

                      {(selectedValidation?.logs ?? []).length > 0 && (
                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 0.75 }}
                          >
                            Log de validação
                          </Typography>
                          <Stack spacing={0.75}>
                            {(selectedValidation.logs ?? [])
                              .slice(0, 4)
                              .map((log: any) => (
                                <Box
                                  key={log.id}
                                  sx={{
                                    p: 1,
                                    borderRadius: 1,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: "background.paper",
                                  }}
                                >
                                  <Typography variant="body2">
                                    {getValidationActorName(log)} validou em{" "}
                                    {formatDateTimePtBr(log.validatedAt)}
                                  </Typography>
                                </Box>
                              ))}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Box sx={{ overflowX: "auto", pb: 1 }}>
                    <Stepper
                      nonLinear
                      activeStep={activeStep}
                      sx={{ minWidth: 760 }}
                    >
                      {STEP_DEFS.map((step, index) => (
                        <Step key={step.title}>
                          <StepButton
                            color="inherit"
                            disabled={index > maxUnlockedStep}
                            onClick={() => setActiveStep(index)}
                          >
                            {step.title}
                          </StepButton>
                        </Step>
                      ))}
                    </Stepper>
                  </Box>

                  <Box sx={ACTIVE_STEP_HEADER_SX}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ letterSpacing: 0.8 }}
                    >
                      Etapa atual
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {STEP_DEFS[activeStep].title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {STEP_DEFS[activeStep].subtitle}
                    </Typography>
                    {activeStep < STEP_DEFS.length - 1 &&
                      activeStep >= maxUnlockedStep && (
                        <Typography variant="caption" color="text.secondary">
                          Preencha ao menos um campo útil desta etapa para
                          liberar a próxima e atualizar o status.
                        </Typography>
                      )}
                  </Box>

                  {renderStepContent()}

                  {summarySaveState === "analyzing" && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      A IA está analisando o Resumo do Fato para verificar
                      possíveis nomes de militares antes do salvamento.
                    </Alert>
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Button
                      variant="outlined"
                      onClick={() =>
                        setActiveStep((prev) => Math.max(0, prev - 1))
                      }
                      disabled={activeStep === 0}
                    >
                      Etapa anterior
                    </Button>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={() =>
                          setActiveStep((prev) =>
                            Math.min(STEP_DEFS.length - 1, prev + 1),
                          )
                        }
                        disabled={
                          activeStep === STEP_DEFS.length - 1 ||
                          activeStep >= maxUnlockedStep
                        }
                      >
                        Próxima etapa
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => {
                          void saveCase();
                        }}
                        disabled={
                          (isCreateMode && !canCreateCase) ||
                          (!isCreateMode && !canUpdateCase) ||
                          isSavingCase
                        }
                        startIcon={
                          isSavingCase ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : undefined
                        }
                      >
                        {saveCaseLabel}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {!isCreateMode && selectedCaseQuery.data && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={1}>
                      Histórico de status e procedimento
                    </Typography>
                    {(selectedCaseQuery.data.statusHistory ?? []).length ===
                    0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Sem mudanças registradas.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {(selectedCaseQuery.data.statusHistory ?? []).map(
                          (entry: any) => (
                            <Box
                              key={entry.id}
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                p: 1,
                              }}
                            >
                              <Typography variant="body2">
                                {STATUS_OPTIONS.find(
                                  (item) => item.value === entry.fromStatus,
                                )?.label ??
                                  entry.fromStatus ??
                                  "Inicial"}
                                {" -> "}
                                {STATUS_OPTIONS.find(
                                  (item) => item.value === entry.toStatus,
                                )?.label ?? entry.toStatus}
                                {" | "}
                                {PROCEDURE_OPTIONS.find(
                                  (item) => item.value === entry.fromProcedure,
                                )?.label ??
                                  entry.fromProcedure ??
                                  "Inicial"}
                                {" -> "}
                                {PROCEDURE_OPTIONS.find(
                                  (item) => item.value === entry.toProcedure,
                                )?.label ?? entry.toProcedure}
                              </Typography>
                              {entry.note && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}
                                >
                                  {entry.note}
                                </Typography>
                              )}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {entry.changedBy?.name ?? "Usuário"} •{" "}
                                {new Date(entry.changedAt).toLocaleString(
                                  "pt-BR",
                                )}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}

              {!isCreateMode && selectedCaseQuery.data && (
                <Card>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.25}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight={800}>
                            Comentários da CIPAVD
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Fluxo de alinhamento entre a gestão nacional e a
                            presidência da comissão da OM.
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={`${selectedCipavdSummary.openPendingCount} aberta${selectedCipavdSummary.openPendingCount === 1 ? "" : "s"}`}
                            sx={{
                              fontWeight: 700,
                              color: "#B45309",
                              bgcolor: "rgba(245, 158, 11, 0.14)",
                              border: "1px solid rgba(245, 158, 11, 0.28)",
                            }}
                          />
                          {canReviewResolvedPendencies &&
                            selectedCipavdSummary.resolvedPendingCount > 0 && (
                              <Chip
                                size="small"
                                label={`${selectedCipavdSummary.resolvedPendingCount} resolvida${selectedCipavdSummary.resolvedPendingCount > 1 ? "s" : ""}`}
                                sx={{
                                  fontWeight: 700,
                                  color: "#166534",
                                  bgcolor: "rgba(34, 197, 94, 0.12)",
                                  border: "1px solid rgba(34, 197, 94, 0.24)",
                                }}
                              />
                            )}
                        </Stack>
                      </Stack>

                      {canCreateCipavdThread ? (
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            border: "1px solid",
                            borderColor: "divider",
                            background:
                              "linear-gradient(135deg, rgba(15,23,42,0.03), rgba(148,163,184,0.06))",
                          }}
                        >
                          <Stack spacing={1.25}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={cipavdDraftIsPending}
                                  onChange={(event) =>
                                    setCipavdDraftIsPending(
                                      event.target.checked,
                                    )
                                  }
                                />
                              }
                              label={
                                cipavdDraftIsPending
                                  ? "Registrar como pendência"
                                  : "Registrar como comentário"
                              }
                            />
                            <TextField
                              size="small"
                              label={
                                cipavdDraftIsPending
                                  ? "Nova pendência"
                                  : "Novo comentário da CIPAVD"
                              }
                              value={cipavdDraft}
                              onChange={(event) =>
                                setCipavdDraft(event.target.value)
                              }
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <Box display="flex" justifyContent="flex-end">
                              <Button
                                variant="contained"
                                onClick={saveCipavdThread}
                                disabled={
                                  !cipavdDraft.trim() ||
                                  createCipavdThread.isPending ||
                                  deleteCase.isPending
                                }
                              >
                                {cipavdDraftIsPending
                                  ? "Enviar pendência"
                                  : "Enviar comentário"}
                              </Button>
                            </Box>
                          </Stack>
                        </Box>
                      ) : (
                        <Alert severity="info">
                          Somente a gestão nacional inicia novos comentários ou
                          pendências neste fluxo.
                        </Alert>
                      )}

                      {selectedCipavdThreads.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhuma interação da CIPAVD registrada até o momento.
                        </Typography>
                      ) : (
                        <Stack spacing={1.5}>
                          {selectedCipavdThreads.map((thread: any) => {
                            const statusTone = getComplaintPendingStatusTone(
                              thread.status,
                            );
                            const draftValue = String(
                              threadDrafts[thread.id] ?? "",
                            );
                            const activeManagementMessage =
                              getActiveManagementThreadMessage(thread);
                            const canDeleteThread =
                              canDeletePendingThread(thread);
                            const isEditingThread =
                              editingThreadId === thread.id;

                            return (
                              <Box
                                key={thread.id}
                                sx={{
                                  p: 2,
                                  borderRadius: 3,
                                  border: "1px solid",
                                  borderColor:
                                    focusedThreadId === thread.id
                                      ? "primary.main"
                                      : "divider",
                                  boxShadow:
                                    focusedThreadId === thread.id
                                      ? "0 0 0 1px rgba(25,118,210,0.12)"
                                      : "none",
                                  background:
                                    "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
                                }}
                              >
                                <Stack spacing={1.25}>
                                  <Stack
                                    direction={{ xs: "column", md: "row" }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{
                                      xs: "flex-start",
                                      md: "center",
                                    }}
                                  >
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      flexWrap="wrap"
                                      useFlexGap
                                    >
                                      <Chip
                                        size="small"
                                        label={thread.typeLabel}
                                        variant="outlined"
                                        sx={{ fontWeight: 700 }}
                                      />
                                      <Chip
                                        size="small"
                                        label={thread.statusLabel}
                                        sx={{
                                          fontWeight: 700,
                                          color: statusTone.color,
                                          bgcolor: statusTone.background,
                                          border: "1px solid",
                                          borderColor: statusTone.borderColor,
                                        }}
                                      />
                                      {thread.reopenedCount > 0 && (
                                        <Chip
                                          size="small"
                                          label={`${thread.reopenedCount} retorno${thread.reopenedCount > 1 ? "s" : ""}`}
                                          variant="outlined"
                                        />
                                      )}
                                    </Stack>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Última atualização{" "}
                                      {thread.lastMessageAt
                                        ? new Date(
                                            thread.lastMessageAt,
                                          ).toLocaleString("pt-BR")
                                        : "-"}
                                    </Typography>
                                  </Stack>

                                  <Stack spacing={1}>
                                    {(thread.messages ?? []).map(
                                      (message: any) => {
                                        const isPresidentMessage =
                                          message.authorKind === "PRESIDENT";

                                        return (
                                          <Box
                                            key={message.id}
                                            sx={{
                                              alignSelf: isPresidentMessage
                                                ? "flex-end"
                                                : "flex-start",
                                              maxWidth: {
                                                xs: "100%",
                                                md: "88%",
                                              },
                                              p: 1.25,
                                              borderRadius: 3,
                                              borderTopLeftRadius:
                                                isPresidentMessage ? 3 : 1,
                                              borderTopRightRadius:
                                                isPresidentMessage ? 1 : 3,
                                              bgcolor: isPresidentMessage
                                                ? "rgba(25,118,210,0.08)"
                                                : "rgba(15,23,42,0.05)",
                                              border: "1px solid",
                                              borderColor: isPresidentMessage
                                                ? "rgba(25,118,210,0.16)"
                                                : "rgba(148,163,184,0.22)",
                                            }}
                                          >
                                            <Typography
                                              variant="overline"
                                              color="text.secondary"
                                              sx={{ lineHeight: 1.2 }}
                                            >
                                              {message.authorLabel} •{" "}
                                              {message.typeLabel}
                                            </Typography>
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                whiteSpace: "pre-wrap",
                                                mt: 0.35,
                                              }}
                                            >
                                              {message.body}
                                            </Typography>
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ display: "block", mt: 0.5 }}
                                            >
                                              {message.createdBy?.name ??
                                                "Usuário"}{" "}
                                              •{" "}
                                              {message.createdAt
                                                ? new Date(
                                                    message.createdAt,
                                                  ).toLocaleString("pt-BR")
                                                : "-"}
                                            </Typography>
                                          </Box>
                                        );
                                      },
                                    )}
                                  </Stack>

                                  {thread.type === "PENDENCY" &&
                                    thread.status === "OPEN" &&
                                    canCreateCipavdThread && (
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2.5,
                                          border: "1px dashed",
                                          borderColor: "rgba(180, 83, 9, 0.28)",
                                          bgcolor: "rgba(245, 158, 11, 0.05)",
                                        }}
                                      >
                                        <Stack spacing={1}>
                                          <Stack
                                            direction={{
                                              xs: "column",
                                              sm: "row",
                                            }}
                                            spacing={1}
                                            justifyContent="space-between"
                                            alignItems={{
                                              xs: "flex-start",
                                              sm: "center",
                                            }}
                                          >
                                            <Box>
                                              <Typography
                                                variant="subtitle2"
                                                fontWeight={800}
                                              >
                                                Gestão da pendência
                                              </Typography>
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                Ajuste o texto atual ou exclua a
                                                pendência quando ela tiver sido
                                                aberta por engano.
                                              </Typography>
                                            </Box>
                                            <Stack
                                              direction="row"
                                              spacing={1}
                                              flexWrap="wrap"
                                              useFlexGap
                                            >
                                              <Button
                                                variant={
                                                  isEditingThread
                                                    ? "contained"
                                                    : "outlined"
                                                }
                                                size="small"
                                                color="inherit"
                                                onClick={() =>
                                                  isEditingThread
                                                    ? stopEditingPendingThread(
                                                        thread.id,
                                                      )
                                                    : startEditingPendingThread(
                                                        thread,
                                                      )
                                                }
                                                disabled={
                                                  updateCipavdThread.isPending
                                                }
                                              >
                                                {isEditingThread
                                                  ? "Cancelar edição"
                                                  : "Editar pendência"}
                                              </Button>
                                              <Button
                                                variant="outlined"
                                                size="small"
                                                color="inherit"
                                                onClick={() =>
                                                  setConfirmThreadDeleteTarget({
                                                    id: thread.id,
                                                    label:
                                                      activeManagementMessage?.body,
                                                  })
                                                }
                                                disabled={
                                                  !canDeleteThread ||
                                                  removeCipavdThread.isPending
                                                }
                                              >
                                                Excluir pendência
                                              </Button>
                                            </Stack>
                                          </Stack>
                                          {isEditingThread && (
                                            <Stack spacing={1}>
                                              <TextField
                                                size="small"
                                                label="Texto da pendência"
                                                value={draftValue}
                                                onChange={(event) =>
                                                  setThreadDraftValue(
                                                    thread.id,
                                                    event.target.value,
                                                  )
                                                }
                                                fullWidth
                                                multiline
                                                minRows={2}
                                                helperText="A edição atualiza o texto ativo da pendência sem quebrar o histórico."
                                              />
                                              <Box
                                                display="flex"
                                                justifyContent="flex-end"
                                              >
                                                <Button
                                                  variant="contained"
                                                  onClick={() =>
                                                    saveEditedPendingThread(
                                                      thread.id,
                                                    )
                                                  }
                                                  disabled={
                                                    !draftValue.trim() ||
                                                    updateCipavdThread.isPending
                                                  }
                                                >
                                                  Salvar ajuste
                                                </Button>
                                              </Box>
                                            </Stack>
                                          )}
                                        </Stack>
                                      </Box>
                                    )}

                                  {thread.type === "PENDENCY" &&
                                    thread.status === "OPEN" &&
                                    canResolveCipavdPending && (
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2.5,
                                          border: "1px dashed",
                                          borderColor: "rgba(25,118,210,0.28)",
                                          bgcolor: "rgba(25,118,210,0.03)",
                                        }}
                                      >
                                        <Stack spacing={1}>
                                          <TextField
                                            size="small"
                                            label="Resposta da comissão"
                                            value={draftValue}
                                            onChange={(event) =>
                                              setThreadDraftValue(
                                                thread.id,
                                                event.target.value,
                                              )
                                            }
                                            fullWidth
                                            multiline
                                            minRows={2}
                                          />
                                          <Box
                                            display="flex"
                                            justifyContent="flex-end"
                                          >
                                            <Button
                                              variant="contained"
                                              onClick={() =>
                                                resolvePendingThread(thread.id)
                                              }
                                              disabled={
                                                !draftValue.trim() ||
                                                resolveCipavdThread.isPending
                                              }
                                            >
                                              Responder e resolver
                                            </Button>
                                          </Box>
                                        </Stack>
                                      </Box>
                                    )}

                                  {thread.type === "PENDENCY" &&
                                    thread.status === "RESOLVED" &&
                                    canReviewResolvedPendencies && (
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2.5,
                                          border: "1px dashed",
                                          borderColor:
                                            "rgba(34, 197, 94, 0.28)",
                                          bgcolor: "rgba(34, 197, 94, 0.04)",
                                        }}
                                      >
                                        <Stack spacing={1}>
                                          <TextField
                                            size="small"
                                            label="Validação final ou nova pendência"
                                            value={draftValue}
                                            onChange={(event) =>
                                              setThreadDraftValue(
                                                thread.id,
                                                event.target.value,
                                              )
                                            }
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            helperText="Descreva a solução validada para encerrar ou registre uma nova exigência no mesmo histórico."
                                          />
                                          <Stack
                                            direction={{
                                              xs: "column",
                                              sm: "row",
                                            }}
                                            spacing={1}
                                            justifyContent="flex-end"
                                          >
                                            <Button
                                              variant="outlined"
                                              color="inherit"
                                              onClick={() =>
                                                finalizePendingThread(thread.id)
                                              }
                                              disabled={
                                                !draftValue.trim() ||
                                                finalizeCipavdThread.isPending
                                              }
                                            >
                                              Finalizar com solução
                                            </Button>
                                            <Button
                                              variant="contained"
                                              onClick={() =>
                                                reopenPendingThread(thread.id)
                                              }
                                              disabled={
                                                !draftValue.trim() ||
                                                reopenCipavdThread.isPending
                                              }
                                            >
                                              Gerar nova pendência
                                            </Button>
                                          </Stack>
                                        </Stack>
                                      </Box>
                                    )}
                                </Stack>
                              </Box>
                            );
                          })}
                        </Stack>
                      )}

                      {selectedLegacyComments.length > 0 && (
                        <>
                          <Divider />
                          <Stack spacing={1}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Registros anteriores
                            </Typography>
                            {selectedLegacyComments.map((comment: any) => (
                              <Box
                                key={comment.id}
                                sx={{
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 2,
                                  p: 1.25,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ whiteSpace: "pre-wrap" }}
                                >
                                  {comment.text}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {comment.createdBy?.name ?? "Usuário"} •{" "}
                                  {new Date(comment.createdAt).toLocaleString(
                                    "pt-BR",
                                  )}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={Boolean(summaryPrivacyReview)}
        onClose={() => {
          if (summarySaveState !== "idle") return;
          setSummaryPrivacyReview(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Possíveis nomes identificados no Resumo do Fato
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              {summaryPrivacyReview?.userMessage ??
                "A Inteligência Artificial identificou a presença de possíveis nomes no texto."}{" "}
              Revise o texto abaixo. Se entender que a sinalização não procede,
              ainda é possível prosseguir com o salvamento.
            </Alert>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={`${summaryPrivacyReview?.findings.length ?? 0} trecho${
                  (summaryPrivacyReview?.findings.length ?? 0) === 1 ? "" : "s"
                } sinalizado${(summaryPrivacyReview?.findings.length ?? 0) === 1 ? "" : "s"}`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={
                  summaryPrivacyReview?.engine === "hybrid"
                    ? "Heurística + IA"
                    : summaryPrivacyReview?.engine === "llm"
                      ? "IA"
                      : "Heurística"
                }
              />
              {summaryPrivacyReview?.model && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={summaryPrivacyReview.model}
                />
              )}
            </Stack>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Trechos sinalizados no texto
              </Typography>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.default",
                  p: 2,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                }}
              >
                {summaryPrivacyHighlightSegments.map((segment) => (
                  <Box
                    key={segment.key}
                    component="span"
                    sx={
                      segment.highlighted
                        ? {
                            backgroundColor: "rgba(245, 158, 11, 0.32)",
                            borderRadius: 0.75,
                            px: 0.25,
                            boxDecorationBreak: "clone",
                          }
                        : undefined
                    }
                  >
                    {segment.text}
                  </Box>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                O que revisar
              </Typography>
              <Stack spacing={1}>
                {(summaryPrivacyReview?.findings ?? []).map(
                  (finding, index) => (
                    <Box
                      key={`${finding.start}-${finding.end}-${index}`}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        p: 1.5,
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        justifyContent="space-between"
                      >
                        <Typography fontWeight={700}>
                          {finding.excerpt}
                        </Typography>
                        <Chip
                          size="small"
                          color={
                            finding.confidence === "HIGH"
                              ? "warning"
                              : "default"
                          }
                          label={
                            finding.confidence === "HIGH"
                              ? "Alta confiança"
                              : "Média confiança"
                          }
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.75 }}
                      >
                        {finding.explanation ||
                          "Possível nome próprio associado ao relato."}
                      </Typography>
                    </Box>
                  ),
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSummaryPrivacyReview(null)}
            disabled={summarySaveState !== "idle"}
          >
            Voltar e revisar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              void saveCase({ allowSummaryPrivacyOverride: true });
            }}
            disabled={summarySaveState !== "idle"}
            startIcon={
              summarySaveState === "saving" ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            Prosseguir mesmo assim
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(archiveReasonDialog)}
        onClose={() => setArchiveReasonDialog(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {archiveReasonDialog?.isMissingReason
            ? "Arquivamento sem comentário"
            : "Comentário de arquivamento"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="error">
              {archiveReasonDialog?.isMissingReason
                ? "Esta denúncia foi arquivada sem comentário registrado. Isso pode acontecer em registros antigos, anteriores à obrigatoriedade do motivo de arquivamento."
                : "Motivo registrado para o arquivamento desta denúncia."}
            </Alert>

            {archiveReasonDialog?.caseNumber ? (
              <Typography variant="subtitle2" fontWeight={700}>
                {formatComplaintCaseNumberForDisplay(
                  archiveReasonDialog.caseNumber,
                )}
              </Typography>
            ) : null}

            {archiveReasonDialog?.archivedAt ? (
              <Typography variant="body2" color="text.secondary">
                Arquivada em{" "}
                {new Date(archiveReasonDialog.archivedAt).toLocaleString(
                  "pt-BR",
                )}
              </Typography>
            ) : null}

            <Box
              sx={{
                border: "1px solid rgba(239, 68, 68, 0.24)",
                borderRadius: 2,
                bgcolor: "rgba(239, 68, 68, 0.04)",
                p: 2,
              }}
            >
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}
              >
                {archiveReasonDialog?.archiveReason ??
                  "Nenhum comentário de arquivamento foi informado neste registro."}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveReasonDialog(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Denúncias para validação</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              A fila considera os filtros ativos e reúne denúncias criadas ou
              atualizadas que ainda não receberam validação da comissão.
            </Typography>

            {validationSummaryQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Carregando validações pendentes...
              </Typography>
            ) : pendingValidationItems.length === 0 ? (
              <Alert severity="success">
                Não há denúncias aguardando validação no filtro atual.
              </Alert>
            ) : (
              <Stack spacing={1}>
                {pendingValidationItems.map((item: any) => (
                  <Box
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setValidationModalOpen(false);
                      openDetails(item.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setValidationModalOpen(false);
                        openDetails(item.id);
                      }
                    }}
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      border: "1px solid",
                      borderColor: "divider",
                      cursor: "pointer",
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                      >
                        <Typography fontWeight={700}>
                          {formatComplaintCaseNumberForDisplay(
                            item.caseNumber,
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Atualizada em {formatDateTimePtBr(item.updatedAt)}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {formatOmLabel(item.locality)}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={
                            STATUS_OPTIONS.find(
                              (entry) => entry.value === item.status,
                            )?.label ?? item.status
                          }
                          sx={{ fontWeight: 700 }}
                        />
                        <Chip
                          size="small"
                          label="A validar"
                          sx={{
                            fontWeight: 700,
                            color: "#B45309",
                            bgcolor: "rgba(245, 158, 11, 0.12)",
                            border: "1px solid rgba(245, 158, 11, 0.24)",
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationModalOpen(false)}>Fechar</Button>
          {pendingValidationCount > 0 && (
            <Button
              variant="outlined"
              onClick={() => {
                setValidationModalOpen(false);
                updateParam("validationStatus", "PENDING");
              }}
            >
              Filtrar lista
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Pendências da CIPAVD</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              A listagem respeita os filtros ativos desta tela.
            </Typography>

            {pendingSummaryQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Carregando pendências...
              </Typography>
            ) : (
              <>
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                    Em aberto ({openPendingCount})
                  </Typography>
                  {openPendingItems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma pendência aberta no filtro atual.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {openPendingItems.map((item: any) => (
                        <Box
                          key={item.threadId}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setPendingModalOpen(false);
                            openDetails(item.case.id, item.threadId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setPendingModalOpen(false);
                              openDetails(item.case.id, item.threadId);
                            }
                          }}
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            border: "1px solid",
                            borderColor: "divider",
                            cursor: "pointer",
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                            >
                              <Typography fontWeight={700}>
                                {formatComplaintCaseNumberForDisplay(
                                  item.case.caseNumber,
                                )}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {item.lastMessageAt
                                  ? new Date(item.lastMessageAt).toLocaleString(
                                      "pt-BR",
                                    )
                                  : "-"}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {formatOmLabel(item.case.locality)}
                            </Typography>
                            <Typography variant="body2">
                              {item.lastMessage?.body ??
                                "Sem detalhe informado."}
                            </Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>

                {resolvedPendingCount > 0 && (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      gutterBottom
                    >
                      Resolvidas aguardando validação ({resolvedPendingCount})
                    </Typography>
                    {resolvedPendingItems.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma pendência resolvida para validação.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {resolvedPendingItems.map((item: any) => (
                          <Box
                            key={item.threadId}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setPendingModalOpen(false);
                              openDetails(item.case.id, item.threadId);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setPendingModalOpen(false);
                                openDetails(item.case.id, item.threadId);
                              }
                            }}
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              border: "1px solid",
                              borderColor: "divider",
                              cursor: "pointer",
                              backgroundColor: "rgba(34, 197, 94, 0.04)",
                            }}
                          >
                            <Stack spacing={0.75}>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                              >
                                <Typography fontWeight={700}>
                                  {formatComplaintCaseNumberForDisplay(
                                    item.case.caseNumber,
                                  )}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {item.lastMessageAt
                                    ? new Date(
                                        item.lastMessageAt,
                                      ).toLocaleString("pt-BR")
                                    : "-"}
                                </Typography>
                              </Stack>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {formatOmLabel(item.case.locality)}
                              </Typography>
                              <Typography variant="body2">
                                {item.lastMessage?.body ??
                                  "Sem resolução registrada."}
                              </Typography>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingModalOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={Boolean(
          consistencyPopover.anchorEl && consistencyPopover.inconsistency,
        )}
        anchorEl={consistencyPopover.anchorEl}
        onClose={() =>
          setConsistencyPopover({ anchorEl: null, inconsistency: null })
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            maxWidth: 480,
            p: 2,
            borderRadius: 3,
          },
        }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={800}>
            {consistencyPopover.inconsistency?.headline}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {consistencyPopover.inconsistency?.summary}
          </Typography>
          <Divider />
          <Typography variant="caption" fontWeight={800} color="text.secondary">
            {consistencyPopover.inconsistency?.referenceTitle}
          </Typography>
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-line", maxHeight: 320, overflowY: "auto" }}
          >
            {consistencyPopover.inconsistency?.referenceBody}
          </Typography>
        </Stack>
      </Popover>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Excluir denúncia ${workflowLabel}`}
        message="Tem certeza que deseja excluir esta denúncia?"
        highlightText={
          selectedCaseQuery.data
            ? `${selectedCaseQuery.data.caseNumber} • ${formatOmLabel(
                selectedCaseQuery.data.locality,
              )}`
            : undefined
        }
        note="Esta ação não pode ser desfeita."
        confirmLabel={deleteCase.isPending ? "Excluindo..." : "Excluir"}
        severity="error"
        confirmLoading={deleteCase.isPending}
      />

      <ConfirmDialog
        open={Boolean(confirmThreadDeleteTarget)}
        onCancel={() => setConfirmThreadDeleteTarget(null)}
        onConfirm={handleConfirmDeleteThread}
        title="Excluir pendência"
        message="Tem certeza que deseja excluir esta pendência?"
        highlightText={confirmThreadDeleteTarget?.label ?? undefined}
        note="A exclusão só é permitida enquanto a pendência ainda não tiver histórico de resposta da comissão."
        confirmLabel={
          removeCipavdThread.isPending ? "Excluindo..." : "Excluir pendência"
        }
        severity="error"
        confirmLoading={removeCipavdThread.isPending}
      />
    </Box>
  );
}
