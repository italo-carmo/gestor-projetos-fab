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
  Checkbox,
  Drawer,
  IconButton,
  InputAdornment,
  FormControlLabel,
  MenuItem,
  Paper,
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
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import TextSnippetRoundedIcon from '@mui/icons-material/TextSnippetRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useCallback, useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  useAiSettings,
  useComgepScoringSettings,
  useEmailSettings,
  useMe,
  usePhases,
  useSelectableKnowledgeBases,
  useUpdateAiSettings,
  useUpdateComgepScoringSettings,
  useUpdateEmailSettings,
  useUpdatePhase,
  useTestAiConnection,
  type AdminKnowledgeBase,
  type AiAnalysisSourceSelection,
  type AiAnalysisType,
  type AiKnowledgeSourceId,
  type AiProfileFeatureId,
  type AiProfileFeatureSelection,
  type AiSettingsPatch,
  type AiSettingsResponse,
  type ComgepScoringGroupId,
  type ComgepScoringSettingItem,
  type ComgepScoringSettingsPatch,
  type ComgepScoringWeightKey,
} from '../api/hooks';
import {
  useCreatePosto,
  useCreateMissionChecklistDimension,
  useDeletePosto,
  useDeleteMissionChecklistDimension,
  useMissionChecklistConfig,
  usePostos,
  useUpdateMissionChecklistClassification,
  useUpdateMissionChecklistDimension,
  useUpdatePosto,
} from '../api/hooks';
import {
  useCipavdLocalities,
  useCreateCipavdLocality,
  useDeleteCipavdLocality,
  useUpdateCipavdLocality,
  useCreateLocality,
  useDeleteLocality,
  useCreateEloRole,
  useDeleteEloRole,
  useEloRoles,
  useLocalities,
  useUpdateLocality,
  useUpdateEloRole,
} from '../api/hooks';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from '../app/roleAccess';
import { normalizeEmailSettingDraft } from '../features/adminUsers';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { useSearchParams } from 'react-router-dom';
import { getTargetLocalityKey, selectTargetLocalities } from '../constants/localities';
import { BiNormalizationTab } from '../components/admin/BiNormalizationTab';
import { KnowledgeBasesTab } from '../components/admin/KnowledgeBasesTab';

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

const ANALYSIS_SOURCE_CATALOG: Array<{
  id: AiKnowledgeSourceId;
  label: string;
  description: string;
}> = [
  { id: 'missions', label: 'Missões', description: 'Missões do sistema.' },
  {
    id: 'activities_smif',
    label: 'Atividades de campo SMIF',
    description: 'Atividades de campo no escopo SMIF.',
  },
  {
    id: 'activities_cipavd',
    label: 'Atividades de campo CIPAVD',
    description: 'Atividades de campo no escopo CIPAVD.',
  },
  {
    id: 'activity_reports',
    label: 'Relatórios de atividades de campo',
    description: 'Relatórios técnicos e observações de campo.',
  },
  {
    id: 'best_practices',
    label: 'Boas práticas',
    description: 'Registros de boas práticas do sistema.',
  },
  {
    id: 'tasks',
    label: 'Tarefas',
    description: 'Tarefas por localidade, status e prazos.',
  },
  {
    id: 'survey_schools',
    label: 'Pesquisas de escolas',
    description: 'Pesquisas institucionais de escolas.',
  },
  {
    id: 'survey_domestic_violence',
    label: 'Pesquisas de violência doméstica',
    description: 'Respostas e indicadores de violência doméstica.',
  },
  {
    id: 'survey_recruits',
    label: 'Pesquisa de recrutas',
    description: 'Percepção e risco em pesquisas de recrutamento.',
  },
  {
    id: 'survey_best_practice_cycle',
    label: 'Pesquisa ciclo de boas práticas',
    description: 'Dados de ciclo de boas práticas.',
  },
  {
    id: 'survey_cpca_meeting',
    label: 'Pesquisa encontro CPCA',
    description: 'Registros da pesquisa de encontros CPCA.',
  },
  {
    id: 'survey_gsd_evaluation',
    label: 'Pesquisa avaliação GSD',
    description: 'Avaliação de GSD.',
  },
  {
    id: 'complaints_cpca',
    label: 'Denúncias CPCA',
    description: 'Casos e andamento de denúncias CPCA.',
  },
  {
    id: 'complaints_smif',
    label: 'Denúncias SMIF',
    description: 'Casos e andamento de denúncias SMIF.',
  },
];

const AI_PROFILE_FEATURE_CATALOG: Array<{
  id: AiProfileFeatureId;
  label: string;
  description: string;
}> = [
  {
    id: 'structured_situational',
    label: 'Panorama situacional',
    description:
      'Libera panorama estruturado com pesquisas, denúncias, missões, atividades e tarefas.',
  },
  {
    id: 'structured_complaints',
    label: 'Perfis de denúncias',
    description:
      'Libera perfil de agressor, vítima, relações hierárquicas e estatísticas de denúncias.',
  },
  {
    id: 'structured_text',
    label: 'Sinais textuais',
    description:
      'Libera análise textual consolidada a partir de relatórios, observações e textos livres.',
  },
  {
    id: 'structured_geo',
    label: 'Recorte geográfico',
    description: 'Libera recortes por UF, localidade e distribuição territorial.',
  },
  {
    id: 'rag_knowledge_bases',
    label: 'RAG documental',
    description:
      'Permite consultar as bases de conhecimento selecionadas com busca lexical e vetorial.',
  },
  {
    id: 'traceability_links',
    label: 'Referências',
    description:
      'Acrescenta referências estruturadas e documentais ao final das respostas.',
  },
  {
    id: 'suggested_links',
    label: 'Links sugeridos',
    description:
      'Permite sugerir telas e registros do sistema ao final da resposta.',
  },
  {
    id: 'suggested_actions',
    label: 'Ações sugeridas',
    description:
      'Permite sugerir atalhos operacionais como criar missão, atividade, tarefa ou cronograma.',
  },
  {
    id: 'cpca_case_inconsistencies',
    label: 'Inconsistências CPCA',
    description:
      'Libera a camada analítica de inconsistências cadastrais, cronológicas e normativas nas denúncias CPCA.',
  },
  {
    id: 'comgep_room',
    label: 'Sala COMGEP',
    description:
      'Permite consultar o contexto estruturado da Sala COMGEP nos copilotos gerenciais.',
  },
];

const ANALYSIS_TYPES: AiAnalysisType[] = [
  'executive',
  'situational',
  'aggressor',
  'text',
  'geo',
  'chatbot',
  'cpca_agent',
  'briefing_comgep',
  'priorizacao_intervencao',
  'governanca_cpca',
];

const normalizeSourceArray = (value: AiKnowledgeSourceId[] | undefined) =>
  Array.from(new Set((value ?? []).filter(Boolean).sort()));

const normalizeKnowledgeBaseArray = (value: string[] | undefined) =>
  Array.from(new Set((value ?? []).map((item) => String(item ?? '').trim()).filter(Boolean)));

const normalizeFeatureArray = (value: AiProfileFeatureId[] | undefined) =>
  Array.from(new Set((value ?? []).filter(Boolean).sort()));

const buildDefaultAnalysisSources = (): AiAnalysisSourceSelection => ({
  executive: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  situational: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  aggressor: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  text: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  geo: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  chatbot: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  cpca_agent: [
    'complaints_cpca',
    'missions',
    'activities_smif',
    'activities_cipavd',
    'tasks',
    'survey_cpca_meeting',
  ],
  briefing_comgep: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  priorizacao_intervencao: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
  governanca_cpca: [...ANALYSIS_SOURCE_CATALOG.map((entry) => entry.id)],
});

