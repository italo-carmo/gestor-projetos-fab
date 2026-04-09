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
  FormControlLabel,
  Grid,
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
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
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
  useBiRecruitsDashboard,
  useBiRecruitsImports,
  useBiRecruitsResponses,
  useDeleteBiRecruitsResponses,
  useImportBiRecruits,
  useMe,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type MetricMode = "PERCENT" | "COUNT";
type CombineMode = "AND" | "OR";
type DeleteConfirmMode = "SELECTED" | "FILTERED";

type DistributionDatum = {
  label: string;
  count: number;
  percent: number;
  [key: string]: string | number;
};

type RecruitsDashboardResponse = {
  kpis: {
    totalResponses: number;
    totalRowsInDb: number;
    secureGuidanceCount: number;
    secureGuidanceRatePercent: number;
    secureReportCount: number;
    secureReportRatePercent: number;
    knowOrientationYesCount: number;
    knowOrientationYesRatePercent: number;
    knowReportYesCount: number;
    knowReportYesRatePercent: number;
  };
  filters: {
    education: string[];
    gender: string[];
    identifyHarassment: string[];
    conductLimits: string[];
    knowOrientation: string[];
    knowReportProcess: string[];
    willingnessOrientation: string[];
    willingnessReport: string[];
    enlistmentDecisionInfluence: string[];
  };
  charts: {
    educationDistribution: DistributionDatum[];
    genderDistribution: DistributionDatum[];
    identifyHarassmentDistribution: DistributionDatum[];
    conductLimitsDistribution: DistributionDatum[];
    knowOrientationDistribution: DistributionDatum[];
    knowReportProcessDistribution: DistributionDatum[];
    willingnessOrientationDistribution: DistributionDatum[];
    willingnessReportDistribution: DistributionDatum[];
    enlistmentDecisionInfluenceDistribution: DistributionDatum[];
    responseTrend: Array<{
      day: string;
      dayLabel: string;
      total: number;
      positiveCount: number;
      positiveRatePercent: number;
    }>;
  };
  textColumns: {
    suggestionComment: {
      total: number;
      displayed: number;
      items: Array<{
        id: string;
        submittedAt: string | null;
        education: string | null;
        gender: string | null;
        text: string;
      }>;
    };
  };
  insights: {
    topEducation: {
      label: string;
      count: number;
      percent: number;
    } | null;
    topDecisionDriver: {
      label: string;
      count: number;
      percent: number;
    } | null;
    weakestPoint: {
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
};

type RecruitsResponseRow = {
  id: string;
  submittedAt?: string | null;
  education?: string | null;
  gender?: string | null;
  identifyHarassment?: string | null;
  conductLimits?: string | null;
  knowOrientation?: string | null;
  knowReportProcess?: string | null;
  willingnessOrientation?: string | null;
  willingnessReport?: string | null;
  enlistmentDecisionInfluenceText?: string | null;
  suggestionComment?: string | null;
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type DistributionCardProps = {
  title: string;
  subtitle: string;
  data: DistributionDatum[];
  mode: MetricMode;
  color: string;
  longLabels?: boolean;
};

const RC_PALETTE = {
  primary: "#0A4D68",
  primaryDark: "#083D53",
  secondary: "#0F9D8E",
  accent: "#F08A24",
  accentSoft: "#F3AE63",
  text: "#182A37",
  muted: "#5E7686",
  neutral: "#CAD5DF",
  danger: "#C44536",
};

const CHART_COLORS = [
  RC_PALETTE.primary,
  RC_PALETTE.secondary,
  RC_PALETTE.accent,
  "#4D7CFE",
  "#2196A3",
  "#F7A35C",
  "#6FA16C",
  "#7E57C2",
  "#AA6D39",
  "#778899",
];

const cardSx = {
  borderRadius: 3,
  border: `1px solid ${alpha(RC_PALETTE.primary, 0.12)}`,
  boxShadow: `0 12px 28px ${alpha(RC_PALETTE.primary, 0.09)}`,
  background: `linear-gradient(165deg, #FFFFFF 0%, ${alpha(RC_PALETTE.primary, 0.06)} 100%)`,
};

const axisTickStyle = {
  fill: RC_PALETTE.muted,
  fontSize: 12,
};

const chartGridStroke = alpha(RC_PALETTE.primary, 0.13);
const chartAxisStroke = alpha(RC_PALETTE.primary, 0.24);
const tooltipContentStyle = {
  borderRadius: 10,
  border: `1px solid ${alpha(RC_PALETTE.primary, 0.2)}`,
  boxShadow: `0 10px 24px ${alpha(RC_PALETTE.primary, 0.16)}`,
  background: "#FFFFFF",
};
const tooltipLabelStyle = { color: RC_PALETTE.text, fontWeight: 700 };

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

function buildCsv(items: RecruitsResponseRow[]) {
  const header = [
    "Data",
    "Escolaridade",
    "Gênero",
    "Identifica assédio",
    "Compreende limites",
    "Sabe a quem recorrer",
    "Sabe registrar formalmente",
    "Disposição para orientação",
    "Disposição para registrar",
    "Influência para ingresso",
    "Sugestão/Comentário",
  ];

  const rows = items.map((item) => [
    formatDate(item.submittedAt),
    item.education ?? "",
    item.gender ?? "",
    item.identifyHarassment ?? "",
    item.conductLimits ?? "",
    item.knowOrientation ?? "",
    item.knowReportProcess ?? "",
    item.willingnessOrientation ?? "",
    item.willingnessReport ?? "",
    item.enlistmentDecisionInfluenceText ?? "",
    item.suggestionComment ?? "",
  ]);

  return [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function DistributionCard({
  title,
  subtitle,
  data,
  mode,
  color,
  longLabels = false,
}: DistributionCardProps) {
  const chartData = data.slice(0, 12).map((item) => ({
    ...item,
    metric: metricValue(mode, item.count, item.percent),
  }));

  const longestLabelLength = chartData.reduce(
    (max, item) => Math.max(max, String(item.label ?? "").length),
    0,
  );
  const useLongLabelLayout = longLabels || longestLabelLength >= 34;
  const rowHeight = useLongLabelLayout ? 34 : 24;
  const height = Math.max(useLongLabelLayout ? 228 : 164, chartData.length * rowHeight);
  const yAxisWidth = useLongLabelLayout ? 236 : 168;
  const yAxisTickStyle = useLongLabelLayout
    ? { ...axisTickStyle, fontSize: 11 }
    : axisTickStyle;
  const metricLabel = mode === "COUNT" ? "Quantidade" : "Percentual (%)";

  return (
    <Card sx={cardSx}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
          {subtitle}
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
                <XAxis type="number" stroke={chartAxisStroke} tick={axisTickStyle} />
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
                      key={`${title}-${item.label}`}
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

export function BiRecruitsDashboardPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const [metricMode, setMetricMode] = useState<MetricMode>("PERCENT");
  const [responsesExpanded, setResponsesExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replaceOnImport, setReplaceOnImport] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] =
    useState<DeleteConfirmMode | null>(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    education: "",
    gender: "",
    identifyHarassment: "",
    conductLimits: "",
    knowOrientation: "",
    knowReportProcess: "",
    willingnessOrientation: "",
    willingnessReport: "",
    enlistmentDecisionInfluence: "",
    q: "",
    combineMode: "AND" as CombineMode,
  });

  const dashboardFilters = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
      education: filters.education || undefined,
      gender: filters.gender || undefined,
      identifyHarassment: filters.identifyHarassment || undefined,
      conductLimits: filters.conductLimits || undefined,
      knowOrientation: filters.knowOrientation || undefined,
      knowReportProcess: filters.knowReportProcess || undefined,
      willingnessOrientation: filters.willingnessOrientation || undefined,
      willingnessReport: filters.willingnessReport || undefined,
      enlistmentDecisionInfluence:
        filters.enlistmentDecisionInfluence || undefined,
      q: filters.q || undefined,
      combineMode: filters.combineMode || undefined,
    }),
    [filters],
  );

  const dashboardQuery = useBiRecruitsDashboard(dashboardFilters);
  const responsesQuery = useBiRecruitsResponses({
    ...dashboardFilters,
    page,
    pageSize: 25,
  });
  const importsQuery = useBiRecruitsImports({ page: 1, pageSize: 8 });
  const importMutation = useImportBiRecruits();
  const deleteResponsesMutation = useDeleteBiRecruitsResponses();

  const dashboard = dashboardQuery.data as RecruitsDashboardResponse | undefined;
  const responses = responsesQuery.data as
    | PagedResponse<RecruitsResponseRow>
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
      education: "",
      gender: "",
      identifyHarassment: "",
      conductLimits: "",
      knowOrientation: "",
      knowReportProcess: "",
      willingnessOrientation: "",
      willingnessReport: "",
      enlistmentDecisionInfluence: "",
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
    a.download = "bi-recrutas-recorte.csv";
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
        Não foi possível carregar o BI de Recrutas.
      </Alert>
    );
  }

  const distributionCards: Array<Omit<DistributionCardProps, "mode">> = [
    {
      title: "Escolaridade",
      subtitle: "Perfil acadêmico da amostra.",
      data: dashboard.charts.educationDistribution,
      color: CHART_COLORS[0],
    },
    {
      title: "Gênero",
      subtitle: "Distribuição de gênero dos respondentes.",
      data: dashboard.charts.genderDistribution,
      color: CHART_COLORS[1],
    },
    {
      title: "Identificação de assédio",
      subtitle: "Questão 1.1 - capacidade de identificar situações.",
      data: dashboard.charts.identifyHarassmentDistribution,
      color: CHART_COLORS[2],
    },
    {
      title: "Compreensão dos limites",
      subtitle: "Questão 1.2 - clareza sobre limites de conduta.",
      data: dashboard.charts.conductLimitsDistribution,
      color: CHART_COLORS[3],
    },
    {
      title: "Sabe a quem recorrer",
      subtitle: "Questão 2.1 - orientação institucional.",
      data: dashboard.charts.knowOrientationDistribution,
      color: CHART_COLORS[4],
    },
    {
      title: "Sabe registrar formalmente",
      subtitle: "Questão 2.2 - conhecimento do processo de registro.",
      data: dashboard.charts.knowReportProcessDistribution,
      color: CHART_COLORS[5],
    },
    {
      title: "Disposição para orientação",
      subtitle: "Questão 3.1 - segurança para buscar orientação.",
      data: dashboard.charts.willingnessOrientationDistribution,
      color: CHART_COLORS[6],
    },
    {
      title: "Disposição para registrar",
      subtitle: "Questão 3.2 - segurança para registrar ocorrência.",
      data: dashboard.charts.willingnessReportDistribution,
      color: CHART_COLORS[7],
    },
    {
      title: "Fator para ingresso na FAB",
      subtitle: "Pergunta 4 - principal motivador de ingresso.",
      data: dashboard.charts.enlistmentDecisionInfluenceDistribution,
      color: CHART_COLORS[8],
      longLabels: true,
    },
  ];

  return (
    <Box
      sx={{
        color: RC_PALETTE.text,
        background: `radial-gradient(1250px 420px at -8% -18%, ${alpha(RC_PALETTE.primary, 0.2)} 0%, transparent 62%), radial-gradient(900px 320px at 108% -10%, ${alpha(RC_PALETTE.accent, 0.14)} 0%, transparent 60%)`,
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
          <Typography variant="h4" fontWeight={700}>
            Recrutas
          </Typography>
          <Typography variant="body2" sx={{ color: RC_PALETTE.muted }}>
            Painel estratégico da Pesquisa de Percepção Institucional com foco
            em leitura rápida para decisão de comando.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            component="a"
            href="/templates/bi-recruits-template.csv"
            download
            sx={{
              borderColor: alpha(RC_PALETTE.primary, 0.45),
              color: RC_PALETTE.primary,
              "&:hover": {
                borderColor: RC_PALETTE.primary,
                bgcolor: alpha(RC_PALETTE.primary, 0.08),
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
              borderColor: alpha(RC_PALETTE.primary, 0.45),
              color: RC_PALETTE.primary,
              "&:hover": {
                borderColor: RC_PALETTE.primary,
                bgcolor: alpha(RC_PALETTE.primary, 0.08),
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
              bgcolor: RC_PALETTE.primary,
              "&:hover": { bgcolor: RC_PALETTE.primaryDark },
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
                  <Typography variant="subtitle1" fontWeight={700}>
                    Ingestão de base CSV/XLSX
                  </Typography>
                  <Typography variant="body2" sx={{ color: RC_PALETTE.muted }}>
                    Atualize o BI de Recrutas com a planilha oficial e escolha
                    entre anexar ou substituir toda a base.
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
                      borderColor: alpha(RC_PALETTE.primary, 0.45),
                      color: RC_PALETTE.primary,
                      "&:hover": {
                        borderColor: RC_PALETTE.primary,
                        bgcolor: alpha(RC_PALETTE.primary, 0.08),
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
                      bgcolor: RC_PALETTE.accent,
                      "&:hover": { bgcolor: "#D0761D" },
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
                      borderColor: alpha(RC_PALETTE.primary, 0.35),
                      color: RC_PALETTE.primary,
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
                        color: RC_PALETTE.muted,
                      },
                    }}
                  />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={metricMode === "PERCENT" ? "contained" : "outlined"}
                    onClick={() => setMetricMode("PERCENT")}
                    sx={{
                      minWidth: 84,
                      ...(metricMode === "PERCENT"
                        ? {
                            bgcolor: RC_PALETTE.primary,
                            "&:hover": { bgcolor: RC_PALETTE.primaryDark },
                          }
                        : {
                            borderColor: alpha(RC_PALETTE.primary, 0.4),
                            color: RC_PALETTE.primary,
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
                            bgcolor: RC_PALETTE.primary,
                            "&:hover": { bgcolor: RC_PALETTE.primaryDark },
                          }
                        : {
                            borderColor: alpha(RC_PALETTE.primary, 0.4),
                            color: RC_PALETTE.primary,
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
                  <Typography variant="body2" sx={{ color: RC_PALETTE.muted }}>
                    Arquivo: <strong>{dashboard.latestImport.fileName}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: RC_PALETTE.muted }}>
                    Data: <strong>{formatDate(dashboard.latestImport.importedAt)}</strong>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
            Filtros analíticos
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
                label="Escolaridade"
                value={filters.education}
                onChange={(event) => updateFilter("education", event.target.value)}
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
                label="Gênero"
                value={filters.gender}
                onChange={(event) => updateFilter("gender", event.target.value)}
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.gender ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Identifica assédio"
                value={filters.identifyHarassment}
                onChange={(event) =>
                  updateFilter("identifyHarassment", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.identifyHarassment ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Compreende limites"
                value={filters.conductLimits}
                onChange={(event) =>
                  updateFilter("conductLimits", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.conductLimits ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Sabe a quem recorrer"
                value={filters.knowOrientation}
                onChange={(event) =>
                  updateFilter("knowOrientation", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.knowOrientation ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Sabe registrar"
                value={filters.knowReportProcess}
                onChange={(event) =>
                  updateFilter("knowReportProcess", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.knowReportProcess ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Disposição orientação"
                value={filters.willingnessOrientation}
                onChange={(event) =>
                  updateFilter("willingnessOrientation", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.willingnessOrientation ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Disposição registro"
                value={filters.willingnessReport}
                onChange={(event) =>
                  updateFilter("willingnessReport", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {(dashboard.filters.willingnessReport ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Influência no ingresso"
                value={filters.enlistmentDecisionInfluence}
                onChange={(event) =>
                  updateFilter("enlistmentDecisionInfluence", event.target.value)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {(dashboard.filters.enlistmentDecisionInfluence ?? []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Busca textual"
                value={filters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
                size="small"
                fullWidth
                placeholder="Buscar em comentários e respostas"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                label="Combinação"
                value={filters.combineMode}
                onChange={(event) =>
                  updateFilter("combineMode", event.target.value as CombineMode)
                }
                select
                size="small"
                fullWidth
              >
                <MenuItem value="AND">Todos os filtros (AND)</MenuItem>
                <MenuItem value="OR">Qualquer filtro (OR)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={1.2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="overline">Respostas no recorte</Typography>
              <Typography variant="h5" lineHeight={1.1}>
                {dashboard.kpis.totalResponses}
              </Typography>
              <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
                Base total: {dashboard.kpis.totalRowsInDb}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card
            sx={{
              ...cardSx,
              borderColor: alpha(RC_PALETTE.secondary, 0.28),
            }}
          >
            <CardContent>
              <Typography variant="overline">Segurança para orientação</Typography>
              <Typography variant="h5" lineHeight={1.1}>
                {dashboard.kpis.secureGuidanceRatePercent.toFixed(1)}%
              </Typography>
              <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
                Seguro(a): {dashboard.kpis.secureGuidanceCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card
            sx={{
              ...cardSx,
              borderColor: alpha(RC_PALETTE.accent, 0.28),
            }}
          >
            <CardContent>
              <Typography variant="overline">Segurança para registro</Typography>
              <Typography variant="h5" lineHeight={1.1}>
                {dashboard.kpis.secureReportRatePercent.toFixed(1)}%
              </Typography>
              <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
                Seguro(a): {dashboard.kpis.secureReportCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card
            sx={{
              ...cardSx,
              borderColor: alpha(RC_PALETTE.danger, 0.24),
            }}
          >
            <CardContent>
              <Typography variant="overline">Ponto de atenção</Typography>
              <Typography variant="body2" sx={{ mt: 0.6 }}>
                <strong>{dashboard.insights.weakestPoint.title}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
                {dashboard.insights.weakestPoint.affectedCount} respostas ({" "}
                {dashboard.insights.weakestPoint.affectedRatePercent.toFixed(1)}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>
            Evolução das respostas
          </Typography>
          <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
            Cada barra representa o percentual diário de respostas positivas
            (disposição "Seguro(a)" para registrar ocorrência).
          </Typography>

          {(dashboard.charts.responseTrend ?? []).length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Sem dados de tendência para o recorte atual.
            </Alert>
          ) : (
            <Box sx={{ mt: 1.1 }}>
              <ResponsiveContainer width="100%" height={228}>
                <BarChart data={dashboard.charts.responseTrend} barCategoryGap="42%">
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
                        toPercent(Number(value ?? 0)),
                        `Positivas (${Number(payload?.positiveCount ?? 0)}/${Number(payload?.total ?? 0)})`,
                      ];
                    }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Bar
                    dataKey="positiveRatePercent"
                    name="Positivas (%)"
                    fill={alpha(RC_PALETTE.primary, 0.62)}
                    radius={[8, 8, 0, 0]}
                    barSize={8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {distributionCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, lg: 6 }}>
            <DistributionCard {...card} mode={metricMode} />
          </Grid>
        ))}
      </Grid>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>
            Insight Executivo
          </Typography>
          <Typography variant="body2" sx={{ color: RC_PALETTE.muted, mt: 0.5 }}>
            Escolaridade dominante: <strong>{dashboard.insights.topEducation?.label ?? "-"}</strong>
            {dashboard.insights.topEducation
              ? ` (${dashboard.insights.topEducation.count} respostas | ${dashboard.insights.topEducation.percent.toFixed(1)}%)`
              : ""}
          </Typography>
          <Typography variant="body2" sx={{ color: RC_PALETTE.muted, mt: 0.35 }}>
            Principal motivador de ingresso: <strong>{dashboard.insights.topDecisionDriver?.label ?? "-"}</strong>
            {dashboard.insights.topDecisionDriver
              ? ` (${dashboard.insights.topDecisionDriver.count} respostas | ${dashboard.insights.topDecisionDriver.percent.toFixed(1)}%)`
              : ""}
          </Typography>
          <Typography variant="body2" sx={{ color: RC_PALETTE.muted, mt: 0.35 }}>
            Conhece a quem recorrer: <strong>{dashboard.kpis.knowOrientationYesRatePercent.toFixed(1)}%</strong> | Conhece processo de registro: <strong>{dashboard.kpis.knowReportYesRatePercent.toFixed(1)}%</strong>
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>
            Sugestões e Comentários (texto livre)
          </Typography>
          <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
            Coluna aberta apresentada em lista para leitura qualitativa. Exibindo{" "}
            {dashboard.textColumns.suggestionComment.displayed} de{" "}
            {dashboard.textColumns.suggestionComment.total} registros.
          </Typography>

          {(dashboard.textColumns.suggestionComment.items ?? []).length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Sem comentários livres para o recorte atual.
            </Alert>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.2, maxHeight: 360, overflow: "auto", pr: 0.5 }}>
              {dashboard.textColumns.suggestionComment.items.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.1,
                    borderRadius: 2,
                    border: `1px solid ${alpha(RC_PALETTE.primary, 0.14)}`,
                    bgcolor: alpha(RC_PALETTE.primary, 0.03),
                  }}
                >
                  <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" sx={{ mb: 0.6 }}>
                    <Chip size="small" label={formatDate(item.submittedAt)} />
                    <Chip size="small" variant="outlined" label={`Escolaridade: ${item.education ?? "-"}`} />
                    <Chip size="small" variant="outlined" label={`Gênero: ${item.gender ?? "-"}`} />
                  </Stack>
                  <Typography variant="body2">{item.text}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
            gap={1}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Respostas ({responses?.total ?? 0})
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                endIcon={
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
              {canDelete ? (
                <>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    disabled={selectedIds.length === 0}
                    onClick={() => setDeleteConfirmMode("SELECTED")}
                  >
                    Excluir selecionados
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    disabled={(responses?.total ?? 0) === 0}
                    onClick={() => setDeleteConfirmMode("FILTERED")}
                  >
                    Excluir recorte
                  </Button>
                </>
              ) : null}
            </Stack>
          </Stack>

          <Collapse in={responsesExpanded}>
            <Box sx={{ mt: 1.2 }}>
              {responsesQuery.isFetching ? <LinearProgress sx={{ mb: 1 }} /> : null}

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
                    <TableCell>Escolaridade</TableCell>
                    <TableCell>Gênero</TableCell>
                    <TableCell>Q1.1</TableCell>
                    <TableCell>Q2.2</TableCell>
                    <TableCell>Q3.2</TableCell>
                    <TableCell>Influência</TableCell>
                    <TableCell>Comentário</TableCell>
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
                      <TableCell>{item.education ?? "-"}</TableCell>
                      <TableCell>{item.gender ?? "-"}</TableCell>
                      <TableCell>{item.identifyHarassment ?? "-"}</TableCell>
                      <TableCell>{item.knowReportProcess ?? "-"}</TableCell>
                      <TableCell>{item.willingnessReport ?? "-"}</TableCell>
                      <TableCell>{item.enlistmentDecisionInfluenceText ?? "-"}</TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.suggestionComment ?? "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {(responses?.items.length ?? 0) === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Nenhuma resposta encontrada para os filtros aplicados.
                </Alert>
              ) : null}

              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ md: "center" }}
                gap={1}
                mt={1}
              >
                <Typography variant="caption" sx={{ color: RC_PALETTE.muted }}>
                  Página {responses?.page ?? page} de {totalPages} | Total: {responses?.total ?? 0}
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
          </Collapse>
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Histórico de importações
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Arquivo</TableCell>
                <TableCell>Inseridos</TableCell>
                <TableCell>Duplicados</TableCell>
                <TableCell>Inválidos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(imports?.items ?? []).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{formatDate(item.importedAt)}</TableCell>
                  <TableCell>{item.fileName}</TableCell>
                  <TableCell>{item.insertedRows}</TableCell>
                  <TableCell>{item.duplicateRows}</TableCell>
                  <TableCell>{item.invalidRows}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(imports?.items.length ?? 0) === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Nenhuma importação cadastrada até o momento.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirmMode !== null}
        title="Confirmar exclusão"
        message={
          deleteConfirmMode === "SELECTED"
            ? "Deseja realmente excluir os registros selecionados?"
            : "Deseja realmente excluir todos os registros do recorte filtrado atual?"
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
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmMode(null)}
      />
    </Box>
  );
}
