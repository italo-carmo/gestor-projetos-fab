import {
  Box,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useMe, usePhases, useUpdatePhase } from '../api/hooks';
import { can } from '../app/rbac';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';

export function AdminPhasesPage() {
  const { data: me } = useMe();
  const phasesQuery = usePhases();
  const updatePhase = useUpdatePhase();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!can(me, 'phases', 'update')) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Administração de Fases
        </Typography>
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
      <Typography variant="h4" gutterBottom>
        Administração de Fases
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
                      disabled={!isDirty(phase) || updatePhase.isPending}
                      onClick={() => save(phase)}
                      sx={{
                        color: '#fff',
                        '&.Mui-disabled': {
                          color: 'rgba(255,255,255,0.78)',
                          background: 'linear-gradient(135deg, rgba(12,101,126,0.72) 0%, rgba(10,84,113,0.72) 100%)',
                        },
                      }}
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
