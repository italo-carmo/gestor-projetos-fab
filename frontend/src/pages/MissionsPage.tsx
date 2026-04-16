import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddMissionParticipantFromLdap,
  useAddMissionParticipantFromUser,
  useCreateMission,
  useCreateMissionBanner,
  useCreateMissionScheduleItem,
  useDeleteMissionBanner,
  useDeleteMission,
  useDeleteMissionScheduleItem,
  useDownloadMissionBannerFile,
  useExportMissionSchedulePdf,
  useLookupMissionLdapParticipant,
  useMission,
  useMissionChecklist,
  useMe,
  useMissionLocalityOptions,
  useMissionStatistics,
  useMissions,
  useOmsCatalog,
  useRemoveMissionParticipant,
  useUpdateMissionChecklist,
  useUploadMissionChecklistPhoto,
  useUpdateMissionBanner,
  useUpdateMission,
  useUpdateMissionScheduleItem,
  useUsers,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import {
  loadMissionsPageUiSettings,
  MISSIONS_PAGE_UI_SETTINGS_KEY,
  MISSIONS_STATS_SECTION_DEFAULTS,
  persistMissionsPageUiSettings,
} from '../app/missionsPageUiSettings';
import { hasAnyRole, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import {
  MissionBannerLayoutEditor,
  type MissionBannerLayoutOverrides,
} from '../components/missions/MissionBannerLayoutEditor';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
type MissionScope = 'SMIF' | 'CIPAVD';

function resolveChecklistPhotoUrl(raw: string) {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('/missions/checklist/uploads/')) return `/api${url}`;
  return url;
}

const blankMissionForm = {
  title: '',
  description: '',
  localityId: '',
  startDate: '',
  endDate: '',
};

const blankScheduleForm = {
  title: '',
  startAt: '',
  durationMinutes: 60,
  location: '',
  responsible: '',
  participants: '',
};

const blankBannerForm = {
  name: '',
  eventDate: '',
  eventTime: '',
  locationPrimary: '',
  locationSecondary: '',
  layoutOverrides: {} as MissionBannerLayoutOverrides,
};

type MissionChecklistClassification =
  | 'FORTE_CONSOLIDADA'
  | 'OPORTUNIDADE_MELHORIA'
  | 'NECESSITA_ANALISE'
  | 'POSSIVEL_RISCO';

type MissionStatsCardKey =
  | 'missionsByUser'
  | 'usersByMissionDays'
  | 'participantsByMission';

type MissionChecklistItemState = {
  classification: MissionChecklistClassification;
  notes: string;
  photos: string[];
};

type MissionChecklistItemConfig = {
  id: string;
  title: string;
  prompt?: string | null;
};

type MissionChecklistSectionConfig = {
  id: string;
  title: string;
  items: MissionChecklistItemConfig[];
};

type MissionChecklistClassificationConfig = {
  id: MissionChecklistClassification;
  label: string;
  colorHex: string | null;
};

const fallbackChecklistClassifications: MissionChecklistClassificationConfig[] = [
  {
    id: 'FORTE_CONSOLIDADA',
    label: 'Dimensão forte/consolidada',
    colorHex: '#2E7D32',
  },
  {
    id: 'OPORTUNIDADE_MELHORIA',
    label: 'Dimensão com oportunidades de melhoria',
    colorHex: '#F9A825',
  },
  {
    id: 'NECESSITA_ANALISE',
    label: 'Dimensão necessita de maior análise',
    colorHex: null,
  },
  {
    id: 'POSSIVEL_RISCO',
    label: 'Possível Risco',
    colorHex: '#C62828',
  },
];

const fallbackChecklistClassificationMeta: Record<
  MissionChecklistClassification,
  MissionChecklistClassificationConfig
> = {
  FORTE_CONSOLIDADA: {
    id: 'FORTE_CONSOLIDADA',
    label: 'Dimensão forte/consolidada',
    colorHex: '#2E7D32',
  },
  OPORTUNIDADE_MELHORIA: {
    id: 'OPORTUNIDADE_MELHORIA',
    label: 'Dimensão com oportunidades de melhoria',
    colorHex: '#F9A825',
  },
  NECESSITA_ANALISE: {
    id: 'NECESSITA_ANALISE',
    label: 'Dimensão necessita de maior análise',
    colorHex: null,
  },
  POSSIVEL_RISCO: {
    id: 'POSSIVEL_RISCO',
    label: 'Possível Risco',
    colorHex: '#C62828',
  },
};

const fallbackMissionChecklistSections: MissionChecklistSectionConfig[] = [
  {
    id: 'lideranca',
    title: 'Liderança',
    items: [
      { id: 'lideranca_atuacao', title: 'Atuação de lideranças' },
      {
        id: 'lideranca_coesao_equipe',
        title:
          'Coesão da equipe de instrução e inclusão de instrutoras do sexo feminino',
      },
      {
        id: 'lideranca_preparo_instrutoras',
        title: 'Preparo das instrutoras mulheres',
      },
    ],
  },
  {
    id: 'acompanhamento_recrutas',
    title: 'Acompanhamento de Recrutas',
    items: [
      {
        id: 'acompanhamento_motivacao',
        title: 'Percepção de motivação das recrutas',
      },
      {
        id: 'acompanhamento_suporte_psicossocial',
        title: 'Suporte psicossocial (psicólogo, assistente social e jurídico)',
      },
      {
        id: 'acompanhamento_engajamento_familiar',
        title: 'Engajamento familiar',
      },
      {
        id: 'acompanhamento_infraestrutura',
        title: 'Infraestrutura e condições',
      },
    ],
  },
  {
    id: 'analise_riscos',
    title: 'Análise de Riscos',
    items: [
      {
        id: 'riscos_reputacional_juridico',
        title:
          'Avaliação do risco reputacional e jurídico para a equipe de instrução',
        prompt:
          'Existe clareza sobre os limites da atuação dos instrutores? A equipe compreende que determinadas condutas, mesmo sem intenção, podem configurar assédio?',
      },
      {
        id: 'riscos_subnotificacao',
        title: 'Risco de subnotificação: ambiente que inibe denúncias',
        prompt:
          'O ambiente de instrução é percebido pelas recrutas como seguro para denunciar? Há sinais de que denúncias são desencorajadas, minimizadas ou expostas?',
      },
      {
        id: 'riscos_tratamento_desigual',
        title: 'Risco de tratamento desigual percebido como discriminação',
        prompt:
          'As diferenças de tratamento entre recrutas masculinos e femininos são explicadas institucionalmente? Há risco de que sejam lidas como privilégio ou discriminação por qualquer das partes?',
      },
      {
        id: 'riscos_abertura_mudancas',
        title: 'Abertura para mudanças e adaptações do processo',
        prompt:
          'A liderança demonstra flexibilidade para ajustar práticas com base nos aprendizados do SMIF?',
      },
      {
        id: 'riscos_participacao_boas_praticas',
        title: 'Participação ativa no ciclo de boas práticas',
        prompt:
          'A equipe engajou com qualidade nas atividades propostas? Trouxe reflexões genuínas?',
      },
      {
        id: 'riscos_valorizacao_presenca_feminina',
        title: 'Valorização da presença feminina na instrução e na formação',
        prompt:
          'Há reconhecimento genuíno, e não apenas formal, da importância deste momento histórico?',
      },
    ],
  },
];

function buildDefaultMissionChecklistState(
  sections: MissionChecklistSectionConfig[],
  defaultClassification: MissionChecklistClassification,
): Record<string, MissionChecklistItemState> {
  const itemIds = sections.flatMap((section) => section.items.map((item) => item.id));
  return itemIds.reduce<Record<string, MissionChecklistItemState>>(
    (acc, itemId) => {
      acc[itemId] = {
        classification: defaultClassification,
        notes: '',
        photos: [],
      };
      return acc;
    },
    {},
  );
}

function isMissionChecklistClassification(value: string): value is MissionChecklistClassification {
  return Object.hasOwn(fallbackChecklistClassificationMeta, value);
}

function buildMissionChecklistStateFromApi(data: any): Record<string, MissionChecklistItemState> {
  const sections =
    Array.isArray(data?.sections) && data.sections.length > 0
      ? (data.sections as MissionChecklistSectionConfig[])
      : fallbackMissionChecklistSections;
  const defaultClassification = isMissionChecklistClassification(
    String(data?.defaultClassification ?? ''),
  )
    ? (String(data?.defaultClassification) as MissionChecklistClassification)
    : 'NECESSITA_ANALISE';
  const base = buildDefaultMissionChecklistState(sections, defaultClassification);
  const itemIdSet = new Set(
    sections.flatMap((section) =>
      (section.items ?? []).map((item) => String(item?.id ?? '')),
    ),
  );
  const validClassifications = new Set(
    (
      Array.isArray(data?.classifications)
        ? data.classifications
        : fallbackChecklistClassifications
    )
      .map((classification: any) => String(classification?.id ?? ''))
      .filter((id: string): id is MissionChecklistClassification =>
        isMissionChecklistClassification(id),
      ),
  );
  for (const section of sections as any[]) {
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const item of items) {
      const itemId = String(item?.id ?? '');
      if (!itemIdSet.has(itemId)) continue;
      const classificationRaw = String(item?.classification ?? '');
      const classification =
        isMissionChecklistClassification(classificationRaw) &&
        validClassifications.has(classificationRaw)
          ? classificationRaw
          : defaultClassification;
      base[itemId] = {
        classification,
        notes: String(item?.notes ?? ''),
        photos: Array.isArray(item?.photos)
          ? item.photos
              .map((photo: any) => String(photo ?? '').trim())
              .filter((photo: string) => Boolean(photo))
          : [],
      };
    }
  }

  return base;
}

function normalizeChecklistColorHex(colorHex: string | null | undefined) {
  const value = String(colorHex ?? '').trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value)) return null;
  return value.toUpperCase();
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

function formatDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getNextMissionScheduleStart(scheduleItems: any[] | null | undefined) {
  let latestEndTime = 0;

  for (const item of scheduleItems ?? []) {
    const startAt = new Date(String(item?.startAt ?? ''));
    if (Number.isNaN(startAt.getTime())) continue;

    const durationMinutes = Math.max(Number(item?.durationMinutes ?? 0) || 0, 0);
    const endTime = startAt.getTime() + durationMinutes * 60_000;
    latestEndTime = Math.max(latestEndTime, endTime);
  }

  return latestEndTime > 0 ? formatDateTimeLocalValue(new Date(latestEndTime)) : '';
}

function buildBlankScheduleForm(scheduleItems?: any[] | null) {
  return {
    ...blankScheduleForm,
    startAt: getNextMissionScheduleStart(scheduleItems),
  };
}

function isScheduleFormEmpty(form: typeof blankScheduleForm) {
  return (
    !form.title.trim() &&
    !form.location.trim() &&
    !form.responsible.trim() &&
    !form.participants.trim()
  );
}

function formatDateOnlyPtBr(value: string | Date | null | undefined) {
  if (!value) return '-';
  const raw = String(value);
  const isoDatePart = raw.slice(0, 10);
  const match = isoDatePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const year = String(parsed.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatBannerDateAndWeekday(value: string | null | undefined) {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'UTC',
  })
    .format(date)
    .replace(/-feira/gi, '')
    .replace(/^\w/, (char) => char.toUpperCase());
  return `${match[3]}/${match[2]}/${match[1]} • ${weekday}`;
}

