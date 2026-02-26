import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  MenuItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useDashboardRecruits,
  useMe,
  useUpdateLocalityRecruits,
} from '../api/hooks';
import { can } from '../app/rbac';
import { canEditRecruitsCount } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
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

type RecruitsTab = 'gestao' | 'historico';

function formatHistoryDate(value: string) {
  const [year, month, day] = String(value ?? '').split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function GsdRecruitsPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const canViewHistoryTab = can(me, 'dashboard', 'view');
  const canViewGsdTab =
    can(me, 'localities', 'view') ||
    (can(me, 'dashboard', 'view') && Boolean(me?.localityId));
  const canLoadRecruitsData = can(me, 'dashboard', 'view');

  const visibleTabs = useMemo<RecruitsTab[]>(() => {
    const tabs: RecruitsTab[] = [];
    if (canViewGsdTab) tabs.push('gestao');
    if (canViewHistoryTab) tabs.push('historico');
    return tabs;
  }, [canViewGsdTab, canViewHistoryTab]);

  const requestedTab =
    searchParams.get('tab') === 'historico' ? 'historico' : 'gestao';
  const activeTab = visibleTabs.includes(requestedTab)
    ? requestedTab
    : visibleTabs[0] ?? 'gestao';

  const selectedHistoryLocalityId = searchParams.get('localityId') ?? '';

  const recruitsQuery = useDashboardRecruits({}, canLoadRecruitsData);
  const updateLocalityRecruits = useUpdateLocalityRecruits();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [formRecruitsCount, setFormRecruitsCount] = useState<string>('');
  const [formDismissalReason, setFormDismissalReason] = useState<string>('');

  const data = recruitsQuery.data;
  const managementItems = (data?.currentPerLocality ?? []).map((loc: any) => ({
    id: loc.localityId,
    name: loc.localityName,
    code: loc.code,
    recruitsFemaleCountCurrent: loc.recruitsFemaleCountCurrent,
  }));

  const historyCurrentPerLocality = useMemo(
    () =>
      (data?.currentPerLocality ?? []).filter(
        (loc: any) => Number(loc?.recruitsFemaleCountCurrent ?? 0) > 0,
      ),
    [data?.currentPerLocality],
  );
  const historyAggregateByMonth = data?.aggregateByMonth ?? [];
  const historyByLocality = useMemo(() => {
    const visibleLocalityIds = new Set(
      historyCurrentPerLocality.map((loc: any) => String(loc.localityId)),
    );
    return (data?.byLocality ?? []).filter((loc: any) =>
      visibleLocalityIds.has(String(loc.localityId)),
    );
  }, [data?.byLocality, historyCurrentPerLocality]);

  const historySelectedSeries = useMemo(() => {
    if (!selectedHistoryLocalityId) return [];
    const locality = historyByLocality.find(
      (entry: any) => String(entry.localityId) === selectedHistoryLocalityId,
    );
    return locality?.series ?? [];
  }, [historyByLocality, selectedHistoryLocalityId]);
  const historyLog = data?.historyLog ?? [];
  const historySelectedLog = useMemo(() => {
    if (!selectedHistoryLocalityId) return historyLog;
    return historyLog.filter(
      (entry: any) => String(entry.localityId) === selectedHistoryLocalityId,
    );
  }, [historyLog, selectedHistoryLocalityId]);
  const historyRowsForTable = useMemo(
    () => historySelectedLog,
    [historySelectedLog],
  );

  const historyTotalCurrent = historyCurrentPerLocality.reduce(
    (acc: number, loc: any) => acc + (loc.recruitsFemaleCountCurrent ?? 0),
    0,
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (activeTab === requestedTab) return;

    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, requestedTab, searchParams, setSearchParams, visibleTabs.length]);

  useEffect(() => {
    if (!selectedHistoryLocalityId) return;
    const stillAvailable = historyByLocality.some(
      (loc: any) => String(loc.localityId) === selectedHistoryLocalityId,
    );
    if (!stillAvailable) {
      const next = new URLSearchParams(searchParams);
      next.delete('localityId');
      setSearchParams(next, { replace: true });
    }
  }, [historyByLocality, searchParams, selectedHistoryLocalityId, setSearchParams]);

  if (meLoading) return <SkeletonState />;
  if (!visibleTabs.length) {
    return <ErrorState error={{ message: 'Acesso negado' }} />;
  }
  if (canLoadRecruitsData && recruitsQuery.isLoading) return <SkeletonState />;
  if (canLoadRecruitsData && recruitsQuery.isError) {
    return (
      <ErrorState
        error={recruitsQuery.error}
        onRetry={() => recruitsQuery.refetch()}
      />
    );
  }

  const handleTabChange = (_: unknown, nextTab: RecruitsTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    if (nextTab !== 'historico') {
      next.delete('localityId');
    }
    setSearchParams(next, { replace: true });
  };

  const openEdit = (locality: any) => {
    if (!canEditRecruitsCount(me, locality.id)) return;
    setSelected(locality);
    setFormRecruitsCount(String(locality.recruitsFemaleCountCurrent ?? ''));
    setFormDismissalReason('');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;

    const value = Number(formRecruitsCount);
    if (!Number.isInteger(value) || value < 0) {
      toast.push({
        message: 'Informe um número inteiro maior ou igual a zero.',
        severity: 'warning',
      });
      return;
    }
    const previousValue = Number(selected.recruitsFemaleCountCurrent ?? 0);
    const isDismissal = value < previousValue;
    if (isDismissal && !formDismissalReason.trim()) {
      toast.push({
        message: 'Informe o motivo da baixa/desligamento.',
        severity: 'warning',
      });
      return;
    }

    try {
      await updateLocalityRecruits.mutateAsync({
        id: selected.id,
        recruitsFemaleCountCurrent: value,
        dismissalReason: isDismissal ? formDismissalReason.trim() : null,
      });
      toast.push({
        message: 'Número de recrutas atualizado com histórico.',
        severity: 'success',
      });
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao atualizar recrutas.',
        severity: 'error',
      });
    }
  };

  const openHistoryForLocality = (localityId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'historico');
    next.set('localityId', localityId);
    setSearchParams(next, { replace: true });
  };
  const parsedFormCount = Number(formRecruitsCount);
  const selectedCurrentCount = Number(selected?.recruitsFemaleCountCurrent ?? 0);
  const isDismissalChange =
    Boolean(selected) &&
    Number.isFinite(parsedFormCount) &&
    parsedFormCount < selectedCurrentCount;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        GSD e Recrutas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gestão de quantitativo atual e histórico de recrutas em um único módulo.
      </Typography>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
        {canViewGsdTab && <Tab value="gestao" label="Gestão por localidade" />}
        {canViewHistoryTab && <Tab value="historico" label="Histórico de recrutas" />}
      </Tabs>

      {activeTab === 'gestao' && (
        <Card>
          <CardContent>
            {!canLoadRecruitsData ? (
              <ErrorState
                error={{
                  message:
                    'Você não possui permissão para visualizar o quantitativo de recrutas.',
                }}
              />
            ) : managementItems.length === 0 ? (
              <EmptyState
                title="Sem localidades"
                description="Nenhuma localidade disponível no seu escopo."
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                      Localidade
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                      Recrutas femininos
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {managementItems.map((locality: any) => (
                    <TableRow key={locality.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {locality.name}
                        </Typography>
                        {locality.code && (
                          <Typography variant="caption" color="text.secondary">
                            {locality.code}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {locality.recruitsFemaleCountCurrent ?? 0}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEdit(locality)}
                          disabled={!canEditRecruitsCount(me, locality.id)}
                        >
                          Editar quantidade
                        </Button>
                        {canViewHistoryTab && (
                          <Button
                            size="small"
                            sx={{ ml: 0.5 }}
                            onClick={() => openHistoryForLocality(locality.id)}
                          >
                            Ver histórico
                          </Button>
                        )}
                        <Button
                          size="small"
                          component={Link}
                          to={`/activities?localityId=${locality.id}`}
                          sx={{ ml: 0.5 }}
                        >
                          Ver atividades da GSD
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'historico' && (
        <Box>
          {!canLoadRecruitsData ? (
            <ErrorState
              error={{
                message:
                  'Você não possui permissão para visualizar o histórico de recrutas.',
              }}
            />
          ) : (
            <>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quantitativo atual por localidade
                  </Typography>
                  {historyCurrentPerLocality.length === 0 ? (
                    <EmptyState
                      title="Sem dados"
                      description="Nenhuma localidade no seu escopo com recrutas maior que zero."
                    />
                  ) : (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Total atual: <strong>{historyTotalCurrent}</strong> recrutas femininas
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                              Localidade
                            </TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                              Quantidade
                            </TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ação</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {historyCurrentPerLocality.map((locality: any) => (
                            <TableRow key={locality.localityId} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {locality.localityName}
                                </Typography>
                                {locality.code && (
                                  <Typography variant="caption" color="text.secondary">
                                    {locality.code}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {locality.recruitsFemaleCountCurrent ?? 0}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    const next = new URLSearchParams(searchParams);
                                    next.set('tab', 'gestao');
                                    setSearchParams(next, { replace: true });
                                  }}
                                >
                                  Editar em gestão
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>

              {historyAggregateByMonth.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Quantitativo geral por mês
                    </Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={historyAggregateByMonth}
                        margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          name="Recrutas"
                          fill="#0B4DA1"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {historyByLocality.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Histórico por localidade
                    </Typography>
                    <TextField
                      select
                      size="small"
                      label="Localidade"
                      value={selectedHistoryLocalityId}
                      onChange={(event) => {
                        const value = event.target.value;
                        const next = new URLSearchParams(searchParams);
                        if (value) next.set('localityId', value);
                        else next.delete('localityId');
                        setSearchParams(next, { replace: true });
                      }}
                      sx={{ minWidth: 220, mb: 2 }}
                    >
                      <MenuItem value="">Selecione uma localidade</MenuItem>
                      {historyByLocality.map((locality: any) => (
                        <MenuItem
                          key={locality.localityId}
                          value={String(locality.localityId)}
                        >
                          {locality.localityName} ({locality.code})
                        </MenuItem>
                      ))}
                    </TextField>
                    {selectedHistoryLocalityId && historySelectedSeries.length > 0 && (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart
                          data={historySelectedSeries}
                          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name="Recrutas"
                            stroke="#0B4DA1"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                    {selectedHistoryLocalityId && historySelectedSeries.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Nenhum ponto de histórico para esta localidade ainda.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Histórico consultável de alterações
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Quantidade por época e motivo de desligamento (quando houver baixa).
                  </Typography>
                  {historyRowsForTable.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem registros para o filtro/localidade selecionado.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                            Data
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                            Localidade
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                            Quantidade
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                            Baixas
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                            Motivo do desligamento
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {historyRowsForTable.map((entry: any, index: number) => (
                          <TableRow key={`${entry.localityId}:${entry.date}:${index}`} hover>
                            <TableCell>{formatHistoryDate(entry.date)}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {entry.localityName}
                              </Typography>
                              {entry.code && (
                                <Typography variant="caption" color="text.secondary">
                                  {entry.code}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {entry.recruitsFemaleCount ?? 0}
                            </TableCell>
                            <TableCell align="right">
                              {entry.turnoverCount ?? 0}
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ whiteSpace: 'pre-wrap' }}
                              >
                                {entry.dismissalReason || '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {historyCurrentPerLocality.length > 0 &&
                historyAggregateByMonth.length === 0 &&
                historyByLocality.length === 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        O histórico será preenchido conforme as localidades forem
                        atualizando o número de recrutas em Gestão por localidade.
                      </Typography>
                    </CardContent>
                  </Card>
                )}
            </>
          )}
        </Box>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 400 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">Atualizar recrutas</Typography>
          {selected && (
            <>
              <TextField
                size="small"
                label="Localidade"
                value={selected.name}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <TextField
                size="small"
                type="number"
                label="Recrutas femininos"
                value={formRecruitsCount}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setFormRecruitsCount(nextValue);
                  const parsed = Number(nextValue);
                  if (!Number.isFinite(parsed) || parsed >= selectedCurrentCount) {
                    setFormDismissalReason('');
                  }
                }}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                size="small"
                label="Motivo da baixa (desligamento)"
                value={formDismissalReason}
                onChange={(e) => setFormDismissalReason(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={!isDismissalChange}
                helperText={
                  isDismissalChange
                    ? 'Obrigatório quando houver redução da quantidade.'
                    : 'Preenchido apenas quando a nova quantidade for menor que a atual.'
                }
              />
              <Typography variant="caption" color="text.secondary">
                O sistema registra automaticamente o histórico da alteração na data
                de hoje, incluindo motivo da baixa quando houver desligamento.
              </Typography>
            </>
          )}
          <Box display="flex" gap={1} justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={
                !selected ||
                !canEditRecruitsCount(me, selected.id) ||
                updateLocalityRecruits.isPending
              }
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
