import { Chip } from '@mui/material';
import { dueBadge } from '../../app/date';

export function DueBadge({ dueDate, status }: { dueDate?: string | Date | null; status?: string | null }) {
  const badge = dueBadge(dueDate ?? null, status ?? null);
  return <Chip size="small" label={badge.label} color={badge.tone === 'default' ? 'default' : badge.tone} />;
}
