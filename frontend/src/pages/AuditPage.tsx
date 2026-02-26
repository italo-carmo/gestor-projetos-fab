import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuditLogs, useLocalities } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const resource = params.get('resource') ?? '';
  const userId = params.get('userId') ?? '';
  const localityId = params.get('localityId') ?? '';
  const entityId = params.get('entityId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize') ?? '20') || 20));

  const filters = useMemo(
    () => ({
      resource: resource || undefined,
      userId: userId || undefined,
      localityId: localityId || undefined,
      entityId: entityId || undefined,
      from: from || undefined,
      to: to || undefined,
      page: String(page),
      pageSize: String(pageSize),
    }),
    [resource, userId, localityId, entityId, from, to, page, pageSize],
  );

  const auditQuery = useAuditLogs(filters);
  const localitiesQuery = useLocalities();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') {
      next.set('page', '1');
    }
    setParams(next);
  };
  const clearFilters = () => setParams({ page: '1', pageSize: String(pageSize) });

  if (auditQuery.isLoading) return <SkeletonState />;
  if (auditQuery.isError) return <ErrorState error={auditQuery.error} onRetry={() => auditQuery.refetch()} />;

  const items = auditQuery.data?.items ?? [];
  const total = Number(auditQuery.data?.total ?? 0);
  const currentPage = Number(auditQuery.data?.page ?? page);
  const currentPageSize = Number(auditQuery.data?.pageSize ?? pageSize);
  const totalPages = Math.max(1, Math.ceil(total / currentPageSize));
  const activeFiltersCount = [resource, userId, localityId, entityId, from, to].filter(Boolean).length;

  const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR');
  const formatDiff = (value: unknown) => {
    if (!value) return '-';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Auditoria
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Registro de ações críticas do sistema com filtros por recurso, usuário, localidade e período.
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Chip label={`Eventos: ${total}`} color="primary" variant="outlined" />
        <Chip label={`Página ${currentPage} de ${totalPages}`} variant="outlined" />
        <Chip label={`Filtros ativos: ${activeFiltersCount}`} variant="outlined" />
      </Stack>

      <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} flexWrap="wrap">
            <TextField
              size="small"
              label="Recurso"
              value={resource}
              onChange={(e) => updateParam('resource', e.target.value)}
              sx={{ minWidth: 160 }}
            />
            <TextField
              size="small"
              label="ID do usuário"
              value={userId}
              onChange={(e) => updateParam('userId', e.target.value)}
              sx={{ minWidth: 160 }}
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(e) => updateParam('localityId', e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {(localitiesQuery.data?.items ?? []).map((l: any) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Entidade (ID)"
              value={entityId}
              onChange={(e) => updateParam('entityId', e.target.value)}
              sx={{ minWidth: 190 }}
            />
            <TextField
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => updateParam('from', e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => updateParam('to', e.target.value)}
            />
            <TextField
              select
              size="small"
              label="Itens por página"
              value={String(currentPageSize)}
              onChange={(e) => updateParam('pageSize', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {[10, 20, 50, 100].map((size) => (
                <MenuItem key={size} value={String(size)}>
                  {size}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="text" onClick={clearFilters}>
              Limpar filtros
            </Button>
            <Button variant="outlined" onClick={() => auditQuery.refetch()}>
              Atualizar
            </Button>
          </Stack>
          <Divider sx={{ my: 1.2 }} />
          <Alert severity="info" sx={{ py: 0.4 }}>
            Os detalhes exibem o diff da operação auditada quando disponível.
          </Alert>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <EmptyState title="Nenhum evento" description="Ajuste filtros para ver mais eventos." />
      )}

      {items.length > 0 && (
        <Card sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <TableContainer sx={{ maxHeight: '68vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Recurso</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ação</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Usuário</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Localidade</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Entidade</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 360 }}>Detalhes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((log: any) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={log.resource} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={log.action} color="primary" />
                    </TableCell>
                    <TableCell>{log.user?.name ?? log.userId ?? '-'}</TableCell>
                    <TableCell>{log.locality?.name ?? log.localityId ?? '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{log.entityId ?? '-'}</TableCell>
                    <TableCell>
                      {log.diffJson ? (
                        <Box component="details">
                          <Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main' }}>
                            Ver detalhes
                          </Box>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              mt: 1,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: '#0f172a',
                              color: '#e2e8f0',
                              fontSize: 12,
                              lineHeight: 1.45,
                              overflowX: 'auto',
                              maxWidth: 520,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {formatDiff(log.diffJson)}
                          </Box>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <CardContent sx={{ pt: 1.2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Typography variant="caption" color="text.secondary">
                Mostrando {items.length} de {total} eventos.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={currentPage <= 1}
                  onClick={() => updateParam('page', String(currentPage - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateParam('page', String(currentPage + 1))}
                >
                  Próxima
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
