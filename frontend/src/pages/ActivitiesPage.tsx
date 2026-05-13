import {
  Autocomplete,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  Pagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useActivityComments,
  useActivity,
  useActivityResponsibleUsers,
  useActivityTypes,
  useAddActivityComment,
  useActivities,
  useBatchDeleteActivities,
  useBatchUpdateActivityResponsible,
  useBatchUpdateActivitySpecialty,
  useBatchUpdateActivityStatus,
  useReorderActivities,
  useReplicateActivities,
  useCreateActivityType,
  useCreateActivity,
  useDeleteActivity,
  useDeleteActivityType,
  useDeleteActivityReportPhoto,
  useExportActivityReportPdf,
  useCipavdLocalitiesCatalog,
  useLocalities,
  useMe,
  useSpecialties,
  useSignActivityReport,
  useMarkActivityCommentsSeen,
  useUpdateActivity,
  useUpdateActivityStatus,
  useUploadActivityReportPhoto,
  useUpsertActivityReport,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { can } from '../app/rbac';
import { toMilitaryDisplayName } from '../app/militaryName';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { ACTIVITY_STATUS_LABELS, ActivityStatus } from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';
import { ChecklistsPage } from './ChecklistsPage';

const blankReport: {
  date: string;
  location: string;
  responsible: string;
  activityAnalysis: string;
  activitiesPerformed: string;
  participantsCount: number;
  participantsMaleCount?: number;
  participantsFemaleCount?: number;
  instructorsCount: number;
  recruitsCount: number;
  eloPsychologyCount: number;
  eloSocialAssistanceCount: number;
  eloJuridicoCount: number;
  eloCpcaCount: number;
  eloGraduadoMasterCount: number;
  participantsCharacteristics: string;
  mainPointsObserved: string;
  attentionPoints: string;
  nextSteps: string;
  referencesAndAttachments: string;
  conclusion: string;
  city: string;
  closingDate: string;
} = {
  date: '',
  location: '',
  responsible: '',
  activityAnalysis: '',
  activitiesPerformed: '',
  participantsCount: 0,
  instructorsCount: 0,
  recruitsCount: 0,
  eloPsychologyCount: 0,
  eloSocialAssistanceCount: 0,
  eloJuridicoCount: 0,
  eloCpcaCount: 0,
  eloGraduadoMasterCount: 0,
  participantsCharacteristics: '',
  mainPointsObserved: '',
  attentionPoints: '',
  nextSteps: '',
  referencesAndAttachments: '',
  conclusion: '',
  city: '',
  closingDate: '',
};

const drawerActionButtonSx = {
  minHeight: 32,
  px: 1.5,
  whiteSpace: 'nowrap',
} as const;

type ActivityDrawerTab = 'activity' | 'report';
type ActivitySortColumn = 'type' | 'activity' | 'locality' | 'specialty' | 'eventDate' | 'status';
type ActivitySortDirection = 'asc' | 'desc';
type FormsReportRow = {
  id_sessao?: string | number | null;
  atividade?: string | number | null;
  data?: string | number | null;
  inicio?: string | number | null;
  fim?: string | number | null;
  tipo?: string | number | null;
  total_registros?: string | number | null;
  presentes_unicos?: string | number | null;
  feminino?: string | number | null;
  masculino?: string | number | null;
  nao_informado_outro?: string | number | null;
  postos_graduacoes_distintos?: string | number | null;
  oms_distintas?: string | number | null;
  observacao?: string | number | null;
};
type FormsReportOption = FormsReportRow & { key: string };
type FormsReportApiPayload = {
  ok?: boolean;
  message?: unknown;
  dados?: unknown;
};
const ACTIVITY_PAGE_SIZE = 15;
const ACTIVITY_PAGE_SIZE_OPTIONS = [15, 30, 50, 'all'] as const;
const FORMS_REPORT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwaBPrJOIUo71CYpZHzvQ7GGI3VbLK1IzP1mNBLMccTE-c-JM8L3qxTe7ofpErPhzi2/exec?token=agaghavshab23jjghab';

function normalizeSortText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function compareTextValues(first: unknown, second: unknown) {
  return normalizeSortText(first).localeCompare(normalizeSortText(second), 'pt-BR', {
    sensitivity: 'base',
  });
}

function toSortableDateValue(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function toIsoDateStartOfDay(value: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00.000Z`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function toNonNegativeInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function toOptionalNonNegativeInt(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.trunc(parsed));
}

function toFormsNonNegativeInt(value: unknown) {
  const raw = String(value ?? '').replace(/\./g, '').replace(',', '.').trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function toFormsText(value: unknown) {
  return String(value ?? '').trim();
}

function toFormsInputDate(value: unknown) {
  const raw = toFormsText(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const brazilianDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getFormsParticipantsCount(row: FormsReportRow) {
  const uniqueParticipants = toFormsNonNegativeInt(row.presentes_unicos);
  if (uniqueParticipants > 0) return uniqueParticipants;
  return toFormsNonNegativeInt(row.total_registros);
}

function getFormsTimeRange(row: FormsReportRow) {
  const start = toFormsText(row.inicio);
  const end = toFormsText(row.fim);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function getFormsReportOptionLabel(row: FormsReportRow) {
  const date = toFormsText(row.data) || 'Data não informada';
  const activity = toFormsText(row.atividade) || 'Atividade sem nome';
  const timeRange = getFormsTimeRange(row);
  return [date, activity, timeRange].filter(Boolean).join(' - ');
}

function buildFormsParticipantCharacteristics(row: FormsReportRow) {
  const parts = [
    `Dados importados do Forms: ${getFormsParticipantsCount(row)} participante(s) único(s)`,
    `${toFormsNonNegativeInt(row.total_registros)} registro(s)`,
    `${toFormsNonNegativeInt(row.feminino)} feminino`,
    `${toFormsNonNegativeInt(row.masculino)} masculino`,
    `${toFormsNonNegativeInt(row.nao_informado_outro)} não informado/outro`,
    `${toFormsNonNegativeInt(row.postos_graduacoes_distintos)} posto(s)/graduação(ões) distinto(s)`,
    `${toFormsNonNegativeInt(row.oms_distintas)} OM(s) distinta(s)`,
  ];
  const sessionId = toFormsText(row.id_sessao);
  const observation = toFormsText(row.observacao);
  if (sessionId) parts.push(`sessão ${sessionId}`);
  if (observation) parts.push(observation);
  return `${parts.join('; ')}.`;
}

function isFormsReportRecord(row: unknown): row is Record<string, unknown> {
  return Boolean(row && typeof row === 'object');
}

function getReportMissingFields(
  reportForm: typeof blankReport,
  reportRequired = false,
  optionalTextMode = false,
) {
  const missing: string[] = [];
  if (optionalTextMode) {
    if (reportRequired && toNonNegativeInt(reportForm.participantsCount) <= 0) {
      missing.push('Total de Participantes');
    }
    return missing;
  }
  if (!String(reportForm.date ?? '').trim()) missing.push('Data');
  if (!String(reportForm.closingDate ?? reportForm.date ?? '').trim()) {
    missing.push('Data de Fechamento');
  }
  if (!String(reportForm.location ?? '').trim()) missing.push('Local');
  if (!String(reportForm.responsible ?? '').trim()) missing.push('Responsável(is)');
  if (!String(reportForm.activityAnalysis ?? '').trim()) missing.push('Apoio à Missão');
  if (!String(reportForm.activitiesPerformed ?? '').trim()) missing.push('Desenvolvimento');
  if (!String(reportForm.participantsCharacteristics ?? '').trim()) {
    missing.push('Características dos Participantes');
  }
  if (!String(reportForm.conclusion ?? '').trim()) missing.push('Conclusão');
  if (!String(reportForm.city ?? '').trim()) missing.push('Cidade');
  return missing;
}

function buildIncompleteReportMessage(
  payload: { message?: string; details?: any },
  fallbackMissingFields: string[] = [],
) {
  const base = payload.message || 'Relatório incompleto para assinatura digital.';
  const rawMissing = Array.isArray(payload.details?.missingFields)
    ? payload.details.missingFields
    : [];
  const labels = [
    ...rawMissing
      .map((item: any) => String(item?.label ?? item?.field ?? '').trim())
      .filter(Boolean),
    ...fallbackMissingFields,
  ];
  const uniqueLabels = Array.from(new Set(labels.filter(Boolean)));
  if (!uniqueLabels.length) return base;
  return `${base} Faltando: ${uniqueLabels.join(', ')}.`;
}

function getActivityStatusChipStyle(status: string) {
  if (status === 'DONE') {
    return {
      bg: '#E8F5E9',
      color: '#2E7D32',
      borderColor: '#A5D6A7',
    };
  }
  if (status === 'IN_PROGRESS') {
    return {
      bg: '#ECEFF1',
      color: '#455A64',
      borderColor: '#CFD8DC',
    };
  }
  if (status === 'CANCELLED') {
    return {
      bg: '#FFEBEE',
      color: '#C62828',
      borderColor: '#FFCDD2',
    };
  }
  return {
    bg: '#E3F2FD',
    color: '#1565C0',
    borderColor: '#BBDEFB',
  };
}

const localityBadgePalette = [
  { bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7' },
  { bg: '#E3F2FD', color: '#0D47A1', border: '#90CAF9' },
  { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  { bg: '#F3E5F5', color: '#6A1B9A', border: '#CE93D8' },
  { bg: '#E0F2F1', color: '#004D40', border: '#80CBC4' },
  { bg: '#FCE4EC', color: '#880E4F', border: '#F48FB1' },
  { bg: '#EDE7F6', color: '#4527A0', border: '#B39DDB' },
  { bg: '#F1F8E9', color: '#33691E', border: '#C5E1A5' },
] as const;

function normalizeLocalityCode(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized) return normalized;
  return 'SEM';
}

function getLocalityShortLabel(item: any) {
  const code = normalizeLocalityCode(item?.locality?.code);
  if (code !== 'SEM') return code;
  const name = String(item?.locality?.name ?? '').trim();
  if (!name) return 'SEM';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('') || 'SEM';
}

function getLocalityChipStyle(localityLabel: string) {
  const normalized = String(localityLabel ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .trim()
    .toUpperCase();
  if (normalized === 'RJ' || normalized === 'RIO' || normalized.includes('RIODEJANEIRO')) {
    return { bg: '#E3F2FD', color: '#0D47A1', border: '#90CAF9' };
  }
  if (normalized === 'LS' || normalized.includes('LAGOASANTA')) {
    return { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' };
  }
  let hash = 0;
  for (let index = 0; index < localityLabel.length; index += 1) {
    hash = (hash * 31 + localityLabel.charCodeAt(index)) >>> 0;
  }
  return localityBadgePalette[hash % localityBadgePalette.length];
}

function mapActivitySpecialties(activity: any) {
  const linked = Array.isArray(activity?.specialties)
    ? activity.specialties
        .map((entry: any) => entry?.specialty ?? entry)
        .filter((entry: any) => String(entry?.id ?? '').trim())
        .map((entry: any) => ({
          id: String(entry.id),
          name: String(entry.name ?? '').trim() || 'Especialidade',
        }))
    : [];
  const fallbackId = String(activity?.specialty?.id ?? activity?.specialtyId ?? '').trim();
  const fallbackName = String(activity?.specialty?.name ?? '').trim();
  if (fallbackId && !linked.some((entry: any) => entry.id === fallbackId)) {
    linked.push({ id: fallbackId, name: fallbackName || 'Especialidade' });
  }
  return linked;
}

function getActivitySpecialtyLabel(activity: any) {
  const names = mapActivitySpecialties(activity)
    .map((item: any) => String(item.name ?? '').trim())
    .filter(Boolean);
  if (!names.length) return 'Comissão CIPAVD';
  return names.join(' / ');
}

function getActivityReportIndicator(activity: any) {
  const hasReport = Boolean(activity?.report);
  const isSigned = Boolean(activity?.report?.hasSignature);
  if (hasReport) {
    return {
      isFilled: true,
      color: isSigned || activity?.status === 'DONE' ? 'success' : 'primary',
      label: isSigned
        ? 'Relatório preenchido e assinado'
        : 'Relatório preenchido',
    } as const;
  }
  if (activity?.reportRequired) {
    return {
      isFilled: false,
      color: 'inherit',
      label: 'Relatório pendente',
    } as const;
  }
  return null;
}

type ActivitiesPageScope = 'smif' | 'cipavd';

export function ActivitiesPage({ scope = 'smif' }: { scope?: ActivitiesPageScope }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activityIdFromUrl = searchParams.get('activityId') ?? '';
  const localityIdFromUrl = searchParams.get('localityId') ?? '';
  const tabFromUrl = searchParams.get('tab') === 'report' ? 'report' : 'activity';
  const toast = useToast();
  const scopeApi = scope === 'cipavd' ? 'CIPAVD' : 'SMIF';
  const scopeSubtitle =
    scopeApi === 'CIPAVD'
      ? 'Atividades de campo vinculadas ao catálogo CIPAVD, com tipos, localidades e relatórios próprios.'
      : 'Atividades de campo do escopo SMIF, com localidades, especialidades e fluxo de relatório independentes do CIPAVD.';

  const [statusFilter, setStatusFilter] = useState('');
  const [localityFilter, setLocalityFilter] = useState(localityIdFromUrl);
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activityPageSizeMode, setActivityPageSizeMode] = useState<string>(
    String(ACTIVITY_PAGE_SIZE),
  );
  const showAllActivities = activityPageSizeMode === 'all';
  const activityPageSize = showAllActivities
    ? -1
    : Math.min(100, Math.max(10, Number(activityPageSizeMode) || ACTIVITY_PAGE_SIZE));

  const { data: localitiesData } = useLocalities(scope !== 'cipavd');
  const cipavdLocalitiesQuery = useCipavdLocalitiesCatalog(scope === 'cipavd');
  const localities = useMemo(() => {
    if (scope === 'cipavd') {
      return cipavdLocalitiesQuery.data?.items ?? [];
    }
    return localitiesData?.items ?? [];
  }, [cipavdLocalitiesQuery.data?.items, localitiesData?.items, scope]);
  const { data: specialtiesData } = useSpecialties();
  const specialties = specialtiesData?.items ?? [];
  const commissionSpecialty = useMemo(
    () => specialties.find((s: any) => s.name === 'Comissão CIPAVD'),
    [specialties],
  );
  const activityTypesQuery = useActivityTypes(scopeApi);
  const activityTypes = activityTypesQuery.data?.items ?? [];
  const responsibleUsersQuery = useActivityResponsibleUsers({});
  const allResponsibleUsers = responsibleUsersQuery.data?.items ?? [];

  const selectableLocalities = useMemo(() => {
    const normalized = (localities as any[])
      .filter(
        (locality: any) =>
          String(locality?.id ?? '').trim() &&
          String(locality?.name ?? '').trim(),
      )
      .sort((first: any, second: any) =>
        String(first?.name ?? '').localeCompare(String(second?.name ?? ''), 'pt-BR'),
      );

    if (scope === 'cipavd') {
      return normalized;
    }

    return selectTargetLocalities(normalized);
  }, [localities, scope]);

  const activitiesQuery = useActivities({
    status: statusFilter || undefined,
    localityId: localityFilter || undefined,
    specialtyId: specialtyFilter || undefined,
    scope: scopeApi,
    q: search || undefined,
    page: currentPage,
    pageSize: showAllActivities ? 'all' : String(activityPageSize),
  });

  const { data: me } = useMe();
  const [selectedId, setSelectedId] = useState<string | null>(activityIdFromUrl || null);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(activityIdFromUrl));
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [drawerTab, setDrawerTab] = useState<ActivityDrawerTab>(tabFromUrl);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [removeSignatureConfirmOpen, setRemoveSignatureConfirmOpen] = useState(false);
  const [sign2faDialogOpen, setSign2faDialogOpen] = useState(false);
  const [sign2faCode, setSign2faCode] = useState('');
  const [sign2faError, setSign2faError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [deleteActivityTypeConfirmOpen, setDeleteActivityTypeConfirmOpen] =
    useState(false);
  const [replicateDialogOpen, setReplicateDialogOpen] = useState(false);
  const [batchStatus, setBatchStatus] = useState('');
  const [batchSpecialtyIds, setBatchSpecialtyIds] = useState<string[]>([]);
  const [batchResponsibleUserId, setBatchResponsibleUserId] = useState('');
  const [replicateTargetLocalityIds, setReplicateTargetLocalityIds] = useState<string[]>([]);
  const [replicateStatusMode, setReplicateStatusMode] = useState<'RESET' | 'KEEP'>('RESET');
  const [replicateDateMode, setReplicateDateMode] = useState<'KEEP' | 'CLEAR' | 'SET_DATE'>('KEEP');
  const [replicateTargetDate, setReplicateTargetDate] = useState('');

  const createActivity = useCreateActivity();
  const createActivityType = useCreateActivityType();
  const deleteActivityType = useDeleteActivityType();
  const deleteActivity = useDeleteActivity();
  const updateActivity = useUpdateActivity();
  const updateActivityStatus = useUpdateActivityStatus();
  const batchDeleteActivities = useBatchDeleteActivities();
  const batchUpdateActivityStatus = useBatchUpdateActivityStatus();
  const batchUpdateActivitySpecialty = useBatchUpdateActivitySpecialty();
  const batchUpdateActivityResponsible = useBatchUpdateActivityResponsible();
  const reorderActivities = useReorderActivities();
  const replicateActivities = useReplicateActivities();
  const commentsQuery = useActivityComments(selectedId ?? '');
  const addComment = useAddActivityComment();
  const markCommentsSeen = useMarkActivityCommentsSeen();
  const upsertReport = useUpsertActivityReport();
  const signReport = useSignActivityReport();
  const uploadPhoto = useUploadActivityReportPhoto();
  const removePhoto = useDeleteActivityReportPhoto();
  const exportPdf = useExportActivityReportPdf();

  const items = activitiesQuery.data?.items ?? [];
  const totalActivities = Number(activitiesQuery.data?.total ?? 0);
  const totalPages = showAllActivities
    ? 1
    : Math.max(1, Math.ceil(totalActivities / activityPageSize));
  const pageStart = totalActivities === 0 ? 0 : showAllActivities ? 1 : (currentPage - 1) * activityPageSize + 1;
  const pageEnd = showAllActivities
    ? totalActivities
    : Math.min(currentPage * activityPageSize, totalActivities);
  const [orderedItems, setOrderedItems] = useState<any[]>([]);
  const [draggingActivityId, setDraggingActivityId] = useState('');
  const [sortState, setSortState] = useState<{
    column: ActivitySortColumn;
    direction: ActivitySortDirection;
  } | null>(null);
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedActivities = useMemo(
    () => items.filter((item: any) => selectedIdsSet.has(String(item.id))),
    [items, selectedIdsSet],
  );
  const selectedLocalityIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedActivities
            .map((item: any) => String(item.localityId ?? '').trim())
            .filter(Boolean),
        ),
      ),
    [selectedActivities],
  );
  const sourceLocalityIdsSet = useMemo(
    () => new Set(selectedLocalityIds),
    [selectedLocalityIds],
  );
  const replicateTargetLocalityOptions = useMemo(
    () =>
      selectableLocalities.filter(
        (locality: any) => !sourceLocalityIdsSet.has(String(locality.id)),
      ),
    [selectableLocalities, sourceLocalityIdsSet],
  );
  const replicateSelectedLocalities = useMemo(
    () =>
      replicateTargetLocalityOptions.filter((locality: any) =>
        replicateTargetLocalityIds.includes(String(locality.id)),
      ),
    [replicateTargetLocalityIds, replicateTargetLocalityOptions],
  );
  const baseItems = orderedItems.length ? orderedItems : items;
  const displayedItems = useMemo(() => {
    if (!sortState) return baseItems;
    const sorted = [...baseItems];
    sorted.sort((first: any, second: any) => {
      let result = 0;
      if (sortState.column === 'type') {
        result = compareTextValues(first?.activityType?.name ?? '', second?.activityType?.name ?? '');
      } else if (sortState.column === 'activity') {
        result = compareTextValues(first?.title ?? '', second?.title ?? '');
      } else if (sortState.column === 'locality') {
        result = compareTextValues(first?.locality?.name ?? '', second?.locality?.name ?? '');
      } else if (sortState.column === 'specialty') {
        result = compareTextValues(
          getActivitySpecialtyLabel(first),
          getActivitySpecialtyLabel(second),
        );
      } else if (sortState.column === 'status') {
        result = compareTextValues(
          ACTIVITY_STATUS_LABELS[first?.status] ?? first?.status ?? '',
          ACTIVITY_STATUS_LABELS[second?.status] ?? second?.status ?? '',
        );
      } else if (sortState.column === 'eventDate') {
        const firstDate = toSortableDateValue(first?.eventDate);
        const secondDate = toSortableDateValue(second?.eventDate);
        if (firstDate == null && secondDate == null) {
          result = 0;
        } else if (firstDate == null) {
          result = 1;
        } else if (secondDate == null) {
          result = -1;
        } else {
          result = firstDate - secondDate;
        }
      }
      if (result === 0) {
        return compareTextValues(first?.id ?? '', second?.id ?? '');
      }
      return sortState.direction === 'asc' ? result : -result;
    });
    return sorted;
  }, [baseItems, sortState]);
  const allVisibleSelected =
    displayedItems.length > 0 && selectedIds.length === displayedItems.length;

  const handleSortByColumn = (column: ActivitySortColumn) => {
    setSortState((previous) => {
      if (!previous || previous.column !== column) {
        return { column, direction: 'asc' };
      }
      return {
        column,
        direction: previous.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };
  const sortLabelSx = {
    color: 'white !important',
    '&.Mui-active': { color: 'white !important' },
    '& .MuiTableSortLabel-icon': { color: 'white !important' },
  };

  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  useEffect(() => {
    if (sortState) {
      setDraggingActivityId('');
    }
  }, [sortState]);

  const selectedFromList = useMemo(
    () => items.find((i: any) => i.id === selectedId) ?? null,
    [items, selectedId],
  );
  const selectedByIdQuery = useActivity(
    selectedId ?? '',
    Boolean(selectedId) && drawerOpen && !selectedFromList,
  );
  const selected = (selectedFromList ?? selectedByIdQuery.data ?? null) as any;
  const selectedByIdLoading =
    Boolean(selectedId) &&
    drawerOpen &&
    !selectedFromList &&
    selectedByIdQuery.isLoading;

  useEffect(() => {
    if (!selectedId) return;
    setCommentText('');
    void markCommentsSeen.mutateAsync(selectedId).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !drawerOpen || isCreateMode) return;
    if (!selectedByIdQuery.isError) return;
    const payload = parseApiError(selectedByIdQuery.error);
    toast.push({
      message:
        payload.message ??
        'Não foi possível abrir os detalhes da atividade pelo link informado.',
      severity: 'warning',
    });
    setSelectedId(null);
    setDrawerOpen(false);
  }, [
    selectedId,
    drawerOpen,
    isCreateMode,
    selectedByIdQuery.isError,
    selectedByIdQuery.error,
    toast,
  ]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => items.some((item: any) => String(item.id) === String(id))),
    );
  }, [items]);

  useEffect(() => {
    const allowedIds = new Set(
      replicateTargetLocalityOptions.map((locality: any) => String(locality.id)),
    );
    setReplicateTargetLocalityIds((prev) =>
      prev.filter((id) => allowedIds.has(String(id))),
    );
  }, [replicateTargetLocalityOptions]);

  useEffect(() => {
    if (localityIdFromUrl && localityIdFromUrl !== localityFilter) {
      setLocalityFilter(localityIdFromUrl);
    }
  }, [localityFilter, localityIdFromUrl]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, localityFilter, specialtyFilter, search, scopeApi, activityPageSizeMode]);

  useEffect(() => {
    if (currentPage <= totalPages) return;
    setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!localityFilter) return;
    const exists = selectableLocalities.some((locality: any) => locality.id === localityFilter);
    if (!exists) {
      setLocalityFilter('');
    }
  }, [localityFilter, selectableLocalities]);

  useEffect(() => {
    if (!activityIdFromUrl) return;
    setSelectedId((prev) =>
      prev === activityIdFromUrl ? prev : activityIdFromUrl,
    );
    setDrawerOpen(true);
    setIsCreateMode(false);
    if (tabFromUrl === 'report') {
      setDrawerTab('report');
    }
  }, [activityIdFromUrl, tabFromUrl]);

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    localityId: '',
    localityIds: [] as string[],
    activityTypeId: '',
    specialtyIds: [] as string[],
    responsibleUserId: '',
    eventDate: '',
    reportRequired: false,
  });
  const selectedActivityType = useMemo(
    () =>
      activityTypes.find(
        (item: any) =>
          String(item?.id ?? '') === String(activityForm.activityTypeId ?? ''),
      ) ?? null,
    [activityForm.activityTypeId, activityTypes],
  );

  useEffect(() => {
    if (!selected) return;
    setActivityForm({
      title: selected.title ?? '',
      description: selected.description ?? '',
      localityId: selected.localityId ?? '',
      localityIds: selected.localityId ? [selected.localityId] : [],
      activityTypeId: selected.activityType?.id ?? '',
      specialtyIds: mapActivitySpecialties(selected).map((item: any) => item.id),
      responsibleUserId: selected.responsibleUsers?.[0]?.id ?? '',
      eventDate: selected.eventDate ? String(selected.eventDate).slice(0, 10) : '',
      reportRequired: Boolean(selected.reportRequired),
    });
  }, [selected]);

  const [reportForm, setReportForm] = useState(blankReport);
  const [formsImportDialogOpen, setFormsImportDialogOpen] = useState(false);
  const [formsImportRows, setFormsImportRows] = useState<FormsReportOption[]>([]);
  const [selectedFormsReportKey, setSelectedFormsReportKey] = useState('');
  const [formsImportLoading, setFormsImportLoading] = useState(false);
  const [formsImportError, setFormsImportError] = useState('');

  useEffect(() => {
    if (!selected?.report) {
      setReportForm(blankReport);
      return;
    }
    setReportForm({
      date: selected.report.date ? String(selected.report.date).slice(0, 10) : '',
      location: selected.report.location ?? '',
      responsible: selected.report.responsible ?? '',
      activityAnalysis: selected.report.activityAnalysis ?? selected.report.missionSupport ?? '',
      activitiesPerformed: selected.report.activitiesPerformed ?? '',
      participantsCount: Number(selected.report.participantsCount ?? 0),
      participantsMaleCount: selected.report.participantsMaleCount != null ? Number(selected.report.participantsMaleCount) : undefined,
      participantsFemaleCount: selected.report.participantsFemaleCount != null ? Number(selected.report.participantsFemaleCount) : undefined,
      instructorsCount: Number(selected.report.instructorsCount ?? 0),
      recruitsCount: Number(selected.report.recruitsCount ?? 0),
      eloPsychologyCount: Number(selected.report.eloPsychologyCount ?? 0),
      eloSocialAssistanceCount: Number(selected.report.eloSocialAssistanceCount ?? 0),
      eloJuridicoCount: Number(selected.report.eloJuridicoCount ?? 0),
      eloCpcaCount: Number(selected.report.eloCpcaCount ?? 0),
      eloGraduadoMasterCount: Number(selected.report.eloGraduadoMasterCount ?? 0),
      participantsCharacteristics: selected.report.participantsCharacteristics ?? '',
      mainPointsObserved: selected.report.mainPointsObserved ?? '',
      attentionPoints: selected.report.attentionPoints ?? '',
      nextSteps: selected.report.nextSteps ?? '',
      referencesAndAttachments: selected.report.referencesAndAttachments ?? '',
      conclusion: selected.report.conclusion ?? '',
      city: selected.report.city ?? '',
      closingDate: selected.report.closingDate ? String(selected.report.closingDate).slice(0, 10) : '',
    });
  }, [selected]);

  const canView = !me ? true : can(me, 'task_instances', 'view');
  const canCreate = can(me, 'task_instances', 'create');
  const canUpdate = can(me, 'task_instances', 'update');
  const canDelete = can(me, 'task_instances', 'delete');
  const canEditReport = can(me, 'reports', 'create');
  const canSign = can(me, 'reports', 'approve');
  const canUpload = can(me, 'reports', 'upload');
  const canDownload = can(me, 'reports', 'download');
  const reportIsSigned = Boolean(selected?.report?.hasSignature);
  const isReportSigner = Boolean(
    selected?.report?.signedById &&
      me?.id &&
      String(selected.report.signedById) === String(me.id),
  );
  const canDeleteSignature =
    reportIsSigned && (can(me, 'reports', 'update') || isReportSigner);
  const canEditReportContent = canEditReport && !reportIsSigned;
  const canUploadReportPhotos = canUpload && !reportIsSigned;
  const reportOptionalTextMode = scope === 'cipavd';
  const reportPublicParticipantRequired = Boolean(selected?.reportRequired);
  const canEditActivityForm = isCreateMode ? canCreate : canUpdate;
  const canManageBatch = can(me, 'task_instances', 'update');
  const canBatchAssignResponsible = selectedLocalityIds.length <= 1;
  const canCreateAssignResponsible = !isCreateMode || activityForm.localityIds.length <= 1;
  const selectedFormsReport = useMemo(
    () => formsImportRows.find((row) => row.key === selectedFormsReportKey) ?? null,
    [formsImportRows, selectedFormsReportKey],
  );
  const createSelectedLocalities = useMemo(
    () =>
      selectableLocalities.filter((locality: any) =>
        activityForm.localityIds.includes(String(locality.id)),
      ),
    [activityForm.localityIds, selectableLocalities],
  );

  useEffect(() => {
    if (!isCreateMode) return;
    if (activityForm.localityIds.length <= 1) return;
    if (!activityForm.responsibleUserId) return;
    setActivityForm((prev) => ({ ...prev, responsibleUserId: '' }));
  }, [isCreateMode, activityForm.localityIds, activityForm.responsibleUserId]);

  const responsibleOptions = useMemo(() => {
    const filtered = allResponsibleUsers.filter((user: any) => {
      if (!String(user?.id ?? '').trim() || !String(user?.name ?? '').trim()) return false;
      return true;
    });

    const selectedResponsible = selected?.responsibleUsers?.[0];
    if (
      selectedResponsible?.id &&
      selectedResponsible?.name &&
      !filtered.some((user: any) => user.id === selectedResponsible.id)
    ) {
      filtered.push({ id: selectedResponsible.id, name: selectedResponsible.name });
    }

    return filtered.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [allResponsibleUsers, selected?.responsibleUsers]);

  const batchResponsibleOptions = useMemo(() => {
    const filtered = allResponsibleUsers.filter((user: any) => {
      if (!String(user?.id ?? '').trim() || !String(user?.name ?? '').trim()) return false;
      return true;
    });
    return filtered.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [allResponsibleUsers]);
  const specialtyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const specialty of specialties as any[]) {
      const id = String(specialty?.id ?? '').trim();
      const name = String(specialty?.name ?? '').trim();
      if (!id) continue;
      map.set(id, name || 'Especialidade');
    }
    return map;
  }, [specialties]);

  const handleCreate = async () => {
    if (!activityForm.title.trim()) {
      toast.push({ message: 'Informe o título da atividade', severity: 'warning' });
      return;
    }
    if (activityForm.localityIds.length === 0) {
      toast.push({ message: 'Selecione pelo menos uma localidade', severity: 'warning' });
      return;
    }
    if (activityForm.localityIds.length > 1 && activityForm.responsibleUserId) {
      toast.push({
        message: 'Para múltiplas localidades, crie sem responsável e ajuste depois em cada atividade.',
        severity: 'warning',
      });
      return;
    }
    try {
      const created = await createActivity.mutateAsync({
        title: activityForm.title,
        description: activityForm.description || null,
        localityId: activityForm.localityId || null,
        localityIds: activityForm.localityIds,
        activityTypeId: activityForm.activityTypeId || null,
        specialtyIds: activityForm.specialtyIds,
        specialtyId: activityForm.specialtyIds[0] || null,
        responsibleUserIds: activityForm.responsibleUserId ? [activityForm.responsibleUserId] : [],
        eventDate: activityForm.eventDate || null,
        reportRequired: activityForm.reportRequired,
        scope: scopeApi,
      });
      const firstId = String(created?.id ?? '');
      if (firstId) setSelectedId(firstId);
      setIsCreateMode(false);
      setDrawerOpen(true);
      const createdCount = Number(created?.createdCount ?? 1);
      toast.push({
        message:
          createdCount > 1
            ? `${createdCount} atividades criadas para as localidades selecionadas`
            : 'Atividade criada',
        severity: 'success',
      });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao criar atividade', severity: 'error' });
    }
  };

  const handleSaveActivity = async () => {
    if (!selected || !canUpdate) return;
    try {
      await updateActivity.mutateAsync({
        id: selected.id,
        payload: {
          title: activityForm.title,
          description: activityForm.description || null,
          localityId: activityForm.localityId || null,
          activityTypeId: activityForm.activityTypeId || null,
          specialtyIds: activityForm.specialtyIds,
          specialtyId: activityForm.specialtyIds[0] || null,
          responsibleUserIds: activityForm.responsibleUserId ? [activityForm.responsibleUserId] : [],
          eventDate: activityForm.eventDate || null,
          reportRequired: activityForm.reportRequired,
        },
      });
      toast.push({ message: 'Atividade atualizada', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao atualizar atividade', severity: 'error' });
    }
  };

  const handleDeleteSelectedActivityType = async () => {
    if (!selectedActivityType) return;
    try {
      await deleteActivityType.mutateAsync({
        id: String(selectedActivityType.id),
        scope: scopeApi,
      });
      setActivityForm((prev) => ({ ...prev, activityTypeId: '' }));
      setDeleteActivityTypeConfirmOpen(false);
      toast.push({ message: 'Tipo excluído com sucesso', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao excluir tipo',
        severity: 'error',
      });
    }
  };

  const handleDeleteActivity = async () => {
    if (!selected || !canDelete) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteActivity = async () => {
    if (!selected || !canDelete) return;
    try {
      await deleteActivity.mutateAsync(selected.id);
      toast.push({ message: 'Atividade excluída', severity: 'success' });
      setDeleteConfirmOpen(false);
      setSelectedId(null);
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir atividade', severity: 'error' });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selected || !canUpdate) return;
    try {
      await updateActivityStatus.mutateAsync({ id: selected.id, status });
      toast.push({ message: 'Status atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar status', severity: 'error' });
    }
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(displayedItems.map((item: any) => String(item.id)));
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((entry) => entry !== id);
      return [...prev, id];
    });
  };

  const handleDropReorder = async (targetId: string) => {
    if (!canUpdate) return;
    if (sortState) return;
    if (!draggingActivityId || draggingActivityId === targetId) return;

    const fromIndex = displayedItems.findIndex(
      (item: any) => String(item.id) === draggingActivityId,
    );
    const toIndex = displayedItems.findIndex(
      (item: any) => String(item.id) === targetId,
    );
    if (fromIndex < 0 || toIndex < 0) return;

    const previous = displayedItems;
    const next = [...displayedItems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedItems(next);
    setDraggingActivityId('');

    try {
      await reorderActivities.mutateAsync(
        next.map((item: any) => String(item.id)),
      );
      toast.push({ message: 'Ordem das atividades atualizada.', severity: 'success' });
    } catch (error) {
      setOrderedItems(previous);
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao reordenar atividades.',
        severity: 'error',
      });
    }
  };

  const handleBatchStatusApply = async () => {
    if (!canManageBatch || !selectedIds.length || !batchStatus) return;
    const count = selectedIds.length;
    try {
      await batchUpdateActivityStatus.mutateAsync({ ids: selectedIds, status: batchStatus });
      toast.push({ message: `${count} atividade(s) atualizada(s) com novo status.`, severity: 'success' });
      setBatchStatus('');
      setSelectedIds([]);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar status em lote.', severity: 'error' });
    }
  };

  const handleBatchSpecialtyApply = async () => {
    if (!canManageBatch || !selectedIds.length) return;
    const count = selectedIds.length;
    try {
      await batchUpdateActivitySpecialty.mutateAsync({
        ids: selectedIds,
        specialtyIds: batchSpecialtyIds,
        specialtyId: batchSpecialtyIds[0] || null,
      });
      toast.push({ message: `${count} atividade(s) atualizada(s) com novas especialidades.`, severity: 'success' });
      setBatchSpecialtyIds([]);
      setSelectedIds([]);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar especialidade em lote.', severity: 'error' });
    }
  };

  const handleBatchResponsibleApply = async () => {
    if (!canManageBatch || !selectedIds.length || !canBatchAssignResponsible) return;
    const count = selectedIds.length;
    try {
      await batchUpdateActivityResponsible.mutateAsync({
        ids: selectedIds,
        responsibleUserId: batchResponsibleUserId || null,
      });
      toast.push({ message: `${count} atividade(s) atualizada(s) com novo responsável.`, severity: 'success' });
      setBatchResponsibleUserId('');
      setSelectedIds([]);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar responsável em lote.', severity: 'error' });
    }
  };

  const handleBatchDeleteConfirm = async () => {
    if (!canManageBatch || !selectedIds.length) return;
    const count = selectedIds.length;
    try {
      await batchDeleteActivities.mutateAsync({ ids: selectedIds });
      toast.push({ message: `${count} atividade(s) excluída(s).`, severity: 'success' });
      setBatchDeleteConfirmOpen(false);
      setSelectedIds([]);
      if (selectedId && selectedIdsSet.has(selectedId)) {
        setSelectedId(null);
        setDrawerOpen(false);
      }
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao excluir atividades selecionadas.', severity: 'error' });
    }
  };

  const openReplicateDialog = () => {
    if (!selectedIds.length) return;
    setReplicateTargetLocalityIds([]);
    setReplicateStatusMode('RESET');
    setReplicateDateMode('KEEP');
    setReplicateTargetDate('');
    setReplicateDialogOpen(true);
  };

  const handleReplicateConfirm = async () => {
    if (!selectedIds.length) return;
    if (!replicateTargetLocalityIds.length) {
      toast.push({
        message: 'Selecione ao menos uma localidade de destino.',
        severity: 'warning',
      });
      return;
    }
    if (replicateDateMode === 'SET_DATE' && !replicateTargetDate) {
      toast.push({
        message: 'Selecione a data que será aplicada às cópias.',
        severity: 'warning',
      });
      return;
    }
    try {
      const payload = await replicateActivities.mutateAsync({
        ids: selectedIds,
        targetLocalityIds: replicateTargetLocalityIds,
        statusMode: replicateStatusMode,
        dateMode: replicateDateMode,
        targetDate:
          replicateDateMode === 'SET_DATE' ? replicateTargetDate || null : null,
      });
      const created = Number(payload?.created ?? 0);
      const skipped = Number(payload?.skippedSameLocality ?? 0);
      toast.push({
        message:
          skipped > 0
            ? `${created} atividade(s) replicada(s). ${skipped} combinação(ões) ignorada(s) por localidade de origem igual ao destino.`
            : `${created} atividade(s) replicada(s) com sucesso.`,
        severity: 'success',
      });
      setReplicateDialogOpen(false);
      setSelectedIds([]);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao replicar atividades.',
        severity: 'error',
      });
    }
  };

  const loadFormsImportRows = async () => {
    setFormsImportLoading(true);
    setFormsImportError('');
    try {
      const response = await fetch(FORMS_REPORT_ENDPOINT, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Não foi possível consultar o Forms (${response.status}).`);
      }
      const payload = (await response.json()) as FormsReportApiPayload;
      if (payload?.ok === false) {
        throw new Error(String(payload?.message ?? 'O Forms retornou uma resposta inválida.'));
      }
      const rows = Array.isArray(payload?.dados) ? payload.dados : [];
      const options = rows
        .filter(isFormsReportRecord)
        .map((row, index) => ({
          ...row,
          key: `${toFormsText(row.id_sessao) || 'sessao'}-${index}`,
        })) as FormsReportOption[];
      setFormsImportRows(options);
      setSelectedFormsReportKey('');
      if (!options.length) {
        setFormsImportError('Nenhuma atividade foi retornada pelo Forms.');
      }
    } catch (error) {
      setFormsImportRows([]);
      setSelectedFormsReportKey('');
      setFormsImportError(
        error instanceof Error ? error.message : 'Erro ao importar dados do Forms.',
      );
    } finally {
      setFormsImportLoading(false);
    }
  };

  const handleOpenFormsImportDialog = () => {
    if (!canEditReportContent) {
      toast.push({
        message: reportIsSigned
          ? 'Relatório assinado não pode ser alterado. Remova a assinatura para editar.'
          : 'Você não tem permissão para editar este relatório.',
        severity: 'warning',
      });
      return;
    }
    setFormsImportDialogOpen(true);
    setFormsImportRows([]);
    setSelectedFormsReportKey('');
    setFormsImportError('');
    void loadFormsImportRows();
  };

  const handleConfirmFormsImport = () => {
    if (!selectedFormsReport || !canEditReportContent) return;
    const importedCharacteristics = buildFormsParticipantCharacteristics(selectedFormsReport);
    const sourceDate = toFormsInputDate(selectedFormsReport.data);

    setReportForm((current) => {
      const currentCharacteristics = String(current.participantsCharacteristics ?? '').trim();
      const participantsCharacteristics =
        currentCharacteristics && !currentCharacteristics.startsWith('Dados importados do Forms:')
          ? `${currentCharacteristics}\n\n${importedCharacteristics}`
          : importedCharacteristics;

      return {
        ...current,
        date: current.date || sourceDate,
        closingDate: current.closingDate || sourceDate,
        participantsCount: getFormsParticipantsCount(selectedFormsReport),
        participantsMaleCount: toFormsNonNegativeInt(selectedFormsReport.masculino),
        participantsFemaleCount: toFormsNonNegativeInt(selectedFormsReport.feminino),
        participantsCharacteristics,
      };
    });
    setFormsImportDialogOpen(false);
    toast.push({ message: 'Dados do Forms aplicados ao relatório.', severity: 'success' });
  };

  const handleSaveReport = async () => {
    if (!selected || !canEditReport) return;
    if (reportIsSigned) {
      toast.push({
        message: 'Relatório assinado não pode ser alterado. Remova a assinatura para editar.',
        severity: 'warning',
      });
      return;
    }
    const missingFields = reportOptionalTextMode
      ? getReportMissingFields(
          reportForm,
          reportPublicParticipantRequired,
          reportOptionalTextMode,
        )
      : [];
    if (missingFields.length > 0) {
      toast.push({
        message: `Preencha os campos obrigatórios antes de salvar: ${missingFields.join(', ')}.`,
        severity: 'warning',
      });
      return;
    }
    const fallbackDateInput =
      reportForm.date ||
      (selected.eventDate ? String(selected.eventDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const reportDateIso = toIsoDateStartOfDay(fallbackDateInput);
    const closingDateInput = reportForm.closingDate || reportForm.date || fallbackDateInput;
    const closingDateIso = toIsoDateStartOfDay(closingDateInput);
    if (!reportDateIso || !closingDateIso) {
      toast.push({
        message: 'Preencha uma data válida para Data e Data de Fechamento.',
        severity: 'warning',
      });
      return;
    }
    const participantsMaleCount = toOptionalNonNegativeInt(reportForm.participantsMaleCount);
    const participantsFemaleCount = toOptionalNonNegativeInt(reportForm.participantsFemaleCount);
    try {
      await upsertReport.mutateAsync({
        id: selected.id,
        payload: {
          date: reportDateIso,
          location: String(reportForm.location ?? ''),
          responsible: String(reportForm.responsible ?? ''),
          activityAnalysis: String(reportForm.activityAnalysis ?? ''),
          activitiesPerformed: String(reportForm.activitiesPerformed ?? ''),
          participantsCount: toNonNegativeInt(reportForm.participantsCount),
          participantsMaleCount,
          participantsFemaleCount,
          instructorsCount: toNonNegativeInt(reportForm.instructorsCount),
          recruitsCount: toNonNegativeInt(reportForm.recruitsCount),
          eloPsychologyCount: toNonNegativeInt(reportForm.eloPsychologyCount),
          eloSocialAssistanceCount: toNonNegativeInt(reportForm.eloSocialAssistanceCount),
          eloJuridicoCount: toNonNegativeInt(reportForm.eloJuridicoCount),
          eloCpcaCount: toNonNegativeInt(reportForm.eloCpcaCount),
          eloGraduadoMasterCount: toNonNegativeInt(reportForm.eloGraduadoMasterCount),
          participantsCharacteristics: String(reportForm.participantsCharacteristics ?? ''),
          mainPointsObserved: String(reportForm.mainPointsObserved ?? ''),
          attentionPoints: String(reportForm.attentionPoints ?? ''),
          nextSteps: String(reportForm.nextSteps ?? ''),
          referencesAndAttachments: String(reportForm.referencesAndAttachments ?? ''),
          conclusion: String(reportForm.conclusion ?? ''),
          city: String(reportForm.city ?? ''),
          closingDate: closingDateIso,
        },
      });
      toast.push({ message: 'Relatório salvo', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar relatório', severity: 'error' });
    }
  };

  const handleSignClick = () => {
    if (!selected || !canSign) return;
    if (reportIsSigned) {
      toast.push({
        message: 'Este relatório já está assinado. Remova a assinatura para alterar e assinar novamente.',
        severity: 'warning',
      });
      return;
    }
    const missingFields = getReportMissingFields(
      reportForm,
      reportPublicParticipantRequired,
      reportOptionalTextMode,
    );
    if (missingFields.length > 0) {
      toast.push({
        message: `Preencha os campos obrigatórios antes de assinar: ${missingFields.join(', ')}.`,
        severity: 'warning',
      });
      return;
    }
    const fallbackDateInput =
      reportForm.date ||
      (selected.eventDate ? String(selected.eventDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const reportDateIso = toIsoDateStartOfDay(fallbackDateInput);
    const closingDateInput = reportForm.closingDate || reportForm.date || fallbackDateInput;
    const closingDateIso = toIsoDateStartOfDay(closingDateInput);
    if (!reportDateIso || !closingDateIso) {
      toast.push({
        message: 'Preencha uma data válida para Data e Data de Fechamento.',
        severity: 'warning',
      });
      return;
    }
    setSign2faCode('');
    setSign2faError('');
    setSign2faDialogOpen(true);
  };

  const handleSignConfirm = async () => {
    if (!selected || !canSign) return;
    const code = sign2faCode.replace(/\s/g, '').trim();
    if (code.length < 6) {
      setSign2faError('Informe o código de 6 dígitos do Google Authenticator.');
      return;
    }
    const fallbackDateInput =
      reportForm.date ||
      (selected.eventDate ? String(selected.eventDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const reportDateIso = toIsoDateStartOfDay(fallbackDateInput);
    const closingDateInput = reportForm.closingDate || reportForm.date || fallbackDateInput;
    const closingDateIso = toIsoDateStartOfDay(closingDateInput);
    if (!reportDateIso || !closingDateIso) return;
    const participantsMaleCount = toOptionalNonNegativeInt(reportForm.participantsMaleCount);
    const participantsFemaleCount = toOptionalNonNegativeInt(reportForm.participantsFemaleCount);
    try {
      if (canEditReport) {
        await upsertReport.mutateAsync({
          id: selected.id,
          payload: {
            date: reportDateIso,
            location: String(reportForm.location ?? ''),
            responsible: String(reportForm.responsible ?? ''),
            activityAnalysis: String(reportForm.activityAnalysis ?? ''),
            activitiesPerformed: String(reportForm.activitiesPerformed ?? ''),
            participantsCount: toNonNegativeInt(reportForm.participantsCount),
            participantsMaleCount,
            participantsFemaleCount,
            instructorsCount: toNonNegativeInt(reportForm.instructorsCount),
            recruitsCount: toNonNegativeInt(reportForm.recruitsCount),
            eloPsychologyCount: toNonNegativeInt(reportForm.eloPsychologyCount),
            eloSocialAssistanceCount: toNonNegativeInt(reportForm.eloSocialAssistanceCount),
            eloJuridicoCount: toNonNegativeInt(reportForm.eloJuridicoCount),
            eloCpcaCount: toNonNegativeInt(reportForm.eloCpcaCount),
            eloGraduadoMasterCount: toNonNegativeInt(reportForm.eloGraduadoMasterCount),
            participantsCharacteristics: String(reportForm.participantsCharacteristics ?? ''),
            mainPointsObserved: String(reportForm.mainPointsObserved ?? ''),
            attentionPoints: String(reportForm.attentionPoints ?? ''),
            nextSteps: String(reportForm.nextSteps ?? ''),
            referencesAndAttachments: String(reportForm.referencesAndAttachments ?? ''),
            conclusion: String(reportForm.conclusion ?? ''),
            city: String(reportForm.city ?? ''),
            closingDate: closingDateIso,
          },
        });
      }
      await signReport.mutateAsync({ id: selected.id, totpCode: code });
      setSign2faDialogOpen(false);
      setSign2faCode('');
      setSign2faError('');
      toast.push({ message: 'Relatório assinado digitalmente', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      if (payload.code === 'AUTH_2FA_INVALID_CODE') {
        setSign2faError('Código inválido. Verifique o Google Authenticator e tente novamente.');
        return;
      }
      if (payload.code === 'ACTIVITY_REPORT_SIGNED_LOCKED') {
        setSign2faDialogOpen(false);
        toast.push({
          message:
            payload.message ??
            'Relatório assinado não pode ser alterado. Remova a assinatura para editar.',
          severity: 'warning',
        });
        return;
      }
      if (
        payload.code === 'ACTIVITY_REPORT_INCOMPLETE' ||
        (payload.code === 'VALIDATION_ERROR' &&
          payload.details?.reason === 'ACTIVITY_REPORT_INCOMPLETE')
      ) {
        setSign2faDialogOpen(false);
        toast.push({
          message: buildIncompleteReportMessage(
            payload,
            getReportMissingFields(
              reportForm,
              reportPublicParticipantRequired,
              reportOptionalTextMode,
            ),
          ),
          severity: 'warning',
        });
        return;
      }
      setSign2faError(payload.message ?? 'Erro ao assinar');
    }
  };

  const handleRemoveSignature = async () => {
    if (!selected) return;
    if (!canDeleteSignature) {
      toast.push({ message: 'Você não tem permissão para remover esta assinatura.', severity: 'error' });
      return;
    }
    if (!reportIsSigned) {
      toast.push({ message: 'Este relatório não possui assinatura ativa.', severity: 'warning' });
      setRemoveSignatureConfirmOpen(false);
      return;
    }

    const source = selected.report;
    const reportDateIso = toIsoDateStartOfDay(
      source?.date ? String(source.date).slice(0, 10) : '',
    );
    const closingDateInput = source?.closingDate
      ? String(source.closingDate).slice(0, 10)
      : source?.date
        ? String(source.date).slice(0, 10)
        : '';
    const closingDateIso = toIsoDateStartOfDay(closingDateInput);
    if (!reportDateIso || !closingDateIso) {
      toast.push({
        message: 'Não foi possível remover a assinatura: datas do relatório estão inválidas.',
        severity: 'error',
      });
      return;
    }

    try {
      await upsertReport.mutateAsync({
        id: selected.id,
        payload: {
          date: reportDateIso,
          location: String(source.location ?? ''),
          responsible: String(source.responsible ?? ''),
          activityAnalysis: String(source.activityAnalysis ?? source.missionSupport ?? ''),
          activitiesPerformed: String(source.activitiesPerformed ?? ''),
          participantsCount: toNonNegativeInt(source.participantsCount),
          participantsMaleCount: toOptionalNonNegativeInt(source.participantsMaleCount),
          participantsFemaleCount: toOptionalNonNegativeInt(source.participantsFemaleCount),
          instructorsCount: toNonNegativeInt(source.instructorsCount),
          recruitsCount: toNonNegativeInt(source.recruitsCount),
          eloPsychologyCount: toNonNegativeInt(source.eloPsychologyCount),
          eloSocialAssistanceCount: toNonNegativeInt(source.eloSocialAssistanceCount),
          eloJuridicoCount: toNonNegativeInt(source.eloJuridicoCount),
          eloCpcaCount: toNonNegativeInt(source.eloCpcaCount),
          eloGraduadoMasterCount: toNonNegativeInt(source.eloGraduadoMasterCount),
          participantsCharacteristics: String(source.participantsCharacteristics ?? ''),
          mainPointsObserved: String(source.mainPointsObserved ?? ''),
          attentionPoints: String(source.attentionPoints ?? ''),
          nextSteps: String(source.nextSteps ?? ''),
          referencesAndAttachments: String(source.referencesAndAttachments ?? ''),
          conclusion: String(source.conclusion ?? ''),
          city: String(source.city ?? ''),
          closingDate: closingDateIso,
        },
      });
      toast.push({ message: 'Assinatura removida com sucesso.', severity: 'success' });
      setRemoveSignatureConfirmOpen(false);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao remover assinatura do relatório',
        severity: 'error',
      });
    }
  };

  const handleExportPdf = async () => {
    if (!selected || !canDownload) return;
    try {
      await exportPdf.mutateAsync(selected.id);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao exportar PDF', severity: 'error' });
    }
  };

  const handleAddComment = async () => {
    if (!selected || !canUpdate) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ id: selected.id, text });
      setCommentText('');
      toast.push({ message: 'Comentário registrado', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao comentar', severity: 'error' });
    }
  };

  const syncUrlState = (activityId?: string, tab: ActivityDrawerTab = 'activity') => {
    const next = new URLSearchParams(searchParams);
    if (localityFilter) next.set('localityId', localityFilter);
    else next.delete('localityId');

    if (activityId) {
      next.set('activityId', activityId);
      if (tab === 'report') next.set('tab', tab);
      else next.delete('tab');
    } else {
      next.delete('activityId');
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  const openActivityDrawer = (activityId: string, tab: ActivityDrawerTab = 'activity') => {
    setSelectedId(activityId);
    setIsCreateMode(false);
    setDrawerTab(tab);
    setDrawerOpen(true);
    syncUrlState(activityId, tab);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setRemoveSignatureConfirmOpen(false);
    syncUrlState(undefined);
  };

  if (!canView) {
    return <ErrorState error={{ message: 'Acesso negado' }} />;
  }

  if (activitiesQuery.isLoading) return <SkeletonState />;
  if (activitiesQuery.isError) {
    return <ErrorState error={activitiesQuery.error} onRetry={() => activitiesQuery.refetch()} />;
  }

  const openCreateDrawer = () => {
    setIsCreateMode(true);
    setSelectedId(null);
    setDrawerTab('activity');
    setCommentText('');
    setActivityForm({
      title: '',
      description: '',
      localityId: '',
      localityIds: [],
      activityTypeId: '',
      specialtyIds: [],
      responsibleUserId: '',
      eventDate: '',
      reportRequired: false,
    });
    setReportForm(blankReport);
    setDrawerOpen(true);
    syncUrlState(undefined);
  };

  return (
    <Box>
      {scope === 'smif' && (
        <Box mb={2}>
          <ChecklistsPage />
        </Box>
      )}

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
        spacing={1.25}
        mb={2}
      >
        <Box>
          <Typography variant="h4">Atividades de Campo</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {scopeSubtitle}
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreateDrawer} disabled={!canCreate}>
          Nova atividade
        </Button>
      </Stack>

      <Tabs
        value={scope}
        onChange={(_event, value: ActivitiesPageScope) => {
          navigate(value === 'cipavd' ? '/cipavd-activities' : '/activities');
        }}
        sx={{ mb: 2 }}
      >
        <Tab value="smif" label="SMIF" />
        <Tab value="cipavd" label="CIPAVD" />
      </Tabs>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 220 }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todos</MenuItem>
              {ActivityStatus.map((status) => (
                <MenuItem key={status} value={status}>
                  {ACTIVITY_STATUS_LABELS[status] ?? status}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityFilter}
              onChange={(e) => {
                const value = e.target.value;
                setLocalityFilter(value);
                const next = new URLSearchParams(searchParams);
                if (value) next.set('localityId', value);
                else next.delete('localityId');
                setSearchParams(next, { replace: true });
              }}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {selectableLocalities.map((l: any) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Especialidade"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {commissionSpecialty && (
                <MenuItem value={commissionSpecialty.id}>Comissão CIPAVD</MenuItem>
              )}
              {specialties
                .filter((s: any) => s.name !== 'Comissão CIPAVD')
                .map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            {canManageBatch && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.4,
                  borderRadius: 2,
                  border: '1px solid #DBE4EF',
                  bgcolor: '#F8FBFF',
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                    <Chip
                      size="small"
                      label={`Selecionadas: ${selectedIds.length}`}
                      color={selectedIds.length > 0 ? 'primary' : 'default'}
                      variant={selectedIds.length > 0 ? 'filled' : 'outlined'}
                    />
                    {!canBatchAssignResponsible && selectedIds.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Responsável em massa exige atividades da mesma localidade.
                      </Typography>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <TextField
                      select
                      size="small"
                      label="Status"
                      value={batchStatus}
                      onChange={(e) => setBatchStatus(e.target.value)}
                      sx={{ width: { xs: '100%', sm: 170 } }}
                      disabled={!selectedIds.length}
                    >
                      <MenuItem value="">Selecionar</MenuItem>
                      {ActivityStatus.map((status) => (
                        <MenuItem key={status} value={status}>
                          {ACTIVITY_STATUS_LABELS[status] ?? status}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      sx={{ minHeight: 36, px: 1.4, whiteSpace: 'nowrap' }}
                      onClick={handleBatchStatusApply}
                      disabled={!selectedIds.length || !batchStatus || batchUpdateActivityStatus.isPending}
                    >
                      Aplicar status
                    </Button>
                    <TextField
                      select
                      size="small"
                      label="Especialidade"
                      value={batchSpecialtyIds}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBatchSpecialtyIds(
                          Array.isArray(value)
                            ? value.map((item) => String(item))
                            : [String(value)],
                        );
                      }}
                      sx={{ width: { xs: '100%', sm: 210 } }}
                      disabled={!selectedIds.length}
                      SelectProps={{
                        multiple: true,
                        renderValue: (selected) => {
                          const selectedValues = Array.isArray(selected)
                            ? selected.map((item) => String(item))
                            : [];
                          if (!selectedValues.length) return 'Comissão CIPAVD';
                          return selectedValues
                            .map((id) => specialtyNameById.get(id) ?? 'Especialidade')
                            .join(', ');
                        },
                      }}
                    >
                      {specialties.map((specialty: any) => (
                        <MenuItem key={specialty.id} value={specialty.id}>
                          {specialty.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      sx={{ minHeight: 36, px: 1.4, whiteSpace: 'nowrap' }}
                      onClick={handleBatchSpecialtyApply}
                      disabled={!selectedIds.length || batchUpdateActivitySpecialty.isPending}
                    >
                      Aplicar especialidade
                    </Button>
                    <TextField
                      select
                      size="small"
                      label="Responsável"
                      value={batchResponsibleUserId}
                      onChange={(e) => setBatchResponsibleUserId(e.target.value)}
                      sx={{ width: { xs: '100%', sm: 240 } }}
                      disabled={!selectedIds.length || !canBatchAssignResponsible}
                    >
                      <MenuItem value="">Sem responsável</MenuItem>
                      {batchResponsibleOptions.map((user: any) => (
                        <MenuItem key={user.id} value={user.id}>
                          {toMilitaryDisplayName(user.name)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      sx={{ minHeight: 36, px: 1.4, whiteSpace: 'nowrap' }}
                      onClick={handleBatchResponsibleApply}
                      disabled={
                        !selectedIds.length ||
                        !canBatchAssignResponsible ||
                        batchUpdateActivityResponsible.isPending
                      }
                    >
                      Aplicar responsável
                    </Button>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      sx={{ minHeight: 36, px: 1.4, whiteSpace: 'nowrap' }}
                      onClick={openReplicateDialog}
                      disabled={!selectedIds.length || replicateActivities.isPending}
                    >
                      Replicar selecionadas
                    </Button>
                    <Button
                      color="error"
                      variant="outlined"
                      size="small"
                      sx={{ minHeight: 36, px: 1.4, whiteSpace: 'nowrap' }}
                      onClick={() => setBatchDeleteConfirmOpen(true)}
                      disabled={!selectedIds.length || batchDeleteActivities.isPending}
                    >
                      Excluir selecionadas
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
            <Typography variant="h6" sx={{ mb: 1 }}>Atividades de Campo</Typography>
            {displayedItems.length === 0 ? (
              <EmptyState title="Nenhuma atividade" description="Cadastre uma nova atividade externa." />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      {canUpdate && (
                        <TableCell sx={{ color: 'white', fontWeight: 600, width: 40 }} />
                      )}
                      {canManageBatch && (
                        <TableCell padding="checkbox" sx={{ color: 'white' }}>
                          <Checkbox
                            size="small"
                            checked={allVisibleSelected}
                            indeterminate={selectedIds.length > 0 && !allVisibleSelected}
                            onChange={toggleSelectAll}
                            sx={{ color: 'white', '&.Mui-checked': { color: 'white' }, '&.MuiCheckbox-indeterminate': { color: 'white' } }}
                          />
                        </TableCell>
                      )}
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortState?.column === 'type'}
                          direction={sortState?.column === 'type' ? sortState.direction : 'asc'}
                          onClick={() => handleSortByColumn('type')}
                          sx={sortLabelSx}
                        >
                          Tipo
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortState?.column === 'activity'}
                          direction={sortState?.column === 'activity' ? sortState.direction : 'asc'}
                          onClick={() => handleSortByColumn('activity')}
                          sx={sortLabelSx}
                        >
                          Atividade
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortState?.column === 'locality'}
                          direction={sortState?.column === 'locality' ? sortState.direction : 'asc'}
                          onClick={() => handleSortByColumn('locality')}
                          sx={sortLabelSx}
                        >
                          Localidade
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortState?.column === 'specialty'}
                          direction={sortState?.column === 'specialty' ? sortState.direction : 'asc'}
                          onClick={() => handleSortByColumn('specialty')}
                          sx={sortLabelSx}
                        >
                          Especialidade
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Responsável</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortState?.column === 'eventDate'}
                          direction={sortState?.column === 'eventDate' ? sortState.direction : 'asc'}
                          onClick={() => handleSortByColumn('eventDate')}
                          sx={sortLabelSx}
                        >
                          Data
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortState?.column === 'status'}
                          direction={sortState?.column === 'status' ? sortState.direction : 'asc'}
                          onClick={() => handleSortByColumn('status')}
                          sx={sortLabelSx}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sx={{ color: 'white', fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}
                      >
                        Relatório
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedItems.map((item: any) => (
                      <TableRow
                        key={item.id}
                        hover
                        onDragOver={(event) => {
                          if (!canUpdate || !!sortState) return;
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          if (!canUpdate || !!sortState) return;
                          event.preventDefault();
                          void handleDropReorder(String(item.id));
                        }}
                        selected={!isCreateMode && selectedId === item.id}
                        onClick={() => openActivityDrawer(item.id, 'activity')}
                        sx={{
                          cursor: 'pointer',
                          opacity: draggingActivityId === String(item.id) ? 0.72 : 1,
                        }}
                      >
                        {canUpdate && (
                          <TableCell
                            padding="checkbox"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Box
                              component="span"
                              draggable={!sortState}
                              onDragStart={() => {
                                if (sortState) return;
                                setDraggingActivityId(String(item.id));
                              }}
                              onDragEnd={() => setDraggingActivityId('')}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: sortState ? 'not-allowed' : 'grab',
                                color: 'text.disabled',
                                '&:active': { cursor: sortState ? 'not-allowed' : 'grabbing' },
                              }}
                            >
                              <DragIndicatorRoundedIcon fontSize="small" />
                            </Box>
                          </TableCell>
                        )}
                        {canManageBatch && (
                          <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              size="small"
                              checked={selectedIdsSet.has(String(item.id))}
                              onChange={() => toggleRowSelection(String(item.id))}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2">
                            {item.activityType?.name ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.title}</TableCell>
                        <TableCell>
                          {(() => {
                            const localityLabel = getLocalityShortLabel(item);
                            const localityStyle = getLocalityChipStyle(localityLabel);
                            return (
                              <Chip
                                size="small"
                                label={localityLabel}
                                title={item.locality?.name ?? localityLabel}
                                sx={{
                                  fontWeight: 700,
                                  borderWidth: 1,
                                  borderStyle: 'solid',
                                  bgcolor: localityStyle.bg,
                                  color: localityStyle.color,
                                  borderColor: localityStyle.border,
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell>{getActivitySpecialtyLabel(item)}</TableCell>
                        <TableCell>
                          {Array.isArray(item.responsibleUsers) && item.responsibleUsers.length > 0
                            ? item.responsibleUsers.map((user: any) => toMilitaryDisplayName(user.name)).join(', ')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {item.eventDate
                            ? (() => {
                                // Format date without timezone conversion to avoid day offset
                                const dateStr = String(item.eventDate);
                                if (dateStr.includes('T')) {
                                  const dateOnly = dateStr.split('T')[0];
                                  const [year, month, day] = dateOnly.split('-');
                                  return `${day}/${month}/${year}`;
                                }
                                // Fallback for other formats
                                const date = new Date(dateStr);
                                const day = String(date.getUTCDate()).padStart(2, '0');
                                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                const year = date.getUTCFullYear();
                                return `${day}/${month}/${year}`;
                              })()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const statusStyle = getActivityStatusChipStyle(String(item.status));
                            return (
                              <Chip
                                size="small"
                                label={ACTIVITY_STATUS_LABELS[item.status] ?? item.status}
                                sx={{
                                  fontWeight: 700,
                                  borderWidth: 1,
                                  borderStyle: 'solid',
                                  bgcolor: statusStyle.bg,
                                  color: statusStyle.color,
                                  borderColor: statusStyle.borderColor,
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {(() => {
                            const reportIndicator = getActivityReportIndicator(item);
                            if (!reportIndicator) return null;
                            return (
                              <Tooltip title={reportIndicator.label}>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openActivityDrawer(item.id, 'report');
                                  }}
                                  aria-label={reportIndicator.label}
                                >
                                  {reportIndicator.isFilled ? (
                                    <CheckBoxRoundedIcon
                                      color={reportIndicator.color}
                                      fontSize="small"
                                    />
                                  ) : (
                                    <CheckBoxOutlineBlankRoundedIcon
                                      color={reportIndicator.color}
                                      fontSize="small"
                                    />
                                  )}
                                </IconButton>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ mt: 1.5 }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {showAllActivities
                        ? `Mostrando todas as ${totalActivities} atividades`
                        : `Mostrando ${pageStart}-${pageEnd} de ${totalActivities} atividades`}
                    </Typography>
                    <TextField
                      select
                      size="small"
                      label="Atividades por página"
                      value={activityPageSizeMode}
                      onChange={(event) => setActivityPageSizeMode(String(event.target.value))}
                      sx={{ minWidth: 180 }}
                    >
                      {ACTIVITY_PAGE_SIZE_OPTIONS.map((option) => {
                        const value = String(option);
                        return (
                          <MenuItem key={value} value={value}>
                            {value === 'all' ? 'Todas' : value}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Stack>
                  {!showAllActivities && (
                    <Pagination
                      color="primary"
                      shape="rounded"
                      size="small"
                      page={currentPage}
                      count={totalPages}
                      onChange={(_, value) => setCurrentPage(value)}
                    />
                  )}
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', md: 840, lg: 920 } } }}
      >
        <Box p={3} sx={{ height: '100%', overflowY: 'auto', paddingTop: 10 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              {isCreateMode ? 'Nova atividade' : selected ? 'Detalhes da atividade' : 'Detalhes da atividade'}
            </Typography>
            <Stack direction="row" spacing={1}>
              {!isCreateMode && selected && canDelete && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={handleDeleteActivity}
                  disabled={deleteActivity.isPending}
                >
                  Excluir
                </Button>
              )}
              <Button size="small" onClick={closeDrawer}>
                Fechar
              </Button>
            </Stack>
          </Stack>

          {!isCreateMode && selected && (
            <Tabs
              value={drawerTab}
              onChange={(_, value: ActivityDrawerTab) => {
                setDrawerTab(value);
                if (selected?.id) syncUrlState(selected.id, value);
              }}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 2 }}
            >
              <Tab value="activity" label="Dados da atividade" />
              <Tab value="report" label="Relatório" />
            </Tabs>
          )}

          {!isCreateMode && selectedByIdLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Carregando atividade selecionada...
            </Typography>
          )}

          {(isCreateMode || drawerTab === 'activity') && (
            <>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
              >
                <TextField
                  select
                  size="small"
                  label="Tipo"
                  value={activityForm.activityTypeId}
                  onChange={(e) => setActivityForm({ ...activityForm, activityTypeId: e.target.value })}
                  sx={{ minWidth: 220 }}
                  disabled={!canEditActivityForm}
                >
                  <MenuItem value="">Sem tipo</MenuItem>
                  {activityTypes.map((type: any) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  sx={drawerActionButtonSx}
                  disabled={!canEditActivityForm || createActivityType.isPending}
                  onClick={async () => {
                    const name = window.prompt('Informe o nome do novo tipo de atividade:');
                    const normalized = String(name ?? '').trim();
                    if (!normalized) return;
                    try {
                      const created = await createActivityType.mutateAsync({
                        name: normalized,
                        scope: scopeApi,
                      });
                      setActivityForm((prev) => ({
                        ...prev,
                        activityTypeId: String(created?.id ?? ''),
                      }));
                      toast.push({ message: 'Tipo criado com sucesso', severity: 'success' });
                    } catch (error) {
                      toast.push({
                        message: parseApiError(error).message ?? 'Erro ao criar tipo',
                        severity: 'error',
                      });
                    }
                  }}
                >
                  Adicionar tipo
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  sx={drawerActionButtonSx}
                  disabled={
                    !canEditActivityForm ||
                    !selectedActivityType ||
                    Number(selectedActivityType?.usageCount ?? 0) > 0 ||
                    deleteActivityType.isPending
                  }
                  onClick={() => setDeleteActivityTypeConfirmOpen(true)}
                >
                  Excluir tipo
                </Button>
              </Stack>
              {selectedActivityType && Number(selectedActivityType?.usageCount ?? 0) > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                  Este tipo possui {Number(selectedActivityType.usageCount)} atividade(s) vinculada(s) e não pode ser excluído.
                </Typography>
              )}
              <TextField
                size="small"
                label="Título"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                fullWidth
                disabled={!canEditActivityForm}
                sx={{ mt: 1 }}
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                {isCreateMode ? (
                  <Box sx={{ flex: 1, minWidth: 280 }}>
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      options={selectableLocalities}
                      value={createSelectedLocalities}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      onChange={(_, options) => {
                        const ids = options.map((option) => String(option.id));
                        setActivityForm({
                          ...activityForm,
                          localityIds: ids,
                          localityId: ids.length === 1 ? ids[0] : '',
                        });
                      }}
                      disabled={!canEditActivityForm}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={option.id}
                            label={option.name}
                            size="small"
                            variant="outlined"
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          label="Localidades"
                          placeholder={activityForm.localityIds.length ? '' : 'Selecione uma ou mais localidades'}
                        />
                      )}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={drawerActionButtonSx}
                        disabled={!canEditActivityForm}
                        onClick={() => {
                          const ids = selectableLocalities.map((locality: any) => String(locality.id));
                          setActivityForm({
                            ...activityForm,
                            localityIds: ids,
                            localityId: '',
                          });
                        }}
                      >
                        Selecionar todas
                      </Button>
                      <Button
                        size="small"
                        sx={drawerActionButtonSx}
                        disabled={!canEditActivityForm}
                        onClick={() =>
                          setActivityForm({
                            ...activityForm,
                            localityIds: [],
                            localityId: '',
                          })
                        }
                      >
                        Limpar
                      </Button>
                      <Chip
                        size="small"
                        color={activityForm.localityIds.length > 0 ? 'primary' : 'default'}
                        label={`${activityForm.localityIds.length} localidade(s)`}
                        variant={activityForm.localityIds.length > 0 ? 'filled' : 'outlined'}
                      />
                    </Stack>
                  </Box>
                ) : (
                  <TextField
                    select
                    size="small"
                    label="Localidade"
                    value={activityForm.localityId}
                    onChange={(e) => setActivityForm({ ...activityForm, localityId: e.target.value })}
                    sx={{ minWidth: 220 }}
                    disabled={!canEditActivityForm}
                  >
                    <MenuItem value="">Não vinculada</MenuItem>
                    {selectableLocalities.map((l: any) => (
                      <MenuItem key={l.id} value={l.id}>
                        {l.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <TextField
                  select
                  size="small"
                  label="Especialidade"
                  InputLabelProps={{ shrink: true }}
                  value={activityForm.specialtyIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActivityForm({
                      ...activityForm,
                      specialtyIds: Array.isArray(value)
                        ? value.map((item) => String(item))
                        : [String(value)],
                    });
                  }}
                  sx={{ minWidth: 220 }}
                  disabled={!canEditActivityForm}
                  SelectProps={{
                    multiple: true,
                    renderValue: (value) => {
                      const selectedValues = Array.isArray(value)
                        ? value.map((item) => String(item).trim()).filter(Boolean)
                        : [];
                      if (!selectedValues.length) return 'Comissão CIPAVD';
                      return selectedValues
                        .map((id) => specialtyNameById.get(id) ?? 'Especialidade')
                        .join(', ');
                    },
                  }}
                >
                  {specialties.map((s: any) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              {isCreateMode && activityForm.localityIds.length > 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Criação em lote ativa: será criada 1 atividade por localidade com os mesmos dados-base.
                </Typography>
              )}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Responsável"
                  value={activityForm.responsibleUserId}
                  onChange={(e) => setActivityForm({ ...activityForm, responsibleUserId: e.target.value })}
                  sx={{ minWidth: 240 }}
                  disabled={responsibleUsersQuery.isLoading || !canEditActivityForm || !canCreateAssignResponsible}
                >
                  <MenuItem value="">Sem responsável</MenuItem>
                  {responsibleOptions.map((user: any) => (
                    <MenuItem key={user.id} value={user.id}>
                      {toMilitaryDisplayName(user.name)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="date"
                  label="Data da atividade"
                  value={activityForm.eventDate}
                  onChange={(e) => setActivityForm({ ...activityForm, eventDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 200 }}
                  disabled={!canEditActivityForm}
                />
              </Stack>
              {isCreateMode && !canCreateAssignResponsible && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Para múltiplas localidades, o responsável deve ser definido após a criação em cada atividade.
                </Typography>
              )}
              <TextField
                size="small"
                label="Descrição"
                multiline
                minRows={2}
                fullWidth
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                sx={{ mt: 1 }}
                disabled={!canEditActivityForm}
              />
              {responsibleUsersQuery.isError && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                  Não foi possível carregar a lista completa de responsáveis no momento.
                </Typography>
              )}

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Relatório obrigatório"
                  value={activityForm.reportRequired ? 'true' : 'false'}
                  onChange={(e) => setActivityForm({ ...activityForm, reportRequired: e.target.value === 'true' })}
                  sx={{ minWidth: 220 }}
                  disabled={!canEditActivityForm}
                >
                  <MenuItem value="true">Sim</MenuItem>
                  <MenuItem value="false">Não</MenuItem>
                </TextField>

                {!isCreateMode && selected && (
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={selected.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    sx={{ minWidth: 220 }}
                    disabled={!canUpdate}
                  >
                    {ActivityStatus.map((status) => (
                      <MenuItem key={status} value={status}>
                        {ACTIVITY_STATUS_LABELS[status] ?? status}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {isCreateMode ? (
                  <Button
                    variant="contained"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleCreate}
                    disabled={!canCreate || createActivity.isPending}
                  >
                    Criar atividade
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleSaveActivity}
                    disabled={!selected || !canUpdate || updateActivity.isPending}
                  >
                    Salvar atividade
                  </Button>
                )}
              </Stack>

              {!isCreateMode && selected && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Responsáveis
                  </Typography>
                  <Typography variant="body2">
                    {Array.isArray(selected.responsibleUsers) && selected.responsibleUsers.length > 0
                      ? selected.responsibleUsers.map((user: any) => toMilitaryDisplayName(user.name)).join(', ')
                      : 'Não definido'}
                  </Typography>
                </Box>
              )}

              {!isCreateMode && selected && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Comentários e Linha do Tempo
                  </Typography>
                  <Stack spacing={1.2} sx={{ mb: 2 }}>
                    <TextField
                      size="small"
                      label="Novo comentário"
                      multiline
                      minRows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={!canUpdate}
                      placeholder="Escreva pendências, orientações ou observações desta atividade..."
                    />
                    <Box display="flex" justifyContent="flex-end">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleAddComment}
                        disabled={!canUpdate || !commentText.trim() || addComment.isPending}
                        sx={{
                          color: '#FFFFFF',
                          '&.Mui-disabled': {
                            color: 'rgba(255,255,255,0.78)',
                            background: 'linear-gradient(135deg, rgba(12,101,126,0.72) 0%, rgba(10,84,113,0.72) 100%)',
                          },
                        }}
                      >
                        Comentar
                      </Button>
                    </Box>
                    {(commentsQuery.data?.items ?? []).length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Sem comentários até o momento.
                      </Typography>
                    )}
                    <Stack spacing={1}>
                      {(commentsQuery.data?.items ?? []).map((comment: any) => (
                        <Box
                          key={comment.id}
                          sx={{
                            borderLeft: '3px solid #0C657E',
                            pl: 1.2,
                            py: 0.5,
                            bgcolor: '#F8FBFD',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {comment.authorName} • {new Date(comment.createdAt).toLocaleString('pt-BR')}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {comment.text}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </>
              )}
            </>
          )}

          {!isCreateMode && selected && drawerTab === 'report' && (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Typography variant="h6">
                  Formulário de Relatório da Atividade
                </Typography>
                <Tooltip
                  title={
                    canEditReportContent
                      ? 'Importar público participante do Forms'
                      : 'Relatório sem edição disponível'
                  }
                >
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudDownloadRoundedIcon fontSize="small" />}
                      sx={drawerActionButtonSx}
                      onClick={handleOpenFormsImportDialog}
                      disabled={!canEditReportContent || formsImportLoading}
                    >
                      Importar do Forms
                    </Button>
                  </span>
                </Tooltip>
              </Stack>

              <Stack spacing={3}>
                <Accordion
                  variant="outlined"
                  disableGutters
                  defaultExpanded={!reportOptionalTextMode}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Identificação e equipe
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={3}>
                {/* 1. IDENTIFICAÇÃO DA ATIVIDADE */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    1. IDENTIFICAÇÃO DA ATIVIDADE
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Tipo de Atividade"
                      value={selected.activityType?.name ?? ''}
                      fullWidth
                      disabled
                    />
                    <TextField
                      size="small"
                      label="Título / Tema"
                      value={selected.title ?? ''}
                      fullWidth
                      disabled
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        type="date"
                        label="Data"
                        value={reportForm.date}
                        onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        disabled={!canEditReportContent}
                      />
                      <TextField
                        size="small"
                        label="Local"
                        value={reportForm.location}
                        onChange={(e) => setReportForm({ ...reportForm, location: e.target.value })}
                        fullWidth
                        disabled={!canEditReportContent}
                      />
                    </Stack>
                  </Stack>
                </Box>

                {/* 2. EQUIPE RESPONSÁVEL */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    2. EQUIPE RESPONSÁVEL
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Responsável(is)"
                      value={reportForm.responsible}
                      onChange={(e) => setReportForm({ ...reportForm, responsible: e.target.value })}
                      fullWidth
                      disabled={!canEditReportContent}
                    />
                    <TextField
                      size="small"
                      label="Apoio à Missão"
                      value={reportForm.activityAnalysis}
                      onChange={(e) => setReportForm({ ...reportForm, activityAnalysis: e.target.value })}
                      multiline
                      minRows={2}
                      fullWidth
                      disabled={!canEditReportContent}
                    />
                  </Stack>
                </Box>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* 3. PÚBLICO PARTICIPANTE */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    3. PÚBLICO PARTICIPANTE
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      type="number"
                      label="Total de Participantes"
                      value={reportForm.participantsCount}
                      onChange={(e) =>
                        setReportForm({ ...reportForm, participantsCount: Number(e.target.value) || 0 })
                      }
                      inputProps={{ min: 0 }}
                      required={reportPublicParticipantRequired}
                      fullWidth
                      disabled={!canEditReportContent}
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        type="number"
                        label="Homens"
                        value={reportForm.participantsMaleCount ?? ''}
                        onChange={(e) =>
                          setReportForm({
                            ...reportForm,
                            participantsMaleCount: e.target.value ? Number(e.target.value) || 0 : undefined,
                          })
                        }
                        inputProps={{ min: 0 }}
                        fullWidth
                        disabled={!canEditReportContent}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Mulheres"
                        value={reportForm.participantsFemaleCount ?? ''}
                        onChange={(e) =>
                          setReportForm({
                            ...reportForm,
                            participantsFemaleCount: e.target.value ? Number(e.target.value) || 0 : undefined,
                          })
                        }
                        inputProps={{ min: 0 }}
                        fullWidth
                        disabled={!canEditReportContent}
                      />
                    </Stack>
                    <Box sx={{ p: 1.2, border: '1px solid #E6ECF5', borderRadius: 2, bgcolor: '#F9FCFF' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Participantes por perfil
                      </Typography>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <TextField
                          size="small"
                          type="number"
                          label="Instrutores"
                          value={reportForm.instructorsCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              instructorsCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Recrutas"
                          value={reportForm.recruitsCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              recruitsCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                        <TextField
                          size="small"
                          type="number"
                          label="Elo Psicologia"
                          value={reportForm.eloPsychologyCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              eloPsychologyCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Elo Assistência Social"
                          value={reportForm.eloSocialAssistanceCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              eloSocialAssistanceCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Elo Jurídico"
                          value={reportForm.eloJuridicoCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              eloJuridicoCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Elo CPCA"
                          value={reportForm.eloCpcaCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              eloCpcaCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Elo Graduado Master"
                          value={reportForm.eloGraduadoMasterCount}
                          onChange={(e) =>
                            setReportForm({
                              ...reportForm,
                              eloGraduadoMasterCount: Number(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0 }}
                          fullWidth
                          disabled={!canEditReportContent}
                        />
                      </Stack>
                    </Box>
                    <TextField
                      size="small"
                      label="Características dos Participantes"
                      value={reportForm.participantsCharacteristics}
                      onChange={(e) =>
                        setReportForm({ ...reportForm, participantsCharacteristics: e.target.value })
                      }
                      multiline
                      minRows={2}
                      fullWidth
                      disabled={!canEditReportContent}
                    />
                  </Stack>
                </Box>

                <Accordion
                  variant="outlined"
                  disableGutters
                  defaultExpanded={!reportOptionalTextMode}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Informações complementares
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={3}>
                {/* 4. DESCRIÇÃO DA ATIVIDADE */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    4. DESCRIÇÃO DA ATIVIDADE
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Desenvolvimento"
                      value={reportForm.activitiesPerformed}
                      onChange={(e) => setReportForm({ ...reportForm, activitiesPerformed: e.target.value })}
                      multiline
                      minRows={4}
                      fullWidth
                      disabled={!canEditReportContent}
                      placeholder="Descreva o desenvolvimento da atividade, incluindo horários, conteúdo abordado, apresentações realizadas, etc."
                    />
                  </Stack>
                </Box>

                {/* 5. PRINCIPAIS PONTOS OBSERVADOS */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    5. PRINCIPAIS PONTOS OBSERVADOS
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Principais questionamentos levantados pelos participantes"
                      value={reportForm.mainPointsObserved}
                      onChange={(e) => setReportForm({ ...reportForm, mainPointsObserved: e.target.value })}
                      multiline
                      minRows={3}
                      fullWidth
                      disabled={!canEditReportContent}
                      placeholder="Liste os principais questionamentos, pontos de atenção ou observações relevantes"
                    />
                  </Stack>
                </Box>

                {/* 6. PONTOS DE ATENÇÃO */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    6. PONTOS DE ATENÇÃO
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Lacunas / Riscos / Encaminhamentos necessários"
                      value={reportForm.attentionPoints}
                      onChange={(e) => setReportForm({ ...reportForm, attentionPoints: e.target.value })}
                      multiline
                      minRows={3}
                      fullWidth
                      disabled={!canEditReportContent}
                      placeholder="Identifique lacunas, riscos ou encaminhamentos necessários"
                    />
                  </Stack>
                </Box>

                {/* 7. ENCAMINHAMENTOS E PRÓXIMOS PASSOS */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    7. ENCAMINHAMENTOS E PRÓXIMOS PASSOS
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Ações previstas"
                      value={reportForm.nextSteps}
                      onChange={(e) => setReportForm({ ...reportForm, nextSteps: e.target.value })}
                      multiline
                      minRows={3}
                      fullWidth
                      disabled={!canEditReportContent}
                      placeholder="Descreva as ações previstas e próximos passos"
                    />
                  </Stack>
                </Box>

                {/* 8. REFERÊNCIAS E ANEXOS */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    8. REFERÊNCIAS E ANEXOS
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Links e registros"
                      value={reportForm.referencesAndAttachments}
                      onChange={(e) => setReportForm({ ...reportForm, referencesAndAttachments: e.target.value })}
                      multiline
                      minRows={2}
                      fullWidth
                      disabled={!canEditReportContent}
                      placeholder="Ex: Reportagem completa: https://... | Vídeo resumo: https://..."
                    />
                  </Stack>
                </Box>

                {/* CONCLUSÃO */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                    CONCLUSÃO
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Conclusão"
                      value={reportForm.conclusion}
                      onChange={(e) => setReportForm({ ...reportForm, conclusion: e.target.value })}
                      multiline
                      minRows={3}
                      fullWidth
                      disabled={!canEditReportContent}
                    />
                  </Stack>
                </Box>

                {/* Rodapé */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Cidade"
                    value={reportForm.city}
                    onChange={(e) => setReportForm({ ...reportForm, city: e.target.value })}
                    fullWidth
                    disabled={!canEditReportContent}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="Data de Fechamento"
                    value={reportForm.closingDate}
                    onChange={(e) => setReportForm({ ...reportForm, closingDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    disabled={!canEditReportContent}
                  />
                </Stack>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Imagens da atividade
                  </Typography>
                  <Button variant="outlined" component="label" size="small" disabled={!canUploadReportPhotos}>
                    Inserir foto
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (event) => {
                        if (!selected || !event.target.files?.[0]) return;
                        try {
                          await uploadPhoto.mutateAsync({ id: selected.id, file: event.target.files[0] });
                          toast.push({ message: 'Foto inserida', severity: 'success' });
                        } catch (error) {
                          toast.push({ message: parseApiError(error).message ?? 'Erro ao enviar foto', severity: 'error' });
                        } finally {
                          event.target.value = '';
                        }
                      }}
                    />
                  </Button>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                    {(selected.report?.photos ?? []).map((photo: any) => (
                      <Chip
                        key={photo.id}
                        label={photo.fileName}
                        onDelete={
                          canUploadReportPhotos
                            ? async () => {
                                try {
                                  await removePhoto.mutateAsync({ id: selected.id, photoId: photo.id });
                                  toast.push({ message: 'Foto removida', severity: 'success' });
                                } catch (error) {
                                  toast.push({
                                    message: parseApiError(error).message ?? 'Erro ao remover foto',
                                    severity: 'error',
                                  });
                                }
                              }
                            : undefined
                        }
                        size="small"
                      />
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ p: 1.5, border: '1px solid #E6ECF5', borderRadius: 2 }}>
                  <Typography variant="subtitle2">Assinatura digital</Typography>
                  {selected.report?.hasSignature ? (
                    <>
                      <Typography variant="body2" color="success.main">
                        Assinado em {new Date(selected.report.signedAt).toLocaleString('pt-BR')} por {selected.report.signedBy?.name ?? selected.report.signedById}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Relatório bloqueado para edição após assinatura.
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="warning.main">
                      Relatório ainda não assinado.
                    </Typography>
                  )}
                </Box>

                {canDeleteSignature ? (
                  <Box sx={{ p: 1.5, border: '1px dashed #CFD8DC', borderRadius: 2, bgcolor: '#FAFBFC' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Ação de assinatura
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Permite remover a assinatura digital do relatório sem excluir o conteúdo.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      sx={drawerActionButtonSx}
                      onClick={() => setRemoveSignatureConfirmOpen(true)}
                      disabled={!canDeleteSignature || upsertReport.isPending}
                    >
                      Deletar assinatura
                    </Button>
                  </Box>
                ) : null}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleSaveReport}
                    disabled={!canEditReportContent || upsertReport.isPending}
                  >
                    Salvar relatório
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleSignClick}
                    disabled={!canSign || signReport.isPending || reportIsSigned}
                  >
                    Assinar digitalmente
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={handleExportPdf}
                    disabled={!canDownload || exportPdf.isPending}
                  >
                    Exportar PDF assinado
                  </Button>
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    sx={drawerActionButtonSx}
                    onClick={() => handleStatusChange('DONE')}
                    disabled={!canUpdate || updateActivityStatus.isPending}
                  >
                    Finalizar atividade
                  </Button>
                </Stack>
              </Stack>
            </>
          )}

        </Box>
      </Drawer>

      <Dialog
        open={formsImportDialogOpen}
        onClose={() => setFormsImportDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Importar do Forms</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formsImportLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  border: '1px solid #E6ECF5',
                  borderRadius: 2,
                  bgcolor: '#F9FCFF',
                }}
              >
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Carregando dados do Forms...
                </Typography>
              </Box>
            ) : null}

            {formsImportError ? (
              <Alert severity={formsImportRows.length ? 'warning' : 'error'}>
                {formsImportError}
              </Alert>
            ) : null}

            {formsImportRows.length ? (
              <Autocomplete
                size="small"
                options={formsImportRows}
                value={selectedFormsReport}
                onChange={(_event, value) => setSelectedFormsReportKey(value?.key ?? '')}
                getOptionLabel={getFormsReportOptionLabel}
                isOptionEqualToValue={(option, value) => option.key === value.key}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    <Box component="li" key={key} {...optionProps}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" fontWeight={700}>
                          {toFormsText(option.atividade) || 'Atividade sem nome'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[toFormsText(option.data), getFormsTimeRange(option), toFormsText(option.id_sessao)]
                            .filter(Boolean)
                            .join(' - ')}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Atividade do Forms"
                    placeholder="Data, atividade ou sessão"
                  />
                )}
              />
            ) : null}

            {selectedFormsReport ? (
              <Box
                sx={{
                  p: 1.5,
                  border: '1px solid #DDE7F2',
                  borderRadius: 2,
                  bgcolor: '#FBFDFF',
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {toFormsText(selectedFormsReport.atividade) || 'Atividade sem nome'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[toFormsText(selectedFormsReport.data), getFormsTimeRange(selectedFormsReport), toFormsText(selectedFormsReport.id_sessao)]
                        .filter(Boolean)
                        .join(' - ')}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={toFormsText(selectedFormsReport.tipo) || 'Forms'}
                    sx={{ bgcolor: '#E8F5E9', color: '#1B5E20', border: '1px solid #A5D6A7' }}
                  />
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1,
                  }}
                >
                  {[
                    ['Participantes únicos', getFormsParticipantsCount(selectedFormsReport)],
                    ['Registros', toFormsNonNegativeInt(selectedFormsReport.total_registros)],
                    ['Feminino', toFormsNonNegativeInt(selectedFormsReport.feminino)],
                    ['Masculino', toFormsNonNegativeInt(selectedFormsReport.masculino)],
                    ['Não informado/outro', toFormsNonNegativeInt(selectedFormsReport.nao_informado_outro)],
                    ['Postos/graduações', toFormsNonNegativeInt(selectedFormsReport.postos_graduacoes_distintos)],
                    ['OMs distintas', toFormsNonNegativeInt(selectedFormsReport.oms_distintas)],
                    ['Data aproveitável', toFormsInputDate(selectedFormsReport.data) || '-'],
                  ].map(([label, value]) => (
                    <Box
                      key={String(label)}
                      sx={{
                        p: 1,
                        minHeight: 64,
                        border: '1px solid #E6ECF5',
                        borderRadius: 1.5,
                        bgcolor: '#FFFFFF',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {toFormsText(selectedFormsReport.observacao) ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                    {toFormsText(selectedFormsReport.observacao)}
                  </Typography>
                ) : null}
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormsImportDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon fontSize="small" />}
            onClick={() => void loadFormsImportRows()}
            disabled={formsImportLoading}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudDownloadRoundedIcon fontSize="small" />}
            onClick={handleConfirmFormsImport}
            disabled={!selectedFormsReport || formsImportLoading || !canEditReportContent}
          >
            Confirmar importação
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={replicateDialogOpen}
        onClose={() => setReplicateDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Replicar atividades selecionadas</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} mt={0.5}>
            <DialogContentText>
              Replicação rápida para outras localidades. Responsáveis, comentários,
              cronograma de visita e relatório não são copiados.
            </DialogContentText>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={replicateTargetLocalityOptions}
              value={replicateSelectedLocalities}
              getOptionLabel={(option: any) => String(option.name ?? option.id)}
              isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
              onChange={(_, options) =>
                setReplicateTargetLocalityIds(
                  options.map((option: any) => String(option.id)),
                )
              }
              renderTags={(value, getTagProps) =>
                value.map((option: any, index: number) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.name}
                    size="small"
                    variant="outlined"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Localidades destino"
                  placeholder={
                    replicateTargetLocalityIds.length
                      ? ''
                      : 'Selecione uma ou mais localidades'
                  }
                />
              )}
            />
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  setReplicateTargetLocalityIds(
                    replicateTargetLocalityOptions.map((locality: any) =>
                      String(locality.id),
                    ),
                  )
                }
              >
                Selecionar todas
              </Button>
              <Button
                size="small"
                onClick={() => setReplicateTargetLocalityIds([])}
              >
                Limpar
              </Button>
              <Chip
                size="small"
                color={replicateTargetLocalityIds.length > 0 ? 'primary' : 'default'}
                label={`${replicateTargetLocalityIds.length} destino(s)`}
                variant={replicateTargetLocalityIds.length > 0 ? 'filled' : 'outlined'}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                select
                size="small"
                label="Status nas cópias"
                value={replicateStatusMode}
                onChange={(event) =>
                  setReplicateStatusMode(
                    event.target.value as 'RESET' | 'KEEP',
                  )
                }
                fullWidth
              >
                <MenuItem value="RESET">Reiniciar como Não iniciada</MenuItem>
                <MenuItem value="KEEP">Manter status original</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Data nas cópias"
                value={replicateDateMode}
                onChange={(event) =>
                  setReplicateDateMode(
                    event.target.value as 'KEEP' | 'CLEAR' | 'SET_DATE',
                  )
                }
                fullWidth
              >
                <MenuItem value="KEEP">Manter data original</MenuItem>
                <MenuItem value="CLEAR">Deixar sem data</MenuItem>
                <MenuItem value="SET_DATE">Definir uma data</MenuItem>
              </TextField>
            </Stack>
            {replicateDateMode === 'SET_DATE' && (
              <TextField
                size="small"
                type="date"
                label="Data para as cópias"
                value={replicateTargetDate}
                onChange={(event) => setReplicateTargetDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplicateDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleReplicateConfirm}
            disabled={!selectedIds.length || replicateActivities.isPending}
          >
            Replicar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={batchDeleteConfirmOpen}
        onCancel={() => setBatchDeleteConfirmOpen(false)}
        onConfirm={handleBatchDeleteConfirm}
        title="Excluir atividades selecionadas"
        message="Deseja realmente excluir todas as atividades selecionadas?"
        highlightText={`${selectedIds.length} atividade(s)`}
        note="Esta ação será registrada em auditoria e não pode ser desfeita."
        confirmLabel="Excluir selecionadas"
        severity="error"
        confirmLoading={batchDeleteActivities.isPending}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteActivity}
        title="Excluir atividade"
        message="Deseja excluir esta atividade?"
        highlightText={selected?.title ?? ''}
        note="Esta ação será registrada em auditoria e não pode ser desfeita."
        confirmLabel="Excluir atividade"
        severity="error"
        confirmLoading={deleteActivity.isPending}
      />

      <ConfirmDialog
        open={deleteActivityTypeConfirmOpen}
        onCancel={() => setDeleteActivityTypeConfirmOpen(false)}
        onConfirm={handleDeleteSelectedActivityType}
        title="Excluir tipo de atividade"
        message="Deseja excluir este tipo de atividade do escopo atual?"
        highlightText={selectedActivityType?.name ?? ''}
        note="A exclusão só é permitida quando não houver nenhuma atividade vinculada a este tipo."
        confirmLabel="Excluir tipo"
        severity="error"
        confirmLoading={deleteActivityType.isPending}
      />

      <ConfirmDialog
        open={removeSignatureConfirmOpen}
        onCancel={() => setRemoveSignatureConfirmOpen(false)}
        onConfirm={handleRemoveSignature}
        title="Deletar assinatura digital"
        message="Deseja realmente remover a assinatura digital deste relatório?"
        note="Apenas o hash/registro da assinatura será removido. O conteúdo do relatório será mantido."
        confirmLabel="Remover assinatura"
        severity="warning"
        confirmLoading={upsertReport.isPending}
      />

      <Dialog
        open={sign2faDialogOpen}
        onClose={() => { setSign2faDialogOpen(false); setSign2faCode(''); setSign2faError(''); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0.5 }}>Verificação de segurança</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Para assinar digitalmente este relatório, informe o código de 6 dígitos do seu <strong>Google Authenticator</strong>.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Código de verificação"
            placeholder="000 000"
            value={sign2faCode}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9\s]/g, '');
              setSign2faCode(v);
              if (sign2faError) setSign2faError('');
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSignConfirm(); }}
            error={!!sign2faError}
            helperText={sign2faError || 'Abra o Google Authenticator no seu celular e digite o código exibido.'}
            inputProps={{ maxLength: 7, inputMode: 'numeric', autoComplete: 'one-time-code' }}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setSign2faDialogOpen(false); setSign2faCode(''); setSign2faError(''); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSignConfirm}
            disabled={signReport.isPending || upsertReport.isPending}
          >
            {signReport.isPending ? 'Assinando…' : 'Confirmar e assinar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
