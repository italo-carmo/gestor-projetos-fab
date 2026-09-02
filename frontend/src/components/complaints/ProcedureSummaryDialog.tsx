import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import {
  COMPLAINT_OPENED_PROCEDURE_OPTIONS,
  getComplaintProcedureLabel,
  getComplaintProcedureResultLabel,
} from "../../features/complaintProcedureOptions";
import { formatComplaintCaseNumberForDisplay } from "../../features/cpcaCipavdThreads";

type ProcedureSummaryLocality = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
};

export type ProcedureSummaryItem = {
  id: string;
  caseNumber?: string | null;
  workflowScope?: string | null;
  procedureType?: string | null;
  procedureCurrentSituation?: string | null;
  status?: string | null;
  subsequentProcedureOpened?: boolean | null;
  subsequentProcedureType?: string | null;
  subsequentProcedureStatus?: string | null;
  subsequentProcedureReference?: string | null;
  subsequentProcedureCurrentSituation?: string | null;
  subsequentProcedureStartDate?: string | null;
  subsequentProcedureEndDate?: string | null;
  reportedAt?: string | null;
  locality?: ProcedureSummaryLocality | null;
  om?: ProcedureSummaryLocality | null;
};

type ProcedureSummaryDialogProps = {
  open: boolean;
  onClose: () => void;
  items: ProcedureSummaryItem[];
  isLoading?: boolean;
  isError?: boolean;
  onSelectItem?: (item: ProcedureSummaryItem) => void;
};

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Recebida",
  PROTECTION_MEASURES: "Acolhimento e proteção",
  PRELIMINARY_ANALYSIS: "Análise preliminar",
  PROCEDURE_DEFINED: "Procedimento instaurado",
  INVESTIGATION: "Em apuração",
  CONCLUDED: "Concluída",
  ARCHIVED: "Arquivada",
};

const STATUS_CHIP_STYLES: Record<
  string,
  { bgcolor: string; color: string; borderColor: string }
> = {
  RECEIVED: {
    bgcolor: "rgba(30, 136, 229, 0.12)",
    color: "#0D47A1",
    borderColor: "rgba(30, 136, 229, 0.28)",
  },
  PROTECTION_MEASURES: {
    bgcolor: "rgba(0, 121, 107, 0.12)",
    color: "#00695C",
    borderColor: "rgba(0, 121, 107, 0.28)",
  },
  PRELIMINARY_ANALYSIS: {
    bgcolor: "rgba(251, 140, 0, 0.12)",
    color: "#E65100",
    borderColor: "rgba(251, 140, 0, 0.28)",
  },
  PROCEDURE_DEFINED: {
    bgcolor: "rgba(142, 36, 170, 0.12)",
    color: "#6A1B9A",
    borderColor: "rgba(142, 36, 170, 0.28)",
  },
  INVESTIGATION: {
    bgcolor: "rgba(94, 53, 177, 0.12)",
    color: "#4527A0",
    borderColor: "rgba(94, 53, 177, 0.28)",
  },
  CONCLUDED: {
    bgcolor: "rgba(46, 125, 50, 0.12)",
    color: "#1B5E20",
    borderColor: "rgba(46, 125, 50, 0.28)",
  },
  ARCHIVED: {
    bgcolor: "rgba(84, 110, 122, 0.14)",
    color: "#37474F",
    borderColor: "rgba(84, 110, 122, 0.28)",
  },
};

const DEFAULT_STATUS_STYLE = {
  bgcolor: "rgba(84, 110, 122, 0.12)",
  color: "#37474F",
  borderColor: "rgba(84, 110, 122, 0.25)",
};

function formatOmLabel(item: ProcedureSummaryItem) {
  const locality = item.om ?? item.locality;
  const code = String(locality?.code ?? "").trim();
  const name = String(locality?.name ?? "").trim();
  if (
    code &&
    name &&
    code.localeCompare(name, "pt-BR", { sensitivity: "accent" }) === 0
  ) {
    return code;
  }
  if (code && name) return `${code} - ${name}`;
  return code || name || "OM não informada";
}

