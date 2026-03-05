import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
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
  useDeletePosto,
  usePostos,
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

  const items = selectTargetLocalities((localitiesQuery.data?.items ?? []) as any[])
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
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocality.mutateAsync(id);
      toast.push({ message: 'Localidade excluída.', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message, severity: 'error' });
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
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosto.mutateAsync(id);
      toast.push({ message: 'Posto excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message, severity: 'error' });
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
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEloRole.mutateAsync(id);
      toast.push({ message: 'Tipo de elo excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message, severity: 'error' });
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
        Gerencie localidades SMIF, postos, fases e papéis de elo do sistema.
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
          </Tabs>

          {currentTab === 'localities' && <LocalitiesTab />}
          {currentTab === 'postos' && <PostosTab />}
          {currentTab === 'phases' && <PhasesTab />}
          {currentTab === 'elo-roles' && <EloRolesTab />}
        </CardContent>
      </Card>
    </Box>
  );
}
