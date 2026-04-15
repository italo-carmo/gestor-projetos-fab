import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import { useEffect, useMemo, useState } from 'react';
import {
  useAddCpcaCommissionMember,
  useAssignCpcaPresident,
  useCpcaCommissionOverview,
  useMe,
  useMyFabProfile,
  useOmsCatalog,
  useRemoveCpcaCommissionMember,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

type OmsCatalogItem = {
  id: string;
  code: string;
  name: string;
  hasCpca?: boolean;
};

type CommissionMemberItem = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    ldapUid?: string | null;
  };
  addedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

function extractReason(error: unknown) {
  const responseData = (error as { response?: { data?: { details?: { reason?: string } } } })
    ?.response?.data;
  return String(responseData?.details?.reason ?? '').trim();
}

export function CpcaCommissionPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const fabProfileQuery = useMyFabProfile();
  const isApprover = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);
  const omsCatalogQuery = useOmsCatalog(isApprover);

  const cpcaLocalities = useMemo(
    () =>
      ((omsCatalogQuery.data?.items ?? []) as OmsCatalogItem[])
        .filter((item) => Boolean(item.hasCpca))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [omsCatalogQuery.data?.items],
  );

  const [selectedLocalityId, setSelectedLocalityId] = useState('');
  const [presidentIdentifier, setPresidentIdentifier] = useState('');
  const [presidentBulletin, setPresidentBulletin] = useState('');
  const [presidentIsSubstitution, setPresidentIsSubstitution] = useState(true);
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [pendingPresidentOverwrite, setPendingPresidentOverwrite] = useState<{
    identifier: string;
    localityId: string;
    isSubstitution: boolean;
    designationBulletin: string;
  } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<CommissionMemberItem | null>(null);

  useEffect(() => {
    if (isApprover) {
      if (
        selectedLocalityId &&
        cpcaLocalities.some((item) => item.id === selectedLocalityId)
      ) {
        return;
      }

      const ownLocalityId = String(me?.localityId ?? '').trim();
      if (
        ownLocalityId &&
        cpcaLocalities.some((item) => item.id === ownLocalityId)
      ) {
        setSelectedLocalityId(ownLocalityId);
        return;
      }

      if (cpcaLocalities.length > 0) {
        setSelectedLocalityId(cpcaLocalities[0].id);
      }
      return;
    }

    const ownLocalityId = String(me?.localityId ?? '').trim();
    if (ownLocalityId) {
      setSelectedLocalityId(ownLocalityId);
    }
  }, [cpcaLocalities, isApprover, me?.localityId, selectedLocalityId]);

  const overviewQuery = useCpcaCommissionOverview(
    isApprover ? selectedLocalityId : undefined,
    Boolean(me?.id),
  );

  const assignPresidentMutation = useAssignCpcaPresident();
  const addMemberMutation = useAddCpcaCommissionMember();
  const removeMemberMutation = useRemoveCpcaCommissionMember();

  const canManageMembers = Boolean(overviewQuery.data?.canManageMembers);
  const canAssignPresident = Boolean(overviewQuery.data?.canAssignPresident);
  const currentPresident = overviewQuery.data?.currentPresident as
    | {
        id: string;
        designationBulletin?: string | null;
        isSubstitution: boolean;
        assignedAt: string;
        user: { id: string; name: string; email: string; ldapUid?: string | null };
        assignedByUser?: { id: string; name: string; email: string } | null;
      }
    | null
    | undefined;
  const members = (overviewQuery.data?.members ?? []) as CommissionMemberItem[];
  const locality = overviewQuery.data?.locality as
    | { id: string; code: string; name: string }
    | null
    | undefined;

  const selectedLocalityCode =
    locality?.code ??
    cpcaLocalities.find((item) => item.id === selectedLocalityId)?.code ??
    null;
  const selectedLocalityName =
    locality?.name ??
    cpcaLocalities.find((item) => item.id === selectedLocalityId)?.name ??
    null;
  const selectedLocalityLabel =
    selectedLocalityCode && selectedLocalityName
      ? `${selectedLocalityCode} - ${selectedLocalityName}`
      : selectedLocalityName ?? '';
  const ldapFabom = String(fabProfileQuery.data?.fabom ?? '').trim();
  const nonApproverOmLabel = ldapFabom
    ? selectedLocalityLabel &&
      selectedLocalityLabel.toLowerCase() !== ldapFabom.toLowerCase()
      ? `${ldapFabom} (${selectedLocalityLabel})`
      : ldapFabom
    : selectedLocalityLabel;

  const handleAssignPresident = async (args: {
    identifier: string;
    localityId: string;
    isSubstitution: boolean;
    designationBulletin: string;
    proceedWithExistingPresident?: boolean;
  }) => {
    try {
      await assignPresidentMutation.mutateAsync(args);
      toast.push({
        message: 'Presidente CPCA designado com sucesso.',
        severity: 'success',
      });
      setPresidentIdentifier('');
      setPresidentBulletin('');
      setPendingPresidentOverwrite(null);
    } catch (error) {
      const reason = extractReason(error);
      if (
        reason === 'CPCA_LOCALITY_ALREADY_HAS_PRESIDENT' &&
        !args.proceedWithExistingPresident
      ) {
        setPendingPresidentOverwrite({
          identifier: args.identifier,
          localityId: args.localityId,
          isSubstitution: args.isSubstitution,
          designationBulletin: args.designationBulletin,
        });
        return;
      }
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao designar presidente.',
        severity: 'error',
      });
    }
  };

  const handleAddMember = async () => {
    const identifier = memberIdentifier.trim();
    if (!identifier) {
      toast.push({
        message: 'Informe e-mail ou CPF para adicionar membro.',
        severity: 'warning',
      });
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        identifier,
        localityId: isApprover ? selectedLocalityId : undefined,
      });
      toast.push({
        message: 'Membro adicionado à comissão CPCA.',
        severity: 'success',
      });
      setMemberIdentifier('');
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao adicionar membro.',
        severity: 'error',
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync(memberToRemove.id);
      toast.push({
        message: 'Membro removido da comissão.',
        severity: 'success',
      });
      setMemberToRemove(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao remover membro.',
        severity: 'error',
      });
    }
  };

  if (overviewQuery.isLoading || (isApprover && omsCatalogQuery.isLoading)) {
    return <SkeletonState />;
  }
  if (overviewQuery.isError) {
    return <ErrorState error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />;
  }
  if (isApprover && omsCatalogQuery.isError) {
    return <ErrorState error={omsCatalogQuery.error} onRetry={() => omsCatalogQuery.refetch()} />;
  }
  if (!locality) {
    return (
      <EmptyState
        title="Nenhuma OM com CPCA habilitado"
        description="Ative 'Possui CPCA = Sim' em Administração > OMs para liberar o fluxo de comissão."
      />
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Box>
                <Typography variant="h4" fontWeight={800}>
                  Comissão CPCA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestão de presidente e membros da comissão por OM.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  icon={<WorkspacePremiumRoundedIcon />}
                  label={`Presidente: ${currentPresident?.user?.name ?? 'Não designado'}`}
                  color={currentPresident ? 'primary' : 'default'}
                  variant={currentPresident ? 'filled' : 'outlined'}
                />
                <Chip
                  icon={<GroupRoundedIcon />}
                  label={`Membros: ${members.length}`}
                  color="default"
                  variant="outlined"
                />
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ mt: 2 }}>
              {isApprover ? (
                <TextField
                  select
                  label="OM"
                  size="small"
                  value={selectedLocalityId}
                  onChange={(event) => setSelectedLocalityId(event.target.value)}
                  sx={{ minWidth: 320 }}
                >
                  {cpcaLocalities.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  size="small"
                  label="OM"
                  value={nonApproverOmLabel}
                  InputProps={{ readOnly: true }}
                  sx={{ minWidth: 320 }}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        {canAssignPresident ? (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>
                Designar Presidente CPCA
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Cadastro via LDAP por e-mail/CPF, com concessão automática da permissão CPCA na OM.
              </Typography>

              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
                <TextField
                  size="small"
                  label="E-mail ou CPF"
                  value={presidentIdentifier}
                  onChange={(event) => setPresidentIdentifier(event.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Boletim de designação"
                  value={presidentBulletin}
                  onChange={(event) => setPresidentBulletin(event.target.value)}
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  label="Substituição"
                  value={presidentIsSubstitution ? 'SIM' : 'NAO'}
                  onChange={(event) =>
                    setPresidentIsSubstitution(event.target.value === 'SIM')
                  }
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="SIM">Sim</MenuItem>
                  <MenuItem value="NAO">Não</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  startIcon={<PersonSearchRoundedIcon />}
                  disabled={
                    !selectedLocalityId ||
                    !presidentIdentifier.trim() ||
                    !presidentBulletin.trim() ||
                    assignPresidentMutation.isPending
                  }
                  onClick={() =>
                    handleAssignPresident({
                      identifier: presidentIdentifier,
                      localityId: selectedLocalityId,
                      isSubstitution: presidentIsSubstitution,
                      designationBulletin: presidentBulletin,
                    })
                  }
                >
                  {assignPresidentMutation.isPending
                    ? 'Salvando...'
                    : 'Designar'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>
              Membros da Comissão
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {canManageMembers
                ? 'Cadastre membros por LDAP (e-mail ou CPF).'
                : 'Somente o presidente da comissão (ou TI/COMGEP) pode cadastrar/remover membros.'}
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.5 }}>
              <TextField
                size="small"
                label="E-mail ou CPF"
                value={memberIdentifier}
                onChange={(event) => setMemberIdentifier(event.target.value)}
                fullWidth
                disabled={!canManageMembers || addMemberMutation.isPending}
              />
              <Button
                variant="contained"
                disabled={
                  !canManageMembers ||
                  !memberIdentifier.trim() ||
                  addMemberMutation.isPending
                }
                onClick={handleAddMember}
              >
                {addMemberMutation.isPending ? 'Adicionando...' : 'Adicionar membro'}
              </Button>
            </Stack>

            {members.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum membro cadastrado nesta OM.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Militar</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>UID</TableCell>
                    <TableCell>Cadastrado por</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.user.name}</TableCell>
                      <TableCell>{member.user.email}</TableCell>
                      <TableCell>{member.user.ldapUid ?? '-'}</TableCell>
                      <TableCell>{member.addedByUser?.name ?? '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          size="small"
                          disabled={!canManageMembers || removeMemberMutation.isPending}
                          onClick={() => setMemberToRemove(member)}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Stack>

      <ConfirmDialog
        open={Boolean(pendingPresidentOverwrite)}
        title="Substituir presidente atual?"
        message="Já existe presidente registrado nesta OM. Confirma ciência e deseja prosseguir com a alteração?"
        highlightText={currentPresident?.user?.name ?? 'Presidente atual já registrado'}
        severity="warning"
        confirmLabel="Prosseguir"
        confirmLoading={assignPresidentMutation.isPending}
        onCancel={() => setPendingPresidentOverwrite(null)}
        onConfirm={() => {
          if (!pendingPresidentOverwrite) return;
          void handleAssignPresident({
            ...pendingPresidentOverwrite,
            proceedWithExistingPresident: true,
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="Remover membro da comissão"
        message="Tem certeza que deseja remover este militar da comissão CPCA desta OM?"
        highlightText={memberToRemove?.user?.name ?? ''}
        severity="error"
        confirmLabel="Remover"
        confirmLoading={removeMemberMutation.isPending}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={() => {
          void handleRemoveMember();
        }}
      />
    </Box>
  );
}
