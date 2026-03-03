import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Drawer,
  MenuItem,
  Stack,
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
  useLocalityRecruitMembers,
  useMe,
  useOmsCatalog,
  useReplaceLocalityRecruitMembers,
  useSetLocalityCommanderFromLdap,
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
const APP_HEADER_HEIGHT = 96;

type RecruitStatus =
  | 'RECRUITMENT_TO_START'
  | 'RECRUITMENT_STARTED'
  | 'DISMISSED'
  | 'ASSIGNED_TO_OM';

type RecruitMemberRow = {
  id?: string;
  name: string;
  status: RecruitStatus;
  dismissalReason?: string | null;
  destinationLocalityId?: string | null;
  dismissedAt?: string | null;
  designatedAt?: string | null;
};

const RECRUIT_STATUS_OPTIONS: Array<{ value: RecruitStatus; label: string }> = [
  { value: 'RECRUITMENT_TO_START', label: 'Recrutamento a iniciar' },
  { value: 'RECRUITMENT_STARTED', label: 'Recrutamento iniciado' },
  { value: 'DISMISSED', label: 'Desligada' },
  { value: 'ASSIGNED_TO_OM', label: 'Designada para OM' },
];

function formatHistoryDate(value: string) {
  const [year, month, day] = String(value ?? '').split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function statusLabel(status: RecruitStatus) {
  return RECRUIT_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function newRecruitDraft(): RecruitMemberRow {
  return {
    name: '',
    status: 'RECRUITMENT_TO_START',
    dismissalReason: null,
    destinationLocalityId: null,
    dismissedAt: null,
    designatedAt: null,
  };
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
  const omsCatalogQuery = useOmsCatalog(canLoadRecruitsData);
  const replaceRecruitMembers = useReplaceLocalityRecruitMembers();
  const setLocalityCommanderFromLdap = useSetLocalityCommanderFromLdap();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [memberRows, setMemberRows] = useState<RecruitMemberRow[]>([]);
  const [selectedRecruitKeys, setSelectedRecruitKeys] = useState<string[]>([]);
  const [bulkDismissReason, setBulkDismissReason] = useState('');
  const [bulkDestinationLocalityId, setBulkDestinationLocalityId] = useState('');
  const [commanderLdapUid, setCommanderLdapUid] = useState('');

  const selectedLocalityId = String(selected?.id ?? '');
  const recruitMembersQuery = useLocalityRecruitMembers(
    selectedLocalityId,
    drawerOpen && Boolean(selectedLocalityId),
  );

  const data = recruitsQuery.data;
  const managementItems = (data?.currentPerLocality ?? []).map((loc: any) => ({
    id: loc.localityId,
    name: loc.localityName,
    code: loc.code,
    commanderName: loc.commanderName ?? null,
    recruitsFemaleCountCurrent: loc.recruitsFemaleCountCurrent,
    recruitsByStatus: loc.recruitsByStatus ?? {
      toStart: 0,
      started: 0,
      dismissed: 0,
      assignedToOm: 0,
    },
  }));

  const historyCurrentPerLocality = useMemo(
    () =>
      (data?.currentPerLocality ?? []).filter(
        (loc: any) => Number(loc?.recruitsFemaleCountCurrent ?? 0) > 0,
      ),
    [data?.currentPerLocality],
  );
  const historyAggregateByMonth = data?.aggregateByMonth ?? [];
  const historyByLocality = data?.byLocality ?? [];
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
  const dismissedRecruitsLog = useMemo(() => {
    const rows = (data?.dismissedRecruitsLog ?? []) as any[];
    if (!selectedHistoryLocalityId) return rows;
    return rows.filter(
      (entry) => String(entry.localityId) === selectedHistoryLocalityId,
    );
  }, [data?.dismissedRecruitsLog, selectedHistoryLocalityId]);

  useEffect(() => {
    if (!drawerOpen || !selectedLocalityId) return;
    if (recruitMembersQuery.isLoading) return;
    const rows = ((recruitMembersQuery.data?.items ?? []) as Array<any>).map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      status: item.status as RecruitStatus,
      dismissalReason: item.dismissalReason ?? null,
      destinationLocalityId: item.destinationLocalityId ?? null,
      dismissedAt: item.dismissedAt ?? null,
      designatedAt: item.designatedAt ?? null,
    }));
    setMemberRows(rows);
    setSelectedRecruitKeys([]);
    setBulkDismissReason('');
    setBulkDestinationLocalityId('');
  }, [
    drawerOpen,
    recruitMembersQuery.data?.items,
    recruitMembersQuery.isLoading,
    selectedLocalityId,
  ]);

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (activeTab === requestedTab) return;

    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, requestedTab, searchParams, setSearchParams, visibleTabs.length]);

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
    setMemberRows([]);
    setSelectedRecruitKeys([]);
    setBulkDismissReason('');
    setBulkDestinationLocalityId('');
    setCommanderLdapUid('');
    setDrawerOpen(true);
  };

  const handleSetCommanderFromLdap = async () => {
    if (!selected) return;
    const uid = commanderLdapUid.trim();
    if (!uid) {
      toast.push({ message: 'Informe o UID/CPF no LDAP.', severity: 'warning' });
      return;
    }
    try {
      const response = await setLocalityCommanderFromLdap.mutateAsync({
        localityId: selected.id,
        uid,
      });
      const nextCommanderName = String(response?.commanderName ?? '').trim();
      setSelected((current: any) =>
        current ? { ...current, commanderName: nextCommanderName || current.commanderName } : current,
      );
      toast.push({
        message: nextCommanderName
          ? `Comandante atualizado para ${nextCommanderName}.`
          : 'Comandante atualizado com sucesso.',
        severity: 'success',
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao atualizar comandante via LDAP.',
        severity: 'error',
      });
    }
  };

  const omOptions = ((omsCatalogQuery.data?.items ?? []) as Array<any>).map((item) => ({
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? item.id),
  }));

  const rowKey = (row: RecruitMemberRow, index: number) => row.id || `draft-${index}`;

  const selectedRows = memberRows.filter((row, index) =>
    selectedRecruitKeys.includes(rowKey(row, index)),
  );

  const statusSummary = memberRows.reduce(
    (acc, row) => {
      if (row.status === 'RECRUITMENT_TO_START') acc.toStart += 1;
      else if (row.status === 'RECRUITMENT_STARTED') acc.started += 1;
      else if (row.status === 'DISMISSED') acc.dismissed += 1;
      else if (row.status === 'ASSIGNED_TO_OM') acc.assigned += 1;
      return acc;
    },
    { toStart: 0, started: 0, dismissed: 0, assigned: 0 },
  );
  const activeCount = statusSummary.toStart + statusSummary.started;

  const setMemberStatus = (keys: string[], status: RecruitStatus) => {
    const nowIso = new Date().toISOString();
    setMemberRows((current) =>
      current.map((row, index) => {
        const key = rowKey(row, index);
        if (!keys.includes(key)) return row;

        if (status === 'DISMISSED') {
          return {
            ...row,
            status,
            destinationLocalityId: null,
            designatedAt: null,
            dismissedAt: row.dismissedAt ?? nowIso,
          };
        }

        if (status === 'ASSIGNED_TO_OM') {
          return {
            ...row,
            status,
            dismissalReason: null,
            dismissedAt: null,
            designatedAt: row.designatedAt ?? nowIso,
          };
        }

        return {
          ...row,
          status,
          dismissalReason: null,
          dismissedAt: null,
          destinationLocalityId: null,
          designatedAt: null,
        };
      }),
    );
  };

  const handleMarkRecruitmentStarted = () => {
    if (!selectedRows.length) return;
    setMemberStatus(selectedRecruitKeys, 'RECRUITMENT_STARTED');
  };

  const handleMarkRecruitmentToStart = () => {
    if (!selectedRows.length) return;
    setMemberStatus(selectedRecruitKeys, 'RECRUITMENT_TO_START');
  };

  const handleBulkDismiss = () => {
    if (!selectedRows.length) return;
    const reason = bulkDismissReason.trim();
    if (!reason) {
      toast.push({ message: 'Informe o motivo da baixa para as recrutas selecionadas.', severity: 'warning' });
      return;
    }

    const nowIso = new Date().toISOString();
    setMemberRows((current) =>
      current.map((row, index) => {
        const key = rowKey(row, index);
        if (!selectedRecruitKeys.includes(key)) return row;
        return {
          ...row,
          status: 'DISMISSED',
          dismissalReason: reason,
          dismissedAt: row.dismissedAt ?? nowIso,
          destinationLocalityId: null,
          designatedAt: null,
        };
      }),
    );
  };

  const handleBulkDesignate = () => {
    if (!selectedRows.length) return;
    const destinationId = String(bulkDestinationLocalityId ?? '').trim();
    if (!destinationId) {
      toast.push({ message: 'Selecione a OM de destino para designação.', severity: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    setMemberRows((current) =>
      current.map((row, index) => {
        const key = rowKey(row, index);
        if (!selectedRecruitKeys.includes(key)) return row;
        return {
          ...row,
          status: 'ASSIGNED_TO_OM',
          destinationLocalityId: destinationId,
          designatedAt: row.designatedAt ?? nowIso,
          dismissalReason: null,
          dismissedAt: null,
        };
      }),
    );
  };

  const addRecruitRow = () => {
    setMemberRows((current) => [...current, newRecruitDraft()]);
  };

  const removeDraftRow = (index: number) => {
    setMemberRows((current) => current.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selected) return;

    const payloadItems = memberRows
      .map((row) => ({
        id: row.id,
        name: String(row.name ?? '').trim(),
        status: row.status,
        dismissalReason: row.dismissalReason?.trim() || null,
        destinationLocalityId: row.destinationLocalityId || null,
      }))
      .filter((row) => row.name);

    if (!payloadItems.length) {
      toast.push({ message: 'Inclua ao menos uma recruta com nome.', severity: 'warning' });
      return;
    }

    const hasDismissWithoutReason = payloadItems.some(
      (row) => row.status === 'DISMISSED' && !row.dismissalReason,
    );
    if (hasDismissWithoutReason) {
      toast.push({ message: 'Toda recruta desligada deve ter motivo da baixa.', severity: 'warning' });
      return;
    }

    const hasAssignedWithoutDestination = payloadItems.some(
      (row) => row.status === 'ASSIGNED_TO_OM' && !row.destinationLocalityId,
    );
    if (hasAssignedWithoutDestination) {
      toast.push({ message: 'Toda recruta designada deve ter OM de destino.', severity: 'warning' });
      return;
    }

    try {
      await replaceRecruitMembers.mutateAsync({
        localityId: selected.id,
        items: payloadItems,
      });
      toast.push({ message: 'Recrutas atualizadas com sucesso.', severity: 'success' });
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        GSD e Recrutas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gestão individual das recrutas por GSD, com status, baixas e designação de OM por pessoa.
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
                      Recrutas ativas
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                      Comandante (LDAP)
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                      Situação
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {managementItems.map((locality: any) => (
                    <TableRow
                      key={locality.id}
                      hover
                      onClick={() => openEdit(locality)}
                      sx={{
                        cursor: canEditRecruitsCount(me, locality.id) ? 'pointer' : 'default',
                      }}
                    >
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
                      <TableCell>{locality.recruitsFemaleCountCurrent ?? 0}</TableCell>
                      <TableCell>{locality.commanderName || '—'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={`A iniciar: ${locality.recruitsByStatus?.toStart ?? 0}`} variant="outlined" />
                          <Chip size="small" label={`Iniciado: ${locality.recruitsByStatus?.started ?? 0}`} color="info" variant="outlined" />
                          <Chip size="small" label={`Designadas: ${locality.recruitsByStatus?.assignedToOm ?? 0}`} color="success" variant="outlined" />
                          <Chip size="small" label={`Desligadas: ${locality.recruitsByStatus?.dismissed ?? 0}`} color="warning" variant="outlined" />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEdit(locality)}
                          disabled={!canEditRecruitsCount(me, locality.id)}
                        >
                          Editar recrutas
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
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                            Localidade
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                            Quantidade
                          </TableCell>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                <Card sx={{ mb: 2 }}>
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
                  </CardContent>
                </Card>
              )}

              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Histórico de alterações por quantidade
                  </Typography>
                  {historySelectedLog.length === 0 ? (
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
                            Motivo
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {historySelectedLog.map((entry: any, index: number) => (
                          <TableRow key={`${entry.localityId}:${entry.date}:${index}`} hover>
                            <TableCell>{formatHistoryDate(entry.date)}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {entry.localityName}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{entry.recruitsFemaleCount ?? 0}</TableCell>
                            <TableCell align="right">{entry.turnoverCount ?? 0}</TableCell>
                            <TableCell>{entry.dismissalReason || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recrutas desligadas (individual)
                  </Typography>
                  {dismissedRecruitsLog.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma baixa individual registrada para o filtro atual.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>Data da baixa</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>Recruta</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600 }}>Motivo</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dismissedRecruitsLog.map((entry: any) => (
                          <TableRow key={entry.recruitId} hover>
                            <TableCell>
                              {entry.dismissedAt
                                ? new Date(entry.dismissedAt).toLocaleDateString('pt-BR')
                                : '—'}
                            </TableCell>
                            <TableCell>{entry.recruitName}</TableCell>
                            <TableCell>{entry.localityName}</TableCell>
                            <TableCell>{entry.dismissalReason || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </Box>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', md: 760 },
            mt: `${APP_HEADER_HEIGHT}px`,
            height: `calc(100% - ${APP_HEADER_HEIGHT}px)`,
          },
        }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2} sx={{ height: '100%', overflow: 'auto' }}>
          <Typography variant="h6">Gestão individual de recrutas</Typography>
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
                label="Comandante atual"
                value={selected.commanderName ?? ''}
                fullWidth
                InputProps={{ readOnly: true }}
                placeholder="Não definido"
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  size="small"
                  label="UID/CPF do comandante (LDAP)"
                  value={commanderLdapUid}
                  onChange={(event) => setCommanderLdapUid(event.target.value)}
                  placeholder="Ex.: 12229820729"
                  sx={{ minWidth: 280 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleSetCommanderFromLdap}
                  disabled={setLocalityCommanderFromLdap.isPending}
                >
                  Definir comandante via LDAP
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Ativas: ${activeCount}`} color="primary" />
                <Chip label={`A iniciar: ${statusSummary.toStart}`} variant="outlined" />
                <Chip label={`Iniciadas: ${statusSummary.started}`} variant="outlined" />
                <Chip label={`Designadas: ${statusSummary.assigned}`} color="success" variant="outlined" />
                <Chip label={`Desligadas: ${statusSummary.dismissed}`} color="warning" variant="outlined" />
              </Stack>

              <Alert severity="info">
                Selecione uma ou mais recrutas para ações em lote: iniciar recrutamento, desligar com motivo e designar para OM.
              </Alert>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Button variant="outlined" onClick={addRecruitRow}>Adicionar recruta</Button>
                <Button variant="outlined" onClick={handleMarkRecruitmentToStart} disabled={!selectedRows.length}>
                  Marcar a iniciar
                </Button>
                <Button variant="outlined" onClick={handleMarkRecruitmentStarted} disabled={!selectedRows.length}>
                  Marcar recrutamento iniciado
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  size="small"
                  label="Motivo da baixa"
                  value={bulkDismissReason}
                  onChange={(event) => setBulkDismissReason(event.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <Button color="warning" variant="outlined" onClick={handleBulkDismiss} disabled={!selectedRows.length}>
                  Registrar baixa das selecionadas
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Autocomplete
                  size="small"
                  options={omOptions}
                  value={omOptions.find((option) => option.id === bulkDestinationLocalityId) ?? null}
                  onChange={(_, option) => setBulkDestinationLocalityId(option?.id ?? '')}
                  getOptionLabel={(option) => option.code ? `${option.name} (${option.code})` : option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => <TextField {...params} label="OM de destino" />}
                  sx={{ minWidth: 300 }}
                />
                <Button color="success" variant="outlined" onClick={handleBulkDesignate} disabled={!selectedRows.length}>
                  Designar selecionadas para OM
                </Button>
              </Stack>

              {recruitMembersQuery.isLoading ? (
                <Typography variant="body2" color="text.secondary">Carregando recrutas...</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: 40 }}>
                        <Checkbox
                          size="small"
                          checked={memberRows.length > 0 && selectedRecruitKeys.length === memberRows.length}
                          indeterminate={selectedRecruitKeys.length > 0 && selectedRecruitKeys.length < memberRows.length}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedRecruitKeys(memberRows.map((row, index) => rowKey(row, index)));
                            } else {
                              setSelectedRecruitKeys([]);
                            }
                          }}
                          sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>OM destino</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Baixa</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {memberRows.map((row, index) => {
                      const key = rowKey(row, index);
                      const isSelected = selectedRecruitKeys.includes(key);
                      return (
                        <TableRow key={key} hover>
                          <TableCell>
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={(event) => {
                                setSelectedRecruitKeys((current) => {
                                  if (event.target.checked) return [...current, key];
                                  return current.filter((item) => item !== key);
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={row.name}
                              onChange={(event) =>
                                setMemberRows((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, name: event.target.value } : item,
                                  ),
                                )
                              }
                              placeholder="Nome da recruta"
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              value={row.status}
                              onChange={(event) => {
                                const nextStatus = event.target.value as RecruitStatus;
                                setMemberRows((current) =>
                                  current.map((item, itemIndex) => {
                                    if (itemIndex !== index) return item;
                                    if (nextStatus === 'DISMISSED') {
                                      return {
                                        ...item,
                                        status: nextStatus,
                                        destinationLocalityId: null,
                                        designatedAt: null,
                                      };
                                    }
                                    if (nextStatus === 'ASSIGNED_TO_OM') {
                                      return {
                                        ...item,
                                        status: nextStatus,
                                        dismissalReason: null,
                                        dismissedAt: null,
                                      };
                                    }
                                    return {
                                      ...item,
                                      status: nextStatus,
                                      destinationLocalityId: null,
                                      designatedAt: null,
                                      dismissalReason: null,
                                      dismissedAt: null,
                                    };
                                  }),
                                );
                              }}
                              sx={{ minWidth: 190 }}
                            >
                              {RECRUIT_STATUS_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            {row.status === 'ASSIGNED_TO_OM' ? (
                              <Autocomplete
                                size="small"
                                options={omOptions}
                                value={omOptions.find((option) => option.id === row.destinationLocalityId) ?? null}
                                onChange={(_, option) =>
                                  setMemberRows((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, destinationLocalityId: option?.id ?? null }
                                        : item,
                                    ),
                                  )
                                }
                                getOptionLabel={(option) => option.code ? `${option.name} (${option.code})` : option.name}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                renderInput={(params) => <TextField {...params} size="small" placeholder="Selecione a OM" />}
                                sx={{ minWidth: 220 }}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.status === 'DISMISSED' ? (
                              <Stack spacing={0.8}>
                                <TextField
                                  size="small"
                                  value={row.dismissalReason ?? ''}
                                  onChange={(event) =>
                                    setMemberRows((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, dismissalReason: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  placeholder="Motivo da baixa"
                                  fullWidth
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {row.dismissedAt
                                    ? `Baixa em ${new Date(row.dismissedAt).toLocaleDateString('pt-BR')}`
                                    : 'Baixa será registrada na data de hoje.'}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {!row.id && (
                              <Button color="error" size="small" onClick={() => removeDraftRow(index)}>
                                Remover
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          )}
          <Box display="flex" gap={1} justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={
                !selected ||
                !canEditRecruitsCount(me, selected.id) ||
                replaceRecruitMembers.isPending ||
                recruitMembersQuery.isLoading
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
