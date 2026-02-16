import { Box, Typography } from '@mui/material';
import { addDays, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useRef } from 'react';

export type CalendarEvent = {
  id: string;
  title: string;
  date: string | Date;
};

export function YearCalendarView({
  year,
  events,
  onSelect,
}: {
  year: number;
  events: CalendarEvent[];
  onSelect: (id: string) => void;
}) {
  const currentMonthRef = useRef<HTMLDivElement>(null);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const date = typeof event.date === 'string' ? parseISO(event.date) : event.date;
    const key = format(date, 'yyyy-MM-dd');
    const list = eventsByDate.get(key) ?? [];
    list.push(event);
    eventsByDate.set(key, list);
  });

  const months = Array.from({ length: 12 }, (_, idx) => new Date(year, idx, 1));
  const today = new Date();
  const isCurrentYear = year === today.getFullYear();

  useEffect(() => {
    if (isCurrentYear && currentMonthRef.current) {
      currentMonthRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [year, isCurrentYear]);

  return (
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2}>
      {months.map((month, monthIndex) => {
        const isCurrentMonth = isCurrentYear && monthIndex === today.getMonth();
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        const days: Date[] = [];
        const leadingBlank = start.getDay();
        for (let i = 0; i < leadingBlank; i += 1) {
          days.push(addDays(start, -(leadingBlank - i)));
        }
        let cursor = start;
        while (cursor <= end) {
          days.push(cursor);
          cursor = addDays(cursor, 1);
        }
        return (
          <Box
            key={month.toISOString()}
            ref={isCurrentMonth ? currentMonthRef : undefined}
            sx={{
              border: '1px solid #E6ECF5',
              borderRadius: 2,
              p: 1,
              ...(isCurrentMonth && { borderColor: 'primary.main', borderWidth: 2, boxShadow: 1 }),
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {format(month, 'MMMM', { locale: ptBR })}
              {isCurrentMonth && ' (atual)'}
            </Typography>
            <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.5}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, index) => (
                <Typography key={index} variant="caption" color="text.secondary" textAlign="center">
                  {label}
                </Typography>
              ))}
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(key) ?? [];
                const isToday = isSameDay(day, new Date());
                return (
                  <Box
                    key={key}
                    sx={{
                      minHeight: 60,
                      borderRadius: 1,
                      p: 0.5,
                      backgroundColor: isToday ? '#E8F0FF' : 'transparent',
                      opacity: isSameMonth(day, month) ? 1 : 0.3,
                    }}
                  >
                    <Typography variant="caption" fontWeight={600}>
                      {format(day, 'd')}
                    </Typography>
                    {dayEvents.slice(0, 2).map((event) => (
                      <Box
                        key={event.id}
                        sx={{
                          mt: 0.5,
                          backgroundColor: '#0B4DA1',
                          color: '#fff',
                          borderRadius: 1,
                          px: 0.5,
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                        onClick={() => onSelect(event.id)}
                      >
                        {event.title}
                      </Box>
                    ))}
                    {dayEvents.length > 2 && (
                      <Typography variant="caption" color="text.secondary">
                        +{dayEvents.length - 2}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
