# SEED_ROLES_SUGGESTION — Papéis e permissões iniciais (sugestão)

> TI poderá ajustar tudo depois via Matriz RBAC.

## TI
- Acesso total NATIONAL + auditoria

## Coordenação CIPAVD
- Gestão nacional: meetings, task_templates, task_instances, notices, checklists, kpis, elos, org
- reports: view/download NATIONAL, approve (opcional)

## GSD Localidade
- tasks: view/update/assign LOCALITY
- reports: upload/download LOCALITY
- notices: view/create/update LOCALITY
- elos: view/update LOCALITY
- checklists: view/update status LOCALITY

## Admin Especialidade Local (Localidade+Especialidade)
- tasks: view/update LOCALITY_SPECIALTY
- reports: upload/download LOCALITY_SPECIALTY
- notices: view/create/update LOCALITY_SPECIALTY
- checklists: view/update status LOCALITY_SPECIALTY

## COMGEP (Executivo)
- dashboards/kpis: view/export NATIONAL (visibility EXECUTIVE)
- tasks: view agregada NATIONAL sem PII
