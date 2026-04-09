import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  MenuItem,
  Tooltip,
  TextField,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import CampaignIcon from '@mui/icons-material/Campaign';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import MapIcon from '@mui/icons-material/Map';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GavelIcon from '@mui/icons-material/Gavel';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useDashboardNational,
  useBestPractices,
  useMe,
  useMissionChecklistMapping,
  useUpdateDashboardNationalCardSetting,
  useUpdateMissionChecklist,
  useUploadMissionChecklistPhoto,
} from '../api/hooks';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';

function resolveChecklistPhotoUrl(raw: string) {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('/missions/checklist/uploads/')) return `/api${url}`;
  return url;
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type NationalDashboardTotals = {
  localities: number;
  coverageLocalities: number;
  late: number;
  unassigned: number;
  recruitsFemale: number;
  reportsProduced: number;
  smifNewsCount: number;
  visitsCompleted: number;
  completedReports: number;
  completedTasks: number;
  completedFieldActivities: number;
  completedVisits: number;
  completedLectures: number;
  completedBestPracticeCycles: number;
  completedMappings: number;
  fieldActivitiesBySpecialty: {
    psychology: number;
    socialService: number;
    doctrine: number;
    law: number;
  };
  participants?: {
    instructors: number;
    recruits: number;
    elos: number;
    graduadosMaster: number;
  };
  participantsKpis?: {
    instructors: number;
    recruits: number;
    eloPsychology: number;
    eloSocialAssistance: number;
    eloGraduadoMaster: number;
  };
};

type IndicatorTile = {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
};

type NationalDrilldownItem = {
  activityId: string;
  title: string;
  localityId: string;
  localityCode?: string | null;
  localityName: string;
  specialtyId?: string | null;
  specialtyName?: string | null;
  activityTypeName?: string | null;
  eventDate?: string | null;
  status?: string;
  hasSignedReport?: boolean;
  detailLabel?: string | null;
  linkPath?: string | null;
  instructors?: number;
  recruits?: number;
  eloPsychology?: number;
  eloSocialAssistance?: number;
  elos?: number;
  eloGraduadoMaster?: number;
};

type NationalDashboardDrilldown = {
  participants: {
    instructors: NationalDrilldownItem[];
    recruits: NationalDrilldownItem[];
    elos: NationalDrilldownItem[];
    graduadosMaster: NationalDrilldownItem[];
  };
  completedReports: NationalDrilldownItem[];
  completedTasks: NationalDrilldownItem[];
  completedFieldActivities: NationalDrilldownItem[];
  completedVisits: NationalDrilldownItem[];
  completedLectures: NationalDrilldownItem[];
  completedBestPracticeCycles: NationalDrilldownItem[];
  completedMappings: NationalDrilldownItem[];
  fieldActivitiesBySpecialty: {
    psychology: NationalDrilldownItem[];
    socialService: NationalDrilldownItem[];
    doctrine: NationalDrilldownItem[];
    law: NationalDrilldownItem[];
  };
};

type DrilldownCountField =
  | 'instructors'
  | 'recruits'
  | 'elos'
  | 'eloGraduadoMaster'
  | 'detailLabel'
  | null;

type KpiDetailState = {
  title: string;
  subtitle: string;
  items: NationalDrilldownItem[];
  emptyMessage: string;
  countField: DrilldownCountField;
} | null;

type BestPracticePoint = {
  id: string;
  title: string;
  content: string;
  authorLabel?: string | null;
  createdAt: string;
  type?: {
    id: string;
    name: string;
    colorHex: string;
    textColorHex?: string | null;
  } | null;
};

type InstitutionalChecklistClassification =
  | 'FORTE_CONSOLIDADA'
  | 'OPORTUNIDADE_MELHORIA'
  | 'NECESSITA_ANALISE'
  | 'POSSIVEL_RISCO';

type InstitutionalChecklistCell = {
  localityId: string;
  missionId: string | null;
  classification: InstitutionalChecklistClassification | null;
  notes: string;
  hasNotes: boolean;
  photos: string[];
  hasPhotos: boolean;
};

type InstitutionalChecklistItem = {
  id: string;
  title: string;
  prompt?: string | null;
  cells: InstitutionalChecklistCell[];
};

type InstitutionalChecklistSection = {
  id: string;
  title: string;
  items: InstitutionalChecklistItem[];
};

type InstitutionalChecklistMission = {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  updatedAt: string;
  locality: {
    id: string;
    name: string;
    code?: string | null;
  };
  participants: Array<{
    id: string;
    name: string;
    email?: string | null;
    cpf?: string | null;
    fabom?: string | null;
    ldapUid?: string | null;
  }>;
  participantsCount: number;
  scheduleItems: Array<{
    id: string;
    title: string;
    startAt: string;
    durationMinutes: number;
    location: string;
    responsible: string;
    participants: string;
  }>;
  scheduleItemsCount: number;
  checklistSections: Array<{
    id: string;
    title: string;
    items: Array<{
      id: string;
      title: string;
      prompt?: string | null;
      classification: InstitutionalChecklistClassification;
      notes: string;
      photos: string[];
    }>;
  }>;
};

type InstitutionalChecklistMapping = {
  generatedAt: string;
  classifications?: Array<{
    id: InstitutionalChecklistClassification;
    label: string;
    colorHex?: string | null;
  }>;
  defaultClassification?: InstitutionalChecklistClassification;
  localities: Array<{
    id: string;
    name: string;
    code?: string | null;
  }>;
  sections: InstitutionalChecklistSection[];
  missionsByLocality: Array<{
    localityId: string;
    mission: InstitutionalChecklistMission | null;
  }>;
};

type InstitutionalChecklistDetailState = {
  itemId: string;
  sectionTitle: string;
  itemTitle: string;
  itemPrompt?: string | null;
  localityName: string;
  localityCode?: string | null;
  cell: InstitutionalChecklistCell;
  mission: InstitutionalChecklistMission | null;
} | null;

type InstitutionalChecklistClassificationConfig = {
  id: InstitutionalChecklistClassification;
  label: string;
  colorHex: string | null;
};

const fallbackInstitutionalChecklistClassificationMeta: Record<
  InstitutionalChecklistClassification,
  {
    label: string;
    colorHex: string | null;
  }
> = {
  FORTE_CONSOLIDADA: {
    label: 'Dimensão forte/consolidada',
    colorHex: '#2E7D32',
  },
  OPORTUNIDADE_MELHORIA: {
    label: 'Dimensão com oportunidades de melhoria',
    colorHex: '#F9A825',
  },
  NECESSITA_ANALISE: {
    label: 'Dimensão necessita de maior análise',
    colorHex: null,
  },
  POSSIVEL_RISCO: {
    label: 'Possível Risco',
    colorHex: '#C62828',
  },
};

function normalizeChecklistColorHex(colorHex: string | null | undefined) {
  const normalized = String(colorHex ?? '').trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(normalized)) return null;
  return normalized.toUpperCase();
}

