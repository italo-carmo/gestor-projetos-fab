import {
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddMissionParticipantFromLdap,
  useCreateMission,
  useCreateMissionScheduleItem,
  useDeleteMission,
  useDeleteMissionScheduleItem,
  useExportMissionSchedulePdf,
  useLocalities,
  useLookupMissionLdapParticipant,
  useMission,
  useMissions,
  useRemoveMissionParticipant,
  useUpdateMission,
  useUpdateMissionScheduleItem,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { selectTargetLocalities } from '../constants/localities';

const blankMissionForm = {
  title: '',
  description: '',
  localityId: '',
  startDate: '',
  endDate: '',
};

const blankScheduleForm = {
  title: '',
  startAt: '',
  durationMinutes: 60,
  location: '',
  responsible: '',
  participants: '',
};

export function MissionsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const missionIdFromUrl = params.get('missionId') ?? '';
  const localityId = params.get('localityId') ?? '';
  const q = params.get('q') ?? '';

  const missionsQuery = useMissions({ localityId: localityId || undefined, q: q || undefined });
  const localitiesQuery = useLocalities();
  const missionDetailQuery = useMission(missionIdFromUrl, Boolean(missionIdFromUrl));

  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const addParticipant = useAddMissionParticipantFromLdap();
  const removeParticipant = useRemoveMissionParticipant();
  const createScheduleItem = useCreateMissionScheduleItem();
  const updateScheduleItem = useUpdateMissionScheduleItem();
  const deleteScheduleItem = useDeleteMissionScheduleItem();
  const exportSchedulePdf = useExportMissionSchedulePdf();

  const [drawerOpen, setDrawerOpen] = useState(Boolean(missionIdFromUrl));
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [missionForm, setMissionForm] = useState(blankMissionForm);
  const [ldapIdentifier, setLdapIdentifier] = useState('');
  const [scheduleForm, setScheduleForm] = useState(blankScheduleForm);
  const [editingScheduleItemId, setEditingScheduleItemId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [scheduleDeleteTarget, setScheduleDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const lookupQuery = useLookupMissionLdapParticipant(ldapIdentifier);

  const localityOptions = useMemo(
    () =>
      selectTargetLocalities((localitiesQuery.data?.items ?? []) as any[])
        .filter((locality: any) => Number(locality?.recruitsFemaleCountCurrent ?? 0) > 0)
        .map((locality: any) => ({ id: String(locality.id), name: String(locality.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [localitiesQuery.data?.items],
  );

  const items = missionsQuery.data?.items ?? [];
  const selectedMission = missionDetailQuery.data ?? null;

  useEffect(() => {
    if (!missionIdFromUrl) {
      setDrawerOpen(false);
      if (!isCreateMode) {
        setScheduleForm(blankScheduleForm);
        setEditingScheduleItemId(null);
      }
      return;
    }
    setDrawerOpen(true);
    setIsCreateMode(false);
  }, [isCreateMode, missionIdFromUrl]);

  useEffect(() => {
    if (!selectedMission) return;
    setMissionForm({
      title: selectedMission.title ?? '',
      description: selectedMission.description ?? '',
      localityId: selectedMission.localityId ?? '',
      startDate: selectedMission.startDate ? String(selectedMission.startDate).slice(0, 10) : '',
      endDate: selectedMission.endDate ? String(selectedMission.endDate).slice(0, 10) : '',
    });
  }, [selectedMission]);

  const openCreate = () => {
    setIsCreateMode(true);
    setMissionForm({
      ...blankMissionForm,
      localityId: localityId || localityOptions[0]?.id || '',
    });
    setLdapIdentifier('');
    setScheduleForm(blankScheduleForm);
    setEditingScheduleItemId(null);
    setDrawerOpen(true);

    const next = new URLSearchParams(params);
    next.delete('missionId');
    setParams(next, { replace: true });
  };

  const openMission = (id: string) => {
    setIsCreateMode(false);
    setDrawerOpen(true);
    setEditingScheduleItemId(null);
    setScheduleForm(blankScheduleForm);

    const next = new URLSearchParams(params);
    next.set('missionId', id);
    setParams(next, { replace: true });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setIsCreateMode(false);
    setEditingScheduleItemId(null);
    setScheduleForm(blankScheduleForm);
    setConfirmDeleteOpen(false);
    setScheduleDeleteTarget(null);

    const next = new URLSearchParams(params);
    next.delete('missionId');
    setParams(next, { replace: true });
  };

  const handleSaveMission = async () => {
    if (!missionForm.title.trim()) {
      toast.push({ message: 'Informe o título da missão.', severity: 'warning' });
      return;
    }
    if (!missionForm.localityId) {
      toast.push({ message: 'Selecione uma localidade.', severity: 'warning' });
      return;
    }
    if (!missionForm.startDate || !missionForm.endDate) {
      toast.push({ message: 'Informe data de início e término.', severity: 'warning' });
      return;
    }

    try {
      if (isCreateMode) {
        const created = await createMission.mutateAsync({
          title: missionForm.title,
          description: missionForm.description || null,
          localityId: missionForm.localityId,
          startDate: missionForm.startDate,
          endDate: missionForm.endDate,
        });
        toast.push({ message: 'Missão criada com sucesso.', severity: 'success' });
        openMission(created.id);
      } else if (selectedMission) {
        await updateMission.mutateAsync({
          id: selectedMission.id,
          payload: {
            title: missionForm.title,
            description: missionForm.description || null,
            localityId: missionForm.localityId,
            startDate: missionForm.startDate,
            endDate: missionForm.endDate,
          },
        });
        toast.push({ message: 'Missão atualizada.', severity: 'success' });
      }
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar missão.', severity: 'error' });
    }
  };

  const handleDeleteMission = async () => {
    if (!selectedMission) return;

    try {
      await deleteMission.mutateAsync(selectedMission.id);
      toast.push({ message: 'Missão removida.', severity: 'success' });
      setConfirmDeleteOpen(false);
      closeDrawer();
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover missão.', severity: 'error' });
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedMission) return;
    if (!ldapIdentifier.trim()) return;

    try {
      await addParticipant.mutateAsync({ id: selectedMission.id, identifier: ldapIdentifier.trim() });
      toast.push({ message: 'Participante adicionado.', severity: 'success' });
      setLdapIdentifier('');
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao adicionar participante.', severity: 'error' });
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedMission) return;

    try {
      await removeParticipant.mutateAsync({ id: selectedMission.id, participantId });
      toast.push({ message: 'Participante removido.', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover participante.', severity: 'error' });
    }
  };

  const handleSaveScheduleItem = async () => {
    if (!selectedMission) return;
    if (!scheduleForm.title.trim() || !scheduleForm.startAt) {
      toast.push({ message: 'Preencha atividade e horário.', severity: 'warning' });
      return;
    }

    const payload = {
      title: scheduleForm.title,
      startAt: new Date(scheduleForm.startAt).toISOString(),
      durationMinutes: Number(scheduleForm.durationMinutes) || 0,
      location: scheduleForm.location,
      responsible: scheduleForm.responsible,
      participants: scheduleForm.participants,
    };

    try {
      if (editingScheduleItemId) {
        await updateScheduleItem.mutateAsync({
          id: selectedMission.id,
          itemId: editingScheduleItemId,
          payload,
        });
        toast.push({ message: 'Item de cronograma atualizado.', severity: 'success' });
      } else {
        await createScheduleItem.mutateAsync({ id: selectedMission.id, payload });
        toast.push({ message: 'Item de cronograma adicionado.', severity: 'success' });
      }
      setScheduleForm(blankScheduleForm);
      setEditingScheduleItemId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar item.', severity: 'error' });
    }
  };

  const handleDeleteScheduleItem = (itemId: string, itemTitle: string) => {
    setScheduleDeleteTarget({ id: itemId, title: itemTitle });
  };

  const handleConfirmDeleteScheduleItem = async () => {
    if (!selectedMission) return;
    if (!scheduleDeleteTarget) return;

    try {
      await deleteScheduleItem.mutateAsync({ id: selectedMission.id, itemId: scheduleDeleteTarget.id });
      toast.push({ message: 'Item removido.', severity: 'success' });
      if (editingScheduleItemId === scheduleDeleteTarget.id) {
        setEditingScheduleItemId(null);
        setScheduleForm(blankScheduleForm);
      }
      setScheduleDeleteTarget(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover item.', severity: 'error' });
    }
  };

  if (missionsQuery.isLoading) return <SkeletonState />;
  if (missionsQuery.isError) return <ErrorState error={missionsQuery.error} onRetry={() => missionsQuery.refetch()} />;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={2} gap={1.2}>
        <Box>
          <Typography variant="h4">Missões</Typography>
          <Typography variant="body2" color="text.secondary">
            Planejamento completo da missão, participantes via LDAP e cronograma oficial com exportação em PDF.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
          Nova missão
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Buscar"
              value={q}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('q', event.target.value);
                else next.delete('q');
                setParams(next, { replace: true });
              }}
              sx={{ minWidth: 240 }}
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('localityId', event.target.value);
                else next.delete('localityId');
                setParams(next, { replace: true });
              }}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localityOptions.map((locality) => (
                <MenuItem key={locality.id} value={locality.id}>
                  {locality.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Nenhuma missão" description="Crie a primeira missão para iniciar o planejamento." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Missão</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Localidade</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Período</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Participantes</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Itens de cronograma</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((mission: any) => (
                  <TableRow key={mission.id} hover>
                    <TableCell>
                      <Typography fontWeight={700}>{mission.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mission.description || 'Sem descrição'}
                      </Typography>
                    </TableCell>
                    <TableCell>{mission.locality?.name ?? '-'}</TableCell>
                    <TableCell>
                      {new Date(mission.startDate).toLocaleDateString('pt-BR')} a{' '}
                      {new Date(mission.endDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Chip label={String(mission.participantsCount ?? mission.participants?.length ?? 0)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={String(mission.scheduleItemsCount ?? mission.scheduleItems?.length ?? 0)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => openMission(mission.id)}>
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer} PaperProps={{ sx: { width: { xs: '100%', md: 760 } } }}>
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">{isCreateMode ? 'Nova missão' : 'Detalhes da missão'}</Typography>
            <Stack direction="row" spacing={1}>
              {!isCreateMode && selectedMission && (
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleteMission.isPending}
                >
                  Excluir
                </Button>
              )}
              <Button onClick={closeDrawer}>Fechar</Button>
            </Stack>
          </Stack>

          {!isCreateMode && missionDetailQuery.isLoading && <SkeletonState />}
          {!isCreateMode && missionDetailQuery.isError && (
            <ErrorState error={missionDetailQuery.error} onRetry={() => missionDetailQuery.refetch()} />
          )}

          {(isCreateMode || selectedMission) && (
            <>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} mb={1.2}>
                    Informações da missão
                  </Typography>
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      label="Título"
                      value={missionForm.title}
                      onChange={(event) => setMissionForm({ ...missionForm, title: event.target.value })}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Descrição"
                      value={missionForm.description}
                      onChange={(event) => setMissionForm({ ...missionForm, description: event.target.value })}
                      multiline
                      minRows={2}
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Localidade"
                        value={missionForm.localityId}
                        onChange={(event) => setMissionForm({ ...missionForm, localityId: event.target.value })}
                        sx={{ minWidth: 260 }}
                      >
                        {localityOptions.map((locality) => (
                          <MenuItem key={locality.id} value={locality.id}>
                            {locality.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        type="date"
                        label="Início"
                        value={missionForm.startDate}
                        onChange={(event) => setMissionForm({ ...missionForm, startDate: event.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 180 }}
                      />
                      <TextField
                        size="small"
                        type="date"
                        label="Término"
                        value={missionForm.endDate}
                        onChange={(event) => setMissionForm({ ...missionForm, endDate: event.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 180 }}
                      />
                    </Stack>
                    <Box display="flex" justifyContent="flex-end">
                      <Button
                        variant="contained"
                        onClick={handleSaveMission}
                        disabled={createMission.isPending || updateMission.isPending}
                      >
                        {isCreateMode ? 'Criar missão' : 'Salvar missão'}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {!isCreateMode && selectedMission && (
                <>
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} mb={1.2}>
                        Participantes (LDAP)
                      </Typography>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                        <TextField
                          size="small"
                          label="CPF ou e-mail"
                          value={ldapIdentifier}
                          onChange={(event) => setLdapIdentifier(event.target.value)}
                          fullWidth
                        />
                        <Button
                          variant="outlined"
                          startIcon={<PersonAddAlt1RoundedIcon />}
                          onClick={handleAddParticipant}
                          disabled={!ldapIdentifier.trim() || addParticipant.isPending}
                        >
                          Adicionar
                        </Button>
                      </Stack>
                      {lookupQuery.data?.item && (
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.8}>
                          LDAP: {lookupQuery.data.item.name || lookupQuery.data.item.uid} ({lookupQuery.data.item.email || 'sem e-mail'})
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.2 }}>
                        {(selectedMission.participants ?? []).map((participant: any) => (
                          <Chip
                            key={participant.id}
                            label={`${participant.name}${participant.email ? ` • ${participant.email}` : participant.cpf ? ` • ${participant.cpf}` : ''}`}
                            onDelete={() => handleRemoveParticipant(participant.id)}
                            size="small"
                          />
                        ))}
                        {(selectedMission.participants ?? []).length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Nenhum participante cadastrado.
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={1.2} gap={1}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          Cronograma da missão
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<DownloadRoundedIcon />}
                          onClick={() => exportSchedulePdf.mutateAsync(selectedMission.id)}
                          disabled={exportSchedulePdf.isPending}
                        >
                          Exportar PDF
                        </Button>
                      </Stack>

                      <Stack spacing={1} mb={1.4}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                          <TextField
                            size="small"
                            label="Atividade"
                            value={scheduleForm.title}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, title: event.target.value })}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            type="datetime-local"
                            label="Início"
                            value={scheduleForm.startAt}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, startAt: event.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ minWidth: 220 }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Duração (min)"
                            value={scheduleForm.durationMinutes}
                            onChange={(event) =>
                              setScheduleForm({ ...scheduleForm, durationMinutes: Number(event.target.value) || 0 })
                            }
                            inputProps={{ min: 1 }}
                            sx={{ minWidth: 150 }}
                          />
                        </Stack>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                          <TextField
                            size="small"
                            label="Local"
                            value={scheduleForm.location}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, location: event.target.value })}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            label="Responsável"
                            value={scheduleForm.responsible}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, responsible: event.target.value })}
                            fullWidth
                          />
                        </Stack>
                        <TextField
                          size="small"
                          label="Participantes"
                          value={scheduleForm.participants}
                          onChange={(event) => setScheduleForm({ ...scheduleForm, participants: event.target.value })}
                          fullWidth
                          multiline
                          minRows={2}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            onClick={handleSaveScheduleItem}
                            disabled={createScheduleItem.isPending || updateScheduleItem.isPending}
                          >
                            {editingScheduleItemId ? 'Atualizar item' : 'Adicionar item'}
                          </Button>
                          {editingScheduleItemId && (
                            <Button
                              variant="text"
                              onClick={() => {
                                setEditingScheduleItemId(null);
                                setScheduleForm(blankScheduleForm);
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                        </Stack>
                      </Stack>

                      <Divider sx={{ mb: 1.2 }} />

                      {(selectedMission.scheduleItems ?? []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhum item no cronograma da missão.
                        </Typography>
                      ) : (
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'primary.main' }}>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Horário</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Atividade</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Local</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Responsável</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Participantes</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Ações</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(selectedMission.scheduleItems ?? []).map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  {new Date(item.startAt).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {item.durationMinutes} min
                                  </Typography>
                                </TableCell>
                                <TableCell>{item.title}</TableCell>
                                <TableCell>{item.location}</TableCell>
                                <TableCell>{item.responsible}</TableCell>
                                <TableCell sx={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{item.participants}</TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setEditingScheduleItemId(item.id);
                                      setScheduleForm({
                                        title: item.title ?? '',
                                        startAt: item.startAt ? new Date(item.startAt).toISOString().slice(0, 16) : '',
                                        durationMinutes: Number(item.durationMinutes ?? 60),
                                        location: item.location ?? '',
                                        responsible: item.responsible ?? '',
                                        participants: item.participants ?? '',
                                      });
                                    }}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteScheduleItem(item.id, item.title ?? 'Item de cronograma')}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </Box>
      </Drawer>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteMission}
        title="Excluir missão"
        message="Confirma a exclusão definitiva desta missão?"
        highlightText={selectedMission?.title ?? ''}
        note="Esta ação também remove participantes e itens de cronograma vinculados."
        confirmLabel="Excluir missão"
        severity="error"
        confirmLoading={deleteMission.isPending}
      />

      <ConfirmDialog
        open={Boolean(scheduleDeleteTarget)}
        onCancel={() => setScheduleDeleteTarget(null)}
        onConfirm={handleConfirmDeleteScheduleItem}
        title="Excluir item do cronograma"
        message="Deseja remover este item do cronograma?"
        highlightText={scheduleDeleteTarget?.title ?? ''}
        note="A exclusão é permanente."
        confirmLabel="Excluir item"
        severity="error"
        confirmLoading={deleteScheduleItem.isPending}
      />
    </Box>
  );
}
