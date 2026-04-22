import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import { useDeferredValue, useMemo, useState } from "react";
import { useCpcaChecklistNational } from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import {
  formatCpcaChecklistOmLabel,
  formatCpcaChecklistDate,
  getCpcaChecklistFieldConfig,
  getCpcaChecklistReadOnlyStatusLabel,
  getCpcaChecklistStatusTone,
  normalizeCpcaChecklistUrl,
  type CpcaChecklistItem,
  type CpcaChecklistItemKey,
  type CpcaChecklistSnapshot,
  type CpcaChecklistStatus,
} from "../features/cpcaChecklist";

type NationalChecklistRow = {
  locality: {
    id: string;
    code: string;
    name: string;
    uf?: string | null;
  };
  currentPresident?: {
    assignedAt: string;
    designationBulletin?: string | null;
    isSubstitution: boolean;
    user: {
      id: string;
      name: string;
      email?: string | null;
    };
  } | null;
  checklist: CpcaChecklistSnapshot;
};

const STATUS_OPTIONS: Array<{ value: "ALL" | CpcaChecklistStatus; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "NOT_STARTED", label: "Não iniciadas" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluídas" },
];

function resolveChecklistIcon(itemKey: CpcaChecklistItemKey) {
  if (itemKey === "EMAIL_DIRETO_RELATOS") {
    return <MailOutlineRoundedIcon fontSize="small" />;
  }
  if (itemKey === "LINK_INTRAER_CPCA") {
    return <LinkRoundedIcon fontSize="small" />;
  }
  if (itemKey === "PALESTRA") return <CampaignRoundedIcon fontSize="small" />;
  if (itemKey === "SEMINARIO_EVENTO") {
    return <EventAvailableRoundedIcon fontSize="small" />;
  }
  if (itemKey === "MATERIAIS_INFORMATIVOS") {
    return <DescriptionRoundedIcon fontSize="small" />;
  }
  if (itemKey === "COMPARTILHAMENTO_APLICATIVOS_MENSAGEM") {
    return <ShareRoundedIcon fontSize="small" />;
  }
  if (itemKey === "POP_US") return <TouchAppRoundedIcon fontSize="small" />;
  return <GroupsRoundedIcon fontSize="small" />;
}

function SummaryStatCard(props: {
  label: string;
  value: string;
  tone: "default" | "success" | "warning";
}) {
  const background =
    props.tone === "success"
      ? "linear-gradient(135deg, rgba(46,125,50,0.16), rgba(129,199,132,0.08))"
      : props.tone === "warning"
        ? "linear-gradient(135deg, rgba(245,124,0,0.16), rgba(255,183,77,0.08))"
        : "linear-gradient(135deg, rgba(15,23,42,0.08), rgba(148,163,184,0.12))";

  return (
    <Box
      sx={{
        minWidth: { xs: "100%", sm: 180 },
        flex: 1,
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        background,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.4 }}>
        {props.label}
      </Typography>
      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
        {props.value}
      </Typography>
    </Box>
  );
}

