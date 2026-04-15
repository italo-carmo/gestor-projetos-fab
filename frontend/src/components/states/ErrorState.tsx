import { Box, Button, Typography } from '@mui/material';
import { parseApiError } from '../../app/apiErrors';

type ErrorStateProps =
  | { error: unknown; onRetry?: () => void; message?: string }
  | { error?: unknown; onRetry?: () => void; message: string };

export function ErrorState({ error, onRetry, message }: ErrorStateProps) {
  const payload = error !== undefined ? parseApiError(error) : null;
  return (
    <Box textAlign="center" py={6}>
      <Typography variant="h6" gutterBottom>
        Algo deu errado
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {message ?? payload?.message ?? 'Não foi possível carregar os dados.'}
      </Typography>
      {onRetry && (
        <Button variant="outlined" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Box>
  );
}
