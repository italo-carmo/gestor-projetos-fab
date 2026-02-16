import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  useCreatePosto,
  useDeletePosto,
  usePostos,
  useUpdatePosto,
} from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';

export function PostosPage() {
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
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosto.mutateAsync(id);
      toast.push({ message: 'Posto excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Postos</Typography>
        <Button variant="contained" onClick={openCreate}>
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
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={createPosto.isPending || updatePosto.isPending}>
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
