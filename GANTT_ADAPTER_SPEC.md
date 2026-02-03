# GANTT_ADAPTER_SPEC — Conversão TaskInstance → Gantt

Lib sugerida: `gantt-task-react` (ou similar).

## Entrada (API)
`GET /task-instances/gantt?localityId=&from=&to=&phaseId=&status=` retorna TaskInstances com:
- id, title, localityName, phaseName, dueDate, progressPercent, status, isLate, blockedByIds

## Conversão (regras)
- `start` = `dueDate - defaultDurationDays` (default 7 dias)
- `end` = `dueDate`
- `name` = `[Fase] título — Localidade`
- `progress` = progressPercent
- `type` = "task"
- `isDisabled` = (blockedByIds não resolvidas) opcional
- `styles` = pode mapear cor por status (opcional; MUI já resolve via chips)

Clique na barra:
- abre `TaskDetailsDrawer(taskInstanceId)`
