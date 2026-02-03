# CALENDAR_ADAPTER_SPEC — Conversão TaskInstance → FullCalendar

Lib sugerida: `@fullcalendar/react` + month grid. Para “ano inteiro”:
- usar 12 months grid (component custom) ou plugins e paginação por mês com navegação rápida.
- MVP: renderizar um calendário mensal com navegação e botão “Ano” que lista meses.

## Evento
- `id` = taskInstanceId
- `title` = `[Fase] título`
- `start` = dueDate (date)
- `allDay` = true
- `extendedProps`: { taskInstanceId, status, progressPercent, isLate, localityId }

Clique:
- abre Drawer de tarefa.
