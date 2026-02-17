# Migração do Repositório Google Drive para o SMIF Gestão

## Objetivo
Centralizar o acervo da CIPAVD/SMIF no sistema e permitir desativar o repositório externo.

## O que foi migrado
- Fonte: `/Users/italocarmo/Downloads/Repositório`
- Arquivos importados para o acervo do sistema: **265**
- Categorias aplicadas: `Geral`, `Missões`, `Apresentações`, `Histórico`, `Pesquisas`, `SMIF`, `Identidade visual`
- Localidades cadastradas com base nos documentos reais: **24**
- Quantitativos de recrutas aplicados (SMIF 2026): BR, RJ, SP, CO, MN, GW, LS, YS
- Reuniões importadas/geradas a partir dos documentos: **3**
- Atividades criadas a partir dos cronogramas e planos reais: **33**
- Tarefas operacionais criadas para acompanhamento local por GSD e pauta de reunião: **82** instâncias
- Elos importados a partir das respostas dos GSD: **29**

## Funcionalidades implementadas no sistema
- Novo módulo de **Acervo de Documentos** (`/documents`)
  - Filtro por categoria, localidade e texto
  - Download controlado por autenticação/permissão
  - Respeito ao escopo por localidade no acesso
- Cobertura operacional por documento
  - Extração textual automática para `docx`, `xlsx`, `pptx` e `pdf`
  - Status de extração por arquivo (`Extraído`, `Parcial`, `Sem extração`)
  - Vínculos rastreáveis do documento para `atividade`, `reunião`, `elo`, `localidade` e `tarefa`
  - Endpoints de auditoria:
    - `GET /documents/coverage`
    - `GET /documents/:id/content`
- Busca global integrada ao acervo (barra superior)
- Script de carga real com reset completo da base seed
  - `npm run seed:repositorio`
- Geração de resumo da migração
  - `docs/migration-summary.json`

## Tarefas de evolução já abertas no sistema (backlog)
Foram criadas tarefas na fase de acompanhamento para viabilizar desligamento definitivo do Drive:
1. OCR e indexação textual dos documentos
2. Versionamento e trilha de alterações de arquivos
3. Fluxo formal de revisão/aprovação/publicação
4. Assinatura digital com certificado ICP-Brasil
5. Política de retenção e descarte documental

## Como refazer a migração
1. Garantir PostgreSQL ativo e `backend/.env` configurado.
2. Para extração textual de PDF, garantir `python3` com `pypdf` instalado (`python3 -m pip install --user pypdf`).
3. Executar:
   - `npm --prefix backend run prisma:generate`
   - `npm --prefix backend run prisma:migrate`
   - `npm run seed:repositorio`
4. Subir o sistema:
   - `npm run dev`

## Credenciais iniciais criadas
- Administrador: `admin@smif.local`
- TI (compatibilidade): `ti@smif.local`
- Senha padrão: `Smif@2026`

## Checklist para desligar o Google Drive
1. Validar no `/documents` que todos os documentos críticos foram localizados por categoria e localidade.
2. Validar no `/activities`, `/tasks` e `/meetings` o cronograma importado.
3. Confirmar com cada GSD local acesso ao sistema e consulta ao acervo.
4. Validar governança: perfil de quem pode editar, baixar e aprovar documentos.
5. Congelar atualização no Drive (somente leitura) por período de transição.
6. Após período de transição, desativar Drive como fonte operacional.
