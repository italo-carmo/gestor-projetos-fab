import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { useExecutiveDashboard, useMe } from '../api/hooks';
import { can } from '../app/rbac';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

const KPI_BLUE_CARD_SX = {
  bgcolor: 'rgb(83, 127, 151)',
  backgroundColor: 'rgb(83, 127, 151) !important',
  border: '1px solid rgba(139, 184, 207, 0.38)',
  boxShadow: '0 18px 34px rgba(15,44,59,0.36)',
} as const;
const EXECUTIVE_CARD_STYLES_STORAGE_KEY = 'executive-card-styles-v1';

type ExecutiveCardId =
  | 'cipavd-kpis'
  | 'cipavd-specialty'
  | 'cipavd-locality-performance'
  | 'cipavd-completed-reports';

type EditableCardStyle = {
  title: string;
  backgroundColor: string;
  textColor: string;
};

const EXECUTIVE_CARD_DEFAULTS: Record<ExecutiveCardId, EditableCardStyle> = {
  'cipavd-kpis': {
    title: 'Indicadores executivos',
    backgroundColor: 'rgb(83, 127, 151)',
    textColor: '#F4FAFD',
  },
  'cipavd-specialty': {
    title: 'Indicadores por especialidade',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
  },
  'cipavd-locality-performance': {
    title: 'Destaque de performance por localidade',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
  },
  'cipavd-completed-reports': {
    title: 'Relatórios concluídos',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
  },
};

function isExecutiveCardId(value: string): value is ExecutiveCardId {
  return (
    value === 'cipavd-kpis' ||
    value === 'cipavd-specialty' ||
    value === 'cipavd-locality-performance' ||
    value === 'cipavd-completed-reports'
  );
}

type ExecutiveKpiDetailKind =
  | 'completedActivities'
  | 'visitedCities'
  | 'reportsApproved'
  | 'participantsInActivities';

type ExecutiveKpiDetailState = {
  kind: ExecutiveKpiDetailKind;
  title: string;
  subtitle: string;
} | null;

type ExecutiveChartDetailState =
  | {
      kind: 'locality';
      item: any;
    }
  | {
      kind: 'specialty';
      item: any;
    }
  | null;

