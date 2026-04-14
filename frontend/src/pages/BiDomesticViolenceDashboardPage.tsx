import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useBiDomesticViolenceDashboard,
  useBiDomesticViolenceResponses,
  useBiDomesticViolenceImports,
  useImportBiDomesticViolence,
  useDeleteBiDomesticViolenceResponses,
  useMe,
  useUpdateBiDomesticViolenceCardSetting,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { hasAnyRole, ROLE_TI } from "../app/roleAccess";
import { useToast } from "../app/toast";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { useSearchParams } from "react-router-dom";

type MetricMode = "PERCENT" | "COUNT";
type CombineMode = "AND" | "OR";
type DeleteConfirmMode = "SELECTED" | "FILTERED";

type DashboardFilters = {
  organization: string[];
  rank: string[];
  maritalStatus: string[];
  education: string[];
  naturality: string[];
  fabBond: string[];
  situationScope: string[];
  frequency: string[];
  affectiveBond: string[];
  violenceTypes: string[];
  authorRelation: string[];
  impactIntensity: string[];
  impactAreas: string[];
  complaintChannels: string[];
  noComplaintReasons: string[];
  authorMilitaryLink: string[];
  occurrencePlace: string[];
  sufferedLifetime: Array<{ value: string; label: string }>;
  sufferedLast12Months: Array<{ value: string; label: string }>;
  soughtHelp: Array<{ value: string; label: string }>;
  witnesses: Array<{ value: string; label: string }>;
};

type DistributionDatum = {
  label: string;
  count: number;
  percent: number;
  [key: string]: string | number;
};

type CardSetting = {
  cardId: string;
  title: string;
  description?: string | null;
};

type EditableCardText = {
  title: string;
  description: string;
};

type ViolenceByOrganizationDatum = {
  organization: string;
  total: number;
  [key: string]: string | number;
};

type DomesticDashboardResponse = {
  kpis: {
    totalResponses: number;
    totalRowsInDb: number;
    lifetimeYesCount: number;
    lifetimeNoCount: number;
    lifetimeUnknownCount: number;
    last12MonthsYesCount: number;
    last12MonthsNoCount: number;
    last12MonthsUnknownCount: number;
    soughtHelpYesCount: number;
    soughtHelpRatePercent: number;
    recurringCount: number;
    recurringRatePercent: number;
    totalViolenceMentions: number;
    avgTypesPerVictim: number;
  };
  filters: DashboardFilters;
  charts: {
    lifetimeDonut: DistributionDatum[];
    last12MonthsDonut: DistributionDatum[];
    violenceTypeDistribution: DistributionDatum[];
    organizationDistribution: DistributionDatum[];
    rankDistribution: DistributionDatum[];
    maritalStatusDistribution: DistributionDatum[];
    educationDistribution: DistributionDatum[];
    naturalityDistribution: DistributionDatum[];
    fabBondDistribution: DistributionDatum[];
    ageRangeDistribution: DistributionDatum[];
    situationScopeDistribution: DistributionDatum[];
    frequencyDistribution: DistributionDatum[];
    affectiveBondDistribution: DistributionDatum[];
    authorRelationDistribution: DistributionDatum[];
    authorMilitaryLinkDistribution: DistributionDatum[];
    occurrencePlaceDistribution: DistributionDatum[];
    witnessesDistribution: DistributionDatum[];
    soughtHelpDistribution: DistributionDatum[];
    impactIntensityDistribution: DistributionDatum[];
    impactAreaDistribution: DistributionDatum[];
    complaintChannelDistribution: DistributionDatum[];
    noComplaintReasonDistribution: DistributionDatum[];
    violenceByOrganization: {
      types: string[];
      items: ViolenceByOrganizationDatum[];
    };
    responseTrend: Array<{
      day: string;
      dayLabel: string;
      total: number;
      positiveCount: number;
      positiveRatePercent: number;
    }>;
  };
  insights: {
    topViolenceType: {
      type: string;
      mentions: number;
      sharePercent: number;
    } | null;
    highestOrganizationRisk: {
      organization: string;
      lifetimeRatePercent: number;
      total: number;
    } | null;
    mostImpactedArea: {
      area: string;
      mentions: number;
      sharePercent: number;
    } | null;
    mainNoReportReason: {
      reason: string;
      mentions: number;
      sharePercent: number;
    } | null;
    preferredChannel: {
      channel: string;
      mentions: number;
      sharePercent: number;
    } | null;
  };
  latestImport?: {
    id: string;
    importedAt: string;
    fileName: string;
  } | null;
  cardSettings?: CardSetting[];
};

