import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from "../app/roleAccess";
import { useCpcaCaseStats, useMe, useOmsCatalog } from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Recebida",
  PROTECTION_MEASURES: "Acolhimento",
  PRELIMINARY_ANALYSIS: "Triagem",
  PROCEDURE_DEFINED: "Procedimento",
  INVESTIGATION: "Apuração",
  CONCLUDED: "Concluída",
  ARCHIVED: "Arquivada",
};

const PROCEDURE_LABELS: Record<string, string> = {
  NOT_DEFINED: "Não definido",
  PATD: "PATD",
  APF: "APF",
  SINDICANCIA: "Sindicância",
  PAD: "PAD",
  IPM: "IPM",
  BOLETIM_OCORRENCIA: "Boletim de ocorrência",
  INQUERITO_CIVIL: "Inquérito civil",
  NAO_HOUVE: "Não houve",
  INQUERITO_POLICIAL_COMUM: "Inquérito Policial Comum",
  NOTICIA_FATO: "Notícia de Fato",
  CONSELHO_DISCIPLINA: "Conselho de Disciplina",
  CONSELHO_JUSTIFICACAO: "Conselho de Justificação",
};

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  MORAL: "Assédio moral",
  SEXUAL: "Assédio sexual",
};

const DETAILED_VIOLENCE_TYPE_LABELS: Record<string, string> = {
  ASSEDIO_MORAL: "Assédio Moral",
  ASSEDIO_SEXUAL: "Assédio Sexual",
  VIOLENCIA_DOMESTICA_FISICA: "Violência doméstica - Física",
  VIOLENCIA_DOMESTICA_PSICOLOGICA: "Violência doméstica - Psicológica",
  VIOLENCIA_DOMESTICA_MORAL: "Violência doméstica - Moral",
  VIOLENCIA_DOMESTICA_PATRIMONIAL: "Violência doméstica - Patrimonial",
  VIOLENCIA_DOMESTICA_SEXUAL: "Violência doméstica - Sexual",
  VIOLENCIA_DOMESTICA_VICARIA: "Violência doméstica - Vicária",
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
};

const AGE_RANGE_LABELS: Record<string, string> = {
  "15_18": "15 a 18 anos",
  "19_25": "19 a 25 anos",
  "26_30": "26 a 30 anos",
  "31_35": "31 a 35 anos",
  "36_40": "36 a 40 anos",
  "41_45": "41 a 45 anos",
  "46_50": "46 a 50 anos",
  "51_55": "51 a 55 anos",
  MAIOR_55: "Mais de 55 anos",
};

const CHART_COLORS = [
  "#0C657E",
  "#C56A2B",
  "#1D8A6C",
  "#AD2F45",
  "#4A67A1",
  "#7B4DB4",
];
const CHART_TICK_STYLE = { fontSize: 11, fill: "rgba(35, 49, 64, 0.88)" };
const BLUE_CARD_SX = {
  bgcolor: "#1F4A61",
  border: "1px solid rgba(139, 184, 207, 0.38)",
  color: "#F4FAFD",
  "& .MuiTypography-root": {
    color: "inherit",
  },
  "& .MuiTypography-overline, & .MuiTypography-caption, & .MuiTypography-body2":
    {
      color: "rgba(231,244,250,0.92)",
    },
  "& .MuiTableCell-root": {
    color: "rgba(231,244,250,0.92)",
    borderColor: "rgba(231,244,250,0.18)",
  },
  "& .MuiTableHead-root .MuiTableCell-root": {
    color: "#F4FAFD",
    fontWeight: 700,
  },
  "& a": {
    color: "#9FD6FF",
  },
};

const CPCA_PANEL_CARD_SX = {
  bgcolor: "#FFFFFF",
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(17,66,89,0.14)",
  "& .MuiTypography-root": { color: "text.primary" },
  "& .MuiTypography-caption, & .MuiTypography-body2": {
    color: "text.secondary",
  },
  "& .MuiTableCell-root": {
    color: "text.primary",
    borderColor: "rgba(17,66,89,0.14)",
  },
  "& .MuiTableHead-root .MuiTableCell-root": {
    color: "text.primary",
    fontWeight: 700,
  },
} as const;

const CPCA_KPI_CARD_SX = {
  ...BLUE_CARD_SX,
  border: "1px solid rgba(139, 184, 207, 0.42) !important",
  backgroundColor: "rgb(83, 127, 151) !important",
  backgroundImage: "none !important",
  boxShadow: "0 18px 34px rgba(15,44,59,0.36)",
} as const;

type EditableCardStyle = {
  backgroundColor: string;
  textColor: string;
  title?: string;
  description?: string;
};

type CardEditorState = {
  cardId: string;
  defaults: EditableCardStyle;
  allowTextEditing: boolean;
} | null;

type CpcaChartDetailKind =
  | "status"
  | "monthly"
  | "procedure"
  | "openAging"
  | "violenceType"
  | "aggressorAge"
  | "victimAge";

type CpcaChartDetailState = {
  kind: CpcaChartDetailKind;
  item: any;
} | null;

