import { useMemo, useState } from "react";
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
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
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
  useBiSurveyDashboard,
  useDeleteBiSurveyResponses,
  useBiSurveyImports,
  useBiSurveyQuestions,
  useBiSurveyResponses,
  useImportBiSurvey,
  useMe,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { hasAnyRole, ROLE_TI } from "../app/roleAccess";
import { useToast } from "../app/toast";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";

type MetricMode = "PERCENT" | "COUNT";
type CombineMode = "AND" | "OR";
type DeleteConfirmMode = "SELECTED" | "FILTERED";

type DashboardFilters = {
  mission: string[];
  om?: string[];
  posto: string[];
  postoGraduacao: string[];
  autodeclara: string[];
  violenceTypes: string[];
  suffered: Array<{ value: string; label: string }>;
};

type OmViolenceDatum = {
  om: string;
  simCount: number;
  naoCount: number;
  unknownCount: number;
  total: number;
  simPercent: number;
  naoPercent: number;
  unknownPercent: number;
};

type DistributionDatum = {
  label: string;
  count: number;
  percent: number;
};

type ViolenceTypeDatum = {
  type: string;
  count: number;
  percent: number;
};

type ViolenceTypeByOmDatum = {
  om: string;
  total: number;
  [key: string]: number | string;
};

type BiDashboardResponse = {
  kpis: {
    totalResponses: number;
    totalRowsInDb: number;
    yesCount: number;
    noCount: number;
    unknownCount: number;
    violenceRatePercent: number;
    totalViolenceMentions: number;
    averageTypesPerVictim: number;
  };
  filters: DashboardFilters;
  charts: {
    omViolencePercent: OmViolenceDatum[];
    omDistribution: DistributionDatum[];
    postoDistribution: DistributionDatum[];
    postoGraduacaoDistribution: DistributionDatum[];
    autodeclaraDistribution: DistributionDatum[];
    yesNoDonut: Array<{ label: string; count: number; percent: number }>;
    violenceTypePercent: ViolenceTypeDatum[];
    violenceTypeByOmPercent: {
      types: string[];
      items: ViolenceTypeByOmDatum[];
    };
    violenceTypeByPostoPercent: {
      types: string[];
      items: Array<{
        posto: string;
        total: number;
        [key: string]: number | string;
      }>;
    };
    monthlyTrend: Array<{
      month: string;
      total: number;
      yesCount: number;
      noCount: number;
      unknownCount: number;
      yesRatePercent: number;
    }>;
  };
  insights: {
    mostCommonType: { type: string; mentions: number } | null;
    riskiestOm: { om: string; simPercent: number; total: number } | null;
    topMissionByMentions:
      | { om: string; mentions: number; sharePercent: number }
      | null;
    topProfileByMentions:
      | { posto: string; mentions: number; sharePercent: number }
      | null;
  };
  latestImport?: {
    id: string;
    importedAt: string;
    fileName: string;
  } | null;
};

type BiResponseRow = {
  id: string;
  submittedAt?: string | null;
  om?: string | null;
  posto?: string | null;
  postoGraduacao?: string | null;
  autodeclara?: string | null;
  sufferedViolenceRaw?: string | null;
  sufferedViolence?: boolean | null;
  violenceTypes?: string[];
};

type MissionQuestionAnswer = {
  label: string;
  count: number;
  percent: number;
};

type MissionQuestionItem = {
  id: string;
  label: string;
  answeredCount: number;
  emptyCount: number;
  answerRatePercent: number;
  topAnswers: MissionQuestionAnswer[];
};

