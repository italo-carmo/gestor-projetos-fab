# Deploy em Producao (Sem Docker)

Este guia registra o fluxo padrao para publicar novas versoes no servidor de producao via `git pull`, mantendo o stack ja instalado.

## Servidor
- Host: `172.16.31.178`
- Usuario: `root`
- Repositorio principal: `/home/sddm/gestor-projetos-fab`

## 1) Conectar e atualizar codigo

```bash
ssh root@172.16.31.178
cd /home/sddm/gestor-projetos-fab
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
```

Valide se o hash retornado e o commit esperado da release.

## 2) Instalar dependencias e aplicar banco

```bash
cd /home/sddm/gestor-projetos-fab
npm install --workspaces

cd backend
npx prisma migrate deploy
npm run build
```

## 3) Build do frontend

```bash
cd /home/sddm/gestor-projetos-fab/frontend
npm install
npm run build
```

## 4) Reiniciar servicos

Descubra os nomes reais dos servicos:

```bash
systemctl list-units --type=service --no-pager | egrep -i 'gestao|smif|cipav|backend|frontend|nginx'
```

Reinicie os servicos encontrados (exemplo):

```bash
systemctl restart <SERVICO_BACKEND>
systemctl restart <SERVICO_FRONTEND>
systemctl restart nginx
```

## 5) Validacao pos-deploy

```bash
curl -i http://127.0.0.1:3000/health
```

Verificar se nao ficou URL fixa de API em localhost no build do frontend:

```bash
grep -R "localhost:3000" -n /home/sddm/gestor-projetos-fab/frontend/dist || true
```

Esperado: sem referencias validas para producao.

## Observacoes importantes
- O frontend deve usar `VITE_API_BASE_URL=/api` em producao.
- Se o deploy efetivo estiver sendo servido por `/opt/gestao-projetos`, sincronizar esse caminho antes do restart.
- Em caso de falha de migration, nao seguir para restart antes de corrigir o banco.
