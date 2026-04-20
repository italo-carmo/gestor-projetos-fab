import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  MenuItem,
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
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAddCpcaCaseComment,
  useAddSmifComplaintCaseComment,
  useCpcaCase,
  useCpcaCases,
  useCpcaCaseLocalityOptions,
  useCreateCpcaCase,
  useDeleteCpcaCase,
  useLocalities,
  useMe,
  usePostos,
  useSmifComplaintCase,
  useSmifComplaintCases,
  useCreateSmifComplaintCase,
  useDeleteSmifComplaintCase,
  useUpdateSmifComplaintCase,
  useUpdateCpcaCase,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_CPCA,
  ROLE_TI,
} from "../app/roleAccess";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

const STATUS_OPTIONS = [
  { value: "RECEIVED", label: "Recebida" },
  { value: "PROTECTION_MEASURES", label: "Acolhimento e proteção" },
  { value: "PRELIMINARY_ANALYSIS", label: "Análise preliminar" },
  { value: "PROCEDURE_DEFINED", label: "Procedimento instaurado" },
  { value: "INVESTIGATION", label: "Em apuração" },
  { value: "CONCLUDED", label: "Concluída" },
  { value: "ARCHIVED", label: "Arquivada" },
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

const DETAILED_VIOLENCE_TYPE_OPTIONS = [
  { value: "ASSEDIO_MORAL", label: "Assédio Moral" },
  { value: "ASSEDIO_SEXUAL", label: "Assédio Sexual" },
  {
    value: "VIOLENCIA_DOMESTICA_FISICA",
    label: "Violência doméstica - Física",
  },
  {
    value: "VIOLENCIA_DOMESTICA_PSICOLOGICA",
    label: "Violência doméstica - Psicológica",
  },
  { value: "VIOLENCIA_DOMESTICA_MORAL", label: "Violência doméstica - Moral" },
  {
    value: "VIOLENCIA_DOMESTICA_PATRIMONIAL",
    label: "Violência doméstica - Patrimonial",
  },
  {
    value: "VIOLENCIA_DOMESTICA_SEXUAL",
    label: "Violência doméstica - Sexual",
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
    title: "1) Notificação e provas",
    subtitle: "ICA Art. 47: registro inicial, dados genéricos e evidências.",
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

const defaultForm = {
  localityId: "",
  complaintType: "MORAL",
  notifierType: "VITIMA",
  status: "RECEIVED",
  procedureType: "NOT_DEFINED",
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
  evidenceCount: 0,
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
  if (
    normalized === "ASSEDIO_SEXUAL" ||
    normalized === "VIOLENCIA_DOMESTICA_SEXUAL" ||
    normalized === "VIOLENCIA_SEXUAL"
  ) {
    return "SEXUAL";
  }
  return "MORAL";
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
  const workflowRoleAccess = isSmifWorkflow
    ? [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI]
    : [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI];

  const canAccessByRole = hasAnyRole(me, workflowRoleAccess);

  const q = params.get("q") ?? "";
  const localityId = params.get("localityId") ?? "";
  const status = params.get("status") ?? "";
  const detailedViolenceType = params.get("detailedViolenceType") ?? "";
  const procedureType = params.get("procedureType") ?? "";
  const pageSizeParam = String(params.get("pageSize") ?? "20").trim().toLowerCase();
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
      page,
      pageSize: showAllRows ? "all" : pageSize,
    }),
    [q, localityId, status, detailedViolenceType, procedureType, page, pageSize, showAllRows],
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
  const cpcaLocalityOptionsQuery = useCpcaCaseLocalityOptions(
    canAccessByRole && !isSmifWorkflow,
  );
  const smifLocalitiesQuery = useLocalities(canAccessByRole && isSmifWorkflow);
  const localitiesQuery = isSmifWorkflow
    ? smifLocalitiesQuery
    : cpcaLocalityOptionsQuery;
  const postosQuery = usePostos();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [newComment, setNewComment] = useState("");
  const [activeStep, setActiveStep] = useState(0);

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
  const createCpcaCase = useCreateCpcaCase();
  const updateCpcaCase = useUpdateCpcaCase();
  const deleteCpcaCase = useDeleteCpcaCase();
  const addCpcaCaseComment = useAddCpcaCaseComment();
  const createSmifCase = useCreateSmifComplaintCase();
  const updateSmifCase = useUpdateSmifComplaintCase();
  const deleteSmifCase = useDeleteSmifComplaintCase();
  const addSmifCaseComment = useAddSmifComplaintCaseComment();
  const createCase = isSmifWorkflow ? createSmifCase : createCpcaCase;
  const updateCase = isSmifWorkflow ? updateSmifCase : updateCpcaCase;
  const deleteCase = isSmifWorkflow ? deleteSmifCase : deleteCpcaCase;
  const addComment = isSmifWorkflow ? addSmifCaseComment : addCpcaCaseComment;
  const canCreateCase = can(me, resourceKey, "create");
  const canUpdateCase = can(me, resourceKey, "update");
  const canDeleteCase = can(me, resourceKey, "delete");
  const canCommentCase = can(me, resourceKey, "comment");
  const workflowLabel = isSmifWorkflow ? "SMIF" : "CPCA";

  const isNationalScope = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
    ROLE_TI,
  ]);

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
        OCCURRENCE_FORM_OPTIONS.map((item) => [item.value, item.label] as const),
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
    Number(form.evidenceCount ?? 0) > 0 ||
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
    if (!isCreateMode || !drawerOpen) return;
    setForm((prev) => ({
      ...prev,
      localityId: isNationalScope || !isSmifWorkflow
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
      localityId: item.localityId ?? "",
      complaintType: inferredComplaintType ?? item.complaintType ?? "MORAL",
      notifierType,
      status: item.status ?? "RECEIVED",
      procedureType: item.procedureType ?? "NOT_DEFINED",
      incidentDate: item.incidentDate
        ? String(item.incidentDate).slice(0, 10)
        : "",
      aggressorRank: item.aggressorRank ?? "",
      aggressorGender: item.aggressorGender ?? "NAO_INFORMADO",
      aggressorAgeRange: item.aggressorAgeRange ?? "",
      victimRank: item.victimRank ?? "",
      victimGender: item.victimGender ?? "NAO_INFORMADO",
      victimAgeRange: item.victimAgeRange ?? "",
      victimIsNotifier: nextNotifierIsVictim,
      notifierRank: item.notifierRank ?? item.victimRank ?? "",
      notifierGender: item.notifierGender ?? item.victimGender ?? "NAO_INFORMADO",
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
      evidenceCount: Number(item.evidenceCount ?? 0),
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
    setForm({
      ...defaultForm,
      localityId: isNationalScope ? "" : String(me?.omId ?? ""),
    });
    setNewComment("");
    setActiveStep(0);
    setDrawerOpen(true);
  };

  const openDetails = (id: string) => {
    setIsCreateMode(false);
    setSelectedId(id);
    setConfirmDeleteOpen(false);
    setNewComment("");
    setActiveStep(0);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedId("");
    setIsCreateMode(false);
    setConfirmDeleteOpen(false);
    setForm(defaultForm);
    setNewComment("");
    setActiveStep(0);
  };

  const saveCase = async () => {
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
      status: form.status,
      procedureType: form.procedureType,
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
      evidenceCount: Number(form.evidenceCount ?? 0),
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

    if (!isCreateMode) {
      payload.statusChangeNote = toNullable(form.statusChangeNote);
    }

    try {
      if (isCreateMode) {
        const created = await createCase.mutateAsync(payload);
        toast.push({
          message: `Caso ${created.caseNumber} criado.`,
          severity: "success",
        });
        setIsCreateMode(false);
        setSelectedId(created.id);
      } else if (selectedId) {
        await updateCase.mutateAsync({ id: selectedId, payload });
        toast.push({
          message: "Caso atualizado com sucesso.",
          severity: "success",
        });
      }
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          `Erro ao salvar caso ${workflowLabel}.`,
        severity: "error",
      });
    }
  };

  const saveComment = async () => {
    if (!canCommentCase) {
      toast.push({
        message: "Seu perfil nao possui permissao para registrar comentários.",
        severity: "warning",
      });
      return;
    }
    if (!selectedId || !newComment.trim()) return;
    try {
      await addComment.mutateAsync({ id: selectedId, text: newComment.trim() });
      setNewComment("");
      toast.push({ message: "Comentário registrado.", severity: "success" });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao registrar comentário.",
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
            gap: 1.2,
          }}
        >
          <Box sx={{ gridColumn: "1 / -1" }}>
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
          >
            <MenuItem value="">Selecionar</MenuItem>
            {OCCURRENCE_LOCATION_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
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

          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
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
                  notifierRank: prev.notifierType === "VITIMA"
                    ? nextVictimRank
                    : prev.notifierRank,
                };
              })
            }
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
                  notifierGender: prev.notifierType === "VITIMA"
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
                  notifierAgeRange: prev.notifierType === "VITIMA"
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
            <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
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
                <MenuItem key={`notifier-gender-${item.value}`} value={item.value}>
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

          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
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
              renderValue: (selected) => {
                const selectedValues = Array.isArray(selected)
                  ? selected.map((item) => String(item).trim()).filter(Boolean)
                  : [];
                if (!selectedValues.length) return "Selecionar";
                return selectedValues
                  .map(
                    (value) =>
                      occurrenceFormLabelByValue.get(value) ?? value,
                  )
                  .join(", ");
              },
            }}
          >
            {OCCURRENCE_FORM_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Provas e evidências
            </Typography>
            <Divider />
          </Box>

          <TextField
            size="small"
            type="number"
            label="Quantidade de evidências"
            value={form.evidenceCount}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                evidenceCount: Number(e.target.value) || 0,
              }))
            }
            inputProps={{ min: 0 }}
          />

          <Box />

          <TextField
            size="small"
            label="Resumo de evidências"
            value={form.evidenceSummary}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, evidenceSummary: e.target.value }))
            }
            multiline
            minRows={6}
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
            helperText="Descreva contexto, canal, datas e material coletado (sem nomes)."
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
                setForm((prev) => ({ ...prev, status: e.target.value }))
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
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  procedureCurrentSituation: e.target.value,
                }))
              }
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
              setForm((prev) => ({ ...prev, status: e.target.value }))
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
                {items.map((item: any) => (
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
                    <TableCell>
                      <Typography fontWeight={700}>
                        {item.caseNumber}
                      </Typography>
                      {item.lastCommentAt && (
                        <Typography variant="caption" color="text.secondary">
                          Último comentário:{" "}
                          {new Date(item.lastCommentAt).toLocaleString("pt-BR")}
                        </Typography>
                      )}
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
                            STATUS_CHIP_STYLES[String(item.status)]?.bgcolor ??
                            "rgba(17, 24, 39, 0.08)",
                          color:
                            STATUS_CHIP_STYLES[String(item.status)]?.color ??
                            "#111827",
                          border: "1px solid",
                          borderColor:
                            STATUS_CHIP_STYLES[String(item.status)]?.borderColor ??
                            "rgba(17, 24, 39, 0.14)",
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
                        ? new Date(item.reportedAt).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
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
        <Box p={3} sx={{ height: "100%", overflowY: "auto" }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Typography variant="h6" fontWeight={700}>
              {isCreateMode
                ? `Nova notificação ${workflowLabel}`
                : `Caso ${selectedCaseQuery.data?.caseNumber ?? ""}`}
            </Typography>
            <Stack direction="row" spacing={1}>
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

          <Alert severity="warning" sx={{ mb: 2 }}>
            Registrar apenas dados genéricos (sem nomes). Acesso restrito a
            {isSmifWorkflow
              ? " TI, Coordenação CIPAVD e COMGEP."
              : " CPCA, Coordenação CIPAVD e COMGEP."}
          </Alert>

          {!isCreateMode && selectedCaseQuery.isLoading && <SkeletonState />}
          {!isCreateMode && selectedCaseQuery.isError && (
            <ErrorState
              error={selectedCaseQuery.error}
              onRetry={() => selectedCaseQuery.refetch()}
            />
          )}

          {(isCreateMode || selectedCaseQuery.data) && (
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Box sx={{ overflowX: "auto", pb: 0.5 }}>
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

                  <Typography variant="subtitle1" fontWeight={700} mt={1}>
                    {STEP_DEFS[activeStep].title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={1.5}>
                    {STEP_DEFS[activeStep].subtitle}
                  </Typography>
                  {activeStep < STEP_DEFS.length - 1 &&
                    activeStep >= maxUnlockedStep && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 1.2 }}
                      >
                        Preencha ao menos um campo útil desta etapa para liberar
                        a próxima e atualizar o status.
                      </Typography>
                    )}

                  {renderStepContent()}

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
                        onClick={saveCase}
                        disabled={
                          (isCreateMode && !canCreateCase) ||
                          (!isCreateMode && !canUpdateCase) ||
                          createCase.isPending ||
                          updateCase.isPending ||
                          deleteCase.isPending
                        }
                      >
                        {isCreateMode
                          ? "Criar notificação"
                          : "Salvar alterações"}
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
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={1}>
                      Comentários do processo
                    </Typography>
                    {(selectedCaseQuery.data.comments ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Nenhum comentário registrado.
                      </Typography>
                    ) : (
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {(selectedCaseQuery.data.comments ?? []).map(
                          (comment: any) => (
                            <Box
                              key={comment.id}
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                p: 1,
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
                          ),
                        )}
                      </Stack>
                    )}
                    <Divider sx={{ mb: 1 }} />
                    {canCommentCase ? (
                      <>
                        <TextField
                          size="small"
                          label="Novo comentário"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          fullWidth
                          multiline
                          minRows={2}
                        />
                        <Box display="flex" justifyContent="flex-end" mt={1}>
                          <Button
                            variant="outlined"
                            onClick={saveComment}
                            disabled={
                              !newComment.trim() ||
                              addComment.isPending ||
                              deleteCase.isPending
                            }
                          >
                            Adicionar comentário
                          </Button>
                        </Box>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Seu perfil possui acesso somente para leitura dos
                        comentários.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>

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
    </Box>
  );
}
