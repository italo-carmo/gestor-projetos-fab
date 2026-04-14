import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { useMemo, useState } from 'react';
import {
  useApproveCpcaPresidentRequest,
  useCpcaPresidentRequests,
  useRejectCpcaPresidentRequest,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

type PresidentRequestItem = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  applicantIdentifier: string;
  applicantUid: string;
  applicantEmail?: string | null;
  applicantName: string;
  requestedAsSubstitution: boolean;
  bulletinNumber: string;
  createdAt: string;
  decidedAt?: string | null;
  decisionNotes?: string | null;
  locality: {
    id: string;
    code: string;
    name: string;
  };
  applicantUser: {
    id: string;
    name: string;
    email: string;
    ldapUid?: string | null;
  };
};

function extractReason(error: unknown) {
  const details = (error as { response?: { data?: { details?: Record<string, unknown> } } })
    ?.response?.data?.details;
  return {
    reason: String(details?.reason ?? '').trim(),
    currentPresident: String(details?.currentPresident ?? '').trim(),
    localityName: String(details?.localityName ?? '').trim(),
  };
}

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

export function CpcaPresidentApprovalsPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [approveTarget, setApproveTarget] = useState<PresidentRequestItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PresidentRequestItem | null>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<PresidentRequestItem | null>(null);

  const requestsQuery = useCpcaPresidentRequests({ status: statusFilter }, true);
  const approveMutation = useApproveCpcaPresidentRequest();
  const rejectMutation = useRejectCpcaPresidentRequest();

  const requests = useMemo(
    () => (requestsQuery.data?.items ?? []) as PresidentRequestItem[],
    [requestsQuery.data?.items],
  );
  const pendingCount = Number(requestsQuery.data?.pendingCount ?? 0);

  const approveRequest = async (
    requestId: string,
    proceedWithExistingPresident?: boolean,
  ) => {
    try {
      await approveMutation.mutateAsync({
        id: requestId,
        proceedWithExistingPresident,
      });
      toast.push({
        message: 'Solicitação homologada com sucesso.',
        severity: 'success',
      });
      setApproveTarget(null);
      setOverwriteTarget(null);
    } catch (error) {
      const details = extractReason(error);
      if (
        details.reason === 'CPCA_LOCALITY_ALREADY_HAS_PRESIDENT' &&
        !proceedWithExistingPresident
      ) {
        const target = requests.find((item) => item.id === requestId) ?? null;
        setOverwriteTarget(target);
        return;
      }
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao homologar solicitação.',
        severity: 'error',
      });
    }
  };

  const rejectRequest = async () => {
    if (!rejectTarget) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectTarget.id });
      toast.push({
        message: 'Solicitação excluída.',
        severity: 'success',
      });
      setRejectTarget(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao excluir solicitação.',
        severity: 'error',
      });
    }
  };

  if (requestsQuery.isLoading) return <SkeletonState />;
  if (requestsQuery.isError) {
    return <ErrorState error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />;
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
                  Homologações CPCA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Análise de solicitações de auto-cadastro de presidente da comissão CPCA.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`Pendentes: ${pendingCount}`}
                  color={pendingCount > 0 ? 'warning' : 'default'}
                  variant={pendingCount > 0 ? 'filled' : 'outlined'}
                />
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'PENDING' | 'APPROVED' | 'REJECTED')
                  }
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="PENDING">Pendentes</MenuItem>
                  <MenuItem value="APPROVED">Homologadas</MenuItem>
                  <MenuItem value="REJECTED">Excluídas</MenuItem>
                </TextField>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {requests.length === 0 ? (
          <EmptyState
            title="Nenhuma solicitação encontrada"
            description="Não há registros para o filtro selecionado."
          />
        ) : (
          <Card>
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Solicitante</TableCell>
                    <TableCell>UID</TableCell>
                    <TableCell>OM</TableCell>
                    <TableCell>Substituição</TableCell>
                    <TableCell>Boletim</TableCell>
                    <TableCell>Solicitado em</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((item) => {
                    const canAct = item.status === 'PENDING';
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Stack spacing={0.3}>
                            <Typography variant="body2" fontWeight={600}>
                              {item.applicantName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.applicantEmail ?? item.applicantUser?.email ?? item.applicantIdentifier}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{item.applicantUid || item.applicantUser?.ldapUid || '-'}</TableCell>
                        <TableCell>
                          {item.locality.code} - {item.locality.name}
                        </TableCell>
                        <TableCell>{item.requestedAsSubstitution ? 'Sim' : 'Não'}</TableCell>
                        <TableCell>{item.bulletinNumber}</TableCell>
                        <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<VerifiedUserRoundedIcon />}
                              disabled={!canAct || approveMutation.isPending}
                              onClick={() => setApproveTarget(item)}
                            >
                              Homologar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<BlockRoundedIcon />}
                              disabled={!canAct || rejectMutation.isPending}
                              onClick={() => setRejectTarget(item)}
                            >
                              Excluir
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Stack>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="Homologar presidente CPCA"
        message="Confirma a homologação desta solicitação? A permissão CPCA será concedida automaticamente para a OM selecionada."
        highlightText={approveTarget ? `${approveTarget.applicantName} • ${approveTarget.locality.code} - ${approveTarget.locality.name}` : ''}
        confirmLabel="Homologar"
        confirmLoading={approveMutation.isPending}
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => {
          if (!approveTarget) return;
          void approveRequest(approveTarget.id, false);
        }}
      />

      <ConfirmDialog
        open={Boolean(overwriteTarget)}
        title="OM já possui presidente"
        message="Esta OM já possui um presidente cadastrado. Deseja registrar ciência e prosseguir com a homologação mesmo assim?"
        highlightText={
          overwriteTarget
            ? `${overwriteTarget.locality.code} - ${overwriteTarget.locality.name}`
            : ''
        }
        note={
          overwriteTarget?.requestedAsSubstitution
            ? 'A solicitação foi marcada como substituição. O presidente anterior perderá a permissão CPCA desta OM.'
            : 'A solicitação não foi marcada como substituição.'
        }
        severity="warning"
        confirmLabel="Prosseguir"
        confirmLoading={approveMutation.isPending}
        onCancel={() => setOverwriteTarget(null)}
        onConfirm={() => {
          if (!overwriteTarget) return;
          void approveRequest(overwriteTarget.id, true);
        }}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Excluir solicitação"
        message="Confirma a exclusão desta solicitação de cadastro de presidente CPCA?"
        highlightText={rejectTarget?.applicantName ?? ''}
        severity="error"
        confirmLabel="Excluir"
        confirmLoading={rejectMutation.isPending}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => {
          void rejectRequest();
        }}
      />
    </Box>
  );
}
