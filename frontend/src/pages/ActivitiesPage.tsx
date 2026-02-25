import {
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
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
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useActivityComments,
  useAddActivityComment,
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  useDeleteActivityReportPhoto,
  useExportActivityReportPdf,
  useLocalities,
  useMe,
  useSpecialties,
  useUsers,
  useSignActivityReport,
  useMarkActivityCommentsSeen,
  useUpdateActivity,
  useUpdateActivityStatus,
  useUploadActivityReportPhoto,
  useUpsertActivityReport,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { can } from '../app/rbac';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { ACTIVITY_STATUS_LABELS, ActivityStatus } from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';

const blankReport = {
  date: '',
  location: '',
  responsible: '',
  activityAnalysis: '',
  activitiesPerformed: '',
  participantsCount: 0,
  participantsCharacteristics: '',
  conclusion: '',
  city: '',
  closingDate: '',
};

const drawerActionButtonSx = {
  minHeight: 34,
  px: 1.75,
  borderRadius: 1.5,
  whiteSpace: 'nowrap',
} as const;

type ActivityDrawerTab = 'activity' | 'report';

export function ActivitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activityIdFromUrl = searchParams.get('activityId') ?? '';
  const localityIdFromUrl = searchParams.get('localityId') ?? '';
  const tabFromUrl = searchParams.get('tab') === 'report' ? 'report' : 'activity';
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [localityFilter, setLocalityFilter] = useState(localityIdFromUrl);
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: localitiesData } = useLocalities();
  const localities = localitiesData?.items ?? [];
  const { data: specialtiesData } = useSpecialties();
  const specialties = specialtiesData?.items ?? [];
  const usersQuery = useUsers();
  const allUsers = usersQuery.data?.items ?? [];

  const selectableLocalities = useMemo(
    () =>
      selectTargetLocalities(localities as any[]).filter(
        (locality: any) =>
          String(locality?.id ?? '').trim() &&
          String(locality?.name ?? '').trim(),
      ),
    [localities],
  );

  const activitiesQuery = useActivities({
    status: statusFilter || undefined,
    localityId: localityFilter || undefined,
    specialtyId: specialtyFilter || undefined,
    q: search || undefined,
  });

  const { data: me } = useMe();
  const [selectedId, setSelectedId] = useState<string | null>(activityIdFromUrl || null);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(activityIdFromUrl));
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [drawerTab, setDrawerTab] = useState<ActivityDrawerTab>(tabFromUrl);

  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  const updateActivity = useUpdateActivity();
  const updateActivityStatus = useUpdateActivityStatus();
  const commentsQuery = useActivityComments(selectedId ?? '');
  const addComment = useAddActivityComment();
  const markCommentsSeen = useMarkActivityCommentsSeen();
  const upsertReport = useUpsertActivityReport();
  const signReport = useSignActivityReport();
  const uploadPhoto = useUploadActivityReportPhoto();
  const removePhoto = useDeleteActivityReportPhoto();
  const exportPdf = useExportActivityReportPdf();

  const items = activitiesQuery.data?.items ?? [];

  useEffect(() => {
    if (activitiesQuery.isLoading) return;
    if (selectedId && !items.some((i: any) => i.id === selectedId)) {
      setSelectedId(null);
      if (!isCreateMode) setDrawerOpen(false);
    }
  }, [activitiesQuery.isLoading, items, selectedId, isCreateMode]);

  const selected = items.find((i: any) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setCommentText('');
    void markCommentsSeen.mutateAsync(selectedId).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    if (localityIdFromUrl && localityIdFromUrl !== localityFilter) {
      setLocalityFilter(localityIdFromUrl);
    }
  }, [localityFilter, localityIdFromUrl]);

  useEffect(() => {
    if (!localityFilter) return;
    const exists = selectableLocalities.some((locality: any) => locality.id === localityFilter);
    if (!exists) {
      setLocalityFilter('');
    }
  }, [localityFilter, selectableLocalities]);

  useEffect(() => {
    if (!activityIdFromUrl) return;
    if (activityIdFromUrl !== selectedId) {
      setSelectedId(activityIdFromUrl);
      setDrawerOpen(true);
      setIsCreateMode(false);
    } else if (!drawerOpen) {
      setDrawerOpen(true);
    }
    if (tabFromUrl === 'report') {
      setDrawerTab('report');
    }
  }, [activityIdFromUrl, drawerOpen, selectedId, tabFromUrl]);

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    localityId: '',
    specialtyId: '',
    responsibleUserId: '',
    eventDate: '',
    reportRequired: false,
  });

  useEffect(() => {
    if (!selected) return;
    setActivityForm({
      title: selected.title ?? '',
      description: selected.description ?? '',
      localityId: selected.localityId ?? '',
      specialtyId: selected.specialtyId ?? '',
      responsibleUserId: selected.responsibleUsers?.[0]?.id ?? '',
      eventDate: selected.eventDate ? String(selected.eventDate).slice(0, 10) : '',
      reportRequired: Boolean(selected.reportRequired),
    });
  }, [selected]);

  const [reportForm, setReportForm] = useState(blankReport);

  useEffect(() => {
    if (!selected?.report) {
      setReportForm(blankReport);
      return;
    }
    setReportForm({
      date: selected.report.date ? String(selected.report.date).slice(0, 10) : '',
      location: selected.report.location ?? '',
      responsible: selected.report.responsible ?? '',
      activityAnalysis: selected.report.activityAnalysis ?? selected.report.missionSupport ?? '',
      activitiesPerformed: selected.report.activitiesPerformed ?? '',
      participantsCount: Number(selected.report.participantsCount ?? 0),
      participantsCharacteristics: selected.report.participantsCharacteristics ?? '',
      conclusion: selected.report.conclusion ?? '',
      city: selected.report.city ?? '',
      closingDate: selected.report.closingDate ? String(selected.report.closingDate).slice(0, 10) : '',
    });
  }, [selected]);

  const canView = !me ? true : can(me, 'task_instances', 'view');
  const canCreate = can(me, 'task_instances', 'create');
  const canUpdate = can(me, 'task_instances', 'update');
  const canDelete = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]) && canUpdate;
  const canEditReport = can(me, 'reports', 'create');
  const canSign = can(me, 'reports', 'approve');
  const canUpload = can(me, 'reports', 'upload');
  const canDownload = can(me, 'reports', 'download');

  const responsibleOptions = useMemo(() => {
    const filtered = allUsers.filter((user: any) => {
      if (!String(user?.id ?? '').trim() || !String(user?.name ?? '').trim()) return false;
      if (activityForm.localityId && user.localityId && user.localityId !== activityForm.localityId) return false;
      if (activityForm.specialtyId && user.specialtyId && user.specialtyId !== activityForm.specialtyId) return false;
      return true;
    });

    const selectedResponsible = selected?.responsibleUsers?.[0];
    if (
      selectedResponsible?.id &&
      selectedResponsible?.name &&
      !filtered.some((user: any) => user.id === selectedResponsible.id)
    ) {
      filtered.push({ id: selectedResponsible.id, name: selectedResponsible.name });
    }

    return filtered.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [activityForm.localityId, activityForm.specialtyId, allUsers, selected?.responsibleUsers]);

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
        specialtyId: activityForm.specialtyId || null,
        responsibleUserIds: activityForm.responsibleUserId ? [activityForm.responsibleUserId] : [],
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
          specialtyId: activityForm.specialtyId || null,
          responsibleUserIds: activityForm.responsibleUserId ? [activityForm.responsibleUserId] : [],
          eventDate: activityForm.eventDate || null,
          reportRequired: activityForm.reportRequired,
        },
      });
      toast.push({ message: 'Atividade atualizada', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao atualizar atividade', severity: 'error' });
    }
  };

  const handleDeleteActivity = async () => {
    if (!selected || !canDelete) return;
    if (!window.confirm('Deseja excluir esta atividade? Esta ação será registrada em auditoria.')) return;
    try {
      await deleteActivity.mutateAsync(selected.id);
      toast.push({ message: 'Atividade excluída', severity: 'success' });
      setSelectedId(null);
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir atividade', severity: 'error' });
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

  const syncUrlState = (activityId?: string, tab: ActivityDrawerTab = 'activity') => {
    const next = new URLSearchParams(searchParams);
    if (localityFilter) next.set('localityId', localityFilter);
    else next.delete('localityId');

    if (activityId) {
      next.set('activityId', activityId);
      if (tab === 'report') next.set('tab', tab);
      else next.delete('tab');
    } else {
      next.delete('activityId');
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  const openActivityDrawer = (activityId: string, tab: ActivityDrawerTab = 'activity') => {
    setSelectedId(activityId);
    setIsCreateMode(false);
    setDrawerTab(tab);
    setDrawerOpen(true);
    syncUrlState(activityId, tab);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    syncUrlState(undefined);
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
      specialtyId: '',
      responsibleUserId: '',
      eventDate: '',
      reportRequired: false,
    });
    setReportForm(blankReport);
    setDrawerOpen(true);
    syncUrlState(undefined);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Atividades de Campo</Typography>
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
              onChange={(e) => {
                const value = e.target.value;
                setLocalityFilter(value);
                const next = new URLSearchParams(searchParams);
                if (value) next.set('localityId', value);
                else next.delete('localityId');
                setSearchParams(next, { replace: true });
              }}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {selectableLocalities.map((l: any) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Especialidade"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {specialties.map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Atividades de Campo</Typography>
            {items.length === 0 ? (
              <EmptyState title="Nenhuma atividade" description="Cadastre uma nova atividade externa." />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Atividade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Especialidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Responsável</TableCell>
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
                      onClick={() => openActivityDrawer(item.id, 'activity')}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{item.locality?.name ?? '-'}</TableCell>
                      <TableCell>{item.specialty?.name ?? 'Todas'}</TableCell>
                      <TableCell>
                        {Array.isArray(item.responsibleUsers) && item.responsibleUsers.length > 0
                          ? item.responsibleUsers.map((user: any) => user.name).join(', ')
                          : '—'}
                      </TableCell>
                      <TableCell>{item.eventDate ? new Date(item.eventDate).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell>{ACTIVITY_STATUS_LABELS[item.status] ?? item.status}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            openActivityDrawer(item.id, 'activity');
                          }}
                        >
                          <Badge
                            overlap="rectangular"
                            badgeContent={0}
                            sx={{
                              '& .MuiBadge-badge': {
                                display: 'none',
                              },
                            }}
                          >
                            <Box
                              sx={{
                                minWidth: 26,
                                height: 20,
                                px: 0.8,
                                borderRadius: 999,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                                border: '1px solid',
                                borderColor: item.comments?.hasUnread ? '#C56A2B' : '#C9D7E6',
                                bgcolor: item.comments?.hasUnread ? '#FFF3E8' : '#F7FAFC',
                                color: item.comments?.hasUnread ? '#9A4B14' : '#44566C',
                              }}
                            >
                              {item.comments?.total ?? 0}
                            </Box>
                          </Badge>
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            openActivityDrawer(item.id, 'report');
                          }}
                          aria-label="Abrir relatório"
                        >
                          {item.report ? (
                            <CheckBoxRoundedIcon
                              color={item.report.hasSignature ? 'success' : 'primary'}
                              fontSize="small"
                            />
                          ) : (
                            <CheckBoxOutlineBlankRoundedIcon fontSize="small" />
                          )}
                        </IconButton>
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
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', md: 620 } } }}
      >
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              {isCreateMode ? 'Nova atividade' : selected ? 'Detalhes da atividade' : 'Detalhes da atividade'}
            </Typography>
            <Stack direction="row" spacing={1}>
              {!isCreateMode && selected && canDelete && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={handleDeleteActivity}
                  disabled={deleteActivity.isPending}
                >
                  Excluir
                </Button>
              )}
              <Button size="small" onClick={closeDrawer}>
                Fechar
              </Button>
            </Stack>
          </Stack>

          {!isCreateMode && selected && (
            <Tabs
              value={drawerTab}
              onChange={(_, value: ActivityDrawerTab) => {
                setDrawerTab(value);
                if (selected?.id) syncUrlState(selected.id, value);
              }}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 2 }}
            >
              <Tab value="activity" label="Dados da atividade" />
              <Tab value="report" label="Relatório" />
            </Tabs>
          )}

          {(isCreateMode || drawerTab === 'activity') && (
            <>
              <TextField
                size="small"
                label="Título"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                fullWidth
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Localidade"
                  value={activityForm.localityId}
                  onChange={(e) => setActivityForm({ ...activityForm, localityId: e.target.value })}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Não vinculada</MenuItem>
                  {selectableLocalities.map((l: any) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Especialidade"
                  value={activityForm.specialtyId}
                  onChange={(e) => setActivityForm({ ...activityForm, specialtyId: e.target.value })}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Todas as especialidades</MenuItem>
                  {specialties.map((s: any) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Responsável"
                  value={activityForm.responsibleUserId}
                  onChange={(e) => setActivityForm({ ...activityForm, responsibleUserId: e.target.value })}
                  sx={{ minWidth: 240 }}
                  disabled={usersQuery.isLoading}
                >
                  <MenuItem value="">Sem responsável</MenuItem>
                  {responsibleOptions.map((user: any) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
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
              {usersQuery.isError && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                  Não foi possível carregar a lista completa de responsáveis no momento.
                </Typography>
              )}

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
                  <Button
                    variant="contained"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleCreate}
                    disabled={!canCreate || createActivity.isPending}
                  >
                    Criar atividade
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleSaveActivity}
                    disabled={!selected || !canUpdate || updateActivity.isPending}
                  >
                    Salvar atividade
                  </Button>
                )}
              </Stack>

              {!isCreateMode && selected && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Responsáveis
                  </Typography>
                  <Typography variant="body2">
                    {Array.isArray(selected.responsibleUsers) && selected.responsibleUsers.length > 0
                      ? selected.responsibleUsers.map((user: any) => user.name).join(', ')
                      : 'Não definido'}
                  </Typography>
                </Box>
              )}

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
                  label="Análise da atividade"
                  value={reportForm.activityAnalysis}
                  onChange={(e) => setReportForm({ ...reportForm, activityAnalysis: e.target.value })}
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
                  <Button
                    variant="contained"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleSaveReport}
                    disabled={!canEditReport || upsertReport.isPending}
                  >
                    Salvar relatório
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleSign}
                    disabled={!canSign || signReport.isPending}
                  >
                    Assinar digitalmente
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleExportPdf}
                    disabled={!canDownload || exportPdf.isPending}
                  >
                    Exportar PDF assinado
                  </Button>
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    sx={drawerActionButtonSx}
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