type DomesticResponseRow = {
  id: string;
  submittedAt?: string | null;
  age?: number | null;
  organization?: string | null;
  maritalStatus?: string | null;
  education?: string | null;
  naturality?: string | null;
  fabBond?: string | null;
  rank?: string | null;
  situationScope?: string | null;
  sufferedLifetimeRaw?: string | null;
  sufferedLifetime?: boolean | null;
  sufferedLast12MonthsRaw?: string | null;
  sufferedLast12Months?: boolean | null;
  frequency?: string | null;
  affectiveBond?: string | null;
  violenceTypes?: string[];
  authorRelation?: string | null;
  authorMilitaryLink?: string | null;
  occurrencePlace?: string | null;
  witnessesRaw?: string | null;
  witnesses?: boolean | null;
  impactIntensity?: string | null;
  impactAreas?: string[];
  soughtHelpRaw?: string | null;
  soughtHelp?: boolean | null;
  complaintChannels?: string[];
  noComplaintReasons?: string[];
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

const DV_PALETTE = {
  primary: "#0E4A7B",
  primaryDark: "#0A3557",
  accent: "#E64C3C",
  accentSoft: "#F08A7A",
  secondary: "#2E7D32",
  gold: "#C78A00",
  violet: "#6F42C1",
  neutral: "#D7DFEA",
  text: "#1A2A40",
  muted: "#5C6F85",
};

const PIE_COLORS = [
  DV_PALETTE.primary,
  DV_PALETTE.accent,
  DV_PALETTE.neutral,
  DV_PALETTE.secondary,
  DV_PALETTE.gold,
  DV_PALETTE.violet,
];

const DONUT_COLOR_BY_LABEL: Record<string, string> = {
  Sim: DV_PALETTE.accent,
  Não: DV_PALETTE.primary,
  "Não informado": "#AAB6C5",
};

const STACK_COLORS = [
  DV_PALETTE.primary,
  DV_PALETTE.accent,
  DV_PALETTE.secondary,
  DV_PALETTE.gold,
  DV_PALETTE.violet,
  DV_PALETTE.accentSoft,
];

const cardSx = {
  borderRadius: 3,
  border: `1px solid ${alpha(DV_PALETTE.primary, 0.12)}`,
  boxShadow: `0 12px 30px ${alpha(DV_PALETTE.primary, 0.08)}`,
  background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(DV_PALETTE.primary, 0.06)} 100%)`,
};

const axisTickStyle = {
  fill: DV_PALETTE.muted,
  fontSize: 12,
};

const chartGridStroke = alpha(DV_PALETTE.primary, 0.14);
const chartAxisStroke = alpha(DV_PALETTE.primary, 0.2);
const tooltipContentStyle = {
  borderRadius: 10,
  border: `1px solid ${alpha(DV_PALETTE.primary, 0.2)}`,
  boxShadow: `0 10px 24px ${alpha(DV_PALETTE.primary, 0.15)}`,
  background: "#FFFFFF",
};
const tooltipLabelStyle = { color: DV_PALETTE.text, fontWeight: 700 };
const legendWrapperStyle = { color: DV_PALETTE.text };

const FIXED_CARD_DEFAULTS: Record<string, EditableCardText> = {
  "page-header": {
    title: "Violência Doméstica",
    description:
      "Painel estratégico com leitura de prevalência, padrões de impacto e barreiras de denúncia.",
  },
  "panel-ingestion": {
    title: "Ingestão de base CSV/XLSX",
    description:
      "Atualize o BI a partir do formulário oficial, com opção de substituir toda a base.",
  },
  "panel-filters": {
    title: "Filtros analíticos",
    description: "Refine o recorte por período, perfil e respostas do formulário.",
  },
  "kpi-total": {
    title: "Respostas no recorte",
    description: "Volume total de respostas consideradas nos filtros atuais.",
  },
  "kpi-lifetime": {
    title: "Sofreram ao longo da vida",
    description: "Quantidade de respondentes com marcação positiva ao longo da vida.",
  },
  "kpi-last12": {
    title: "Últimos 12 meses",
    description: "Quantidade de respondentes com marcação positiva nos últimos 12 meses.",
  },
  "kpi-sought-help": {
    title: "Buscaram canal",
    description: "Quantidade de respondentes que buscaram algum canal de ajuda.",
  },
  "kpi-sought-help-rate": {
    title: "Taxa de busca de ajuda",
    description: "Percentual de busca de ajuda entre casos com violência declarada.",
  },
  "kpi-recurring": {
    title: "Violência recorrente",
    description: "Volume e percentual de casos recorrentes no recorte atual.",
  },
  "kpi-violence-mentions": {
    title: "Menções de tipos de violência",
    description: "Total de menções distribuídas entre os tipos de violência.",
  },
  "kpi-avg-types": {
    title: "Média de tipos por vítima",
    description: "Média de tipos de violência por resposta positiva.",
  },
  "insight-main": {
    title: "Insights executivos",
    description:
      "Resumo dos principais sinais observados no recorte, com foco em prevalência, canais e barreiras.",
  },
  "chart-lifetime-donut": {
    title: "Sofreu violência ao longo da vida",
    description: "Clique em uma fatia para aplicar filtro.",
  },
  "chart-last12-donut": {
    title: "Sofreu nos últimos 12 meses",
    description: "Clique em uma fatia para filtrar o recorte recente.",
  },
  "chart-response-trend": {
    title: "Evolução das respostas",
    description:
      'Cada barra representa o percentual diário de respostas positivas (responderam "Sim" para violência ao longo da vida).',
  },
  "list-imports": {
    title: "Histórico de importações recentes",
    description: "Últimos lotes importados para esta base.",
  },
  "list-responses": {
    title: "Respostas do recorte",
    description: "Tabela detalhada com os registros filtrados e ações de exclusão.",
  },
  "chart-marital-status": {
    title: "Estado civil",
    description: "",
  },
  "chart-education": {
    title: "Escolaridade",
    description: "",
  },
  "chart-naturality": {
    title: "Naturalidade",
    description: "",
  },
  "chart-fab-bond": {
    title: "Vínculo institucional FAB",
    description: "",
  },
  "chart-situation-scope": {
    title: "Situação relatada",
    description: "",
  },
  "chart-frequency": {
    title: "Frequência da ocorrência",
    description: "",
  },
  "chart-affective-bond": {
    title: "Vínculo afetivo com o autor",
    description: "",
  },
  "chart-author-relation": {
    title: "Tipo de autor do fato",
    description: "",
  },
  "chart-author-military-link": {
    title: "Autor com vínculo militar",
    description: "",
  },
  "chart-occurrence-place": {
    title: "Local da ocorrência",
    description: "",
  },
  "chart-witnesses": {
    title: "Houve testemunhas?",
    description: "",
  },
  "chart-impact-intensity": {
    title: "Intensidade do impacto",
    description: "",
  },
  "chart-sought-help-bar": {
    title: "Procurou canal de denúncia?",
    description: "",
  },
  "chart-violence-types": {
    title: "Tipos de violência reportados",
    description: "Clique em uma barra para filtrar pelo tipo.",
  },
  "chart-impact-areas": {
    title: "Áreas de impacto percebidas",
    description: "Clique em uma barra para filtrar por área.",
  },
  "chart-violence-by-org": {
    title: "Cruzamento: tipos de violência por organização militar",
    description:
      "Visualização de concentração por OM. Clique em qualquer barra para filtrar a organização.",
  },
  "chart-org-distribution": {
    title: "Distribuição por organização",
    description: "",
  },
  "chart-rank": {
    title: "Distribuição por posto/graduação",
    description: "",
  },
  "chart-age": {
    title: "Faixa etária",
    description: "",
  },
  "chart-complaint-channels": {
    title: "Canais de denúncia",
    description: "",
  },
  "chart-no-complaint-reasons": {
    title: "Motivos para não denunciar",
    description: "",
  },
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function getPercentLabel(value: number) {
  return `${value.toFixed(1)}%`;
}

function boolLabel(value: boolean | null | undefined) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "Não informado";
}

function buildCsv(items: DomesticResponseRow[]) {
  const header = [
    "Data",
    "Idade",
    "Organização Militar",
    "Estado civil",
    "Escolaridade",
    "Naturalidade",
    "Vínculo institucional com a FAB",
    "Posto/Graduação",
    "Situação relatada",
    "Sofreu ao longo da vida",
    "Sofreu nos últimos 12 meses",
    "Frequência",
    "Vínculo afetivo com o autor",
    "Tipos de violência",
    "Tipo de vínculo com autor do fato",
    "Autor com vínculo militar",
    "Local da ocorrência",
    "Houve testemunhas",
    "Impacto",
    "Áreas de impacto",
    "Procurou canal",
    "Canal",
    "Motivos para não denunciar",
  ];

  const rows = items.map((item) => [
    formatDate(item.submittedAt),
    item.age ?? "",
    item.organization ?? "",
    item.maritalStatus ?? "",
    item.education ?? "",
    item.naturality ?? "",
    item.fabBond ?? "",
    item.rank ?? "",
    item.situationScope ?? "",
    boolLabel(item.sufferedLifetime),
    boolLabel(item.sufferedLast12Months),
    item.frequency ?? "",
    item.affectiveBond ?? "",
    (item.violenceTypes ?? []).join(" | "),
    item.authorRelation ?? "",
    item.authorMilitaryLink ?? "",
    item.occurrencePlace ?? "",
    boolLabel(item.witnesses),
    item.impactIntensity ?? "",
    (item.impactAreas ?? []).join(" | "),
    boolLabel(item.soughtHelp),
    (item.complaintChannels ?? []).join(" | "),
    (item.noComplaintReasons ?? []).join(" | "),
  ]);

  return [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function metricValue(mode: MetricMode, count: number, percent: number) {
  if (mode === "COUNT") return count;
  return Number(percent.toFixed(2));
}

export function BiDomesticViolenceDashboardPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const responseIdFromUrl = String(searchParams.get("responseId") ?? "").trim();
  const { data: me } = useMe();
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const [metricMode, setMetricMode] = useState<MetricMode>("PERCENT");
  const [responsesExpanded, setResponsesExpanded] = useState(
    Boolean(responseIdFromUrl),
  );
  const [file, setFile] = useState<File | null>(null);
  const [replaceOnImport, setReplaceOnImport] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] =
    useState<DeleteConfirmMode | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardDraft, setEditingCardDraft] = useState<EditableCardText>({
    title: "",
    description: "",
  });

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    organization: "",
    rank: "",
    maritalStatus: "",
    education: "",
    naturality: "",
    fabBond: "",
    situationScope: "",
    sufferedLifetime: "",
    sufferedLast12Months: "",
    frequency: "",
    affectiveBond: "",
    violenceType: "",
    authorRelation: "",
    impactIntensity: "",
    impactArea: "",
    soughtHelp: "",
    complaintChannel: "",
    noComplaintReason: "",
    authorMilitaryLink: "",
    occurrencePlace: "",
    witnesses: "",
    responseId: responseIdFromUrl,
    q: "",
    combineMode: "AND" as CombineMode,
  });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, responseId: responseIdFromUrl }));
    if (responseIdFromUrl) {
      setPage(1);
      setResponsesExpanded(true);
    }
  }, [responseIdFromUrl]);

  const dashboardFilters = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
      organization: filters.organization || undefined,
      rank: filters.rank || undefined,
      maritalStatus: filters.maritalStatus || undefined,
      education: filters.education || undefined,
      naturality: filters.naturality || undefined,
      fabBond: filters.fabBond || undefined,
      situationScope: filters.situationScope || undefined,
      sufferedLifetime: filters.sufferedLifetime || undefined,
      sufferedLast12Months: filters.sufferedLast12Months || undefined,
      frequency: filters.frequency || undefined,
      affectiveBond: filters.affectiveBond || undefined,
      violenceType: filters.violenceType || undefined,
      authorRelation: filters.authorRelation || undefined,
      impactIntensity: filters.impactIntensity || undefined,
      impactArea: filters.impactArea || undefined,
      soughtHelp: filters.soughtHelp || undefined,
      complaintChannel: filters.complaintChannel || undefined,
      noComplaintReason: filters.noComplaintReason || undefined,
      authorMilitaryLink: filters.authorMilitaryLink || undefined,
      occurrencePlace: filters.occurrencePlace || undefined,
      witnesses: filters.witnesses || undefined,
      responseId: filters.responseId || undefined,
      q: filters.q || undefined,
      combineMode: filters.combineMode || undefined,
    }),
    [filters],
  );

  const dashboardQuery = useBiDomesticViolenceDashboard(dashboardFilters);
  const responsesQuery = useBiDomesticViolenceResponses({
    ...dashboardFilters,
    page,
    pageSize: 25,
  });
  const importsQuery = useBiDomesticViolenceImports({ page: 1, pageSize: 8 });
  const importMutation = useImportBiDomesticViolence();
  const deleteResponsesMutation = useDeleteBiDomesticViolenceResponses();
  const updateCardSettingMutation = useUpdateBiDomesticViolenceCardSetting();

  const dashboard = dashboardQuery.data as
    | DomesticDashboardResponse
    | undefined;
  const responses = responsesQuery.data as
    | PagedResponse<DomesticResponseRow>
    | undefined;
  const imports = importsQuery.data as
    | PagedResponse<{
        id: string;
        fileName: string;
        importedAt: string;
        insertedRows: number;
        duplicateRows: number;
        invalidRows: number;
      }>
    | undefined;

  const canUpload = can(me, "bi", "upload");
  const canDelete = can(me, "bi", "delete");

  const getDefaultCardText = (cardId: string): EditableCardText => {
    return (
      FIXED_CARD_DEFAULTS[cardId] ?? {
        title: cardId,
        description: "",
      }
    );
  };

  const cardSettingsMap = useMemo(() => {
    const map = new Map<string, EditableCardText>();
    for (const item of dashboard?.cardSettings ?? []) {
      const cardId = String(item?.cardId ?? "").trim();
      if (!cardId) continue;
      map.set(cardId, {
        title:
          String(item?.title ?? "").trim() ||
          getDefaultCardText(cardId).title,
        description:
          typeof item?.description === "string"
            ? item.description
            : getDefaultCardText(cardId).description,
      });
    }
    return map;
  }, [dashboard?.cardSettings]);

  const getCardText = (cardId: string): EditableCardText => {
    return cardSettingsMap.get(cardId) ?? getDefaultCardText(cardId);
  };

  const openCardEditor = (cardId: string) => {
    const text = getCardText(cardId);
    setEditingCardId(cardId);
    setEditingCardDraft({ ...text });
  };

  const saveCardEditor = async () => {
    if (!editingCardId) return;
    const title = editingCardDraft.title.trim();
    if (!title) {
      toast.push({
        message: "Título é obrigatório.",
        severity: "warning",
      });
      return;
    }

    try {
      await updateCardSettingMutation.mutateAsync({
        cardId: editingCardId,
        payload: {
          title,
          description: editingCardDraft.description.trim() || "",
        },
      });
      toast.push({
        message: "Texto do card atualizado.",
        severity: "success",
      });
      setEditingCardId(null);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao atualizar card.",
        severity: "error",
      });
    }
  };

  const totalPages = responses
    ? Math.max(1, Math.ceil(responses.total / responses.pageSize))
    : 1;

  const currentPageIds = useMemo(
    () => (responses?.items ?? []).map((item) => item.id),
    [responses?.items],
  );

  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.includes(id));

  const organizationBars = useMemo(
    () => (dashboard?.charts.organizationDistribution ?? []).slice(0, 12),
    [dashboard?.charts.organizationDistribution],
  );

  const violenceTypeBars = useMemo(
    () => (dashboard?.charts.violenceTypeDistribution ?? []).slice(0, 8),
    [dashboard?.charts.violenceTypeDistribution],
  );

  const impactAreaBars = useMemo(
    () => (dashboard?.charts.impactAreaDistribution ?? []).slice(0, 8),
    [dashboard?.charts.impactAreaDistribution],
  );

  const channelBars = useMemo(
    () => (dashboard?.charts.complaintChannelDistribution ?? []).slice(0, 8),
    [dashboard?.charts.complaintChannelDistribution],
  );

  const reasonBars = useMemo(
    () => (dashboard?.charts.noComplaintReasonDistribution ?? []).slice(0, 8),
    [dashboard?.charts.noComplaintReasonDistribution],
  );

  const rankBars = useMemo(
    () => (dashboard?.charts.rankDistribution ?? []).slice(0, 10),
    [dashboard?.charts.rankDistribution],
  );

  const maritalStatusBars = useMemo(
    () => (dashboard?.charts.maritalStatusDistribution ?? []).slice(0, 8),
    [dashboard?.charts.maritalStatusDistribution],
  );

  const educationBars = useMemo(
    () => (dashboard?.charts.educationDistribution ?? []).slice(0, 8),
    [dashboard?.charts.educationDistribution],
  );

  const naturalityBars = useMemo(
    () => (dashboard?.charts.naturalityDistribution ?? []).slice(0, 8),
    [dashboard?.charts.naturalityDistribution],
  );

  const fabBondBars = useMemo(
    () => (dashboard?.charts.fabBondDistribution ?? []).slice(0, 8),
    [dashboard?.charts.fabBondDistribution],
  );

  const situationScopeBars = useMemo(
    () => (dashboard?.charts.situationScopeDistribution ?? []).slice(0, 8),
    [dashboard?.charts.situationScopeDistribution],
  );

  const frequencyBars = useMemo(
    () => (dashboard?.charts.frequencyDistribution ?? []).slice(0, 8),
    [dashboard?.charts.frequencyDistribution],
  );

  const affectiveBondBars = useMemo(
    () => (dashboard?.charts.affectiveBondDistribution ?? []).slice(0, 8),
    [dashboard?.charts.affectiveBondDistribution],
  );

  const authorRelationBars = useMemo(
    () => (dashboard?.charts.authorRelationDistribution ?? []).slice(0, 8),
    [dashboard?.charts.authorRelationDistribution],
  );

  const authorMilitaryLinkBars = useMemo(
    () => (dashboard?.charts.authorMilitaryLinkDistribution ?? []).slice(0, 8),
    [dashboard?.charts.authorMilitaryLinkDistribution],
  );

  const occurrencePlaceBars = useMemo(
    () => (dashboard?.charts.occurrencePlaceDistribution ?? []).slice(0, 8),
    [dashboard?.charts.occurrencePlaceDistribution],
  );

  const impactIntensityBars = useMemo(
    () => (dashboard?.charts.impactIntensityDistribution ?? []).slice(0, 8),
    [dashboard?.charts.impactIntensityDistribution],
  );

  const witnessesBars = useMemo(
    () => dashboard?.charts.witnessesDistribution ?? [],
    [dashboard?.charts.witnessesDistribution],
  );

  const soughtHelpBars = useMemo(
    () => dashboard?.charts.soughtHelpDistribution ?? [],
    [dashboard?.charts.soughtHelpDistribution],
  );

  const ageBars = useMemo(
    () => dashboard?.charts.ageRangeDistribution ?? [],
    [dashboard?.charts.ageRangeDistribution],
  );

  const trend = dashboard?.charts.responseTrend ?? [];
  const violenceByOrganization = dashboard?.charts.violenceByOrganization;

  const updateFilter = <K extends keyof typeof filters>(
    key: K,
    value: (typeof filters)[K],
  ) => {
    setPage(1);
    setSelectedIds([]);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setSelectedIds([]);
    setFilters({
      from: "",
      to: "",
      organization: "",
      rank: "",
      maritalStatus: "",
      education: "",
      naturality: "",
      fabBond: "",
      situationScope: "",
      sufferedLifetime: "",
      sufferedLast12Months: "",
      frequency: "",
      affectiveBond: "",
      violenceType: "",
      authorRelation: "",
      impactIntensity: "",
      impactArea: "",
      soughtHelp: "",
      complaintChannel: "",
      noComplaintReason: "",
      authorMilitaryLink: "",
      occurrencePlace: "",
      witnesses: "",
      responseId: responseIdFromUrl,
      q: "",
      combineMode: "AND",
    });
  };

  const toggleSelectAllCurrentPage = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id)),
      );
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...currentPageIds])]);
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleImport = async () => {
    if (!file) {
      toast.push({
        message: "Selecione um CSV/XLSX para importar.",
        severity: "warning",
      });
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        file,
        replace: replaceOnImport,
      });
      setFile(null);
      toast.push({
        message:
          `Importação concluída. Inseridos: ${result?.batch?.insertedRows ?? 0}. ` +
          `Duplicados: ${result?.batch?.duplicateRows ?? 0}. Inválidos: ${result?.batch?.invalidRows ?? 0}.`,
        severity: "success",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao importar o arquivo.",
        severity: "error",
      });
    }
  };

  const exportCurrentCsv = () => {
    if (!responses?.items?.length) {
      toast.push({
        message: "Sem dados para exportar no recorte atual.",
        severity: "warning",
      });
      return;
    }

    const csv = buildCsv(responses.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bi-violencia-domestica-recorte.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmMode) return;

    try {
      if (deleteConfirmMode === "SELECTED") {
        const result = await deleteResponsesMutation.mutateAsync({
          ids: selectedIds,
        });
        toast.push({
          message: `${result?.deletedCount ?? 0} registro(s) excluído(s).`,
          severity: "success",
        });
      } else {
        const result = await deleteResponsesMutation.mutateAsync({
          ...dashboardFilters,
          allFiltered: true,
        });
        toast.push({
          message: `${result?.deletedCount ?? 0} registro(s) excluído(s) pelo filtro atual.`,
          severity: "success",
        });
      }

      setDeleteConfirmMode(null);
      setSelectedIds([]);
      setPage(1);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao excluir registros.",
        severity: "error",
      });
      setDeleteConfirmMode(null);
    }
  };

  if (dashboardQuery.isLoading) return <SkeletonState />;

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  if (!dashboard) {
    return (
      <Alert severity="warning">
        Não foi possível carregar os dados do BI de Violência Doméstica.
      </Alert>
    );
  }

  const pageHeaderText = getCardText("page-header");
  const ingestionPanelText = getCardText("panel-ingestion");
  const filtersPanelText = getCardText("panel-filters");
  const kpiTextsById: Record<string, EditableCardText> = {
    "kpi-total": getCardText("kpi-total"),
    "kpi-lifetime": getCardText("kpi-lifetime"),
    "kpi-last12": getCardText("kpi-last12"),
    "kpi-sought-help": getCardText("kpi-sought-help"),
    "kpi-sought-help-rate": getCardText("kpi-sought-help-rate"),
    "kpi-recurring": getCardText("kpi-recurring"),
    "kpi-violence-mentions": getCardText("kpi-violence-mentions"),
    "kpi-avg-types": getCardText("kpi-avg-types"),
  };
  const insightMainText = getCardText("insight-main");
  const lifetimeDonutText = getCardText("chart-lifetime-donut");
  const last12DonutText = getCardText("chart-last12-donut");
  const responseTrendText = getCardText("chart-response-trend");
  const importsText = getCardText("list-imports");
  const responsesText = getCardText("list-responses");

  const renderDistributionChartHeader = (cardId: string) => {
    const text = getCardText(cardId);
    const hasDesc = Boolean(String(text.description ?? "").trim());
    return (
      <>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ mb: hasDesc ? 0.5 : 1 }}
          >
            {text.title}
          </Typography>
          {isTiProfile ? (
            <MuiTooltip title="Editar título/descrição">
              <IconButton size="small" onClick={() => openCardEditor(cardId)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
          ) : null}
        </Stack>
        {hasDesc ? (
          <Typography variant="body2" sx={{ color: DV_PALETTE.muted, mb: 1.2 }}>
            {text.description}
          </Typography>
        ) : null}
      </>
    );
  };

  return (
    <Box
      sx={{
        color: DV_PALETTE.text,
        background: `radial-gradient(1200px 420px at -8% -18%, ${alpha(DV_PALETTE.primary, 0.22)} 0%, transparent 62%), radial-gradient(1000px 320px at 110% -10%, ${alpha(DV_PALETTE.accent, 0.16)} 0%, transparent 60%)`,
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ lg: "center" }}
        gap={1.5}
        mb={2}
      >
        <Box>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Typography variant="h4" fontWeight={700}>
              {pageHeaderText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton size="small" onClick={() => openCardEditor("page-header")}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="body2" sx={{ color: DV_PALETTE.muted }}>
            {pageHeaderText.description}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            component="a"
            href="/templates/bi-domestic-violence-template.csv"
            download
            sx={{
              borderColor: alpha(DV_PALETTE.primary, 0.45),
              color: DV_PALETTE.primary,
              "&:hover": {
                borderColor: DV_PALETTE.primary,
                bgcolor: alpha(DV_PALETTE.primary, 0.08),
              },
            }}
          >
            Baixar template
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={exportCurrentCsv}
            sx={{
              borderColor: alpha(DV_PALETTE.primary, 0.45),
              color: DV_PALETTE.primary,
              "&:hover": {
                borderColor: DV_PALETTE.primary,
                bgcolor: alpha(DV_PALETTE.primary, 0.08),
              },
            }}
          >
            Exportar recorte CSV
          </Button>

          <Button
            size="small"
            variant="contained"
            startIcon={<AutoGraphRoundedIcon />}
            onClick={resetFilters}
            sx={{
              bgcolor: DV_PALETTE.primary,
              "&:hover": { bgcolor: DV_PALETTE.primaryDark },
            }}
          >
            Limpar filtros
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{ lg: "center" }}
                gap={1.2}
              >
                <Box>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      {ingestionPanelText.title}
                    </Typography>
                    {isTiProfile ? (
                      <MuiTooltip title="Editar título/descrição">
                        <IconButton
                          size="small"
                          onClick={() => openCardEditor("panel-ingestion")}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </MuiTooltip>
                    ) : null}
                  </Stack>
                  <Typography variant="body2" sx={{ color: DV_PALETTE.muted }}>
                    {ingestionPanelText.description}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    component="label"
                    size="small"
                    variant="outlined"
                    startIcon={<UploadFileRoundedIcon />}
                    disabled={!canUpload}
                    sx={{
                      borderColor: alpha(DV_PALETTE.primary, 0.45),
                      color: DV_PALETTE.primary,
                      "&:hover": {
                        borderColor: DV_PALETTE.primary,
                        bgcolor: alpha(DV_PALETTE.primary, 0.08),
                      },
                    }}
                  >
                    Selecionar arquivo
                    <input
                      hidden
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null;
                        setFile(selected);
                      }}
                    />
                  </Button>

                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleImport}
                    disabled={!canUpload || !file || importMutation.isPending}
                    sx={{
                      bgcolor: DV_PALETTE.accent,
                      "&:hover": { bgcolor: "#CA3325" },
                    }}
                  >
                    {importMutation.isPending ? "Importando..." : "Importar"}
                  </Button>
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{ lg: "center" }}
                mt={1.2}
                gap={1}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Chip
                    size="small"
                    label={`Arquivo: ${file?.name ?? "Nenhum"}`}
                    variant="outlined"
                    sx={{
                      borderColor: alpha(DV_PALETTE.primary, 0.35),
                      color: DV_PALETTE.primary,
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={replaceOnImport}
                        onChange={(event) =>
                          setReplaceOnImport(event.target.checked)
                        }
                        disabled={!canUpload}
                      />
                    }
                    label="Substituir base atual"
                    sx={{
                      m: 0,
                      ".MuiFormControlLabel-label": {
                        fontSize: 13,
                        color: DV_PALETTE.muted,
                      },
                    }}
                  />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={
                      metricMode === "PERCENT" ? "contained" : "outlined"
                    }
                    onClick={() => setMetricMode("PERCENT")}
                    sx={{
                      minWidth: 84,
                      ...(metricMode === "PERCENT"
                        ? {
                            bgcolor: DV_PALETTE.primary,
                            "&:hover": { bgcolor: DV_PALETTE.primaryDark },
                          }
                        : {
                            borderColor: alpha(DV_PALETTE.primary, 0.4),
                            color: DV_PALETTE.primary,
                          }),
                    }}
                  >
                    %
                  </Button>
                  <Button
                    size="small"
                    variant={metricMode === "COUNT" ? "contained" : "outlined"}
                    onClick={() => setMetricMode("COUNT")}
                    sx={{
                      minWidth: 84,
                      ...(metricMode === "COUNT"
                        ? {
                            bgcolor: DV_PALETTE.primary,
                            "&:hover": { bgcolor: DV_PALETTE.primaryDark },
                          }
                        : {
                            borderColor: alpha(DV_PALETTE.primary, 0.4),
                            color: DV_PALETTE.primary,
                          }),
                    }}
                  >
                    Quantidade
                  </Button>
                </Stack>
              </Stack>

              {dashboardQuery.isFetching || importsQuery.isFetching ? (
                <Box sx={{ mt: 1.2 }}>
                  <LinearProgress />
                </Box>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>
                Última atualização
              </Typography>
              {dashboard.latestImport ? (
                <Stack spacing={0.6} mt={1}>
                  <Typography variant="body2" sx={{ color: DV_PALETTE.muted }}>
                    Arquivo: <strong>{dashboard.latestImport.fileName}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: DV_PALETTE.muted }}>
                    Data:{" "}
                    <strong>
                      {formatDate(dashboard.latestImport.importedAt)}
                    </strong>
                  </Typography>
                </Stack>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Nenhuma importação registrada até o momento.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 0.6 }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {filtersPanelText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton size="small" onClick={() => openCardEditor("panel-filters")}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: DV_PALETTE.muted }}>
            {filtersPanelText.description}
          </Typography>

          <Grid container spacing={1.2}>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="De"
                type="date"
                value={filters.from}
                onChange={(event) => updateFilter("from", event.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Até"
                type="date"
                value={filters.to}
                onChange={(event) => updateFilter("to", event.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Organização"
                value={filters.organization}
                onChange={(event) =>
                  updateFilter("organization", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.organization ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Posto/Graduação"
                value={filters.rank}
                onChange={(event) => updateFilter("rank", event.target.value)}
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.rank ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Estado civil"
                value={filters.maritalStatus}
                onChange={(event) =>
                  updateFilter("maritalStatus", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.maritalStatus ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Escolaridade"
                value={filters.education}
                onChange={(event) =>
                  updateFilter("education", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.education ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Naturalidade"
                value={filters.naturality}
                onChange={(event) =>
                  updateFilter("naturality", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.naturality ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Vínculo com FAB"
                value={filters.fabBond}
                onChange={(event) =>
                  updateFilter("fabBond", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.fabBond ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Situação relatada"
                value={filters.situationScope}
                onChange={(event) =>
                  updateFilter("situationScope", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.situationScope ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Frequência da ocorrência"
                value={filters.frequency}
                onChange={(event) =>
                  updateFilter("frequency", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.frequency ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Vínculo afetivo (autor)"
                value={filters.affectiveBond}
                onChange={(event) =>
                  updateFilter("affectiveBond", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.affectiveBond ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Tipo de autor do fato"
                value={filters.authorRelation}
                onChange={(event) =>
                  updateFilter("authorRelation", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.authorRelation ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Autor com vínculo militar"
                value={filters.authorMilitaryLink}
                onChange={(event) =>
                  updateFilter("authorMilitaryLink", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.authorMilitaryLink ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Local da ocorrência"
                value={filters.occurrencePlace}
                onChange={(event) =>
                  updateFilter("occurrencePlace", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.occurrencePlace ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Houve testemunhas"
                value={filters.witnesses}
                onChange={(event) =>
                  updateFilter("witnesses", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.witnesses ?? []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Sofreu (vida)"
                value={filters.sufferedLifetime}
                onChange={(event) =>
                  updateFilter("sufferedLifetime", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.sufferedLifetime ?? []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Sofreu (12 meses)"
                value={filters.sufferedLast12Months}
                onChange={(event) =>
                  updateFilter("sufferedLast12Months", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.sufferedLast12Months ?? []).map(
                  (option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ),
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Tipo de violência"
                value={filters.violenceType}
                onChange={(event) =>
                  updateFilter("violenceType", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.violenceTypes ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Intensidade do impacto"
                value={filters.impactIntensity}
                onChange={(event) =>
                  updateFilter("impactIntensity", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.impactIntensity ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Área de impacto"
                value={filters.impactArea}
                onChange={(event) =>
                  updateFilter("impactArea", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.impactAreas ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Canal de denúncia"
                value={filters.complaintChannel}
                onChange={(event) =>
                  updateFilter("complaintChannel", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.complaintChannels ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Motivo de não denúncia"
                value={filters.noComplaintReason}
                onChange={(event) =>
                  updateFilter("noComplaintReason", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.noComplaintReasons ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Procurou canal"
                value={filters.soughtHelp}
                onChange={(event) =>
                  updateFilter("soughtHelp", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.soughtHelp ?? []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Busca livre"
                value={filters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Combinação dos filtros"
                value={filters.combineMode}
                onChange={(event) =>
                  updateFilter("combineMode", event.target.value as CombineMode)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="AND">AND (mais restritivo)</MenuItem>
                <MenuItem value="OR">OR (mais amplo)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={1.2} sx={{ mb: 2 }}>
        {[
          {
            cardId: "kpi-total",
            label: kpiTextsById["kpi-total"].title,
            value: dashboard.kpis.totalResponses,
            color: DV_PALETTE.primary,
          },
          {
            cardId: "kpi-lifetime",
            label: kpiTextsById["kpi-lifetime"].title,
            value: dashboard.kpis.lifetimeYesCount,
            color: DV_PALETTE.accent,
          },
          {
            cardId: "kpi-last12",
            label: kpiTextsById["kpi-last12"].title,
            value: dashboard.kpis.last12MonthsYesCount,
            color: DV_PALETTE.gold,
          },
          {
            cardId: "kpi-sought-help",
            label: kpiTextsById["kpi-sought-help"].title,
            value: dashboard.kpis.soughtHelpYesCount,
            color: DV_PALETTE.secondary,
          },
          {
            cardId: "kpi-sought-help-rate",
            label: kpiTextsById["kpi-sought-help-rate"].title,
            value: `${getPercentLabel(dashboard.kpis.soughtHelpRatePercent)}`,
            color: DV_PALETTE.violet,
          },
          {
            cardId: "kpi-recurring",
            label: kpiTextsById["kpi-recurring"].title,
            value: `${dashboard.kpis.recurringCount} (${getPercentLabel(
              dashboard.kpis.recurringRatePercent,
            )})`,
            color: DV_PALETTE.accentSoft,
          },
          {
            cardId: "kpi-violence-mentions",
            label: kpiTextsById["kpi-violence-mentions"].title,
            value: dashboard.kpis.totalViolenceMentions,
            color: DV_PALETTE.primaryDark,
          },
          {
            cardId: "kpi-avg-types",
            label: kpiTextsById["kpi-avg-types"].title,
            value: dashboard.kpis.avgTypesPerVictim,
            color: DV_PALETTE.primary,
          },
        ].map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ ...cardSx, height: "100%" }}>
              <CardContent
                sx={{ py: 1.2, px: 1.4, "&:last-child": { pb: 1.2 } }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ color: DV_PALETTE.muted }}>
                    {kpi.label}
                  </Typography>
                  {isTiProfile ? (
                    <MuiTooltip title="Editar título/descrição">
                      <IconButton size="small" onClick={() => openCardEditor(kpi.cardId)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </MuiTooltip>
                  ) : null}
                </Stack>
                <Typography
                  variant="h5"
                  sx={{ color: kpi.color, fontWeight: 700, mt: 0.4 }}
                >
                  {kpi.value}
                </Typography>
                <Typography variant="caption" sx={{ color: DV_PALETTE.muted }}>
                  {kpiTextsById[kpi.cardId]?.description ?? ""}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              {insightMainText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton size="small" onClick={() => openCardEditor("insight-main")}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: DV_PALETTE.muted }}>
            {insightMainText.description}
          </Typography>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="info">
                <strong>Tipo predominante:</strong>{" "}
                {dashboard.insights.topViolenceType
                  ? `${dashboard.insights.topViolenceType.type} (${dashboard.insights.topViolenceType.mentions} menções / ${getPercentLabel(
                      dashboard.insights.topViolenceType.sharePercent,
                    )})`
                  : "Sem dados suficientes."}
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="warning">
                <strong>OM com maior prevalência:</strong>{" "}
                {dashboard.insights.highestOrganizationRisk
                  ? `${dashboard.insights.highestOrganizationRisk.organization} (${getPercentLabel(
                      dashboard.insights.highestOrganizationRisk
                        .lifetimeRatePercent,
                    )}, n=${dashboard.insights.highestOrganizationRisk.total})`
                  : "Sem volume mínimo para comparação robusta."}
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="error">
                <strong>Principal barreira de denúncia:</strong>{" "}
                {dashboard.insights.mainNoReportReason
                  ? `${dashboard.insights.mainNoReportReason.reason} (${dashboard.insights.mainNoReportReason.mentions} menções)`
                  : "Sem dados suficientes."}
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Alert severity="success">
                <strong>Canal mais utilizado:</strong>{" "}
                {dashboard.insights.preferredChannel
                  ? `${dashboard.insights.preferredChannel.channel} (${dashboard.insights.preferredChannel.mentions} registros)`
                  : "Sem dados suficientes."}
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Alert severity="info">
                <strong>Área de maior impacto:</strong>{" "}
                {dashboard.insights.mostImpactedArea
                  ? `${dashboard.insights.mostImpactedArea.area} (${dashboard.insights.mostImpactedArea.mentions} menções)`
                  : "Sem dados suficientes."}
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {lifetimeDonutText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton size="small" onClick={() => openCardEditor("chart-lifetime-donut")}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="body2"
                sx={{ color: DV_PALETTE.muted, mb: 1.2 }}
              >
                {lifetimeDonutText.description}
              </Typography>
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={dashboard.charts.lifetimeDonut}
                      dataKey={metricMode === "COUNT" ? "count" : "percent"}
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={98}
                      paddingAngle={2}
                      onClick={(entry: any) => {
                        if (!entry?.label) return;
                        if (entry.label === "Sim")
                          updateFilter("sufferedLifetime", "SIM");
                        if (entry.label === "Não")
                          updateFilter("sufferedLifetime", "NAO");
                      }}
                    >
                      {(dashboard.charts.lifetimeDonut ?? []).map(
                        (entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={
                              DONUT_COLOR_BY_LABEL[entry.label] ??
                              PIE_COLORS[index % PIE_COLORS.length]
                            }
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Registros"];
                        }
                        return [`${getPercentLabel(Number(_value ?? 0))}`, "%"];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Legend wrapperStyle={legendWrapperStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {last12DonutText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton size="small" onClick={() => openCardEditor("chart-last12-donut")}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="body2"
                sx={{ color: DV_PALETTE.muted, mb: 1.2 }}
              >
                {last12DonutText.description}
              </Typography>
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={dashboard.charts.last12MonthsDonut}
                      dataKey={metricMode === "COUNT" ? "count" : "percent"}
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={98}
                      paddingAngle={2}
                      onClick={(entry: any) => {
                        if (!entry?.label) return;
                        if (entry.label === "Sim") {
                          updateFilter("sufferedLast12Months", "SIM");
                        }
                        if (entry.label === "Não") {
                          updateFilter("sufferedLast12Months", "NAO");
                        }
                      }}
                    >
                      {(dashboard.charts.last12MonthsDonut ?? []).map(
                        (entry, index) => (
                          <Cell
                            key={`${entry.label}-${index}`}
                            fill={
                              DONUT_COLOR_BY_LABEL[entry.label] ??
                              PIE_COLORS[index % PIE_COLORS.length]
                            }
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Registros"];
                        }
                        return [`${getPercentLabel(Number(_value ?? 0))}`, "%"];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Legend wrapperStyle={legendWrapperStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-marital-status")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={maritalStatusBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="maritalStatus"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.primaryDark}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.maritalStatus) {
                          updateFilter(
                            "maritalStatus",
                            String(entry.maritalStatus),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-education")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={educationBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="education"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.gold}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.education) {
                          updateFilter("education", String(entry.education));
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-naturality")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={naturalityBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="naturality"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.secondary}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.naturality) {
                          updateFilter("naturality", String(entry.naturality));
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-fab-bond")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={fabBondBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="fabBond"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.violet}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.fabBond) {
                          updateFilter("fabBond", String(entry.fabBond));
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-situation-scope")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={situationScopeBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="situationScope"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.accent}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.situationScope) {
                          updateFilter(
                            "situationScope",
                            String(entry.situationScope),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-frequency")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={frequencyBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="frequency"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.accentSoft}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.frequency) {
                          updateFilter("frequency", String(entry.frequency));
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-affective-bond")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={affectiveBondBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="affectiveBond"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.primary}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.affectiveBond) {
                          updateFilter(
                            "affectiveBond",
                            String(entry.affectiveBond),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-author-relation")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={authorRelationBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="authorRelation"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.gold}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.authorRelation) {
                          updateFilter(
                            "authorRelation",
                            String(entry.authorRelation),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-author-military-link")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={authorMilitaryLinkBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="authorMilitaryLink"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.primaryDark}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.authorMilitaryLink) {
                          updateFilter(
                            "authorMilitaryLink",
                            String(entry.authorMilitaryLink),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-occurrence-place")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={occurrencePlaceBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="occurrencePlace"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.secondary}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.occurrencePlace) {
                          updateFilter(
                            "occurrencePlace",
                            String(entry.occurrencePlace),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-witnesses")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={witnessesBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="witnessesLabel"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.accentSoft}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.witnessesLabel === "Sim") {
                          updateFilter("witnesses", "SIM");
                        }
                        if (entry?.witnessesLabel === "Não") {
                          updateFilter("witnesses", "NAO");
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-impact-intensity")}
              <Box sx={{ height: 248 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={impactIntensityBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="level"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.violet}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.level) {
                          updateFilter(
                            "impactIntensity",
                            String(entry.level),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-sought-help-bar")}
              <Box sx={{ height: 248 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={soughtHelpBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="soughtHelpLabel"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.accent}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.soughtHelpLabel === "Sim") {
                          updateFilter("soughtHelp", "SIM");
                        }
                        if (entry?.soughtHelpLabel === "Não") {
                          updateFilter("soughtHelp", "NAO");
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-violence-types")}
              <Box sx={{ height: 248 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={violenceTypeBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="type"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Menções"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.accent}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.type)
                          updateFilter("violenceType", String(entry.type));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-impact-areas")}
              <Box sx={{ height: 248 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={impactAreaBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="area"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Menções"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.secondary}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.area)
                          updateFilter("impactArea", String(entry.area));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          {renderDistributionChartHeader("chart-violence-by-org")}
          <Box sx={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart barCategoryGap="42%" maxBarSize={14} data={violenceByOrganization?.items ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="organization"
                  stroke={chartAxisStroke}
                  tick={axisTickStyle}
                />
                <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name.endsWith("__count")) {
                      return [`${value ?? 0}`, name.replace(/__count$/, "")];
                    }
                    if (name.endsWith("__percent")) {
                      return [
                        getPercentLabel(Number(value ?? 0)),
                        name.replace(/__percent$/, ""),
                      ];
                    }
                    return [value, name];
                  }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={legendWrapperStyle} />
                {(violenceByOrganization?.types ?? []).map((type, index) => (
                  <Bar
                    key={type}
                    dataKey={
                      metricMode === "COUNT"
                        ? `${type}__count`
                        : `${type}__percent`
                    }
                    stackId="stack"
                    fill={STACK_COLORS[index % STACK_COLORS.length]}
                    onClick={(entry: any) => {
                      if (entry?.organization) {
                        updateFilter(
                          "organization",
                          String(entry.organization),
                        );
                      }
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-org-distribution")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={organizationBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="organization"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.primary}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.organization) {
                          updateFilter(
                            "organization",
                            String(entry.organization),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-rank")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={rankBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="rank"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.gold}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.rank)
                          updateFilter("rank", String(entry.rank));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-age")}
              <Box sx={{ height: 236 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={ageBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="range"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Respostas"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.violet}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-complaint-channels")}
              <Box sx={{ height: 248 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={channelBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="channel"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Menções"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.secondary}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.channel) {
                          updateFilter(
                            "complaintChannel",
                            String(entry.channel),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              {renderDistributionChartHeader("chart-no-complaint-reasons")}
              <Box sx={{ height: 248 }}>
                <ResponsiveContainer>
                  <BarChart barCategoryGap="42%" maxBarSize={14} data={reasonBars}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="reason"
                      stroke={chartAxisStroke}
                      tick={axisTickStyle}
                    />
                    <YAxis stroke={chartAxisStroke} tick={axisTickStyle} />
                    <Tooltip
                      formatter={(_value: number, _name, props: any) => {
                        const payload = props?.payload as
                          | DistributionDatum
                          | undefined;
                        if (metricMode === "COUNT") {
                          return [`${payload?.count ?? 0}`, "Menções"];
                        }
                        return [
                          `${getPercentLabel(Number(payload?.percent ?? 0))}`,
                          "%",
                        ];
                      }}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey={(entry: DistributionDatum) =>
                        metricValue(metricMode, entry.count, entry.percent)
                      }
                      fill={DV_PALETTE.accentSoft}
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry?.reason) {
                          updateFilter(
                            "noComplaintReason",
                            String(entry.reason),
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              {responseTrendText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton size="small" onClick={() => openCardEditor("chart-response-trend")}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: DV_PALETTE.muted }}>
            {responseTrendText.description}
          </Typography>
          <Box sx={{ height: 250 }}>
            <ResponsiveContainer>
              <BarChart barCategoryGap="42%" maxBarSize={14} data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="dayLabel"
                  stroke={chartAxisStroke}
                  tick={axisTickStyle}
                  minTickGap={18}
                />
                <YAxis
                  stroke={chartAxisStroke}
                  tick={axisTickStyle}
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${Math.round(value)}%`}
                  label={{
                    value: "Positivas (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(
                    value: number,
                    _name,
                    props: { payload?: { total?: number; positiveCount?: number } },
                  ) => {
                    const payload = props?.payload;
                    return [
                      getPercentLabel(Number(value ?? 0)),
                      `Positivas (${Number(payload?.positiveCount ?? 0)}/${Number(payload?.total ?? 0)})`,
                    ];
                  }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar
                  dataKey="positiveRatePercent"
                  name="Positivas (%)"
                  fill={alpha(DV_PALETTE.primary, 0.62)}
                  radius={[8, 8, 0, 0]}
                  barSize={10}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
            mb={1}
          >
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Typography variant="subtitle1" fontWeight={700}>
                {importsText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar título/descrição">
                  <IconButton size="small" onClick={() => openCardEditor("list-imports")}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            <Chip
              size="small"
              label={`${imports?.items?.length ?? 0} lote(s)`}
              sx={{
                bgcolor: alpha(DV_PALETTE.primary, 0.1),
                color: DV_PALETTE.primary,
              }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: DV_PALETTE.muted }}>
            {importsText.description}
          </Typography>

          {!imports?.items?.length ? (
            <Alert severity="info">Sem histórico de importações.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Arquivo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Inseridos
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Duplicados
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Inválidos
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(imports.items ?? []).map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.fileName}</TableCell>
                    <TableCell>{formatDate(item.importedAt)}</TableCell>
                    <TableCell align="right">{item.insertedRows}</TableCell>
                    <TableCell align="right">{item.duplicateRows}</TableCell>
                    <TableCell align="right">{item.invalidRows}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card sx={{ ...cardSx, mb: 4 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ lg: "center" }}
            gap={1}
          >
            <Box>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Typography variant="subtitle1" fontWeight={700}>
                  {responsesText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton size="small" onClick={() => openCardEditor("list-responses")}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography variant="caption" sx={{ color: DV_PALETTE.muted }}>
                {responsesText.description}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setResponsesExpanded((prev) => !prev)}
                endIcon={
                  responsesExpanded ? (
                    <KeyboardArrowUpRoundedIcon />
                  ) : (
                    <KeyboardArrowDownRoundedIcon />
                  )
                }
                sx={{
                  borderColor: alpha(DV_PALETTE.primary, 0.45),
                  color: DV_PALETTE.primary,
                }}
              >
                {responsesExpanded ? "Ocultar tabela" : "Exibir tabela"}
              </Button>

              {canDelete ? (
                <MuiTooltip title="Excluir registros selecionados">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      disabled={!selectedIds.length}
                      onClick={() => setDeleteConfirmMode("SELECTED")}
                    >
                      Excluir selecionados
                    </Button>
                  </span>
                </MuiTooltip>
              ) : null}

              {canDelete ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setDeleteConfirmMode("FILTERED")}
                >
                  Excluir filtro atual
                </Button>
              ) : null}
            </Stack>
          </Stack>

          <Collapse in={responsesExpanded}>
            {!responses?.items?.length ? (
              <Alert severity="info" sx={{ mt: 1.2 }}>
                Nenhum registro encontrado para os filtros aplicados.
              </Alert>
            ) : (
              <Box sx={{ mt: 1.2, overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allCurrentPageSelected}
                          indeterminate={
                            selectedIds.length > 0 && !allCurrentPageSelected
                          }
                          onChange={toggleSelectAllCurrentPage}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>OM</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Posto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Vida</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>12 meses</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tipos</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Impacto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Canal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(responses.items ?? []).map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelectRow(row.id)}
                          />
                        </TableCell>
                        <TableCell>{formatDate(row.submittedAt)}</TableCell>
                        <TableCell>{row.organization ?? "-"}</TableCell>
                        <TableCell>{row.rank ?? "-"}</TableCell>
                        <TableCell>{boolLabel(row.sufferedLifetime)}</TableCell>
                        <TableCell>
                          {boolLabel(row.sufferedLast12Months)}
                        </TableCell>
                        <TableCell>
                          {(row.violenceTypes ?? []).length
                            ? (row.violenceTypes ?? []).join(" | ")
                            : "-"}
                        </TableCell>
                        <TableCell>{row.impactIntensity ?? "-"}</TableCell>
                        <TableCell>
                          {(row.complaintChannels ?? []).length
                            ? (row.complaintChannels ?? []).join(" | ")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  mt={1.2}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: DV_PALETTE.muted }}
                  >
                    Página {page} de {totalPages} • Total {responses.total}{" "}
                    registros
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((prev) => Math.min(totalPages, prev + 1))
                      }
                    >
                      Próxima
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      <Dialog
        open={editingCardId !== null}
        onClose={() => setEditingCardId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar texto do card</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.3} sx={{ mt: 0.4 }}>
            <TextField
              label="Título"
              value={editingCardDraft.title}
              onChange={(event) =>
                setEditingCardDraft((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              label="Descrição"
              value={editingCardDraft.description}
              onChange={(event) =>
                setEditingCardDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCardId(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void saveCardEditor()}
            disabled={updateCardSettingMutation.isPending}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmMode !== null}
        title="Confirmar exclusão"
        message={
          deleteConfirmMode === "SELECTED"
            ? `Esta ação excluirá ${selectedIds.length} registro(s) selecionado(s). Deseja continuar?`
            : `Esta ação excluirá ${responses?.total ?? 0} registro(s) com os filtros atuais (${filters.combineMode}). Deseja continuar?`
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onCancel={() => setDeleteConfirmMode(null)}
        onConfirm={handleConfirmDelete}
        confirmLoading={deleteResponsesMutation.isPending}
      />
    </Box>
  );
}
