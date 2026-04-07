import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useMe, usePhases, useUpdatePhase } from '../api/hooks';
import {
  useCreatePosto,
  useCreateMissionChecklistDimension,
  useDeletePosto,
  useDeleteMissionChecklistDimension,
  useMissionChecklistConfig,
  usePostos,
  useUpdateMissionChecklistClassification,
  useUpdateMissionChecklistDimension,
  useUpdatePosto,
} from '../api/hooks';
import {
  useCreateLocality,
  useDeleteLocality,
  useCreateEloRole,
  useDeleteEloRole,
  useEloRoles,
  useLocalities,
  useUpdateLocality,
  useUpdateEloRole,
} from '../api/hooks';
import { can } from '../app/rbac';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { useSearchParams } from 'react-router-dom';
import { getTargetLocalityKey, selectTargetLocalities } from '../constants/localities';

type LocalityForm = {
  code: string;
  name: string;
};

function LocalitiesTab() {
  const localitiesQuery = useLocalities();
  const createLocality = useCreateLocality();
  const updateLocality = useUpdateLocality();
  const deleteLocality = useDeleteLocality();
  const toast = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<LocalityForm>({ code: '', name: '' });

  if (localitiesQuery.isLoading) return <SkeletonState />;
  if (localitiesQuery.isError) {
    return <ErrorState error={localitiesQuery.error} onRetry={() => localitiesQuery.refetch()} />;
  }

  const allLocalities = (localitiesQuery.data?.items ?? []) as any[];
  const items = selectTargetLocalities(allLocalities)
    .slice()
    .sort((a: any, b: any) => String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'pt-BR'));

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '' });
    setDrawerOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
    };
    if (!payload.code || !payload.name) {
      toast.push({ message: 'Informe sigla e nome da localidade.', severity: 'warning' });
      return;
    }
    if (!getTargetLocalityKey(payload.name)) {
      toast.push({
        message:
          'Nome inválido para localidade SMIF. Use uma das localidades alvo (Brasília, Canoas, Guaratinguetá, Lagoa Santa, Manaus, Pirassununga, Rio de Janeiro, São Paulo).',
        severity: 'warning',
      });
      return;
    }

    const conflictingLocality = allLocalities.find((locality: any) => {
      const localityId = String(locality?.id ?? '').trim();
      const localityCode = String(locality?.code ?? '').trim().toUpperCase();
      if (!localityCode) return false;
      if (editing && localityId === String(editing.id ?? '')) return false;
      return localityCode === payload.code;
    });

    if (conflictingLocality && editing) {
      const editingKey = getTargetLocalityKey(String(editing?.name ?? payload.name));
      const conflictKey = getTargetLocalityKey(String(conflictingLocality?.name ?? ''));
      const sameSmifLocality = Boolean(editingKey && conflictKey && editingKey === conflictKey);
      if (sameSmifLocality) {
        const previousCode = String(editing?.code ?? '').trim().toUpperCase();
        const conflictId = String(conflictingLocality?.id ?? '').trim();
        const usedCodes = new Set(
          allLocalities.map((item: any) => String(item?.code ?? '').trim().toUpperCase()).filter(Boolean),
        );
        let tempCode = `TMP${Date.now().toString().slice(-6)}`;
        while (usedCodes.has(tempCode)) {
          tempCode = `TMP${Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, '0')}`;
        }
        try {
          await updateLocality.mutateAsync({
            id: conflictId,
            payload: { code: tempCode },
          });
          await updateLocality.mutateAsync({ id: editing.id, payload });
          if (previousCode && previousCode !== payload.code) {
            await updateLocality.mutateAsync({
              id: conflictId,
              payload: { code: previousCode },
            });
          }
          toast.push({ message: 'Localidade atualizada e registros consolidados.', severity: 'success' });
          setDrawerOpen(false);
          return;
        } catch (error) {
          toast.push({ message: parseApiError(error).message ?? 'Erro ao atualizar localidade.', severity: 'error' });
          return;
        }
      }
    }

    if (conflictingLocality) {
      const conflictName = String(conflictingLocality?.name ?? 'outra localidade');
      toast.push({
        message: `A sigla ${payload.code} já está em uso por ${conflictName}. Use uma sigla diferente.`,
        severity: 'warning',
      });
      return;
    }

    try {
      if (editing) {
        await updateLocality.mutateAsync({ id: editing.id, payload });
        toast.push({ message: 'Localidade atualizada.', severity: 'success' });
      } else {
        await createLocality.mutateAsync(payload);
        toast.push({ message: 'Localidade criada.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar localidade.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocality.mutateAsync(id);
      toast.push({ message: 'Localidade excluída.', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir localidade.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Localidades</Typography>
        <Button variant="contained" size="small" onClick={openCreate}>
          Nova localidade
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cadastre e gerencie as localidades da SMIF (ex.: Brasília-DF, Canoas-RS), incluindo a sigla de cada uma.
      </Typography>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma localidade"
              description="Crie uma localidade da SMIF para começar."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600, width: 160 }}>Sigla</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleteId(item.id)}>
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar localidade SMIF' : 'Nova localidade SMIF'}</Typography>
          <TextField
            size="small"
            label="Sigla"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: BASV"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome da localidade"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Brasília-DF"
            fullWidth
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={createLocality.isPending || updateLocality.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir localidade"
        message="Essa ação remove a localidade e pode afetar vínculos existentes. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

function PostosTab() {
  const postosQuery = usePostos();
  const createPosto = useCreatePosto();
  const updatePosto = useUpdatePosto();
  const deletePosto = useDeletePosto();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', sortOrder: 0 });

  if (postosQuery.isLoading) return <SkeletonState />;
  if (postosQuery.isError)
    return <ErrorState error={postosQuery.error} onRetry={() => postosQuery.refetch()} />;

  const items = postosQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', sortOrder: items.length });
    setDrawerOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      sortOrder: item.sortOrder ?? 0,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updatePosto.mutateAsync({
          id: editing.id,
          payload: { code: form.code.trim(), name: form.name.trim(), sortOrder: form.sortOrder },
        });
        toast.push({ message: 'Posto atualizado', severity: 'success' });
      } else {
        await createPosto.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          sortOrder: form.sortOrder,
        });
        toast.push({ message: 'Posto criado', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar posto.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosto.mutateAsync(id);
      toast.push({ message: 'Posto excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir posto.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Postos</Typography>
        <Button variant="contained" size="small" onClick={openCreate}>
          Novo posto
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Postos ou cargos usados no módulo de atividades externas para registrar o quantitativo de participantes por posto (ex.: Sargento, Capitão, Soldado).
      </Typography>
      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhum posto"
              description="Crie postos para usar no fechamento de atividades externas (quantitativo de participantes por posto)."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ordem</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.sortOrder ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleteId(item.id)}>
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar posto' : 'Novo posto'}</Typography>
          <TextField
            size="small"
            label="Código"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: SGT, CAP"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Sargento, Capitão"
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Ordem"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            fullWidth
            inputProps={{ min: 0 }}
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={createPosto.isPending || updatePosto.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir posto"
        message="Ao excluir, registros de atividades externas que usam este posto podem ficar sem vínculo. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

function PhasesTab() {
  const { data: me } = useMe();
  const phasesQuery = usePhases();
  const updatePhase = useUpdatePhase();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!can(me, 'phases', 'update')) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  if (phasesQuery.isLoading) return <SkeletonState />;
  if (phasesQuery.isError) return <ErrorState error={phasesQuery.error} onRetry={() => phasesQuery.refetch()} />;

  const items = phasesQuery.data?.items ?? [];

  const getDraft = (phase: any) => drafts[phase.id] ?? (phase.displayName ?? '');
  const getCurrent = (phase: any) => phase.displayName ?? '';
  const isDirty = (phase: any) => getDraft(phase).trim() !== getCurrent(phase).trim();

  const save = async (phase: any) => {
    try {
      const value = getDraft(phase).trim();
      await updatePhase.mutateAsync({
        id: phase.id,
        displayName: value ? value : null,
      });
      toast.push({ message: 'Fase atualizada', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar fase', severity: 'error' });
    }
  };

  if (items.length === 0) {
    return <EmptyState title="Sem fases" description="Nenhuma fase cadastrada no sistema." />;
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Fases
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Defina o nome exibido das fases no sistema. Deixe vazio para usar o nome padrão.
      </Typography>

      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ordem</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código técnico</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome padrão</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome exibido</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((phase: any) => (
                <TableRow key={phase.id} hover>
                  <TableCell>{phase.order}</TableCell>
                  <TableCell>{phase.code ?? phase.id}</TableCell>
                  <TableCell>{phase.defaultName ?? phase.name}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={phase.defaultName ?? phase.name}
                      value={getDraft(phase)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [phase.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setDrafts((prev) => ({ ...prev, [phase.id]: '' }))}
                      sx={{ mr: 1 }}
                    >
                      Padrão
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={!isDirty(phase) || updatePhase.isPending}
                      onClick={() => save(phase)}
                    >
                      Salvar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}

function EloRolesTab() {
  const eloRolesQuery = useEloRoles();
  const createEloRole = useCreateEloRole();
  const updateEloRole = useUpdateEloRole();
  const deleteEloRole = useDeleteEloRole();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', sortOrder: 0 });

  if (eloRolesQuery.isLoading) return <SkeletonState />;
  if (eloRolesQuery.isError)
    return <ErrorState error={eloRolesQuery.error} onRetry={() => eloRolesQuery.refetch()} />;

  const items = eloRolesQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', sortOrder: items.length });
    setDrawerOpen(true);
  };

  const openEdit = (role: any) => {
    setEditing(role);
    setForm({
      code: role.code ?? '',
      name: role.name ?? '',
      sortOrder: role.sortOrder ?? 0,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateEloRole.mutateAsync({
          id: editing.id,
          payload: { code: form.code.trim(), name: form.name.trim(), sortOrder: form.sortOrder },
        });
        toast.push({ message: 'Tipo de elo atualizado', severity: 'success' });
      } else {
        await createEloRole.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          sortOrder: form.sortOrder,
        });
        toast.push({ message: 'Tipo de elo criado', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar tipo de elo.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEloRole.mutateAsync(id);
      toast.push({ message: 'Tipo de elo excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir tipo de elo.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Papéis de Elo</Typography>
        <Button variant="contained" size="small" onClick={openCreate}>
          Novo tipo
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Psicologia, SSO, Jurídico, CPCA, Graduado Master, etc. Estes tipos são usados na matriz de elos e nas tarefas.
      </Typography>
      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhum tipo de elo"
              description="Crie os tipos de elo (Psicologia, SSO, Jurídico, etc.) para usar na matriz de elos e nas tarefas."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ordem</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((role: any) => (
                  <TableRow key={role.id} hover>
                    <TableCell>{role.code}</TableCell>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.sortOrder ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(role)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleteId(role.id)}>
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar tipo de elo' : 'Novo tipo de elo'}</Typography>
          <TextField
            size="small"
            label="Código"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: PSICOLOGIA"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Psicologia"
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Ordem"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            fullWidth
            inputProps={{ min: 0 }}
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={createEloRole.isPending || updateEloRole.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir tipo de elo"
        message="Ao excluir, elos e tarefas que usam este tipo podem ficar sem vínculo. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

const institutionalAreaOptions = [
  { id: 'lideranca', label: 'Liderança' },
  { id: 'acompanhamento_recrutas', label: 'Acompanhamento de Recrutas' },
  { id: 'analise_riscos', label: 'Análise de Riscos' },
] as const;

type InstitutionalAreaId = (typeof institutionalAreaOptions)[number]['id'];

function normalizeHexColor(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(normalized)) return null;
  return normalized.toUpperCase();
}

function InstitutionalMappingTab() {
  const { data: me } = useMe();
  const canManage = can(me, 'missions', 'update');
  const configQuery = useMissionChecklistConfig(canManage);
  const createDimension = useCreateMissionChecklistDimension();
  const updateDimension = useUpdateMissionChecklistDimension();
  const deleteDimension = useDeleteMissionChecklistDimension();
  const updateClassification = useUpdateMissionChecklistClassification();
  const toast = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDimension, setEditingDimension] = useState<any | null>(null);
  const [deleteDimensionId, setDeleteDimensionId] = useState<string | null>(null);
  const [dimensionForm, setDimensionForm] = useState({
    sectionId: 'lideranca' as InstitutionalAreaId,
    title: '',
    prompt: '',
    sortOrder: 0,
  });
  const [classificationDrafts, setClassificationDrafts] = useState<
    Record<string, { label: string; colorHex: string }>
  >({});

  const sections = (configQuery.data?.sections ?? []) as any[];
  const classifications = (configQuery.data?.classifications ?? []) as Array<any>;
  const dimensions = sections.flatMap((section) =>
    (section?.items ?? []).map((item: any, index: number) => ({
      id: String(item?.id ?? ''),
      sectionId: String(section?.id ?? ''),
      sectionTitle: String(section?.title ?? ''),
      title: String(item?.title ?? ''),
      prompt: String(item?.prompt ?? ''),
      sortOrder: Number(item?.sortOrder ?? (index + 1) * 10),
    })),
  );

  const draftById = (classification: any) => {
    const id = String(classification?.id ?? '');
    const existing = classificationDrafts[id];
    if (existing) return existing;
    return {
      label: String(classification?.label ?? ''),
      colorHex:
        normalizeHexColor(classification?.colorHex as string | null | undefined) ??
        '#FFFFFF',
    };
  };

  const setClassificationDraft = (
    id: string,
    patch: Partial<{ label: string; colorHex: string }>,
  ) => {
    setClassificationDrafts((current) => {
      const currentValue = current[id] ?? { label: '', colorHex: '#FFFFFF' };
      return {
        ...current,
        [id]: { ...currentValue, ...patch },
      };
    });
  };

  const isClassificationDirty = (classification: any) => {
    const draft = draftById(classification);
    const currentLabel = String(classification?.label ?? '').trim();
    const currentColor =
      normalizeHexColor(classification?.colorHex as string | null | undefined) ??
      '#FFFFFF';
    return (
      draft.label.trim() !== currentLabel ||
      draft.colorHex.trim().toUpperCase() !== currentColor
    );
  };

  const openCreateDimension = () => {
    setEditingDimension(null);
    setDimensionForm({
      sectionId: 'lideranca',
      title: '',
      prompt: '',
      sortOrder: dimensions.length * 10 + 10,
    });
    setDrawerOpen(true);
  };

  const openEditDimension = (dimension: any) => {
    const area = institutionalAreaOptions.find(
      (option) => option.id === dimension.sectionId,
    )?.id;
    setEditingDimension(dimension);
    setDimensionForm({
      sectionId: area ?? 'lideranca',
      title: dimension.title ?? '',
      prompt: dimension.prompt ?? '',
      sortOrder: Number(dimension.sortOrder ?? 0),
    });
    setDrawerOpen(true);
  };

  const saveDimension = async () => {
    if (!canManage) return;
    if (!dimensionForm.title.trim()) {
      toast.push({
        message: 'Informe o nome da dimensão.',
        severity: 'warning',
      });
      return;
    }
    try {
      if (editingDimension?.id) {
        await updateDimension.mutateAsync({
          id: String(editingDimension.id),
          payload: {
            sectionId: dimensionForm.sectionId,
            title: dimensionForm.title.trim(),
            prompt: dimensionForm.prompt.trim() || undefined,
            sortOrder: Number(dimensionForm.sortOrder) || 0,
          },
        });
        toast.push({ message: 'Dimensão atualizada.', severity: 'success' });
      } else {
        await createDimension.mutateAsync({
          sectionId: dimensionForm.sectionId,
          title: dimensionForm.title.trim(),
          prompt: dimensionForm.prompt.trim() || undefined,
          sortOrder: Number(dimensionForm.sortOrder) || 0,
        });
        toast.push({ message: 'Dimensão criada.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar dimensão.',
        severity: 'error',
      });
    }
  };

  const confirmDeleteDimension = async () => {
    if (!canManage || !deleteDimensionId) return;
    try {
      await deleteDimension.mutateAsync(deleteDimensionId);
      setDeleteDimensionId(null);
      toast.push({ message: 'Dimensão excluída.', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao excluir dimensão.',
        severity: 'error',
      });
    }
  };

  const saveClassification = async (classification: any) => {
    if (!canManage) return;
    const id = String(classification?.id ?? '');
    const draft = draftById(classification);
    if (!draft.label.trim()) {
      toast.push({
        message: 'Informe o nome da classificação.',
        severity: 'warning',
      });
      return;
    }
    try {
      await updateClassification.mutateAsync({
        id: id as any,
        payload: {
          label: draft.label.trim(),
          colorHex:
            draft.colorHex.trim().toUpperCase() === '#FFFFFF'
              ? ''
              : draft.colorHex.trim().toUpperCase(),
        },
      });
      toast.push({ message: 'Classificação atualizada.', severity: 'success' });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? 'Erro ao atualizar classificação.',
        severity: 'error',
      });
    }
  };

  if (!canManage) {
    return (
      <Typography variant="body2" color="text.secondary">
        Acesso restrito. Apenas Coordenação CIPAVD e TI podem alterar o
        mapeamento institucional.
      </Typography>
    );
  }
  if (configQuery.isLoading) return <SkeletonState />;
  if (configQuery.isError) {
    return (
      <ErrorState
        error={configQuery.error}
        onRetry={() => configQuery.refetch()}
      />
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Mapeamento Institucional
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie dimensões por área e personalize as classificações usadas
            no checklist e no SMIF.
          </Typography>
        </Box>
        <Button variant="contained" size="small" onClick={openCreateDimension}>
          Nova dimensão
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          {dimensions.length === 0 ? (
            <EmptyState
              title="Sem dimensões"
              description="Crie a primeira dimensão para usar no checklist."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Área</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Dimensão</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Descrição auxiliar</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Ordem</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dimensions.map((dimension) => (
                  <TableRow key={dimension.id} hover>
                    <TableCell>{dimension.sectionTitle}</TableCell>
                    <TableCell>{dimension.title}</TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {dimension.prompt || 'Sem descrição auxiliar'}
                      </Typography>
                    </TableCell>
                    <TableCell>{dimension.sortOrder}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEditDimension(dimension)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setDeleteDimensionId(dimension.id)}
                      >
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
            Classificações
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Código</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Nome exibido</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Cor</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }} align="right">
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {classifications.map((classification) => {
                const id = String(classification?.id ?? '');
                const draft = draftById(classification);
                return (
                  <TableRow key={id} hover>
                    <TableCell>{id}</TableCell>
                    <TableCell sx={{ minWidth: 320 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={draft.label}
                        onChange={(event) =>
                          setClassificationDraft(id, { label: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          type="color"
                          value={draft.colorHex}
                          onChange={(event) =>
                            setClassificationDraft(id, {
                              colorHex: event.target.value.toUpperCase(),
                            })
                          }
                          sx={{ width: 86 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            setClassificationDraft(id, { colorHex: '#FFFFFF' })
                          }
                        >
                          Sem cor
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => saveClassification(classification)}
                        disabled={
                          !isClassificationDirty(classification) ||
                          updateClassification.isPending
                        }
                      >
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 430 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">
            {editingDimension ? 'Editar dimensão' : 'Nova dimensão'}
          </Typography>
          <TextField
            select
            size="small"
            label="Área"
            value={dimensionForm.sectionId}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                sectionId: event.target.value as InstitutionalAreaId,
              }))
            }
          >
            {institutionalAreaOptions.map((area) => (
              <MenuItem key={area.id} value={area.id}>
                {area.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Nome da dimensão"
            value={dimensionForm.title}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
          <TextField
            size="small"
            label="Descrição auxiliar (opcional)"
            value={dimensionForm.prompt}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                prompt: event.target.value,
              }))
            }
            multiline
            minRows={3}
          />
          <TextField
            size="small"
            type="number"
            label="Ordem"
            value={dimensionForm.sortOrder}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                sortOrder: Number(event.target.value) || 0,
              }))
            }
            inputProps={{ min: 0 }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={saveDimension}
              disabled={createDimension.isPending || updateDimension.isPending}
            >
              Salvar
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteDimensionId)}
        title="Excluir dimensão"
        message="Deseja remover esta dimensão do mapeamento institucional?"
        onConfirm={confirmDeleteDimension}
        onCancel={() => setDeleteDimensionId(null)}
      />
    </Box>
  );
}

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'postos';
  const [currentTab, setCurrentTab] = useState(tabParam);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
    const params = new URLSearchParams(searchParams);
    params.set('tab', newValue);
    setSearchParams(params, { replace: true });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        Administração
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gerencie localidades SMIF, postos, fases, papéis de elo e o mapeamento
        institucional do sistema.
      </Typography>

      <Card>
        <CardContent>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Localidades SMIF" value="localities" />
            <Tab label="Postos" value="postos" />
            <Tab label="Fases" value="phases" />
            <Tab label="Papéis de Elo" value="elo-roles" />
            <Tab label="Mapeamento Institucional" value="institutional-mapping" />
          </Tabs>

          {currentTab === 'localities' && <LocalitiesTab />}
          {currentTab === 'postos' && <PostosTab />}
          {currentTab === 'phases' && <PhasesTab />}
          {currentTab === 'elo-roles' && <EloRolesTab />}
          {currentTab === 'institutional-mapping' && <InstitutionalMappingTab />}
        </CardContent>
      </Card>
    </Box>
  );
}
