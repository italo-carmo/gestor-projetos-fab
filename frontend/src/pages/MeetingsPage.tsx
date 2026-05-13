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
  Step,
  StepLabel,
  Stepper,
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
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddMeetingDecision,
  useCreateMeeting,
  useDeleteMeeting,
  useDownloadMeetingMinutesFile,
  useGenerateMeetingTasks,
  useLocalities,
  useMeetings,
  usePhases,
  useSpecialties,
  useTaskTemplates,
  useUpdateMeeting,
  useUpdateMeetingMinutes,
  useUploadMeetingMinutesFiles,
  useMe,
  useUsers,
} from '../api/hooks';
import { FiltersBar } from '../components/filters/FiltersBar';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { MeetingStatus, MEETING_STATUS_LABELS, MeetingType, MEETING_TYPE_LABELS, TaskPriority, TASK_PRIORITY_LABELS } from '../constants/enums';

const STATUS_BG: Record<string, string> = {
  PLANNED: '#E3F2FD',
  HELD: '#E8F5E9',
  CANCELLED: '#FFEBEE',
};
const STATUS_CHIP_COLOR: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  PLANNED: 'primary',
  HELD: 'success',
  CANCELLED: 'error',
};

function readMultiSelectValue(value: string | string[]) {
  return Array.isArray(value) ? value : value.split(',').filter(Boolean);
}

