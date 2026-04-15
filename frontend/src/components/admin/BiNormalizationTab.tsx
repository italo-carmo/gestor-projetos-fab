import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useBiNormalizationOverview, useMe, useRebuildBiNormalization } from '../../api/hooks';
import { hasAnyRole, ROLE_TI, ROLE_COMGEP } from '../../app/roleAccess';
import { parseApiError } from '../../app/apiErrors';
import { useToast } from '../../app/toast';
import { ErrorState } from '../states/ErrorState';
import { SkeletonState } from '../states/SkeletonState';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function resolveCoverageColor(value: number | null) {
  if (value === null) return 'default';
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'error';
}

export function BiNormalizationTab() {
  const { data: me } = useMe();
  const overviewQuery = useBiNormalizationOverview(
    hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]),
  );
  const rebuildMutation = useRebuildBiNormalization();
  const toast = useToast();
  const canRebuild = hasAnyRole(me, [ROLE_TI]);

  const handleRebuild = async (sourceType?: string) => {
    try {
      const result = await rebuildMutation.mutateAsync({
        sourceType: sourceType ?? null,
      });
      const processed = Array.isArray(result?.processed) ? result.processed.length : 0;
      toast.push({
        message:
          processed > 0
            ? `Normalização BI reprocessada para ${processed} fonte(s).`
            : 'Reprocessamento concluído.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? 'Erro ao reprocessar normalização BI.',
        severity: 'error',
      });
    }
  };

  if (overviewQuery.isLoading) return <SkeletonState />;
  if (overviewQuery.isError) {
    return (
      <ErrorState error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />
    );
  }

  const data = overviewQuery.data;
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const overall = data?.overall ?? {};

  return (
    <Box>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Normalização BI para OM e UF
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
            Governança dos dados analíticos usados pela Sala de Situação COMGEP, pela matriz de risco e pelos agentes de IA. Aqui ficam somente os sinais que impactam leitura executiva: cobertura útil, pendências de resolução e capacidade de reprocessar.
          </Typography>
        </Box>

        <Alert severity="info" variant="outlined">
          A cobertura considera apenas fontes que carregam ou permitem inferir referência organizacional. Fontes sem chave organizacional nativa permanecem explicitamente marcadas como não aplicáveis.
        </Alert>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
                  Registros BI com OM ou UF resolvidos entre as fontes suportadas.
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
                  Registros avaliados no ecossistema BI com foco em comando e cruzamento organizacional.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberRoundedIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle2">Pendências de resolução</Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color="warning.main">
                  {Number(overall?.notFound ?? 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registros onde a heurística ainda não encontrou referência confiável para OM ou UF.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={1.5}
        >
          <Typography variant="body2" color="text.secondary">
            Última atualização consolidada: {formatDateTime(data?.lastUpdatedAt)}
          </Typography>
          {canRebuild ? (
            <Button
              variant="contained"
              startIcon={<AutorenewRoundedIcon />}
              onClick={() => handleRebuild()}
              disabled={rebuildMutation.isPending}
              sx={{ alignSelf: { xs: 'flex-start', md: 'auto' } }}
            >
              {rebuildMutation.isPending ? 'Reprocessando...' : 'Reprocessar tudo'}
            </Button>
          ) : null}
        </Stack>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fonte</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Cobertura</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Resolvidos</TableCell>
                  <TableCell align="right">Pendentes</TableCell>
                  <TableCell align="right">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources.map((source: any) => {
                  const coverage =
                    typeof source?.coveragePercent === 'number'
                      ? Number(source.coveragePercent)
                      : null;
                  const resolved =
                    Number(source?.statusCounts?.matched ?? 0) +
                    Number(source?.statusCounts?.ufOnly ?? 0);
                  const pending = Number(source?.statusCounts?.notFound ?? 0);
                  const supported = Boolean(source?.supported);
                  return (
                    <TableRow key={String(source?.sourceType ?? source?.label)} hover>
                      <TableCell sx={{ minWidth: 240 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {String(source?.label ?? 'Fonte BI')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {String(source?.description ?? '')}
                        </Typography>
                        {Array.isArray(source?.unresolvedSamples) && source.unresolvedSamples.length > 0 ? (
                          <Typography
                            variant="caption"
                            color="warning.main"
                            sx={{ display: 'block', mt: 0.6 }}
                          >
                            Exemplos pendentes: {source.unresolvedSamples
                              .map((item: any) => String(item?.rawReference ?? item?.secondaryReference ?? '').trim())
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(' • ')}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={supported ? 'Suportada' : 'Não aplicável'}
                          color={supported ? 'primary' : 'default'}
                          variant={supported ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 180 }}>
                        <Stack spacing={0.8} alignItems="stretch">
                          <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={700}>
                              {coverage === null ? 'N/A' : `${coverage.toFixed(1)}%`}
                            </Typography>
                            {coverage !== null ? (
                              <Chip
                                size="small"
                                color={resolveCoverageColor(coverage) as any}
                                label={coverage >= 80 ? 'Alta' : coverage >= 50 ? 'Parcial' : 'Baixa'}
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
                      <TableCell align="right">{Number(source?.totalRecords ?? 0)}</TableCell>
                      <TableCell align="right">{resolved}</TableCell>
                      <TableCell align="right">{pending}</TableCell>
                      <TableCell align="right">
                        {canRebuild && supported ? (
                          <Button
                            size="small"
                            onClick={() => handleRebuild(String(source?.sourceType ?? ''))}
                            disabled={rebuildMutation.isPending}
                          >
                            Reprocessar
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {supported ? 'Somente TI' : '—'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