function loadExecutiveCardStyles(): Record<ExecutiveCardId, EditableCardStyle> {
  const merged = { ...EXECUTIVE_CARD_DEFAULTS };
  if (typeof window === 'undefined') return merged;
  try {
    const raw = window.localStorage.getItem(EXECUTIVE_CARD_STYLES_STORAGE_KEY);
    if (!raw) return merged;
    const parsed = JSON.parse(raw) as Record<
      string,
      Partial<EditableCardStyle> | undefined
    >;
    if (!parsed || typeof parsed !== 'object') return merged;
    for (const [key, value] of Object.entries(parsed)) {
      if (!isExecutiveCardId(key) || !value) continue;
      const defaults = EXECUTIVE_CARD_DEFAULTS[key];
      merged[key] = {
        title:
          typeof value.title === 'string' && value.title.trim()
            ? value.title
            : defaults.title,
        backgroundColor:
          typeof value.backgroundColor === 'string' && value.backgroundColor.trim()
            ? value.backgroundColor
            : defaults.backgroundColor,
        textColor:
          typeof value.textColor === 'string' && value.textColor.trim()
            ? value.textColor
            : defaults.textColor,
      };
    }
    return merged;
  } catch {
    return merged;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

export function DashboardExecutivePage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const threshold = params.get('threshold') ?? '70';
  const command = params.get('command') ?? '';
  const localityId = params.get('localityId') ?? '';

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      threshold: threshold || undefined,
      command: command || undefined,
      localityId: localityId || undefined,
      scope: 'CIPAVD',
    }),
    [from, to, threshold, command, localityId],
  );

  const dashboardQuery = useExecutiveDashboard(filters);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [completedReportCarouselIndex, setCompletedReportCarouselIndex] = useState(0);
  const isTiProfile = Boolean(me?.roles?.some((role: any) => role?.name === 'TI' || role?.code === 'ROLE_TI'));
  const [cardStyles, setCardStyles] = useState<Record<ExecutiveCardId, EditableCardStyle>>(
    () => loadExecutiveCardStyles(),
  );
  const [editingCardId, setEditingCardId] = useState<ExecutiveCardId | null>(null);
  const [editingCardDraft, setEditingCardDraft] = useState<EditableCardStyle>({
    title: '',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
  });
  const [kpiDetail, setKpiDetail] = useState<ExecutiveKpiDetailState>(null);
  const [kpiDetailSearch, setKpiDetailSearch] = useState('');
  const [chartDetail, setChartDetail] = useState<ExecutiveChartDetailState>(null);
  const completedReportItemsForCarousel = Array.isArray(
    (dashboardQuery.data as any)?.reportsCompliance?.completedItems,
  )
    ? ((dashboardQuery.data as any).reportsCompliance.completedItems as any[])
    : [];

  useEffect(() => {
    if (completedReportItemsForCarousel.length <= 1) return;
    const timer = window.setInterval(() => {
      setCompletedReportCarouselIndex(
        (current) => (current + 1) % completedReportItemsForCarousel.length,
      );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [completedReportItemsForCarousel.length]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  if (!can(me, 'dashboard', 'view')) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Painel de Comando - CIPAVD
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError)
    return (
      <ErrorState
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
      />
    );

  const data = dashboardQuery.data;
  if (!data)
    return (
      <EmptyState
        title="Sem dados"
        description="Ajuste os filtros ou tente novamente."
      />
    );

  const statusItems = data.status?.items ?? [];
  const byLocality = data.progress?.byLocality ?? [];
  const bySpecialty = data.specialties?.items ?? [];

  const doneCount =
    statusItems.find((item: any) => String(item.status) === 'DONE')?.count ?? 0;
  const totalActivities = statusItems.reduce(
    (acc: number, item: any) => acc + Number(item.count ?? 0),
    0,
  );
  const closureRate = totalActivities
    ? Math.round((doneCount / totalActivities) * 100)
    : 0;

  const approvedReports = Number(data.reportsCompliance?.approved ?? 0);
  const pendingReports = Number(data.reportsCompliance?.pending ?? 0);
  const totalReports = approvedReports + pendingReports;
  const reportsComplianceRate = totalReports
    ? Math.round((approvedReports / totalReports) * 100)
    : 100;

  const localityOptions = [...byLocality].sort((a: any, b: any) =>
    String(a.localityName ?? '').localeCompare(
      String(b.localityName ?? ''),
      'pt-BR',
    ),
  );

  const topSpecialties = [...bySpecialty]
    .filter((item: any) => {
      const normalizedName = String(item?.specialtyName ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
      return !normalizedName.includes('comunicacao social');
    })
    .sort((a: any, b: any) => Number(b.count ?? 0) - Number(a.count ?? 0))
    .slice(0, 12);

  const topLocalitiesByProgress = [...byLocality]
    .sort((a: any, b: any) => Number(b.progress ?? 0) - Number(a.progress ?? 0))
    .slice(0, 12);
  const completedReportItems = data.reportsCompliance?.completedItems ?? [];
  const executiveKpiDetails = data.kpiDetails ?? {
    completedActivities: [],
    visitedCities: [],
    reportsApproved: completedReportItems,
    participantsInActivities: completedReportItems.filter(
      (item: any) => Number(item?.report?.participantsCount ?? 0) > 0,
    ),
  };
  const visitedCities = Number(
    data.summary?.visitedCities ??
      byLocality.filter((item: any) => Number(item.done ?? 0) > 0).length,
  );
  const participantsInActivities = Number(
    data.summary?.participantsInActivities ??
      completedReportItems.reduce(
        (acc: number, item: any) => acc + Number(item?.report?.participantsCount ?? 0),
        0,
      ),
  );
  const completedActivityItems = executiveKpiDetails.completedActivities ?? [];
  const participantsActivityItems = executiveKpiDetails.participantsInActivities ?? [];
  const reportsApprovedItems = executiveKpiDetails.reportsApproved ?? [];
  const completedReportSlideHeight = 214;
  const safeCompletedReportCarouselIndex =
    completedReportItems.length > 0
      ? completedReportCarouselIndex % completedReportItems.length
      : 0;

  const goToPreviousCompletedReport = () => {
    if (completedReportItems.length <= 1) return;
    setCompletedReportCarouselIndex((current) =>
      (current - 1 + completedReportItems.length) % completedReportItems.length,
    );
  };
  const goToNextCompletedReport = () => {
    if (completedReportItems.length <= 1) return;
    setCompletedReportCarouselIndex((current) =>
      (current + 1) % completedReportItems.length,
    );
  };

  const downloadCsv = () => {
    const headers = ['localityCode', 'localityName', 'progress', 'specialtyName', 'specialtyCount'];
    const rows = topLocalitiesByProgress.map((item: any, index: number) => {
      const specialty = topSpecialties[index];
      return [
        item.localityCode ?? '',
        item.localityName ?? '',
        item.progress ?? 0,
        specialty?.specialtyName ?? '',
        specialty?.count ?? 0,
      ];
    });
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'painel-cipavd-indicadores-positivos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCardStyle = (cardId: ExecutiveCardId): EditableCardStyle =>
    cardStyles[cardId] ?? EXECUTIVE_CARD_DEFAULTS[cardId];
  const openStyleEditor = (cardId: ExecutiveCardId) => {
    setEditingCardId(cardId);
    setEditingCardDraft({ ...getCardStyle(cardId) });
  };
  const saveStyleEditor = () => {
    if (!editingCardId) return;
    const defaults = EXECUTIVE_CARD_DEFAULTS[editingCardId];
    const normalizedTitle = editingCardDraft.title.trim() || defaults.title;
    const next = {
      ...cardStyles,
      [editingCardId]: {
        ...editingCardDraft,
        title: normalizedTitle,
      },
    };
    setCardStyles(next);
    window.localStorage.setItem(EXECUTIVE_CARD_STYLES_STORAGE_KEY, JSON.stringify(next));
    setEditingCardId(null);
  };
  const openKpiDetail = (kind: ExecutiveKpiDetailKind) => {
    const metadata: Record<
      ExecutiveKpiDetailKind,
      { title: string; subtitle: string }
    > = {
      completedActivities: {
        title: 'Atividades concluídas',
        subtitle: 'Lista de atividades concluídas no recorte atual.',
      },
      visitedCities: {
        title: 'Cidades visitadas',
        subtitle:
          'Localidades que receberam missões CIPAVD no recorte atual.',
      },
      reportsApproved: {
        title: 'Relatórios aprovados',
        subtitle: 'Relatórios assinados e aprovados no período.',
      },
      participantsInActivities: {
        title: 'Participantes em atividades',
        subtitle:
          'Atividades concluídas com relatório salvo e participantes registrados.',
      },
    };
    setKpiDetail({
      kind,
      title: metadata[kind].title,
      subtitle: metadata[kind].subtitle,
    });
    setKpiDetailSearch('');
  };
  const openActivityFromDetail = (activityId: string) => {
    const next = new URLSearchParams();
    next.set('activityId', activityId);
    next.set('tab', 'report');
    navigate(`/activities-cipavd?${next.toString()}`);
  };
  const openLocalityMissions = (targetLocalityId: string) => {
    const next = new URLSearchParams();
    next.set('localityId', targetLocalityId);
    next.set('scope', 'CIPAVD');
    navigate(`/missions?${next.toString()}`);
  };
  const openLocalityActivities = (targetLocalityId: string) => {
    const next = new URLSearchParams();
    next.set('localityId', targetLocalityId);
    navigate(`/activities-cipavd?${next.toString()}`);
  };
  const openSpecialtyActivities = (targetSpecialtyId: string) => {
    const next = new URLSearchParams();
    next.set('specialtyId', targetSpecialtyId);
    navigate(`/activities-cipavd?${next.toString()}`);
  };
  const openChartDetail = (kind: 'locality' | 'specialty', item: any) => {
    setChartDetail({ kind, item });
  };
  const normalizeText = (value: unknown) =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const specialtyMatches = (activity: any, specialty: any) => {
    const selectedName = normalizeText(specialty?.specialtyName);
    const activityIds = Array.isArray(activity?.specialtyIds)
      ? activity.specialtyIds.map((item: any) => String(item))
      : activity?.specialtyId
        ? [String(activity.specialtyId)]
        : [];
    const activityNames = Array.isArray(activity?.specialtyNames)
      ? activity.specialtyNames.map((item: any) => normalizeText(item))
      : [normalizeText(activity?.specialtyName)];
    if (specialty?.specialtyId && activityIds.length > 0) {
      return activityIds.includes(String(specialty.specialtyId));
    }
    if (selectedName === 'comissao cipavd') {
      if (activityIds.length === 0) return true;
      return activityNames.some((name: string) => name === 'comissao cipavd');
    }
    if (selectedName === 'psicologia') {
      return activityNames.some((name: string) => name.includes('psicologia'));
    }
    return activityNames.some((name: string) => name === selectedName);
  };
  const chartDetailActivities =
    chartDetail?.kind === 'locality'
      ? completedActivityItems
          .filter(
            (item: any) =>
              String(item?.localityId ?? '') ===
              String(chartDetail.item?.localityId ?? ''),
          )
          .slice(0, 20)
      : chartDetail?.kind === 'specialty'
        ? completedActivityItems
            .filter((item: any) => specialtyMatches(item, chartDetail.item))
            .slice(0, 20)
        : [];
  const chartDetailParticipantsTotal =
    chartDetail?.kind === 'locality'
      ? participantsActivityItems
          .filter(
            (item: any) =>
              String(item?.localityId ?? '') ===
              String(chartDetail.item?.localityId ?? ''),
          )
          .reduce(
            (acc: number, item: any) =>
              acc + Number(item?.report?.participantsCount ?? 0),
            0,
          )
      : chartDetail?.kind === 'specialty'
        ? participantsActivityItems
            .filter((item: any) => specialtyMatches(item, chartDetail.item))
            .reduce(
              (acc: number, item: any) =>
                acc + Number(item?.report?.participantsCount ?? 0),
              0,
            )
        : 0;
  const chartDetailApprovedReports =
    chartDetail?.kind === 'locality'
      ? reportsApprovedItems.filter(
          (item: any) =>
            String(item?.localityId ?? '') ===
            String(chartDetail.item?.localityId ?? ''),
        ).length
      : chartDetail?.kind === 'specialty'
        ? reportsApprovedItems.filter((item: any) =>
            specialtyMatches(item, chartDetail.item),
          ).length
        : 0;
  const activeKpiItems = kpiDetail
    ? executiveKpiDetails[kpiDetail.kind] ?? []
    : [];
  const normalizedKpiDetailSearch = String(kpiDetailSearch ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const filteredKpiItems = !normalizedKpiDetailSearch
    ? activeKpiItems
    : activeKpiItems.filter((item: any) => {
        const haystack = [
          item?.title,
          item?.activityTypeName,
          item?.localityCode,
          item?.localityName,
          item?.commandName,
          item?.specialtyName,
        ]
          .map((value) => String(value ?? ''))
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return haystack.includes(normalizedKpiDetailSearch);
      });
  const getKpiActivityDisplayTitle = (item: any) => {
    const typeName = String(item?.activityTypeName ?? '').trim();
    const title = String(item?.title ?? '').trim() || '-';
    if (!typeName) return title;
    return `${typeName} • ${title}`;
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4">Painel de Comando - CIPAVD</Typography>
          <Typography variant="body2" color="text.secondary">
            Visão de entregas, produtividade e performance da comissão nas OM.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={downloadCsv}>
          Exportar CSV
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            flexWrap="wrap"
            useFlexGap
          >
            <TextField
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => updateParam('from', e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => updateParam('to', e.target.value)}
            />
            <TextField
              size="small"
              label="Comando"
              value={command}
              onChange={(e) => updateParam('command', e.target.value)}
              sx={{ minWidth: 190 }}
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(e) => updateParam('localityId', e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localityOptions.map((locality: any) => (
                <MenuItem key={locality.localityId} value={locality.localityId}>
                  {locality.localityCode || locality.localityName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Limiar"
              value={threshold}
              onChange={(e) => updateParam('threshold', e.target.value)}
              sx={{ minWidth: 130 }}
            >
              {['50', '60', '70', '80', '90'].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}%
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }}
        gap={2}
      >
        {(() => {
          const style = getCardStyle('cipavd-kpis');
          return (
        <Card sx={{ ...KPI_BLUE_CARD_SX, minHeight: 320, backgroundColor: `${style.backgroundColor} !important` }}>
          <CardContent sx={{ backgroundColor: `${style.backgroundColor} !important`, height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
              <Typography variant="subtitle1" sx={{ color: style.textColor, fontWeight: 700 }}>
                {style.title}
              </Typography>
              {isTiProfile ? (
                <Tooltip title="Editar card">
                  <IconButton
                    size="small"
                    sx={{ color: style.textColor, opacity: 0.72 }}
                    onClick={() => openStyleEditor('cipavd-kpis')}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.2,
              }}
            >
              {[
                {
                  id: 'completedActivities' as const,
                  label: 'Atividades concluídas',
                  value: doneCount,
                  helper: `Taxa de conclusão: ${closureRate}%`,
                },
                {
                  id: 'visitedCities' as const,
                  label: 'Cidades visitadas',
                  value: visitedCities,
                  helper: 'Localidades com missão CIPAVD',
                },
                {
                  id: 'reportsApproved' as const,
                  label: 'Relatórios aprovados',
                  value: approvedReports,
                  helper: `Conformidade: ${reportsComplianceRate}%`,
                },
                {
                  id: 'participantsInActivities' as const,
                  label: 'Participantes em atividades',
                  value: participantsInActivities,
                  helper: 'Somatório dos relatórios concluídos',
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  role="button"
                  tabIndex={0}
                  onClick={() => openKpiDetail(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openKpiDetail(item.id);
                    }
                  }}
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.58)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 8px 16px rgba(15,44,59,0.24)',
                    },
                    '&:focus-visible': {
                      outline: '2px solid rgba(255,255,255,0.9)',
                      outlineOffset: '2px',
                    },
                  }}
                >
                  <Typography variant="overline" sx={{ color: style.textColor }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h4" sx={{ color: style.textColor, lineHeight: 1.05 }}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: style.textColor }}>
                    {item.helper} • Clique para detalhar
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
          );
        })()}

        {(() => {
          const style = getCardStyle('cipavd-specialty');
          return (
        <Card sx={{ minHeight: 320, backgroundColor: style.backgroundColor }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: style.textColor }}>
                {style.title}
              </Typography>
              {isTiProfile ? (
                <Tooltip title="Editar card">
                  <IconButton
                    size="small"
                    sx={{ color: style.textColor, opacity: 0.72 }}
                    onClick={() => openStyleEditor('cipavd-specialty')}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.7, display: 'block' }}>
              Clique em uma barra para detalhar o indicador.
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={topSpecialties}
                layout="vertical"
                margin={{ left: 20, right: 10 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="specialtyName" width={150} />
                <RechartsTooltip formatter={(value: any) => [value, 'Atividades']} />
                <Bar
                  dataKey="count"
                  fill="#4D86A0"
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  cursor="pointer"
                  onClick={(state: any) => {
                    if (!state?.payload) return;
                    openChartDetail('specialty', state.payload);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
          );
        })()}

        {(() => {
          const style = getCardStyle('cipavd-locality-performance');
          return (
        <Card sx={{ minHeight: 320, backgroundColor: style.backgroundColor }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: style.textColor }}>
                {style.title}
              </Typography>
              {isTiProfile ? (
                <Tooltip title="Editar card">
                  <IconButton
                    size="small"
                    sx={{ color: style.textColor, opacity: 0.72 }}
                    onClick={() => openStyleEditor('cipavd-locality-performance')}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.7, display: 'block' }}>
              Clique em uma barra para detalhar a localidade.
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topLocalitiesByProgress}>
                <XAxis dataKey="localityCode" />
                <YAxis />
                <RechartsTooltip formatter={(value: any) => [`${value}%`, 'Progresso']} />
                <Bar
                  dataKey="progress"
                  fill="#114259"
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                  cursor="pointer"
                  onClick={(state: any) => {
                    if (!state?.payload) return;
                    openChartDetail('locality', state.payload);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
          );
        })()}

        {(() => {
          const style = getCardStyle('cipavd-completed-reports');
          return (
        <Card sx={{ minHeight: 320, backgroundColor: style.backgroundColor }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: style.textColor }}>
                {style.title}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.2}>
                {completedReportItems.length > 1 ? (
                  <>
                    <Tooltip title="Relatório anterior">
                      <IconButton
                        size="small"
                        onClick={goToPreviousCompletedReport}
                        sx={{ color: style.textColor, opacity: 0.82 }}
                        aria-label="Ir para relatório anterior"
                      >
                        <KeyboardArrowUpRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Próximo relatório">
                      <IconButton
                        size="small"
                        onClick={goToNextCompletedReport}
                        sx={{ color: style.textColor, opacity: 0.82 }}
                        aria-label="Ir para próximo relatório"
                      >
                        <KeyboardArrowDownRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : null}
                {isTiProfile ? (
                  <Tooltip title="Editar card">
                    <IconButton
                      size="small"
                      sx={{ color: style.textColor, opacity: 0.72 }}
                      onClick={() => openStyleEditor('cipavd-completed-reports')}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
            </Stack>
            {completedReportItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum relatório concluído no período selecionado.
              </Typography>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                <Typography variant="caption" color="text.secondary">
                  Clique no relatório para abrir os detalhes completos.
                </Typography>
                <Box sx={{ overflow: 'hidden', height: `${completedReportSlideHeight}px` }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      transform: `translateY(-${safeCompletedReportCarouselIndex * completedReportSlideHeight}px)`,
                      transition: 'transform 420ms ease-in-out',
                    }}
                  >
                    {completedReportItems.map((item: any) => (
                      <Card
                        key={item.activityId}
                        variant="outlined"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedReport(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedReport(item);
                          }
                        }}
                        sx={{
                          height: `${completedReportSlideHeight}px`,
                          flexShrink: 0,
                          borderColor: 'rgba(17,66,89,0.22)',
                          borderRadius: 2,
                          background:
                            'linear-gradient(165deg, rgba(248,251,255,0.97) 0%, rgba(242,247,252,0.97) 100%)',
                          cursor: 'pointer',
                          transition: 'transform 150ms ease, box-shadow 180ms ease, border-color 180ms ease',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: '0 10px 18px rgba(17,66,89,0.14)',
                            borderColor: 'rgba(17,66,89,0.36)',
                          },
                          '&:focus-visible': {
                            outline: '2px solid #1F4A61',
                            outlineOffset: '2px',
                          },
                        }}
                      >
                        <CardContent sx={{ p: 1.35, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0E3142' }} noWrap>
                              {item.title}
                            </Typography>
                            <OpenInNewRoundedIcon sx={{ fontSize: 16, color: '#1F4A61', flexShrink: 0 }} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {(item.localityCode || item.localityName) ?? '-'} • Assinado em {formatDateTime(item.report?.signedAt)}
                          </Typography>
                          <Stack direction="row" spacing={0.6} sx={{ mt: 0.8, flexWrap: 'wrap' }} useFlexGap>
                            <Chip
                              size="small"
                              label={`${Number(item?.report?.participantsCount ?? 0)} participantes`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={`${Number(item?.report?.instructorsCount ?? 0)} instrutores`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={`${Number(item?.report?.recruitsCount ?? 0)} recrutas`}
                              color="primary"
                              variant="outlined"
                            />
                          </Stack>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mt: 0.9,
                              display: '-webkit-box',
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.35,
                            }}
                          >
                            {item?.report?.activitiesPerformed ||
                              item?.report?.missionSupport ||
                              item?.report?.conclusion ||
                              'Sem resumo textual disponível.'}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
                {completedReportItems.length > 1 ? (
                  <Typography variant="caption" color="text.secondary">
                    {safeCompletedReportCarouselIndex + 1} de {completedReportItems.length} • rotação automática a cada 5s
                  </Typography>
                ) : null}
              </Box>
            )}
          </CardContent>
        </Card>
          );
        })()}
      </Box>

      <Dialog
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.7 }}>
          {selectedReport?.title || 'Relatório concluído'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.3}>
            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={`Localidade: ${selectedReport?.localityCode || selectedReport?.localityName || '-'}`}
              />
              <Chip
                size="small"
                label={`Assinado em: ${formatDateTime(selectedReport?.report?.signedAt)}`}
              />
              <Chip
                size="small"
                label={`Data do relatório: ${formatDateTime(selectedReport?.report?.date)}`}
              />
            </Stack>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Responsável
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedReport?.report?.responsible || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Apoio à missão
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.missionSupport || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Introdução
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.introduction || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Objetivos da missão
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.missionObjectives || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Execução e cronograma
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.executionSchedule || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Atividades realizadas
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.activitiesPerformed || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.7 }}>
                  Resumo numérico
                </Typography>
                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`Participantes: ${selectedReport?.report?.participantsCount ?? 0}`} />
                  <Chip size="small" label={`Homens: ${selectedReport?.report?.participantsMaleCount ?? 0}`} />
                  <Chip size="small" label={`Mulheres: ${selectedReport?.report?.participantsFemaleCount ?? 0}`} />
                  <Chip size="small" label={`Instrutores: ${selectedReport?.report?.instructorsCount ?? 0}`} />
                  <Chip size="small" label={`Recrutas: ${selectedReport?.report?.recruitsCount ?? 0}`} />
                  <Chip size="small" label={`Elo Psicologia: ${selectedReport?.report?.eloPsychologyCount ?? 0}`} />
                  <Chip size="small" label={`Elo Assistência Social: ${selectedReport?.report?.eloSocialAssistanceCount ?? 0}`} />
                  <Chip size="small" label={`Elo Jurídico: ${selectedReport?.report?.eloJuridicoCount ?? 0}`} />
                  <Chip size="small" label={`Elo CPCA: ${selectedReport?.report?.eloCpcaCount ?? 0}`} />
                  <Chip size="small" label={`Elo Graduado Master: ${selectedReport?.report?.eloGraduadoMasterCount ?? 0}`} />
                </Stack>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Características dos participantes
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.participantsCharacteristics || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Principais pontos observados
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.mainPointsObserved || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Pontos de atenção
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.attentionPoints || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Próximos passos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.nextSteps || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Referências e anexos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.referencesAndAttachments || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Conclusão
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedReport?.report?.conclusion || '-'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.3 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.4 }}>
                  Local e fechamento
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Local: {selectedReport?.report?.location || '-'} • Cidade: {selectedReport?.report?.city || '-'} • Fechamento:{' '}
                  {formatDateTime(selectedReport?.report?.closingDate)}
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          {selectedReport?.activityId ? (
            <Button
              variant="outlined"
              onClick={() => openActivityFromDetail(String(selectedReport.activityId))}
            >
              Abrir atividade
            </Button>
          ) : null}
          <Button onClick={() => setSelectedReport(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(kpiDetail)}
        onClose={() => setKpiDetail(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pb: 0.7 }}>
          {kpiDetail?.title ?? 'Detalhamento'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                {kpiDetail?.subtitle}
              </Typography>
              <Chip
                size="small"
                sx={{ mt: 0.8 }}
                label={`${filteredKpiItems.length} item(ns) encontrados`}
              />
            </Box>
            <TextField
              size="small"
              label="Buscar"
              placeholder="Atividade, localidade, comando"
              value={kpiDetailSearch}
              onChange={(event) => setKpiDetailSearch(event.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 320 } }}
            />
          </Stack>

          {filteredKpiItems.length === 0 ? (
            <EmptyState
              title="Sem detalhes para exibir"
              description="Nenhum registro encontrado para o KPI e filtros atuais."
            />
          ) : kpiDetail?.kind === 'visitedCities' ? (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {filteredKpiItems.map((item: any) => (
                <Card key={item.localityId} variant="outlined">
                  <CardContent sx={{ p: 1.25 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.localityCode || item.localityName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.localityName || '-'} • Comando: {item.commandName || '-'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={`${Number(item.visitMissions ?? item.visitActivities ?? 0)} missão(ões)`}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Última: {formatDateTime(item.lastVisitDate)}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openLocalityMissions(String(item.localityId))}
                        >
                          Ver missões
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {filteredKpiItems.map((item: any) => (
                <Card key={item.activityId} variant="outlined">
                  <CardContent sx={{ p: 1.25 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {getKpiActivityDisplayTitle(item)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(item.localityCode || item.localityName) ?? '-'} • {formatDateTime(item.eventDate)}
                        </Typography>
                        {kpiDetail?.kind === 'participantsInActivities' ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Participantes: {Number(item?.report?.participantsCount ?? 0)} | Instrutores:{' '}
                            {Number(item?.report?.instructorsCount ?? 0)} | Recrutas:{' '}
                            {Number(item?.report?.recruitsCount ?? 0)}
                          </Typography>
                        ) : null}
                        {kpiDetail?.kind === 'reportsApproved' ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Assinado em: {formatDateTime(item?.report?.signedAt)}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {item?.report ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setSelectedReport(item)}
                          >
                            Ler relatório
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => openActivityFromDetail(String(item.activityId))}
                        >
                          Abrir atividade
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKpiDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(chartDetail)}
        onClose={() => setChartDetail(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.7 }}>
          {chartDetail?.kind === 'locality'
            ? `Localidade: ${chartDetail.item?.localityCode || chartDetail.item?.localityName || '-'}`
            : `Especialidade: ${chartDetail?.item?.specialtyName || 'Sem especialidade'}`}
        </DialogTitle>
        <DialogContent dividers>
          {chartDetail?.kind === 'locality' ? (
            <Stack spacing={1.1}>
              <Typography variant="body2" color="text.secondary">
                Este indicador simboliza o percentual médio de execução das atividades da localidade no período filtrado.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Progresso: ${Number(chartDetail.item?.progress ?? 0)}%`} />
                <Chip size="small" label={`Atividades: ${Number(chartDetail.item?.activitiesCount ?? 0)}`} />
                <Chip size="small" label={`Concluídas: ${Number(chartDetail.item?.done ?? 0)}`} />
                <Chip size="small" label={`Atrasadas: ${Number(chartDetail.item?.late ?? 0)}`} />
                <Chip size="small" label={`Sem responsável: ${Number(chartDetail.item?.unassigned ?? 0)}`} />
                <Chip size="small" label={`Relatórios pendentes: ${Number(chartDetail.item?.reportPending ?? 0)}`} />
                <Chip size="small" label={`Relatórios aprovados: ${chartDetailApprovedReports}`} />
                <Chip size="small" label={`Participantes: ${chartDetailParticipantsTotal}`} />
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.1}>
              <Typography variant="body2" color="text.secondary">
                Este indicador simboliza o volume de atividades registradas para a especialidade no período filtrado.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Atividades: ${Number(chartDetail?.item?.count ?? 0)}`} />
                <Chip
                  size="small"
                  label={`Participação: ${
                    totalActivities
                      ? Math.round((Number(chartDetail?.item?.count ?? 0) / totalActivities) * 100)
                      : 0
                  }%`}
                />
                <Chip size="small" label={`Relatórios aprovados: ${chartDetailApprovedReports}`} />
                <Chip size="small" label={`Participantes: ${chartDetailParticipantsTotal}`} />
              </Stack>
            </Stack>
          )}
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.8 }}>
              Atividades concluídas relacionadas (até 20)
            </Typography>
            {chartDetailActivities.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma atividade concluída encontrada para o item selecionado.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 1 }}>
                {chartDetailActivities.map((item: any) => (
                  <Card key={item.activityId} variant="outlined">
                    <CardContent sx={{ p: 1.2 }}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.localityCode || item.localityName} • {formatDateTime(item.eventDate)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => openActivityFromDetail(String(item.activityId))}
                        >
                          Abrir atividade
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {chartDetail?.kind === 'locality' ? (
            <Button
              variant="outlined"
              onClick={() => openLocalityActivities(String(chartDetail.item?.localityId ?? ''))}
            >
              Ver atividades da localidade
            </Button>
          ) : chartDetail?.item?.specialtyId ? (
            <Button
              variant="outlined"
              onClick={() => openSpecialtyActivities(String(chartDetail.item?.specialtyId))}
            >
              Ver atividades da especialidade
            </Button>
          ) : null}
          <Button onClick={() => setChartDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(editingCardId)} onClose={() => setEditingCardId(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar card</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Nome do card"
              value={editingCardDraft.title}
              onChange={(e) =>
                setEditingCardDraft((prev) => ({ ...prev, title: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Cor do fundo"
              type="color"
              value={editingCardDraft.backgroundColor}
              onChange={(e) =>
                setEditingCardDraft((prev) => ({ ...prev, backgroundColor: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Cor da fonte"
              type="color"
              value={editingCardDraft.textColor}
              onChange={(e) =>
                setEditingCardDraft((prev) => ({ ...prev, textColor: e.target.value }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCardId(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveStyleEditor}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
