import { Box, Typography } from '@mui/material';
import { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';

/** Calendário “puro” sem HOC uncontrollable (evita conflito entre date/onNavigate e estado interno). */
const CalendarControlled =
  (Calendar as unknown as { ControlledComponent?: typeof Calendar })
    .ControlledComponent ?? Calendar;

type RbcView = 'month' | 'week' | 'day' | 'agenda';
type RbcNavigateAction = 'PREV' | 'NEXT' | 'TODAY';
import {
  endOfDay,
  format,
  getDay,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns';
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

export type CalendarEventKind = 'task' | 'mission' | 'activity' | 'meeting';

export type CalendarEventInput = {
  id: string;
  title: string;
  date: string | Date;
  /** End date for multi-day events (e.g. missions). If omitted, event is single-day. */
  endDate?: string | Date;
  /** Keeps dated items full-day by default, but allows meetings to appear at their scheduled time in week/day views. */
  allDay?: boolean;
  subtitle?: string;
  status?: string;
  /** Distinguishes styling: task (status colors), mission, activity, meeting */
  kind?: CalendarEventKind;
};

type CalendarRbcEvent = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  kind: CalendarEventKind;
  start: Date;
  end: Date;
  allDay: boolean;
};

type CalendarToolbarProps = {
  label: string;
  onNavigate: (action: RbcNavigateAction) => void;
  onView: (view: RbcView) => void;
  view: RbcView;
  views?: RbcView[] | Partial<Record<RbcView, boolean>>;
};

type CalendarSlotInfo = {
  start: Date;
  end: Date;
};

const STATUS_BG: Record<string, string> = {
  DONE: '#E8F5E9',
  IN_PROGRESS: '#E3F2FD',
  STARTED: '#E3F2FD',
  BLOCKED: '#E3F2FD',
  NOT_STARTED: '#ECEFF1',
};

const STATUS_BORDER: Record<string, string> = {
  DONE: '#2E7D32',
  IN_PROGRESS: '#1565C0',
  STARTED: '#1565C0',
  BLOCKED: '#1565C0',
  NOT_STARTED: '#607D8B',
};

/** Mission: indigo/purple. Activity: teal. Meeting: amber. Task: by status. */
const KIND_STYLES: Record<CalendarEventKind, { bg: string; border: string }> = {
  task: { bg: '', border: '' }, // use status
  mission: { bg: '#EDE7F6', border: '#5E35B1' },
  activity: { bg: '#E0F2F1', border: '#00695C' },
  meeting: { bg: '#FFF8E1', border: '#F57C00' },
};

const VIEW_LABELS: Record<RbcView, string> = {
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
};

function isRbcView(name: string): name is RbcView {
  return name in VIEW_LABELS;
}

function CalendarToolbar({
  label,
  onNavigate,
  onView,
  view,
  views,
}: CalendarToolbarProps) {
  const rawViews = Array.isArray(views)
    ? views
    : Object.keys(views ?? VIEW_LABELS);
  const availableViews = rawViews.filter(isRbcView);

  return (
    <Box className="rbc-toolbar app-calendar-toolbar">
      <Box component="span" className="rbc-btn-group app-calendar-nav">
        <button type="button" onClick={() => onNavigate('PREV')}>
          Anterior
        </button>
        <button type="button" onClick={() => onNavigate('TODAY')}>
          Hoje
        </button>
        <button type="button" onClick={() => onNavigate('NEXT')}>
          Próximo
        </button>
      </Box>
      <Box component="span" className="rbc-toolbar-label">
        {label}
      </Box>
      <Box component="span" className="rbc-btn-group app-calendar-views">
        {availableViews.map((viewName) => (
          <button
            key={viewName}
            type="button"
            className={view === viewName ? 'rbc-active' : undefined}
            onClick={() => onView(viewName)}
          >
            {VIEW_LABELS[viewName]}
          </button>
        ))}
      </Box>
    </Box>
  );
}

function EventCard({ event }: { event: CalendarRbcEvent }) {
  const kind: CalendarEventKind = event.kind ?? 'task';
  const isTask = kind === 'task';
  const status = event.status ?? 'NOT_STARTED';
  const kindStyle = KIND_STYLES[kind];
  const dotColor = isTask
    ? (STATUS_BORDER[status] ?? '#0C657E')
    : kindStyle.border;
  const bg = isTask ? (STATUS_BG[status] ?? '#E3F2FD') : kindStyle.bg;

  return (
    <Box
      sx={{
        px: 0.7,
        py: 0.4,
        borderRadius: 1.2,
        border: `1px solid ${dotColor}`,
        bgcolor: bg,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.15,
        width: '100%',
        minWidth: 0,
      }}
    >
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.55, minWidth: 0 }}
      >
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: dotColor,
            flex: '0 0 auto',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            lineHeight: 1.05,
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.title}
        </Typography>
      </Box>
      {(event.subtitle || (isTask && event.status)) && (
        <Typography
          variant="caption"
          sx={{
            lineHeight: 1,
            opacity: 0.86,
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.subtitle ??
            (isTask ? (TASK_STATUS_LABELS[status] ?? status) : '')}
        </Typography>
      )}
    </Box>
  );
}

