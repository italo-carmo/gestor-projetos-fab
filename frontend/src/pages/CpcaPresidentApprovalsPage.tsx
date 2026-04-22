import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { useEffect, useMemo, useState } from "react";
import {
  useApproveCpcaPresidentRequest,
  useCpcaPresidentRequests,
  useRejectCpcaPresidentRequest,
} from "../api/hooks";
import { api } from "../api/client";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import {
  formatCpcaPresidentBulletinFileSize,
  getCpcaPresidentBulletinPreviewKind,
} from "../features/cpcaPresidentBulletinFile";

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
  applicantIdentifier?: string | null;
  applicantUid?: string | null;
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
  bulletinFile?: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    checksum?: string | null;
    available: boolean;
  } | null;
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

function getStatusMeta(status: ApprovalRequestItem["status"]) {
  if (status === "APPROVED") {
    return { label: "Homologada", color: "success" as const };
  }
  if (status === "REJECTED") {
    return { label: "Rejeitada", color: "error" as const };
  }
  return { label: "Pendente", color: "warning" as const };
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
  const [detailsTarget, setDetailsTarget] =
    useState<ApprovalRequestItem | null>(null);
  const [detailsFileUrl, setDetailsFileUrl] = useState("");
  const [detailsFileMimeType, setDetailsFileMimeType] = useState("");
  const [detailsFileError, setDetailsFileError] = useState("");
  const [detailsFileLoading, setDetailsFileLoading] = useState(false);

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
  const canDecide = Boolean(requestsQuery.data?.canDecide);

  useEffect(() => {
    let objectUrl = "";
    let isActive = true;

    const loadBulletin = async () => {
      setDetailsFileUrl("");
      setDetailsFileMimeType("");
      setDetailsFileError("");

      if (
        !detailsTarget ||
        detailsTarget.type !== "SELF_REGISTRATION" ||
        !detailsTarget.bulletinFile
      ) {
        setDetailsFileLoading(false);
        return;
      }

      if (!detailsTarget.bulletinFile.available) {
        setDetailsFileError(
          "O arquivo da publicação não está mais disponível.",
        );
        setDetailsFileLoading(false);
        return;
      }

      setDetailsFileLoading(true);
      try {
        const response = await api.get(
          `/cpca-commission/approval-requests/${detailsTarget.type}/${detailsTarget.id}/bulletin-file`,
          {
            responseType: "blob",
          },
        );
        objectUrl = URL.createObjectURL(response.data);
        if (!isActive) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setDetailsFileUrl(objectUrl);
        setDetailsFileMimeType(
          String(response.data?.type ?? "").trim() ||
            String(response.headers["content-type"] ?? "").trim() ||
            detailsTarget.bulletinFile.mimeType,
        );
      } catch (error) {
        if (!isActive) return;
        setDetailsFileError(
          parseApiError(error).message ??
            "Não foi possível carregar o arquivo da publicação.",
        );
      } finally {
        if (isActive) {
          setDetailsFileLoading(false);
        }
      }
    };

    void loadBulletin();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [detailsTarget]);

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

  const handleOpenBulletinInNewTab = () => {
    if (!detailsFileUrl) return;
    window.open(detailsFileUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadBulletin = () => {
    if (!detailsFileUrl || !detailsTarget?.bulletinFile?.fileName) return;
    const anchor = document.createElement("a");
    anchor.href = detailsFileUrl;
    anchor.download = detailsTarget.bulletinFile.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
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
                {!canDecide ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.6 }}
                  >
                    Seu perfil está em modo de consulta nesta fila. Use o ícone
                    de visualização para inspecionar os anexos e os dados do
                    pedido.
                  </Typography>
                ) : null}
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
                    const statusMeta = getStatusMeta(item.status);
                    const origin = renderOrigin(item);
                    return (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <Stack spacing={0.8} alignItems="flex-start">
                            <Chip
                              icon={typeMeta.icon}
                              label={typeMeta.label}
                              color={typeMeta.color}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={statusMeta.label}
                              color={statusMeta.color}
                              size="small"
                              variant={
                                item.status === "PENDING"
                                  ? "filled"
                                  : "outlined"
                              }
                            />
                          </Stack>
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
                            <Tooltip title="Ver dados da solicitação">
                              <IconButton
                                color="primary"
                                onClick={() => setDetailsTarget(item)}
                              >
                                <VisibilityRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {canDecide ? (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<VerifiedUserRoundedIcon />}
                                  disabled={
                                    !canAct || approveMutation.isPending
                                  }
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
                              </>
                            ) : null}
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

      <Dialog
        open={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalhes da solicitação CPCA</DialogTitle>
        <DialogContent dividers>
          {detailsTarget ? (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    {detailsTarget.locality
                      ? `${detailsTarget.locality.code} - ${detailsTarget.locality.name}`
                      : "Solicitação sem OM vinculada"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Registrada em {formatDateTime(detailsTarget.createdAt)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label={getTypeMeta(detailsTarget.type).label}
                    color={getTypeMeta(detailsTarget.type).color}
                    variant="outlined"
                    size="small"
                  />
                  <Chip
                    label={getStatusMeta(detailsTarget.status).label}
                    color={getStatusMeta(detailsTarget.status).color}
                    variant={
                      detailsTarget.status === "PENDING" ? "filled" : "outlined"
                    }
                    size="small"
                  />
                  {detailsTarget.requestedAsSubstitution ? (
                    <Chip
                      label="Substituição"
                      color="warning"
                      variant="outlined"
                      size="small"
                    />
                  ) : null}
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Stack spacing={0.9} sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Solicitante
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {detailsTarget.type === "SELF_REGISTRATION"
                      ? detailsTarget.applicant?.name || "Não informado"
                      : detailsTarget.requestedByUser?.name || "Não informado"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {detailsTarget.type === "SELF_REGISTRATION"
                      ? detailsTarget.applicant?.email || "Sem e-mail"
                      : detailsTarget.requestedByUser?.email || "Sem e-mail"}
                  </Typography>
                  {detailsTarget.type === "SELF_REGISTRATION" ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        UID/CPF:{" "}
                        {detailsTarget.applicantUid ||
                          detailsTarget.applicant?.ldapUid ||
                          "Não informado"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Identificador informado:{" "}
                        {detailsTarget.applicantIdentifier || "Não informado"}
                      </Typography>
                    </>
                  ) : null}
                </Stack>

                <Stack spacing={0.9} sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contexto
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {detailsTarget.type === "PRESIDENT_NOMINATION"
                      ? detailsTarget.nominee?.displayName ||
                        detailsTarget.nominee?.name ||
                        "Indicado não informado"
                      : detailsTarget.type === "COVERAGE"
                        ? `${detailsTarget.requestedManagedLocalities?.length ?? 0} OM(s) na cobertura`
                        : "Cadastro como presidente"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Boletim: {detailsTarget.bulletinNumber || "Não informado"}
                  </Typography>
                  {detailsTarget.decidedAt ? (
                    <Typography variant="body2" color="text.secondary">
                      Processada em {formatDateTime(detailsTarget.decidedAt)}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>

              {detailsTarget.decisionNotes ? (
                <Alert
                  severity={
                    detailsTarget.status === "REJECTED" ? "error" : "success"
                  }
                >
                  {detailsTarget.decisionNotes}
                </Alert>
              ) : null}

              <Divider />

              {detailsTarget.type === "SELF_REGISTRATION" ? (
                <Stack spacing={1.2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Publicação anexada
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {detailsTarget.bulletinFile
                          ? `${detailsTarget.bulletinFile.fileName} • ${formatCpcaPresidentBulletinFileSize(detailsTarget.bulletinFile.fileSize)}`
                          : "Nenhum arquivo foi anexado a esta solicitação."}
                      </Typography>
                    </Box>
                    {detailsTarget.bulletinFile && detailsFileUrl ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewRoundedIcon />}
                          onClick={handleOpenBulletinInNewTab}
                        >
                          Abrir
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadRoundedIcon />}
                          onClick={handleDownloadBulletin}
                        >
                          Baixar
                        </Button>
                      </Stack>
                    ) : null}
                  </Stack>

                  {detailsFileLoading ? (
                    <Stack
                      spacing={1}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ py: 5 }}
                    >
                      <CircularProgress size={28} />
                      <Typography variant="body2" color="text.secondary">
                        Carregando o boletim com autenticação segura...
                      </Typography>
                    </Stack>
                  ) : detailsFileError ? (
                    <Alert
                      severity={
                        detailsTarget.bulletinFile?.available ? "error" : "info"
                      }
                    >
                      {detailsFileError}
                    </Alert>
                  ) : !detailsTarget.bulletinFile ? (
                    <Alert severity="info">
                      Esta solicitação não possui arquivo de publicação
                      disponível.
                    </Alert>
                  ) : getCpcaPresidentBulletinPreviewKind(
                      detailsFileMimeType ||
                        detailsTarget.bulletinFile.mimeType,
                    ) === "pdf" ? (
                    <Box
                      component="iframe"
                      src={detailsFileUrl}
                      title="Boletim da comissão"
                      sx={{
                        width: "100%",
                        minHeight: { xs: 360, md: 560 },
                        border: 0,
                        borderRadius: 2,
                        bgcolor: "#f4f7fa",
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        borderRadius: 2,
                        bgcolor: "#f4f7fa",
                        p: 1.2,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        {getCpcaPresidentBulletinPreviewKind(
                          detailsFileMimeType ||
                            detailsTarget.bulletinFile.mimeType,
                        ) === "pdf" ? (
                          <PictureAsPdfRoundedIcon fontSize="small" />
                        ) : (
                          <ImageRoundedIcon fontSize="small" />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Pré-visualização autenticada do boletim
                        </Typography>
                      </Stack>
                      <Box
                        component="img"
                        src={detailsFileUrl}
                        alt="Publicação do boletim"
                        sx={{
                          width: "100%",
                          maxHeight: 560,
                          objectFit: "contain",
                          borderRadius: 1.5,
                          bgcolor: "#fff",
                        }}
                      />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Alert severity="info">
                  Esta solicitação não utiliza anexo de boletim para
                  visualização.
                </Alert>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsTarget(null)} color="inherit">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

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
