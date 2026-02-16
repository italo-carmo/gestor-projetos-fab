import { Box, Typography } from '@mui/material';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { endOfDay, format, getDay, parse, startOfDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { TASK_STATUS_LABELS } from '../../constants/enums';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const MESSAGES = {
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  allDay: 'Dia inteiro',
  week: 'Semana',
  work_week: 'Semana de trabalho',
  day: 'Dia',
  month: 'Mês',
  previous: 'Anterior',
  next: 'Próximo',
  yesterday: 'Ontem',
  tomorrow: 'Amanhã',
  today: 'Hoje',
  agenda: 'Agenda',
  noEventsInRange: 'Nenhum evento neste período.',
  showMore: (total: number) => `+${total} mais`,
};

export type CalendarEventInput = {
  id: string;
  title: string;
  date: string | Date;
  subtitle?: string;
  status?: string;
};

const STATUS_BG: Record<string, string> = {
  DONE: '#E8F5E9',
  IN_PROGRESS: '#E3F2FD',
  STARTED: '#E3F2FD',
  BLOCKED: '#FFEBEE',
  NOT_STARTED: '#ECEFF1',
};

const STATUS_BORDER: Record<string, string> = {
  DONE: '#2E7D32',
  IN_PROGRESS: '#1565C0',
  STARTED: '#1565C0',
  BLOCKED: '#C62828',
  NOT_STARTED: '#607D8B',
};

function EventCard({ event }: { event: any }) {
  const status = event.status ?? 'NOT_STARTED';
  const dotColor = STATUS_BORDER[status] ?? '#0C657E';
  const bg = STATUS_BG[status] ?? '#E3F2FD';

  return (
    <Box
      sx={{
        px: 0.85,
        py: 0.55,
        borderRadius: 1.2,
        border: `1px solid ${dotColor}`,
        bgcolor: bg,
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 0.2,
        maxWidth: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, minWidth: 0 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dotColor, flex: '0 0 auto' }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, lineHeight: 1.1, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {event.title}
        </Typography>
      </Box>
      {(event.subtitle || event.status) && (
        <Typography
          variant="caption"
          sx={{
            lineHeight: 1.05,
            opacity: 0.86,
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.subtitle ?? TASK_STATUS_LABELS[event.status] ?? event.status}
        </Typography>
      )}
    </Box>
  );
}

export function CalendarView({
  events,
  onSelect,
  height = 640,
  date,
}: {
  events: CalendarEventInput[];
  onSelect: (id: string) => void;
  height?: number;
  date?: Date;
}) {
  const rbcEvents = events.map((e) => {
    const d = typeof e.date === 'string' ? new Date(e.date) : e.date;
    return {
      id: e.id,
      title: e.title,
      subtitle: e.subtitle,
      status: e.status,
      start: startOfDay(d),
      end: endOfDay(d),
      allDay: true,
    };
  });

  return (
    <Box
      sx={{
        height,
        '& .rbc-calendar': { fontFamily: 'inherit' },
        '& .rbc-toolbar': {
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          '& button': {
            borderRadius: 1.3,
            textTransform: 'none',
            fontWeight: 700,
            borderColor: 'rgba(17, 66, 89, 0.24)',
          },
          '& button.rbc-active': {
            backgroundColor: 'rgba(12, 101, 126, 0.14)',
          },
        },
        '& .rbc-toolbar-label': { fontWeight: 800, fontSize: 18 },
        '& .rbc-header': {
          padding: '10px 4px',
          fontWeight: 700,
          fontSize: 12,
          color: '#234454',
          background: 'rgba(12, 101, 126, 0.05)',
        },
        '& .rbc-month-view': {
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(17, 66, 89, 0.14)',
        },
        '& .rbc-today': { backgroundColor: 'rgba(12, 101, 126, 0.08)' },
        '& .rbc-off-range-bg': { backgroundColor: '#F6FAFC' },
        '& .rbc-date-cell': { padding: '4px 8px 2px' },
        '& .rbc-event': {
          borderRadius: 8,
          padding: 0,
          minHeight: 34,
          border: 'none',
          boxShadow: '0 5px 10px rgba(13, 42, 56, 0.1)',
        },
        '& .rbc-event:focus': { outline: '2px solid #0C657E' },
        '& .rbc-month-view .rbc-row-segment': {
          paddingLeft: 4,
          paddingRight: 4,
        },
        '& .rbc-month-view .rbc-row-segment .rbc-event': {
          display: 'inline-flex',
          width: 'auto',
          maxWidth: '100%',
          margin: '2px 0',
          boxShadow: 'none',
          backgroundColor: 'transparent !important',
          borderLeft: 'none !important',
        },
        '& .rbc-month-view .rbc-event-content': {
          width: 'auto',
          minWidth: 0,
        },
        '& .rbc-month-view .rbc-event-label': {
          display: 'none',
        },
        '& .rbc-show-more': {
          color: 'primary.main',
          fontWeight: 700,
        },
      }}
    >
      <Calendar
        localizer={localizer}
        events={rbcEvents}
        startAccessor="start"
        endAccessor="end"
        culture="pt-BR"
        messages={MESSAGES}
        onSelectEvent={(event: any) => onSelect((event as { id: string }).id)}
        views={['month', 'week', 'day', 'agenda']}
        defaultView="month"
        date={date ?? new Date()}
        popup
        components={{ event: EventCard }}
        eventPropGetter={(event: any) => {
          const status = event.status ?? 'NOT_STARTED';
          return {
            style: {
              backgroundColor: STATUS_BG[status] ?? '#E3F2FD',
              color: '#17394B',
              borderLeft: `4px solid ${STATUS_BORDER[status] ?? '#0C657E'}`,
            },
          };
        }}
      />
    </Box>
  );
}
