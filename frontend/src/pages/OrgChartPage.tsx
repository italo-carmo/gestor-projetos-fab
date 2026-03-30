import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  useAddOrgChartCommissionMember,
  useMe,
  useOrgChartCommissionCandidates,
  useOrgChartCommissionMembers,
  useReorderOrgChartCommissionMembers,
  useRemoveOrgChartCommissionMember,
  useSigpesPhoto,
  useUpdateOrgChartCommissionMember,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { hasAnyRole, ROLE_CIPAVD, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

function CommissionMemberCard({
  member,
  canManage,
  canReorder,
  draggingMemberId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  onRemove,
}: {
  member: any;
  canManage: boolean;
  canReorder: boolean;
  draggingMemberId: string;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const sigpesPhotoQuery = useSigpesPhoto(member?.numeroOrdem);
  const photoDataUrl = String(sigpesPhotoQuery.data?.dataUrl ?? '').trim();
  const displayName = member.warName ?? member.name ?? '—';
  const initials = displayName !== '—' ? displayName.split(/\s+/).slice(0, 2).map((s: string) => s[0]).join('').toUpperCase() : '?';

  return (
    <Card
      variant="outlined"
      draggable={canReorder}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        cursor: canReorder ? 'grab' : 'default',
        opacity: draggingMemberId === String(member.id) ? 0.75 : 1,
      }}
    >
      <CardContent sx={{ py: 1.4, '&:last-child': { pb: 1.4 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          gap={1}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
            {photoDataUrl ? (
              <Tooltip
                title={
                  <Box
                    component="img"
                    src={photoDataUrl}
                    alt=""
                    sx={{
                      display: 'block',
                      maxWidth: 320,
                      maxHeight: 420,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      borderRadius: 1,
                    }}
                  />
                }
                enterDelay={250}
                leaveDelay={150}
                slotProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'background.paper',
                      p: 0.5,
                      boxShadow: 6,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      maxWidth: 'none',
                    },
                  },
                }}
              >
                <Avatar
                  src={photoDataUrl}
                  sx={{
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    cursor: 'zoom-in',
                  }}
                />
              </Tooltip>
            ) : (
              <Avatar
                sx={{ width: 48, height: 48, flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText' }}
              >
                {initials}
              </Avatar>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">{displayName}</Typography>
              <Chip
                size="small"
                label={`Antiguidade ${member.seniority ?? '—'}`}
                sx={{ mt: 0.6, mb: 0.4 }}
                color="primary"
                variant="outlined"
              />
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
          </Stack>
          {canManage && (
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={onEdit}>
                Editar dados
              </Button>
              <Button size="small" color="error" onClick={onRemove}>
                Retirar da comissão
              </Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function OrgChartPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = hasAnyRole(me, [ROLE_CIPAVD, ROLE_COORDENACAO_CIPAVD, ROLE_TI]);

  const commissionMembersQuery = useOrgChartCommissionMembers({});
  const addCommissionMember = useAddOrgChartCommissionMember();
  const removeCommissionMember = useRemoveOrgChartCommissionMember();
  const updateCommissionMember = useUpdateOrgChartCommissionMember();
  const reorderCommissionMembers = useReorderOrgChartCommissionMembers();

  const [commissionDrawerOpen, setCommissionDrawerOpen] = useState(false);
  const [commissionEditOpen, setCommissionEditOpen] = useState(false);
  const [commissionSearch, setCommissionSearch] = useState('');
  const [commissionCandidateSearch, setCommissionCandidateSearch] = useState('');
  const [commissionDeleteTarget, setCommissionDeleteTarget] = useState<any | null>(null);
  const [draggingMemberId, setDraggingMemberId] = useState('');
  const [orderedMembers, setOrderedMembers] = useState<any[]>([]);
  const [commissionEditForm, setCommissionEditForm] = useState({
    userId: '',
    warName: '',
    functionText: '',
    phone: '',
    seniority: '',
  });

  const commissionCandidatesQuery = useOrgChartCommissionCandidates(
    { q: commissionCandidateSearch || undefined },
    commissionDrawerOpen && canManage,
  );

  const commissionMembersRaw = commissionMembersQuery.data?.items as any[] | undefined;
  useEffect(() => {
    if (!commissionMembersRaw) return;
    setOrderedMembers(commissionMembersRaw);
  }, [commissionMembersRaw]);

  if (commissionMembersQuery.isLoading) return <SkeletonState />;
  if (commissionMembersQuery.isError) {
    return <ErrorState error={commissionMembersQuery.error} onRetry={() => commissionMembersQuery.refetch()} />;
  }

  const canReorder = canManage && !commissionSearch.trim();
  const commissionMembers = commissionSearch
    ? orderedMembers.filter((item: any) =>
        [item.warName ?? item.name, item.email, item.ldapUid]
          .map((value: unknown) => String(value ?? '').toLowerCase())
          .some((value) => value.includes(commissionSearch.toLowerCase())),
      )
    : orderedMembers;

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
      seniority:
        member.seniority === null || member.seniority === undefined
          ? ''
          : String(member.seniority),
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
          seniority: commissionEditForm.seniority
            ? Number(commissionEditForm.seniority)
            : null,
        },
      });
      toast.push({ message: 'Dados da comissão atualizados.', severity: 'success' });
      setCommissionEditOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar dados da comissão.', severity: 'error' });
    }
  };

  const applyReorder = async (nextMembers: any[]) => {
    try {
      await reorderCommissionMembers.mutateAsync({
        userIds: nextMembers.map((item: any) => String(item.id)),
      });
      toast.push({ message: 'Ordem de antiguidade atualizada.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao salvar nova ordem de antiguidade.',
        severity: 'error',
      });
      void commissionMembersQuery.refetch();
    }
  };

  const moveMember = (targetId: string) => {
    if (!canReorder || !draggingMemberId || draggingMemberId === targetId) return;
    const fromIndex = orderedMembers.findIndex((item: any) => item.id === draggingMemberId);
    const toIndex = orderedMembers.findIndex((item: any) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const next = [...orderedMembers];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedMembers(next);
    setDraggingMemberId('');
    void applyReorder(next);
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
              <Typography variant="caption" color="text.secondary">
                A ordem de antiguidade é do menor para o maior número.
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
          {canManage && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {canReorder
                ? 'Arraste os cards para reordenar a antiguidade.'
                : 'Limpe a busca para habilitar o arraste e reordenar a antiguidade.'}
            </Typography>
          )}

          {commissionMembers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum membro da comissão encontrado.
            </Typography>
          ) : (
            <Stack spacing={1.2}>
              {commissionMembers.map((member: any) => (
                <CommissionMemberCard
                  key={member.id}
                  member={member}
                  canManage={canManage}
                  canReorder={canReorder}
                  draggingMemberId={draggingMemberId}
                  onDragStart={() => setDraggingMemberId(String(member.id))}
                  onDragOver={(e) => {
                    if (!canReorder) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    moveMember(String(member.id));
                  }}
                  onDragEnd={() => setDraggingMemberId('')}
                  onEdit={() => openEditCommissionMember(member)}
                  onRemove={() => setCommissionDeleteTarget(member)}
                />
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
          <TextField
            size="small"
            type="number"
            label="Antiguidade"
            placeholder="Ex: 1"
            value={commissionEditForm.seniority}
            onChange={(e) =>
              setCommissionEditForm((prev) => ({
                ...prev,
                seniority: e.target.value.replace(/\D/g, ''),
              }))
            }
            inputProps={{ min: 1 }}
            helperText="Ordem no organograma: 1 = mais antigo."
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" color="error" onClick={() => setCommissionEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
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
