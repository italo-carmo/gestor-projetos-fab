import {
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
  LinearProgress,
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
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Link as RouterLink } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  useComgepRecommendations,
  useComgepSituationRoom,
} from "../../api/hooks";
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
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
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

export function ComgepStrategicTab() {
  const roomQuery = useComgepSituationRoom();
  const recommendationsQuery = useComgepRecommendations(6);
  const [detailModal, setDetailModal] = useState<
    | null
    | "retaliation"
    | "stalled"
    | "criticalUfs"
    | "confidence"
    | "pressure"
  >(null);
  const [selectedPressureUf, setSelectedPressureUf] = useState<any | null>(null);

  if (roomQuery.isLoading) {
    return <SkeletonState />;
  }

  if (roomQuery.isError) {
    return (
      <ErrorState error={roomQuery.error} onRetry={() => roomQuery.refetch()} />
    );
  }

  const room = roomQuery.data;
  const summary = room?.summary ?? {};
  const dataConfidence = room?.dataConfidence ?? {};
  const watchlists = room?.watchlists ?? {};
  const recommendations = recommendationsQuery.data?.items ?? [];
  const confidencePercent = Number(dataConfidence.supportedCoveragePercent ?? 0);
  const omRiskIndex = Array.isArray(room?.details?.omRiskIndex)
    ? room.details.omRiskIndex
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
              Sala COMGEP consolidada no Painel Estratégico
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.65 }}>
              Este recorte mostra apenas os sinais executivos de decisão:
              cobertura CPCA, OMs descobertas, UFs prioritárias, risco por OM,
              pressão operacional e confiança da base. As análises com IA e o
              assistente operacional foram centralizados em Inteligência
              Artificial.
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
            title="Risco de retaliação"
            value={retaliationCount}
            subtitle="Casos abertos com indicação de retaliação ou risco de retaliação à vítima."
            color="#D32F2F"
            icon={<WarningAmberRoundedIcon />}
            onClick={() => setDetailModal("retaliation")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="Casos além do prazo"
            value={stalledCount}
            subtitle="Denúncias abertas há mais de 30 dias, com potencial de desgaste institucional."
            color="#ED6C02"
            icon={<ShieldRoundedIcon />}
            onClick={() => setDetailModal("stalled")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="UFs prioritárias"
            value={summary.criticalUfCount ?? 0}
            subtitle="UFs em faixa crítica, com risco alto e governança ou presença insuficientes."
            color="#ED6C02"
            icon={<TrendingUpRoundedIcon />}
            onClick={() => setDetailModal("criticalUfs")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="Confiança do dado"
            value={`${confidencePercent.toFixed(1)}%`}
            subtitle="Percentual da base BI já normalizado por OM ou UF para cruzamento executivo."
            color="#2E7D32"
            icon={<HubRoundedIcon />}
            onClick={() => setDetailModal("confidence")}
          />
        </Grid>
      </Grid>

      <SectionCard
        title="Confiança da base executiva"
        subtitle="Leitura rápida da sustentação analítica disponível para cruzar denúncias, cobertura CPCA e presença operacional."
      >
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              Cobertura útil da normalização BI
            </Typography>
            <Chip
              label={`${confidencePercent.toFixed(1)}%`}
              size="small"
              color={confidencePercent >= 70 ? "success" : confidencePercent >= 50 ? "warning" : "error"}
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, confidencePercent))}
            sx={{
              height: 10,
              borderRadius: 999,
              bgcolor: "#E8EEF6",
              "& .MuiLinearProgress-bar": { bgcolor: "#1A3C6E" },
            }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`Registros BI: ${dataConfidence.totalRecords ?? 0}`} size="small" variant="outlined" />
            <Chip label={`Vínculo direto: ${dataConfidence.matched ?? 0}`} size="small" variant="outlined" />
            <Chip label={`Só UF: ${dataConfidence.ufOnly ?? 0}`} size="small" variant="outlined" />
            <Chip label={`Sem vínculo: ${dataConfidence.notFound ?? 0}`} size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
            Quanto maior esse indicador, mais confiável fica o cruzamento entre
            denúncias por OM, cobertura CPCA e sinais operacionais por UF.
          </Typography>
        </Stack>
      </SectionCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <SectionCard
            title="UFs prioritárias"
            subtitle="Estados que exigem atenção do gestor por combinação de risco, cobertura e presença operacional."
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell><strong>Faixa</strong></TableCell>
                    <TableCell align="right"><strong>Risco</strong></TableCell>
                    <TableCell align="right"><strong>Cobertura</strong></TableCell>
                    <TableCell align="right"><strong>Presença</strong></TableCell>
                    <TableCell><strong>Foco recomendado</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(watchlists.criticalUfs ?? []).slice(0, 8).map((item: any) => (
                    <TableRow key={item.uf} hover>
                      <TableCell>{item.uf}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={priorityChipColor(item.priorityBand)}
                          label={item.priorityBand}
                        />
                      </TableCell>
                      <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                      <TableCell align="right">{Number(item.coveragePercent ?? 0).toFixed(1)}%</TableCell>
                      <TableCell align="right">{item.presenceScore ?? 0}</TableCell>
                      <TableCell>{item.recommendedFocus ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!(watchlists.criticalUfs ?? []).length && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhuma UF crítica no recorte atual.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 5 }}>
          <SectionCard
            title="Pressão operacional"
            subtitle="Estados em que o risco está mais alto do que a presença institucional disponível."
          >
            <Stack spacing={1}>
              {(watchlists.operationalPressure ?? []).slice(0, 6).map((item: any) => (
                <Card
                  key={item.uf}
                  variant="outlined"
                  onClick={() => {
                    setSelectedPressureUf(item);
                    setDetailModal("pressure");
                  }}
                  sx={{
                    borderRadius: 2.5,
                    bgcolor: "#FAFBFD",
                    cursor: "pointer",
                    transition: "box-shadow 0.2s, transform 0.15s",
                    "&:hover": { boxShadow: 3, transform: "translateY(-1px)" },
                  }}
                >
                  <CardContent sx={{ py: 1.4, "&:last-child": { pb: 1.4 } }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800}>
                          {item.uf}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.recommendedFocus ?? "Monitorar cenário."}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={item.pressureScore >= 30 ? "error" : item.pressureScore >= 15 ? "warning" : "success"}
                        label={`Pressão ${item.pressureScore ?? 0}`}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={`Risco ${item.riskScore ?? 0}`} />
                      <Chip size="small" variant="outlined" label={`Presença ${item.presenceScore ?? 0}`} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Cobertura ${Number(item.coveragePercent ?? 0).toFixed(1)}%`}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <SectionCard
            title="OMs de maior risco"
            subtitle="Risco composto por denúncias abertas, retaliação, atraso de tratamento, cobertura CPCA e sinais BI."
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>OM</strong></TableCell>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell align="right"><strong>Score</strong></TableCell>
                    <TableCell><strong>Cobertura</strong></TableCell>
                    <TableCell><strong>Motivo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(watchlists.topRiskOms ?? []).slice(0, 8).map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.code || item.name || "—"}</TableCell>
                      <TableCell>{item.uf || "—"}</TableCell>
                      <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                      <TableCell>{formatCoverageType(item.coverageType)}</TableCell>
                      <TableCell>{buildOmReason(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <SectionCard
            title="Gaps de cobertura CPCA"
            subtitle="OMs que permanecem sem CPCA próprio e sem cobertura por outra comissão."
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>OM</strong></TableCell>
                    <TableCell><strong>UF</strong></TableCell>
                    <TableCell align="right"><strong>Score</strong></TableCell>
                    <TableCell><strong>Motivo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(watchlists.coverageGaps ?? []).slice(0, 8).map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.code || item.name || "—"}</TableCell>
                      <TableCell>{item.uf || "—"}</TableCell>
                      <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                      <TableCell>{buildOmReason(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard
        title="Recomendações registradas"
        subtitle="Últimas recomendações estratégicas gravadas no sistema. A nova geração assistida foi centralizada no menu Inteligência Artificial."
      >
        <Stack spacing={1}>
          {recommendations.map((item: any) => (
            <Card key={item.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ py: 1.4, "&:last-child": { pb: 1.4 } }}>
                <Stack spacing={0.75}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle2" fontWeight={800}>
                      {item.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={item.sourceAgentType || "manual"}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                    {item.summary}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {item.uf ? <Chip size="small" label={`UF ${item.uf}`} /> : null}
                    {item.om?.code ? (
                      <Chip size="small" label={`OM ${item.om.code}`} />
                    ) : null}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={new Date(item.createdAt).toLocaleString("pt-BR")}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
          {!recommendations.length && (
            <Typography variant="body2" color="text.secondary">
              Nenhuma recomendação registrada até o momento.
            </Typography>
          )}
        </Stack>
      </SectionCard>

      <ComgepDetailModal
        open={detailModal === "retaliation"}
        title="Detalhamento — Risco de retaliação"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <MeaningBlock
            title="O que isso significa"
            meaning="Este indicador mostra quantos casos abertos hoje carregam marcação de retaliação ou risco de retaliação. Ele não mede volume total de denúncias; ele destaca os casos mais sensíveis para proteção da vítima e ação imediata do gestor."
            source="Fonte: denúncias abertas da base CPCA/SMIF consolidadas na Sala COMGEP."
          />
          <ModalRow label="Casos com risco de retaliação" value={retaliationCount} color="#D32F2F" />
          <ModalRow label="OMs impactadas" value={retaliationOms.length} />
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
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "stalled"}
        title="Detalhamento — Casos além do prazo"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <MeaningBlock
            title="O que isso significa"
            meaning="Este indicador soma os casos abertos há mais de 30 dias. Ele funciona como alerta de atraso de tratamento, risco de perda de confiança na resposta institucional e potencial de agravamento do passivo."
            source="Fonte: denúncias abertas da base CPCA/SMIF, com cálculo de tempo desde o registro."
          />
          <ModalRow label="Casos além do prazo" value={stalledCount} color="#ED6C02" />
          <ModalRow label="OMs impactadas" value={stalledOms.length} />
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
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "criticalUfs"}
        title="Detalhamento — UFs prioritárias"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <MeaningBlock
            title="O que isso significa"
            meaning="Este KPI conta quantas UFs estão em faixa crítica na matriz da Sala COMGEP. A classificação considera risco composto, cobertura CPCA e presença operacional. Não é um volume bruto; é um indicador de prioridade executiva."
            source="Fonte: matriz consolidada da Sala COMGEP, com cruzamento entre denúncias, cobertura, BI e presença operacional."
          />
          <ModalRow label="UFs em faixa crítica" value={summary.criticalUfCount ?? 0} color="#ED6C02" />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>UF</strong></TableCell>
                  <TableCell><strong>Faixa</strong></TableCell>
                  <TableCell align="right"><strong>Risco</strong></TableCell>
                  <TableCell align="right"><strong>Cobertura</strong></TableCell>
                  <TableCell align="right"><strong>Presença</strong></TableCell>
                  <TableCell><strong>Foco recomendado</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(watchlists.criticalUfs ?? []).map((item: any) => (
                  <TableRow key={item.uf}>
                    <TableCell>{item.uf}</TableCell>
                    <TableCell>
                      <Chip size="small" color={priorityChipColor(item.priorityBand)} label={item.priorityBand} />
                    </TableCell>
                    <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                    <TableCell align="right">{Number(item.coveragePercent ?? 0).toFixed(1)}%</TableCell>
                    <TableCell align="right">{item.presenceScore ?? 0}</TableCell>
                    <TableCell>{item.recommendedFocus ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "confidence"}
        title="Detalhamento — Confiança do dado"
        onClose={() => setDetailModal(null)}
      >
        <Stack spacing={1.25}>
          <MeaningBlock
            title="O que isso significa"
            meaning="Este indicador mede quanto da base BI já está normalizada por OM ou ao menos por UF. Quanto maior a cobertura útil, mais confiável fica o cruzamento entre pesquisas, denúncias, cobertura CPCA e presença operacional."
            source="Fonte: processo de normalização BI que vincula registros a OM e UF."
          />
          <ModalRow label="Cobertura útil" value={`${confidencePercent.toFixed(1)}%`} color="#2E7D32" />
          <ModalRow label="Total de registros BI" value={dataConfidence.totalRecords ?? 0} />
          <ModalRow label="Vínculo direto com OM" value={dataConfidence.matched ?? 0} />
          <ModalRow label="Vínculo apenas por UF" value={dataConfidence.ufOnly ?? 0} />
          <ModalRow label="Sem vínculo" value={dataConfidence.notFound ?? 0} />
          {Array.isArray(dataConfidence.sources) && dataConfidence.sources.length > 0 ? (
            <>
              <Typography variant="subtitle2">Fontes consideradas</Typography>
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
            </>
          ) : null}
        </Stack>
      </ComgepDetailModal>

      <ComgepDetailModal
        open={detailModal === "pressure"}
        title={`Detalhamento — Pressão operacional${selectedPressureUf?.uf ? ` (${selectedPressureUf.uf})` : ""}`}
        onClose={() => {
          setDetailModal(null);
          setSelectedPressureUf(null);
        }}
      >
        <Stack spacing={1.25}>
          <MeaningBlock
            title="O que isso significa"
            meaning="Pressão operacional compara o tamanho do risco com a presença institucional disponível na UF. Quando a pressão sobe, o sistema entende que o risco está avançando mais rápido do que a capacidade de resposta operacional ou de governança."
            source="Fonte: Sala COMGEP, cruzando risco composto, cobertura CPCA e presença operacional da UF."
          />
          <ModalRow label="UF" value={selectedPressureUf?.uf ?? "—"} />
          <ModalRow label="Pressão" value={selectedPressureUf?.pressureScore ?? 0} color="#D32F2F" />
          <ModalRow label="Risco" value={selectedPressureUf?.riskScore ?? 0} />
          <ModalRow label="Presença" value={selectedPressureUf?.presenceScore ?? 0} />
          <ModalRow
            label="Cobertura CPCA"
            value={`${Number(selectedPressureUf?.coveragePercent ?? 0).toFixed(1)}%`}
          />
          <ModalRow
            label="Missões na UF"
            value={selectedPressureUf?.presence?.missions ?? 0}
          />
          <ModalRow
            label="Atividades concluídas"
            value={selectedPressureUf?.presence?.completedActivities ?? 0}
          />
          <ModalRow
            label="Relatórios assinados"
            value={selectedPressureUf?.presence?.signedReports ?? 0}
          />
          <Typography variant="body2" color="text.secondary">
            {selectedPressureUf?.recommendedFocus ?? "Monitorar cenário."}
          </Typography>
          <Typography variant="subtitle2">OMs que mais puxam a pressão desta UF</Typography>
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
                {(selectedPressureUf?.oms ?? []).slice(0, 10).map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.code || item.name || "—"}</TableCell>
                    <TableCell align="right">{item.riskScore ?? 0}</TableCell>
                    <TableCell>{formatCoverageType(item.coverageType)}</TableCell>
                    <TableCell align="right">{item.complaints?.openCases ?? 0}</TableCell>
                    <TableCell>{buildOmReason(item)}</TableCell>
                  </TableRow>
                ))}
                {!(selectedPressureUf?.oms ?? []).length && (
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
        </Stack>
      </ComgepDetailModal>
    </Stack>
  );
}
