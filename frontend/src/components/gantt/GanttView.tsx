import { Box, Typography } from '@mui/material';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

const DEFAULT_DURATION_DAYS = 7;

export function GanttView({ items, onSelect }: { items: any[]; onSelect: (id: string) => void }) {
  if (!items.length) return null;

  const mapped = items.map((item) => {
    const due = typeof item.dueDate === 'string' ? parseISO(item.dueDate) : new Date(item.dueDate);
    const start = addDays(due, -DEFAULT_DURATION_DAYS);
      return {
      id: item.id,
      name: `[${item.phaseName ?? item.taskTemplate?.phaseId ?? 'Fase'}] ${item.taskTemplate?.title ?? 'Tarefa'}`,
      start,
      end: due,
      progress: item.progressPercent ?? 0,
      status: item.status,
    };
  });

  const minStart = mapped.reduce((min, item) => (item.start < min ? item.start : min), mapped[0].start);
  const maxEnd = mapped.reduce((max, item) => (item.end > max ? item.end : max), mapped[0].end);
  const totalDays = Math.max(1, differenceInCalendarDays(maxEnd, minStart) + 1);

  return (
    <Box display="grid" gap={2}>
      {mapped.map((row) => {
        const offset = differenceInCalendarDays(row.start, minStart);
        const duration = Math.max(1, differenceInCalendarDays(row.end, row.start) + 1);
        const left = (offset / totalDays) * 100;
        const width = (duration / totalDays) * 100;
        return (
          <Box key={row.id}>
            <Typography variant="caption" color="text.secondary">
              {row.name}
            </Typography>
            <Box
              sx={{
                position: 'relative',
                height: 24,
                backgroundColor: '#E8EEF7',
                borderRadius: 999,
                overflow: 'hidden',
              }}
              onClick={() => onSelect(row.id)}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  height: '100%',
                  backgroundColor: '#0B4DA1',
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${(width * row.progress) / 100}%`,
                  height: '100%',
                  backgroundColor: '#4F7BC2',
                  borderRadius: 999,
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
