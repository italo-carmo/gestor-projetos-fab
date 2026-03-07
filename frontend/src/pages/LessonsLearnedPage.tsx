import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useMemo, useState } from 'react';
import {
  useCreateLessonLearned,
  useCreateLessonLearnedType,
  useDeleteLessonLearned,
  useDeleteLessonLearnedType,
  useLessonLearnedTypes,
  useLessonsLearned,
  useMe,
  useUpdateLessonLearned,
  useUpdateLessonLearnedType,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

type LessonType = {
  id: string;
  name: string;
  colorHex: string;
};

type LessonPost = {
  id: string;
  title: string;
  content: string;
  authorLabel?: string | null;
  createdAt: string;
  type?: LessonType | null;
  typeId: string;
};

export function LessonsLearnedPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const canView =
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI, ROLE_COMANDANTE_COMGEP]) &&
    can(me, 'lessons_learned', 'view');
  const canManage =
    hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]) &&
    can(me, 'lessons_learned', 'create');

  const typesQuery = useLessonLearnedTypes(canView);
  const lessonsQuery = useLessonsLearned({}, canView);
  const createLesson = useCreateLessonLearned();
  const updateLesson = useUpdateLessonLearned();
  const deleteLesson = useDeleteLessonLearned();
  const createType = useCreateLessonLearnedType();
  const updateType = useUpdateLessonLearnedType();
  const deleteType = useDeleteLessonLearnedType();

  const types = (typesQuery.data?.items ?? []) as LessonType[];
  const lessons = (lessonsQuery.data?.items ?? []) as LessonPost[];
  const typeById = useMemo(() => new Map(types.map((item) => [item.id, item])), [types]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', typeId: '' });
  const [typeForm, setTypeForm] = useState({ id: '', name: '', colorHex: '#8E44AD' });

  const resetLessonForm = () => {
    setEditingLessonId(null);
    setLessonForm({
      title: '',
      content: '',
      typeId: types[0]?.id ?? '',
    });
  };

  const openCreateLesson = () => {
    resetLessonForm();
    setDrawerOpen(true);
  };

  const openEditLesson = (lesson: LessonPost) => {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: String(lesson.title ?? ''),
      content: String(lesson.content ?? ''),
      typeId: String(lesson.typeId ?? ''),
    });
    setDrawerOpen(true);
  };

  const handleSaveLesson = async () => {
    const title = lessonForm.title.trim();
    const content = lessonForm.content.trim();
    const typeId = lessonForm.typeId.trim();
    if (!title || !content || !typeId) {
      toast.push({ message: 'Preencha título, conteúdo e tipo.', severity: 'warning' });
      return;
    }
    try {
      if (editingLessonId) {
        await updateLesson.mutateAsync({ id: editingLessonId, payload: { title, content, typeId } });
        toast.push({ message: 'Lição atualizada.', severity: 'success' });
      } else {
        await createLesson.mutateAsync({ title, content, typeId });
        toast.push({ message: 'Lição criada.', severity: 'success' });
      }
      setDrawerOpen(false);
      resetLessonForm();
      await lessonsQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar lição.',
        severity: 'error',
      });
    }
  };

  const handleDeleteLesson = async (lesson: LessonPost) => {
    const ok = window.confirm(`Deseja excluir "${lesson.title}"?`);
    if (!ok) return;
    try {
      await deleteLesson.mutateAsync(lesson.id);
      toast.push({ message: 'Lição excluída.', severity: 'success' });
      await lessonsQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao excluir lição.',
        severity: 'error',
      });
    }
  };

  const resetTypeForm = () => setTypeForm({ id: '', name: '', colorHex: '#8E44AD' });

  const handleSaveType = async () => {
    const name = typeForm.name.trim();
    const colorHex = typeForm.colorHex.trim();
    if (!name || !colorHex) {
      toast.push({ message: 'Informe nome e cor do tipo.', severity: 'warning' });
      return;
    }
    try {
      if (typeForm.id) {
        await updateType.mutateAsync({
          id: typeForm.id,
          payload: { name, colorHex },
        });
        toast.push({ message: 'Tipo atualizado.', severity: 'success' });
      } else {
        await createType.mutateAsync({ name, colorHex });
        toast.push({ message: 'Tipo criado.', severity: 'success' });
      }
      resetTypeForm();
      await typesQuery.refetch();
      await lessonsQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar tipo.',
        severity: 'error',
      });
    }
  };

  const handleDeleteType = async (type: LessonType) => {
    const ok = window.confirm(`Deseja excluir o tipo "${type.name}"?`);
    if (!ok) return;
    try {
      await deleteType.mutateAsync(type.id);
      toast.push({ message: 'Tipo excluído.', severity: 'success' });
      if (typeForm.id === type.id) resetTypeForm();
      await typesQuery.refetch();
      await lessonsQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao excluir tipo.',
        severity: 'error',
      });
    }
  };

  if (!canView) return <ErrorState error={new Error('Acesso negado a Lições Aprendidas.')} />;
  if (typesQuery.isLoading || lessonsQuery.isLoading) return <SkeletonState />;
  if (typesQuery.isError) return <ErrorState error={typesQuery.error} onRetry={() => typesQuery.refetch()} />;
  if (lessonsQuery.isError) return <ErrorState error={lessonsQuery.error} onRetry={() => lessonsQuery.refetch()} />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Lições Aprendidas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestão completa das lições e dos tipos (com cor dos cards).
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateLesson}>
            Nova lição
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
        <Card sx={{ flex: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.2 }}>
              Lições cadastradas
            </Typography>
            {lessons.length === 0 ? (
              <EmptyState title="Sem lições" description="Cadastre a primeira lição aprendida." />
            ) : (
              <Box sx={{ display: 'grid', gap: 1.2 }}>
                {lessons.map((lesson) => {
                  const type = lesson.type ?? typeById.get(lesson.typeId);
                  const bg = type?.colorHex || '#537F97';
                  return (
                    <Card key={lesson.id} variant="outlined" sx={{ borderColor: `${bg}` }}>
                      <CardContent sx={{ p: 1.4, backgroundColor: bg }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="start" gap={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>
                              {lesson.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                mt: 0.4,
                                color: 'rgba(255,255,255,0.94)',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {lesson.content}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                              <Chip
                                size="small"
                                label={type?.name || 'Sem tipo'}
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                              />
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                {lesson.authorLabel || 'Coordenação CIPAVD'} - {new Date(lesson.createdAt).toLocaleString('pt-BR')}
                              </Typography>
                            </Stack>
                          </Box>
                          {canManage && (
                            <Stack direction="row" spacing={0.5}>
                              <IconButton size="small" sx={{ color: '#fff' }} onClick={() => openEditLesson(lesson)}>
                                <EditRoundedIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" sx={{ color: '#fff' }} onClick={() => handleDeleteLesson(lesson)}>
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Tipos de lição
            </Typography>
            {canManage ? (
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Nome do tipo"
                  value={typeForm.name}
                  onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    type="color"
                    label="Cor do card"
                    value={typeForm.colorHex}
                    onChange={(event) => setTypeForm((prev) => ({ ...prev, colorHex: event.target.value.toUpperCase() }))}
                    sx={{ width: 120 }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      border: '1px solid rgba(0,0,0,0.2)',
                      bgcolor: typeForm.colorHex,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Prévia
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={handleSaveType}>
                    {typeForm.id ? 'Atualizar tipo' : 'Criar tipo'}
                  </Button>
                  {typeForm.id && (
                    <Button variant="outlined" onClick={resetTypeForm}>
                      Cancelar edição
                    </Button>
                  )}
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Somente Coordenação CIPAVD e TI podem alterar tipos.
              </Typography>
            )}

            <Box sx={{ mt: 1.5, display: 'grid', gap: 0.8 }}>
              {types.map((type) => (
                <Card key={type.id} variant="outlined">
                  <CardContent sx={{ p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 16, height: 16, borderRadius: 0.8, bgcolor: type.colorHex, border: '1px solid rgba(0,0,0,0.2)' }} />
                        <Typography variant="body2" fontWeight={600}>
                          {type.name}
                        </Typography>
                      </Stack>
                      {canManage && (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => setTypeForm({ id: type.id, name: type.name, colorHex: type.colorHex })}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteType(type)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          resetLessonForm();
        }}
        PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
      >
        <Box p={3} pt={7} display="flex" flexDirection="column" gap={1.4}>
          <Typography variant="h6" sx={{ mt: 2.5 }}>
            {editingLessonId ? 'Editar lição aprendida' : 'Nova lição aprendida'}
          </Typography>
          <TextField
            size="small"
            label="Tipo"
            select
            value={lessonForm.typeId}
            onChange={(event) => setLessonForm((prev) => ({ ...prev, typeId: event.target.value }))}
            fullWidth
          >
            {types.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Título"
            value={lessonForm.title}
            onChange={(event) => setLessonForm((prev) => ({ ...prev, title: event.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label="Texto"
            value={lessonForm.content}
            onChange={(event) => setLessonForm((prev) => ({ ...prev, content: event.target.value }))}
            multiline
            minRows={5}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSaveLesson}>
              Salvar
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setDrawerOpen(false);
                resetLessonForm();
              }}
            >
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}

