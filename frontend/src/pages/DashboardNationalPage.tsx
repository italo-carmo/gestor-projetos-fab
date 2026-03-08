import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TerrainIcon from '@mui/icons-material/Terrain';
import PlaceIcon from '@mui/icons-material/Place';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GavelIcon from '@mui/icons-material/Gavel';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useDashboardNational,
  useLessonsLearned,
  useMe,
} from '../api/hooks';
import { toMilitaryDisplayName } from '../app/militaryName';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
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
  participantsKpis?: {
    instructors: number;
    recruits: number;
    eloPsychology: number;
    eloSocialAssistance: number;
    eloGraduadoMaster: number;
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
  typeId: string;
  type?: {
    id: string;
    name: string;
    colorHex: string;
    textColorHex?: string | null;
  } | null;
};

export function DashboardNationalPage() {
  const { data: me } = useMe();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const localityId = params.get('localityId') ?? '';
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const canViewLessons =
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI, ROLE_COMANDANTE_COMGEP]) &&
    can(me, 'lessons_learned', 'view');
  const lessonsQuery = useLessonsLearned({}, canViewLessons);
  const qc = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [showVisitColumn, setShowVisitColumn] = useState(true);
  const [lessonOffset, setLessonOffset] = useState(0);
  const [readingLesson, setReadingLesson] = useState<LessonPost | null>(null);

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
  const totalElos = (totals.participantsKpis?.eloPsychology ?? 0) + 
                    (totals.participantsKpis?.eloSocialAssistance ?? 0) + 
                    (totals.participantsKpis?.eloGraduadoMaster ?? 0);
  const participantsIndicators: IndicatorTile[] = [
    {
      label: 'Instrutores',
      value: String(totals.participantsKpis?.instructors ?? 0),
      helper: 'Total de instrutores',
      icon: <PersonIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Recrutas',
      value: String(totals.participantsKpis?.recruits ?? 0),
      helper: 'Total de recrutas',
      icon: <SchoolIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Elos',
      value: String(totalElos),
      helper: 'Total de elos',
      icon: <GroupIcon sx={{ fontSize: 22 }} />,
    },
    {
      label: 'Graduados Master',
      value: String(totals.participantsKpis?.eloGraduadoMaster ?? 0),
      helper: 'Total de graduados',
      icon: <WorkspacePremiumIcon sx={{ fontSize: 22 }} />,
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
        <Card
          sx={{
            background: '#3A7A9A',
            border: '1px solid rgba(145, 195, 220, 0.36)',
            width: '100%',
            borderRadius: 3,
            boxShadow: '0 18px 34px rgba(18,42,56,0.38)',
          }}
        >
          <CardContent sx={{ p: 2.25 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: 0.2, color: '#F0F9FC' }}>
              Número de Participantes
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(238,251,255,0.9)' }}>
              Total de participantes em atividades concluídas
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
              {participantsIndicators.map((item) => (
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
        <Card sx={{ width: '100%', height: '100%' }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Resultados Positivos</Typography>
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
                          <Typography
                            variant="caption"
                            sx={{ color: lesson.type?.textColorHex || 'rgba(236, 248, 252, 0.92)' }}
                            noWrap
                          >
                            {lesson.authorLabel || 'Coordenação CIPAVD'}
                          </Typography>
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
      </Box>

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
    </Box>
  );
}
