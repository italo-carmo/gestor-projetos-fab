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
  useCreateEloRole,
  useDeleteEloRole,
  useEloRoles,
  useUpdateEloRole,
} from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';

export function EloRolesPage() {
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
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEloRole.mutateAsync(id);
      toast.push({ message: 'Tipo de elo excluído', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({ message: parseApiError(error).message, severity: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Tipos de Elo</Typography>
        <Button variant="contained" onClick={openCreate}>
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
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={createEloRole.isPending || updateEloRole.isPending}>
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
