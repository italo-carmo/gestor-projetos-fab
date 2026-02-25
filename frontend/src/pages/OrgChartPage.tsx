import { Box, Button, Card, CardContent, Chip, Drawer, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddOrgChartCommissionMember,
  useCreateOrgChartAssignment,
  useDeleteOrgChartAssignment,
  useEloRoles,
  useMe,
  useOrgChartCommissionCandidates,
  useOrgChartCommissionMembers,
  useOrgChart,
  useOrgChartCandidates,
  useRemoveOrgChartCommissionMember,
  useUpdateOrgChartAssignment,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

export function OrgChartPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]);
  const eloRolesQuery = useEloRoles();
  const createAssignment = useCreateOrgChartAssignment();
  const updateAssignment = useUpdateOrgChartAssignment();
  const deleteAssignment = useDeleteOrgChartAssignment();
  const commissionMembersQuery = useOrgChartCommissionMembers({});
  const addCommissionMember = useAddOrgChartCommissionMember();
  const removeCommissionMember = useRemoveOrgChartCommissionMember();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commissionDrawerOpen, setCommissionDrawerOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [commissionSearch, setCommissionSearch] = useState('');
  const [commissionCandidateSearch, setCommissionCandidateSearch] = useState('');
  const [commissionDeleteTarget, setCommissionDeleteTarget] = useState<any | null>(null);
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
  const commissionCandidatesQuery = useOrgChartCommissionCandidates(
    {
      q: commissionCandidateSearch || undefined,
    },
    commissionDrawerOpen && canManage,
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
  const commissionMembersRaw = (commissionMembersQuery.data?.items ?? []) as any[];
  const commissionMembers = commissionSearch
    ? commissionMembersRaw.filter((item: any) =>
        [item.warName ?? item.name, item.email, item.ldapUid]
          .map((value: unknown) => String(value ?? '').toLowerCase())
          .some((value) => value.includes(commissionSearch.toLowerCase())),
      )
    : commissionMembersRaw;
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

  const handleAddCommissionMember = async (userId: string) => {
    if (!userId) return;
    try {
      await addCommissionMember.mutateAsync({ userId });
      toast.push({ message: 'Usuário incluído na Comissão CIPAVD.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao incluir usuário na comissão.', severity: 'error' });
    }
  };

  const handleConfirmRemoveCommissionMember = async () => {
    if (!commissionDeleteTarget?.id) return;
    try {
      await removeCommissionMember.mutateAsync(String(commissionDeleteTarget.id));
      toast.push({ message: 'Usuário removido da Comissão CIPAVD.', severity: 'success' });
      setCommissionDeleteTarget(null);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao remover usuário da comissão.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Organograma
      </Typography>

      <Card sx={{ mb: 2.2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
            <Box>
              <Typography variant="h6">Organograma da Comissão CIPAVD</Typography>
              <Typography variant="body2" color="text.secondary">
                Integrantes com o papel de Coordenação CIPAVD.
              </Typography>
            </Box>
            {canManage && (
              <Button size="small" variant="outlined" onClick={() => setCommissionDrawerOpen(true)}>
                Incluir usuário
              </Button>
            )}
          </Stack>

          <TextField
            size="small"
            label="Buscar na comissão"
            value={commissionSearch}
            onChange={(e) => setCommissionSearch(e.target.value)}
            sx={{ mb: 1.5, minWidth: 280 }}
          />

          {commissionMembersQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Carregando membros da comissão...
            </Typography>
          ) : commissionMembersQuery.isError ? (
            <Typography variant="body2" color="error.main">
              Não foi possível carregar os membros da comissão.
            </Typography>
          ) : commissionMembers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum membro da comissão encontrado.
            </Typography>
          ) : (
            <Stack spacing={1.2}>
              {commissionMembers.map((member: any) => (
                <Card key={member.id} variant="outlined">
                  <CardContent sx={{ py: 1.4, '&:last-child': { pb: 1.4 } }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      gap={1}
                    >
                      <Box>
                        <Typography variant="subtitle2">{member.warName ?? member.name ?? '—'}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {member.email ?? 'Sem e-mail'}
                        </Typography>
                        {member.ldapUid && (
                          <Typography variant="caption" color="text.secondary">
                            UID FAB: {member.ldapUid}
                          </Typography>
                        )}
                      </Box>
                      {canManage && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setCommissionDeleteTarget(member)}
                        >
                          Retirar da comissão
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

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

      <Drawer
        anchor="right"
        open={commissionDrawerOpen}
        onClose={() => setCommissionDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 480 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={1.5}>
          <Typography variant="h6">Incluir na Comissão CIPAVD</Typography>
          <Typography variant="body2" color="text.secondary">
            Selecionar um usuário abaixo atribui o papel de Coordenação CIPAVD.
          </Typography>

          <TextField
            size="small"
            label="Buscar usuário por nome/e-mail/UID"
            value={commissionCandidateSearch}
            onChange={(e) => setCommissionCandidateSearch(e.target.value)}
          />

          <Box sx={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', pr: 0.5 }}>
            <Stack spacing={1}>
              {(commissionCandidatesQuery.data?.items ?? []).map((candidate: any) => (
                <Card key={candidate.id} variant="outlined">
                  <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap title={candidate.name}>
                          {candidate.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap title={candidate.email}>
                          {candidate.email}
                        </Typography>
                        {candidate.ldapUid && (
                          <Typography variant="caption" color="text.secondary">
                            UID FAB: {candidate.ldapUid}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          void handleAddCommissionMember(candidate.id);
                        }}
                        disabled={addCommissionMember.isPending}
                      >
                        Incluir
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {commissionCandidatesQuery.isLoading && (
                <Typography variant="body2" color="text.secondary">
                  Carregando candidatos...
                </Typography>
              )}
              {!commissionCandidatesQuery.isLoading && (commissionCandidatesQuery.data?.items ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nenhum candidato encontrado.
                </Typography>
              )}
            </Stack>
          </Box>

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="text" onClick={() => setCommissionDrawerOpen(false)}>
              Fechar
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(commissionDeleteTarget)}
        onCancel={() => setCommissionDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmRemoveCommissionMember();
        }}
        title="Retirar da Comissão CIPAVD"
        message="Deseja retirar este usuário da Comissão CIPAVD?"
        highlightText={commissionDeleteTarget?.warName ?? commissionDeleteTarget?.name ?? ''}
        note="A remoção do papel é aplicada imediatamente."
        confirmLabel="Retirar da comissão"
        severity="error"
        confirmLoading={removeCommissionMember.isPending}
      />
    </Box>
  );
}
