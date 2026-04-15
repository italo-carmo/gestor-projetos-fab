import {
  Autocomplete,
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
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { useEffect, useMemo, useState } from "react";
import {
  useAddCpcaCommissionMember,
  useAssignCpcaPresident,
  useCpcaCommissionOverview,
  useMe,
  useOmsCatalog,
  useRemoveCpcaCommissionMember,
  useUpdateCpcaCommissionCoverage,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from "../app/roleAccess";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type OmsCatalogItem = {
  id: string;
  code: string;
  name: string;
  hasCpca?: boolean;
  uf?: string | null;
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
  const responseData = (
    error as { response?: { data?: { details?: { reason?: string } } } }
  )?.response?.data;
  return String(responseData?.details?.reason ?? "").trim();
}

function formatOmLabel(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  const codeValue = String(code ?? "").trim();
  const nameValue = String(name ?? "").trim();
  if (codeValue && nameValue) {
    if (
      codeValue.localeCompare(nameValue, "pt-BR", { sensitivity: "base" }) === 0
    ) {
      return codeValue;
    }
    return `${codeValue} - ${nameValue}`;
  }
  return codeValue || nameValue;
}

export function CpcaCommissionPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const isApprover = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);
  const ownLocalityId = String(me?.localityId ?? "").trim();
  const omsCatalogQuery = useOmsCatalog(isApprover);

  const cpcaLocalities = useMemo(
    () =>
      ((omsCatalogQuery.data?.items ?? []) as OmsCatalogItem[])
        .filter((item) => Boolean(item.hasCpca))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [omsCatalogQuery.data?.items],
  );

  const [selectedLocalityId, setSelectedLocalityId] = useState("");
  const [presidentIdentifier, setPresidentIdentifier] = useState("");
  const [presidentBulletin, setPresidentBulletin] = useState("");
  const [presidentIsSubstitution, setPresidentIsSubstitution] = useState(true);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [managedLocalityIds, setManagedLocalityIds] = useState<string[]>([]);
  const [pendingPresidentOverwrite, setPendingPresidentOverwrite] = useState<{
    identifier: string;
    localityId: string;
    isSubstitution: boolean;
    designationBulletin: string;
  } | null>(null);
  const [memberToRemove, setMemberToRemove] =
    useState<CommissionMemberItem | null>(null);

  useEffect(() => {
    if (!isApprover) {
      setSelectedLocalityId("");
      return;
    }
  }, [isApprover]);

  useEffect(() => {
    if (isApprover) {
      if (
        selectedLocalityId &&
        cpcaLocalities.some((item) => item.id === selectedLocalityId)
      ) {
        return;
      }

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
  const updateCoverageMutation = useUpdateCpcaCommissionCoverage();

  const canManageMembers = Boolean(overviewQuery.data?.canManageMembers);
  const canAssignPresident = Boolean(overviewQuery.data?.canAssignPresident);
  const currentPresident = overviewQuery.data?.currentPresident as
    | {
        id: string;
        designationBulletin?: string | null;
        isSubstitution: boolean;
        assignedAt: string;
        user: {
          id: string;
          name: string;
          email: string;
          ldapUid?: string | null;
        };
        assignedByUser?: { id: string; name: string; email: string } | null;
      }
    | null
    | undefined;
  const members = (overviewQuery.data?.members ?? []) as CommissionMemberItem[];
  const locality = overviewQuery.data?.locality as
    | { id: string; code: string; name: string }
    | null
    | undefined;
  const managedLocalities = ((overviewQuery.data?.managedLocalities ??
    []) as OmsCatalogItem[]).sort((a, b) =>
    formatOmLabel(a.code, a.name).localeCompare(
      formatOmLabel(b.code, b.name),
      "pt-BR",
    ),
  );
  const availableManagedLocalities = ((overviewQuery.data
    ?.availableManagedLocalities ?? []) as OmsCatalogItem[]).sort((a, b) =>
    formatOmLabel(a.code, a.name).localeCompare(
      formatOmLabel(b.code, b.name),
      "pt-BR",
    ),
  );
  const canManageCoverage = Boolean(overviewQuery.data?.canManageCoverage);

  useEffect(() => {
    if (isApprover) return;
    const resolvedLocalityId = String(locality?.id ?? ownLocalityId).trim();
    if (!resolvedLocalityId) return;
    if (resolvedLocalityId !== selectedLocalityId) {
      setSelectedLocalityId(resolvedLocalityId);
    }
  }, [isApprover, locality?.id, ownLocalityId, selectedLocalityId]);

  useEffect(() => {
    setManagedLocalityIds(managedLocalities.map((item) => item.id));
  }, [locality?.id, managedLocalities]);

  const selectedLocalityCode =
    locality?.code ??
    cpcaLocalities.find((item) => item.id === selectedLocalityId)?.code ??
    null;
  const selectedLocalityName =
    locality?.name ??
    cpcaLocalities.find((item) => item.id === selectedLocalityId)?.name ??
    null;
  const selectedLocalityLabel = formatOmLabel(
    selectedLocalityCode,
    selectedLocalityName,
  );

  const handleSaveCoverage = async () => {
    const localityId = String(locality?.id ?? selectedLocalityId).trim();
    if (!localityId) {
      toast.push({
        message: "Selecione uma OM para configurar a cobertura.",
        severity: "warning",
      });
      return;
    }

    try {
      await updateCoverageMutation.mutateAsync({
        localityId,
        managedLocalityIds,
      });
      toast.push({
        message: "Cobertura CPCA atualizada com sucesso.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          "Erro ao atualizar a cobertura da comissão.",
        severity: "error",
      });
    }
  };

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
        message: "Presidente CPCA designado com sucesso.",
        severity: "success",
      });
      setPresidentIdentifier("");
      setPresidentBulletin("");
      setPendingPresidentOverwrite(null);
    } catch (error) {
      const reason = extractReason(error);
      if (
        reason === "CPCA_LOCALITY_ALREADY_HAS_PRESIDENT" &&
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
        message: parseApiError(error).message ?? "Erro ao designar presidente.",
        severity: "error",
      });
    }
  };

  const handleAddMember = async () => {
    const identifier = memberIdentifier.trim();
    if (!identifier) {
      toast.push({
        message: "Informe e-mail ou CPF para adicionar membro.",
        severity: "warning",
      });
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        identifier,
        localityId: isApprover ? selectedLocalityId : undefined,
      });
      toast.push({
        message: "Membro adicionado à comissão CPCA.",
        severity: "success",
      });
      setMemberIdentifier("");
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao adicionar membro.",
        severity: "error",
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync(memberToRemove.id);
      toast.push({
        message: "Membro removido da comissão.",
        severity: "success",
      });
      setMemberToRemove(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao remover membro.",
        severity: "error",
      });
    }
  };

  if (overviewQuery.isLoading || (isApprover && omsCatalogQuery.isLoading)) {
    return <SkeletonState />;
  }
  if (overviewQuery.isError) {
    return (
      <ErrorState
        error={overviewQuery.error}
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }
  if (isApprover && omsCatalogQuery.isError) {
    return (
      <ErrorState
        error={omsCatalogQuery.error}
        onRetry={() => omsCatalogQuery.refetch()}
      />
    );
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
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h4" fontWeight={800}>
                  Comissão CPCA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestão de presidente e membros da comissão por OM.
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <Chip
                  icon={<WorkspacePremiumRoundedIcon />}
                  label={`Presidente: ${currentPresident?.user?.name ?? "Não designado"}`}
                  color={currentPresident ? "primary" : "default"}
                  variant={currentPresident ? "filled" : "outlined"}
                />
                <Chip
                  icon={<GroupRoundedIcon />}
                  label={`Membros: ${members.length}`}
                  color="default"
                  variant="outlined"
                />
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              sx={{ mt: 2 }}
            >
              <TextField
                select
                label="OM"
                size="small"
                value={
                  isApprover
                    ? selectedLocalityId
                    : (ownLocalityId || locality?.id || selectedLocalityId)
                }
                onChange={(event) => {
                  if (!isApprover) return;
                  setSelectedLocalityId(event.target.value);
                }}
                sx={{ minWidth: 320 }}
                disabled={!isApprover}
              >
                {isApprover ? (
                  cpcaLocalities.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {formatOmLabel(item.code, item.name)}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value={locality?.id ?? selectedLocalityId}>
                    {selectedLocalityLabel}
                  </MenuItem>
                )}
              </TextField>
            </Stack>
          </CardContent>
        </Card>

        {canAssignPresident ? (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>
                Designar Presidente CPCA
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Cadastro via LDAP por e-mail/CPF, com concessão automática da
                permissão CPCA na OM.
              </Typography>

              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.2}
                alignItems={{ xs: "stretch", lg: "flex-end" }}
              >
                <TextField
                  size="small"
                  label="E-mail ou CPF"
                  value={presidentIdentifier}
                  onChange={(event) =>
                    setPresidentIdentifier(event.target.value)
                  }
                  fullWidth
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Boletim de designação"
                  value={presidentBulletin}
                  onChange={(event) => setPresidentBulletin(event.target.value)}
                  fullWidth
                  sx={{ flex: 1, maxWidth: { lg: 340 } }}
                />
                <TextField
                  select
                  size="small"
                  label="Substituição"
                  value={presidentIsSubstitution ? "SIM" : "NAO"}
                  onChange={(event) =>
                    setPresidentIsSubstitution(event.target.value === "SIM")
                  }
                  sx={{ minWidth: 150, flexShrink: 0 }}
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
                  sx={{
                    minHeight: 40,
                    height: { lg: 40 },
                    minWidth: { lg: 120 },
                    whiteSpace: "nowrap",
                    alignSelf: { xs: "stretch", lg: "flex-end" },
                    flexShrink: 0,
                  }}
                >
                  {assignPresidentMutation.isPending
                    ? "Salvando..."
                    : "Designar"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>
              Cobertura da Comissão
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {canManageCoverage
                ? "Defina quais OMs sem CPCA próprio ficam sob responsabilidade desta comissão. A própria OM já entra automaticamente."
                : "Consulte abaixo quais OMs esta comissão atende além da própria OM."}
            </Typography>

            <Autocomplete
              multiple
              disableCloseOnSelect
              options={availableManagedLocalities}
              value={availableManagedLocalities.filter((option) =>
                managedLocalityIds.includes(option.id),
              )}
              onChange={(_, value) =>
                setManagedLocalityIds(value.map((item) => item.id))
              }
              getOptionDisabled={(option) => Boolean(option.hasCpca)}
              getOptionLabel={(option) =>
                `${formatOmLabel(option.code, option.name)}${option.uf ? ` - ${option.uf}` : ""}`
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="OMs adicionais cobertas por esta comissão"
                  helperText="OMs com CPCA próprio ficam bloqueadas para evitar sobreposição de gestão."
                />
              )}
              disabled={!canManageCoverage || updateCoverageMutation.isPending}
            />

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.2}
              alignItems={{ xs: "stretch", md: "center" }}
              sx={{ mt: 1.5 }}
            >
              <Chip
                size="small"
                color="primary"
                label="A própria OM sempre permanece vinculada"
              />
              <Chip
                size="small"
                variant="outlined"
                label={`${managedLocalityIds.length} OMs adicionais vinculadas`}
              />
              {canManageCoverage ? (
                <Button
                  variant="contained"
                  onClick={handleSaveCoverage}
                  disabled={updateCoverageMutation.isPending}
                  sx={{ minWidth: { md: 180 } }}
                >
                  {updateCoverageMutation.isPending
                    ? "Salvando..."
                    : "Salvar cobertura"}
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>
              Membros da Comissão
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {canManageMembers
                ? "Cadastre membros por LDAP (e-mail ou CPF)."
                : "Somente o presidente da comissão (ou TI/COMGEP) pode cadastrar/remover membros."}
            </Typography>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.2}
              alignItems={{ xs: "stretch", md: "flex-end" }}
              sx={{ mb: 1.5 }}
            >
              <TextField
                size="small"
                label="E-mail ou CPF"
                value={memberIdentifier}
                onChange={(event) => setMemberIdentifier(event.target.value)}
                fullWidth
                disabled={!canManageMembers || addMemberMutation.isPending}
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                disabled={
                  !canManageMembers ||
                  !memberIdentifier.trim() ||
                  addMemberMutation.isPending
                }
                onClick={handleAddMember}
                sx={{
                  minHeight: 40,
                  height: { md: 40 },
                  minWidth: { md: 170 },
                  whiteSpace: "nowrap",
                  alignSelf: { xs: "stretch", md: "flex-end" },
                  flexShrink: 0,
                }}
              >
                {addMemberMutation.isPending
                  ? "Adicionando..."
                  : "Adicionar membro"}
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
                      <TableCell>{member.user.ldapUid ?? "-"}</TableCell>
                      <TableCell>{member.addedByUser?.name ?? "-"}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          size="small"
                          disabled={
                            !canManageMembers || removeMemberMutation.isPending
                          }
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
        highlightText={
          currentPresident?.user?.name ?? "Presidente atual já registrado"
        }
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
        highlightText={memberToRemove?.user?.name ?? ""}
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
