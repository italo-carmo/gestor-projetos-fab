import {
  Box,
  Button,
  Card,
  CardContent,
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ReportGmailerrorredRoundedIcon from "@mui/icons-material/ReportGmailerrorredRounded";
import { useMemo, useState } from "react";
import { parseApiError } from "../app/apiErrors";
import {
  hasAnyRole,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from "../app/roleAccess";
import { useToast } from "../app/toast";
import {
  useCreateSmifComplaint,
  useMe,
  useOmsCatalog,
  useSmifComplaints,
  useUpdateSmifComplaint,
} from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

const APP_HEADER_HEIGHT = 96;

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
};

const STATUS_COLOR: Record<string, "warning" | "success"> = {
  IN_PROGRESS: "warning",
  COMPLETED: "success",
};

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

type SmifComplaintItem = {
  id: string;
  localityId: string;
  reportedAt: string;
  description: string;
  status: "IN_PROGRESS" | "COMPLETED";
  conclusion?: string | null;
  createdAt: string;
  locality?: { id: string; code?: string | null; name: string } | null;
};

export function SmifComplaintsPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [localityIdFilter, setLocalityIdFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SmifComplaintItem | null>(null);
  const [form, setForm] = useState({
    localityId: "",
    reportedAt: toDateInput(new Date()),
    description: "",
    status: "IN_PROGRESS" as "IN_PROGRESS" | "COMPLETED",
    conclusion: "",
  });

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      status: status || undefined,
      localityId: localityIdFilter || undefined,
    }),
    [q, status, localityIdFilter],
  );

  const complaintsQuery = useSmifComplaints(filters, canManage);
  const omsCatalogQuery = useOmsCatalog(canManage);
  const createComplaint = useCreateSmifComplaint();
  const updateComplaint = useUpdateSmifComplaint();

  const omOptions = useMemo(
    () =>
      ((omsCatalogQuery.data?.items ?? []) as any[])
        .map((item) => ({
          id: String(item?.id ?? "").trim(),
          code: String(item?.code ?? "").trim(),
          name: String(item?.name ?? "").trim(),
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((item) => ({
          id: item.id,
          label:
            item.code &&
            item.code.localeCompare(item.name, "pt-BR", {
              sensitivity: "accent",
            }) !== 0
              ? `${item.code} - ${item.name}`
              : item.name,
        })),
    [omsCatalogQuery.data?.items],
  );

  if (!canManage) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Somente os perfis TI e Coordenação CIPAVD podem acessar denúncias SMIF."
      />
    );
  }

  if (complaintsQuery.isLoading || omsCatalogQuery.isLoading)
    return <SkeletonState />;

  if (complaintsQuery.isError) {
    return (
      <ErrorState
        error={complaintsQuery.error}
        onRetry={() => complaintsQuery.refetch()}
      />
    );
  }

  if (omsCatalogQuery.isError) {
    return (
      <ErrorState
        error={omsCatalogQuery.error}
        onRetry={() => omsCatalogQuery.refetch()}
      />
    );
  }

  const items = (complaintsQuery.data?.items ?? []) as SmifComplaintItem[];

  const openCreate = () => {
    setEditing(null);
    setForm({
      localityId: "",
      reportedAt: toDateInput(new Date()),
      description: "",
      status: "IN_PROGRESS",
      conclusion: "",
    });
    setDrawerOpen(true);
  };

  const openEdit = (item: SmifComplaintItem) => {
    setEditing(item);
    setForm({
      localityId: String(item.localityId ?? ""),
      reportedAt: toDateInput(item.reportedAt),
      description: String(item.description ?? ""),
      status: item.status ?? "IN_PROGRESS",
      conclusion: String(item.conclusion ?? ""),
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!form.localityId) {
        toast.push({
          message: "Selecione a OM do ocorrido.",
          severity: "warning",
        });
        return;
      }
      if (!form.reportedAt) {
        toast.push({
          message: "Informe a data da comunicação do fato.",
          severity: "warning",
        });
        return;
      }
      if (!form.description.trim()) {
        toast.push({
          message: "Preencha a descrição geral.",
          severity: "warning",
        });
        return;
      }

      const payload = {
        localityId: form.localityId,
        reportedAt: form.reportedAt,
        description: form.description,
        status: form.status,
        conclusion: form.conclusion,
      };

      if (editing) {
        await updateComplaint.mutateAsync({ id: editing.id, payload });
        toast.push({ message: "Denúncia atualizada.", severity: "success" });
      } else {
        await createComplaint.mutateAsync(payload);
        toast.push({ message: "Denúncia registrada.", severity: "success" });
      }

      setDrawerOpen(false);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao salvar denúncia.",
        severity: "error",
      });
    }
  };

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={1.5}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <ReportGmailerrorredRoundedIcon color="warning" />
                <Typography variant="h6">
                  Denúncias de Assédio (SMIF)
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Registro e acompanhamento de denúncias no contexto do SMIF.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={openCreate}
            >
              Nova denúncia
            </Button>
          </Stack>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ mt: 2 }}
          >
            <TextField
              size="small"
              label="Buscar"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Descrição, conclusão ou OM"
              fullWidth
            />
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="IN_PROGRESS">Em andamento</MenuItem>
              <MenuItem value="COMPLETED">Concluído</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="OM"
              value={localityIdFilter}
              onChange={(event) => setLocalityIdFilter(event.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {omOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma denúncia registrada"
              description="Use o botão Nova denúncia para iniciar um registro."
            />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>OM</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Data da comunicação
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      hover
                      onClick={() => openEdit(item)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        {item.locality?.name ?? item.localityId}
                      </TableCell>
                      <TableCell>
                        {toDateInput(item.reportedAt)
                          .split("-")
                          .reverse()
                          .join("/")}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={STATUS_LABEL[item.status] ?? item.status}
                          color={STATUS_COLOR[item.status] ?? "warning"}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 520 },
            mt: `${APP_HEADER_HEIGHT}px`,
            height: `calc(100% - ${APP_HEADER_HEIGHT}px)`,
          },
        }}
      >
        <Box p={3} sx={{ height: "100%", overflowY: "auto" }}>
          <Stack spacing={2}>
            <Typography variant="h6">
              {editing ? "Editar denúncia" : "Nova denúncia"}
            </Typography>

            <TextField
              select
              size="small"
              label="Local do ocorrido (OM)"
              value={form.localityId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, localityId: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="">Selecione</MenuItem>
              {omOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              type="date"
              label="Data da comunicação do fato"
              value={form.reportedAt}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, reportedAt: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              size="small"
              label="Descrição geral"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              multiline
              minRows={4}
              fullWidth
            />

            <TextField
              select
              size="small"
              label="Status"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as "IN_PROGRESS" | "COMPLETED",
                }))
              }
              fullWidth
            >
              <MenuItem value="IN_PROGRESS">Em andamento</MenuItem>
              <MenuItem value="COMPLETED">Concluído</MenuItem>
            </TextField>

            <TextField
              size="small"
              label="Conclusão"
              value={form.conclusion}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, conclusion: event.target.value }))
              }
              multiline
              minRows={3}
              fullWidth
            />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="text" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={
                  createComplaint.isPending || updateComplaint.isPending
                }
              >
                Salvar
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </Stack>
  );
}
