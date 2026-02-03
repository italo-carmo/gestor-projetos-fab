# DOMAIN_TASKS — Núcleo de Gestão de Projetos (Fonte de Verdade)

Este documento “fecha” as regras do core (Fases → Tarefas → Prazos → Responsáveis → Progresso → Gantt/Calendário),
para reduzir decisões abertas durante a geração pelo Codex.

## 0) Definições
- **Fase (Phase)**: agrupador ordenado de tarefas (ex.: PREPARACAO, EXECUCAO, ACOMPANHAMENTO).
- **TaskTemplate**: definição “global” da tarefa (título, descrição, fase, especialidade opcional, regras padrão).
- **TaskInstance**: instância criada para uma **Localidade** (com `dueDate`, status, responsável, progresso).
- **Projeto por Localidade**: conjunto de TaskInstances (de várias fases) daquela localidade.
- **Admin de andamento**: perfis que podem ajustar status/progresso/atribuição dentro de seus escopos (RBAC).

## 1) Status e regras (fonte de verdade)
### 1.1 Status possíveis
- NOT_STARTED
- STARTED
- IN_PROGRESS
- BLOCKED
- LATE (calculado/derivado — ver regra)
- DONE

### 1.2 Regra de atraso (LATE)
Uma TaskInstance é **considerada LATE** quando:
- `now > dueDate` **e**
- `status != DONE`

**Implementação recomendada**
- Persistir `status` sem LATE (status “real”) e expor `isLate` derivado; **OU**
- Permitir `status=LATE` apenas como “auto-flag” no retorno (não editável manualmente).
> Para simplificar no MVP, mantenha `status` editável e compute `isLate` no backend; no frontend, exiba chip “Atrasada” quando `isLate=true`.

### 1.3 Regra de conclusão com relatório obrigatório
Se `reportRequired=true` em TaskInstance:
- Não pode mudar para DONE se **não existir pelo menos 1 Report** anexado.

Caso viole:
- Backend retorna **409 REPORT_REQUIRED**.

### 1.4 Progresso (%)
Campo: `progressPercent` (0–100)
Regras:
- Se `status=NOT_STARTED` => `progressPercent` deve ser 0 (backend corrige).
- Se `status=DONE` => `progressPercent` deve ser 100 (backend corrige).
- Caso contrário, `progressPercent` pode ser 0–99.
- `progressPercent` é **manual** (MVP). Futuro: derivado por checklist/subtarefas.

### 1.5 Bloqueio / dependência (MVP)
Campo: `blockedByIds` (array de ids TaskInstance) opcional.
- Se houver itens em `blockedByIds` que ainda não estejam DONE, a task é “bloqueada”.
- Frontend mostra chip BLOCKED e motivo (tarefas que bloqueiam).
- Backend pode impedir `status=IN_PROGRESS` quando bloqueada (opcional no MVP).

## 2) Cálculo de progresso do Projeto (Localidade)
### 2.1 Progresso por Fase (localidade)
Para uma localidade L e uma fase P:
- `phaseProgress(L,P) = average(progressPercent das tasks de P em L)`

Opcional (se quiser mais “gerencial”):
- Ponderar por prioridade: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1.

### 2.2 Progresso geral da Localidade
- `localityProgress(L) = average(phaseProgress(L, cada fase))`
- Se fase não tiver tasks para aquela localidade, ignorar na média.

## 3) Gantt e Calendário (conversões)
### 3.1 Gantt (task bars)
Cada TaskInstance deve renderizar uma barra com:
- `start`: por padrão `dueDate - defaultDurationDays` (ex.: 7 dias)
- `end`: `dueDate`
- `progress`: `progressPercent`
- `name`: título + localidade

> Se você optar por adicionar `startDate` futuramente, use ela como fonte de verdade.

### 3.2 Calendário anual
Cada TaskInstance vira um evento:
- `date`: `dueDate`
- `title`: `[Fase] Título`
- Ao clicar: abrir Drawer de detalhes da tarefa.

## 4) Relação com reuniões
- TaskInstance pode ter `meetingId` nulo (tarefa fora de reunião).
- Ao gerar tarefas de uma reunião, o `meetingId` deve ser preenchido nas instâncias geradas.

## 5) Atribuição de responsável
- `assignedToId` pode ser nulo (sem responsável).
- Dashboards devem destacar “Sem responsável” como risco.

## 6) Auditoria mínima (core)
Registrar AuditLog em:
- create/update/delete de TaskTemplate
- create (geração em lote) de TaskInstances
- mudanças de status/progresso/assignee/dueDate
- upload/approve de Report

## 7) MVP: o que não entra (por enquanto)
- Subtarefas, estimativas complexas, carga de trabalho por pessoa
- Dependências avançadas (FS/SS/FF, buffers)
- Notificações push/email (pode vir depois)
