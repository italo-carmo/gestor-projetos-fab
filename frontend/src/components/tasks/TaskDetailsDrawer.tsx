import {
  Box,
  Button,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useAssignTask, useAuditLogs, useUpdateTaskProgress, useUpdateTaskStatus, useUploadReport } from '../../api/hooks';
import { useToast } from '../../app/toast';
import { parseApiError } from '../../app/apiErrors';
import { can } from '../../app/rbac';
import { StatusChip } from '../chips/StatusChip';
import { ProgressInline } from '../chips/ProgressInline';
import { DueBadge } from '../chips/DueBadge';
import { TaskStatus } from '../../constants/enums';
import { formatDate } from '../../app/date';

export type TaskDetailsDrawerProps = {
  task: any | null;
  open: boolean;
  onClose: () => void;
  user: any | undefined;
};

export function TaskDetailsDrawer({ task, open, onClose, user }: TaskDetailsDrawerProps) {
  const [tab, setTab] = useState(0);
  const toast = useToast();
  const updateStatus = useUpdateTaskStatus();
  const updateProgress = useUpdateTaskProgress();
  const assignTask = useAssignTask();
  const uploadReport = useUploadReport();

  const canUpdate = can(user, 'task_instances', 'update');
  const canAssign = can(user, 'task_instances', 'assign');
  const auditQuery = useAuditLogs(
    task
      ? {
          resource: 'task_instances',
          entityId: task.id,
        }
      : {},
  );

  const handleStatus = async (status: string) => {
    if (!task) return;
    try {
      await updateStatus.mutateAsync({ id: task.id, status });
      toast.push({ message: 'Status atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      if (payload.code === 'REPORT_REQUIRED') {
        toast.push({ message: 'Relatorio obrigatorio para concluir', severity: 'warning' });
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

  const handleAssign = async (assigneeId: string) => {
    if (!task) return;
    try {
      await assignTask.mutateAsync({ id: task.id, assignedToId: assigneeId || null });
      toast.push({ message: 'Responsavel atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
    }
  };

  const reportRequiredLabel = useMemo(() => {
    if (!task?.reportRequired) return null;
    return 'Relatorio obrigatorio para concluir';
  }, [task?.reportRequired]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
      <Box p={3} display="flex" flexDirection="column" height="100%" data-testid="task-drawer">
        {task ? (
          <>
            <Stack spacing={1}>
              <Typography variant="h5">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
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
              <Tab label="Anexos" />
              <Tab label="Historico" />
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
                      {status}
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
                  size="small"
                  label="Responsavel (ID)"
                  value={task.assignedToId ?? ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={!canAssign || user?.executive_hide_pii}
                  placeholder="ID do usuario"
                  data-testid="task-assign"
                />
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
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Upload de relatorio
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
                        toast.push({ message: 'Relatorio enviado', severity: 'success' });
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

            {tab === 2 && (
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
            Nenhuma tarefa selecionada.
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
