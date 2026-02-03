# FRONTEND_COMPONENT_REQUIREMENTS — Regras obrigatórias de UI (para o Codex)

1) **Edição em Drawer (EntityDrawer)**: listas nunca navegam para uma página “/edit”; tudo abre Drawer à direita.
2) **FiltersBar padrão** em todas as listas (Tasks, Meetings, Localities…).
3) **States padrão**: Skeleton, EmptyState, ErrorState com retry.
4) **StatusChip** único (mapeamento central).
5) **Toasts**: sucesso/erro para toda mutação.
6) **Permissões UI**: ocultar ações sem permissão (mas backend é fonte de verdade).
7) **Gantt/Calendar**: clique em item sempre abre TaskDetailsDrawer.
8) **Atalhos de andamento**: botões rápidos no Drawer (Iniciar → IN_PROGRESS, Bloquear → BLOCKED, Concluir → DONE).
9) **Optimistic updates** para status/progresso/assignee (com rollback em erro).
10) **Executive mode**: se flag `executive_hide_pii` true, ocultar nome/email/telefone em toda UI (mostrar apenas agregados).
