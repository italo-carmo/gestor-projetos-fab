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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  TextField,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import TerrainIcon from '@mui/icons-material/Terrain';
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
  useLessonsLearned,
  useMe,
  useMissionChecklistMapping,
} from '../api/hooks';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
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

type LessonPost = {
  id: string;
  title: string;
  content: string;
  authorLabel?: string | null;
  createdAt: string;
  typeId: string;
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
    }>;
  }>;
};

type InstitutionalChecklistMapping = {
  generatedAt: string;
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
  sectionTitle: string;
  itemTitle: string;
  itemPrompt?: string | null;
  localityName: string;
  localityCode?: string | null;
  cell: InstitutionalChecklistCell;
  mission: InstitutionalChecklistMission | null;
} | null;

const institutionalChecklistClassificationMeta: Record<
  InstitutionalChecklistClassification,
  {
    label: string;
    chipLabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  FORTE_CONSOLIDADA: {
    label: 'Dimensão forte/consolidada',
    chipLabel: 'Forte',
    color: '#166534',
    bgColor: '#e8f5e9',
    borderColor: '#81c784',
  },
  OPORTUNIDADE_MELHORIA: {
    label: 'Dimensão com oportunidades de melhoria',
    chipLabel: 'Melhoria',
    color: '#8a5800',
    bgColor: '#fff8e1',
    borderColor: '#ffcc80',
  },
  NECESSITA_ANALISE: {
    label: 'Dimensão necessita de maior análise',
    chipLabel: 'Análise',
    color: '#475569',
    bgColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  POSSIVEL_RISCO: {
    label: 'Possível Risco',
    chipLabel: 'Risco',
    color: '#b71c1c',
    bgColor: '#ffebee',
    borderColor: '#ef9a9a',
  },
};

type EditableCardStyle = {
  backgroundColor: string;
  textColor: string;
};

const SMIF_CARD_STYLES_STORAGE_KEY = 'smif-card-styles-v1';
const INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH = 230;
const INSTITUTIONAL_LOCALITY_COLUMN_WIDTH = 150;
const institutionalSectionHighlightMeta: Record<
  string,
  { color: string; bgColor: string; borderColor: string }
> = {
  lideranca: {
    color: '#24507A',
    bgColor: '#eef5ff',
    borderColor: '#bfd7f5',
  },
  acompanhamento_recrutas: {
    color: '#246548',
    bgColor: '#eefaf2',
    borderColor: '#c4e8d1',
  },
  analise_riscos: {
    color: '#8a4c18',
    bgColor: '#fff5ea',
    borderColor: '#f2d8bc',
  },
};

function loadSmifCardStyles(): Record<string, EditableCardStyle> {
  try {
    const raw = window.localStorage.getItem(SMIF_CARD_STYLES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, EditableCardStyle>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function DashboardNationalPage() {
  const { data: me } = useMe();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const localityId = params.get('localityId') ?? '';
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const missionChecklistMappingQuery = useMissionChecklistMapping({
    localityId: localityId || undefined,
  });
  const canViewLessons =
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI, ROLE_COMANDANTE_COMGEP]) &&
    can(me, 'lessons_learned', 'view');
  const lessonsQuery = useLessonsLearned({}, canViewLessons);
  const [lessonOffset, setLessonOffset] = useState(0);
  const [readingLesson, setReadingLesson] = useState<LessonPost | null>(null);
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const [cardStyles, setCardStyles] = useState<Record<string, EditableCardStyle>>(() => loadSmifCardStyles());
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardDraft, setEditingCardDraft] = useState<EditableCardStyle>({
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
  });
  const [kpiDetail, setKpiDetail] = useState<KpiDetailState>(null);
  const [kpiDetailSearch, setKpiDetailSearch] = useState('');
  const [institutionalDetail, setInstitutionalDetail] =
    useState<InstitutionalChecklistDetailState>(null);

  const lessons = ((lessonsQuery.data?.items ?? []) as LessonPost[])
    .filter((item) => item?.id)
    .filter((item) => {
      const normalizedType = String(item.type?.name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      return normalizedType === 'resultados positivos';
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    if (lessons.length <= 1) return;
    const timer = window.setInterval(() => {
      setLessonOffset((prev) => prev + 1);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [lessons.length]);

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
    fieldActivitiesBySpecialty: {
      psychology: [],
      socialService: [],
      doctrine: [],
      law: [],
    },
  };
  const institutionalMapping =
    (missionChecklistMappingQuery.data as InstitutionalChecklistMapping | undefined) ??
    null;
  const institutionalLocalities = institutionalMapping?.localities ?? [];
  const institutionalSections = institutionalMapping?.sections ?? [];
  const institutionalTableWidth =
    INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH +
    institutionalLocalities.length * INSTITUTIONAL_LOCALITY_COLUMN_WIDTH;
  const institutionalTotalColumns = institutionalLocalities.length + 1;
  const institutionalLegendItems: Array<{
    key: InstitutionalChecklistClassification;
    label: string;
  }> = [
    { key: 'FORTE_CONSOLIDADA', label: 'Dimensão forte/consolidada' },
    {
      key: 'OPORTUNIDADE_MELHORIA',
      label: 'Dimensão com oportunidades de melhoria',
    },
    {
      key: 'NECESSITA_ANALISE',
      label: 'Dimensão necessita de maior análise',
    },
    { key: 'POSSIVEL_RISCO', label: 'Possível Risco' },
  ];
  const missionByLocality = new Map<string, InstitutionalChecklistMission | null>(
    (institutionalMapping?.missionsByLocality ?? []).map((entry) => [
      entry.localityId,
      entry.mission,
    ]),
  );
  const lessonsPerView = 3;
  const visibleLessons =
    lessons.length <= lessonsPerView
      ? lessons
      : Array.from({ length: lessonsPerView }, (_, index) => {
          const safeIndex = (lessonOffset + index) % lessons.length;
          return lessons[safeIndex];
        });

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
      sectionTitle: section.title,
      itemTitle: item.title,
      itemPrompt: item.prompt ?? null,
      localityName: locality.name,
      localityCode: locality.code ?? null,
      cell,
      mission: missionByLocality.get(locality.id) ?? null,
    });
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
  const openCompletedFieldActivitiesDetail = () => {
    openKpiDetail({
      title: 'Atividades de campo concluídas',
      subtitle: 'Lista das atividades de campo concluídas no recorte atual.',
      items: drilldown.completedFieldActivities,
      emptyMessage: 'Nenhuma atividade de campo concluída encontrada.',
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
  const openCompletedTasksDetail = () => {
    openKpiDetail({
      title: 'Tarefas concluídas',
      subtitle: 'Tarefas finalizadas em todas as localidades do recorte.',
      items: drilldown.completedTasks,
      emptyMessage: 'Nenhuma tarefa concluída em todas as localidades.',
      countField: 'detailLabel',
    });
  };
  const openCompletedVisitsDetail = () => {
    openKpiDetail({
      title: 'Visitas concluídas',
      subtitle: 'Atividades do tipo visita com status concluído.',
      items: drilldown.completedVisits,
      emptyMessage: 'Nenhuma visita concluída encontrada.',
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
      id: 'fieldActivities',
      label: 'Atividades de campo',
      value: String(totals.completedFieldActivities ?? 0),
      helper: 'Concluídas',
      icon: <TerrainIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'reports',
      label: 'Relatórios',
      value: String(totals.completedReports ?? 0),
      helper: 'Concluídas',
      icon: <DescriptionIcon sx={{ fontSize: 22 }} />,
    },
    {
      id: 'placeholder-1',
      label: '',
      value: '',
      helper: '',
      icon: <Box sx={{ width: 22, height: 22 }} />,
    },
    {
      id: 'placeholder-2',
      label: '',
      value: '',
      helper: '',
      icon: <Box sx={{ width: 22, height: 22 }} />,
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

  const getCardStyle = (cardId: string, defaults: EditableCardStyle) => cardStyles[cardId] ?? defaults;

  const openStyleEditor = (cardId: string, defaults: EditableCardStyle) => {
    setEditingCardId(cardId);
    setEditingCardDraft(getCardStyle(cardId, defaults));
  };

  const saveStyleEditor = () => {
    if (!editingCardId) return;
    const next = {
      ...cardStyles,
      [editingCardId]: editingCardDraft,
    };
    setCardStyles(next);
    window.localStorage.setItem(SMIF_CARD_STYLES_STORAGE_KEY, JSON.stringify(next));
    setEditingCardId(null);
  };
  const getIndicatorClickAction = (groupId: string, itemId: string) => {
    if (groupId === 'smif-completed') {
      if (itemId === 'reports') return openCompletedReportsDetail;
      if (itemId === 'tasks') return openCompletedTasksDetail;
      if (itemId === 'fieldActivities') return openCompletedFieldActivitiesDetail;
      if (itemId === 'visits') return openCompletedVisitsDetail;
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
          mb: 2,
        }}
      >
        {[
          {
            id: 'smif-completed',
            title: 'Entregas Realizadas',
            subtitle: 'Resumo de atuação da CIPAVD.',
            items: completedIndicators,
            bg: '#1F4A61',
            border: '1px solid rgba(139, 184, 207, 0.38)',
            shadow: '0 18px 34px rgba(15,44,59,0.36)',
            titleColor: '#F4FAFD',
            subtitleColor: 'rgba(231,244,250,0.92)',
          },
          {
            id: 'smif-field',
            title: 'Atividades de campo realizadas pela CIPAVD.',
            subtitle: 'Apoio realizado pela área técnica dos integrantes.',
            items: fieldBySpecialtyIndicators,
            bg: '#2F6F8A',
            border: '1px solid rgba(132, 178, 201, 0.36)',
            shadow: '0 18px 34px rgba(16,40,53,0.38)',
            titleColor: '#F2FBFE',
            subtitleColor: 'rgba(236,250,255,0.9)',
          },
        ].map((group) => {
          const groupStyle = getCardStyle(group.id, {
            backgroundColor: group.bg,
            textColor: group.titleColor,
          });
          return (
          <Card
            key={group.title}
            sx={{
              background: groupStyle.backgroundColor,
              border: group.border,
              width: '100%',
              minWidth: 0,
              borderRadius: 3,
              boxShadow: group.shadow,
              position: 'relative',
            }}
          >
            <CardContent sx={{ p: 2.25 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: 0.2, color: groupStyle.textColor }}>
                    {group.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: groupStyle.textColor }}>
                    {group.subtitle}
                  </Typography>
                </Box>
                {isTiProfile ? (
                  <Tooltip title="Editar cores do card">
                    <IconButton
                      size="small"
                      sx={{ color: groupStyle.textColor, opacity: 0.72 }}
                      onClick={() =>
                        openStyleEditor(group.id, {
                          backgroundColor: group.bg,
                          textColor: group.titleColor,
                        })
                      }
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
              <Box
                sx={{
                  mt: 1.5,
                  display: 'grid',
                  gap: 1.25,
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
                        p: 1.5,
                        borderRadius: 2,
                        border: isInteractive ? '1px solid rgba(0,60,92,0.35)' : '1px solid rgba(255,255,255,0.5)',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        minHeight: 106,
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
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          {item.label}
                        </Typography>
                        <Box sx={{ color: '#114259' }}>{item.icon}</Box>
                      </Box>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, color: '#0E3142' }}>
                          {item.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.helper}{isInteractive ? ' • Clique para detalhar' : ''}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        )})}
      </Box>
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
          mb: 2,
        }}
      >
        {(() => {
          const style = getCardStyle('smif-participants', {
            backgroundColor: '#3A7A9A',
            textColor: '#F0F9FC',
          });
          return (
        <Card
          sx={{
            background: style.backgroundColor,
            border: '1px solid rgba(145, 195, 220, 0.36)',
            width: '100%',
            minWidth: 0,
            borderRadius: 3,
            boxShadow: '0 18px 34px rgba(18,42,56,0.38)',
          }}
        >
          <CardContent sx={{ p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: 0.2, color: style.textColor }}>
                  Público alcançado
                </Typography>
                <Typography variant="caption" sx={{ color: style.textColor }}>
                  Total de participações em atividades de campo.
                </Typography>
              </Box>
              {isTiProfile ? (
                <Tooltip title="Editar cores do card">
                  <IconButton
                    size="small"
                    sx={{ color: style.textColor, opacity: 0.72 }}
                    onClick={() =>
                      openStyleEditor('smif-participants', {
                        backgroundColor: '#3A7A9A',
                        textColor: '#F0F9FC',
                      })
                    }
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
            <Box
              sx={{
                mt: 1.5,
                display: 'grid',
                gap: 1.25,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                },
              }}
            >
              {participantsIndicators.map((item) => {
                const onItemClick = getIndicatorClickAction('smif-participants', item.id);
                const isInteractive = Boolean(onItemClick);
                return (
                  <Box
                    key={item.label}
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
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid rgba(0,60,92,0.35)',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      minHeight: 106,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 16px rgba(17,66,89,0.16)',
                        borderColor: 'rgba(0,60,92,0.45)',
                      },
                      '&:focus-visible': {
                        outline: '2px solid #0D5B84',
                        outlineOffset: '2px',
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {item.label}
                      </Typography>
                      <Box sx={{ color: '#114259' }}>{item.icon}</Box>
                    </Box>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, color: '#0E3142' }}>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.helper} • Clique para detalhar
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
          );
        })()}
        {(() => {
          const style = getCardStyle('smif-positive-results', {
            backgroundColor: '#FFFFFF',
            textColor: '#111827',
          });
          return (
        <Card sx={{ width: '100%', minWidth: 0, height: '100%', backgroundColor: style.backgroundColor, borderRadius: 3 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ color: style.textColor }}>
                Resultados positivos alcançados
              </Typography>
              {isTiProfile ? (
                <Tooltip title="Editar cores do card">
                  <IconButton
                    size="small"
                    sx={{ color: style.textColor, opacity: 0.72 }}
                    onClick={() =>
                      openStyleEditor('smif-positive-results', {
                        backgroundColor: '#FFFFFF',
                        textColor: '#111827',
                      })
                    }
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
              {!canViewLessons ? (
                <Typography variant="body2" color="text.secondary">
                  Conteúdo disponível para Coordenação, TI e COMGEP.
                </Typography>
              ) : lessonsQuery.isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Carregando lições aprendidas...
                </Typography>
              ) : lessonsQuery.isError ? (
                <Typography variant="body2" color="error.main">
                  Não foi possível carregar as lições aprendidas.
                </Typography>
              ) : lessons.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum resultado positivo cadastrado.
                </Typography>
              ) : (
                <Box
                  display="grid"
                  gap={1}
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    alignContent: 'start',
                  }}
                >
                  {visibleLessons.map((lesson, index) => (
                    <Card
                      key={`${lesson.id}-${lessonOffset}-${index}`}
                      variant="outlined"
                      onClick={() => setReadingLesson(lesson)}
                      sx={{
                        transition: 'transform 280ms ease, opacity 280ms ease',
                        backgroundColor: lesson.type?.colorHex || '#8E44AD',
                        borderColor: lesson.type?.colorHex || '#8E44AD',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.2, backgroundColor: lesson.type?.colorHex || '#8E44AD' }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.25,
                            color: lesson.type?.textColorHex || '#F4FAFD',
                          }}
                        >
                          {lesson.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 0.6,
                            color: lesson.type?.textColorHex || 'rgba(244, 250, 253, 0.94)',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {lesson.content}
                        </Typography>
                        <Box display="flex" justifyContent="space-between" gap={1} mt={1}>
                          <Chip
                            size="small"
                            label={lesson.authorLabel || 'Coordenação CIPAVD'}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.15)',
                              color: lesson.type?.textColorHex || 'rgba(236, 248, 252, 0.92)',
                              border: `1px solid ${(lesson.type?.textColorHex || '#ECF8FC')}40`,
                              height: 20,
                              fontSize: '0.7rem',
                              maxWidth: '68%',
                              '& .MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              },
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ color: lesson.type?.textColorHex || 'rgba(236, 248, 252, 0.9)' }}
                            noWrap
                          >
                            {new Date(lesson.createdAt).toLocaleString('pt-BR')}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
        </Card>
          );
        })()}
      </Box>

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
                  {institutionalLegendItems.map((legendItem) => {
                    const legendMeta =
                      institutionalChecklistClassificationMeta[legendItem.key];
                    return (
                      <Box
                        key={legendItem.key}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.55,
                          minWidth: 0,
                          px: 0.7,
                          py: 0.48,
                          borderRadius: 1.25,
                          border: `1px solid ${legendMeta.borderColor}`,
                          bgcolor:
                            legendItem.key === 'NECESSITA_ANALISE'
                              ? '#ffffff'
                              : legendMeta.bgColor,
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor:
                              legendItem.key === 'NECESSITA_ANALISE'
                                ? '#ffffff'
                                : legendMeta.color,
                            border: `1px solid ${legendMeta.borderColor}`,
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
                        fontSize: '0.68rem',
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
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, lineHeight: 1.1, fontSize: '0.65rem' }} noWrap>
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
                          py: 0.15,
                          px: 0.7,
                          fontWeight: 700,
                          fontSize: '0.61rem',
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
                            py: 0.28,
                            px: 0.55,
                            verticalAlign: 'top',
                          }}
                        >
                          <Typography sx={{ fontWeight: 700, fontSize: '0.66rem', lineHeight: 1.15 }}>
                            {item.title}
                          </Typography>
                          {item.prompt ? (
                            <Typography
                              color="text.secondary"
                              sx={{
                                mt: 0.12,
                                fontSize: '0.6rem',
                                lineHeight: 1.15,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.prompt}
                            </Typography>
                          ) : null}
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
                            };
                          const classificationMeta = cell.classification
                            ? institutionalChecklistClassificationMeta[cell.classification]
                            : null;
                          const isClickable = Boolean(cell.missionId);
                          const previewText =
                            cell.notes.trim() ||
                            (cell.classification
                              ? 'Sem observações registradas.'
                              : 'Sem preenchimento.');

                          return (
                            <TableCell key={`${item.id}-${locality.id}`} sx={{ py: 0.2, px: 0.3 }}>
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
                                  p: 0.38,
                                  borderRadius: 0.8,
                                  border: `1px solid ${classificationMeta?.borderColor ?? 'rgba(148,163,184,0.35)'}`,
                                  backgroundColor: classificationMeta?.bgColor ?? '#ffffff',
                                  cursor: isClickable ? 'pointer' : 'default',
                                  minHeight: 46,
                                  transition:
                                    'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                                  '&:hover': isClickable
                                    ? {
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 5px 12px rgba(18, 42, 56, 0.11)',
                                        borderColor:
                                          classificationMeta?.color ?? 'rgba(30,64,175,0.45)',
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
                                    lineHeight: 1.15,
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
              placeholder="Nome da atividade, localidade ou área"
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
                    <Chip
                      size="small"
                      label={
                        institutionalDetail.cell.classification
                          ? institutionalChecklistClassificationMeta[
                              institutionalDetail.cell.classification
                            ].label
                          : 'Sem classificação'
                      }
                      sx={{
                        alignSelf: { xs: 'flex-start', md: 'center' },
                        color: institutionalDetail.cell.classification
                          ? institutionalChecklistClassificationMeta[
                              institutionalDetail.cell.classification
                            ].color
                          : '#475569',
                        bgcolor: institutionalDetail.cell.classification
                          ? institutionalChecklistClassificationMeta[
                              institutionalDetail.cell.classification
                            ].bgColor
                          : '#f1f5f9',
                        border: `1px solid ${
                          institutionalDetail.cell.classification
                            ? institutionalChecklistClassificationMeta[
                                institutionalDetail.cell.classification
                              ].borderColor
                            : '#cbd5e1'
                        }`,
                        fontWeight: 700,
                      }}
                    />
                  </Stack>
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
                    {institutionalDetail.cell.notes.trim() || 'Sem observações registradas para este item.'}
                  </Typography>
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
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                        Cronograma da missão
                      </Typography>
                      {institutionalDetail.mission.scheduleItems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Missão sem itens de cronograma.
                        </Typography>
                      ) : (
                        <TableContainer
                          sx={{
                            border: '1px solid rgba(15, 23, 42, 0.08)',
                            borderRadius: 1.5,
                            maxHeight: 240,
                          }}
                        >
                          <Table size="small" stickyHeader>
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
                                const meta =
                                  institutionalChecklistClassificationMeta[
                                    item.classification
                                  ];
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
                                        {meta.label}
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
        open={Boolean(readingLesson)}
        onClose={() => setReadingLesson(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          {readingLesson?.title || 'Resultado Positivo'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            variant="body1"
            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
          >
            {readingLesson?.content || '-'}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}
          >
            <Typography variant="caption" color="text.secondary">
              Autor: {readingLesson?.authorLabel || 'Coordenação CIPAVD'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Data: {readingLesson?.createdAt ? new Date(readingLesson.createdAt).toLocaleString('pt-BR') : '-'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReadingLesson(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingCardId)} onClose={() => setEditingCardId(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar cores do card</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
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
