import { Box, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrgChart } from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

export function OrgChartPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';

  const filters = useMemo(
    () => ({
      q: search || undefined,
    }),
    [search],
  );

  const orgQuery = useOrgChart(filters);

  const updateParam = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next);
  };

  if (orgQuery.isLoading) return <SkeletonState />;
  if (orgQuery.isError) return <ErrorState error={orgQuery.error} onRetry={() => orgQuery.refetch()} />;

  const items = orgQuery.data?.items ?? [];
  const filtered = search
    ? items.map((group: any) => ({
        ...group,
        elos: group.elos.filter((elo: any) =>
          [elo.name, elo.om, elo.roleType].some((value: string) => value?.toLowerCase().includes(search.toLowerCase())),
        ),
      })).filter((group: any) => group.elos.length > 0)
    : items;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Organograma
      </Typography>

      <TextField
        size="small"
        label="Buscar por nome/OM"
        value={search}
        onChange={(e) => updateParam(e.target.value)}
        sx={{ mb: 2, minWidth: 260 }}
      />

      {filtered.length === 0 && (
        <EmptyState title="Nenhum contato encontrado" description="Ajuste a busca ou filtros." />
      )}

      <Stack spacing={2}>
        {filtered.map((group: any) => (
          <Card key={group.localityName}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {group.localityName}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
                {group.elos.map((elo: any) => (
                    <Card key={elo.id} variant="outlined" sx={{ minWidth: 220 }}>
                      <CardContent>
                      <Typography variant="subtitle2">{elo.name ?? 'Contato'}</Typography>
                      <Chip size="small" label={elo.eloRole?.name ?? elo.eloRole?.code ?? '—'} sx={{ mt: 1 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {elo.om ?? '-'}
                      </Typography>
                      {elo.phone && (
                        <Typography variant="body2" color="text.secondary">
                          {elo.phone}
                        </Typography>
                      )}
                      {elo.email && (
                        <Typography variant="body2" color="text.secondary">
                          {elo.email}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
