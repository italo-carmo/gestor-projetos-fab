import { Chip } from '@mui/material';
import { dueBadge } from '../../app/date';

export function DueBadge({ dueDate }: { dueDate?: string | Date | null }) {
  const badge = dueBadge(dueDate ?? null);
  return <Chip size="small" label={badge.label} color={badge.tone === 'default' ? 'default' : badge.tone} />;
}
