import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChecklists, usePhases, useSpecialties, useEloRoles, useMe } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { can } from '../app/rbac';
import { api } from '../api/client';
import { CHECKLIST_ITEM_STATUS_LABELS } from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';

const DONE_COLOR = '#2e7d32';
const PENDING_COLOR = '#9e9e9e';
const IN_PROGRESS_COLOR = '#ed6c02';
const CHECKLIST_TABLE_STICKY_TOP = 76;
const CHECKLIST_HEADER_BG = '#17394B';

function StatusIcon({
  status,
  localityName,
  onClick,
  disabled,
}: {
  status: string;
  localityName: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const label = CHECKLIST_ITEM_STATUS_LABELS[status] ?? status;
  const clickable = Boolean(onClick) && !disabled;
  const content = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: clickable ? 'pointer' : 'default',
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
      <span
        onClick={
          clickable
            ? (event) => {
                event.stopPropagation();
                onClick?.();
              }
            : undefined
        }
      >
        {content}
      </span>
    </Tooltip>
  );
}

export function ChecklistsPage() {
  const [params, setParams] = useSearchParams();
  const [viewByLocality, setViewByLocality] = useState(false);
  const { data: me } = useMe();

  const phaseId = params.get('phaseId') ?? '';
  const specialtyId = params.get('specialtyId') ?? '';
  const eloRoleId = params.get('eloRoleId') ?? '';
  const itemSourceType = params.get('itemSourceType') ?? 'ACTIVITY';

  useEffect(() => {
    if (params.get('itemSourceType')) return;
    const next = new URLSearchParams(params);
    next.set('itemSourceType', 'ACTIVITY');
    setParams(next, { replace: true });
  }, [params, setParams]);

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
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete('phaseId');
    next.delete('specialtyId');
    next.delete('eloRoleId');
    next.set('itemSourceType', 'ACTIVITY');
    setParams(next);
  };

  const data = checklistsQuery.data ?? { items: [], localities: [] };
  const phases = (phasesQuery.data?.items ?? []) as any[];
  const specialties = (specialtiesQuery.data?.items ?? []) as any[];
  const phaseMap = new Map<string, string>(phases.map((p: any) => [String(p.id), String(p.name)]));
  const specialtyMap = new Map<string, string>(specialties.map((s: any) => [String(s.id), String(s.name)]));
  const localities = selectTargetLocalities((data.localities ?? []) as any[]);
  const checklists = data.items ?? [];

  const checklistsToRender = useMemo(() => {
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
  }, [checklists]);
  const filteredByPhase = phaseId
    ? checklistsToRender.filter((c: any) => c.phaseId === phaseId)
    : checklistsToRender;

  if (checklistsQuery.isLoading) return <SkeletonState />;
  if (checklistsQuery.isError)
    return <ErrorState error={checklistsQuery.error} onRetry={() => checklistsQuery.refetch()} />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.2} mb={1.2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Checklist de execução
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visualização do andamento real de tarefas e atividades de campo por OM.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
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

      <Card sx={{ mb: 1.2, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            spacing={0.75}
            sx={{
              columnGap: 1,
              rowGap: 1,
              flexWrap: { xs: 'wrap', md: 'nowrap' },
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              Legenda:
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 18, color: DONE_COLOR }} />
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                Concluída
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <ScheduleRoundedIcon sx={{ fontSize: 18, color: IN_PROGRESS_COLOR }} />
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                Em andamento
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: PENDING_COLOR }} />
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                Pendente
              </Typography>
            </Stack>
            <TextField
              select
              size="small"
              label="Fase"
              value={phaseId}
              onChange={(e) => updateParam('phaseId', e.target.value)}
              sx={{
                minWidth: 0,
                width: { xs: '100%', sm: 108 },
                flexShrink: { md: 0 },
                '& .MuiInputBase-input': { fontSize: '0.8125rem' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' },
              }}
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
              sx={{
                minWidth: 0,
                width: { xs: '100%', sm: 142 },
                flexShrink: { md: 0 },
                '& .MuiInputBase-input': { fontSize: '0.8125rem' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' },
              }}
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
              sx={{
                minWidth: 0,
                width: { xs: '100%', sm: 152 },
                flexShrink: { md: 0 },
                '& .MuiInputBase-input': { fontSize: '0.8125rem' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' },
              }}
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
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set('itemSourceType', e.target.value);
                setParams(next);
              }}
              sx={{
                minWidth: 0,
                width: { xs: '100%', sm: 180 },
                flexShrink: { md: 0 },
                '& .MuiInputBase-input': { fontSize: '0.8125rem' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' },
              }}
            >
              <MenuItem value="ALL">Todos</MenuItem>
              <MenuItem value="TASK">Somente tarefas</MenuItem>
              <MenuItem value="ACTIVITY">Somente atividades</MenuItem>
            </TextField>
            <Button variant="text" size="small" onClick={clearFilters} sx={{ flexShrink: 0 }}>
              Limpar filtros
            </Button>
            <Box sx={{ flexGrow: 1, minWidth: 8 }} />
            <Chip
              label={viewByLocality ? 'Ver por item' : 'Ver por localidade'}
              onClick={() => setViewByLocality((v) => !v)}
              variant={viewByLocality ? 'filled' : 'outlined'}
              size="small"
              sx={{ flexShrink: 0 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {filteredByPhase.length === 0 && (
        <EmptyState
          title="Nenhum item para exibir"
          description={
            localities.length === 0
              ? 'Nenhuma localidade no escopo. Verifique o cadastro das OMs-alvo.'
              : itemSourceType === 'ACTIVITY'
                ? 'Não há atividades de campo registradas para os filtros selecionados (ou tente "Todos" / "Somente tarefas").'
                : itemSourceType === 'TASK'
                  ? 'Não há tarefas no escopo para os filtros selecionados. Ajuste fase, especialidade ou elo.'
                  : 'Não há tarefas nem atividades que correspondam aos filtros selecionados.'
          }
        />
      )}

      {filteredByPhase.map((checklist: any) => {
        const items = checklist.items ?? [];
        const filteredItems = itemSourceType && itemSourceType !== 'ALL'
          ? items.filter((item: any) => item.sourceType === itemSourceType)
          : items;
        const isItemApplicableToLocality = (item: any, localityId: string) => {
          if (item?.sourceType !== 'ACTIVITY') return true;
          const availability = item?.availabilityByLocality;
          if (!availability || typeof availability !== 'object') return true;
          return Boolean(availability[localityId]);
        };
        const statusSummary = filteredItems.reduce(
          (acc: { total: number; done: number; inProgress: number; pending: number }, item: any) => {
            for (const locality of localities) {
              if (!isItemApplicableToLocality(item, locality.id)) continue;
              const status = item.statuses?.[locality.id] ?? 'NOT_STARTED';
              acc.total += 1;
              if (status === 'DONE') {
                acc.done += 1;
              } else if (status === 'IN_PROGRESS' || status === 'STARTED') {
                acc.inProgress += 1;
              } else {
                acc.pending += 1;
              }
            }
            return acc;
          },
          { total: 0, done: 0, inProgress: 0, pending: 0 },
        );
        const progressPercent = statusSummary.total
          ? Math.round((statusSummary.done / statusSummary.total) * 100)
          : 0;

        return (
          <Card
            key={checklist.id}
            sx={{
              mb: 1.2,
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'visible',
            }}
          >
            <CardContent sx={{ pb: 0.6, pt: 1.3 }}>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.8} mb={1.2}>
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

              <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>{statusSummary.done}</strong> de <strong>{statusSummary.total}</strong> itens concluídos
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
                <Typography variant="caption" color="text.secondary">
                  {statusSummary.inProgress} em andamento, {statusSummary.pending} pendentes
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
                <Box sx={{ width: '100%' }}>
                <Table size="small" sx={{ '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 0.5, px: 0.75 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          width: 180,
                          position: 'sticky',
                          top: CHECKLIST_TABLE_STICKY_TOP,
                          left: 0,
                          bgcolor: CHECKLIST_HEADER_BG,
                          color: '#fff',
                          zIndex: 8,
                        }}
                      >
                        Localidade
                      </TableCell>
                      {filteredItems.map((item: any) => {
                        const label =
                          item.sourceType === 'ACTIVITY' && item.activityTypeName
                            ? `${item.activityTypeName} - ${item.title}`
                            : item.title;
                        return (
                        <TableCell
                          key={item.id}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            minWidth: 44,
                            position: 'sticky',
                            top: CHECKLIST_TABLE_STICKY_TOP,
                            bgcolor: CHECKLIST_HEADER_BG,
                            color: '#fff',
                            zIndex: 7,
                          }}
                        >
                          <Tooltip title={label}>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 80, display: 'block' }}>
                              {label.slice(0, 12)}
                              {label.length > 12 ? '…' : ''}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      )})}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {localities.map((loc: any) => (
                      <TableRow key={loc.id} hover>
                        <TableCell sx={{ fontWeight: 500, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>
                          {loc.name}
                        </TableCell>
                        {filteredItems.map((item: any) => {
                          const applicable = isItemApplicableToLocality(item, loc.id);
                          const status = item.statuses?.[loc.id] ?? 'NOT_STARTED';
                          return (
                            <TableCell key={item.id} align="center" sx={{ py: 0.75 }}>
                              {applicable ? (
                                <StatusIcon status={status} localityName={loc.name} />
                              ) : null}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </Box>
              ) : (
                <Box sx={{ width: '100%' }}>
                <Table size="small" sx={{ '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 0.5, px: 0.75 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 220,
                          position: 'sticky',
                          top: CHECKLIST_TABLE_STICKY_TOP,
                          left: 0,
                          bgcolor: CHECKLIST_HEADER_BG,
                          color: '#fff',
                          zIndex: 8,
                        }}
                      >
                        Item
                      </TableCell>
                      {localities.map((loc: any) => (
                        <TableCell
                          key={loc.id}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            minWidth: 52,
                            position: 'sticky',
                            top: CHECKLIST_TABLE_STICKY_TOP,
                            bgcolor: CHECKLIST_HEADER_BG,
                            color: '#fff',
                            zIndex: 7,
                          }}
                        >
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
                    {filteredItems.map((item: any) => {
                      const label =
                        item.sourceType === 'ACTIVITY' && item.activityTypeName
                          ? `${item.activityTypeName} - ${item.title}`
                          : item.title;
                      return (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ fontWeight: 500, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={500}>
                              {label}
                            </Typography>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={item.sourceType === 'TASK' ? 'Tarefa' : 'Atividade'}
                            />
                          </Stack>
                        </TableCell>
                        {localities.map((loc: any) => {
                          const applicable = isItemApplicableToLocality(item, loc.id);
                          const status = item.statuses?.[loc.id] ?? 'NOT_STARTED';
                          return (
                            <TableCell key={loc.id} align="center" sx={{ py: 0.75 }}>
                              {applicable ? (
                                <StatusIcon status={status} localityName={loc.name} />
                              ) : null}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}

    </Box>
  );
}