function ChecklistTile({ item }: { item: CpcaChecklistItem }) {
  const isCompleted = Boolean(item.isCompleted);
  const fieldConfig = getCpcaChecklistFieldConfig(item.itemKey);
  const statusLabel = getCpcaChecklistReadOnlyStatusLabel(
    item.itemKey,
    isCompleted,
  );
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: isCompleted ? "success.light" : "divider",
        background: isCompleted
          ? "linear-gradient(135deg, rgba(46,125,50,0.10), rgba(129,199,132,0.05))"
          : "linear-gradient(135deg, rgba(15,23,42,0.03), rgba(148,163,184,0.06))",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
          <Box sx={{ color: isCompleted ? "success.main" : "text.secondary", display: "flex" }}>
            {resolveChecklistIcon(item.itemKey)}
          </Box>
          <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
            {item.shortLabel}
          </Typography>
        </Stack>
        {isCompleted ? (
          <CheckCircleRoundedIcon color="success" fontSize="small" />
        ) : (
          <RadioButtonUncheckedRoundedIcon color="disabled" fontSize="small" />
        )}
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <TodayRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
        <Typography variant="caption" color="text.secondary">
          {isCompleted ? formatCpcaChecklistDate(item.completedAt) : statusLabel}
        </Typography>
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          mt: 1,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: 32,
        }}
      >
        {item.details || item.description}
      </Typography>

      {isCompleted && item.itemKey === "EMAIL_DIRETO_RELATOS" && item.details ? (
        <Typography
          variant="caption"
          component="a"
          href={`mailto:${item.details}`}
          sx={{
            mt: 1,
            display: "block",
            fontWeight: 700,
            color: "primary.main",
            textDecoration: "none",
            overflowWrap: "anywhere",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {fieldConfig.detailsLabel}: {item.details}
        </Typography>
      ) : null}

      {isCompleted && item.itemKey === "LINK_INTRAER_CPCA" && item.details ? (
        <Typography
          variant="caption"
          component="a"
          href={normalizeCpcaChecklistUrl(item.details)}
          target="_blank"
          rel="noreferrer"
          sx={{
            mt: 1,
            display: "block",
            fontWeight: 700,
            color: "primary.main",
            textDecoration: "none",
            overflowWrap: "anywhere",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {fieldConfig.detailsLabel}: {item.details}
        </Typography>
      ) : null}

      {item.speakerName ? (
        <Typography variant="caption" sx={{ mt: 1, display: "block", fontWeight: 700 }}>
          Palestrante: {item.speakerName}
        </Typography>
      ) : null}
    </Box>
  );
}

export function CpcaChecklistPage() {
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("");
  const [status, setStatus] = useState<"ALL" | CpcaChecklistStatus>("ALL");
  const deferredSearch = useDeferredValue(search);

  const filters = useMemo(
    () => ({
      q: deferredSearch.trim() || undefined,
      uf: uf || undefined,
      status: status === "ALL" ? undefined : status,
    }),
    [deferredSearch, status, uf],
  );

  const overviewQuery = useCpcaChecklistNational(filters, true);

  if (overviewQuery.isLoading) {
    return <SkeletonState />;
  }
  if (overviewQuery.isError) {
    return (
      <ErrorState
        error={overviewQuery.error}
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }

  const items = (overviewQuery.data?.items ?? []) as NationalChecklistRow[];
  const summary = (overviewQuery.data?.summary ?? {
    totalCount: 0,
    completedCount: 0,
    inProgressCount: 0,
    notStartedCount: 0,
  }) as {
    totalCount: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
  };
  const availableUfs = (overviewQuery.data?.filters?.availableUfs ?? []) as string[];

  return (
    <Box>
      <Stack spacing={2.5}>
        <Card
          sx={{
            overflow: "hidden",
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            background:
              "radial-gradient(circle at top right, rgba(14,165,233,0.12), transparent 28%), linear-gradient(135deg, #f8fafc 0%, #fffaf2 52%, #eef6ff 100%)",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", lg: "center" }}
              >
                <Box sx={{ maxWidth: 760 }}>
                  <Typography variant="h4" fontWeight={900}>
                    Checklist
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Acompanhamento nacional das ações mínimas executadas pelas
                    comissões CPCA nas OMs com CPCA habilitada.
                  </Typography>
                </Box>
                <Chip
                  label={`${summary.totalCount} OMs monitoradas`}
                  sx={{
                    borderRadius: 999,
                    bgcolor: "rgba(15,23,42,0.06)",
                    color: "text.primary",
                    fontWeight: 700,
                  }}
                />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} flexWrap="wrap">
                <SummaryStatCard
                  label="Concluídas"
                  value={String(summary.completedCount)}
                  tone="success"
                />
                <SummaryStatCard
                  label="Em andamento"
                  value={String(summary.inProgressCount)}
                  tone="warning"
                />
                <SummaryStatCard
                  label="Não iniciadas"
                  value={String(summary.notStartedCount)}
                  tone="default"
                />
              </Stack>

              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", lg: "center" }}
              >
                <TextField
                  label="Buscar OM ou presidente"
                  size="small"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  fullWidth
                  sx={{
                    flex: 1,
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "rgba(255,255,255,0.72)",
                    },
                  }}
                />
                <TextField
                  select
                  label="UF"
                  size="small"
                  value={uf}
                  onChange={(event) => setUf(event.target.value)}
                  sx={{
                    minWidth: { xs: "100%", lg: 140 },
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "rgba(255,255,255,0.72)",
                    },
                  }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {availableUfs.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Situação"
                  size="small"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as "ALL" | CpcaChecklistStatus)
                  }
                  sx={{
                    minWidth: { xs: "100%", lg: 190 },
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "rgba(255,255,255,0.72)",
                    },
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma CPCA encontrada"
            description="Ajuste os filtros ou verifique se existem OMs com CPCA habilitada para acompanhamento."
          />
        ) : (
          <Stack spacing={1.5}>
            {items.map((item) => {
              const tone = getCpcaChecklistStatusTone(item.checklist.summary.status);
              return (
                <Accordion
                  key={item.locality.id}
                  disableGutters
                  sx={{
                    overflow: "hidden",
                    borderRadius: 3.5,
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "none",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreRoundedIcon />}
                    sx={{ px: 2.5, py: 1.25 }}
                  >
                    <Stack spacing={1.5} sx={{ width: "100%" }}>
                      <Stack
                        direction={{ xs: "column", lg: "row" }}
                        spacing={1.25}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", lg: "center" }}
                      >
                        <Box>
                          <Typography variant="h6" fontWeight={800}>
                            {formatCpcaChecklistOmLabel(
                              item.locality.code,
                              item.locality.name,
                            )}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.currentPresident?.user?.name
                              ? `Presidente: ${item.currentPresident.user.name}`
                              : "Presidente ainda não designado"}
                            {item.locality.uf ? ` • ${item.locality.uf}` : ""}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            label={item.checklist.summary.statusLabel}
                            color={tone.color}
                            sx={{ fontWeight: 700, background: tone.background }}
                          />
                          <Chip
                            label={`${item.checklist.summary.completedCount}/${item.checklist.summary.totalCount} concluídos`}
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>

                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mb: 0.75 }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            Progresso
                          </Typography>
                          <Typography variant="caption" fontWeight={700}>
                            {item.checklist.summary.completionRate}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={item.checklist.summary.completionRate}
                          color={tone.color === "default" ? "inherit" : tone.color}
                          sx={{
                            height: 10,
                            borderRadius: 999,
                            bgcolor: "action.hover",
                          }}
                        />
                      </Box>
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        divider={<Divider flexItem orientation="vertical" />}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Última ação:{" "}
                          <strong>
                            {formatCpcaChecklistDate(
                              item.checklist.summary.lastUpdatedAt,
                            )}
                          </strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Última entrega:{" "}
                          <strong>
                            {formatCpcaChecklistDate(
                              item.checklist.summary.lastCompletedAt,
                            )}
                          </strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Boletim:{" "}
                          <strong>
                            {item.currentPresident?.designationBulletin || "-"}
                          </strong>
                        </Typography>
                      </Stack>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                            xl: "repeat(3, minmax(0, 1fr))",
                          },
                          gap: 1.25,
                        }}
                      >
                        {item.checklist.items.map((checklistItem) => (
                          <ChecklistTile
                            key={`${item.locality.id}-${checklistItem.itemKey}`}
                            item={checklistItem}
                          />
                        ))}
                      </Box>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