export function MeetingsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const toast = useToast();
  const { data: me } = useMe();

  const status = params.get('status') ?? '';
  const scopeSearch = params.get('scope') ?? '';
  const localityId = params.get('localityId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const meetingIdFromUrl = params.get('meetingId') ?? '';

  const filters = useMemo(
    () => ({
      status: status || undefined,
      scope: scopeSearch || undefined,
      localityId: localityId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [status, scopeSearch, localityId, from, to],
  );

  const meetingsQuery = useMeetings(filters);
  const localitiesQuery = useLocalities();
  const usersQuery = useUsers();
  const users = usersQuery.data?.items ?? [];
  const phasesQuery = usePhases();
  const specialtiesQuery = useSpecialties();
  const templatesQuery = useTaskTemplates();

  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const updateMeeting = useUpdateMeeting();
  const updateMeetingMinutes = useUpdateMeetingMinutes();
  const uploadMeetingMinutesFiles = useUploadMeetingMinutesFiles();
  const downloadMeetingMinutesFile = useDownloadMeetingMinutesFile();
  const addDecision = useAddMeetingDecision();
  const generateTasks = useGenerateMeetingTasks();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [minutesDraft, setMinutesDraft] = useState('');
  const [form, setForm] = useState({
    datetime: '',
    scope: '',
    status: 'PLANNED',
    meetingType: 'PRESENCIAL',
    location: '',
    meetingLink: '',
    localityId: '',
    agenda: '',
    participantIds: [] as string[],
  });

  const [decisionText, setDecisionText] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardPayload, setWizardPayload] = useState<any>({
    templateId: '',
    title: '',
    description: '',
    phaseId: '',
    specialtyId: '',
    priority: 'MEDIUM',
    assigneeId: '',
    baseDueDate: '',
    selectedLocalities: [] as string[],
    localities: [] as { localityId: string; dueDate: string }[],
  });

  useEffect(() => {
    if (meetingIdFromUrl && meetingsQuery.data?.items?.length) {
      const meeting = meetingsQuery.data.items.find((m: any) => m.id === meetingIdFromUrl);
      if (meeting) {
        setSelectedMeeting(meeting);
        setMinutesDraft(meeting.minutes ?? '');
        setDrawerTab(0);
        setDrawerOpen(true);
      }
    }
  }, [meetingIdFromUrl, meetingsQuery.data?.items]);

  useEffect(() => {
    if (!drawerOpen || !selectedMeeting?.id || !meetingsQuery.data?.items) return;
    const found = meetingsQuery.data.items.find((m: any) => m.id === selectedMeeting.id);
    if (found) setSelectedMeeting(found);
  }, [drawerOpen, selectedMeeting?.id, meetingsQuery.data?.items]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(new Date()), { weekStartsOn: 1 });
    const end = endOfMonth(new Date());
    const days = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, []);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams({});

  const openCreate = () => {
    setSelectedMeeting(null);
    setMinutesDraft('');
    setDrawerTab(0);
    setForm({
      datetime: '',
      scope: '',
      status: 'PLANNED',
      meetingType: 'PRESENCIAL',
      location: '',
      meetingLink: '',
      localityId: '',
      agenda: '',
      participantIds: [],
    });
    setDrawerOpen(true);
  };

  const openEdit = (meeting: any) => {
    setSelectedMeeting(meeting);
    setMinutesDraft(meeting.minutes ?? '');
    setDrawerTab(0);
    setForm({
      datetime: meeting.datetime ? meeting.datetime.slice(0, 16) : '',
      scope: meeting.scope ?? '',
      status: meeting.status ?? 'PLANNED',
      meetingType: meeting.meetingType ?? 'PRESENCIAL',
      location: meeting.location ?? meeting.locality?.name ?? '',
      meetingLink: meeting.meetingLink ?? '',
      localityId: meeting.localityId ?? '',
      agenda: meeting.agenda ?? '',
      participantIds: (meeting.participants ?? []).map((p: any) => p.user?.id ?? p.userId).filter(Boolean),
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (selectedMeeting && !canUpdate) return;
    if (!selectedMeeting && !canCreate) return;
    try {
      const payload = {
        datetime: new Date(form.datetime).toISOString(),
        scope: form.scope.trim(),
        status: form.status,
        meetingType: form.meetingType,
        location: form.meetingType === 'PRESENCIAL' ? form.location.trim() || null : null,
        meetingLink: form.meetingType === 'ONLINE' ? form.meetingLink.trim() || null : null,
        localityId: null,
        agenda: form.agenda || null,
        participantIds: form.participantIds,
      };
      if (selectedMeeting) {
        await updateMeeting.mutateAsync({ id: selectedMeeting.id, payload });
        toast.push({ message: 'Reunião atualizada', severity: 'success' });
      } else {
        await createMeeting.mutateAsync(payload);
        toast.push({ message: 'Reunião criada', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao salvar reunião', severity: 'error' });
    }
  };

  const handleSaveMinutes = async () => {
    if (!selectedMeeting || !canUpdate) return;
    try {
      await updateMeetingMinutes.mutateAsync({
        id: selectedMeeting.id,
        minutes: minutesDraft,
      });
      toast.push({ message: 'Ata salva', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao salvar ata', severity: 'error' });
    }
  };

  const handleUploadMinutesFiles = async (files: File[]) => {
    if (!selectedMeeting || !canUpdate || files.length === 0) return;
    try {
      await uploadMeetingMinutesFiles.mutateAsync({
        id: selectedMeeting.id,
        files,
      });
      toast.push({
        message: files.length === 1 ? 'Arquivo enviado' : 'Arquivos enviados',
        severity: 'success',
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao enviar arquivos', severity: 'error' });
    }
  };

  const handleDownloadMinutesFile = async (document: any) => {
    if (!selectedMeeting) return;
    try {
      await downloadMeetingMinutesFile.mutateAsync({
        meetingId: selectedMeeting.id,
        documentId: document.id,
        fileName: document.fileName ?? 'ata',
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao baixar arquivo', severity: 'error' });
    }
  };

  const handleAddDecision = async () => {
    if (!selectedMeeting || !decisionText) return;
    try {
      await addDecision.mutateAsync({ id: selectedMeeting.id, text: decisionText });
      setDecisionText('');
      toast.push({ message: 'Decisão registrada', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao adicionar decisão', severity: 'error' });
    }
  };

  const openWizard = () => {
    setWizardStep(0);
    setWizardPayload({
      templateId: '',
      title: '',
      description: '',
      phaseId: '',
      specialtyId: '',
      priority: 'MEDIUM',
      assigneeId: '',
      baseDueDate: '',
      selectedLocalities: [],
      localities: [],
    });
    setWizardOpen(true);
  };

  const proceedWizard = () => {
    if (wizardStep === 1) {
      const localities = wizardPayload.selectedLocalities.map((id: string) => ({
        localityId: id,
        dueDate: wizardPayload.baseDueDate,
      }));
      setWizardPayload({ ...wizardPayload, localities });
    }
    setWizardStep((prev) => Math.min(prev + 1, 2));
  };

  const generateMeetingTasks = async () => {
    if (!selectedMeeting) return;
    try {
      const payload = {
        templateId: wizardPayload.templateId || undefined,
        title: wizardPayload.templateId ? undefined : wizardPayload.title,
        description: wizardPayload.templateId ? undefined : wizardPayload.description,
        phaseId: wizardPayload.templateId ? undefined : wizardPayload.phaseId,
        specialtyId: wizardPayload.specialtyId || null,
        priority: wizardPayload.priority,
        assigneeId: wizardPayload.assigneeId || null,
        localities: wizardPayload.localities,
      };
      await generateTasks.mutateAsync({ id: selectedMeeting.id, payload });
      toast.push({ message: 'Tarefas geradas', severity: 'success' });
      setWizardOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao gerar tarefas', severity: 'error' });
    }
  };

  if (meetingsQuery.isLoading) return <SkeletonState />;
  if (meetingsQuery.isError) return <ErrorState error={meetingsQuery.error} onRetry={() => meetingsQuery.refetch()} />;

  const meetings = meetingsQuery.data?.items ?? [];
  const localities = localitiesQuery.data?.items ?? [];

  const canCreate = can(me, 'meetings', 'create');
  const canUpdate = can(me, 'meetings', 'update');
  const canGenerate = can(me, 'tasks', 'generate_from_meeting');
  const canDelete = can(me, 'meetings', 'delete');

  const handleDeleteMeeting = async () => {
    if (!selectedMeeting || !canDelete) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteMeeting = async () => {
    if (!selectedMeeting || !canDelete) return;
    try {
      await deleteMeeting.mutateAsync(selectedMeeting.id);
      toast.push({ message: 'Reunião excluída', severity: 'success' });
      setDeleteConfirmOpen(false);
      setSelectedMeeting(null);
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao excluir reunião', severity: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Reuniões</Typography>
        {canCreate && (
          <Button variant="contained" onClick={openCreate}>
            Nova reunião
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FiltersBar
            localityId={localityId}
            onLocalityChange={(value) => updateParam('localityId', value)}
            localities={localities.map((l: any) => ({ id: l.id, name: l.name }))}
            onClear={clearFilters}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2}>
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => updateParam('status', e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {MeetingStatus.map((s) => (
                <MenuItem key={s} value={s}>
                  {MEETING_STATUS_LABELS[s] ?? s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Escopo (texto)"
              value={scopeSearch}
              onChange={(e) => updateParam('scope', e.target.value)}
              placeholder="O que será tratado"
              sx={{ minWidth: 200 }}
            />
            <TextField
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => updateParam('from', e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => updateParam('to', e.target.value)}
            />
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Cartões" />
        <Tab label="Linhas" />
        <Tab label="Calendário" />
      </Tabs>

      {meetings.length === 0 && <EmptyState title="Nenhuma reunião" description="Crie uma reunião para começar." />}

      {meetings.length > 0 && tab === 0 && (
        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }}
          gap={2}
          alignItems="stretch"
        >
          {meetings.map((meeting: any) => (
            <Card
              key={meeting.id}
              variant="outlined"
              sx={{
                background: STATUS_BG[meeting.status] ?? '#F5F8FC',
                borderLeft: `4px solid ${meeting.status === 'PLANNED' ? '#1976d2' : meeting.status === 'HELD' ? '#2e7d32' : '#c62828'}`,
                height: '100%',
                display: 'flex',
              }}
            >
              <CardContent
                sx={{
                  py: 1.25,
                  px: 1.5,
                  '&:last-child': { pb: 1.25 },
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}
              >
                <Stack spacing={0.6} sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                      {format(new Date(meeting.datetime), 'dd/MM/yyyy HH:mm')}
                    </Typography>
                    <Chip
                      size="small"
                      label={MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
                      color={STATUS_CHIP_COLOR[meeting.status] ?? 'default'}
                      sx={{ height: 22 }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={meeting.scope || 'Sem escopo'}
                  >
                    {meeting.scope || 'Sem escopo'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {meeting.meetingType === 'ONLINE'
                      ? `Online${meeting.meetingLink ? ` • ${meeting.meetingLink}` : ''}`
                      : meeting.location ?? meeting.locality?.name ?? '—'}
                  </Typography>
                  <Button
                    size="small"
                    sx={{ alignSelf: 'flex-start', minHeight: 24, px: 0.5, mt: 'auto' }}
                    variant="text"
                    onClick={() => openEdit(meeting)}
                  >
                    Ver detalhes
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {meetings.length > 0 && tab === 1 && (
        <Card>
          <CardContent sx={{ overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderBottom: 2, borderColor: 'divider' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Data/Hora</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Escopo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Local/Link</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {meetings.map((meeting: any) => (
                  <TableRow
                    key={meeting.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openEdit(meeting)}
                  >
                    <TableCell>{format(new Date(meeting.datetime), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
                        color={STATUS_CHIP_COLOR[meeting.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }} title={meeting.scope}>
                      <Typography variant="body2" noWrap>{meeting.scope || '—'}</Typography>
                    </TableCell>
                    <TableCell>{MEETING_TYPE_LABELS[meeting.meetingType] ?? meeting.meetingType}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography variant="body2" noWrap>
                        {meeting.meetingType === 'ONLINE'
                          ? (meeting.meetingLink || '—')
                          : (meeting.location ?? meeting.locality?.name ?? '—')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={(e) => { e.stopPropagation(); openEdit(meeting); }}>Detalhes</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={1}>
              {calendarDays.map((day) => {
                const dayMeetings = meetings.filter(
                  (meeting: any) => format(new Date(meeting.datetime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'),
                );
                return (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      border: '1px solid #E6ECF5',
                      borderRadius: 2,
                      p: 1,
                      minHeight: { xs: 124, md: 156 },
                      maxHeight: { xs: 124, md: 156 },
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {format(day, 'dd/MM')}
                    </Typography>
                    <Stack spacing={0.5} mt={1} sx={{ overflowY: 'auto', pr: 0.25 }}>
                      {dayMeetings.map((meeting: any) => (
                        <Chip
                          key={meeting.id}
                          size="small"
                          label={meeting.scope || MEETING_STATUS_LABELS[meeting.status]}
                          onClick={() => openEdit(meeting)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: STATUS_BG[meeting.status],
                            borderLeft: `3px solid ${meeting.status === 'PLANNED' ? '#1976d2' : meeting.status === 'HELD' ? '#2e7d32' : '#c62828'}`,
                            width: '100%',
                            justifyContent: 'flex-start',
                            '& .MuiChip-label': {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDrawerOpen(false);
        }}
        PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
      >
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          gap={2}
          height="100%"
          sx={{ overflowY: 'auto', pt: { xs: 10, md: 9 } }}
        >
          <Typography variant="h5" sx={{ mt: 1 }}>
            {selectedMeeting ? 'Detalhes da reunião' : 'Nova reunião'}
          </Typography>
          <Tabs
            value={drawerTab}
            onChange={(_, value) => setDrawerTab(value)}
            variant="fullWidth"
          >
            <Tab label="Detalhes" />
            <Tab label="Ata" disabled={!selectedMeeting} />
          </Tabs>
          <Stack spacing={2} sx={{ display: drawerTab === 0 ? 'flex' : 'none' }}>
          <TextField
            size="small"
            type="datetime-local"
            label="Data e hora"
            InputLabelProps={{ shrink: true }}
            value={form.datetime}
            onChange={(e) => setForm({ ...form, datetime: e.target.value })}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          />
          <TextField
            size="small"
            label="Escopo (o que será tratado)"
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value })}
            placeholder="Ex.: Alinhamento de fases, checklist de preparação"
            multiline
            minRows={2}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          >
            {MeetingStatus.map((s) => (
              <MenuItem key={s} value={s}>
                {MEETING_STATUS_LABELS[s] ?? s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Tipo"
            value={form.meetingType}
            onChange={(e) => setForm({ ...form, meetingType: e.target.value })}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          >
            {MeetingType.map((t) => (
              <MenuItem key={t} value={t}>
                {MEETING_TYPE_LABELS[t] ?? t}
              </MenuItem>
            ))}
          </TextField>
          {form.meetingType === 'PRESENCIAL' && (
            <TextField
              size="small"
              label="Local"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex.: Sala de briefing, COMGEP, Auditório"
              disabled={Boolean(selectedMeeting) && !canUpdate}
            />
          )}
          {form.meetingType === 'ONLINE' && (
            <TextField
              size="small"
              label="Link da reunião"
              value={form.meetingLink}
              onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
              placeholder="https://meet.google.com/..."
              disabled={Boolean(selectedMeeting) && !canUpdate}
            />
          )}
          <TextField
            size="small"
            label="Pauta"
            value={form.agenda}
            onChange={(e) => setForm({ ...form, agenda: e.target.value })}
            multiline
            minRows={3}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          />
          <TextField
            select
            size="small"
            label="Participantes"
            SelectProps={{ multiple: true }}
            value={form.participantIds}
            onChange={(e) =>
              setForm({
                ...form,
                participantIds: readMultiSelectValue(e.target.value),
              })
            }
            disabled={Boolean(selectedMeeting) && !canUpdate}
            helperText="Usuários do sistema (logins existentes)"
          >
            {users.map((u: any) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name ?? u.email} {u.email ? `(${u.email})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            {((selectedMeeting && canUpdate) || (!selectedMeeting && canCreate)) && (
              <Button variant="contained" onClick={handleSave}>
                Salvar
              </Button>
            )}
            {selectedMeeting && canDelete && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDeleteMeeting}
                disabled={deleteMeeting.isPending}
              >
                Excluir
              </Button>
            )}
            <Button
              variant="text"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDrawerOpen(false);
              }}
            >
              Fechar
            </Button>
            {selectedMeeting && canGenerate && (
              <Button variant="outlined" onClick={openWizard}>
                Gerar tarefas
              </Button>
            )}
          </Stack>

          {selectedMeeting && (
            <>
              <Divider />
              <Typography variant="subtitle1">Participantes</Typography>
              <Stack spacing={1}>
                {(selectedMeeting.participants ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum participante incluído.
                  </Typography>
                )}
                {(selectedMeeting.participants ?? []).map((p: any) => (
                  <Card key={p.id} variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="subtitle2">{p.user?.name ?? p.user?.email ?? 'Usuário'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {p.user?.email ?? ''}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              <Divider />
              <Typography variant="subtitle1">Decisões</Typography>
              <Stack spacing={1}>
                {(selectedMeeting.decisions ?? []).map((decision: any) => (
                  <Card key={decision.id} variant="outlined">
                    <CardContent>
                      <Typography variant="body2">{decision.text}</Typography>
                    </CardContent>
                  </Card>
                ))}
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Nova decisão"
                    value={decisionText}
                    onChange={(e) => setDecisionText(e.target.value)}
                    fullWidth
                  />
                  <Button variant="contained" onClick={handleAddDecision}>
                    Adicionar
                  </Button>
                </Stack>
              </Stack>
            </>
          )}
          </Stack>
          {selectedMeeting && (
            <Stack spacing={2} sx={{ display: drawerTab === 1 ? 'flex' : 'none' }}>
              <TextField
                label="Texto da ata"
                value={minutesDraft}
                onChange={(e) => setMinutesDraft(e.target.value)}
                multiline
                minRows={12}
                fullWidth
                disabled={!canUpdate}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {canUpdate && (
                  <Button
                    variant="contained"
                    onClick={handleSaveMinutes}
                    disabled={updateMeetingMinutes.isPending}
                  >
                    Salvar ata
                  </Button>
                )}
                {canUpdate && (
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={uploadMeetingMinutesFiles.isPending}
                  >
                    Enviar arquivos
                    <input
                      hidden
                      type="file"
                      multiple
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = '';
                        void handleUploadMinutesFiles(files);
                      }}
                    />
                  </Button>
                )}
              </Stack>
              {uploadMeetingMinutesFiles.isPending && (
                <Typography variant="body2" color="text.secondary">
                  Enviando arquivos...
                </Typography>
              )}
              <Divider />
              <Typography variant="subtitle1">Arquivos da ata</Typography>
              <Stack spacing={1}>
                {(selectedMeeting.documents ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum arquivo enviado.
                  </Typography>
                )}
                {(selectedMeeting.documents ?? []).map((document: any) => (
                  <Card key={document.id} variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {document.title ?? document.fileName ?? 'Arquivo'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {document.fileSize
                              ? `${Math.round(Number(document.fileSize) / 1024)} KB`
                              : document.mimeType ?? 'Arquivo'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            void handleDownloadMinutesFile(document);
                          }}
                          disabled={downloadMeetingMinutesFile.isPending}
                        >
                          Baixar
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Stack>
          )}
        </Box>
      </Drawer>

      <Drawer anchor="right" open={wizardOpen} onClose={() => setWizardOpen(false)} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5">Gerar tarefas</Typography>
          <Stepper activeStep={wizardStep}>
            {['Modelo', 'Localidades', 'Revisão'].map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {wizardStep === 0 && (
            <Stack spacing={2}>
              <TextField
                select
                size="small"
                label="Modelo existente"
                value={wizardPayload.templateId}
                onChange={(e) => setWizardPayload({ ...wizardPayload, templateId: e.target.value })}
              >
                <MenuItem value="">Criar novo</MenuItem>
                {(templatesQuery.data?.items ?? []).map((t: any) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.title}
                  </MenuItem>
                ))}
              </TextField>
              {!wizardPayload.templateId && (
                <>
                  <TextField
                    size="small"
                    label="Título"
                    value={wizardPayload.title}
                    onChange={(e) => setWizardPayload({ ...wizardPayload, title: e.target.value })}
                  />
                  <TextField
                    size="small"
                    label="Descrição"
                    multiline
                    minRows={3}
                    value={wizardPayload.description}
                    onChange={(e) => setWizardPayload({ ...wizardPayload, description: e.target.value })}
                  />
                  <TextField
                    select
                    size="small"
                    label="Fase"
                    value={wizardPayload.phaseId}
                    onChange={(e) => setWizardPayload({ ...wizardPayload, phaseId: e.target.value })}
                  >
                    {(phasesQuery.data?.items ?? []).map((p: any) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
              <TextField
                select
                size="small"
                label="Especialidade"
                value={wizardPayload.specialtyId}
                onChange={(e) => setWizardPayload({ ...wizardPayload, specialtyId: e.target.value })}
              >
                <MenuItem value="">Nenhuma</MenuItem>
                {(specialtiesQuery.data?.items ?? []).map((s: any) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {wizardStep === 1 && (
            <Stack spacing={2}>
              <TextField
                size="small"
                type="date"
                label="Prazo base"
                InputLabelProps={{ shrink: true }}
                value={wizardPayload.baseDueDate}
                onChange={(e) => setWizardPayload({ ...wizardPayload, baseDueDate: e.target.value })}
              />
              <TextField
                select
                size="small"
                label="Localidades"
                SelectProps={{ multiple: true }}
                value={wizardPayload.selectedLocalities}
                onChange={(e) =>
                  setWizardPayload({
                    ...wizardPayload,
                    selectedLocalities: readMultiSelectValue(e.target.value),
                  })
                }
              >
                {localities.map((l: any) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                Ajuste o prazo por localidade se necessário.
              </Typography>
              {wizardPayload.localities.map((entry: any, index: number) => (
                <TextField
                  key={entry.localityId}
                  size="small"
                  type="date"
                  label={localities.find((l: any) => l.id === entry.localityId)?.name ?? 'Localidade'}
                  InputLabelProps={{ shrink: true }}
                  value={entry.dueDate}
                  onChange={(e) => {
                    const next = [...wizardPayload.localities];
                    next[index] = { ...next[index], dueDate: e.target.value };
                    setWizardPayload({ ...wizardPayload, localities: next });
                  }}
                />
              ))}
            </Stack>
          )}

          {wizardStep === 2 && (
            <Stack spacing={2}>
              <TextField
                select
                size="small"
                label="Prioridade"
                value={wizardPayload.priority}
                onChange={(e) => setWizardPayload({ ...wizardPayload, priority: e.target.value })}
              >
                {TaskPriority.map((p) => (
                  <MenuItem key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p] ?? p}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Responsável (ID)"
                value={wizardPayload.assigneeId}
                onChange={(e) => setWizardPayload({ ...wizardPayload, assigneeId: e.target.value })}
              />
            </Stack>
          )}

          <Stack direction="row" spacing={1}>
            {wizardStep > 0 && (
              <Button variant="text" onClick={() => setWizardStep((prev) => prev - 1)}>
                Voltar
              </Button>
            )}
            {wizardStep < 2 && (
              <Button variant="contained" onClick={proceedWizard}>
                Próximo
              </Button>
            )}
            {wizardStep === 2 && (
              <Button variant="contained" onClick={generateMeetingTasks}>
                Gerar
              </Button>
            )}
          </Stack>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteMeeting}
        title="Excluir reunião"
        message="Deseja excluir esta reunião?"
        highlightText={selectedMeeting?.scope ?? 'Reunião selecionada'}
        note="Esta ação será registrada em auditoria e não pode ser desfeita."
        confirmLabel="Excluir reunião"
        severity="error"
        confirmLoading={deleteMeeting.isPending}
      />
    </Box>
  );
}
