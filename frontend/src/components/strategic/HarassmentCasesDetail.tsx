import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { getComplaintProcedureLabel } from "../../features/complaintProcedureOptions";
import { getComplaintStatusLabel } from "../../features/complaintStatus";
import {
  EMPTY_STRATEGIC_COMPLAINT_FILTERS,
  filterStrategicComplaints,
  getStrategicComplaintProcedures,
  STRATEGIC_COMPLAINT_STATUS_LABELS,
  summarizeStrategicComplaints,
  type StrategicComplaintDetailItem,
  type StrategicComplaintFilters,
} from "../../features/strategicComplaintDetails";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

export function HarassmentCasesDetail({
  items,
  percent,
}: {
  items: StrategicComplaintDetailItem[];
  percent: number;
}) {
  const [filters, setFilters] = useState(EMPTY_STRATEGIC_COMPLAINT_FILTERS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const omOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items.map((item) => [
            item.omId,
            { id: item.omId, label: item.omLabel || "OM não informada" },
          ]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [items],
  );
  const procedureOptions = useMemo(
    () =>
      summarizeStrategicComplaints(items).byProcedure.sort((a, b) =>
        getComplaintProcedureLabel(a.type).localeCompare(
          getComplaintProcedureLabel(b.type),
          "pt-BR",
        ),
      ),
    [items],
  );
  const filteredItems = useMemo(
    () => filterStrategicComplaints(items, filters),
    [items, filters],
  );
  const summary = useMemo(
    () => summarizeStrategicComplaints(filteredItems),
    [filteredItems],
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filteredItems.length / rowsPerPage) - 1),
  );
  const hasFilters = Object.values(filters).some(Boolean);

  const updateFilter = (
    key: keyof StrategicComplaintFilters,
    value: string,
  ) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(0);
  };
  const clearFilters = () => {
    setFilters(EMPTY_STRATEGIC_COMPLAINT_FILTERS);
    setPage(0);
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {items.length} casos deste tipo · {percent}% dos casos analisados.
        Fonte: reportes CPCA e SMIF.
      </Typography>

      <Grid container spacing={1.5}>
        {[
          {
            label: "Casos no recorte",
            value: filteredItems.length,
            helper: `de ${items.length} casos deste tipo`,
          },
          {
            label: "Procedimentos instaurados",
            value: summary.procedureCount,
            helper: `em ${summary.casesWithProcedure} casos · inclui desdobramentos`,
          },
          {
            label: "Sem procedimento instaurado",
            value: filteredItems.length - summary.casesWithProcedure,
            helper: "casos sem instauração registrada",
          },
        ].map((metric) => (
          <Grid key={metric.label} size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.25,
                height: "100%",
                bgcolor: "#F8FAFD",
                border: "1px solid #E1E7F0",
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                color="primary"
                sx={{ my: 0.25 }}
              >
                {metric.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {metric.helper}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Filtrar casos
          </Typography>
          <Button size="small" onClick={clearFilters} disabled={!hasFilters}>
            Limpar filtros
          </Button>
        </Stack>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Buscar caso"
              placeholder="Número do reporte, OM ou procedimento"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              size="small"
              options={omOptions}
              value={
                omOptions.find((option) => option.id === filters.omId) ?? null
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => updateFilter("omId", value?.id ?? "")}
              renderInput={(params) => (
                <TextField {...params} label="OM" placeholder="Todas as OMs" />
              )}
              noOptionsText="Nenhuma OM encontrada"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Procedimento instaurado"
              value={filters.procedure}
              onChange={(event) =>
                updateFilter("procedure", event.target.value)
              }
            >
              <MenuItem value="">Todos os casos</MenuItem>
              <MenuItem value="WITH_PROCEDURE">
                Com procedimento instaurado
              </MenuItem>
              <MenuItem value="WITHOUT_PROCEDURE">
                Sem procedimento instaurado
              </MenuItem>
              {procedureOptions.map(({ type }) => (
                <MenuItem key={type} value={type}>
                  {getComplaintProcedureLabel(type)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Situação do caso"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <MenuItem value="">Todas as situações</MenuItem>
              {Object.entries(STRATEGIC_COMPLAINT_STATUS_LABELS).map(
                ([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ),
              )}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Escopo"
              value={filters.workflowScope}
              onChange={(event) =>
                updateFilter("workflowScope", event.target.value)
              }
            >
              <MenuItem value="">CPCA e SMIF</MenuItem>
              <MenuItem value="CPCA">CPCA</MenuItem>
              <MenuItem value="SMIF">SMIF</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Box>

      {summary.byProcedure.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Procedimentos por tipo
          </Typography>
          {summary.byProcedure.map(({ type, count }) => (
            <Chip
              key={type}
              size="small"
              label={`${getComplaintProcedureLabel(type)}: ${count}`}
              variant={filters.procedure === type ? "filled" : "outlined"}
              color="primary"
              onClick={() =>
                updateFilter(
                  "procedure",
                  filters.procedure === type ? "" : type,
                )
              }
            />
          ))}
        </Stack>
      )}

      <Box>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 1 }}
          aria-live="polite"
        >
          Casos listados · {filteredItems.length} de {items.length}
        </Typography>
        <TableContainer sx={{ border: "1px solid #E1E7F0", borderRadius: 2 }}>
          <Table
            size="small"
            aria-label="Casos por tipo de assédio"
            sx={{ minWidth: 760 }}
          >
            <TableHead sx={{ bgcolor: "#F8FAFD" }}>
              <TableRow>
                <TableCell>Reporte / data</TableCell>
                <TableCell>OM</TableCell>
                <TableCell>Escopo</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Procedimentos instaurados</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems
                .slice(
                  currentPage * rowsPerPage,
                  (currentPage + 1) * rowsPerPage,
                )
                .map((item) => {
                  const procedures = getStrategicComplaintProcedures(item);
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.caseNumber || item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(item.date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.omLabel || "OM não informada"}
                      </TableCell>
                      <TableCell>{item.workflowScope || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={getComplaintStatusLabel(item.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {procedures.length ? (
                          <Stack spacing={0.5}>
                            {procedures.map((type, index) => (
                              <Typography
                                key={`${type}-${index}`}
                                variant="body2"
                              >
                                {getComplaintProcedureLabel(type)}
                                {index > 0 ? " (desdobramento)" : ""}
                              </Typography>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Sem instauração registrada
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {item.link && (
                          <Button
                            component={RouterLink}
                            to={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                            endIcon={<OpenInNewRoundedIcon />}
                            aria-label={`Abrir ${item.caseNumber || item.title}`}
                          >
                            Abrir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!filteredItems.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {hasFilters
                        ? "Nenhum caso encontrado com os filtros selecionados."
                        : "Nenhum caso registrado para este tipo de assédio."}
                    </Typography>
                    {hasFilters && (
                      <Button
                        size="small"
                        onClick={clearFilters}
                        sx={{ mt: 1 }}
                      >
                        Mostrar todos os casos
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredItems.length}
          page={currentPage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, value) => setPage(value)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          labelRowsPerPage="Casos por página"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} de ${count}`
          }
          getItemAriaLabel={(type) =>
            type === "next" ? "Próxima página" : "Página anterior"
          }
          sx={{
            ".MuiTablePagination-toolbar": {
              flexWrap: "wrap",
              justifyContent: "flex-end",
            },
            ".MuiTablePagination-spacer": { display: "none" },
          }}
        />
      </Box>
    </Stack>
  );
}
