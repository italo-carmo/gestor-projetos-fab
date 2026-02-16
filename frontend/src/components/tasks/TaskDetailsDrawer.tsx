import {
  Box,
  Button,
  Divider,
  Drawer,
  Link,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import {
  useAddTaskComment,
  useAssignTask,
  useAuditLogs,
  useEloRoles,
  useMarkTaskCommentsSeen,
  useMeetings,
  useTaskAssignees,
  useTaskComments,
  useUpdateTaskEloRole,
  useUpdateTaskMeeting,
  useUpdateTaskProgress,
  useUpdateTaskStatus,
  useUploadReport,
} from '../../api/hooks';
import { useToast } from '../../app/toast';
import { parseApiError } from '../../app/apiErrors';
import { can } from '../../app/rbac';
import { StatusChip } from '../chips/StatusChip';
import { ProgressInline } from '../chips/ProgressInline';
import { DueBadge } from '../chips/DueBadge';
import { TaskStatus, TASK_STATUS_LABELS } from '../../constants/enums';
import { formatDate } from '../../app/date';

export type TaskDetailsDrawerProps = {
  task: any | null;
  open: boolean;
  onClose: () => void;
  user: any | undefined;
  localities?: { id: string; name: string }[];
  loading?: boolean;
};

export function TaskDetailsDrawer({ task, open, onClose, user, localities = [], loading = false }: TaskDetailsDrawerProps) {
  const [tab, setTab] = useState(0);
  const [selectedLocalityId, setSelectedLocalityId] = useState('');
  const [selectedAssigneeValue, setSelectedAssigneeValue] = useState('');
  const [commentText, setCommentText] = useState('');
  const toast = useToast();
  const updateStatus = useUpdateTaskStatus();
  const updateProgress = useUpdateTaskProgress();
  const assignTask = useAssignTask();
  const addComment = useAddTaskComment();
  const markCommentsSeen = useMarkTaskCommentsSeen();
  const uploadReport = useUploadReport();

  const canUpdate = can(user, 'task_instances', 'update');
  const canAssign = can(user, 'task_instances', 'assign');
  const meetingsQuery = useMeetings({});
  const meetings = meetingsQuery.data?.items ?? [];
  const updateTaskMeeting = useUpdateTaskMeeting();
  const eloRolesQuery = useEloRoles();
  const eloRoles = eloRolesQuery.data?.items ?? [];
  const updateTaskEloRole = useUpdateTaskEloRole();
  const assigneesQuery = useTaskAssignees(selectedLocalityId);
  const assigneeOptions = assigneesQuery.data?.items ?? [];
  const commentsQuery = useTaskComments(task?.id ?? '');
  const auditQuery = useAuditLogs(
    task
      ? {
          resource: 'task_instances',
          entityId: task.id,
        }
      : {},
  );

  const assigneeValueFromTask = (taskItem: any) => {
    if (taskItem?.assignee?.type === 'USER' && taskItem?.assignee?.id) {
      return `USER:${taskItem.assignee.id}`;
    }
    if (taskItem?.assignee?.type === 'ELO' && taskItem?.assignee?.id) {
      return `ELO:${taskItem.assignee.id}`;
    }
    if (taskItem?.assignee?.type === 'LOCALITY_COMMAND') return 'LOCALITY_COMMAND';
    if (taskItem?.assignee?.type === 'LOCALITY_COMMANDER') return 'LOCALITY_COMMANDER';
    if (taskItem?.assignedToId) return `USER:${taskItem.assignedToId}`;
    if (taskItem?.assignedEloId) return `ELO:${taskItem.assignedEloId}`;
    return '';
  };

  useEffect(() => {
    if (!task) {
      setSelectedLocalityId('');
      setSelectedAssigneeValue('');
      setCommentText('');
      return;
    }
    setSelectedLocalityId(task.localityId ?? '');
    setSelectedAssigneeValue(assigneeValueFromTask(task));
    setCommentText('');
  }, [task?.id, task?.localityId, task?.assignedToId, task?.assignedEloId, task?.assigneeType]);

  useEffect(() => {
    if (!open || !task?.id) return;
    void markCommentsSeen.mutateAsync(task.id).catch(() => {});
  }, [open, task?.id]);

  const handleStatus = async (status: string) => {
    if (!task) return;
    try {
      await updateStatus.mutateAsync({ id: task.id, status });
      toast.push({ message: 'Status atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      if (payload.code === 'REPORT_REQUIRED') {
        toast.push({ message: 'Relatório obrigatório para concluir', severity: 'warning' });
      } else if (payload.code === 'RBAC_FORBIDDEN') {
        toast.push({ message: 'Acesso negado', severity: 'error' });
      } else {
        toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
      }
    }
  };

  const handleProgress = async (value: number) => {
    if (!task) return;
    try {
      await updateProgress.mutateAsync({ id: task.id, progressPercent: value });
      toast.push({ message: 'Progresso atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      if (payload.code === 'RBAC_FORBIDDEN') {
        toast.push({ message: 'Acesso negado', severity: 'error' });
      } else {
        toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
      }
    }
  };

  const handleAssign = async (rawValue: string) => {
    if (!task) return;
    const value = rawValue.trim();
    let assigneeType: 'USER' | 'ELO' | 'LOCALITY_COMMAND' | 'LOCALITY_COMMANDER' | null = null;
    let assigneeId: string | null = null;
    if (value.startsWith('USER:')) {
      assigneeType = 'USER';
      assigneeId = value.slice('USER:'.length);
    } else if (value.startsWith('ELO:')) {
      assigneeType = 'ELO';
      assigneeId = value.slice('ELO:'.length);
    } else if (value === 'LOCALITY_COMMAND' || value === 'LOCALITY_COMMANDER') {
      assigneeType = value;
    }
    try {
      await assignTask.mutateAsync({
        id: task.id,
        localityId: selectedLocalityId || task.localityId,
        assigneeType,
        assigneeId,
      });
      setSelectedAssigneeValue(value);
      toast.push({ message: 'Responsável atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
    }
  };

  const handleMeetingChange = async (meetingId: string) => {
    if (!task) return;
    try {
      await updateTaskMeeting.mutateAsync({ id: task.id, meetingId: meetingId || null });
      toast.push({ message: 'Vínculo com reunião atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
    }
  };

  const handleEloRoleChange = async (eloRoleId: string) => {
    if (!task) return;
    try {
      await updateTaskEloRole.mutateAsync({ id: task.id, eloRoleId: eloRoleId || null });
      toast.push({ message: 'Elo atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
    }
  };

  const handleAddComment = async () => {
    if (!task) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ id: task.id, text });
      setCommentText('');
      toast.push({ message: 'Comentário registrado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao comentar', severity: 'error' });
    }
  };

  const reportRequiredLabel = useMemo(() => {
    if (!task?.reportRequired) return null;
    return 'Relatório obrigatório para concluir';
  }, [task?.reportRequired]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
      <Box p={3} display="flex" flexDirection="column" height="100%" data-testid="task-drawer">
        {task ? (
          <>
            <Stack spacing={1}>
              <Typography variant="h5">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <StatusChip status={task.status} isLate={task.isLate} blocked={task.blockedByIds?.length > 0} />
                <DueBadge dueDate={task.dueDate} />
              </Stack>
              {reportRequiredLabel && (
                <Typography variant="caption" color="warning.main">
                  {reportRequiredLabel}
                </Typography>
              )}
            </Stack>

            <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mt: 2 }}>
              <Tab label="Detalhes" />
              <Tab label={`Comentários${task.comments?.hasUnread ? ' • novo' : ''}`} />
              <Tab label="Anexos" />
              <Tab label="Histórico" />
            </Tabs>
            <Divider sx={{ my: 2 }} />

            {tab === 0 && (
              <Stack spacing={2}>
                <TextField
                  select
                  label="Status"
                  size="small"
                  value={task.status}
                  onChange={(e) => handleStatus(e.target.value)}
                  disabled={!canUpdate}
                  data-testid="task-status"
                >
                  {TaskStatus.map((status) => (
                    <MenuItem key={status} value={status}>
                      {TASK_STATUS_LABELS[status] ?? status}
                    </MenuItem>
                  ))}
                </TextField>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Progresso
                  </Typography>
                  <ProgressInline value={task.progressPercent ?? 0} />
                  <TextField
                    size="small"
                    type="number"
                    value={task.progressPercent ?? 0}
                    onChange={(e) => handleProgress(Number(e.target.value))}
                    inputProps={{ min: 0, max: 100 }}
                    disabled={!canUpdate}
                    sx={{ mt: 1, maxWidth: 120 }}
                    data-testid="task-progress"
                  />
                </Box>
                <TextField
                  size="small"
                  label="Prazo"
                  value={formatDate(task.dueDate)}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  select
                  size="small"
                  label="Localidade do responsável"
                  value={selectedLocalityId}
                  onChange={(e) => {
                    setSelectedLocalityId(e.target.value);
                    setSelectedAssigneeValue('');
                  }}
                  disabled={!canAssign || user?.executive_hide_pii}
                >
                  {(localities.length ? localities : [{ id: task.localityId, name: task.localityName ?? 'Localidade atual' }]).map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Responsável"
                  value={selectedAssigneeValue}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={!canAssign || user?.executive_hide_pii || !selectedLocalityId}
                  data-testid="task-assign"
                  helperText={selectedLocalityId ? 'Selecione usuário, elo, GSD ou comandante da localidade.' : 'Escolha uma localidade.'}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {assigneeOptions.map((option: any) => {
                    const optionValue =
                      option.type === 'USER' || option.type === 'ELO'
                        ? `${option.type}:${option.id}`
                        : option.type;
                    return (
                      <MenuItem key={`${option.type}:${option.id}`} value={optionValue}>
                        {option.label}
                        {option.subtitle ? ` — ${option.subtitle}` : ''}
                      </MenuItem>
                    );
                  })}
                </TextField>
                {!user?.executive_hide_pii && task.assigneeLabel && (
                  <Typography variant="caption" color="text.secondary">
                    Atual: {task.assigneeLabel}
                  </Typography>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Vinculada à reunião
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={task.meetingId ?? ''}
                    onChange={(e) => handleMeetingChange(e.target.value)}
                    disabled={!canUpdate}
                  >
                    <MenuItem value="">Nenhuma</MenuItem>
                    {meetings.map((m: any) => (
                      <MenuItem key={m.id} value={m.id}>
                        {format(new Date(m.datetime), 'dd/MM/yyyy HH:mm')} — {m.scope || 'Reunião'}
                      </MenuItem>
                    ))}
                  </TextField>
                  {task.meeting && (
                    <Link
                      component={RouterLink}
                      to={`/meetings?meetingId=${task.meeting.id}`}
                      sx={{ mt: 1, display: 'inline-block', fontSize: 13 }}
                    >
                      Ver reunião →
                    </Link>
                  )}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Elo (Psicologia, SSO, Jurídico, etc.)
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={task.eloRoleId ?? ''}
                    onChange={(e) => handleEloRoleChange(e.target.value)}
                    disabled={!canUpdate}
                  >
                    <MenuItem value="">Nenhum</MenuItem>
                    {eloRoles.map((r: any) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => handleStatus('IN_PROGRESS')} disabled={!canUpdate}>
                    Iniciar
                  </Button>
                  <Button variant="outlined" onClick={() => handleStatus('BLOCKED')} disabled={!canUpdate}>
                    Bloquear
                  </Button>
                  <Button variant="contained" onClick={() => handleStatus('DONE')} disabled={!canUpdate} data-testid="task-mark-done">
                    Concluir
                  </Button>
                  <Button variant="text" disabled={!canUpdate} data-testid="task-save">
                    Salvar
                  </Button>
                </Stack>
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Novo comentário"
                  multiline
                  minRows={2}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  disabled={!canUpdate}
                  placeholder="Escreva pendências, orientações, alinhamentos e observações..."
                />
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddComment}
                    disabled={!canUpdate || !commentText.trim() || addComment.isPending}
                  >
                    Comentar
                  </Button>
                </Box>
                <Divider />
                {(commentsQuery.data?.items ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Sem comentários até o momento.
                  </Typography>
                )}
                <Stack spacing={1.2}>
                  {(commentsQuery.data?.items ?? []).map((comment: any) => (
                    <Box key={comment.id} sx={{ borderLeft: '3px solid #0C657E', pl: 1.2, py: 0.5, bgcolor: '#F8FBFD', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {comment.authorName} • {new Date(comment.createdAt).toLocaleString('pt-BR')}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {comment.text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            )}

            {tab === 2 && (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Upload de relatório
                </Typography>
                <Button variant="outlined" component="label" disabled={!canUpdate}>
                  Selecionar arquivo
                  <input
                    hidden
                    type="file"
                    onChange={async (event) => {
                      if (!task || !event.target.files?.[0]) return;
                      try {
                        await uploadReport.mutateAsync({ taskInstanceId: task.id, file: event.target.files[0] });
                        toast.push({ message: 'Relatório enviado', severity: 'success' });
                      } catch (error) {
                        const payload = parseApiError(error);
                        toast.push({ message: payload.message ?? 'Erro ao enviar', severity: 'error' });
                      } finally {
                        event.target.value = '';
                      }
                    }}
                  />
                </Button>
              </Stack>
            )}

            {tab === 3 && (
              <Stack spacing={1}>
                {(auditQuery.data?.items ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum evento registrado.
                  </Typography>
                )}
                {(auditQuery.data?.items ?? []).map((log: any) => (
                  <Box key={log.id} sx={{ border: '1px solid #E6ECF5', borderRadius: 2, p: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </Typography>
                    <Typography variant="body2">
                      {log.action} por {log.user?.name ?? log.userId ?? 'Sistema'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}

          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Carregando detalhes da tarefa...' : 'Nenhuma tarefa selecionada.'}
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
