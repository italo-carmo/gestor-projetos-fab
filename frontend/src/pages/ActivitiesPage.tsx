import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
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
import { useEffect, useState } from 'react';
import {
  useActivityComments,
  useActivitySchedule,
  useAddActivityComment,
  useActivities,
  useCreateActivityScheduleItem,
  useCreateActivity,
  useDeleteActivityScheduleItem,
  useDeleteActivityReportPhoto,
  useExportActivitySchedulePdf,
  useExportActivityReportPdf,
  useLocalities,
  useMe,
  useSignActivityReport,
  useMarkActivityCommentsSeen,
  useUpdateActivityScheduleItem,
  useUpdateActivity,
  useUpdateActivityStatus,
  useUploadActivityReportPhoto,
  useUpsertActivityReport,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { can } from '../app/rbac';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { ACTIVITY_STATUS_LABELS, ActivityStatus } from '../constants/enums';

const blankReport = {
  date: '',
  location: '',
  responsible: '',
  missionSupport: '',
  introduction: '',
  missionObjectives: '',
  executionSchedule: '',
  activitiesPerformed: '',
  participantsCount: 0,
  participantsCharacteristics: '',
  conclusion: '',
  city: '',
  closingDate: '',
};

const blankScheduleItem = {
  title: '',
  startTime: '',
  durationMinutes: 60,
  location: '',
  responsible: '',
  participants: '',
};

type ActivityDrawerTab = 'activity' | 'schedule' | 'report';

export function ActivitiesPage() {
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [localityFilter, setLocalityFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: localitiesData } = useLocalities();
  const localities = localitiesData?.items ?? [];

  const activitiesQuery = useActivities({
    status: statusFilter || undefined,
    localityId: localityFilter || undefined,
    q: search || undefined,
  });

  const { data: me } = useMe();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [drawerTab, setDrawerTab] = useState<ActivityDrawerTab>('activity');

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const updateActivityStatus = useUpdateActivityStatus();
  const commentsQuery = useActivityComments(selectedId ?? '');
  const scheduleQuery = useActivitySchedule(selectedId ?? '');
  const addComment = useAddActivityComment();
  const markCommentsSeen = useMarkActivityCommentsSeen();
  const createScheduleItem = useCreateActivityScheduleItem();
  const updateScheduleItem = useUpdateActivityScheduleItem();
  const deleteScheduleItem = useDeleteActivityScheduleItem();
  const exportSchedulePdf = useExportActivitySchedulePdf();
  const upsertReport = useUpsertActivityReport();
  const signReport = useSignActivityReport();
  const uploadPhoto = useUploadActivityReportPhoto();
  const removePhoto = useDeleteActivityReportPhoto();
  const exportPdf = useExportActivityReportPdf();

  const items = activitiesQuery.data?.items ?? [];

  useEffect(() => {
    if (selectedId && !items.some((i: any) => i.id === selectedId)) {
      setSelectedId(null);
      if (!isCreateMode) setDrawerOpen(false);
    }
  }, [items, selectedId, isCreateMode]);

  const selected = items.find((i: any) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setCommentText('');
    void markCommentsSeen.mutateAsync(selectedId).catch(() => {});
  }, [selectedId]);

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    localityId: '',
    eventDate: '',
    reportRequired: false,
  });

  useEffect(() => {
    if (!selected) return;
    setActivityForm({
      title: selected.title ?? '',
      description: selected.description ?? '',
      localityId: selected.localityId ?? '',
      eventDate: selected.eventDate ? String(selected.eventDate).slice(0, 10) : '',
      reportRequired: Boolean(selected.reportRequired),
    });
  }, [selected]);

  const [reportForm, setReportForm] = useState(blankReport);
  const [scheduleForm, setScheduleForm] = useState(blankScheduleItem);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  useEffect(() => {
    if (!selected?.report) {
      setReportForm(blankReport);
      return;
    }
    setReportForm({
      date: selected.report.date ? String(selected.report.date).slice(0, 10) : '',
      location: selected.report.location ?? '',
      responsible: selected.report.responsible ?? '',
      missionSupport: selected.report.missionSupport ?? '',
      introduction: selected.report.introduction ?? '',
      missionObjectives: selected.report.missionObjectives ?? '',
      executionSchedule: selected.report.executionSchedule ?? '',
      activitiesPerformed: selected.report.activitiesPerformed ?? '',
      participantsCount: Number(selected.report.participantsCount ?? 0),
      participantsCharacteristics: selected.report.participantsCharacteristics ?? '',
      conclusion: selected.report.conclusion ?? '',
      city: selected.report.city ?? '',
      closingDate: selected.report.closingDate ? String(selected.report.closingDate).slice(0, 10) : '',
    });
  }, [selected]);

  useEffect(() => {
    setScheduleForm(blankScheduleItem);
    setEditingScheduleId(null);
  }, [selectedId, isCreateMode]);

  useEffect(() => {
    setDrawerTab('activity');
  }, [selectedId, isCreateMode, drawerOpen]);

  const canView = !me ? true : can(me, 'task_instances', 'view');
  const canCreate = can(me, 'task_instances', 'create');
  const canUpdate = can(me, 'task_instances', 'update');
  const canEditReport = can(me, 'reports', 'create');
  const canSign = can(me, 'reports', 'approve');
  const canUpload = can(me, 'reports', 'upload');
  const canDownload = can(me, 'reports', 'download');

  const handleCreate = async () => {
    if (!activityForm.title.trim()) {
      toast.push({ message: 'Informe o título da atividade', severity: 'warning' });
      return;
    }
    try {
      const created = await createActivity.mutateAsync({
        title: activityForm.title,
        description: activityForm.description || null,
        localityId: activityForm.localityId || null,
        eventDate: activityForm.eventDate || null,
        reportRequired: activityForm.reportRequired,
      });
      setSelectedId(created.id);
      setIsCreateMode(false);
      setDrawerOpen(true);
      toast.push({ message: 'Atividade criada', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao criar atividade', severity: 'error' });
    }
  };

  const handleSaveActivity = async () => {
    if (!selected) return;
    try {
      await updateActivity.mutateAsync({
        id: selected.id,
        payload: {
          title: activityForm.title,
          description: activityForm.description || null,
          localityId: activityForm.localityId || null,
          eventDate: activityForm.eventDate || null,
          reportRequired: activityForm.reportRequired,
        },
      });
      toast.push({ message: 'Atividade atualizada', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao atualizar atividade', severity: 'error' });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    try {
      await updateActivityStatus.mutateAsync({ id: selected.id, status });
      toast.push({ message: 'Status atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar status', severity: 'error' });
    }
  };

  const handleSaveReport = async () => {
    if (!selected) return;
    try {
      await upsertReport.mutateAsync({ id: selected.id, payload: reportForm });
      toast.push({ message: 'Relatório salvo', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar relatório', severity: 'error' });
    }
  };

  const handleSign = async () => {
    if (!selected) return;
    try {
      await signReport.mutateAsync(selected.id);
      toast.push({ message: 'Relatório assinado digitalmente', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao assinar', severity: 'error' });
    }
  };

  const handleExportPdf = async () => {
    if (!selected) return;
    try {
      await exportPdf.mutateAsync(selected.id);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao exportar PDF', severity: 'error' });
    }
  };

  const handleAddComment = async () => {
    if (!selected) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ id: selected.id, text });
      setCommentText('');
      toast.push({ message: 'Comentário registrado', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao comentar', severity: 'error' });
    }
  };

  const handleSaveScheduleItem = async () => {
    if (!selected) return;
    if (!scheduleForm.title.trim()) {
      toast.push({ message: 'Informe a atividade do cronograma', severity: 'warning' });
      return;
    }
    if (!scheduleForm.startTime) {
      toast.push({ message: 'Informe o horário', severity: 'warning' });
      return;
    }
    try {
      if (editingScheduleId) {
        await updateScheduleItem.mutateAsync({
          id: selected.id,
          itemId: editingScheduleId,
          payload: {
            title: scheduleForm.title,
            startTime: scheduleForm.startTime,
            durationMinutes: Number(scheduleForm.durationMinutes) || 0,
            location: scheduleForm.location,
            responsible: scheduleForm.responsible,
            participants: scheduleForm.participants,
          },
        });
        toast.push({ message: 'Item do cronograma atualizado', severity: 'success' });
      } else {
        await createScheduleItem.mutateAsync({
          id: selected.id,
          payload: {
            title: scheduleForm.title,
            startTime: scheduleForm.startTime,
            durationMinutes: Number(scheduleForm.durationMinutes) || 0,
            location: scheduleForm.location,
            responsible: scheduleForm.responsible,
            participants: scheduleForm.participants,
          },
        });
        toast.push({ message: 'Item do cronograma adicionado', severity: 'success' });
      }
      setScheduleForm(blankScheduleItem);
      setEditingScheduleId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar item do cronograma', severity: 'error' });
    }
  };

  const handleEditScheduleItem = (item: any) => {
    setEditingScheduleId(item.id);
    setScheduleForm({
      title: item.title ?? '',
      startTime: item.startTime ?? '',
      durationMinutes: Number(item.durationMinutes ?? 60),
      location: item.location ?? '',
      responsible: item.responsible ?? '',
      participants: item.participants ?? '',
    });
  };

  const handleDeleteScheduleItem = async (itemId: string) => {
    if (!selected) return;
    if (!window.confirm('Remover este item do cronograma?')) return;
    try {
      await deleteScheduleItem.mutateAsync({ id: selected.id, itemId });
      if (editingScheduleId === itemId) {
        setEditingScheduleId(null);
        setScheduleForm(blankScheduleItem);
      }
      toast.push({ message: 'Item do cronograma removido', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover item', severity: 'error' });
    }
  };

  const handleExportSchedulePdf = async () => {
    if (!selected) return;
    try {
      await exportSchedulePdf.mutateAsync(selected.id);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao exportar cronograma em PDF', severity: 'error' });
    }
  };

  if (!canView) {
    return <ErrorState error={{ message: 'Acesso negado' }} />;
  }

  if (activitiesQuery.isLoading) return <SkeletonState />;
  if (activitiesQuery.isError) {
    return <ErrorState error={activitiesQuery.error} onRetry={() => activitiesQuery.refetch()} />;
  }

  const openCreateDrawer = () => {
    setIsCreateMode(true);
    setSelectedId(null);
    setDrawerTab('activity');
    setCommentText('');
    setActivityForm({
      title: '',
      description: '',
      localityId: '',
      eventDate: '',
      reportRequired: false,
    });
    setReportForm(blankReport);
    setDrawerOpen(true);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Atividades Externas</Typography>
        <Button variant="contained" onClick={openCreateDrawer} disabled={!canCreate}>
          Nova atividade
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 220 }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {ActivityStatus.map((status) => (
                <MenuItem key={status} value={status}>
                  {ACTIVITY_STATUS_LABELS[status] ?? status}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityFilter}
              onChange={(e) => setLocalityFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localities.map((l: any) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Lista de atividades</Typography>
            {items.length === 0 ? (
              <EmptyState title="Nenhuma atividade" description="Cadastre uma nova atividade externa." />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Atividade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Data</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Comentários</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Relatório</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow
                      key={item.id}
                      hover
                      selected={!isCreateMode && selectedId === item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setIsCreateMode(false);
                        setDrawerTab('activity');
                        setDrawerOpen(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{item.locality?.name ?? '-'}</TableCell>
                      <TableCell>{item.eventDate ? new Date(item.eventDate).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell>{ACTIVITY_STATUS_LABELS[item.status] ?? item.status}</TableCell>
                      <TableCell>
                        {(item.comments?.total ?? 0) === 0 ? (
                          <Chip size="small" label="Sem comentários" />
                        ) : item.comments?.hasUnread ? (
                          <Chip size="small" color="warning" label={`Novo (${item.comments.unread})`} />
                        ) : (
                          <Chip size="small" color="info" label={`${item.comments.total}`} />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.report ? (
                          <Chip
                            size="small"
                            color={item.report.hasSignature ? 'success' : 'warning'}
                            label={item.report.hasSignature ? 'Assinado' : 'Pendente assinatura'}
                          />
                        ) : (
                          <Chip size="small" label="Sem relatório" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 620 } } }}
      >
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              {isCreateMode ? 'Nova atividade' : selected ? 'Detalhes da atividade' : 'Detalhes da atividade'}
            </Typography>
            <Button size="small" onClick={() => setDrawerOpen(false)}>
              Fechar
            </Button>
          </Stack>

          {!isCreateMode && selected && (
            <Tabs
              value={drawerTab}
              onChange={(_, value: ActivityDrawerTab) => setDrawerTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 2 }}
            >
              <Tab value="activity" label="Dados da atividade" />
              <Tab value="schedule" label="Cronograma" />
              <Tab value="report" label="Relatório" />
            </Tabs>
          )}

          {(isCreateMode || drawerTab === 'activity') && (
            <>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  size="small"
                  label="Título"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  label="Localidade"
                  value={activityForm.localityId}
                  onChange={(e) => setActivityForm({ ...activityForm, localityId: e.target.value })}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Não vinculada</MenuItem>
                  {localities.map((l: any) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="date"
                  label="Data da atividade"
                  value={activityForm.eventDate}
                  onChange={(e) => setActivityForm({ ...activityForm, eventDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 200 }}
                />
              </Stack>
              <TextField
                size="small"
                label="Descrição"
                multiline
                minRows={2}
                fullWidth
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                sx={{ mt: 1 }}
              />

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Relatório obrigatório"
                  value={activityForm.reportRequired ? 'true' : 'false'}
                  onChange={(e) => setActivityForm({ ...activityForm, reportRequired: e.target.value === 'true' })}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="true">Sim</MenuItem>
                  <MenuItem value="false">Não</MenuItem>
                </TextField>

                {!isCreateMode && selected && (
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={selected.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    sx={{ minWidth: 220 }}
                    disabled={!canUpdate}
                  >
                    {ActivityStatus.map((status) => (
                      <MenuItem key={status} value={status}>
                        {ACTIVITY_STATUS_LABELS[status] ?? status}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {isCreateMode ? (
                  <Button variant="contained" onClick={handleCreate} disabled={!canCreate || createActivity.isPending}>
                    Criar atividade
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={handleSaveActivity}
                    disabled={!selected || !canUpdate || updateActivity.isPending}
                  >
                    Salvar atividade
                  </Button>
                )}
              </Stack>

              {!isCreateMode && selected && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Comentários e Linha do Tempo
                  </Typography>
                  <Stack spacing={1.2} sx={{ mb: 2 }}>
                    <TextField
                      size="small"
                      label="Novo comentário"
                      multiline
                      minRows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={!canUpdate}
                      placeholder="Escreva pendências, orientações ou observações desta atividade..."
                    />
                    <Box display="flex" justifyContent="flex-end">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleAddComment}
                        disabled={!canUpdate || !commentText.trim() || addComment.isPending}
                        sx={{
                          color: '#FFFFFF',
                          '&.Mui-disabled': {
                            color: 'rgba(255,255,255,0.78)',
                            background: 'linear-gradient(135deg, rgba(12,101,126,0.72) 0%, rgba(10,84,113,0.72) 100%)',
                          },
                        }}
                      >
                        Comentar
                      </Button>
                    </Box>
                    {(commentsQuery.data?.items ?? []).length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Sem comentários até o momento.
                      </Typography>
                    )}
                    <Stack spacing={1}>
                      {(commentsQuery.data?.items ?? []).map((comment: any) => (
                        <Box
                          key={comment.id}
                          sx={{
                            borderLeft: '3px solid #0C657E',
                            pl: 1.2,
                            py: 0.5,
                            bgcolor: '#F8FBFD',
                            borderRadius: 1,
                          }}
                        >
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
                </>
              )}
            </>
          )}

          {!isCreateMode && selected && drawerTab === 'schedule' && (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Cronograma da Visita
              </Typography>

              <Stack spacing={1}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Atividade"
                    value={scheduleForm.title}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    type="time"
                    label="Horário"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 150 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Duração (min)"
                    value={scheduleForm.durationMinutes}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) || 0 })
                    }
                    inputProps={{ min: 1 }}
                    sx={{ minWidth: 150 }}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Local (texto livre)"
                    value={scheduleForm.location}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Responsável"
                    value={scheduleForm.responsible}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, responsible: e.target.value })}
                    fullWidth
                  />
                </Stack>

                <TextField
                  size="small"
                  label="Participantes (texto livre)"
                  value={scheduleForm.participants}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, participants: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    onClick={handleSaveScheduleItem}
                    disabled={!canUpdate || createScheduleItem.isPending || updateScheduleItem.isPending}
                  >
                    {editingScheduleId ? 'Atualizar item' : 'Adicionar item'}
                  </Button>
                  {editingScheduleId && (
                    <Button
                      variant="text"
                      onClick={() => {
                        setEditingScheduleId(null);
                        setScheduleForm(blankScheduleItem);
                      }}
                    >
                      Cancelar edição
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={handleExportSchedulePdf}
                    disabled={!canDownload || exportSchedulePdf.isPending}
                  >
                    Exportar cronograma em PDF
                  </Button>
                </Stack>

                {scheduleQuery.isLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    Carregando cronograma...
                  </Typography>
                ) : (scheduleQuery.data?.items ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum item no cronograma desta visita.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Horário</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Duração</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Atividade</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Local</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Responsável</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Participantes</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(scheduleQuery.data?.items ?? []).map((item: any) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.startTime}</TableCell>
                          <TableCell>{item.durationMinutes} min</TableCell>
                          <TableCell>{item.title}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.responsible}</TableCell>
                          <TableCell sx={{ maxWidth: 180, whiteSpace: 'pre-wrap' }}>{item.participants}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => handleEditScheduleItem(item)}
                                disabled={!canUpdate}
                              >
                                Editar
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                onClick={() => handleDeleteScheduleItem(item.id)}
                                disabled={!canUpdate || deleteScheduleItem.isPending}
                              >
                                Remover
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Stack>
            </>
          )}

          {!isCreateMode && selected && drawerTab === 'report' && (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Formulário de Relatório da Atividade
              </Typography>

              <Stack spacing={1}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    type="date"
                    label="Data"
                    value={reportForm.date}
                    onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Local"
                    value={reportForm.location}
                    onChange={(e) => setReportForm({ ...reportForm, location: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Responsável"
                    value={reportForm.responsible}
                    onChange={(e) => setReportForm({ ...reportForm, responsible: e.target.value })}
                    fullWidth
                  />
                </Stack>

                <TextField
                  size="small"
                  label="Amparo da missão"
                  value={reportForm.missionSupport}
                  onChange={(e) => setReportForm({ ...reportForm, missionSupport: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Introdução"
                  value={reportForm.introduction}
                  onChange={(e) => setReportForm({ ...reportForm, introduction: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Objetivos da missão"
                  value={reportForm.missionObjectives}
                  onChange={(e) => setReportForm({ ...reportForm, missionObjectives: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Cronograma de execução"
                  value={reportForm.executionSchedule}
                  onChange={(e) => setReportForm({ ...reportForm, executionSchedule: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Atividades realizadas"
                  value={reportForm.activitiesPerformed}
                  onChange={(e) => setReportForm({ ...reportForm, activitiesPerformed: e.target.value })}
                  multiline
                  minRows={3}
                  fullWidth
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="Número de participantes"
                    value={reportForm.participantsCount}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, participantsCount: Number(e.target.value) || 0 })
                    }
                    inputProps={{ min: 0 }}
                    sx={{ minWidth: 220 }}
                  />
                  <TextField
                    size="small"
                    label="Características dos participantes"
                    value={reportForm.participantsCharacteristics}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, participantsCharacteristics: e.target.value })
                    }
                    fullWidth
                  />
                </Stack>

                <TextField
                  size="small"
                  label="Conclusão"
                  value={reportForm.conclusion}
                  onChange={(e) => setReportForm({ ...reportForm, conclusion: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Cidade"
                    value={reportForm.city}
                    onChange={(e) => setReportForm({ ...reportForm, city: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="Data"
                    value={reportForm.closingDate}
                    onChange={(e) => setReportForm({ ...reportForm, closingDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Stack>

                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Imagens da atividade
                  </Typography>
                  <Button variant="outlined" component="label" size="small" disabled={!canUpload}>
                    Inserir foto
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (event) => {
                        if (!selected || !event.target.files?.[0]) return;
                        try {
                          await uploadPhoto.mutateAsync({ id: selected.id, file: event.target.files[0] });
                          toast.push({ message: 'Foto inserida', severity: 'success' });
                        } catch (error) {
                          toast.push({ message: parseApiError(error).message ?? 'Erro ao enviar foto', severity: 'error' });
                        } finally {
                          event.target.value = '';
                        }
                      }}
                    />
                  </Button>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                    {(selected.report?.photos ?? []).map((photo: any) => (
                      <Chip
                        key={photo.id}
                        label={photo.fileName}
                        onDelete={
                          canUpload
                            ? async () => {
                                try {
                                  await removePhoto.mutateAsync({ id: selected.id, photoId: photo.id });
                                  toast.push({ message: 'Foto removida', severity: 'success' });
                                } catch (error) {
                                  toast.push({
                                    message: parseApiError(error).message ?? 'Erro ao remover foto',
                                    severity: 'error',
                                  });
                                }
                              }
                            : undefined
                        }
                        size="small"
                      />
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ p: 1.5, border: '1px solid #E6ECF5', borderRadius: 2 }}>
                  <Typography variant="subtitle2">Assinatura digital</Typography>
                  {selected.report?.hasSignature ? (
                    <Typography variant="body2" color="success.main">
                      Assinado em {new Date(selected.report.signedAt).toLocaleString('pt-BR')} por {selected.report.signedBy?.name ?? selected.report.signedById}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="warning.main">
                      Relatório ainda não assinado.
                    </Typography>
                  )}
                </Box>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Button variant="contained" onClick={handleSaveReport} disabled={!canEditReport || upsertReport.isPending}>
                    Salvar relatório
                  </Button>
                  <Button variant="outlined" onClick={handleSign} disabled={!canSign || signReport.isPending}>
                    Assinar digitalmente
                  </Button>
                  <Button variant="outlined" onClick={handleExportPdf} disabled={!canDownload || exportPdf.isPending}>
                    Exportar PDF assinado
                  </Button>
                  <Button
                    variant="text"
                    color="success"
                    onClick={() => handleStatusChange('DONE')}
                    disabled={!canUpdate || updateActivityStatus.isPending}
                  >
                    Finalizar atividade
                  </Button>
                </Stack>
              </Stack>
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
