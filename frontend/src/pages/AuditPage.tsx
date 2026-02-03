import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
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
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const filters = useMemo(
    () => ({
      resource: resource || undefined,
      userId: userId || undefined,
      localityId: localityId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [resource, userId, localityId, from, to],
  );

  const auditQuery = useAuditLogs(filters);
  const localitiesQuery = useLocalities();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  if (auditQuery.isLoading) return <SkeletonState />;
  if (auditQuery.isError) return <ErrorState error={auditQuery.error} onRetry={() => auditQuery.refetch()} />;

  const items = auditQuery.data?.items ?? [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Auditoria
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Recurso"
              value={resource}
              onChange={(e) => updateParam('resource', e.target.value)}
              sx={{ minWidth: 160 }}
            />
            <TextField
              size="small"
              label="Usuário"
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
          </Stack>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <EmptyState title="Nenhum evento" description="Ajuste filtros para ver mais eventos." />
      )}

      {items.length > 0 && (
        <Card>
          <CardContent>
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Data', 'Recurso', 'Ação', 'Usuário', 'Localidade', 'Detalhes'].map((header) => (
                    <Box key={header} component="th" sx={{ textAlign: 'left', pb: 1 }}>
                      {header}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {items.map((log: any) => (
                  <Box key={log.id} component="tr" sx={{ borderTop: '1px solid #E6ECF5' }}>
                    <Box component="td" sx={{ py: 1 }}>
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {log.resource}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {log.action}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {log.user?.name ?? log.userId ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {log.locality?.name ?? log.localityId ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {log.diffJson ? JSON.stringify(log.diffJson) : '-'}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

