import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useCreateOrgChartAssignment,
  useCreateElo,
  useDeleteOrgChartAssignment,
  useDeleteElo,
  useEloRoles,
  useElos,
  useLocalities,
  useOmsCatalog,
  useOrgChart,
  useOrgChartCandidates,
  useUpdateOrgChartAssignment,
  useUpdateElo,
  useMe,
} from "../api/hooks";
import { FiltersBar } from "../components/filters/FiltersBar";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { useToast } from "../app/toast";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import {
  normalizeLocalityName,
  selectTargetLocalities,
} from "../constants/localities";

export function ElosPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { data: me } = useMe();
  const localityId = params.get("localityId") ?? "";
  const roleType = params.get("roleType") ?? "";

  const filters = useMemo(
    () => ({
      localityId: localityId || undefined,
      roleType: roleType || undefined,
    }),
    [localityId, roleType],
  );

  const elosQuery = useElos(filters);
  const elosAllQuery = useElos({}); // para montar mapa graduado master por localidade
  const localitiesQuery = useLocalities();
  const omsCatalogQuery = useOmsCatalog();
  const eloRolesQuery = useEloRoles();
  const createElo = useCreateElo();
  const createOrgChartAssignment = useCreateOrgChartAssignment();
  const updateOrgChartAssignment = useUpdateOrgChartAssignment();
  const deleteOrgChartAssignment = useDeleteOrgChartAssignment();
  const canManageOrgChart =
    can(me, "org_chart", "create") ||
    can(me, "org_chart", "update") ||
    can(me, "org_chart", "delete");

  const gradMasterByLocalityId = useMemo(() => {
    const map = new Map<string, string>();
    (elosAllQuery.data?.items ?? []).forEach((elo: any) => {
      if (elo.eloRole?.code === "GRAD_MASTER" && elo.localityId)
        map.set(elo.localityId, elo.name ?? "");
    });
    return map;
  }, [elosAllQuery.data?.items]);

  const eloRoles = eloRolesQuery.data?.items ?? [];
  const updateElo = useUpdateElo();
  const deleteElo = useDeleteElo();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);
  const [showAllLocalities, setShowAllLocalities] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [orgCandidateSearch, setOrgCandidateSearch] = useState("");
  const [orgEditingGroup, setOrgEditingGroup] = useState<any | null>(null);
  const [orgForm, setOrgForm] = useState({
    id: "",
    localityId: "",
    eloRoleId: "",
    userId: "",
    rank: "",
    phone: "",
    om: "",
    autoFromUser: false,
  });
  const [form, setForm] = useState({
    localityId: "",
    eloRoleId: "",
    name: "",
    rank: "",
    phone: "",
    email: "",
    om: "",
  });

  const orgChartQuery = useOrgChart({
    localityId: localityId || undefined,
    roleType: roleType || undefined,
  });
  const orgChartCandidatesQuery = useOrgChartCandidates(
    {
      localityId: orgForm.localityId || undefined,
      eloRoleId: orgForm.eloRoleId || undefined,
      q: orgCandidateSearch || undefined,
    },
    orgDrawerOpen && canManageOrgChart && Boolean(orgForm.localityId && orgForm.eloRoleId),
  );

  const allLocalities = localitiesQuery.data?.items ?? [];
  const uniqueLocalities = useMemo(() => {
    return selectTargetLocalities(allLocalities as any[]).sort((a: any, b: any) =>
      String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
    );
  }, [allLocalities]);

  const localitiesWithRecruits = useMemo(
    () =>
      uniqueLocalities.filter(
        (locality: any) =>
          Number(locality?.recruitsFemaleCountCurrent ?? 0) > 0,
      ),
    [uniqueLocalities],
  );

  const omOptions = useMemo(() => {
    const items = (omsCatalogQuery.data?.items ?? []) as any[];
    const base = items.map((item) => ({
      value: String(item.name ?? "").trim(),
      label: String(item.code ?? "").trim()
        ? `${String(item.code).trim()} - ${String(item.name ?? "").trim()}`
        : String(item.name ?? "").trim(),
    })).filter((item) => item.value);

    const withCurrentValues = new Map(base.map((item) => [item.value, item]));
    for (const fallback of [form.om, orgForm.om]) {
      const value = String(fallback ?? "").trim();
      if (value && !withCurrentValues.has(value)) {
        withCurrentValues.set(value, { value, label: value });
      }
    }
    return Array.from(withCurrentValues.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }, [form.om, orgForm.om, omsCatalogQuery.data?.items]);

  const selectableLocalities = useMemo(() => {
    const base = showAllLocalities ? uniqueLocalities : localitiesWithRecruits;
    const byId = new Map<string, any>();

    for (const locality of base) {
      const id = String(locality?.id ?? "").trim();
      if (!id) continue;
      byId.set(id, locality);
    }

    for (const preservedId of [localityId, form.localityId]) {
      const id = String(preservedId ?? "").trim();
      if (!id || byId.has(id)) continue;
      const found = uniqueLocalities.find(
        (locality: any) => String(locality?.id ?? "") === id,
      );
      if (found) byId.set(id, found);
    }

    return Array.from(byId.values()).sort((a: any, b: any) =>
      String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
    );
  }, [
    form.localityId,
    localityId,
    localitiesWithRecruits,
    showAllLocalities,
    uniqueLocalities,
  ]);

  const updateParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }, [params, setParams]);

  const clearFilters = useCallback(() => setParams({}), [setParams]);

  useEffect(() => {
    if (showAllLocalities || !localityId) return;
    const exists = localitiesWithRecruits.some(
      (locality: any) => String(locality?.id ?? "") === localityId,
    );
    if (!exists) {
      updateParam("localityId", "");
    }
  }, [localityId, localitiesWithRecruits, showAllLocalities, updateParam]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      localityId: "",
      eloRoleId: eloRoles[0]?.id ?? "",
      name: "",
      rank: "",
      phone: "",
      email: "",
      om: "",
    });
    setDrawerOpen(true);
  };

  const openEdit = (elo: any) => {
    setEditing(elo);
    setForm({
      localityId: elo.localityId,
      eloRoleId: elo.eloRoleId ?? elo.eloRole?.id ?? "",
      name: elo.name ?? "",
      rank: elo.rank ?? "",
      phone: elo.phone ?? "",
      email: elo.email ?? "",
      om: elo.om ?? "",
    });
    setDrawerOpen(true);
  };

  const openOrgCreate = (group: any) => {
    setOrgCandidateSearch("");
    setOrgEditingGroup(group);
    setOrgForm({
      id: "",
      localityId: group.localityId ?? "",
      eloRoleId: eloRoles[0]?.id ?? "",
      userId: "",
      rank: "",
      phone: "",
      om: "",
      autoFromUser: false,
    });
    setOrgDrawerOpen(true);
  };

  const openOrgEdit = (group: any, elo: any) => {
    setOrgCandidateSearch("");
    setOrgEditingGroup(group);
    setOrgForm({
      id: elo.id ?? "",
      localityId: elo.localityId ?? group.localityId ?? "",
      eloRoleId: elo.eloRoleId ?? elo.eloRole?.id ?? "",
      userId: elo.systemUser?.id ?? "",
      rank: elo.rank ?? "",
      phone: elo.phone ?? "",
      om: elo.om ?? "",
      autoFromUser: Boolean(elo.autoFromUser),
    });
    setOrgDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        localityId: form.localityId,
        eloRoleId: form.eloRoleId,
        name: form.name,
        rank: form.rank || null,
        phone: form.phone || null,
        email: form.email || null,
        om: form.om || null,
      };
      if (editing) {
        await updateElo.mutateAsync({ id: editing.id, payload });
        toast.push({ message: "Elo atualizado", severity: "success" });
      } else {
        await createElo.mutateAsync(payload);
        toast.push({ message: "Elo criado", severity: "success" });
      }
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao salvar elo",
        severity: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteElo.mutateAsync(id);
      toast.push({ message: "Elo removido", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao remover elo",
        severity: "error",
      });
    }
  };

  const handleSaveOrgAssignment = async () => {
    if (!orgForm.localityId || !orgForm.eloRoleId || !orgForm.userId) {
      toast.push({
        message: "Selecione localidade, função e usuário para o vínculo.",
        severity: "warning",
      });
      return;
    }

    const payload = {
      localityId: orgForm.localityId,
      eloRoleId: orgForm.eloRoleId,
      userId: orgForm.userId,
      rank: orgForm.rank || null,
      phone: orgForm.phone || null,
      om: orgForm.om || null,
    };

    try {
      if (!orgForm.id || orgForm.autoFromUser || orgForm.id.startsWith("auto-user-")) {
        await createOrgChartAssignment.mutateAsync(payload);
        toast.push({ message: "Vínculo criado no organograma.", severity: "success" });
      } else {
        await updateOrgChartAssignment.mutateAsync({ id: orgForm.id, payload });
        toast.push({ message: "Vínculo do organograma atualizado.", severity: "success" });
      }
      setOrgDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao salvar vínculo do organograma.",
        severity: "error",
      });
    }
  };

  const handleDeleteOrgAssignment = async () => {
    if (!orgForm.id || orgForm.id.startsWith("auto-user-")) return;
    try {
      await deleteOrgChartAssignment.mutateAsync(orgForm.id);
      toast.push({ message: "Vínculo removido do organograma.", severity: "success" });
      setOrgDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao remover vínculo do organograma.",
        severity: "error",
      });
    }
  };

  const canCreate = can(me, "elos", "create");
  const canUpdate = can(me, "elos", "update");
  const canDelete = can(me, "elos", "delete");
  const canViewOrgChart = can(me, "org_chart", "view");
  const renderedItems = useMemo(() => {
    const items = elosQuery.data?.items ?? [];
    if (showAllLocalities) return items;
    const localityIds = new Set(
      localitiesWithRecruits.map((locality: any) =>
        String(locality?.id ?? "").trim(),
      ),
    );
    const localityNameKeys = new Set(
      localitiesWithRecruits
        .map((locality: any) => normalizeLocalityName(locality?.name))
        .filter(Boolean),
    );
    return items.filter((elo: any) => {
      const eloLocalityId = String(elo?.localityId ?? "").trim();
      if (eloLocalityId && localityIds.has(eloLocalityId)) return true;
      const eloLocalityNameKey = normalizeLocalityName(elo?.locality?.name);
      return Boolean(
        eloLocalityNameKey && localityNameKeys.has(eloLocalityNameKey),
      );
    });
  }, [elosQuery.data?.items, localitiesWithRecruits, showAllLocalities]);
  const orgChartItems = (orgChartQuery.data?.items ?? []) as any[];

  if (elosQuery.isLoading) return <SkeletonState />;
  if (elosQuery.isError)
    return (
      <ErrorState error={elosQuery.error} onRetry={() => elosQuery.refetch()} />
    );

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h4">Elos</Typography>
        {canCreate && (
          <Button variant="contained" onClick={openCreate}>
            Novo elo
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FiltersBar
            localityId={localityId}
            onLocalityChange={(value) => updateParam("localityId", value)}
            localities={selectableLocalities.map((l: any) => ({
              id: l.id,
              name: l.name,
            }))}
            onClear={clearFilters}
          />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={2}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={showAllLocalities}
                  onChange={(event) =>
                    setShowAllLocalities(event.target.checked)
                  }
                />
              }
              label="Mostrar todas as localidades"
              sx={{ mr: 0 }}
            />
            <TextField
              select
              size="small"
              label="Tipo de elo"
              value={roleType}
              onChange={(e) => updateParam("roleType", e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {eloRoles.map((r: any) => (
                <MenuItem key={r.id} value={r.code}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {renderedItems.length === 0 && (
        <EmptyState
          title="Nenhum elo cadastrado"
          description="Cadastre os contatos das localidades."
        />
      )}

      {renderedItems.length > 0 && (
        <Card>
          <CardContent>
            <Box
              component="table"
              width="100%"
              sx={{ borderCollapse: "collapse" }}
            >
              <Box component="thead">
                <Box component="tr">
                  {[
                    "Localidade",
                    "Graduado Master",
                    "Papel",
                    "Nome",
                    "OM",
                    "Telefone",
                    "Email",
                    "Ações",
                  ].map((header) => (
                    <Box
                      key={header}
                      component="th"
                      sx={{
                        textAlign: "left",
                        px: 1.2,
                        py: 1.15,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        bgcolor: "rgb(23, 57, 75)",
                      }}
                    >
                      {header}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {renderedItems.map((elo: any) => (
                  <Box
                    key={elo.id}
                    component="tr"
                    sx={{ borderTop: "1px solid #E6ECF5" }}
                  >
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.locality?.name ?? elo.localityId}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {gradMasterByLocalityId.get(elo.localityId) ?? "—"}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.eloRole?.name ?? elo.eloRole?.code ?? "—"}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.name}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.om ?? "-"}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.phone ?? "-"}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {elo.email ?? "-"}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {canUpdate && (
                        <Button size="small" onClick={() => openEdit(elo)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(elo.id)}
                        >
                          Excluir
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {canViewOrgChart && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Box>
                <Typography variant="h6">Vínculos do Organograma</Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestão operacional do organograma foi movida para Elos, mantendo os mesmos dados.
                </Typography>
              </Box>
            </Stack>

            {orgChartQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Carregando vínculos do organograma...
              </Typography>
            ) : orgChartQuery.isError ? (
              <Typography variant="body2" color="error.main">
                Não foi possível carregar os vínculos do organograma.
              </Typography>
            ) : orgChartItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum vínculo encontrado para os filtros atuais.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {orgChartItems.map((group: any) => (
                  <Card key={group.localityId ?? group.localityName} variant="outlined">
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle1">{group.localityName}</Typography>
                        {canManageOrgChart && (
                          <Button size="small" variant="outlined" onClick={() => openOrgCreate(group)}>
                            Vincular usuário
                          </Button>
                        )}
                      </Stack>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
                        {(group.elos ?? []).map((elo: any) => (
                          <Card key={elo.id} variant="outlined" sx={{ minWidth: 220 }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2">{elo.name ?? "Contato"}</Typography>
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                                {elo.eloRole?.name ?? elo.eloRole?.code ?? "—"}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {elo.om ?? "-"}
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
                              {canManageOrgChart && (
                                <Button
                                  size="small"
                                  variant="text"
                                  sx={{ mt: 1 }}
                                  onClick={() => openOrgEdit(group, elo)}
                                >
                                  {elo.autoFromUser ? "Adicionar ao organograma" : "Editar vínculo"}
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
            )}
          </CardContent>
        </Card>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", md: 420 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5">
            {editing ? "Editar elo" : "Novo elo"}
          </Typography>
          <TextField
            select
            size="small"
            label="Localidade"
            value={form.localityId}
            onChange={(e) => setForm({ ...form, localityId: e.target.value })}
          >
            {selectableLocalities.map((l: any) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Tipo de elo"
            value={form.eloRoleId}
            onChange={(e) => setForm({ ...form, eloRoleId: e.target.value })}
            fullWidth
          >
            {eloRoles.map((r: any) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name} ({r.code})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            size="small"
            label="Posto/Grad"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
          />
          <TextField
            size="small"
            label="Telefone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            size="small"
            label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="OM (PM)"
            value={form.om}
            onChange={(e) => setForm({ ...form, om: e.target.value })}
            helperText="Selecione uma OM cadastrada no CRUD de OMs."
          >
            <MenuItem value="">Selecionar</MenuItem>
            {omOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSave}>
              Salvar
            </Button>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={orgDrawerOpen}
        onClose={() => setOrgDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", md: 440 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">
            {orgForm.id && !orgForm.autoFromUser ? "Editar vínculo do organograma" : "Novo vínculo do organograma"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Localidade: {orgEditingGroup?.localityName ?? "—"}
          </Typography>

          <TextField
            select
            size="small"
            label="Localidade"
            value={orgForm.localityId}
            onChange={(e) => setOrgForm((prev) => ({ ...prev, localityId: e.target.value }))}
          >
            {selectableLocalities.map((loc: any) => (
              <MenuItem key={loc.id} value={loc.id}>
                {loc.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Função"
            value={orgForm.eloRoleId}
            onChange={(e) => setOrgForm((prev) => ({ ...prev, eloRoleId: e.target.value }))}
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
            value={orgCandidateSearch}
            onChange={(e) => setOrgCandidateSearch(e.target.value)}
          />

          <TextField
            select
            size="small"
            label="Usuário do sistema"
            value={orgForm.userId}
            onChange={(e) => setOrgForm((prev) => ({ ...prev, userId: e.target.value }))}
            helperText="Somente usuários com função/localidade compatíveis."
          >
            {(orgChartCandidatesQuery.data?.items ?? []).map((item: any) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name} - {item.email}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Posto/Graduação"
            value={orgForm.rank}
            onChange={(e) => setOrgForm((prev) => ({ ...prev, rank: e.target.value }))}
          />
          <TextField
            size="small"
            label="Telefone"
            value={orgForm.phone}
            onChange={(e) => setOrgForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <TextField
            select
            size="small"
            label="OM (PM)"
            value={orgForm.om}
            onChange={(e) => setOrgForm((prev) => ({ ...prev, om: e.target.value }))}
            helperText="Selecione uma OM cadastrada no CRUD de OMs."
          >
            <MenuItem value="">Selecionar</MenuItem>
            {omOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {orgForm.id && !orgForm.id.startsWith("auto-user-") && (
              <Button color="error" onClick={handleDeleteOrgAssignment} disabled={deleteOrgChartAssignment.isPending}>
                Remover
              </Button>
            )}
            <Button variant="text" onClick={() => setOrgDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveOrgAssignment}
              disabled={createOrgChartAssignment.isPending || updateOrgChartAssignment.isPending}
            >
              Salvar
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
