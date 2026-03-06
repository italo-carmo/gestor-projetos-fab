import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DescriptionIcon from '@mui/icons-material/Description';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TerrainIcon from '@mui/icons-material/Terrain';
import PlaceIcon from '@mui/icons-material/Place';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GavelIcon from '@mui/icons-material/Gavel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCreateLessonLearned,
  useDashboardNational,
  useLessonsLearned,
  useMe,
  useUpdateLessonLearned,
} from '../api/hooks';
import { toMilitaryDisplayName } from '../app/militaryName';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
type NationalLocalityItem = {
  localityId: string;
  localityCode?: string | null;
  localityName: string;
  commandName?: string | null;
  progress: number;
  recruitsFemaleCountCurrent?: number | null;
  commanderName?: string | null;
  visitDate?: string | null;
  late: number;
  unassigned: number;
};
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
};

type IndicatorTile = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
};

type LessonPost = {
  id: string;
  title: string;
  content: string;
  authorLabel?: string | null;
  createdAt: string;
};

export function DashboardNationalPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const localityId = params.get('localityId') ?? '';
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const canViewLessons =
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI, ROLE_COMANDANTE_COMGEP]) &&
    can(me, 'lessons_learned', 'view');
  const canManageLessons =
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]) &&
    can(me, 'lessons_learned', 'create');
  const lessonsQuery = useLessonsLearned({}, canViewLessons);
  const createLesson = useCreateLessonLearned();
  const updateLesson = useUpdateLessonLearned();
  const qc = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [showVisitColumn, setShowVisitColumn] = useState(true);
  const [lessonOffset, setLessonOffset] = useState(0);
  const [lessonsDrawerOpen, setLessonsDrawerOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', content: '' });

  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const updateVisibility = () => {
      // Hide visit column when the area gets narrow to avoid horizontal scrolling.
      const minWidthWithVisitColumn = 760;
      setShowVisitColumn(element.clientWidth >= minWidthWithVisitColumn);
    };

    updateVisibility();
    const observer = new ResizeObserver(updateVisibility);
    observer.observe(element);
    window.addEventListener('resize', updateVisibility);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateVisibility);
    };
  }, []);

  const lessons = ((lessonsQuery.data?.items ?? []) as LessonPost[])
    .filter((item) => item?.id)
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

  const items = (dashboardQuery.data?.items ?? []) as NationalLocalityItem[];
  const smifLocalities = [...items]
    .sort((a, b) => a.localityName.localeCompare(b.localityName, 'pt-BR'))
    .slice(0, 8);
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
  const lessonsPerView = 3;
  const visibleLessons =
    lessons.length <= lessonsPerView
      ? lessons
      : Array.from({ length: lessonsPerView }, (_, index) => {
          const safeIndex = (lessonOffset + index) % lessons.length;
          return lessons[safeIndex];
        });

  const resetLessonForm = () => {
    setEditingLessonId(null);
    setLessonForm({ title: '', content: '' });
  };

  const openCreateLesson = () => {
    resetLessonForm();
    setLessonsDrawerOpen(true);
  };

  const openEditLesson = (post: LessonPost) => {
    setEditingLessonId(post.id);
    setLessonForm({
      title: String(post.title ?? ''),
      content: String(post.content ?? ''),
    });
    setLessonsDrawerOpen(true);
  };

  const handleSaveLesson = async () => {
    const title = lessonForm.title.trim();
    const content = lessonForm.content.trim();
    if (!title || !content) {
      toast.push({ message: 'Preencha título e conteúdo.', severity: 'warning' });
      return;
    }
    try {
      if (editingLessonId) {
        await updateLesson.mutateAsync({
          id: editingLessonId,
          payload: {
            title,
            content,
          },
        });
        toast.push({ message: 'Lição atualizada.', severity: 'success' });
      } else {
        await createLesson.mutateAsync({
          title,
          content,
        });
        toast.push({ message: 'Lição criada.', severity: 'success' });
      }
      setLessonsDrawerOpen(false);
      resetLessonForm();
      await lessonsQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar lição aprendida.',
        severity: 'error',
      });
    }
  };
  const averageProgress = smifLocalities.length
    ? Math.round(smifLocalities.reduce((acc, item) => acc + Number(item.progress ?? 0), 0) / smifLocalities.length)
    : 0;
  const formatGsdLabel = (localityName?: string | null, localityCode?: string | null) => {
    const code = String(localityCode ?? '').trim();
    const normalized = String(localityName ?? '').trim();
    return code || normalized || '—';
  };
  const formatCommanderName = (commanderName?: string | null) => {
    const base = toMilitaryDisplayName(commanderName);
    if (!base) return '—';
    const sanitized = base
      .replace(/\s+(?:GSD|OM)(?:\s*[-/]\s*|\s+)?[A-Z0-9]{1,8}$/i, '')
      .replace(/\s+(?:GSD|OM)$/i, '')
      .trim();
    return sanitized || base;
  };

  const completedIndicators: IndicatorTile[] = [
    {
      label: 'Relatórios',
      value: String(totals.completedReports ?? 0),
      helper: 'Concluídos',
      icon: <DescriptionIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Tarefas',
      value: String(totals.completedTasks ?? 0),
      helper: 'Concluídas nas localidades',
      icon: <TaskAltIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Atividades de campo',
      value: String(totals.completedFieldActivities ?? 0),
      helper: 'Concluídas',
      icon: <TerrainIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Visitas',
      value: String(totals.completedVisits ?? 0),
      helper: 'Concluídas',
      icon: <PlaceIcon sx={{ fontSize: 22 }} />,
    },
  ];
  const fieldBySpecialtyIndicators: IndicatorTile[] = [
    {
      label: 'Psicologia',
      value: String(totals.fieldActivitiesBySpecialty?.psychology ?? 0),
      helper: 'Atividades concluídas',
      icon: <PsychologyIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Serviço Social',
      value: String(totals.fieldActivitiesBySpecialty?.socialService ?? 0),
      helper: 'Atividades concluídas',
      icon: <VolunteerActivismIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Doutrina',
      value: String(totals.fieldActivitiesBySpecialty?.doctrine ?? 0),
      helper: 'Atividades concluídas',
      icon: <MenuBookIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Direito',
      value: String(totals.fieldActivitiesBySpecialty?.law ?? 0),
      helper: 'Atividades concluídas',
      icon: <GavelIcon sx={{ fontSize: 22 }} />,
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Painel de Comando - SMIF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Acompanhamento estratégico do alistamento feminino, execução de atividades e prontidão nas OM.
      </Typography>
      <Box
        sx={{
          display: 'grid',
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
            title: 'Concluídos no SMIF',
            subtitle: `Execução média atual: ${averageProgress}%`,
            items: completedIndicators,
            bg: '#1F4A61',
            border: '1px solid rgba(139, 184, 207, 0.38)',
            shadow: '0 18px 34px rgba(15,44,59,0.36)',
            titleColor: '#F4FAFD',
            subtitleColor: 'rgba(231,244,250,0.92)',
          },
          {
            title: 'Atividades de Campo por Área',
            subtitle: 'Somente atividades de campo concluídas',
            items: fieldBySpecialtyIndicators,
            bg: '#2F6F8A',
            border: '1px solid rgba(132, 178, 201, 0.36)',
            shadow: '0 18px 34px rgba(16,40,53,0.38)',
            titleColor: '#F2FBFE',
            subtitleColor: 'rgba(236,250,255,0.9)',
          },
        ].map((group) => (
          <Card
            key={group.title}
            sx={{
              background: group.bg,
              border: group.border,
              width: '100%',
              borderRadius: 3,
              boxShadow: group.shadow,
            }}
          >
            <CardContent sx={{ p: 2.25 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: 0.2, color: group.titleColor }}>
                {group.title}
              </Typography>
              <Typography variant="caption" sx={{ color: group.subtitleColor }}>
                {group.subtitle}
              </Typography>
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
                {group.items.map((item) => (
                  <Box
                    key={item.label}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.5)',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      minHeight: 106,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
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
                        {item.helper}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Grid container spacing={1.2} sx={{ mt: 0 }} alignItems="stretch">
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
          <Card sx={{ width: '100%', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Localidades
              </Typography>
              {smifLocalities.length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhuma localidade encontrada." />
              ) : (
                <TableContainer ref={tableContainerRef} sx={{ width: '100%', overflowX: 'hidden' }}>
                  <Table
                    size="small"
                    sx={{
                      width: '100%',
                      tableLayout: 'fixed',
                      '& .MuiTableCell-root': {
                        px: 0.45,
                        py: 0.6,
                      },
                      '& .MuiTableBody-root .MuiTableCell-root': {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 600, width: '12%', px: 0.4 }}>GSD</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, width: '10%', px: 0.4 }}>% Geral</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, width: '12%', px: 0.4, whiteSpace: 'normal', lineHeight: 1.2 }}>
                          Rec. Fem.
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, width: showVisitColumn ? '46%' : '66%', px: 0.4 }}>Comandante</TableCell>
                        {showVisitColumn && (
                          <TableCell sx={{ color: 'white', fontWeight: 600, width: '20%', px: 0.4 }}>Visita</TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {smifLocalities.map((loc) => (
                        <TableRow
                          key={loc.localityId}
                          hover
                          onClick={() => navigate(`/dashboard/locality/${loc.localityId}`)}
                          onMouseEnter={() =>
                            qc.prefetchQuery({
                              queryKey: ['localityProgress', loc.localityId],
                              queryFn: async () =>
                                (await api.get(`/localities/${loc.localityId}/progress`)).data,
                            })
                          }
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell sx={{ px: 0.4 }}>
                            <Typography variant="body2" fontWeight={700}>
                              {formatGsdLabel(loc.localityName, loc.localityCode)}
                            </Typography>
                            {loc.commandName && (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {loc.commandName}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ px: 0.4 }}>{Math.round(loc.progress)}%</TableCell>
                          <TableCell sx={{ px: 0.4 }}>{loc.recruitsFemaleCountCurrent ?? 0}</TableCell>
                          <TableCell sx={{ px: 0.4 }}>
                            <Typography variant="body2" noWrap>
                              {formatCommanderName(loc.commanderName)}
                            </Typography>
                          </TableCell>
                          {showVisitColumn && (
                            <TableCell sx={{ px: 0.4 }}>
                              {loc.visitDate ? new Date(loc.visitDate).toLocaleDateString('pt-BR') : '—'}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
          <Card sx={{ width: '100%', height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Lições aprendidas</Typography>
                {canManageLessons && (
                  <IconButton
                    size="small"
                    onClick={openCreateLesson}
                    title="Adicionar ou editar lições aprendidas"
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                )}
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
                  Nenhuma lição aprendida cadastrada.
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
                      sx={{
                        transition: 'transform 280ms ease, opacity 280ms ease',
                        backgroundColor: 'rgb(83, 127, 151)',
                        borderColor: 'rgba(83, 127, 151, 0.9)',
                      }}
                    >
                      <CardContent sx={{ p: 1.2, backgroundColor: 'rgb(83, 127, 151)' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25, color: '#F4FAFD' }}>
                          {lesson.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 0.6,
                            color: 'rgba(244, 250, 253, 0.94)',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {lesson.content}
                        </Typography>
                        <Box display="flex" justifyContent="space-between" gap={1} mt={1}>
                          <Typography variant="caption" sx={{ color: 'rgba(236, 248, 252, 0.92)' }} noWrap>
                            {lesson.authorLabel || 'Coordenação CIPAVD'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(236, 248, 252, 0.9)' }} noWrap>
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
        </Grid>
      </Grid>
      <Drawer
        anchor="right"
        open={lessonsDrawerOpen}
        onClose={() => {
          setLessonsDrawerOpen(false);
          resetLessonForm();
        }}
        PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
      >
        <Box p={3} pt={5} display="flex" flexDirection="column" gap={1.4}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              {editingLessonId ? 'Editar lição aprendida' : 'Nova lição aprendida'}
            </Typography>
            <Button size="small" variant="outlined" onClick={openCreateLesson}>
              Nova
            </Button>
          </Stack>
          <TextField
            size="small"
            label="Título"
            value={lessonForm.title}
            onChange={(event) =>
              setLessonForm((prev) => ({ ...prev, title: event.target.value }))
            }
            fullWidth
          />
          <TextField
            size="small"
            label="Texto"
            value={lessonForm.content}
            onChange={(event) =>
              setLessonForm((prev) => ({ ...prev, content: event.target.value }))
            }
            multiline
            minRows={4}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={handleSaveLesson}
              disabled={createLesson.isPending || updateLesson.isPending}
            >
              Salvar
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setLessonsDrawerOpen(false);
                resetLessonForm();
              }}
            >
              Cancelar
            </Button>
          </Stack>
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Lições cadastradas
          </Typography>
          <Box sx={{ display: 'grid', gap: 1, maxHeight: '55vh', overflowY: 'auto', pr: 0.3 }}>
            {lessons.map((lesson) => (
              <Card key={lesson.id} variant="outlined">
                <CardContent sx={{ p: 1.2 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>
                      {lesson.title}
                    </Typography>
                    <IconButton size="small" onClick={() => openEditLesson(lesson)}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      mt: 0.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {lesson.content}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
