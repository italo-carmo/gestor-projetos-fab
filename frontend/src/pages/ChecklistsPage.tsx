import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChecklists, usePhases, useSpecialties, useEloRoles, useCreateChecklist, useMe } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { can } from '../app/rbac';
import { api } from '../api/client';
import { CHECKLIST_ITEM_STATUS_LABELS } from '../constants/enums';

const DONE_COLOR = '#2e7d32';
const PENDING_COLOR = '#9e9e9e';
const IN_PROGRESS_COLOR = '#ed6c02';

function StatusIcon({ status, localityName }: { status: string; localityName: string }) {
  const label = CHECKLIST_ITEM_STATUS_LABELS[status] ?? status;
  const content = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        borderRadius: 1,
      }}
    >
      {status === 'DONE' && <CheckCircleRoundedIcon sx={{ fontSize: 28, color: DONE_COLOR }} />}
      {status === 'IN_PROGRESS' && <ScheduleRoundedIcon sx={{ fontSize: 26, color: IN_PROGRESS_COLOR }} />}
      {(status === 'NOT_STARTED' || status === 'STARTED') && (
        <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 26, color: PENDING_COLOR }} />
      )}
    </Box>
  );
  return (
    <Tooltip title={`${localityName}: ${label}`} arrow placement="top">
      <span>{content}</span>
    </Tooltip>
  );
}

