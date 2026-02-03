# UI_COMPONENTS — Padrões e componentes (React/MUI)

## Theme
- Palette azul/branco, fundos claros, bordas suaves.
- StatusChip: DONE=verde, IN_PROGRESS=amarelo, LATE=vermelho, NOT_STARTED=cinza, BLOCKED=cinza escuro.

## Layout
- AppBar (topo): logo, seletor de contexto (quando permitido), alertas, avatar.
- Drawer (lateral): menu condicionado por permissões.
- Padrão: listas em tabela/kanban; detalhes em Drawer à direita.

## Componentes essenciais
- `KpiCard`
- `StatusChip`
- `FiltersBar`
- `EntityDrawer`
- `ConfirmDialog`
- `EmptyState` + `SkeletonList`
- `TasksTable` + `TasksKanban`
- `PermissionMatrixGrid`
- `GanttView` (adapter -> gantt-task-react)
- `YearCalendarView` (FullCalendar)
