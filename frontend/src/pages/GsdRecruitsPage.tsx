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
import { Link } from 'react-router-dom';
import { useDashboardRecruits, useMe, useUpdateLocalityRecruits } from '../api/hooks';
import { can } from '../app/rbac';
import { canEditRecruitsCount } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

export function GsdRecruitsPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const canViewRecruits = can(me, 'dashboard', 'view');
  const recruitsQuery = useDashboardRecruits(canViewRecruits);
  const updateLocalityRecruits = useUpdateLocalityRecruits();
  const toast = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [formRecruitsCount, setFormRecruitsCount] = useState<string>('');

  if (meLoading || recruitsQuery.isLoading) return <SkeletonState />;
  if (recruitsQuery.isError) return <ErrorState error={recruitsQuery.error} onRetry={() => recruitsQuery.refetch()} />;

  const items = (recruitsQuery.data?.currentPerLocality ?? []).map((loc: any) => ({
    id: loc.localityId,
    name: loc.localityName,
    code: loc.code,
    recruitsFemaleCountCurrent: loc.recruitsFemaleCountCurrent,
  }));

  const openEdit = (loc: any) => {
    if (!canEditRecruitsCount(me, loc.id)) return;
    setSelected(loc);
    setFormRecruitsCount(String(loc.recruitsFemaleCountCurrent ?? ''));
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;

    const value = Number(formRecruitsCount);
    if (!Number.isInteger(value) || value < 0) {
      toast.push({ message: 'Informe um número inteiro maior ou igual a zero.', severity: 'warning' });
      return;
    }

    try {
      await updateLocalityRecruits.mutateAsync({
        id: selected.id,
        recruitsFemaleCountCurrent: value,
      });
      toast.push({ message: 'Número de recrutas atualizado com histórico.', severity: 'success' });
      setDrawerOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar recrutas.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        GSD e Recrutas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Atualize o quantitativo de recrutas da localidade. Cada alteração gera histórico diário e alimenta os gráficos e totais do sistema.
      </Typography>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Sem localidades" description="Nenhuma localidade disponível no seu escopo." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Recrutas femininos</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((loc: any) => (
                  <TableRow key={loc.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {loc.name}
                      </Typography>
                      {loc.code && (
                        <Typography variant="caption" color="text.secondary">
                          {loc.code}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{loc.recruitsFemaleCountCurrent ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openEdit(loc)}
                        disabled={!canEditRecruitsCount(me, loc.id)}
                      >
                        Editar quantidade
                      </Button>
                      <Button size="small" component={Link} to="/recruits-history" sx={{ ml: 0.5 }}>
                        Ver histórico
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
        PaperProps={{ sx: { width: { xs: '100%', md: 400 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">Atualizar recrutas</Typography>
          {selected && (
            <>
              <TextField size="small" label="Localidade" value={selected.name} fullWidth InputProps={{ readOnly: true }} />
              <TextField
                size="small"
                type="number"
                label="Recrutas femininos"
                value={formRecruitsCount}
                onChange={(e) => setFormRecruitsCount(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                O sistema registra automaticamente o histórico da alteração na data de hoje.
              </Typography>
            </>
          )}
          <Box display="flex" gap={1} justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={
                !selected ||
                !canEditRecruitsCount(me, selected.id) ||
                updateLocalityRecruits.isPending
              }
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
