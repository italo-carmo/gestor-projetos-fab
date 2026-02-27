import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  MenuItem,
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
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { ChipProps } from "@mui/material";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuditLogs, useLocalities } from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type AuditLogItem = {
  id: string;
  resource?: string | null;
  action?: string | null;
  createdAt?: string | null;
  userId?: string | null;
  entityId?: string | null;
  diffJson?: unknown;
  localityId?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  locality?: {
    code?: string | null;
    name?: string | null;
  } | null;
};

type LocalityOption = {
  id: string;
  name: string;
};

function actionColor(action: string): ChipProps["color"] {
  const normalized = String(action ?? "")
    .trim()
    .toLowerCase();
  if (["create", "add", "insert", "import"].includes(normalized))
    return "success";
  if (["update", "edit", "change", "assign"].includes(normalized))
    return "info";
  if (["delete", "remove", "revoke", "archive"].includes(normalized))
    return "error";
  if (["export", "login", "view", "read"].includes(normalized))
    return "warning";
  return "default";
}

function prettyJson(value: unknown) {
  if (!value) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeDiff(value: unknown) {
  if (!value) return "Sem alterações detalhadas";
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return "Sem alterações detalhadas";
    const preview = keys.slice(0, 3).join(", ");
    return keys.length > 3 ? `${preview} +${keys.length - 3}` : preview;
  }
  return String(value);
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const resource = params.get("resource") ?? "";
  const userId = params.get("userId") ?? "";
  const localityId = params.get("localityId") ?? "";
  const entityId = params.get("entityId") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(10, Number(params.get("pageSize") ?? "20") || 20),
  );

  const filters = useMemo(
    () => ({
      resource: resource || undefined,
      userId: userId || undefined,
      localityId: localityId || undefined,
      entityId: entityId || undefined,
      from: from || undefined,
      to: to || undefined,
      page: String(page),
      pageSize: String(pageSize),
    }),
    [resource, userId, localityId, entityId, from, to, page, pageSize],
  );

  const auditQuery = useAuditLogs(filters);
  const localitiesQuery = useLocalities();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") {
      next.set("page", "1");
    }
    setParams(next);
  };

  const clearFilters = () =>
    setParams({ page: "1", pageSize: String(pageSize) }, { replace: true });

  if (auditQuery.isLoading) return <SkeletonState />;
  if (auditQuery.isError) {
    return (
      <ErrorState
        error={auditQuery.error}
        onRetry={() => auditQuery.refetch()}
      />
    );
  }

  const items = (auditQuery.data?.items ?? []) as AuditLogItem[];
  const total = Number(auditQuery.data?.total ?? 0);
  const currentPage = Number(auditQuery.data?.page ?? page);
  const currentPageSize = Number(auditQuery.data?.pageSize ?? pageSize);
  const totalPages = Math.max(1, Math.ceil(total / currentPageSize));
  const activeFiltersCount = [
    resource,
    userId,
    localityId,
    entityId,
    from,
    to,
  ].filter(Boolean).length;

  const distinctResources = new Set(
    items.map((item) => String(item.resource ?? "").trim()).filter(Boolean),
  ).size;
  const distinctUsers = new Set(
    items.map((item) => String(item.userId ?? "").trim()).filter(Boolean),
  ).size;
  const lastEventAt = items.length ? String(items[0]?.createdAt ?? "") : "";
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("pt-BR");

  return (
    <Box>
      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
          background:
            "linear-gradient(120deg, rgba(12,101,126,0.14), rgba(12,101,126,0.04) 65%, rgba(197,106,43,0.08))",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.4}>
                <RuleRoundedIcon color="primary" />
                <Typography variant="h4" fontWeight={800}>
                  Auditoria
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Trilhas de rastreabilidade para ações críticas do sistema.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={<InsightsRoundedIcon />}
                label={`Eventos: ${total}`}
                color="primary"
                variant="filled"
              />
              <Chip
                label={`Recursos no recorte: ${distinctResources}`}
                variant="outlined"
              />
              <Chip
                label={`Usuários no recorte: ${distinctUsers}`}
                variant="outlined"
              />
              <Chip
                label={`Filtros ativos: ${activeFiltersCount}`}
                variant="outlined"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
            mb={1}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterAltRoundedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Filtros e navegação
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshRoundedIcon />}
                onClick={() => auditQuery.refetch()}
              >
                Atualizar
              </Button>
              <Button size="small" variant="text" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(4, minmax(0, 1fr))",
                xl: "repeat(8, minmax(0, 1fr))",
              },
              gap: 1,
            }}
          >
            <TextField
              size="small"
              label="Recurso"
              value={resource}
              onChange={(e) => updateParam("resource", e.target.value)}
            />
            <TextField
              size="small"
              label="ID do usuário"
              value={userId}
              onChange={(e) => updateParam("userId", e.target.value)}
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(e) => updateParam("localityId", e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {((localitiesQuery.data?.items ?? []) as LocalityOption[]).map(
                (loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ),
              )}
            </TextField>
            <TextField
              size="small"
              label="Entidade (ID)"
              value={entityId}
              onChange={(e) => updateParam("entityId", e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => updateParam("from", e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => updateParam("to", e.target.value)}
            />
            <TextField
              select
              size="small"
              label="Itens por página"
              value={String(currentPageSize)}
              onChange={(e) => updateParam("pageSize", e.target.value)}
            >
              {[10, 20, 50, 100].map((size) => (
                <MenuItem key={size} value={String(size)}>
                  {size}
                </MenuItem>
              ))}
            </TextField>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: { xs: "flex-start", xl: "flex-end" },
              }}
            >
              <Chip
                size="small"
                label={`Página ${currentPage} de ${totalPages}`}
                variant="outlined"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado"
          description="Ajuste os filtros para visualizar outros registros de auditoria."
        />
      ) : (
        <Card
          sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <TableContainer sx={{ maxHeight: "68vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: "grey.100" }}>
                    Data/Hora
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: "grey.100" }}>
                    Recurso
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: "grey.100" }}>
                    Ação
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: "grey.100" }}>
                    Usuário
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: "grey.100" }}>
                    Localidade
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: "grey.100" }}>
                    Entidade
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 800, bgcolor: "grey.100", minWidth: 270 }}
                  >
                    Alterações
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 800, bgcolor: "grey.100", width: 90 }}
                  >
                    Detalhe
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((log, index: number) => (
                  <TableRow
                    key={log.id}
                    hover
                    sx={{
                      bgcolor: index % 2 === 0 ? "common.white" : "grey.50",
                    }}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" fontWeight={700}>
                        {formatDateTime(log.createdAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {String(log.id).slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={log.resource ?? "-"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={log.action ?? "-"}
                        color={actionColor(String(log.action ?? ""))}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {log.user?.name ?? "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {log.user?.email ?? log.userId ?? "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.locality?.code ??
                          log.locality?.name ??
                          log.localityId ??
                          "-"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {log.entityId ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {summarizeDiff(log.diffJson)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityRoundedIcon fontSize="small" />}
                        onClick={() => setSelectedLog(log)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <CardContent sx={{ pt: 1.4 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              gap={1}
            >
              <Typography variant="caption" color="text.secondary">
                Mostrando {items.length} de {total} eventos
                {lastEventAt
                  ? ` • Último registro: ${formatDateTime(lastEventAt)}`
                  : ""}
                .
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ChevronLeftRoundedIcon />}
                  disabled={currentPage <= 1}
                  onClick={() => updateParam("page", String(currentPage - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ChevronRightRoundedIcon />}
                  disabled={currentPage >= totalPages}
                  onClick={() => updateParam("page", String(currentPage + 1))}
                >
                  Próxima
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Drawer
        anchor="right"
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 560 },
            top: 84,
            height: "calc(100% - 84px)",
          },
        }}
      >
        <Box p={2.2} sx={{ height: "100%", overflowY: "auto" }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Typography variant="h6" fontWeight={800}>
              Evento de auditoria
            </Typography>
            <Button
              size="small"
              variant="text"
              startIcon={<CloseRoundedIcon />}
              onClick={() => setSelectedLog(null)}
            >
              Fechar
            </Button>
          </Stack>

          {selectedLog && (
            <Stack spacing={1.3}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={selectedLog.resource ?? "-"} variant="outlined" />
                <Chip
                  label={selectedLog.action ?? "-"}
                  color={actionColor(String(selectedLog.action ?? ""))}
                />
                <Chip
                  label={
                    selectedLog.locality?.code ??
                    selectedLog.localityId ??
                    "Sem OM"
                  }
                  variant="outlined"
                />
              </Stack>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Data/hora
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {selectedLog.createdAt
                    ? formatDateTime(String(selectedLog.createdAt))
                    : "-"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Usuário
                </Typography>
                <Typography variant="body2">
                  {selectedLog.user?.name ?? "-"}
                  {selectedLog.user?.email
                    ? ` • ${selectedLog.user.email}`
                    : ""}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Entidade auditada
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  {selectedLog.entityId ?? "-"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Diff completo da operação
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.8,
                    p: 1.4,
                    borderRadius: 2,
                    bgcolor: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: 12,
                    lineHeight: 1.45,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    border: "1px solid #1e293b",
                  }}
                >
                  {prettyJson(selectedLog.diffJson)}
                </Box>
              </Box>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