type CpcaKpiDetailKind =
  | "totalCases"
  | "openCases"
  | "closureRate"
  | "averageClosureTime"
  | "triageOver7Days"
  | "investigationOver30Days";

type CpcaKpiDetailState = {
  kind: CpcaKpiDetailKind;
  title: string;
  subtitle: string;
} | null;

const CPCA_CARD_STYLES_STORAGE_KEY = "cpca-card-styles-v1";

function loadCpcaCardStyles(): Record<string, EditableCardStyle> {
  try {
    const raw = window.localStorage.getItem(CPCA_CARD_STYLES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, EditableCardStyle>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatPercent(value: number) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0%";
  return `${Math.round(numeric)}%`;
}

function translateMetricName(name: string | number) {
  const normalized = String(name ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "count") return "Quantidade";
  if (normalized === "total") return "Total";
  if (normalized === "open") return "Abertos";
  if (normalized === "moral") return "Moral";
  if (normalized === "sexual") return "Sexual";
  if (normalized === "concluded") return "Concluídas";
  if (normalized === "archived") return "Arquivadas";
  return String(name ?? "");
}

export function CpcaStatsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const [cardStyles, setCardStyles] = useState<
    Record<string, EditableCardStyle>
  >(() => loadCpcaCardStyles());
  const [cardEditorState, setCardEditorState] = useState<CardEditorState>(
    null,
  );
  const [editingCardDraft, setEditingCardDraft] = useState<EditableCardStyle>({
    backgroundColor: "#FFFFFF",
    textColor: "#111827",
    title: "",
    description: "",
  });
  const [chartDetail, setChartDetail] = useState<CpcaChartDetailState>(null);
  const [kpiDetail, setKpiDetail] = useState<CpcaKpiDetailState>(null);
  const [kpiDetailSearch, setKpiDetailSearch] = useState("");
  const isNationalScope = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
    ROLE_TI,
  ]);
  const localitiesQuery = useOmsCatalog(isNationalScope);

  const localityId = params.get("localityId") ?? "";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!params.has("from") && !params.has("to")) return;
    const next = new URLSearchParams(params);
    next.delete("from");
    next.delete("to");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const filters = useMemo(
    () => ({
      localityId: localityId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [from, localityId, to],
  );
  const statsQuery = useCpcaCaseStats(filters);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  if (statsQuery.isLoading) return <SkeletonState />;
  if (statsQuery.isError)
    return (
      <ErrorState
        error={statsQuery.error}
        onRetry={() => statsQuery.refetch()}
      />
    );

  const data = statsQuery.data ?? {};
  const summary = data.summary ?? {};
  const localities = (localitiesQuery.data?.items ?? []) as Array<{
    id?: string;
    name?: string;
  }>;
  const statusDistribution = (
    (data.statusDistribution ?? []) as Array<{ status: string; count: number }>
  ).map((item) => ({
    ...item,
    label: STATUS_LABELS[item.status] ?? item.status,
  }));
  const procedureDistribution = (
    (data.procedureDistribution ?? []) as Array<{
      procedureType: string;
      count: number;
    }>
  ).map((item) => ({
    ...item,
    label: PROCEDURE_LABELS[item.procedureType] ?? item.procedureType,
  }));
  const monthlyTrend = (data.monthlyTrend ?? []) as Array<{
    month: string;
    total: number;
    moral: number;
    sexual: number;
    open: number;
  }>;
  const openByAgeBuckets = (data.openByAgeBuckets ?? []) as Array<{
    bucket: string;
    count: number;
  }>;
  const topRiskLocalities = (data.topRiskLocalities ?? []) as Array<{
    localityId: string;
    localityCode: string;
    localityName: string;
    totalCases: number;
    openCases: number;
    retaliationRiskCases: number;
    stalledOver30Days: number;
    averageOpenDays: number;
    riskScore: number;
  }>;
  const topAggressorRanks = (data.topAggressorRanks ?? []) as Array<{
    rank: string;
    count: number;
  }>;
  const topVictimRanks = (data.topVictimRanks ?? []) as Array<{
    rank: string;
    count: number;
  }>;
  const detailedTypeDistribution = (
    (data.detailedTypeDistribution ?? []) as Array<{
      detailedViolenceType: string;
      count: number;
    }>
  ).map((item) => ({
    ...item,
    label:
      DETAILED_VIOLENCE_TYPE_LABELS[item.detailedViolenceType] ??
      item.detailedViolenceType,
  }));
  const aggressorAgeRangeDistribution = (
    (data.aggressorAgeRangeDistribution ?? []) as Array<{
      ageRange: string;
      count: number;
    }>
  ).map((item) => ({
    ...item,
    label: AGE_RANGE_LABELS[item.ageRange] ?? item.ageRange,
  }));
  const victimAgeRangeDistribution = (
    (data.victimAgeRangeDistribution ?? []) as Array<{
      ageRange: string;
      count: number;
    }>
  ).map((item) => ({
    ...item,
    label: AGE_RANGE_LABELS[item.ageRange] ?? item.ageRange,
  }));
  const criticalOpenCases = (data.criticalOpenCases ?? []) as Array<{
    caseId: string;
    caseNumber: string;
    localityCode: string;
    localityName: string;
    status: string;
    complaintType: string;
    detailedViolenceType?: string;
    openDays: number;
    idleDays: number;
    retaliationRisk: boolean;
  }>;
  const cpcaKpiDetails = (data.kpiDetails ?? {
    totalCases: [],
    openCases: criticalOpenCases,
    closureRate: [],
    averageClosureTime: [],
    triageOver7Days: criticalOpenCases.filter((item: any) =>
      ["RECEIVED", "PROTECTION_MEASURES", "PRELIMINARY_ANALYSIS"].includes(
        String(item?.status ?? ""),
      ),
    ),
    investigationOver30Days: criticalOpenCases.filter((item: any) =>
      ["PROCEDURE_DEFINED", "INVESTIGATION"].includes(
        String(item?.status ?? ""),
      ),
    ),
  }) as Record<CpcaKpiDetailKind, any[]>;

  const normalizeText = (value: unknown) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const kpiCards = [
    {
      id: "totalCases" as const,
      label: "Total de notificações",
      value: String(summary.totalCases ?? 0),
      hint: "Registros no período filtrado",
    },
    {
      id: "openCases" as const,
      label: "Casos em aberto",
      value: String(summary.openCases ?? 0),
      hint: `${formatPercent(((summary.openCases ?? 0) / Math.max(1, summary.totalCases ?? 0)) * 100)} do total`,
    },
    {
      id: "closureRate" as const,
      label: "Taxa de conclusão",
      value: formatPercent(summary.closureRatePercent ?? 0),
      hint: `${summary.concludedCases ?? 0} concluídas + ${summary.archivedCases ?? 0} arquivadas`,
    },
    {
      id: "averageClosureTime" as const,
      label: "Tempo médio até fechamento",
      value: `${summary.averageDaysToClosure ?? 0} dias`,
      hint: "Concluídas + Arquivadas",
    },
    {
      id: "triageOver7Days" as const,
      label: "Triagem > 7 dias",
      value: String(summary.triageOver7Days ?? 0),
      hint: "Alertas de tempo no item 3 da ICA",
    },
    {
      id: "investigationOver30Days" as const,
      label: "Apuração > 30 dias",
      value: String(summary.investigationOver30Days ?? 0),
      hint: "Procedimento definido/apuração sem fechamento",
    },
  ];

  const getCardStyle = (cardId: string, defaults: EditableCardStyle) => {
    const current = cardStyles[cardId];
    if (!current) return defaults;
    return {
      backgroundColor: current.backgroundColor || defaults.backgroundColor,
      textColor: current.textColor || defaults.textColor,
      title: (current.title ?? "").trim() || defaults.title || "",
      description:
        typeof current.description === "string"
          ? current.description
          : (defaults.description ?? ""),
    };
  };
  const openStyleEditor = (
    cardId: string,
    defaults: EditableCardStyle,
    options?: {
      allowTextEditing?: boolean;
    },
  ) => {
    setCardEditorState({
      cardId,
      defaults,
      allowTextEditing: Boolean(options?.allowTextEditing),
    });
    setEditingCardDraft(getCardStyle(cardId, defaults));
  };
  const saveStyleEditor = () => {
    if (!cardEditorState) return;
    const normalized: EditableCardStyle = {
      backgroundColor:
        editingCardDraft.backgroundColor ||
        cardEditorState.defaults.backgroundColor,
      textColor: editingCardDraft.textColor || cardEditorState.defaults.textColor,
    };
    if (cardEditorState.allowTextEditing) {
      normalized.title =
        (editingCardDraft.title ?? "").trim() ||
        cardEditorState.defaults.title ||
        "";
      normalized.description =
        (editingCardDraft.description ?? "").trim() ||
        cardEditorState.defaults.description ||
        "";
    }
    const next = {
      ...cardStyles,
      [cardEditorState.cardId]: normalized,
    };
    setCardStyles(next);
    window.localStorage.setItem(
      CPCA_CARD_STYLES_STORAGE_KEY,
      JSON.stringify(next),
    );
    setCardEditorState(null);
  };
  const openKpiDetail = (kind: CpcaKpiDetailKind) => {
    const metadata: Record<
      CpcaKpiDetailKind,
      { title: string; subtitle: string }
    > = {
      totalCases: {
        title: "Total de notificações",
        subtitle: "Casos registrados no recorte atual de filtros.",
      },
      openCases: {
        title: "Casos em aberto",
        subtitle:
          "Casos ainda sem encerramento (recebida até apuração), com foco no backlog operacional.",
      },
      closureRate: {
        title: "Taxa de conclusão",
        subtitle:
          "Casos concluídos ou arquivados que compõem a taxa de fechamento no período.",
      },
      averageClosureTime: {
        title: "Tempo médio até fechamento",
        subtitle:
          "Casos encerrados usados para calcular a média de dias até fechamento.",
      },
      triageOver7Days: {
        title: "Triagem > 7 dias",
        subtitle:
          "Casos em etapas iniciais com tempo em aberto acima de 7 dias.",
      },
      investigationOver30Days: {
        title: "Apuração > 30 dias",
        subtitle:
          "Casos em procedimento/apuração com tempo em aberto acima de 30 dias.",
      },
    };
    setKpiDetail({
      kind,
      title: metadata[kind].title,
      subtitle: metadata[kind].subtitle,
    });
    setKpiDetailSearch("");
  };
  const kpiDetailItems = kpiDetail
    ? (cpcaKpiDetails[kpiDetail.kind] ?? [])
    : [];
  const normalizedKpiSearch = normalizeText(kpiDetailSearch);
  const filteredKpiDetailItems = !normalizedKpiSearch
    ? kpiDetailItems
    : kpiDetailItems.filter((item: any) =>
        normalizeText(
          [
            item?.caseNumber,
            item?.localityCode,
            item?.localityName,
            item?.status,
            item?.complaintType,
            item?.detailedViolenceType,
            item?.procedureType,
          ].join(" "),
        ).includes(normalizedKpiSearch),
      );
  const openKpiCase = (caseNumber: string) => {
    if (!caseNumber) return;
    navigate(`/cpca-cases?q=${encodeURIComponent(caseNumber)}`);
  };
  const openCpcaCasesPanel = () => {
    const next = new URLSearchParams();
    if (localityId) next.set("localityId", localityId);
    navigate(`/cpca-cases${next.toString() ? `?${next.toString()}` : ""}`);
  };
  const getStatusLabel = (status: string | null | undefined) =>
    STATUS_LABELS[String(status ?? "")] ?? String(status ?? "-");
  const getProcedureLabel = (procedure: string | null | undefined) =>
    PROCEDURE_LABELS[String(procedure ?? "")] ?? String(procedure ?? "-");
  const getTypeLabel = (item: any) =>
    DETAILED_VIOLENCE_TYPE_LABELS[String(item?.detailedViolenceType ?? "")] ??
    COMPLAINT_TYPE_LABELS[String(item?.complaintType ?? "")] ??
    String(item?.detailedViolenceType ?? item?.complaintType ?? "-");

  const openChartDetail = (kind: CpcaChartDetailKind, item: any) => {
    if (!item) return;
    setChartDetail({ kind, item });
  };
  const chartDetailTitleByKind: Record<CpcaChartDetailKind, string> = {
    status: "Detalhe por status",
    monthly: "Detalhe da evolução mensal",
    procedure: "Detalhe por procedimento",
    openAging: "Detalhe de envelhecimento dos abertos",
    violenceType: "Detalhe por tipo de assédio/violência",
    aggressorAge: "Detalhe de faixa etária do acusado",
    victimAge: "Detalhe de faixa etária da vítima/noticiante",
  };
  const chartDetailMeaningByKind: Record<CpcaChartDetailKind, string> = {
    status:
      "Este item simboliza quantas denúncias estão neste status dentro do período e filtros atuais.",
    monthly:
      "Este item simboliza o comportamento mensal de entradas e estoque de casos em aberto.",
    procedure:
      "Este item simboliza quantas denúncias tiveram este procedimento instaurado no período.",
    openAging:
      "Este item simboliza a concentração de casos ainda abertos por faixa de tempo em aberto.",
    violenceType:
      "Este item simboliza a incidência de cada tipo específico de assédio/violência no recorte atual.",
    aggressorAge:
      "Este item simboliza quantas denúncias possuem acusado nesta faixa etária no recorte atual.",
    victimAge:
      "Este item simboliza quantas denúncias possuem vítima/noticiante nesta faixa etária no recorte atual.",
  };
  const chartDetailLabel =
    chartDetail?.item?.label ??
    chartDetail?.item?.month ??
    chartDetail?.item?.bucket ??
    "-";
  const chartDetailValue =
    chartDetail?.kind === "monthly"
      ? Number(chartDetail?.item?.total ?? 0)
      : Number(chartDetail?.item?.count ?? 0);
  const chartDetailBase =
    chartDetail?.kind === "openAging"
      ? Number(summary.openCases ?? 0)
      : Number(summary.totalCases ?? 0);
  const chartDetailPercent = chartDetailBase
    ? Math.round((chartDetailValue / chartDetailBase) * 100)
    : 0;
  const relatedCriticalCases = !chartDetail
    ? []
    : criticalOpenCases
        .filter((item) => {
          if (chartDetail.kind === "status") {
            return String(item.status) === String(chartDetail.item?.status);
          }
          if (chartDetail.kind === "violenceType") {
            return (
              String(item.detailedViolenceType ?? "") ===
              String(chartDetail.item?.detailedViolenceType ?? "")
            );
          }
          return false;
        })
        .slice(0, 10);
  const openCpcaCasesFromDetail = () => {
    if (!chartDetail) return;
    const next = new URLSearchParams();
    if (localityId) next.set("localityId", localityId);
    if (chartDetail.kind === "status") {
      next.set("status", String(chartDetail.item?.status ?? ""));
    }
    if (chartDetail.kind === "procedure") {
      next.set("procedureType", String(chartDetail.item?.procedureType ?? ""));
    }
    if (chartDetail.kind === "violenceType") {
      next.set(
        "detailedViolenceType",
        String(chartDetail.item?.detailedViolenceType ?? ""),
      );
    }
    navigate(`/cpca-cases${next.toString() ? `?${next.toString()}` : ""}`);
  };
  const canFilterOpenCases = Boolean(
    chartDetail &&
    (chartDetail.kind === "status" ||
      chartDetail.kind === "procedure" ||
      chartDetail.kind === "violenceType"),
  );

  return (
    <Box
      sx={{
        "& .MuiTypography-h6": { fontSize: "1rem", fontWeight: 700 },
        "& .MuiTypography-overline": { fontSize: "0.68rem" },
        "& .MuiTableCell-root": { fontSize: "0.8rem" },
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        flexWrap="wrap"
        mb={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Painel de Comando - CPCA
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Indicadores de denúncias, risco, tempo de resposta e priorização por
            OM para apoio ao comando.
          </Typography>
        </Box>
        <Button component={Link} to="/cpca-cases" variant="outlined">
          Abrir denúncias
        </Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            {isNationalScope && (
              <TextField
                select
                size="small"
                label="OM"
                value={localityId}
                onChange={(event) =>
                  updateParam("localityId", event.target.value)
                }
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {localities.map((locality) => (
                  <MenuItem
                    key={String(locality.id ?? "")}
                    value={String(locality.id ?? "")}
                  >
                    {String(locality.name ?? locality.id)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              type="date"
              size="small"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <TextField
              type="date"
              size="small"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
            <Button
              onClick={() => {
                setFrom("");
                setTo("");
                setParams({}, { replace: true });
              }}
            >
              Limpar filtros
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {kpiCards.map((card) => {
          const kpiCardStyle = getCardStyle(`cpca-kpi-${card.id}`, {
            backgroundColor: "rgb(83, 127, 151)",
            textColor: "#F4FAFD",
            title: card.label,
            description: card.hint,
          });
          const isTextEditableKpi =
            card.id === "totalCases" ||
            card.id === "openCases" ||
            card.id === "closureRate";
          const cardTitle = (kpiCardStyle.title ?? "").trim() || card.label;
          const cardDescription =
            (kpiCardStyle.description ?? "").trim() || card.hint;
          return (
            <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  ...CPCA_KPI_CARD_SX,
                  height: "100%",
                  backgroundColor: `${kpiCardStyle.backgroundColor} !important`,
                }}
              >
                <CardContent
                  sx={{
                    cursor: "pointer",
                    transition: "transform 150ms ease, box-shadow 150ms ease",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: "0 8px 16px rgba(15,44,59,0.24)",
                    },
                    "&:focus-visible": {
                      outline: "2px solid rgba(255,255,255,0.9)",
                      outlineOffset: "2px",
                    },
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => openKpiDetail(card.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openKpiDetail(card.id);
                    }
                  }}
                >
                  {isTiProfile ? (
                    <Box display="flex" justifyContent="flex-end">
                      <Tooltip
                        title={
                          isTextEditableKpi
                            ? "Editar título, descrição e cores do card"
                            : "Editar cores do card"
                        }
                      >
                        <IconButton
                          size="small"
                          sx={{
                            color: kpiCardStyle.textColor,
                            opacity: 0.72,
                            p: 0.3,
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            openStyleEditor(
                              `cpca-kpi-${card.id}`,
                              {
                                backgroundColor: "rgb(83, 127, 151)",
                                textColor: "#F4FAFD",
                                title: card.label,
                                description: card.hint,
                              },
                              {
                                allowTextEditing: isTextEditableKpi,
                              },
                            );
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : null}
                  <Typography
                    variant="overline"
                    fontWeight={600}
                    sx={{ color: kpiCardStyle.textColor }}
                  >
                    {cardTitle}
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    lineHeight={1.15}
                    sx={{ color: kpiCardStyle.textColor }}
                  >
                    {card.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: kpiCardStyle.textColor }}
                  >
                    {cardDescription
                      ? `${cardDescription} • Clique para detalhar`
                      : "Clique para detalhar"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-status", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Distribuição por status
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-status", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.7, display: "block" }}
                  >
                    Clique em uma barra para ver o que o status simboliza.
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={statusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={70}
                        tick={CHART_TICK_STYLE}
                      />
                      <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          value,
                          translateMetricName(name),
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        name="Quantidade"
                        fill="#0C657E"
                        radius={[8, 8, 0, 0]}
                        barSize={12}
                        cursor="pointer"
                        onClick={(state: any) =>
                          openChartDetail("status", state?.payload)
                        }
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-monthly-trend", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Evolução mensal (moral x sexual x aberto)
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-monthly-trend", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.7, display: "block" }}
                  >
                    Clique em um ponto para ver o detalhamento do mês.
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={monthlyTrend}
                      onClick={(state: any) =>
                        openChartDetail(
                          "monthly",
                          state?.activePayload?.[0]?.payload,
                        )
                      }
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={CHART_TICK_STYLE} />
                      <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          value,
                          translateMetricName(name),
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="moral"
                        name="Moral"
                        stroke="#0C657E"
                        strokeWidth={2}
                        dot={{ r: 3, cursor: "pointer" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sexual"
                        name="Sexual"
                        stroke="#AD2F45"
                        strokeWidth={2}
                        dot={{ r: 3, cursor: "pointer" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="open"
                        name="Abertos"
                        stroke="#C56A2B"
                        strokeWidth={2}
                        dot={{ r: 3, cursor: "pointer" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-procedure", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Procedimento instaurado
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-procedure", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.7, display: "block" }}
                  >
                    Clique em uma barra para detalhar este procedimento.
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={procedureDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={70}
                        tick={CHART_TICK_STYLE}
                      />
                      <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          value,
                          translateMetricName(name),
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        name="Quantidade"
                        fill="#1D8A6C"
                        radius={[8, 8, 0, 0]}
                        barSize={12}
                        cursor="pointer"
                        onClick={(state: any) =>
                          openChartDetail("procedure", state?.payload)
                        }
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-open-aging", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Envelhecimento dos casos abertos
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-open-aging", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.7, display: "block" }}
                  >
                    Clique em uma barra para entender a faixa de tempo em
                    aberto.
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={openByAgeBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" tick={CHART_TICK_STYLE} />
                      <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          value,
                          translateMetricName(name),
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        name="Quantidade"
                        radius={[8, 8, 0, 0]}
                        barSize={12}
                        cursor="pointer"
                        onClick={(state: any) =>
                          openChartDetail("openAging", state?.payload)
                        }
                      >
                        {openByAgeBuckets.map((entry, index) => (
                          <Cell
                            key={entry.bucket}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-top-risk", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Top OMs por risco operacional CPCA
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-top-risk", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  {topRiskLocalities.length === 0 ? (
                    <EmptyState
                      title="Sem dados"
                      description="Nenhuma OM com casos no recorte informado."
                    />
                  ) : (
                    <Table size="small">
                      <TableHead
                        sx={{
                          "& .MuiTableCell-root": {
                            bgcolor: "primary.main",
                            color: "#F4FAFD !important",
                            fontWeight: "700 !important",
                          },
                        }}
                      >
                        <TableRow>
                          <TableCell>OM</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Abertos</TableCell>
                          <TableCell align="right">Retaliação</TableCell>
                          <TableCell align="right">+30d</TableCell>
                          <TableCell align="right">Risco</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topRiskLocalities.map((item) => (
                          <TableRow
                            key={`${item.localityId}:${item.localityCode}`}
                          >
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>
                                {item.localityCode || item.localityName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {item.localityName}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {item.totalCases}
                            </TableCell>
                            <TableCell align="right">
                              {item.openCases}
                            </TableCell>
                            <TableCell align="right">
                              {item.retaliationRiskCases}
                            </TableCell>
                            <TableCell align="right">
                              {item.stalledOver30Days}
                            </TableCell>
                            <TableCell align="right">
                              {item.riskScore}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-violence-type", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Distribuição por tipo de assédio ou violência
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-violence-type", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  {detailedTypeDistribution.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem dados de tipo para o recorte.
                    </Typography>
                  ) : (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mb: 0.7, display: "block" }}
                      >
                        Clique em uma barra para detalhar o tipo selecionado.
                      </Typography>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={detailedTypeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={90}
                            tick={CHART_TICK_STYLE}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={CHART_TICK_STYLE}
                          />
                          <RechartsTooltip
                            formatter={(value, name) => [
                              value,
                              translateMetricName(name),
                            ]}
                          />
                          <Bar
                            dataKey="count"
                            name="Quantidade"
                            fill="#4A67A1"
                            radius={[8, 8, 0, 0]}
                            barSize={10}
                            cursor="pointer"
                            onClick={(state: any) =>
                              openChartDetail("violenceType", state?.payload)
                            }
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                  <Typography variant="h6" gutterBottom sx={{ mt: 1.5 }}>
                    Top posto/graduação do acusado
                  </Typography>
                  {topAggressorRanks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem dados de posto/graduação.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableBody>
                        {topAggressorRanks.slice(0, 5).map((item) => (
                          <TableRow key={`aggr:${item.rank}`}>
                            <TableCell>{item.rank}</TableCell>
                            <TableCell align="right">{item.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Typography variant="h6" gutterBottom sx={{ mt: 1.5 }}>
                    Top posto/graduação da vítima/noticiante
                  </Typography>
                  {topVictimRanks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem dados de posto/graduação.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableBody>
                        {topVictimRanks.slice(0, 5).map((item) => (
                          <TableRow key={`victim:${item.rank}`}>
                            <TableCell>{item.rank}</TableCell>
                            <TableCell align="right">{item.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-aggressor-age", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Faixa etária do acusado
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-aggressor-age", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  {aggressorAgeRangeDistribution.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem dados de faixa etária do acusado.
                    </Typography>
                  ) : (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mb: 0.7, display: "block" }}
                      >
                        Clique em uma barra para detalhar a faixa etária.
                      </Typography>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={aggressorAgeRangeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={80}
                            tick={CHART_TICK_STYLE}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={CHART_TICK_STYLE}
                          />
                          <RechartsTooltip
                            formatter={(value, name) => [
                              value,
                              translateMetricName(name),
                            ]}
                          />
                          <Bar
                            dataKey="count"
                            name="Quantidade"
                            fill="#1D8A6C"
                            radius={[8, 8, 0, 0]}
                            barSize={12}
                            cursor="pointer"
                            onClick={(state: any) =>
                              openChartDetail("aggressorAge", state?.payload)
                            }
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {(() => {
            const style = getCardStyle("cpca-victim-age", {
              backgroundColor: "#FFFFFF",
              textColor: "#111827",
            });
            return (
              <Card
                sx={{
                  ...CPCA_PANEL_CARD_SX,
                  height: "100%",
                  backgroundColor: style.backgroundColor,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="h6" sx={{ color: style.textColor }}>
                      Faixa etária da vítima/noticiante
                    </Typography>
                    {isTiProfile ? (
                      <Tooltip title="Editar cores do card">
                        <IconButton
                          size="small"
                          sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                          onClick={() =>
                            openStyleEditor("cpca-victim-age", {
                              backgroundColor: "#FFFFFF",
                              textColor: "#111827",
                            })
                          }
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  {victimAgeRangeDistribution.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem dados de faixa etária da vítima/noticiante.
                    </Typography>
                  ) : (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mb: 0.7, display: "block" }}
                      >
                        Clique em uma barra para detalhar a faixa etária.
                      </Typography>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={victimAgeRangeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={80}
                            tick={CHART_TICK_STYLE}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={CHART_TICK_STYLE}
                          />
                          <RechartsTooltip
                            formatter={(value, name) => [
                              value,
                              translateMetricName(name),
                            ]}
                          />
                          <Bar
                            dataKey="count"
                            name="Quantidade"
                            fill="#AD2F45"
                            radius={[8, 8, 0, 0]}
                            barSize={12}
                            cursor="pointer"
                            onClick={(state: any) =>
                              openChartDetail("victimAge", state?.payload)
                            }
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </Grid>
      </Grid>

      {(() => {
        const style = getCardStyle("cpca-critical-open", {
          backgroundColor: "#FFFFFF",
          textColor: "#111827",
        });
        return (
          <Card
            sx={{
              ...CPCA_PANEL_CARD_SX,
              mt: 2,
              backgroundColor: style.backgroundColor,
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                mb={1}
              >
                <Typography variant="h6" sx={{ color: style.textColor }}>
                  Casos críticos em aberto (priorização imediata)
                </Typography>
                {isTiProfile ? (
                  <Tooltip title="Editar cores do card">
                    <IconButton
                      size="small"
                      sx={{ color: style.textColor, opacity: 0.72, p: 0.3 }}
                      onClick={() =>
                        openStyleEditor("cpca-critical-open", {
                          backgroundColor: "#FFFFFF",
                          textColor: "#111827",
                        })
                      }
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
              {criticalOpenCases.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum caso aberto no recorte atual.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead
                    sx={{
                      "& .MuiTableCell-root": {
                        bgcolor: "primary.main",
                        color: "#F4FAFD !important",
                        fontWeight: "700 !important",
                      },
                    }}
                  >
                    <TableRow>
                      <TableCell>Caso</TableCell>
                      <TableCell>OM</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell align="right">Dias em aberto</TableCell>
                      <TableCell align="right">Dias sem atualização</TableCell>
                      <TableCell align="right">Retaliação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {criticalOpenCases.slice(0, 10).map((item) => (
                      <TableRow key={item.caseId} hover>
                        <TableCell>
                          <Link
                            to={`/cpca-cases?q=${encodeURIComponent(item.caseNumber)}`}
                          >
                            {item.caseNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {item.localityCode || item.localityName || "—"}
                        </TableCell>
                        <TableCell>
                          {STATUS_LABELS[item.status] ?? item.status}
                        </TableCell>
                        <TableCell>
                          {DETAILED_VIOLENCE_TYPE_LABELS[
                            item.detailedViolenceType ?? ""
                          ] ??
                            COMPLAINT_TYPE_LABELS[item.complaintType] ??
                            item.detailedViolenceType ??
                            item.complaintType}
                        </TableCell>
                        <TableCell align="right">{item.openDays}</TableCell>
                        <TableCell align="right">{item.idleDays}</TableCell>
                        <TableCell align="right">
                          {item.retaliationRisk ? "Sim" : "Não"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <Dialog
        open={Boolean(kpiDetail)}
        onClose={() => setKpiDetail(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pb: 0.8 }}>
          {kpiDetail?.title ?? "Detalhamento do KPI"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                {kpiDetail?.subtitle}
              </Typography>
              <Chip
                size="small"
                sx={{ mt: 0.8 }}
                label={`${filteredKpiDetailItems.length} caso(s) encontrado(s)`}
              />
            </Box>
            <TextField
              size="small"
              label="Buscar caso"
              placeholder="Número, OM, status, tipo"
              value={kpiDetailSearch}
              onChange={(event) => setKpiDetailSearch(event.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 320 } }}
            />
          </Stack>

          {filteredKpiDetailItems.length === 0 ? (
            <EmptyState
              title="Sem detalhes para exibir"
              description="Nenhum caso encontrado para o KPI e filtros atuais."
            />
          ) : (
            <Box sx={{ display: "grid", gap: 1 }}>
              {filteredKpiDetailItems.map((item: any, index: number) => (
                <Card
                  key={`${String(item.caseId ?? item.caseNumber ?? "kpi-item")}:${index}`}
                  variant="outlined"
                >
                  <CardContent sx={{ p: 1.2 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.caseNumber || "-"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.localityCode || item.localityName || "—"} •{" "}
                          {getStatusLabel(item.status)} • {getTypeLabel(item)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          Procedimento: {getProcedureLabel(item.procedureType)}
                        </Typography>
                        {Number(item.openDays ?? 0) > 0 ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Em aberto: {Number(item.openDays ?? 0)} dias • Sem
                            atualização: {Number(item.idleDays ?? 0)} dias
                          </Typography>
                        ) : null}
                        {item.daysToClosure != null ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Tempo até fechamento: {Number(item.daysToClosure)}{" "}
                            dias
                          </Typography>
                        ) : null}
                      </Box>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() =>
                          openKpiCase(String(item.caseNumber ?? ""))
                        }
                      >
                        Abrir denúncia
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={openCpcaCasesPanel}>
            Abrir painel de denúncias
          </Button>
          <Button onClick={() => setKpiDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(chartDetail)}
        onClose={() => setChartDetail(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.8 }}>
          {chartDetail
            ? chartDetailTitleByKind[chartDetail.kind]
            : "Detalhe do gráfico"}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
            {chartDetail ? chartDetailMeaningByKind[chartDetail.kind] : ""}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 1.4 }}
          >
            <Chip size="small" label={`Item: ${chartDetailLabel}`} />
            <Chip size="small" label={`Valor: ${chartDetailValue}`} />
            <Chip
              size="small"
              label={`Participação no período: ${chartDetailPercent}%`}
            />
            <Chip size="small" label={`Base: ${chartDetailBase}`} />
            {chartDetail?.kind === "monthly" ? (
              <>
                <Chip
                  size="small"
                  label={`Moral: ${Number(chartDetail.item?.moral ?? 0)}`}
                />
                <Chip
                  size="small"
                  label={`Sexual: ${Number(chartDetail.item?.sexual ?? 0)}`}
                />
                <Chip
                  size="small"
                  label={`Abertos: ${Number(chartDetail.item?.open ?? 0)}`}
                />
              </>
            ) : null}
          </Stack>
          {(chartDetail?.kind === "status" ||
            chartDetail?.kind === "violenceType") && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>
                Casos críticos relacionados (até 10)
              </Typography>
              {relatedCriticalCases.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum caso crítico no recorte atual para este item.
                </Typography>
              ) : (
                <Box sx={{ display: "grid", gap: 1 }}>
                  {relatedCriticalCases.map((item) => (
                    <Card key={item.caseId} variant="outlined">
                      <CardContent sx={{ p: 1.2 }}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700 }}
                            >
                              {item.caseNumber}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {item.localityCode || item.localityName || "—"} •{" "}
                              {item.openDays} dias em aberto
                            </Typography>
                          </Box>
                          <Button
                            component={Link}
                            to={`/cpca-cases?q=${encodeURIComponent(item.caseNumber)}`}
                            size="small"
                            variant="text"
                          >
                            Abrir denúncia
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {canFilterOpenCases ? (
            <Button variant="outlined" onClick={openCpcaCasesFromDetail}>
              Abrir denúncias filtradas
            </Button>
          ) : null}
          <Button onClick={() => setChartDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(cardEditorState)}
        onClose={() => setCardEditorState(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {cardEditorState?.allowTextEditing
            ? "Editar card"
            : "Editar cores do card"}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {cardEditorState?.allowTextEditing ? (
              <>
                <TextField
                  label="Título do card"
                  value={editingCardDraft.title ?? ""}
                  onChange={(e) =>
                    setEditingCardDraft((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  fullWidth
                />
                <TextField
                  label="Descrição do card"
                  value={editingCardDraft.description ?? ""}
                  onChange={(e) =>
                    setEditingCardDraft((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  minRows={2}
                  multiline
                  fullWidth
                />
              </>
            ) : null}
            <TextField
              label="Cor do fundo"
              type="color"
              value={editingCardDraft.backgroundColor}
              onChange={(e) =>
                setEditingCardDraft((prev) => ({
                  ...prev,
                  backgroundColor: e.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              label="Cor da fonte"
              type="color"
              value={editingCardDraft.textColor}
              onChange={(e) =>
                setEditingCardDraft((prev) => ({
                  ...prev,
                  textColor: e.target.value,
                }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCardEditorState(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveStyleEditor}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
