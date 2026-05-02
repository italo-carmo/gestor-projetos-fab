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
  FormControlLabel,
  Grid,
  IconButton,
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
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useBiGsdEvaluationCardSettings,
  useBiGsdEvaluationDashboard,
  useBiGsdEvaluationImports,
  useBiGsdEvaluationResponses,
  useDeleteBiGsdEvaluationResponses,
  useExportBiDashboardPdf,
  useExportBiExecutiveNotebookPdf,
  useImportBiGsdEvaluation,
  useMe,
  useUpdateBiGsdEvaluationCardSetting,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { hasAnyRole, ROLE_TI } from "../app/roleAccess";
import { useToast } from "../app/toast";
import {
  BiExecutiveNotebookDialog,
  type BiExecutiveNotebookPayload,
} from "../components/bi/BiExecutiveNotebookDialog";
import { BiCollapsibleSection } from "../components/bi/BiCollapsibleSection";
import { BiSurveyQuestionsPanel } from "../components/bi/BiSurveyQuestionsPanel";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { countActiveBusinessIntelligenceFilters } from "../features/businessIntelligence";
import {
  BI_GSD_EVALUATION_QUESTIONS,
  buildBiSurveyQuestionsFromColumnsMeta,
} from "../features/biSurveyQuestions";

type MetricMode = "PERCENT" | "COUNT";
type CombineMode = "AND" | "OR";
type DeleteConfirmMode = "SELECTED" | "FILTERED";

type DistributionDatum = {
  label: string;
  count: number;
  percent: number;
  localities?: string[];
};

type CardSetting = {
  cardId: string;
  title: string;
  description?: string | null;
};

type GsdEvaluationDashboardResponse = {
  kpis: {
    totalResponses: number;
    totalRowsInDb: number;
    completionRatePercent: number;
    categoricalQuestions: number;
    freeTextQuestions: number;
  };
  filters: {
    columns: Array<{
      key: string;
      label: string;
      options: string[];
    }>;
  };
  charts: {
    categoricalDistributions: Array<{
      key: string;
      label: string;
      type: "CATEGORICAL" | "MULTI_SELECT";
      totalMentions: number;
      data: DistributionDatum[];
    }>;
  };
  textColumns: {
    freeTextLists: Array<{
      key: string;
      label: string;
      totalUnique: number;
      totalResponses: number;
      displayed: number;
      items: Array<{
        text: string;
        count: number;
        percent: number;
      }>;
    }>;
  };
  insights: {
    topDistribution: {
      questionLabel: string;
      optionLabel: string;
      count: number;
      percent: number;
    } | null;
    topFreeText: {
      key: string;
      label: string;
      totalResponses: number;
    } | null;
    completion: {
      title: string;
      answeredRatePercent: number;
      filledCells: number;
      totalCells: number;
    };
  };
  latestImport?: {
    id: string;
    importedAt: string;
    fileName: string;
  } | null;
  cardSettings?: CardSetting[];
  columnsMeta?: Array<{
    key: string;
    label: string;
    type: "CATEGORICAL" | "MULTI_SELECT" | "FREE_TEXT";
  }>;
};

