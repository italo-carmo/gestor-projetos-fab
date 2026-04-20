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
} from "@mui/material";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import { useMemo, useState } from "react";
import {
  useApproveCpcaPresidentRequest,
  useCpcaPresidentRequests,
  useRejectCpcaPresidentRequest,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type ApprovalRequestType =
  | "SELF_REGISTRATION"
  | "PRESIDENT_NOMINATION"
  | "COVERAGE";

type ApprovalRequestItem = {
  id: string;
  type: ApprovalRequestType;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt?: string | null;
  decisionNotes?: string | null;
  locality?: {
    id: string;
    code: string;
    name: string;
  } | null;
  applicant?: {
    id?: string;
    name: string;
    email?: string | null;
    ldapUid?: string | null;
  } | null;
  requestedByUser?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  nominee?: {
    id?: string;
    name?: string | null;
    displayName?: string | null;
    email?: string | null;
    ldapUid?: string | null;
  } | null;
  requestedManagedLocalities?: Array<{
    id: string;
    code: string;
    name: string;
    uf?: string | null;
  }>;
  requestedAsSubstitution?: boolean;
  bulletinNumber?: string | null;
};

function extractReason(error: unknown) {
  const details = (
    error as { response?: { data?: { details?: Record<string, unknown> } } }
  )?.response?.data?.details;
  return {
    reason: String(details?.reason ?? "").trim(),
    currentPresident: String(details?.currentPresident ?? "").trim(),
    localityName: String(details?.localityName ?? "").trim(),
  };
}

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function getTypeMeta(type: ApprovalRequestType) {
  if (type === "SELF_REGISTRATION") {
    return {
      label: "Autoinscrição",
      color: "primary" as const,
      icon: <FactCheckRoundedIcon fontSize="small" />,
    };
  }
  if (type === "PRESIDENT_NOMINATION") {
    return {
      label: "Sucessão de presidente",
      color: "secondary" as const,
      icon: <ManageAccountsRoundedIcon fontSize="small" />,
    };
  }
  return {
    label: "Cobertura de OM",
    color: "warning" as const,
    icon: <AltRouteRoundedIcon fontSize="small" />,
  };
}

function renderOrigin(item: ApprovalRequestItem) {
  if (item.type === "SELF_REGISTRATION") {
    return {
      title: item.applicant?.name ?? "Solicitante não informado",
      subtitle: item.applicant?.email ?? "-",
    };
  }
  return {
    title: item.requestedByUser?.name ?? "Solicitante não informado",
    subtitle: item.requestedByUser?.email ?? "-",
  };
}

function renderDetail(item: ApprovalRequestItem) {
  if (item.type === "SELF_REGISTRATION") {
    return (
      <Stack spacing={0.3}>
        <Typography variant="body2" fontWeight={600}>
          {item.requestedAsSubstitution
            ? "Solicitou substituição"
            : "Solicitou homologação como presidente"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Boletim: {item.bulletinNumber || "Não informado"}
        </Typography>
      </Stack>
    );
  }

  if (item.type === "PRESIDENT_NOMINATION") {
    return (
      <Stack spacing={0.3}>
        <Typography variant="body2" fontWeight={600}>
          Indicado:{" "}
          {item.nominee?.displayName ?? item.nominee?.name ?? "Não informado"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {item.nominee?.email || "Sem e-mail"}
          {item.bulletinNumber ? ` • Boletim: ${item.bulletinNumber}` : ""}
        </Typography>
      </Stack>
    );
  }

  const requestedLocalities = item.requestedManagedLocalities ?? [];
  const summary = requestedLocalities
    .slice(0, 3)
    .map((entry) => entry.code)
    .join(", ");

  return (
    <Stack spacing={0.3}>
      <Typography variant="body2" fontWeight={600}>
        {requestedLocalities.length} OM(s) na cobertura proposta
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {summary || "Sem OMs adicionais"}
        {requestedLocalities.length > 3
          ? ` e mais ${requestedLocalities.length - 3}`
          : ""}
      </Typography>
    </Stack>
  );
}

export function CpcaPresidentApprovalsPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<
    "PENDING" | "APPROVED" | "REJECTED"
  >("PENDING");
  const [approveTarget, setApproveTarget] =
    useState<ApprovalRequestItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequestItem | null>(
    null,
  );
  const [overwriteTarget, setOverwriteTarget] =
    useState<ApprovalRequestItem | null>(null);

  const requestsQuery = useCpcaPresidentRequests(
    { status: statusFilter },
    true,
  );
  const approveMutation = useApproveCpcaPresidentRequest();
  const rejectMutation = useRejectCpcaPresidentRequest();

  const requests = useMemo(
    () => (requestsQuery.data?.items ?? []) as ApprovalRequestItem[],
    [requestsQuery.data?.items],
  );
  const pendingCount = Number(requestsQuery.data?.pendingCount ?? 0);

  const approveRequest = async (
    item: ApprovalRequestItem,
    proceedWithExistingPresident?: boolean,
  ) => {
    try {
      await approveMutation.mutateAsync({
        type: item.type,
        id: item.id,
        proceedWithExistingPresident,
      });
      toast.push({
        message: "Solicitação homologada com sucesso.",
        severity: "success",
      });
      setApproveTarget(null);
      setOverwriteTarget(null);
    } catch (error) {
      const details = extractReason(error);
      if (
        details.reason === "CPCA_LOCALITY_ALREADY_HAS_PRESIDENT" &&
        item.type !== "COVERAGE" &&
        !proceedWithExistingPresident
      ) {
        setOverwriteTarget(item);
        return;
      }
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao homologar solicitação.",
        severity: "error",
      });
    }
  };

  const rejectRequest = async () => {
    if (!rejectTarget) return;
    try {
      await rejectMutation.mutateAsync({
        type: rejectTarget.type,
        id: rejectTarget.id,
      });
      toast.push({
        message: "Solicitação rejeitada.",
        severity: "success",
      });
      setRejectTarget(null);
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao rejeitar solicitação.",
        severity: "error",
      });
    }
  };

  if (requestsQuery.isLoading) return <SkeletonState />;
  if (requestsQuery.isError) {
    return (
      <ErrorState
        error={requestsQuery.error}
        onRetry={() => requestsQuery.refetch()}
      />
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h4" fontWeight={800}>
                  Homologações CPCA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fila única de aprovação para autoinscrição de presidente,
                  sucessão de presidência e solicitações de cobertura entre OMs.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`Pendentes: ${pendingCount}`}
                  color={pendingCount > 0 ? "warning" : "default"}
                  variant={pendingCount > 0 ? "filled" : "outlined"}
                />
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "PENDING" | "APPROVED" | "REJECTED",
                    )
                  }
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="PENDING">Pendentes</MenuItem>
                  <MenuItem value="APPROVED">Homologadas</MenuItem>
                  <MenuItem value="REJECTED">Rejeitadas</MenuItem>
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
                    <TableCell>Tipo</TableCell>
                    <TableCell>Origem</TableCell>
                    <TableCell>OM</TableCell>
                    <TableCell>Detalhe</TableCell>
                    <TableCell>Solicitado em</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((item) => {
                    const canAct = item.status === "PENDING";
                    const typeMeta = getTypeMeta(item.type);
                    const origin = renderOrigin(item);
                    return (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <Chip
                            icon={typeMeta.icon}
                            label={typeMeta.label}
                            color={typeMeta.color}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.3}>
                            <Typography variant="body2" fontWeight={600}>
                              {origin.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {origin.subtitle}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {item.locality
                            ? `${item.locality.code} - ${item.locality.name}`
                            : "-"}
                        </TableCell>
                        <TableCell>{renderDetail(item)}</TableCell>
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
                              Rejeitar
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
        title="Homologar solicitação CPCA"
        message="Confirma a homologação desta solicitação? A aprovação será aplicada imediatamente no fluxo da OM correspondente."
        highlightText={
          approveTarget?.locality
            ? `${approveTarget.locality.code} - ${approveTarget.locality.name}`
            : ""
        }
        confirmLabel="Homologar"
        confirmLoading={approveMutation.isPending}
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => {
          if (!approveTarget) return;
          void approveRequest(approveTarget, false);
        }}
      />

      <ConfirmDialog
        open={Boolean(overwriteTarget)}
        title="OM já possui presidente"
        message="Esta OM já possui um presidente registrado. Deseja registrar ciência e prosseguir com a homologação mesmo assim?"
        highlightText={
          overwriteTarget?.locality
            ? `${overwriteTarget.locality.code} - ${overwriteTarget.locality.name}`
            : ""
        }
        note={
          overwriteTarget?.requestedAsSubstitution
            ? "A solicitação foi marcada como substituição. O presidente anterior perderá a permissão CPCA desta OM."
            : "A solicitação não foi marcada como substituição."
        }
        severity="warning"
        confirmLabel="Prosseguir"
        confirmLoading={approveMutation.isPending}
        onCancel={() => setOverwriteTarget(null)}
        onConfirm={() => {
          if (!overwriteTarget) return;
          void approveRequest(overwriteTarget, true);
        }}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Rejeitar solicitação"
        message="Confirma a rejeição desta solicitação de homologação CPCA?"
        highlightText={
          rejectTarget?.locality
            ? `${rejectTarget.locality.code} - ${rejectTarget.locality.name}`
            : ""
        }
        severity="error"
        confirmLabel="Rejeitar"
        confirmLoading={rejectMutation.isPending}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => {
          void rejectRequest();
        }}
      />
    </Box>
  );
}
