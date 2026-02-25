import { Chip } from '@mui/material';

const map: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  NOT_STARTED: { label: 'Não iniciada', color: 'default' },
  STARTED: { label: 'Iniciada', color: 'primary' },
  IN_PROGRESS: { label: 'Em andamento', color: 'primary' },
  BLOCKED: { label: 'Em andamento', color: 'primary' },
  DONE: { label: 'Concluída', color: 'success' },
};

export function StatusChip({ status, isLate }: { status: string; isLate?: boolean }) {
  const entry = map[status] ?? { label: status, color: 'default' };
  const label = isLate ? `${entry.label} (Atrasada)` : entry.label;
  return <Chip size="small" label={label} color={entry.color} />;
}
