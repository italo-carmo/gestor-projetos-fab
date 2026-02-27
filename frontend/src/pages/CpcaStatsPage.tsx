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
} from '@mui/material';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
} from 'recharts';
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../app/roleAccess';
import { useCpcaCaseStats, useLocalities, useMe } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recebida',
  PROTECTION_MEASURES: 'Acolhimento',
  PRELIMINARY_ANALYSIS: 'Triagem',
  PROCEDURE_DEFINED: 'Procedimento',
  INVESTIGATION: 'Apuração',
  CONCLUDED: 'Concluída',
  ARCHIVED: 'Arquivada',
};

const PROCEDURE_LABELS: Record<string, string> = {
  NOT_DEFINED: 'Não definido',
  PATD: 'PATD',
  SINDICANCIA: 'Sindicância',
  PAD: 'PAD',
  IPM: 'IPM',
};

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  MORAL: 'Assédio moral',
  SEXUAL: 'Assédio sexual',
};

const CHART_COLORS = ['#0C657E', '#C56A2B', '#1D8A6C', '#AD2F45', '#4A67A1', '#7B4DB4'];

function formatPercent(value: number) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0%';
  return `${Math.round(numeric)}%`;
}

function buildDefaultFromDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

export function CpcaStatsPage() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const isNationalScope = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI]);
  const localitiesQuery = useLocalities(isNationalScope);

  const localityId = params.get('localityId') ?? '';
  const from = params.get('from') ?? buildDefaultFromDate();
  const to = params.get('to') ?? '';

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
  if (statsQuery.isError) return <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />;

  const data = statsQuery.data ?? {};
  const summary = data.summary ?? {};
  const localities = (localitiesQuery.data?.items ?? []) as Array<{ id?: string; name?: string }>;
  const statusDistribution = ((data.statusDistribution ?? []) as Array<{ status: string; count: number }>).map(
    (item) => ({
      ...item,
      label: STATUS_LABELS[item.status] ?? item.status,
    }),
  );
  const procedureDistribution = (
    (data.procedureDistribution ?? []) as Array<{ procedureType: string; count: number }>
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
  const openByAgeBuckets = (data.openByAgeBuckets ?? []) as Array<{ bucket: string; count: number }>;
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
  const topAggressorRanks = (data.topAggressorRanks ?? []) as Array<{ rank: string; count: number }>;
  const topVictimRanks = (data.topVictimRanks ?? []) as Array<{ rank: string; count: number }>;
  const complaintTypeDistribution = (data.complaintTypeDistribution ?? []) as Array<{
    complaintType: string;
    count: number;
  }>;
  const criticalOpenCases = (data.criticalOpenCases ?? []) as Array<{
    caseId: string;
    caseNumber: string;
    localityCode: string;
    localityName: string;
    status: string;
    complaintType: string;
    openDays: number;
    idleDays: number;
    retaliationRisk: boolean;
  }>;

  const kpiCards = [
    {
      label: 'Total de notificações',
      value: String(summary.totalCases ?? 0),
      hint: 'Registros no período filtrado',
      bg: '#E8F2FF',
    },
    {
      label: 'Casos em aberto',
      value: String(summary.openCases ?? 0),
      hint: `${formatPercent(((summary.openCases ?? 0) / Math.max(1, summary.totalCases ?? 0)) * 100)} do total`,
      bg: '#FFF6E1',
    },
    {
      label: 'Taxa de conclusão',
      value: formatPercent(summary.closureRatePercent ?? 0),
      hint: `${summary.concludedCases ?? 0} concluídas + ${summary.archivedCases ?? 0} arquivadas`,
      bg: '#E8F8EF',
    },
    {
      label: 'Tempo médio até fechamento',
      value: `${summary.averageDaysToClosure ?? 0} dias`,
      hint: 'Concluídas + Arquivadas',
      bg: '#F2EEFF',
    },
    {
      label: 'Triagem > 7 dias',
      value: String(summary.triageOver7Days ?? 0),
      hint: 'Alertas de tempo no item 3 da ICA',
      bg: '#FFECEF',
    },
    {
      label: 'Apuração > 30 dias',
      value: String(summary.investigationOver30Days ?? 0),
      hint: 'Procedimento definido/apuração sem fechamento',
      bg: '#FFECEF',
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap" mb={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            CPCA - Estatísticas de Assédio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Indicadores de risco, tempo de resposta e priorização por localidade para apoio ao comando.
          </Typography>
        </Box>
        <Button component={Link} to="/cpca-cases" variant="outlined">
          Abrir denúncias
        </Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
            {isNationalScope && (
              <TextField
                select
                size="small"
                label="Localidade"
                value={localityId}
                onChange={(event) => updateParam('localityId', event.target.value)}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {localities.map((locality) => (
                  <MenuItem key={String(locality.id ?? '')} value={String(locality.id ?? '')}>
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
              onChange={(event) => updateParam('from', event.target.value)}
            />
            <TextField
              type="date"
              size="small"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(event) => updateParam('to', event.target.value)}
            />
            <Button onClick={() => setParams({ from: buildDefaultFromDate() }, { replace: true })}>
              Limpar filtros
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {kpiCards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ bgcolor: card.bg, height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" fontWeight={600}>
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
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por status
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#0C657E" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Evolução mensal (moral x sexual x aberto)
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="moral" name="Moral" stroke="#0C657E" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sexual" name="Sexual" stroke="#AD2F45" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="open" name="Abertos" stroke="#C56A2B" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Procedimento instaurado
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={procedureDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#1D8A6C" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Envelhecimento dos casos abertos
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={openByAgeBuckets}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {openByAgeBuckets.map((entry, index) => (
                      <Cell key={entry.bucket} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top localidades por risco operacional CPCA
              </Typography>
              {topRiskLocalities.length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhuma localidade com casos no recorte informado." />
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
                        <TableCell align="right">{item.retaliationRiskCases}</TableCell>
                        <TableCell align="right">{item.stalledOver30Days}</TableCell>
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
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por tipo de assédio
              </Typography>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={complaintTypeDistribution.map((item) => ({
                    ...item,
                    label: COMPLAINT_TYPE_LABELS[item.complaintType] ?? item.complaintType,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#4A67A1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Typography variant="h6" gutterBottom sx={{ mt: 1.5 }}>
                Top posto/graduação do assediador
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
                Top posto/graduação do assediado
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
                  <TableCell>Localidade</TableCell>
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
                      <Link to={`/cpca-cases?q=${encodeURIComponent(item.caseNumber)}`}>{item.caseNumber}</Link>
                    </TableCell>
                    <TableCell>{item.localityCode || item.localityName || '—'}</TableCell>
                    <TableCell>{STATUS_LABELS[item.status] ?? item.status}</TableCell>
                    <TableCell>{COMPLAINT_TYPE_LABELS[item.complaintType] ?? item.complaintType}</TableCell>
                    <TableCell align="right">{item.openDays}</TableCell>
                    <TableCell align="right">{item.idleDays}</TableCell>
                    <TableCell align="right">{item.retaliationRisk ? 'Sim' : 'Não'}</TableCell>
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
