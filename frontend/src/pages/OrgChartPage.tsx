import { Box, Button, Card, CardContent, Drawer, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import {
  useAddOrgChartCommissionMember,
  useMe,
  useOrgChartCommissionCandidates,
  useOrgChartCommissionMembers,
  useRemoveOrgChartCommissionMember,
  useUpdateOrgChartCommissionMember,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

export function OrgChartPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]);

  const commissionMembersQuery = useOrgChartCommissionMembers({});
  const addCommissionMember = useAddOrgChartCommissionMember();
  const removeCommissionMember = useRemoveOrgChartCommissionMember();
  const updateCommissionMember = useUpdateOrgChartCommissionMember();

  const [commissionDrawerOpen, setCommissionDrawerOpen] = useState(false);
  const [commissionEditOpen, setCommissionEditOpen] = useState(false);
  const [commissionSearch, setCommissionSearch] = useState('');
  const [commissionCandidateSearch, setCommissionCandidateSearch] = useState('');
  const [commissionDeleteTarget, setCommissionDeleteTarget] = useState<any | null>(null);
  const [commissionEditForm, setCommissionEditForm] = useState({
    userId: '',
    warName: '',
    functionText: '',
    phone: '',
  });

  const commissionCandidatesQuery = useOrgChartCommissionCandidates(
    { q: commissionCandidateSearch || undefined },
    commissionDrawerOpen && canManage,
  );

  if (commissionMembersQuery.isLoading) return <SkeletonState />;
  if (commissionMembersQuery.isError) {
    return <ErrorState error={commissionMembersQuery.error} onRetry={() => commissionMembersQuery.refetch()} />;
  }

  const commissionMembersRaw = (commissionMembersQuery.data?.items ?? []) as any[];
  const commissionMembers = commissionSearch
    ? commissionMembersRaw.filter((item: any) =>
        [item.warName ?? item.name, item.email, item.ldapUid]
          .map((value: unknown) => String(value ?? '').toLowerCase())
          .some((value) => value.includes(commissionSearch.toLowerCase())),
      )
    : commissionMembersRaw;

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

  const formatCommissionPhone = (value: string) => {
    const digits = String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const openEditCommissionMember = (member: any) => {
    setCommissionEditForm({
      userId: String(member.id ?? ''),
      warName: String(member.warName ?? member.name ?? ''),
      functionText: String(member.functionText ?? ''),
      phone: String(member.phone ?? ''),
    });
    setCommissionEditOpen(true);
  };

  const handleSaveCommissionMember = async () => {
    if (!commissionEditForm.userId) return;
    try {
      await updateCommissionMember.mutateAsync({
        userId: commissionEditForm.userId,
        payload: {
          functionText: commissionEditForm.functionText.trim() || null,
          phone: commissionEditForm.phone.trim() || null,
        },
      });
      toast.push({ message: 'Dados da comissão atualizados.', severity: 'success' });
      setCommissionEditOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar dados da comissão.', severity: 'error' });
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
              <Typography variant="h6">Comissão CIPAVD</Typography>
              <Typography variant="body2" color="text.secondary">
                Nesta tela ficam apenas os integrantes da Comissão CIPAVD.
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

          {commissionMembers.length === 0 ? (
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
                        {member.functionText && (
                          <Typography variant="body2" color="text.secondary">
                            Função: {member.functionText}
                          </Typography>
                        )}
                        {member.phone && (
                          <Typography variant="body2" color="text.secondary">
                            Telefone: {member.phone}
                          </Typography>
                        )}
                      </Box>
                      {canManage && (
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => openEditCommissionMember(member)}>
                            Editar dados
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setCommissionDeleteTarget(member)}
                          >
                            Retirar da comissão
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={commissionEditOpen}
        onClose={() => setCommissionEditOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 420 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={1.5}>
          <Typography variant="h6">Editar dados do membro da comissão</Typography>
          <Typography variant="body2" color="text.secondary">
            Nome de guerra: {commissionEditForm.warName || '—'}
          </Typography>
          <TextField
            size="small"
            label="Função"
            placeholder="Ex: Presidente da Comissão"
            value={commissionEditForm.functionText}
            onChange={(e) =>
              setCommissionEditForm((prev) => ({
                ...prev,
                functionText: e.target.value,
              }))
            }
          />
          <TextField
            size="small"
            label="Telefone"
            placeholder="(00) 00000-0000"
            value={commissionEditForm.phone}
            onChange={(e) =>
              setCommissionEditForm((prev) => ({
                ...prev,
                phone: formatCommissionPhone(e.target.value),
              }))
            }
            inputProps={{ maxLength: 15 }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="text" onClick={() => setCommissionEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleSaveCommissionMember();
              }}
              disabled={updateCommissionMember.isPending}
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
