import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  MenuItem,
  Stack,
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
  useBiSurveyResponses,
  useImportBiSurvey,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";

type MetricMode = "PERCENT" | "COUNT";
type CombineMode = "AND" | "OR";
type DeleteConfirmMode = "SELECTED" | "FILTERED";

type DashboardFilters = {
  om: string[];
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
  };
  insights: {
    mostCommonType: { type: string; mentions: number } | null;
    riskiestOm: { om: string; simPercent: number; total: number } | null;
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

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
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

function buildCsv(items: BiResponseRow[]) {
  const header = [
    "Data",
    "OM",
    "Posto/Graduacao",
    "Posto",
    "Autodeclaracao",
    "Sofreu violencia",
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
  "Violencia Patrimonial": BI_PALETTE.warning,
  "Violencia Fisica": BI_PALETTE.orange,
  "Violencia Sexual": BI_PALETTE.violet,
  "Violencia Moral": BI_PALETTE.accentSoft,
  "Violencia Psicologica": BI_PALETTE.primary,
};

const DONUT_COLOR_BY_LABEL: Record<string, string> = {
  Nao: BI_PALETTE.primaryMid,
  Sim: BI_PALETTE.accent,
  "Nao informado": "#A5A5A5",
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

export function BiSurveyDashboardPage() {
  const toast = useToast();
  const [metricMode, setMetricMode] = useState<MetricMode>("PERCENT");
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] =
    useState<DeleteConfirmMode | null>(null);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    om: "",
    posto: "",
    postoGraduacao: "",
    autodeclara: "",
    suffered: "",
    violenceType: "",
    combineMode: "AND" as CombineMode,
  });

  const dashboardFilters = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
      om: filters.om || undefined,
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
  const importsQuery = useBiSurveyImports({ page: 1, pageSize: 6 });
  const importMutation = useImportBiSurvey();
  const deleteResponsesMutation = useDeleteBiSurveyResponses();

  const dashboard = dashboardQuery.data as BiDashboardResponse | undefined;
  const responses = responsesQuery.data as
    | PagedResponse<BiResponseRow>
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

  const totalPages = responses
    ? Math.max(1, Math.ceil(responses.total / responses.pageSize))
    : 1;

  const handleImport = async () => {
    if (!file) {
      toast.push({
        message: "Selecione um arquivo CSV ou XLSX.",
        severity: "warning",
      });
      return;
    }

    try {
      const result = await importMutation.mutateAsync({ file });
      setFile(null);
      toast.push({
        message: `Importacao em modo acumulativo concluida. Inseridos: ${result?.batch?.insertedRows ?? 0}. Duplicados: ${result?.batch?.duplicateRows ?? 0}.`,
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
      om: "",
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
            BI de Pesquisa
          </Typography>
          <Typography variant="body2" sx={{ color: BI_PALETTE.muted }}>
            Analise interativa dos dados do Google Forms com filtros, cenarios e
            drill-down.
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
            Baixar template CSV
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
              {file ? file.name : "Selecionar CSV/XLSX"}
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
                : "Importar para banco"}
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
              label="OM"
              value={filters.om}
              onChange={(event) => updateFilter("om", event.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {(dashboard.filters.om ?? []).map((item) => (
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
            <TextField
              select
              size="small"
              label="Autodeclaracao"
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
            <TextField
              select
              size="small"
              label="Sofreu violencia"
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
              label="Tipo de violencia"
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
          <CardContent>
            <Typography variant="overline">Respostas no recorte</Typography>
            <Typography variant="h4">
              {dashboard.kpis.totalResponses}
            </Typography>
            <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
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
          <CardContent>
            <Typography variant="overline">Taxa de relatos</Typography>
            <Typography variant="h4">
              {dashboard.kpis.violenceRatePercent.toFixed(1)}%
            </Typography>
            <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
              Sim: {dashboard.kpis.yesCount} | Nao: {dashboard.kpis.noCount}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            ...cardSx,
            borderColor: alpha(BI_PALETTE.primaryMid, 0.2),
          }}
        >
          <CardContent>
            <Typography variant="overline">Ocorrencias mapeadas</Typography>
            <Typography variant="h4">
              {dashboard.kpis.totalViolenceMentions}
            </Typography>
            <Typography variant="caption" sx={{ color: BI_PALETTE.muted }}>
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
          <CardContent>
            <Typography variant="overline">Insight rapido</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Tipo mais frequente:{" "}
              <strong>{dashboard.insights.mostCommonType?.type ?? "-"}</strong>
            </Typography>
            <Typography variant="body2">
              OM com maior taxa:{" "}
              <strong>{dashboard.insights.riskiestOm?.om ?? "-"}</strong>
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
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              OE/OM Percentual ({metricMode === "PERCENT" ? "%" : "Qtd"})
            </Typography>
            <Typography variant="caption" sx={chartCaptionSx}>
              Clique em uma barra para filtrar a OM.
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={dashboard.charts.omViolencePercent}
                onClick={(state: {
                  activePayload?: Array<{ payload?: OmViolenceDatum }>;
                }) => {
                  const payload = state.activePayload?.[0]?.payload;
                  if (payload?.om) {
                    updateFilter("om", payload.om);
                  }
                }}
                margin={{ top: 14, right: 16, left: 0, bottom: 0 }}
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
                  name="Nao"
                  fill={BI_PALETTE.primarySoft}
                />
                <Bar
                  dataKey={metricMode === "PERCENT" ? "simPercent" : "simCount"}
                  stackId="a"
                  name="Sim"
                  fill={BI_PALETTE.accent}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Sofreu violencia (geral)
            </Typography>
            <Typography variant="caption" sx={chartCaptionSx}>
              Clique em uma fatia para aplicar filtro de Sim/Nao.
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboard.charts.yesNoDonut}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={96}
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
                        } else if (entry.label === "Nao") {
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
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Violencia Percentual por tipo (
              {metricMode === "PERCENT" ? "%" : "Qtd"})
            </Typography>
            <Typography variant="caption" sx={chartCaptionSx}>
              Clique em um tipo para filtrar o recorte.
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={dashboard.charts.violenceTypePercent}
                onClick={(state: {
                  activePayload?: Array<{ payload?: ViolenceTypeDatum }>;
                }) => {
                  const payload = state.activePayload?.[0]?.payload;
                  if (payload?.type) {
                    updateFilter("violenceType", payload.type);
                  }
                }}
                margin={{ top: 14, right: 16, left: 0, bottom: 0 }}
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
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Violencias por OM ({metricMode === "PERCENT" ? "%" : "Qtd"})
            </Typography>
            <Typography variant="caption" sx={chartCaptionSx}>
              Equivalente ao cruzamento por OM/tipo do arquivo original.
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={typeByOm?.items ?? []}
                margin={{ top: 14, right: 16, left: 0, bottom: 0 }}
                onClick={(state: {
                  activePayload?: Array<{ payload?: ViolenceTypeByOmDatum }>;
                }) => {
                  const payload = state.activePayload?.[0]?.payload;
                  const om = payload?.om;
                  if (typeof om === "string" && om.trim()) {
                    updateFilter("om", om);
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
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Distribuicao por OM ({metricMode === "PERCENT" ? "%" : "Qtd"})
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dashboard.charts.omDistribution}>
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
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Distribuicao por Posto/Graduacao (
              {metricMode === "PERCENT" ? "%" : "Qtd"})
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={dashboard.charts.postoGraduacaoDistribution}
                  dataKey={metricMode === "PERCENT" ? "percent" : "count"}
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {dashboard.charts.postoGraduacaoDistribution.map(
                    (entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ),
                  )}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === "PERCENT" ? getPercentLabel(value) : value
                  }
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={legendWrapperStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

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
            mb={1.2}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Respostas detalhadas
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
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
              <Chip
                size="small"
                variant="outlined"
                label={`Selecionados: ${selectedIds.length}`}
                sx={{
                  borderColor: alpha(BI_PALETTE.primary, 0.4),
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
                    OM
                  </TableCell>
                  <TableCell sx={tableHeaderCellSx}>
                    Posto/Graduacao
                  </TableCell>
                  <TableCell sx={tableHeaderCellSx}>
                    Posto
                  </TableCell>
                  <TableCell sx={tableHeaderCellSx}>
                    Autodeclaracao
                  </TableCell>
                  <TableCell sx={tableHeaderCellSx}>
                    Sofreu violencia?
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