const buildDefaultAnalysisKnowledgeBases = (): Record<AiAnalysisType, string[]> =>
  ANALYSIS_TYPES.reduce<Record<AiAnalysisType, string[]>>((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as Record<AiAnalysisType, string[]>);

const buildDefaultAnalysisFeatures = (): AiProfileFeatureSelection => ({
  executive: [
    'structured_situational',
    'structured_complaints',
    'structured_text',
    'structured_geo',
    'rag_knowledge_bases',
    'traceability_links',
  ],
  situational: [
    'structured_situational',
    'rag_knowledge_bases',
    'traceability_links',
  ],
  aggressor: [
    'structured_situational',
    'structured_complaints',
    'rag_knowledge_bases',
    'traceability_links',
  ],
  text: ['structured_text', 'rag_knowledge_bases', 'traceability_links'],
  geo: [
    'structured_situational',
    'structured_geo',
    'rag_knowledge_bases',
    'traceability_links',
  ],
  chatbot: [
    'structured_situational',
    'structured_complaints',
    'structured_text',
    'structured_geo',
    'rag_knowledge_bases',
    'traceability_links',
    'suggested_links',
    'suggested_actions',
  ],
  cpca_agent: [
    'structured_situational',
    'structured_complaints',
    'structured_text',
    'rag_knowledge_bases',
    'traceability_links',
    'suggested_links',
    'cpca_case_inconsistencies',
  ],
  briefing_comgep: ['comgep_room', 'rag_knowledge_bases', 'traceability_links'],
  priorizacao_intervencao: ['comgep_room', 'rag_knowledge_bases', 'traceability_links'],
  governanca_cpca: ['comgep_room', 'rag_knowledge_bases', 'traceability_links'],
});

type LocalityForm = {
  code: string;
  name: string;
  uf: string;
};

function LocalitiesTab() {
  const localitiesQuery = useLocalities();
  const createLocality = useCreateLocality();
  const updateLocality = useUpdateLocality();
  const deleteLocality = useDeleteLocality();
  const toast = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<LocalityForm>({ code: '', name: '', uf: '' });

  if (localitiesQuery.isLoading) return <SkeletonState />;
  if (localitiesQuery.isError) {
    return <ErrorState error={localitiesQuery.error} onRetry={() => localitiesQuery.refetch()} />;
  }

  const allLocalities = (localitiesQuery.data?.items ?? []) as any[];
  const items = selectTargetLocalities(allLocalities)
    .slice()
    .sort((a: any, b: any) => String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'pt-BR'));

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', uf: '' });
    setDrawerOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      uf: item.uf ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      uf: form.uf.trim().toUpperCase() || null,
    };
    if (!payload.code || !payload.name) {
      toast.push({ message: 'Informe sigla e nome da localidade.', severity: 'warning' });
      return;
    }
    if (!getTargetLocalityKey(payload.name)) {
      toast.push({
        message:
          'Nome inválido para localidade SMIF. Use uma das localidades alvo (Brasília, Canoas, Guaratinguetá, Lagoa Santa, Manaus, Pirassununga, Rio de Janeiro, São Paulo).',
        severity: 'warning',
      });
      return;
    }

    const conflictingLocality = allLocalities.find((locality: any) => {
      const localityId = String(locality?.id ?? '').trim();
      const localityCode = String(locality?.code ?? '').trim().toUpperCase();
      if (!localityCode) return false;
      if (editing && localityId === String(editing.id ?? '')) return false;
      return localityCode === payload.code;
    });

    if (conflictingLocality && editing) {
      const editingKey = getTargetLocalityKey(String(editing?.name ?? payload.name));
      const conflictKey = getTargetLocalityKey(String(conflictingLocality?.name ?? ''));
      const sameSmifLocality = Boolean(editingKey && conflictKey && editingKey === conflictKey);
      if (sameSmifLocality) {
        const previousCode = String(editing?.code ?? '').trim().toUpperCase();
        const conflictId = String(conflictingLocality?.id ?? '').trim();
        const usedCodes = new Set(
          allLocalities.map((item: any) => String(item?.code ?? '').trim().toUpperCase()).filter(Boolean),
        );
        let tempCode = `TMP${Date.now().toString().slice(-6)}`;
        while (usedCodes.has(tempCode)) {
          tempCode = `TMP${Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, '0')}`;
        }
        try {
          await updateLocality.mutateAsync({
            id: conflictId,
            payload: { code: tempCode },
          });
          await updateLocality.mutateAsync({ id: editing.id, payload });
          if (previousCode && previousCode !== payload.code) {
            await updateLocality.mutateAsync({
              id: conflictId,
              payload: { code: previousCode },
            });
          }
          toast.push({ message: 'Localidade atualizada e registros consolidados.', severity: 'success' });
          setDrawerOpen(false);
          return;
        } catch (error) {
          toast.push({ message: parseApiError(error).message ?? 'Erro ao atualizar localidade.', severity: 'error' });
          return;
        }
      }
    }

    if (conflictingLocality) {
      const conflictName = String(conflictingLocality?.name ?? 'outra localidade');
      toast.push({
        message: `A sigla ${payload.code} já está em uso por ${conflictName}. Use uma sigla diferente.`,
        severity: 'warning',
      });
      return;
    }

    try {
      if (editing) {
        await updateLocality.mutateAsync({ id: editing.id, payload });
        toast.push({ message: 'Localidade atualizada.', severity: 'success' });
      } else {
        await createLocality.mutateAsync(payload);
        toast.push({ message: 'Localidade criada.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar localidade.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocality.mutateAsync(id);
      toast.push({ message: 'Localidade excluída.', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir localidade.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Localidades</Typography>
        <Button variant="contained" size="small" onClick={openCreate}>
          Nova localidade
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cadastre e gerencie as localidades da SMIF (ex.: Brasília-DF, Canoas-RS), incluindo a sigla de cada uma.
      </Typography>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma localidade"
              description="Crie uma localidade da SMIF para começar."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600, width: 160 }}>Sigla</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600, width: 80 }}>UF</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.uf ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleteId(item.id)}>
                        Excluir
                      </Button>
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
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar localidade SMIF' : 'Nova localidade SMIF'}</Typography>
          <TextField
            size="small"
            label="Sigla"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: BASV"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome da localidade"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Brasília-DF"
            fullWidth
          />
          <TextField
            size="small"
            label="UF (Estado)"
            value={form.uf}
            onChange={(e) => setForm({ ...form, uf: e.target.value })}
            fullWidth
            select
            helperText="Sigla do estado para o Mapa Geográfico do Painel Estratégico"
          >
            <MenuItem value="">
              <em>Nenhum</em>
            </MenuItem>
            {UF_OPTIONS.map((uf) => (
              <MenuItem key={uf} value={uf}>{uf}</MenuItem>
            ))}
          </TextField>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={createLocality.isPending || updateLocality.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir localidade"
        message="Essa ação remove a localidade e pode afetar vínculos existentes. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

function CipavdLocalitiesTab() {
  const { data: me } = useMe();
  const localitiesQuery = useCipavdLocalities();
  const createLocality = useCreateCipavdLocality();
  const updateLocality = useUpdateCipavdLocality();
  const deleteLocality = useDeleteCipavdLocality();
  const toast = useToast();

  const canCreateLocality = can(me, 'localities_cipavd', 'create');
  const canUpdateLocality = can(me, 'localities_cipavd', 'update');
  const canDeleteLocality = can(me, 'localities_cipavd', 'delete');
  const canManage = canCreateLocality || canUpdateLocality || canDeleteLocality;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<LocalityForm>({ code: '', name: '', uf: '' });

  if (localitiesQuery.isLoading) return <SkeletonState />;
  if (localitiesQuery.isError) {
    return <ErrorState error={localitiesQuery.error} onRetry={() => localitiesQuery.refetch()} />;
  }

  const items = ((localitiesQuery.data?.items ?? []) as any[])
    .slice()
    .sort((a: any, b: any) => String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'pt-BR'));

  const openCreate = () => {
    if (!canCreateLocality) return;
    setEditing(null);
    setForm({ code: '', name: '', uf: '' });
    setDrawerOpen(true);
  };

  const openEdit = (item: any) => {
    if (!canUpdateLocality) return;
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      uf: item.uf ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (editing && !canUpdateLocality) {
      toast.push({ message: 'Você não possui permissão para editar localidades CIPAVD.', severity: 'warning' });
      return;
    }
    if (!editing && !canCreateLocality) {
      toast.push({ message: 'Você não possui permissão para criar localidades CIPAVD.', severity: 'warning' });
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      uf: form.uf.trim().toUpperCase() || null,
    };

    if (!payload.code || !payload.name) {
      toast.push({ message: 'Informe sigla e nome da localidade.', severity: 'warning' });
      return;
    }

    const duplicateCode = items.find((item: any) => {
      const sameCode = String(item?.code ?? '').trim().toUpperCase() === payload.code;
      if (!sameCode) return false;
      if (!editing) return true;
      return String(item?.id ?? '') !== String(editing?.id ?? '');
    });
    if (duplicateCode) {
      toast.push({
        message: `A sigla ${payload.code} já está em uso. Use uma sigla diferente.`,
        severity: 'warning',
      });
      return;
    }

    try {
      if (editing) {
        await updateLocality.mutateAsync({ id: editing.id, payload });
        toast.push({ message: 'Localidade CIPAVD atualizada.', severity: 'success' });
      } else {
        await createLocality.mutateAsync(payload);
        toast.push({ message: 'Localidade CIPAVD criada.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar localidade CIPAVD.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteLocality) {
      toast.push({ message: 'Você não possui permissão para excluir localidades CIPAVD.', severity: 'warning' });
      return;
    }
    try {
      await deleteLocality.mutateAsync(id);
      toast.push({ message: 'Localidade CIPAVD excluída.', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir localidade CIPAVD.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Localidades CIPAVD</Typography>
        {canCreateLocality && (
          <Button variant="contained" size="small" onClick={openCreate}>
            Nova localidade
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cadastre as localidades exclusivas para as atividades de campo da CIPAVD.
      </Typography>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma localidade CIPAVD"
              description="Crie uma localidade CIPAVD para habilitar seleção no módulo de atividades de campo CIPAVD."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600, width: 160 }}>Sigla</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600, width: 80 }}>UF</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.uf ?? '—'}</TableCell>
                    <TableCell align="right">
                      {canManage ? (
                        <>
                          {canUpdateLocality && (
                            <Button size="small" onClick={() => openEdit(item)}>
                              Editar
                            </Button>
                          )}
                          {canDeleteLocality && (
                            <Button size="small" color="error" onClick={() => setDeleteId(item.id)}>
                              Excluir
                            </Button>
                          )}
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Sem permissão de alteração
                        </Typography>
                      )}
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
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          gap={2}
          sx={{ mt: { xs: 9, md: 10 } }}
        >
          <Typography variant="h6">{editing ? 'Editar localidade CIPAVD' : 'Nova localidade CIPAVD'}</Typography>
          <TextField
            size="small"
            label="Sigla"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: CIPA01"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome da localidade"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Base Operacional 01"
            fullWidth
          />
          <TextField
            size="small"
            label="UF (Estado)"
            value={form.uf}
            onChange={(e) => setForm({ ...form, uf: e.target.value })}
            fullWidth
            select
            helperText="Sigla do estado para o Mapa Geográfico do Painel Estratégico"
          >
            <MenuItem value="">
              <em>Nenhum</em>
            </MenuItem>
            {UF_OPTIONS.map((uf) => (
              <MenuItem key={uf} value={uf}>{uf}</MenuItem>
            ))}
          </TextField>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={
                createLocality.isPending ||
                updateLocality.isPending ||
                (!editing && !canCreateLocality) ||
                (editing && !canUpdateLocality)
              }
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir localidade CIPAVD"
        message="Essa ação remove a localidade e pode afetar vínculos existentes em atividades CIPAVD. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

function PostosTab() {
  const postosQuery = usePostos();
  const createPosto = useCreatePosto();
  const updatePosto = useUpdatePosto();
  const deletePosto = useDeletePosto();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', sortOrder: 0 });

  if (postosQuery.isLoading) return <SkeletonState />;
  if (postosQuery.isError)
    return <ErrorState error={postosQuery.error} onRetry={() => postosQuery.refetch()} />;

  const items = postosQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', sortOrder: items.length });
    setDrawerOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      sortOrder: item.sortOrder ?? 0,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updatePosto.mutateAsync({
          id: editing.id,
          payload: { code: form.code.trim(), name: form.name.trim(), sortOrder: form.sortOrder },
        });
        toast.push({ message: 'Posto atualizado', severity: 'success' });
      } else {
        await createPosto.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          sortOrder: form.sortOrder,
        });
        toast.push({ message: 'Posto criado', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar posto.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosto.mutateAsync(id);
      toast.push({ message: 'Posto excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir posto.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Postos</Typography>
        <Button variant="contained" size="small" onClick={openCreate}>
          Novo posto
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Postos ou cargos usados no módulo de atividades externas para registrar o quantitativo de participantes por posto (ex.: Sargento, Capitão, Soldado).
      </Typography>
      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhum posto"
              description="Crie postos para usar no fechamento de atividades externas (quantitativo de participantes por posto)."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ordem</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.sortOrder ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleteId(item.id)}>
                        Excluir
                      </Button>
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
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar posto' : 'Novo posto'}</Typography>
          <TextField
            size="small"
            label="Código"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: SGT, CAP"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Sargento, Capitão"
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Ordem"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            fullWidth
            inputProps={{ min: 0 }}
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={createPosto.isPending || updatePosto.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir posto"
        message="Ao excluir, registros de atividades externas que usam este posto podem ficar sem vínculo. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

function PhasesTab() {
  const { data: me } = useMe();
  const phasesQuery = usePhases();
  const updatePhase = useUpdatePhase();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!can(me, 'phases', 'update')) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  if (phasesQuery.isLoading) return <SkeletonState />;
  if (phasesQuery.isError) return <ErrorState error={phasesQuery.error} onRetry={() => phasesQuery.refetch()} />;

  const items = phasesQuery.data?.items ?? [];

  const getDraft = (phase: any) => drafts[phase.id] ?? (phase.displayName ?? '');
  const getCurrent = (phase: any) => phase.displayName ?? '';
  const isDirty = (phase: any) => getDraft(phase).trim() !== getCurrent(phase).trim();

  const save = async (phase: any) => {
    try {
      const value = getDraft(phase).trim();
      await updatePhase.mutateAsync({
        id: phase.id,
        displayName: value ? value : null,
      });
      toast.push({ message: 'Fase atualizada', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar fase', severity: 'error' });
    }
  };

  if (items.length === 0) {
    return <EmptyState title="Sem fases" description="Nenhuma fase cadastrada no sistema." />;
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Fases
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Defina o nome exibido das fases no sistema. Deixe vazio para usar o nome padrão.
      </Typography>

      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ordem</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código técnico</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome padrão</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome exibido</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((phase: any) => (
                <TableRow key={phase.id} hover>
                  <TableCell>{phase.order}</TableCell>
                  <TableCell>{phase.code ?? phase.id}</TableCell>
                  <TableCell>{phase.defaultName ?? phase.name}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={phase.defaultName ?? phase.name}
                      value={getDraft(phase)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [phase.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setDrafts((prev) => ({ ...prev, [phase.id]: '' }))}
                      sx={{ mr: 1 }}
                    >
                      Padrão
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={!isDirty(phase) || updatePhase.isPending}
                      onClick={() => save(phase)}
                    >
                      Salvar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}

function EloRolesTab() {
  const eloRolesQuery = useEloRoles();
  const createEloRole = useCreateEloRole();
  const updateEloRole = useUpdateEloRole();
  const deleteEloRole = useDeleteEloRole();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', sortOrder: 0 });

  if (eloRolesQuery.isLoading) return <SkeletonState />;
  if (eloRolesQuery.isError)
    return <ErrorState error={eloRolesQuery.error} onRetry={() => eloRolesQuery.refetch()} />;

  const items = eloRolesQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', sortOrder: items.length });
    setDrawerOpen(true);
  };

  const openEdit = (role: any) => {
    setEditing(role);
    setForm({
      code: role.code ?? '',
      name: role.name ?? '',
      sortOrder: role.sortOrder ?? 0,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateEloRole.mutateAsync({
          id: editing.id,
          payload: { code: form.code.trim(), name: form.name.trim(), sortOrder: form.sortOrder },
        });
        toast.push({ message: 'Tipo de elo atualizado', severity: 'success' });
      } else {
        await createEloRole.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          sortOrder: form.sortOrder,
        });
        toast.push({ message: 'Tipo de elo criado', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar tipo de elo.', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEloRole.mutateAsync(id);
      toast.push({ message: 'Tipo de elo excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao excluir tipo de elo.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Papéis de Elo</Typography>
        <Button variant="contained" size="small" onClick={openCreate}>
          Novo tipo
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Psicologia, SSO, Jurídico, CPCA, Graduado Master, etc. Estes tipos são usados na matriz de elos e nas tarefas.
      </Typography>
      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Nenhum tipo de elo"
              description="Crie os tipos de elo (Psicologia, SSO, Jurídico, etc.) para usar na matriz de elos e nas tarefas."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Ordem</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((role: any) => (
                  <TableRow key={role.id} hover>
                    <TableCell>{role.code}</TableCell>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.sortOrder ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(role)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleteId(role.id)}>
                        Excluir
                      </Button>
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
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 380 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar tipo de elo' : 'Novo tipo de elo'}</Typography>
          <TextField
            size="small"
            label="Código"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Ex: PSICOLOGIA"
            fullWidth
          />
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Psicologia"
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Ordem"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            fullWidth
            inputProps={{ min: 0 }}
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSave}
              disabled={createEloRole.isPending || updateEloRole.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir tipo de elo"
        message="Ao excluir, elos e tarefas que usam este tipo podem ficar sem vínculo. Deseja continuar?"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}

const institutionalAreaOptions = [
  { id: 'lideranca', label: 'Liderança' },
  { id: 'acompanhamento_recrutas', label: 'Acompanhamento de Recrutas' },
  { id: 'analise_riscos', label: 'Análise de Riscos' },
] as const;

type InstitutionalAreaId = (typeof institutionalAreaOptions)[number]['id'];

function normalizeHexColor(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(normalized)) return null;
  return normalized.toUpperCase();
}

function InstitutionalMappingTab() {
  const { data: me } = useMe();
  const canManage = can(me, 'missions', 'update');
  const configQuery = useMissionChecklistConfig(canManage);
  const createDimension = useCreateMissionChecklistDimension();
  const updateDimension = useUpdateMissionChecklistDimension();
  const deleteDimension = useDeleteMissionChecklistDimension();
  const updateClassification = useUpdateMissionChecklistClassification();
  const toast = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDimension, setEditingDimension] = useState<any | null>(null);
  const [deleteDimensionId, setDeleteDimensionId] = useState<string | null>(null);
  const [dimensionForm, setDimensionForm] = useState({
    sectionId: 'lideranca' as InstitutionalAreaId,
    title: '',
    prompt: '',
    sortOrder: 0,
  });
  const [classificationDrafts, setClassificationDrafts] = useState<
    Record<string, { label: string; colorHex: string }>
  >({});

  const sections = (configQuery.data?.sections ?? []) as any[];
  const classifications = (configQuery.data?.classifications ?? []) as Array<any>;
  const dimensions = sections.flatMap((section) =>
    (section?.items ?? []).map((item: any, index: number) => ({
      id: String(item?.id ?? ''),
      sectionId: String(section?.id ?? ''),
      sectionTitle: String(section?.title ?? ''),
      title: String(item?.title ?? ''),
      prompt: String(item?.prompt ?? ''),
      sortOrder: Number(item?.sortOrder ?? (index + 1) * 10),
    })),
  );

  const draftById = (classification: any) => {
    const id = String(classification?.id ?? '');
    const existing = classificationDrafts[id];
    if (existing) return existing;
    return {
      label: String(classification?.label ?? ''),
      colorHex:
        normalizeHexColor(classification?.colorHex as string | null | undefined) ??
        '#FFFFFF',
    };
  };

  const setClassificationDraft = (
    id: string,
    patch: Partial<{ label: string; colorHex: string }>,
  ) => {
    setClassificationDrafts((current) => {
      const currentValue = current[id] ?? { label: '', colorHex: '#FFFFFF' };
      return {
        ...current,
        [id]: { ...currentValue, ...patch },
      };
    });
  };

  const isClassificationDirty = (classification: any) => {
    const draft = draftById(classification);
    const currentLabel = String(classification?.label ?? '').trim();
    const currentColor =
      normalizeHexColor(classification?.colorHex as string | null | undefined) ??
      '#FFFFFF';
    return (
      draft.label.trim() !== currentLabel ||
      draft.colorHex.trim().toUpperCase() !== currentColor
    );
  };

  const openCreateDimension = () => {
    setEditingDimension(null);
    setDimensionForm({
      sectionId: 'lideranca',
      title: '',
      prompt: '',
      sortOrder: dimensions.length * 10 + 10,
    });
    setDrawerOpen(true);
  };

  const openEditDimension = (dimension: any) => {
    const area = institutionalAreaOptions.find(
      (option) => option.id === dimension.sectionId,
    )?.id;
    setEditingDimension(dimension);
    setDimensionForm({
      sectionId: area ?? 'lideranca',
      title: dimension.title ?? '',
      prompt: dimension.prompt ?? '',
      sortOrder: Number(dimension.sortOrder ?? 0),
    });
    setDrawerOpen(true);
  };

  const saveDimension = async () => {
    if (!canManage) return;
    if (!dimensionForm.title.trim()) {
      toast.push({
        message: 'Informe o nome da dimensão.',
        severity: 'warning',
      });
      return;
    }
    try {
      if (editingDimension?.id) {
        await updateDimension.mutateAsync({
          id: String(editingDimension.id),
          payload: {
            sectionId: dimensionForm.sectionId,
            title: dimensionForm.title.trim(),
            prompt: dimensionForm.prompt.trim() || undefined,
            sortOrder: Number(dimensionForm.sortOrder) || 0,
          },
        });
        toast.push({ message: 'Dimensão atualizada.', severity: 'success' });
      } else {
        await createDimension.mutateAsync({
          sectionId: dimensionForm.sectionId,
          title: dimensionForm.title.trim(),
          prompt: dimensionForm.prompt.trim() || undefined,
          sortOrder: Number(dimensionForm.sortOrder) || 0,
        });
        toast.push({ message: 'Dimensão criada.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar dimensão.',
        severity: 'error',
      });
    }
  };

  const confirmDeleteDimension = async () => {
    if (!canManage || !deleteDimensionId) return;
    try {
      await deleteDimension.mutateAsync(deleteDimensionId);
      setDeleteDimensionId(null);
      toast.push({ message: 'Dimensão excluída.', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao excluir dimensão.',
        severity: 'error',
      });
    }
  };

  const saveClassification = async (classification: any) => {
    if (!canManage) return;
    const id = String(classification?.id ?? '');
    const draft = draftById(classification);
    if (!draft.label.trim()) {
      toast.push({
        message: 'Informe o nome da classificação.',
        severity: 'warning',
      });
      return;
    }
    try {
      await updateClassification.mutateAsync({
        id: id as any,
        payload: {
          label: draft.label.trim(),
          colorHex:
            draft.colorHex.trim().toUpperCase() === '#FFFFFF'
              ? ''
              : draft.colorHex.trim().toUpperCase(),
        },
      });
      toast.push({ message: 'Classificação atualizada.', severity: 'success' });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? 'Erro ao atualizar classificação.',
        severity: 'error',
      });
    }
  };

  if (!canManage) {
    return (
      <Typography variant="body2" color="text.secondary">
        Acesso restrito. Apenas Coordenação CIPAVD e TI podem alterar o
        mapeamento institucional.
      </Typography>
    );
  }
  if (configQuery.isLoading) return <SkeletonState />;
  if (configQuery.isError) {
    return (
      <ErrorState
        error={configQuery.error}
        onRetry={() => configQuery.refetch()}
      />
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Mapeamento Institucional
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie dimensões por área e personalize as classificações usadas
            no checklist e no SMIF.
          </Typography>
        </Box>
        <Button variant="contained" size="small" onClick={openCreateDimension}>
          Nova dimensão
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          {dimensions.length === 0 ? (
            <EmptyState
              title="Sem dimensões"
              description="Crie a primeira dimensão para usar no checklist."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Área</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Dimensão</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Descrição auxiliar</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Ordem</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dimensions.map((dimension) => (
                  <TableRow key={dimension.id} hover>
                    <TableCell>{dimension.sectionTitle}</TableCell>
                    <TableCell>{dimension.title}</TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {dimension.prompt || 'Sem descrição auxiliar'}
                      </Typography>
                    </TableCell>
                    <TableCell>{dimension.sortOrder}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEditDimension(dimension)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setDeleteDimensionId(dimension.id)}
                      >
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>
            Classificações
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Código</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Nome exibido</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Cor</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }} align="right">
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {classifications.map((classification) => {
                const id = String(classification?.id ?? '');
                const draft = draftById(classification);
                return (
                  <TableRow key={id} hover>
                    <TableCell>{id}</TableCell>
                    <TableCell sx={{ minWidth: 320 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={draft.label}
                        onChange={(event) =>
                          setClassificationDraft(id, { label: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          type="color"
                          value={draft.colorHex}
                          onChange={(event) =>
                            setClassificationDraft(id, {
                              colorHex: event.target.value.toUpperCase(),
                            })
                          }
                          sx={{ width: 86 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            setClassificationDraft(id, { colorHex: '#FFFFFF' })
                          }
                        >
                          Sem cor
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => saveClassification(classification)}
                        disabled={
                          !isClassificationDirty(classification) ||
                          updateClassification.isPending
                        }
                      >
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 430 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">
            {editingDimension ? 'Editar dimensão' : 'Nova dimensão'}
          </Typography>
          <TextField
            select
            size="small"
            label="Área"
            value={dimensionForm.sectionId}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                sectionId: event.target.value as InstitutionalAreaId,
              }))
            }
          >
            {institutionalAreaOptions.map((area) => (
              <MenuItem key={area.id} value={area.id}>
                {area.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Nome da dimensão"
            value={dimensionForm.title}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
          <TextField
            size="small"
            label="Descrição auxiliar (opcional)"
            value={dimensionForm.prompt}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                prompt: event.target.value,
              }))
            }
            multiline
            minRows={3}
          />
          <TextField
            size="small"
            type="number"
            label="Ordem"
            value={dimensionForm.sortOrder}
            onChange={(event) =>
              setDimensionForm((current) => ({
                ...current,
                sortOrder: Number(event.target.value) || 0,
              }))
            }
            inputProps={{ min: 0 }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={saveDimension}
              disabled={createDimension.isPending || updateDimension.isPending}
            >
              Salvar
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteDimensionId)}
        title="Excluir dimensão"
        message="Deseja remover esta dimensão do mapeamento institucional?"
        onConfirm={confirmDeleteDimension}
        onCancel={() => setDeleteDimensionId(null)}
      />
    </Box>
  );
}

const ANALYSIS_PROMPTS_CONFIG: {
  type: AiAnalysisType;
  group: 'ia' | 'chatbot' | 'copilot';
  label: string;
  short: string;
  placeholder: string;
  accent: string;
  icon: ReactNode;
}[] = [
  {
    type: 'executive',
    group: 'ia',
    label: 'Resumo Executivo Completo',
    short: 'Panorama completo para o comando.',
    placeholder:
      'Redija um resumo executivo completo para o comando, abordando panorama situacional, perfil de denúncias, destaques textuais e distribuição geográfica.',
    accent: '#1A3C6E',
    icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'situational',
    group: 'ia',
    label: 'Análise Situacional',
    short: 'Pesquisas, denúncias, atividades e missões.',
    placeholder:
      'Analise o panorama situacional: pesquisas, taxas de violência, denúncias ativas, atividades e missões.',
    accent: '#2E7D32',
    icon: <DashboardRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'aggressor',
    group: 'ia',
    label: 'Perfil de Assédio e Violência',
    short: 'Perfil de agressor, vítima e contexto.',
    placeholder:
      'Analise o perfil de assédio e violência: tipos de ocorrência, perfil do agressor e da vítima, relações hierárquicas e contextos.',
    accent: '#D32F2F',
    icon: <FingerprintRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'text',
    group: 'ia',
    label: 'Análise Textual',
    short: 'Termos e tendências em textos livres.',
    placeholder:
      'Analise os padrões e tendências identificados nos textos livres do sistema: termos mais frequentes, temas recorrentes e insights.',
    accent: '#7B1FA2',
    icon: <TextSnippetRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'geo',
    group: 'ia',
    label: 'Distribuição Geográfica',
    short: 'Concentração por estado e localidade.',
    placeholder:
      'Analise a distribuição geográfica: estados com mais registros, concentração de denúncias, atividades e missões por região.',
    accent: '#ED6C02',
    icon: <MapRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'chatbot',
    group: 'chatbot',
    label: 'Chatbot livre',
    short: 'Perguntas abertas sobre CIPAVD, SMIF e CPCA.',
    placeholder:
      'Responda perguntas abertas sobre o sistema com Markdown, linguagem institucional, foco em CIPAVD, SMIF e CPCA, sempre respeitando as fontes permitidas e sem inventar dados fora do contexto.',
    accent: '#00695C',
    icon: <SmartToyRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'cpca_agent',
    group: 'chatbot',
    label: 'IA CPCA',
    short: 'Denúncias CPCA, inconsistências, relatórios e base normativa.',
    placeholder:
      'Responda como a IA analítica da CPCA, com foco em denúncias CPCA, workflow, inconsistências cadastrais e procedimentais, aderência normativa, risco institucional e relatórios executivos com rastreabilidade por caso e OM.',
    accent: '#8B1E3F',
    icon: <ShieldRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'briefing_comgep',
    group: 'copilot',
    label: 'Briefing COMGEP',
    short: 'Síntese executiva com decisão e risco.',
    placeholder:
      'Consolide a Sala COMGEP em um briefing curto, institucional e orientado à decisão, destacando riscos, cobertura CPCA, pressão operacional e ação imediata.',
    accent: '#1A3C6E',
    icon: <CampaignRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'priorizacao_intervencao',
    group: 'copilot',
    label: 'Priorização de Intervenção',
    short: 'Ordena esforço e impacto esperado.',
    placeholder:
      'Priorize UFs e OMs com maior impacto potencial, explique a ordem sugerida e recomende a melhor sequência de intervenção.',
    accent: '#2E7D32',
    icon: <AssignmentTurnedInRoundedIcon sx={{ fontSize: 28 }} />,
  },
  {
    type: 'governanca_cpca',
    group: 'copilot',
    label: 'Governança CPCA',
    short: 'Cobertura, gargalos e exposição institucional.',
    placeholder:
      'Analise cobertura CPCA, sobrecarga, OMs descobertas e ajustes de governança necessários, com linguagem objetiva para gestores.',
    accent: '#6A1B9A',
    icon: <ShieldRoundedIcon sx={{ fontSize: 28 }} />,
  },
];

const AI_SETTINGS_GROUPS: Array<{
  id: 'ia' | 'chatbot' | 'copilot';
  label: string;
  description: string;
}> = [
  {
    id: 'ia',
    label: 'Análises da Página IA',
    description:
      'Configura as 5 análises estruturadas da aba IA, incluindo fontes permitidas e instrução específica.',
  },
  {
    id: 'chatbot',
    label: 'Chatbots e agentes conversacionais',
    description:
      'Configura o chatbot livre da aba IA e a IA CPCA, incluindo bases, fontes estruturadas, features e instruções específicas.',
  },
  {
    id: 'copilot',
    label: 'Copilotos Gerenciais',
    description:
      'Configura os 3 copilotos executivos da aba Assistente IA: Briefing COMGEP, Priorização de intervenção e Governança CPCA.',
  },
];

const buildDefaultAnalysisPrompts = () =>
  ANALYSIS_PROMPTS_CONFIG.reduce<Record<string, string>>((acc, item) => {
    acc[item.type] = '';
    return acc;
  }, {});

const sameSources = (
  sourceA: AiKnowledgeSourceId[] = [],
  sourceB: AiKnowledgeSourceId[] = [],
) => {
  const normalizedA = normalizeSourceArray(sourceA);
  const normalizedB = normalizeSourceArray(sourceB);
  if (normalizedA.length !== normalizedB.length) return false;
  return normalizedA.every((value, index) => value === normalizedB[index]);
};

const sanitizeAnalysisSources = (input: AiSettingsResponse['analysisSources']) => {
  const defaults = buildDefaultAnalysisSources();
  return ANALYSIS_TYPES.reduce<AiAnalysisSourceSelection>((acc, type) => {
    acc[type] = normalizeSourceArray(input?.[type]);
    return acc;
  }, defaults);
};

const sanitizeAnalysisKnowledgeBases = (
  input: AiSettingsResponse['analysisKnowledgeBases'],
) => {
  const defaults = buildDefaultAnalysisKnowledgeBases();
  return ANALYSIS_TYPES.reduce<Record<AiAnalysisType, string[]>>((acc, type) => {
    acc[type] = normalizeKnowledgeBaseArray(input?.[type]);
    return acc;
  }, defaults);
};

const sanitizeAnalysisFeatures = (
  input: AiSettingsResponse['analysisFeatures'],
) => {
  const defaults = buildDefaultAnalysisFeatures();
  return ANALYSIS_TYPES.reduce<AiProfileFeatureSelection>((acc, type) => {
    acc[type] = normalizeFeatureArray(input?.[type]);
    return acc;
  }, defaults);
};

const sameStringSelections = (
  valuesA: string[] = [],
  valuesB: string[] = [],
) => {
  const normalizedA = normalizeKnowledgeBaseArray(valuesA);
  const normalizedB = normalizeKnowledgeBaseArray(valuesB);
  if (normalizedA.length !== normalizedB.length) return false;
  return normalizedA.every((value, index) => value === normalizedB[index]);
};

const sameFeatureSelections = (
  valuesA: AiProfileFeatureId[] = [],
  valuesB: AiProfileFeatureId[] = [],
) => {
  const normalizedA = normalizeFeatureArray(valuesA);
  const normalizedB = normalizeFeatureArray(valuesB);
  if (normalizedA.length !== normalizedB.length) return false;
  return normalizedA.every((value, index) => value === normalizedB[index]);
};

function AiSettingsTab() {
  const settingsQuery = useAiSettings();
  const selectableKnowledgeBasesQuery = useSelectableKnowledgeBases();
  const updateSettings = useUpdateAiSettings();
  const testConnection = useTestAiConnection();
  const toast = useToast();

  const [aiSection, setAiSection] = useState<'prompts' | 'server'>('prompts');
  const [expandedAiProfile, setExpandedAiProfile] = useState<string | false>(false);
  const [form, setForm] = useState({
    baseUrl: '',
    apiKey: '',
    model: '',
    embeddingModel: '',
    systemPrompt: '',
  });
  const [analysisSources, setAnalysisSources] =
    useState<AiAnalysisSourceSelection>(buildDefaultAnalysisSources());
  const [analysisKnowledgeBases, setAnalysisKnowledgeBases] =
    useState<Record<AiAnalysisType, string[]>>(buildDefaultAnalysisKnowledgeBases());
  const [analysisFeatures, setAnalysisFeatures] =
    useState<AiProfileFeatureSelection>(buildDefaultAnalysisFeatures());
  const [analysisPrompts, setAnalysisPrompts] =
    useState<Record<string, string>>(buildDefaultAnalysisPrompts());
  const [showKey, setShowKey] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelMode, setModelMode] = useState<'list' | 'manual'>('manual');
  const [embeddingModelMode, setEmbeddingModelMode] = useState<'list' | 'manual'>('manual');

  useEffect(() => {
    if (settingsQuery.data && !loaded) {
      setForm({
        baseUrl: settingsQuery.data.baseUrl ?? '',
        apiKey: '',
        model: settingsQuery.data.model ?? '',
        embeddingModel: settingsQuery.data.embeddingModel ?? '',
        systemPrompt: settingsQuery.data.systemPrompt ?? '',
      });
      setAnalysisSources(sanitizeAnalysisSources(settingsQuery.data.analysisSources));
      setAnalysisKnowledgeBases(
        sanitizeAnalysisKnowledgeBases(settingsQuery.data.analysisKnowledgeBases),
      );
      setAnalysisFeatures(sanitizeAnalysisFeatures(settingsQuery.data.analysisFeatures));
      const serverPrompts = settingsQuery.data.analysisPrompts ?? {};
      setAnalysisPrompts(
        ANALYSIS_PROMPTS_CONFIG.reduce<Record<string, string>>((acc, item) => {
          acc[item.type] = serverPrompts[item.type] ?? '';
          return acc;
        }, buildDefaultAnalysisPrompts()),
      );
      setLoaded(true);
    }
  }, [settingsQuery.data, loaded]);

  const loadModelsFromLiteLLM = useCallback(
    async (notify: boolean) => {
      try {
        const result = await testConnection.mutateAsync();
        if (!result.ok) {
          if (notify) {
            toast.push({
              message: `Falha na conexão: ${result.error ?? 'Erro desconhecido'}`,
              severity: 'error',
            });
          }
          return;
        }

        const models = Array.from(new Set((result.models ?? []).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b, 'pt-BR'),
        );
        setAvailableModels(models);

        if (models.length > 0) {
          if (form.model && !models.includes(form.model)) {
            setModelMode('manual');
          } else {
            setModelMode('list');
          }
          if (form.embeddingModel && !models.includes(form.embeddingModel)) {
            setEmbeddingModelMode('manual');
          } else {
            setEmbeddingModelMode('list');
          }
        }

        if (notify) {
          toast.push({
            message: `Conexão OK! ${models.length} modelo(s) carregado(s).`,
            severity: 'success',
          });
        }
      } catch (error) {
        if (!notify) return;
        toast.push({
          message: parseApiError(error).message ?? 'Erro ao carregar modelos do LiteLLM.',
          severity: 'error',
        });
      }
    },
    [form.embeddingModel, form.model, testConnection, toast],
  );

  const allSourceIds = ANALYSIS_SOURCE_CATALOG.map((source) => source.id);
  const selectableKnowledgeBases = useMemo(
    () => (selectableKnowledgeBasesQuery.data?.items ?? []) as AdminKnowledgeBase[],
    [selectableKnowledgeBasesQuery.data],
  );
  const allKnowledgeBaseIds = useMemo(
    () => selectableKnowledgeBases.map((item) => item.id),
    [selectableKnowledgeBases],
  );
  const allFeatureIds = AI_PROFILE_FEATURE_CATALOG.map((feature) => feature.id);

  const toggleSource = (
    analysisType: AiAnalysisType,
    sourceId: AiKnowledgeSourceId,
    checked: boolean,
  ) => {
    setAnalysisSources((prev) => {
      const next = normalizeSourceArray(prev[analysisType]);
      const set = new Set(next);
      if (checked) {
        set.add(sourceId);
      } else {
        set.delete(sourceId);
      }
      return {
        ...prev,
        [analysisType]: Array.from(set),
      };
    });
  };

  const setAllSources = (analysisType: AiAnalysisType) => {
    setAnalysisSources((prev) => ({
      ...prev,
      [analysisType]: [...allSourceIds],
    }));
  };

  const clearSources = (analysisType: AiAnalysisType) => {
    setAnalysisSources((prev) => ({
      ...prev,
      [analysisType]: [],
    }));
  };

  const toggleKnowledgeBase = (
    analysisType: AiAnalysisType,
    knowledgeBaseId: string,
    checked: boolean,
  ) => {
    setAnalysisKnowledgeBases((prev) => {
      const next = new Set(normalizeKnowledgeBaseArray(prev[analysisType]));
      if (checked) {
        next.add(knowledgeBaseId);
      } else {
        next.delete(knowledgeBaseId);
      }
      return {
        ...prev,
        [analysisType]: Array.from(next),
      };
    });
  };

  const setAllKnowledgeBases = (analysisType: AiAnalysisType) => {
    setAnalysisKnowledgeBases((prev) => ({
      ...prev,
      [analysisType]: [...allKnowledgeBaseIds],
    }));
  };

  const clearKnowledgeBases = (analysisType: AiAnalysisType) => {
    setAnalysisKnowledgeBases((prev) => ({
      ...prev,
      [analysisType]: [],
    }));
  };

  const toggleFeature = (
    analysisType: AiAnalysisType,
    featureId: AiProfileFeatureId,
    checked: boolean,
  ) => {
    setAnalysisFeatures((prev) => {
      const next = new Set(normalizeFeatureArray(prev[analysisType]));
      if (checked) {
        next.add(featureId);
      } else {
        next.delete(featureId);
      }
      return {
        ...prev,
        [analysisType]: Array.from(next),
      };
    });
  };

  const setAllFeatures = (analysisType: AiAnalysisType) => {
    setAnalysisFeatures((prev) => ({
      ...prev,
      [analysisType]: [...allFeatureIds],
    }));
  };

  const clearFeatures = (analysisType: AiAnalysisType) => {
    setAnalysisFeatures((prev) => ({
      ...prev,
      [analysisType]: [],
    }));
  };

  const getSourceSelectionSummary = (analysisType: AiAnalysisType) => {
    const selected = analysisSources[analysisType] ?? [];
    const selectedLabels = ANALYSIS_SOURCE_CATALOG.filter((source) =>
      selected.includes(source.id),
    ).map((source) => source.label);
    if (selectedLabels.length === 0) {
      return 'Nenhuma fonte selecionada';
    }
    if (selectedLabels.length <= 2) {
      return selectedLabels.join(' • ');
    }
    return `${selectedLabels.slice(0, 2).join(' • ')} +${selectedLabels.length - 2}`;
  };

  const getKnowledgeBaseSelectionSummary = (analysisType: AiAnalysisType) => {
    const selected = analysisKnowledgeBases[analysisType] ?? [];
    const selectedLabels = selectableKnowledgeBases
      .filter((knowledgeBase) => selected.includes(knowledgeBase.id))
      .map((knowledgeBase) => knowledgeBase.name);
    if (selectedLabels.length === 0) return 'Nenhuma base documental';
    if (selectedLabels.length <= 2) return selectedLabels.join(' • ');
    return `${selectedLabels.slice(0, 2).join(' • ')} +${selectedLabels.length - 2}`;
  };

  const getFeatureSelectionSummary = (analysisType: AiAnalysisType) => {
    const selected = analysisFeatures[analysisType] ?? [];
    const selectedLabels = AI_PROFILE_FEATURE_CATALOG.filter((feature) =>
      selected.includes(feature.id),
    ).map((feature) => feature.label);
    if (selectedLabels.length === 0) return 'Nenhuma feature liberada';
    if (selectedLabels.length <= 2) return selectedLabels.join(' • ');
    return `${selectedLabels.slice(0, 2).join(' • ')} +${selectedLabels.length - 2}`;
  };

  useEffect(() => {
    if (aiSection !== 'server') return;
    if (availableModels.length > 0) return;
    void loadModelsFromLiteLLM(false);
  }, [aiSection, availableModels.length, loadModelsFromLiteLLM]);

  const handleSave = async () => {
    const patch: AiSettingsPatch = {};
    if (form.systemPrompt !== (settingsQuery.data?.systemPrompt ?? ''))
      patch.systemPrompt = form.systemPrompt;
    if (form.baseUrl !== (settingsQuery.data?.baseUrl ?? ''))
      patch.baseUrl = form.baseUrl;
    if (form.apiKey) patch.apiKey = form.apiKey;
    if (form.model !== (settingsQuery.data?.model ?? ''))
      patch.model = form.model;
    if (form.embeddingModel !== (settingsQuery.data?.embeddingModel ?? ''))
      patch.embeddingModel = form.embeddingModel;

    const serverPrompts = settingsQuery.data?.analysisPrompts ?? {};
    const changedPrompts: Record<string, string> = {};
    for (const { type } of ANALYSIS_PROMPTS_CONFIG) {
      if (analysisPrompts[type] !== (serverPrompts[type] ?? '')) {
        changedPrompts[type] = analysisPrompts[type];
      }
    }
    if (Object.keys(changedPrompts).length > 0) {
      patch.analysisPrompts = changedPrompts;
    }

    const changedSources: Partial<Record<string, AiKnowledgeSourceId[]>> = {};
    for (const analysisType of ANALYSIS_TYPES) {
      const baseline = settingsQuery.data?.analysisSources?.[analysisType] ?? [];
      const selected = analysisSources[analysisType] ?? [];
      if (!sameSources(selected, baseline)) {
        changedSources[analysisType] = selected;
      }
    }
    if (Object.keys(changedSources).length > 0) {
      patch.analysisSources = changedSources;
    }

    const changedKnowledgeBases: Partial<Record<AiAnalysisType, string[]>> = {};
    for (const analysisType of ANALYSIS_TYPES) {
      const baseline = settingsQuery.data?.analysisKnowledgeBases?.[analysisType] ?? [];
      const selected = analysisKnowledgeBases[analysisType] ?? [];
      if (!sameStringSelections(selected, baseline)) {
        changedKnowledgeBases[analysisType] = selected;
      }
    }
    if (Object.keys(changedKnowledgeBases).length > 0) {
      patch.analysisKnowledgeBases = changedKnowledgeBases;
    }

    const changedFeatures: Partial<Record<AiAnalysisType, AiProfileFeatureId[]>> = {};
    for (const analysisType of ANALYSIS_TYPES) {
      const baseline = settingsQuery.data?.analysisFeatures?.[analysisType] ?? [];
      const selected = analysisFeatures[analysisType] ?? [];
      if (!sameFeatureSelections(selected, baseline)) {
        changedFeatures[analysisType] = selected;
      }
    }
    if (Object.keys(changedFeatures).length > 0) {
      patch.analysisFeatures = changedFeatures;
    }

    if (Object.keys(patch).length === 0) {
      toast.push({ message: 'Nenhuma alteração detectada.', severity: 'info' });
      return;
    }

    try {
      await updateSettings.mutateAsync(patch);
      toast.push({ message: 'Configurações de IA salvas.', severity: 'success' });
      setLoaded(false);
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar.', severity: 'error' });
    }
  };

  const handleTest = async () => {
    await loadModelsFromLiteLLM(true);
  };

  if (settingsQuery.isLoading) return <SkeletonState />;
  if (settingsQuery.isError) return <ErrorState error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />;

  return (
    <Box sx={{ width: '100%', maxWidth: 'none' }}>
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SmartToyRoundedIcon color="primary" sx={{ fontSize: 30 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Configuração de IA
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Prompts, fontes estruturadas, bases do RAG, features por perfil e conexão do
            LiteLLM para as análises estruturadas da página IA, para o chatbot livre e
            para os copilotos gerenciais da aba Assistente. Valores salvos aqui substituem
            o <code>.env</code> do servidor para URL, chave e modelo.
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={aiSection}
        onChange={(_, v: 'prompts' | 'server') => setAiSection(v)}
        variant="fullWidth"
        sx={{
          mb: 2.5,
          minHeight: 44,
          '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' },
        }}
      >
        <Tab value="prompts" label="Perfis, escopo e prompts" />
        <Tab value="server" label="Servidor LiteLLM" />
      </Tabs>

      {aiSection === 'server' && (
        <Stack spacing={2.5}>
          <TextField
            size="small"
            label="URL do LiteLLM"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="http://172.16.31.84:4000"
            fullWidth
            helperText="Endereço base do proxy (sem /v1)"
          />
          <TextField
            size="small"
            label="Chave API"
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={settingsQuery.data?.apiKeyMasked || 'sk-...'}
            fullWidth
            helperText="Deixe vazio para manter a chave atual"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowKey(!showKey)} size="small" edge="end">
                      {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => void loadModelsFromLiteLLM(true)}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? 'Carregando modelos...' : 'Atualizar modelos do LiteLLM'}
            </Button>
            {availableModels.length > 0 && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`${availableModels.length} modelo(s) disponível(is)`}
              />
            )}
          </Stack>
          <TextField
            size="small"
            select
            label="Modelo padrão"
            value={modelMode === 'manual' ? '__manual__' : form.model}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '__manual__') {
                setModelMode('manual');
                return;
              }
              setModelMode('list');
              setForm({ ...form, model: value });
            }}
            fullWidth
            helperText="Selecione um modelo retornado por /v1/models do LiteLLM."
          >
            <MenuItem value="">
              <em>Selecionar modelo...</em>
            </MenuItem>
            {availableModels.map((model) => (
              <MenuItem key={model} value={model}>
                {model}
              </MenuItem>
            ))}
            {form.model && !availableModels.includes(form.model) && (
              <MenuItem value={form.model}>{`${form.model} (atual, não listado)`}</MenuItem>
            )}
            <MenuItem value="__manual__">
              <em>Outro (digitar manualmente)</em>
            </MenuItem>
          </TextField>
          {modelMode === 'manual' && (
            <TextField
              size="small"
              label="Modelo personalizado"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Ex.: nemotron-3-nano:30b"
              fullWidth
              helperText="Use somente se o ID estiver correto no LiteLLM."
            />
          )}
          <TextField
            size="small"
            select
            label="Modelo de embeddings"
            value={embeddingModelMode === 'manual' ? '__manual__' : form.embeddingModel}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '__manual__') {
                setEmbeddingModelMode('manual');
                return;
              }
              setEmbeddingModelMode('list');
              setForm({ ...form, embeddingModel: value });
            }}
            fullWidth
            helperText="Opcional. Se vazio, o RAG usa somente busca lexical."
          >
            <MenuItem value="">
              <em>Sem embeddings configurados</em>
            </MenuItem>
            {availableModels.map((model) => (
              <MenuItem key={`embedding-${model}`} value={model}>
                {model}
              </MenuItem>
            ))}
            {form.embeddingModel && !availableModels.includes(form.embeddingModel) && (
              <MenuItem value={form.embeddingModel}>
                {`${form.embeddingModel} (atual, não listado)`}
              </MenuItem>
            )}
            <MenuItem value="__manual__">
              <em>Outro (digitar manualmente)</em>
            </MenuItem>
          </TextField>
          {embeddingModelMode === 'manual' && (
            <TextField
              size="small"
              label="Modelo de embeddings personalizado"
              value={form.embeddingModel}
              onChange={(e) => setForm({ ...form, embeddingModel: e.target.value })}
              placeholder="Ex.: bge-m3 ou e5-large"
              fullWidth
              helperText="Use o identificador exposto pelo LiteLLM para o endpoint /v1/embeddings."
            />
          )}
        </Stack>
      )}

      {aiSection === 'prompts' && (
        <Stack spacing={3}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              borderColor: (t) => alpha(t.palette.primary.main, 0.2),
              bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
            }}
          >
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                justifyContent="space-between"
                alignItems={{ sm: 'center' }}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    Perfis de IA
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    Cada perfil reúne no mesmo lugar as fontes permitidas e o prompt específico.
                    A visualização começa compacta e você expande apenas o que precisa editar.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${ANALYSIS_PROMPTS_CONFIG.length} perfis`}
                  />
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${ANALYSIS_SOURCE_CATALOG.length} fontes`}
                  />
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${selectableKnowledgeBases.length} bases RAG`}
                  />
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${AI_PROFILE_FEATURE_CATALOG.length} features`}
                  />
                  <Chip size="small" color="primary" variant="outlined" label="1 system prompt" />
                </Stack>
              </Stack>
            </Stack>
          </Paper>

          {selectableKnowledgeBasesQuery.isError && (
            <Alert severity="warning" variant="outlined">
              Não foi possível carregar as bases de conhecimento disponíveis. Você ainda pode
              editar prompts e fontes estruturadas, mas a seleção do RAG ficará incompleta até
              a aba de bases voltar a responder.
            </Alert>
          )}

          {ANALYSIS_PROMPTS_CONFIG.length === 0 ? (
            <Alert severity="warning" variant="outlined">
              Não foi possível carregar a configuração dos perfis de IA.
            </Alert>
          ) : (
            <Stack spacing={2.25}>
              {AI_SETTINGS_GROUPS.map((group) => {
                const items = ANALYSIS_PROMPTS_CONFIG.filter(
                  (item) => item.group === group.id,
                );
                return (
                  <Stack key={`prompt-group-${group.id}`} spacing={1.25}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {group.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {group.description}
                      </Typography>
                    </Box>
                    <Stack spacing={1}>
                      {items.map((item, index) => {
                        const selectedCount = (analysisSources[item.type] ?? []).length;
                        const selectedKnowledgeBasesCount =
                          (analysisKnowledgeBases[item.type] ?? []).length;
                        const selectedFeaturesCount = (analysisFeatures[item.type] ?? []).length;
                        const hasCustomPrompt = Boolean((analysisPrompts[item.type] ?? '').trim());
                        const isExpanded = expandedAiProfile === item.type;

                        return (
                          <Accordion
                            key={item.type}
                            expanded={isExpanded}
                            onChange={(_, expanded) =>
                              setExpandedAiProfile(expanded ? item.type : false)
                            }
                            disableGutters
                            elevation={0}
                            sx={{
                              border: '1px solid',
                              borderColor: alpha(item.accent, 0.22),
                              borderRadius: '16px !important',
                              overflow: 'hidden',
                              bgcolor: '#fff',
                              '&:before': { display: 'none' },
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              sx={{
                                px: 2,
                                py: 1,
                                minHeight: 88,
                                bgcolor: isExpanded ? alpha(item.accent, 0.08) : '#fff',
                                '& .MuiAccordionSummary-content': {
                                  my: 0,
                                },
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1.5}
                                alignItems="flex-start"
                                sx={{ width: '100%' }}
                              >
                                <Box
                                  sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 2,
                                    bgcolor: alpha(item.accent, 0.12),
                                    color: item.accent,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {item.icon}
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Stack
                                    direction={{ xs: 'column', md: 'row' }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ md: 'flex-start' }}
                                  >
                                    <Box sx={{ minWidth: 0 }}>
                                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip
                                          label={`${
                                            group.id === 'ia'
                                              ? 'Análise'
                                              : group.id === 'chatbot'
                                                ? 'Chatbot'
                                                : 'Copiloto'
                                          } ${index + 1}`}
                                          size="small"
                                          sx={{
                                            bgcolor: alpha(item.accent, 0.16),
                                            color: item.accent,
                                            fontWeight: 700,
                                          }}
                                        />
                                      </Stack>
                                      <Typography
                                        variant="subtitle1"
                                        fontWeight={800}
                                        sx={{ mt: 0.8, lineHeight: 1.25 }}
                                      >
                                        {item.label}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 0.35, lineHeight: 1.55 }}
                                      >
                                        {item.short}
                                      </Typography>
                                    </Box>
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      flexWrap="wrap"
                                      useFlexGap
                                      justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                                    >
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`${selectedCount} fonte(s)`}
                                      />
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`${selectedKnowledgeBasesCount} base(s)`}
                                      />
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`${selectedFeaturesCount} feature(s)`}
                                      />
                                      <Chip
                                        size="small"
                                        color={hasCustomPrompt ? 'success' : 'default'}
                                        variant={hasCustomPrompt ? 'filled' : 'outlined'}
                                        label={hasCustomPrompt ? 'Prompt customizado' : 'Prompt padrão'}
                                      />
                                    </Stack>
                                  </Stack>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mt: 0.9 }}
                                  >
                                    {[
                                      getSourceSelectionSummary(item.type),
                                      getKnowledgeBaseSelectionSummary(item.type),
                                      getFeatureSelectionSummary(item.type),
                                    ].join(' • ')}
                                  </Typography>
                                </Box>
                              </Stack>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.95fr) minmax(0, 1.05fr)' },
                                }}
                              >
                                <Box
                                  sx={{
                                    p: 2,
                                    borderRight: { xs: 'none', lg: '1px solid #EEF2F7' },
                                    borderBottom: { xs: '1px solid #EEF2F7', lg: 'none' },
                                  }}
                                >
                                  <Stack spacing={2}>
                                    <Stack spacing={1.25}>
                                      <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        justifyContent="space-between"
                                        alignItems={{ sm: 'center' }}
                                      >
                                        <Box>
                                          <Typography variant="subtitle2" fontWeight={800}>
                                            Fontes estruturadas permitidas
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                            Defina quais tabelas e agregados internos este perfil pode consultar.
                                          </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setAllSources(item.type)}
                                          >
                                            Todas
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => clearSources(item.type)}
                                          >
                                            Nenhuma
                                          </Button>
                                        </Stack>
                                      </Stack>
                                      <Box
                                        sx={{
                                          display: 'grid',
                                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                          gap: 1,
                                        }}
                                      >
                                        {ANALYSIS_SOURCE_CATALOG.map((source) => (
                                          <Paper
                                            key={`${item.type}-${source.id}`}
                                            variant="outlined"
                                            sx={{
                                              p: 1.1,
                                              borderRadius: 2,
                                              borderColor:
                                                analysisSources[item.type]?.includes(source.id)
                                                  ? alpha(item.accent, 0.45)
                                                  : '#E6ECF5',
                                              bgcolor:
                                                analysisSources[item.type]?.includes(source.id)
                                                  ? alpha(item.accent, 0.06)
                                                  : '#fff',
                                            }}
                                          >
                                            <FormControlLabel
                                              control={
                                                <Checkbox
                                                  size="small"
                                                  checked={
                                                    analysisSources[item.type]?.includes(source.id) ??
                                                    false
                                                  }
                                                  onChange={(event) =>
                                                    toggleSource(
                                                      item.type,
                                                      source.id,
                                                      event.target.checked,
                                                    )
                                                  }
                                                />
                                              }
                                              label={
                                                <Stack spacing={0.1}>
                                                  <Typography variant="body2" fontWeight={700}>
                                                    {source.label}
                                                  </Typography>
                                                  <Typography variant="caption" color="text.secondary">
                                                    {source.description}
                                                  </Typography>
                                                </Stack>
                                              }
                                              sx={{
                                                m: 0,
                                                alignItems: 'flex-start',
                                                width: '100%',
                                              }}
                                            />
                                          </Paper>
                                        ))}
                                      </Box>
                                    </Stack>

                                    <Stack spacing={1.25}>
                                      <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        justifyContent="space-between"
                                        alignItems={{ sm: 'center' }}
                                      >
                                        <Box>
                                          <Typography variant="subtitle2" fontWeight={800}>
                                            Bases de conhecimento do RAG
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                            Selecione uma ou mais bases documentais que este perfil poderá consultar.
                                          </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setAllKnowledgeBases(item.type)}
                                            disabled={allKnowledgeBaseIds.length === 0}
                                          >
                                            Todas
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => clearKnowledgeBases(item.type)}
                                          >
                                            Nenhuma
                                          </Button>
                                        </Stack>
                                      </Stack>
                                      {selectableKnowledgeBasesQuery.isLoading ? (
                                        <Typography variant="body2" color="text.secondary">
                                          Carregando bases de conhecimento...
                                        </Typography>
                                      ) : selectableKnowledgeBases.length === 0 ? (
                                        <Alert severity="warning" variant="outlined">
                                          Nenhuma base cadastrada. Crie bases na aba
                                          {' '}<strong>Bases de conhecimento</strong> antes de ativar o RAG.
                                        </Alert>
                                      ) : (
                                        <Box
                                          sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                            gap: 1,
                                          }}
                                        >
                                          {selectableKnowledgeBases.map((knowledgeBase) => (
                                            <Paper
                                              key={`${item.type}-kb-${knowledgeBase.id}`}
                                              variant="outlined"
                                              sx={{
                                                p: 1.1,
                                                borderRadius: 2,
                                                borderColor:
                                                  analysisKnowledgeBases[item.type]?.includes(knowledgeBase.id)
                                                    ? alpha(item.accent, 0.45)
                                                    : '#E6ECF5',
                                                bgcolor:
                                                  analysisKnowledgeBases[item.type]?.includes(knowledgeBase.id)
                                                    ? alpha(item.accent, 0.06)
                                                    : '#fff',
                                              }}
                                            >
                                              <FormControlLabel
                                                control={
                                                  <Checkbox
                                                    size="small"
                                                    checked={
                                                      analysisKnowledgeBases[item.type]?.includes(
                                                        knowledgeBase.id,
                                                      ) ?? false
                                                    }
                                                    onChange={(event) =>
                                                      toggleKnowledgeBase(
                                                        item.type,
                                                        knowledgeBase.id,
                                                        event.target.checked,
                                                      )
                                                    }
                                                  />
                                                }
                                                label={
                                                  <Stack spacing={0.1}>
                                                    <Typography variant="body2" fontWeight={700}>
                                                      {knowledgeBase.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                      {knowledgeBase.theme} • {knowledgeBase.description?.trim() || knowledgeBase.key}
                                                    </Typography>
                                                  </Stack>
                                                }
                                                sx={{
                                                  m: 0,
                                                  alignItems: 'flex-start',
                                                  width: '100%',
                                                }}
                                              />
                                            </Paper>
                                          ))}
                                        </Box>
                                      )}
                                    </Stack>

                                    <Stack spacing={1.25}>
                                      <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        justifyContent="space-between"
                                        alignItems={{ sm: 'center' }}
                                      >
                                        <Box>
                                          <Typography variant="subtitle2" fontWeight={800}>
                                            Features liberadas
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                            Controle o que o perfil pode fazer além dos prompts: RAG, rastreabilidade, ações sugeridas e contexto COMGEP.
                                          </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setAllFeatures(item.type)}
                                          >
                                            Todas
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => clearFeatures(item.type)}
                                          >
                                            Nenhuma
                                          </Button>
                                        </Stack>
                                      </Stack>
                                      <Box
                                        sx={{
                                          display: 'grid',
                                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                          gap: 1,
                                        }}
                                      >
                                        {AI_PROFILE_FEATURE_CATALOG.map((feature) => (
                                          <Paper
                                            key={`${item.type}-feature-${feature.id}`}
                                            variant="outlined"
                                            sx={{
                                              p: 1.1,
                                              borderRadius: 2,
                                              borderColor:
                                                analysisFeatures[item.type]?.includes(feature.id)
                                                  ? alpha(item.accent, 0.45)
                                                  : '#E6ECF5',
                                              bgcolor:
                                                analysisFeatures[item.type]?.includes(feature.id)
                                                  ? alpha(item.accent, 0.06)
                                                  : '#fff',
                                            }}
                                          >
                                            <FormControlLabel
                                              control={
                                                <Checkbox
                                                  size="small"
                                                  checked={
                                                    analysisFeatures[item.type]?.includes(feature.id) ??
                                                    false
                                                  }
                                                  onChange={(event) =>
                                                    toggleFeature(
                                                      item.type,
                                                      feature.id,
                                                      event.target.checked,
                                                    )
                                                  }
                                                />
                                              }
                                              label={
                                                <Stack spacing={0.1}>
                                                  <Typography variant="body2" fontWeight={700}>
                                                    {feature.label}
                                                  </Typography>
                                                  <Typography variant="caption" color="text.secondary">
                                                    {feature.description}
                                                  </Typography>
                                                </Stack>
                                              }
                                              sx={{
                                                m: 0,
                                                alignItems: 'flex-start',
                                                width: '100%',
                                              }}
                                            />
                                          </Paper>
                                        ))}
                                      </Box>
                                    </Stack>
                                  </Stack>
                                </Box>

                                <Box sx={{ p: 2 }}>
                                  <Stack spacing={1.25}>
                                    <Box>
                                      <Typography variant="subtitle2" fontWeight={800}>
                                        Prompt específico do perfil
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                        Instrução adicional usada só neste perfil. Se ficar vazio, o sistema usa o padrão interno.
                                      </Typography>
                                    </Box>
                                    <TextField
                                      size="small"
                                      label="Prompt do perfil (opcional)"
                                      value={analysisPrompts[item.type] ?? ''}
                                      onChange={(e) =>
                                        setAnalysisPrompts((prev) => ({
                                          ...prev,
                                          [item.type]: e.target.value,
                                        }))
                                      }
                                      placeholder={item.placeholder}
                                      multiline
                                      minRows={7}
                                      maxRows={18}
                                      fullWidth
                                    />
                                  </Stack>
                                </Box>
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        );
                      })}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}

          <Accordion
            expanded={expandedAiProfile === 'system'}
            onChange={(_, expanded) => setExpandedAiProfile(expanded ? 'system' : false)}
            disableGutters
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: (t) => alpha(t.palette.primary.main, 0.24),
              borderRadius: '16px !important',
              overflow: 'hidden',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 2,
                py: 1,
                minHeight: 84,
                bgcolor: (t) =>
                  expandedAiProfile === 'system'
                    ? alpha(t.palette.primary.main, 0.08)
                    : alpha(t.palette.primary.main, 0.03),
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="flex-start"
                sx={{ width: '100%' }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SmartToyRoundedIcon />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label="Global" size="small" color="primary" />
                      </Stack>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 0.8 }}>
                        System prompt
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        Regras comuns a todas as IAs: tom, idioma, limites e instruções globais.
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={form.systemPrompt.trim() ? 'success' : 'default'}
                      variant={form.systemPrompt.trim() ? 'filled' : 'outlined'}
                      label={form.systemPrompt.trim() ? 'Conteúdo carregado' : 'Sem conteúdo'}
                    />
                  </Stack>
                </Box>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 2 }}>
              <TextField
                size="small"
                label="Conteúdo do system prompt"
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                multiline
                minRows={8}
                maxRows={24}
                fullWidth
              />
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateSettings.isPending}
          sx={{ bgcolor: '#1A3C6E', '&:hover': { bgcolor: '#122B4E' } }}
        >
          {updateSettings.isPending ? 'Salvando...' : 'Salvar tudo'}
        </Button>
        <Button variant="outlined" onClick={handleTest} disabled={testConnection.isPending}>
          {testConnection.isPending ? 'Testando...' : 'Testar conexão LiteLLM'}
        </Button>
      </Stack>
    </Box>
  );
}

