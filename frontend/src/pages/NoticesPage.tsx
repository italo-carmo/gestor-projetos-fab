import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCreateNotice, useDeleteNotice, useLocalities, useNotices, usePinNotice, useSpecialties, useUpdateNotice, useMe } from '../api/hooks';
import { FiltersBar } from '../components/filters/FiltersBar';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { can } from '../app/rbac';
import { NoticePriority } from '../constants/enums';

const priorityColor: Record<string, string> = {
  LOW: '#E8F2FF',
  MEDIUM: '#FFF6E1',
  HIGH: '#FFE7E9',
};

export function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { data: me } = useMe();

  const localityId = params.get('localityId') ?? '';
  const specialtyId = params.get('specialtyId') ?? '';
  const priority = params.get('priority') ?? '';
  const dueFrom = params.get('dueFrom') ?? '';
  const dueTo = params.get('dueTo') ?? '';

  const filters = useMemo(
    () => ({
      localityId: localityId || undefined,
      specialtyId: specialtyId || undefined,
      priority: priority || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
    }),
    [localityId, specialtyId, priority, dueFrom, dueTo],
  );

  const noticesQuery = useNotices(filters);
  const localitiesQuery = useLocalities();
  const specialtiesQuery = useSpecialties();

  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNotice();
  const deleteNotice = useDeleteNotice();
  const pinNotice = usePinNotice();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    localityId: '',
    specialtyId: '',
    dueDate: '',
    priority: 'MEDIUM',
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams({});

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      body: '',
      localityId: '',
      specialtyId: '',
      dueDate: '',
      priority: 'MEDIUM',
    });
    setDrawerOpen(true);
  };

  const openEdit = (notice: any) => {
    setEditing(notice);
    setForm({
      title: notice.title ?? '',
      body: notice.body ?? '',
      localityId: notice.localityId ?? '',
      specialtyId: notice.specialtyId ?? '',
      dueDate: notice.dueDate ? notice.dueDate.slice(0, 10) : '',
      priority: notice.priority ?? 'MEDIUM',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        title: form.title,
        body: form.body,
        localityId: form.localityId || null,
        specialtyId: form.specialtyId || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        priority: form.priority,
      };
      if (editing) {
        await updateNotice.mutateAsync({ id: editing.id, payload });
        toast.push({ message: 'Aviso atualizado', severity: 'success' });
      } else {
        await createNotice.mutateAsync(payload);
        toast.push({ message: 'Aviso criado', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao salvar aviso', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotice.mutateAsync(id);
      toast.push({ message: 'Aviso removido', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao remover aviso', severity: 'error' });
    }
  };

  const handlePin = async (notice: any) => {
    try {
      await pinNotice.mutateAsync({ id: notice.id, pinned: !notice.pinned });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao fixar aviso', severity: 'error' });
    }
  };

  if (noticesQuery.isLoading) return <SkeletonState />;
  if (noticesQuery.isError) return <ErrorState error={noticesQuery.error} onRetry={() => noticesQuery.refetch()} />;

  const notices = noticesQuery.data?.items ?? [];
  const now = Date.now();
  const startWeek = new Date();
  const endWeek = new Date();
  endWeek.setDate(startWeek.getDate() + 7);

  const columns = [
    {
      title: 'Pinned',
      items: notices.filter((n: any) => n.pinned),
    },
    {
      title: 'Esta semana',
      items: notices.filter(
        (n: any) =>
          !n.pinned &&
          n.dueDate &&
          new Date(n.dueDate).getTime() >= now &&
          new Date(n.dueDate).getTime() <= endWeek.getTime(),
      ),
    },
    {
      title: 'Sem prazo',
      items: notices.filter((n: any) => !n.pinned && !n.dueDate),
    },
    {
      title: 'Vencidos',
      items: notices.filter(
        (n: any) => !n.pinned && n.dueDate && new Date(n.dueDate).getTime() < now,
      ),
    },
  ];

  const canCreate = can(me, 'notices', 'create');
  const canUpdate = can(me, 'notices', 'update');
  const canDelete = can(me, 'notices', 'delete');
  const canPin = can(me, 'notices', 'pin');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Quadro de avisos</Typography>
        {canCreate && (
          <Button variant="contained" onClick={openCreate}>
            Novo aviso
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FiltersBar
            localityId={localityId}
            onLocalityChange={(value) => updateParam('localityId', value)}
            localities={(localitiesQuery.data?.items ?? []).map((l: any) => ({ id: l.id, name: l.name }))}
            onClear={clearFilters}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2}>
            <TextField
              select
              size="small"
              label="Especialidade"
              value={specialtyId}
              onChange={(e) => updateParam('specialtyId', e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {(specialtiesQuery.data?.items ?? []).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Prioridade"
              value={priority}
              onChange={(e) => updateParam('priority', e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {NoticePriority.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={dueFrom}
              onChange={(e) => updateParam('dueFrom', e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={dueTo}
              onChange={(e) => updateParam('dueTo', e.target.value)}
            />
          </Stack>
        </CardContent>
      </Card>

      {notices.length === 0 && (
        <EmptyState title="Nenhum aviso" description="Crie um novo aviso para começar." />
      )}

      {notices.length > 0 && (
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(4, 1fr)' }} gap={2}>
          {columns.map((column) => (
            <Card key={column.title} variant="outlined" sx={{ background: '#F7FAFF' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {column.title}
                </Typography>
                <Stack spacing={2}>
                  {column.items.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Sem avisos
                    </Typography>
                  )}
                  {column.items.map((notice: any) => (
                    <Card
                      key={notice.id}
                      variant="outlined"
                      sx={{ background: priorityColor[notice.priority] ?? '#F5F8FC' }}
                    >
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2">{notice.title}</Typography>
                          <Stack direction="row" spacing={1}>
                            {canPin && (
                              <IconButton size="small" onClick={() => handlePin(notice)}>
                                <PushPinIcon fontSize="small" color={notice.pinned ? 'primary' : 'inherit'} />
                              </IconButton>
                            )}
                            {canUpdate && (
                              <IconButton size="small" onClick={() => openEdit(notice)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            )}
                            {canDelete && (
                              <IconButton size="small" onClick={() => handleDelete(notice.id)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {notice.body}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Stack direction="row" spacing={1} alignItems="center">
                          {notice.dueDate && (
                            <Chip
                              size="small"
                              label={new Date(notice.dueDate).toLocaleDateString('pt-BR')}
                              color={notice.isLate ? 'error' : 'default'}
                            />
                          )}
                          <Chip size="small" label={notice.priority} />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', md: 420 } } }}>
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5">{editing ? 'Editar aviso' : 'Novo aviso'}</Typography>
          <TextField label="Título" size="small" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField
            label="Mensagem"
            size="small"
            multiline
            minRows={4}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="Localidade"
            value={form.localityId}
            onChange={(e) => setForm({ ...form, localityId: e.target.value })}
          >
            <MenuItem value="">Global</MenuItem>
            {(localitiesQuery.data?.items ?? []).map((l: any) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Especialidade"
            value={form.specialtyId}
            onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}
          >
            <MenuItem value="">Todas</MenuItem>
            {(specialtiesQuery.data?.items ?? []).map((s: any) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label="Prazo"
            InputLabelProps={{ shrink: true }}
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="Prioridade"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            {NoticePriority.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSave}>
              Salvar
            </Button>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
