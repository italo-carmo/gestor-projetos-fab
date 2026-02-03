import { Chip } from '@mui/material';

const map: Record<string, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  NOT_STARTED: { label: 'Nao iniciada', color: 'default' },
  STARTED: { label: 'Iniciada', color: 'primary' },
  IN_PROGRESS: { label: 'Em andamento', color: 'primary' },
  BLOCKED: { label: 'Bloqueada', color: 'warning' },
  DONE: { label: 'Concluida', color: 'success' },
};

export function StatusChip({ status, isLate, blocked }: { status: string; isLate?: boolean; blocked?: boolean }) {
  const entry = map[status] ?? { label: status, color: 'default' };
  const label = isLate ? `${entry.label} (Atrasada)` : entry.label;
  const color = blocked ? 'warning' : entry.color;
  return <Chip size="small" label={label} color={color} />;
}