function ComgepSettingsTab() {
  const settingsQuery = useComgepScoringSettings();
  const updateSettings = useUpdateComgepScoringSettings();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<ComgepScoringGroupId | false>('risk');
  const [weights, setWeights] = useState<Partial<Record<ComgepScoringWeightKey, number>>>({});

  useEffect(() => {
    if (loaded || !settingsQuery.data) return;
    setWeights(settingsQuery.data.values);
    setLoaded(true);
  }, [loaded, settingsQuery.data]);

  const getCurrentValue = useCallback(
    (item: ComgepScoringSettingItem) => weights[item.key] ?? item.value ?? item.defaultValue,
    [weights],
  );

  const isDirty = useMemo(() => {
    const baseline: Partial<Record<ComgepScoringWeightKey, number>> =
      settingsQuery.data?.values ?? {};
    return Object.keys(weights).some((key) => {
      const typedKey = key as ComgepScoringWeightKey;
      return Number(weights[typedKey]) !== Number(baseline[typedKey]);
    });
  }, [settingsQuery.data?.values, weights]);

  const changedCountByGroup = useMemo(() => {
    const counts: Partial<Record<ComgepScoringGroupId, number>> = {};
    for (const group of settingsQuery.data?.groups ?? []) {
      counts[group.id] = group.items.filter((item) => getCurrentValue(item) !== item.value).length;
    }
    return counts;
  }, [getCurrentValue, settingsQuery.data?.groups]);

  const updateWeight = (item: ComgepScoringSettingItem, next: number) => {
    const bounded = Math.min(Math.max(next, item.min), item.max);
    setWeights((current) => ({
      ...current,
      [item.key]: Number.isFinite(bounded) ? Number(bounded.toFixed(3)) : item.defaultValue,
    }));
  };

  const handleInputChange = (item: ComgepScoringSettingItem, raw: string) => {
    if (raw.trim() === '') {
      setWeights((current) => ({ ...current, [item.key]: item.defaultValue }));
      return;
    }
    const normalized = Number(raw.replace(',', '.'));
    if (!Number.isFinite(normalized)) return;
    updateWeight(item, normalized);
  };

  const resetItem = (item: ComgepScoringSettingItem) => {
    setWeights((current) => ({
      ...current,
      [item.key]: item.defaultValue,
    }));
  };

  const resetGroup = (groupId: ComgepScoringGroupId) => {
    const group = settingsQuery.data?.groups.find((entry) => entry.id === groupId);
    if (!group) return;
    setWeights((current) => {
      const next = { ...current };
      for (const item of group.items) {
        next[item.key] = item.defaultValue;
      }
      return next;
    });
  };

  const resetAll = () => {
    const next: Partial<Record<ComgepScoringWeightKey, number>> = {};
    for (const item of settingsQuery.data?.groups.flatMap((group) => group.items) ?? []) {
      next[item.key] = item.defaultValue;
    }
    setWeights(next);
  };

  const handleSave = async () => {
    const baseline: Partial<Record<ComgepScoringWeightKey, number>> =
      settingsQuery.data?.values ?? {};
    const patch: Partial<Record<ComgepScoringWeightKey, number>> = {};
    for (const [key, currentValue] of Object.entries(weights)) {
      const typedKey = key as ComgepScoringWeightKey;
      if (Number(currentValue) !== Number(baseline[typedKey])) {
        patch[typedKey] = Number(currentValue);
      }
    }

    if (Object.keys(patch).length === 0) {
      toast.push({ message: 'Nenhuma alteração detectada.', severity: 'info' });
      return;
    }

    try {
      await updateSettings.mutateAsync({
        weights: patch,
      } satisfies ComgepScoringSettingsPatch);
      toast.push({
        message: 'Parâmetros do COMGEP salvos.',
        severity: 'success',
      });
      setLoaded(false);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar os parâmetros do COMGEP.',
        severity: 'error',
      });
    }
  };

  if (settingsQuery.isLoading) return <SkeletonState />;
  if (settingsQuery.isError) {
    return <ErrorState error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />;
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 'none' }}>
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2.5 }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <TuneRoundedIcon color="primary" sx={{ fontSize: 30 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Configuração COMGEP
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ajuste os pesos que compõem o score de risco e a presença operacional da Sala
            COMGEP. Maior peso significa maior impacto daquele fator no ranking exibido ao
            gestor. Os efeitos aparecem nas tabelas de OMs de maior risco e UFs com atuação
            prioritária.
          </Typography>
        </Box>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 2.5,
          borderRadius: 2.5,
          borderColor: (t) => alpha(t.palette.primary.main, 0.2),
          bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              Como ler esta configuração
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Os fatores de risco aumentam a prioridade de OMs e UFs. Os fatores de presença
              mostram o quanto já houve atuação operacional. A pressão operacional da UF é
              calculada cruzando esses dois blocos.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" color="primary" variant="outlined" label={`${settingsQuery.data?.groups.length ?? 0} grupos`} />
            <Chip
              size="small"
              color={isDirty ? 'warning' : 'success'}
              variant={isDirty ? 'filled' : 'outlined'}
              label={isDirty ? 'Há alterações não salvas' : 'Tudo sincronizado'}
            />
          </Stack>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {(settingsQuery.data?.groups ?? []).map((group) => (
          <Accordion
            key={group.id}
            expanded={expandedGroup === group.id}
            onChange={(_, expanded) => setExpandedGroup(expanded ? group.id : false)}
            disableGutters
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: alpha(group.id === 'risk' ? '#C62828' : '#1565C0', 0.22),
              borderRadius: '16px !important',
              overflow: 'hidden',
              bgcolor: '#fff',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 2,
                py: 1,
                minHeight: 88,
                bgcolor:
                  expandedGroup === group.id
                    ? alpha(group.id === 'risk' ? '#C62828' : '#1565C0', 0.06)
                    : '#fff',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ width: '100%' }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    bgcolor: alpha(group.id === 'risk' ? '#C62828' : '#1565C0', 0.12),
                    color: group.id === 'risk' ? '#C62828' : '#1565C0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {group.id === 'risk' ? (
                    <TrendingUpRoundedIcon sx={{ fontSize: 28 }} />
                  ) : (
                    <RadarRoundedIcon sx={{ fontSize: 28 }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ md: 'flex-start' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {group.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {group.description}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={`${group.items.length} fatores`} />
                      <Chip
                        size="small"
                        color={(changedCountByGroup[group.id] ?? 0) > 0 ? 'warning' : 'default'}
                        variant={(changedCountByGroup[group.id] ?? 0) > 0 ? 'filled' : 'outlined'}
                        label={
                          (changedCountByGroup[group.id] ?? 0) > 0
                            ? `${changedCountByGroup[group.id]} alterado(s)`
                            : 'Sem alterações'
                        }
                      />
                    </Stack>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
                    {group.effectSummary}
                  </Typography>
                </Box>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ md: 'center' }}
                sx={{ mb: 1.5 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Edite os pesos com granularidade fina. Se quiser voltar ao desenho original do
                  sistema, use os valores padrão.
                </Typography>
                <Button size="small" variant="outlined" onClick={() => resetGroup(group.id)}>
                  Restaurar padrão deste grupo
                </Button>
              </Stack>

              <Stack spacing={1.2}>
                {group.items.map((item) => {
                  const currentValue = getCurrentValue(item);
                  const dirty = currentValue !== item.value;
                  return (
                    <Paper
                      key={item.key}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        borderColor: dirty
                          ? alpha(group.id === 'risk' ? '#C62828' : '#1565C0', 0.35)
                          : '#E6ECF5',
                        bgcolor: dirty
                          ? alpha(group.id === 'risk' ? '#C62828' : '#1565C0', 0.03)
                          : '#fff',
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', lg: 'row' }}
                        spacing={1.5}
                        justifyContent="space-between"
                        alignItems={{ lg: 'flex-start' }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={item.appliesTo} variant="outlined" />
                            <Chip size="small" label={item.unitLabel} variant="outlined" />
                            {dirty && <Chip size="small" color="warning" label="Alterado" />}
                          </Stack>
                          <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                            {item.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.9 }}>
                            {item.impact}
                          </Typography>
                        </Box>

                        <Stack spacing={0.9} sx={{ width: { xs: '100%', lg: 260 }, flexShrink: 0 }}>
                          <TextField
                            size="small"
                            type="number"
                            label="Peso"
                            value={String(currentValue)}
                            onChange={(event) => handleInputChange(item, event.target.value)}
                            inputProps={{
                              min: item.min,
                              max: item.max,
                              step: item.step,
                            }}
                            helperText={`Padrão: ${item.defaultValue} • Faixa: ${item.min} a ${item.max}`}
                            fullWidth
                          />
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => updateWeight(item, currentValue - item.step)}>
                              -{item.step}
                            </Button>
                            <Button size="small" onClick={() => updateWeight(item, currentValue + item.step)}>
                              +{item.step}
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => resetItem(item)}>
                              Usar padrão
                            </Button>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
        <Button variant="contained" onClick={handleSave} disabled={updateSettings.isPending || !isDirty}>
          {updateSettings.isPending ? 'Salvando...' : 'Salvar parâmetros'}
        </Button>
        <Button variant="outlined" onClick={resetAll}>
          Restaurar todos os padrões
        </Button>
      </Stack>
    </Box>
  );
}

function EmailSettingsTab() {
  const toast = useToast();
  const settingsQuery = useEmailSettings();
  const updateSettings = useUpdateEmailSettings();
  const [loaded, setLoaded] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    if (loaded || !settingsQuery.data) return;
    setRecipientEmail(
      settingsQuery.data.cpcaPresidentSelfRegistrationRecipientEmail ?? '',
    );
    setLoaded(true);
  }, [loaded, settingsQuery.data]);

  const baseline =
    settingsQuery.data?.cpcaPresidentSelfRegistrationRecipientEmail ?? '';
  const normalizedDraft = normalizeEmailSettingDraft(recipientEmail);
  const isDirty = normalizedDraft !== baseline;

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        cpcaPresidentSelfRegistrationRecipientEmail: recipientEmail,
      });
      toast.push({
        message: 'Configuração de e-mail salva com sucesso.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          'Erro ao salvar configuração de e-mail.',
        severity: 'error',
      });
    }
  };

  if (settingsQuery.isLoading) return <SkeletonState />;
  if (settingsQuery.isError) {
    return (
      <ErrorState
        error={settingsQuery.error}
        onRetry={() => settingsQuery.refetch()}
      />
    );
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" fontWeight={800}>
          E-mails do sistema
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configure destinatários operacionais para notificações automáticas.
        </Typography>
      </Box>

      <Alert severity="info">
        Este endereço receberá um aviso quando um militar enviar cadastro como
        presidente CPCA pela tela de login.
      </Alert>

      <TextField
        label="Destinatário da autoinscrição de presidente CPCA"
        value={recipientEmail}
        onChange={(event) => setRecipientEmail(event.target.value)}
        placeholder="exemplo@fab.mil.br"
        fullWidth
      />

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          onClick={() => {
            void handleSave();
          }}
          disabled={updateSettings.isPending || !isDirty}
        >
          {updateSettings.isPending ? 'Salvando...' : 'Salvar e-mail'}
        </Button>
      </Stack>
    </Stack>
  );
}

