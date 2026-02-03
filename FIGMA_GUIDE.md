# FIGMA_GUIDE — Guia de Design System (SMIF Gestão)

Este guia serve para replicar um visual **moderno, fluido, profissional**, com identidade **azul e branco** (FAB).  
Use como “tokens” para Figma e como referência para a UI do React/MUI.

## 1) Paleta (tokens)
> Você pode ajustar para a cor oficial que o COMGEP/CIPAVD preferir. Aqui vai uma base segura.

### Brand
- `brand.700` (Primário): Azul institucional (ex.: #0B3D91)
- `brand.600`: Azul médio
- `brand.100`: Azul claro (hover/background)
- `brand.contrast`: Branco

### Neutros
- `neutral.900`: textos (quase preto)
- `neutral.700`: texto secundário
- `neutral.200`: bordas/divisórias
- `neutral.50`: fundo de páginas

### Status
- `status.success`: DONE
- `status.warning`: IN_PROGRESS
- `status.error`: LATE
- `status.muted`: NOT_STARTED
- `status.blocked`: BLOCKED

## 2) Tipografia
- Família: Inter (ou Roboto no MUI default)
- H1: 28–32 / bold
- H2: 22–24 / semibold
- Body: 14–16
- Caption: 12

## 3) Grid & Spacing
- Base spacing: 8px
- Container: 1200–1440px (desktop)
- Cards: padding 16–20, radius 12, shadow suave

## 4) Componentes principais
### 4.1 AppShell
- **TopBar** fixo: logo + título do sistema + seletor contexto (quando permitido) + alertas + perfil
- **Drawer**: menu por permissões, ícones + labels, estado colapsado

### 4.2 Dashboard Cards
- `KpiCard` com label, valor, unidade, tendência
- `InsightCard` com texto e callout

### 4.3 Tabelas e Listas
- Header sticky
- Coluna Status com `StatusChip`
- Ações em kebab menu (⋮), respeitando permissões

### 4.4 EntityDrawer (padrão ouro)
- Abre à direita (width 480–560)
- Header com título + ações (Salvar/Cancelar)
- Tabs: Detalhes / Histórico / Anexos (quando aplicável)

### 4.5 Kanban
- Colunas por status
- Card com: título, localidade, prazo, chip prioridade, responsável

### 4.6 Quadro de Avisos
- Visual post-it com colunas por especialidade
- Aviso com `dueDate` mostra chip “vence em X dias”

### 4.7 Gantt + Calendário
- Gantt: clique abre drawer de tarefa
- Calendário anual: abre em “hoje”, clique abre drawer

## 5) Microinterações
- Toasts (snackbar) para sucesso/erro
- Skeleton em load
- Empty state com CTA (quando permissão permitir criar)

## 6) Acessibilidade
- Contraste mínimo AA
- Tooltips para ícones
- Focus outline visível
- Teclas: ESC fecha drawer/modal

## 7) Iconografia
- Use Material Icons (outlined), padrão corporativo.
- Ícones por módulo:
  - Dashboard: `dashboard`
  - Reuniões: `event`
  - Tarefas: `checklist`
  - Avisos: `campaign`
  - Checklists: `fact_check`
  - KPIs: `analytics`
  - Admin: `admin_panel_settings`
