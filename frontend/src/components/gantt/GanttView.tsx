import { Box, Tooltip, Typography } from '@mui/material';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { addDays, format, parseISO, startOfMonth } from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { TASK_STATUS_LABELS } from '../../constants/enums';

const DEFAULT_DURATION_DAYS = 7;
const DATE_COL_WIDTH = 88;

const STATUS_COLORS: Record<string, { bg: string; progress: string }> = {
  DONE: { bg: '#2E7D32', progress: '#66BB6A' },
  IN_PROGRESS: { bg: '#0B4DA1', progress: '#4F7BC2' },
  STARTED: { bg: '#0B4DA1', progress: '#4F7BC2' },
  NOT_STARTED: { bg: '#78909C', progress: '#90A4AE' },
  BLOCKED: { bg: '#C62828', progress: '#EF5350' },
  LATE: { bg: '#E65100', progress: '#FF9800' },
};

function getTaskStyles(status: string, isLate?: boolean) {
  if (isLate && status !== 'DONE') {
    const c = STATUS_COLORS.LATE;
    return { backgroundColor: c.bg, backgroundSelectedColor: c.bg, progressColor: c.progress, progressSelectedColor: c.progress };
  }
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.NOT_STARTED;
  return {
    backgroundColor: c.bg,
    backgroundSelectedColor: c.bg,
    progressColor: c.progress,
    progressSelectedColor: c.progress,
  };
}

export type GanttItem = {
  id: string;
  localityId?: string;
  taskTemplate?: { title?: string; phaseId?: string } | null;
  phaseName?: string;
  localityName?: string;
  dueDate: string | Date;
  progressPercent?: number;
  status?: string;
  isLate?: boolean;
};

function TooltipPt({ task }: { task: Task }) {
  const start = format(task.start, 'dd/MM/yyyy');
  const end = format(task.end, 'dd/MM/yyyy');
  const status = TASK_STATUS_LABELS[task.project ?? ''] ?? task.project ?? '—';

  return (
    <Box
      sx={{
        minWidth: 250,
        maxWidth: 340,
        px: 1.4,
        py: 1.25,
        borderRadius: 1.7,
        color: '#EAF4F8',
        background: 'linear-gradient(158deg, #123241 0%, #0C657E 100%)',
        border: '1px solid rgba(255,255,255,0.24)',
        boxShadow: '0 14px 34px rgba(8, 32, 44, 0.35)',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25 }}>
        {task.name}
      </Typography>
      <Typography
        variant="caption"
        display="block"
        sx={{ mt: 0.9, color: 'rgba(234, 244, 248, 0.88)', lineHeight: 1.6 }}
      >
        Início: {start}
        <br />
        Prazo: {end}
        <br />
        Progresso: {Math.round(task.progress)}%
        <br />
        Status: {status}
      </Typography>
    </Box>
  );
}

function TaskListHeaderPt({
  headerHeight,
  rowWidth: _rowWidth,
  fontFamily,
  fontSize,
}: {
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `minmax(0, 1fr) ${DATE_COL_WIDTH}px ${DATE_COL_WIDTH}px`,
        height: headerHeight,
        borderBottom: '1px solid rgba(0,0,0,0.12)',
        borderTop: '1px solid rgba(0,0,0,0.12)',
        borderLeft: '1px solid rgba(0,0,0,0.12)',
        bgcolor: 'rgba(12, 101, 126, 0.08)',
        fontFamily,
        fontSize,
      }}
    >
      {['Tarefa', 'Início', 'Prazo'].map((label) => (
        <Box
          key={label}
          sx={{
            px: 1.2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            fontWeight: 700,
            borderRight: '1px solid rgba(0,0,0,0.12)',
          }}
        >
          {label}
        </Box>
      ))}
    </Box>
  );
}

