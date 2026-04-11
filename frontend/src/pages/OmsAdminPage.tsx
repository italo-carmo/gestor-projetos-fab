import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import {
  useCreateLocality,
  useDeleteLocality,
  useLocalities,
  useMe,
  useUpdateLocality,
  useUsers,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { normalizeRoleName, ROLE_CPCA } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

type LocalityItem = {
  id: string;
  code: string;
  name: string;
  commandName?: string | null;
  commanderName?: string | null;
  notes?: string | null;
};

type UserItem = {
  id: string;
  name: string;
  localityId?: string | null;
  roles?: Array<{ role?: { id?: string; name?: string } | null }>;
};

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

type OmsForm = {
  code: string;
  name: string;
  uf: string;
  commandName: string;
  commanderName: string;
  notes: string;
};

type CpcaCoverageFilter = 'ALL' | 'WITH_CPCA' | 'WITHOUT_CPCA';

const DEFAULT_FORM: OmsForm = {
  code: '',
  name: '',
  uf: '',
  commandName: '',
  commanderName: '',
  notes: '',
};

function hasCpcaRole(user: UserItem) {
  return (user.roles ?? []).some(
    (entry) => normalizeRoleName(entry?.role?.name) === normalizeRoleName(ROLE_CPCA),
  );
}

export function OmsAdminPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const localitiesQuery = useLocalities();
  const usersQuery = useUsers(Boolean(me?.id));
  const createLocality = useCreateLocality();
  const updateLocality = useUpdateLocality();
  const deleteLocality = useDeleteLocality();

  const [search, setSearch] = useState('');
  const [cpcaCoverageFilter, setCpcaCoverageFilter] = useState<CpcaCoverageFilter>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LocalityItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<OmsForm>(DEFAULT_FORM);

  const localities = useMemo(
    () =>
      ((localitiesQuery.data?.items ?? []) as LocalityItem[]).sort((a, b) =>
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR'),
      ),
    [localitiesQuery.data?.items],
  );
  const users = useMemo(() => (usersQuery.data?.items ?? []) as UserItem[], [usersQuery.data?.items]);

  const cpcaByLocalityId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    for (const user of users) {
      const localityId = String(user.localityId ?? '').trim();
      if (!localityId || !hasCpcaRole(user)) continue;
      const current = map.get(localityId) ?? [];
      current.push({ id: user.id, name: user.name });
      map.set(localityId, current);
    }
    for (const [localityId, members] of map.entries()) {
      members.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      map.set(localityId, members);
    }
    return map;
  }, [users]);

  const filteredLocalities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return localities.filter((item) => {
      const hasCoverage = (cpcaByLocalityId.get(item.id)?.length ?? 0) > 0;
      if (cpcaCoverageFilter === 'WITH_CPCA' && !hasCoverage) return false;
      if (cpcaCoverageFilter === 'WITHOUT_CPCA' && hasCoverage) return false;
      if (!term) return true;
      const code = String(item.code ?? '').toLowerCase();
      const name = String(item.name ?? '').toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [localities, search, cpcaCoverageFilter, cpcaByLocalityId]);

  const coverage = useMemo(() => {
    const withCpca = localities.filter((locality) => (cpcaByLocalityId.get(locality.id)?.length ?? 0) > 0);
    const withoutCpca = localities.filter((locality) => (cpcaByLocalityId.get(locality.id)?.length ?? 0) === 0);
    return { total: localities.length, withCpca, withoutCpca };
  }, [cpcaByLocalityId, localities]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (locality: LocalityItem) => {
    setEditing(locality);
    setForm({
      code: locality.code ?? '',
      name: locality.name ?? '',
      uf: (locality as any).uf ?? '',
      commandName: locality.commandName ?? '',
      commanderName: locality.commanderName ?? '',
      notes: locality.notes ?? '',
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      uf: form.uf.trim().toUpperCase() || null,
      commandName: form.commandName.trim() || null,
      commanderName: form.commanderName.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (!payload.code || !payload.name) {
      toast.push({ message: 'Informe código e nome da OM.', severity: 'warning' });
      return;
    }

    try {
      if (editing) {
        await updateLocality.mutateAsync({ id: editing.id, payload });
        toast.push({ message: 'OM atualizada com sucesso.', severity: 'success' });
      } else {
        await createLocality.mutateAsync(payload);
        toast.push({ message: 'OM criada com sucesso.', severity: 'success' });
      }
      closeDrawer();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar OM.',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocality.mutateAsync(id);
      toast.push({ message: 'OM removida com sucesso.', severity: 'success' });
      setDeleteId(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao remover OM.',
        severity: 'error',
      });
    }
  };

  if (localitiesQuery.isLoading || usersQuery.isLoading) return <SkeletonState />;
  if (localitiesQuery.isError) {
    return <ErrorState error={localitiesQuery.error} onRetry={() => localitiesQuery.refetch()} />;
  }
  if (usersQuery.isError) {
    return <ErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Cadastro de OMs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            CRUD completo de OMs e cobertura do perfil CPCA por localidade.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Nova OM
        </Button>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              OMs cadastradas
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {coverage.total}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              OMs com CPCA
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {coverage.withCpca.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              OMs sem CPCA
            </Typography>
            <Typography variant="h5" fontWeight={800} color={coverage.withoutCpca.length > 0 ? 'warning.main' : 'text.primary'}>
              {coverage.withoutCpca.length}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
            <TextField
              size="small"
              label="Buscar OM"
              placeholder="Digite código ou nome da OM..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <TextField
              select
              size="small"
              label="Cobertura CPCA"
              value={cpcaCoverageFilter}
              onChange={(event) => setCpcaCoverageFilter(event.target.value as CpcaCoverageFilter)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="ALL">Todas</MenuItem>
              <MenuItem value="WITH_CPCA">Com CPCA</MenuItem>
              <MenuItem value="WITHOUT_CPCA">Sem CPCA</MenuItem>
            </TextField>
            <Button variant="text" onClick={() => setSearch('')}>
              Limpar
            </Button>
            <Button variant="text" onClick={() => setCpcaCoverageFilter('ALL')}>
              Limpar cobertura
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {filteredLocalities.length === 0 ? (
            <EmptyState title="Nenhuma OM encontrada" description="Ajuste o filtro de busca ou cadastre uma nova OM." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Código</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Nome</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700, width: 80 }}>UF</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Cobertura CPCA</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Militares CPCA</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLocalities.map((locality) => {
                  const cpcaMembers = cpcaByLocalityId.get(locality.id) ?? [];
                  const hasCoverage = cpcaMembers.length > 0;
                  return (
                    <TableRow key={locality.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {locality.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {locality.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{(locality as any).uf ?? '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={hasCoverage ? 'success' : 'warning'}
                          label={hasCoverage ? 'Com CPCA' : 'Sem CPCA'}
                        />
                      </TableCell>
                      <TableCell>
                        {cpcaMembers.length > 0 ? cpcaMembers.map((member) => member.name).join(', ') : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openEdit(locality)}>
                          Editar
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setDeleteId(locality.id)}
                          disabled={cpcaMembers.length > 0}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            OMs sem militar CPCA
          </Typography>
          {coverage.withoutCpca.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Todas as OMs cadastradas possuem ao menos um militar com perfil CPCA.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {coverage.withoutCpca.map((item) => item.code).join(', ')}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', md: 420 } } }}
      >
        <Box p={3} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">{editing ? 'Editar OM' : 'Nova OM'}</Typography>
          <TextField
            size="small"
            label="Código"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
            placeholder="Ex: BASV"
          />
          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ex: Base Aérea de Salvador"
          />
          <TextField
            size="small"
            label="UF (Estado)"
            value={form.uf}
            onChange={(event) => setForm((prev) => ({ ...prev, uf: event.target.value }))}
            select
            helperText="Sigla do estado para o Mapa Geográfico"
          >
            <MenuItem value="">
              <em>Nenhum</em>
            </MenuItem>
            {UF_OPTIONS.map((uf) => (
              <MenuItem key={uf} value={uf}>{uf}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Comando"
            value={form.commandName}
            onChange={(event) => setForm((prev) => ({ ...prev, commandName: event.target.value }))}
            placeholder="Opcional"
          />
          <TextField
            size="small"
            label="Comandante"
            value={form.commanderName}
            onChange={(event) => setForm((prev) => ({ ...prev, commanderName: event.target.value }))}
            placeholder="Opcional"
          />
          <TextField
            size="small"
            label="Observações"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            multiline
            minRows={3}
            placeholder="Notas administrativas da OM"
          />
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button onClick={closeDrawer}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleSave();
              }}
              disabled={createLocality.isPending || updateLocality.isPending}
            >
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir OM"
        message="A exclusão remove o cadastro da OM e pode afetar vínculos existentes. Deseja continuar?"
        note="OMs com militares CPCA vinculados não podem ser excluídas por esta tela."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) void handleDelete(deleteId);
        }}
      />
    </Box>
  );
}
