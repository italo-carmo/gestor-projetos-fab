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
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import TextSnippetRoundedIcon from "@mui/icons-material/TextSnippetRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", borderLeft: `4px solid ${color}` }}
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
      </CardContent>
    </Card>
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

function SituationalTab() {
  const { data, isLoading, error } = useStrategicDashboard();
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

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Pesquisas — Taxa de Violência"
            value={`${s.violenceRatePercent ?? 0}%`}
            subtitle={`${s.yesCount ?? 0} de ${s.totalResponses ?? 0} respondentes`}
            color="#D32F2F"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Violência Doméstica (Vida)"
            value={`${dv.lifetimeRatePercent ?? 0}%`}
            subtitle={`${dv.lifetimeYes ?? 0} de ${dv.totalResponses ?? 0}`}
            color="#ED6C02"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Recrutas — Segurança p/ denunciar"
            value={`${r.safeToReportPercent ?? 0}%`}
            subtitle={`${r.safeCount ?? 0} de ${r.totalResponses ?? 0}`}
            color="#2E7D32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Denúncias Ativas"
            value={c.openCases ?? 0}
            subtitle={`Total: ${c.totalCases ?? 0} | CPCA: ${c.byCpca ?? 0} | SMIF: ${c.bySmif ?? 0}`}
            color="#1A3C6E"
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
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Recrutas — Conhece canal"
            value={`${r.knowReportProcessPercent ?? 0}%`}
            subtitle={`${r.knowProcess ?? 0} de ${r.totalResponses ?? 0}`}
            color="#0288D1"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Atividades de Campo"
            value={a.totalActivities ?? 0}
            subtitle={`SMIF: ${a.smif ?? 0} | CIPAVD: ${a.cipavd ?? 0} | Concluídas: ${a.done ?? 0}`}
            color="#4E342E"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Missões Realizadas"
            value={m.totalMissions ?? 0}
            subtitle={`SMIF: ${m.smif ?? 0} | CIPAVD: ${m.cipavd ?? 0} | OMs: ${m.localitiesCovered ?? 0}`}
            color="#7B1FA2"
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
          <Card variant="outlined">
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
    </Box>
  );
}

function AggressorProfileTab() {
  const { data, isLoading, error } = useAggressorProfile();
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
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Assédio Moral"
            value={`${data.byComplaintType.moral.count}`}
            subtitle={`${data.byComplaintType.moral.percent}% dos casos`}
            color="#ED6C02"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Assédio Sexual"
            value={`${data.byComplaintType.sexual.count}`}
            subtitle={`${data.byComplaintType.sexual.percent}% dos casos`}
            color="#D32F2F"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Relação Hierárquica"
            value={`${data.hierarchicalRelation.percent}%`}
            subtitle={`${data.hierarchicalRelation.count} casos com superior hierárquico`}
            color="#7B1FA2"
          />
        </Grid>
      </Grid>

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
          label="Análise de Texto"
          icon={<TextSnippetRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
      </Tabs>

      {tab === 0 && <SituationalTab />}
      {tab === 1 && <AggressorProfileTab />}
      {tab === 2 && <TextAnalysisTab />}
    </Box>
  );
}
