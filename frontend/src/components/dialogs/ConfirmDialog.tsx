import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  highlightText?: ReactNode;
  note?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'primary' | 'error' | 'warning';
  confirmLoading?: boolean;
  disableConfirm?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  highlightText,
  note,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  severity = 'primary',
  confirmLoading = false,
  disableConfirm = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const toneBySeverity: Record<'primary' | 'error' | 'warning', { bg: string; border: string; icon: string; button: string; buttonHover: string }> = {
    primary: {
      bg: '#F3F7FB',
      border: '#D9E4EF',
      icon: '#3F6D8F',
      button: '#3F6D8F',
      buttonHover: '#355D7A',
    },
    error: {
      bg: '#FDF5F6',
      border: '#F0DADF',
      icon: '#9A5D68',
      button: '#9A5D68',
      buttonHover: '#86505A',
    },
    warning: {
      bg: '#FFF8EF',
      border: '#F2E0C7',
      icon: '#8E7240',
      button: '#8E7240',
      buttonHover: '#785F35',
    },
  };
  const tone = toneBySeverity[severity];

  return (
    <Dialog
      open={open}
      onClose={confirmLoading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid #E3EAF3',
          boxShadow: '0 18px 44px rgba(7, 26, 43, 0.22)',
        },
      }}
    >
      <Box
        sx={{
          px: 2.2,
          py: 1.1,
          backgroundColor: tone.bg,
          borderBottom: `1px solid ${tone.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <WarningAmberRoundedIcon sx={{ color: tone.icon, fontSize: 18 }} />
        <Typography variant="caption" sx={{ color: '#4A5968', fontWeight: 700, letterSpacing: 0.4 }}>
          CONFIRMACAO
        </Typography>
      </Box>
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: '4px !important' }}>
        <Typography variant="body2" sx={{ color: '#1F2D3D' }}>
          {message}
        </Typography>
        {highlightText ? (
          <Box
            sx={{
              mt: 1.1,
              p: 1.2,
              borderRadius: 1.6,
              border: '1px solid #E3EAF3',
              backgroundColor: '#F8FBFD',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#0C657E' }}>
              {highlightText}
            </Typography>
          </Box>
        ) : null}
        {note ? (
          <Typography variant="caption" sx={{ mt: 1.2, display: 'block', color: 'text.secondary' }}>
            {note}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit" disabled={confirmLoading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={confirmLoading || disableConfirm}
          sx={{
            backgroundColor: tone.button,
            '&:hover': {
              backgroundColor: tone.buttonHover,
            },
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
