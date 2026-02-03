import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Divider,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddMeetingDecision,
  useCreateMeeting,
  useGenerateMeetingTasks,
  useLocalities,
  useMeetings,
  usePhases,
  useSpecialties,
  useTaskTemplates,
  useUpdateMeeting,
  useMe,
} from '../api/hooks';
import { FiltersBar } from '../components/filters/FiltersBar';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { MeetingScope, MeetingStatus, TaskPriority } from '../constants/enums';

const statusColors: Record<string, string> = {
  PLANNED: '#E8F2FF',
  HELD: '#E8F8EF',
  CANCELLED: '#FFE7E9',
};

export function MeetingsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const toast = useToast();
  const { data: me } = useMe();

  const status = params.get('status') ?? '';
  const scope = params.get('scope') ?? '';
  const localityId = params.get('localityId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const filters = useMemo(
    () => ({
      status: status || undefined,
      scope: scope || undefined,
      localityId: localityId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [status, scope, localityId, from, to],
  );

  const meetingsQuery = useMeetings(filters);
  const localitiesQuery = useLocalities();
  const phasesQuery = usePhases();
  const specialtiesQuery = useSpecialties();
  const templatesQuery = useTaskTemplates();

  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const addDecision = useAddMeetingDecision();
  const generateTasks = useGenerateMeetingTasks();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [form, setForm] = useState({
    datetime: '',
    scope: 'NATIONAL',
    status: 'PLANNED',
    localityId: '',
    agenda: '',
    participantsText: '',
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
    reportRequired: false,
    assigneeId: '',
    baseDueDate: '',
    selectedLocalities: [] as string[],
    localities: [] as { localityId: string; dueDate: string }[],
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams({});

  const openCreate = () => {
    setSelectedMeeting(null);
    setForm({
      datetime: '',
      scope: 'NATIONAL',
      status: 'PLANNED',
      localityId: '',
      agenda: '',
      participantsText: '',
    });
    setDrawerOpen(true);
  };

  const openEdit = (meeting: any) => {
    setSelectedMeeting(meeting);
    setForm({
      datetime: meeting.datetime ? meeting.datetime.slice(0, 16) : '',
      scope: meeting.scope ?? 'NATIONAL',
      status: meeting.status ?? 'PLANNED',
      localityId: meeting.localityId ?? '',
      agenda: meeting.agenda ?? '',
      participantsText: meeting.participantsJson ? JSON.stringify(meeting.participantsJson, null, 2) : '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      let participantsJson: any = null;
      if (form.participantsText) {
        try {
          participantsJson = JSON.parse(form.participantsText);
        } catch {
          toast.push({ message: 'JSON de participantes inválido', severity: 'warning' });
          return;
        }
      }
      const payload = {
        datetime: new Date(form.datetime).toISOString(),
        scope: form.scope,
        status: form.status,
        localityId: form.localityId || null,
        agenda: form.agenda,
        participantsJson,
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
      reportRequired: false,
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
        reportRequired: wizardPayload.reportRequired,
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

  const canCreate = can(me, 'meetings', 'create');
  const canUpdate = can(me, 'meetings', 'update');
  const canGenerate = can(me, 'tasks', 'generate_from_meeting');

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
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Escopo"
              value={scope}
              onChange={(e) => updateParam('scope', e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {MeetingScope.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
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
        <Tab label="Cards" />
        <Tab label="Calendário" />
      </Tabs>

      {meetings.length === 0 && <EmptyState title="Nenhuma reunião" description="Crie uma reunião para começar." />}

      {meetings.length > 0 && tab === 0 && (
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2}>
          {meetings.map((meeting: any) => (
            <Card key={meeting.id} variant="outlined" sx={{ background: statusColors[meeting.status] ?? '#F5F8FC' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">{format(new Date(meeting.datetime), 'dd/MM/yyyy HH:mm')}</Typography>
                  <Chip size="small" label={meeting.status} />
                  <Typography variant="body2" color="text.secondary">
                    {meeting.agenda ?? 'Sem pauta'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {meeting.locality?.name ?? 'Brasil'}
                  </Typography>
                  <Button variant="text" onClick={() => openEdit(meeting)}>
                    Ver detalhes
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={1}>
              {calendarDays.map((day) => {
                const dayMeetings = meetings.filter(
                  (meeting: any) => format(new Date(meeting.datetime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'),
                );
                return (
                  <Box key={day.toISOString()} sx={{ border: '1px solid #E6ECF5', borderRadius: 2, p: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {format(day, 'dd/MM')}
                    </Typography>
                    <Stack spacing={0.5} mt={1}>
                      {dayMeetings.map((meeting: any) => (
                        <Chip
                          key={meeting.id}
                          size="small"
                          label={meeting.scope}
                          onClick={() => openEdit(meeting)}
                          sx={{ cursor: 'pointer' }}
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

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
        <Box p={3} display="flex" flexDirection="column" gap={2} height="100%">
          <Typography variant="h5">{selectedMeeting ? 'Detalhes da reunião' : 'Nova reunião'}</Typography>
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
            select
            size="small"
            label="Escopo"
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value })}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          >
            {MeetingScope.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
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
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Localidade"
            value={form.localityId}
            onChange={(e) => setForm({ ...form, localityId: e.target.value })}
            disabled={Boolean(selectedMeeting) && !canUpdate}
          >
            <MenuItem value="">Brasil</MenuItem>
            {localities.map((l: any) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
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
            size="small"
            label="Participantes (JSON)"
            value={form.participantsText}
            onChange={(e) => setForm({ ...form, participantsText: e.target.value })}
            multiline
            minRows={3}
            placeholder='[{"nome":"Fulano","papel":"Coordenação","om":"CIPAVD","contato":"(61) ..."}]'
            disabled={Boolean(selectedMeeting) && !canUpdate}
          />
          <Stack direction="row" spacing={1}>
            {(canCreate || canUpdate) && (
              <Button variant="contained" onClick={handleSave}>
                Salvar
              </Button>
            )}
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
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
                {(selectedMeeting.participantsJson ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum participante registrado.
                  </Typography>
                )}
                {(selectedMeeting.participantsJson ?? []).map((p: any, index: number) => (
                  <Card key={`${p.name ?? 'p'}-${index}`} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2">{p.nome ?? p.name ?? 'Participante'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {p.papel ?? p.role ?? '-'} · {p.om ?? '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.contato ?? p.contact ?? '-'}
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
              <Divider />
              <Typography variant="subtitle1">Tarefas geradas</Typography>
              <Stack spacing={1}>
                {(selectedMeeting.tasks ?? []).map((task: any) => (
                  <Card key={task.id} variant="outlined">
                    <CardContent>
                      <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
                {selectedMeeting.tasks?.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma tarefa vinculada.
                  </Typography>
                )}
              </Stack>
            </>
          )}
        </Box>
      </Drawer>

      <Drawer anchor="right" open={wizardOpen} onClose={() => setWizardOpen(false)} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5">Gerar tarefas</Typography>
          <Stepper activeStep={wizardStep}>
            {['Template', 'Localidades', 'Revisão'].map((label) => (
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
                label="Template existente"
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
                    selectedLocalities: e.target.value as string[],
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
                    {p}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={wizardPayload.reportRequired}
                    onChange={(e) => setWizardPayload({ ...wizardPayload, reportRequired: e.target.checked })}
                  />
                }
                label="Relatório obrigatório"
              />
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
    </Box>
  );
}