function hexToRgba(hexColor: string, alpha: number) {
  const normalized = hexColor.replace('#', '');
  const safeHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveChecklistClassificationStyle(colorHex: string | null | undefined) {
  const normalizedColor = normalizeChecklistColorHex(colorHex);
  if (!normalizedColor) {
    return {
      color: '#475569',
      bgColor: '#ffffff',
      borderColor: '#CBD5E1',
    };
  }
  return {
    color: normalizedColor,
    bgColor: hexToRgba(normalizedColor, 0.14),
    borderColor: hexToRgba(normalizedColor, 0.5),
  };
}

type SmifCardId = 'smif-completed' | 'smif-field' | 'smif-participants';

type SmifCardSetting = {
  id: SmifCardId;
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
};

const DEFAULT_SMIF_CARD_SETTINGS: Record<SmifCardId, SmifCardSetting> = {
  'smif-completed': {
    id: 'smif-completed',
    title: 'Entregas Realizadas',
    description: 'Resumo de atuação da CIPAVD.',
    backgroundColor: '#1F4A61',
    textColor: '#F4FAFD',
  },
  'smif-field': {
    id: 'smif-field',
    title: 'Atividades de campo realizadas pela CIPAVD.',
    description: 'Apoio realizado pela área técnica dos integrantes.',
    backgroundColor: '#2F6F8A',
    textColor: '#F2FBFE',
  },
  'smif-participants': {
    id: 'smif-participants',
    title: 'Público alcançado',
    description: 'Total de participações em atividades de campo.',
    backgroundColor: '#3A7A9A',
    textColor: '#F0F9FC',
  },
};

const INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH = 230;
const INSTITUTIONAL_LOCALITY_COLUMN_WIDTH = 150;
/** Cabeçalhos de bloco (Liderança, Acompanhamento de recrutas, Análise de riscos) — mesmo visual azul */
const SMIF_INSTITUTIONAL_SECTION_HEADER_STYLE = {
  color: '#24507A',
  bgColor: '#eef5ff',
  borderColor: '#bfd7f5',
} as const;
const institutionalSectionHighlightMeta: Record<
  string,
  { color: string; bgColor: string; borderColor: string }
> = {
  lideranca: { ...SMIF_INSTITUTIONAL_SECTION_HEADER_STYLE },
  acompanhamento_recrutas: { ...SMIF_INSTITUTIONAL_SECTION_HEADER_STYLE },
  analise_riscos: { ...SMIF_INSTITUTIONAL_SECTION_HEADER_STYLE },
};

function isSmifCardId(value: string): value is SmifCardId {
  return Object.hasOwn(DEFAULT_SMIF_CARD_SETTINGS, value);
}

export function DashboardNationalPage() {
  const { data: me } = useMe();
  const toast = useToast();
  const updateMissionChecklist = useUpdateMissionChecklist();
  const uploadMissionChecklistPhoto = useUploadMissionChecklistPhoto();
  const updateSmifCardSetting = useUpdateDashboardNationalCardSetting();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const localityId = params.get('localityId') ?? '';
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const missionChecklistMappingQuery = useMissionChecklistMapping({
    localityId: localityId || undefined,
    scope: "SMIF",
  });
  const canViewBestPractices = can(me, 'best_practices', 'view');
  const bestPracticesQuery = useBestPractices({}, canViewBestPractices);
  const [attentionPointOffset, setAttentionPointOffset] = useState(0);
  const [completedReportCarouselIndex, setCompletedReportCarouselIndex] =
    useState(0);
  const [readingAttentionPoint, setReadingAttentionPoint] =
    useState<BestPracticePoint | null>(null);
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const [editingCardId, setEditingCardId] = useState<SmifCardId | null>(null);
  const [editingCardDraft, setEditingCardDraft] = useState<SmifCardSetting>({
    id: 'smif-completed',
    title: DEFAULT_SMIF_CARD_SETTINGS['smif-completed'].title,
    description: DEFAULT_SMIF_CARD_SETTINGS['smif-completed'].description,
    backgroundColor: DEFAULT_SMIF_CARD_SETTINGS['smif-completed'].backgroundColor,
    textColor: DEFAULT_SMIF_CARD_SETTINGS['smif-completed'].textColor,
  });
  const [kpiDetail, setKpiDetail] = useState<KpiDetailState>(null);
  const [kpiDetailSearch, setKpiDetailSearch] = useState('');
  const [institutionalDetail, setInstitutionalDetail] =
    useState<InstitutionalChecklistDetailState>(null);
  const [institutionalScheduleExpanded, setInstitutionalScheduleExpanded] = useState(false);
  const [institutionalDraftClassification, setInstitutionalDraftClassification] =
    useState<InstitutionalChecklistClassification>('NECESSITA_ANALISE');
  const [institutionalDraftNotes, setInstitutionalDraftNotes] = useState('');
  const [institutionalPhotoCarouselIndex, setInstitutionalPhotoCarouselIndex] =
    useState(0);

  const bestPracticeItems = ((bestPracticesQuery.data?.items ?? []) as BestPracticePoint[])
    .filter((item) => item?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const typedAttentionPoints = bestPracticeItems.filter((item) => {
    const normalizedType = normalizeSearchText(item.type?.name);
    return (
      normalizedType.includes('ponto de atencao') ||
      normalizedType.includes('pontos de atencao')
    );
  });
  const attentionPoints = typedAttentionPoints;
  const attentionSlideHeight = 238;
  const completedReportsForCarousel = Array.isArray(
    (dashboardQuery.data as any)?.drilldown?.completedReports,
  )
    ? ((dashboardQuery.data as any).drilldown.completedReports as NationalDrilldownItem[])
    : [];
  const completedReportSlideHeight = 202;
  const safeAttentionPointOffset =
    attentionPoints.length > 0 ? attentionPointOffset % attentionPoints.length : 0;
  const safeCompletedReportCarouselIndex =
    completedReportsForCarousel.length > 0
      ? completedReportCarouselIndex % completedReportsForCarousel.length
      : 0;
  const goToPreviousAttentionPoint = () => {
    if (attentionPoints.length <= 1) return;
    setAttentionPointOffset((current) =>
      (current - 1 + attentionPoints.length) % attentionPoints.length,
    );
  };
  const goToNextAttentionPoint = () => {
    if (attentionPoints.length <= 1) return;
    setAttentionPointOffset((current) =>
      (current + 1) % attentionPoints.length,
    );
  };
  const goToPreviousCompletedReport = () => {
    if (completedReportsForCarousel.length <= 1) return;
    setCompletedReportCarouselIndex(
      (current) =>
        (current - 1 + completedReportsForCarousel.length) %
        completedReportsForCarousel.length,
    );
  };
  const goToNextCompletedReport = () => {
    if (completedReportsForCarousel.length <= 1) return;
    setCompletedReportCarouselIndex(
      (current) => (current + 1) % completedReportsForCarousel.length,
    );
  };

  useEffect(() => {
    setInstitutionalScheduleExpanded(false);
  }, [institutionalDetail?.mission?.id]);

  useEffect(() => {
    setInstitutionalDraftClassification(
      institutionalDetail?.cell.classification ?? 'NECESSITA_ANALISE',
    );
    setInstitutionalDraftNotes(institutionalDetail?.cell.notes ?? '');
  }, [
    institutionalDetail?.itemId,
    institutionalDetail?.cell.classification,
    institutionalDetail?.cell.notes,
  ]);

  useEffect(() => {
    setInstitutionalPhotoCarouselIndex(0);
  }, [institutionalDetail?.itemId, (institutionalDetail?.cell.photos ?? []).length]);

  useEffect(() => {
    if (attentionPoints.length <= 1) return;
    const timer = window.setInterval(() => {
      setAttentionPointOffset((prev) => (prev + 1) % attentionPoints.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [attentionPoints.length]);

  useEffect(() => {
    if (completedReportsForCarousel.length <= 1) return;
    const timer = window.setInterval(() => {
      setCompletedReportCarouselIndex(
        (current) => (current + 1) % completedReportsForCarousel.length,
      );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [completedReportsForCarousel.length]);

  useEffect(() => {
    const photos = institutionalDetail?.cell.photos ?? [];
    if (photos.length <= 1) return;
    const t = setInterval(() => {
      setInstitutionalPhotoCarouselIndex((i) => (i + 1) % photos.length);
    }, 5000);
    return () => clearInterval(t);
  }, [
    institutionalDetail?.itemId,
    (institutionalDetail?.cell.photos ?? []).length,
  ]);

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError) return <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;

  const totals: NationalDashboardTotals = dashboardQuery.data?.totals ?? {
    localities: 0,
    coverageLocalities: 0,
    visitsCompleted: 0,
    late: 0,
    unassigned: 0,
    recruitsFemale: 0,
    reportsProduced: 0,
    smifNewsCount: 0,
    completedReports: 0,
    completedTasks: 0,
    completedFieldActivities: 0,
    completedVisits: 0,
    completedLectures: 0,
    completedBestPracticeCycles: 0,
    completedMappings: 0,
    fieldActivitiesBySpecialty: {
      psychology: 0,
      socialService: 0,
      doctrine: 0,
      law: 0,
    },
  };
  const drilldown: NationalDashboardDrilldown = dashboardQuery.data?.drilldown ?? {
    participants: {
      instructors: [],
      recruits: [],
      elos: [],
      graduadosMaster: [],
    },
    completedReports: [],
    completedTasks: [],
    completedFieldActivities: [],
    completedVisits: [],
    completedLectures: [],
    completedBestPracticeCycles: [],
    completedMappings: [],
    fieldActivitiesBySpecialty: {
      psychology: [],
      socialService: [],
      doctrine: [],
      law: [],
    },
  };
  const smifCardsFromApi = Array.isArray((dashboardQuery.data as any)?.smifCards)
    ? ((dashboardQuery.data as any).smifCards as Array<any>)
    : [];
  const smifCardSettingsById = new Map<SmifCardId, SmifCardSetting>(
    (Object.keys(DEFAULT_SMIF_CARD_SETTINGS) as SmifCardId[]).map((id) => [
      id,
      DEFAULT_SMIF_CARD_SETTINGS[id],
    ]),
  );
  for (const rawCard of smifCardsFromApi) {
    const rawId = String(rawCard?.id ?? '');
    if (!isSmifCardId(rawId)) continue;
    const defaults = DEFAULT_SMIF_CARD_SETTINGS[rawId];
    smifCardSettingsById.set(rawId, {
      id: rawId,
      title: String(rawCard?.title ?? '').trim() || defaults.title,
      description:
        String(rawCard?.description ?? '').trim() || defaults.description,
      backgroundColor:
        normalizeChecklistColorHex(rawCard?.backgroundColor) ??
        defaults.backgroundColor,
      textColor:
        normalizeChecklistColorHex(rawCard?.textColor) ?? defaults.textColor,
    });
  }
  const institutionalMapping =
    (missionChecklistMappingQuery.data as InstitutionalChecklistMapping | undefined) ??
    null;
  const institutionalLocalities = institutionalMapping?.localities ?? [];
  const institutionalSections = institutionalMapping?.sections ?? [];
  const institutionalTableWidth =
    INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH +
    institutionalLocalities.length * INSTITUTIONAL_LOCALITY_COLUMN_WIDTH;
  const institutionalTotalColumns = institutionalLocalities.length + 1;
  const institutionalClassifications: InstitutionalChecklistClassificationConfig[] =
    (
      Array.isArray(institutionalMapping?.classifications)
        ? institutionalMapping?.classifications
        : null
    )
      ?.map((classification) => {
        const fallback =
          fallbackInstitutionalChecklistClassificationMeta[classification.id];
        return {
          id: classification.id,
          label:
            String(classification.label ?? '').trim() || fallback.label,
          colorHex:
            normalizeChecklistColorHex(classification.colorHex) ??
            fallback.colorHex,
        };
      })
      .filter(Boolean) ?? [
      {
        id: 'FORTE_CONSOLIDADA',
        label: fallbackInstitutionalChecklistClassificationMeta.FORTE_CONSOLIDADA.label,
        colorHex:
          fallbackInstitutionalChecklistClassificationMeta.FORTE_CONSOLIDADA.colorHex,
      },
      {
        id: 'OPORTUNIDADE_MELHORIA',
        label:
          fallbackInstitutionalChecklistClassificationMeta.OPORTUNIDADE_MELHORIA
            .label,
        colorHex:
          fallbackInstitutionalChecklistClassificationMeta.OPORTUNIDADE_MELHORIA
            .colorHex,
      },
      {
        id: 'NECESSITA_ANALISE',
        label:
          fallbackInstitutionalChecklistClassificationMeta.NECESSITA_ANALISE
            .label,
        colorHex:
          fallbackInstitutionalChecklistClassificationMeta.NECESSITA_ANALISE
            .colorHex,
      },
      {
        id: 'POSSIVEL_RISCO',
        label:
          fallbackInstitutionalChecklistClassificationMeta.POSSIVEL_RISCO.label,
        colorHex:
          fallbackInstitutionalChecklistClassificationMeta.POSSIVEL_RISCO
            .colorHex,
      },
    ];
  const institutionalClassificationById = new Map(
    institutionalClassifications.map((classification) => [
      classification.id,
      classification,
    ]),
  );
  const missionByLocality = new Map<string, InstitutionalChecklistMission | null>(
    (institutionalMapping?.missionsByLocality ?? []).map((entry) => [
      entry.localityId,
      entry.mission,
    ]),
  );
  const showInstitutionalMapping =
    import.meta.env.VITE_SMIF_SHOW_INSTITUTIONAL_MAPPING === 'true';

  const formatGsdLabel = (localityName?: string | null, localityCode?: string | null) => {
    const code = String(localityCode ?? '').trim();
    const normalized = String(localityName ?? '').trim();
    return code || normalized || '—';
  };
  const formatDrilldownDate = (value?: string | null) => {
    if (!value) return 'Sem data';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sem data';
    return parsed.toLocaleDateString('pt-BR');
  };
  const formatDateTimePtBr = (value?: string | null) => {
    if (!value) return 'Sem data';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sem data';
    return parsed.toLocaleString('pt-BR');
  };
  const formatMissionPeriod = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return 'Período não informado';
    return `${formatDrilldownDate(startDate)} a ${formatDrilldownDate(endDate)}`;
  };
  const openInstitutionalDetail = (
    section: InstitutionalChecklistSection,
    item: InstitutionalChecklistItem,
    locality: { id: string; name: string; code?: string | null },
    cell: InstitutionalChecklistCell,
  ) => {
    if (!cell.missionId) return;
    setInstitutionalDetail({
      itemId: item.id,
      sectionTitle: section.title,
      itemTitle: item.title,
      itemPrompt: item.prompt ?? null,
      localityName: locality.name,
      localityCode: locality.code ?? null,
      cell,
      mission: missionByLocality.get(locality.id) ?? null,
    });
  };
  const canEditInstitutionalChecklist = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_TI,
  ]);
  const saveInstitutionalChecklistItem = async () => {
    const detail = institutionalDetail;
    if (!detail?.mission?.id || !canEditInstitutionalChecklist) return;

    const nextClassification = institutionalDraftClassification;
    const nextNotes = institutionalDraftNotes;
    const itemsPayload = detail.mission.checklistSections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        classification:
          item.id === detail.itemId ? nextClassification : item.classification,
        notes: item.id === detail.itemId ? nextNotes : item.notes,
        photos:
          item.id === detail.itemId
            ? detail.cell.photos ?? []
            : item.photos ?? [],
      })),
    );

    try {
      const response = await updateMissionChecklist.mutateAsync({
        id: detail.mission.id,
        payload: {
          omId: detail.cell.localityId,
          items: itemsPayload,
        },
      });
      setInstitutionalDetail((current) => {
        if (
          !current ||
          !current.mission ||
          current.itemId !== detail.itemId ||
          current.mission.id !== detail.mission?.id
        ) {
          return current;
        }
        return {
          ...current,
          cell: {
            ...current.cell,
            classification: nextClassification,
            notes: nextNotes,
            hasNotes: Boolean(nextNotes.trim()),
            photos: current.cell.photos ?? [],
            hasPhotos: Boolean((current.cell.photos ?? []).length),
          },
          mission: {
            ...current.mission,
            updatedAt: response.updatedAt ?? current.mission.updatedAt,
            checklistSections:
              response.sections ?? current.mission.checklistSections,
          },
        };
      });
      toast.push({
        message: 'Checklist atualizado com sucesso.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao atualizar checklist.',
        severity: 'error',
      });
    }
  };

  const updateInstitutionalDetailPhotos = (
    itemId: string,
    nextPhotos: string[],
  ) => {
    setInstitutionalDetail((current) => {
      if (!current?.mission) return current;
      const nextSections = current.mission.checklistSections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === itemId ? { ...item, photos: nextPhotos } : item,
        ),
      }));
      return {
        ...current,
        cell: { ...current.cell, photos: nextPhotos, hasPhotos: nextPhotos.length > 0 },
        mission: { ...current.mission, checklistSections: nextSections },
      };
    });
  };

  const handleAddInstitutionalPhoto = async (file: File | null) => {
    const detail = institutionalDetail;
    if (!file || !detail?.mission?.id || !canEditInstitutionalChecklist) return;
    try {
      const { photoUrl } = await uploadMissionChecklistPhoto.mutateAsync({
        missionId: detail.mission.id,
        file,
      });
      const currentPhotos = detail.cell.photos ?? [];
      if (currentPhotos.includes(photoUrl)) return;
      updateInstitutionalDetailPhotos(detail.itemId, [...currentPhotos, photoUrl]);
      toast.push({ message: 'Foto adicionada. Clique em Salvar para persistir.', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao enviar foto.',
        severity: 'error',
      });
    }
  };

  const handleRemoveInstitutionalPhoto = (photoUrl: string) => {
    const detail = institutionalDetail;
    if (!detail) return;
    const currentPhotos = detail.cell.photos ?? [];
    updateInstitutionalDetailPhotos(
      detail.itemId,
      currentPhotos.filter((p) => p !== photoUrl),
    );
  };

  const openKpiDetail = (nextDetail: Exclude<KpiDetailState, null>) => {
    setKpiDetail(nextDetail);
    setKpiDetailSearch('');
  };
  const openParticipantsDetail = (
    key: 'instructors' | 'recruits' | 'elos' | 'graduadosMaster',
  ) => {
    if (key === 'instructors') {
      openKpiDetail({
        title: 'Instrutores por atividade',
        subtitle: 'Atividades concluídas com registro de instrutores.',
        items: drilldown.participants.instructors,
        emptyMessage: 'Nenhuma atividade concluída com instrutores registrados.',
        countField: 'instructors',
      });
      return;
    }
    if (key === 'recruits') {
      openKpiDetail({
        title: 'Recrutas por atividade',
        subtitle: 'Atividades concluídas com registro de recrutas.',
        items: drilldown.participants.recruits,
        emptyMessage: 'Nenhuma atividade concluída com recrutas registradas.',
        countField: 'recruits',
      });
      return;
    }
    if (key === 'elos') {
      openKpiDetail({
        title: 'Elos por atividade',
        subtitle: 'Soma de Elo Psicologia e Elo Serviço Social por atividade concluída.',
        items: drilldown.participants.elos,
        emptyMessage: 'Nenhuma atividade concluída com elos registrados.',
        countField: 'elos',
      });
      return;
    }
    openKpiDetail({
      title: 'Graduados Master por atividade',
      subtitle: 'Atividades concluídas com graduados master registrados.',
      items: drilldown.participants.graduadosMaster,
      emptyMessage: 'Nenhuma atividade concluída com graduados master registrados.',
      countField: 'eloGraduadoMaster',
    });
  };
  const openCompletedLecturesDetail = () => {
    openKpiDetail({
      title: 'Palestras concluídas',
      subtitle: 'Atividades concluídas classificadas com tipo Palestra.',
      items: drilldown.completedLectures,
      emptyMessage: 'Nenhuma palestra concluída encontrada.',
      countField: null,
    });
  };
  const openCompletedBestPracticeCyclesDetail = () => {
    openKpiDetail({
      title: 'Ciclo de Boas Práticas concluído',
      subtitle:
        'Atividades concluídas classificadas com tipo Ciclo de Boas Práticas.',
      items: drilldown.completedBestPracticeCycles,
      emptyMessage: 'Nenhum ciclo de boas práticas concluído encontrado.',
      countField: null,
    });
  };
  const openCompletedMappingsDetail = () => {
    openKpiDetail({
      title: 'Mapeamento concluído',
      subtitle:
        'Soma de atividades concluídas dos tipos Visita, Acompanhamento e Mapeamento.',
      items: drilldown.completedMappings,
      emptyMessage:
        'Nenhuma atividade concluída de visita, acompanhamento ou mapeamento encontrada.',
      countField: null,
    });
  };
  const openCompletedReportsDetail = () => {
    openKpiDetail({
      title: 'Relatórios concluídos',
      subtitle: 'Atividades concluídas com relatório assinado.',
      items: drilldown.completedReports,
      emptyMessage: 'Nenhuma atividade concluída com relatório assinado.',
      countField: null,
    });
  };
  const openFieldAreaDetail = (
    key: 'psychology' | 'socialService' | 'doctrine' | 'law',
  ) => {
    const labels: Record<
      'psychology' | 'socialService' | 'doctrine' | 'law',
      { title: string; subtitle: string; empty: string }
    > = {
      psychology: {
        title: 'Atividades de Psicologia concluídas',
        subtitle: 'Atividades de campo concluídas classificadas em Psicologia.',
        empty: 'Nenhuma atividade concluída em Psicologia.',
      },
      socialService: {
        title: 'Atividades de Serviço Social concluídas',
        subtitle: 'Atividades de campo concluídas classificadas em Serviço Social.',
        empty: 'Nenhuma atividade concluída em Serviço Social.',
      },
      doctrine: {
        title: 'Atividades de Doutrina concluídas',
        subtitle: 'Atividades de campo concluídas classificadas em Doutrina.',
        empty: 'Nenhuma atividade concluída em Doutrina.',
      },
      law: {
        title: 'Atividades de Direito concluídas',
        subtitle: 'Atividades de campo concluídas classificadas em Direito.',
        empty: 'Nenhuma atividade concluída em Direito.',
      },
    };
    const metadata = labels[key];
    openKpiDetail({
      title: metadata.title,
      subtitle: metadata.subtitle,
      items: drilldown.fieldActivitiesBySpecialty[key] ?? [],
      emptyMessage: metadata.empty,
      countField: null,
    });
  };
  const getKpiCountValue = (
    item: NationalDrilldownItem,
    field: DrilldownCountField,
  ) => {
    if (!field) return null;
    if (field === 'detailLabel') {
      return item.detailLabel || '—';
    }
    return Number(item[field] ?? 0);
  };
  const normalizedKpiSearch = kpiDetailSearch
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const filteredKpiItems =
    !kpiDetail || !normalizedKpiSearch
      ? (kpiDetail?.items ?? [])
      : kpiDetail.items.filter((item) => {
          const haystack = [
            item.title,
            item.localityCode,
            item.localityName,
            item.specialtyName,
            item.activityTypeName,
          ]
            .map((value) => String(value ?? ''))
            .join(' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
          return haystack.includes(normalizedKpiSearch);
        });

  const completedIndicators: IndicatorTile[] = [
    {
      id: 'lectures',
      label: 'Palestras',
      value: String(totals.completedLectures ?? 0),
      helper: 'Concluídas no período',
      icon: <CampaignIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'bestPracticeCycles',
      label: 'Ciclo de Boas Práticas',
      value: String(totals.completedBestPracticeCycles ?? 0),
      helper: 'Concluídos no período',
      icon: <AutorenewIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'mappings',
      label: 'Mapeamento',
      value: String(totals.completedMappings ?? 0),
      helper: 'Visitas + Acompanhamento',
      icon: <MapIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'reports',
      label: 'Relatórios',
      value: String(totals.completedReports ?? 0),
      helper: 'Concluídos no período',
      icon: <DescriptionIcon sx={{ fontSize: 22 }} />,
    },
  ];
  const fieldBySpecialtyIndicators: IndicatorTile[] = [
    {
      id: 'psychology',
      label: 'Psicologia',
      value: String(totals.fieldActivitiesBySpecialty?.psychology ?? 0),
      helper: 'Atividades concluídas',
      icon: <PsychologyIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'socialService',
      label: 'Serviço Social',
      value: String(totals.fieldActivitiesBySpecialty?.socialService ?? 0),
      helper: 'Atividades concluídas',
      icon: <VolunteerActivismIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'doctrine',
      label: 'Doutrina',
      value: String(totals.fieldActivitiesBySpecialty?.doctrine ?? 0),
      helper: 'Atividades concluídas',
      icon: <MenuBookIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'law',
      label: 'Direito',
      value: String(totals.fieldActivitiesBySpecialty?.law ?? 0),
      helper: 'Atividades concluídas',
      icon: <GavelIcon sx={{ fontSize: 22 }} />,
    },
  ];
  const totalElos =
    totals.participants?.elos ??
    ((totals.participantsKpis?.eloPsychology ?? 0) +
      (totals.participantsKpis?.eloSocialAssistance ?? 0));
  const participantsIndicators: IndicatorTile[] = [
    {
      id: 'instructors',
      label: 'Instrutores',
      value: String(totals.participantsKpis?.instructors ?? 0),
      helper: 'Total de instrutores',
      icon: <PersonIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'recruits',
      label: 'Recrutas',
      value: String(totals.participantsKpis?.recruits ?? 0),
      helper: 'Total de recrutas',
      icon: <SchoolIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'elos',
      label: 'Elos',
      value: String(totalElos),
      helper: 'Total de elos',
      icon: <GroupIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'graduadosMaster',
      label: 'Graduados Master',
      value: String(totals.participantsKpis?.eloGraduadoMaster ?? 0),
      helper: 'Total de graduados',
      icon: <WorkspacePremiumIcon sx={{ fontSize: 22 }} />,
    },
  ];

  const getCardSetting = (cardId: SmifCardId): SmifCardSetting =>
    smifCardSettingsById.get(cardId) ?? DEFAULT_SMIF_CARD_SETTINGS[cardId];

  const openStyleEditor = (cardId: SmifCardId) => {
    setEditingCardId(cardId);
    setEditingCardDraft({ ...getCardSetting(cardId) });
  };

  const saveStyleEditor = async () => {
    if (!editingCardId) return;
    if (!editingCardDraft.title.trim()) {
      toast.push({
        message: 'Informe o nome do card.',
        severity: 'warning',
      });
      return;
    }
    if (!editingCardDraft.description.trim()) {
      toast.push({
        message: 'Informe a descrição do card.',
        severity: 'warning',
      });
      return;
    }
    try {
      await updateSmifCardSetting.mutateAsync({
        id: editingCardId,
        payload: {
          title: editingCardDraft.title.trim(),
          description: editingCardDraft.description.trim(),
          backgroundColor: editingCardDraft.backgroundColor,
          textColor: editingCardDraft.textColor,
        },
      });
      toast.push({
        message: 'Card atualizado com sucesso.',
        severity: 'success',
      });
      setEditingCardId(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao atualizar card.',
        severity: 'error',
      });
    }
  };
  const getIndicatorClickAction = (groupId: string, itemId: string) => {
    if (groupId === 'smif-completed') {
      if (itemId === 'reports') return openCompletedReportsDetail;
      if (itemId === 'lectures') return openCompletedLecturesDetail;
      if (itemId === 'bestPracticeCycles')
        return openCompletedBestPracticeCyclesDetail;
      if (itemId === 'mappings') return openCompletedMappingsDetail;
      return null;
    }
    if (groupId === 'smif-field') {
      if (
        itemId === 'psychology' ||
        itemId === 'socialService' ||
        itemId === 'doctrine' ||
        itemId === 'law'
      ) {
        return () => openFieldAreaDetail(itemId);
      }
      return null;
    }
    if (groupId === 'smif-participants') {
      if (
        itemId === 'instructors' ||
        itemId === 'recruits' ||
        itemId === 'elos' ||
        itemId === 'graduadosMaster'
      ) {
        return () => openParticipantsDetail(itemId);
      }
      return null;
    }
    return null;
  };
  const openActivityFromDetail = (activityId: string) => {
    const next = new URLSearchParams();
    next.set('activityId', activityId);
    next.set('tab', 'report');
    navigate(`/activities?${next.toString()}`);
  };
  const openKpiDetailItem = (item: NationalDrilldownItem) => {
    if (item.linkPath) {
      navigate(item.linkPath);
      return;
    }
    if (item.activityId) {
      openActivityFromDetail(item.activityId);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'clip',
      }}
    >
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Painel de Comando - SMIF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Acompanhamento estratégico do alistamento feminino, execução de atividades e prontidão nas OM.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
          },
          alignItems: 'stretch',
          mb: 2,
        }}
      >
        {[
          {
            id: 'smif-completed' as SmifCardId,
            items: completedIndicators,
            border: '1px solid rgba(139, 184, 207, 0.38)',
            shadow: '0 18px 34px rgba(15,44,59,0.36)',
          },
          {
            id: 'smif-field' as SmifCardId,
            items: fieldBySpecialtyIndicators,
            border: '1px solid rgba(132, 178, 201, 0.36)',
            shadow: '0 18px 34px rgba(16,40,53,0.38)',
          },
          {
            id: 'smif-participants' as SmifCardId,
            items: participantsIndicators,
            border: '1px solid rgba(145, 195, 220, 0.36)',
            shadow: '0 18px 34px rgba(18,42,56,0.38)',
          },
        ].map((group) => {
          const cardSetting = getCardSetting(group.id);
          return (
          <Card
            key={group.id}
            sx={{
              background: cardSetting.backgroundColor,
              border: group.border,
              width: '100%',
              minWidth: 0,
              borderRadius: 3,
              boxShadow: group.shadow,
              position: 'relative',
            }}
          >
            <CardContent sx={{ p: 1.85 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ letterSpacing: 0.2, color: cardSetting.textColor, lineHeight: 1.25 }}
                  >
                    {cardSetting.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: cardSetting.textColor, opacity: 0.95 }}>
                    {cardSetting.description}
                  </Typography>
                </Box>
                {isTiProfile ? (
                  <Tooltip title="Editar card">
                    <IconButton
                      size="small"
                      sx={{ color: cardSetting.textColor, opacity: 0.72 }}
                      onClick={() => openStyleEditor(group.id)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
              <Box
                sx={{
                  mt: 1.15,
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                {group.items.map((item) => {
                  const onItemClick = getIndicatorClickAction(group.id, item.id);
                  const isInteractive = Boolean(onItemClick);
                  return (
                    <Box
                      key={item.id}
                      role={isInteractive ? 'button' : undefined}
                      tabIndex={isInteractive ? 0 : undefined}
                      onClick={onItemClick ?? undefined}
                      onKeyDown={
                        isInteractive
                          ? (event) => {
                              if ((event.key === 'Enter' || event.key === ' ') && onItemClick) {
                                event.preventDefault();
                                onItemClick();
                              }
                            }
                          : undefined
                      }
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        border: isInteractive ? '1px solid rgba(0,60,92,0.35)' : '1px solid rgba(255,255,255,0.5)',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        minHeight: 88,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: isInteractive ? 'pointer' : 'default',
                        transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
                        '&:hover': isInteractive
                          ? {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 8px 16px rgba(17,66,89,0.16)',
                              borderColor: 'rgba(0,60,92,0.45)',
                            }
                          : undefined,
                        '&:focus-visible': isInteractive
                          ? {
                              outline: '2px solid #0D5B84',
                              outlineOffset: '2px',
                            }
                          : undefined,
                      }}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          {item.label}
                        </Typography>
                        <Box sx={{ color: '#114259' }}>{item.icon}</Box>
                      </Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1, color: '#0E3142' }}>
                          {item.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                          {item.helper}{isInteractive ? ' • Clique para detalhar' : ''}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        );
        })}
        <Card
          sx={{
            width: '100%',
            minWidth: 0,
            minHeight: 320,
            backgroundColor: '#FFFFFF',
            borderRadius: 3,
            border: '1px solid rgba(17,66,89,0.28)',
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
              <Typography variant="h6" sx={{ color: '#111827' }}>
                Relatórios concluídos
              </Typography>
              {completedReportsForCarousel.length > 1 ? (
                <Stack direction="row" alignItems="center" spacing={0.2}>
                  <Tooltip title="Relatório anterior">
                    <IconButton
                      size="small"
                      onClick={goToPreviousCompletedReport}
                      sx={{ color: '#111827', opacity: 0.82 }}
                      aria-label="Ir para relatório anterior"
                    >
                      <KeyboardArrowUpRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Próximo relatório">
                    <IconButton
                      size="small"
                      onClick={goToNextCompletedReport}
                      sx={{ color: '#111827', opacity: 0.82 }}
                      aria-label="Ir para próximo relatório"
                    >
                      <KeyboardArrowDownRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : null}
            </Stack>
            {completedReportsForCarousel.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum relatório concluído no período selecionado.
              </Typography>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                <Typography variant="caption" color="text.secondary">
                  Clique no relatório para abrir a atividade no contexto SMIF.
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
                    {completedReportsForCarousel.map((item) => (
                      <Card
                        key={item.activityId}
                        variant="outlined"
                        role="button"
                        tabIndex={0}
                        onClick={() => openActivityFromDetail(item.activityId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openActivityFromDetail(item.activityId);
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
                            {(item.localityCode || item.localityName) ?? '-'} • Data da atividade {formatDrilldownDate(item.eventDate)}
                          </Typography>
                          <Stack direction="row" spacing={0.6} sx={{ mt: 0.8, flexWrap: 'wrap' }} useFlexGap>
                            <Chip
                              size="small"
                              label={`${Number(item?.instructors ?? 0)} instrutores`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={`${Number(item?.recruits ?? 0)} recrutas`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={`${Number(item?.elos ?? 0)} elos`}
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
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.35,
                            }}
                          >
                            {String(item.activityTypeName ?? '').trim() || 'Relatório assinado'}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
                {completedReportsForCarousel.length > 1 ? (
                  <Typography variant="caption" color="text.secondary">
                    {safeCompletedReportCarouselIndex + 1} de {completedReportsForCarousel.length} • rotação automática a cada 5s
                  </Typography>
                ) : null}
              </Box>
            )}
          </CardContent>
        </Card>
        <Card
          sx={{
            width: '100%',
            minWidth: 0,
            height: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 3,
            border: '1px solid rgb(58, 122, 154)',
            gridColumn: { xs: '1', md: '1 / -1' },
          }}
        >
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ color: '#111827' }}>
                Pontos de atenção
              </Typography>
              {attentionPoints.length > 1 ? (
                <Stack direction="row" alignItems="center" spacing={0.2}>
                  <Tooltip title="Ponto anterior">
                    <IconButton
                      size="small"
                      onClick={goToPreviousAttentionPoint}
                      sx={{ color: '#111827', opacity: 0.82 }}
                      aria-label="Ir para ponto de atenção anterior"
                    >
                      <KeyboardArrowUpRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Próximo ponto">
                    <IconButton
                      size="small"
                      onClick={goToNextAttentionPoint}
                      sx={{ color: '#111827', opacity: 0.82 }}
                      aria-label="Ir para próximo ponto de atenção"
                    >
                      <KeyboardArrowDownRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : null}
            </Stack>
            {!canViewBestPractices ? (
              <Typography variant="body2" color="text.secondary">
                Conteúdo disponível para perfis com acesso a Boas Práticas.
              </Typography>
            ) : bestPracticesQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Carregando pontos de atenção...
              </Typography>
            ) : bestPracticesQuery.isError ? (
              <Typography variant="body2" color="error.main">
                Não foi possível carregar os pontos de atenção.
              </Typography>
            ) : attentionPoints.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum ponto de atenção cadastrado em boas práticas.
              </Typography>
            ) : (
              <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <Box sx={{ overflow: 'hidden', height: `${attentionSlideHeight}px` }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      transform: `translateY(-${safeAttentionPointOffset * attentionSlideHeight}px)`,
                      transition: 'transform 450ms ease-in-out',
                    }}
                  >
                    {attentionPoints.map((item) => {
                      const typeColor =
                        normalizeChecklistColorHex(item.type?.colorHex) ?? '#537F97';
                      const typeTextColor =
                        normalizeChecklistColorHex(item.type?.textColorHex) ??
                        '#F4FAFD';
                      return (
                        <Card
                          key={item.id}
                          variant="outlined"
                          role="button"
                          tabIndex={0}
                          onClick={() => setReadingAttentionPoint(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setReadingAttentionPoint(item);
                            }
                          }}
                          sx={{
                            height: `${attentionSlideHeight}px`,
                            flexShrink: 0,
                            borderRadius: 2,
                            borderColor: typeColor,
                            backgroundColor: typeColor,
                            boxShadow: 'none',
                            cursor: 'pointer',
                            transition: 'transform 220ms ease, box-shadow 220ms ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 18px rgba(8, 15, 24, 0.22)',
                            },
                            '&:focus-visible': {
                              outline: `2px solid ${typeTextColor}`,
                              outlineOffset: '2px',
                            },
                          }}
                        >
                          <CardContent
                            sx={{
                              p: 1.4,
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              backgroundColor: typeColor,
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 700,
                                color: typeTextColor,
                                lineHeight: 1.22,
                              }}
                            >
                              {item.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: hexToRgba(typeTextColor, 0.94),
                                display: '-webkit-box',
                                WebkitLineClamp: 5,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {item.content}
                            </Typography>
                            <Box mt="auto" display="flex" justifyContent="space-between" gap={1}>
                              <Chip
                                size="small"
                                label={item.authorLabel || 'Coordenação CIPAVD'}
                                sx={{
                                  maxWidth: '70%',
                                  bgcolor: 'rgba(255,255,255,0.15)',
                                  color: typeTextColor,
                                  border: `1px solid ${hexToRgba(typeTextColor, 0.25)}`,
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ color: hexToRgba(typeTextColor, 0.9) }}
                                noWrap
                              >
                                {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                </Box>
                {attentionPoints.length > 1 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block' }}>
                    {safeAttentionPointOffset + 1} de {attentionPoints.length} • rotação automática a cada 5s
                  </Typography>
                ) : null}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {showInstitutionalMapping ? (
      <Card
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          mb: 2,
          borderRadius: 3,
          border: '1px solid rgba(20,74,102,0.16)',
          boxShadow: '0 12px 28px rgba(16, 40, 53, 0.12)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2.25,
            py: 1.6,
            background:
              'linear-gradient(135deg, rgba(22,76,104,0.96) 0%, rgba(40,116,151,0.95) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.16)',
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ color: '#F2FBFF' }}>
            Mapeamento institucional
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(235, 248, 255, 0.9)' }}>
            Leitura consolidada por OM com base no checklist preenchido nas missões.
          </Typography>
        </Box>
        <CardContent sx={{ p: 2, maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>
          {missionChecklistMappingQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Carregando mapeamento institucional...
            </Typography>
          ) : missionChecklistMappingQuery.isError ? (
            <Typography variant="body2" color="error.main">
              Não foi possível carregar o mapeamento institucional.
            </Typography>
          ) : institutionalSections.length === 0 || institutionalLocalities.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum checklist de missão preenchido para exibir no mapeamento institucional.
            </Typography>
          ) : (
            <Stack spacing={1.05} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  border: '1px solid rgba(22,76,104,0.14)',
                  background:
                    'linear-gradient(135deg, rgba(245,252,255,0.95) 0%, rgba(251,254,255,0.95) 100%)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#164c68',
                    mb: 0.7,
                    letterSpacing: 0.2,
                    textTransform: 'uppercase',
                  }}
                >
                  Legenda de classificação
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 0.55,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(4, minmax(0, 1fr))',
                    },
                  }}
                >
                  {institutionalClassifications.map((legendItem) => {
                    const legendStyle = resolveChecklistClassificationStyle(
                      legendItem.colorHex,
                    );
                    return (
                      <Box
                        key={legendItem.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.55,
                          minWidth: 0,
                          px: 0.7,
                          py: 0.48,
                          borderRadius: 1.25,
                          border: `1px solid ${legendStyle.borderColor}`,
                          bgcolor: legendStyle.bgColor,
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: legendStyle.color,
                            border: `1px solid ${legendStyle.borderColor}`,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: '0.67rem',
                            lineHeight: 1.15,
                            color: '#244459',
                            fontWeight: 700,
                          }}
                        >
                          {legendItem.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
              <TableContainer
                sx={{
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: 2,
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  display: 'block',
                  overflowX: 'auto',
                  overflowY: { xs: 'auto', md: 'visible' },
                  maxHeight: { xs: '64vh', md: 'none' },
                }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    width: `${institutionalTableWidth}px`,
                    minWidth: '100%',
                    tableLayout: 'fixed',
                  }}
                >
                <colgroup>
                  <col style={{ width: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px` }} />
                  {institutionalLocalities.map((locality) => (
                    <col
                      key={`column-${locality.id}`}
                      style={{ width: `${INSTITUTIONAL_LOCALITY_COLUMN_WIDTH}px` }}
                    />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        width: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`,
                        minWidth: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`,
                        bgcolor: '#eaf4fa',
                        py: 0.6,
                        px: 0.7,
                        fontSize: '0.7rem',
                        zIndex: 3,
                      }}
                    >
                      Dimensão observada
                    </TableCell>
                    {institutionalLocalities.map((locality) => (
                      <TableCell
                        key={locality.id}
                        sx={{
                          width: `${INSTITUTIONAL_LOCALITY_COLUMN_WIDTH}px`,
                          minWidth: `${INSTITUTIONAL_LOCALITY_COLUMN_WIDTH}px`,
                          bgcolor: '#f1f8fc',
                          py: 0.45,
                          px: 0.55,
                          zIndex: 3,
                        }}
                      >
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, lineHeight: 1.08, fontSize: '0.68rem' }} noWrap>
                          {String(locality.code ?? '').trim() || locality.name}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {institutionalSections.flatMap((section, sectionIndex) => [
                    <TableRow key={`section-divider-${section.id}`}>
                      {(() => {
                        const sectionMeta =
                          institutionalSectionHighlightMeta[section.id] ?? {
                            color: '#486477',
                            bgColor: '#ffffff',
                            borderColor: 'rgba(15,23,42,0.1)',
                          };
                        return (
                      <TableCell
                        colSpan={institutionalTotalColumns}
                        sx={{
                          py: 0.1,
                          px: 0.7,
                          fontWeight: 700,
                          fontSize: '0.63rem',
                          letterSpacing: 0.22,
                          textTransform: 'uppercase',
                          color: sectionMeta.color,
                          bgcolor: sectionMeta.bgColor,
                          borderLeft: `3px solid ${sectionMeta.borderColor}`,
                          borderTop:
                            sectionIndex === 0
                              ? '1px solid rgba(15,23,42,0.12)'
                              : '1px solid rgba(15,23,42,0.1)',
                          borderBottom: '1px solid rgba(15,23,42,0.05)',
                        }}
                      >
                        {section.title}
                      </TableCell>
                        );
                      })()}
                    </TableRow>,
                    ...section.items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell
                          sx={{
                            bgcolor: '#f8fbfe',
                            width: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`,
                            minWidth: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`,
                            borderRight: '1px solid rgba(15,23,42,0.06)',
                            py: 0.18,
                            px: 0.4,
                            verticalAlign: 'middle',
                          }}
                        >
                          <Box
                            sx={{
                              minHeight: 32,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                            }}
                          >
                            {section.id === 'analise_riscos' && item.prompt ? (
                              <Tooltip
                                arrow
                                placement="top-start"
                                title={
                                  <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.25 }}>
                                    {item.prompt}
                                  </Typography>
                                }
                              >
                                <Typography
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '0.66rem',
                                    lineHeight: 1.06,
                                    cursor: 'help',
                                    textAlign: 'left',
                                  }}
                                >
                                  {item.title}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.66rem',
                                  lineHeight: 1.06,
                                  textAlign: 'left',
                                }}
                              >
                                {item.title}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        {institutionalLocalities.map((locality) => {
                          const cell =
                            item.cells.find(
                              (currentCell) => currentCell.localityId === locality.id,
                            ) ?? {
                              localityId: locality.id,
                              missionId: null,
                              classification: null,
                              notes: '',
                              hasNotes: false,
                              photos: [],
                              hasPhotos: false,
                            };
                          const classificationConfig = cell.classification
                            ? institutionalClassificationById.get(cell.classification) ??
                              {
                                id: cell.classification,
                                label:
                                  fallbackInstitutionalChecklistClassificationMeta[
                                    cell.classification
                                  ].label,
                                colorHex:
                                  fallbackInstitutionalChecklistClassificationMeta[
                                    cell.classification
                                  ].colorHex,
                              }
                            : null;
                          const classificationMeta = classificationConfig
                            ? resolveChecklistClassificationStyle(
                                classificationConfig.colorHex,
                              )
                            : null;
                          const isClickable = Boolean(cell.missionId);
                          const previewText =
                            cell.notes.trim() ||
                            (cell.classification ? '' : 'Sem preenchimento.');

                          return (
                            <TableCell
                              key={`${item.id}-${locality.id}`}
                              sx={{ py: 0.12, px: 0.2, verticalAlign: 'middle' }}
                            >
                              <Box
                                role={isClickable ? 'button' : undefined}
                                tabIndex={isClickable ? 0 : undefined}
                                onClick={
                                  isClickable
                                    ? () =>
                                        openInstitutionalDetail(
                                          section,
                                          item,
                                          locality,
                                          cell,
                                        )
                                    : undefined
                                }
                                onKeyDown={
                                  isClickable
                                    ? (event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          openInstitutionalDetail(
                                            section,
                                            item,
                                            locality,
                                            cell,
                                          );
                                        }
                                      }
                                    : undefined
                                }
                                sx={{
                                  p: 0.22,
                                  borderRadius: 0.8,
                                  border: `1px solid ${classificationMeta?.borderColor ?? 'rgba(148,163,184,0.35)'}`,
                                  backgroundColor: classificationMeta?.bgColor ?? '#ffffff',
                                  cursor: isClickable ? 'pointer' : 'default',
                                  minHeight: 32,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-start',
                                  transition:
                                    'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                                  '&:hover': isClickable
                                    ? {
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 5px 12px rgba(18, 42, 56, 0.11)',
                                        borderColor:
                                          classificationMeta?.color ??
                                          'rgba(30,64,175,0.45)',
                                      }
                                    : undefined,
                                  '&:focus-visible': isClickable
                                    ? {
                                        outline: '2px solid #0D5B84',
                                        outlineOffset: '2px',
                                      }
                                    : undefined,
                                }}
                              >
                                <Typography
                                  sx={{
                                    color: '#334155',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '0.58rem',
                                    lineHeight: 1.02,
                                    textAlign: 'left',
                                  }}
                                >
                                  {previewText}
                                </Typography>
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )),
                  ])}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </CardContent>
      </Card>
      ) : null}

      <Dialog
        open={Boolean(kpiDetail)}
        onClose={() => setKpiDetail(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pb: 0.75 }}>
          {kpiDetail?.title ?? 'Detalhes do KPI'}
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
                label={`${filteredKpiItems.length} atividade(s) no resultado`}
              />
            </Box>
            <TextField
              size="small"
              label="Buscar atividade"
              placeholder="Nome, localidade, área ou tipo"
              value={kpiDetailSearch}
              onChange={(event) => setKpiDetailSearch(event.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 320 } }}
            />
          </Stack>
          {filteredKpiItems.length === 0 ? (
            <EmptyState
              title="Sem itens para exibir"
              description={kpiDetail?.emptyMessage ?? 'Nenhum detalhe encontrado para este KPI.'}
            />
          ) : (
            <TableContainer sx={{ border: '1px solid rgba(15, 23, 42, 0.08)', borderRadius: 2, maxHeight: 460 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Atividade</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Localidade</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>
                      {kpiDetail?.countField === 'detailLabel'
                        ? 'Detalhe'
                        : kpiDetail?.countField
                          ? 'Quantidade'
                          : 'Perfil'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Relatório</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredKpiItems.map((item) => (
                    <TableRow key={item.activityId} hover>
                      <TableCell>
                        <Stack spacing={0.4}>
                          <Typography variant="body2" fontWeight={700}>
                            {item.title}
                          </Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Chip
                              size="small"
                              label={item.specialtyName || 'Comissão CIPAVD'}
                              sx={{ height: 20 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              ID: {item.activityId.slice(0, 8)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {formatGsdLabel(item.localityName, item.localityCode)}
                      </TableCell>
                      <TableCell>{formatDrilldownDate(item.eventDate)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={String(item.activityTypeName ?? '').trim() || 'Não informado'}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {kpiDetail?.countField
                          ? getKpiCountValue(item, kpiDetail.countField)
                          : `${item.instructors ?? 0} Inst | ${item.recruits ?? 0} Rec | ${item.elos ?? 0} Elo | ${item.eloGraduadoMaster ?? 0} GM`}
                      </TableCell>
                      <TableCell>
                        {typeof item.hasSignedReport === 'boolean' ? (
                          <Chip
                            size="small"
                            color={item.hasSignedReport ? 'success' : 'default'}
                            label={item.hasSignedReport ? 'Assinado' : 'Não assinado'}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => openKpiDetailItem(item)}
                        >
                          {item.linkPath ? 'Abrir tarefas' : 'Abrir'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              navigate(kpiDetail?.countField === 'detailLabel' ? '/tasks' : '/activities')
            }
          >
            {kpiDetail?.countField === 'detailLabel'
              ? 'Ver todas as tarefas'
              : 'Ver todas as atividades'}
          </Button>
          <Button onClick={() => setKpiDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(institutionalDetail)}
        onClose={() => setInstitutionalDetail(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pb: 0.6 }}>
          Mapeamento institucional -{' '}
          {institutionalDetail
            ? `${institutionalDetail.localityCode || institutionalDetail.localityName}`
            : 'Detalhes'}
        </DialogTitle>
        <DialogContent dividers>
          {institutionalDetail ? (
            <Stack spacing={1.5}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 1.4 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {institutionalDetail.sectionTitle}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.2 }}>
                        {institutionalDetail.itemTitle}
                      </Typography>
                      {institutionalDetail.itemPrompt ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                          {institutionalDetail.itemPrompt}
                        </Typography>
                      ) : null}
                    </Box>
                    {canEditInstitutionalChecklist &&
                    Boolean(institutionalDetail.mission?.id) ? (
                      <TextField
                        select
                        size="small"
                        label="Classificação"
                        value={institutionalDraftClassification}
                        onChange={(event) =>
                          setInstitutionalDraftClassification(
                            event.target
                              .value as InstitutionalChecklistClassification,
                          )
                        }
                        sx={{ minWidth: { xs: '100%', md: 320 } }}
                        disabled={updateMissionChecklist.isPending}
                      >
                        {institutionalClassifications.map((classification) => (
                          <MenuItem
                            key={classification.id}
                            value={classification.id}
                          >
                            {classification.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      (() => {
                        const currentClassification =
                          institutionalDetail.cell.classification;
                        const classificationConfig = currentClassification
                          ? institutionalClassificationById.get(
                              currentClassification,
                            ) ??
                            {
                              id: currentClassification,
                              label:
                                fallbackInstitutionalChecklistClassificationMeta[
                                  currentClassification
                                ].label,
                              colorHex:
                                fallbackInstitutionalChecklistClassificationMeta[
                                  currentClassification
                                ].colorHex,
                            }
                          : null;
                        const style = classificationConfig
                          ? resolveChecklistClassificationStyle(
                              classificationConfig.colorHex,
                            )
                          : null;
                        return (
                          <Chip
                            size="small"
                            label={classificationConfig?.label ?? 'Sem classificação'}
                            sx={{
                              alignSelf: { xs: 'flex-start', md: 'center' },
                              color: style?.color ?? '#475569',
                              bgcolor: style?.bgColor ?? '#f1f5f9',
                              border: `1px solid ${
                                style?.borderColor ?? '#cbd5e1'
                              }`,
                              fontWeight: 700,
                            }}
                          />
                        );
                      })()
                    )}
                  </Stack>
                  {canEditInstitutionalChecklist &&
                  Boolean(institutionalDetail.mission?.id) ? (
                    <TextField
                      label="Observações"
                      value={institutionalDraftNotes}
                      onChange={(event) =>
                        setInstitutionalDraftNotes(event.target.value)
                      }
                      multiline
                      minRows={4}
                      fullWidth
                      sx={{ mt: 1 }}
                      disabled={updateMissionChecklist.isPending}
                    />
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: 1.2,
                        backgroundColor: '#f8fbfe',
                        border: '1px solid rgba(15,23,42,0.08)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {institutionalDetail.cell.notes.trim() ||
                        'Sem observações registradas para este item.'}
                    </Typography>
                  )}
                  {((canEditInstitutionalChecklist &&
                      Boolean(institutionalDetail.mission?.id)) ||
                      (institutionalDetail.cell.photos ?? []).length > 0) ? (
                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.6 }}
                      >
                        Fotos relacionadas
                      </Typography>
                      {canEditInstitutionalChecklist &&
                      Boolean(institutionalDetail.mission?.id) ? (
                        <>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'stretch', md: 'center' }}
                            sx={{ mb: 1 }}
                          >
                            <Button
                              component="label"
                              variant="outlined"
                              size="small"
                              disabled={uploadMissionChecklistPhoto.isPending}
                              sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}
                            >
                              {uploadMissionChecklistPhoto.isPending
                                ? 'Enviando...'
                                : 'Adicionar foto'}
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  void handleAddInstitutionalPhoto(file);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </Button>
                            <Typography variant="caption" color="text.secondary">
                              Salve o item para persistir as alterações.
                            </Typography>
                          </Stack>
                          {(institutionalDetail.cell.photos ?? []).length > 0
                            ? (() => {
                                const photos = institutionalDetail.cell.photos ?? [];
                                const idx = Math.min(
                                  institutionalPhotoCarouselIndex,
                                  photos.length - 1,
                                );
                                const currentUrl = photos[idx];
                                const resolvedUrl = resolveChecklistPhotoUrl(currentUrl);
                                return (
                                  <Box
                                    sx={{
                                      position: 'relative',
                                      borderRadius: 2,
                                      overflow: 'hidden',
                                      border: '1px solid rgba(15,23,42,0.15)',
bgcolor: '#fff',
                                    minHeight: 200,
                                      maxHeight: 340,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Box
                                      component="a"
                                      href={resolvedUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      sx={{
                                        display: 'block',
                                        flex: 1,
                                        minHeight: 200,
                                        maxHeight: 340,
                                      }}
                                    >
                                      <Box
                                        component="img"
                                        src={resolvedUrl}
                                        alt={`Foto do mapeamento institucional ${idx + 1}`}
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          maxHeight: 340,
                                          objectFit: 'contain',
                                          display: 'block',
                                        }}
                                      />
                                    </Box>
                                    {photos.length > 1 ? (
                                      <>
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            setInstitutionalPhotoCarouselIndex((i) =>
                                              i <= 0 ? photos.length - 1 : i - 1,
                                            )
                                          }
                                          sx={{
                                            position: 'absolute',
                                            left: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            bgcolor: 'rgba(255,255,255,0.9)',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                                          }}
                                        >
                                          <ChevronLeftIcon />
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            setInstitutionalPhotoCarouselIndex((i) =>
                                              i >= photos.length - 1 ? 0 : i + 1,
                                            )
                                          }
                                          sx={{
                                            position: 'absolute',
                                            right: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            bgcolor: 'rgba(255,255,255,0.9)',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                                          }}
                                        >
                                          <ChevronRightIcon />
                                        </IconButton>
                                      </>
                                    ) : null}
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        handleRemoveInstitutionalPhoto(currentUrl)
                                      }
                                      sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        bgcolor: 'rgba(255,255,255,0.9)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                                      }}
                                    >
                                      <DeleteOutlineIcon fontSize="inherit" />
                                    </IconButton>
                                    {photos.length > 1 ? (
                                      <Stack
                                        direction="row"
                                        spacing={0.5}
                                        justifyContent="center"
                                        sx={{
                                          position: 'absolute',
                                          bottom: 8,
                                          left: 0,
                                          right: 0,
                                        }}
                                      >
                                        {photos.map((_, i) => (
                                          <Box
                                            key={i}
                                            onClick={() =>
                                              setInstitutionalPhotoCarouselIndex(i)
                                            }
                                            sx={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: '50%',
                                              bgcolor:
                                                i === idx
                                                  ? 'primary.main'
                                                  : 'rgba(255,255,255,0.7)',
                                              cursor: 'pointer',
                                              border: '1px solid rgba(0,0,0,0.2)',
                                            }}
                                          />
                                        ))}
                                      </Stack>
                                    ) : null}
                                  </Box>
                                );
                              })()
                            : null}
                        </>
                      ) : (institutionalDetail.cell.photos ?? []).length > 0
                        ? (() => {
                            const photos = institutionalDetail.cell.photos ?? [];
                            const idx = Math.min(
                              institutionalPhotoCarouselIndex,
                              photos.length - 1,
                            );
                            const currentUrl = photos[idx];
                            const resolvedUrl = resolveChecklistPhotoUrl(currentUrl);
                            return (
                              <Box
                                sx={{
                                  position: 'relative',
                                  borderRadius: 2,
                                  overflow: 'hidden',
                                  border: '1px solid rgba(15,23,42,0.15)',
                                  bgcolor: '#fff',
                                  minHeight: 200,
                                  maxHeight: 340,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Box
                                  component="a"
                                  href={resolvedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  sx={{
                                    display: 'block',
                                    flex: 1,
                                    minHeight: 200,
                                    maxHeight: 340,
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={resolvedUrl}
                                    alt={`Foto do mapeamento institucional ${idx + 1}`}
                                    sx={{
                                      width: '100%',
                                      height: '100%',
                                      maxHeight: 340,
                                      objectFit: 'contain',
                                      display: 'block',
                                    }}
                                  />
                                </Box>
                                {photos.length > 1 ? (
                                  <>
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        setInstitutionalPhotoCarouselIndex((i) =>
                                          i <= 0 ? photos.length - 1 : i - 1,
                                        )
                                      }
                                      sx={{
                                        position: 'absolute',
                                        left: 8,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        bgcolor: 'rgba(255,255,255,0.9)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                                      }}
                                    >
                                      <ChevronLeftIcon />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        setInstitutionalPhotoCarouselIndex((i) =>
                                          i >= photos.length - 1 ? 0 : i + 1,
                                        )
                                      }
                                      sx={{
                                        position: 'absolute',
                                        right: 8,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        bgcolor: 'rgba(255,255,255,0.9)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                                      }}
                                    >
                                      <ChevronRightIcon />
                                    </IconButton>
                                    <Stack
                                      direction="row"
                                      spacing={0.5}
                                      justifyContent="center"
                                      sx={{
                                        position: 'absolute',
                                        bottom: 8,
                                        left: 0,
                                        right: 0,
                                      }}
                                    >
                                      {photos.map((_, i) => (
                                        <Box
                                          key={i}
                                          onClick={() =>
                                            setInstitutionalPhotoCarouselIndex(i)
                                          }
                                          sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            bgcolor:
                                              i === idx
                                                ? 'primary.main'
                                                : 'rgba(255,255,255,0.7)',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(0,0,0,0.2)',
                                          }}
                                        />
                                      ))}
                                    </Stack>
                                  </>
                                ) : null}
                              </Box>
                            );
                          })()
                        : null}
                    </Box>
                  ) : null}
                </CardContent>
              </Card>

              {institutionalDetail.mission ? (
                <>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.4 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Missão relacionada
                      </Typography>
                      <Typography variant="h6" sx={{ mt: 0.5 }}>
                        {institutionalDetail.mission.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                        {institutionalDetail.mission.description || 'Sem descrição.'}
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                        <Chip
                          size="small"
                          label={`Período: ${formatMissionPeriod(
                            institutionalDetail.mission.startDate,
                            institutionalDetail.mission.endDate,
                          )}`}
                        />
                        <Chip
                          size="small"
                          label={`Atualização: ${formatDateTimePtBr(
                            institutionalDetail.mission.updatedAt,
                          )}`}
                        />
                        <Chip
                          size="small"
                          label={`Participantes: ${institutionalDetail.mission.participantsCount}`}
                        />
                        <Chip
                          size="small"
                          label={`Itens de cronograma: ${institutionalDetail.mission.scheduleItemsCount}`}
                        />
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.4 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                        Participantes da missão
                      </Typography>
                      {institutionalDetail.mission.participants.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhum participante cadastrado.
                        </Typography>
                      ) : (
                        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                          {institutionalDetail.mission.participants.map((participant) => (
                            <Chip
                              key={participant.id}
                              size="small"
                              label={`${participant.name || 'Sem nome'}${
                                participant.email
                                  ? ` • ${participant.email}`
                                  : participant.cpf
                                    ? ` • ${participant.cpf}`
                                    : ''
                              }`}
                            />
                          ))}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.4 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        sx={{ mb: institutionalScheduleExpanded ? 1 : 0 }}
                      >
                        <Typography variant="subtitle2" fontWeight={700}>
                          Cronograma da missão
                        </Typography>
                        {institutionalDetail.mission.scheduleItems.length > 0 ? (
                          <Button
                            size="small"
                            variant={institutionalScheduleExpanded ? 'outlined' : 'contained'}
                            onClick={() =>
                              setInstitutionalScheduleExpanded((current) => !current)
                            }
                          >
                            {institutionalScheduleExpanded
                              ? 'Ocultar cronograma'
                              : 'Ver cronograma'}
                          </Button>
                        ) : null}
                      </Stack>
                      {institutionalDetail.mission.scheduleItems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Missão sem itens de cronograma.
                        </Typography>
                      ) : (
                        <Collapse in={institutionalScheduleExpanded} timeout="auto" unmountOnExit>
                          <TableContainer
                            sx={{
                              border: '1px solid rgba(15, 23, 42, 0.08)',
                              borderRadius: 1.5,
                              overflowY: 'visible',
                            }}
                          >
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700 }}>Início</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Atividade</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Local</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Responsável</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {institutionalDetail.mission.scheduleItems.map((item) => (
                                  <TableRow key={item.id} hover>
                                    <TableCell>{formatDateTimePtBr(item.startAt)}</TableCell>
                                    <TableCell>
                                      <Typography variant="body2" fontWeight={600}>
                                        {item.title}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {item.durationMinutes} min
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{item.location || '-'}</TableCell>
                                    <TableCell>{item.responsible || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Collapse>
                      )}
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.4 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                        Checklist completo da missão
                      </Typography>
                      <Stack spacing={1}>
                        {institutionalDetail.mission.checklistSections.map((section) => (
                          <Box key={section.id}>
                            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                              {section.title}
                            </Typography>
                            <Stack spacing={0.7}>
                              {section.items.map((item) => {
                                const classificationConfig =
                                  institutionalClassificationById.get(
                                    item.classification,
                                  ) ??
                                  fallbackInstitutionalChecklistClassificationMeta[
                                    item.classification
                                  ];
                                const meta = resolveChecklistClassificationStyle(
                                  classificationConfig.colorHex,
                                );
                                return (
                                  <Box
                                    key={item.id}
                                    sx={{
                                      border: `1px solid ${meta.borderColor}`,
                                      borderRadius: 1.2,
                                      p: 0.8,
                                      backgroundColor: meta.bgColor,
                                    }}
                                  >
                                    <Stack
                                      direction={{ xs: 'column', md: 'row' }}
                                      justifyContent="space-between"
                                      spacing={0.8}
                                    >
                                      <Typography variant="caption" fontWeight={700}>
                                        {item.title}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: meta.color, fontWeight: 700 }}
                                      >
                                        {classificationConfig.label}
                                      </Typography>
                                    </Stack>
                                    {item.prompt ? (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                                        {item.prompt}
                                      </Typography>
                                    ) : null}
                                    <Typography
                                      variant="caption"
                                      sx={{ display: 'block', mt: 0.45, whiteSpace: 'pre-wrap' }}
                                    >
                                      {item.notes || 'Sem observações.'}
                                    </Typography>
                                    {(item.photos ?? []).length > 0 ? (
                                      <Stack
                                        direction="row"
                                        spacing={0.6}
                                        flexWrap="wrap"
                                        useFlexGap
                                        sx={{ mt: 0.55 }}
                                      >
                                        {item.photos.map((photoUrl) => (
                                          <Box
                                            key={photoUrl}
                                            component="a"
                                            href={photoUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            sx={{
                                              width: 70,
                                              height: 52,
                                              borderRadius: 0.8,
                                              overflow: 'hidden',
                                              border: '1px solid rgba(15,23,42,0.16)',
                                              display: 'block',
                                              bgcolor: '#E2E8F0',
                                            }}
                                          >
                                            <Box
                                              component="img"
                                              src={photoUrl}
                                              alt="Foto do item do checklist"
                                              sx={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                              }}
                                            />
                                          </Box>
                                        ))}
                                      </Stack>
                                    ) : null}
                                  </Box>
                                );
                              })}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Não foi encontrada missão com checklist preenchido para esta localidade.
                </Typography>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          {canEditInstitutionalChecklist && institutionalDetail?.mission?.id ? (
            <Button
              variant="contained"
              onClick={saveInstitutionalChecklistItem}
              disabled={updateMissionChecklist.isPending}
            >
              {updateMissionChecklist.isPending
                ? 'Salvando...'
                : 'Salvar alterações'}
            </Button>
          ) : null}
          {institutionalDetail?.mission?.id ? (
            <Button
              onClick={() => {
                const next = new URLSearchParams();
                next.set('missionId', institutionalDetail.mission?.id || '');
                navigate(`/missions?${next.toString()}`);
              }}
            >
              Abrir missão
            </Button>
          ) : null}
          <Button onClick={() => setInstitutionalDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(readingAttentionPoint)}
        onClose={() => setReadingAttentionPoint(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          {readingAttentionPoint?.title || 'Ponto de atenção'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography
              variant="body1"
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
            >
              {readingAttentionPoint?.content || '-'}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              <Typography variant="caption" color="text.secondary">
                Autor: {readingAttentionPoint?.authorLabel || 'Coordenação CIPAVD'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Data:{' '}
                {readingAttentionPoint?.createdAt
                  ? new Date(readingAttentionPoint.createdAt).toLocaleString('pt-BR')
                  : '-'}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReadingAttentionPoint(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingCardId)} onClose={() => setEditingCardId(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar card do SMIF</DialogTitle>
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
              label="Descrição"
              value={editingCardDraft.description}
              onChange={(e) =>
                setEditingCardDraft((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              multiline
              minRows={2}
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
          <Button
            onClick={() => setEditingCardId(null)}
            disabled={updateSmifCardSetting.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={saveStyleEditor}
            disabled={updateSmifCardSetting.isPending}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
