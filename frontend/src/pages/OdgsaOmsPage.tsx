import AddBusinessRoundedIcon from "@mui/icons-material/AddBusinessRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useMyOdgsaOms, useUpdateMyOdgsaOms } from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import {
  filterOdgsaOms,
  getSelectableOdgsaOmIds,
  getSelectedOdgsaOmIdsForAction,
  type OdgsaOmAssignmentStatus,
  type OdgsaOmItem,
} from "../features/odgsaOms";

type BatchConfirmation = {
  action: "ASSIGN" | "UNASSIGN";
  omIds: string[];
} | null;

const STATUS_LABELS: Record<OdgsaOmAssignmentStatus, string> = {
  OWN: "No meu ODGSA",
  UNASSIGNED: "Sem ODGSA",
  OTHER: "Em outro ODGSA",
};

function extractReason(error: unknown) {
  return String(
    (error as { response?: { data?: { details?: { reason?: string } } } })
      ?.response?.data?.details?.reason ?? "",
  );
}

export function OdgsaOmsPage() {
  const toast = useToast();
  const query = useMyOdgsaOms();
  const updateOms = useUpdateMyOdgsaOms();
  const [queryText, setQueryText] = useState("");
  const [uf, setUf] = useState("");
  const [status, setStatus] = useState<"ALL" | OdgsaOmAssignmentStatus>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<BatchConfirmation>(null);

  const items = useMemo(
    () => (query.data?.items ?? []) as OdgsaOmItem[],
    [query.data?.items],
  );
  const odgsa = query.data?.odgsa as
    | { id: string; code: string; name: string; role?: { name?: string } }
    | undefined;
  const filteredItems = useMemo(
    () => filterOdgsaOms(items, { query: queryText, uf, status }),
    [items, queryText, status, uf],
  );
  const ufOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items.map((item) => String(item.uf ?? "").trim()).filter(Boolean),
        ),
      ).sort(),
    [items],
  );
  const selectableFilteredIds = useMemo(
    () => getSelectableOdgsaOmIds(filteredItems),
    [filteredItems],
  );
  const effectiveSelectedIds = useMemo(() => {
    const validIds = new Set(
      items
        .filter((item) => item.assignmentStatus !== "OTHER")
        .map((item) => item.id),
    );
    return new Set(Array.from(selectedIds).filter((id) => validIds.has(id)));
  }, [items, selectedIds]);
  const selectedAssignIds = useMemo(
    () => getSelectedOdgsaOmIdsForAction(items, effectiveSelectedIds, "ASSIGN"),
    [effectiveSelectedIds, items],
  );
  const selectedUnassignIds = useMemo(
    () =>
      getSelectedOdgsaOmIdsForAction(items, effectiveSelectedIds, "UNASSIGN"),
    [effectiveSelectedIds, items],
  );
  const ownCount = items.filter(
    (item) => item.assignmentStatus === "OWN",
  ).length;
  const unassignedCount = items.filter(
    (item) => item.assignmentStatus === "UNASSIGNED",
  ).length;
  const otherCount = items.length - ownCount - unassignedCount;
  const selectedVisibleCount = selectableFilteredIds.filter((id) =>
    effectiveSelectedIds.has(id),
  ).length;
  const allVisibleSelected =
    selectableFilteredIds.length > 0 &&
    selectedVisibleCount === selectableFilteredIds.length;

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        selectableFilteredIds.forEach((id) => next.delete(id));
      } else {
        selectableFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBatch = async () => {
    if (!confirmation) return;
    try {
      const result = await updateOms.mutateAsync(confirmation);
      toast.push({
        message:
          confirmation.action === "ASSIGN"
            ? `${Number(result?.updatedCount ?? 0)} OM(s) incluída(s) no ODGSA.`
            : `${Number(result?.updatedCount ?? 0)} OM(s) removida(s) do ODGSA.`,
        severity: "success",
      });
      setSelectedIds(new Set());
      setConfirmation(null);
    } catch (error) {
      const reason = extractReason(error);
      toast.push({
        message:
          reason === "OM_ALREADY_ASSIGNED_TO_ANOTHER_ODGSA"
            ? "Uma das OMs selecionadas acabou de ser vinculada a outro ODGSA. Atualize a lista e tente novamente."
            : (parseApiError(error).message ??
              "Não foi possível atualizar as OMs."),
        severity: "error",
      });
      void query.refetch();
    }
  };

  if (query.isLoading) return <SkeletonState />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          OMs do meu ODGSA
        </Typography>
        <Typography color="text.secondary">
          {odgsa
            ? `${odgsa.code} — ${odgsa.name}`
            : "Escopo de acompanhamento CPCA"}
        </Typography>
      </Box>

      {ownCount === 0 && (
        <Alert severity="info">
          Este ODGSA ainda não possui OMs. Enquanto a lista estiver vazia, as
          telas de denúncias e indicadores CPCA não exibirão registros.
        </Alert>
      )}

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, 1fr)" }}
        gap={1.5}
      >
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              No meu ODGSA
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {ownCount}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              Disponíveis
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {unassignedCount}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              Em outros ODGSA
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {otherCount}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Buscar OM"
              placeholder="Código, nome ou UF"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>UF</InputLabel>
              <Select
                value={uf}
                label="UF"
                onChange={(event) => setUf(event.target.value)}
              >
                <MenuItem value="">Todas</MenuItem>
                {ufOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <InputLabel>Situação</InputLabel>
              <Select
                value={status}
                label="Situação"
                onChange={(event) =>
                  setStatus(
                    event.target.value as "ALL" | OdgsaOmAssignmentStatus,
                  )
                }
              >
                <MenuItem value="ALL">Todas</MenuItem>
                <MenuItem value="OWN">No meu ODGSA</MenuItem>
                <MenuItem value="UNASSIGNED">Sem ODGSA</MenuItem>
                <MenuItem value="OTHER">Em outro ODGSA</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <Box
          px={2}
          py={1.5}
          display="flex"
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          flexDirection={{ xs: "column", md: "row" }}
          gap={1}
          borderBottom="1px solid"
          borderColor="divider"
        >
          <Typography variant="body2" color="text.secondary">
            {filteredItems.length} OM(s) encontrada(s) ·{" "}
            {effectiveSelectedIds.size} selecionada(s)
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddBusinessRoundedIcon />}
              disabled={selectedAssignIds.length === 0}
              onClick={() =>
                setConfirmation({ action: "ASSIGN", omIds: selectedAssignIds })
              }
            >
              Incluir ({selectedAssignIds.length})
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepRoundedIcon />}
              disabled={selectedUnassignIds.length === 0}
              onClick={() =>
                setConfirmation({
                  action: "UNASSIGN",
                  omIds: selectedUnassignIds,
                })
              }
            >
              Remover ({selectedUnassignIds.length})
            </Button>
          </Stack>
        </Box>

        {filteredItems.length === 0 ? (
          <EmptyState
            title="Nenhuma OM encontrada"
            description="Ajuste os filtros para localizar as OMs desejadas."
          />
        ) : (
          <TableContainer sx={{ maxHeight: "62vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={
                        selectedVisibleCount > 0 && !allVisibleSelected
                      }
                      disabled={selectableFilteredIds.length === 0}
                      onChange={toggleAllVisible}
                      inputProps={{ "aria-label": "Selecionar OMs filtradas" }}
                    />
                  </TableCell>
                  <TableCell>Código</TableCell>
                  <TableCell>Organização Militar</TableCell>
                  <TableCell>UF</TableCell>
                  <TableCell>Situação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((item) => {
                  const unavailable = item.assignmentStatus === "OTHER";
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      selected={effectiveSelectedIds.has(item.id)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={effectiveSelectedIds.has(item.id)}
                          disabled={unavailable}
                          onChange={() => toggleOne(item.id)}
                          inputProps={{
                            "aria-label": `Selecionar ${item.code}`,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {item.code}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.uf || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={STATUS_LABELS[item.assignmentStatus]}
                          color={
                            item.assignmentStatus === "OWN"
                              ? "primary"
                              : item.assignmentStatus === "UNASSIGNED"
                                ? "default"
                                : "warning"
                          }
                          variant={
                            item.assignmentStatus === "OWN"
                              ? "filled"
                              : "outlined"
                          }
                        />
                        {item.assignmentStatus === "OTHER" &&
                          item.assignedOdgsa && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {item.assignedOdgsa.code}
                            </Typography>
                          )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation?.action === "ASSIGN"
            ? "Incluir OMs no ODGSA?"
            : "Remover OMs do ODGSA?"
        }
        message={
          confirmation?.action === "ASSIGN"
            ? "As denúncias dessas OMs passarão a compor o acompanhamento e os indicadores do seu ODGSA."
            : "As OMs ficarão sem ODGSA e suas denúncias deixarão de aparecer no seu acompanhamento."
        }
        highlightText={`${confirmation?.omIds.length ?? 0} OM(s) selecionada(s)`}
        severity={confirmation?.action === "UNASSIGN" ? "warning" : "primary"}
        confirmLabel={confirmation?.action === "ASSIGN" ? "Incluir" : "Remover"}
        confirmLoading={updateOms.isPending}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmBatch()}
      />
    </Stack>
  );
}
