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
  const gradientBySeverity: Record<'primary' | 'error' | 'warning', string> = {
    primary: 'linear-gradient(135deg, #0C657E 0%, #0A5471 100%)',
    error: 'linear-gradient(135deg, #9D1C2E 0%, #6F1322 100%)',
    warning: 'linear-gradient(135deg, #9A5A06 0%, #734205 100%)',
  };
  const confirmColorBySeverity: Record<'primary' | 'error' | 'warning', 'primary' | 'error' | 'warning'> = {
    primary: 'primary',
    error: 'error',
    warning: 'warning',
  };

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
          background: gradientBySeverity[severity],
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <WarningAmberRoundedIcon sx={{ color: '#E8F4FA', fontSize: 18 }} />
        <Typography variant="caption" sx={{ color: '#E8F4FA', fontWeight: 700, letterSpacing: 0.4 }}>
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
          color={confirmColorBySeverity[severity]}
          disabled={confirmLoading || disableConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
