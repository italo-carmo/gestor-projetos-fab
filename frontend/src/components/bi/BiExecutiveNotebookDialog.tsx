import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { alpha } from "@mui/material/styles";

export type BiExecutiveNotebookPanelKey =
  | "surveys"
  | "domestic-violence"
  | "recruits"
  | "best-practices-cycle"
  | "cpca-meeting"
  | "gsd-evaluation";

export type BiExecutiveNotebookPayload = {
  title?: string;
  panels: Array<{
    key: BiExecutiveNotebookPanelKey;
    filters?: Record<string, unknown>;
  }>;
};

type BiExecutiveNotebookDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: BiExecutiveNotebookPayload) => Promise<unknown> | unknown;
  isPending?: boolean;
  accentColor: string;
  currentPanelKey: BiExecutiveNotebookPanelKey;
  currentPanelFilters?: Record<string, unknown>;
};

type PanelMeta = {
  key: BiExecutiveNotebookPanelKey;
  title: string;
  description: string;
};

export const BI_EXECUTIVE_NOTEBOOK_PANELS: PanelMeta[] = [
  {
    key: "surveys",
    title: "Pesquisa Institucional",
    description:
      "Incidência declarada, distribuição por OM e leitura consolidada dos sinais do painel.",
  },
  {
    key: "domestic-violence",
    title: "Violência Doméstica",
    description:
      "Incidência, recorrência, busca por ajuda e fatores críticos para intervenção.",
  },
  {
    key: "recruits",
    title: "Recrutas",
    description:
      "Conhecimento de canais, segurança para denunciar e sinais qualitativos dos recrutas.",
  },
  {
    key: "best-practices-cycle",
    title: "Ciclo de Boas Práticas",
    description:
      "Preparo para liderança mista, viés percebido e desafios centrais do ciclo.",
  },
  {
    key: "cpca-meeting",
    title: "Encontro CPCA",
    description:
      "Preenchimento, distribuições mais sensíveis e consolidação textual do encontro.",
  },
  {
    key: "gsd-evaluation",
    title: "Avaliação GSD",
    description:
      "Indicadores de preenchimento, distribuições centrais e comentários qualitativos.",
  },
];

const DEFAULT_NOTEBOOK_TITLE = "Caderno Executivo de Painéis BI";