export function AdminPage() {
  const { data: me } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'postos';
  const [currentTab, setCurrentTab] = useState(tabParam);
  const canViewCipavdLocalities = can(me, 'localities_cipavd', 'view');
  const canViewAiSettings = hasAnyRole(me, [ROLE_TI]);
  const canViewEmailSettings = hasAnyRole(me, [ROLE_TI]);
  const canViewKnowledgeBases = canViewAiSettings;
  const canViewComgepSettings = canViewAiSettings;
  const canViewBiNormalization = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);

  useEffect(() => {
    setCurrentTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (currentTab !== 'localities-cipavd' || canViewCipavdLocalities) return;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'postos');
    setSearchParams(params, { replace: true });
  }, [canViewCipavdLocalities, currentTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (currentTab !== 'bi-normalization' || canViewBiNormalization) return;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'postos');
    setSearchParams(params, { replace: true });
  }, [canViewBiNormalization, currentTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (currentTab !== 'knowledge-bases' || canViewKnowledgeBases) return;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'postos');
    params.delete('baseId');
    params.delete('docId');
    setSearchParams(params, { replace: true });
  }, [canViewKnowledgeBases, currentTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (currentTab !== 'comgep-settings' || canViewComgepSettings) return;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'postos');
    setSearchParams(params, { replace: true });
  }, [canViewComgepSettings, currentTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (currentTab !== 'emails' || canViewEmailSettings) return;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'postos');
    setSearchParams(params, { replace: true });
  }, [canViewEmailSettings, currentTab, searchParams, setSearchParams]);

  const handleTabChange = (_event: SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
    const params = new URLSearchParams(searchParams);
    params.set('tab', newValue);
    setSearchParams(params, { replace: true });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        Administração
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gerencie localidades SMIF e CIPAVD, postos, fases, papéis de elo e o
        mapeamento institucional do sistema, além das bases de conhecimento,
        das configurações de IA e dos parâmetros executivos do COMGEP.
      </Typography>

      <Card>
        <CardContent>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Localidades SMIF" value="localities" />
            {canViewCipavdLocalities && (
              <Tab label="Localidades CIPAVD" value="localities-cipavd" />
            )}
            <Tab label="Postos" value="postos" />
            <Tab label="Fases" value="phases" />
            <Tab label="Papéis de Elo" value="elo-roles" />
            <Tab label="Mapeamento Institucional" value="institutional-mapping" />
            {canViewBiNormalization && (
              <Tab label="Normalização BI" value="bi-normalization" />
            )}
            {canViewKnowledgeBases && (
              <Tab label="Bases de Conhecimento" value="knowledge-bases" />
            )}
            {canViewComgepSettings && (
              <Tab label="Configuração COMGEP" value="comgep-settings" />
            )}
            {canViewEmailSettings && <Tab label="E-mails" value="emails" />}
            {canViewAiSettings && <Tab label="Configuração IA" value="ai-settings" />}
          </Tabs>

          {currentTab === 'localities' && <LocalitiesTab />}
          {canViewCipavdLocalities && currentTab === 'localities-cipavd' && (
            <CipavdLocalitiesTab />
          )}
          {currentTab === 'postos' && <PostosTab />}
          {currentTab === 'phases' && <PhasesTab />}
          {currentTab === 'elo-roles' && <EloRolesTab />}
          {currentTab === 'institutional-mapping' && <InstitutionalMappingTab />}
          {canViewBiNormalization && currentTab === 'bi-normalization' && (
            <BiNormalizationTab />
          )}
          {canViewKnowledgeBases && currentTab === 'knowledge-bases' && (
            <KnowledgeBasesTab />
          )}
          {canViewComgepSettings && currentTab === 'comgep-settings' && (
            <ComgepSettingsTab />
          )}
          {canViewEmailSettings && currentTab === 'emails' && (
            <EmailSettingsTab />
          )}
          {canViewAiSettings && currentTab === 'ai-settings' && <AiSettingsTab />}
        </CardContent>
      </Card>
    </Box>
  );
}
