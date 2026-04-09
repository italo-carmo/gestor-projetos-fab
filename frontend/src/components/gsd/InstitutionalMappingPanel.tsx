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
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMe,
  useMissionChecklistMapping,
  useUpdateMissionChecklist,
  useUploadMissionChecklistPhoto,
} from '../../api/hooks';
import { parseApiError } from '../../app/apiErrors';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../../app/roleAccess';
import { useToast } from '../../app/toast';

function resolveChecklistPhotoUrl(raw: string) {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('/missions/checklist/uploads/')) return `/api${url}`;
  return url;
}

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
  { label: string; colorHex: string | null }
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

const INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH = 230;
const INSTITUTIONAL_LOCALITY_COLUMN_WIDTH = 150;
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

function formatDatePtBr(value?: string | null) {
  if (!value) return 'Sem data';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem data';
  return parsed.toLocaleDateString('pt-BR');
}

function formatDateTimePtBr(value?: string | null) {
  if (!value) return 'Sem data';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem data';
  return parsed.toLocaleString('pt-BR');
}

function formatMissionPeriod(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return 'Período não informado';
  return `${formatDatePtBr(startDate)} a ${formatDatePtBr(endDate)}`;
}

export function InstitutionalMappingPanel() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const toast = useToast();

  const updateMissionChecklist = useUpdateMissionChecklist();
  const uploadMissionChecklistPhoto = useUploadMissionChecklistPhoto();
  const missionChecklistMappingQuery = useMissionChecklistMapping({
    scope: "SMIF",
  });

  const [institutionalDetail, setInstitutionalDetail] =
    useState<InstitutionalChecklistDetailState>(null);
  const [institutionalScheduleExpanded, setInstitutionalScheduleExpanded] = useState(false);
  const [institutionalDraftClassification, setInstitutionalDraftClassification] =
    useState<InstitutionalChecklistClassification>('NECESSITA_ANALISE');
  const [institutionalDraftNotes, setInstitutionalDraftNotes] = useState('');
  const [institutionalPhotoCarouselIndex, setInstitutionalPhotoCarouselIndex] =
    useState(0);

  const institutionalPhotos = institutionalDetail?.cell.photos ?? [];

  useEffect(() => {
    if (institutionalPhotos.length <= 1) return;
    const t = setInterval(() => {
      setInstitutionalPhotoCarouselIndex((i) => (i + 1) % institutionalPhotos.length);
    }, 5000);
    return () => clearInterval(t);
  }, [institutionalDetail?.itemId, institutionalPhotos.length]);

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
          label: String(classification.label ?? '').trim() || fallback.label,
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

  const institutionalClassificationById = useMemo(
    () =>
      new Map(
        institutionalClassifications.map((classification) => [
          classification.id,
          classification,
        ]),
      ),
    [institutionalClassifications],
  );

  const missionByLocality = useMemo(
    () =>
      new Map<string, InstitutionalChecklistMission | null>(
        (institutionalMapping?.missionsByLocality ?? []).map((entry) => [
          entry.localityId,
          entry.mission,
        ]),
      ),
    [institutionalMapping?.missionsByLocality],
  );

  const openInstitutionalDetail = (
    section: InstitutionalChecklistSection,
    item: InstitutionalChecklistItem,
    locality: { id: string; name: string; code?: string | null },
    cell: InstitutionalChecklistCell,
  ) => {
    if (!cell.missionId) return;
    setInstitutionalScheduleExpanded(false);
    setInstitutionalDraftClassification(cell.classification ?? 'NECESSITA_ANALISE');
    setInstitutionalDraftNotes(cell.notes ?? '');
    setInstitutionalPhotoCarouselIndex(0);
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

  return (
    <>
      <Card
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
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
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#164c68', mb: 0.7, letterSpacing: 0.2, textTransform: 'uppercase' }}>
                  Legenda de classificação
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.55, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
                  {institutionalClassifications.map((legendItem) => {
                    const legendStyle = resolveChecklistClassificationStyle(legendItem.colorHex);
                    return (
                      <Box key={legendItem.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.55, minWidth: 0, px: 0.7, py: 0.48, borderRadius: 1.25, border: `1px solid ${legendStyle.borderColor}`, bgcolor: legendStyle.bgColor }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: legendStyle.color, border: `1px solid ${legendStyle.borderColor}`, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.67rem', lineHeight: 1.15, color: '#244459', fontWeight: 700 }}>
                          {legendItem.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <TableContainer sx={{ border: '1px solid rgba(15, 23, 42, 0.08)', borderRadius: 2, width: '100%', maxWidth: '100%', minWidth: 0, display: 'block', overflowX: 'auto', overflowY: { xs: 'auto', md: 'visible' }, maxHeight: { xs: '64vh', md: 'none' } }}>
                <Table size="small" stickyHeader sx={{ width: `${institutionalTableWidth}px`, minWidth: '100%', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px` }} />
                    {institutionalLocalities.map((locality) => (
                      <col key={`column-${locality.id}`} style={{ width: `${INSTITUTIONAL_LOCALITY_COLUMN_WIDTH}px` }} />
                    ))}
                  </colgroup>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, width: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`, minWidth: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`, bgcolor: '#eaf4fa', py: 0.6, px: 0.7, fontSize: '0.7rem', zIndex: 3 }}>
                        Dimensão observada
                      </TableCell>
                      {institutionalLocalities.map((locality) => (
                        <TableCell key={locality.id} sx={{ width: `${INSTITUTIONAL_LOCALITY_COLUMN_WIDTH}px`, minWidth: `${INSTITUTIONAL_LOCALITY_COLUMN_WIDTH}px`, bgcolor: '#f1f8fc', py: 0.45, px: 0.55, zIndex: 3 }}>
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
                          const sectionMeta = institutionalSectionHighlightMeta[section.id] ?? {
                            color: '#486477',
                            bgColor: '#ffffff',
                            borderColor: 'rgba(15,23,42,0.1)',
                          };
                          return (
                            <TableCell colSpan={institutionalTotalColumns} sx={{ py: 0.1, px: 0.7, fontWeight: 700, fontSize: '0.63rem', letterSpacing: 0.22, textTransform: 'uppercase', color: sectionMeta.color, bgcolor: sectionMeta.bgColor, borderLeft: `3px solid ${sectionMeta.borderColor}`, borderTop: sectionIndex === 0 ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(15,23,42,0.1)', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                              {section.title}
                            </TableCell>
                          );
                        })()}
                      </TableRow>,
                      ...section.items.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell sx={{ bgcolor: '#f8fbfe', width: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`, minWidth: `${INSTITUTIONAL_DESCRIPTION_COLUMN_WIDTH}px`, borderRight: '1px solid rgba(15,23,42,0.06)', py: 0.18, px: 0.4, verticalAlign: 'middle' }}>
                            <Box sx={{ minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {section.id === 'analise_riscos' && item.prompt ? (
                                <Tooltip arrow placement="top-start" title={<Typography sx={{ fontSize: '0.72rem', lineHeight: 1.25 }}>{item.prompt}</Typography>}>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.66rem', lineHeight: 1.06, cursor: 'help', textAlign: 'left' }}>
                                    {item.title}
                                  </Typography>
                                </Tooltip>
                              ) : (
                                <Typography sx={{ fontWeight: 700, fontSize: '0.66rem', lineHeight: 1.06, textAlign: 'left' }}>
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
                              ? institutionalClassificationById.get(cell.classification) ?? {
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
                              <TableCell key={`${item.id}-${locality.id}`} sx={{ py: 0.12, px: 0.2, verticalAlign: 'middle' }}>
                                <Box
                                  role={isClickable ? 'button' : undefined}
                                  tabIndex={isClickable ? 0 : undefined}
                                  onClick={isClickable ? () => openInstitutionalDetail(section, item, locality, cell) : undefined}
                                  onKeyDown={isClickable ? (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      openInstitutionalDetail(section, item, locality, cell);
                                    }
                                  } : undefined}
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
                                    transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                                  }}
                                >
                                  <Typography sx={{ color: '#334155', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.58rem', lineHeight: 1.02, textAlign: 'left' }}>
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

      <Dialog open={Boolean(institutionalDetail)} onClose={() => setInstitutionalDetail(null)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pb: 0.6 }}>
          Mapeamento institucional -{' '}
          {institutionalDetail ? `${institutionalDetail.localityCode || institutionalDetail.localityName}` : 'Detalhes'}
        </DialogTitle>
        <DialogContent dividers>
          {institutionalDetail ? (
            <Stack spacing={1.5}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 1.4 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>{institutionalDetail.sectionTitle}</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.2 }}>{institutionalDetail.itemTitle}</Typography>
                      {institutionalDetail.itemPrompt ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                          {institutionalDetail.itemPrompt}
                        </Typography>
                      ) : null}
                    </Box>
                    {canEditInstitutionalChecklist && Boolean(institutionalDetail.mission?.id) ? (
                      <TextField
                        select
                        size="small"
                        label="Classificação"
                        value={institutionalDraftClassification}
                        onChange={(event) =>
                          setInstitutionalDraftClassification(
                            event.target.value as InstitutionalChecklistClassification,
                          )
                        }
                        sx={{ minWidth: { xs: '100%', md: 320 } }}
                        disabled={updateMissionChecklist.isPending}
                      >
                        {institutionalClassifications.map((classification) => (
                          <MenuItem key={classification.id} value={classification.id}>
                            {classification.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (() => {
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
                              border: `1px solid ${style?.borderColor ?? '#cbd5e1'}`,
                              fontWeight: 700,
                            }}
                          />
                        );
                      })()}
                  </Stack>

                  {canEditInstitutionalChecklist && Boolean(institutionalDetail.mission?.id) ? (
                    <TextField
                      label="Observações"
                      value={institutionalDraftNotes}
                      onChange={(event) => setInstitutionalDraftNotes(event.target.value)}
                      multiline
                      minRows={4}
                      fullWidth
                      sx={{ mt: 1 }}
                      disabled={updateMissionChecklist.isPending}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ mt: 1, p: 1, borderRadius: 1.2, backgroundColor: '#f8fbfe', border: '1px solid rgba(15,23,42,0.08)', whiteSpace: 'pre-wrap' }}>
                      {institutionalDetail.cell.notes.trim() || 'Sem observações registradas para este item.'}
                    </Typography>
                  )}

                  {((canEditInstitutionalChecklist && Boolean(institutionalDetail.mission?.id)) || (institutionalDetail.cell.photos ?? []).length > 0) ? (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>
                        Fotos relacionadas
                      </Typography>

                      {canEditInstitutionalChecklist && Boolean(institutionalDetail.mission?.id) ? (
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 1 }}>
                          <Button component="label" variant="outlined" size="small" disabled={uploadMissionChecklistPhoto.isPending}>
                            {uploadMissionChecklistPhoto.isPending ? 'Enviando...' : 'Adicionar foto'}
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
                      ) : null}

                      {(institutionalDetail.cell.photos ?? []).length > 0 ? (() => {
                        const photos = institutionalDetail.cell.photos ?? [];
                        const idx = Math.min(institutionalPhotoCarouselIndex, photos.length - 1);
                        const currentUrl = photos[idx];
                        const resolvedUrl = resolveChecklistPhotoUrl(currentUrl);
                        return (
                          <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(15,23,42,0.15)', bgcolor: '#fff', minHeight: 200, maxHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box component="a" href={resolvedUrl} target="_blank" rel="noreferrer" sx={{ display: 'block', flex: 1, minHeight: 200, maxHeight: 340 }}>
                              <Box component="img" src={resolvedUrl} alt={`Foto do mapeamento institucional ${idx + 1}`} sx={{ width: '100%', height: '100%', maxHeight: 340, objectFit: 'contain', display: 'block' }} />
                            </Box>
                            {photos.length > 1 ? (
                              <>
                                <IconButton size="small" onClick={() => setInstitutionalPhotoCarouselIndex((i) => (i <= 0 ? photos.length - 1 : i - 1))} sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.9)' }}>
                                  <ChevronLeftIcon />
                                </IconButton>
                                <IconButton size="small" onClick={() => setInstitutionalPhotoCarouselIndex((i) => (i >= photos.length - 1 ? 0 : i + 1))} sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.9)' }}>
                                  <ChevronRightIcon />
                                </IconButton>
                              </>
                            ) : null}
                            {canEditInstitutionalChecklist ? (
                              <IconButton size="small" color="error" onClick={() => handleRemoveInstitutionalPhoto(currentUrl)} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)' }}>
                                <DeleteOutlineIcon fontSize="inherit" />
                              </IconButton>
                            ) : null}
                          </Box>
                        );
                      })() : null}
                    </Box>
                  ) : null}
                </CardContent>
              </Card>

              {institutionalDetail.mission ? (
                <>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.4 }}>
                      <Typography variant="subtitle1" fontWeight={700}>Missão relacionada</Typography>
                      <Typography variant="h6" sx={{ mt: 0.5 }}>{institutionalDetail.mission.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                        {institutionalDetail.mission.description || 'Sem descrição.'}
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                        <Chip size="small" label={`Período: ${formatMissionPeriod(institutionalDetail.mission.startDate, institutionalDetail.mission.endDate)}`} />
                        <Chip size="small" label={`Atualização: ${formatDateTimePtBr(institutionalDetail.mission.updatedAt)}`} />
                        <Chip size="small" label={`Participantes: ${institutionalDetail.mission.participantsCount}`} />
                        <Chip size="small" label={`Itens de cronograma: ${institutionalDetail.mission.scheduleItemsCount}`} />
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.4 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: institutionalScheduleExpanded ? 1 : 0 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Cronograma da missão</Typography>
                        {institutionalDetail.mission.scheduleItems.length > 0 ? (
                          <Button size="small" variant={institutionalScheduleExpanded ? 'outlined' : 'contained'} onClick={() => setInstitutionalScheduleExpanded((current) => !current)}>
                            {institutionalScheduleExpanded ? 'Ocultar cronograma' : 'Ver cronograma'}
                          </Button>
                        ) : null}
                      </Stack>

                      {institutionalDetail.mission.scheduleItems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">Missão sem itens de cronograma.</Typography>
                      ) : (
                        <Collapse in={institutionalScheduleExpanded} timeout="auto" unmountOnExit>
                          <TableContainer sx={{ border: '1px solid rgba(15, 23, 42, 0.08)', borderRadius: 1.5, overflowY: 'visible' }}>
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
                                      <Typography variant="body2" fontWeight={600}>{item.title}</Typography>
                                      <Typography variant="caption" color="text.secondary">{item.durationMinutes} min</Typography>
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
                                  institutionalClassificationById.get(item.classification) ??
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
                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.45, whiteSpace: 'pre-wrap' }}>
                                      {item.notes || 'Sem observações.'}
                                    </Typography>
                                    {(item.photos ?? []).length > 0 ? (
                                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.55 }}>
                                        {item.photos.map((photoUrl) => (
                                          <Box
                                            key={photoUrl}
                                            component="a"
                                            href={resolveChecklistPhotoUrl(photoUrl)}
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
                                              src={resolveChecklistPhotoUrl(photoUrl)}
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
            <Button variant="contained" onClick={saveInstitutionalChecklistItem} disabled={updateMissionChecklist.isPending}>
              {updateMissionChecklist.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          ) : null}
          {institutionalDetail?.mission?.id ? (
            <Button
              onClick={() => {
                const missionId = institutionalDetail.mission?.id || '';
                navigate(`/missions?missionId=${encodeURIComponent(missionId)}`);
              }}
            >
              Abrir missão
            </Button>
          ) : null}
          <Button onClick={() => setInstitutionalDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
