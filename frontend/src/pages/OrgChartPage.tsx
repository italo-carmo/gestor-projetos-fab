import { Box, Button, Card, CardContent, Chip, Drawer, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateOrgChartAssignment,
  useDeleteOrgChartAssignment,
  useEloRoles,
  useMe,
  useOrgChart,
  useOrgChartCandidates,
  useUpdateOrgChartAssignment,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { isNationalCommissionMember } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

export function OrgChartPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = isNationalCommissionMember(me);
  const eloRolesQuery = useEloRoles();
  const createAssignment = useCreateOrgChartAssignment();
  const updateAssignment = useUpdateOrgChartAssignment();
  const deleteAssignment = useDeleteOrgChartAssignment();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [form, setForm] = useState<{
    id: string;
    localityId: string;
    eloRoleId: string;
    userId: string;
    rank: string;
    phone: string;
    om: string;
    autoFromUser: boolean;
  }>({
    id: '',
    localityId: '',
    eloRoleId: '',
    userId: '',
    rank: '',
    phone: '',
    om: '',
    autoFromUser: false,
  });

  const filters = useMemo(
    () => ({
      q: search || undefined,
    }),
    [search],
  );

  const orgQuery = useOrgChart(filters);
  const candidatesQuery = useOrgChartCandidates(
    {
      localityId: form.localityId || undefined,
      eloRoleId: form.eloRoleId || undefined,
      q: candidateSearch || undefined,
    },
    drawerOpen && canManage && Boolean(form.localityId && form.eloRoleId),
  );

  const updateParam = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next);
  };

  if (orgQuery.isLoading) return <SkeletonState />;
  if (orgQuery.isError) return <ErrorState error={orgQuery.error} onRetry={() => orgQuery.refetch()} />;

  const items = orgQuery.data?.items ?? [];
  const eloRoles = eloRolesQuery.data?.items ?? [];
  const localityOptions: Array<{ id: string; name: string }> = Array.from(
    new Map<string, { id: string; name: string }>(
      items.map((group: any) => {
        const id = String(group.localityId ?? group.localityName ?? '');
        return [
          id,
          {
            id,
            name: String(group.localityName ?? id),
          },
        ];
      }),
    ).values(),
  );
  const filtered = search
    ? items.map((group: any) => ({
        ...group,
        elos: group.elos.filter((elo: any) =>
          [elo.name, elo.om, elo.eloRole?.name, elo.eloRole?.code].some((value: string) =>
            value?.toLowerCase().includes(search.toLowerCase()),
          ),
        ),
      })).filter((group: any) => group.elos.length > 0)
    : items;

  const openCreate = (group: any) => {
    setCandidateSearch('');
    setForm({
      id: '',
      localityId: group.localityId ?? '',
      eloRoleId: eloRoles[0]?.id ?? '',
      userId: '',
      rank: '',
      phone: '',
      om: '',
      autoFromUser: false,
    });
    setDrawerOpen(true);
  };

  const openEdit = (group: any, elo: any) => {
    setCandidateSearch('');
    setForm({
      id: elo.id ?? '',
      localityId: elo.localityId ?? group.localityId ?? '',
      eloRoleId: elo.eloRoleId ?? elo.eloRole?.id ?? '',
      userId: elo.systemUser?.id ?? '',
      rank: elo.rank ?? '',
      phone: elo.phone ?? '',
      om: elo.om ?? '',
      autoFromUser: Boolean(elo.autoFromUser),
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.localityId || !form.eloRoleId || !form.userId) {
      toast.push({ message: 'Selecione localidade, função e usuário.', severity: 'warning' });
      return;
    }

    const payload = {
      localityId: form.localityId,
      eloRoleId: form.eloRoleId,
      userId: form.userId,
      rank: form.rank || null,
      phone: form.phone || null,
      om: form.om || null,
    };

    try {
      if (!form.id || form.autoFromUser || form.id.startsWith('auto-user-')) {
        await createAssignment.mutateAsync(payload);
        toast.push({ message: 'Vínculo criado no organograma.', severity: 'success' });
      } else {
        await updateAssignment.mutateAsync({ id: form.id, payload });
        toast.push({ message: 'Organograma atualizado.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao salvar vínculo.', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!form.id || form.id.startsWith('auto-user-')) return;
    try {
      await deleteAssignment.mutateAsync(form.id);
      toast.push({ message: 'Vínculo removido do organograma.', severity: 'success' });
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao remover vínculo.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Organograma
      </Typography>

      <TextField
        size="small"
        label="Buscar por nome/OM"
        value={search}
        onChange={(e) => updateParam(e.target.value)}
        sx={{ mb: 2, minWidth: 260 }}
      />

      {filtered.length === 0 && (
        <EmptyState title="Nenhum contato encontrado" description="Ajuste a busca ou filtros." />
      )}

      <Stack spacing={2}>
        {filtered.map((group: any) => (
          <Card key={group.localityName}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6">{group.localityName}</Typography>
                {canManage && (
                  <Button size="small" variant="outlined" onClick={() => openCreate(group)}>
                    Vincular usuário
                  </Button>
                )}
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
                {group.elos.map((elo: any) => (
                    <Card key={elo.id} variant="outlined" sx={{ minWidth: 220 }}>
                      <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2">{elo.name ?? 'Contato'}</Typography>
                        {elo.autoFromUser && (
                          <Chip size="small" label="Auto" color="info" variant="outlined" />
                        )}
                      </Stack>
                      <Chip size="small" label={elo.eloRole?.name ?? elo.eloRole?.code ?? '—'} sx={{ mt: 1 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {elo.om ?? '-'}
                      </Typography>
                      {elo.phone && (
                        <Typography variant="body2" color="text.secondary">
                          {elo.phone}
                        </Typography>
                      )}
                      {elo.email && (
                        <Typography variant="body2" color="text.secondary">
                          {elo.email}
                        </Typography>
                      )}
                      {canManage && (
                        <Button
                          size="small"
                          variant="text"
                          sx={{ mt: 1 }}
                          onClick={() => openEdit(group, elo)}
                        >
                          {elo.autoFromUser ? 'Adicionar ao organograma' : 'Editar vínculo'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 440 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">
            {form.id && !form.autoFromUser ? 'Editar vínculo do organograma' : 'Novo vínculo do organograma'}
          </Typography>

          <TextField
            select
            size="small"
            label="Localidade"
            value={form.localityId}
            onChange={(e) => setForm((prev) => ({ ...prev, localityId: e.target.value }))}
          >
            {localityOptions.map((loc) => (
              <MenuItem key={loc.id} value={loc.id}>
                {loc.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Função"
            value={form.eloRoleId}
            onChange={(e) => setForm((prev) => ({ ...prev, eloRoleId: e.target.value }))}
          >
            {eloRoles.map((role: any) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name} ({role.code})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Buscar usuário"
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
          />

          <TextField
            select
            size="small"
            label="Usuário do sistema"
            value={form.userId}
            onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
            helperText="Somente usuários com função/localidade compatíveis."
          >
            {(candidatesQuery.data?.items ?? []).map((item: any) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name} - {item.email}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Posto/Graduação"
            value={form.rank}
            onChange={(e) => setForm((prev) => ({ ...prev, rank: e.target.value }))}
          />
          <TextField
            size="small"
            label="Telefone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <TextField
            size="small"
            label="OM"
            value={form.om}
            onChange={(e) => setForm((prev) => ({ ...prev, om: e.target.value }))}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {form.id && !form.id.startsWith('auto-user-') && (
              <Button color="error" onClick={handleDelete} disabled={deleteAssignment.isPending}>
                Remover
              </Button>
            )}
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={createAssignment.isPending || updateAssignment.isPending}
            >
              Salvar
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