function buildMissionBannerLocationLabel(
  primary: string | null | undefined,
  secondary: string | null | undefined,
) {
  const line1 = String(primary ?? '').trim();
  const line2 = String(secondary ?? '').trim();
  if (line1 && line2) return `${line1} • ${line2}`;
  return line1 || line2 || '-';
}

function splitMissionBannerLocationPreset(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized === '-') {
    return {
      locationPrimary: '',
      locationSecondary: '',
    };
  }

  for (const separator of [' • ', ' - ', ' — ', ' / ', ' | ']) {
    if (!normalized.includes(separator)) continue;
    const [left, ...rest] = normalized.split(separator);
    const right = rest.join(separator).trim();
    if (left.trim() && right) {
      return {
        locationPrimary: left.trim(),
        locationSecondary: right,
      };
    }
  }

  if (normalized.length <= 24) {
    return {
      locationPrimary: normalized,
      locationSecondary: '',
    };
  }

  const midpoint = Math.floor(normalized.length / 2);
  let splitIndex = -1;
  for (let offset = 0; offset <= 12; offset += 1) {
    const leftIndex = midpoint - offset;
    const rightIndex = midpoint + offset;
    if (leftIndex > 0 && normalized[leftIndex] === ' ') {
      splitIndex = leftIndex;
      break;
    }
    if (rightIndex < normalized.length && normalized[rightIndex] === ' ') {
      splitIndex = rightIndex;
      break;
    }
  }

  if (splitIndex > 0) {
    return {
      locationPrimary: normalized.slice(0, splitIndex).trim(),
      locationSecondary: normalized.slice(splitIndex + 1).trim(),
    };
  }

  return {
    locationPrimary: normalized,
    locationSecondary: '',
  };
}

function formatMissionBannerPresetLabel(item: any) {
  const title = String(item?.title ?? '').trim() || 'Item de cronograma';
  const location = String(item?.location ?? '').trim() || 'Local não informado';
  const startAt = new Date(String(item?.startAt ?? ''));
  const dateLabel = Number.isNaN(startAt.getTime())
    ? 'Sem horário'
    : startAt.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

  return `${dateLabel} • ${title} • ${location}`;
}

function normalizeMissionBannerLayoutOverrides(
  value: unknown,
): MissionBannerLayoutOverrides {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const next: MissionBannerLayoutOverrides = {};
  for (const key of [
    'day',
    'month',
    'time',
    'weekday',
    'locationPrimary',
    'locationSecondary',
  ] as const) {
    const raw =
      source[key] && typeof source[key] === 'object'
        ? (source[key] as Record<string, unknown>)
        : null;
    if (!raw) continue;
    const block: NonNullable<MissionBannerLayoutOverrides[typeof key]> = {};
    if (typeof raw.xPct === 'number' && Number.isFinite(raw.xPct)) {
      block.xPct = raw.xPct;
    }
    if (typeof raw.yPct === 'number' && Number.isFinite(raw.yPct)) {
      block.yPct = raw.yPct;
    }
    if (typeof raw.fontSizePx === 'number' && Number.isFinite(raw.fontSizePx)) {
      block.fontSizePx = raw.fontSizePx;
    }
    if (typeof raw.fontScale === 'number' && Number.isFinite(raw.fontScale)) {
      block.fontScale = raw.fontScale;
    }
    if (Object.keys(block).length > 0) {
      next[key] = block;
    }
  }
  return next;
}

