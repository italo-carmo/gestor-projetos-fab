import { Box, LinearProgress, Typography } from '@mui/material';

export function ProgressInline({ value }: { value: number }) {
  return (
    <Box display="flex" alignItems="center" gap={1} minWidth={120}>
      <LinearProgress variant="determinate" value={value} sx={{ flex: 1, height: 6, borderRadius: 999 }} />
      <Typography variant="caption" color="text.secondary">
        {Math.round(value)}%
      </Typography>
    </Box>
  );
}
