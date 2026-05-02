import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RuleFolderRoundedIcon from "@mui/icons-material/RuleFolderRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import type {
  BiImportNormalizationPreview,
  BiImportNormalizationSuggestion,
} from "../../api/hooks";

type Props = {
  open: boolean;
  title: string;
  preview: BiImportNormalizationPreview | null;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  onImportWithoutNormalization: () => void;
  confirmLoading?: boolean;
};

function confidenceLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function methodLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  const catalog: Record<string, string> = {
    OM_EXACT_CANONICAL: "Equivalência exata com OM do sistema",
    OM_STRONG_HEURISTIC: "Heurística forte de sigla/nome",
    OM_FALLBACK_HEURISTIC: "Heurística conservadora",
    AI_ASSISTED_OM: "Sugestão assistida por IA",
    CASE_SPACE_NORMALIZATION: "Padronização de caixa e espaços",
    OM_REFERENCE_NOT_RESOLVED: "Sem correspondência segura na lista de OMs",
    NO_HEURISTIC_MATCH: "Sem correspondência segura",
    EMPTY_REFERENCE: "Campo vazio",
  };
  return catalog[normalized] ?? normalized;
}

function summarizeRows(rows: number[]) {
  if (!Array.isArray(rows) || rows.length === 0) return "—";
  return rows.slice(0, 4).map((row) => `L${row}`).join(", ");
}

function fieldGroupLabel(suggestion: BiImportNormalizationSuggestion) {
  return suggestion.kind === "SPECIALTY"
    ? `${suggestion.fieldLabel} · padronização textual`
    : `${suggestion.fieldLabel} · OM do sistema`;
}

export function BiImportNormalizationReviewDialog({
  open,
  title,
  preview,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
  onImportWithoutNormalization,
  confirmLoading = false,
}: Props) {
  const suggestions = preview?.suggestions ?? [];
  const unresolved = preview?.unresolved ?? [];
  const groupedSuggestions = suggestions.reduce<Record<string, typeof suggestions>>(
    (acc, suggestion) => {
      const key = `${suggestion.kind}:${suggestion.fieldKey}`;
      acc[key] = acc[key] ?? [];
      acc[key].push(suggestion);
      return acc;
    },
    {},
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Alert severity="info" variant="outlined">
            O sistema só sugere correções conservadoras. O que não tiver segurança
            suficiente fica fora da normalização automática e segue sem alteração.
          </Alert>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <Chip
              color="primary"
              icon={<RuleFolderRoundedIcon />}
              label={`${preview?.summary.suggestionCount ?? 0} sugestão(ões)`}
            />
            <Chip
              color="success"
              icon={<VerifiedRoundedIcon />}
              label={`${selectedIds.length} marcada(s) para aplicar`}
            />
            <Chip
              color="warning"
              icon={<WarningAmberRoundedIcon />}
              label={`${preview?.summary.unresolvedCount ?? 0} item(ns) sem sugestão segura`}
            />
          </Stack>

          {Object.entries(groupedSuggestions).map(([groupKey, items]) => (
            <Box key={groupKey}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {fieldGroupLabel(items[0])}
              </Typography>
              <Table size="small" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell width={64}>Aplicar</TableCell>
                    <TableCell>Valor encontrado</TableCell>
                    <TableCell>Valor sugerido</TableCell>
                    <TableCell width={120}>Confiança</TableCell>
                    <TableCell width={140}>Ocorrências</TableCell>
                    <TableCell width={220}>Linhas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => {
                    const checked = selectedIds.includes(item.id);
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onChange={(event) =>
                              onToggle(item.id, event.target.checked)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {item.originalValue}
                          </Typography>
                          {item.resolutionMethod || item.reasoning ? (
                            <Typography variant="caption" color="text.secondary">
                              {item.reasoning || methodLabel(item.resolutionMethod)}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={item.suggestedValue}
                          />
                        </TableCell>
                        <TableCell>{confidenceLabel(item.confidence)}</TableCell>
                        <TableCell>{item.rowCount}</TableCell>
                        <TableCell>{summarizeRows(item.sampleRows)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          ))}

          {suggestions.length === 0 ? (
            <Alert severity="success" variant="outlined">
              Nenhuma normalização automática foi necessária nesta importação.
            </Alert>
          ) : null}

          {unresolved.length > 0 ? (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Itens mantidos sem alteração
                </Typography>
                <Table size="small" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Campo</TableCell>
                      <TableCell>Valor encontrado</TableCell>
                      <TableCell width={140}>Ocorrências</TableCell>
                      <TableCell width={220}>Linhas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unresolved.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.fieldLabel}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {item.originalValue}
                          </Typography>
                          {item.reasoning || item.resolutionMethod ? (
                            <Typography variant="caption" color="text.secondary">
                              {item.reasoning || methodLabel(item.resolutionMethod)}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>{item.rowCount}</TableCell>
                        <TableCell>{summarizeRows(item.sampleRows)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          ) : null}

          <FormControlLabel
            control={<Checkbox checked={selectedIds.length === suggestions.length && suggestions.length > 0} />}
            label="Todas as sugestões estão marcadas para aplicação"
            disabled
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={confirmLoading}>
          Cancelar
        </Button>
        <Button
          onClick={onImportWithoutNormalization}
          color="inherit"
          disabled={confirmLoading}
        >
          Importar sem aplicar correções
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={confirmLoading}
        >
          {confirmLoading ? "Importando..." : "Confirmar importação"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
