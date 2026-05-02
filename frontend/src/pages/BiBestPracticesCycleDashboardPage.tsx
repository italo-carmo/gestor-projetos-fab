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
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type BiImportNormalizationPreview,
  useBiBestPracticesCycleDashboard,
  useBiBestPracticesCycleImports,
  useBiBestPracticesCycleResponses,
  useDeleteBiBestPracticesCycleResponses,
  useExportBiDashboardPdf,
  useExportBiExecutiveNotebookPdf,
  useImportBiBestPracticesCycle,
  usePreviewImportBiBestPracticesCycle,
  useMe,
  useUpdateBiBestPracticesCycleCardSetting,
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
import { BiImportNormalizationReviewDialog } from "../components/bi/BiImportNormalizationReviewDialog";
import { BiSurveyQuestionsPanel } from "../components/bi/BiSurveyQuestionsPanel";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { countActiveBusinessIntelligenceFilters } from "../features/businessIntelligence";
import { BI_BEST_PRACTICES_CYCLE_QUESTIONS } from "../features/biSurveyQuestions";

type MetricMode = "PERCENT" | "COUNT";
type CombineMode = "AND" | "OR";
type DeleteConfirmMode = "SELECTED" | "FILTERED";

type DistributionDatum = {
  label: string;
  count: number;
  percent: number;
  [key: string]: string | number;
};

type CardId =
  | "page-header"
  | "kpi-total"
  | "kpi-prepared"
  | "kpi-interaction"
  | "kpi-support"
  | "insight-main"
  | "chart-q1"
  | "chart-q2"
  | "chart-q3"
  | "chart-q4"
  | "chart-q6"
  | "chart-q7"
  | "chart-trend-q2"
  | "list-q5"
  | "list-specialty";

type EditableCardText = {
  title: string;
  description: string;
};

type CardSetting = {
  cardId: string;
  title: string;
  description?: string | null;
};

type BestPracticesCycleDashboardResponse = {
  kpis: {
    totalResponses: number;
    totalRowsInDb: number;
    preparedPositiveCount: number;
    preparedPositiveRatePercent: number;
    interactionYesCount: number;
    interactionYesRatePercent: number;
    supportFrequentCount: number;
    supportFrequentRatePercent: number;
    lowPreparednessCount: number;
    lowPreparednessRatePercent: number;
  };
  filters: {
    technicalRigorPerception: string[];
    preparednessToLeadMixedClass: string[];
    genderBiasImpact: string[];
    interactionDifference: string[];
    supportNeedRecognition: string[];
    mainChallengeOptions: string[];
    identification: string[];
    specialty: string[];
  };
  charts: {
    technicalRigorDistribution: DistributionDatum[];
    preparednessDistribution: DistributionDatum[];
    genderBiasDistribution: DistributionDatum[];
    interactionDifferenceDistribution: DistributionDatum[];
    supportNeedDistribution: DistributionDatum[];
    mainChallengeDistribution: DistributionDatum[];
    preparednessTrendByDay: {
      options: string[];
      items: Array<{
        day: string;
        dayLabel: string;
        total: number;
        [key: string]: string | number;
      }>;
    };
  };
  textColumns: {
    interactionDifferenceComment: {
      total: number;
      displayed: number;
      items: Array<{
        id: string;
        submittedAt: string | null;
        identification: string | null;
        specialty: string | null;
        text: string;
      }>;
    };
    specialtyFreeText: {
      totalUnique: number;
      totalResponses: number;
      displayed: number;
      items: Array<{
        text: string;
        count: number;
        percent: number;
      }>;
    };
  };
  insights: {
    topChallenge: {
      label: string;
      count: number;
      percent: number;
    } | null;
    mostFrequentSpecialty: {
      text: string;
      count: number;
      percent: number;
    } | null;
    preparednessAttentionPoint: {
      title: string;
      affectedCount: number;
      affectedRatePercent: number;
    };
  };
  latestImport?: {
    id: string;
    importedAt: string;
    fileName: string;
  } | null;
  cardSettings?: CardSetting[];
};

