import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChecklists, usePhases, useSpecialties, useUpdateChecklistStatus, useMe } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { can } from '../app/rbac';
import { api } from '../api/client';

const statusColors: Record<string, string> = {
  NOT_STARTED: '#EEF2F7',
  IN_PROGRESS: '#FFF6E1',
  DONE: '#E8F8EF',
};

export function ChecklistsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const toast = useToast();
  const { data: me } = useMe();
  const updateStatus = useUpdateChecklistStatus();

  const phaseId = params.get('phaseId') ?? '';
  const specialtyId = params.get('specialtyId') ?? '';

  const filters = useMemo(
    () => ({
      phaseId: phaseId || undefined,
      specialtyId: specialtyId || undefined,
    }),
    [phaseId, specialtyId],
  );

  const checklistsQuery = useChecklists(filters);
  const phasesQuery = usePhases();
  const specialtiesQuery = useSpecialties();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams({});

  const handleCycleStatus = async (itemId: string, localityId: string, current: string) => {
    const order = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    try {
      await updateStatus.mutateAsync({ updates: [{ checklistItemId: itemId, localityId, status: next }] });
      toast.push({ message: 'Checklist atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar checklist', severity: 'error' });
    }
  };

  if (checklistsQuery.isLoading) return <SkeletonState />;
  if (checklistsQuery.isError) return <ErrorState error={checklistsQuery.error} onRetry={() => checklistsQuery.refetch()} />;

  const data = checklistsQuery.data ?? { items: [], localities: [] };
  const filteredItems = (data.items ?? []).filter((item: any) => {
    if (tab === 0) return Boolean(item.phaseId);
    if (tab === 1) return Boolean(item.specialtyId);
    return true;
  });
  const canUpdate = can(me, 'checklists', 'update');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Checklists</Typography>
        {can(me, 'checklists', 'export') && (
          <Button
            variant="outlined"
            onClick={() => {
              const query = new URLSearchParams(filters as any).toString();
              const base = api.defaults.baseURL ?? '';
              window.open(`${base}/exports/checklists.csv?${query}`, '_blank');
            }}
          >
            Exportar CSV
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              size="small"
              label="Fase"
              value={phaseId}
              onChange={(e) => updateParam('phaseId', e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {(phasesQuery.data?.items ?? []).map((p: any) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Especialidade"
              value={specialtyId}
              onChange={(e) => updateParam('specialtyId', e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {(specialtiesQuery.data?.items ?? []).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="text" onClick={clearFilters}>
              Limpar
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Por fase" />
        <Tab label="Por especialidade" />
      </Tabs>

      {filteredItems.length === 0 && (
        <EmptyState title="Nenhum checklist" description="Crie um checklist para acompanhar a execução." />
      )}

      {filteredItems.map((checklist: any) => (
        <Card key={checklist.id} sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">{checklist.title}</Typography>
              <Stack direction="row" spacing={1}>
                {(checklist.localityProgress ?? []).map((entry: any) => {
                  const localityName = data.localities.find((l: any) => l.id === entry.localityId)?.name ?? 'Localidade';
                  return (
                    <Chip key={entry.localityId} label={`${localityName}: ${entry.percent}%`} />
                  );
                })}
              </Stack>
            </Stack>
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: 'left', pb: 1 }}>
                    Item
                  </Box>
                  {(data.localities ?? []).map((loc: any) => (
                    <Box key={loc.id} component="th" sx={{ textAlign: 'center', pb: 1 }}>
                      {loc.name}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {(checklist.items ?? []).map((item: any) => (
                  <Box key={item.id} component="tr" sx={{ borderTop: '1px solid #E6ECF5' }}>
                    <Box component="td" sx={{ py: 1 }}>
                      <Typography variant="body2">{item.title}</Typography>
                    </Box>
                    {(data.localities ?? []).map((loc: any) => {
                      const status = item.statuses?.[loc.id] ?? 'NOT_STARTED';
                      return (
                        <Box key={loc.id} component="td" sx={{ py: 1, textAlign: 'center' }}>
                          <Chip
                            size="small"
                            label={status}
                            sx={{ background: statusColors[status], cursor: canUpdate && !item.taskTemplateId ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (!canUpdate || item.taskTemplateId) return;
                              handleCycleStatus(item.id, loc.id, status);
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
