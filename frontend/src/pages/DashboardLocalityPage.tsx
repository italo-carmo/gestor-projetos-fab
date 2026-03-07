import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import {
  useActivities,
  useBestPractices,
  useDashboardNational,
  useDocuments,
  useLocalityProgress,
  useMeetings,
  useMissions,
  useNotices,
  useTasks,
  useMe,
  useTaskTemplates,
} from '../api/hooks';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { ProgressInline } from '../components/chips/ProgressInline';
import { DueBadge } from '../components/chips/DueBadge';

export function DashboardLocalityPage() {
  const { id } = useParams();
  const { data: me } = useMe();
  const dashboardQuery = useDashboardNational({});
  const progressQuery = useLocalityProgress(id ?? '');
  const tasksQuery = useTasks({ localityId: id });
  const templatesQuery = useTaskTemplates();
  const canViewBestPractices = can(me, 'best_practices', 'view');
  const canViewNotices = can(me, 'notices', 'view');
  const canViewMeetings = can(me, 'meetings', 'view');
  const canViewDocuments =
    can(me, 'search', 'view') &&
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]);
  const activitiesQuery = useActivities({ localityId: id, pageSize: '20' });
  const bestPracticesQuery = useBestPractices({ localityId: id }, canViewBestPractices);
  const noticesQuery = useNotices({ localityId: id, pageSize: '20' }, canViewNotices);
  const missionsQuery = useMissions({ localityId: id, pageSize: '20' }, Boolean(id));
  const meetingsQuery = useMeetings({ localityId: id, pageSize: '20' }, canViewMeetings);
  const documentsQuery = useDocuments({ localityId: id, pageSize: '20' }, canViewDocuments);

  if (progressQuery.isLoading) return <SkeletonState />;
  if (progressQuery.isError) return <ErrorState error={progressQuery.error} onRetry={() => progressQuery.refetch()} />;

  const progress = progressQuery.data;
  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));

  const upcoming = [...tasks]
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);
  // Filtrar tarefas atrasadas excluindo as que estão com status DONE
  const late = tasks.filter((task: any) => task.isLate && task.status !== 'DONE').slice(0, 5);
  const unassigned = tasks.filter((task: any) => task.hasAssignee === false).slice(0, 5);

  const localityInfo = (dashboardQuery.data?.items ?? []).find((loc: any) => loc.localityId === id);
  const activities = (activitiesQuery.data?.items ?? []).slice(0, 5);
  const bestPractices = (bestPracticesQuery.data?.items ?? []).slice(0, 5);
  const notices = (noticesQuery.data?.items ?? []).slice(0, 5);
  const missions = (missionsQuery.data?.items ?? []).slice(0, 5);
  const meetings = (meetingsQuery.data?.items ?? []).slice(0, 5);
  const documents = (documentsQuery.data?.items ?? []).slice(0, 5);

  // Estado para modal de boas práticas
  const [selectedBestPractice, setSelectedBestPractice] = useState<any>(null);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {localityInfo?.localityName ?? `Localidade ${id}`}
      </Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">
            Progresso geral
          </Typography>
          <ProgressInline value={progress?.overallProgress ?? 0} />
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button component={Link} to={`/gantt?localityId=${id}`} variant="outlined" size="small">
              Ver Gantt
            </Button>
            <Button component={Link} to={`/calendar?localityId=${id}`} variant="outlined" size="small">
              Ver Calendário
            </Button>
          </Stack>
          <Stack spacing={1}>
            {progress?.byPhase?.map((phase: any) => (
              <Box key={phase.phaseName} display="flex" alignItems="center" gap={2}>
                <Typography variant="caption" sx={{ minWidth: 120 }}>
                  {phase.phaseName}
                </Typography>
                <ProgressInline value={phase.progress ?? 0} />
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Próximas tarefas
            </Typography>
            {upcoming.length === 0 ? (
              <EmptyState title="Sem tarefas" description="Nenhuma tarefa cadastrada." />
            ) : (
              <Stack spacing={1}>
                {upcoming.map((task: any) => (
                  <Box key={task.id} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {(task.comments?.unread ?? 0) > 0 && <Chip size="small" color="warning" label="Novo comentário" />}
                      <DueBadge dueDate={task.dueDate} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Atrasadas
            </Typography>
            {late.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma tarefa atrasada.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {late.map((task: any) => (
                  <Box key={task.id} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {(task.comments?.unread ?? 0) > 0 && <Chip size="small" color="warning" label="Novo comentário" />}
                      <Chip size="small" label="Atrasada" color="warning" />
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sem responsavel
            </Typography>
            {unassigned.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma tarefa sem responsavel.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {unassigned.map((task: any) => (
                  <Box key={task.id} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                    {!me?.executive_hide_pii && <Chip size="small" label="Sem resp." />}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Panorama da localidade
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Conteúdos e registros vinculados a esta localidade em todo o sistema (exceto denúncias/CPCA).
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {/* Boas Práticas */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgb(102, 133, 114) 0%, rgb(85, 110, 95) 100%)',
                color: 'white',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
                    Boas práticas
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/best-practices?localityId=${id}`}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    variant="outlined"
                  >
                    Ver tudo
                  </Button>
                </Stack>
                {bestPracticesQuery.isError ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem permissão ou indisponível.
                  </Typography>
                ) : bestPractices.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem registros.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {bestPractices.map((item: any) => (
                      <Box
                        key={item.id}
                        onClick={() => setSelectedBestPractice(item)}
                        sx={{
                          cursor: 'pointer',
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          transition: 'background-color 0.2s',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          },
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'white', mb: 0.5 }}>
                          {item.title}
                        </Typography>
                        {item.content && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255, 255, 255, 0.9)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.content}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Atividades de Campo */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgb(83, 127, 151) 0%, rgb(65, 100, 120) 100%)',
                color: 'white',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
                    Atividades de campo
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/activities?localityId=${id}`}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    variant="outlined"
                  >
                    Ver tudo
                  </Button>
                </Stack>
                {activities.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem registros.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {activities.map((item: any) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                          {item.title}
                        </Typography>
                        {item.specialtyName && (
                          <Chip
                            label={item.specialtyName}
                            size="small"
                            sx={{
                              mt: 0.5,
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              fontSize: '0.7rem',
                            }}
                          />
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Avisos */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgb(255, 152, 0) 0%, rgb(230, 126, 0) 100%)',
                color: 'white',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
                    Avisos
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/notices?localityId=${id}`}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    variant="outlined"
                  >
                    Ver tudo
                  </Button>
                </Stack>
                {noticesQuery.isError ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem permissão ou indisponível.
                  </Typography>
                ) : notices.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem registros.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {notices.map((item: any) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                          {item.title}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Missões */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgb(156, 39, 176) 0%, rgb(123, 31, 162) 100%)',
                color: 'white',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
                    Missões
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/missions?localityId=${id}`}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    variant="outlined"
                  >
                    Ver tudo
                  </Button>
                </Stack>
                {missionsQuery.isError ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem permissão ou indisponível.
                  </Typography>
                ) : missions.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem registros.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {missions.map((item: any) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                          {item.title}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Reuniões */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgb(33, 150, 243) 0%, rgb(25, 118, 210) 100%)',
                color: 'white',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
                    Reuniões
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/meetings?localityId=${id}`}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    variant="outlined"
                  >
                    Ver tudo
                  </Button>
                </Stack>
                {meetingsQuery.isError ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem permissão ou indisponível.
                  </Typography>
                ) : meetings.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem registros.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {meetings.map((item: any) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                          {item.scope || 'Reunião'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Documentos */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgb(76, 175, 80) 0%, rgb(56, 142, 60) 100%)',
                color: 'white',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
                    Documentos
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/documents?localityId=${id}`}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    variant="outlined"
                  >
                    Ver tudo
                  </Button>
                </Stack>
                {documentsQuery.isError ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem permissão ou indisponível.
                  </Typography>
                ) : documents.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Sem registros.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {documents.map((item: any) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                          {item.title}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Modal para exibir boas práticas completas */}
          <Dialog
            open={Boolean(selectedBestPractice)}
            onClose={() => setSelectedBestPractice(null)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">{selectedBestPractice?.title}</Typography>
                <IconButton onClick={() => setSelectedBestPractice(null)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent>
              {selectedBestPractice?.content && (
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                  {selectedBestPractice.content}
                </Typography>
              )}
              {selectedBestPractice?.authorLabel && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Por: {selectedBestPractice.authorLabel}
                </Typography>
              )}
              {selectedBestPractice?.createdAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {new Date(selectedBestPractice.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedBestPractice(null)}>Fechar</Button>
            </DialogActions>
          </Dialog>
        </CardContent>
      </Card>
    </Box>
  );
}