export function CalendarView({
  events,
  onSelect,
  onSelectSlot,
  height = 520,
  date,
}: {
  events: CalendarEventInput[];
  onSelect: (id: string) => void;
  onSelectSlot?: (date: Date) => void;
  height?: number | string;
  /** Data inicial / âncora (ex.: início do ano filtrado). Precisa de estado interno + onNavigate para Anterior/Próximo funcionarem. */
  date?: Date;
}) {
  const [currentDate, setCurrentDate] = useState(() => date ?? new Date());
  const [currentView, setCurrentView] = useState<RbcView>('month');

  const rbcEvents: CalendarRbcEvent[] = events.map((e) => {
    const d = typeof e.date === 'string' ? new Date(e.date) : e.date;
    const endD = e.endDate
      ? typeof e.endDate === 'string'
        ? new Date(e.endDate)
        : e.endDate
      : d;
    const isAllDay = e.allDay ?? true;
    return {
      id: e.id,
      title: e.title,
      subtitle: e.subtitle,
      status: e.status,
      kind: e.kind ?? 'task',
      start: isAllDay ? startOfDay(d) : d,
      end: isAllDay ? endOfDay(endD) : endD,
      allDay: isAllDay,
    };
  });

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate',
        zIndex: 0,
        height,
        width: '100%',
        overflowX: 'hidden',
        '& .rbc-calendar': {
          fontFamily: 'inherit',
          position: 'relative',
          zIndex: 0,
        },
        '& .rbc-toolbar': {
          flexWrap: 'wrap',
          gap: 0.8,
          mb: 1.1,
          alignItems: 'center',
          '& .app-calendar-nav': {
            order: 1,
          },
          '& .app-calendar-views': {
            order: 3,
          },
          '& button': {
            borderRadius: 1.3,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 12,
            padding: '4px 8px',
            borderColor: 'rgba(17, 66, 89, 0.24)',
          },
          '& button.rbc-active': {
            backgroundColor: 'rgba(12, 101, 126, 0.14)',
          },
        },
        '& .rbc-toolbar-label': {
          order: 2,
          flex: '1 1 190px',
          minWidth: 160,
          fontWeight: 800,
          fontSize: 16,
          textAlign: 'center',
        },
        '& .rbc-header': {
          padding: '5px 1px',
          fontWeight: 700,
          fontSize: 9.5,
          color: '#FFFFFF',
          background: 'rgb(23, 57, 75)',
        },
        '& .rbc-month-view': {
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(17, 66, 89, 0.14)',
        },
        '& .rbc-today': { backgroundColor: 'rgba(12, 101, 126, 0.08)' },
        '& .rbc-off-range-bg': { backgroundColor: '#F6FAFC' },
        '& .rbc-date-cell': { padding: '2px 3px 1px', fontSize: 10.5 },
        '& .rbc-event': {
          borderRadius: 8,
          padding: 0,
          minHeight: 24,
          border: 'none',
          boxShadow: '0 5px 10px rgba(13, 42, 56, 0.1)',
          width: '100%',
          maxWidth: '100%',
        },
        '& .rbc-event:focus': { outline: '2px solid #0C657E' },
        '& .rbc-month-view .rbc-row-segment': {
          paddingLeft: 2,
          paddingRight: 2,
        },
        '& .rbc-month-view .rbc-row-segment .rbc-event': {
          display: 'flex',
          width: '100%',
          maxWidth: '100%',
          margin: '2px 0',
          boxShadow: 'none',
          backgroundColor: 'transparent !important',
          borderLeft: 'none !important',
        },
        '& .rbc-month-view .rbc-event-content': {
          width: '100%',
          minWidth: 0,
        },
        '& .rbc-month-row, & .rbc-row-content, & .rbc-row': {
          minWidth: 0,
          overflow: 'hidden',
        },
        '& .rbc-month-view .rbc-event-label': {
          display: 'none',
        },
        '& .rbc-show-more': {
          color: 'primary.main',
          fontWeight: 700,
        },
        '& .rbc-overlay': {
          zIndex: 2,
          maxWidth: 'calc(100vw - 32px)',
        },
      }}
    >
      <CalendarControlled
        localizer={localizer}
        events={rbcEvents}
        startAccessor="start"
        endAccessor="end"
        culture="pt-BR"
        messages={MESSAGES}
        onSelectEvent={(event: CalendarRbcEvent) => onSelect(event.id)}
        selectable={Boolean(onSelectSlot)}
        onSelectSlot={(slotInfo: CalendarSlotInfo) =>
          onSelectSlot?.(slotInfo.start)
        }
        views={['month', 'week', 'day', 'agenda']}
        view={currentView}
        onView={(nextView: RbcView) => setCurrentView(nextView)}
        date={currentDate}
        onNavigate={(nextDate: Date) =>
          setCurrentDate(new Date(nextDate.getTime()))
        }
        popup={false}
        doShowMoreDrillDown
        components={{ event: EventCard, toolbar: CalendarToolbar }}
        eventPropGetter={(event: CalendarRbcEvent) => {
          const kind: CalendarEventKind = event.kind ?? 'task';
          const isTask = kind === 'task';
          const status = event.status ?? 'NOT_STARTED';
          const bg = isTask
            ? (STATUS_BG[status] ?? '#E3F2FD')
            : KIND_STYLES[kind].bg;
          const borderColor = isTask
            ? (STATUS_BORDER[status] ?? '#0C657E')
            : KIND_STYLES[kind].border;
          return {
            style: {
              backgroundColor: bg,
              color: '#17394B',
              borderLeft: `4px solid ${borderColor}`,
            },
          };
        }}
      />
    </Box>
  );
}
