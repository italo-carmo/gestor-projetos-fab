import { differenceInDays, format, parseISO } from 'date-fns';

export function formatDate(input?: string | Date | null, pattern = 'dd/MM/yyyy') {
  if (!input) return '-';
  const date = typeof input === 'string' ? parseISO(input) : input;
  return format(date, pattern);
}

export function dueBadge(dueDate?: string | Date | null, status?: string | null) {
  if (status === 'DONE') return { label: 'Concluída', tone: 'success' as const };
  if (!dueDate) return { label: '-', tone: 'default' as const };
  const date = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  const days = differenceInDays(date, new Date());
  if (days < 0) return { label: `Atrasada ha ${Math.abs(days)} dias`, tone: 'error' as const };
  if (days === 0) return { label: 'Vence hoje', tone: 'warning' as const };
  if (days <= 5) return { label: `Vence em ${days} dias`, tone: 'warning' as const };
  return { label: `Vence em ${days} dias`, tone: 'default' as const };
}
