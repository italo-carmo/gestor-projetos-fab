import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import DataObjectRoundedIcon from "@mui/icons-material/DataObjectRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import PsychologyAltRoundedIcon from "@mui/icons-material/PsychologyAltRounded";
import RuleFolderRoundedIcon from "@mui/icons-material/RuleFolderRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useMemo, useState } from "react";
import {
  useApplyBiNormalization,
  useApplyReadyBiNormalization,
  useBiNormalizationOverview,
  useBiNormalizationReview,
  useMe,
  useOmsCatalog,
  useRebuildBiNormalization,
  type BiNormalizationReviewGroup,
} from "../../api/hooks";
import { parseApiError } from "../../app/apiErrors";
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from "../../app/roleAccess";
import { useToast } from "../../app/toast";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { ErrorState } from "../states/ErrorState";
import { SkeletonState } from "../states/SkeletonState";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function resolveCoverageColor(value: number | null) {
  if (value === null) return "default";
  if (value >= 80) return "success";
  if (value >= 50) return "warning";
  return "error";
}

function resolveMethodLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Sem método registrado";
  const catalog: Record<string, string> = {
    OM_EXACT_CANONICAL: "Equivalência exata de sigla/nome",
    OM_STRONG_HEURISTIC: "Heurística forte de sigla",
    OM_FALLBACK_HEURISTIC: "Heurística conservadora",
    AI_ASSISTED_OM: "Sugestão assistida por IA",
    LOCALITY_EXACT: "Localidade exata",
    LOCALITY_HEURISTIC: "Localidade heurística",
    DIRECT_UF: "UF explícita",
    NO_HEURISTIC_MATCH: "Sem correspondência confiável",
    OM_REFERENCE_NOT_RESOLVED: "Referência de OM não resolvida",
    EMPTY_REFERENCE: "Campo vazio",
    SOURCE_WITHOUT_ORGANIZATIONAL_KEY: "Fonte sem chave organizacional",
  };
  return catalog[normalized] ?? normalized;
}

function summarizeVariants(group: BiNormalizationReviewGroup) {
  return group.variants
    .slice(0, 4)
    .map((variant) => `${variant.value} (${variant.count})`)
    .join(" • ");
}

