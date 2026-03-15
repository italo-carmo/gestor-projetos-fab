import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
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
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddMissionParticipantFromLdap,
  useAddMissionParticipantFromUser,
  useCreateMission,
  useCreateMissionScheduleItem,
  useDeleteMission,
  useDeleteMissionScheduleItem,
  useExportMissionSchedulePdf,
  useLocalities,
  useLookupMissionLdapParticipant,
  useMission,
  useMissionChecklist,
  useMissionStatistics,
  useMissions,
  useOmsCatalog,
  useRemoveMissionParticipant,
  useUpdateMissionChecklist,
  useUpdateMission,
  useUpdateMissionScheduleItem,
  useUsers,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { selectTargetLocalities } from '../constants/localities';

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

type MissionChecklistClassification =
  | 'FORTE_CONSOLIDADA'
  | 'OPORTUNIDADE_MELHORIA'
  | 'NECESSITA_ANALISE'
  | 'POSSIVEL_RISCO';

type MissionChecklistItemState = {
  classification: MissionChecklistClassification;
  notes: string;
};

type MissionChecklistItemConfig = {
  id: string;
  title: string;
  prompt?: string;
};

type MissionChecklistSectionConfig = {
  id: string;
  title: string;
  items: MissionChecklistItemConfig[];
};

const checklistClassificationMeta: Record<
  MissionChecklistClassification,
  { label: string; color: string; bgColor: string }
> = {
  FORTE_CONSOLIDADA: {
    label: 'Dimensão forte/consolidada',
    color: '#1b5e20',
    bgColor: '#e8f5e9',
  },
  OPORTUNIDADE_MELHORIA: {
    label: 'Dimensão com oportunidades de melhoria',
    color: '#8a5800',
    bgColor: '#fff8e1',
  },
  NECESSITA_ANALISE: {
    label: 'Dimensão necessita de maior análise',
    color: '#334155',
    bgColor: '#f1f5f9',
  },
  POSSIVEL_RISCO: {
    label: 'Possível risco',
    color: '#b71c1c',
    bgColor: '#ffebee',
  },
};

const checklistClassificationEntries = Object.entries(
  checklistClassificationMeta,
) as Array<
  [MissionChecklistClassification, { label: string; color: string; bgColor: string }]
>;

