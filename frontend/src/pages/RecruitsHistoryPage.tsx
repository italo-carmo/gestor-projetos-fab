import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardRecruits } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function RecruitsHistoryPage() {
  const recruitsQuery = useDashboardRecruits();
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>('');
  const data = recruitsQuery.data;
  const currentPerLocality = data?.currentPerLocality ?? [];
  const aggregateByMonth = data?.aggregateByMonth ?? [];
  const byLocality = data?.byLocality ?? [];

  const selectedSeries = useMemo(() => {
    if (!selectedLocalityId) return [];
    const loc = byLocality.find((l: any) => l.localityId === selectedLocalityId);
    return loc?.series ?? [];
  }, [selectedLocalityId, byLocality]);

  if (recruitsQuery.isLoading) return <SkeletonState />;
  if (recruitsQuery.isError)
    return <ErrorState error={recruitsQuery.error} onRetry={() => recruitsQuery.refetch()} />;

  const totalCurrent = currentPerLocality.reduce((acc: number, l: any) => acc + (l.recruitsFemaleCountCurrent ?? 0), 0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Histórico de recrutas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quantitativo atual por localidade, evolução mensal geral e por localidade. A edição do número de recrutas é feita em GSD e Recrutas e gera automaticamente este histórico.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quantitativo atual por localidade
          </Typography>
          {currentPerLocality.length === 0 ? (
            <EmptyState
              title="Sem dados"
              description="Nenhuma localidade no seu escopo ou ainda sem registro de recrutas."
            />
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Total atual: <strong>{totalCurrent}</strong> recrutas femininas
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                      Quantidade
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentPerLocality.map((loc: any) => (
                    <TableRow key={loc.localityId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {loc.localityName}
                        </Typography>
                        {loc.code && (
                          <Typography variant="caption" color="text.secondary">
                            {loc.code}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{loc.recruitsFemaleCountCurrent ?? 0}</TableCell>
                      <TableCell>
                        <Link to="/gsd-recruits">Editar em GSD e Recrutas</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {aggregateByMonth.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quantitativo geral por mês
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={aggregateByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Recrutas" fill="#0B4DA1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {byLocality.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Histórico por localidade
            </Typography>
            <TextField
              select
              size="small"
              label="Localidade"
              value={selectedLocalityId}
              onChange={(e) => setSelectedLocalityId(e.target.value)}
              sx={{ minWidth: 220, mb: 2 }}
            >
              <MenuItem value="">Selecione uma localidade</MenuItem>
              {byLocality.map((loc: any) => (
                <MenuItem key={loc.localityId} value={loc.localityId}>
                  {loc.localityName} ({loc.code})
                </MenuItem>
              ))}
            </TextField>
            {selectedLocalityId && selectedSeries.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={selectedSeries} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="Recrutas" stroke="#0B4DA1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {selectedLocalityId && selectedSeries.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhum ponto de histórico para esta localidade ainda.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {currentPerLocality.length > 0 && aggregateByMonth.length === 0 && byLocality.length === 0 && (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              O histórico (gráficos) será preenchido conforme as localidades forem atualizando o número de recrutas em GSD e Recrutas. Cada alteração gera um registro na data do dia.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