function TaskListTablePt({
  rowHeight,
  rowWidth: _rowWidth,
  fontFamily,
  fontSize,
  locale: _locale,
  tasks,
  selectedTaskId,
  setSelectedTask,
}: {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}) {
  return (
    <Box sx={{ fontFamily, fontSize }}>
      {tasks.map((task) => {
        const selected = task.id === selectedTaskId;
        return (
          <Box
            key={task.id}
            onClick={() => setSelectedTask(task.id)}
            sx={{
              display: 'grid',
              gridTemplateColumns: `minmax(0, 1fr) ${DATE_COL_WIDTH}px ${DATE_COL_WIDTH}px`,
              minHeight: rowHeight,
              cursor: 'pointer',
              bgcolor: selected ? 'rgba(12, 101, 126, 0.1)' : 'transparent',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              borderLeft: '1px solid rgba(0,0,0,0.08)',
              '&:hover': { bgcolor: 'rgba(12, 101, 126, 0.06)' },
            }}
          >
            <Box sx={{ px: 1.2, py: 1.1, borderRight: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Tooltip title={task.name} arrow>
                <Typography variant="body2" noWrap component="span" sx={{ display: 'block', fontSize: 13 }}>
                  {task.name}
                </Typography>
              </Tooltip>
            </Box>
            <Box sx={{ px: 1.2, py: 1.1, borderRight: '1px solid rgba(0,0,0,0.08)' }}>
              {format(task.start, 'dd/MM/yy')}
            </Box>
            <Box sx={{ px: 1.2, py: 1.1 }}>
              {format(task.end, 'dd/MM/yy')}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function GanttView({
  items,
  onSelect,
  viewMode = 'Week',
}: {
  items: GanttItem[];
  onSelect: (id: string) => void;
  viewMode?: 'Day' | 'Week' | 'Month';
}) {
  const tasks: Task[] = useMemo(() => {
    return items.map((item) => {
      const due = typeof item.dueDate === 'string' ? parseISO(item.dueDate) : new Date(item.dueDate);
      const start = addDays(due, -DEFAULT_DURATION_DAYS);
      const title = item.taskTemplate?.title ?? 'Tarefa';
      const phase = item.phaseName ?? 'Fase';
      const locality = item.localityName ?? '—';
      const name = `${phase} | ${title} — ${locality}`;

      return {
        id: item.id,
        name,
        type: 'task' as const,
        start,
        end: due,
        progress: Math.min(100, Math.max(0, item.progressPercent ?? 0)),
        isDisabled: false,
        project: item.status ?? undefined,
        styles: getTaskStyles(item.status ?? 'NOT_STARTED', item.isLate),
      };
    });
  }, [items]);

  const viewDate = useMemo(() => {
    if (tasks.length === 0) return new Date();
    const dates = tasks.flatMap((t) => [t.start, t.end]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    return startOfMonth(min);
  }, [tasks]);

  if (!items.length) return null;

  const ganttHeight = Math.min(620, Math.max(320, tasks.length * 44 + 90));
  const columnWidth = viewMode === 'Day' ? 70 : viewMode === 'Week' ? 88 : 130;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; pointerId: number | null; startX: number; startScrollLeft: number }>({
    active: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
  });
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const getHorizontalScroller = () => {
    if (!rootRef.current) return null;
    return rootRef.current.querySelector<HTMLElement>('._2k9Ys');
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('button, a, input, textarea, [role="button"]') ||
      target.closest('._3ZbQT') ||
      target.closest('._3_ygE')
    ) {
      return;
    }

    const scroller = getHorizontalScroller();
    if (!scroller) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
    };
    didDragRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    const scroller = getHorizontalScroller();
    if (!scroller) return;
    const dx = event.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) didDragRef.current = true;
    scroller.scrollLeft = dragRef.current.startScrollLeft - dx;
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <Box
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      sx={{
        border: '1px solid rgba(17, 66, 89, 0.14)',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: '#fff',
        userSelect: isDragging ? 'none' : 'auto',
        '& ._3_ygE': { borderColor: '#DCE7EE' },
        '& ._34SS0:nth-of-type(even)': { backgroundColor: '#F7FBFD' },
        '& ._3lLk3': { fontFamily: 'inherit', fontSize: 13 },
        '& ._2QjE6': { fontFamily: 'inherit', color: '#355160' },
        '& ._2TfEi': { fontFamily: 'inherit', color: '#355160' },
        '& ._1eT-t': { width: '0.9rem' },
        '& ._2k9Ys': { height: '0.95rem' },
        '& ._2B2zv, & ._3eULf, & ._2k9Ys, & ._CZjuD': { cursor: isDragging ? 'grabbing' : 'grab' },
        '& ._2dZTy, & ._3rUKi, & ._RuwuK': { cursor: isDragging ? 'grabbing' : 'grab' },
        '& ._3T42e': {
          background: 'transparent',
          boxShadow: 'none',
          padding: '0 !important',
        },
        '& ._3zRJQ': { display: 'none' },
        '& ._3KcaM': { display: 'none' },
      }}
    >
      <Gantt
        tasks={tasks}
        viewMode={ViewMode[viewMode as keyof typeof ViewMode] ?? ViewMode.Week}
        viewDate={viewDate}
        locale="pt-BR"
        preStepsCount={1}
        listCellWidth="260px"
        columnWidth={columnWidth}
        rowHeight={44}
        headerHeight={48}
        ganttHeight={ganttHeight}
        barFill={88}
        barCornerRadius={5}
        todayColor="rgba(12, 101, 126, 0.08)"
        fontSize="13px"
        fontFamily="inherit"
        TooltipContent={TooltipPt}
        TaskListHeader={TaskListHeaderPt}
        TaskListTable={TaskListTablePt}
        onClick={(task) => {
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          onSelect(task.id);
        }}
        onDoubleClick={(task) => {
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          onSelect(task.id);
        }}
      />
    </Box>
  );
}
