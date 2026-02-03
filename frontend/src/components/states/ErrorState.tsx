import { Box, Button, Typography } from '@mui/material';
import { parseApiError } from '../../app/apiErrors';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const payload = parseApiError(error);
  return (
    <Box textAlign="center" py={6}>
      <Typography variant="h6" gutterBottom>
        Algo deu errado
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {payload.message ?? 'Nao foi possivel carregar os dados.'}
      </Typography>
      {onRetry && (
        <Button variant="outlined" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Box>
  );
}
