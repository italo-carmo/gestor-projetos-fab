import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Link as RouterLink } from "react-router-dom";
import { useMemo, useState } from "react";
import { buildAiCopilotPath } from "../../app/aiCopilotLaunch";
import {
  useComgepSituationRoom,
} from "../../api/hooks";
import { AiCopilotCtaRow } from "./AiCopilotCtaRow";
import { ErrorState } from "../states/ErrorState";
import { SkeletonState } from "../states/SkeletonState";

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  color,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        height: "100%",
        borderRadius: 3,
        borderTop: `4px solid ${color}`,
        ...(onClick
          ? {
              cursor: "pointer",
              transition: "box-shadow 0.2s, transform 0.15s",
              "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
            }
          : {}),
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.7 }}
            >
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color, mt: 0.4 }}>
              {value}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.8, lineHeight: 1.55 }}
            >
              {subtitle}
            </Typography>
          </Box>
          <Box sx={{ color }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Typography variant="h6" fontWeight={800} color="#1A3C6E">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {subtitle}
          </Typography>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

function priorityChipColor(value: string) {
  if (value === "CRÍTICA") return "error";
  if (value === "ALTA") return "warning";
  if (value === "ATENÇÃO") return "info";
  return "success";
}

function formatCoverageType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || "Sem cobertura";
}

function buildOmReason(item: any) {
  const reasons: string[] = [];
  const complaints = item?.complaints ?? {};
  if (Number(complaints?.openCases ?? 0) > 0) {
    reasons.push(`${complaints.openCases} denúncia(s) aberta(s)`);
  }
  if (Number(complaints?.retaliationCases ?? 0) > 0) {
    reasons.push(`${complaints.retaliationCases} com risco de retaliação`);
  }
  if (Number(complaints?.stalledCases ?? 0) > 0) {
    reasons.push(`${complaints.stalledCases} além do prazo`);
  }
  if (item?.covered === false) {
    reasons.push("sem cobertura CPCA");
  }
  if (Number(item?.surveyRate ?? 0) >= 20) {
    reasons.push(`pesquisa institucional em ${Number(item.surveyRate).toFixed(1)}%`);
  }
  return reasons.slice(0, 3).join(" • ") || "Risco composto por denúncias, cobertura e sinais BI.";
}

function subnotificationColor(percent: number) {
  if (percent >= 60) return "error";
  if (percent >= 35) return "warning";
  if (percent > 0) return "info";
  return "success";
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function buildComgepCopilotLinks(args: {
  label: string;
  description: string;
  focus?: {
    kind:
      | "overview"
      | "kpi_covered_oms"
      | "kpi_critical_ufs"
      | "kpi_high_risk_oms"
      | "kpi_operational_presence"
      | "uf"
      | "om"
      | "coverage_gap"
      | "operational_pressure";
    uf?: string | null;
    omId?: string | null;
    refId?: string | null;
  } | null;
  allowAction?: boolean;
}) {
  return {
    explainHref: buildAiCopilotPath({
      type: "briefing_comgep",
      mode: "analyst",
      intent: "explain",
      label: args.label,
      description: args.description,
      focus: args.focus ?? { kind: "overview" },
    }),
    briefingHref: buildAiCopilotPath({
      type: "briefing_comgep",
      mode: "executive",
      intent: "briefing",
      label: args.label,
      description: args.description,
      focus: args.focus ?? { kind: "overview" },
    }),
    actionHref: args.allowAction === false
      ? null
      : buildAiCopilotPath({
          type: "priorizacao_intervencao",
          mode: "executive",
          intent: "action",
          label: args.label,
          description: args.description,
          focus: args.focus ?? { kind: "overview" },
        }),
  };
}

function SignalsPreview({ item }: { item: any }) {
  const sexual = Number(item?.sexualSignals ?? 0);
  const moral = Number(item?.moralSignals ?? 0);
  const domestic = Number(item?.domesticSignals?.yes12m ?? 0);
  const military = Number(item?.domesticSignals?.militaryAuthor ?? 0);
  const chips = [
    sexual > 0 ? { label: `Sexual ${sexual}`, color: "#AD1457" } : null,
    moral > 0 ? { label: `Moral ${moral}`, color: "#6A1B9A" } : null,
    domestic > 0 ? { label: `VD 12m ${domestic}`, color: "#1565C0" } : null,
    military > 0 ? { label: `Autor militar ${military}`, color: "#2E7D32" } : null,
  ].filter(Boolean) as Array<{ label: string; color: string }>;

  if (!chips.length) {
    return <Typography variant="body2" color="text.secondary">Sem sinal relevante</Typography>;
  }

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {chips.map((chip) => (
        <Chip
          key={chip.label}
          size="small"
          label={chip.label}
          sx={{ bgcolor: chip.color, color: "#fff" }}
        />
      ))}
    </Stack>
  );
}

