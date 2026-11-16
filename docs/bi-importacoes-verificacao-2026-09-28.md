# Verificação das importações de pesquisas — 28/09/2026

Correções aplicadas no código local e no runtime de produção em `/opt/gestao-projetos`.

| Pesquisa | Origem usada pelo painel | Respostas após a verificação |
| --- | --- | ---: |
| Violência Doméstica | API Google Sheets | 1.443 |
| Recrutas | API Google Sheets | 1.368 |
| Ciclo de Boas Práticas | API Google Sheets | 111 |
| Encontro CPCA | API Google Sheets | 230 |
| Escolas | CSV/XLSX | 574 |
| Avaliação GSD | CSV/XLSX | 5 |

O CPCA tinha 96 respostas pendentes; foram importadas incrementalmente, com zero duplicados e zero inválidos. As consultas finais às quatro APIs indicaram zero registros pendentes. As bases de Escolas e Avaliação GSD não foram substituídas: os fluxos de arquivo foram verificados com dados fictícios.

## Problemas corrigidos

- Consultas sem nova tentativa após falhas temporárias. As quatro APIs agora compartilham uma leitura com até duas tentativas, mantendo o timeout durante o download do JSON.
- HTTP 404 intermitente do Apps Script: observado em produção após uma importação bem-sucedida; a repetição da mesma consulta retornou HTTP 200. A leitura repete uma vez o endereço original quando esse erro vem de uma integração em `script.google.com`.
- Falhas e consultas vazias com retorno pouco visível: os seis painéis agora mantêm o resultado junto ao botão. Uma consulta sem novidades também atualiza os totais, respostas e histórico exibidos.
- Alteração do arquivo ou modo de substituição enquanto uma prévia está sendo utilizada: os controles relevantes ficam bloqueados durante o fluxo.
- Exclusão da base antiga antes de concluir a nova gravação: exclusão, criação do lote e inserção das respostas passam a ocorrer na mesma transação.
- Arquivos vazios e substituições com linhas inválidas são rejeitados antes de alterar a base. Registros inválidos de API também interrompem a importação, evitando avançar o cursor sobre respostas não interpretadas.
- CSV de Escolas com acentos: o leitor agora trata explicitamente UTF-8. O próprio template publicado passou a ser aceito.

## Validação

- Backend: 50 testes cobrindo templates CSV/XLSX das seis pesquisas, transações, registros inválidos, paginação, timeouts e novas tentativas.
- Frontend: 11 testes de mensagens e modos de importação.
- Navegador: seis fluxos com APIs simuladas e dados fictícios, incluindo clique, retorno vazio, erro, confirmação e atualização do painel.
- Compilação do backend e verificação TypeScript do frontend aprovadas; bundles compilados em produção.
- Conferência em produção por serviço: importação CPCA e leitura das quatro APIs, sem exibir respostas individuais ou credenciais.

Testes de regressão: `backend/src/bi/bi-imports.spec.ts`, `backend/src/bi/bi-api-fetch.spec.ts`, `backend/src/bi/bi-domestic-violence.service.spec.ts`, `backend/src/bi/bi-recruits.service.spec.ts`, `frontend/src/app/apiErrors.test.ts` e `e2e/bi-imports.spec.ts`.

Backup anterior à publicação principal: `/var/tmp/bi-import-audit-backup.f7lQN4/runtime.tgz` no servidor de produção. O ajuste adicional para HTTP 404 possui backup próprio em `/var/tmp/bi-google-retry-backup.*`.
