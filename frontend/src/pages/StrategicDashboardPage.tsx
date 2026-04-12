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
  Divider,
  Grid,
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
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import TextSnippetRoundedIcon from "@mui/icons-material/TextSnippetRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useStrategicDashboard,
  useAggressorProfile,
  useTextAnalysis,
  useGeoMap,
  useExportExecutiveReportPdf,
  useMe,
} from "../api/hooks";
import { SkeletonState } from "../components/states/SkeletonState";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";

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

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  MORAL: "Assédio Moral",
  SEXUAL: "Assédio Sexual",
};
const GENDER_LABELS: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  NAO_INFORMADO: "Não informado",
};
const SOURCE_LABELS: Record<string, string> = {
  recruitsSuggestions: "Sugestões dos Recrutas",
  recruitsEnlistment: "Motivos de Alistamento",
  reportObservations: "Observações dos Relatórios",
  reportAttentionPoints: "Pontos de Atenção",
  reportConclusions: "Conclusões dos Relatórios",
  bestPracticeComments: "Comentários Boas Práticas",
  cpcaComments: "Comentários CPCA/SMIF",
};

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
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
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

function ClickableBarCard({
  data,
  height = 280,
  onBarClick,
}: {
  data: { label: string; count: number; percent: number }[];
  height?: number;
  onBarClick?: (word: string) => void;
}) {
  if (data.length === 0) return null;
  const chartHeight = Math.max(height, data.length * 28 + 40);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${v}`} />
        <YAxis
          dataKey="label"
          type="category"
          width={140}
          tick={{ fontSize: 11 }}
          interval={0}
        />
        <RechartsTooltip
          formatter={(val: number) => [`${val} ocorrências — clique para ver textos`]}
        />
        <Bar
          dataKey="count"
          barSize={16}
          radius={[0, 4, 4, 0]}
          cursor="pointer"
          onClick={(entry: any) => onBarClick?.(entry?.label ?? "")}
        >
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function normalizeForSearch(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterTextsByWord(texts: string[], word: string): string[] {
  const normalized = normalizeForSearch(word);
  return texts.filter((t) => normalizeForSearch(t).includes(normalized));
}

function TextsModal({
  open,
  word,
  texts,
  onClose,
}: {
  open: boolean;
  word: string;
  texts: string[];
  onClose: () => void;
}) {
  const filtered = useMemo(
    () => (word ? filterTextsByWord(texts, word) : []),
    [texts, word],
  );
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" component="span">
            Textos contendo:{" "}
          </Typography>
          <Chip label={word} color="primary" size="small" sx={{ ml: 0.5 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {filtered.length} texto(s) encontrado(s)
          </Typography>
        </Box>
        <Button onClick={onClose} size="small" sx={{ minWidth: "auto" }}>
          <CloseRoundedIcon />
        </Button>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {filtered.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">
            Nenhum texto encontrado.
          </Typography>
        ) : (
          <List dense>
            {filtered.map((text, i) => {
              const regex = new RegExp(
                `(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                "gi",
              );
              const parts = text.split(regex);
              return (
                <ListItem
                  key={i}
                  sx={{
                    borderBottom: "1px solid #F0F0F0",
                    alignItems: "flex-start",
                    py: 1.2,
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {parts.map((part, j) =>
                          regex.test(part) ? (
                            <Box
                              key={j}
                              component="mark"
                              sx={{
                                bgcolor: "#FFF3CD",
                                color: "#856404",
                                px: 0.3,
                                borderRadius: 0.5,
                                fontWeight: 600,
                              }}
                            >
                              {part}
                            </Box>
                          ) : (
                            <span key={j}>{part}</span>
                          ),
                        )}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

function WordCloud({
  words,
  maxWords = 60,
  onWordClick,
}: {
  words: { word: string; count: number }[];
  maxWords?: number;
  onWordClick?: (word: string) => void;
}) {
  const sliced = words.slice(0, maxWords);
  if (sliced.length === 0)
    return (
      <Typography color="text.secondary" variant="body2">
        Nenhum texto disponível.
      </Typography>
    );
  const maxCount = sliced[0]?.count ?? 1;
  const minSize = 11;
  const maxSize = 36;
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.8,
        justifyContent: "center",
        alignItems: "baseline",
        p: 2,
      }}
    >
      {sliced.map((w, i) => {
        const size = Math.max(
          minSize,
          Math.round((w.count / maxCount) * maxSize),
        );
        return (
          <Tooltip key={i} title={`${w.word}: ${w.count} ocorrências — clique para ver textos`} arrow>
            <Typography
              component="span"
              onClick={() => onWordClick?.(w.word)}
              sx={{
                fontSize: size,
                fontWeight: size > 20 ? 700 : size > 15 ? 600 : 400,
                color: COLORS[i % COLORS.length],
                cursor: "pointer",
                lineHeight: 1.2,
                transition: "transform 0.2s",
                "&:hover": { transform: "scale(1.15)", textDecoration: "underline" },
              }}
            >
              {w.word}
            </Typography>
          </Tooltip>
        );
      })}
    </Box>
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

function SituationalTab() {
  const { data, isLoading, error } = useStrategicDashboard();
  const [detailModal, setDetailModal] = useState<string | null>(null);

  if (isLoading) return <SkeletonState />;
  if (error) return <ErrorState message="Erro ao carregar painel situacional." />;
  if (!data) return <EmptyState message="Sem dados." />;

  const s = data.surveys ?? {};
  const dv = data.domesticViolence ?? {};
  const r = data.recruits ?? {};
  const c = data.complaints ?? {};
  const a = data.activities ?? {};
  const m = data.missions ?? {};

  const complaintDonut = [
    { name: "Assédio Moral", value: c.moral ?? 0 },
    { name: "Assédio Sexual", value: c.sexual ?? 0 },
  ].filter((d) => d.value > 0);

  const scopeDonut = [
    { name: "CPCA", value: c.byCpca ?? 0 },
    { name: "SMIF", value: c.bySmif ?? 0 },
  ].filter((d) => d.value > 0);

  const renderModalContent = () => {
    switch (detailModal) {
      case "surveys":
        return (
          <Stack spacing={1}>
            <DetailRow label="Total de respondentes" value={s.totalResponses ?? 0} />
            <DetailRow label="Responderam SIM (sofreu violência)" value={s.yesCount ?? 0} color="#D32F2F" />
            <DetailRow label="Responderam NÃO" value={s.noCount ?? 0} color="#2E7D32" />
            <DetailRow label="Taxa de violência" value={`${s.violenceRatePercent ?? 0}%`} color="#D32F2F" />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Dados provenientes das pesquisas de avaliação realizadas durante as visitas da comissão itinerante.
              A taxa de violência representa o percentual de respondentes que declararam ter sofrido algum tipo de violência.
            </Typography>
          </Stack>
        );
      case "domesticViolence":
        return (
          <Stack spacing={1}>
            <DetailRow label="Total de respondentes" value={dv.totalResponses ?? 0} />
            <DetailRow label="Sofreram violência doméstica (alguma vez)" value={dv.lifetimeYes ?? 0} color="#ED6C02" />
            <DetailRow label="Taxa — alguma vez na vida" value={`${dv.lifetimeRatePercent ?? 0}%`} color="#ED6C02" />
            <DetailRow label="Sofreram nos últimos 12 meses" value={dv.last12MonthsYes ?? 0} color="#C2185B" />
            <DetailRow label="Taxa — últimos 12 meses" value={`${dv.last12MonthsRatePercent ?? 0}%`} color="#C2185B" />
            <DetailRow label="Buscaram ajuda" value={dv.soughtHelp ?? 0} color="#F9A825" />
            <DetailRow label="Taxa de busca de ajuda" value={`${dv.soughtHelpPercent ?? 0}%`} />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Dados da pesquisa sobre violência doméstica aplicada nas localidades visitadas.
              A taxa de busca de ajuda é calculada sobre o total que sofreu violência em algum momento.
            </Typography>
          </Stack>
        );
      case "recruits":
        return (
          <Stack spacing={1}>
            <DetailRow label="Total de respondentes (recrutas)" value={r.totalResponses ?? 0} />
            <DetailRow label="Sentem-se seguros(as) para denunciar" value={r.safeCount ?? 0} color="#2E7D32" />
            <DetailRow label="Taxa de segurança para denúncia" value={`${r.safeToReportPercent ?? 0}%`} color="#2E7D32" />
            <DetailRow label="Conhecem o canal de denúncia" value={r.knowProcess ?? 0} color="#0288D1" />
            <DetailRow label="Taxa de conhecimento do canal" value={`${r.knowReportProcessPercent ?? 0}%`} color="#0288D1" />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Dados da pesquisa com recrutas do SMIF (alistamento feminino).
              Indicadores medem o nível de segurança percebida e conhecimento dos canais de denúncia.
            </Typography>
          </Stack>
        );
      case "complaints":
        return (
          <Stack spacing={1}>
            <DetailRow label="Total de denúncias/casos" value={c.totalCases ?? 0} />
            <DetailRow label="Casos abertos/ativos" value={c.openCases ?? 0} color="#D32F2F" />
            <DetailRow label="Casos concluídos" value={c.concludedCases ?? 0} color="#2E7D32" />
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Por tipo</Typography>
            <DetailRow label="Assédio Moral" value={`${c.moral ?? 0} (${c.moralPercent ?? 0}%)`} color="#ED6C02" />
            <DetailRow label="Assédio Sexual" value={`${c.sexual ?? 0} (${c.sexualPercent ?? 0}%)`} color="#D32F2F" />
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Por escopo</Typography>
            <DetailRow label="CPCA" value={c.byCpca ?? 0} color="#1A3C6E" />
            <DetailRow label="SMIF" value={c.bySmif ?? 0} color="#7B1FA2" />
          </Stack>
        );
      case "activities":
        return (
          <Stack spacing={1}>
            <DetailRow label="Total de atividades" value={a.totalActivities ?? 0} />
            <DetailRow label="SMIF" value={a.smif ?? 0} color="#4E342E" />
            <DetailRow label="CIPAVD" value={a.cipavd ?? 0} color="#7B1FA2" />
            <DetailRow label="Concluídas" value={a.done ?? 0} color="#2E7D32" />
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Relatórios</Typography>
            <DetailRow label="Relatórios preenchidos" value={a.withReport ?? 0} />
            <DetailRow label="Relatórios assinados" value={a.signed ?? 0} color="#2E7D32" />
            <DetailRow label="Taxa de preenchimento" value={a.totalActivities ? `${((a.withReport / a.totalActivities) * 100).toFixed(1)}%` : "0%"} />
            <DetailRow label="Taxa de assinatura" value={a.withReport ? `${((a.signed / a.withReport) * 100).toFixed(1)}%` : "0%"} />
          </Stack>
        );
      case "missions":
        return (
          <Stack spacing={1}>
            <DetailRow label="Total de missões" value={m.totalMissions ?? 0} />
            <DetailRow label="SMIF" value={m.smif ?? 0} color="#4E342E" />
            <DetailRow label="CIPAVD" value={m.cipavd ?? 0} color="#7B1FA2" />
            <DetailRow label="OMs visitadas (distintas)" value={m.localitiesCovered ?? 0} color="#0288D1" />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Missões realizadas pela comissão itinerante em todo o território nacional.
            </Typography>
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
            title="Pesquisas — Taxa de Violência"
            value={`${s.violenceRatePercent ?? 0}%`}
            subtitle={`${s.yesCount ?? 0} de ${s.totalResponses ?? 0} respondentes`}
            color="#D32F2F"
            onClick={() => setDetailModal("surveys")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Violência Doméstica"
            value={`${dv.lifetimeRatePercent ?? 0}%`}
            subtitle={`${dv.lifetimeYes ?? 0} de ${dv.totalResponses ?? 0}`}
            color="#ED6C02"
            onClick={() => setDetailModal("domesticViolence")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Recrutas — Segurança p/ denunciar"
            value={`${r.safeToReportPercent ?? 0}%`}
            subtitle={`${r.safeCount ?? 0} de ${r.totalResponses ?? 0}`}
            color="#2E7D32"
            onClick={() => setDetailModal("recruits")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Denúncias Ativas"
            value={c.openCases ?? 0}
            subtitle={`Total: ${c.totalCases ?? 0} | CPCA: ${c.byCpca ?? 0} | SMIF: ${c.bySmif ?? 0}`}
            color="#1A3C6E"
            onClick={() => setDetailModal("complaints")}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Viol. Doméstica (12 meses)"
            value={`${dv.last12MonthsRatePercent ?? 0}%`}
            subtitle={`${dv.last12MonthsYes ?? 0} respondentes`}
            color="#C2185B"
            onClick={() => setDetailModal("domesticViolence")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Recrutas — Conhece canal"
            value={`${r.knowReportProcessPercent ?? 0}%`}
            subtitle={`${r.knowProcess ?? 0} de ${r.totalResponses ?? 0}`}
            color="#0288D1"
            onClick={() => setDetailModal("recruits")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Atividades de Campo"
            value={a.totalActivities ?? 0}
            subtitle={`SMIF: ${a.smif ?? 0} | CIPAVD: ${a.cipavd ?? 0} | Concluídas: ${a.done ?? 0}`}
            color="#4E342E"
            onClick={() => setDetailModal("activities")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Missões Realizadas"
            value={m.totalMissions ?? 0}
            subtitle={`SMIF: ${m.smif ?? 0} | CIPAVD: ${m.cipavd ?? 0} | OMs: ${m.localitiesCovered ?? 0}`}
            color="#7B1FA2"
            onClick={() => setDetailModal("missions")}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Denúncias por Tipo
              </Typography>
              {complaintDonut.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={complaintDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      cursor="pointer"
                      onClick={() => setDetailModal("complaints")}
                    >
                      {complaintDonut.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary" variant="body2">
                  Sem denúncias registradas.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Denúncias por Escopo
              </Typography>
              {scopeDonut.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={scopeDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      cursor="pointer"
                      onClick={() => setDetailModal("complaints")}
                    >
                      {scopeDonut.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary" variant="body2">
                  Sem dados.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined" sx={{ cursor: "pointer", "&:hover": { boxShadow: 4 } }}
            onClick={() => setDetailModal("activities")}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Relatórios de Campo
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2">Relatórios preenchidos</Typography>
                  <Chip label={a.withReport ?? 0} size="small" />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2">Relatórios assinados</Typography>
                  <Chip label={a.signed ?? 0} size="small" color="success" />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2">Buscaram ajuda (viol. doméstica)</Typography>
                  <Chip
                    label={`${dv.soughtHelpPercent ?? 0}%`}
                    size="small"
                    color="warning"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <KpiDetailModal
        open={!!detailModal}
        title={modalTitles[detailModal ?? ""] ?? ""}
        onClose={() => setDetailModal(null)}
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

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Total de Casos"
            value={data.totalCases}
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
            title="Relação Hierárquica"
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
      >
        {detailModal === "total" && (
          <Stack spacing={1}>
            <DetailRow label="Total de casos registrados" value={data.totalCases} />
            <DetailRow label="Assédio Moral" value={`${data.byComplaintType.moral.count} (${data.byComplaintType.moral.percent}%)`} color="#ED6C02" />
            <DetailRow label="Assédio Sexual" value={`${data.byComplaintType.sexual.count} (${data.byComplaintType.sexual.percent}%)`} color="#D32F2F" />
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2">Por escopo</Typography>
            {(data.byScope ?? []).map((s: any) => (
              <DetailRow key={s.label} label={s.label} value={`${s.count} (${s.percent}%)`} />
            ))}
            {data.byLocality?.length > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="subtitle2">Por localidade</Typography>
                {data.byLocality.slice(0, 10).map((l: any) => (
                  <DetailRow key={l.label} label={l.localityName || l.label} value={`${l.count} (${l.percent}%)`} />
                ))}
              </>
            )}
          </Stack>
        )}
        {detailModal === "moral" && (
          <Stack spacing={1}>
            <DetailRow label="Total de casos de assédio moral" value={data.byComplaintType.moral.count} color="#ED6C02" />
            <DetailRow label="Percentual do total" value={`${data.byComplaintType.moral.percent}%`} />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              O assédio moral inclui humilhações, exclusão, ameaças, intimidações, críticas excessivas, injustiças e outras formas de violência psicológica no ambiente de trabalho.
            </Typography>
          </Stack>
        )}
        {detailModal === "sexual" && (
          <Stack spacing={1}>
            <DetailRow label="Total de casos de assédio sexual" value={data.byComplaintType.sexual.count} color="#D32F2F" />
            <DetailRow label="Percentual do total" value={`${data.byComplaintType.sexual.percent}%`} />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              O assédio sexual inclui comentários sexistas, contato físico indesejado, chantagem por favores sexuais, exibição de material pornográfico e outras formas de violência sexual.
            </Typography>
          </Stack>
        )}
        {detailModal === "hierarchical" && (
          <Stack spacing={1}>
            <DetailRow label="Casos com relação hierárquica" value={data.hierarchicalRelation.count} color="#7B1FA2" />
            <DetailRow label="Percentual do total" value={`${data.hierarchicalRelation.percent}%`} />
            <DetailRow label="Total de casos" value={data.totalCases} />
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {data.hierarchicalRelation.description}. Inclui relações de superior hierárquico, chefe imediato ou instrutor/professor com subordinado.
            </Typography>
          </Stack>
        )}
      </KpiDetailModal>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Perfil do Agressor
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Posto/Graduação do Agressor"
            data={data.aggressorProfile.byRank}
            color="#D32F2F"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Gênero do Agressor"
            data={data.aggressorProfile.byGender.map((d: any) => ({
              ...d,
              label: GENDER_LABELS[d.label] ?? d.label,
            }))}
            color="#ED6C02"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Faixa Etária do Agressor"
            data={data.aggressorProfile.byAgeRange}
            color="#7B1FA2"
          />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Perfil da Vítima
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Posto/Graduação da Vítima"
            data={data.victimProfile.byRank}
            color="#0288D1"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Gênero da Vítima"
            data={data.victimProfile.byGender.map((d: any) => ({
              ...d,
              label: GENDER_LABELS[d.label] ?? d.label,
            }))}
            color="#00838F"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Faixa Etária da Vítima"
            data={data.victimProfile.byAgeRange}
            color="#2E7D32"
          />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Contexto das Ocorrências
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <HorizontalBarCard
            title="Tipo Detalhado de Violência"
            data={data.context.byViolenceType}
            color="#D32F2F"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <HorizontalBarCard
            title="Contexto do Assédio"
            data={data.context.byHarassmentContext}
            color="#7B1FA2"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Local de Ocorrência"
            data={data.context.byLocation}
            color="#4E342E"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <HorizontalBarCard
            title="Frequência da Violência"
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

      {data.byLocality?.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
            Distribuição por Localidade
          </Typography>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <ResponsiveContainer
                width="100%"
                height={Math.max(300, data.byLocality.length * 28 + 40)}
              >
                <BarChart
                  data={data.byLocality.slice(0, 20)}
                  layout="vertical"
                  margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="localityName"
                    type="category"
                    width={200}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <RechartsTooltip
                    formatter={(v: number, _: any, entry: any) =>
                      `${v} (${entry.payload.percent}%)`
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="#1A3C6E"
                    barSize={16}
                    radius={[0, 4, 4, 0]}
                  >
                    {data.byLocality
                      .slice(0, 20)
                      .map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

function TextAnalysisTab() {
  const { data, isLoading, error } = useTextAnalysis();
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [modalWord, setModalWord] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const sourcesWithData = useMemo(() => {
    if (!data?.sources) return [];
    return Object.entries(data.sources)
      .filter(([, v]: [string, any]) => v.count > 0)
      .map(([key, v]: [string, any]) => ({
        key,
        label: SOURCE_LABELS[key] ?? key,
        ...v,
      }));
  }, [data]);

  const activeRawTexts = useMemo(() => {
    if (!data) return [];
    if (activeSource) {
      return sourcesWithData.find((s) => s.key === activeSource)?.rawTexts ?? [];
    }
    return data.consolidated.rawTexts ?? [];
  }, [data, activeSource, sourcesWithData]);

  const handleWordClick = useCallback((word: string) => {
    setModalWord(word);
    setModalOpen(true);
  }, []);

  if (isLoading) return <SkeletonState />;
  if (error) return <ErrorState message="Erro ao carregar análise de texto." />;
  if (!data || data.consolidated.totalTexts === 0)
    return (
      <EmptyState message="Nenhum texto disponível para análise. Os dados aparecerão conforme relatórios e pesquisas forem preenchidos." />
    );

  const activeWords = activeSource
    ? sourcesWithData.find((s) => s.key === activeSource)?.topWords ?? []
    : data.consolidated.topWords;
  const activeLabel = activeSource
    ? sourcesWithData.find((s) => s.key === activeSource)?.label ?? ""
    : "Todas as fontes consolidadas";

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Total de Textos Analisados"
            value={data.consolidated.totalTexts}
            color="#1A3C6E"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Fontes de Dados"
            value={sourcesWithData.length}
            subtitle="fontes com texto"
            color="#7B1FA2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Termos Únicos"
            value={data.consolidated.topWords.length}
            subtitle="palavras mais frequentes"
            color="#0288D1"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Termo mais frequente"
            value={data.consolidated.topWords[0]?.word ?? "—"}
            subtitle={`${data.consolidated.topWords[0]?.count ?? 0} ocorrências`}
            color="#2E7D32"
          />
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap", gap: 0.5 }}
          >
            <Chip
              label="Todas as fontes"
              variant={activeSource === null ? "filled" : "outlined"}
              color={activeSource === null ? "primary" : "default"}
              onClick={() => setActiveSource(null)}
              size="small"
            />
            {sourcesWithData.map((s) => (
              <Chip
                key={s.key}
                label={`${s.label} (${s.count})`}
                variant={activeSource === s.key ? "filled" : "outlined"}
                color={activeSource === s.key ? "primary" : "default"}
                onClick={() => setActiveSource(s.key)}
                size="small"
              />
            ))}
          </Stack>
          <Typography variant="subtitle2" gutterBottom>
            {activeLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
            Clique em qualquer palavra para ver os textos completos que a contêm.
          </Typography>
          <WordCloud words={activeWords} maxWords={60} onWordClick={handleWordClick} />
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2, color: "#1A3C6E" }}>
        Termos mais frequentes por fonte
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
        Clique em uma barra do gráfico para ver os textos que contêm a palavra.
      </Typography>
      <Grid container spacing={2}>
        {sourcesWithData.map((source) => (
          <Grid key={source.key} size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {source.label}{" "}
                  <Chip label={`${source.count} textos`} size="small" sx={{ ml: 1 }} />
                </Typography>
                <ClickableBarCard
                  data={source.topWords.slice(0, 15).map((w: any) => ({
                    label: w.word,
                    count: w.count,
                    percent: 0,
                  }))}
                  height={280}
                  onBarClick={(word) => {
                    setActiveSource(source.key);
                    handleWordClick(word);
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <TextsModal
        open={modalOpen}
        word={modalWord}
        texts={activeRawTexts}
        onClose={() => setModalOpen(false)}
      />
    </Box>
  );
}

const BR_STATES: Record<string, { name: string; path: string; labelX: number; labelY: number }> = {
  AC: { name: "Acre", labelX: 80, labelY: 288,
    path: "M50,270 L58,265 L72,262 L88,264 L95,272 L98,282 L92,294 L82,300 L68,302 L54,298 L48,290 L46,280Z" },
  AL: { name: "Alagoas", labelX: 510, labelY: 262,
    path: "M496,252 L504,248 L514,250 L520,256 L522,264 L518,270 L510,272 L500,270 L494,264 L494,258Z" },
  AP: { name: "Amapá", labelX: 310, labelY: 78,
    path: "M292,92 L296,82 L304,68 L314,58 L326,62 L332,72 L330,86 L324,98 L312,104 L300,102 L292,96Z" },
  AM: { name: "Amazonas", labelX: 155, labelY: 170,
    path: "M58,168 L62,148 L72,132 L92,118 L118,110 L152,106 L188,108 L218,116 L240,130 L248,148 L244,168 L236,188 L222,204 L202,216 L176,224 L148,226 L120,222 L96,214 L76,202 L64,188Z" },
  BA: { name: "Bahia", labelX: 462, labelY: 272,
    path: "M400,218 L418,212 L440,210 L462,214 L482,222 L498,234 L510,248 L516,264 L514,282 L506,300 L494,314 L478,324 L460,330 L440,332 L420,328 L404,318 L394,304 L390,288 L392,268 L396,248 L398,232Z" },
  CE: { name: "Ceará", labelX: 492, labelY: 186,
    path: "M468,174 L476,166 L488,160 L502,158 L514,162 L522,172 L524,184 L520,196 L512,206 L500,212 L486,214 L474,210 L466,200 L464,188Z" },
  DF: { name: "Distrito Federal", labelX: 372, labelY: 302,
    path: "M364,296 L372,292 L382,294 L386,302 L384,310 L376,314 L366,312 L362,304Z" },
  ES: { name: "Espírito Santo", labelX: 472, labelY: 338,
    path: "M458,322 L468,318 L478,322 L484,332 L486,344 L482,354 L474,360 L464,358 L456,348 L454,336Z" },
  GO: { name: "Goiás", labelX: 362, labelY: 306,
    path: "M318,270 L334,264 L354,260 L376,262 L394,268 L404,280 L408,296 L404,314 L396,330 L382,342 L366,348 L348,346 L332,338 L320,326 L312,310 L310,294 L314,280Z" },
  MA: { name: "Maranhão", labelX: 398, labelY: 170,
    path: "M352,142 L368,132 L388,126 L408,124 L428,128 L442,138 L450,152 L452,170 L446,188 L436,204 L420,214 L402,218 L384,216 L368,208 L356,196 L348,180 L348,162Z" },
  MT: { name: "Mato Grosso", labelX: 280, labelY: 278,
    path: "M202,228 L228,220 L260,214 L292,212 L320,216 L342,226 L352,242 L354,262 L348,282 L336,300 L318,314 L296,322 L272,326 L248,322 L228,312 L212,298 L202,280 L198,258 L200,240Z" },
  MS: { name: "Mato Grosso do Sul", labelX: 298, labelY: 372,
    path: "M248,338 L268,332 L290,328 L312,330 L330,338 L342,352 L346,370 L342,388 L332,402 L318,412 L300,418 L280,416 L262,408 L248,396 L240,380 L238,362 L242,348Z" },
  MG: { name: "Minas Gerais", labelX: 420, labelY: 326,
    path: "M362,282 L382,274 L406,270 L430,272 L452,280 L468,294 L478,312 L480,332 L474,352 L462,368 L446,378 L426,382 L406,380 L388,372 L372,360 L362,344 L356,326 L356,306 L358,292Z" },
  PA: { name: "Pará", labelX: 276, labelY: 142,
    path: "M192,108 L218,98 L250,88 L282,82 L314,80 L342,84 L362,94 L374,110 L378,130 L374,150 L364,168 L348,182 L328,190 L304,194 L278,194 L252,190 L230,182 L212,170 L198,154 L190,136 L190,120Z" },
  PB: { name: "Paraíba", labelX: 508, labelY: 204,
    path: "M482,196 L494,192 L508,190 L522,192 L530,200 L530,210 L524,218 L512,220 L498,218 L486,214 L480,206Z" },
  PR: { name: "Paraná", labelX: 348, labelY: 414,
    path: "M300,396 L318,390 L340,386 L364,388 L384,394 L398,406 L404,420 L400,434 L390,444 L374,450 L356,452 L336,448 L318,440 L304,430 L296,418 L296,406Z" },
  PE: { name: "Pernambuco", labelX: 492, labelY: 222,
    path: "M450,210 L468,204 L488,200 L508,202 L524,210 L532,222 L530,234 L522,242 L508,246 L490,248 L472,244 L458,236 L450,224Z" },
  PI: { name: "Piauí", labelX: 442, labelY: 196,
    path: "M414,168 L430,162 L448,160 L464,164 L474,176 L478,192 L474,208 L466,222 L452,232 L436,236 L420,232 L408,222 L402,208 L400,192 L404,178Z" },
  RJ: { name: "Rio de Janeiro", labelX: 444, labelY: 380,
    path: "M416,364 L430,358 L446,356 L462,360 L472,370 L476,382 L470,392 L458,398 L442,400 L428,396 L418,388 L414,378Z" },
  RN: { name: "Rio Grande do Norte", labelX: 512, labelY: 184,
    path: "M488,176 L500,170 L514,168 L528,170 L536,178 L538,190 L532,200 L520,204 L506,204 L494,200 L486,192 L486,184Z" },
  RS: { name: "Rio Grande do Sul", labelX: 322, labelY: 478,
    path: "M272,452 L292,444 L316,440 L340,442 L360,450 L374,462 L380,478 L378,496 L368,510 L352,520 L332,526 L310,524 L290,516 L274,504 L264,490 L260,474 L264,460Z" },
  RO: { name: "Rondônia", labelX: 176, labelY: 256,
    path: "M132,230 L150,224 L172,220 L194,224 L210,234 L218,250 L216,268 L206,282 L192,290 L174,294 L156,290 L140,282 L132,268 L128,252 L130,240Z" },
  RR: { name: "Roraima", labelX: 168, labelY: 78,
    path: "M132,64 L148,52 L168,44 L190,46 L206,56 L212,72 L210,90 L202,106 L188,116 L170,120 L152,116 L138,106 L130,92 L128,76Z" },
  SC: { name: "Santa Catarina", labelX: 352, labelY: 450,
    path: "M312,438 L330,432 L352,430 L374,434 L390,444 L396,458 L390,470 L378,478 L362,480 L344,478 L328,472 L316,462 L310,452 L310,444Z" },
  SP: { name: "São Paulo", labelX: 382, labelY: 382,
    path: "M328,354 L350,346 L376,342 L400,346 L420,356 L432,370 L436,388 L430,404 L418,416 L400,422 L380,424 L360,420 L342,410 L328,398 L322,382 L322,366Z" },
  SE: { name: "Sergipe", labelX: 508, labelY: 250,
    path: "M496,240 L506,236 L516,238 L522,246 L522,256 L516,262 L506,264 L498,260 L494,252 L494,244Z" },
  TO: { name: "Tocantins", labelX: 370, labelY: 222,
    path: "M332,178 L350,170 L372,166 L394,170 L410,180 L418,196 L420,214 L414,232 L402,248 L386,258 L368,262 L350,258 L336,248 L326,234 L322,216 L324,198 L328,188Z" },
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
      <svg viewBox="20 30 560 520" style={{ width: "100%", maxHeight: 560 }}>
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
              strokeWidth={1.2}
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
            fontSize={9}
            fontWeight={700}
            fill={stateData[uf]?.total ? "#fff" : "#999"}
            pointerEvents="none"
            style={{ textShadow: stateData[uf]?.total ? "0 1px 2px rgba(0,0,0,0.4)" : "none" }}
          >
            {uf}
          </text>
        ))}
      </svg>
    </Box>
  );
}

function GeoMapTab() {
  const { data, isLoading, error } = useGeoMap();
  const [selectedState, setSelectedState] = useState<{ uf: string; data: any } | null>(null);

  if (isLoading) return <SkeletonState />;
  if (error) return <ErrorState message="Erro ao carregar mapa geográfico." />;
  if (!data) return <EmptyState message="Sem dados geográficos." />;

  const stateDataMap: Record<string, any> = {};
  for (const s of (data.states ?? [])) {
    stateDataMap[s.uf] = {
      total: s.complaints + s.activities + s.missions,
      complaints: s.complaints,
      activities: s.activities,
      missions: s.missions,
      localities: s.localities ?? [],
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

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Localidades Cadastradas"
            value={data.totalLocalities ?? 0}
            color="#1A3C6E"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Com UF Preenchida"
            value={data.totalLocalitiesWithUf ?? 0}
            subtitle={data.totalLocalities
              ? `${((data.totalLocalitiesWithUf / data.totalLocalities) * 100).toFixed(0)}% do total`
              : ""}
            color="#2E7D32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Estados com Dados"
            value={(data.states ?? []).filter((s: any) => s.complaints + s.activities + s.missions > 0).length}
            color="#ED6C02"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Total de Registros"
            value={(data.states ?? []).reduce((sum: number, s: any) => sum + s.complaints + s.activities + s.missions, 0)}
            color="#D32F2F"
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
                Mapa do Brasil — Distribuição por Estado
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Clique em um estado para ver detalhes. Intensidade do azul indica volume de dados.
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
                Ranking por Estado
              </Typography>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="uf" type="category" width={35} tick={{ fontSize: 11 }} interval={0} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="Denúncias" stackId="a" fill="#D32F2F" barSize={16} />
                    <Bar dataKey="Atividades" stackId="a" fill="#1A3C6E" barSize={16} />
                    <Bar dataKey="Missões" stackId="a" fill="#2E7D32" barSize={16} radius={[0, 4, 4, 0]} />
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
              Tabela Detalhada por Estado
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
                    <TableCell><strong>Localidades</strong></TableCell>
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
                          {s.localities?.join(", ")}
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

      <KpiDetailModal
        open={!!selectedState}
        title={selectedState ? `${BR_STATES[selectedState.uf]?.name ?? selectedState.uf} (${selectedState.uf})` : ""}
        onClose={() => setSelectedState(null)}
      >
        {selectedState?.data ? (
          <Stack spacing={1}>
            <DetailRow label="Total de registros" value={selectedState.data.total ?? 0} />
            <DetailRow label="Denúncias/Casos" value={selectedState.data.complaints ?? 0} color="#D32F2F" />
            <DetailRow label="Atividades de Campo" value={selectedState.data.activities ?? 0} color="#1A3C6E" />
            <DetailRow label="Missões" value={selectedState.data.missions ?? 0} color="#2E7D32" />
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2">Localidades neste estado:</Typography>
            {(selectedState.data.localities ?? []).length > 0 ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selectedState.data.localities.map((loc: string, i: number) => (
                  <Chip key={i} label={loc} size="small" variant="outlined" />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">Nenhuma localidade encontrada.</Typography>
            )}
          </Stack>
        ) : (
          <Typography color="text.secondary">Sem dados para este estado.</Typography>
        )}
      </KpiDetailModal>
    </Box>
  );
}

export function StrategicDashboardPage() {
  const [tab, setTab] = useState(0);
  const exportPdf = useExportExecutiveReportPdf();

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
            Visão consolidada para prevenção e combate ao assédio e violência
            doméstica
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadRoundedIcon />}
          onClick={() => exportPdf.mutate()}
          disabled={exportPdf.isPending}
          sx={{
            mt: { xs: 1, sm: 0 },
            bgcolor: "#1A3C6E",
            "&:hover": { bgcolor: "#122B4E" },
          }}
        >
          {exportPdf.isPending ? "Gerando…" : "Relatório Executivo (PDF)"}
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Painel Situacional"
          icon={<DashboardRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Perfil de Assédio"
          icon={<FingerprintRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Mapa Geográfico"
          icon={<MapRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Análise de Texto"
          icon={<TextSnippetRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
      </Tabs>

      {tab === 0 && <SituationalTab />}
      {tab === 1 && <AggressorProfileTab />}
      {tab === 2 && <GeoMapTab />}
      {tab === 3 && <TextAnalysisTab />}
    </Box>
  );
}
