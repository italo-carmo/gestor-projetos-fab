import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { addDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { useCreateTaskTemplate, useEloRoles, useGenerateInstances, useLocalities, usePhases, useTaskTemplates, useCloneTaskTemplate, useMe } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { TASK_PRIORITY_LABELS } from '../constants/enums';

export function TaskTemplatesPage() {
  const { data: me } = useMe();
  const toast = useToast();
  const templatesQuery = useTaskTemplates();
  const phasesQuery = usePhases();
  const localitiesQuery = useLocalities();
  const eloRolesQuery = useEloRoles();
  const eloRoles = eloRolesQuery.data?.items ?? [];
  const createTemplate = useCreateTaskTemplate();
  const cloneTemplate = useCloneTaskTemplate();
  const generateInstances = useGenerateInstances();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    phaseId: '',
    specialtyId: '',
    eloRoleId: '',
    appliesToAllLocalities: false,
    reportRequiredDefault: false,
  });
  const [generateForm, setGenerateForm] = useState({
    baseDate: '',
    selectedLocalities: [] as string[],
    offsets: {} as Record<string, number>,
    priority: 'MEDIUM',
    reportRequired: false,
  });

  const openCreate = () => {
    setForm({
      title: '',
      description: '',
      phaseId: '',
      specialtyId: '',
      eloRoleId: '',
      appliesToAllLocalities: false,
      reportRequiredDefault: false,
    });
    setDrawerOpen(true);
  };

  const openGenerate = (template: any) => {
    setSelectedTemplate(template);
    setGenerateForm({
      baseDate: '',
      selectedLocalities: [],
      offsets: {},
      priority: 'MEDIUM',
      reportRequired: template.reportRequiredDefault ?? false,
    });
    setGenerateOpen(true);
  };

  const handleCreate = async () => {
    try {
      await createTemplate.mutateAsync({
        title: form.title,
        description: form.description || null,
        phaseId: form.phaseId,
        specialtyId: form.specialtyId || null,
        eloRoleId: form.eloRoleId || null,
        appliesToAllLocalities: form.appliesToAllLocalities,
        reportRequiredDefault: form.reportRequiredDefault,
      });
      toast.push({ message: 'Template criado', severity: 'success' });
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao criar modelo', severity: 'error' });
    }
  };

  const handleClone = async (id: string) => {
    try {
      await cloneTemplate.mutateAsync(id);
      toast.push({ message: 'Template clonado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao clonar', severity: 'error' });
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    try {
      const base = new Date(generateForm.baseDate);
      const localities = generateForm.selectedLocalities.map((id) => ({
        localityId: id,
        dueDate: addDays(base, generateForm.offsets[id] ?? 0).toISOString(),
      }));
      await generateInstances.mutateAsync({
        id: selectedTemplate.id,
        payload: {
          localities,
          priority: generateForm.priority,
          reportRequired: generateForm.reportRequired,
        },
      });
      toast.push({ message: 'Instâncias geradas', severity: 'success' });
      setGenerateOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao gerar instâncias', severity: 'error' });
    }
  };

  if (templatesQuery.isLoading) return <SkeletonState />;
  if (templatesQuery.isError) return <ErrorState error={templatesQuery.error} onRetry={() => templatesQuery.refetch()} />;

  const templates = templatesQuery.data?.items ?? [];
  const templatesToRender = useMemo(() => {
    if (showDuplicates) return templates;

    const grouped = new Map<string, any>();
    for (const template of templates) {
      const key = [
        (template.title ?? '').trim().toLowerCase(),
        template.phaseId ?? '',
        template.specialtyId ?? '',
        template.eloRoleId ?? '',
      ].join('|');

      const prev = grouped.get(key);
      if (!prev) {
        grouped.set(key, { ...template, duplicateCount: 1 });
        continue;
      }

      const prevDate = new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime();
      const nextDate = new Date(template.updatedAt ?? template.createdAt ?? 0).getTime();
      if (nextDate > prevDate) {
        grouped.set(key, { ...template, duplicateCount: (prev.duplicateCount ?? 1) + 1 });
      } else {
        prev.duplicateCount = (prev.duplicateCount ?? 1) + 1;
      }
    }

    return Array.from(grouped.values());
  }, [showDuplicates, templates]);
  const hiddenDuplicates = Math.max(0, templates.length - templatesToRender.length);
  const phases = phasesQuery.data?.items ?? [];
  const localities = localitiesQuery.data?.items ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Modelos de tarefa</Typography>
        {can(me, 'task_templates', 'create') && (
          <Button variant="contained" onClick={openCreate}>
            Novo template
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Gerar instâncias = criar tarefas reais a partir deste modelo para as localidades selecionadas.
      </Typography>
      <FormControlLabel
        sx={{ mb: 1 }}
        control={<Switch size="small" checked={showDuplicates} onChange={(e) => setShowDuplicates(e.target.checked)} />}
        label={showDuplicates ? 'Exibindo todos os modelos (com duplicados)' : 'Ocultar modelos duplicados'}
      />
      {!showDuplicates && hiddenDuplicates > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {hiddenDuplicates} registros duplicados ocultos para facilitar a gestão.
        </Typography>
      )}

      {templatesToRender.length === 0 && (
        <EmptyState title="Nenhum template" description="Crie templates para acelerar a criação de tarefas." />
      )}

      {templatesToRender.length > 0 && (
        <Card>
          <CardContent>
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Título', 'Fase', 'Relatório', 'Ações'].map((header) => (
                    <Box key={header} component="th" sx={{ textAlign: 'left', pb: 1 }}>
                      {header}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {templatesToRender.map((template: any) => (
                  <Box key={template.id} component="tr" sx={{ borderTop: '1px solid #E6ECF5' }}>
                    <Box component="td" sx={{ py: 1 }}>
                      {template.title}
                      {(template.duplicateCount ?? 1) > 1 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${template.duplicateCount} semelhantes`}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {phases.find((p: any) => p.id === template.phaseId)?.name ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {template.reportRequiredDefault ? 'Sim' : 'Não'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      <Button size="small" onClick={() => openGenerate(template)}>
                        Gerar instâncias
                      </Button>
                      <Button size="small" onClick={() => handleClone(template.id)}>
                        Clonar
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', md: 420 } } }}>
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5">Novo template</Typography>
          <TextField size="small" label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField
            size="small"
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            multiline
            minRows={3}
          />
          <TextField
            select
            size="small"
            label="Fase"
            value={form.phaseId}
            onChange={(e) => setForm({ ...form, phaseId: e.target.value })}
          >
            {phases.map((phase: any) => (
              <MenuItem key={phase.id} value={phase.id}>
                {phase.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Especialidade (ID)"
            value={form.specialtyId}
            onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="Elo"
            fullWidth
            value={form.eloRoleId}
            onChange={(e) => setForm({ ...form, eloRoleId: e.target.value })}
          >
            <MenuItem value="">Nenhum</MenuItem>
            {eloRoles.map((r: any) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Relatório obrigatório"
            value={form.reportRequiredDefault ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, reportRequiredDefault: e.target.value === 'true' })}
          >
            <MenuItem value="true">Sim</MenuItem>
            <MenuItem value="false">Não</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={form.appliesToAllLocalities}
                onChange={(e) => setForm({ ...form, appliesToAllLocalities: e.target.checked })}
              />
            }
            label="Aplicar a todas localidades"
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleCreate}>
              Salvar
            </Button>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Drawer anchor="right" open={generateOpen} onClose={() => setGenerateOpen(false)} PaperProps={{ sx: { width: { xs: '100%', md: 420 } } }}>
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5">Gerar instâncias</Typography>
          <TextField
            size="small"
            type="date"
            label="Data base"
            InputLabelProps={{ shrink: true }}
            value={generateForm.baseDate}
            onChange={(e) => setGenerateForm({ ...generateForm, baseDate: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="Localidades"
            SelectProps={{ multiple: true }}
            value={generateForm.selectedLocalities}
            onChange={(e) =>
              setGenerateForm({
                ...generateForm,
                selectedLocalities: e.target.value as string[],
              })
            }
          >
            {localities.map((loc: any) => (
              <MenuItem key={loc.id} value={loc.id}>
                {loc.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              onClick={() => {
                const allIds = localities.map((loc: any) => loc.id);
                const offsets = allIds.reduce((acc: Record<string, number>, id: string) => {
                  acc[id] = generateForm.offsets[id] ?? 0;
                  return acc;
                }, {});
                setGenerateForm({ ...generateForm, selectedLocalities: allIds, offsets });
              }}
            >
              Selecionar todas
            </Button>
            <Button
              size="small"
              onClick={() => setGenerateForm({ ...generateForm, selectedLocalities: [], offsets: {} })}
            >
              Limpar
            </Button>
          </Stack>
          {generateForm.selectedLocalities.map((locId) => (
            <TextField
              key={locId}
              size="small"
              type="number"
              label={`Deslocamento ${localities.find((l: any) => l.id === locId)?.name ?? ''} (dias)`}
              value={generateForm.offsets[locId] ?? 0}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  offsets: { ...generateForm.offsets, [locId]: Number(e.target.value) },
                })
              }
            />
          ))}
          <TextField
            select
            size="small"
            label="Prioridade"
            value={generateForm.priority}
            onChange={(e) => setGenerateForm({ ...generateForm, priority: e.target.value })}
          >
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <MenuItem key={p} value={p}>
                {TASK_PRIORITY_LABELS[p] ?? p}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Relatório obrigatório"
            value={generateForm.reportRequired ? 'true' : 'false'}
            onChange={(e) => setGenerateForm({ ...generateForm, reportRequired: e.target.value === 'true' })}
          >
            <MenuItem value="true">Sim</MenuItem>
            <MenuItem value="false">Não</MenuItem>
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleGenerate}>
              Gerar
            </Button>
            <Button variant="text" onClick={() => setGenerateOpen(false)}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