export function ChecklistsPage() {
  const [params, setParams] = useSearchParams();
  const [viewByLocality, setViewByLocality] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const toast = useToast();
  const { data: me } = useMe();

  const phaseId = params.get('phaseId') ?? '';
  const specialtyId = params.get('specialtyId') ?? '';
  const eloRoleId = params.get('eloRoleId') ?? '';
  const itemSourceType = params.get('itemSourceType') ?? '';

  const filters = useMemo(
    () => ({
      phaseId: phaseId || undefined,
      specialtyId: specialtyId || undefined,
      eloRoleId: eloRoleId || undefined,
    }),
    [phaseId, specialtyId, eloRoleId],
  );

  const checklistsQuery = useChecklists(filters);
  const phasesQuery = usePhases();
  const specialtiesQuery = useSpecialties();
  const eloRolesQuery = useEloRoles();
  const createChecklist = useCreateChecklist();
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createPhaseId, setCreatePhaseId] = useState('');
  const [createSpecialtyId, setCreateSpecialtyId] = useState('');
  const [createEloRoleId, setCreateEloRoleId] = useState('');

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams({});

  const data = checklistsQuery.data ?? { items: [], localities: [] };
  const phases = (phasesQuery.data?.items ?? []) as any[];
  const specialties = (specialtiesQuery.data?.items ?? []) as any[];
  const phaseMap = new Map<string, string>(phases.map((p: any) => [String(p.id), String(p.name)]));
  const specialtyMap = new Map<string, string>(specialties.map((s: any) => [String(s.id), String(s.name)]));
  const localities = data.localities ?? [];
  const checklists = data.items ?? [];

  const checklistsToRender = useMemo(() => {
    if (showDuplicates) return checklists;

    const grouped = new Map<string, any>();
    for (const checklist of checklists) {
      const key = [
        String(checklist.title ?? '').trim().toLocaleLowerCase('pt-BR'),
        checklist.phaseId ?? '',
        checklist.specialtyId ?? '',
        checklist.eloRoleId ?? '',
      ].join('|');

      const prev = grouped.get(key);
      if (!prev) {
        grouped.set(key, { ...checklist, duplicateCount: 1 });
        continue;
      }

      const prevDate = new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime();
      const nextDate = new Date(checklist.updatedAt ?? checklist.createdAt ?? 0).getTime();
      if (nextDate >= prevDate) {
        grouped.set(key, { ...checklist, duplicateCount: (prev.duplicateCount ?? 1) + 1 });
      } else {
        prev.duplicateCount = (prev.duplicateCount ?? 1) + 1;
      }
    }

    return Array.from(grouped.values());
  }, [checklists, showDuplicates]);

  const hiddenDuplicates = Math.max(0, checklists.length - checklistsToRender.length);
  const filteredByPhase = phaseId
    ? checklistsToRender.filter((c: any) => c.phaseId === phaseId)
    : checklistsToRender;

  const handleCreateChecklist = async () => {
    if (!createTitle.trim()) return;
    try {
      await createChecklist.mutateAsync({
        title: createTitle.trim(),
        phaseId: createPhaseId || undefined,
        specialtyId: createSpecialtyId || undefined,
        eloRoleId: createEloRoleId || undefined,
      });
      toast.push({ message: 'Checklist criado', severity: 'success' });
      setCreateOpen(false);
      setCreateTitle('');
      setCreatePhaseId('');
      setCreateSpecialtyId('');
      setCreateEloRoleId('');
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao criar checklist', severity: 'error' });
    }
  };

  if (checklistsQuery.isLoading) return <SkeletonState />;
  if (checklistsQuery.isError)
    return <ErrorState error={checklistsQuery.error} onRetry={() => checklistsQuery.refetch()} />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Checklist por fase
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Filtre por fase e veja o panorama de execução de tarefas e atividades por localidade.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {can(me, 'checklists', 'create') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Criar checklist
            </Button>
          )}
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
      </Stack>

      <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Este checklist é automático: os checks são renderizados pelo andamento real de tarefas e atividades de cada localidade.
          </Alert>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Legenda:
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleRoundedIcon sx={{ fontSize: 20, color: DONE_COLOR }} />
              <Typography variant="caption">Concluída</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleRoundedIcon sx={{ fontSize: 20, color: IN_PROGRESS_COLOR }} />
              <Typography variant="caption">Em andamento</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 20, color: PENDING_COLOR }} />
              <Typography variant="caption">Pendente</Typography>
            </Stack>
            <Chip
              size="small"
              color="info"
              variant="outlined"
              label="Atualização automática: concluído quando tarefa/atividade for finalizada"
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              select
              size="small"
              label="Fase"
              value={phaseId}
              onChange={(e) => updateParam('phaseId', e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Todas as fases</MenuItem>
              {phases.map((p: any) => (
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
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {(specialtiesQuery.data?.items ?? []).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Elo responsável"
              value={eloRoleId}
              onChange={(e) => updateParam('eloRoleId', e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {(eloRolesQuery.data?.items ?? []).map((r: any) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Tipo de item"
              value={itemSourceType}
              onChange={(e) => updateParam('itemSourceType', e.target.value)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="TASK">Somente tarefas</MenuItem>
              <MenuItem value="ACTIVITY">Somente atividades</MenuItem>
            </TextField>
            <Button variant="text" onClick={clearFilters} sx={{ ml: 1 }}>
              Limpar filtros
            </Button>
            <FormControlLabel
              control={<Switch size="small" checked={showDuplicates} onChange={(e) => setShowDuplicates(e.target.checked)} />}
              label={showDuplicates ? 'Exibindo duplicados' : 'Ocultar duplicados'}
            />
            <Box flexGrow={1} />
            <Chip
              label={viewByLocality ? 'Ver por item' : 'Ver por localidade'}
              onClick={() => setViewByLocality((v) => !v)}
              variant={viewByLocality ? 'filled' : 'outlined'}
              size="small"
            />
          </Stack>
          {!showDuplicates && hiddenDuplicates > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {hiddenDuplicates} checklist(s) duplicado(s) ocultado(s).
            </Typography>
          )}
        </CardContent>
      </Card>

      {!phaseId && checklists.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Selecione uma fase para ver o checklist daquela fase.
        </Typography>
      )}

      {filteredByPhase.length === 0 && (
        <EmptyState
          title="Nenhum checklist"
          description={
            phaseId
              ? 'Nenhum checklist encontrado para esta fase. Crie um checklist vinculado a esta fase.'
              : 'Selecione uma fase no filtro acima ou crie um checklist para acompanhar a execução.'
          }
        />
      )}

      {filteredByPhase.map((checklist: any) => {
        const items = checklist.items ?? [];
        const filteredItems = itemSourceType
          ? items.filter((item: any) => item.sourceType === itemSourceType)
          : items;
        const localityProgress = localities.map((locality: any) => {
          if (filteredItems.length === 0) return { localityId: locality.id, percent: 0 };
          const doneCount = filteredItems.filter(
            (item: any) => item.statuses?.[locality.id] === 'DONE',
          ).length;
          return {
            localityId: locality.id,
            percent: Math.round((doneCount / filteredItems.length) * 100),
          };
        });
        const completedLocalities = localityProgress.filter((p: any) => p.percent === 100).length;
        const totalLocalities = localities.length;
        const progressPercent = totalLocalities ? Math.round((completedLocalities / totalLocalities) * 100) : 0;

        return (
          <Card
            key={checklist.id}
            sx={{
              mb: 2,
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ pb: 0 }}>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  {checklist.title}
                </Typography>
                {(checklist.duplicateCount ?? 1) > 1 && (
                  <Chip size="small" variant="outlined" label={`${checklist.duplicateCount} semelhantes`} />
                )}
                {checklist.phaseId && (
                  <Chip label={phaseMap.get(checklist.phaseId) ?? checklist.phaseId} size="small" color="primary" variant="outlined" />
                )}
                {checklist.specialtyId && (
                  <Chip
                    label={specialtyMap.get(checklist.specialtyId) ?? 'Especialidade'}
                    size="small"
                    variant="outlined"
                  />
                )}
                {checklist.eloRole && (
                  <Chip label={checklist.eloRole.name} size="small" variant="outlined" title={`Elo: ${checklist.eloRole.code}`} />
                )}
              </Stack>

              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>{completedLocalities}</strong> de <strong>{totalLocalities}</strong> localidades concluíram todos os itens
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progressPercent}
                  sx={{ flex: 1, maxWidth: 200, height: 6, borderRadius: 1 }}
                  color="primary"
                />
                <Typography variant="caption" color="text.secondary">
                  {progressPercent}%
                </Typography>
              </Stack>

              {localities.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma localidade no escopo.
                </Typography>
              ) : filteredItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum item do tipo selecionado neste checklist.
                </Typography>
              ) : viewByLocality ? (
                <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& th, & td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, width: 180, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                        Localidade
                      </TableCell>
                      {filteredItems.map((item: any) => (
                        <TableCell key={item.id} align="center" sx={{ fontWeight: 600, minWidth: 44 }}>
                          <Tooltip title={item.title}>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 80, display: 'block' }}>
                              {item.title.slice(0, 12)}
                              {item.title.length > 12 ? '…' : ''}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {localities.map((loc: any) => (
                      <TableRow key={loc.id} hover>
                        <TableCell sx={{ fontWeight: 500, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                          {loc.name}
                        </TableCell>
                        {filteredItems.map((item: any) => {
                          const status = item.statuses?.[loc.id] ?? 'NOT_STARTED';
                          return (
                            <TableCell key={item.id} align="center" sx={{ py: 0.75 }}>
                              <StatusIcon
                                status={status}
                                localityName={loc.name}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& th, & td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, minWidth: 220, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                        Item
                      </TableCell>
                      {localities.map((loc: any) => (
                        <TableCell key={loc.id} align="center" sx={{ fontWeight: 600, minWidth: 52 }}>
                          <Tooltip title={loc.name}>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 72, display: 'block' }}>
                              {loc.name.length > 10 ? loc.name.slice(0, 9) + '…' : loc.name}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredItems.map((item: any) => (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ fontWeight: 500, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={500}>
                              {item.title}
                            </Typography>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={item.sourceType === 'TASK' ? 'Tarefa' : 'Atividade'}
                            />
                          </Stack>
                        </TableCell>
                        {localities.map((loc: any) => {
                          const status = item.statuses?.[loc.id] ?? 'NOT_STARTED';
                          return (
                            <TableCell key={loc.id} align="center" sx={{ py: 0.75 }}>
                              <StatusIcon
                                status={status}
                                localityName={loc.name}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Criar checklist</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Título"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              select
              label="Fase"
              value={createPhaseId}
              onChange={(e) => setCreatePhaseId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Nenhuma</MenuItem>
              {(phasesQuery.data?.items ?? []).map((p: any) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Especialidade"
              value={createSpecialtyId}
              onChange={(e) => setCreateSpecialtyId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Nenhuma</MenuItem>
              {(specialtiesQuery.data?.items ?? []).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Elo responsável"
              value={createEloRoleId}
              onChange={(e) => setCreateEloRoleId(e.target.value)}
              fullWidth
              helperText="Ex.: Psicologia, SSO — quem acompanha este checklist a nível Brasil"
            >
              <MenuItem value="">Nenhum</MenuItem>
              {(eloRolesQuery.data?.items ?? []).map((r: any) => (
                <MenuItem key={r.id} value={r.id}>{r.name} ({r.code})</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateChecklist} disabled={!createTitle.trim() || createChecklist.isPending}>
            {createChecklist.isPending ? 'Criando…' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
