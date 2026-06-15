import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type AdminTableScrollProps = {
  children: ReactNode;
  minWidth?: number;
};

export function AdminTableScroll({
  children,
  minWidth = 720,
}: AdminTableScrollProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        '& .MuiTable-root': {
          width: '100%',
          minWidth,
        },
        '& .MuiTableCell-root': {
          verticalAlign: 'top',
        },
      }}
    >
      {children}
    </Box>
  );
}
