import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
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
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Link as RouterLink } from "react-router-dom";
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
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderTop: `4px solid ${color}`,
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

export function ComgepStrategicTab() {
  const roomQuery = useComgepSituationRoom();
  const recommendationsQuery = useComgepRecommendations(6);

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
  const uncoveredOms = Math.max(
    0,
    Number(summary.totalOms ?? 0) - Number(summary.coveredOms ?? 0),
  );
  const confidencePercent = Number(dataConfidence.supportedCoveragePercent ?? 0);

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
            title="OMs cobertas pela CPCA"
            value={`${summary.coveredOms ?? 0}/${summary.totalOms ?? 0}`}
            subtitle={`${summary.coveredOmsPercent ?? 0}% das OMs já possuem cobertura própria ou por comissão gestora.`}
            color="#1A3C6E"
            icon={<ShieldRoundedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="OMs descobertas"
            value={uncoveredOms}
            subtitle="OMs sem CPCA próprio e sem cobertura de outra comissão."
            color="#D32F2F"
            icon={<WarningAmberRoundedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="UFs prioritárias"
            value={summary.criticalUfCount ?? 0}
            subtitle="UFs em faixa crítica, com risco alto e governança ou presença insuficientes."
            color="#ED6C02"
            icon={<TrendingUpRoundedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="Confiança do dado"
            value={`${confidencePercent.toFixed(1)}%`}
            subtitle="Percentual da base BI já normalizado por OM ou UF para cruzamento executivo."
            color="#2E7D32"
            icon={<HubRoundedIcon />}
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
                  sx={{ borderRadius: 2.5, bgcolor: "#FAFBFD" }}
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
    </Stack>
  );
}