export function BiNormalizationTab() {
  const { data: me } = useMe();
  const canView = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);
  const canWrite = hasAnyRole(me, [ROLE_TI]);
  const overviewQuery = useBiNormalizationOverview(canView);
  const reviewQuery = useBiNormalizationReview(null, canView);
  const omsCatalogQuery = useOmsCatalog(canView);
  const rebuildMutation = useRebuildBiNormalization();
  const applyMutation = useApplyBiNormalization();
  const applyReadyMutation = useApplyReadyBiNormalization();
  const toast = useToast();

  const [expandedSource, setExpandedSource] = useState<string | false>(false);
  const [manualGroup, setManualGroup] = useState<{
    sourceType: string;
    sourceLabel: string;
    group: BiNormalizationReviewGroup;
  } | null>(null);
  const [selectedOm, setSelectedOm] = useState<any | null>(null);
  const [readyConfirmSource, setReadyConfirmSource] = useState<{
    sourceType: string | null;
    label: string;
    totalRecords: number;
  } | null>(null);

  const omsCatalog = useMemo(() => {
    const raw = omsCatalogQuery.data;
    return Array.isArray(raw) ? raw : [];
  }, [omsCatalogQuery.data]);

  const handleRebuild = async (sourceType?: string) => {
    try {
      const result = await rebuildMutation.mutateAsync({
        sourceType: sourceType ?? null,
      });
      const processed = Array.isArray(result?.processed)
        ? result.processed.length
        : 0;
      toast.push({
        message:
          processed > 0
            ? `Normalização BI reprocessada para ${processed} fonte(s).`
            : "Reprocessamento concluído.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          "Erro ao reprocessar normalização BI.",
        severity: "error",
      });
    }
  };

  const handleApplyGroup = async (
    sourceType: string,
    group: BiNormalizationReviewGroup,
    omId?: string | null,
  ) => {
    try {
      const result = await applyMutation.mutateAsync({
        sourceType,
        sourceRecordIds: group.recordIds,
        omId: omId ?? null,
      });
      toast.push({
        message:
          Number(result?.applied ?? 0) > 0
            ? `${Number(result?.applied ?? 0)} registro(s) padronizado(s).`
            : "Nenhum registro precisou ser alterado.",
        severity: "success",
      });
      setManualGroup(null);
      setSelectedOm(null);
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao aplicar padronização.",
        severity: "error",
      });
    }
  };

  const handleApplyReady = async (sourceType?: string | null) => {
    try {
      const result = await applyReadyMutation.mutateAsync({
        sourceType: sourceType ?? null,
      });
      const applied = Array.isArray(result?.processed)
        ? result.processed.reduce(
            (sum: number, item: any) => sum + Number(item?.applied ?? 0),
            0,
          )
        : 0;
      toast.push({
        message:
          applied > 0
            ? `${applied} registro(s) padronizado(s) com as sugestões prontas.`
            : "Não havia correções prontas para aplicar.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          "Erro ao aplicar sugestões prontas de normalização.",
        severity: "error",
      });
    } finally {
      setReadyConfirmSource(null);
    }
  };

  if (overviewQuery.isLoading || reviewQuery.isLoading)
    return <SkeletonState />;
  if (overviewQuery.isError) {
    return (
      <ErrorState
        error={overviewQuery.error}
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }
  if (reviewQuery.isError) {
    return (
      <ErrorState
        error={reviewQuery.error}
        onRetry={() => reviewQuery.refetch()}
      />
    );
  }

  const overview = overviewQuery.data;
  const review = reviewQuery.data;
  const sources = Array.isArray(overview?.sources) ? overview.sources : [];
  const reviewSources = Array.isArray(review?.sources) ? review.sources : [];
  const overall = overview?.overall ?? {};
  const reviewOverall =
    review?.overall ??
    ({
      totalGroups: 0,
      totalRecords: 0,
      readyGroups: 0,
      readyRecords: 0,
      unresolvedGroups: 0,
      unresolvedRecords: 0,
    } as const);

  return (
    <Box>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Normalização BI para OM e UF
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
            A cobertura mostra quantos registros já foram associados a OM ou UF.
            A padronização efetiva acontece quando a sugestão é aprovada e o
            valor canônico é gravado de volta na pesquisa. Depois de cada
            upload, esta tela concentra a revisão assistida e a aplicação das
            correções.
          </Typography>
        </Box>

        <Alert severity="info" variant="outlined">
          O fluxo correto agora é: <strong>upload da pesquisa</strong> →{" "}
          <strong>reprocessar/sugerir</strong> →{" "}
          <strong>revisar as variações</strong> →{" "}
          <strong>aplicar a OM canônica</strong>. Isso resolve diferenças como{" "}
          <code>BACO</code>, <code>Baco</code>, <code>Gap-co</code> e{" "}
          <code>GAP-CO</code> no próprio dado fonte.
        </Alert>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <VerifiedRoundedIcon color="success" fontSize="small" />
                  <Typography variant="subtitle2">Cobertura útil</Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="success.main">
                  {Number(overall?.supportedCoveragePercent ?? 0).toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registros BI já resolvidos para OM ou UF nas fontes
                  suportadas.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoFixHighRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2">
                    Prontas para aplicar
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="primary.main">
                  {Number(reviewOverall?.readyRecords ?? 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registros onde a OM correta já foi sugerida e só falta gravar
                  o valor canônico no dado fonte.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberRoundedIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle2">
                    Sem sugestão confiável
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="warning.main">
                  {Number(reviewOverall?.unresolvedRecords ?? 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registros que ainda precisam de escolha manual da OM porque a
                  heurística e a IA não chegaram a uma correspondência segura.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DataObjectRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2">Base processada</Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="primary.main">
                  {Number(overall?.totalRecords ?? 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total de registros BI monitorados nesta governança de
                  normalização.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          spacing={1.5}
        >
          <Typography variant="body2" color="text.secondary">
            Última atualização consolidada:{" "}
            {formatDateTime(overview?.lastUpdatedAt)}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            {canWrite ? (
              <Button
                variant="outlined"
                startIcon={<AutorenewRoundedIcon />}
                onClick={() => handleRebuild()}
                disabled={rebuildMutation.isPending}
              >
                {rebuildMutation.isPending
                  ? "Reprocessando..."
                  : "Reprocessar tudo"}
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="contained"
                startIcon={<RuleFolderRoundedIcon />}
                disabled={
                  applyReadyMutation.isPending ||
                  Number(reviewOverall?.readyRecords ?? 0) <= 0
                }
                onClick={() =>
                  setReadyConfirmSource({
                    sourceType: null,
                    label: "todas as fontes BI",
                    totalRecords: Number(reviewOverall?.readyRecords ?? 0),
                  })
                }
              >
                Aplicar tudo pronto
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fonte</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Cobertura</TableCell>
                  <TableCell align="right">Prontas</TableCell>
                  <TableCell align="right">Sem sugestão</TableCell>
                  <TableCell align="right">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources.map((source: any) => {
                  const reviewSource = reviewSources.find(
                    (item: any) => item.sourceType === source.sourceType,
                  );
                  const coverage =
                    typeof source?.coveragePercent === "number"
                      ? Number(source.coveragePercent)
                      : null;
                  const supported = Boolean(source?.supported);
                  return (
                    <TableRow
                      key={String(source?.sourceType ?? source?.label)}
                      hover
                    >
                      <TableCell sx={{ minWidth: 240 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {String(source?.label ?? "Fonte BI")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {String(source?.description ?? "")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={supported ? "Suportada" : "Não aplicável"}
                          color={supported ? "primary" : "default"}
                          variant={supported ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 180 }}>
                        <Stack spacing={0.8} alignItems="stretch">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                            alignItems="center"
                          >
                            <Typography variant="subtitle2" fontWeight={700}>
                              {coverage === null
                                ? "N/A"
                                : `${coverage.toFixed(1)}%`}
                            </Typography>
                            {coverage !== null ? (
                              <Chip
                                size="small"
                                color={resolveCoverageColor(coverage) as any}
                                label={
                                  coverage >= 80
                                    ? "Alta"
                                    : coverage >= 50
                                      ? "Parcial"
                                      : "Baixa"
                                }
                              />
                            ) : null}
                          </Stack>
                          {coverage !== null ? (
                            <LinearProgress
                              variant="determinate"
                              value={Math.max(0, Math.min(100, coverage))}
                              color={resolveCoverageColor(coverage) as any}
                              sx={{ height: 8, borderRadius: 999 }}
                            />
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        {Number(reviewSource?.readyRecords ?? 0)}
                      </TableCell>
                      <TableCell align="right">
                        {Number(reviewSource?.unresolvedRecords ?? 0)}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() =>
                            setExpandedSource((current) =>
                              current === source.sourceType
                                ? false
                                : source.sourceType,
                            )
                          }
                        >
                          Revisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Stack spacing={1.5}>
          {reviewSources.map((source) => (
            <Accordion
              key={source.sourceType}
              expanded={expandedSource === source.sourceType}
              onChange={(_event, isExpanded) =>
                setExpandedSource(isExpanded ? source.sourceType : false)
              }
              disableGutters
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.2}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  sx={{ width: "100%" }}
                >
                  <Typography variant="subtitle1" fontWeight={700}>
                    {source.label}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${source.readyRecords} prontas`}
                    color="success"
                    variant={source.readyRecords > 0 ? "filled" : "outlined"}
                  />
                  <Chip
                    size="small"
                    label={`${source.unresolvedRecords} sem sugestão`}
                    color="warning"
                    variant={
                      source.unresolvedRecords > 0 ? "filled" : "outlined"
                    }
                  />
                  <Typography variant="caption" color="text.secondary">
                    {source.description}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.2}
                    justifyContent="space-between"
                  >
                    <Alert severity="info" variant="outlined" sx={{ flex: 1 }}>
                      <strong>Como ler esta revisão:</strong> grupos em verde já
                      têm OM sugerida e só precisam ser aplicados. Grupos em
                      amarelo ainda exigem escolha manual da OM correta antes de
                      gravar o valor canônico na pesquisa.
                    </Alert>
                    {canWrite ? (
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.2}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AutorenewRoundedIcon />}
                          onClick={() => handleRebuild(source.sourceType)}
                          disabled={rebuildMutation.isPending}
                        >
                          Reprocessar fonte
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<HubRoundedIcon />}
                          disabled={
                            applyReadyMutation.isPending ||
                            source.readyRecords <= 0
                          }
                          onClick={() =>
                            setReadyConfirmSource({
                              sourceType: source.sourceType,
                              label: source.label,
                              totalRecords: source.readyRecords,
                            })
                          }
                        >
                          Aplicar tudo pronto da fonte
                        </Button>
                      </Stack>
                    ) : null}
                  </Stack>

                  {source.groups.length === 0 ? (
                    <Alert severity="success" variant="outlined">
                      Esta fonte já está consistente ou não possui correções
                      pendentes para aplicar nesta revisão.
                    </Alert>
                  ) : (
                    <Stack spacing={1.2}>
                      {source.groups.map((group) => (
                        <Card
                          key={group.id}
                          variant="outlined"
                          sx={{ borderRadius: 3 }}
                        >
                          <CardContent>
                            <Stack spacing={1.2}>
                              <Stack
                                direction={{ xs: "column", lg: "row" }}
                                justifyContent="space-between"
                                spacing={1.2}
                              >
                                <Stack spacing={0.7}>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    useFlexGap
                                  >
                                    <Typography
                                      variant="subtitle2"
                                      fontWeight={700}
                                    >
                                      {group.fieldLabel}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      color={
                                        group.status === "READY_TO_APPLY"
                                          ? "success"
                                          : "warning"
                                      }
                                      label={
                                        group.status === "READY_TO_APPLY"
                                          ? "Sugestão pronta"
                                          : "Escolha manual necessária"
                                      }
                                    />
                                    {group.resolutionMethod ? (
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        icon={
                                          group.resolutionMethod ===
                                          "AI_ASSISTED_OM" ? (
                                            <PsychologyAltRoundedIcon fontSize="small" />
                                          ) : undefined
                                        }
                                        label={resolveMethodLabel(
                                          group.resolutionMethod,
                                        )}
                                      />
                                    ) : null}
                                  </Stack>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {group.summary}
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  alignItems={{ xs: "stretch", sm: "center" }}
                                >
                                  <Chip
                                    size="small"
                                    label={`${group.totalRecords} registro(s)`}
                                  />
                                  {typeof group.confidence === "number" ? (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`Confiança ${(group.confidence * 100).toFixed(0)}%`}
                                    />
                                  ) : null}
                                </Stack>
                              </Stack>

                              <Divider />

                              <Stack spacing={0.8}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Variações encontradas
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={0.8}
                                  flexWrap="wrap"
                                  useFlexGap
                                >
                                  {group.variants.map((variant) => (
                                    <Chip
                                      key={`${group.id}-${variant.value}`}
                                      size="small"
                                      variant="outlined"
                                      label={`${variant.value} (${variant.count})`}
                                    />
                                  ))}
                                </Stack>
                              </Stack>

                              <Stack
                                direction={{ xs: "column", lg: "row" }}
                                spacing={1.2}
                                justifyContent="space-between"
                                alignItems={{ xs: "stretch", lg: "center" }}
                              >
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    OM sugerida
                                  </Typography>
                                  {group.suggestedOm ? (
                                    <Typography
                                      variant="body2"
                                      fontWeight={700}
                                    >
                                      {group.suggestedOm.code} —{" "}
                                      {group.suggestedOm.name}
                                      {group.suggestedOm.uf
                                        ? ` (${group.suggestedOm.uf})`
                                        : ""}
                                    </Typography>
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="warning.main"
                                      fontWeight={700}
                                    >
                                      Sem sugestão confiável no momento
                                    </Typography>
                                  )}
                                  {group.reasoning ? (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: "block", mt: 0.4 }}
                                    >
                                      Observação da IA: {group.reasoning}
                                    </Typography>
                                  ) : null}
                                </Box>

                                {canWrite ? (
                                  <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                  >
                                    {group.suggestedOm ? (
                                      <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() =>
                                          handleApplyGroup(
                                            source.sourceType,
                                            group,
                                          )
                                        }
                                        disabled={applyMutation.isPending}
                                      >
                                        Aplicar sugestão
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => {
                                        setSelectedOm(
                                          group.suggestedOm
                                            ? (omsCatalog.find(
                                                (item) =>
                                                  item.id ===
                                                  group.suggestedOm?.id,
                                              ) ?? null)
                                            : null,
                                        );
                                        setManualGroup({
                                          sourceType: source.sourceType,
                                          sourceLabel: source.label,
                                          group,
                                        });
                                      }}
                                    >
                                      Escolher OM
                                    </Button>
                                  </Stack>
                                ) : null}
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </Stack>

      <ConfirmDialog
        open={Boolean(readyConfirmSource)}
        title="Aplicar sugestões prontas"
        message={`Isso vai gravar a OM canônica nos registros da ${readyConfirmSource?.label ?? "fonte selecionada"} e reprocessar a normalização em seguida.`}
        highlightText={
          readyConfirmSource
            ? `${readyConfirmSource.totalRecords} registro(s) serão padronizados agora.`
            : undefined
        }
        note="Use essa ação quando as sugestões automáticas já estiverem coerentes. Ajustes manuais continuam disponíveis abaixo, por grupo."
        confirmLabel="Aplicar agora"
        confirmLoading={applyReadyMutation.isPending}
        onCancel={() => setReadyConfirmSource(null)}
        onConfirm={() =>
          handleApplyReady(readyConfirmSource?.sourceType ?? null)
        }
      />

      <Dialog
        open={Boolean(manualGroup)}
        onClose={
          applyMutation.isPending
            ? undefined
            : () => {
                setManualGroup(null);
                setSelectedOm(null);
              }
        }
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: "1px solid #E3EAF3",
            boxShadow: "0 18px 44px rgba(7, 26, 43, 0.22)",
          },
        }}
      >
        <DialogTitle>Escolher OM manualmente</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.4}>
            <Typography variant="body2" color="text.secondary">
              Fonte: <strong>{manualGroup?.sourceLabel ?? "—"}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Campo: <strong>{manualGroup?.group.fieldLabel ?? "—"}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Variações:{" "}
              {manualGroup ? summarizeVariants(manualGroup.group) : "—"}
            </Typography>
            <Autocomplete
              size="small"
              options={omsCatalog}
              value={selectedOm}
              onChange={(_event, value) => setSelectedOm(value)}
              getOptionLabel={(option: any) =>
                `${option.code} — ${option.name}${option.uf ? ` (${option.uf})` : ""}`
              }
              isOptionEqualToValue={(option: any, value: any) =>
                option.id === value.id
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="OM canônica"
                  helperText="Escolha a OM da lista oficial. Ao confirmar, o valor será gravado nas pesquisas selecionadas."
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            color="inherit"
            disabled={applyMutation.isPending}
            onClick={() => {
              setManualGroup(null);
              setSelectedOm(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={applyMutation.isPending || !selectedOm || !manualGroup}
            onClick={() => {
              if (!manualGroup || !selectedOm) return;
              handleApplyGroup(
                manualGroup.sourceType,
                manualGroup.group,
                selectedOm.id,
              );
            }}
          >
            Aplicar OM escolhida
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
