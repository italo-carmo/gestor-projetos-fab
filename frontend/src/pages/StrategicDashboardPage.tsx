import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  DialogActions,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useStrategicDashboard,
  useAggressorProfile,
  useGeoMap,
  useExportExecutiveReportPdf,
} from "../api/hooks";
import { buildAiCopilotPath } from "../app/aiCopilotLaunch";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { AiCopilotCtaRow } from "../components/strategic/AiCopilotCtaRow";
import { SkeletonState } from "../components/states/SkeletonState";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { ComgepStrategicTab } from "../components/strategic/ComgepStrategicTab";

const COLORS = [
  "#1A3C6E",
  "#2E7D32",
  "#ED6C02",
  "#D32F2F",
  "#7B1FA2",
  "#0288D1",
  "#C2185B",
  "#00838F",
  "#4E342E",
  "#546E7A",
  "#F9A825",
  "#1B5E20",
];

const GENDER_LABELS: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  NAO_INFORMADO: "Não informado",
};

function buildStrategicCopilotLinks(args: {
  label: string;
  description: string;
  focus?: {
    kind:
      | "overview"
      | "kpi_covered_oms"
      | "kpi_critical_ufs"
      | "kpi_high_risk_oms"
      | "kpi_operational_presence"
      | "uf"
      | "om"
      | "coverage_gap"
      | "operational_pressure";
    uf?: string | null;
    omId?: string | null;
    refId?: string | null;
  } | null;
}) {
  return {
    explainHref: buildAiCopilotPath({
      type: "briefing_comgep",
      mode: "analyst",
      intent: "explain",
      label: args.label,
      description: args.description,
      focus: args.focus ?? { kind: "overview" },
    }),
    briefingHref: buildAiCopilotPath({
      type: "briefing_comgep",
      mode: "executive",
      intent: "briefing",
      label: args.label,
      description: args.description,
      focus: args.focus ?? { kind: "overview" },
    }),
    actionHref: buildAiCopilotPath({
      type: "priorizacao_intervencao",
      mode: "executive",
      intent: "action",
      label: args.label,
      description: args.description,
      focus: args.focus ?? { kind: "overview" },
    }),
  };
}

