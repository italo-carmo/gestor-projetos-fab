# WIREFRAMES_TASK_CORE — Wireframes (foco no core)

## 1) /tasks (Tabela + Kanban)
[TopBar]  CIPAVD Gestão | Contexto | Perfil
[Drawer]  Dashboard | Tarefas | Gantt | Calendário | Reuniões | (Admin...)

[Header] Tarefas
[FiltersBar] (Busca q) (Localidade) (Fase) (Status) (Responsável) (De/Até prazo) [Limpar]

[Tabs]  (Tabela) (Kanban)

[Tabela]
| Título | Localidade | Fase | Prazo | Responsável | Status | Progresso | Ações |
- Clique na linha abre Drawer (direita)

[Drawer: TaskDetails]
- Título + (chips: Fase, Prioridade, Atrasada?)
- Campos: Status (select), Progresso (slider), Prazo (date), Responsável (autocomplete)
- Se reportRequired: área Anexos com Upload + lista
- Aba Histórico (Audit) em timeline
- Botões: Salvar | Marcar como DONE (valida report)

## 2) /gantt
[Header] Cronograma (Gantt)
[FiltersBar] (Ano) (Localidade) (Fase) (Status)
[Gantt]
- Clique na barra -> abre TaskDetailsDrawer

## 3) /dashboard/national
[Header] Visão Brasil
[Row: KPI cards] Progresso médio | Tarefas atrasadas | Sem responsável | Bloqueadas | Turnover
[Table: Localidades]
| Localidade | % Geral | % Preparação | % Execução | % Acomp. | Atrasadas | Sem resp. | Visita | Abrir |
- Clique em Abrir -> /dashboard/locality/:id

## 4) /dashboard/locality/:id
[Header] Localidade X (comandante, visita, recrutas atuais)
[Progress] Barra Geral + barras por fase
[Lista curta] Próximas tarefas (ordenar por prazo) + Atrasadas + Sem responsável
