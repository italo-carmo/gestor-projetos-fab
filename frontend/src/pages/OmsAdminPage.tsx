import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Drawer,
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
import { useEffect, useMemo, useState } from "react";
import {
  useAssignCpcaPresident,
  useCpcaCommissionOverview,
  useCreateOm,
  useDeleteOm,
  useLookupCpcaPresidentCandidate,
  useMe,
  useOms,
  useUpdateCpcaCommissionCoverage,
  useUpdateOm,
  useUpdateOmsHasCpcaBatch,
  useUsers,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import {
  hasAnyRole,
  normalizeRoleName,
  ROLE_COMGEP,
  ROLE_CPCA,
  ROLE_TI,
} from "../app/roleAccess";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type LocalityItem = {
  id: string;
  code: string;
  name: string;
  uf?: string | null;
  hasCpca?: boolean;
  notes?: string | null;
  cpcaManagedByLocality?: {
    id: string;
    code: string;
    name: string;
  } | null;
  cpcaManagedLocalityIds?: string[];
  cpcaManagedLocalities?: Array<{
    id: string;
    code: string;
    name: string;
    uf?: string | null;
    hasCpca?: boolean;
  }>;
};

type UserItem = {
  id: string;
  name: string;
  omId?: string | null;
  localityId?: string | null;
  roles?: Array<{ role?: { id?: string; name?: string } | null }>;
};

const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

type OmsForm = {
  code: string;
  name: string;
  uf: string;
  hasCpca: boolean;
  notes: string;
  managedLocalityIds: string[];
};

type CpcaCoverageFilter = "ALL" | "WITH_CPCA" | "WITHOUT_CPCA";

const DEFAULT_FORM: OmsForm = {
  code: "",
  name: "",
  uf: "",
  hasCpca: false,
  notes: "",
  managedLocalityIds: [],
};

type CpcaPresidentCandidate = {
  identifier: string;
  profile: {
    uid: string;
    name?: string | null;
    email?: string | null;
    fabom?: string | null;
    numeroOrdem?: string | null;
  };
  existingUser?: {
    id: string;
    name: string;
    email: string;
    ldapUid?: string | null;
    localityId?: string | null;
  } | null;
};

type CpcaCommissionHistoryItem = {
  id: string;
  actionLabel?: string | null;
  summary?: string | null;
  createdAt?: string | null;
  actor?: { name?: string | null } | null;
};

function hasCpcaRole(user: UserItem) {
  return (user.roles ?? []).some(
    (entry) =>
      normalizeRoleName(entry?.role?.name) === normalizeRoleName(ROLE_CPCA),
  );
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Data não informada";
  return new Date(value).toLocaleString("pt-BR");
}

type DeleteOmResponse = {
  ok?: boolean;
  detached?: {
    users?: number;
    cpcaCases?: number;
    cpcaCommissionPresidents?: number;
    cpcaCommissionMembers?: number;
    cpcaPresidentRequests?: number;
    cpcaCoverageAsManager?: number;
    cpcaCoverageAsManaged?: number;
  } | null;
};

function formatDetachedOmSummary(payload: DeleteOmResponse | null | undefined) {
  const detached = payload?.detached;
  if (!detached) return "";
  const labels: Array<[number | undefined, string]> = [
    [detached.users, "usuários"],
    [detached.cpcaCases, "denúncias CPCA"],
    [detached.cpcaCommissionPresidents, "presidências CPCA"],
    [detached.cpcaCommissionMembers, "membros de comissão"],
    [detached.cpcaPresidentRequests, "solicitações de presidente"],
    [detached.cpcaCoverageAsManager, "coberturas CPCA geridas"],
    [detached.cpcaCoverageAsManaged, "coberturas CPCA recebidas"],
  ];
  return labels
    .filter(([count]) => Number(count ?? 0) > 0)
    .map(([count, label]) => `${label}: ${Number(count ?? 0)}`)
    .join(", ");
}

export function OmsAdminPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const localitiesQuery = useOms();
  const usersQuery = useUsers(Boolean(me?.id));
  const createLocality = useCreateOm();
  const updateLocality = useUpdateOm();
  const updateCpcaCoverage = useUpdateCpcaCommissionCoverage();
  const updateLocalitiesHasCpcaBatch = useUpdateOmsHasCpcaBatch();
  const deleteLocality = useDeleteOm();
  const assignPresident = useAssignCpcaPresident();
  const lookupPresidentCandidate = useLookupCpcaPresidentCandidate();
  const canManagePresident = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);

  const [search, setSearch] = useState("");
  const [cpcaCoverageFilter, setCpcaCoverageFilter] =
    useState<CpcaCoverageFilter>("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LocalityItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<OmsForm>(DEFAULT_FORM);
  const [selectedLocalityIds, setSelectedLocalityIds] = useState<string[]>([]);
  const [batchHasCpcaValue, setBatchHasCpcaValue] = useState<
    "SIM" | "NAO" | ""
  >("");
  const [managedUfFilter, setManagedUfFilter] = useState("");
  const [presidentIdentifier, setPresidentIdentifier] = useState("");
  const [presidentBulletin, setPresidentBulletin] = useState("");
  const [presidentCandidate, setPresidentCandidate] =
    useState<CpcaPresidentCandidate | null>(null);
  const [pendingPresidentConfirm, setPendingPresidentConfirm] = useState<{
    identifier: string;
    localityId: string;
    designationBulletin?: string;
  } | null>(null);
  const [pendingPresidentOverwrite, setPendingPresidentOverwrite] = useState<{
    identifier: string;
    localityId: string;
    designationBulletin?: string;
  } | null>(null);

  const editingLocalityId = String(editing?.id ?? "").trim();
  const cpcaOverviewQuery = useCpcaCommissionOverview(
    editingLocalityId || undefined,
    drawerOpen &&
      canManagePresident &&
      Boolean(editingLocalityId) &&
      Boolean(editing?.hasCpca),
  );
  const currentPresident = cpcaOverviewQuery.data?.currentPresident as
    | {
        id: string;
        designationBulletin?: string | null;
        assignedAt?: string;
        assignmentSourceLabel?: string | null;
        assignedByUser?: { name?: string | null } | null;
        user?: { name?: string | null; email?: string | null } | null;
      }
    | null
    | undefined;
  const recentCommissionHistory = (
    (cpcaOverviewQuery.data?.history ?? []) as CpcaCommissionHistoryItem[]
  ).slice(0, 4);

  const localities = useMemo(
    () =>
      ((localitiesQuery.data?.items ?? []) as LocalityItem[]).sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"),
      ),
    [localitiesQuery.data?.items],
  );
  const users = useMemo(
    () => (usersQuery.data?.items ?? []) as UserItem[],
    [usersQuery.data?.items],
  );

  const cpcaByLocalityId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    for (const user of users) {
      const localityId = String(user.omId ?? "").trim();
      if (!localityId || !hasCpcaRole(user)) continue;
      const current = map.get(localityId) ?? [];
      current.push({ id: user.id, name: user.name });
      map.set(localityId, current);
    }
    for (const [localityId, members] of map.entries()) {
      members.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      map.set(localityId, members);
    }
    return map;
  }, [users]);

  const filteredLocalities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return localities.filter((item) => {
      const hasCpca = Boolean(item.hasCpca);
      if (cpcaCoverageFilter === "WITH_CPCA" && !hasCpca) return false;
      if (cpcaCoverageFilter === "WITHOUT_CPCA" && hasCpca) return false;
      if (!term) return true;
      const code = String(item.code ?? "").toLowerCase();
      const name = String(item.name ?? "").toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [localities, search, cpcaCoverageFilter]);

  const coverage = useMemo(() => {
    const withCpca = localities.filter((locality) => Boolean(locality.hasCpca));
    const withoutCpca = localities.filter((locality) => !locality.hasCpca);
    return { total: localities.length, withCpca, withoutCpca };
  }, [localities]);

  const cpcaCoverageOptions = useMemo(
    () =>
      localities
        .filter((item) => item.id !== editingLocalityId)
        .map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          uf: item.uf ?? null,
          hasCpca: Boolean(item.hasCpca),
        }))
        .sort((a, b) =>
          formatOmLabel(a.code, a.name).localeCompare(
            formatOmLabel(b.code, b.name),
            "pt-BR",
          ),
        ),
    [editingLocalityId, localities],
  );
  const cpcaCoverageUfOptions = useMemo(
    () =>
      Array.from(
        new Set(
          cpcaCoverageOptions
            .map((item) => String(item.uf ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [cpcaCoverageOptions],
  );
  const visibleCpcaCoverageOptions = useMemo(
    () =>
      cpcaCoverageOptions.filter((item) => {
        if (!managedUfFilter) return true;
        if (form.managedLocalityIds.includes(item.id)) return true;
        return String(item.uf ?? "").trim() === managedUfFilter;
      }),
    [cpcaCoverageOptions, form.managedLocalityIds, managedUfFilter],
  );
  const visibleCpcaCoverageCount = useMemo(
    () =>
      cpcaCoverageOptions.filter(
        (item) =>
          !managedUfFilter || String(item.uf ?? "").trim() === managedUfFilter,
      ).length,
    [cpcaCoverageOptions, managedUfFilter],
  );

  const filteredLocalityIds = useMemo(
    () => filteredLocalities.map((item) => item.id),
    [filteredLocalities],
  );
  const selectedIdSet = useMemo(
    () => new Set(selectedLocalityIds),
    [selectedLocalityIds],
  );
  const selectedVisibleCount = useMemo(
    () => filteredLocalityIds.filter((id) => selectedIdSet.has(id)).length,
    [filteredLocalityIds, selectedIdSet],
  );
  const allVisibleSelected =
    filteredLocalityIds.length > 0 &&
    selectedVisibleCount === filteredLocalityIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    const available = new Set(localities.map((item) => item.id));
    setSelectedLocalityIds((prev) => prev.filter((id) => available.has(id)));
  }, [localities]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setManagedUfFilter("");
    setPresidentIdentifier("");
    setPresidentBulletin("");
    setPresidentCandidate(null);
    setPendingPresidentConfirm(null);
    setPendingPresidentOverwrite(null);
    setDrawerOpen(true);
  };

  const openEdit = (locality: LocalityItem) => {
    setEditing(locality);
    setForm({
      code: locality.code ?? "",
      name: locality.name ?? "",
      uf: locality.uf ?? "",
      hasCpca: Boolean(locality.hasCpca),
      notes: locality.notes ?? "",
      managedLocalityIds: locality.cpcaManagedLocalityIds ?? [],
    });
    setManagedUfFilter("");
    setPresidentIdentifier("");
    setPresidentBulletin("");
    setPresidentCandidate(null);
    setPendingPresidentConfirm(null);
    setPendingPresidentOverwrite(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
    setManagedUfFilter("");
    setPresidentIdentifier("");
    setPresidentBulletin("");
    setPresidentCandidate(null);
    setPendingPresidentConfirm(null);
    setPendingPresidentOverwrite(null);
  };

  const toggleSelectVisible = (checked: boolean) => {
    if (checked) {
      setSelectedLocalityIds((prev) =>
        Array.from(new Set([...prev, ...filteredLocalityIds])),
      );
      return;
    }
    setSelectedLocalityIds((prev) =>
      prev.filter((id) => !filteredLocalityIds.includes(id)),
    );
  };

  const toggleSelectLocality = (id: string, checked: boolean) => {
    setSelectedLocalityIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((itemId) => itemId !== id);
    });
  };

  const applyHasCpcaBatch = async () => {
    const ids = Array.from(
      new Set(
        selectedLocalityIds
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );
    if (ids.length === 0) {
      toast.push({
        message: "Selecione ao menos uma OM para aplicar em lote.",
        severity: "warning",
      });
      return;
    }
    if (!batchHasCpcaValue) {
      toast.push({
        message: 'Selecione o valor de "Possui CPCA" para aplicar em lote.',
        severity: "warning",
      });
      return;
    }
    const hasCpca = batchHasCpcaValue === "SIM";
    try {
      const result = await updateLocalitiesHasCpcaBatch.mutateAsync({
        ids,
        hasCpca,
      });
      toast.push({
        message: `${result.updatedCount} OMs atualizadas com sucesso.`,
        severity: "success",
      });
      setSelectedLocalityIds([]);
      setBatchHasCpcaValue("");
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao atualizar OMs em lote.",
        severity: "error",
      });
    }
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      uf: form.uf.trim().toUpperCase() || null,
      hasCpca: Boolean(form.hasCpca),
      notes: form.notes.trim() || null,
    };
    if (!payload.code || !payload.name) {
      toast.push({
        message: "Informe código e nome da OM.",
        severity: "warning",
      });
      return;
    }

    try {
      if (editing) {
        await updateLocality.mutateAsync({ id: editing.id, payload });
        if (canManagePresident) {
          await updateCpcaCoverage.mutateAsync({
            localityId: editing.id,
            managedLocalityIds: form.hasCpca ? form.managedLocalityIds : [],
          });
        }
        toast.push({
          message: "OM atualizada com sucesso.",
          severity: "success",
        });
      } else {
        await createLocality.mutateAsync(payload);
        toast.push({ message: "OM criada com sucesso.", severity: "success" });
      }
      closeDrawer();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao salvar OM.",
        severity: "error",
      });
    }
  };

  const handleLookupPresident = async () => {
    const identifier = presidentIdentifier.trim();
    if (!identifier) {
      toast.push({
        message: "Informe e-mail ou CPF para pesquisar no LDAP.",
        severity: "warning",
      });
      return;
    }
    try {
      const result = await lookupPresidentCandidate.mutateAsync({ identifier });
      setPresidentCandidate({
        ...(result as Omit<CpcaPresidentCandidate, "identifier">),
        identifier,
      });
      toast.push({
        message:
          "Militar localizado no LDAP. Revise os dados e confirme a designação.",
        severity: "success",
      });
    } catch (error) {
      setPresidentCandidate(null);
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao pesquisar militar no LDAP.",
        severity: "error",
      });
    }
  };

  const handleAssignPresident = async (args: {
    identifier: string;
    localityId: string;
    designationBulletin?: string;
    proceedWithExistingPresident?: boolean;
  }) => {
    try {
      await assignPresident.mutateAsync({
        identifier: args.identifier,
        localityId: args.localityId,
        isSubstitution: true,
        designationBulletin: args.designationBulletin,
        proceedWithExistingPresident: args.proceedWithExistingPresident,
      });
      toast.push({
        message: "Presidente CPCA atualizado com sucesso.",
        severity: "success",
      });
      setPendingPresidentConfirm(null);
      setPendingPresidentOverwrite(null);
      setPresidentIdentifier("");
      setPresidentCandidate(null);
      await Promise.allSettled([
        cpcaOverviewQuery.refetch(),
        usersQuery.refetch(),
      ]);
    } catch (error) {
      const reason = extractReason(error);
      if (
        reason === "CPCA_LOCALITY_ALREADY_HAS_PRESIDENT" &&
        !args.proceedWithExistingPresident
      ) {
        setPendingPresidentOverwrite({
          identifier: args.identifier,
          localityId: args.localityId,
          designationBulletin: args.designationBulletin,
        });
        return;
      }
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao definir presidente CPCA.",
        severity: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = (await deleteLocality.mutateAsync(id)) as DeleteOmResponse;
      const detachedSummary = formatDetachedOmSummary(result);
      toast.push({
        message: detachedSummary
          ? `OM removida com sucesso. Vínculos removidos: ${detachedSummary}.`
          : "OM removida com sucesso.",
        severity: "success",
      });
      setDeleteId(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao remover OM.",
        severity: "error",
      });
    }
  };

  if (localitiesQuery.isLoading || usersQuery.isLoading)
    return <SkeletonState />;
  if (localitiesQuery.isError) {
    return (
      <ErrorState
        error={localitiesQuery.error}
        onRetry={() => localitiesQuery.refetch()}
      />
    );
  }
  if (usersQuery.isError) {
    return (
      <ErrorState
        error={usersQuery.error}
        onRetry={() => usersQuery.refetch()}
      />
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Cadastro de OMs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            CRUD completo de OMs com marcação de "Possui CPCA" e visão de
            militares CPCA por localidade.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Nova OM
        </Button>
      </Box>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              OMs cadastradas
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {coverage.total}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              OMs com CPCA
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {coverage.withCpca.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              OMs sem CPCA
            </Typography>
            <Typography
              variant="h5"
              fontWeight={800}
              color={
                coverage.withoutCpca.length > 0
                  ? "warning.main"
                  : "text.primary"
              }
            >
              {coverage.withoutCpca.length}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              size="small"
              label="Buscar OM"
              placeholder="Digite código ou nome da OM..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <TextField
              select
              size="small"
              label="Filtro Possui CPCA"
              value={cpcaCoverageFilter}
              onChange={(event) =>
                setCpcaCoverageFilter(event.target.value as CpcaCoverageFilter)
              }
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="ALL">Todas</MenuItem>
              <MenuItem value="WITH_CPCA">Possui CPCA = Sim</MenuItem>
              <MenuItem value="WITHOUT_CPCA">Possui CPCA = Não</MenuItem>
            </TextField>
            <Button variant="text" onClick={() => setSearch("")}>
              Limpar
            </Button>
            <Button variant="text" onClick={() => setCpcaCoverageFilter("ALL")}>
              Limpar cobertura
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.2}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ minWidth: 180 }}
            >
              OMs selecionadas: <strong>{selectedLocalityIds.length}</strong>
            </Typography>
            <Button
              variant="text"
              onClick={() => toggleSelectVisible(true)}
              disabled={filteredLocalityIds.length === 0}
            >
              Selecionar visíveis
            </Button>
            <Button
              variant="text"
              onClick={() => setSelectedLocalityIds([])}
              disabled={selectedLocalityIds.length === 0}
            >
              Limpar seleção
            </Button>
            <TextField
              select
              size="small"
              label="Possui CPCA (lote)"
              value={batchHasCpcaValue}
              onChange={(event) =>
                setBatchHasCpcaValue(event.target.value as "SIM" | "NAO" | "")
              }
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">
                <em>Selecione</em>
              </MenuItem>
              <MenuItem value="SIM">Sim</MenuItem>
              <MenuItem value="NAO">Não</MenuItem>
            </TextField>
            <Button
              variant="contained"
              onClick={() => {
                void applyHasCpcaBatch();
              }}
              disabled={updateLocalitiesHasCpcaBatch.isPending}
            >
              Aplicar em lote
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {filteredLocalities.length === 0 ? (
            <EmptyState
              title="Nenhuma OM encontrada"
              description="Ajuste o filtro de busca ou cadastre uma nova OM."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell padding="checkbox" sx={{ color: "white" }}>
                    <Checkbox
                      size="small"
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onChange={(_, checked) => toggleSelectVisible(checked)}
                      sx={{
                        color: "white",
                        "&.Mui-checked": { color: "white" },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>
                    Código
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>
                    Nome
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 700, width: 80 }}
                  >
                    UF
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>
                    Possui CPCA
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>
                    Gerenciada por
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>
                    Militares CPCA
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 700 }}
                    align="right"
                  >
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLocalities.map((locality) => {
                  const cpcaMembers = cpcaByLocalityId.get(locality.id) ?? [];
                  const hasCoverage = Boolean(locality.hasCpca);
                  const managedBy = locality.cpcaManagedByLocality;
                  return (
                    <TableRow key={locality.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selectedIdSet.has(locality.id)}
                          onChange={(_, checked) =>
                            toggleSelectLocality(locality.id, checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {locality.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {locality.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{locality.uf ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={hasCoverage ? "success" : "default"}
                          label={hasCoverage ? "Sim" : "Não"}
                        />
                      </TableCell>
                      <TableCell>
                        {managedBy ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={managedBy.code}
                            title={formatOmLabel(
                              managedBy.code,
                              managedBy.name,
                            )}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {cpcaMembers.length > 0
                          ? cpcaMembers.map((member) => member.name).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openEdit(locality)}>
                          Editar
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setDeleteId(locality.id)}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: "100%", md: 520 } } }}
      >
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          gap={2}
          sx={{ mt: { xs: 8, md: 9 } }}
        >
          <Typography variant="h6">
            {editing ? "Editar OM" : "Nova OM"}
          </Typography>
          <TextField
            size="small"
            label="Código"
            value={form.code}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                code: event.target.value.toUpperCase(),
              }))
            }
            placeholder="Ex: BASV"
          />
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Ex: Base Aérea de Salvador"
          />
          <TextField
            size="small"
            label="UF (Estado)"
            value={form.uf}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, uf: event.target.value }))
            }
            select
            helperText="Sigla do estado para o Mapa Geográfico"
          >
            <MenuItem value="">
              <em>Nenhum</em>
            </MenuItem>
            {UF_OPTIONS.map((uf) => (
              <MenuItem key={uf} value={uf}>
                {uf}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Possui CPCA"
            value={form.hasCpca ? "SIM" : "NAO"}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                hasCpca: event.target.value === "SIM",
              }))
            }
          >
            <MenuItem value="SIM">Sim</MenuItem>
            <MenuItem value="NAO">Não</MenuItem>
          </TextField>
          {canManagePresident && editing ? (
            <Stack spacing={1.2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <TextField
                  select
                  size="small"
                  label="Filtrar OMs por UF"
                  value={managedUfFilter}
                  onChange={(event) => setManagedUfFilter(event.target.value)}
                  sx={{ minWidth: { xs: "100%", md: 200 } }}
                  disabled={!form.hasCpca}
                  helperText={
                    form.hasCpca
                      ? "Filtra a lista de OMs disponíveis para vincular."
                      : "Ative o CPCA da OM para liberar a cobertura."
                  }
                >
                  <MenuItem value="">
                    <em>Todas as UFs</em>
                  </MenuItem>
                  {cpcaCoverageUfOptions.map((uf) => (
                    <MenuItem key={uf} value={uf}>
                      {uf}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${visibleCpcaCoverageCount} OMs visíveis`}
                  />
                  {managedUfFilter ? (
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`UF ${managedUfFilter}`}
                      onDelete={() => setManagedUfFilter("")}
                    />
                  ) : null}
                </Stack>
              </Stack>
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={visibleCpcaCoverageOptions}
                value={cpcaCoverageOptions.filter((option) =>
                  form.managedLocalityIds.includes(option.id),
                )}
                onChange={(_, value) =>
                  setForm((prev) => ({
                    ...prev,
                    managedLocalityIds: value.map((item) => item.id),
                  }))
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionDisabled={(option) => option.hasCpca}
                getOptionLabel={(option) =>
                  `${formatOmLabel(option.code, option.name)}${option.uf ? ` - ${option.uf}` : ""}`
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="OMs gerenciadas pela CPCA desta OM"
                    helperText={
                      form.hasCpca
                        ? "A própria OM já faz parte da cobertura automaticamente. OMs com CPCA próprio ficam bloqueadas. Seleções já feitas continuam preservadas mesmo quando o filtro por UF estiver ativo."
                        : 'Ative "Possui CPCA = Sim" para configurar a cobertura desta comissão.'
                    }
                  />
                )}
                noOptionsText={
                  managedUfFilter
                    ? `Nenhuma OM encontrada para a UF ${managedUfFilter}.`
                    : "Nenhuma OM disponível."
                }
                disabled={!form.hasCpca}
              />
            </Stack>
          ) : null}
          {canManagePresident && editing && form.hasCpca ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                color="primary"
                label="A própria OM sempre entra na cobertura"
              />
              <Chip
                size="small"
                variant="outlined"
                label={`${form.managedLocalityIds.length} OMs adicionais vinculadas`}
              />
            </Stack>
          ) : null}
          {canManagePresident && editing ? (
            <Box
              sx={{
                border: (theme) => `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                Presidente CPCA
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Pesquisa por e-mail/CPF no LDAP com confirmação antes da troca
                do presidente.
              </Typography>
              <Stack spacing={1.2}>
                {!editing?.hasCpca ? (
                  <Typography variant="caption" color="warning.main">
                    Esta OM está com "Possui CPCA = Não". Salve como "Sim" para
                    permitir designação de presidente.
                  </Typography>
                ) : null}
                <TextField
                  size="small"
                  label="E-mail ou CPF (LDAP)"
                  value={presidentIdentifier}
                  onChange={(event) =>
                    setPresidentIdentifier(event.target.value)
                  }
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    void handleLookupPresident();
                  }}
                  disabled={
                    !editing?.hasCpca ||
                    !presidentIdentifier.trim() ||
                    lookupPresidentCandidate.isPending
                  }
                >
                  {lookupPresidentCandidate.isPending
                    ? "Pesquisando..."
                    : "Pesquisar"}
                </Button>
                <TextField
                  size="small"
                  label="Boletim de designação do presidente"
                  value={presidentBulletin}
                  onChange={(event) => setPresidentBulletin(event.target.value)}
                  placeholder="Opcional"
                />

                <Typography variant="caption" color="text.secondary">
                  Presidente atual:{" "}
                  {currentPresident?.user?.name ?? "Não designado"}
                </Typography>
                {currentPresident ? (
                  <Typography variant="caption" color="text.secondary">
                    {currentPresident.assignmentSourceLabel ??
                      "Origem não identificada"}
                    {currentPresident.assignedByUser?.name
                      ? ` por ${currentPresident.assignedByUser.name}`
                      : ""}
                    {currentPresident.assignedAt
                      ? ` em ${new Date(currentPresident.assignedAt).toLocaleString("pt-BR")}`
                      : ""}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  Boletim atual:{" "}
                  {currentPresident?.designationBulletin || "Não informado"}
                </Typography>

                <Box
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    borderRadius: 1.5,
                    p: 1,
                    bgcolor: "grey.50",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Histórico CPCA recente
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: recentCommissionHistory.length ? 1 : 0 }}
                  >
                    Últimos eventos da comissão registrados para esta OM.
                  </Typography>
                  {cpcaOverviewQuery.isLoading ? (
                    <Typography variant="caption" color="text.secondary">
                      Carregando histórico...
                    </Typography>
                  ) : recentCommissionHistory.length > 0 ? (
                    <Stack spacing={1}>
                      {recentCommissionHistory.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            border: (theme) =>
                              `1px solid ${theme.palette.divider}`,
                            borderRadius: 1.5,
                            p: 1,
                            bgcolor: "background.paper",
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                            sx={{ mb: 0.5 }}
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              label={item.actionLabel || "Evento registrado"}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {item.actor?.name || "Sistema"} •{" "}
                              {formatDateTime(item.createdAt)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2">
                            {item.summary || "Alteração registrada na comissão CPCA."}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Ainda não há eventos registrados para esta OM.
                    </Typography>
                  )}
                </Box>

                {presidentCandidate ? (
                  <Box
                    sx={{
                      border: (theme) => `1px dashed ${theme.palette.divider}`,
                      borderRadius: 1.5,
                      p: 1,
                      bgcolor: "background.paper",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Candidato localizado
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {presidentCandidate.profile.name ||
                        presidentCandidate.profile.uid}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      E-mail: {presidentCandidate.profile.email || "—"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      UID: {presidentCandidate.profile.uid}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      OM LDAP: {presidentCandidate.profile.fabom || "—"}
                    </Typography>
                    {presidentCandidate.existingUser ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Usuário no sistema:{" "}
                        {presidentCandidate.existingUser.name}
                      </Typography>
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Usuário será criado automaticamente ao confirmar.
                      </Typography>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ mt: 1 }}
                      onClick={() =>
                        setPendingPresidentConfirm({
                          identifier: presidentCandidate.identifier,
                          localityId: editing.id,
                          designationBulletin:
                            presidentBulletin.trim() || undefined,
                        })
                      }
                      disabled={assignPresident.isPending || !editing?.hasCpca}
                    >
                      Selecionar como presidente
                    </Button>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          ) : null}
          <TextField
            size="small"
            label="Observações"
            value={form.notes}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            multiline
            minRows={3}
            placeholder="Notas administrativas da OM"
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button onClick={closeDrawer}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleSave();
              }}
              disabled={createLocality.isPending || updateLocality.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir OM"
        message="A OM será removida do catálogo, mas os registros relacionados serão preservados. Usuários, denúncias e vínculos de comissão apenas perderão a associação com esta OM."
        note="Esta ação não exclui os itens relacionados. Ela apenas desfaz os relacionamentos com a OM e remove a cobertura CPCA associada."
        severity="warning"
        confirmLabel="Excluir OM"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) void handleDelete(deleteId);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPresidentConfirm)}
        title="Confirmar troca de presidente CPCA"
        message="Ao confirmar, o presidente atual da OM será substituído e o vínculo CPCA anterior será removido."
        highlightText={
          presidentCandidate?.profile?.name ||
          presidentCandidate?.profile?.uid ||
          ""
        }
        severity="warning"
        confirmLabel="Confirmar troca"
        confirmLoading={assignPresident.isPending}
        onCancel={() => setPendingPresidentConfirm(null)}
        onConfirm={() => {
          if (!pendingPresidentConfirm) return;
          void handleAssignPresident(pendingPresidentConfirm);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPresidentOverwrite)}
        title="OM já possui presidente"
        message="Esta OM já possui presidente cadastrado. Deseja registrar ciência e prosseguir com a troca?"
        highlightText={
          currentPresident?.user?.name ?? "Presidente atual já cadastrado"
        }
        severity="warning"
        confirmLabel="Prosseguir"
        confirmLoading={assignPresident.isPending}
        onCancel={() => setPendingPresidentOverwrite(null)}
        onConfirm={() => {
          if (!pendingPresidentOverwrite) return;
          void handleAssignPresident({
            ...pendingPresidentOverwrite,
            proceedWithExistingPresident: true,
          });
        }}
      />
    </Box>
  );
}