function formatDateTimePtBr(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "data não informada";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function ProcedureSummaryDialog({
  open,
  onClose,
  items,
  isLoading = false,
  isError = false,
  onSelectItem,
}: ProcedureSummaryDialogProps) {
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(
    null,
  );

  const handleClose = () => {
    setSelectedProcedure(null);
    onClose();
  };

  const handleSelectItem = (item: ProcedureSummaryItem) => {
    setSelectedProcedure(null);
    onSelectItem?.(item);
  };

  const procedureCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const procedureTypes = [
        String(item.procedureType ?? "").trim(),
        item.subsequentProcedureOpened
          ? String(item.subsequentProcedureType ?? "").trim()
          : "",
      ].filter(Boolean);
      for (const procedureType of procedureTypes) {
        counts.set(procedureType, (counts.get(procedureType) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const procedureIndicators = useMemo(() => {
    const knownValues = new Set<string>(
      COMPLAINT_OPENED_PROCEDURE_OPTIONS.map((item) => item.value),
    );
    const known = COMPLAINT_OPENED_PROCEDURE_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
      count: procedureCounts.get(item.value) ?? 0,
    }));
    const additional = Array.from(procedureCounts.entries())
      .filter(([value]) => !knownValues.has(value))
      .map(([value, count]) => ({
        value,
        label: getComplaintProcedureLabel(value),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return [...known, ...additional];
  }, [procedureCounts]);

  const filteredItems = useMemo(
    () =>
      selectedProcedure
        ? items.filter(
            (item) =>
              item.procedureType === selectedProcedure ||
              (item.subsequentProcedureOpened &&
                item.subsequentProcedureType === selectedProcedure),
          )
        : items,
    [items, selectedProcedure],
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="lg"
      scroll="paper"
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <AssignmentOutlinedIcon color="primary" />
          <Typography variant="h6" component="span" fontWeight={800}>
            Procedimentos administrativos
          </Typography>
        </Stack>
        <IconButton aria-label="Fechar" onClick={handleClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "#F8FAFD" }}>
        <Stack spacing={2.25}>
          {isLoading ? (
            <Stack alignItems="center" spacing={1.25} sx={{ py: 5 }}>
              <CircularProgress size={30} />
              <Typography variant="body2" color="text.secondary">
                Carregando procedimentos administrativos...
              </Typography>
            </Stack>
          ) : isError ? (
            <Alert severity="error">
              Não foi possível carregar os procedimentos administrativos.
            </Alert>
          ) : (
            <>
              <Box>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                  Quantidade por tipo de procedimento
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "repeat(2, minmax(0, 1fr))",
                      sm: "repeat(3, minmax(0, 1fr))",
                      md: "repeat(4, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  <Card
                    variant="outlined"
                    sx={{
                      borderColor:
                        selectedProcedure === null ? "primary.main" : "divider",
                      bgcolor:
                        selectedProcedure === null
                          ? "rgba(26, 60, 110, 0.06)"
                          : "background.paper",
                    }}
                  >
                    <CardActionArea onClick={() => setSelectedProcedure(null)}>
                      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <Typography
                          variant="h5"
                          fontWeight={800}
                          color="primary"
                        >
                          {items.length}
                        </Typography>
                        <Typography variant="caption" fontWeight={700}>
                          Todos
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>

                  {procedureIndicators.map((indicator) => {
                    const active = selectedProcedure === indicator.value;
                    return (
                      <Card
                        key={indicator.value}
                        variant="outlined"
                        sx={{
                          borderColor: active ? "primary.main" : "divider",
                          bgcolor: active
                            ? "rgba(26, 60, 110, 0.06)"
                            : "background.paper",
                          opacity: indicator.count === 0 ? 0.68 : 1,
                        }}
                      >
                        <CardActionArea
                          disabled={indicator.count === 0}
                          onClick={() => setSelectedProcedure(indicator.value)}
                          sx={{ height: "100%" }}
                        >
                          <CardContent
                            sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}
                          >
                            <Typography
                              variant="h5"
                              fontWeight={800}
                              color="primary"
                            >
                              {indicator.count}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              sx={{ lineHeight: 1.25, display: "block" }}
                            >
                              {indicator.label}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    );
                  })}
                </Box>
              </Box>

              <Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2" fontWeight={800}>
                    Reportes detalhados
                  </Typography>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${filteredItems.length} reporte${filteredItems.length === 1 ? "" : "s"}`}
                  />
                </Stack>

                {filteredItems.length === 0 ? (
                  <Alert severity="info">
                    Nenhum reporte com procedimento administrativo foi
                    encontrado no recorte atual.
                  </Alert>
                ) : (
                  <Stack spacing={1}>
                    {filteredItems.map((item) => {
                      const status = String(item.status ?? "").trim();
                      const statusStyle =
                        STATUS_CHIP_STYLES[status] ?? DEFAULT_STATUS_STYLE;
                      const scope = String(item.workflowScope ?? "")
                        .trim()
                        .toUpperCase();
                      const subsequentStatus = String(
                        item.subsequentProcedureStatus ?? "",
                      ).trim();
                      const subsequentStatusStyle =
                        STATUS_CHIP_STYLES[subsequentStatus] ??
                        DEFAULT_STATUS_STYLE;

                      return (
                        <Box
                          key={`${scope}:${item.id}`}
                          {...(onSelectItem
                            ? {
                                role: "button",
                                tabIndex: 0,
                                onClick: () => handleSelectItem(item),
                                onKeyDown: (
                                  event: React.KeyboardEvent<HTMLDivElement>,
                                ) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    handleSelectItem(item);
                                  }
                                },
                              }
                            : {})}
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "background.paper",
                            ...(onSelectItem && {
                              cursor: "pointer",
                              transition:
                                "background-color 120ms ease, border-color 120ms ease",
                              "&:hover": {
                                bgcolor: "action.hover",
                                borderColor: "primary.light",
                              },
                              "&:focus-visible": {
                                outline: "2px solid",
                                outlineColor: "primary.main",
                                outlineOffset: 2,
                              },
                            }),
                          }}
                        >
                          <Stack spacing={0.85}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                            >
                              <Typography fontWeight={800}>
                                {formatComplaintCaseNumberForDisplay(
                                  String(item.caseNumber ?? ""),
                                )}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Recebido em{" "}
                                {formatDateTimePtBr(item.reportedAt)}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {formatOmLabel(item)}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              {scope ? (
                                <Chip
                                  size="small"
                                  label={scope}
                                  sx={{ fontWeight: 800 }}
                                />
                              ) : null}
                              <Chip
                                size="small"
                                label={getComplaintProcedureLabel(
                                  item.procedureType,
                                )}
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700 }}
                              />
                              <Chip
                                size="small"
                                label={STATUS_LABELS[status] ?? status}
                                sx={{
                                  fontWeight: 700,
                                  bgcolor: statusStyle.bgcolor,
                                  color: statusStyle.color,
                                  border: "1px solid",
                                  borderColor: statusStyle.borderColor,
                                }}
                              />
                              <Chip
                                size="small"
                                label={getComplaintProcedureResultLabel(
                                  item.procedureCurrentSituation,
                                )}
                                variant="outlined"
                              />
                            </Stack>
                            {item.subsequentProcedureOpened &&
                            item.subsequentProcedureType ? (
                              <Box
                                sx={{
                                  mt: 0.25,
                                  p: 1,
                                  borderRadius: 2,
                                  bgcolor: "rgba(26, 60, 110, 0.045)",
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  fontWeight={800}
                                  sx={{ display: "block", mb: 0.75 }}
                                >
                                  Procedimento posterior à Sindicância
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  flexWrap="wrap"
                                  useFlexGap
                                >
                                  <Chip
                                    size="small"
                                    label={getComplaintProcedureLabel(
                                      item.subsequentProcedureType,
                                    )}
                                    color="secondary"
                                    variant="outlined"
                                    sx={{ fontWeight: 700 }}
                                  />
                                  {subsequentStatus ? (
                                    <Chip
                                      size="small"
                                      label={
                                        STATUS_LABELS[subsequentStatus] ??
                                        subsequentStatus
                                      }
                                      sx={{
                                        fontWeight: 700,
                                        bgcolor: subsequentStatusStyle.bgcolor,
                                        color: subsequentStatusStyle.color,
                                        border: "1px solid",
                                        borderColor:
                                          subsequentStatusStyle.borderColor,
                                      }}
                                    />
                                  ) : null}
                                  <Chip
                                    size="small"
                                    label={getComplaintProcedureResultLabel(
                                      item.subsequentProcedureCurrentSituation,
                                    )}
                                    variant="outlined"
                                  />
                                </Stack>
                                {item.subsequentProcedureReference ? (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block", mt: 0.75 }}
                                  >
                                    Referência:{" "}
                                    {item.subsequentProcedureReference}
                                  </Typography>
                                ) : null}
                                {item.subsequentProcedureStartDate ||
                                item.subsequentProcedureEndDate ? (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block", mt: 0.25 }}
                                  >
                                    Início:{" "}
                                    {formatDateTimePtBr(
                                      item.subsequentProcedureStartDate,
                                    )}
                                    {" · "}Conclusão:{" "}
                                    {formatDateTimePtBr(
                                      item.subsequentProcedureEndDate,
                                    )}
                                  </Typography>
                                ) : null}
                              </Box>
                            ) : null}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
