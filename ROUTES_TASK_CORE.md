# ROUTES_TASK_CORE — Mapa de Rotas (foco tarefas/fases/andamento)

| Rota | Quem usa | Objetivo | Endpoints | Componentes obrigatórios |
|---|---|---|---|---|
| /dashboard/national | Coordenação, TI, COMGEP | Visão geral Brasil (progresso por localidade, riscos, tendências) | GET /dashboard/national, GET /localities, GET /task-instances | KpiCard, RiskList, LocalitiesProgressTable |
| /dashboard/locality/:id | GSD, Admin Local | Painel da localidade (progresso geral + por fase + tarefas críticas) | GET /localities/:id/progress, GET /task-instances?localityId= | LocalityHeader, PhaseProgressBars, TasksTableMini |
| /tasks | Todos (por escopo) | Gestão de tarefas (tabela + kanban) | GET /task-instances, PUT status/assign/progress | FiltersBar, TasksTable, TasksKanban, TaskDetailsDrawer |
| /gantt | Todos (por escopo) | Cronograma visual (Gantt) | GET /task-instances/gantt | GanttView + TaskDetailsDrawer |
| /calendar | Todos (por escopo) | Calendário anual (abre no hoje) | GET /task-instances/calendar?year= | YearCalendarView + TaskDetailsDrawer |
| /meetings | Coordenação, GSD | Reuniões e geração de tarefas | CRUD /meetings + /generate-tasks | MeetingsList, MeetingDrawer, GenerateTasksModal |
| /admin/rbac | TI | Matriz RBAC (import/export + clone role) | /roles, /permissions, /roles/:id/permissions | PermissionMatrixGrid |
