import { Box, Skeleton, Stack } from '@mui/material';

export function SkeletonState() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="text" width="40%" height={32} />
      <Skeleton variant="rectangular" height={120} />
      <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr 1fr' }}>
        <Skeleton variant="rectangular" height={140} />
        <Skeleton variant="rectangular" height={140} />
        <Skeleton variant="rectangular" height={140} />
      </Box>
    </Stack>
  );
}
