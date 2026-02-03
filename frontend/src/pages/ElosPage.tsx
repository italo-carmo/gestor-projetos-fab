import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCreateElo, useDeleteElo, useElos, useLocalities, useUpdateElo, useMe } from '../api/hooks';
import { FiltersBar } from '../components/filters/FiltersBar';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { EloRoleType } from '../constants/enums';

export function ElosPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { data: me } = useMe();
  const localityId = params.get('localityId') ?? '';
  const roleType = params.get('roleType') ?? '';

  const filters = useMemo(
    () => ({
      localityId: localityId || undefined,
      roleType: roleType || undefined,
    }),
    [localityId, roleType],
  );

  const elosQuery = useElos(filters);
  const localitiesQuery = useLocalities();
  const createElo = useCreateElo();
  const updateElo = useUpdateElo();
  const deleteElo = useDeleteElo();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    localityId: '',
    roleType: 'PSICOLOGIA',
    name: '',
    rank: '',
    phone: '',
    email: '',
    om: '',
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams({});

  const openCreate = () => {
    setEditing(null);
    setForm({
      localityId: '',
      roleType: 'PSICOLOGIA',
      name: '',
      rank: '',
      phone: '',
      email: '',
      om: '',
    });
    setDrawerOpen(true);
  };

  const openEdit = (elo: any) => {
    setEditing(elo);
    setForm({
      localityId: elo.localityId,
      roleType: elo.roleType,
      name: elo.name ?? '',
      rank: elo.rank ?? '',
      phone: elo.phone ?? '',
      email: elo.email ?? '',
      om: elo.om ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        localityId: form.localityId,
        roleType: form.roleType,
        name: form.name,
        rank: form.rank || null,
        phone: form.phone || null,
        email: form.email || null,
        om: form.om || null,
      };
      if (editing) {
        await updateElo.mutateAsync({ id: editing.id, payload });
        toast.push({ message: 'Elo atualizado', severity: 'success' });
      } else {
        await createElo.mutateAsync(payload);
        toast.push({ message: 'Elo criado', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao salvar elo', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteElo.mutateAsync(id);
      toast.push({ message: 'Elo removido', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao remover elo', severity: 'error' });
    }
  };

  if (elosQuery.isLoading) return <SkeletonState />;
  if (elosQuery.isError) return <ErrorState error={elosQuery.error} onRetry={() => elosQuery.refetch()} />;

  const canCreate = can(me, 'elos', 'create');
  const canUpdate = can(me, 'elos', 'update');
  const canDelete = can(me, 'elos', 'delete');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Elos</Typography>
        {canCreate && (
          <Button variant="contained" onClick={openCreate}>
            Novo elo
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FiltersBar
            localityId={localityId}
            onLocalityChange={(value) => updateParam('localityId', value)}
            localities={(localitiesQuery.data?.items ?? []).map((l: any) => ({ id: l.id, name: l.name }))}
            onClear={clearFilters}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2}>
            <TextField
              select
              size="small"
              label="Role"
              value={roleType}
              onChange={(e) => updateParam('roleType', e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {EloRoleType.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {(elosQuery.data?.items ?? []).length === 0 && (
        <EmptyState title="Nenhum elo cadastrado" description="Cadastre os contatos das localidades." />
      )}

      {(elosQuery.data?.items ?? []).length > 0 && (
        <Card>
          <CardContent>
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Localidade', 'Role', 'Nome', 'OM', 'Telefone', 'Email', 'Ações'].map((header) => (
                    <Box key={header} component="th" sx={{ textAlign: 'left', pb: 1 }}>
                      {header}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {(elosQuery.data?.items ?? []).map((elo: any) => (
                  <Box key={elo.id} component="tr" sx={{ borderTop: '1px solid #E6ECF5' }}>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.locality?.name ?? elo.localityId}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.roleType}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.name}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.om ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.phone ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.email ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {canUpdate && (
                        <Button size="small" onClick={() => openEdit(elo)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="small" color="error" onClick={() => handleDelete(elo.id)}>
                          Excluir
                        </Button>
                      )}
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
          <Typography variant="h5">{editing ? 'Editar elo' : 'Novo elo'}</Typography>
          <TextField
            select
            size="small"
            label="Localidade"
            value={form.localityId}
            onChange={(e) => setForm({ ...form, localityId: e.target.value })}
          >
            {(localitiesQuery.data?.items ?? []).map((l: any) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Role"
            value={form.roleType}
            onChange={(e) => setForm({ ...form, roleType: e.target.value })}
          >
            {EloRoleType.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField size="small" label="Posto/Grad" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
          <TextField size="small" label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField size="small" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField size="small" label="OM" value={form.om} onChange={(e) => setForm({ ...form, om: e.target.value })} />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSave}>
              Salvar
            </Button>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}

