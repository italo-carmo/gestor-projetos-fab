# UX_RULES — Fluidez e microinterações (padrões)

- **Foco em ação**: usuário deve conseguir mudar status e atribuir responsável em 2 cliques.
- **Risco visível**: destaque automático para (Atrasadas, Bloqueadas, Sem responsável).
- **Vence em X dias**: badge calculado no frontend a partir do dueDate.
- **Atualização otimista**: status/progresso muda na hora, com snackbar de erro se falhar.
- **Paginação server-side** nas listas grandes.
- **Busca com debounce 300ms** (TanStack Query).
- **Abertura no “Hoje”**: calendário rola para mês atual e evidencia dia atual.
- **Persistir filtros** em querystring: copiar/colar URL mantém filtros.