export function MissionsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const missionIdFromUrl = params.get('missionId') ?? '';
  const localityId = params.get('localityId') ?? '';
  const q = params.get('q') ?? '';
  const missionScope: MissionScope =
    params.get('scope') === 'CIPAVD' ? 'CIPAVD' : 'SMIF';

  const missionsQuery = useMissions({
    localityId: localityId || undefined,
    q: q || undefined,
    scope: missionScope,
  });
  const localityOptionsQuery = useMissionLocalityOptions(missionScope);
  const omsCatalogQuery = useOmsCatalog(missionScope === 'SMIF');
  const missionDetailQuery = useMission(missionIdFromUrl, Boolean(missionIdFromUrl));
  const cloneMissionOptionsQuery = useMissions({
    pageSize: '200',
    scope: missionScope,
  });
  const statisticsQuery = useMissionStatistics(missionScope);

  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const addParticipantLdap = useAddMissionParticipantFromLdap();
  const addParticipantUser = useAddMissionParticipantFromUser();
  const removeParticipant = useRemoveMissionParticipant();
  const usersQuery = useUsers();
  const createMissionBanner = useCreateMissionBanner();
  const updateMissionBanner = useUpdateMissionBanner();
  const deleteMissionBanner = useDeleteMissionBanner();
  const downloadMissionBannerFile = useDownloadMissionBannerFile();
  const createScheduleItem = useCreateMissionScheduleItem();
  const updateScheduleItem = useUpdateMissionScheduleItem();
  const deleteScheduleItem = useDeleteMissionScheduleItem();
  const exportSchedulePdf = useExportMissionSchedulePdf();
  const updateMissionChecklist = useUpdateMissionChecklist();
  const uploadMissionChecklistPhoto = useUploadMissionChecklistPhoto();

  const [drawerOpen, setDrawerOpen] = useState(Boolean(missionIdFromUrl));
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [missionTab, setMissionTab] = useState(0);
  const [missionForm, setMissionForm] = useState(blankMissionForm);
  const [ldapIdentifier, setLdapIdentifier] = useState('');
  const [participantTab, setParticipantTab] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [bannerForm, setBannerForm] = useState(() => ({
    ...blankBannerForm,
    layoutOverrides: {},
  }));
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [selectedBannerPresetId, setSelectedBannerPresetId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState(blankScheduleForm);
  const [editingScheduleItemId, setEditingScheduleItemId] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<Record<string, MissionChecklistItemState>>(
    () =>
      buildDefaultMissionChecklistState(
        fallbackMissionChecklistSections,
        'NECESSITA_ANALISE',
      ),
  );
  const [checklistOmId, setChecklistOmId] = useState('');
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [cloneSourceMissionId, setCloneSourceMissionId] = useState('');
  const [missionDeleteTarget, setMissionDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [bannerDeleteTarget, setBannerDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [scheduleDeleteTarget, setScheduleDeleteTarget] = useState<{
    ids: string[];
    title?: string | null;
    count: number;
  } | null>(null);
  const [selectedScheduleItemIds, setSelectedScheduleItemIds] = useState<string[]>([]);
  const [expandedStatsCards, setExpandedStatsCards] = useState<
    Record<MissionStatsCardKey, boolean>
  >({
    missionsByUser: false,
    usersByMissionDays: false,
    participantsByMission: false,
  });

  const { data: me } = useMe();
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const [missionsUiSettings, setMissionsUiSettings] = useState(() =>
    loadMissionsPageUiSettings(),
  );
  const [statsSectionEditorOpen, setStatsSectionEditorOpen] = useState(false);
  const [statsSectionDraft, setStatsSectionDraft] = useState({ title: '', description: '' });

  const lookupQuery = useLookupMissionLdapParticipant(ldapIdentifier);

  const localityOptions = useMemo(() => {
    const rows = (localityOptionsQuery.data?.items ?? []) as Array<{
      id: string;
      code?: string | null;
      name: string;
    }>;
    return rows
      .map((row) => ({
        id: String(row.id),
        name: row.code ? `${row.name} (${row.code})` : String(row.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [localityOptionsQuery.data?.items]);

  const checklistOmOptions = useMemo(() => {
    if (missionScope === 'CIPAVD') {
      const rows = (localityOptionsQuery.data?.items ?? []) as Array<{
        id: string;
        code?: string | null;
        name: string;
      }>;
      return rows
        .map((item) => {
          const id = String(item?.id ?? '').trim();
          if (!id) return null;
          const code = String(item?.code ?? '').trim();
          const name = String(item?.name ?? '').trim();
          return {
            id,
            code,
            name,
            label: code || name || id,
          };
        })
        .filter(Boolean)
        .sort((a, b) =>
          String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR'),
        ) as Array<{
        id: string;
        code: string;
        name: string;
        label: string;
      }>;
    }
    return ((omsCatalogQuery.data?.items ?? []) as Array<any>)
      .map((item) => {
        const id = String(item?.id ?? '').trim();
        if (!id) return null;
        const code = String(item?.code ?? '').trim();
        const name = String(item?.name ?? '').trim();
        return {
          id,
          code,
          name,
          label: code || name || id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR')) as Array<{
      id: string;
      code: string;
      name: string;
      label: string;
    }>;
  }, [missionScope, localityOptionsQuery.data?.items, omsCatalogQuery.data?.items]);

  const items = missionsQuery.data?.items ?? [];
  const selectedMission = missionDetailQuery.data ?? null;
  const missionBanners = useMemo(
    () => ((selectedMission?.banners ?? []) as any[]),
    [selectedMission?.banners],
  );
  const missionChecklistQuery = useMissionChecklist(
    String(selectedMission?.id ?? ''),
    Boolean(selectedMission?.id) && !isCreateMode,
  );
  const missionChecklistSections = useMemo(() => {
    const sectionsRaw = Array.isArray((missionChecklistQuery.data as any)?.sections)
      ? ((missionChecklistQuery.data as any).sections as any[])
      : [];
    if (sectionsRaw.length === 0) return fallbackMissionChecklistSections;
    return sectionsRaw.map((section) => ({
      id: String(section?.id ?? ''),
      title: String(section?.title ?? ''),
      items: (Array.isArray(section?.items) ? section.items : []).map((item: any) => ({
        id: String(item?.id ?? ''),
        title: String(item?.title ?? ''),
        prompt: item?.prompt ? String(item.prompt) : null,
      })),
    })) as MissionChecklistSectionConfig[];
  }, [missionChecklistQuery.data]);
  const checklistClassifications = useMemo(() => {
    const classificationsRaw = Array.isArray(
      (missionChecklistQuery.data as any)?.classifications,
    )
      ? ((missionChecklistQuery.data as any).classifications as any[])
      : [];
    const normalized = classificationsRaw
      .map((classification) => {
        const id = String(classification?.id ?? '');
        if (!isMissionChecklistClassification(id)) return null;
        return {
          id,
          label:
            String(classification?.label ?? '').trim() ||
            fallbackChecklistClassificationMeta[id].label,
          colorHex:
            normalizeChecklistColorHex(
              classification?.colorHex as string | null | undefined,
            ) ?? fallbackChecklistClassificationMeta[id].colorHex,
        };
      })
      .filter(Boolean) as MissionChecklistClassificationConfig[];

    if (normalized.length === 0) return fallbackChecklistClassifications;
    return normalized;
  }, [missionChecklistQuery.data]);
  const checklistClassificationMap = useMemo(() => {
    const map = new Map<
      MissionChecklistClassification,
      MissionChecklistClassificationConfig
    >();
    for (const classification of checklistClassifications) {
      map.set(classification.id, classification);
    }
    return map;
  }, [checklistClassifications]);
  const checklistDefaultClassification = useMemo(() => {
    if (checklistClassificationMap.has('NECESSITA_ANALISE')) {
      return 'NECESSITA_ANALISE' as MissionChecklistClassification;
    }
    const first = checklistClassifications[0]?.id;
    return first && isMissionChecklistClassification(first)
      ? first
      : ('NECESSITA_ANALISE' as MissionChecklistClassification);
  }, [checklistClassificationMap, checklistClassifications]);
  const checklistClassificationEntries = useMemo(
    () =>
      checklistClassifications.filter((classification) =>
        isMissionChecklistClassification(classification.id),
      ),
    [checklistClassifications],
  );
  const cloneSourceMissionQuery = useMission(cloneSourceMissionId, Boolean(cloneSourceMissionId));
  const cloneMissionOptions = useMemo(() => {
    const missions = (cloneMissionOptionsQuery.data?.items ?? []) as any[];
    return missions.filter((mission) => String(mission.id) !== String(selectedMission?.id ?? ''));
  }, [cloneMissionOptionsQuery.data?.items, selectedMission?.id]);
  const nextScheduleStartAt = useMemo(
    () => getNextMissionScheduleStart((selectedMission?.scheduleItems ?? []) as any[]),
    [selectedMission?.scheduleItems],
  );
  const missionScheduleItems = useMemo(
    () => ((selectedMission?.scheduleItems ?? []) as any[]),
    [selectedMission?.scheduleItems],
  );
  const missionBannerPresetOptions = useMemo(
    () =>
      missionScheduleItems
        .map((item: any) => {
          const id = String(item?.id ?? '').trim();
          if (!id) return null;
          return {
            id,
            label: formatMissionBannerPresetLabel(item),
            item,
          };
        })
        .filter(Boolean) as Array<{ id: string; label: string; item: any }>,
    [missionScheduleItems],
  );
  const scheduleDayOptions = useMemo(() => {
    const dayMap = new Map<string, { key: string; label: string; ids: string[] }>();
    for (const item of missionScheduleItems) {
      const itemId = String(item?.id ?? '').trim();
      const date = new Date(String(item?.startAt ?? ''));
      if (!itemId || Number.isNaN(date.getTime())) continue;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      const existing = dayMap.get(key);
      if (existing) {
        existing.ids.push(itemId);
        continue;
      }
      dayMap.set(key, {
        key,
        label: `${day}/${month}`,
        ids: [itemId],
      });
    }
    return Array.from(dayMap.values()).sort((left, right) => left.key.localeCompare(right.key));
  }, [missionScheduleItems]);
  const allScheduleItemIds = useMemo(
    () => missionScheduleItems.map((item: any) => String(item.id)).filter(Boolean),
    [missionScheduleItems],
  );
  const scheduleDeleteSummaryTitles = useMemo(() => {
    if (!scheduleDeleteTarget?.ids?.length) return [];
    const selectedIds = new Set(scheduleDeleteTarget.ids);
    return missionScheduleItems
      .filter((item: any) => selectedIds.has(String(item.id)))
      .map((item: any) => String(item.title ?? 'Item de cronograma').trim() || 'Item de cronograma');
  }, [missionScheduleItems, scheduleDeleteTarget]);
  const selectedScheduleCount = selectedScheduleItemIds.length;
  const allScheduleItemsSelected =
    allScheduleItemIds.length > 0 &&
    selectedScheduleItemIds.length === allScheduleItemIds.length;
  const someScheduleItemsSelected =
    selectedScheduleItemIds.length > 0 &&
    selectedScheduleItemIds.length < allScheduleItemIds.length;
  const selectedScheduleDayKey = useMemo(() => {
    if (!selectedScheduleItemIds.length || !scheduleDayOptions.length) return null;
    const normalizedSelection = [...selectedScheduleItemIds].sort().join('|');
    const matchingDay = scheduleDayOptions.find(
      (option) => [...option.ids].sort().join('|') === normalizedSelection,
    );
    return matchingDay?.key ?? null;
  }, [scheduleDayOptions, selectedScheduleItemIds]);

  const resetScheduleForm = useCallback((scheduleItems?: any[] | null) => {
    setEditingScheduleItemId(null);
    setScheduleForm(buildBlankScheduleForm(scheduleItems));
  }, []);

  const resetBannerForm = useCallback(() => {
    setEditingBannerId(null);
    setSelectedBannerPresetId(null);
    setBannerForm({
      ...blankBannerForm,
      layoutOverrides: {},
    });
  }, []);

  useEffect(() => {
    if (!missionIdFromUrl) {
      setDrawerOpen(false);
      setMissionTab(0);
      setSelectedScheduleItemIds([]);
      resetBannerForm();
      if (!isCreateMode) {
        resetScheduleForm();
      }
      return;
    }
    setDrawerOpen(true);
    setIsCreateMode(false);
  }, [isCreateMode, missionIdFromUrl, resetBannerForm, resetScheduleForm]);

  useEffect(() => {
    setSelectedScheduleItemIds((current) =>
      current.filter((itemId) => allScheduleItemIds.includes(itemId)),
    );
  }, [allScheduleItemIds]);

  useEffect(() => {
    if (!selectedMission) return;
    setMissionForm({
      title: selectedMission.title ?? '',
      description: selectedMission.description ?? '',
      localityId: selectedMission.localityId ?? '',
      startDate: selectedMission.startDate ? String(selectedMission.startDate).slice(0, 10) : '',
      endDate: selectedMission.endDate ? String(selectedMission.endDate).slice(0, 10) : '',
    });
  }, [selectedMission]);

  useEffect(() => {
    if (!selectedMission?.id) {
      resetBannerForm();
      return;
    }
    setEditingBannerId((current) => {
      if (!current) return current;
      const exists = missionBanners.some((banner: any) => String(banner.id) === String(current));
      return exists ? current : null;
    });
  }, [missionBanners, resetBannerForm, selectedMission?.id]);

  useEffect(() => {
    const selectedBanner =
      editingBannerId && selectedMission
        ? missionBanners.find(
            (banner: any) => String(banner.id) === String(editingBannerId),
          ) ?? null
        : null;
    if (!selectedBanner) {
      if (!editingBannerId) {
        setBannerForm({
          ...blankBannerForm,
          layoutOverrides: {},
        });
      }
      return;
    }
    setBannerForm({
      name: String(selectedBanner.name ?? ''),
      eventDate: String(selectedBanner.eventDate ?? ''),
      eventTime: String(selectedBanner.eventTime ?? ''),
      locationPrimary: String(selectedBanner.locationPrimary ?? ''),
      locationSecondary: String(selectedBanner.locationSecondary ?? ''),
      layoutOverrides: normalizeMissionBannerLayoutOverrides(
        selectedBanner.layoutOverrides,
      ),
    });
  }, [editingBannerId, missionBanners, selectedMission]);

  useEffect(() => {
    if (!selectedMission?.id) {
      setChecklistState(
        buildDefaultMissionChecklistState(
          missionChecklistSections,
          checklistDefaultClassification,
        ),
      );
      setChecklistOmId('');
      setChecklistDirty(false);
      return;
    }
    setChecklistState(
      buildDefaultMissionChecklistState(
        missionChecklistSections,
        checklistDefaultClassification,
      ),
    );
    setChecklistOmId(String(selectedMission.localityId ?? '').trim());
    setChecklistDirty(false);
  }, [
    selectedMission?.id,
    selectedMission?.localityId,
    missionChecklistSections,
    checklistDefaultClassification,
  ]);

  useEffect(() => {
    if (!selectedMission?.id) return;
    if (!missionChecklistQuery.data) return;
    setChecklistState(buildMissionChecklistStateFromApi(missionChecklistQuery.data));
    const apiOmId = String((missionChecklistQuery.data as any)?.omId ?? '').trim();
    const fallbackOmId = String(selectedMission.localityId ?? '').trim();
    setChecklistOmId(apiOmId || fallbackOmId);
    setChecklistDirty(false);
  }, [missionChecklistQuery.data, selectedMission?.id, selectedMission?.localityId]);

  useEffect(() => {
    const data = missionDetailQuery.data as { scope?: string } | undefined;
    if (!missionIdFromUrl || !data?.scope) return;
    const expected: MissionScope =
      String(data.scope).toUpperCase() === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
    if (missionScope !== expected) {
      const next = new URLSearchParams(params);
      next.set('scope', expected);
      setParams(next, { replace: true });
    }
  }, [missionIdFromUrl, missionDetailQuery.data, missionScope, params, setParams]);

  useEffect(() => {
    const sync = () => setMissionsUiSettings(loadMissionsPageUiSettings());
    window.addEventListener('missions-page-ui-settings-changed', sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MISSIONS_PAGE_UI_SETTINGS_KEY) return;
      sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('missions-page-ui-settings-changed', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const openCreate = () => {
    setIsCreateMode(true);
    setMissionTab(0);
    setMissionForm({
      ...blankMissionForm,
      localityId: localityId || localityOptions[0]?.id || '',
    });
    setLdapIdentifier('');
    setChecklistState(
      buildDefaultMissionChecklistState(
        missionChecklistSections,
        checklistDefaultClassification,
      ),
    );
    setChecklistOmId(localityId || localityOptions[0]?.id || '');
    setChecklistDirty(false);
    resetScheduleForm();
    resetBannerForm();
    setCloneSourceMissionId('');
    setDrawerOpen(true);

    const next = new URLSearchParams(params);
    next.delete('missionId');
    setParams(next, { replace: true });
  };

  const openMission = (id: string) => {
    setIsCreateMode(false);
    setMissionTab(0);
    setDrawerOpen(true);
    setChecklistDirty(false);
    resetScheduleForm();
    resetBannerForm();
    setCloneSourceMissionId('');

    const next = new URLSearchParams(params);
    next.set('missionId', id);
    setParams(next, { replace: true });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setIsCreateMode(false);
    setMissionTab(0);
    resetScheduleForm();
    resetBannerForm();
    setChecklistState(
      buildDefaultMissionChecklistState(
        missionChecklistSections,
        checklistDefaultClassification,
      ),
    );
    setChecklistOmId('');
    setChecklistDirty(false);
    setCloneSourceMissionId('');
    setMissionDeleteTarget(null);
    setBannerDeleteTarget(null);
    setScheduleDeleteTarget(null);

    const next = new URLSearchParams(params);
    next.delete('missionId');
    setParams(next, { replace: true });
  };

  const handleSaveMission = async () => {
    if (!missionForm.title.trim()) {
      toast.push({ message: 'Informe o título da missão.', severity: 'warning' });
      return;
    }
    if (!missionForm.localityId) {
      toast.push({ message: 'Selecione uma localidade.', severity: 'warning' });
      return;
    }
    if (!missionForm.startDate || !missionForm.endDate) {
      toast.push({ message: 'Informe data de início e término.', severity: 'warning' });
      return;
    }

    const cloneScheduleItems = async (targetMissionId: string) => {
      if (!cloneSourceMissionId) return 0;
      const sourceItems = ((cloneSourceMissionQuery.data?.scheduleItems ?? []) as any[])
        .slice()
        .sort(
          (a, b) =>
            new Date(String(a.startAt ?? 0)).getTime() - new Date(String(b.startAt ?? 0)).getTime(),
        );
      if (!sourceItems.length) return 0;

      for (const item of sourceItems) {
        const startAtIso = new Date(String(item.startAt)).toISOString();
        await createScheduleItem.mutateAsync({
          id: targetMissionId,
          payload: {
            title: String(item.title ?? ''),
            startAt: startAtIso,
            durationMinutes: Number(item.durationMinutes ?? 60) || 60,
            location: String(item.location ?? ''),
            responsible: String(item.responsible ?? ''),
            participants: String(item.participants ?? ''),
          },
        });
      }
      return sourceItems.length;
    };

    if (cloneSourceMissionId && cloneSourceMissionQuery.isLoading) {
      toast.push({ message: 'Aguarde o carregamento da missão origem para clonar o cronograma.', severity: 'info' });
      return;
    }

    try {
      if (isCreateMode) {
        const created = await createMission.mutateAsync({
          title: missionForm.title,
          description: missionForm.description || null,
          localityId: missionForm.localityId,
          startDate: missionForm.startDate,
          endDate: missionForm.endDate,
          scope: missionScope,
        });
        const clonedCount = await cloneScheduleItems(created.id);
        toast.push({ message: 'Missão criada com sucesso.', severity: 'success' });
        if (cloneSourceMissionId) {
          toast.push({
            message: clonedCount > 0
              ? `Cronograma clonado com ${clonedCount} item(ns).`
              : 'Missão origem sem itens de cronograma para clonar.',
            severity: clonedCount > 0 ? 'success' : 'warning',
          });
        }
        openMission(created.id);
      } else if (selectedMission) {
        await updateMission.mutateAsync({
          id: selectedMission.id,
          payload: {
            title: missionForm.title,
            description: missionForm.description || null,
            localityId: missionForm.localityId,
            startDate: missionForm.startDate,
            endDate: missionForm.endDate,
          },
        });
        toast.push({ message: 'Missão atualizada.', severity: 'success' });
        const clonedCount = await cloneScheduleItems(selectedMission.id);
        if (cloneSourceMissionId) {
          toast.push({
            message: clonedCount > 0
              ? `Cronograma clonado com ${clonedCount} item(ns).`
              : 'Missão origem sem itens de cronograma para clonar.',
            severity: clonedCount > 0 ? 'success' : 'warning',
          });
        }
      }
      setCloneSourceMissionId('');
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar missão.', severity: 'error' });
    }
  };

  const handleDeleteMission = async () => {
    if (!missionDeleteTarget) return;

    try {
      await deleteMission.mutateAsync(missionDeleteTarget.id);
      toast.push({ message: 'Missão removida.', severity: 'success' });
      if (selectedMission?.id === missionDeleteTarget.id) {
        closeDrawer();
      }
      setMissionDeleteTarget(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover missão.', severity: 'error' });
    }
  };

  const handleAddParticipantLdap = async () => {
    if (!selectedMission) return;
    if (!ldapIdentifier.trim()) return;

    try {
      await addParticipantLdap.mutateAsync({ id: selectedMission.id, identifier: ldapIdentifier.trim() });
      toast.push({ message: 'Participante adicionado.', severity: 'success' });
      setLdapIdentifier('');
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao adicionar participante.', severity: 'error' });
    }
  };

  const handleAddParticipantUser = async () => {
    if (!selectedMission) return;
    if (!selectedUserId) return;

    try {
      await addParticipantUser.mutateAsync({ id: selectedMission.id, userId: selectedUserId });
      toast.push({ message: 'Participante adicionado.', severity: 'success' });
      setSelectedUserId(null);
      setUserSearch('');
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao adicionar participante.', severity: 'error' });
    }
  };

  const allUsers = useMemo(() => {
    if (!usersQuery.data?.items) return [];
    return (usersQuery.data.items as any[]).filter((user: any) => user?.id);
  }, [usersQuery.data?.items]);

  const filteredUsers = useMemo(() => {
    if (!allUsers.length) return [];
    const searchTerm = userSearch.toLowerCase().trim();
    if (!searchTerm) return allUsers.slice(0, 50);
    return allUsers
      .filter((user: any) => {
        const name = String(user.name ?? '').toLowerCase();
        const email = String(user.email ?? '').toLowerCase();
        const ldapUid = String(user.ldapUid ?? '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm) || ldapUid.includes(searchTerm);
      })
      .slice(0, 50);
  }, [allUsers, userSearch]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId || !allUsers.length) return null;
    return allUsers.find((u: any) => u?.id === selectedUserId) || null;
  }, [selectedUserId, allUsers]);

  const toggleStatsCard = (cardKey: MissionStatsCardKey) => {
    setExpandedStatsCards((current) => ({
      ...current,
      [cardKey]: !current[cardKey],
    }));
  };

  const openStatsSectionEditor = () => {
    const s = missionsUiSettings.statsSection;
    setStatsSectionDraft({ title: s.title, description: s.description });
    setStatsSectionEditorOpen(true);
  };

  const saveStatsSectionEditor = () => {
    const next = {
      ...missionsUiSettings,
      statsSection: {
        title: statsSectionDraft.title,
        description: statsSectionDraft.description,
      },
    };
    setMissionsUiSettings(next);
    persistMissionsPageUiSettings(next);
    setStatsSectionEditorOpen(false);
    toast.push({ message: 'Texto do card atualizado.', severity: 'success' });
  };

  const validParticipants = useMemo(() => {
    if (!selectedMission?.participants) return [];
    const participants = selectedMission.participants as any[];
    const seen = new Set<string>();
    return participants
      .filter((p: any) => {
        if (!p?.id) return false;
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
  }, [selectedMission?.participants]);

  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedMission) return;

    try {
      await removeParticipant.mutateAsync({ id: selectedMission.id, participantId });
      toast.push({ message: 'Participante removido.', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover participante.', severity: 'error' });
    }
  };

  const handleSaveScheduleItem = async () => {
    if (!selectedMission) return;
    const scheduleStartAt = scheduleForm.startAt || nextScheduleStartAt;
    if (!scheduleForm.title.trim() || !scheduleStartAt) {
      toast.push({ message: 'Preencha atividade e horário.', severity: 'warning' });
      return;
    }

    // Converter datetime-local (horário local) para ISO UTC real
    // Ex.: 07:15 local (UTC-3) -> 10:15:00.000Z
    const utcDateTime = new Date(scheduleStartAt).toISOString();

    const payload = {
      title: scheduleForm.title,
      startAt: utcDateTime,
      durationMinutes: Number(scheduleForm.durationMinutes) || 0,
      location: scheduleForm.location,
      responsible: scheduleForm.responsible,
      participants: scheduleForm.participants,
    };

    try {
      if (editingScheduleItemId) {
        await updateScheduleItem.mutateAsync({
          id: selectedMission.id,
          itemId: editingScheduleItemId,
          payload,
        });
        toast.push({ message: 'Item de cronograma atualizado.', severity: 'success' });
      } else {
        await createScheduleItem.mutateAsync({ id: selectedMission.id, payload });
        toast.push({ message: 'Item de cronograma adicionado.', severity: 'success' });
      }
      const nextScheduleItems = editingScheduleItemId
        ? ((selectedMission.scheduleItems ?? []) as any[]).map((item: any) =>
            item.id === editingScheduleItemId ? { ...item, ...payload } : item,
          )
        : [...((selectedMission.scheduleItems ?? []) as any[]), payload];
      resetScheduleForm(nextScheduleItems);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar item.', severity: 'error' });
    }
  };

  const handleDeleteScheduleItem = (itemId: string, itemTitle: string) => {
    setScheduleDeleteTarget({ ids: [itemId], title: itemTitle, count: 1 });
  };

  const handleToggleScheduleItemSelection = (itemId: string) => {
    setSelectedScheduleItemIds((current) =>
      current.includes(itemId)
        ? current.filter((candidate) => candidate !== itemId)
        : [...current, itemId],
    );
  };

  const handleToggleAllScheduleItems = () => {
    setSelectedScheduleItemIds((current) =>
      current.length === allScheduleItemIds.length ? [] : allScheduleItemIds,
    );
  };

  const handleSelectScheduleItemsByDay = (itemIds: string[]) => {
    setSelectedScheduleItemIds(itemIds);
  };

  const handleDeleteSelectedScheduleItems = () => {
    if (!selectedScheduleItemIds.length) return;
    setScheduleDeleteTarget({
      ids: selectedScheduleItemIds,
      count: selectedScheduleItemIds.length,
    });
  };

  const handleConfirmDeleteScheduleItem = async () => {
    if (!selectedMission) return;
    if (!scheduleDeleteTarget) return;

    try {
      for (const itemId of scheduleDeleteTarget.ids) {
        await deleteScheduleItem.mutateAsync({ id: selectedMission.id, itemId });
      }
      toast.push({
        message:
          scheduleDeleteTarget.count > 1
            ? `${scheduleDeleteTarget.count} itens removidos.`
            : 'Item removido.',
        severity: 'success',
      });
      const nextScheduleItems = ((selectedMission.scheduleItems ?? []) as any[]).filter(
        (item: any) => !scheduleDeleteTarget.ids.includes(String(item.id)),
      );
      if (
        editingScheduleItemId &&
        scheduleDeleteTarget.ids.includes(editingScheduleItemId)
      ) {
        resetScheduleForm(nextScheduleItems);
      } else {
        setScheduleForm((current) => (isScheduleFormEmpty(current) ? buildBlankScheduleForm(nextScheduleItems) : current));
      }
      setSelectedScheduleItemIds((current) =>
        current.filter((itemId) => !scheduleDeleteTarget.ids.includes(itemId)),
      );
      setScheduleDeleteTarget(null);
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          (scheduleDeleteTarget.count > 1
            ? 'Erro ao remover itens selecionados.'
            : 'Erro ao remover item.'),
        severity: 'error',
      });
    }
  };

  const handleStartCreateBanner = () => {
    setEditingBannerId(null);
    setSelectedBannerPresetId(null);
    setBannerForm({
      ...blankBannerForm,
      eventDate: selectedMission?.startDate
        ? String(selectedMission.startDate).slice(0, 10)
        : '',
      layoutOverrides: {},
    });
  };

  const handleEditBanner = (banner: any) => {
    setEditingBannerId(String(banner.id));
    setSelectedBannerPresetId(null);
    setBannerForm({
      name: String(banner.name ?? ''),
      eventDate: String(banner.eventDate ?? ''),
      eventTime: String(banner.eventTime ?? ''),
      locationPrimary: String(banner.locationPrimary ?? ''),
      locationSecondary: String(banner.locationSecondary ?? ''),
      layoutOverrides: normalizeMissionBannerLayoutOverrides(
        banner.layoutOverrides,
      ),
    });
  };

  const handleApplyBannerPreset = (preset: { id: string; item: any } | null) => {
    setSelectedBannerPresetId(preset?.id ?? null);
    if (!preset?.item) return;

    const formattedStartAt = formatDateTimeLocalValue(preset.item.startAt);
    const [eventDate = '', eventTimeRaw = ''] = formattedStartAt.split('T');
    const { locationPrimary, locationSecondary } = splitMissionBannerLocationPreset(
      preset.item.location,
    );

    setBannerForm((current) => ({
      ...current,
      eventDate: eventDate || current.eventDate,
      eventTime: eventTimeRaw.slice(0, 5) || current.eventTime,
      locationPrimary: locationPrimary || current.locationPrimary,
      locationSecondary: locationSecondary || '',
    }));
  };

  const handleSaveBanner = async () => {
    if (!selectedMission?.id) return;
    if (
      !bannerForm.name.trim() ||
      !bannerForm.eventDate ||
      !bannerForm.eventTime ||
      !bannerForm.locationPrimary.trim()
    ) {
      toast.push({
        message: 'Preencha nome, data, hora e local principal do banner.',
        severity: 'warning',
      });
      return;
    }

    const payload = {
      name: bannerForm.name.trim(),
      eventDate: bannerForm.eventDate,
      eventTime: bannerForm.eventTime,
      locationPrimary: bannerForm.locationPrimary.trim(),
      locationSecondary: bannerForm.locationSecondary.trim() || null,
      layoutOverrides:
        Object.keys(bannerForm.layoutOverrides ?? {}).length > 0
          ? bannerForm.layoutOverrides
          : null,
    };

    try {
      if (editingBannerId) {
        const updated = await updateMissionBanner.mutateAsync({
          id: selectedMission.id,
          bannerId: editingBannerId,
          payload,
        });
        setEditingBannerId(String(updated.id));
        toast.push({
          message: 'Banner atualizado.',
          severity: 'success',
        });
      } else {
        const created = await createMissionBanner.mutateAsync({
          id: selectedMission.id,
          payload,
        });
        setEditingBannerId(String(created.id));
        toast.push({
          message: 'Banner criado.',
          severity: 'success',
        });
      }
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar banner.',
        severity: 'error',
      });
    }
  };

  const handleDeleteBanner = (banner: any) => {
    setBannerDeleteTarget({
      id: String(banner.id),
      name: String(banner.name ?? 'Banner'),
    });
  };

  const handleConfirmDeleteBanner = async () => {
    if (!selectedMission?.id || !bannerDeleteTarget) return;
    try {
      await deleteMissionBanner.mutateAsync({
        id: selectedMission.id,
        bannerId: bannerDeleteTarget.id,
      });
      if (editingBannerId === bannerDeleteTarget.id) {
        handleStartCreateBanner();
      }
      toast.push({ message: 'Banner removido.', severity: 'success' });
      setBannerDeleteTarget(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao remover banner.',
        severity: 'error',
      });
    }
  };

  const handleDownloadBanner = async (bannerId: string, format: 'png' | 'pdf') => {
    if (!selectedMission?.id) return;
    try {
      await downloadMissionBannerFile.mutateAsync({
        id: selectedMission.id,
        bannerId,
        format,
      });
      toast.push({
        message:
          format === 'pdf'
            ? 'Banner em PDF baixado com sucesso.'
            : 'Banner em imagem baixado com sucesso.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao baixar banner.',
        severity: 'error',
      });
    }
  };

  const handleChecklistClassificationChange = (
    itemId: string,
    classification: MissionChecklistClassification,
  ) => {
    setChecklistState((current) => ({
      ...current,
      [itemId]: {
        classification,
        notes: current[itemId]?.notes ?? '',
        photos: current[itemId]?.photos ?? [],
      },
    }));
    setChecklistDirty(true);
  };

  const handleChecklistNotesChange = (itemId: string, notes: string) => {
    setChecklistState((current) => ({
      ...current,
      [itemId]: {
        classification:
          current[itemId]?.classification ?? checklistDefaultClassification,
        notes,
        photos: current[itemId]?.photos ?? [],
      },
    }));
    setChecklistDirty(true);
  };

  const handleChecklistPhotoUpload = async (itemId: string, file: File | null) => {
    if (!selectedMission?.id || !file) return;
    try {
      const response = await uploadMissionChecklistPhoto.mutateAsync({
        missionId: selectedMission.id,
        file,
      });
      const photoUrl = String(response?.photoUrl ?? '').trim();
      if (!photoUrl) return;
      setChecklistState((current) => {
        const currentItem = current[itemId] ?? {
          classification: checklistDefaultClassification,
          notes: '',
          photos: [],
        };
        const dedup = Array.from(new Set([...(currentItem.photos ?? []), photoUrl]));
        return {
          ...current,
          [itemId]: {
            ...currentItem,
            photos: dedup,
          },
        };
      });
      setChecklistDirty(true);
      toast.push({ message: 'Foto adicionada ao item.', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao enviar foto.',
        severity: 'error',
      });
    }
  };

  const handleChecklistPhotoRemove = (itemId: string, photoUrl: string) => {
    setChecklistState((current) => {
      const currentItem = current[itemId] ?? {
        classification: checklistDefaultClassification,
        notes: '',
        photos: [],
      };
      return {
        ...current,
        [itemId]: {
          ...currentItem,
          photos: (currentItem.photos ?? []).filter((photo) => photo !== photoUrl),
        },
      };
    });
    setChecklistDirty(true);
  };

  const handleChecklistOmChange = (nextOmId: string) => {
    const normalized = String(nextOmId ?? '').trim();
    setChecklistOmId(normalized);
    setChecklistDirty(true);
  };

  const handleSaveChecklist = async () => {
    if (!selectedMission?.id) return;
    const normalizedChecklistOmId = String(checklistOmId ?? '').trim();
    if (!normalizedChecklistOmId) {
      toast.push({ message: 'Selecione a OM do mapeamento institucional antes de salvar.', severity: 'error' });
      return;
    }

    try {
      await updateMissionChecklist.mutateAsync({
        id: String(selectedMission.id),
        payload: {
          omId: normalizedChecklistOmId,
          items: missionChecklistSections.flatMap((section) =>
            section.items.map((item) => item.id),
          ).map((itemId) => ({
            id: itemId,
            classification:
              checklistState[itemId]?.classification ??
              checklistDefaultClassification,
            notes: checklistState[itemId]?.notes ?? '',
            photos: checklistState[itemId]?.photos ?? [],
          })),
        },
      });
      setChecklistDirty(false);
      toast.push({ message: 'Mapeamento institucional da missão salvo.', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar mapeamento institucional.', severity: 'error' });
    }
  };

  if (missionsQuery.isLoading) return <SkeletonState />;
  if (missionsQuery.isError) return <ErrorState error={missionsQuery.error} onRetry={() => missionsQuery.refetch()} />;

  const scopeLabel = missionScope === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
  const scopeSubtitle =
    missionScope === 'CIPAVD'
      ? 'Planejamento de missões da frente CIPAVD: equipe, cronograma com PDF e mapeamento institucional alinhado ao catálogo CIPAVD.'
      : 'Planejamento das missões SMIF de instrução e acompanhamento, com participantes via LDAP, cronograma oficial e exportação em PDF.';

  const handleScopeTabChange = (_event: unknown, value: MissionScope) => {
    const next = new URLSearchParams(params);
    next.set('scope', value);
    next.delete('missionId');
    setParams(next, { replace: true });
  };

  return (
    <Box sx={{ overflowX: 'clip' }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
        spacing={1.25}
        mb={2}
      >
        <Box>
          <Typography variant="h4">Missões</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {scopeSubtitle}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
          Nova missão
        </Button>
      </Stack>

      <Tabs value={missionScope} onChange={handleScopeTabChange} sx={{ mb: 2 }}>
        <Tab value="SMIF" label="SMIF" />
        <Tab value="CIPAVD" label="CIPAVD" />
      </Tabs>

      {statisticsQuery.isLoading && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <LinearProgress />
          </CardContent>
        </Card>
      )}
      {statisticsQuery.isError && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="body2" color="error">
              Erro ao carregar estatísticas.
            </Typography>
          </CardContent>
        </Card>
      )}
      {statisticsQuery.data && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 1.5 }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {missionsUiSettings.statsSection.title.trim() ||
                    MISSIONS_STATS_SECTION_DEFAULTS.title}
                </Typography>
                {missionsUiSettings.statsSection.description.trim() ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {missionsUiSettings.statsSection.description.trim()}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                  Indicadores calculados apenas para missões {scopeLabel}.
                </Typography>
              </Box>
              {isTiProfile ? (
                <Tooltip title="Editar título e descrição">
                  <IconButton
                    size="small"
                    onClick={openStatsSectionEditor}
                    sx={{ flexShrink: 0 }}
                    aria-label="Editar título e descrição do card Estatísticas de Missões"
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(6, minmax(0, 1fr))',
                },
                gap: 1.2,
                mb: 1.6,
              }}
            >
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.2, px: 1.4, '&:last-child': { pb: 1.2 } }}>
                  <Typography variant="caption" color="text.secondary">Total de Missões</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">{statisticsQuery.data.totalMissions}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.2, px: 1.4, '&:last-child': { pb: 1.2 } }}>
                  <Typography variant="caption" color="text.secondary">Total de Participantes</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">{statisticsQuery.data.totalParticipants}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.2, px: 1.4, '&:last-child': { pb: 1.2 } }}>
                  <Typography variant="caption" color="text.secondary">Média por Missão</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {statisticsQuery.data.averageParticipantsPerMission.toFixed(1)}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.2, px: 1.4, '&:last-child': { pb: 1.2 } }}>
                  <Typography variant="caption" color="text.secondary">Total de Dias de Missão</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {statisticsQuery.data.totalMissionDays}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.2, px: 1.4, '&:last-child': { pb: 1.2 } }}>
                  <Typography variant="caption" color="text.secondary">Média de Dias por Missão</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {statisticsQuery.data.averageMissionDays.toFixed(1)}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ py: 1.2, px: 1.4, '&:last-child': { pb: 1.2 } }}>
                  <Typography variant="caption" color="text.secondary">Missões sem Participantes</Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={statisticsQuery.data.missionsWithoutParticipants > 0 ? 'warning.main' : 'success.main'}
                  >
                    {statisticsQuery.data.missionsWithoutParticipants}
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1.2,
                alignItems: 'start',
              }}
            >
              <Card variant="outlined">
                <CardContent sx={{ py: 1.2, px: 1.4 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Usuários com Mais Missões
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => toggleStatsCard('missionsByUser')}
                      aria-label="Expandir card de usuários com mais missões"
                    >
                      {expandedStatsCards.missionsByUser ? (
                        <KeyboardArrowUpRoundedIcon fontSize="small" />
                      ) : (
                        <KeyboardArrowDownRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Stack>
                  <Collapse in={expandedStatsCards.missionsByUser}>
                    {statisticsQuery.data.missionsByUser.length > 0 ? (
                      <Stack spacing={1} sx={{ mt: 0.6 }}>
                        {statisticsQuery.data.missionsByUser.map((item: any, index: number) => (
                          <Box key={item.userId}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>{item.userName}</Typography>
                                {item.userEmail && (
                                  <Typography variant="caption" color="text.secondary" noWrap>{item.userEmail}</Typography>
                                )}
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                <Chip label={`${item.count} missões`} size="small" color="primary" />
                                <Chip label={`${item.totalDays} dias`} size="small" variant="outlined" color="primary" />
                              </Stack>
                            </Stack>
                            {index < statisticsQuery.data.missionsByUser.length - 1 && <Divider sx={{ mt: 1 }} />}
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        Sem dados para exibir.
                      </Typography>
                    )}
                  </Collapse>
                  {!expandedStatsCards.missionsByUser && (
                    <Typography variant="caption" color="text.secondary">
                      Card comprimido. Clique na seta para expandir.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent sx={{ py: 1.2, px: 1.4 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Usuários com Mais Dias em Missão
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => toggleStatsCard('usersByMissionDays')}
                      aria-label="Expandir card de usuários com mais dias em missão"
                    >
                      {expandedStatsCards.usersByMissionDays ? (
                        <KeyboardArrowUpRoundedIcon fontSize="small" />
                      ) : (
                        <KeyboardArrowDownRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Stack>
                  <Collapse in={expandedStatsCards.usersByMissionDays}>
                    {statisticsQuery.data.usersByMissionDays.length > 0 ? (
                      <Stack spacing={1} sx={{ mt: 0.6 }}>
                        {statisticsQuery.data.usersByMissionDays.map((item: any, index: number) => (
                          <Box key={item.userId}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>{item.userName}</Typography>
                                {item.userEmail && (
                                  <Typography variant="caption" color="text.secondary" noWrap>{item.userEmail}</Typography>
                                )}
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                <Chip label={`${item.totalDays} dias`} size="small" color="secondary" />
                                <Chip label={`${item.count} missões`} size="small" variant="outlined" color="secondary" />
                              </Stack>
                            </Stack>
                            {index < statisticsQuery.data.usersByMissionDays.length - 1 && <Divider sx={{ mt: 1 }} />}
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        Sem dados para exibir.
                      </Typography>
                    )}
                  </Collapse>
                  {!expandedStatsCards.usersByMissionDays && (
                    <Typography variant="caption" color="text.secondary">
                      Card comprimido. Clique na seta para expandir.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent sx={{ py: 1.2, px: 1.4 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Missões com Mais Participantes
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => toggleStatsCard('participantsByMission')}
                      aria-label="Expandir card de missões com mais participantes"
                    >
                      {expandedStatsCards.participantsByMission ? (
                        <KeyboardArrowUpRoundedIcon fontSize="small" />
                      ) : (
                        <KeyboardArrowDownRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Stack>
                  <Collapse in={expandedStatsCards.participantsByMission}>
                    {statisticsQuery.data.participantsByMission.length > 0 ? (
                      <Stack spacing={1} sx={{ mt: 0.6 }}>
                        {statisticsQuery.data.participantsByMission.map((item: any, index: number) => (
                          <Box key={item.missionId}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 0, flex: 1 }} noWrap>
                                {item.missionTitle}
                              </Typography>
                              <Stack direction="row" spacing={0.5}>
                                <Chip label={`${item.participantsCount} participantes`} size="small" color="secondary" />
                                <Chip label={`${item.missionDays} dias`} size="small" variant="outlined" color="secondary" />
                              </Stack>
                            </Stack>
                            {index < statisticsQuery.data.participantsByMission.length - 1 && <Divider sx={{ mt: 1 }} />}
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        Sem dados para exibir.
                      </Typography>
                    )}
                  </Collapse>
                  {!expandedStatsCards.participantsByMission && (
                    <Typography variant="caption" color="text.secondary">
                      Card comprimido. Clique na seta para expandir.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Buscar"
              value={q}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('q', event.target.value);
                else next.delete('q');
                setParams(next, { replace: true });
              }}
              sx={{ minWidth: 240 }}
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('localityId', event.target.value);
                else next.delete('localityId');
                setParams(next, { replace: true });
              }}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localityOptions.map((locality) => (
                <MenuItem key={locality.id} value={locality.id}>
                  {locality.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma missão"
              description={
                missionScope === 'CIPAVD'
                  ? 'Crie a primeira missão CIPAVD para iniciar o planejamento nesta frente.'
                  : 'Crie a primeira missão SMIF para iniciar o planejamento.'
              }
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Missão</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Localidade</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Período</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Participantes</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Itens de cronograma</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700, width: 90 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((mission: any) => (
                  <TableRow
                    key={mission.id}
                    hover
                    onClick={() => openMission(mission.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openMission(mission.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    sx={{
                      cursor: 'pointer',
                      '&:hover .mission-title': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography fontWeight={700} className="mission-title">
                        {mission.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mission.description || 'Sem descrição'}
                      </Typography>
                      <Typography variant="caption" color="primary.main" display="block">
                        Clique para abrir detalhes
                      </Typography>
                    </TableCell>
                    <TableCell>{mission.locality?.name ?? '-'}</TableCell>
                    <TableCell>
                      {formatDateOnlyPtBr(mission.startDate)} a{' '}
                      {formatDateOnlyPtBr(mission.endDate)}
                    </TableCell>
                    <TableCell>
                      <Chip label={String(mission.participantsCount ?? mission.participants?.length ?? 0)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={String(mission.scheduleItemsCount ?? mission.scheduleItems?.length ?? 0)} size="small" />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setMissionDeleteTarget({
                            id: String(mission.id),
                            title: String(mission.title ?? 'Missão'),
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', md: 'min(1100px, 96vw)' } } }}
      >
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              {isCreateMode ? `Nova missão (${scopeLabel})` : `Detalhes da missão (${scopeLabel})`}
            </Typography>
            <Stack direction="row" spacing={1}>
              {!isCreateMode && selectedMission && (
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() =>
                    setMissionDeleteTarget({
                      id: String(selectedMission.id),
                      title: String(selectedMission.title ?? 'Missão'),
                    })
                  }
                  disabled={deleteMission.isPending}
                >
                  Excluir
                </Button>
              )}
              <Button onClick={closeDrawer}>Fechar</Button>
            </Stack>
          </Stack>

          {!isCreateMode && missionDetailQuery.isLoading && <SkeletonState />}
          {!isCreateMode && missionDetailQuery.isError && (
            <ErrorState error={missionDetailQuery.error} onRetry={() => missionDetailQuery.refetch()} />
          )}

          {(isCreateMode || selectedMission) && (
            <>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} mb={1.2}>
                    Informações da missão
                  </Typography>
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      label="Título"
                      value={missionForm.title}
                      onChange={(event) => setMissionForm({ ...missionForm, title: event.target.value })}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Descrição"
                      value={missionForm.description}
                      onChange={(event) => setMissionForm({ ...missionForm, description: event.target.value })}
                      multiline
                      minRows={2}
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Localidade"
                        value={missionForm.localityId}
                        onChange={(event) => setMissionForm({ ...missionForm, localityId: event.target.value })}
                        sx={{ minWidth: 260 }}
                      >
                        {localityOptions.map((locality) => (
                          <MenuItem key={locality.id} value={locality.id}>
                            {locality.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        type="date"
                        label="Início"
                        value={missionForm.startDate}
                        onChange={(event) => setMissionForm({ ...missionForm, startDate: event.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 180 }}
                      />
                      <TextField
                        size="small"
                        type="date"
                        label="Término"
                        value={missionForm.endDate}
                        onChange={(event) => setMissionForm({ ...missionForm, endDate: event.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 180 }}
                      />
                    </Stack>
                    <TextField
                      select
                      size="small"
                      label="Clonar cronograma de"
                      value={cloneSourceMissionId}
                      onChange={(event) => setCloneSourceMissionId(event.target.value)}
                      helperText="Opcional. Ao salvar, os itens da missão selecionada serão adicionados ao cronograma."
                      fullWidth
                    >
                      <MenuItem value="">Não clonar</MenuItem>
                      {cloneMissionOptions.map((mission: any) => (
                        <MenuItem key={mission.id} value={String(mission.id)}>
                          {mission.title} ({formatDateOnlyPtBr(mission.startDate)} a {formatDateOnlyPtBr(mission.endDate)})
                        </MenuItem>
                      ))}
                    </TextField>
                    <Box display="flex" justifyContent="flex-end">
                      <Button
                        variant="contained"
                        onClick={handleSaveMission}
                        disabled={createMission.isPending || updateMission.isPending || createScheduleItem.isPending}
                      >
                        {isCreateMode ? 'Criar missão' : 'Salvar missão'}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {!isCreateMode && selectedMission && (
                <>
                  <Card sx={{ mb: 2 }}>
                    <CardContent sx={{ pb: '8px !important' }}>
                      <Tabs
                        value={missionTab}
                        onChange={(_, newValue) => setMissionTab(newValue)}
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Tab label="Participantes" />
                        <Tab label="Cronograma" />
                        <Tab label="Banners" />
                        <Tab label="Mapeamento Institucional" />
                      </Tabs>
                    </CardContent>
                  </Card>

                  {missionTab === 0 && (
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
                        Participantes
                      </Typography>

                      <Tabs value={participantTab} onChange={(_, newValue) => setParticipantTab(newValue)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Tab label="LDAP" />
                        <Tab label="Usuários do Sistema" />
                      </Tabs>

                      {participantTab === 0 && (
                        <Stack spacing={1.5}>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                            <TextField
                              size="small"
                              label="CPF ou e-mail"
                              value={ldapIdentifier}
                              onChange={(event) => setLdapIdentifier(event.target.value)}
                              fullWidth
                              placeholder="Digite CPF ou e-mail do LDAP"
                            />
                            <Button
                              variant="outlined"
                              startIcon={<PersonAddAlt1RoundedIcon />}
                              onClick={handleAddParticipantLdap}
                              disabled={!ldapIdentifier.trim() || addParticipantLdap.isPending}
                              sx={{ minWidth: 120 }}
                            >
                              Adicionar
                            </Button>
                          </Stack>
                          {lookupQuery.data?.item && (
                            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                <strong>LDAP:</strong> {lookupQuery.data.item.name || lookupQuery.data.item.uid}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {lookupQuery.data.item.email || 'sem e-mail'}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      )}

                      {participantTab === 1 && (
                        <Stack spacing={1.5}>
                          <Autocomplete
                            size="small"
                            options={filteredUsers}
                            getOptionLabel={(option: any) =>
                              option?.id ? String(option.name ?? '') : ''
                            }
                            isOptionEqualToValue={(option: any, value: any) => {
                              if (!option || !value) return false;
                              if (!option.id || !value.id) return false;
                              return String(option.id) === String(value.id);
                            }}
                            value={selectedUser}
                            onChange={(_, newValue: any) => {
                              if (newValue?.id) {
                                setSelectedUserId(String(newValue.id));
                                setUserSearch(newValue.name || '');
                              } else {
                                setSelectedUserId(null);
                                setUserSearch('');
                              }
                            }}
                            inputValue={userSearch}
                            onInputChange={(_, newInputValue) => {
                              setUserSearch(newInputValue);
                              if (!newInputValue) {
                                setSelectedUserId(null);
                              }
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Buscar usuário"
                                placeholder="Digite nome, e-mail ou CPF"
                              />
                            )}
                            loading={usersQuery.isLoading}
                            noOptionsText={userSearch.trim() ? 'Nenhum usuário encontrado' : 'Digite para buscar'}
                            fullWidth
                          />
                          <Button
                            variant="outlined"
                            startIcon={<PersonAddAlt1RoundedIcon />}
                            onClick={handleAddParticipantUser}
                            disabled={!selectedUserId || addParticipantUser.isPending}
                            fullWidth
                          >
                            Adicionar Participante
                          </Button>
                        </Stack>
                      )}

                      <Divider sx={{ my: 2 }} />

                      <Stack direction="row" spacing={1.5} sx={{ mt: 1.2 }} useFlexGap flexWrap="wrap">
                        {validParticipants.map((participant: any) => (
                          <Chip
                            key={participant.id}
                            label={`${participant.name || 'Sem nome'}${participant.email ? ` • ${participant.email}` : participant.cpf ? ` • ${participant.cpf}` : ''}`}
                            onDelete={() => handleRemoveParticipant(participant.id)}
                            size="small"
                            color="primary"
                            sx={{ mb: 0.5 }}
                          />
                        ))}
                        {validParticipants.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Nenhum participante cadastrado.
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                  )}

                  {missionTab === 1 && (
                  <Card>
                    <CardContent>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={1.2} gap={1}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          Cronograma da missão
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<DownloadRoundedIcon />}
                          onClick={async () => {
                            try {
                              await exportSchedulePdf.mutateAsync(selectedMission.id);
                              toast.push({ message: 'PDF exportado com sucesso.', severity: 'success' });
                            } catch (error) {
                              const parsed = parseApiError(error);
                              toast.push({
                                message: parsed.message || 'Não foi possível exportar o PDF. Faça login novamente e tente de novo.',
                                severity: 'error',
                              });
                            }
                          }}
                          disabled={exportSchedulePdf.isPending}
                        >
                          Exportar PDF
                        </Button>
                      </Stack>

                      <Stack spacing={1} mb={1.4}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                          <TextField
                            size="small"
                            label="Atividade"
                            value={scheduleForm.title}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, title: event.target.value })}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            type="datetime-local"
                            label="Início"
                            value={editingScheduleItemId ? scheduleForm.startAt : scheduleForm.startAt || nextScheduleStartAt}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, startAt: event.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ minWidth: 220 }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Duração (min)"
                            value={scheduleForm.durationMinutes}
                            onChange={(event) =>
                              setScheduleForm({ ...scheduleForm, durationMinutes: Number(event.target.value) || 0 })
                            }
                            inputProps={{ min: 1 }}
                            sx={{ minWidth: 150 }}
                          />
                        </Stack>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                          <TextField
                            size="small"
                            label="Local"
                            value={scheduleForm.location}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, location: event.target.value })}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            label="Responsável"
                            value={scheduleForm.responsible}
                            onChange={(event) => setScheduleForm({ ...scheduleForm, responsible: event.target.value })}
                            fullWidth
                          />
                        </Stack>
                        <TextField
                          size="small"
                          label="Participantes"
                          value={scheduleForm.participants}
                          onChange={(event) => setScheduleForm({ ...scheduleForm, participants: event.target.value })}
                          fullWidth
                          multiline
                          minRows={2}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            onClick={handleSaveScheduleItem}
                            disabled={createScheduleItem.isPending || updateScheduleItem.isPending}
                          >
                            {editingScheduleItemId ? 'Atualizar item' : 'Adicionar item'}
                          </Button>
                          {editingScheduleItemId && (
                            <Button
                              variant="text"
                              onClick={() => resetScheduleForm((selectedMission?.scheduleItems ?? []) as any[])}
                            >
                              Cancelar
                            </Button>
                          )}
                        </Stack>
                      </Stack>

                      <Divider sx={{ mb: 1.2 }} />

                      {(selectedMission.scheduleItems ?? []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhum item no cronograma da missão.
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ sm: 'center' }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              Selecione um ou mais itens para exclusão em lote.
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {selectedScheduleCount > 0 ? (
                                <Chip
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  label={`${selectedScheduleCount} selecionado(s)`}
                                />
                              ) : null}
                              <Button
                                variant="text"
                                color="inherit"
                                onClick={() => setSelectedScheduleItemIds([])}
                                disabled={selectedScheduleCount === 0}
                              >
                                Desfazer seleção
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={handleDeleteSelectedScheduleItems}
                                disabled={selectedScheduleCount === 0 || deleteScheduleItem.isPending}
                              >
                                Excluir selecionados
                              </Button>
                            </Stack>
                          </Stack>
                          {scheduleDayOptions.length > 0 ? (
                            <Stack
                              direction={{ xs: 'column', md: 'row' }}
                              spacing={1}
                              alignItems={{ xs: 'flex-start', md: 'center' }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                Selecionar apenas os itens do dia:
                              </Typography>
                              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                {scheduleDayOptions.map((option) => (
                                  <Chip
                                    key={option.key}
                                    size="small"
                                    clickable
                                    color={selectedScheduleDayKey === option.key ? 'primary' : 'default'}
                                    variant={selectedScheduleDayKey === option.key ? 'filled' : 'outlined'}
                                    label={`${option.label} (${option.ids.length})`}
                                    onClick={() => handleSelectScheduleItemsByDay(option.ids)}
                                  />
                                ))}
                              </Stack>
                            </Stack>
                          ) : null}

                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'primary.main' }}>
                                <TableCell padding="checkbox" sx={{ color: '#fff' }}>
                                  <Checkbox
                                    size="small"
                                    checked={allScheduleItemsSelected}
                                    indeterminate={someScheduleItemsSelected}
                                    onChange={handleToggleAllScheduleItems}
                                    sx={{
                                      color: '#fff',
                                      '&.Mui-checked': { color: '#fff' },
                                      '&.MuiCheckbox-indeterminate': { color: '#fff' },
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Horário</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Atividade</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Local</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Responsável</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Participantes</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Ações</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {missionScheduleItems.map((item: any) => {
                                const itemId = String(item.id);
                                const checked = selectedScheduleItemIds.includes(itemId);
                                return (
                                  <TableRow key={item.id} selected={checked}>
                                    <TableCell padding="checkbox">
                                      <Checkbox
                                        size="small"
                                        checked={checked}
                                        onChange={() => handleToggleScheduleItemSelection(itemId)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {new Date(item.startAt).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {item.durationMinutes} min
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{item.title}</TableCell>
                                    <TableCell>{item.location}</TableCell>
                                    <TableCell>{item.responsible}</TableCell>
                                    <TableCell sx={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{item.participants}</TableCell>
                                    <TableCell>
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          setEditingScheduleItemId(item.id);
                                          setScheduleForm({
                                            title: item.title ?? '',
                                            startAt: formatDateTimeLocalValue(item.startAt),
                                            durationMinutes: Number(item.durationMinutes ?? 60),
                                            location: item.location ?? '',
                                            responsible: item.responsible ?? '',
                                            participants: item.participants ?? '',
                                          });
                                        }}
                                      >
                                        <EditOutlinedIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton size="small" color="error" onClick={() => handleDeleteScheduleItem(itemId, item.title ?? 'Item de cronograma')}>
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                  )}

                  {missionTab === 2 && (
                    <Card sx={{ mb: 2 }}>
                      <CardContent>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'stretch', md: 'center' }}
                          spacing={1.5}
                          mb={1.8}
                        >
                          <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                              Banners da missão
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Preencha data, hora e local nas posições padronizadas do banner CIPAVD e baixe em imagem ou PDF.
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            startIcon={<AddRoundedIcon />}
                            onClick={handleStartCreateBanner}
                          >
                            Novo banner
                          </Button>
                        </Stack>

                        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2}>
                          <Stack spacing={1.5} sx={{ flex: 1.1 }}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography variant="subtitle2" fontWeight={700} mb={1.2}>
                                  {editingBannerId ? 'Editar banner' : 'Criar banner'}
                                </Typography>
                                <Stack spacing={1}>
                                  <Autocomplete
                                    size="small"
                                    options={missionBannerPresetOptions}
                                    value={
                                      missionBannerPresetOptions.find(
                                        (option) => option.id === selectedBannerPresetId,
                                      ) ?? null
                                    }
                                    onChange={(_, value) => handleApplyBannerPreset(value)}
                                    isOptionEqualToValue={(option, value) =>
                                      option.id === value.id
                                    }
                                    getOptionLabel={(option) => option.label}
                                    noOptionsText="Esta missão ainda não possui itens no cronograma."
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label="Usar item do cronograma como base"
                                        helperText="Preenche data, hora e local com base em um item já cadastrado no cronograma da missão."
                                      />
                                    )}
                                    fullWidth
                                  />
                                  <TextField
                                    size="small"
                                    label="Nome do banner"
                                    value={bannerForm.name}
                                    onChange={(event) =>
                                      setBannerForm((current) => ({
                                        ...current,
                                        name: event.target.value,
                                      }))
                                    }
                                    fullWidth
                                  />
                                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                                    <TextField
                                      size="small"
                                      type="date"
                                      label="Data"
                                      value={bannerForm.eventDate}
                                      onChange={(event) =>
                                        setBannerForm((current) => ({
                                          ...current,
                                          eventDate: event.target.value,
                                        }))
                                      }
                                      InputLabelProps={{ shrink: true }}
                                      sx={{ minWidth: 180 }}
                                    />
                                    <TextField
                                      size="small"
                                      type="time"
                                      label="Hora"
                                      value={bannerForm.eventTime}
                                      onChange={(event) =>
                                        setBannerForm((current) => ({
                                          ...current,
                                          eventTime: event.target.value,
                                        }))
                                      }
                                      InputLabelProps={{ shrink: true }}
                                      sx={{ minWidth: 180 }}
                                    />
                                  </Stack>
                                  <TextField
                                    size="small"
                                    label="Local principal"
                                    value={bannerForm.locationPrimary}
                                    onChange={(event) =>
                                      setBannerForm((current) => ({
                                        ...current,
                                        locationPrimary: event.target.value,
                                      }))
                                    }
                                    fullWidth
                                    helperText="Linha principal exibida ao lado do ícone de local."
                                  />
                                  <TextField
                                    size="small"
                                    label="Complemento do local"
                                    value={bannerForm.locationSecondary}
                                    onChange={(event) =>
                                      setBannerForm((current) => ({
                                        ...current,
                                        locationSecondary: event.target.value,
                                      }))
                                    }
                                    fullWidth
                                    helperText="Opcional. Se vazio, o sistema tenta ajustar o local automaticamente em duas linhas."
                                  />
                                  <Stack direction="row" spacing={1}>
                                    <Button
                                      variant="contained"
                                      onClick={handleSaveBanner}
                                      disabled={
                                        createMissionBanner.isPending ||
                                        updateMissionBanner.isPending
                                      }
                                    >
                                      {editingBannerId ? 'Salvar banner' : 'Criar banner'}
                                    </Button>
                                    {(editingBannerId || bannerForm.name || bannerForm.eventDate || bannerForm.eventTime || bannerForm.locationPrimary || bannerForm.locationSecondary) && (
                                      <Button variant="text" onClick={resetBannerForm}>
                                        Limpar
                                      </Button>
                                    )}
                                  </Stack>
                                </Stack>
                              </CardContent>
                            </Card>

                            <Card variant="outlined">
                              <CardContent>
                                <Stack
                                  direction={{ xs: 'column', md: 'row' }}
                                  justifyContent="space-between"
                                  alignItems={{ xs: 'stretch', md: 'center' }}
                                  spacing={1}
                                  mb={1.1}
                                >
                                  <Typography variant="subtitle2" fontWeight={700}>
                                    Banners cadastrados
                                  </Typography>
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`${missionBanners.length} banner(s)`}
                                  />
                                </Stack>
                                {missionBanners.length === 0 ? (
                                  <Typography variant="body2" color="text.secondary">
                                    Nenhum banner cadastrado para esta missão.
                                  </Typography>
                                ) : (
                                  <Stack spacing={1}>
                                    {missionBanners.map((banner: any) => {
                                      const isSelected =
                                        String(editingBannerId ?? '') ===
                                        String(banner.id);
                                      return (
                                        <Card
                                          key={banner.id}
                                          variant="outlined"
                                          sx={{
                                            borderColor: isSelected
                                              ? 'primary.main'
                                              : 'divider',
                                          }}
                                        >
                                          <CardContent sx={{ py: 1.3, '&:last-child': { pb: 1.3 } }}>
                                            <Stack
                                              direction={{ xs: 'column', md: 'row' }}
                                              justifyContent="space-between"
                                              alignItems={{ xs: 'stretch', md: 'flex-start' }}
                                              spacing={1}
                                            >
                                              <Box>
                                                <Typography variant="body2" fontWeight={700}>
                                                  {banner.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  {formatBannerDateAndWeekday(banner.eventDate)} • {banner.eventTime}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  {buildMissionBannerLocationLabel(
                                                    banner.locationPrimary,
                                                    banner.locationSecondary,
                                                  )}
                                                </Typography>
                                              </Box>
                                              <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                                                <Button
                                                  size="small"
                                                  variant={isSelected ? 'contained' : 'outlined'}
                                                  onClick={() => handleEditBanner(banner)}
                                                >
                                                  Editar
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  startIcon={<DownloadRoundedIcon />}
                                                  onClick={() =>
                                                    handleDownloadBanner(String(banner.id), 'png')
                                                  }
                                                >
                                                  PNG
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  startIcon={<DownloadRoundedIcon />}
                                                  onClick={() =>
                                                    handleDownloadBanner(String(banner.id), 'pdf')
                                                  }
                                                >
                                                  PDF
                                                </Button>
                                                <Button
                                                  size="small"
                                                  color="error"
                                                  variant="outlined"
                                                  startIcon={<DeleteOutlineIcon />}
                                                  onClick={() => handleDeleteBanner(banner)}
                                                >
                                                  Excluir
                                                </Button>
                                              </Stack>
                                            </Stack>
                                          </CardContent>
                                        </Card>
                                      );
                                    })}
                                  </Stack>
                                )}
                              </CardContent>
                            </Card>
                          </Stack>

                          <Card variant="outlined" sx={{ flex: 0.9 }}>
                            <CardContent>
                              <Typography variant="subtitle2" fontWeight={700} mb={1.2}>
                                Editor visual do banner
                              </Typography>
                              <MissionBannerLayoutEditor
                                eventDate={bannerForm.eventDate}
                                eventTime={bannerForm.eventTime}
                                locationPrimary={bannerForm.locationPrimary}
                                locationSecondary={bannerForm.locationSecondary}
                                layoutOverrides={bannerForm.layoutOverrides}
                                onChange={(next) =>
                                  setBannerForm((current) => ({
                                    ...current,
                                    layoutOverrides: next,
                                  }))
                                }
                              />
                            </CardContent>
                          </Card>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}

                  {missionTab === 3 && (
                    <Card>
                      <CardContent>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'stretch', md: 'center' }}
                          mb={1.5}
                          gap={1}
                        >
                          <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                              Mapeamento institucional da missão
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Selecione a OM de referência do mapeamento institucional. Essa OM será usada como coluna no mapeamento institucional do SMIF.
                            </Typography>
                          </Box>
                          <Stack spacing={0.7} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
                            <TextField
                              select
                              size="small"
                              label="OM do mapeamento"
                              value={checklistOmId}
                              onChange={(event) => handleChecklistOmChange(event.target.value)}
                              sx={{ minWidth: { xs: '100%', sm: 260 } }}
                            >
                              <MenuItem value="">Selecione</MenuItem>
                              {checklistOmOptions.map((option) => (
                                <MenuItem key={option.id} value={option.id}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </TextField>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={handleSaveChecklist}
                              disabled={
                                updateMissionChecklist.isPending ||
                                !checklistDirty ||
                                !checklistOmId
                              }
                              sx={{
                                alignSelf: { xs: 'stretch', sm: 'flex-end' },
                                minHeight: 30,
                                px: 1.4,
                                py: 0.35,
                              }}
                            >
                              Salvar mapeamento
                            </Button>
                          </Stack>
                        </Stack>

                        {missionChecklistQuery.isLoading && <LinearProgress sx={{ mb: 1.5 }} />}
                        {missionChecklistQuery.isError && (
                          <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
                            Não foi possível carregar o mapeamento institucional da missão.
                          </Typography>
                        )}

                        <Stack spacing={1.6}>
                          {missionChecklistSections.map((section) => (
                            <Card key={section.id} variant="outlined">
                              <CardContent>
                                <Typography variant="subtitle1" fontWeight={700} mb={1.1}>
                                  {section.title}
                                </Typography>
                                <Stack spacing={1.2}>
                                  {section.items.map((item) => {
                                    const current = checklistState[item.id] ?? {
                                      classification: checklistDefaultClassification,
                                      notes: '',
                                      photos: [],
                                    };
                                    const classificationMeta =
                                      checklistClassificationMap.get(current.classification) ??
                                      fallbackChecklistClassificationMeta[current.classification];
                                    const classificationColor =
                                      normalizeChecklistColorHex(
                                        classificationMeta?.colorHex,
                                      ) ?? '#475569';
                                    const classificationBg =
                                      normalizeChecklistColorHex(
                                        classificationMeta?.colorHex,
                                      )
                                        ? hexToRgba(classificationColor, 0.13)
                                        : '#F8FAFC';
                                    return (
                                      <Box
                                        key={item.id}
                                        sx={{
                                          border: 1,
                                          borderColor: 'divider',
                                          borderRadius: 1.2,
                                          p: 1.2,
                                        }}
                                      >
                                        <Typography variant="body2" fontWeight={700}>
                                          {item.title}
                                        </Typography>
                                        {item.prompt && (
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.4 }}
                                          >
                                            {item.prompt}
                                          </Typography>
                                        )}
                                        <Stack
                                          direction={{ xs: 'column', md: 'row' }}
                                          spacing={1}
                                          sx={{ mt: 1.1 }}
                                        >
                                          <TextField
                                            select
                                            size="small"
                                            label="Classificação"
                                            value={current.classification}
                                            onChange={(event) =>
                                              handleChecklistClassificationChange(
                                                item.id,
                                                event.target.value as MissionChecklistClassification,
                                              )
                                            }
                                            sx={{
                                              minWidth: { xs: '100%', md: 360 },
                                              '& .MuiOutlinedInput-root': {
                                                backgroundColor: classificationBg,
                                              },
                                              '& .MuiSelect-select': {
                                                color: classificationColor,
                                                fontWeight: 700,
                                              },
                                            }}
                                          >
                                            {checklistClassificationEntries.map((entry) => {
                                              const optionColor =
                                                normalizeChecklistColorHex(
                                                  entry.colorHex,
                                                ) ?? '#475569';
                                              return (
                                              <MenuItem
                                                key={entry.id}
                                                value={entry.id}
                                                sx={{ color: optionColor, fontWeight: 700 }}
                                              >
                                                {entry.label}
                                              </MenuItem>
                                              );
                                            })}
                                          </TextField>
                                          <TextField
                                            size="small"
                                            label="Observações"
                                            value={current.notes}
                                            onChange={(event) =>
                                              handleChecklistNotesChange(item.id, event.target.value)
                                            }
                                            multiline
                                            minRows={2}
                                            fullWidth
                                          />
                                        </Stack>
                                        <Stack
                                          direction={{ xs: 'column', md: 'row' }}
                                          spacing={1}
                                          alignItems={{ xs: 'stretch', md: 'center' }}
                                          sx={{ mt: 1 }}
                                        >
                                          <Button
                                            component="label"
                                            variant="outlined"
                                            size="small"
                                            disabled={uploadMissionChecklistPhoto.isPending}
                                            sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}
                                          >
                                            {uploadMissionChecklistPhoto.isPending
                                              ? 'Enviando foto...'
                                              : 'Adicionar foto'}
                                            <input
                                              type="file"
                                              accept="image/*"
                                              hidden
                                              onChange={(event) => {
                                                const file = event.target.files?.[0] ?? null;
                                                void handleChecklistPhotoUpload(item.id, file);
                                                event.currentTarget.value = '';
                                              }}
                                            />
                                          </Button>
                                          <Typography variant="caption" color="text.secondary">
                                            Fotos aparecem no detalhamento do item no SMIF.
                                          </Typography>
                                        </Stack>
                                        {(current.photos ?? []).length > 0 ? (
                                          <Stack
                                            direction="row"
                                            spacing={0.8}
                                            flexWrap="wrap"
                                            useFlexGap
                                            sx={{ mt: 1 }}
                                          >
                                            {(current.photos ?? []).map((photoUrl) => {
                                              const resolvedUrl =
                                                resolveChecklistPhotoUrl(photoUrl);
                                              return (
                                                <Box
                                                  key={photoUrl}
                                                sx={{
                                                  width: 92,
                                                  height: 68,
                                                  borderRadius: 1,
                                                  overflow: 'hidden',
                                                  border: '1px solid rgba(15,23,42,0.18)',
                                                  position: 'relative',
                                                  bgcolor: '#E2E8F0',
                                                }}
                                              >
                                                <Box
                                                  component="img"
                                                  src={resolvedUrl}
                                                  alt="Foto do mapeamento"
                                                  sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                  }}
                                                />
                                                <IconButton
                                                  size="small"
                                                  color="error"
                                                  onClick={() =>
                                                    handleChecklistPhotoRemove(
                                                      item.id,
                                                      photoUrl,
                                                    )
                                                  }
                                                  sx={{
                                                    position: 'absolute',
                                                    top: 2,
                                                    right: 2,
                                                    bgcolor: 'rgba(255,255,255,0.9)',
                                                    '&:hover': {
                                                      bgcolor: 'rgba(255,255,255,1)',
                                                    },
                                                  }}
                                                >
                                                  <DeleteOutlineIcon fontSize="inherit" />
                                                </IconButton>
                                              </Box>
                                            );})}
                                          </Stack>
                                        ) : null}
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </CardContent>
                            </Card>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={statsSectionEditorOpen}
        onClose={() => setStatsSectionEditorOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Card Estatísticas de Missões</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Título"
              value={statsSectionDraft.title}
              onChange={(e) =>
                setStatsSectionDraft((prev) => ({ ...prev, title: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Descrição"
              value={statsSectionDraft.description}
              onChange={(e) =>
                setStatsSectionDraft((prev) => ({ ...prev, description: e.target.value }))
              }
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsSectionEditorOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveStatsSectionEditor}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(missionDeleteTarget)}
        onCancel={() => setMissionDeleteTarget(null)}
        onConfirm={handleDeleteMission}
        title="Excluir missão"
        message="Confirma a exclusão definitiva desta missão?"
        highlightText={missionDeleteTarget?.title ?? ''}
        note="Esta ação também remove participantes e itens de cronograma vinculados."
        confirmLabel="Excluir missão"
        severity="error"
        confirmLoading={deleteMission.isPending}
      />

      <ConfirmDialog
        open={Boolean(bannerDeleteTarget)}
        onCancel={() => setBannerDeleteTarget(null)}
        onConfirm={handleConfirmDeleteBanner}
        title="Excluir banner"
        message="Confirma a exclusão definitiva deste banner da missão?"
        highlightText={bannerDeleteTarget?.name ?? ''}
        note="Você poderá criar outro banner para a missão a qualquer momento."
        confirmLabel="Excluir banner"
        severity="error"
        confirmLoading={deleteMissionBanner.isPending}
      />

      <ConfirmDialog
        open={Boolean(scheduleDeleteTarget)}
        onCancel={() => setScheduleDeleteTarget(null)}
        onConfirm={handleConfirmDeleteScheduleItem}
        title={
          scheduleDeleteTarget?.count && scheduleDeleteTarget.count > 1
            ? 'Excluir itens do cronograma'
            : 'Excluir item do cronograma'
        }
        message={
          scheduleDeleteTarget?.count && scheduleDeleteTarget.count > 1
            ? `Deseja remover os ${scheduleDeleteTarget.count} itens selecionados do cronograma?`
            : 'Deseja remover este item do cronograma?'
        }
        highlightText={
          scheduleDeleteTarget?.count && scheduleDeleteTarget.count > 1
            ? `${scheduleDeleteTarget.count} itens selecionados`
            : scheduleDeleteTarget?.title ?? ''
        }
        note={
          scheduleDeleteTarget?.count && scheduleDeleteTarget.count > 1 ? (
            <Stack spacing={0.8}>
              <Typography variant="body2" fontWeight={700}>
                Itens que serão excluídos:
              </Typography>
              <Stack spacing={0.4}>
                {scheduleDeleteSummaryTitles.slice(0, 6).map((title, index) => (
                  <Typography key={`${title}-${index}`} variant="body2" color="text.secondary">
                    {index + 1}. {title}
                  </Typography>
                ))}
                {scheduleDeleteSummaryTitles.length > 6 ? (
                  <Typography variant="caption" color="text.secondary">
                    ... e mais {scheduleDeleteSummaryTitles.length - 6} item(ns).
                  </Typography>
                ) : null}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                A exclusão é permanente.
              </Typography>
            </Stack>
          ) : (
            'A exclusão é permanente.'
          )
        }
        confirmLabel={
          scheduleDeleteTarget?.count && scheduleDeleteTarget.count > 1
            ? 'Excluir itens'
            : 'Excluir item'
        }
        severity="error"
        confirmLoading={deleteScheduleItem.isPending}
      />
    </Box>
  );
}