function MeaningBlock({
  title,
  meaning,
  source,
}: {
  title: string;
  meaning: string;
  source: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "#F5F8FC",
        border: "1px solid #D7E3F4",
      }}
    >
      <Typography variant="subtitle2" fontWeight={800} color="#1A3C6E">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.6, lineHeight: 1.65 }}>
        {meaning}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
        {source}
      </Typography>
    </Box>
  );
}

function ModalRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        py: 0.5,
        borderBottom: "1px solid #EDF1F7",
      }}
    >
      <Typography variant="body2">{label}</Typography>
      <Chip
        size="small"
        label={value}
        sx={color ? { bgcolor: color, color: "#fff" } : undefined}
      />
    </Box>
  );
}

function ComgepDetailModal({
  open,
  title,
  onClose,
  maxWidth = "md",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">{title}</Typography>
        <Button onClick={onClose} size="small" sx={{ minWidth: "auto" }}>
          <CloseRoundedIcon />
        </Button>
      </DialogTitle>
      <Divider />
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

function ComgepAccordionSection({
  title,
  subtitle,
  defaultExpanded = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      defaultExpanded={defaultExpanded}
      sx={{
        border: "1px solid #E1E7F0",
        borderRadius: "12px !important",
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ bgcolor: "#F8FAFD", px: 2, py: 0.4 }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={800} color="#1A3C6E">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 2 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

export function ComgepStrategicTab() {
  const roomQuery = useComgepSituationRoom();
  const [detailModal, setDetailModal] = useState<
    | null
    | "retaliation"
    | "stalled"
    | "criticalUfs"
    | "confidence"
    | "priorityUf"
    | "riskOm"
  >(null);
  const [selectedPriorityUf, setSelectedPriorityUf] = useState<any | null>(null);
  const [selectedRiskOm, setSelectedRiskOm] = useState<any | null>(null);

  const room = roomQuery.data;
  const summary = room?.summary ?? {};
  const dataConfidence = room?.dataConfidence ?? {};
  const confidencePercent = Number(dataConfidence.supportedCoveragePercent ?? 0);
  const omRiskIndex = Array.isArray(room?.details?.omRiskIndex)
    ? room.details.omRiskIndex
    : [];
  const priorityUfs = Array.isArray(room?.details?.ufMatrix) ? room.details.ufMatrix : [];
  const topRiskOms = Array.isArray(room?.watchlists?.topRiskOms)
    ? room.watchlists.topRiskOms
    : [];
  const retaliationOms = useMemo(
    () =>
      omRiskIndex
        .filter((item: any) => Number(item?.complaints?.retaliationCases ?? 0) > 0)
        .sort(
          (a: any, b: any) =>
            Number(b?.complaints?.retaliationCases ?? 0) -
            Number(a?.complaints?.retaliationCases ?? 0),
        ),
    [omRiskIndex],
  );
  const stalledOms = useMemo(
    () =>
      omRiskIndex
        .filter((item: any) => Number(item?.complaints?.stalledCases ?? 0) > 0)
        .sort(
          (a: any, b: any) =>
            Number(b?.complaints?.stalledCases ?? 0) -
            Number(a?.complaints?.stalledCases ?? 0),
        ),
    [omRiskIndex],
  );
  const retaliationCount = retaliationOms.reduce(
    (sum: number, item: any) => sum + Number(item?.complaints?.retaliationCases ?? 0),
    0,
  );
  const stalledCount = stalledOms.reduce(
    (sum: number, item: any) => sum + Number(item?.complaints?.stalledCases ?? 0),
    0,
  );

  if (roomQuery.isLoading) {
    return <SkeletonState />;
  }

  if (roomQuery.isError) {
    return (
      <ErrorState error={roomQuery.error} onRetry={() => roomQuery.refetch()} />
    );
  }

  return (
    <Stack spacing={2}>
      <Alert
        severity="info"
        sx={{
          borderRadius: 3,
          alignItems: "flex-start",
          "& .MuiAlert-message": { width: "100%" },
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              Priorização executiva COMGEP
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.65 }}>
              Este recorte mostra só o que muda decisão: UFs críticas, OMs que puxam o risco,
              retaliação, passivo acima do prazo e confiança mínima para cruzar os dados.
              Explicações mais longas e transformação em ação ficam na IA.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/ai?tab=assistant"
            variant="contained"
            startIcon={<AutoAwesomeRoundedIcon />}
            sx={{
              bgcolor: "#1A3C6E",
              "&:hover": { bgcolor: "#122B4E" },
              alignSelf: { xs: "stretch", md: "auto" },
            }}
          >
            Abrir IA
          </Button>
        </Stack>
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="Retaliação"
            value={retaliationCount}
            subtitle="Casos abertos com risco atual para a vítima."
            color="#D32F2F"
            icon={<WarningAmberRoundedIcon />}
            onClick={() => setDetailModal("retaliation")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="Passivo > 30 dias"
            value={stalledCount}
            subtitle="Casos abertos com atraso relevante de tratamento."
            color="#ED6C02"
            icon={<ShieldRoundedIcon />}
            onClick={() => setDetailModal("stalled")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="UFs críticas"
            value={summary.criticalUfCount ?? 0}
            subtitle="Estados que pedem atuação prioritária agora."
            color="#ED6C02"
            icon={<TrendingUpRoundedIcon />}
            onClick={() => setDetailModal("criticalUfs")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="Base normalizada"
            value={`${confidencePercent.toFixed(1)}%`}
            subtitle="Qualidade mínima da base para cruzamento executivo."
            color="#2E7D32"
            icon={<HubRoundedIcon />}
            onClick={() => setDetailModal("confidence")}
          />
        </Grid>
      </Grid>

      <SectionCard
        title="Onde atuar agora"
        subtitle="UFs que concentram risco, formalização insuficiente ou resposta abaixo do necessário. Clique para detalhar."
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>UF</strong></TableCell>
                <TableCell><strong>Prioridade</strong></TableCell>
                <TableCell><strong>Sinais</strong></TableCell>
                <TableCell align="right"><strong>Casos</strong></TableCell>
                <TableCell align="right"><strong>Subnotif.</strong></TableCell>
                <TableCell align="right"><strong>Presença</strong></TableCell>
                <TableCell><strong>Foco</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priorityUfs.slice(0, 12).map((item: any) => (
                <TableRow
                  key={item.uf}
                  hover
                  onClick={() => {
                    setSelectedPriorityUf(item);
                    setDetailModal("priorityUf");
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{item.uf}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={priorityChipColor(item.priorityBand)}
                      label={`${item.priorityBand} • Pressão ${item.pressureScore ?? 0}`}
                    />
                  </TableCell>
                  <TableCell>
                    <SignalsPreview item={item} />
                  </TableCell>
                  <TableCell align="right">
                    {item.complaints?.openCases ?? 0} / {item.complaints?.totalCases ?? 0}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={subnotificationColor(Number(item?.underreport?.percent ?? 0))}
                      label={formatPercent(item?.underreport?.percent)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {Number(item?.presenceScore ?? 0)}
                  </TableCell>
                  <TableCell>{item.recommendedFocus ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!priorityUfs.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma UF priorizada no recorte atual.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard
        title="OMs que puxam o risco"
        subtitle="OMs que mais explicam a priorização nacional. Clique para detalhar."
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>OM</strong></TableCell>
                <TableCell><strong>UF</strong></TableCell>
                <TableCell align="right"><strong>Score</strong></TableCell>
                <TableCell><strong>Sinais</strong></TableCell>
                <TableCell align="right"><strong>Casos</strong></TableCell>
                <TableCell align="right"><strong>Subnotif.</strong></TableCell>
                <TableCell><strong>Foco</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topRiskOms.slice(0, 12).map((item: any) => (
                <TableRow
                  key={item.id}
                  hover
                  onClick={() => {
                    setSelectedRiskOm(item);
                    setDetailModal("riskOm");
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{item.code || item.name || "—"}</TableCell>
                  <TableCell>{item.uf || "—"}</TableCell>
                  <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                  <TableCell>
                    <SignalsPreview item={item} />
                  </TableCell>
                  <TableCell align="right">
                    {item.complaints?.openCases ?? 0} / {item.complaints?.totalCases ?? 0}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={subnotificationColor(Number(item?.underreport?.percent ?? 0))}
                      label={formatPercent(item?.underreport?.percent)}
                    />
                  </TableCell>
                  <TableCell>{item.recommendedAction ?? buildOmReason(item)}</TableCell>
                </TableRow>
              ))}
              {!topRiskOms.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma OM em destaque no recorte atual.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <ComgepDetailModal
        open={detailModal === "retaliation"}
        title="Detalhamento — Risco de retaliação"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <AiCopilotCtaRow
            title="Usar este KPI na IA"
            subtitle="Abra a IA já focada em retaliação para explicar o cenário, gerar briefing ou propor intervenção."
            {...buildComgepCopilotLinks({
              label: "Risco de retaliação",
              description: "Casos abertos com risco de retaliação e OMs impactadas no recorte atual.",
            })}
          />
          <MeaningBlock
            title="O que isso significa"
            meaning="Este indicador mostra quantos casos abertos hoje carregam marcação de retaliação ou risco de retaliação. Ele não mede volume total de denúncias; ele destaca os casos mais sensíveis para proteção da vítima e ação imediata do gestor."
            source="Fonte: denúncias abertas da base CPCA/SMIF consolidadas na Sala COMGEP."
          />
          <ComgepAccordionSection
            title="Resumo executivo"
            subtitle="Volume sensível que exige proteção institucional"
            defaultExpanded
          >
            <Stack spacing={1}>
              <ModalRow label="Casos com risco de retaliação" value={retaliationCount} color="#D32F2F" />
              <ModalRow label="OMs impactadas" value={retaliationOms.length} />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Este é um KPI de sensibilidade. O ponto principal não é quantas denúncias existem, mas quantos casos demandam contenção de risco, proteção de vítima e monitoramento mais próximo do fluxo.
              </Typography>
            </Stack>
          </ComgepAccordionSection>
          <ComgepAccordionSection
            title="OMs impactadas"
            subtitle="Locais onde o risco de retaliação está concentrado"
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>OM</strong></TableCell>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell align="right"><strong>Retaliação</strong></TableCell>
                    <TableCell align="right"><strong>Abertos</strong></TableCell>
                    <TableCell><strong>Motivo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {retaliationOms.slice(0, 12).map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.code || item.name || "—"}</TableCell>
                      <TableCell>{item.uf || "—"}</TableCell>
                      <TableCell align="right">{item.complaints?.retaliationCases ?? 0}</TableCell>
                      <TableCell align="right">{item.complaints?.openCases ?? 0}</TableCell>
                      <TableCell>{buildOmReason(item)}</TableCell>
                    </TableRow>
                  ))}
                  {!retaliationOms.length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum caso com risco de retaliação no recorte atual.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </ComgepAccordionSection>
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "stalled"}
        title="Detalhamento — Casos além do prazo"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <AiCopilotCtaRow
            title="Usar este KPI na IA"
            subtitle="Leve o passivo além do prazo para a IA e peça leitura executiva, briefing ou plano de ação."
            {...buildComgepCopilotLinks({
              label: "Casos além do prazo",
              description: "Casos abertos há mais de 30 dias e OMs com atraso relevante de tratamento.",
            })}
          />
          <MeaningBlock
            title="O que isso significa"
            meaning="Este indicador soma os casos abertos há mais de 30 dias. Ele funciona como alerta de atraso de tratamento, risco de perda de confiança na resposta institucional e potencial de agravamento do passivo."
            source="Fonte: denúncias abertas da base CPCA/SMIF, com cálculo de tempo desde o registro."
          />
          <ComgepAccordionSection
            title="Resumo executivo"
            subtitle="Passivo institucional com atraso relevante"
            defaultExpanded
          >
            <Stack spacing={1}>
              <ModalRow label="Casos além do prazo" value={stalledCount} color="#ED6C02" />
              <ModalRow label="OMs impactadas" value={stalledOms.length} />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Este número ajuda a separar carga de trabalho normal de passivo que já pressiona a confiança no fluxo institucional. Quanto mais casos estagnados, maior o risco de desgaste e agravamento.
              </Typography>
            </Stack>
          </ComgepAccordionSection>
          <ComgepAccordionSection
            title="OMs impactadas"
            subtitle="Onde o atraso está mais concentrado"
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>OM</strong></TableCell>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell align="right"><strong>Além do prazo</strong></TableCell>
                    <TableCell align="right"><strong>Abertos</strong></TableCell>
                    <TableCell><strong>Motivo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stalledOms.slice(0, 12).map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.code || item.name || "—"}</TableCell>
                      <TableCell>{item.uf || "—"}</TableCell>
                      <TableCell align="right">{item.complaints?.stalledCases ?? 0}</TableCell>
                      <TableCell align="right">{item.complaints?.openCases ?? 0}</TableCell>
                      <TableCell>{buildOmReason(item)}</TableCell>
                    </TableRow>
                  ))}
                  {!stalledOms.length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum caso acima do prazo no recorte atual.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </ComgepAccordionSection>
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "criticalUfs"}
        title="Detalhamento — UFs prioritárias"
        onClose={() => setDetailModal(null)}
        maxWidth="xl"
      >
        <Stack spacing={1.25}>
          <AiCopilotCtaRow
            title="Usar este KPI na IA"
            subtitle="Abra a IA com foco nas UFs críticas para gerar explicação, briefing ou priorização de intervenção."
            {...buildComgepCopilotLinks({
              label: "UFs críticas",
              description: "UFs classificadas em faixa crítica pela matriz da Sala COMGEP.",
              focus: { kind: "kpi_critical_ufs" },
            })}
          />
          <MeaningBlock
            title="O que isso significa"
            meaning="Este KPI conta quantas UFs estão em faixa crítica na matriz da Sala COMGEP. A classificação considera risco composto, cobertura CPCA e presença operacional. Não é um volume bruto; é um indicador de prioridade executiva."
            source="Fonte: matriz consolidada da Sala COMGEP, com cruzamento entre denúncias, cobertura, BI e presença operacional."
          />
          <ComgepAccordionSection
            title="Resumo executivo"
            subtitle="Quantidade de UFs que exigem prioridade de atuação"
            defaultExpanded
          >
            <Stack spacing={1}>
              <ModalRow label="UFs em faixa crítica" value={summary.criticalUfCount ?? 0} color="#ED6C02" />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Esta leitura já combina risco, governança e presença. A lista abaixo existe para o gestor sair do número agregado e entender quais UFs realmente puxam a priorização.
              </Typography>
            </Stack>
          </ComgepAccordionSection>
          <ComgepAccordionSection
            title="UFs em faixa crítica"
            subtitle="Clique em uma UF para abrir o detalhamento completo"
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell><strong>Faixa</strong></TableCell>
                    <TableCell><strong>Sinais de pesquisa</strong></TableCell>
                    <TableCell align="right"><strong>Formais</strong></TableCell>
                    <TableCell align="right"><strong>Subnotificação</strong></TableCell>
                    <TableCell><strong>Foco recomendado</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priorityUfs.slice(0, 12).map((item: any) => (
                    <TableRow
                      key={item.uf}
                      hover
                      onClick={() => {
                        setSelectedPriorityUf(item);
                        setDetailModal("priorityUf");
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{item.uf}</TableCell>
                      <TableCell>
                        <Chip size="small" color={priorityChipColor(item.priorityBand)} label={item.priorityBand} />
                      </TableCell>
                      <TableCell><SignalsPreview item={item} /></TableCell>
                      <TableCell align="right">
                        {item.complaints?.openCases ?? 0} / {item.complaints?.totalCases ?? 0}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          color={subnotificationColor(Number(item?.underreport?.percent ?? 0))}
                          label={formatPercent(item?.underreport?.percent)}
                        />
                      </TableCell>
                      <TableCell>{item.recommendedFocus ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </ComgepAccordionSection>
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "confidence"}
        title="Detalhamento — Confiança do dado"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <AiCopilotCtaRow
            title="Usar este KPI na IA"
            subtitle="Leve a qualidade da base para a IA quando precisar explicar confiança do dado ou gerar resumo executivo do recorte."
            {...buildComgepCopilotLinks({
              label: "Confiança do dado",
              description: "Cobertura útil da normalização BI para cruzamento executivo por OM e UF.",
              allowAction: false,
            })}
          />
          <MeaningBlock
            title="O que isso significa"
            meaning="Este indicador mede quanto da base BI já está normalizada por OM ou ao menos por UF. Quanto maior a cobertura útil, mais confiável fica o cruzamento entre pesquisas, denúncias, cobertura CPCA e presença operacional."
            source="Fonte: processo de normalização BI que vincula registros a OM e UF."
          />
          <ComgepAccordionSection
            title="Resumo executivo"
            subtitle="Qualidade mínima para cruzar BI com os demais sinais"
            defaultExpanded
          >
            <Stack spacing={1}>
              <ModalRow label="Cobertura útil" value={`${confidencePercent.toFixed(1)}%`} color="#2E7D32" />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Quanto mais registros vinculados a OM ou pelo menos UF, mais confiável fica a leitura executiva da Sala COMGEP. Esse KPI mede qualidade de base, não gravidade de cenário.
              </Typography>
            </Stack>
          </ComgepAccordionSection>
          <ComgepAccordionSection
            title="Composição da confiança"
            subtitle="Como a cobertura útil se divide na base processada"
          >
            <Stack spacing={1}>
              <ModalRow label="Total de registros BI" value={dataConfidence.totalRecords ?? 0} />
              <ModalRow label="Vínculo direto com OM" value={dataConfidence.matched ?? 0} />
              <ModalRow label="Vínculo apenas por UF" value={dataConfidence.ufOnly ?? 0} />
              <ModalRow label="Sem vínculo" value={dataConfidence.notFound ?? 0} />
            </Stack>
          </ComgepAccordionSection>
          {Array.isArray(dataConfidence.sources) && dataConfidence.sources.length > 0 ? (
            <ComgepAccordionSection
              title="Fontes consideradas"
              subtitle="Cobertura detalhada por origem de dado"
            >
              <List disablePadding sx={{ border: "1px solid #E6ECF5", borderRadius: 2 }}>
                {dataConfidence.sources.map((item: any, index: number) => (
                  <ListItem key={`${item.sourceType}-${index}`} divider={index < dataConfidence.sources.length - 1}>
                    <ListItemText
                      primary={item.label || item.sourceType || "Fonte"}
                      secondary={`Registros: ${item.totalRecords ?? 0} • Vínculo direto: ${item.matched ?? 0} • Só UF: ${item.ufOnly ?? 0} • Sem vínculo: ${item.notFound ?? 0}`}
                    />
                  </ListItem>
                ))}
              </List>
            </ComgepAccordionSection>
          ) : null}
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "priorityUf"}
        title={`Detalhamento — UF prioritária${selectedPriorityUf?.uf ? ` (${selectedPriorityUf.uf})` : ""}`}
        onClose={() => {
          setDetailModal(null);
          setSelectedPriorityUf(null);
        }}
        maxWidth="xl"
      >
        <Stack spacing={1.25}>
          <AiCopilotCtaRow
            title="Levar esta UF para a IA"
            subtitle="Use a IA para explicar por que esta UF entrou no ranking, gerar briefing pronto ou converter o insight em plano de atuação."
            {...buildComgepCopilotLinks({
              label: `UF prioritária ${selectedPriorityUf?.uf ?? ""}`.trim(),
              description:
                selectedPriorityUf?.recommendedFocus
                  ? `${selectedPriorityUf.recommendedFocus} Pressão ${selectedPriorityUf?.pressureScore ?? 0}, risco ${selectedPriorityUf?.riskScore ?? 0}.`
                  : `UF ${selectedPriorityUf?.uf ?? "selecionada"} em faixa prioritária na Sala COMGEP.`,
              focus: {
                kind: "uf",
                uf: selectedPriorityUf?.uf ?? null,
              },
            })}
          />
          <MeaningBlock
            title="O que isso significa"
            meaning="Esta UF aparece como prioritária porque concentra sinais de pesquisa, denúncias formais e capacidade de resposta abaixo do necessário. O ranking combina assédio moral/sexual, violência doméstica em 12 meses, subnotificação estimada, cobertura CPCA e presença operacional."
            source="Fonte: cruzamento entre pesquisas BI normalizadas, denúncias formais CPCA e registros operacionais de missão e atividade."
          />
          <ComgepAccordionSection
            title="Resumo executivo"
            subtitle="Como esta UF aparece para o gestor"
            defaultExpanded
          >
            <Stack spacing={1}>
              <ModalRow label="UF" value={selectedPriorityUf?.uf ?? "—"} />
              <ModalRow label="Faixa" value={selectedPriorityUf?.priorityBand ?? "—"} color="#ED6C02" />
              <ModalRow label="Risco" value={selectedPriorityUf?.riskScore ?? 0} />
              <ModalRow label="Pressão operacional" value={selectedPriorityUf?.pressureScore ?? 0} color="#D32F2F" />
              <ModalRow label="Presença" value={selectedPriorityUf?.presenceScore ?? 0} />
              <ModalRow
                label="Cobertura CPCA"
                value={`${Number(selectedPriorityUf?.coveragePercent ?? 0).toFixed(1)}%`}
              />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {selectedPriorityUf?.recommendedFocus ?? "Monitorar cenário."}
              </Typography>
            </Stack>
          </ComgepAccordionSection>
          <ComgepAccordionSection
            title="Sinais que compõem a prioridade"
            subtitle="Pesquisas, subnotificação, formalização e presença"
          >
            <Stack spacing={1}>
              <ModalRow label="Pesquisa institucional" value={formatPercent(selectedPriorityUf?.surveyRate)} />
              <ModalRow label="Violência doméstica 12 meses" value={formatPercent(selectedPriorityUf?.domesticRate)} />
              <ModalRow label="Assédio/violência sexual" value={selectedPriorityUf?.sexualSignals ?? 0} />
              <ModalRow label="Assédio/violência moral" value={selectedPriorityUf?.moralSignals ?? 0} />
              <ModalRow label="Autor militar" value={selectedPriorityUf?.domesticSignals?.militaryAuthor ?? 0} />
              <ModalRow
                label="Subnotificação estimada"
                value={formatPercent(selectedPriorityUf?.underreport?.percent)}
                color="#6A1B9A"
              />
              <ModalRow label="Denúncias formais" value={selectedPriorityUf?.complaints?.totalCases ?? 0} />
              <ModalRow label="Denúncias abertas" value={selectedPriorityUf?.complaints?.openCases ?? 0} />
              <ModalRow label="Missões na UF" value={selectedPriorityUf?.presence?.missions ?? 0} />
              <ModalRow label="Atividades concluídas" value={selectedPriorityUf?.presence?.completedActivities ?? 0} />
              <ModalRow label="Relatórios assinados" value={selectedPriorityUf?.presence?.signedReports ?? 0} />
            </Stack>
          </ComgepAccordionSection>
          {Array.isArray(selectedPriorityUf?.rankingReasons) &&
          selectedPriorityUf.rankingReasons.length > 0 ? (
            <ComgepAccordionSection
              title="Por que esta UF aparece aqui"
              subtitle="Explicação textual do ranking"
            >
              <List disablePadding sx={{ border: "1px solid #E6ECF5", borderRadius: 2 }}>
                {selectedPriorityUf.rankingReasons.map((reason: string, index: number) => (
                  <ListItem key={`${reason}-${index}`} divider={index < selectedPriorityUf.rankingReasons.length - 1}>
                    <ListItemText primary={reason} />
                  </ListItem>
                ))}
              </List>
            </ComgepAccordionSection>
          ) : null}
          <ComgepAccordionSection
            title="OMs que mais puxam a pressão desta UF"
            subtitle="Clique em uma OM para abrir o detalhamento completo"
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>OM</strong></TableCell>
                    <TableCell align="right"><strong>Score</strong></TableCell>
                    <TableCell><strong>Cobertura</strong></TableCell>
                    <TableCell align="right"><strong>Abertos</strong></TableCell>
                    <TableCell><strong>Motivo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selectedPriorityUf?.oms ?? []).slice(0, 10).map((item: any) => (
                    <TableRow
                      key={item.id}
                      hover
                      onClick={() => {
                        setSelectedRiskOm(item);
                        setDetailModal("riskOm");
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{item.code || item.name || "—"}</TableCell>
                      <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                      <TableCell>{formatCoverageType(item.coverageType)}</TableCell>
                      <TableCell align="right">{item.complaints?.openCases ?? 0}</TableCell>
                      <TableCell>{buildOmReason(item)}</TableCell>
                    </TableRow>
                  ))}
                  {!(selectedPriorityUf?.oms ?? []).length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhuma OM detalhada para esta UF.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </ComgepAccordionSection>
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "riskOm"}
        title={`Detalhamento — OM de maior risco${selectedRiskOm?.code ? ` (${selectedRiskOm.code})` : ""}`}
        onClose={() => {
          setDetailModal(null);
          setSelectedRiskOm(null);
        }}
        maxWidth="lg"
      >
        <Stack spacing={1.25}>
          <AiCopilotCtaRow
            title="Levar esta OM para a IA"
            subtitle="Explique a posição da OM, gere um briefing executivo ou peça à IA um pacote de intervenção orientado por evidências."
            {...buildComgepCopilotLinks({
              label:
                selectedRiskOm?.code ??
                selectedRiskOm?.name ??
                "OM de maior risco",
              description:
                selectedRiskOm?.recommendedAction ??
                "OM em destaque no ranking de risco da Sala COMGEP.",
              focus: {
                kind: "om",
                uf: selectedRiskOm?.uf ?? null,
                omId: selectedRiskOm?.id ?? null,
              },
            })}
          />
          <MeaningBlock
            title="O que isso significa"
            meaning="Esta OM aparece no ranking porque a combinação entre pesquisas, denúncias formais, cobertura CPCA e presença operacional indica necessidade de atuação prioritária. O objetivo aqui não é só mostrar volume, mas explicar por que a comissão deve agir nesta OM."
            source="Fonte: cruzamento entre pesquisas BI normalizadas por OM, denúncias formais CPCA e presença operacional recente na UF."
          />
          <ComgepAccordionSection
            title="Resumo executivo"
            subtitle="Síntese da OM no ranking"
            defaultExpanded
          >
            <Stack spacing={1}>
              <ModalRow label="OM" value={selectedRiskOm?.code ?? selectedRiskOm?.name ?? "—"} />
              <ModalRow label="UF" value={selectedRiskOm?.uf ?? "—"} />
              <ModalRow label="Score de risco" value={selectedRiskOm?.riskScore ?? 0} color="#D32F2F" />
              <ModalRow label="Cobertura CPCA" value={formatCoverageType(selectedRiskOm?.coverageType)} />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {selectedRiskOm?.recommendedAction ?? "Monitorar cenário e manter presença institucional."}
              </Typography>
            </Stack>
          </ComgepAccordionSection>
          <ComgepAccordionSection
            title="Sinais que compõem o score"
            subtitle="Pesquisas, formalização, subnotificação e presença"
          >
            <Stack spacing={1}>
              <ModalRow label="Pesquisa institucional" value={formatPercent(selectedRiskOm?.surveyRate)} />
              <ModalRow label="Violência doméstica 12 meses" value={formatPercent(selectedRiskOm?.domesticRate)} />
              <ModalRow label="Assédio/violência sexual" value={selectedRiskOm?.sexualSignals ?? 0} />
              <ModalRow label="Assédio/violência moral" value={selectedRiskOm?.moralSignals ?? 0} />
              <ModalRow label="Autor militar" value={selectedRiskOm?.domesticSignals?.militaryAuthor ?? 0} />
              <ModalRow
                label="Subnotificação estimada"
                value={formatPercent(selectedRiskOm?.underreport?.percent)}
                color="#6A1B9A"
              />
              <ModalRow label="Denúncias formais" value={selectedRiskOm?.complaints?.totalCases ?? 0} />
              <ModalRow label="Denúncias abertas" value={selectedRiskOm?.complaints?.openCases ?? 0} />
              <ModalRow label="Risco de retaliação" value={selectedRiskOm?.complaints?.retaliationCases ?? 0} />
              <ModalRow label="Casos além do prazo" value={selectedRiskOm?.complaints?.stalledCases ?? 0} />
              <ModalRow label="Missões na UF" value={selectedRiskOm?.operationalPresence?.missions ?? 0} />
              <ModalRow label="Atividades concluídas na UF" value={selectedRiskOm?.operationalPresence?.completedActivities ?? 0} />
              <ModalRow label="Relatórios assinados na UF" value={selectedRiskOm?.operationalPresence?.signedReports ?? 0} />
            </Stack>
          </ComgepAccordionSection>
          {Array.isArray(selectedRiskOm?.rankingReasons) && selectedRiskOm.rankingReasons.length > 0 ? (
            <ComgepAccordionSection
              title="Por que esta OM ocupa essa posição"
              subtitle="Justificativa textual do ranking"
            >
              <List disablePadding sx={{ border: "1px solid #E6ECF5", borderRadius: 2 }}>
                {selectedRiskOm.rankingReasons.map((reason: string, index: number) => (
                  <ListItem key={`${reason}-${index}`} divider={index < selectedRiskOm.rankingReasons.length - 1}>
                    <ListItemText primary={reason} />
                  </ListItem>
                ))}
              </List>
            </ComgepAccordionSection>
          ) : null}
          {selectedRiskOm?.link ? (
            <ComgepAccordionSection
              title="Ação relacionada"
              subtitle="Atalho para o fluxo formal da OM"
            >
              <Button
                component={RouterLink}
                to={selectedRiskOm.link}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              >
                Abrir casos formais da OM
              </Button>
            </ComgepAccordionSection>
          ) : null}
        </Stack>
      </ComgepDetailModal>
    </Stack>
  );
}