const missionChecklistSections: MissionChecklistSectionConfig[] = [
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

const missionChecklistItems = missionChecklistSections.flatMap((section) =>
  section.items.map((item) => item.id),
);
const missionChecklistItemSet = new Set<string>(missionChecklistItems);

function buildDefaultMissionChecklistState(): Record<string, MissionChecklistItemState> {
  return missionChecklistItems.reduce<Record<string, MissionChecklistItemState>>(
    (acc, itemId) => {
      acc[itemId] = {
        classification: 'NECESSITA_ANALISE',
        notes: '',
      };
      return acc;
    },
    {},
  );
}

function isMissionChecklistClassification(value: string): value is MissionChecklistClassification {
  return Object.hasOwn(checklistClassificationMeta, value);
}

function buildMissionChecklistStateFromApi(data: any): Record<string, MissionChecklistItemState> {
  const base = buildDefaultMissionChecklistState();
  const sections = Array.isArray(data?.sections) ? data.sections : [];

  for (const section of sections) {
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const item of items) {
      const itemId = String(item?.id ?? '');
      if (!missionChecklistItemSet.has(itemId)) continue;
      const classificationRaw = String(item?.classification ?? '');
      const classification = isMissionChecklistClassification(classificationRaw)
        ? classificationRaw
        : 'NECESSITA_ANALISE';
      base[itemId] = {
        classification,
        notes: String(item?.notes ?? ''),
      };
    }
  }

  return base;
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

export function MissionsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const missionIdFromUrl = params.get('missionId') ?? '';
  const localityId = params.get('localityId') ?? '';
  const q = params.get('q') ?? '';

  const missionsQuery = useMissions({ localityId: localityId || undefined, q: q || undefined });
  const localitiesQuery = useLocalities();
  const omsCatalogQuery = useOmsCatalog();
  const missionDetailQuery = useMission(missionIdFromUrl, Boolean(missionIdFromUrl));
  const cloneMissionOptionsQuery = useMissions({ pageSize: '200' });
  const statisticsQuery = useMissionStatistics();

  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const addParticipantLdap = useAddMissionParticipantFromLdap();
  const addParticipantUser = useAddMissionParticipantFromUser();
  const removeParticipant = useRemoveMissionParticipant();
  const usersQuery = useUsers();
  const createScheduleItem = useCreateMissionScheduleItem();
  const updateScheduleItem = useUpdateMissionScheduleItem();
  const deleteScheduleItem = useDeleteMissionScheduleItem();
  const exportSchedulePdf = useExportMissionSchedulePdf();
  const updateMissionChecklist = useUpdateMissionChecklist();

  const [drawerOpen, setDrawerOpen] = useState(Boolean(missionIdFromUrl));
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [missionTab, setMissionTab] = useState(0);
  const [missionForm, setMissionForm] = useState(blankMissionForm);
  const [ldapIdentifier, setLdapIdentifier] = useState('');
  const [participantTab, setParticipantTab] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState(blankScheduleForm);
  const [editingScheduleItemId, setEditingScheduleItemId] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<Record<string, MissionChecklistItemState>>(
    () => buildDefaultMissionChecklistState(),
  );
  const [checklistOmId, setChecklistOmId] = useState('');
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [cloneSourceMissionId, setCloneSourceMissionId] = useState('');
  const [missionDeleteTarget, setMissionDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [scheduleDeleteTarget, setScheduleDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const lookupQuery = useLookupMissionLdapParticipant(ldapIdentifier);

  const localityOptions = useMemo(
    () =>
      selectTargetLocalities((localitiesQuery.data?.items ?? []) as any[])
        .filter((locality: any) => Number(locality?.recruitsFemaleCountCurrent ?? 0) > 0)
        .map((locality: any) => ({ id: String(locality.id), name: String(locality.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [localitiesQuery.data?.items],
  );
  const checklistOmOptions = useMemo(
    () =>
      ((omsCatalogQuery.data?.items ?? []) as Array<any>)
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
      }>,
    [omsCatalogQuery.data?.items],
  );

  const items = missionsQuery.data?.items ?? [];
  const selectedMission = missionDetailQuery.data ?? null;
  const missionChecklistQuery = useMissionChecklist(
    String(selectedMission?.id ?? ''),
    Boolean(selectedMission?.id) && !isCreateMode,
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

  const resetScheduleForm = useCallback((scheduleItems?: any[] | null) => {
    setEditingScheduleItemId(null);
    setScheduleForm(buildBlankScheduleForm(scheduleItems));
  }, []);

  useEffect(() => {
    if (!missionIdFromUrl) {
      setDrawerOpen(false);
      setMissionTab(0);
      if (!isCreateMode) {
        resetScheduleForm();
      }
      return;
    }
    setDrawerOpen(true);
    setIsCreateMode(false);
  }, [isCreateMode, missionIdFromUrl, resetScheduleForm]);

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
      setChecklistState(buildDefaultMissionChecklistState());
      setChecklistOmId('');
      setChecklistDirty(false);
      return;
    }
    setChecklistState(buildDefaultMissionChecklistState());
    setChecklistOmId(String(selectedMission.localityId ?? '').trim());
    setChecklistDirty(false);
  }, [selectedMission?.id, selectedMission?.localityId]);

  useEffect(() => {
    if (!selectedMission?.id) return;
    if (!missionChecklistQuery.data) return;
    setChecklistState(buildMissionChecklistStateFromApi(missionChecklistQuery.data));
    const apiOmId = String((missionChecklistQuery.data as any)?.omId ?? '').trim();
    const fallbackOmId = String(selectedMission.localityId ?? '').trim();
    setChecklistOmId(apiOmId || fallbackOmId);
    setChecklistDirty(false);
  }, [missionChecklistQuery.data, selectedMission?.id, selectedMission?.localityId]);

  const openCreate = () => {
    setIsCreateMode(true);
    setMissionTab(0);
    setMissionForm({
      ...blankMissionForm,
      localityId: localityId || localityOptions[0]?.id || '',
    });
    setLdapIdentifier('');
    setChecklistState(buildDefaultMissionChecklistState());
    setChecklistOmId(localityId || localityOptions[0]?.id || '');
    setChecklistDirty(false);
    resetScheduleForm();
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
    setChecklistState(buildDefaultMissionChecklistState());
    setChecklistOmId('');
    setChecklistDirty(false);
    setCloneSourceMissionId('');
    setMissionDeleteTarget(null);
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
    setScheduleDeleteTarget({ id: itemId, title: itemTitle });
  };

  const handleConfirmDeleteScheduleItem = async () => {
    if (!selectedMission) return;
    if (!scheduleDeleteTarget) return;

    try {
      await deleteScheduleItem.mutateAsync({ id: selectedMission.id, itemId: scheduleDeleteTarget.id });
      toast.push({ message: 'Item removido.', severity: 'success' });
      const nextScheduleItems = ((selectedMission.scheduleItems ?? []) as any[]).filter(
        (item: any) => item.id !== scheduleDeleteTarget.id,
      );
      if (editingScheduleItemId === scheduleDeleteTarget.id) {
        resetScheduleForm(nextScheduleItems);
      } else {
        setScheduleForm((current) => (isScheduleFormEmpty(current) ? buildBlankScheduleForm(nextScheduleItems) : current));
      }
      setScheduleDeleteTarget(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao remover item.', severity: 'error' });
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
      },
    }));
    setChecklistDirty(true);
  };

  const handleChecklistNotesChange = (itemId: string, notes: string) => {
    setChecklistState((current) => ({
      ...current,
      [itemId]: {
        classification: current[itemId]?.classification ?? 'NECESSITA_ANALISE',
        notes,
      },
    }));
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
      toast.push({ message: 'Selecione a OM do checklist antes de salvar.', severity: 'error' });
      return;
    }

    try {
      await updateMissionChecklist.mutateAsync({
        id: String(selectedMission.id),
        payload: {
          omId: normalizedChecklistOmId,
          items: missionChecklistItems.map((itemId) => ({
            id: itemId,
            classification: checklistState[itemId]?.classification ?? 'NECESSITA_ANALISE',
            notes: checklistState[itemId]?.notes ?? '',
          })),
        },
      });
      setChecklistDirty(false);
      toast.push({ message: 'Checklist da missão salvo.', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar checklist.', severity: 'error' });
    }
  };

  if (missionsQuery.isLoading) return <SkeletonState />;
  if (missionsQuery.isError) return <ErrorState error={missionsQuery.error} onRetry={() => missionsQuery.refetch()} />;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={2} gap={1.2}>
        <Box>
          <Typography variant="h4">Missões</Typography>
          <Typography variant="body2" color="text.secondary">
            Planejamento completo da missão, participantes via LDAP e cronograma oficial com exportação em PDF.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
          Nova missão
        </Button>
      </Stack>

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
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Estatísticas de Missões
            </Typography>

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
                  <Typography variant="caption" color="text.secondary">Dias-Pessoa em Missão</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {statisticsQuery.data.totalParticipantDays}
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
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 1.2,
              }}
            >
              {statisticsQuery.data.missionsByUser.length > 0 && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4, px: 1.6 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Usuários com Mais Missões
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 0.8 }}>
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
                  </CardContent>
                </Card>
              )}

              {statisticsQuery.data.usersByMissionDays.length > 0 && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4, px: 1.6 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Usuários com Mais Dias em Missão
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 0.8 }}>
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
                  </CardContent>
                </Card>
              )}

              {statisticsQuery.data.participantsByMission.length > 0 && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4, px: 1.6 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Missões com Mais Participantes
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 0.8 }}>
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
                  </CardContent>
                </Card>
              )}
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
            <EmptyState title="Nenhuma missão" description="Crie a primeira missão para iniciar o planejamento." />
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
            <Typography variant="h6">{isCreateMode ? 'Nova missão' : 'Detalhes da missão'}</Typography>
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
                        <Tab label="Checklist" />
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
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'primary.main' }}>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Horário</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Atividade</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Local</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Responsável</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Participantes</TableCell>
                              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Ações</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(selectedMission.scheduleItems ?? []).map((item: any) => (
                              <TableRow key={item.id}>
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
                                  <IconButton size="small" color="error" onClick={() => handleDeleteScheduleItem(item.id, item.title ?? 'Item de cronograma')}>
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
                  )}

                  {missionTab === 2 && (
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
                              Checklist da missão
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Selecione a OM de referência do checklist. Essa OM será usada como coluna no mapeamento institucional do SMIF.
                            </Typography>
                          </Box>
                          <Stack spacing={0.7} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
                            <TextField
                              select
                              size="small"
                              label="OM do checklist"
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
                              Salvar checklist
                            </Button>
                          </Stack>
                        </Stack>

                        {missionChecklistQuery.isLoading && <LinearProgress sx={{ mb: 1.5 }} />}
                        {missionChecklistQuery.isError && (
                          <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
                            Não foi possível carregar o checklist da missão.
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
                                      classification: 'NECESSITA_ANALISE',
                                      notes: '',
                                    };
                                    const classificationMeta = checklistClassificationMeta[current.classification];
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
                                                backgroundColor: classificationMeta.bgColor,
                                              },
                                              '& .MuiSelect-select': {
                                                color: classificationMeta.color,
                                                fontWeight: 700,
                                              },
                                            }}
                                          >
                                            {checklistClassificationEntries.map(([value, meta]) => (
                                              <MenuItem
                                                key={value}
                                                value={value}
                                                sx={{ color: meta.color, fontWeight: 700 }}
                                              >
                                                {meta.label}
                                              </MenuItem>
                                            ))}
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
        open={Boolean(scheduleDeleteTarget)}
        onCancel={() => setScheduleDeleteTarget(null)}
        onConfirm={handleConfirmDeleteScheduleItem}
        title="Excluir item do cronograma"
        message="Deseja remover este item do cronograma?"
        highlightText={scheduleDeleteTarget?.title ?? ''}
        note="A exclusão é permanente."
        confirmLabel="Excluir item"
        severity="error"
        confirmLoading={deleteScheduleItem.isPending}
      />
    </Box>
  );
}