type GsdEvaluationResponseRow = {
  id: string;
  submittedAt?: string | null;
  answers: Record<string, string>;
  rawPayload: Record<string, string | null>;
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type EditableCardText = {
  title: string;
  description: string;
};

type DistributionDetailModalState = {
  questionTitle: string;
  optionLabel: string;
  count: number;
  percent: number;
  localities: string[];
};

type DistributionCardProps = {
  cardId: string;
  title: string;
  description: string;
  data: DistributionDatum[];
  color: string;
  mode: MetricMode;
  onEdit: (cardId: string) => void;
  editable: boolean;
  onOptionSelect?: (option: DistributionDatum) => void;
};

const GSD_BI_PALETTE = {
  primary: "#0F4C5C",
  primaryDark: "#0B3641",
  secondary: "#2D6A4F",
  accent: "#E76F51",
  accentSoft: "#F4A261",
  text: "#1F2937",
  muted: "#607085",
  neutral: "#DCE5EE",
  success: "#2E7D32",
  warning: "#C77D00",
  danger: "#B42318",
};

const CHART_COLORS = [
  GSD_BI_PALETTE.primary,
  GSD_BI_PALETTE.secondary,
  GSD_BI_PALETTE.accent,
  "#4B6CB7",
  "#7B8E3E",
  "#9C6644",
  "#5B8FB9",
  "#4C956C",
  "#D65DB1",
  "#7B61FF",
];

const cardSx = {
  borderRadius: 3,
  border: `1px solid ${alpha(GSD_BI_PALETTE.primary, 0.12)}`,
  boxShadow: `0 12px 28px ${alpha(GSD_BI_PALETTE.primary, 0.08)}`,
  background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(
    GSD_BI_PALETTE.primary,
    0.06,
  )} 100%)`,
};

const axisTickStyle = {
  fill: GSD_BI_PALETTE.muted,
  fontSize: 12,
};

const chartGridStroke = alpha(GSD_BI_PALETTE.primary, 0.14);
const chartAxisStroke = alpha(GSD_BI_PALETTE.primary, 0.2);
const tooltipContentStyle = {
  borderRadius: 10,
  border: `1px solid ${alpha(GSD_BI_PALETTE.primary, 0.2)}`,
  boxShadow: `0 10px 24px ${alpha(GSD_BI_PALETTE.primary, 0.15)}`,
  background: "#FFFFFF",
};
const tooltipLabelStyle = { color: GSD_BI_PALETTE.text, fontWeight: 700 };

const FIXED_CARD_DEFAULTS: Record<string, EditableCardText> = {
  "page-header": {
    title: "Avaliação GSD",
    description:
      "Painel analítico da pesquisa de Avaliação GSD com leitura de KPIs, distribuições por pergunta e listas de respostas textuais.",
  },
  "kpi-total": {
    title: "Total de respostas",
    description: "Quantidade de registros no recorte atual.",
  },
  "kpi-completion": {
    title: "Taxa de preenchimento",
    description: "Percentual médio de células preenchidas no recorte aplicado.",
  },
  "kpi-categorical": {
    title: "Perguntas categóricas",
    description: "Total de perguntas que geram gráficos de barras.",
  },
  "kpi-text": {
    title: "Perguntas de texto livre",
    description: "Total de perguntas renderizadas em listas textuais.",
  },
  "insight-main": {
    title: "Insights gerenciais",
    description:
      "Resumo dos principais sinais observados no recorte, com foco em concentração de respostas e campos discursivos.",
  },
  "list-imports": {
    title: "Histórico de importações",
    description: "Últimos arquivos importados para a base da Avaliação GSD.",
  },
  "list-responses": {
    title: "Registros da pesquisa",
    description:
      "Tabela com respostas do recorte atual, incluindo seleção para exclusão e exportação.",
  },
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function metricValue(mode: MetricMode, count: number, percent: number) {
  return mode === "COUNT" ? count : Number(percent.toFixed(2));
}

function normalizeCardIdKey(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildCsv(
  rows: GsdEvaluationResponseRow[],
  columnsMeta: Array<{ key: string; label: string }>,
) {
  const header = ["Data", ...columnsMeta.map((column) => column.label)];
  const body = rows.map((row) => [
    formatDate(row.submittedAt),
    ...columnsMeta.map((column) => row.answers?.[column.key] ?? ""),
  ]);

  return [header, ...body]
    .map((line) =>
      line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function DistributionCard({
  cardId,
  title,
  description,
  data,
  color,
  mode,
  onEdit,
  editable,
  onOptionSelect,
}: DistributionCardProps) {
  const chartData = data.slice(0, 12).map((item) => ({
    ...item,
    metric: metricValue(mode, item.count, item.percent),
  }));

  const longestLabelLength = chartData.reduce(
    (max, item) => Math.max(max, String(item.label ?? "").length),
    0,
  );
  const useLongLabelLayout = longestLabelLength >= 34;
  const rowHeight = useLongLabelLayout ? 34 : 24;
  const height = Math.max(
    useLongLabelLayout ? 228 : 164,
    chartData.length * rowHeight,
  );
  const yAxisWidth = useLongLabelLayout ? 240 : 170;
  const yAxisTickStyle = useLongLabelLayout
    ? { ...axisTickStyle, fontSize: 11 }
    : axisTickStyle;
  const metricLabel = mode === "COUNT" ? "Quantidade" : "Percentual (%)";

  return (
    <Card sx={cardSx}>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          {editable ? (
            <MuiTooltip title="Editar título/descrição">
              <IconButton size="small" onClick={() => onEdit(cardId)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
          ) : null}
        </Stack>
        <Typography variant="caption" sx={{ color: GSD_BI_PALETTE.muted }}>
          {description}
        </Typography>

        {chartData.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            Sem dados para o recorte atual.
          </Alert>
        ) : (
          <Box sx={{ mt: 1.1 }}>
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  type="number"
                  stroke={chartAxisStroke}
                  tick={axisTickStyle}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={yAxisWidth}
                  stroke={chartAxisStroke}
                  tick={yAxisTickStyle}
                />
                <Tooltip
                  formatter={(value: number, _name, payload) => {
                    const count = Number(payload?.payload?.count ?? 0);
                    const percent = Number(payload?.payload?.percent ?? 0);
                    const current = Number(value ?? 0);
                    return [
                      mode === "COUNT"
                        ? `${current} registros`
                        : `${current.toFixed(2)}%`,
                      `${metricLabel} | Qtd: ${count} | %: ${toPercent(percent)}`,
                    ];
                  }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar dataKey="metric" radius={[0, 10, 10, 0]} barSize={9}>
                  {chartData.map((item, index) => (
                    <Cell
                      key={`${cardId}-${item.label}`}
                      fill={index % 2 === 0 ? color : alpha(color, 0.72)}
                      onClick={() =>
                        onOptionSelect?.({
                          label: String(item.label),
                          count: Number(item.count),
                          percent: Number(item.percent),
                          localities: Array.isArray(item.localities)
                            ? item.localities
                            : [],
                        })
                      }
                      style={{
                        cursor: onOptionSelect ? "pointer" : "default",
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export function BiGsdEvaluationDashboardPage() {
  const toast = useToast();
  const { data: me } = useMe();

  const [metricMode, setMetricMode] = useState<MetricMode>("PERCENT");
  const [responsesExpanded, setResponsesExpanded] = useState(false);
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] =
    useState<DeleteConfirmMode | null>(null);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardDraft, setEditingCardDraft] = useState<EditableCardText>({
    title: "",
    description: "",
  });
  const [distributionDetailModal, setDistributionDetailModal] =
    useState<DistributionDetailModalState | null>(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    q: "",
    combineMode: "AND" as CombineMode,
    columnFilters: {} as Record<string, string>,
  });

  const dashboardFilters = useMemo(() => {
    const hasColumnFilters = Object.values(filters.columnFilters).some(
      (value) => Boolean(String(value ?? "").trim()),
    );

    return {
      from: filters.from || undefined,
      to: filters.to || undefined,
      q: filters.q || undefined,
      combineMode: filters.combineMode || undefined,
      columnFilters: hasColumnFilters
        ? JSON.stringify(filters.columnFilters)
        : undefined,
    };
  }, [filters]);

  const dashboardQuery = useBiGsdEvaluationDashboard(dashboardFilters);
  const responsesQuery = useBiGsdEvaluationResponses({
    ...dashboardFilters,
    page,
    pageSize: 25,
  });
  const importsQuery = useBiGsdEvaluationImports({ page: 1, pageSize: 8 });
  useBiGsdEvaluationCardSettings(true);

  const importMutation = useImportBiGsdEvaluation();
  const deleteResponsesMutation = useDeleteBiGsdEvaluationResponses();
  const exportPdfMutation = useExportBiDashboardPdf(
    "/bi/gsd-evaluation/dashboard/pdf",
    "bi-avaliacao-gsd",
  );
  const exportNotebookMutation = useExportBiExecutiveNotebookPdf();
  const updateCardSettingMutation = useUpdateBiGsdEvaluationCardSetting();

  const dashboard = dashboardQuery.data as
    | GsdEvaluationDashboardResponse
    | undefined;
  const responses = responsesQuery.data as
    | PagedResponse<GsdEvaluationResponseRow>
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
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);

  const getDefaultCardText = (cardId: string): EditableCardText => {
    if (FIXED_CARD_DEFAULTS[cardId]) return FIXED_CARD_DEFAULTS[cardId];

    if (cardId.startsWith("chart:")) {
      const key = cardId.slice("chart:".length);
      const chart = dashboard?.charts.categoricalDistributions.find(
        (item) => item.key === key,
      );
      return {
        title: chart?.label ?? "Distribuição",
        description:
          "Distribuição de respostas para a pergunta no recorte atual.",
      };
    }

    if (cardId.startsWith("text:")) {
      const key = cardId.slice("text:".length);
      const list = dashboard?.textColumns.freeTextLists.find(
        (item) => item.key === key,
      );
      return {
        title: list?.label ?? "Texto livre",
        description:
          "Lista consolidada das respostas textuais com frequência no recorte.",
      };
    }

    return {
      title: cardId,
      description: "",
    };
  };

  const cardSettingsMap = useMemo(() => {
    const map = new Map<string, EditableCardText>();
    for (const item of dashboard?.cardSettings ?? []) {
      const cardId = String(item?.cardId ?? "").trim();
      if (!cardId) continue;
      map.set(cardId, {
        title:
          String(item?.title ?? "").trim() || getDefaultCardText(cardId).title,
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

  const updateFilter = <K extends keyof typeof filters>(
    key: K,
    value: (typeof filters)[K],
  ) => {
    setPage(1);
    setSelectedIds([]);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateColumnFilter = (key: string, value: string) => {
    setPage(1);
    setSelectedIds([]);
    setFilters((prev) => ({
      ...prev,
      columnFilters: {
        ...prev.columnFilters,
        [key]: value,
      },
    }));
  };

  const resetFilters = () => {
    setPage(1);
    setSelectedIds([]);
    setFilters({
      from: "",
      to: "",
      q: "",
      combineMode: "AND",
      columnFilters: {},
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
          `Importação concluída. Inseridos: ${
            result?.batch?.insertedRows ?? 0
          }. ` +
          `Duplicados: ${result?.batch?.duplicateRows ?? 0}. ` +
          `Inválidos: ${result?.batch?.invalidRows ?? 0}.`,
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

  const exportCurrentCsv = () => {
    if (!responses?.items?.length) {
      toast.push({
        message: "Sem dados para exportar no recorte atual.",
        severity: "warning",
      });
      return;
    }

    const columnsMeta = dashboard?.columnsMeta ?? [];
    const csv = buildCsv(responses.items, columnsMeta);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bi-avaliacao-gsd-recorte.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    try {
      await exportPdfMutation.mutateAsync(dashboardFilters);
      toast.push({
        message: "PDF executivo gerado com sucesso.",
        severity: "success",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao exportar o PDF.",
        severity: "error",
      });
    }
  };

  const handleExportNotebookPdf = async (
    payload: BiExecutiveNotebookPayload,
  ) => {
    try {
      await exportNotebookMutation.mutateAsync(payload);
      setNotebookDialogOpen(false);
      toast.push({
        message: "Caderno executivo gerado com sucesso.",
        severity: "success",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao gerar o caderno executivo.",
        severity: "error",
      });
    }
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
          from: dashboardFilters.from,
          to: dashboardFilters.to,
          q: dashboardFilters.q,
          combineMode: dashboardFilters.combineMode,
          columnFilters: filters.columnFilters,
          allFiltered: true,
        });
        toast.push({
          message: `${
            result?.deletedCount ?? 0
          } registro(s) excluído(s) pelo filtro atual.`,
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

  const activeFiltersCount = useMemo(
    () => countActiveBusinessIntelligenceFilters(filters, ["combineMode"]),
    [filters],
  );

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
      <Alert severity="warning">Não foi possível carregar o painel.</Alert>
    );
  }

  const pageHeaderText = getCardText("page-header");
  const kpiTotalText = getCardText("kpi-total");
  const kpiCompletionText = getCardText("kpi-completion");
  const kpiCategoricalText = getCardText("kpi-categorical");
  const kpiTextText = getCardText("kpi-text");
  const insightMainText = getCardText("insight-main");
  const importsText = getCardText("list-imports");
  const responsesText = getCardText("list-responses");

  const visibleColumns = (dashboard.columnsMeta ?? []).slice(0, 6);
  const surveyQuestions = buildBiSurveyQuestionsFromColumnsMeta(
    dashboard.columnsMeta,
    BI_GSD_EVALUATION_QUESTIONS,
  );

  return (
    <Box
      sx={{
        color: GSD_BI_PALETTE.text,
        background: `radial-gradient(1100px 420px at -8% -18%, ${alpha(
          GSD_BI_PALETTE.primary,
          0.18,
        )} 0%, transparent 62%), radial-gradient(980px 360px at 108% -12%, ${alpha(
          GSD_BI_PALETTE.accentSoft,
          0.16,
        )} 0%, transparent 60%)`,
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
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Typography variant="h4" fontWeight={700}>
              {pageHeaderText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton
                  size="small"
                  onClick={() => openCardEditor("page-header")}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="body2" sx={{ color: GSD_BI_PALETTE.muted }}>
            {pageHeaderText.description}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
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
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.5),
              color: GSD_BI_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: GSD_BI_PALETTE.primary,
                bgcolor: alpha(GSD_BI_PALETTE.primary, 0.06),
              },
            }}
          >
            Exportar recorte CSV
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfRoundedIcon />}
            onClick={handleExportPdf}
            disabled={exportPdfMutation.isPending}
            sx={{
              height: 36,
              px: 1.4,
              fontSize: 13,
              whiteSpace: "nowrap",
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.5),
              color: GSD_BI_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: GSD_BI_PALETTE.primary,
                bgcolor: alpha(GSD_BI_PALETTE.primary, 0.06),
              },
            }}
          >
            {exportPdfMutation.isPending ? "Gerando PDF..." : "Exportar PDF"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<MenuBookRoundedIcon />}
            onClick={() => setNotebookDialogOpen(true)}
            disabled={exportNotebookMutation.isPending}
            sx={{
              height: 36,
              px: 1.4,
              fontSize: 13,
              whiteSpace: "nowrap",
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.5),
              color: GSD_BI_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: GSD_BI_PALETTE.primary,
                bgcolor: alpha(GSD_BI_PALETTE.primary, 0.06),
              },
            }}
          >
            {exportNotebookMutation.isPending
              ? "Gerando caderno..."
              : "Caderno PDF"}
          </Button>
        </Stack>
      </Stack>

      <BiCollapsibleSection
        title="Ingestão de dados"
        description="Template, upload e atualização da base ficam acessíveis sem disputar espaço com os indicadores."
        icon={<UploadFileRoundedIcon fontSize="small" />}
        accentColor={GSD_BI_PALETTE.primary}
        summary={
          <Chip
            size="small"
            label={
              file
                ? "Arquivo pronto"
                : dashboard.latestImport?.fileName
                  ? "Base carregada"
                  : "Sem importação"
            }
            variant="outlined"
            sx={{
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.28),
              color: GSD_BI_PALETTE.primary,
              bgcolor: alpha(GSD_BI_PALETTE.primary, 0.04),
            }}
          />
        }
        sx={{ mb: 2, ...cardSx }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.2}
          alignItems={{ lg: "center" }}
          sx={{ flexWrap: { lg: "wrap" }, rowGap: { lg: 1.2 }, pt: 1.2 }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            component="a"
            href="/templates/bi-avaliacao-gsd-template.csv"
            download
            sx={{
              height: 40,
              px: 1.6,
              whiteSpace: "nowrap",
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.5),
              color: GSD_BI_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: GSD_BI_PALETTE.primary,
                bgcolor: alpha(GSD_BI_PALETTE.primary, 0.06),
              },
            }}
          >
            Baixar template
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileRoundedIcon />}
            disabled={!canUpload}
            sx={{
              minWidth: 260,
              height: 40,
              whiteSpace: "nowrap",
              flexShrink: 0,
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.5),
              color: GSD_BI_PALETTE.primary,
              "&:hover": {
                borderColor: GSD_BI_PALETTE.primary,
                bgcolor: alpha(GSD_BI_PALETTE.primary, 0.06),
              },
            }}
          >
            {file ? file.name : "Selecionar arquivo da pesquisa"}
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
          <FormControlLabel
            control={
              <Checkbox
                checked={replaceOnImport}
                onChange={(event) => setReplaceOnImport(event.target.checked)}
                disabled={!canUpload}
              />
            }
            label="Substituir base atual"
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleImport}
            disabled={!canUpload || importMutation.isPending}
            sx={{
              height: 40,
              px: 2,
              whiteSpace: "nowrap",
              flexShrink: 0,
              bgcolor: GSD_BI_PALETTE.primary,
              "&:hover": { bgcolor: GSD_BI_PALETTE.primaryDark },
            }}
          >
            {importMutation.isPending ? "Importando..." : "Importar"}
          </Button>
          <Box sx={{ ml: { lg: "auto" } }}>
            <Typography variant="caption" sx={{ color: GSD_BI_PALETTE.muted }}>
              Última importação
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {dashboard.latestImport?.fileName ?? "Nenhuma"}
            </Typography>
          </Box>
        </Stack>
      </BiCollapsibleSection>

      <BiSurveyQuestionsPanel
        questions={surveyQuestions}
        accentColor={GSD_BI_PALETTE.primary}
        sx={{ mb: 2, ...cardSx }}
      />

      <BiCollapsibleSection
        title="Filtros do painel"
        description="Os filtros ficam recolhidos e podem ser expandidos apenas quando o usuário precisar aprofundar o recorte."
        icon={<FilterListRoundedIcon fontSize="small" />}
        accentColor={GSD_BI_PALETTE.primary}
        summary={
          <Chip
            size="small"
            label={
              activeFiltersCount > 0
                ? `${activeFiltersCount} filtro${activeFiltersCount > 1 ? "s" : ""} ativo${activeFiltersCount > 1 ? "s" : ""}`
                : "Sem filtros ativos"
            }
            variant="outlined"
            sx={{
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.28),
              color: GSD_BI_PALETTE.primary,
              bgcolor: alpha(GSD_BI_PALETTE.primary, 0.04),
            }}
          />
        }
        headerActions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoGraphRoundedIcon />}
            onClick={resetFilters}
            sx={{
              borderColor: alpha(GSD_BI_PALETTE.primary, 0.35),
              color: GSD_BI_PALETTE.primary,
            }}
          >
            Limpar filtros
          </Button>
        }
        sx={{ mb: 1.2, ...cardSx }}
      >
        <Grid container spacing={1.2} sx={{ pt: 1.2 }}>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Busca livre"
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              select
              label="Combinar filtros"
              value={filters.combineMode}
              onChange={(event) =>
                updateFilter("combineMode", event.target.value as CombineMode)
              }
            >
              <MenuItem value="AND">AND</MenuItem>
              <MenuItem value="OR">OR</MenuItem>
            </TextField>
          </Grid>
          <Grid
            size={{ xs: 12, md: 3 }}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: { xs: "flex-start", md: "flex-end" },
            }}
          >
            <Stack direction="row" spacing={1}>
              <Chip
                label={metricMode === "PERCENT" ? "Exibir: %" : "Exibir: Qtde"}
                color="primary"
                size="small"
                onClick={() =>
                  setMetricMode((prev) =>
                    prev === "PERCENT" ? "COUNT" : "PERCENT",
                  )
                }
                sx={{ cursor: "pointer" }}
              />
            </Stack>
          </Grid>

          {dashboard.filters.columns.map((column) => (
            <Grid key={column.key} size={{ xs: 12, md: 4, lg: 3 }}>
              <TextField
                fullWidth
                size="small"
                select
                label={column.label}
                value={filters.columnFilters[column.key] ?? ""}
                onChange={(event) =>
                  updateColumnFilter(column.key, event.target.value)
                }
              >
                <MenuItem value="">Todos</MenuItem>
                {column.options.map((option) => (
                  <MenuItem key={`${column.key}-${option}`} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ))}
        </Grid>
      </BiCollapsibleSection>

      <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={cardSx}>
            <CardContent
              sx={{ py: 1.15, px: 1.4, "&:last-child": { pb: 1.15 } }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="caption"
                  sx={{ color: GSD_BI_PALETTE.muted }}
                >
                  {kpiTotalText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-total")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: GSD_BI_PALETTE.primary }}
              >
                {dashboard.kpis.totalResponses}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: GSD_BI_PALETTE.muted }}
              >
                {kpiTotalText.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={cardSx}>
            <CardContent
              sx={{ py: 1.15, px: 1.4, "&:last-child": { pb: 1.15 } }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="caption"
                  sx={{ color: GSD_BI_PALETTE.muted }}
                >
                  {kpiCompletionText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-completion")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: GSD_BI_PALETTE.accent }}
              >
                {toPercent(dashboard.kpis.completionRatePercent)}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: GSD_BI_PALETTE.muted }}
              >
                {kpiCompletionText.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={cardSx}>
            <CardContent
              sx={{ py: 1.15, px: 1.4, "&:last-child": { pb: 1.15 } }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="caption"
                  sx={{ color: GSD_BI_PALETTE.muted }}
                >
                  {kpiCategoricalText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-categorical")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: GSD_BI_PALETTE.secondary }}
              >
                {dashboard.kpis.categoricalQuestions}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: GSD_BI_PALETTE.muted }}
              >
                {kpiCategoricalText.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={cardSx}>
            <CardContent
              sx={{ py: 1.15, px: 1.4, "&:last-child": { pb: 1.15 } }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="caption"
                  sx={{ color: GSD_BI_PALETTE.muted }}
                >
                  {kpiTextText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-text")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: GSD_BI_PALETTE.warning }}
              >
                {dashboard.kpis.freeTextQuestions}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: GSD_BI_PALETTE.muted }}
              >
                {kpiTextText.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 1.2, ...cardSx }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={0.4}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {insightMainText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton
                  size="small"
                  onClick={() => openCardEditor("insight-main")}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: GSD_BI_PALETTE.muted }}>
            {insightMainText.description}
          </Typography>
          <Grid container spacing={1.2} sx={{ mt: 0.2 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="info" sx={{ mt: 1 }}>
                <strong>Sinal mais concentrado:</strong>{" "}
                {dashboard.insights.topDistribution
                  ? `${dashboard.insights.topDistribution.questionLabel} — ${dashboard.insights.topDistribution.optionLabel} (${dashboard.insights.topDistribution.count} | ${toPercent(
                      dashboard.insights.topDistribution.percent,
                    )})`
                  : "Sem dados"}
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="warning" sx={{ mt: 1 }}>
                <strong>{dashboard.insights.completion.title}:</strong>{" "}
                {toPercent(dashboard.insights.completion.answeredRatePercent)} (
                {dashboard.insights.completion.filledCells}/
                {dashboard.insights.completion.totalCells})
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="success" sx={{ mt: 1 }}>
                <strong>Texto livre mais ativo:</strong>{" "}
                {dashboard.insights.topFreeText
                  ? `${dashboard.insights.topFreeText.label} (${dashboard.insights.topFreeText.totalResponses} respostas)`
                  : "Sem dados"}
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
        {dashboard.charts.categoricalDistributions.map((chart, index) => {
          const cardId = `chart:${chart.key}`;
          const text = getCardText(cardId);
          return (
            <Grid key={chart.key} size={{ xs: 12, md: 6 }}>
              <DistributionCard
                cardId={cardId}
                title={text.title}
                description={text.description}
                data={chart.data}
                color={CHART_COLORS[index % CHART_COLORS.length]}
                mode={metricMode}
                onEdit={openCardEditor}
                editable={isTiProfile}
                onOptionSelect={(option) =>
                  setDistributionDetailModal({
                    questionTitle: text.title,
                    optionLabel: option.label,
                    count: option.count,
                    percent: option.percent,
                    localities: option.localities ?? [],
                  })
                }
              />
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
        {dashboard.textColumns.freeTextLists.map((list) => {
          const cardId = `text:${list.key}`;
          const text = getCardText(cardId);
          const normalizedListKey = normalizeCardIdKey(list.key);
          const normalizedListLabel = normalizeCardIdKey(list.label);
          const isComplementaryObservationCard =
            normalizedListKey.includes("observacoes_complementares") ||
            normalizedListLabel.includes("observacoes_complementares");
          return (
            <Grid
              key={list.key}
              size={{ xs: 12, md: isComplementaryObservationCard ? 12 : 6 }}
            >
              <Card sx={cardSx}>
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="subtitle1" fontWeight={700}>
                      {text.title}
                    </Typography>
                    {isTiProfile ? (
                      <MuiTooltip title="Editar título/descrição">
                        <IconButton
                          size="small"
                          onClick={() => openCardEditor(cardId)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </MuiTooltip>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ color: GSD_BI_PALETTE.muted }}
                  >
                    {text.description}
                  </Typography>
                  {list.items.length === 0 ? (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Sem respostas textuais no recorte.
                    </Alert>
                  ) : (
                    <Stack spacing={0.8} sx={{ mt: 1 }}>
                      {list.items.map((item) => (
                        <Box
                          key={`${list.key}-${normalizeCardIdKey(item.text)}`}
                          sx={{
                            borderRadius: 2,
                            p: 1,
                            border: `1px solid ${alpha(GSD_BI_PALETTE.primary, 0.18)}`,
                            background: alpha(GSD_BI_PALETTE.primary, 0.03),
                          }}
                        >
                          <Typography variant="body2" sx={{ mb: 0.4 }}>
                            {item.text}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: GSD_BI_PALETTE.muted,
                              fontWeight: 600,
                            }}
                          >
                            {item.count} resposta(s) • {toPercent(item.percent)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card sx={{ mb: 1.2, ...cardSx }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {importsText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton
                  size="small"
                  onClick={() => openCardEditor("list-imports")}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: GSD_BI_PALETTE.muted }}>
            {importsText.description}
          </Typography>
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Arquivo</TableCell>
                <TableCell>Importado em</TableCell>
                <TableCell align="right">Inseridos</TableCell>
                <TableCell align="right">Duplicados</TableCell>
                <TableCell align="right">Inválidos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(imports?.items ?? []).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.fileName}</TableCell>
                  <TableCell>{formatDate(item.importedAt)}</TableCell>
                  <TableCell align="right">{item.insertedRows}</TableCell>
                  <TableCell align="right">{item.duplicateRows}</TableCell>
                  <TableCell align="right">{item.invalidRows}</TableCell>
                </TableRow>
              ))}
              {(imports?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Alert severity="info">
                      Nenhuma importação registrada.
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card sx={{ ...cardSx }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Typography variant="subtitle1" fontWeight={700}>
                  {responsesText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("list-responses")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="caption"
                sx={{ color: GSD_BI_PALETTE.muted }}
              >
                {responsesText.description}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  responsesExpanded ? (
                    <KeyboardArrowUpRoundedIcon />
                  ) : (
                    <KeyboardArrowDownRoundedIcon />
                  )
                }
                onClick={() => setResponsesExpanded((prev) => !prev)}
              >
                {responsesExpanded ? "Ocultar" : "Exibir"}
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={!canDelete || selectedIds.length === 0}
                onClick={() => setDeleteConfirmMode("SELECTED")}
              >
                Excluir selecionados
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={!canDelete || dashboard.kpis.totalResponses === 0}
                onClick={() => setDeleteConfirmMode("FILTERED")}
              >
                Excluir recorte
              </Button>
            </Stack>
          </Stack>

          <Collapse in={responsesExpanded}>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      disabled={currentPageIds.length === 0}
                    />
                  </TableCell>
                  <TableCell>Data</TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key}>{column.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(responses?.items ?? []).map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelectRow(item.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatDate(item.submittedAt)}
                    </TableCell>
                    {visibleColumns.map((column) => (
                      <TableCell key={`${item.id}-${column.key}`}>
                        {item.answers?.[column.key] ?? "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {(responses?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + visibleColumns.length}>
                      <Alert severity="info">Nenhum registro no recorte.</Alert>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ md: "center" }}
              gap={1}
              sx={{ mt: 1 }}
            >
              <Typography
                variant="caption"
                sx={{ color: GSD_BI_PALETTE.muted }}
              >
                Página {responses?.page ?? page} de {totalPages} • Total:{" "}
                {responses?.total ?? 0}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={(responses?.page ?? page) <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={(responses?.page ?? page) >= totalPages}
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                >
                  Próxima
                </Button>
              </Stack>
            </Stack>
          </Collapse>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirmMode !== null}
        title="Confirmar exclusão"
        message={
          deleteConfirmMode === "SELECTED"
            ? "Deseja excluir os registros selecionados?"
            : "Deseja excluir todos os registros do recorte atual?"
        }
        highlightText={
          deleteConfirmMode === "SELECTED"
            ? `${selectedIds.length} registro(s) selecionado(s)`
            : `${dashboard.kpis.totalResponses} registro(s) no recorte atual`
        }
        severity="error"
        confirmLabel="Excluir"
        confirmLoading={deleteResponsesMutation.isPending}
        onCancel={() => setDeleteConfirmMode(null)}
        onConfirm={handleConfirmDelete}
      />

      <Dialog
        open={distributionDetailModal !== null}
        onClose={() => setDistributionDetailModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Localidades da resposta selecionada</DialogTitle>
        <DialogContent
          sx={{ display: "grid", gap: 1.1, pt: "12px !important" }}
        >
          <Typography variant="body2">
            <strong>Pergunta:</strong>{" "}
            {distributionDetailModal?.questionTitle ?? "-"}
          </Typography>
          <Typography variant="body2">
            <strong>Resposta:</strong>{" "}
            {distributionDetailModal?.optionLabel ?? "-"}
          </Typography>
          <Typography variant="body2">
            <strong>Ocorrências:</strong> {distributionDetailModal?.count ?? 0}{" "}
            ({toPercent(distributionDetailModal?.percent ?? 0)})
          </Typography>
          <Typography variant="body2">
            <strong>
              OM observada ({distributionDetailModal?.localities.length ?? 0}):
            </strong>
          </Typography>
          {(distributionDetailModal?.localities.length ?? 0) === 0 ? (
            <Alert severity="info">
              Nenhuma OM identificada para esta combinação no recorte atual.
            </Alert>
          ) : (
            <Box
              sx={{
                maxHeight: 320,
                overflowY: "auto",
                borderRadius: 2,
                border: `1px solid ${alpha(GSD_BI_PALETTE.primary, 0.18)}`,
                p: 1,
              }}
            >
              <Stack spacing={0.65}>
                {(distributionDetailModal?.localities ?? []).map((locality) => (
                  <Typography key={locality} variant="body2">
                    - {locality}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributionDetailModal(null)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingCardId !== null}
        onClose={() => setEditingCardId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar texto do card</DialogTitle>
        <DialogContent
          sx={{ display: "grid", gap: 1.2, pt: "12px !important" }}
        >
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
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCardId(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={saveCardEditor}
            disabled={updateCardSettingMutation.isPending}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <BiExecutiveNotebookDialog
        open={notebookDialogOpen}
        onClose={() => setNotebookDialogOpen(false)}
        onSubmit={handleExportNotebookPdf}
        isPending={exportNotebookMutation.isPending}
        accentColor={GSD_BI_PALETTE.primary}
        currentPanelKey="gsd-evaluation"
        currentPanelFilters={dashboardFilters}
      />
    </Box>
  );
}
