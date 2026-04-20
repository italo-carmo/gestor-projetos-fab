import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

function walk(dirPath) {
  const abs = path.join(repoRoot, dirPath);
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(relative));
      continue;
    }
    files.push(relative);
  }
  return files;
}

function extractQuotedStrings(raw) {
  const matches = raw.match(/"([^"]+)"|'([^']+)'/g) ?? [];
  return matches
    .map((item) => item.slice(1, -1))
    .map((item) => item.trim())
    .filter(Boolean);
}

const appSource = read('frontend/src/App.tsx');
const appShellSource = read('frontend/src/layouts/AppShell.tsx');
const matrixMetaSource = read('frontend/src/app/permissionMatrixMeta.ts');

const routeBlockRegex = /<Route\s+path="([^"]+)"[\s\S]*?\/\>/g;
const appRoutes = [];
for (const match of appSource.matchAll(routeBlockRegex)) {
  appRoutes.push({ path: match[1], block: match[0] });
}

const navRouteRegex = /to:\s*"([^"]+)"/g;
const navRoutes = Array.from(appShellSource.matchAll(navRouteRegex)).map(
  (match) => match[1],
);

const resourceKeyRegex = /^\s{2}([a-zA-Z0-9_]+):\s*\{/gm;
const metaResources = Array.from(matrixMetaSource.matchAll(resourceKeyRegex)).map(
  (match) => match[1],
);

const routeValueRegex = /route:\s*"([^"]+)"/g;
const routesFromMeta = Array.from(matrixMetaSource.matchAll(routeValueRegex)).map(
  (match) => match[1],
);

const routeAliasesRegex = /routeAliases:\s*\[([^\]]*)\]/g;
const routeAliasesFromMeta = Array.from(
  matrixMetaSource.matchAll(routeAliasesRegex),
).flatMap((match) => extractQuotedStrings(match[1]));

const coveredRoutes = new Set([...routesFromMeta, ...routeAliasesFromMeta]);
const metaResourceSet = new Set(metaResources);

const ignoredRoutes = new Set([
  '/',
  '/*',
  '*',
  '/login',
  '/2fa-setup',
  '/dashboard/national',
  '/dashboard/executive',
  '/admin',
]);

const unguardedRouteAllowlist = new Set([
  '/',
  '/*',
  '*',
  '/login',
  '/2fa-setup',
  '/dashboard/national',
  '/dashboard/executive',
  '/admin/localities',
  '/admin/localidades',
  '/admin/localities-cipavd',
  '/admin/localidades-cipavd',
  '/admin/postos',
  '/admin/phases',
  '/admin/elo-roles',
]);

const missingRouteCoverage = [
  ...new Set([...appRoutes.map((item) => item.path), ...navRoutes]),
]
  .filter((routePath) => !ignoredRoutes.has(routePath))
  .filter((routePath) => !coveredRoutes.has(routePath))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

const unguardedRoutes = appRoutes
  .filter(({ path: routePath }) => !unguardedRouteAllowlist.has(routePath))
  .filter(({ block }) => !block.includes('RequireRoleAccess'))
  .filter(({ block }) => !block.includes('Navigate'))
  .filter(({ block }) => !block.includes('NotFoundPage'))
  .map(({ path: routePath }) => routePath)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

const backendFiles = walk('backend/src').filter((file) => file.endsWith('.ts'));
const declaredResources = new Set();
for (const file of backendFiles) {
  const source = read(file);
  for (const match of source.matchAll(/@RequirePermission\(\s*['"]([^'"]+)['"]/g)) {
    declaredResources.add(match[1]);
  }
}

const missingMetaResources = Array.from(declaredResources)
  .filter((resource) => !metaResourceSet.has(resource))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

const errors = [];
if (missingRouteCoverage.length > 0) {
  errors.push(
    [
      'Rotas/telas sem cobertura em permissionMatrixMeta.ts:',
      ...missingRouteCoverage.map((item) => `- ${item}`),
    ].join('\n'),
  );
}
if (unguardedRoutes.length > 0) {
  errors.push(
    [
      'Rotas protegidas sem RequireRoleAccess explícito em App.tsx:',
      ...unguardedRoutes.map((item) => `- ${item}`),
    ].join('\n'),
  );
}
if (missingMetaResources.length > 0) {
  errors.push(
    [
      'Recursos declarados com @RequirePermission sem metadado explícito na matriz:',
      ...missingMetaResources.map((item) => `- ${item}`),
    ].join('\n'),
  );
}

if (errors.length > 0) {
  console.error(errors.join('\n\n'));
  process.exit(1);
}

console.log('Permission matrix coverage OK.');
console.log(`- Rotas verificadas: ${appRoutes.length}`);
console.log(`- Itens de menu verificados: ${navRoutes.length}`);
console.log(`- Recursos RBAC com metadado explícito: ${metaResources.length}`);
