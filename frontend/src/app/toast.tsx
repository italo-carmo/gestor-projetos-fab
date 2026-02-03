import { Alert, Snackbar } from '@mui/material';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export type ToastPayload = { message: string; severity?: 'success' | 'error' | 'warning' | 'info' };

const ToastContext = createContext<{ push: (payload: ToastPayload) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ToastPayload>({ message: '', severity: 'info' });

  const push = useCallback((next: ToastPayload) => {
    setPayload(next);
    setOpen(true);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <Snackbar open={open} autoHideDuration={3500} onClose={() => setOpen(false)}>
        <Alert severity={payload.severity ?? 'info'} onClose={() => setOpen(false)}>
          {payload.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider missing');
  return ctx;
}