function KpiCard({
  title,
  value,
  subtitle,
  color = "#1A3C6E",
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        height: "100%",
        borderLeft: `4px solid ${color}`,
        ...(onClick && {
          cursor: "pointer",
          transition: "box-shadow 0.2s, transform 0.15s",
          "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
        }),
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
        >
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={700} color={color} sx={{ my: 0.3 }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {onClick && (
          <Typography variant="caption" color="primary" sx={{ display: "block", mt: 0.3 }}>
            Clique para detalhes →
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function KpiDetailModal({
  open,
  title,
  onClose,
  maxWidth = "md",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">{title}</Typography>
        <Button onClick={onClose} size="small" sx={{ minWidth: "auto" }}>
          <CloseRoundedIcon />
        </Button>
      </DialogTitle>
      <Divider />
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

function HorizontalBarCard({
  title,
  data,
  maxItems = 10,
  height = 300,
  color = "#1A3C6E",
}: {
  title: string;
  data: { label: string; count: number; percent: number }[];
  maxItems?: number;
  height?: number;
  color?: string;
}) {
  const sliced = data.slice(0, maxItems);
  if (sliced.length === 0) return null;
  const chartHeight = Math.max(height, sliced.length * 32 + 40);
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sliced}
            layout="vertical"
            margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v}`} />
            <YAxis
              dataKey="label"
              type="category"
              width={180}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <RechartsTooltip
              formatter={(val: number, _: any, entry: any) =>
                `${val} (${entry.payload.percent}%)`
              }
            />
            <Bar dataKey="count" fill={color} barSize={18} radius={[0, 4, 4, 0]}>
              {sliced.map((_: any, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5, borderBottom: "1px solid #f0f0f0" }}>
      <Typography variant="body2">{label}</Typography>
      <Chip label={value} size="small" sx={color ? { bgcolor: color, color: "#fff" } : {}} />
    </Box>
  );
}

type StrategicLinkedDetailItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  link?: string;
  date?: string;
};

function formatDetailDateLabel(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function DetailMeaningBlock({
  title,
  meaning,
  source,
}: {
  title: string;
  meaning: string;
  source: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "#F5F8FC",
        border: "1px solid #D7E3F4",
      }}
    >
      <Typography variant="subtitle2" fontWeight={800} color="#1A3C6E">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.6, lineHeight: 1.65 }}>
        {meaning}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
        {source}
      </Typography>
    </Box>
  );
}

function DetailAccordionSection({
  title,
  subtitle,
  defaultExpanded = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      defaultExpanded={defaultExpanded}
      sx={{
        border: "1px solid #E1E7F0",
        borderRadius: "12px !important",
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          bgcolor: "#F8FAFD",
          px: 2,
          py: 0.4,
        }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={800} color="#1A3C6E">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 2 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function DetailItemList({
  items,
  emptyMessage,
}: {
  items: StrategicLinkedDetailItem[];
  emptyMessage: string;
}) {
  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <List disablePadding sx={{ border: "1px solid #E6ECF5", borderRadius: 2, overflow: "hidden" }}>
      {items.map((item, index) => (
        <ListItem
          key={item.id}
          divider={index < items.length - 1}
          secondaryAction={
            item.link ? (
              <Button
                size="small"
                component={RouterLink}
                to={item.link}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewRoundedIcon />}
              >
                Abrir
              </Button>
            ) : undefined
          }
          sx={{ alignItems: "flex-start", py: 1.25, pr: item.link ? 12 : 2 }}
        >
          <ListItemText
            primary={
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ sm: "center" }}
                useFlexGap
              >
                <Typography variant="body2" fontWeight={800}>
                  {item.title}
                </Typography>
                {item.badge ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={formatComplaintStatusLabel(item.badge)}
                    sx={{ width: "fit-content" }}
                  />
                ) : null}
                {formatDetailDateLabel(item.date) ? (
                  <Typography variant="caption" color="text.secondary">
                    {formatDetailDateLabel(item.date)}
                  </Typography>
                ) : null}
              </Stack>
            }
            secondary={
              item.subtitle ? (
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5, lineHeight: 1.6 }}
                >
                  {item.subtitle}
                </Typography>
              ) : null
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

type ActivityKpiDetailItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  link: string;
  date?: string;
};

type ActivitySpecificKpiDetailItem = ActivityKpiDetailItem & {
  scope: string;
  status: string;
  locality?: string;
};

function formatActivityStatusLabel(status: string) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "NOT_STARTED") return "Não iniciada";
  if (normalized === "IN_PROGRESS") return "Em andamento";
  if (normalized === "DONE") return "Concluída";
  if (normalized === "CANCELLED") return "Cancelada";
  return normalized || "—";
}

function formatComplaintTypeLabel(type: string) {
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === "MORAL") return "Assédio Moral";
  if (normalized === "SEXUAL") return "Assédio Sexual";
  return normalized || "—";
}

function formatComplaintStatusLabel(status: string) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "RECEIVED") return "Recebida";
  if (normalized === "PROTECTION_MEASURES") return "Medidas protetivas";
  if (normalized === "PRELIMINARY_ANALYSIS") return "Análise preliminar";
  if (normalized === "PROCEDURE_DEFINED") return "Procedimento definido";
  if (normalized === "INVESTIGATION") return "Em apuração";
  if (normalized === "CONCLUDED") return "Concluída";
  if (normalized === "ARCHIVED") return "Arquivada";
  return normalized || "—";
}

function formatWorkflowScopeLabel(scope: string) {
  const normalized = String(scope || "").trim().toUpperCase();
  if (normalized === "CPCA") return "CPCA";
  if (normalized === "SMIF") return "SMIF";
  return normalized || "—";
}

function formatActivityScopeLabel(scope: string) {
  const normalized = String(scope || "").trim().toUpperCase();
  if (normalized === "SMIF") return "SMIF";
  if (normalized === "CIPAVD") return "CIPAVD";
  return normalized || "—";
}

function formatCoveredOmResponsibility(item: any) {
  const managers = Array.isArray(item?.coveredByOms) ? item.coveredByOms : [];
  if (Boolean(item?.hasCpca)) return "Própria OM";
  if (managers.length === 0) return "Cobertura vinculada";
  return managers
    .map((manager: any) => [manager?.code, manager?.name].filter(Boolean).join(" - "))
    .filter(Boolean)
    .join(", ");
}

function CoveredOmCoverageChip({ item }: { item: any }) {
  const isOwn =
    Boolean(item?.hasCpca) ||
    String(item?.coverageType ?? "").toUpperCase() === "OWN";

  return (
    <Chip
      size="small"
      label={isOwn ? "CPCA própria" : "Coberta por outra OM"}
      sx={
        isOwn
          ? {
              bgcolor: "#E8F5E9",
              color: "#1B5E20",
              fontWeight: 700,
            }
          : {
              bgcolor: "#FFF3E0",
              color: "#E65100",
              fontWeight: 700,
            }
      }
    />
  );
}

function ExpandableActivityMetricRow({
  metricKey,
  label,
  value,
  items,
  color,
  expandedKey,
  onToggle,
}: {
  metricKey: string;
  label: string;
  value: number;
  items: ActivitySpecificKpiDetailItem[];
  color?: string;
  expandedKey: string | null;
  onToggle: (metricKey: string) => void;
}) {
  const expanded = expandedKey === metricKey;
  return (
    <Box sx={{ border: "1px solid #E0E0E0", borderRadius: 1, overflow: "hidden" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 1.25, py: 0.75 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip label={value} size="small" sx={color ? { bgcolor: color, color: "#fff" } : {}} />
          <IconButton
            size="small"
            onClick={() => onToggle(metricKey)}
            aria-label={expanded ? `Recolher ${label}` : `Expandir ${label}`}
          >
            <ExpandMoreIcon
              sx={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </IconButton>
        </Stack>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        {items.length > 0 ? (
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Atividade</strong></TableCell>
                  <TableCell><strong>Escopo</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Data</strong></TableCell>
                  <TableCell><strong>Localidade</strong></TableCell>
                  <TableCell align="right"><strong>Ação</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${metricKey}-${item.id}`} hover>
                    <TableCell>{item.title || "Atividade"}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.scope || "—"}
                        size="small"
                        sx={{
                          bgcolor: item.scope === "CIPAVD" ? "#F3E5F5" : "#E3F2FD",
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell>{formatActivityStatusLabel(item.status)}</TableCell>
                    <TableCell>{item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{item.locality || "—"}</TableCell>
                    <TableCell align="right">
                      <Button
                        component="a"
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNewRoundedIcon fontSize="inherit" />}
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
            Nenhum item encontrado nessa métrica.
          </Typography>
        )}
      </Collapse>
    </Box>
  );
}

function ExpandableKpiMetricRow({
  metricKey,
  label,
  value,
  items,
  color,
  expandedKey,
  onToggle,
}: {
  metricKey: string;
  label: string;
  value: number;
  items: ActivityKpiDetailItem[];
  color?: string;
  expandedKey: string | null;
  onToggle: (metricKey: string) => void;
}) {
  const expanded = expandedKey === metricKey;
  return (
    <Box sx={{ border: "1px solid #E0E0E0", borderRadius: 1, overflow: "hidden" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 1.25, py: 0.75 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip label={value} size="small" sx={color ? { bgcolor: color, color: "#fff" } : {}} />
          <IconButton
            size="small"
            onClick={() => onToggle(metricKey)}
            aria-label={expanded ? `Recolher ${label}` : `Expandir ${label}`}
          >
            <ExpandMoreIcon
              sx={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </IconButton>
        </Stack>
      </Box>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        {items.length > 0 ? (
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Item</strong></TableCell>
                  <TableCell><strong>Detalhes</strong></TableCell>
                  <TableCell><strong>Data</strong></TableCell>
                  <TableCell><strong>Indicador</strong></TableCell>
                  <TableCell align="right"><strong>Ação</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${metricKey}-${item.id}`} hover>
                    <TableCell>{item.title || "Item"}</TableCell>
                    <TableCell>{item.subtitle || "—"}</TableCell>
                    <TableCell>
                      {item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      {item.badge ? <Chip label={item.badge} size="small" /> : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {item.link ? (
                        <Button
                          component="a"
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          variant="outlined"
                          endIcon={<OpenInNewRoundedIcon fontSize="inherit" />}
                        >
                          Abrir
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" disabled>
                          Sem link
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
            Nenhum item encontrado nessa métrica.
          </Typography>
        )}
      </Collapse>
    </Box>
  );
}

function SituationalTab() {
  const { data, isLoading, error } = useStrategicDashboard();
  const [detailModal, setDetailModal] = useState<string | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  useEffect(() => {
    setExpandedMetric(null);
  }, [detailModal]);

  if (isLoading) return <SkeletonState />;
  if (error) return <ErrorState message="Erro ao carregar visão geral." />;
  if (!data) return <EmptyState message="Sem dados." />;

  const s = data.surveys ?? {};
  const dv = data.domesticViolence ?? {};
  const r = data.recruits ?? {};
  const c = data.complaints ?? {};
  const a = data.activities ?? {};
  const m = data.missions ?? {};
  const surveyDetails = (s.details ?? {}) as Record<string, ActivityKpiDetailItem[]>;
  const domesticDetails = (dv.details ?? {}) as Record<string, ActivityKpiDetailItem[]>;
  const recruitDetails = (r.details ?? {}) as Record<string, ActivityKpiDetailItem[]>;
  const complaintDetails = (c.details ?? {}) as Record<string, ActivityKpiDetailItem[]>;
  const activityDetails = (a.details ?? {}) as Record<string, ActivitySpecificKpiDetailItem[]>;
  const missionDetails = (m.details ?? {}) as Record<string, ActivityKpiDetailItem[]>;

  const surveysMetrics = [
    {
      key: "total",
      label: "Total de respondentes",
      value: Number(s.totalResponses ?? 0),
      items: Array.isArray(surveyDetails.total) ? surveyDetails.total : [],
    },
    {
      key: "yes",
      label: "Responderam SIM (sofreu violência)",
      value: Number(s.yesCount ?? 0),
      color: "#D32F2F",
      items: Array.isArray(surveyDetails.yes) ? surveyDetails.yes : [],
    },
    {
      key: "no",
      label: "Responderam NÃO",
      value: Number(s.noCount ?? 0),
      color: "#2E7D32",
      items: Array.isArray(surveyDetails.no) ? surveyDetails.no : [],
    },
  ];

  const domesticMetrics = [
    {
      key: "total",
      label: "Total de respondentes",
      value: Number(dv.totalResponses ?? 0),
      items: Array.isArray(domesticDetails.total) ? domesticDetails.total : [],
    },
    {
      key: "lifetimeYes",
      label: "Sofreram violência doméstica (alguma vez)",
      value: Number(dv.lifetimeYes ?? 0),
      color: "#ED6C02",
      items: Array.isArray(domesticDetails.lifetimeYes) ? domesticDetails.lifetimeYes : [],
    },
    {
      key: "last12MonthsYes",
      label: "Sofreram nos últimos 12 meses",
      value: Number(dv.last12MonthsYes ?? 0),
      color: "#C2185B",
      items: Array.isArray(domesticDetails.last12MonthsYes) ? domesticDetails.last12MonthsYes : [],
    },
    {
      key: "soughtHelp",
      label: "Buscaram ajuda",
      value: Number(dv.soughtHelp ?? 0),
      color: "#F9A825",
      items: Array.isArray(domesticDetails.soughtHelp) ? domesticDetails.soughtHelp : [],
    },
  ];

  const recruitMetrics = [
    {
      key: "total",
      label: "Total de respondentes (recrutas)",
      value: Number(r.totalResponses ?? 0),
      items: Array.isArray(recruitDetails.total) ? recruitDetails.total : [],
    },
    {
      key: "safe",
      label: "Sentem-se seguros(as) para denunciar",
      value: Number(r.safeCount ?? 0),
      color: "#2E7D32",
      items: Array.isArray(recruitDetails.safe) ? recruitDetails.safe : [],
    },
    {
      key: "knowReportProcess",
      label: "Conhecem o canal de denúncia",
      value: Number(r.knowProcess ?? 0),
      color: "#0288D1",
      items: Array.isArray(recruitDetails.knowReportProcess) ? recruitDetails.knowReportProcess : [],
    },
  ];

  const complaintMetrics = [
    {
      key: "total",
      label: "Total de denúncias/casos",
      value: Number(c.totalCases ?? 0),
      items: Array.isArray(complaintDetails.total) ? complaintDetails.total : [],
    },
    {
      key: "open",
      label: "Casos abertos/ativos",
      value: Number(c.openCases ?? 0),
      color: "#D32F2F",
      items: Array.isArray(complaintDetails.open) ? complaintDetails.open : [],
    },
    {
      key: "concluded",
      label: "Casos concluídos",
      value: Number(c.concludedCases ?? 0),
      color: "#2E7D32",
      items: Array.isArray(complaintDetails.concluded) ? complaintDetails.concluded : [],
    },
    {
      key: "moral",
      label: "Assédio Moral",
      value: Number(c.moral ?? 0),
      color: "#ED6C02",
      items: Array.isArray(complaintDetails.moral) ? complaintDetails.moral : [],
    },
    {
      key: "sexual",
      label: "Assédio Sexual",
      value: Number(c.sexual ?? 0),
      color: "#D32F2F",
      items: Array.isArray(complaintDetails.sexual) ? complaintDetails.sexual : [],
    },
    {
      key: "cpca",
      label: "CPCA",
      value: Number(c.byCpca ?? 0),
      color: "#1A3C6E",
      items: Array.isArray(complaintDetails.cpca) ? complaintDetails.cpca : [],
    },
    {
      key: "smif",
      label: "SMIF",
      value: Number(c.bySmif ?? 0),
      color: "#7B1FA2",
      items: Array.isArray(complaintDetails.smif) ? complaintDetails.smif : [],
    },
  ];

  const activityMetrics = [
    {
      key: "total",
      label: "Total de atividades",
      value: Number(a.totalActivities ?? 0),
      color: undefined,
      items: Array.isArray(activityDetails.total) ? activityDetails.total : [],
    },
    {
      key: "smif",
      label: "SMIF",
      value: Number(a.smif ?? 0),
      color: "#4E342E",
      items: Array.isArray(activityDetails.smif) ? activityDetails.smif : [],
    },
    {
      key: "cipavd",
      label: "CIPAVD",
      value: Number(a.cipavd ?? 0),
      color: "#7B1FA2",
      items: Array.isArray(activityDetails.cipavd) ? activityDetails.cipavd : [],
    },
    {
      key: "done",
      label: "Concluídas",
      value: Number(a.done ?? 0),
      color: "#2E7D32",
      items: Array.isArray(activityDetails.done) ? activityDetails.done : [],
    },
    {
      key: "withReport",
      label: "Relatórios preenchidos",
      value: Number(a.withReport ?? 0),
      color: undefined,
      items: Array.isArray(activityDetails.withReport) ? activityDetails.withReport : [],
    },
    {
      key: "signed",
      label: "Relatórios assinados",
      value: Number(a.signed ?? 0),
      color: "#2E7D32",
      items: Array.isArray(activityDetails.signed) ? activityDetails.signed : [],
    },
  ];

  const missionMetrics = [
    {
      key: "total",
      label: "Total de missões",
      value: Number(m.totalMissions ?? 0),
      items: Array.isArray(missionDetails.total) ? missionDetails.total : [],
    },
    {
      key: "smif",
      label: "SMIF",
      value: Number(m.smif ?? 0),
      color: "#4E342E",
      items: Array.isArray(missionDetails.smif) ? missionDetails.smif : [],
    },
    {
      key: "cipavd",
      label: "CIPAVD",
      value: Number(m.cipavd ?? 0),
      color: "#7B1FA2",
      items: Array.isArray(missionDetails.cipavd) ? missionDetails.cipavd : [],
    },
    {
      key: "localitiesCovered",
      label: "OMs visitadas (distintas)",
      value: Number(m.localitiesCovered ?? 0),
      color: "#0288D1",
      items: Array.isArray(missionDetails.localitiesCovered) ? missionDetails.localitiesCovered : [],
    },
  ];

  const reportFillRate = a.totalActivities
    ? (Number(a.withReport ?? 0) / Math.max(1, Number(a.totalActivities ?? 0))) * 100
    : 0;
  const reportSignRate = a.withReport
    ? (Number(a.signed ?? 0) / Math.max(1, Number(a.withReport ?? 0))) * 100
    : 0;
  const researchSignals = [
    {
      title: "Violência reportada",
      value: `${s.violenceRatePercent ?? 0}%`,
      helper: `${s.yesCount ?? 0} de ${s.totalResponses ?? 0} respondentes relataram violência.`,
      color: "#D32F2F",
      detail: "surveys",
    },
    {
      title: "Violência doméstica recente",
      value: `${dv.last12MonthsRatePercent ?? 0}%`,
      helper: `${dv.last12MonthsYes ?? 0} respondentes declararam ocorrência nos últimos 12 meses.`,
      color: "#C2185B",
      detail: "domesticViolence",
    },
    {
      title: "Prontidão para denunciar",
      value: `${r.safeToReportPercent ?? 0}%`,
      helper: `Segurança ${r.safeToReportPercent ?? 0}% • conhecimento do canal ${r.knowReportProcessPercent ?? 0}%`,
      color: "#2E7D32",
      detail: "recruits",
    },
  ];
  const institutionalResponse = [
    {
      title: "Casos em tratamento",
      value: `${c.openCases ?? 0}`,
      helper: `Total ${c.totalCases ?? 0} • concluídos ${c.concludedCases ?? 0}`,
      color: "#1A3C6E",
      detail: "complaints",
    },
    {
      title: "Resposta em campo",
      value: `${a.done ?? 0}`,
      helper: `Atividades concluídas ${a.done ?? 0} • missões ${m.totalMissions ?? 0}`,
      color: "#4E342E",
      detail: "activities",
    },
    {
      title: "Registro validado",
      value: `${a.signed ?? 0}`,
      helper: `Preenchimento ${reportFillRate.toFixed(1)}% • assinatura ${reportSignRate.toFixed(1)}%`,
      color: "#2E7D32",
      detail: "activities",
    },
  ];
  const executiveAlerts = [
    Number(s.violenceRatePercent ?? 0) >= 20
      ? {
          id: "survey-risk",
          title: "Violência reportada acima do limite",
          description: `${s.violenceRatePercent ?? 0}% relataram violência. Vale priorizar leitura de perfil e território.`,
          detail: "surveys",
        }
      : null,
    Number(dv.last12MonthsRatePercent ?? 0) >= 10
      ? {
          id: "domestic-recent",
          title: "Violência doméstica recente em destaque",
          description: `${dv.last12MonthsRatePercent ?? 0}% apontam ocorrência recente e possível demanda institucional imediata.`,
          detail: "domesticViolence",
        }
      : null,
    Number(r.safeToReportPercent ?? 0) > 0 &&
    (Number(r.safeToReportPercent ?? 0) < 60 ||
      Number(r.knowReportProcessPercent ?? 0) < 60)
      ? {
          id: "recruits-underreport",
          title: "Risco de subnotificação entre recrutas",
          description: `Segurança para denunciar em ${r.safeToReportPercent ?? 0}% e conhecimento do canal em ${r.knowReportProcessPercent ?? 0}%.`,
          detail: "recruits",
        }
      : null,
    Number(c.openCases ?? 0) > 0
      ? {
          id: "open-complaints",
          title: "Passivo de casos em tratamento",
          description: `${c.openCases ?? 0} casos seguem abertos e exigem monitoramento gerencial.`,
          detail: "complaints",
        }
      : null,
    Number(a.totalActivities ?? 0) > 0 && reportSignRate < 60
      ? {
          id: "report-compliance",
          title: "Baixa validação de relatórios de campo",
          description: `Apenas ${reportSignRate.toFixed(1)}% dos relatórios preenchidos foram assinados.`,
          detail: "activities",
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    description: string;
    detail: string;
  }>;

  const renderModalContent = () => {
    switch (detailModal) {
      case "surveys":
        return (
          <Stack spacing={1.25}>
            <AiCopilotCtaRow
              title="Levar este indicador para a IA"
              subtitle="Use a IA para explicar a taxa, gerar um briefing executivo ou transformar o sinal em proposta de atuação."
              {...buildStrategicCopilotLinks({
                label: "Violência reportada",
                description: `${s.violenceRatePercent ?? 0}% dos respondentes declararam violência na pesquisa institucional.`,
              })}
            />
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="A Taxa de violência mostra o percentual de respondentes da Pesquisa de Violência que declararam já ter sofrido algum tipo de violência. Os demais números do modal mostram a base total de respondentes e como essa base se divide entre respostas SIM e NÃO."
              source="Fonte: módulo BI > Pesquisas. Base: respostas da Pesquisa de Violência aplicadas nas localidades visitadas pela comissão."
            />
            <DetailAccordionSection
              title="Leitura executiva"
              subtitle="Como interpretar este KPI no contexto da gestão"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Taxa de violência" value={`${s.violenceRatePercent ?? 0}%`} color="#D32F2F" />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Este KPI é lido diretamente da Pesquisa de Violência. Se a taxa subir, isso indica maior proporção de respondentes que reportaram experiência de violência dentro do universo pesquisado, o que tende a pressionar prevenção, acolhimento e capacidade institucional de resposta.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Composição do indicador"
              subtitle="Itens que sustentam o total e permitem chegar ao registro detalhado"
              defaultExpanded
            >
              <Stack spacing={1}>
                {surveysMetrics.map((metric) => (
                  <ExpandableKpiMetricRow
                    key={metric.key}
                    metricKey={`surveys-${metric.key}`}
                    label={metric.label}
                    value={metric.value}
                    color={metric.color}
                    items={metric.items}
                    expandedKey={expandedMetric}
                    onToggle={(metricKey) =>
                      setExpandedMetric((prev) =>
                        prev === metricKey ? null : metricKey,
                      )
                    }
                  />
                ))}
              </Stack>
            </DetailAccordionSection>
          </Stack>
        );
      case "domesticViolence":
        return (
          <Stack spacing={1.25}>
            <AiCopilotCtaRow
              title="Levar este indicador para a IA"
              subtitle="Abra a IA com foco em violência doméstica recente para aprofundar explicação, briefing ou resposta institucional."
              {...buildStrategicCopilotLinks({
                label: "Violência doméstica recente",
                description: `${dv.last12MonthsRatePercent ?? 0}% apontam ocorrência de violência doméstica nos últimos 12 meses.`,
              })}
            />
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Os indicadores deste bloco medem a violência doméstica autorreferida na pesquisa específica de violência doméstica. 'Alguma vez' captura histórico de vida; 'últimos 12 meses' mostra recorrência recente; 'buscaram ajuda' mede reação institucional e rede de apoio."
              source="Fonte: módulo BI > Violência Doméstica. Base: respostas da pesquisa específica de violência doméstica aplicada nas localidades visitadas."
            />
            <DetailAccordionSection
              title="Leitura executiva"
              subtitle="Histórico, recorrência recente e reação institucional"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Taxa — alguma vez na vida" value={`${dv.lifetimeRatePercent ?? 0}%`} color="#ED6C02" />
                <DetailRow label="Taxa — últimos 12 meses" value={`${dv.last12MonthsRatePercent ?? 0}%`} color="#C2185B" />
                <DetailRow label="Taxa de busca de ajuda" value={`${dv.soughtHelpPercent ?? 0}%`} />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  A taxa de busca de ajuda é calculada sobre o subconjunto que declarou ter sofrido violência em algum momento. Isso ajuda a distinguir ocorrência de violência da capacidade de reação e acolhimento.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Composição do indicador"
              subtitle="Itens detalhados que formam cada métrica"
              defaultExpanded
            >
              <Stack spacing={1}>
                {domesticMetrics.map((metric) => (
                  <ExpandableKpiMetricRow
                    key={metric.key}
                    metricKey={`domestic-${metric.key}`}
                    label={metric.label}
                    value={metric.value}
                    color={metric.color}
                    items={metric.items}
                    expandedKey={expandedMetric}
                    onToggle={(metricKey) =>
                      setExpandedMetric((prev) =>
                        prev === metricKey ? null : metricKey,
                      )
                    }
                  />
                ))}
              </Stack>
            </DetailAccordionSection>
          </Stack>
        );
      case "recruits":
        return (
          <Stack spacing={1.25}>
            <AiCopilotCtaRow
              title="Levar este indicador para a IA"
              subtitle="Use a IA para explicar risco de subnotificação entre recrutas, gerar briefing ou montar resposta de prevenção."
              {...buildStrategicCopilotLinks({
                label: "Prontidão para denunciar entre recrutas",
                description: `Segurança para denunciar em ${r.safeToReportPercent ?? 0}% e conhecimento do canal em ${r.knowReportProcessPercent ?? 0}%.`,
              })}
            />
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Os indicadores de recrutas medem percepção institucional. 'Segurança para denunciar' indica confiança para buscar ajuda; 'conhecimento do canal' indica preparo informacional mínimo para acionar o fluxo correto."
              source="Fonte: módulo BI > Pesquisa de Recrutas do SMIF. Base: respostas das recrutas sobre percepção de segurança e conhecimento dos canais."
            />
            <DetailAccordionSection
              title="Leitura executiva"
              subtitle="Prontidão do ambiente para denúncia e acolhimento"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Taxa de segurança para denúncia" value={`${r.safeToReportPercent ?? 0}%`} color="#2E7D32" />
                <DetailRow label="Taxa de conhecimento do canal" value={`${r.knowReportProcessPercent ?? 0}%`} color="#0288D1" />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Esses números não medem ocorrência de caso, mas prontidão do ambiente para denúncia e acolhimento. Queda nesses indicadores tende a sinalizar risco de subnotificação.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Composição do indicador"
              subtitle="Itens usados para construir o percentual e abrir o detalhe"
              defaultExpanded
            >
              <Stack spacing={1}>
                {recruitMetrics.map((metric) => (
                  <ExpandableKpiMetricRow
                    key={metric.key}
                    metricKey={`recruits-${metric.key}`}
                    label={metric.label}
                    value={metric.value}
                    color={metric.color}
                    items={metric.items}
                    expandedKey={expandedMetric}
                    onToggle={(metricKey) =>
                      setExpandedMetric((prev) =>
                        prev === metricKey ? null : metricKey,
                      )
                    }
                  />
                ))}
              </Stack>
            </DetailAccordionSection>
          </Stack>
        );
      case "complaints":
        return (
          <Stack spacing={1.25}>
            <AiCopilotCtaRow
              title="Levar este indicador para a IA"
              subtitle="Abra a IA já focada nos casos formais para explicar o passivo, gerar briefing ou propor ação prioritária."
              {...buildStrategicCopilotLinks({
                label: "Casos em tratamento",
                description: `${c.openCases ?? 0} casos seguem abertos no recorte atual, sobre um total de ${c.totalCases ?? 0}.`,
              })}
            />
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Este bloco consolida os casos e denúncias efetivamente registrados no sistema, somando fluxos CPCA e SMIF. Ele mostra carga real de tratamento institucional, status atual e distribuição por tipo e fluxo."
              source="Fonte: registros de denúncias do sistema, com origem nos módulos CPCA e SMIF."
            />
            <DetailAccordionSection
              title="Leitura executiva"
              subtitle="Carga real de tratamento institucional em andamento"
              defaultExpanded
            >
              <Stack spacing={1}>
                {complaintMetrics.map((metric) => (
                  <ExpandableKpiMetricRow
                    key={metric.key}
                    metricKey={`complaints-${metric.key}`}
                    label={metric.label}
                    value={metric.value}
                    color={metric.color}
                    items={metric.items}
                    expandedKey={expandedMetric}
                    onToggle={(metricKey) =>
                      setExpandedMetric((prev) =>
                        prev === metricKey ? null : metricKey,
                      )
                    }
                  />
                ))}
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Distribuição por tipologia"
              subtitle="Leitura rápida do peso relativo entre assédio moral e sexual"
            >
              <Stack spacing={1}>
                <DetailRow label="Assédio Moral (%)" value={`${c.moralPercent ?? 0}%`} color="#ED6C02" />
                <DetailRow label="Assédio Sexual (%)" value={`${c.sexualPercent ?? 0}%`} color="#D32F2F" />
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Distribuição por fluxo"
              subtitle="Participação relativa entre CPCA e SMIF no total registrado"
            >
              <Stack spacing={1}>
                <DetailRow label="CPCA (%)" value={`${c.totalCases ? ((Number(c.byCpca ?? 0) / Number(c.totalCases ?? 1)) * 100).toFixed(1) : "0.0"}%`} color="#1A3C6E" />
                <DetailRow label="SMIF (%)" value={`${c.totalCases ? ((Number(c.bySmif ?? 0) / Number(c.totalCases ?? 1)) * 100).toFixed(1) : "0.0"}%`} color="#7B1FA2" />
              </Stack>
            </DetailAccordionSection>
          </Stack>
        );
      case "activities":
        return (
          <Stack spacing={1.25}>
            <AiCopilotCtaRow
              title="Levar este indicador para a IA"
              subtitle="Use a IA para relacionar execução em campo, maturidade de registro e necessidade de reforço operacional."
              {...buildStrategicCopilotLinks({
                label: "Resposta em campo",
                description: `${a.done ?? 0} atividades concluídas e ${a.signed ?? 0} relatórios assinados no recorte atual.`,
              })}
            />
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Os números de atividades mostram execução operacional em campo. Eles distinguem o que foi realizado em SMIF e CIPAVD e ainda indicam maturidade de registro por meio de relatório preenchido e relatório assinado."
              source="Fonte: registros de Atividades de Campo do sistema, com status operacional e vínculo de relatório."
            />
            <DetailAccordionSection
              title="Leitura executiva"
              subtitle="Execução em campo e maturidade do registro operacional"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow
                  label="Taxa de preenchimento"
                  value={a.totalActivities ? `${((a.withReport / a.totalActivities) * 100).toFixed(1)}%` : "0%"}
                />
                <DetailRow
                  label="Taxa de assinatura"
                  value={a.withReport ? `${((a.signed / a.withReport) * 100).toFixed(1)}%` : "0%"}
                />
                <Typography variant="caption" color="text.secondary">
                  Clique na seta ao lado de cada número para ver a lista exata de atividades e abrir cada item.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Composição do indicador"
              subtitle="Atividades que sustentam o volume operacional"
              defaultExpanded
            >
              <Stack spacing={1}>
                {activityMetrics.map((metric) => (
                  <ExpandableActivityMetricRow
                    key={metric.key}
                    metricKey={metric.key}
                    label={metric.label}
                    value={metric.value}
                    color={metric.color}
                    items={metric.items}
                    expandedKey={expandedMetric}
                    onToggle={(metricKey) =>
                      setExpandedMetric((prev) =>
                        prev === metricKey ? null : metricKey,
                      )
                    }
                  />
                ))}
              </Stack>
            </DetailAccordionSection>
          </Stack>
        );
      case "missions":
        return (
          <Stack spacing={1.25}>
            <AiCopilotCtaRow
              title="Levar este indicador para a IA"
              subtitle="Abra a IA com foco nas missões do recorte para explicar alcance, gerar briefing ou transformar o cenário em nova frente de atuação."
              {...buildStrategicCopilotLinks({
                label: "Missões realizadas",
                description: `${m.totalMissions ?? 0} missões registradas, cobrindo ${m.localitiesCovered ?? 0} OMs distintas.`,
              })}
            />
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="As missões representam deslocamentos e frentes operacionais cadastradas no sistema. O detalhamento mostra volume por escopo e quantas OMs distintas já foram efetivamente alcançadas pelas missões lançadas."
              source="Fonte: módulo Missões, considerando registros ativos de SMIF e CIPAVD."
            />
            <DetailAccordionSection
              title="Leitura executiva"
              subtitle="Volume de frentes operacionais e alcance territorial"
              defaultExpanded
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Missões realizadas pela comissão itinerante em todo o território nacional. O foco aqui é entender quantas frentes foram abertas, por qual escopo e quantas OMs distintas já receberam atuação registrada.
              </Typography>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Composição do indicador"
              subtitle="Missões cadastradas e seus agrupamentos principais"
              defaultExpanded
            >
              <Stack spacing={1}>
                {missionMetrics.map((metric) => (
                  <ExpandableKpiMetricRow
                    key={metric.key}
                    metricKey={`missions-${metric.key}`}
                    label={metric.label}
                    value={metric.value}
                    color={metric.color}
                    items={metric.items}
                    expandedKey={expandedMetric}
                    onToggle={(metricKey) =>
                      setExpandedMetric((prev) =>
                        prev === metricKey ? null : metricKey,
                      )
                    }
                  />
                ))}
              </Stack>
            </DetailAccordionSection>
          </Stack>
        );
      default:
        return null;
    }
  };

  const modalTitles: Record<string, string> = {
    surveys: "Detalhamento — Pesquisas de Violência",
    domesticViolence: "Detalhamento — Violência Doméstica",
    recruits: "Detalhamento — Pesquisa com Recrutas",
    complaints: "Detalhamento — Denúncias/Casos",
    activities: "Detalhamento — Atividades de Campo",
    missions: "Detalhamento — Missões Realizadas",
  };

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Violência reportada"
            value={`${s.violenceRatePercent ?? 0}%`}
            subtitle={`${s.yesCount ?? 0} de ${s.totalResponses ?? 0} respondentes`}
            color="#D32F2F"
            onClick={() => setDetailModal("surveys")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Violência doméstica recente"
            value={`${dv.last12MonthsRatePercent ?? 0}%`}
            subtitle={`${dv.last12MonthsYes ?? 0} de ${dv.totalResponses ?? 0}`}
            color="#C2185B"
            onClick={() => setDetailModal("domesticViolence")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Casos em tratamento"
            value={c.openCases ?? 0}
            subtitle={`Total ${c.totalCases ?? 0} | CPCA ${c.byCpca ?? 0} | SMIF ${c.bySmif ?? 0}`}
            color="#1A3C6E"
            onClick={() => setDetailModal("complaints")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Resposta em campo"
            value={a.totalActivities ?? 0}
            subtitle={`Concluídas: ${a.done ?? 0} | Missões: ${m.totalMissions ?? 0}`}
            color="#4E342E"
            onClick={() => setDetailModal("activities")}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Sinais de risco
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                O que as pesquisas estão sinalizando agora. O detalhe analítico permanece nos modais e na IA.
              </Typography>
              <Stack spacing={1.2}>
                {researchSignals.map((signal) => (
                  <Box
                    key={signal.title}
                    sx={{
                      border: "1px solid #E5EAF2",
                      borderRadius: 2,
                      p: 1.2,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {signal.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {signal.helper}
                        </Typography>
                      </Box>
                      <Chip
                        label={signal.value}
                        sx={{ bgcolor: signal.color, color: "#fff", fontWeight: 700 }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Button size="small" variant="outlined" onClick={() => setDetailModal("surveys")}>
                  Violência
                </Button>
                <Button size="small" variant="outlined" onClick={() => setDetailModal("domesticViolence")}>
                  Violência doméstica
                </Button>
                <Button size="small" variant="outlined" onClick={() => setDetailModal("recruits")}>
                  Recrutas
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Capacidade de resposta
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                O que o sistema já transformou em resposta: tratamento, presença em campo e qualidade de registro.
              </Typography>
              <Stack spacing={1.2}>
                {institutionalResponse.map((item) => (
                  <Box
                    key={item.title}
                    sx={{
                      border: "1px solid #E5EAF2",
                      borderRadius: 2,
                      p: 1.2,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {item.helper}
                        </Typography>
                      </Box>
                      <Chip
                        label={item.value}
                        sx={{ bgcolor: item.color, color: "#fff", fontWeight: 700 }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Button size="small" variant="outlined" onClick={() => setDetailModal("complaints")}>
                  Denúncias
                </Button>
                <Button size="small" variant="outlined" onClick={() => setDetailModal("activities")}>
                  Atividades
                </Button>
                <Button size="small" variant="outlined" onClick={() => setDetailModal("missions")}>
                  Missões
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                O que exige atenção agora
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Leitura rápida dos sinais que merecem acompanhamento imediato da gestão.
              </Typography>
              {executiveAlerts.length ? (
                <List disablePadding>
                  {executiveAlerts.map((item, index) => (
                    <ListItem
                      key={item.id}
                      divider={index < executiveAlerts.length - 1}
                      sx={{ px: 0, alignItems: "flex-start" }}
                    >
                      <ListItemText
                        primary={item.title}
                        secondary={
                          <Stack spacing={1.2} sx={{ mt: 0.3 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                              {item.description}
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                              <Button size="small" variant="outlined" onClick={() => setDetailModal(item.detail)}>
                                Ver detalhe
                              </Button>
                            </Stack>
                            <AiCopilotCtaRow
                              compact
                              title="Levar este alerta para a IA"
                              subtitle="Explique o sinal, gere um briefing executivo ou converta o recorte em ação."
                              {...buildStrategicCopilotLinks({
                                label: item.title,
                                description: item.description,
                              })}
                            />
                          </Stack>
                        }
                        primaryTypographyProps={{ fontWeight: 700 }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sem alertas executivos críticos no recorte atual.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <KpiDetailModal
        open={!!detailModal}
        title={modalTitles[detailModal ?? ""] ?? ""}
        onClose={() => setDetailModal(null)}
        maxWidth="lg"
      >
        {renderModalContent()}
      </KpiDetailModal>
    </Box>
  );
}

function AggressorProfileTab() {
  const { data, isLoading, error } = useAggressorProfile();
  const [detailModal, setDetailModal] = useState<string | null>(null);
  if (isLoading) return <SkeletonState />;
  if (error)
    return <ErrorState message="Erro ao carregar perfil do agressor." />;
  if (!data || data.totalCases === 0)
    return (
      <EmptyState message="Nenhum caso de assédio/violência registrado ainda. Os dados aparecerão aqui conforme casos forem inseridos." />
    );

  const detailItems = (data.detailItems ?? {}) as Record<
    string,
    StrategicLinkedDetailItem[]
  >;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Casos analisados"
            value={data.totalCases}
            subtitle="Base usada para leitura do perfil"
            color="#1A3C6E"
            onClick={() => setDetailModal("total")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Assédio Moral"
            value={`${data.byComplaintType.moral.count}`}
            subtitle={`${data.byComplaintType.moral.percent}% dos casos`}
            color="#ED6C02"
            onClick={() => setDetailModal("moral")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Assédio Sexual"
            value={`${data.byComplaintType.sexual.count}`}
            subtitle={`${data.byComplaintType.sexual.percent}% dos casos`}
            color="#D32F2F"
            onClick={() => setDetailModal("sexual")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Assimetria hierárquica"
            value={`${data.hierarchicalRelation.percent}%`}
            subtitle={`${data.hierarchicalRelation.count} casos com superior hierárquico`}
            color="#7B1FA2"
            onClick={() => setDetailModal("hierarchical")}
          />
        </Grid>
      </Grid>

      <KpiDetailModal
        open={!!detailModal}
        title={
          detailModal === "total" ? "Visão Geral dos Casos" :
          detailModal === "moral" ? "Detalhes — Assédio Moral" :
          detailModal === "sexual" ? "Detalhes — Assédio Sexual" :
          "Detalhes — Relação Hierárquica"
        }
        onClose={() => setDetailModal(null)}
        maxWidth="lg"
      >
        {detailModal === "total" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Este total reúne todos os casos usados para montar o perfil do agressor. A lista abaixo mostra exatamente quais denúncias formam o agregado, para que o gestor consiga sair do KPI e chegar ao registro real."
              source="Fonte: denúncias CPCA e SMIF consolidadas no painel de Perfil de Assédio."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Leitura consolidada do conjunto usado no painel"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Total de casos registrados" value={data.totalCases} />
                <DetailRow label="Assédio Moral" value={`${data.byComplaintType.moral.count} (${data.byComplaintType.moral.percent}%)`} color="#ED6C02" />
                <DetailRow label="Assédio Sexual" value={`${data.byComplaintType.sexual.count} (${data.byComplaintType.sexual.percent}%)`} color="#D32F2F" />
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Distribuição por escopo"
              subtitle="Como o total se divide entre CPCA e SMIF"
            >
              <Stack spacing={1}>
                {(data.byScope ?? []).map((s: any) => (
                  <DetailRow key={s.label} label={s.label} value={`${s.count} (${s.percent}%)`} />
                ))}
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Casos que compõem o total"
              subtitle="Lista operacional para chegar do KPI ao registro real"
            >
              <DetailItemList
                items={Array.isArray(detailItems.total) ? detailItems.total : []}
                emptyMessage="Nenhum caso disponível para detalhamento."
              />
            </DetailAccordionSection>
          </Stack>
        )}
        {detailModal === "moral" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Casos classificados como assédio moral. O detalhamento abaixo mostra quais registros foram enquadrados nessa tipologia."
              source="Fonte: campo de tipificação da denúncia nos módulos CPCA e SMIF."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Peso relativo do assédio moral dentro do total"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Total de casos de assédio moral" value={data.byComplaintType.moral.count} color="#ED6C02" />
                <DetailRow label="Percentual do total" value={`${data.byComplaintType.moral.percent}%`} />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  O assédio moral inclui humilhações, exclusão, ameaças, intimidações, críticas excessivas, injustiças e outras formas de violência psicológica no ambiente de trabalho.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Itens classificados como assédio moral"
              subtitle="Registros usados para compor este KPI"
            >
              <DetailItemList
                items={Array.isArray(detailItems.moral) ? detailItems.moral : []}
                emptyMessage="Nenhum item classificado como assédio moral."
              />
            </DetailAccordionSection>
          </Stack>
        )}
        {detailModal === "sexual" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Casos classificados como assédio sexual. A lista abaixo mostra os registros exatos por trás do KPI, com acesso direto ao fluxo correspondente."
              source="Fonte: campo de tipificação da denúncia nos módulos CPCA e SMIF."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Peso relativo do assédio sexual dentro do total"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Total de casos de assédio sexual" value={data.byComplaintType.sexual.count} color="#D32F2F" />
                <DetailRow label="Percentual do total" value={`${data.byComplaintType.sexual.percent}%`} />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  O assédio sexual inclui comentários sexistas, contato físico indesejado, chantagem por favores sexuais, exibição de material pornográfico e outras formas de violência sexual.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Itens classificados como assédio sexual"
              subtitle="Registros usados para compor este KPI"
            >
              <DetailItemList
                items={Array.isArray(detailItems.sexual) ? detailItems.sexual : []}
                emptyMessage="Nenhum item classificado como assédio sexual."
              />
            </DetailAccordionSection>
          </Stack>
        )}
        {detailModal === "hierarchical" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Conta os casos em que o agressor ocupava posição hierárquica ou funcional superior à vítima. A lista abaixo mostra os registros usados nessa leitura."
              source="Fonte: campo de relação hierárquica/funcional da denúncia."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Peso da assimetria hierárquica nos casos registrados"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Casos com relação hierárquica" value={data.hierarchicalRelation.count} color="#7B1FA2" />
                <DetailRow label="Percentual do total" value={`${data.hierarchicalRelation.percent}%`} />
                <DetailRow label="Total de casos" value={data.totalCases} />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {data.hierarchicalRelation.description}. Inclui relações de superior hierárquico, chefe imediato ou instrutor/professor com subordinado.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Itens com relação hierárquica"
              subtitle="Registros usados para compor este KPI"
            >
              <DetailItemList
                items={Array.isArray(detailItems.hierarchical) ? detailItems.hierarchical : []}
                emptyMessage="Nenhum item com relação hierárquica identificado."
              />
            </DetailAccordionSection>
          </Stack>
        )}
      </KpiDetailModal>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Quem agride
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Posto/graduação"
            data={data.aggressorProfile.byRank}
            color="#D32F2F"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Gênero"
            data={data.aggressorProfile.byGender.map((d: any) => ({
              ...d,
              label: GENDER_LABELS[d.label] ?? d.label,
            }))}
            color="#ED6C02"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Faixa etária"
            data={data.aggressorProfile.byAgeRange}
            color="#7B1FA2"
          />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Quem sofre
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Posto/graduação"
            data={data.victimProfile.byRank}
            color="#0288D1"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Gênero"
            data={data.victimProfile.byGender.map((d: any) => ({
              ...d,
              label: GENDER_LABELS[d.label] ?? d.label,
            }))}
            color="#00838F"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Faixa etária"
            data={data.victimProfile.byAgeRange}
            color="#2E7D32"
          />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Como os casos acontecem
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <HorizontalBarCard
            title="Tipo detalhado"
            data={data.context.byViolenceType}
            color="#D32F2F"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <HorizontalBarCard
            title="Contexto"
            data={data.context.byHarassmentContext}
            color="#7B1FA2"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Local"
            data={data.context.byLocation}
            color="#4E342E"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Frequência"
            data={data.context.byFrequency}
            color="#ED6C02"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Forma da Ocorrência"
            data={data.context.byForm}
            color="#0288D1"
          />
        </Grid>
      </Grid>
    </Box>
  );
}

const BR_STATES: Record<string, { name: string; path: string; labelX: number; labelY: number }> = {
  AC: { name: "Acre", labelX: 92, labelY: 331,
    path: "M50,291L119,313L194,348L154,373L113,371L116,339L100,350L82,350L80,341L62,338L67,330L46,300L52,295L50,291Z" },
  AL: { name: "Alagoas", labelX: 799, labelY: 338,
    path: "M766,336L776,327L792,337L811,327L828,328L817,343L812,342L815,344L803,360L766,336Z" },
  AM: { name: "Amazonas", labelX: 230, labelY: 198,
    path: "M260,103L274,109L272,115L279,131L276,148L281,160L277,164L290,176L296,176L297,162L303,158L313,165L321,162L327,143L351,143L351,155L360,169L393,192L402,193L359,283L365,296L358,324L293,323L289,327L273,310L256,309L247,318L245,329L232,329L226,338L223,335L212,341L199,338L190,347L119,312L50,291L63,278L61,270L68,251L111,231L127,234L139,171L134,158L125,151L125,136L144,135L140,126L129,126L129,113L163,113L163,107L168,113L178,105L185,124L201,133L215,128L217,135L224,125L239,117L240,120L247,109L260,103Z" },
  AP: { name: "Amapá", labelX: 500, labelY: 112,
    path: "M433,98L446,105L453,100L470,104L497,62L500,69L499,58L505,65L506,74L507,69L514,106L530,113L532,121L526,123L531,124L513,144L502,149L495,168L487,172L470,152L460,123L434,112L433,98Z" },
  BA: { name: "Bahia", labelX: 705, labelY: 408,
    path: "M615,357L624,366L633,368L652,359L657,347L654,338L661,336L678,341L693,335L703,324L713,327L718,340L743,320L765,330L775,352L775,364L766,369L775,381L784,380L764,410L757,403L755,408L756,409L749,420L751,429L748,427L750,436L752,430L749,447L754,471L748,510L737,523L718,504L720,493L726,492L733,477L726,470L704,469L694,455L688,457L667,446L656,448L654,440L646,437L608,458L611,440L605,430L609,411L603,398L608,383L598,377L604,366L615,357Z" },
  CE: { name: "Ceará", labelX: 735, labelY: 258,
    path: "M720,297L722,285L715,278L706,243L709,233L701,216L704,206L721,204L731,205L761,222L786,245L776,250L759,274L756,288L760,295L751,306L737,297L720,297Z" },
  DF: { name: "Distrito Federal", labelX: 576, labelY: 470,
    path: "M584,475L564,475L566,464L581,464L584,475Z" },
  ES: { name: "Espírito Santo", labelX: 720, labelY: 548,
    path: "M726,516L737,523L735,550L711,586L696,583L693,566L703,563L712,545L706,534L712,533L708,522L715,519L712,515L726,516Z" },
  GO: { name: "Goiás", labelX: 553, labelY: 469,
    path: "M510,548L471,530L473,525L468,523L464,507L475,480L491,470L496,457L507,451L522,402L527,400L524,410L541,417L549,405L554,420L566,413L576,419L576,414L579,418L605,407L609,411L605,430L612,447L608,452L599,447L599,454L592,454L593,471L584,475L580,485L587,495L579,505L584,507L584,518L571,526L550,523L542,530L539,527L523,531L510,548ZM584,475L581,464L566,464L564,475L584,475Z" },
  MA: { name: "Maranhão", labelX: 633, labelY: 231,
    path: "M555,256L578,239L588,226L610,169L614,174L615,171L616,175L622,174L621,179L624,174L623,183L633,176L634,184L639,185L633,194L637,197L641,191L643,195L637,200L634,214L649,196L643,205L656,198L661,199L662,195L685,205L694,203L691,212L680,217L670,233L674,252L668,267L673,274L672,282L651,284L636,297L620,303L610,328L614,339L611,357L603,354L596,345L599,340L588,330L593,319L600,317L600,309L589,310L575,293L581,278L580,259L563,252L555,256Z" },
  MG: { name: "Minas Gerais", labelX: 622, labelY: 524,
    path: "M509,561L510,548L523,531L539,527L542,530L550,523L571,526L584,517L584,507L579,504L587,494L580,484L584,475L593,471L592,454L599,454L599,447L609,450L608,458L639,440L650,438L654,440L654,447L671,447L688,457L694,455L704,469L726,470L733,476L719,498L726,516L712,515L715,519L708,523L712,533L706,534L712,541L711,548L703,563L693,566L685,596L669,604L654,603L622,616L615,615L614,621L603,621L596,609L600,590L590,589L580,558L553,562L551,568L549,562L545,565L543,558L519,554L509,561Z" },
  MS: { name: "Mato Grosso do Sul", labelX: 426, labelY: 555,
    path: "M374,511L379,515L393,502L406,499L425,510L436,506L446,508L455,500L449,515L468,517L468,524L473,525L471,530L510,548L508,563L497,572L488,595L457,622L445,647L436,642L420,645L411,608L400,604L391,608L368,604L372,580L365,562L371,559L365,553L379,521L374,511Z" },
  MT: { name: "Mato Grosso", labelX: 390, labelY: 431,
    path: "M365,296L376,324L393,338L524,347L514,380L519,409L509,444L468,492L464,507L468,517L449,515L455,500L446,508L436,506L425,510L406,499L393,502L379,515L360,500L361,480L324,480L323,463L316,455L322,455L320,432L313,426L331,400L326,386L330,379L319,371L297,370L295,325L357,325L365,296Z" },
  PA: { name: "Pará", labelX: 460, labelY: 173,
    path: "M433,98L434,112L460,122L479,165L491,171L489,176L475,180L483,178L485,182L512,166L510,170L516,183L512,187L517,184L521,189L530,184L533,190L537,188L541,183L536,202L550,180L549,185L556,175L561,181L560,173L573,159L582,164L581,159L588,161L588,165L590,162L591,166L593,162L595,167L598,165L595,168L601,165L605,170L604,171L608,170L604,191L588,226L578,239L555,255L566,260L565,267L556,282L545,287L543,317L524,347L393,338L376,324L375,314L359,287L402,193L375,180L353,161L349,121L357,122L362,115L368,117L386,107L409,110L405,102L409,97L433,98Z" },
  PB: { name: "Paraíba", labelX: 791, labelY: 292,
    path: "M757,302L760,276L768,279L786,269L780,282L786,285L800,287L805,275L832,279L835,293L835,300L821,298L792,315L784,309L791,299L786,295L769,306L757,302Z" },
  PE: { name: "Pernambuco", labelX: 772, labelY: 314,
    path: "M703,324L719,312L717,297L738,297L749,306L757,302L766,306L786,294L791,299L784,309L792,315L803,306L813,306L825,297L835,302L828,328L811,327L792,337L776,327L766,336L761,326L758,329L743,320L718,340L713,327L703,324Z" },
  PI: { name: "Piauí", labelX: 668, labelY: 293,
    path: "M611,357L614,339L610,328L620,303L636,297L651,284L672,283L674,276L668,261L674,252L670,233L680,217L691,212L693,203L704,206L701,217L709,235L707,247L716,282L722,285L717,299L719,312L693,335L678,341L661,336L653,339L656,351L647,363L628,368L618,357L611,357Z" },
  PR: { name: "Paraná", labelX: 524, labelY: 666,
    path: "M444,647L457,622L470,614L488,613L514,623L529,622L536,630L537,643L545,653L543,661L558,661L558,669L565,668L569,673L565,678L563,673L560,679L555,676L562,681L554,687L558,690L539,695L517,690L514,696L505,697L501,706L455,696L450,682L436,681L444,647Z" },
  RJ: { name: "Rio de Janeiro", labelX: 666, labelY: 612,
    path: "M693,576L696,583L711,586L711,601L691,614L690,623L670,623L669,617L666,624L650,626L658,624L643,622L636,626L640,630L633,630L634,624L647,617L633,611L684,596L687,580L693,576Z" },
  RN: { name: "Rio Grande do Norte", labelX: 805, labelY: 254,
    path: "M760,277L776,250L786,245L800,251L821,251L832,279L803,275L797,288L795,284L781,282L787,269L768,279L760,277Z" },
  RO: { name: "Rondônia", labelX: 256, labelY: 362,
    path: "M194,348L190,347L199,338L212,341L223,335L225,339L231,329L245,329L247,318L256,309L271,310L285,325L293,323L298,327L297,370L328,374L330,404L313,426L307,421L291,423L285,415L272,412L266,405L241,401L227,391L219,376L219,344L194,348Z" },
  RR: { name: "Roraima", labelX: 296, labelY: 90,
    path: "M349,121L351,143L327,143L321,162L313,165L303,158L297,162L295,176L290,176L277,164L281,160L276,148L278,131L272,115L273,108L261,104L260,99L246,98L243,76L231,61L244,65L247,70L260,68L270,76L272,66L296,62L315,50L313,43L325,42L328,46L324,56L334,59L337,68L331,75L329,100L334,112L348,121Z" },
  RS: { name: "Rio Grande do Sul", labelX: 474, labelY: 780,
    path: "M452,716L485,719L502,727L517,744L535,749L526,763L535,766L517,802L487,833L487,824L504,816L506,806L510,808L515,798L515,790L518,792L517,786L511,792L503,782L502,787L507,790L504,800L501,797L500,807L490,813L485,822L487,832L476,856L461,870L458,857L467,846L454,830L424,811L417,801L408,807L408,800L392,784L383,788L376,786L410,744L415,745L413,741L432,725L452,716Z" },
  SC: { name: "Santa Catarina", labelX: 531, labelY: 722,
    path: "M535,766L526,765L534,746L517,744L502,727L468,715L452,716L455,696L501,706L505,697L514,695L517,690L539,695L558,690L556,695L553,692L560,716L557,741L535,766Z" },
  SE: { name: "Sergipe", labelX: 782, labelY: 362,
    path: "M771,340L792,350L803,360L788,373L785,371L788,374L777,382L766,368L775,363L771,340Z" },
  SP: { name: "São Paulo", labelX: 573, labelY: 614,
    path: "M465,617L488,595L497,572L519,554L544,558L545,565L549,562L551,568L553,562L580,558L590,589L600,590L596,609L602,614L603,621L614,621L615,615L633,611L647,617L634,623L635,632L622,637L621,642L612,640L604,646L602,643L568,669L572,669L568,675L565,668L558,669L558,661L543,661L545,653L537,643L536,630L530,622L514,623L488,613L465,617Z" },
  TO: { name: "Tocantins", labelX: 572, labelY: 349,
    path: "M524,347L543,317L545,288L556,282L564,271L566,261L555,256L561,252L572,254L580,259L582,274L575,293L589,310L600,309L600,317L593,319L588,330L599,340L596,345L603,354L615,357L604,366L598,377L608,383L604,387L608,390L603,394L605,408L579,418L576,414L576,419L566,413L556,415L555,420L549,405L542,417L524,410L526,399L517,408L514,380L524,347Z" },
};

function BrazilMap({
  stateData,
  onStateClick,
}: {
  stateData: Record<string, { total: number; complaints: number; activities: number; missions: number; localities: string[] }>;
  onStateClick?: (uf: string, data: any) => void;
}) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const maxTotal = useMemo(() => {
    let max = 1;
    for (const v of Object.values(stateData)) {
      const t = v.total;
      if (t > max) max = t;
    }
    return max;
  }, [stateData]);

  const getColor = (uf: string) => {
    const d = stateData[uf];
    if (!d || d.total === 0) return "#E8EAF0";
    const intensity = Math.max(0.15, d.total / maxTotal);
    const r = Math.round(26 + (210 - 26) * (1 - intensity));
    const g = Math.round(60 + (230 - 60) * (1 - intensity));
    const b = Math.round(110 + (240 - 110) * (1 - intensity));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
      <svg viewBox="20 20 860 880" style={{ width: "100%", maxHeight: 620 }}>
        <defs>
          <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">
            <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>
        {Object.entries(BR_STATES).map(([uf, { path }]) => (
          <Tooltip
            key={uf}
            title={
              stateData[uf]
                ? `${BR_STATES[uf].name} (${uf}): ${stateData[uf].total} registros — ${stateData[uf].complaints} denúncias, ${stateData[uf].activities} atividades, ${stateData[uf].missions} missões`
                : `${BR_STATES[uf].name} (${uf}): sem dados`
            }
            arrow
          >
            <path
              d={path}
              fill={hoveredState === uf ? "#F9A825" : getColor(uf)}
              stroke="#fff"
              strokeWidth={1.5}
              strokeLinejoin="round"
              cursor="pointer"
              filter="url(#shadow)"
              style={{ transition: "fill 0.2s ease" }}
              onMouseEnter={() => setHoveredState(uf)}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => onStateClick?.(uf, stateData[uf])}
            />
          </Tooltip>
        ))}
        {Object.entries(BR_STATES).map(([uf, { labelX, labelY }]) => (
          <text
            key={`label-${uf}`}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontWeight={700}
            fill={stateData[uf]?.total ? "#fff" : "#888"}
            pointerEvents="none"
            style={{ textShadow: stateData[uf]?.total ? "0 1px 3px rgba(0,0,0,0.5)" : "none" }}
          >
            {uf}
          </text>
        ))}
      </svg>
    </Box>
  );
}

function GeoMapTab() {
  const aggressorProfileQuery = useAggressorProfile();
  const { data, isLoading, error } = useGeoMap();
  const [selectedState, setSelectedState] = useState<{ uf: string; data: any } | null>(null);
  const [geoKpiModal, setGeoKpiModal] = useState<
    "mappedOms" | "cpca" | "statesWithData" | null
  >(null);

  if (isLoading) return <SkeletonState />;
  if (error) return <ErrorState message="Erro ao carregar mapa geográfico." />;
  if (!data) return <EmptyState message="Sem dados geográficos." />;

  const omsCatalog = Array.isArray(data.omsCatalog) ? data.omsCatalog : [];
  const coveredOmsCatalog = Array.isArray(data.cpcaCoveredOmsCatalog)
    ? data.cpcaCoveredOmsCatalog
    : [];
  const omsCoveredByCpca = coveredOmsCatalog.length > 0
    ? coveredOmsCatalog
    : omsCatalog.filter((loc: any) => Boolean(loc?.hasCpca));
  const totalOmsCoveredByCpca = Number(
    data.totalOmsCoveredByCpca ?? omsCoveredByCpca.length,
  );
  const totalOms = omsCatalog.length;
  const statesWithData = (data.states ?? []).filter(
    (s: any) => s.complaints + s.activities + s.missions > 0,
  );
  const localityDistribution = Array.isArray(aggressorProfileQuery.data?.byLocality)
    ? aggressorProfileQuery.data.byLocality
        .map((item: any) => ({
          label:
            String(item?.localityName ?? "").trim() ||
            String(item?.localityCode ?? "").trim() ||
            String(item?.label ?? "").trim() ||
            "Não informado",
          count: Number(item.count ?? 0),
          percent: Number(item.percent ?? 0),
        }))
        .filter((item: any) => item.count > 0)
        .slice(0, 15)
    : [];

  const stateDataMap: Record<string, any> = {};
  for (const s of (data.states ?? [])) {
    stateDataMap[s.uf] = {
      total: s.complaints + s.activities + s.missions,
      complaints: s.complaints,
      activities: s.activities,
      missions: s.missions,
      localities: s.localities ?? [],
      oms: s.oms ?? [],
      complaintDetails: s.complaintDetails ?? [],
      activityDetails: s.activityDetails ?? [],
      missionDetails: s.missionDetails ?? [],
    };
  }

  const chartData = (data.states ?? [])
    .filter((s: any) => s.complaints + s.activities + s.missions > 0)
    .slice(0, 15)
    .map((s: any) => ({
      uf: s.uf,
      Denúncias: s.complaints,
      Atividades: s.activities,
      Missões: s.missions,
    }));

  const openStateDetail = (ufRaw: string | null | undefined) => {
    const uf = String(ufRaw ?? "").trim().toUpperCase();
    if (!uf || !stateDataMap[uf]) return;
    setSelectedState({ uf, data: stateDataMap[uf] });
  };

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            title="OMs no mapa"
            value={omsCatalog.length}
            subtitle="Base territorial pronta para cruzamento"
            color="#1A3C6E"
            onClick={() => setGeoKpiModal("mappedOms")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            title="Cobertura CPCA"
            value={totalOmsCoveredByCpca}
            subtitle={totalOms
              ? `${((totalOmsCoveredByCpca / totalOms) * 100).toFixed(0)}% das OMs`
              : ""}
            color="#2E7D32"
            onClick={() => setGeoKpiModal("cpca")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            title="Estados com pressão"
            value={statesWithData.length}
            subtitle="Com denúncia, atividade ou missão"
            color="#ED6C02"
            onClick={() => setGeoKpiModal("statesWithData")}
          />
        </Grid>
      </Grid>

      {data.totalLocalitiesWithUf === 0 && (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: "#FFF8E1", borderColor: "#FFE082" }}>
          <CardContent>
            <Typography variant="subtitle2" color="#F57F17">
              Atenção: Nenhuma localidade possui o campo UF preenchido.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Para visualizar o mapa geográfico, preencha o campo "UF" (sigla do estado, ex: SP, RJ, DF)
              no cadastro de cada localidade/OM na área de administração.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Pressão por estado
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Clique em um estado para abrir o resumo territorial. A intensidade do azul indica volume combinado.
              </Typography>
              <BrazilMap
                stateData={stateDataMap}
                onStateClick={(uf, d) => setSelectedState({ uf, data: d })}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Estados com maior pressão
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Cada barra soma denúncias, atividades e missões. Clique para abrir o estado.
              </Typography>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="uf" type="category" width={35} tick={{ fontSize: 11 }} interval={0} />
                    <RechartsTooltip
                      labelFormatter={(label: string) =>
                        `${BR_STATES[label]?.name ?? label} (${label})`
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="Denúncias"
                      stackId="a"
                      fill="#D32F2F"
                      barSize={16}
                      onClick={(entry: any) => openStateDetail(entry?.uf)}
                    />
                    <Bar
                      dataKey="Atividades"
                      stackId="a"
                      fill="#1A3C6E"
                      barSize={16}
                      onClick={(entry: any) => openStateDetail(entry?.uf)}
                    />
                    <Bar
                      dataKey="Missões"
                      stackId="a"
                      fill="#2E7D32"
                      barSize={16}
                      radius={[0, 4, 4, 0]}
                      onClick={(entry: any) => openStateDetail(entry?.uf)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary" variant="body2" sx={{ mt: 4, textAlign: "center" }}>
                  Preencha o campo UF nas localidades para visualizar o ranking.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {(data.states ?? []).length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Resumo por estado
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell><strong>Estado</strong></TableCell>
                    <TableCell align="right"><strong>Denúncias</strong></TableCell>
                    <TableCell align="right"><strong>Atividades</strong></TableCell>
                    <TableCell align="right"><strong>Missões</strong></TableCell>
                    <TableCell align="right"><strong>Total</strong></TableCell>
                    <TableCell><strong>OMs</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.states ?? []).map((s: any) => (
                    <TableRow
                      key={s.uf}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => setSelectedState({ uf: s.uf, data: stateDataMap[s.uf] })}
                    >
                      <TableCell><Chip label={s.uf} size="small" sx={{ bgcolor: "#1A3C6E", color: "#fff" }} /></TableCell>
                      <TableCell>{BR_STATES[s.uf]?.name ?? s.uf}</TableCell>
                      <TableCell align="right">{s.complaints}</TableCell>
                      <TableCell align="right">{s.activities}</TableCell>
                      <TableCell align="right">{s.missions}</TableCell>
                      <TableCell align="right"><strong>{s.complaints + s.activities + s.missions}</strong></TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ maxWidth: 250, display: "inline-block" }} noWrap>
                          {s.oms?.join(", ")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {localityDistribution.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1.2, color: "#1A3C6E" }}>
            OMs com maior concentração
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A leitura territorial dos casos fica concentrada nesta aba. Assim, o Perfil de Assédio passa a focar pessoas e contexto, sem duplicar a visão de território.
          </Typography>
          <HorizontalBarCard
            title="Casos por OM / localidade"
            data={localityDistribution}
            maxItems={15}
            height={520}
            color="#546E7A"
          />
        </Box>
      )}

      <KpiDetailModal
        open={Boolean(geoKpiModal)}
        title={
          geoKpiModal === "mappedOms"
            ? "Detalhamento — OMs mapeadas"
            : geoKpiModal === "cpca"
              ? "Detalhamento — OMs cobertas pela CPCA"
              : geoKpiModal === "statesWithData"
                ? "Detalhamento — Estados com Dados"
                  : ""
        }
        onClose={() => setGeoKpiModal(null)}
        maxWidth="lg"
      >
        {geoKpiModal === "mappedOms" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Este KPI mostra quantas OMs/localidades do catálogo já estão aptas a entrar na leitura territorial. Ele serve para medir cobertura de cadastro geográfico, não volume de caso ou intensidade de risco."
              source="Fonte: catálogo de OMs/localidades do sistema com campo UF informado."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Base territorial disponível para cruzamento"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="OMs mapeadas" value={omsCatalog.length} color="#1A3C6E" />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Quanto maior esse número, maior a capacidade do painel de distribuir denúncias, atividades e missões por estado e OM de forma confiável.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Lista detalhada"
              subtitle="OMs/localidades atualmente disponíveis no mapa"
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>OM</strong></TableCell>
                      <TableCell><strong>Descrição</strong></TableCell>
                      <TableCell><strong>UF</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {omsCatalog.map((loc: any) => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.code || "—"}</TableCell>
                        <TableCell>{loc.name || "—"}</TableCell>
                        <TableCell>{loc.uf || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </DetailAccordionSection>
          </Stack>
        )}

        {geoKpiModal === "cpca" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Este KPI mostra quantas OMs contam com CPCA própria ou estão formalmente cobertas por outra OM. Ele ajuda a entender a malha de governança territorial disponível para acolhimento e encaminhamento."
              source="Fonte: catálogo de OMs/localidades e configuração de cobertura CPCA."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Cobertura territorial disponível para acolhimento"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="OMs cobertas pela CPCA" value={totalOmsCoveredByCpca} color="#2E7D32" />
                <DetailRow
                  label="Cobertura relativa"
                  value={totalOms ? `${((totalOmsCoveredByCpca / totalOms) * 100).toFixed(1)}%` : "0%"}
                />
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Lista detalhada"
              subtitle="Como a cobertura está distribuída por OM"
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>OM</strong></TableCell>
                      <TableCell><strong>Descrição</strong></TableCell>
                      <TableCell><strong>UF</strong></TableCell>
                      <TableCell><strong>Cobertura</strong></TableCell>
                      <TableCell><strong>Comissão responsável</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {omsCoveredByCpca.map((loc: any) => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.code || "—"}</TableCell>
                        <TableCell>{loc.name || "—"}</TableCell>
                        <TableCell>{loc.uf || "—"}</TableCell>
                        <TableCell>
                          <CoveredOmCoverageChip item={loc} />
                        </TableCell>
                        <TableCell>{formatCoveredOmResponsibility(loc)}</TableCell>
                      </TableRow>
                    ))}
                    {omsCoveredByCpca.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            Nenhuma OM coberta pela CPCA.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </DetailAccordionSection>
          </Stack>
        )}

        {geoKpiModal === "statesWithData" && (
          <Stack spacing={1.25}>
            <DetailMeaningBlock
              title="O que este número significa"
              meaning="Este KPI mostra em quantos estados já existe pelo menos um sinal territorial relevante: denúncia, atividade ou missão. Ele ajuda a entender abrangência territorial da atuação, não gravidade isolada."
              source="Fonte: consolidação por UF de denúncias, atividades de campo e missões cadastradas."
            />
            <DetailAccordionSection
              title="Resumo executivo"
              subtitle="Abrangência territorial com algum sinal registrado"
              defaultExpanded
            >
              <Stack spacing={1}>
                <DetailRow label="Estados com sinal relevante" value={statesWithData.length} color="#ED6C02" />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Cada estado listado abaixo tem pelo menos um registro territorial relevante no recorte atual. O botão de ação leva direto ao modal completo daquele estado.
                </Typography>
              </Stack>
            </DetailAccordionSection>
            <DetailAccordionSection
              title="Lista detalhada"
              subtitle="Estados com presença territorial registrada"
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>UF</strong></TableCell>
                      <TableCell><strong>Estado</strong></TableCell>
                      <TableCell align="right"><strong>Denúncias</strong></TableCell>
                      <TableCell align="right"><strong>Atividades</strong></TableCell>
                      <TableCell align="right"><strong>Missões</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                      <TableCell align="right"><strong>Ação</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statesWithData.map((s: any) => (
                      <TableRow key={s.uf}>
                        <TableCell>{s.uf}</TableCell>
                        <TableCell>{BR_STATES[s.uf]?.name ?? s.uf}</TableCell>
                        <TableCell align="right">{s.complaints}</TableCell>
                        <TableCell align="right">{s.activities}</TableCell>
                        <TableCell align="right">{s.missions}</TableCell>
                        <TableCell align="right">
                          <strong>{s.complaints + s.activities + s.missions}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setGeoKpiModal(null);
                              setSelectedState({ uf: s.uf, data: stateDataMap[s.uf] });
                            }}
                          >
                            Abrir Estado
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </DetailAccordionSection>
          </Stack>
        )}

      </KpiDetailModal>

      <Dialog
        open={!!selectedState}
        onClose={() => setSelectedState(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: "#1A3C6E", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" fontWeight={700}>
            {selectedState ? `${BR_STATES[selectedState.uf]?.name ?? selectedState.uf} (${selectedState.uf})` : ""}
          </Typography>
          <Button onClick={() => setSelectedState(null)} sx={{ color: "#fff", minWidth: "auto" }}>
            <CloseRoundedIcon />
          </Button>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {selectedState?.data ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <DetailMeaningBlock
                title="O que este detalhamento mostra"
                meaning="Este modal concentra toda a leitura territorial do estado selecionado. O resumo executivo mostra o volume agregado; os blocos expansíveis separam denúncias, atividades, missões e OMs vinculadas ao estado."
                source="Fonte: consolidação territorial por UF do Painel Estratégico."
              />
              <AiCopilotCtaRow
                title="Levar este estado para a IA"
                subtitle="Abra a IA com foco na UF para explicar o cenário, gerar briefing do estado ou transformar o insight territorial em atuação."
                {...buildStrategicCopilotLinks({
                  label: selectedState
                    ? `${BR_STATES[selectedState.uf]?.name ?? selectedState.uf} (${selectedState.uf})`
                    : "Estado selecionado",
                  description: selectedState?.data
                    ? `${selectedState.data.complaints ?? 0} denúncias, ${selectedState.data.activities ?? 0} atividades e ${selectedState.data.missions ?? 0} missões no recorte atual.`
                    : "Leitura territorial do estado selecionado.",
                  focus: selectedState
                    ? {
                        kind: "uf",
                        uf: selectedState.uf,
                      }
                    : {
                        kind: "overview",
                      },
                })}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ textAlign: "center", p: 1 }}>
                    <Typography variant="h5" fontWeight={700}>{selectedState.data.total ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ textAlign: "center", p: 1, borderColor: "#D32F2F" }}>
                    <Typography variant="h5" fontWeight={700} color="#D32F2F">{selectedState.data.complaints ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Denúncias</Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ textAlign: "center", p: 1, borderColor: "#1A3C6E" }}>
                    <Typography variant="h5" fontWeight={700} color="#1A3C6E">{selectedState.data.activities ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Atividades</Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ textAlign: "center", p: 1, borderColor: "#2E7D32" }}>
                    <Typography variant="h5" fontWeight={700} color="#2E7D32">{selectedState.data.missions ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Missões</Typography>
                  </Card>
                </Grid>
              </Grid>

              {(selectedState.data.complaintDetails ?? []).length > 0 && (
                <Accordion defaultExpanded={selectedState.data.complaints <= 10}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#FFF5F5" }}>
                    <Typography fontWeight={600} color="#D32F2F">
                      Denúncias / Casos ({selectedState.data.complaints})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Caso</strong></TableCell>
                            <TableCell><strong>Tipo</strong></TableCell>
                            <TableCell><strong>Status</strong></TableCell>
                            <TableCell><strong>Escopo</strong></TableCell>
                            <TableCell><strong>Data</strong></TableCell>
                            <TableCell><strong>Localidade</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedState.data.complaintDetails.map((c: any, i: number) => (
                            <TableRow key={i} hover>
                              <TableCell>{c.caseNumber}</TableCell>
                              <TableCell>
                                <Chip
                                  label={formatComplaintTypeLabel(c.type)}
                                  size="small"
                                  sx={{
                                    bgcolor: String(c.type || "").toUpperCase() === "SEXUAL" ? "#FFCDD2" : "#FFF9C4",
                                    fontSize: 11,
                                  }}
                                />
                              </TableCell>
                              <TableCell>{formatComplaintStatusLabel(c.status)}</TableCell>
                              <TableCell>{formatWorkflowScopeLabel(c.scope)}</TableCell>
                              <TableCell>{c.date ? new Date(c.date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell>{c.locality || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              {(selectedState.data.activityDetails ?? []).length > 0 && (
                <Accordion defaultExpanded={selectedState.data.activities <= 10}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#EEF2F8" }}>
                    <Typography fontWeight={600} color="#1A3C6E">
                      Atividades de Campo ({selectedState.data.activities})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Título</strong></TableCell>
                            <TableCell><strong>Escopo</strong></TableCell>
                            <TableCell><strong>Status</strong></TableCell>
                            <TableCell><strong>Data</strong></TableCell>
                            <TableCell><strong>Localidade</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedState.data.activityDetails.map((a: any, i: number) => (
                            <TableRow key={i} hover>
                              <TableCell>{a.title}</TableCell>
                              <TableCell>
                                <Chip
                                  label={formatActivityScopeLabel(a.scope)}
                                  size="small"
                                  sx={{
                                    bgcolor: String(a.scope || "").toUpperCase() === "SMIF" ? "#E3F2FD" : "#F3E5F5",
                                    fontSize: 11,
                                  }}
                                />
                              </TableCell>
                              <TableCell>{formatActivityStatusLabel(a.status)}</TableCell>
                              <TableCell>{a.date ? new Date(a.date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell>{a.locality || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              {(selectedState.data.missionDetails ?? []).length > 0 && (
                <Accordion defaultExpanded={selectedState.data.missions <= 10}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#E8F5E9" }}>
                    <Typography fontWeight={600} color="#2E7D32">
                      Missões ({selectedState.data.missions})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Título</strong></TableCell>
                            <TableCell><strong>Escopo</strong></TableCell>
                            <TableCell><strong>Início</strong></TableCell>
                            <TableCell><strong>Fim</strong></TableCell>
                            <TableCell><strong>Localidade</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedState.data.missionDetails.map((m: any, i: number) => (
                            <TableRow key={i} hover>
                              <TableCell>{m.title}</TableCell>
                              <TableCell>
                                <Chip
                                  label={formatActivityScopeLabel(m.scope)}
                                  size="small"
                                  sx={{
                                    bgcolor: String(m.scope || "").toUpperCase() === "SMIF" ? "#E3F2FD" : "#F3E5F5",
                                    fontSize: 11,
                                  }}
                                />
                              </TableCell>
                              <TableCell>{m.startDate ? new Date(m.startDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell>{m.endDate ? new Date(m.endDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell>{m.locality || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#F5F5F5" }}>
                  <Typography fontWeight={600} color="text.secondary">
                    OMs neste estado ({(selectedState.data.oms ?? []).length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {(selectedState.data.oms ?? []).length > 0 ? (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selectedState.data.oms.map((loc: string, i: number) => (
                        <Chip key={i} label={loc} size="small" variant="outlined" />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Nenhuma OM encontrada.</Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </Stack>
          ) : (
            <Typography color="text.secondary">Sem dados para este estado.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export function StrategicDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = String(searchParams.get("tab") ?? "situational");
  const normalizedTabParam =
    currentTabParam === "text" ? "situational" : currentTabParam;
  const tabKeyByIndex = [
    "situational",
    "aggressor",
    "geo",
    "comgep",
  ];
  const initialIndex = Math.max(0, tabKeyByIndex.indexOf(normalizedTabParam));
  const [tab, setTab] = useState(initialIndex);
  const exportPdf = useExportExecutiveReportPdf();

  useEffect(() => {
    if (currentTabParam === "text") {
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
      return;
    }

    const nextIndex = Math.max(0, tabKeyByIndex.indexOf(normalizedTabParam));
    setTab((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [currentTabParam, normalizedTabParam, searchParams, setSearchParams]);

  const handleTabChange = (_: unknown, value: number) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    const nextTabKey = tabKeyByIndex[value] ?? "situational";
    if (nextTabKey === "situational") {
      next.delete("tab");
    } else {
      next.set("tab", nextTabKey);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1A3C6E">
            Painel Estratégico
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Leitura executiva para decidir onde agir, por quê e com qual capacidade de resposta.
          </Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mt: { xs: 1, sm: 0 }, alignSelf: { xs: "stretch", sm: "auto" } }}
        >
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeRoundedIcon />}
            component={RouterLink}
            to="/ai?tab=analyses"
            sx={{ borderColor: "#1A3C6E", color: "#1A3C6E" }}
          >
            IA para explicar ou agir
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadRoundedIcon />}
            onClick={() => exportPdf.mutate()}
            disabled={exportPdf.isPending}
            sx={{
              bgcolor: "#1A3C6E",
              "&:hover": { bgcolor: "#122B4E" },
            }}
          >
            {exportPdf.isPending ? "Gerando…" : "Relatório Executivo (PDF)"}
          </Button>
        </Stack>
      </Stack>

      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Visão Geral"
          icon={<DashboardRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Perfil dos Casos"
          icon={<FingerprintRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Território"
          icon={<MapRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Prioridades COMGEP"
          icon={<ShieldRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
      </Tabs>

      {tab === 0 && <SituationalTab />}
      {tab === 1 && <AggressorProfileTab />}
      {tab === 2 && <GeoMapTab />}
      {tab === 3 && <ComgepStrategicTab />}
    </Box>
  );
}