export function BiExecutiveNotebookDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  accentColor,
  currentPanelKey,
  currentPanelFilters,
}: BiExecutiveNotebookDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<BiExecutiveNotebookPanelKey[]>(
    [currentPanelKey],
  );
  const [title, setTitle] = useState(DEFAULT_NOTEBOOK_TITLE);
  const [applyCurrentFilters, setApplyCurrentFilters] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedKeys([currentPanelKey]);
    setTitle(DEFAULT_NOTEBOOK_TITLE);
    setApplyCurrentFilters(true);
  }, [open, currentPanelKey]);

  const currentPanel = useMemo(
    () =>
      BI_EXECUTIVE_NOTEBOOK_PANELS.find((panel) => panel.key === currentPanelKey) ??
      BI_EXECUTIVE_NOTEBOOK_PANELS[0],
    [currentPanelKey],
  );

  const hasCurrentFilters =
    Object.keys(currentPanelFilters ?? {}).filter((key) => {
      const value = currentPanelFilters?.[key];
      if (value === undefined || value === null) return false;
      return String(value).trim().length > 0;
    }).length > 0;

  const toggleSelection = (key: BiExecutiveNotebookPanelKey) => {
    setSelectedKeys((current) => {
      if (current.includes(key)) {
        const next = current.filter((item) => item !== key);
        return next;
      }
      const order = BI_EXECUTIVE_NOTEBOOK_PANELS.map((panel) => panel.key);
      return [...current, key].sort(
        (left, right) => order.indexOf(left) - order.indexOf(right),
      );
    });
  };

  const handleSubmit = async () => {
    const panels = BI_EXECUTIVE_NOTEBOOK_PANELS.filter((panel) =>
      selectedKeys.includes(panel.key),
    ).map((panel) => ({
      key: panel.key,
      filters:
        panel.key === currentPanelKey && applyCurrentFilters
          ? currentPanelFilters
          : undefined,
    }));

    await onSubmit({
      title: title.trim() || DEFAULT_NOTEBOOK_TITLE,
      panels,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              color: accentColor,
              bgcolor: alpha(accentColor, 0.12),
            }}
          >
            <MenuBookRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Caderno PDF executivo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Consolide múltiplos painéis BI em um único documento para briefing
              gerencial.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert
            severity="info"
            sx={{
              border: `1px solid ${alpha(accentColor, 0.18)}`,
              bgcolor: alpha(accentColor, 0.06),
            }}
          >
            O painel aberto é <strong>{currentPanel.title}</strong>. Se desejar,
            o caderno reaproveita o recorte atual apenas nele. Os demais painéis
            entram com base completa para evitar mistura de filtros de natureza
            diferente.
          </Alert>

          <TextField
            label="Título do caderno"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
            placeholder={DEFAULT_NOTEBOOK_TITLE}
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="text"
                onClick={() =>
                  setSelectedKeys(BI_EXECUTIVE_NOTEBOOK_PANELS.map((panel) => panel.key))
                }
                disabled={isPending}
              >
                Selecionar todos
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => setSelectedKeys([currentPanelKey])}
                disabled={isPending}
              >
                Manter só painel atual
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => setSelectedKeys([])}
                disabled={isPending}
              >
                Limpar seleção
              </Button>
            </Stack>
            <Chip
              label={`${selectedKeys.length} painel(is) selecionado(s)`}
              size="small"
              sx={{
                fontWeight: 700,
                color: accentColor,
                bgcolor: alpha(accentColor, 0.1),
              }}
            />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 1.5,
            }}
          >
            {BI_EXECUTIVE_NOTEBOOK_PANELS.map((panel) => {
              const selected = selectedKeys.includes(panel.key);
              const isCurrent = panel.key === currentPanelKey;
              return (
                <Box
                  key={panel.key}
                  onClick={() => !isPending && toggleSelection(panel.key)}
                  sx={{
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: selected
                      ? alpha(accentColor, 0.55)
                      : "divider",
                    bgcolor: selected
                      ? alpha(accentColor, 0.06)
                      : "background.paper",
                    px: 1.5,
                    py: 1.35,
                    cursor: isPending ? "default" : "pointer",
                    transition: "all 0.18s ease",
                    "&:hover": isPending
                      ? undefined
                      : {
                          borderColor: alpha(accentColor, 0.65),
                          boxShadow: `0 10px 24px ${alpha(accentColor, 0.08)}`,
                        },
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Checkbox
                      checked={selected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleSelection(panel.key)}
                      disabled={isPending}
                      sx={{ mt: -0.6, ml: -0.6 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        useFlexGap
                        flexWrap="wrap"
                        sx={{ mb: 0.6 }}
                      >
                        <Typography variant="subtitle2" fontWeight={700}>
                          {panel.title}
                        </Typography>
                        {isCurrent ? (
                          <Chip
                            label="Painel atual"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              color: accentColor,
                              bgcolor: alpha(accentColor, 0.12),
                            }}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {panel.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={selected ? accentColor : "text.secondary"}
                        sx={{ display: "block", mt: 1, fontWeight: 700 }}
                      >
                        {isCurrent && applyCurrentFilters && hasCurrentFilters
                          ? "Vai usar o recorte atual deste painel"
                          : "Vai usar a base completa"}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Box>

          <Box
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(accentColor, 0.18),
              bgcolor: alpha(accentColor, 0.05),
              px: 1.5,
              py: 1.2,
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Checkbox
                checked={applyCurrentFilters}
                onChange={(event) => setApplyCurrentFilters(event.target.checked)}
                disabled={isPending || !hasCurrentFilters}
                sx={{ ml: -0.75 }}
              />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Aplicar o recorte atual ao painel aberto
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {hasCurrentFilters
                    ? `O capítulo ${currentPanel.title} será gerado com os filtros atualmente visíveis nesta tela.`
                    : `Não há filtros ativos no painel ${currentPanel.title}; nesse caso ele também sairá com base completa.`}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isPending || selectedKeys.length === 0}
          startIcon={<MenuBookRoundedIcon />}
          sx={{
            bgcolor: accentColor,
            "&:hover": {
              bgcolor: accentColor,
              filter: "brightness(0.95)",
            },
          }}
        >
          {isPending ? "Gerando caderno..." : "Gerar caderno PDF"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