type MissionQuestionsResponse = {
  mission: string | null;
  totalResponses: number;
  items: MissionQuestionItem[];
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type BiEditableCardId =
  | "context-mission"
  | "kpi-total-responses"
  | "kpi-violence-rate"
  | "kpi-violence-mentions"
  | "kpi-quick-insight"
  | "chart-mission-percent"
  | "chart-yes-no"
  | "chart-violence-type"
  | "chart-violence-by-mission"
  | "chart-mission-distribution"
  | "chart-profile-types"
  | "chart-monthly-trend";

type BiEditableCardTextStyle = {
  title: string;
  description: string;
  textColor: string;
};

const BI_CARD_TEXT_STYLES_STORAGE_KEY = "bi-survey-card-text-styles-v1";

function isBiEditableCardId(value: string): value is BiEditableCardId {
  return (
    value === "context-mission" ||
    value === "kpi-total-responses" ||
    value === "kpi-violence-rate" ||
    value === "kpi-violence-mentions" ||
    value === "kpi-quick-insight" ||
    value === "chart-mission-percent" ||
    value === "chart-yes-no" ||
    value === "chart-violence-type" ||
    value === "chart-violence-by-mission" ||
    value === "chart-mission-distribution" ||
    value === "chart-profile-types" ||
    value === "chart-monthly-trend"
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function getPercentLabel(value: number) {
  return `${value.toFixed(1)}%`;
}

function buildCsv(items: BiResponseRow[]) {
  const header = [
    "Data",
    "Missão",
    "Posto/Graduacao",
    "Posto",
    "Autodeclaracao",
    "Sofreu violência",
    "Tipos",
  ];
  const rows = items.map((item) => [
    formatDate(item.submittedAt),
    item.om ?? "",
    item.postoGraduacao ?? "",
    item.posto ?? "",
    item.autodeclara ?? "",
    item.sufferedViolenceRaw ?? "",
    (item.violenceTypes ?? []).join(" | "),
  ]);

  return [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

const BI_PALETTE = {
  primary: "#004AAD",
  primaryDark: "#1D4D9C",
  primaryMid: "#215BA6",
  primarySoft: "#8EB4E3",
  accent: "#F34747",
  accentSoft: "#EB6B6A",
  neutral: "#F2F2F2",
  text: "#1E2A44",
  muted: "#6B72AA",
  tableBorder: "#E2E8F5",
  success: "#70AD47",
  warning: "#FFC000",
  secondary: "#5B9BD5",
  violet: "#954F72",
  orange: "#ED7D31",
};

const PIE_COLORS = [
  BI_PALETTE.primary,
  BI_PALETTE.accent,
  BI_PALETTE.primarySoft,
  BI_PALETTE.success,
  BI_PALETTE.warning,
  BI_PALETTE.violet,
  BI_PALETTE.orange,
  BI_PALETTE.secondary,
];

const TYPE_COLOR_BY_LABEL: Record<string, string> = {
  "Violência Patrimonial": BI_PALETTE.warning,
  "Violência Física": BI_PALETTE.orange,
  "Violência Sexual": BI_PALETTE.violet,
  "Violência Moral": BI_PALETTE.accentSoft,
  "Violência Psicológica": BI_PALETTE.primary,
};

const DONUT_COLOR_BY_LABEL: Record<string, string> = {
  "Não": BI_PALETTE.primaryMid,
  Sim: BI_PALETTE.accent,
  "Não informado": "#A5A5A5",
};

const axisTickStyle = {
  fill: BI_PALETTE.muted,
  fontSize: 12,
};

const chartGridStroke = alpha(BI_PALETTE.primary, 0.14);
const chartAxisStroke = alpha(BI_PALETTE.primary, 0.24);
const tooltipContentStyle = {
  borderRadius: 10,
  border: `1px solid ${alpha(BI_PALETTE.primary, 0.18)}`,
  boxShadow: `0 10px 24px ${alpha(BI_PALETTE.primary, 0.15)}`,
  background: "#FFFFFF",
};
const tooltipLabelStyle = { color: BI_PALETTE.text, fontWeight: 700 };
const legendWrapperStyle = { color: BI_PALETTE.text };
const chartCaptionSx = { color: BI_PALETTE.muted };
const tableHeaderCellSx = {
  color: "#FFFFFF",
  fontWeight: 700,
  borderBottomColor: alpha("#FFFFFF", 0.2),
};

const cardSx = {
  borderRadius: 3,
  border: `1px solid ${alpha(BI_PALETTE.primary, 0.12)}`,
  boxShadow: `0 12px 30px ${alpha(BI_PALETTE.primary, 0.08)}`,
  background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(BI_PALETTE.primarySoft, 0.14)} 100%)`,
};

const KPI_CARD_CONTENT_SX = {
  py: 1.15,
  px: 1.4,
  "&:last-child": { pb: 1.15 },
};

const BAR_CHART_HEIGHT_LARGE = 240;
const BAR_CHART_HEIGHT_MEDIUM = 220;
const BAR_CHART_HEIGHT_SMALL = 205;
const BAR_SIZE_PRIMARY = 10;
const BAR_SIZE_STACKED = 8;

function buildBiCardTextDefaults(
  metricMode: MetricMode,
): Record<BiEditableCardId, BiEditableCardTextStyle> {
  const metricLabel = metricMode === "PERCENT" ? "%" : "Qtd";
  return {
    "context-mission": {
      title: "Contexto da Missão",
      description:
        "Esta visão consolida respostas por missão. Use este recorte antes dos gráficos para evitar comparação entre questionários de missões diferentes.",
      textColor: BI_PALETTE.text,
    },
    "kpi-total-responses": {
      title: "Respostas no recorte",
      description: "Total de respostas consideradas nos filtros atuais.",
      textColor: BI_PALETTE.text,
    },
    "kpi-violence-rate": {
      title: "Taxa de relatos",
      description:
        "Percentual de respostas que indicaram ocorrência de violência.",
      textColor: BI_PALETTE.text,
    },
    "kpi-violence-mentions": {
      title: "Ocorrências mapeadas",
      description:
        "Quantidade de menções de tipos de violência no recorte filtrado.",
      textColor: BI_PALETTE.text,
    },
    "kpi-quick-insight": {
      title: "Insight rápido",
      description:
        "Resumo executivo com os principais sinais detectados nesta seleção.",
      textColor: BI_PALETTE.text,
    },
    "chart-mission-percent": {
      title: `Missão Percentual (${metricLabel})`,
      description: "Clique em uma barra para filtrar a missão.",
      textColor: BI_PALETTE.text,
    },
    "chart-yes-no": {
      title: "Sofreu violência (geral)",
      description: "Clique em uma fatia para aplicar filtro de Sim/Não.",
      textColor: BI_PALETTE.text,
    },
    "chart-violence-type": {
      title: `Violência percentual por tipo (${metricLabel})`,
      description: "Clique em um tipo para filtrar o recorte.",
      textColor: BI_PALETTE.text,
    },
    "chart-violence-by-mission": {
      title: `Violências por missão (${metricLabel})`,
      description:
        "Equivalente ao cruzamento por missão/tipo do arquivo original.",
      textColor: BI_PALETTE.text,
    },
    "chart-mission-distribution": {
      title: `Distribuição por missão (${metricLabel})`,
      description: "",
      textColor: BI_PALETTE.text,
    },
    "chart-profile-types": {
      title: `Tipos por perfil funcional (${metricLabel})`,
      description:
        "Leitura de concentração por DISCENTE e GRADUADO E OFICIAL.",
      textColor: BI_PALETTE.text,
    },
    "chart-monthly-trend": {
      title: `Evolução mensal das respostas (${metricLabel})`,
      description: "",
      textColor: BI_PALETTE.text,
    },
  };
}

function loadBiCardTextStyles(): Partial<
  Record<BiEditableCardId, Partial<BiEditableCardTextStyle>>
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BI_CARD_TEXT_STYLES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<
      string,
      Partial<BiEditableCardTextStyle> | undefined
    >;
    if (!parsed || typeof parsed !== "object") return {};
    const normalized: Partial<
      Record<BiEditableCardId, Partial<BiEditableCardTextStyle>>
    > = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isBiEditableCardId(key) || !value) continue;
      normalized[key] = {
        title:
          typeof value.title === "string" && value.title.trim()
            ? value.title
            : undefined,
        description:
          typeof value.description === "string"
            ? value.description
            : undefined,
        textColor:
          typeof value.textColor === "string" && value.textColor.trim()
            ? value.textColor
            : undefined,
      };
    }
    return normalized;
  } catch {
    return {};
  }
}

export function BiSurveyDashboardPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const [metricMode, setMetricMode] = useState<MetricMode>("PERCENT");
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const [responsesExpanded, setResponsesExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] =
    useState<DeleteConfirmMode | null>(null);
  const [cardTextStyles, setCardTextStyles] = useState<
    Partial<Record<BiEditableCardId, Partial<BiEditableCardTextStyle>>>
  >(() => loadBiCardTextStyles());
  const [editingCardId, setEditingCardId] = useState<BiEditableCardId | null>(
    null,
  );
  const [editingCardDraft, setEditingCardDraft] =
    useState<BiEditableCardTextStyle>({
      title: "",
      description: "",
      textColor: BI_PALETTE.text,
    });
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    mission: "",
    posto: "",
    postoGraduacao: "",
    autodeclara: "",
    suffered: "",
    violenceType: "",
    combineMode: "AND" as CombineMode,
  });

  const cardTextDefaults = useMemo(
    () => buildBiCardTextDefaults(metricMode),
    [metricMode],
  );
  const getCardTextStyle = (cardId: BiEditableCardId): BiEditableCardTextStyle => {
    const defaults = cardTextDefaults[cardId];
    const custom = cardTextStyles[cardId];
    return {
      title:
        typeof custom?.title === "string" && custom.title.trim()
          ? custom.title
          : defaults.title,
      description:
        typeof custom?.description === "string"
          ? custom.description
          : defaults.description,
      textColor:
        typeof custom?.textColor === "string" && custom.textColor.trim()
          ? custom.textColor
          : defaults.textColor,
    };
  };
  const openTextEditor = (cardId: BiEditableCardId) => {
    setEditingCardId(cardId);
    setEditingCardDraft({ ...getCardTextStyle(cardId) });
  };
  const saveTextEditor = () => {
    if (!editingCardId) return;
    const defaults = cardTextDefaults[editingCardId];
    const normalized: BiEditableCardTextStyle = {
      title: editingCardDraft.title.trim() || defaults.title,
      description: editingCardDraft.description.trim(),
      textColor: editingCardDraft.textColor.trim() || defaults.textColor,
    };
    const next = {
      ...cardTextStyles,
      [editingCardId]: normalized,
    };
    setCardTextStyles(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        BI_CARD_TEXT_STYLES_STORAGE_KEY,
        JSON.stringify(next),
      );
    }
    setEditingCardId(null);
  };

  const dashboardFilters = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
      mission: filters.mission || undefined,
      posto: filters.posto || undefined,
      postoGraduacao: filters.postoGraduacao || undefined,
      autodeclara: filters.autodeclara || undefined,
      suffered: filters.suffered || undefined,
      violenceType: filters.violenceType || undefined,
      combineMode: filters.combineMode || undefined,
    }),
    [filters],
  );

  const dashboardQuery = useBiSurveyDashboard(dashboardFilters);
  const responsesQuery = useBiSurveyResponses({
    ...dashboardFilters,
    page,
    pageSize: 25,
  });
  const missionQuestionsQuery = useBiSurveyQuestions(
    dashboardFilters,
    Boolean(filters.mission),
  );
  const importsQuery = useBiSurveyImports({ page: 1, pageSize: 6 });
  const importMutation = useImportBiSurvey();
  const deleteResponsesMutation = useDeleteBiSurveyResponses();

  const dashboard = dashboardQuery.data as BiDashboardResponse | undefined;
  const responses = responsesQuery.data as
    | PagedResponse<BiResponseRow>
    | undefined;
  const missionQuestions = missionQuestionsQuery.data as
    | MissionQuestionsResponse
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

  const typeByOm = dashboard?.charts.violenceTypeByOmPercent;
  const typeKeys = typeByOm?.types ?? [];
  const typeByPosto = dashboard?.charts.violenceTypeByPostoPercent;
  const typeByPostoKeys = typeByPosto?.types ?? [];

  const totalPages = responses
    ? Math.max(1, Math.ceil(responses.total / responses.pageSize))
    : 1;
  const hasAutodeclara =
    (dashboard?.filters?.autodeclara?.length ?? 0) > 0;

  const handleImport = async () => {
    if (!file) {
      toast.push({
        message: "Selecione um arquivo CSV ou XLSX.",
        severity: "warning",
      });
      return;
    }

    try {
      const result = await importMutation.mutateAsync({ file, replace: true });
      setFile(null);
      const mentions = Number(result?.correlatedViolence?.mentionRows ?? 0);
      toast.push({
        message: `Base substituída com sucesso. Inseridos: ${result?.batch?.insertedRows ?? 0}. Menções de violência: ${mentions}.`,
        severity: "success",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao importar arquivo.",
        severity: "error",
      });
    }
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({
      from: "",
      to: "",
      mission: "",
      posto: "",
      postoGraduacao: "",
      autodeclara: "",
      suffered: "",
      violenceType: "",
      combineMode: "AND",
    });
    setSelectedIds([]);
  };

  const updateFilter = <K extends keyof typeof filters>(
    key: K,
    value: (typeof filters)[K],
  ) => {
    setPage(1);
    setSelectedIds([]);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const currentPageIds = useMemo(
    () => (responses?.items ?? []).map((item) => item.id),
    [responses?.items],
  );

  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.includes(id));

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

  const handleConfirmDelete = async () => {
    if (!deleteConfirmMode) return;
    try {
      if (deleteConfirmMode === "SELECTED") {
        const result = await deleteResponsesMutation.mutateAsync({
          ids: selectedIds,
        });
        toast.push({
          message: `${result?.deletedCount ?? 0} registro(s) excluido(s).`,
          severity: "success",
        });
      } else {
        const result = await deleteResponsesMutation.mutateAsync({
          ...dashboardFilters,
          allFiltered: true,
        });
        toast.push({
          message: `${result?.deletedCount ?? 0} registro(s) excluido(s) pelo filtro atual.`,
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
    a.download = "bi-pesquisa-recorte.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError)
    return (
      <ErrorState
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  if (!dashboard)
    return (
      <EmptyState
        title="Sem dados"
        description="Importe uma base para iniciar o BI."
      />
    );

  const contextMissionText = getCardTextStyle("context-mission");
  const kpiTotalResponsesText = getCardTextStyle("kpi-total-responses");
  const kpiViolenceRateText = getCardTextStyle("kpi-violence-rate");
  const kpiViolenceMentionsText = getCardTextStyle("kpi-violence-mentions");
  const kpiQuickInsightText = getCardTextStyle("kpi-quick-insight");
  const missionPercentText = getCardTextStyle("chart-mission-percent");
  const yesNoText = getCardTextStyle("chart-yes-no");
  const violenceTypeText = getCardTextStyle("chart-violence-type");
  const violenceByMissionText = getCardTextStyle("chart-violence-by-mission");
  const missionDistributionText = getCardTextStyle(
    "chart-mission-distribution",
  );
  const profileTypesText = getCardTextStyle("chart-profile-types");
  const monthlyTrendText = getCardTextStyle("chart-monthly-trend");

  return (
    <Box
      sx={{
        color: BI_PALETTE.text,
        background: `radial-gradient(1200px 420px at -8% -18%, ${alpha(BI_PALETTE.primarySoft, 0.35)} 0%, transparent 62%), radial-gradient(900px 320px at 108% -10%, ${alpha(BI_PALETTE.accentSoft, 0.22)} 0%, transparent 60%)`,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "center" }}
        gap={1.5}
        mb={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Escolas
          </Typography>
          <Typography variant="body2" sx={{ color: BI_PALETTE.muted }}>
            Painel analítico consolidado para leitura executiva e tomada de decisão sobre os dados de pesquisa.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            component="a"
            href="/templates/bi-survey-template.csv"
            download
            sx={{
              height: 36,
              px: 1.4,
              fontSize: 13,
              whiteSpace: "nowrap",
              borderColor: alpha(BI_PALETTE.primary, 0.5),
              color: BI_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: BI_PALETTE.primary,
                bgcolor: alpha(BI_PALETTE.primary, 0.06),
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
              height: 36,
              px: 1.4,
              fontSize: 13,
              whiteSpace: "nowrap",
              borderColor: alpha(BI_PALETTE.primary, 0.5),
              color: BI_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: BI_PALETTE.primary,
                bgcolor: alpha(BI_PALETTE.primary, 0.06),
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
              height: 36,
              px: 1.4,
              fontSize: 13,
              whiteSpace: "nowrap",
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              bgcolor: BI_PALETTE.primary,
              "&:hover": { bgcolor: BI_PALETTE.primaryDark },
            }}
          >
            Limpar filtros
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2, ...cardSx }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ color: contextMissionText.textColor }}
            >
              {contextMissionText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar card">
                <IconButton
                  size="small"
                  onClick={() => openTextEditor("context-mission")}
                  sx={{ color: contextMissionText.textColor, opacity: 0.72 }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: contextMissionText.textColor, mt: 0.6 }}
          >
            {contextMissionText.description}
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1.2 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Missão atual: ${filters.mission || "Todas"}`}
              sx={{ borderColor: alpha(BI_PALETTE.primary, 0.4), color: BI_PALETTE.primaryDark }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Respostas no recorte: ${dashboard.kpis.totalResponses}`}
              sx={{ borderColor: alpha(BI_PALETTE.accent, 0.45), color: BI_PALETTE.accent }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Base total: ${dashboard.kpis.totalRowsInDb}`}
              sx={{ borderColor: alpha(BI_PALETTE.primaryMid, 0.4), color: BI_PALETTE.primaryMid }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: BI_PALETTE.muted, display: "block", mt: 1 }}>
            Fonte consolidada: abas BANCO_DADOS e BANCO_DADOS_VIOLENCIA.
          </Typography>
        </CardContent>
      </Card>

      <Card
        sx={{
          mb: 2,
          ...cardSx,
          borderColor: alpha(BI_PALETTE.primaryDark, 0.28),
          background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(BI_PALETTE.primarySoft, 0.08)} 100%)`,
        }}
      >
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
            gap={1}
            mb={1}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Perguntas da missão selecionada
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={
                filters.mission
                  ? `Missão: ${filters.mission}`
                  : "Selecione uma missão no filtro"
              }
              sx={{
                borderColor: alpha(BI_PALETTE.primary, 0.4),
                color: BI_PALETTE.primaryDark,
              }}
            />
          </Stack>

          {!filters.mission ? (
            <Alert severity="info" sx={{ mt: 0.8 }}>
              Selecione uma missão para visualizar as perguntas e o nível de preenchimento desta base.
            </Alert>
          ) : missionQuestionsQuery.isLoading ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ color: BI_PALETTE.muted, mb: 0.8 }}>
                Carregando perguntas da missão...
              </Typography>
              <LinearProgress />
            </Box>
          ) : missionQuestionsQuery.isError ? (
            <Alert severity="error" sx={{ mt: 0.8 }}>
              Não foi possível carregar as perguntas desta missão.
            </Alert>
          ) : (missionQuestions?.items.length ?? 0) === 0 ? (
            <Alert severity="warning" sx={{ mt: 0.8 }}>
              Sem perguntas encontradas para os filtros atuais.
            </Alert>
          ) : (
            <Box
              display="grid"
              gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
              gap={1}
              sx={{ mt: 1 }}
            >
              {(missionQuestions?.items ?? []).map((question) => (
                <Box
                  key={question.id}
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    border: `1px solid ${alpha(BI_PALETTE.primary, 0.18)}`,
                    bgcolor: "#FFFFFF",
                  }}
                >
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.8 }}>
                    {question.label}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={question.answerRatePercent}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: alpha(BI_PALETTE.primarySoft, 0.3),
                      "& .MuiLinearProgress-bar": { bgcolor: BI_PALETTE.primaryMid },
                    }}
                  />
                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.8, mb: 0.6 }} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={`Respondidas: ${question.answeredCount}`}
                      sx={{ bgcolor: alpha(BI_PALETTE.success, 0.15), color: BI_PALETTE.success }}
                    />
                    <Chip
                      size="small"
                      label={`Em branco: ${question.emptyCount}`}
                      sx={{ bgcolor: alpha(BI_PALETTE.warning, 0.2), color: "#8E6200" }}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${question.answerRatePercent.toFixed(1)}% preenchimento`}
                      sx={{
                        borderColor: alpha(BI_PALETTE.primary, 0.28),
                        color: BI_PALETTE.primaryDark,
                      }}
                    />
                  </Stack>
                  {question.topAnswers.length > 0 ? (
                    <Stack direction="row" spacing={0.8} flexWrap="wrap">
                      {question.topAnswers.slice(0, 3).map((answer) => (
                        <Chip
                          key={`${question.id}-${answer.label}`}
                          size="small"
                          variant="outlined"
                          label={`${answer.label} (${answer.count})`}
                          sx={{
                            borderColor: alpha(BI_PALETTE.primaryMid, 0.36),
                            color: BI_PALETTE.primaryMid,
                          }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
                      Sem respostas registradas nesta pergunta para o recorte atual.
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, ...cardSx }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.2}
            alignItems={{ lg: "center" }}
            sx={{ flexWrap: { lg: "wrap" }, rowGap: { lg: 1.2 } }}
          >
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileRoundedIcon />}
              sx={{
                minWidth: 260,
                height: 40,
                whiteSpace: "nowrap",
                flexShrink: 0,
                borderColor: alpha(BI_PALETTE.primary, 0.5),
                color: BI_PALETTE.primary,
                "&:hover": {
                  borderColor: BI_PALETTE.primary,
                  bgcolor: alpha(BI_PALETTE.primary, 0.06),
                },
              }}
            >
              {file ? file.name : "Selecionar arquivo de pesquisa"}
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
              variant="contained"
              size="small"
              onClick={handleImport}
              disabled={importMutation.isPending}
              sx={{
                height: 40,
                px: 2,
                whiteSpace: "nowrap",
                flexShrink: 0,
                bgcolor: BI_PALETTE.primary,
                "&:hover": { bgcolor: BI_PALETTE.primaryDark },
              }}
            >
              {importMutation.isPending
                ? "Importando..."
                : "Substituir base no banco"}
            </Button>
            <Box sx={{ ml: { lg: "auto" } }}>
              <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
                Ultima importacao
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {dashboard.latestImport?.fileName ?? "Nenhuma"}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, ...cardSx }}>
        <CardContent>
          <Box
            display="grid"
            gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }}
            gap={1.2}
          >
            <TextField
              select
              size="small"
              label="Visualizacao dos graficos"
              value={metricMode}
              onChange={(event) =>
                setMetricMode(event.target.value as MetricMode)
              }
            >
              <MenuItem value="PERCENT">Percentual (%)</MenuItem>
              <MenuItem value="COUNT">Quantidade (Qtd)</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Combinacao dos filtros"
              value={filters.combineMode}
              onChange={(event) =>
                updateFilter("combineMode", event.target.value as CombineMode)
              }
            >
              <MenuItem value="AND">Todos os filtros (AND)</MenuItem>
              <MenuItem value="OR">Qualquer filtro (OR)</MenuItem>
            </TextField>
            <TextField
              size="small"
              label="De"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
            <TextField
              size="small"
              label="Ate"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
            <TextField
              select
              size="small"
              label="Missão"
              value={filters.mission}
              onChange={(event) => updateFilter("mission", event.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {(dashboard.filters.mission ?? dashboard.filters.om ?? []).map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Posto/Graduacao"
              value={filters.postoGraduacao}
              onChange={(event) =>
                updateFilter("postoGraduacao", event.target.value)
              }
            >
              <MenuItem value="">Todos</MenuItem>
              {(dashboard.filters.postoGraduacao ?? []).map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Posto"
              value={filters.posto}
              onChange={(event) => updateFilter("posto", event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {(dashboard.filters.posto ?? []).map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            {hasAutodeclara && (
              <TextField
                select
                size="small"
                label="Autodeclaração"
                value={filters.autodeclara}
                onChange={(event) =>
                  updateFilter("autodeclara", event.target.value)
                }
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.autodeclara ?? []).map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              size="small"
              label="Sofreu violência"
              value={filters.suffered}
              onChange={(event) => updateFilter("suffered", event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {(dashboard.filters.suffered ?? []).map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Tipo de violência"
              value={filters.violenceType}
              onChange={(event) =>
                updateFilter("violenceType", event.target.value)
              }
            >
              <MenuItem value="">Todos</MenuItem>
              {(dashboard.filters.violenceTypes ?? []).map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </CardContent>
      </Card>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }}
        gap={1.2}
        mb={2}
      >
        <Card
          sx={{
            ...cardSx,
            borderColor: alpha(BI_PALETTE.primary, 0.2),
          }}
        >
          <CardContent sx={KPI_CARD_CONTENT_SX}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.2 }}
            >
              <Typography
                variant="overline"
                sx={{ color: kpiTotalResponsesText.textColor }}
              >
                {kpiTotalResponsesText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar KPI">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("kpi-total-responses")}
                    sx={{ color: kpiTotalResponsesText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            {kpiTotalResponsesText.description.trim() ? (
              <Typography
                variant="caption"
                sx={{
                  color: kpiTotalResponsesText.textColor,
                  display: "block",
                  mb: 0.45,
                }}
              >
                {kpiTotalResponsesText.description}
              </Typography>
            ) : null}
            <Typography
              variant="h5"
              lineHeight={1.1}
              sx={{ color: kpiTotalResponsesText.textColor }}
            >
              {dashboard.kpis.totalResponses}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: alpha(kpiTotalResponsesText.textColor, 0.78) }}
            >
              Base total: {dashboard.kpis.totalRowsInDb}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            ...cardSx,
            borderColor: alpha(BI_PALETTE.accent, 0.25),
            background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(BI_PALETTE.accentSoft, 0.16)} 100%)`,
          }}
        >
          <CardContent sx={KPI_CARD_CONTENT_SX}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.2 }}
            >
              <Typography
                variant="overline"
                sx={{ color: kpiViolenceRateText.textColor }}
              >
                {kpiViolenceRateText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar KPI">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("kpi-violence-rate")}
                    sx={{ color: kpiViolenceRateText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            {kpiViolenceRateText.description.trim() ? (
              <Typography
                variant="caption"
                sx={{
                  color: kpiViolenceRateText.textColor,
                  display: "block",
                  mb: 0.45,
                }}
              >
                {kpiViolenceRateText.description}
              </Typography>
            ) : null}
            <Typography
              variant="h5"
              lineHeight={1.1}
              sx={{ color: kpiViolenceRateText.textColor }}
            >
              {dashboard.kpis.violenceRatePercent.toFixed(1)}%
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: alpha(kpiViolenceRateText.textColor, 0.78) }}
            >
              Sim: {dashboard.kpis.yesCount} | Não: {dashboard.kpis.noCount}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            ...cardSx,
            borderColor: alpha(BI_PALETTE.primaryMid, 0.2),
          }}
        >
          <CardContent sx={KPI_CARD_CONTENT_SX}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.2 }}
            >
              <Typography
                variant="overline"
                sx={{ color: kpiViolenceMentionsText.textColor }}
              >
                {kpiViolenceMentionsText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar KPI">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("kpi-violence-mentions")}
                    sx={{
                      color: kpiViolenceMentionsText.textColor,
                      opacity: 0.72,
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            {kpiViolenceMentionsText.description.trim() ? (
              <Typography
                variant="caption"
                sx={{
                  color: kpiViolenceMentionsText.textColor,
                  display: "block",
                  mb: 0.45,
                }}
              >
                {kpiViolenceMentionsText.description}
              </Typography>
            ) : null}
            <Typography
              variant="h5"
              lineHeight={1.1}
              sx={{ color: kpiViolenceMentionsText.textColor }}
            >
              {dashboard.kpis.totalViolenceMentions}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: alpha(kpiViolenceMentionsText.textColor, 0.78) }}
            >
              Media por vitima: {dashboard.kpis.averageTypesPerVictim}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            ...cardSx,
            borderColor: alpha(BI_PALETTE.violet, 0.25),
          }}
        >
          <CardContent sx={KPI_CARD_CONTENT_SX}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.2 }}
            >
              <Typography
                variant="overline"
                sx={{ color: kpiQuickInsightText.textColor }}
              >
                {kpiQuickInsightText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar KPI">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("kpi-quick-insight")}
                    sx={{ color: kpiQuickInsightText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            {kpiQuickInsightText.description.trim() ? (
              <Typography
                variant="caption"
                sx={{
                  color: kpiQuickInsightText.textColor,
                  display: "block",
                  mb: 0.45,
                }}
              >
                {kpiQuickInsightText.description}
              </Typography>
            ) : null}
            <Typography variant="body2" sx={{ mt: 0.6, color: kpiQuickInsightText.textColor }}>
              Tipo mais frequente:{" "}
              <strong>{dashboard.insights.mostCommonType?.type ?? "-"}</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: kpiQuickInsightText.textColor }}>
              Missão com maior taxa:{" "}
              <strong>{dashboard.insights.riskiestOm?.om ?? "-"}</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: kpiQuickInsightText.textColor }}>
              Perfil com mais relatos:{" "}
              <strong>{dashboard.insights.topProfileByMentions?.posto ?? "-"}</strong>
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", lg: "repeat(2, 1fr)" }}
        gap={1.2}
        mb={2}
      >
        <Card sx={cardSx}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.35 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color: missionPercentText.textColor }}
              >
                {missionPercentText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar card">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("chart-mission-percent")}
                    sx={{ color: missionPercentText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            <Typography
              variant="caption"
              sx={{ ...chartCaptionSx, color: missionPercentText.textColor }}
            >
              {missionPercentText.description}
            </Typography>
            <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_LARGE}>
              <BarChart
                data={dashboard.charts.omViolencePercent}
                barCategoryGap="32%"
                onClick={(state: {
                  activePayload?: Array<{ payload?: OmViolenceDatum }>;
                }) => {
                  const payload = state.activePayload?.[0]?.payload;
                  if (payload?.om) {
                    updateFilter("mission", payload.om);
                  }
                }}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="om"
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metricMode === "PERCENT" ? `${value}%` : String(value)
                  }
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === "PERCENT" ? getPercentLabel(value) : value
                  }
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={legendWrapperStyle} />
                <Bar
                  dataKey={metricMode === "PERCENT" ? "naoPercent" : "naoCount"}
                  stackId="a"
                  name="Não"
                  fill={BI_PALETTE.primarySoft}
                  barSize={BAR_SIZE_STACKED}
                />
                <Bar
                  dataKey={metricMode === "PERCENT" ? "simPercent" : "simCount"}
                  stackId="a"
                  name="Sim"
                  fill={BI_PALETTE.accent}
                  barSize={BAR_SIZE_STACKED}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.35 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color: yesNoText.textColor }}
              >
                {yesNoText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar card">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("chart-yes-no")}
                    sx={{ color: yesNoText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            <Typography
              variant="caption"
              sx={{ ...chartCaptionSx, color: yesNoText.textColor }}
            >
              {yesNoText.description}
            </Typography>
            <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_LARGE}>
              <PieChart>
                <Pie
                  data={dashboard.charts.yesNoDonut}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  label
                >
                  {dashboard.charts.yesNoDonut.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={
                        DONUT_COLOR_BY_LABEL[entry.label] ?? BI_PALETTE.primary
                      }
                      onClick={() => {
                        if (entry.label === "Sim") {
                          updateFilter("suffered", "SIM");
                        } else if (entry.label === "Não") {
                          updateFilter("suffered", "NAO");
                        }
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => value}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={legendWrapperStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", lg: "repeat(2, 1fr)" }}
        gap={1.2}
        mb={2}
      >
        <Card sx={cardSx}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.35 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color: violenceTypeText.textColor }}
              >
                {violenceTypeText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar card">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("chart-violence-type")}
                    sx={{ color: violenceTypeText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            <Typography
              variant="caption"
              sx={{ ...chartCaptionSx, color: violenceTypeText.textColor }}
            >
              {violenceTypeText.description}
            </Typography>
            <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_LARGE}>
              <BarChart
                data={dashboard.charts.violenceTypePercent}
                barCategoryGap="32%"
                onClick={(state: {
                  activePayload?: Array<{ payload?: ViolenceTypeDatum }>;
                }) => {
                  const payload = state.activePayload?.[0]?.payload;
                  if (payload?.type) {
                    updateFilter("violenceType", payload.type);
                  }
                }}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="type"
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={70}
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metricMode === "PERCENT" ? `${value}%` : String(value)
                  }
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === "PERCENT" ? getPercentLabel(value) : value
                  }
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar
                  dataKey={metricMode === "PERCENT" ? "percent" : "count"}
                  barSize={BAR_SIZE_PRIMARY}
                >
                  {dashboard.charts.violenceTypePercent.map((entry) => (
                    <Cell
                      key={entry.type}
                      fill={
                        TYPE_COLOR_BY_LABEL[entry.type] ?? BI_PALETTE.primaryMid
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.35 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color: violenceByMissionText.textColor }}
              >
                {violenceByMissionText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar card">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("chart-violence-by-mission")}
                    sx={{
                      color: violenceByMissionText.textColor,
                      opacity: 0.72,
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            <Typography
              variant="caption"
              sx={{ ...chartCaptionSx, color: violenceByMissionText.textColor }}
            >
              {violenceByMissionText.description}
            </Typography>
            <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_LARGE}>
              <BarChart
                data={typeByOm?.items ?? []}
                barCategoryGap="32%"
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                onClick={(state: {
                  activePayload?: Array<{ payload?: ViolenceTypeByOmDatum }>;
                }) => {
                  const payload = state.activePayload?.[0]?.payload;
                  const om = payload?.om;
                  if (typeof om === "string" && om.trim()) {
                    updateFilter("mission", om);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="om"
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metricMode === "PERCENT" ? `${value}%` : String(value)
                  }
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === "PERCENT" ? getPercentLabel(value) : value
                  }
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={legendWrapperStyle} />
                {typeKeys.map((type, index) => (
                  <Bar
                    key={type}
                    dataKey={
                      metricMode === "PERCENT"
                        ? `${type}__percent`
                        : `${type}__count`
                    }
                    stackId="a"
                    name={type}
                    barSize={BAR_SIZE_STACKED}
                    fill={
                      TYPE_COLOR_BY_LABEL[type] ??
                      PIE_COLORS[index % PIE_COLORS.length]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", lg: "repeat(2, 1fr)" }}
        gap={1.2}
        mb={2}
      >
        <Card sx={cardSx}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.35 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color: missionDistributionText.textColor }}
              >
                {missionDistributionText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar card">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("chart-mission-distribution")}
                    sx={{
                      color: missionDistributionText.textColor,
                      opacity: 0.72,
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            {missionDistributionText.description.trim() ? (
              <Typography
                variant="caption"
                sx={{
                  ...chartCaptionSx,
                  color: missionDistributionText.textColor,
                  display: "block",
                }}
              >
                {missionDistributionText.description}
              </Typography>
            ) : null}
            <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_SMALL}>
              <BarChart data={dashboard.charts.omDistribution} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="label"
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metricMode === "PERCENT" ? `${value}%` : String(value)
                  }
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === "PERCENT" ? getPercentLabel(value) : value
                  }
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar
                  dataKey={metricMode === "PERCENT" ? "percent" : "count"}
                  fill={BI_PALETTE.primaryMid}
                  barSize={BAR_SIZE_PRIMARY}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{ mb: 0.35 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color: profileTypesText.textColor }}
              >
                {profileTypesText.title}
              </Typography>
              {isTiProfile ? (
                <MuiTooltip title="Editar card">
                  <IconButton
                    size="small"
                    onClick={() => openTextEditor("chart-profile-types")}
                    sx={{ color: profileTypesText.textColor, opacity: 0.72 }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              ) : null}
            </Stack>
            <Typography
              variant="caption"
              sx={{ ...chartCaptionSx, color: profileTypesText.textColor }}
            >
              {profileTypesText.description}
            </Typography>
            <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_MEDIUM}>
              <BarChart data={typeByPosto?.items ?? []} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="posto"
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metricMode === "PERCENT" ? `${value}%` : String(value)
                  }
                  tick={axisTickStyle}
                  axisLine={{ stroke: chartAxisStroke }}
                  tickLine={{ stroke: chartAxisStroke }}
                />
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === "PERCENT" ? getPercentLabel(value) : value
                  }
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={legendWrapperStyle} />
                {typeByPostoKeys.map((type, index) => (
                  <Bar
                    key={type}
                    dataKey={
                      metricMode === "PERCENT"
                        ? `${type}__percent`
                        : `${type}__count`
                    }
                    stackId="a"
                    name={type}
                    barSize={BAR_SIZE_STACKED}
                    fill={
                      TYPE_COLOR_BY_LABEL[type] ??
                      PIE_COLORS[index % PIE_COLORS.length]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mb: 2, ...cardSx }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
            sx={{ mb: 0.35 }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ color: monthlyTrendText.textColor }}
            >
              {monthlyTrendText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar card">
                <IconButton
                  size="small"
                  onClick={() => openTextEditor("chart-monthly-trend")}
                  sx={{ color: monthlyTrendText.textColor, opacity: 0.72 }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          {monthlyTrendText.description.trim() ? (
            <Typography
              variant="caption"
              sx={{
                ...chartCaptionSx,
                color: monthlyTrendText.textColor,
                display: "block",
              }}
            >
              {monthlyTrendText.description}
            </Typography>
          ) : null}
          <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT_MEDIUM}>
            <BarChart data={dashboard.charts.monthlyTrend ?? []} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis
                dataKey="month"
                tick={axisTickStyle}
                axisLine={{ stroke: chartAxisStroke }}
                tickLine={{ stroke: chartAxisStroke }}
              />
              <YAxis
                tickFormatter={(value) =>
                  metricMode === "PERCENT" ? `${value}%` : String(value)
                }
                tick={axisTickStyle}
                axisLine={{ stroke: chartAxisStroke }}
                tickLine={{ stroke: chartAxisStroke }}
              />
              <Tooltip
                formatter={(value: number) =>
                  metricMode === "PERCENT" ? getPercentLabel(value) : value
                }
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Bar
                dataKey={metricMode === "PERCENT" ? "yesRatePercent" : "total"}
                name={metricMode === "PERCENT" ? "Taxa de relatos" : "Total de respostas"}
                fill={metricMode === "PERCENT" ? BI_PALETTE.accent : BI_PALETTE.primaryMid}
                barSize={BAR_SIZE_PRIMARY}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {dashboard.kpis.totalResponses === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Nenhum registro encontrado para os filtros atuais.
        </Alert>
      )}

      <Card sx={{ mb: 2, ...cardSx }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
            mb={responsesExpanded ? 1.2 : 0}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Respostas detalhadas
              </Typography>
              {!responsesExpanded && (
                <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
                  Card comprimido. Clique na seta para expandir.
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Chip
                size="small"
                label={`Total no recorte: ${responses?.total ?? 0}`}
                sx={{
                  bgcolor: alpha(BI_PALETTE.primarySoft, 0.3),
                  color: BI_PALETTE.primaryDark,
                }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Selecionados: ${selectedIds.length}`}
                sx={{
                  borderColor: alpha(BI_PALETTE.primary, 0.4),
                  color: BI_PALETTE.primaryDark,
                }}
              />
              <IconButton
                size="small"
                onClick={() => setResponsesExpanded((prev) => !prev)}
                aria-label={
                  responsesExpanded
                    ? "Recolher respostas detalhadas"
                    : "Expandir respostas detalhadas"
                }
              >
                {responsesExpanded ? (
                  <KeyboardArrowUpRoundedIcon fontSize="small" />
                ) : (
                  <KeyboardArrowDownRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Stack>
          </Stack>

          <Collapse in={responsesExpanded} timeout="auto" unmountOnExit>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={0.8}
              alignItems={{ lg: "center" }}
              sx={{ mb: 1.2 }}
            >
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setSelectedIds([]);
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                disabled={page <= 1}
                sx={{
                  borderColor: alpha(BI_PALETTE.primary, 0.5),
                  color: BI_PALETTE.primary,
                  "&:hover": {
                    borderColor: BI_PALETTE.primary,
                    bgcolor: alpha(BI_PALETTE.primary, 0.06),
                  },
                }}
              >
                Anterior
              </Button>
              <Chip
                size="small"
                label={`Pagina ${page} de ${totalPages}`}
                sx={{
                  bgcolor: alpha(BI_PALETTE.primarySoft, 0.3),
                  color: BI_PALETTE.primaryDark,
                }}
              />
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={
                  selectedIds.length === 0 || deleteResponsesMutation.isPending
                }
                onClick={() => setDeleteConfirmMode("SELECTED")}
                sx={{
                  borderColor: alpha(BI_PALETTE.accent, 0.6),
                  color: BI_PALETTE.accent,
                  "&:hover": {
                    borderColor: BI_PALETTE.accent,
                    bgcolor: alpha(BI_PALETTE.accent, 0.08),
                  },
                }}
              >
                Excluir selecionados
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={
                  (responses?.total ?? 0) === 0 ||
                  deleteResponsesMutation.isPending
                }
                onClick={() => setDeleteConfirmMode("FILTERED")}
                sx={{
                  borderColor: alpha(BI_PALETTE.accent, 0.6),
                  color: BI_PALETTE.accent,
                  "&:hover": {
                    borderColor: BI_PALETTE.accent,
                    bgcolor: alpha(BI_PALETTE.accent, 0.08),
                  },
                }}
              >
                Excluir todos filtrados
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setSelectedIds([]);
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
                disabled={page >= totalPages}
                sx={{
                  borderColor: alpha(BI_PALETTE.primary, 0.5),
                  color: BI_PALETTE.primary,
                  "&:hover": {
                    borderColor: BI_PALETTE.primary,
                    bgcolor: alpha(BI_PALETTE.primary, 0.06),
                  },
                }}
              >
                Proxima
              </Button>
            </Stack>

            {responsesQuery.isLoading ? (
              <SkeletonState />
            ) : responsesQuery.isError ? (
              <ErrorState
                error={responsesQuery.error}
                onRetry={() => responsesQuery.refetch()}
              />
            ) : (responses?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="Sem respostas"
                description="Ajuste os filtros para visualizar registros."
              />
            ) : (
              <Table
                size="small"
                sx={{
                  "& .MuiTableCell-root": {
                    borderBottomColor: BI_PALETTE.tableBorder,
                  },
                }}
              >
                <TableHead>
                  <TableRow sx={{ bgcolor: BI_PALETTE.primaryDark }}>
                    <TableCell padding="checkbox" sx={tableHeaderCellSx}>
                      <Checkbox
                        checked={allCurrentPageSelected}
                        indeterminate={
                          !allCurrentPageSelected &&
                          selectedIds.some((id) => currentPageIds.includes(id))
                        }
                        onChange={toggleSelectAllCurrentPage}
                        sx={{
                          color: "white",
                          "&.Mui-checked": { color: "white" },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Data
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Missão
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Posto/Graduação
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Posto
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Autodeclaracao
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Sofreu violência?
                    </TableCell>
                    <TableCell sx={tableHeaderCellSx}>
                      Tipos
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {responses?.items.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        "&:hover": {
                          bgcolor: alpha(BI_PALETTE.primarySoft, 0.18),
                        },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleSelectRow(row.id)}
                        />
                      </TableCell>
                      <TableCell>{formatDate(row.submittedAt)}</TableCell>
                      <TableCell>{row.om ?? "-"}</TableCell>
                      <TableCell>{row.postoGraduacao ?? "-"}</TableCell>
                      <TableCell>{row.posto ?? "-"}</TableCell>
                      <TableCell>{row.autodeclara ?? "-"}</TableCell>
                      <TableCell>{row.sufferedViolenceRaw ?? "-"}</TableCell>
                      <TableCell>
                        {(row.violenceTypes ?? []).join(", ") || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Collapse>
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Historico de importacoes
          </Typography>
          {(imports?.items.length ?? 0) === 0 ? (
            <Alert severity="info">Nenhuma importacao registrada ainda.</Alert>
          ) : (
            <Stack spacing={0.8}>
              {imports?.items.map((item) => (
                <Stack
                  key={item.id}
                  direction={{ xs: "column", md: "row" }}
                  alignItems={{ md: "center" }}
                  justifyContent="space-between"
                  sx={{
                    border: `1px solid ${BI_PALETTE.tableBorder}`,
                    borderRadius: 1.5,
                    px: 1.2,
                    py: 1,
                    bgcolor: alpha(BI_PALETTE.primarySoft, 0.14),
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {item.fileName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
                      {formatDate(item.importedAt)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.8}>
                    <Chip
                      size="small"
                      label={`Inseridos: ${item.insertedRows}`}
                      variant="outlined"
                      sx={{
                        borderColor: alpha(BI_PALETTE.success, 0.65),
                        color: BI_PALETTE.success,
                      }}
                    />
                    <Chip
                      size="small"
                      label={`Duplicados: ${item.duplicateRows}`}
                      variant="outlined"
                      sx={{
                        borderColor: alpha(BI_PALETTE.warning, 0.7),
                        color: "#9B6A00",
                      }}
                    />
                    <Chip
                      size="small"
                      label={`Invalidos: ${item.invalidRows}`}
                      variant="outlined"
                      sx={{
                        borderColor: alpha(BI_PALETTE.primaryMid, 0.5),
                        color: BI_PALETTE.primaryMid,
                      }}
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingCardId)}
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
            <TextField
              label="Cor da fonte"
              type="color"
              value={editingCardDraft.textColor}
              onChange={(event) =>
                setEditingCardDraft((prev) => ({
                  ...prev,
                  textColor: event.target.value,
                }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCardId(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveTextEditor}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteConfirmMode)}
        title={
          deleteConfirmMode === "FILTERED"
            ? "Excluir todos os registros filtrados?"
            : "Excluir registros selecionados?"
        }
        message={
          deleteConfirmMode === "FILTERED"
            ? `Esta acao excluirá ${responses?.total ?? 0} registro(s) com os filtros atuais (${filters.combineMode}). Deseja continuar?`
            : `Esta acao excluirá ${selectedIds.length} registro(s) selecionado(s). Deseja continuar?`
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        severity="error"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteConfirmMode(null)}
      />
    </Box>
  );
}