type BestPracticesCycleResponseRow = {
  id: string;
  submittedAt?: string | null;
  technicalRigorPerception?: string | null;
  preparednessToLeadMixedClass?: string | null;
  genderBiasImpact?: string | null;
  interactionDifference?: string | null;
  interactionDifferenceComment?: string | null;
  supportNeedRecognition?: string | null;
  mainChallengeOptions?: string[];
  identification?: string | null;
  specialty?: string | null;
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

const BPC_PALETTE = {
  primary: "#0B4A6F",
  primaryDark: "#08344F",
  secondary: "#2A9D8F",
  accent: "#E76F51",
  accentSoft: "#F4A261",
  text: "#1F2A37",
  muted: "#5C6D7E",
  neutral: "#DCE5EE",
  success: "#2E7D32",
  warning: "#C77D00",
  danger: "#B42318",
};

const CHART_COLORS = [
  BPC_PALETTE.primary,
  BPC_PALETTE.secondary,
  BPC_PALETTE.accent,
  "#4B6CB7",
  "#7B8E3E",
  "#9C6644",
  "#7B61FF",
  "#4C956C",
  "#D65DB1",
  "#5B8FB9",
];

const cardSx = {
  borderRadius: 3,
  border: `1px solid ${alpha(BPC_PALETTE.primary, 0.12)}`,
  boxShadow: `0 12px 28px ${alpha(BPC_PALETTE.primary, 0.08)}`,
  background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(
    BPC_PALETTE.primary,
    0.06,
  )} 100%)`,
};

const axisTickStyle = {
  fill: BPC_PALETTE.muted,
  fontSize: 12,
};

const chartGridStroke = alpha(BPC_PALETTE.primary, 0.14);
const chartAxisStroke = alpha(BPC_PALETTE.primary, 0.2);
const tooltipContentStyle = {
  borderRadius: 10,
  border: `1px solid ${alpha(BPC_PALETTE.primary, 0.2)}`,
  boxShadow: `0 10px 24px ${alpha(BPC_PALETTE.primary, 0.15)}`,
  background: "#FFFFFF",
};
const tooltipLabelStyle = { color: BPC_PALETTE.text, fontWeight: 700 };
const legendWrapperStyle = { color: BPC_PALETTE.text };

const CARD_DEFAULTS: Record<CardId, EditableCardText> = {
  "page-header": {
    title: "Ciclo de Boas Práticas",
    description:
      "Painel analítico da pesquisa sobre formação de turmas mistas, com leitura gerencial e evidências para decisões de melhoria.",
  },
  "kpi-total": {
    title: "Total de respostas",
    description: "Quantidade de registros no recorte atual.",
  },
  "kpi-prepared": {
    title: "Preparo para condução (Q2)",
    description:
      "Percentual que respondeu Concordo totalmente/parcialmente na pergunta 2.",
  },
  "kpi-interaction": {
    title: "Percepção de diferença (Q4)",
    description: "Percentual de respostas 'Sim' na pergunta 4.",
  },
  "kpi-support": {
    title: "Reconhecimento de apoio (Q6)",
    description:
      "Percentual que respondeu Sempre/Frequentemente sobre identificar demanda de apoio especializado.",
  },
  "insight-main": {
    title: "Insights gerenciais",
    description:
      "Resumo dos principais sinais identificados com base nas respostas fechadas e textos livres.",
  },
  "chart-q1": {
    title: "Q1 · Rigor técnico-militar",
    description:
      "Distribuição das respostas sobre manter o rigor na formação de turmas mistas.",
  },
  "chart-q2": {
    title: "Q2 · Sinto-me preparado",
    description:
      "Distribuição das respostas da pergunta de preparo individual.",
  },
  "chart-q3": {
    title: "Q3 · Vieses de gênero",
    description:
      "Percepção sobre influência de vieses nas decisões e práticas.",
  },
  "chart-q4": {
    title: "Q4 · Diferença de interação",
    description:
      "Comparação da percepção sobre interação em turmas mistas versus masculinas.",
  },
  "chart-q6": {
    title: "Q6 · Identificação de necessidade de apoio",
    description:
      "Frequência com que o respondente identifica situações que demandam Assistente Social/Psicólogo.",
  },
  "chart-q7": {
    title: "Q7 · Principais desafios",
    description:
      "Consolidação das opções marcadas (múltipla escolha) sobre o principal desafio na condução da primeira turma feminina.",
  },
  "chart-trend-q2": {
    title: "Evolução diária das respostas da Q2 (em %)",
    description:
      "Fonte: coluna '2. Sinto-me preparado para conduzir a formação de turmas mistas...'. Cada barra representa a composição percentual diária das respostas.",
  },
  "list-q5": {
    title: "Q5 · Diferenças observadas (texto livre)",
    description:
      "Lista de relatos textuais da pergunta 5. Campos de texto livre são exibidos em lista, não em gráfico.",
  },
  "list-specialty": {
    title: "Especialidades (texto livre)",
    description:
      "Consolidação textual da coluna de especialidade em formato de lista com frequência.",
  },
};

type DistributionCardProps = {
  cardId: CardId;
  data: DistributionDatum[];
  mode: MetricMode;
  color: string;
  longLabels?: boolean;
  getCardText: (cardId: CardId) => EditableCardText;
  onEdit: (cardId: CardId) => void;
  editable: boolean;
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

function isCardId(value: string): value is CardId {
  return Object.prototype.hasOwnProperty.call(CARD_DEFAULTS, value);
}

function buildCsv(items: BestPracticesCycleResponseRow[]) {
  const header = [
    "Data",
    "Q1 - Rigor técnico-militar",
    "Q2 - Sinto-me preparado",
    "Q3 - Vieses de gênero",
    "Q4 - Diferença de interação",
    "Q5 - Diferença (texto)",
    "Q6 - Identifica demanda de apoio",
    "Q7 - Principais desafios",
    "Identificação",
    "Especialidade",
  ];

  const rows = items.map((item) => [
    formatDate(item.submittedAt),
    item.technicalRigorPerception ?? "",
    item.preparednessToLeadMixedClass ?? "",
    item.genderBiasImpact ?? "",
    item.interactionDifference ?? "",
    item.interactionDifferenceComment ?? "",
    item.supportNeedRecognition ?? "",
    (item.mainChallengeOptions ?? []).join(" | "),
    item.identification ?? "",
    item.specialty ?? "",
  ]);

  return [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function DistributionCard({
  cardId,
  data,
  mode,
  color,
  longLabels = false,
  getCardText,
  onEdit,
  editable,
}: DistributionCardProps) {
  const chartData = data.slice(0, 12).map((item) => ({
    ...item,
    metric: metricValue(mode, item.count, item.percent),
  }));
  const cardText = getCardText(cardId);

  const longestLabelLength = chartData.reduce(
    (max, item) => Math.max(max, String(item.label ?? "").length),
    0,
  );
  const useLongLabelLayout = longLabels || longestLabelLength >= 34;
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
            {cardText.title}
          </Typography>
          {editable ? (
            <MuiTooltip title="Editar título/descrição">
              <IconButton size="small" onClick={() => onEdit(cardId)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
          ) : null}
        </Stack>
        <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
          {cardText.description}
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

export function BiBestPracticesCycleDashboardPage() {
  const toast = useToast();
  const { data: me } = useMe();

  const [metricMode, setMetricMode] = useState<MetricMode>("PERCENT");
  const [responsesExpanded, setResponsesExpanded] = useState(false);
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] =
    useState<BiImportNormalizationPreview | null>(null);
  const [selectedNormalizationIds, setSelectedNormalizationIds] = useState<
    string[]
  >([]);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] =
    useState<DeleteConfirmMode | null>(null);

  const [editingCardId, setEditingCardId] = useState<CardId | null>(null);
  const [editingCardDraft, setEditingCardDraft] = useState<EditableCardText>({
    title: "",
    description: "",
  });

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    technicalRigorPerception: "",
    preparednessToLeadMixedClass: "",
    genderBiasImpact: "",
    interactionDifference: "",
    supportNeedRecognition: "",
    mainChallengeOption: "",
    identification: "",
    specialty: "",
    q: "",
    combineMode: "AND" as CombineMode,
  });

  const dashboardFilters = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
      technicalRigorPerception: filters.technicalRigorPerception || undefined,
      preparednessToLeadMixedClass:
        filters.preparednessToLeadMixedClass || undefined,
      genderBiasImpact: filters.genderBiasImpact || undefined,
      interactionDifference: filters.interactionDifference || undefined,
      supportNeedRecognition: filters.supportNeedRecognition || undefined,
      mainChallengeOption: filters.mainChallengeOption || undefined,
      identification: filters.identification || undefined,
      specialty: filters.specialty || undefined,
      q: filters.q || undefined,
      combineMode: filters.combineMode || undefined,
    }),
    [filters],
  );

  const dashboardQuery = useBiBestPracticesCycleDashboard(dashboardFilters);
  const responsesQuery = useBiBestPracticesCycleResponses({
    ...dashboardFilters,
    page,
    pageSize: 25,
  });
  const importsQuery = useBiBestPracticesCycleImports({ page: 1, pageSize: 8 });

  const importMutation = useImportBiBestPracticesCycle();
  const previewImportMutation = usePreviewImportBiBestPracticesCycle();
  const deleteResponsesMutation = useDeleteBiBestPracticesCycleResponses();
  const exportPdfMutation = useExportBiDashboardPdf(
    "/bi/best-practices-cycle/dashboard/pdf",
    "bi-ciclo-boas-praticas",
  );
  const exportNotebookMutation = useExportBiExecutiveNotebookPdf();
  const updateCardSettingMutation = useUpdateBiBestPracticesCycleCardSetting();

  const dashboard = dashboardQuery.data as
    | BestPracticesCycleDashboardResponse
    | undefined;
  const responses = responsesQuery.data as
    | PagedResponse<BestPracticesCycleResponseRow>
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

  const cardSettingsMap = useMemo(() => {
    const map = new Map<CardId, EditableCardText>();
    for (const item of dashboard?.cardSettings ?? []) {
      const cardId = String(item?.cardId ?? "").trim();
      if (!isCardId(cardId)) continue;
      map.set(cardId, {
        title: String(item?.title ?? "").trim() || CARD_DEFAULTS[cardId].title,
        description:
          typeof item?.description === "string"
            ? item.description
            : CARD_DEFAULTS[cardId].description,
      });
    }
    return map;
  }, [dashboard?.cardSettings]);

  const getCardText = (cardId: CardId): EditableCardText => {
    return cardSettingsMap.get(cardId) ?? CARD_DEFAULTS[cardId];
  };

  const openCardEditor = (cardId: CardId) => {
    setEditingCardId(cardId);
    setEditingCardDraft({ ...getCardText(cardId) });
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

  const resetFilters = () => {
    setPage(1);
    setSelectedIds([]);
    setFilters({
      from: "",
      to: "",
      technicalRigorPerception: "",
      preparednessToLeadMixedClass: "",
      genderBiasImpact: "",
      interactionDifference: "",
      supportNeedRecognition: "",
      mainChallengeOption: "",
      identification: "",
      specialty: "",
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
      const result = await previewImportMutation.mutateAsync({
        file,
        replace: replaceOnImport,
      });
      const preview = (result?.normalization ??
        null) as BiImportNormalizationPreview | null;
      if (!preview) {
        throw new Error("A prévia de normalização não foi retornada.");
      }
      setImportPreview(preview);
      setSelectedNormalizationIds(
        (preview.suggestions ?? []).map((item) => item.id),
      );
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Falha ao importar arquivo.",
        severity: "error",
      });
    }
  };

  const closeImportPreview = () => {
    setImportPreview(null);
    setSelectedNormalizationIds([]);
  };

  const confirmImport = async (applyNormalization: boolean) => {
    if (!file) {
      closeImportPreview();
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        file,
        replace: replaceOnImport,
        normalizationPlan: applyNormalization
          ? {
              decisions: selectedNormalizationIds.map((id) => ({
                id,
                apply: true,
              })),
            }
          : { decisions: [] },
      });
      setFile(null);
      closeImportPreview();
      toast.push({
        message:
          `Importação concluída. Inseridos: ${result?.batch?.insertedRows ?? 0}. ` +
          `Duplicados: ${result?.batch?.duplicateRows ?? 0}. ` +
          `Inválidos: ${result?.batch?.invalidRows ?? 0}. ` +
          `Campos normalizados: ${Number(result?.normalization?.updatedFields ?? 0)}.`,
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

    const csv = buildCsv(responses.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bi-ciclo-boas-praticas-recorte.csv";
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
          ...dashboardFilters,
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
  const kpiPreparedText = getCardText("kpi-prepared");
  const kpiInteractionText = getCardText("kpi-interaction");
  const kpiSupportText = getCardText("kpi-support");
  const insightMainText = getCardText("insight-main");
  const trendText = getCardText("chart-trend-q2");
  const listQ5Text = getCardText("list-q5");
  const listSpecialtyText = getCardText("list-specialty");

  const trendOptions = dashboard.charts.preparednessTrendByDay.options ?? [];
  const trendItems = dashboard.charts.preparednessTrendByDay.items ?? [];

  const distributionCards: Array<{
    cardId: CardId;
    data: DistributionDatum[];
    color: string;
    longLabels?: boolean;
  }> = [
    {
      cardId: "chart-q1",
      data: dashboard.charts.technicalRigorDistribution,
      color: CHART_COLORS[0],
    },
    {
      cardId: "chart-q2",
      data: dashboard.charts.preparednessDistribution,
      color: CHART_COLORS[1],
    },
    {
      cardId: "chart-q3",
      data: dashboard.charts.genderBiasDistribution,
      color: CHART_COLORS[2],
    },
    {
      cardId: "chart-q4",
      data: dashboard.charts.interactionDifferenceDistribution,
      color: CHART_COLORS[3],
    },
    {
      cardId: "chart-q6",
      data: dashboard.charts.supportNeedDistribution,
      color: CHART_COLORS[4],
    },
    {
      cardId: "chart-q7",
      data: dashboard.charts.mainChallengeDistribution,
      color: CHART_COLORS[5],
      longLabels: true,
    },
  ];

  return (
    <Box
      sx={{
        color: BPC_PALETTE.text,
        background: `radial-gradient(1100px 420px at -8% -18%, ${alpha(
          BPC_PALETTE.primary,
          0.18,
        )} 0%, transparent 62%), radial-gradient(980px 360px at 108% -12%, ${alpha(
          BPC_PALETTE.accentSoft,
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
          <Typography variant="body2" sx={{ color: BPC_PALETTE.muted }}>
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
              borderColor: alpha(BPC_PALETTE.primary, 0.5),
              color: BPC_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: BPC_PALETTE.primary,
                bgcolor: alpha(BPC_PALETTE.primary, 0.06),
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
              borderColor: alpha(BPC_PALETTE.primary, 0.5),
              color: BPC_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: BPC_PALETTE.primary,
                bgcolor: alpha(BPC_PALETTE.primary, 0.06),
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
              borderColor: alpha(BPC_PALETTE.primary, 0.5),
              color: BPC_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: BPC_PALETTE.primary,
                bgcolor: alpha(BPC_PALETTE.primary, 0.06),
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
        description="Template, importação da pesquisa e status da base ficam concentrados aqui."
        icon={<UploadFileRoundedIcon fontSize="small" />}
        accentColor={BPC_PALETTE.primary}
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
              borderColor: alpha(BPC_PALETTE.primary, 0.28),
              color: BPC_PALETTE.primary,
              bgcolor: alpha(BPC_PALETTE.primary, 0.04),
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
            href="/templates/bi-best-practices-cycle-template.csv"
            download
            sx={{
              height: 40,
              px: 1.6,
              whiteSpace: "nowrap",
              borderColor: alpha(BPC_PALETTE.primary, 0.5),
              color: BPC_PALETTE.primary,
              "& .MuiButton-startIcon > *": { fontSize: 18 },
              "&:hover": {
                borderColor: BPC_PALETTE.primary,
                bgcolor: alpha(BPC_PALETTE.primary, 0.06),
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
              borderColor: alpha(BPC_PALETTE.primary, 0.5),
              color: BPC_PALETTE.primary,
              "&:hover": {
                borderColor: BPC_PALETTE.primary,
                bgcolor: alpha(BPC_PALETTE.primary, 0.06),
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
            disabled={
              !canUpload ||
              importMutation.isPending ||
              previewImportMutation.isPending
            }
            sx={{
              height: 40,
              px: 2,
              whiteSpace: "nowrap",
              flexShrink: 0,
              bgcolor: BPC_PALETTE.primary,
              "&:hover": { bgcolor: BPC_PALETTE.primaryDark },
            }}
          >
            {previewImportMutation.isPending
              ? "Analisando..."
              : importMutation.isPending
                ? "Importando..."
                : "Importar"}
          </Button>
          <Box sx={{ ml: { lg: "auto" } }}>
            <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
              Última importação
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {dashboard.latestImport?.fileName ?? "Nenhuma"}
            </Typography>
          </Box>
        </Stack>
      </BiCollapsibleSection>

      <BiSurveyQuestionsPanel
        questions={BI_BEST_PRACTICES_CYCLE_QUESTIONS}
        accentColor={BPC_PALETTE.primary}
        sx={{ mb: 2, ...cardSx }}
      />

      <BiCollapsibleSection
        title="Filtros do painel"
        description="Os recortes do questionário ficam recolhidos por padrão para deixar a leitura dos indicadores mais limpa."
        icon={<FilterListRoundedIcon fontSize="small" />}
        accentColor={BPC_PALETTE.primary}
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
              borderColor: alpha(BPC_PALETTE.primary, 0.28),
              color: BPC_PALETTE.primary,
              bgcolor: alpha(BPC_PALETTE.primary, 0.04),
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
              borderColor: alpha(BPC_PALETTE.primary, 0.35),
              color: BPC_PALETTE.primary,
            }}
          >
            Limpar filtros
          </Button>
        }
        sx={{ mb: 2, ...cardSx }}
      >
        <Box
          display="grid"
          gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }}
          gap={1.2}
          pt={1.2}
        >
          <TextField
            select
            size="small"
            label="Visualização"
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
            label="Combinação"
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
            label="Até"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.to}
            onChange={(event) => updateFilter("to", event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Q2 - Preparo"
            value={filters.preparednessToLeadMixedClass}
            onChange={(event) =>
              updateFilter("preparednessToLeadMixedClass", event.target.value)
            }
          >
            <MenuItem value="">Todos</MenuItem>
            {(dashboard.filters.preparednessToLeadMixedClass ?? []).map(
              (item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ),
            )}
          </TextField>
          <TextField
            select
            size="small"
            label="Q4 - Diferença"
            value={filters.interactionDifference}
            onChange={(event) =>
              updateFilter("interactionDifference", event.target.value)
            }
          >
            <MenuItem value="">Todos</MenuItem>
            {(dashboard.filters.interactionDifference ?? []).map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Q6 - Apoio"
            value={filters.supportNeedRecognition}
            onChange={(event) =>
              updateFilter("supportNeedRecognition", event.target.value)
            }
          >
            <MenuItem value="">Todos</MenuItem>
            {(dashboard.filters.supportNeedRecognition ?? []).map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Q7 - Desafio"
            value={filters.mainChallengeOption}
            onChange={(event) =>
              updateFilter("mainChallengeOption", event.target.value)
            }
          >
            <MenuItem value="">Todos</MenuItem>
            {(dashboard.filters.mainChallengeOptions ?? []).map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Identificação"
            value={filters.identification}
            onChange={(event) =>
              updateFilter("identification", event.target.value)
            }
          >
            <MenuItem value="">Todas</MenuItem>
            {(dashboard.filters.identification ?? []).map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Especialidade"
            value={filters.specialty}
            onChange={(event) => updateFilter("specialty", event.target.value)}
          >
            <MenuItem value="">Todas</MenuItem>
            {(dashboard.filters.specialty ?? []).map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Busca"
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Pesquisar em textos e categorias"
          />
        </Box>
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
                <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
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
                sx={{ color: BPC_PALETTE.primary }}
              >
                {dashboard.kpis.totalResponses}
              </Typography>
              <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
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
                <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                  {kpiPreparedText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-prepared")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: BPC_PALETTE.secondary }}
              >
                {toPercent(dashboard.kpis.preparedPositiveRatePercent)}
              </Typography>
              <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                {kpiPreparedText.description}
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
                <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                  {kpiInteractionText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-interaction")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: BPC_PALETTE.accent }}
              >
                {toPercent(dashboard.kpis.interactionYesRatePercent)}
              </Typography>
              <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                {kpiInteractionText.description}
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
                <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                  {kpiSupportText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("kpi-support")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: BPC_PALETTE.warning }}
              >
                {toPercent(dashboard.kpis.supportFrequentRatePercent)}
              </Typography>
              <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                {kpiSupportText.description}
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
          <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
            {insightMainText.description}
          </Typography>
          <Grid container spacing={1.2} sx={{ mt: 0.2 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="info" sx={{ mt: 1 }}>
                <strong>Desafio mais recorrente:</strong>{" "}
                {dashboard.insights.topChallenge
                  ? `${dashboard.insights.topChallenge.label} (${dashboard.insights.topChallenge.count} menções | ${toPercent(
                      dashboard.insights.topChallenge.percent,
                    )})`
                  : "Sem dados"}
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="warning" sx={{ mt: 1 }}>
                <strong>
                  {dashboard.insights.preparednessAttentionPoint.title}:
                </strong>{" "}
                {dashboard.insights.preparednessAttentionPoint.affectedCount}{" "}
                respostas (
                {toPercent(
                  dashboard.insights.preparednessAttentionPoint
                    .affectedRatePercent,
                )}
                )
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Alert severity="success" sx={{ mt: 1 }}>
                <strong>Especialidade mais frequente:</strong>{" "}
                {dashboard.insights.mostFrequentSpecialty
                  ? `${dashboard.insights.mostFrequentSpecialty.text} (${dashboard.insights.mostFrequentSpecialty.count} | ${toPercent(
                      dashboard.insights.mostFrequentSpecialty.percent,
                    )})`
                  : "Sem dados"}
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
        {distributionCards.map((item) => (
          <Grid key={item.cardId} size={{ xs: 12, md: 6 }}>
            <DistributionCard
              cardId={item.cardId}
              data={item.data}
              mode={metricMode}
              color={item.color}
              longLabels={item.longLabels}
              getCardText={getCardText}
              onEdit={openCardEditor}
              editable={isTiProfile}
            />
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 1.2, ...cardSx }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={0.5}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {trendText.title}
            </Typography>
            {isTiProfile ? (
              <MuiTooltip title="Editar título/descrição">
                <IconButton
                  size="small"
                  onClick={() => openCardEditor("chart-trend-q2")}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
            {trendText.description}
          </Typography>

          {trendItems.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Sem dados para evolução diária.
            </Alert>
          ) : (
            <Box sx={{ mt: 1.1 }}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={trendItems} barCategoryGap="30%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartGridStroke}
                  />
                  <XAxis
                    dataKey="dayLabel"
                    stroke={chartAxisStroke}
                    tick={axisTickStyle}
                  />
                  <YAxis
                    stroke={chartAxisStroke}
                    tick={axisTickStyle}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string, payload: any) => {
                      const option = String(name ?? "");
                      const count = Number(
                        payload?.payload?.[`${option}__count`] ?? 0,
                      );
                      return [
                        `${Number(value ?? 0).toFixed(2)}%`,
                        `${option} • ${count} resp.`,
                      ];
                    }}
                    labelFormatter={(label, payload) => {
                      const total = Number(payload?.[0]?.payload?.total ?? 0);
                      return `${label} (n=${total})`;
                    }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend wrapperStyle={legendWrapperStyle} />
                  {trendOptions.map((option, index) => (
                    <Bar
                      key={option}
                      dataKey={`${option}__percent`}
                      name={option}
                      stackId="preparedness"
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      radius={
                        index === trendOptions.length - 1
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={0.5}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {listQ5Text.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("list-q5")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                {listQ5Text.description}
              </Typography>

              {(dashboard.textColumns.interactionDifferenceComment.items ?? [])
                .length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Sem relatos textuais no recorte atual.
                </Alert>
              ) : (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {(
                    dashboard.textColumns.interactionDifferenceComment.items ??
                    []
                  ).map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: `1px solid ${alpha(BPC_PALETTE.primary, 0.15)}`,
                        bgcolor: "#FFF",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.8}
                        flexWrap="wrap"
                        sx={{ mb: 0.5 }}
                      >
                        <Chip
                          size="small"
                          label={formatDate(item.submittedAt)}
                        />
                        {item.identification ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={item.identification}
                          />
                        ) : null}
                        {item.specialty ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={item.specialty}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="body2">{item.text}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={0.5}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {listSpecialtyText.title}
                </Typography>
                {isTiProfile ? (
                  <MuiTooltip title="Editar título/descrição">
                    <IconButton
                      size="small"
                      onClick={() => openCardEditor("list-specialty")}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                ) : null}
              </Stack>
              <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                {listSpecialtyText.description}
              </Typography>

              <Typography
                variant="caption"
                sx={{ color: BPC_PALETTE.muted, display: "block", mt: 1 }}
              >
                {dashboard.textColumns.specialtyFreeText.totalResponses}{" "}
                respostas preenchidas •{" "}
                {dashboard.textColumns.specialtyFreeText.totalUnique}{" "}
                especialidades distintas
              </Typography>

              {(dashboard.textColumns.specialtyFreeText.items ?? []).length ===
              0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Sem especialidades para o recorte atual.
                </Alert>
              ) : (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>
                        Especialidade
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        Qtd
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        %
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboard.textColumns.specialtyFreeText.items.map(
                      (item) => (
                        <TableRow key={item.text}>
                          <TableCell>{item.text}</TableCell>
                          <TableCell align="right">{item.count}</TableCell>
                          <TableCell align="right">
                            {toPercent(item.percent)}
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={cardSx}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
            gap={1}
          >
            <Stack direction="row" alignItems="center" spacing={0.8}>
              <Typography variant="subtitle1" fontWeight={700}>
                Registros da pesquisa
              </Typography>
              <MuiTooltip
                title={
                  responsesExpanded ? "Recolher tabela" : "Expandir tabela"
                }
              >
                <IconButton
                  size="small"
                  onClick={() => setResponsesExpanded((prev) => !prev)}
                >
                  {responsesExpanded ? (
                    <KeyboardArrowUpRoundedIcon fontSize="small" />
                  ) : (
                    <KeyboardArrowDownRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              </MuiTooltip>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={!canDelete || selectedIds.length === 0}
                onClick={() => setDeleteConfirmMode("SELECTED")}
              >
                Excluir selecionados
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={!canDelete}
                onClick={() => setDeleteConfirmMode("FILTERED")}
              >
                Excluir filtrados
              </Button>
            </Stack>
          </Stack>

          <Collapse in={responsesExpanded}>
            <Box sx={{ mt: 1, overflowX: "auto" }}>
              {responsesQuery.isFetching ? (
                <LinearProgress sx={{ mb: 1 }} />
              ) : null}

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
                    <TableCell>Data</TableCell>
                    <TableCell>Q2</TableCell>
                    <TableCell>Q4</TableCell>
                    <TableCell>Q6</TableCell>
                    <TableCell>Q7</TableCell>
                    <TableCell>Identificação</TableCell>
                    <TableCell>Especialidade</TableCell>
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
                      <TableCell>{formatDate(item.submittedAt)}</TableCell>
                      <TableCell>
                        {item.preparednessToLeadMixedClass ?? "-"}
                      </TableCell>
                      <TableCell>{item.interactionDifference ?? "-"}</TableCell>
                      <TableCell>
                        {item.supportNeedRecognition ?? "-"}
                      </TableCell>
                      <TableCell>
                        {(item.mainChallengeOptions ?? []).join("; ") || "-"}
                      </TableCell>
                      <TableCell>{item.identification ?? "-"}</TableCell>
                      <TableCell>{item.specialty ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {(responses?.items?.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Alert severity="info">
                          Sem registros para os filtros aplicados.
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ sm: "center" }}
                sx={{ mt: 1 }}
              >
                <Typography variant="caption" sx={{ color: BPC_PALETTE.muted }}>
                  Página {responses?.page ?? 1} de {totalPages} • Total:{" "}
                  {responses?.total ?? 0}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={(responses?.page ?? 1) <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={(responses?.page ?? 1) >= totalPages}
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  >
                    Próxima
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteConfirmMode)}
        title="Confirmar exclusão"
        message={
          deleteConfirmMode === "SELECTED"
            ? `Excluir ${selectedIds.length} registro(s) selecionado(s)?`
            : "Excluir todos os registros do recorte filtrado?"
        }
        highlightText={
          deleteConfirmMode === "SELECTED"
            ? `${selectedIds.length} registro(s) selecionado(s)`
            : `${responses?.total ?? 0} registro(s) no recorte atual`
        }
        confirmLabel="Excluir"
        severity="error"
        confirmLoading={deleteResponsesMutation.isPending}
        disableConfirm={
          deleteConfirmMode === "SELECTED" && selectedIds.length === 0
        }
        onCancel={() => setDeleteConfirmMode(null)}
        onConfirm={handleConfirmDelete}
      />

      <Dialog
        open={Boolean(editingCardId)}
        onClose={() => setEditingCardId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar card</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2} sx={{ mt: 0.4 }}>
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCardId(null)}>Cancelar</Button>
          <Button
            onClick={saveCardEditor}
            variant="contained"
            disabled={updateCardSettingMutation.isPending}
          >
            {updateCardSettingMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      <BiExecutiveNotebookDialog
        open={notebookDialogOpen}
        onClose={() => setNotebookDialogOpen(false)}
        onSubmit={handleExportNotebookPdf}
        isPending={exportNotebookMutation.isPending}
        accentColor={BPC_PALETTE.primary}
        currentPanelKey="best-practices-cycle"
        currentPanelFilters={dashboardFilters}
      />

      <BiImportNormalizationReviewDialog
        open={Boolean(importPreview)}
        title="Revisar normalização antes da importação"
        preview={importPreview}
        selectedIds={selectedNormalizationIds}
        onToggle={(id, checked) =>
          setSelectedNormalizationIds((prev) =>
            checked
              ? [...new Set([...prev, id])]
              : prev.filter((item) => item !== id),
          )
        }
        onClose={closeImportPreview}
        onConfirm={() => void confirmImport(true)}
        onImportWithoutNormalization={() => void confirmImport(false)}
        confirmLoading={importMutation.isPending}
      />

      <Card sx={{ mt: 1.2, ...cardSx }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ color: BPC_PALETTE.muted }}>
            Histórico de importações
          </Typography>
          {importsQuery.isFetching ? <LinearProgress sx={{ my: 1 }} /> : null}
          <Table size="small" sx={{ mt: 0.8 }}>
            <TableHead>
              <TableRow>
                <TableCell>Arquivo</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Inseridos</TableCell>
                <TableCell align="right">Duplicados</TableCell>
                <TableCell align="right">Inválidos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(imports?.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.fileName}</TableCell>
                  <TableCell>{formatDate(item.importedAt)}</TableCell>
                  <TableCell align="right">{item.insertedRows}</TableCell>
                  <TableCell align="right">{item.duplicateRows}</TableCell>
                  <TableCell align="right">{item.invalidRows}</TableCell>
                </TableRow>
              ))}
              {(imports?.items?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Alert severity="info">Sem importações registradas.</Alert>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
