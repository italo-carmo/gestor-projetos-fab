import { Box, Button, Typography } from '@mui/material';

export function EmptyState({
  title,
  description,
  message,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const resolvedTitle = title ?? 'Sem dados';
  const resolvedDescription = description ?? message ?? 'Nenhuma informação disponível.';
  return (
    <Box textAlign="center" py={6}>
      <Typography variant="h6" gutterBottom>
        {resolvedTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {resolvedDescription}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
