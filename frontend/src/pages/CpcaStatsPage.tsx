import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
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
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { useCpcaCaseStats, useLocalities, useMe } from "../api/hooks";
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

function formatPercent(value: number) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0%";
  return `${Math.round(numeric)}%`;
}

function buildDefaultFromDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
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
  const { data: me } = useMe();
  const isNationalScope = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
    ROLE_TI,
  ]);
  const localitiesQuery = useLocalities(isNationalScope);

  const localityId = params.get("localityId") ?? "";
  const from = params.get("from") ?? buildDefaultFromDate();
  const to = params.get("to") ?? "";

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

  const kpiCards = [
    {
      label: "Total de notificações",
      value: String(summary.totalCases ?? 0),
      hint: "Registros no período filtrado",
      bg: "#E8F2FF",
    },
    {
      label: "Casos em aberto",
      value: String(summary.openCases ?? 0),
      hint: `${formatPercent(((summary.openCases ?? 0) / Math.max(1, summary.totalCases ?? 0)) * 100)} do total`,
      bg: "#FFF6E1",
    },
    {
      label: "Taxa de conclusão",
      value: formatPercent(summary.closureRatePercent ?? 0),
      hint: `${summary.concludedCases ?? 0} concluídas + ${summary.archivedCases ?? 0} arquivadas`,
      bg: "#E8F8EF",
    },
    {
      label: "Tempo médio até fechamento",
      value: `${summary.averageDaysToClosure ?? 0} dias`,
      hint: "Concluídas + Arquivadas",
      bg: "#F2EEFF",
    },
    {
      label: "Triagem > 7 dias",
      value: String(summary.triageOver7Days ?? 0),
      hint: "Alertas de tempo no item 3 da ICA",
      bg: "#FFECEF",
    },
    {
      label: "Apuração > 30 dias",
      value: String(summary.investigationOver30Days ?? 0),
      hint: "Procedimento definido/apuração sem fechamento",
      bg: "#FFECEF",
    },
  ];

  return (
    <Box>
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
            CPCA - Estatísticas de Assédio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Indicadores de risco, tempo de resposta e priorização por OM para
            apoio ao comando.
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
              onChange={(event) => updateParam("from", event.target.value)}
            />
            <TextField
              type="date"
              size="small"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(event) => updateParam("to", event.target.value)}
            />
            <Button
              onClick={() =>
                setParams({ from: buildDefaultFromDate() }, { replace: true })
              }
            >
              Limpar filtros
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {kpiCards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ bgcolor: card.bg, height: "100%" }}>
              <CardContent>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  fontWeight={600}
                >
                  {card.label}
                </Typography>
                <Typography variant="h4" fontWeight={800} lineHeight={1.15}>
                  {card.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.hint}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por status
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
                  />
                  <YAxis allowDecimals={false} />
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
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Evolução mensal (moral x sexual x aberto)
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
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
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sexual"
                    name="Sexual"
                    stroke="#AD2F45"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="open"
                    name="Abertos"
                    stroke="#C56A2B"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Procedimento instaurado
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
                  />
                  <YAxis allowDecimals={false} />
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
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Envelhecimento dos casos abertos
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={openByAgeBuckets}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(value, name) => [
                      value,
                      translateMetricName(name),
                    ]}
                  />
                  <Bar dataKey="count" name="Quantidade" radius={[8, 8, 0, 0]}>
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
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top OMs por risco operacional CPCA
              </Typography>
              {topRiskLocalities.length === 0 ? (
                <EmptyState
                  title="Sem dados"
                  description="Nenhuma OM com casos no recorte informado."
                />
              ) : (
                <Table size="small">
                  <TableHead>
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
                      <TableRow key={`${item.localityId}:${item.localityCode}`}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {item.localityCode || item.localityName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.localityName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{item.totalCases}</TableCell>
                        <TableCell align="right">{item.openCases}</TableCell>
                        <TableCell align="right">
                          {item.retaliationRiskCases}
                        </TableCell>
                        <TableCell align="right">
                          {item.stalledOver30Days}
                        </TableCell>
                        <TableCell align="right">{item.riskScore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por tipo de assédio ou violência
              </Typography>
              {detailedTypeDistribution.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem dados de tipo para o recorte.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={detailedTypeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={90}
                    />
                    <YAxis allowDecimals={false} />
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
                    />
                  </BarChart>
                </ResponsiveContainer>
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
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Faixa etária do acusado
              </Typography>
              {aggressorAgeRangeDistribution.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem dados de faixa etária do acusado.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={aggressorAgeRangeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis allowDecimals={false} />
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
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Faixa etária da vítima/noticiante
              </Typography>
              {victimAgeRangeDistribution.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem dados de faixa etária da vítima/noticiante.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={victimAgeRangeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis allowDecimals={false} />
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
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Casos críticos em aberto (priorização imediata)
          </Typography>
          {criticalOpenCases.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum caso aberto no recorte atual.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
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
    </Box>
  );
}
