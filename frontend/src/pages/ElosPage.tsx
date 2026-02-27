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
  useCreateElo,
  useDeleteElo,
  useEloRoles,
  useElos,
  useLocalities,
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
  const eloRolesQuery = useEloRoles();
  const createElo = useCreateElo();

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
  const [showAllLocalities, setShowAllLocalities] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    localityId: "",
    eloRoleId: "",
    name: "",
    rank: "",
    phone: "",
    email: "",
    om: "",
  });

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

  const canCreate = can(me, "elos", "create");
  const canUpdate = can(me, "elos", "update");
  const canDelete = can(me, "elos", "delete");
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
            size="small"
            label="OM"
            value={form.om}
            onChange={(e) => setForm({ ...form, om: e.target.value })}
          />
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
    </Box>
  );
}
