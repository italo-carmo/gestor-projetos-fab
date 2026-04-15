import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
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
import { useToast } from '../app/toast';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

type LessonType = {
  id: string;
  name: string;
  colorHex: string;
  textColorHex?: string | null;
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

type LessonSection = {
  key: string;
  title: string;
  subtitle: string;
  posts: LessonPost[];
  type: LessonType | null;
};

export function LessonsLearnedPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const canView = can(me, 'lessons_learned', 'view');
  const canManage =
    can(me, 'lessons_learned', 'create') ||
    can(me, 'lessons_learned', 'update') ||
    can(me, 'lessons_learned', 'delete');
  const canManageTypes = canManage;

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
  const lessonsByType = useMemo(() => {
    const grouped = new Map<string, LessonPost[]>();
    for (const lesson of lessons) {
      const key = String(lesson.typeId || '__without_type__');
      const list = grouped.get(key) ?? [];
      list.push(lesson);
      grouped.set(key, list);
    }
    return grouped;
  }, [lessons]);
  const sections = useMemo(() => {
    const typedSections: LessonSection[] = types.map((type) => ({
      key: type.id,
      title: type.name,
      subtitle: 'Lições deste tipo',
      posts: lessonsByType.get(type.id) ?? [],
      type,
    }));
    const orphanLessons = lessonsByType.get('__without_type__') ?? [];
    if (orphanLessons.length > 0) {
      typedSections.push({
        key: '__without_type__',
        title: 'Sem tipo',
        subtitle: 'Lições sem tipo vinculado',
        posts: orphanLessons,
        type: null,
      });
    }
    return typedSections.filter((section) => section.posts.length > 0);
  }, [types, lessonsByType]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', typeId: '' });
  const [typeForm, setTypeForm] = useState({ id: '', name: '', colorHex: '#8E44AD', textColorHex: '#FFFFFF' });
  const [typesSectionOpen, setTypesSectionOpen] = useState(false);

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

  const resetTypeForm = () => setTypeForm({ id: '', name: '', colorHex: '#8E44AD', textColorHex: '#FFFFFF' });

  const handleSaveType = async () => {
    const name = typeForm.name.trim();
    const colorHex = typeForm.colorHex.trim();
    const textColorHex = typeForm.textColorHex.trim();
    if (!name || !colorHex || !textColorHex) {
      toast.push({ message: 'Informe nome, cor do card e cor da fonte.', severity: 'warning' });
      return;
    }
    try {
      if (typeForm.id) {
        await updateType.mutateAsync({
          id: typeForm.id,
          payload: { name, colorHex, textColorHex },
        });
        toast.push({ message: 'Tipo atualizado.', severity: 'success' });
      } else {
        await createType.mutateAsync({ name, colorHex, textColorHex });
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
        <Stack direction="row" spacing={1} alignItems="center">
          {canManageTypes && (
            <IconButton
              size="small"
              onClick={() => setTypesSectionOpen(!typesSectionOpen)}
              sx={{ color: "primary.main" }}
              title="Gerenciar tipos"
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          )}
          {canManage && (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateLesson}>
              Nova lição
            </Button>
          )}
        </Stack>
      </Stack>

      {sections.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="Sem lições" description="Cadastre a primeira lição aprendida." />
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {sections.map((section) => (
            <Card key={section.key} sx={{ borderRadius: 2.5 }}>
              <CardContent>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  spacing={0.7}
                  mb={1.4}
                >
                  <Box>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700}>
                        {section.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${section.posts.length} liç${section.posts.length === 1 ? "ão" : "ões"}`}
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {section.subtitle}
                    </Typography>
                  </Box>
                </Stack>
                <Divider sx={{ mb: 1.4 }} />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, minmax(0, 1fr))',
                      xl: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 1.4,
                  }}
                >
                  {section.posts.map((lesson) => {
                    const type = lesson.type ?? typeById.get(lesson.typeId);
                    const bg = type?.colorHex || '#537F97';
                    const textColor = type?.textColorHex || '#FFFFFF';
                    return (
                      <Card key={lesson.id} variant="outlined" sx={{ borderColor: `${bg}CC`, height: '100%' }}>
                        <CardContent sx={{ p: 1.5, backgroundColor: bg, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="start" gap={1} sx={{ flex: 1 }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ color: textColor, fontWeight: 700 }}>
                                {lesson.title}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  mt: 0.8,
                                  color: `${textColor}F0`,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 4,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {lesson.content}
                              </Typography>
                              <Divider sx={{ my: 1.1, borderColor: `${textColor}40` }} />
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Chip
                                  size="small"
                                  label={type?.name || 'Sem tipo'}
                                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: textColor }}
                                />
                                <Chip
                                  size="small"
                                  label={lesson.authorLabel || 'Coordenação CIPAVD'}
                                  sx={{
                                    bgcolor: 'rgba(255,255,255,0.15)',
                                    color: textColor,
                                    border: `1px solid ${textColor}40`,
                                    height: 20,
                                    fontSize: '0.7rem',
                                  }}
                                />
                                <Typography variant="caption" sx={{ color: `${textColor}E6` }}>
                                  {new Date(lesson.createdAt).toLocaleString('pt-BR')}
                                </Typography>
                              </Stack>
                            </Box>
                            {canManage && (
                              <Stack direction="row" spacing={0.5}>
                                <IconButton size="small" sx={{ color: textColor }} onClick={() => openEditLesson(lesson)}>
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" sx={{ color: textColor }} onClick={() => handleDeleteLesson(lesson)}>
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
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {canManageTypes && (
        <Collapse in={typesSectionOpen}>
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
                Gerenciar Tipos de Lições Aprendidas
              </Typography>
              <Stack spacing={2}>
                {types.map((type) => {
                  const isEditing = typeForm.id === type.id;
                  return (
                    <Card key={type.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={1.5}>
                          {isEditing ? (
                            <>
                              <TextField
                                size="small"
                                label="Nome do tipo"
                                value={typeForm.name}
                                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                                fullWidth
                              />
                              <Stack direction="row" spacing={1}>
                                <TextField
                                  size="small"
                                  type="color"
                                  label="Cor do card"
                                  value={typeForm.colorHex}
                                  onChange={(e) => setTypeForm({ ...typeForm, colorHex: e.target.value })}
                                  InputLabelProps={{ shrink: true }}
                                  sx={{ flex: 1 }}
                                />
                                <TextField
                                  size="small"
                                  type="color"
                                  label="Cor da fonte"
                                  value={typeForm.textColorHex}
                                  onChange={(e) => setTypeForm({ ...typeForm, textColorHex: e.target.value })}
                                  InputLabelProps={{ shrink: true }}
                                  sx={{ flex: 1 }}
                                />
                              </Stack>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={handleSaveType}
                                >
                                  Salvar
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={resetTypeForm}
                                >
                                  Cancelar
                                </Button>
                              </Stack>
                            </>
                          ) : (
                            <>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 1,
                                    backgroundColor: type.colorHex,
                                    border: "1px solid rgba(0,0,0,0.1)",
                                  }}
                                />
                                <Typography variant="body1" fontWeight={600}>
                                  {type.name}
                                </Typography>
                                <Box sx={{ flex: 1 }} />
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setTypeForm({
                                      id: type.id,
                                      name: type.name,
                                      colorHex: type.colorHex,
                                      textColorHex: type.textColorHex || "#FFFFFF",
                                    })
                                  }
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteType(type)}
                                >
                                  <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
                {typeForm.id === "" && (
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Novo tipo
                        </Typography>
                        <TextField
                          size="small"
                          label="Nome do tipo"
                          value={typeForm.name}
                          onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                          fullWidth
                        />
                        <Stack direction="row" spacing={1}>
                          <TextField
                            size="small"
                            type="color"
                            label="Cor do card"
                            value={typeForm.colorHex}
                            onChange={(e) => setTypeForm({ ...typeForm, colorHex: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            size="small"
                            type="color"
                            label="Cor da fonte"
                            value={typeForm.textColorHex}
                            onChange={(e) => setTypeForm({ ...typeForm, textColorHex: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                          />
                        </Stack>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={handleSaveType}
                        >
                          Criar tipo
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Collapse>
      )}

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
