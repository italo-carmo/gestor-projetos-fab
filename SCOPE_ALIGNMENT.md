# Alinhamento de Escopo — SMIF Gestão

## Contexto do Projeto
Sistema web para gerenciamento da **Comissão de Iniciação de Recrutamento Feminino da FAB**, com foco em acompanhamento de tarefas, prevenção de assédio moral/sexual e monitoramento por localidade (GSD/Comando).

---

## Mapeamento: Demandas × Estado Atual

### 1. Painel de Informações Gerais (Indicadores de Desempenho)
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| COBERTURA (8/8 localidades) | Dashboard nacional tem lista de localidades | ✅ Existe. Adicionar card KPI visual com ícone |
| ALCANCE (recrutas femininas) | `Locality.recruitsFemaleCountCurrent`, `RecruitsHistory` | ✅ Dados existem. Agregar no frontend |
| RELATÓRIOS (produzidos) | Executive dashboard tem `reportsCompliance` | ✅ Existe. Expor no nacional |
| SATISFAÇÃO | KPIs service existe | ⚠️ Backend tem estrutura. Usar KPI ou placeholder |
| Tabela: FASE, INDICADOR, META, REALIZADO, % CONCLUSÃO, STATUS, CIDADES | Tarefas por fase existem | ⚠️ META/REALIZADO precisam de agregados por template+fase. Derivar de task templates + instances |

### 2. Painel de Reuniões
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Data, horário, participantes, escopo, status visual | MeetingsPage tem cards e calendário | ⚠️ Adicionar chips de status coloridos (Concluída/Planejada/Cancelada) |
| Status em cor visual | Status como texto | Implementar legenda e cores por status |

### 3. Painel de Tarefas
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Descrição, responsável, prazo, status | ✅ TasksPage com DataGrid, TaskDetailsDrawer | Completo |
| Relacionar com reunião ou não | `TaskInstance.meetingId` no schema | ✅ Existe |
| Barrinha de andamento | ProgressInline existe | ✅ Completo |

### 4. Quadro de Avisos (Post-its)
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Visual tipo post-it | NoticesPage em cards | ⚠️ Redesenhar como post-its (cantos dobrados, cores por prioridade) |
| Por grupo: Coordenação, Psicologia, SSO, Jurídico, Doutrina, Comunicação | `Notice.specialtyId` existe | ✅ Filtrar por especialidade. Especialidades no seed batem |
| Prazos, to-dos | `dueDate`, `priority` existem | ✅ Completo |

### 5. Painel de Comando (GSD/Comando)
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| # recrutas femininas | `Locality.recruitsFemaleCountCurrent` | ✅ Existe |
| Comandante | `Locality.commanderName` | ✅ Existe |
| Data da visita | `Locality.visitDate` | ✅ Existe |
| Visão por GSD | Dashboard locality + listagem | ⚠️ Criar view "Painel de Comando" com tabela GSD → recrutas, comandante, visita |

### 6. Matriz de Elos
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| ELO Psicologia, SSO, Jurídico, CPCA, Graduado Master | Elo.roleType: PSICOLOGIA, SSO, JURIDICO, CPCA, GRAD_MASTER | ✅ Schema correto |
| Nome, telefone, email por localidade | ElosPage com CRUD | ✅ Completo |
| Visual em matriz (localidade × tipo) | Tabela/listagem | ⚠️ Melhorar para grid localidade × tipo de elo |

### 7. Painéis de Controle por Localidade
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Tarefas: nome, fase, foco, data, responsável, status, relatório | DashboardLocalityPage + TasksPage | ✅ Existe. Reforçar coluna "Relatório" |
| Barrinha de andamento | ProgressInline | ✅ Completo |
| Histórico recrutas/turnover | RecruitsHistory | ⚠️ Adicionar gráfico de recrutas por data na locality |
| Cronograma por cidade | Tasks com dueDate por locality | ✅ Completo |

### 8. Cronograma Visual (Calendário)
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Ano todo, abrir no hoje | YearCalendarView | ✅ Implementado |
| Clicar nas tarefas | onSelect → TaskDetailsDrawer | ✅ Completo |

### 9. Checklist por Fase
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Ver progresso por fase | ChecklistsPage com tab "Por fase" | ✅ Existe |
| Quais cidades cumpriram | Checklist items por locality | ✅ Dados existem. Melhorar visual (grid localidades × itens) |
| Visual inspirado (FASE 1/2/3, barra progresso, riscos) | Layout básico | ⚠️ Redesenhar com header de fase, progresso, painel riscos |

### 10. Checklist por Especialidade
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Administrador da especialidade vê Brasil | ChecklistsPage tab "Por especialidade" | ✅ Existe |
| Tarefas inseridas para todas ou eletivo | TaskTemplate.appliesToAllLocalities | ✅ Existe |

### 11. Organograma
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Equipe: função, nome, área, OM, telefone, email | OrgChartPage | ✅ Existe. Verificar campos |

### 12. Upload de Relatório
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Após cada tarefa, unidade faz upload | TaskDetailsDrawer + useUploadReport | ✅ Completo |

### 13. RBAC e Comandante COMGEP
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Perfis específicos | Roles, permissions | ✅ Completo |
| Comandante COMGEP vê indicadores | executive_hide_pii, dashboard executive | ✅ Existe |

### 14. Layout FAB (azul e branco)
| Demanda | Estado Atual | Gap |
|---------|--------------|-----|
| Moderno, fluido, profissional | Theme com #0B4DA1 | ✅ Base existe. Refinar bordas, espaçamentos, tipografia |

---

## Plano de Implementação (Prioridade)

### Fase 1 — Alinhamento Visual (curto prazo)
1. **Dashboard Nacional**: KPIs em cards coloridos (Cobertura, Alcance, Relatórios, Satisfação); tabela inspirada em indicadores
2. **Quadro de Avisos**: Visual post-it, filtro por especialidade em destaque
3. **Checklist por Fase**: Header de fase com número, barra de progresso, painel de riscos
4. **Painel de Comando**: Nova view ou aba com tabela GSD → recrutas, comandante, visita

### Fase 2 — Dados e Agregados
1. Endpoint ou extensão para agregar META/REALIZADO por fase+indicador (task templates + instances)
2. Gráfico de histórico de recrutas/turnover no painel da localidade
3. Expor reports count no dashboard nacional (ou usar executive)

### Fase 3 — Refinamentos
1. Matriz de Elos em grid localidade × tipo
2. Reuniões com status visual (chips coloridos)
3. Ajustes finos de UX (breadcrumbs, estados vazios, confirmações)
