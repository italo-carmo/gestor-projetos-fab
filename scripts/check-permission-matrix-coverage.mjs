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
const matrixActionSetConstants = new Map(
  Array.from(
    matrixMetaSource.matchAll(/const\s+([A-Z_]+)\s*=\s*\[([^\]]*)\];/gm),
  ).map((match) => [match[1], extractQuotedStrings(match[2]).sort()]),
);

function parseResourceBlocks(source) {
  const blocks = new Map();
  const regex = /^\s{2}([a-zA-Z0-9_]+):\s*\{/gm;
  const matches = Array.from(source.matchAll(regex));
  for (let index = 0; index < matches.length; index += 1) {
    const key = matches[index][1];
    const start = matches[index].index ?? 0;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? source.length)
        : source.indexOf('\n};', start);
    const block = source.slice(start, end === -1 ? source.length : end);
    blocks.set(key, block);
  }
  return blocks;
}

const routeBlockRegex = /<Route\s+path="([^"]+)"[\s\S]*?\/\>/g;
const appRoutes = [];
for (const match of appSource.matchAll(routeBlockRegex)) {
  appRoutes.push({ path: match[1], block: match[0] });
}

const frontendPermissionUsage = new Map();
const frontendFiles = walk('frontend/src').filter((file) =>
  /\.(ts|tsx)$/.test(file),
);
for (const file of frontendFiles) {
  const source = read(file);
  for (const match of source.matchAll(
    /can\([^)]*?['"]([a-zA-Z0-9_]+)['"]\s*,\s*['"]([a-zA-Z0-9_]+)['"]/g,
  )) {
    const resource = match[1];
    const action = match[2];
    if (!frontendPermissionUsage.has(resource)) {
      frontendPermissionUsage.set(resource, new Set());
    }
    frontendPermissionUsage.get(resource).add(action);
  }
}

const navRouteRegex = /to:\s*"([^"]+)"/g;
const navRoutes = Array.from(appShellSource.matchAll(navRouteRegex)).map(
  (match) => match[1],
);

const resourceKeyRegex = /^\s{2}([a-zA-Z0-9_]+):\s*\{/gm;
const metaResources = Array.from(matrixMetaSource.matchAll(resourceKeyRegex)).map(
  (match) => match[1],
);
const metaResourceBlocks = parseResourceBlocks(matrixMetaSource);

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
const expectedActionsByResource = new Map(
  Array.from(metaResourceBlocks.entries()).flatMap(([resource, block]) => {
    const inlineMatch = block.match(/expectedActions:\s*\[([^\]]*)\]/m);
    if (inlineMatch) {
      return [[resource, extractQuotedStrings(inlineMatch[1]).sort()]];
    }
    const refMatch = block.match(/expectedActions:\s*([A-Z_]+)/m);
    if (refMatch) {
      return [[resource, matrixActionSetConstants.get(refMatch[1]) ?? []]];
    }
    return [];
  }),
);

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
const declaredActionsByResource = new Map();
for (const file of backendFiles) {
  const source = read(file);
  for (const match of source.matchAll(
    /@RequirePermission\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g,
  )) {
    const resource = match[1];
    const action = match[2];
    declaredResources.add(resource);
    if (!declaredActionsByResource.has(resource)) {
      declaredActionsByResource.set(resource, new Set());
    }
    declaredActionsByResource.get(resource).add(action);
  }
}

const missingMetaResources = Array.from(declaredResources)
  .filter((resource) => !metaResourceSet.has(resource))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

const frontendOnlyResourcesWithoutMeta = Array.from(frontendPermissionUsage.keys())
  .filter((resource) => !metaResourceSet.has(resource))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

const frontendUsageMissingInContract = Array.from(frontendPermissionUsage.entries())
  .filter(([resource]) => expectedActionsByResource.has(resource))
  .map(([resource, actions]) => {
    const expected = expectedActionsByResource.get(resource) ?? [];
    const missing = Array.from(actions).sort().filter((action) => !expected.includes(action));
    return { resource, missing };
  })
  .filter((item) => item.missing.length > 0)
  .sort((a, b) => a.resource.localeCompare(b.resource, 'pt-BR'));

const frontendUsageMissingInBackend = Array.from(frontendPermissionUsage.entries())
  .map(([resource, actions]) => {
    const declared = Array.from(declaredActionsByResource.get(resource) ?? []).sort();
    const missing = Array.from(actions).sort().filter((action) => !declared.includes(action));
    return { resource, missing };
  })
  .filter((item) => item.missing.length > 0)
  .sort((a, b) => a.resource.localeCompare(b.resource, 'pt-BR'));

const missingExpectedActionContracts = Array.from(declaredResources)
  .filter((resource) => metaResourceSet.has(resource))
  .filter((resource) => !expectedActionsByResource.has(resource))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

const actionContractMismatches = Array.from(declaredResources)
  .filter((resource) => expectedActionsByResource.has(resource))
  .map((resource) => {
    const expected = expectedActionsByResource.get(resource) ?? [];
    const declared = Array.from(declaredActionsByResource.get(resource) ?? []).sort();
    const missingInMeta = declared.filter((action) => !expected.includes(action));
    const missingInBackend = expected.filter((action) => !declared.includes(action));
    return {
      resource,
      missingInMeta,
      missingInBackend,
    };
  })
  .filter((item) => item.missingInMeta.length > 0 || item.missingInBackend.length > 0)
  .sort((a, b) => a.resource.localeCompare(b.resource, 'pt-BR'));

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
if (frontendOnlyResourcesWithoutMeta.length > 0) {
  errors.push(
    [
      'Permissões usadas no frontend sem metadado explícito na matriz:',
      ...frontendOnlyResourcesWithoutMeta.map((item) => `- ${item}`),
    ].join('\n'),
  );
}
if (missingExpectedActionContracts.length > 0) {
  errors.push(
    [
      'Recursos RBAC com metadado na matriz, mas sem contrato expectedActions explícito:',
      ...missingExpectedActionContracts.map((item) => `- ${item}`),
    ].join('\n'),
  );
}
if (frontendUsageMissingInContract.length > 0) {
  errors.push(
    [
      'Permissões usadas no frontend fora do contrato expectedActions da matriz:',
      ...frontendUsageMissingInContract.flatMap((item) => [
        `- ${item.resource}`,
        `  - faltando no contrato: ${item.missing.join(', ')}`,
      ]),
    ].join('\n'),
  );
}
if (frontendUsageMissingInBackend.length > 0) {
  errors.push(
    [
      'Permissões usadas no frontend sem declaração correspondente no backend:',
      ...frontendUsageMissingInBackend.flatMap((item) => [
        `- ${item.resource}`,
        `  - faltando no backend: ${item.missing.join(', ')}`,
      ]),
    ].join('\n'),
  );
}
if (actionContractMismatches.length > 0) {
  errors.push(
    [
      'Ações esperadas na matriz divergentes do backend:',
      ...actionContractMismatches.flatMap((item) => {
        const lines = [`- ${item.resource}`];
        if (item.missingInMeta.length > 0) {
          lines.push(`  - faltando na matriz: ${item.missingInMeta.join(', ')}`);
        }
        if (item.missingInBackend.length > 0) {
          lines.push(`  - faltando no backend: ${item.missingInBackend.join(', ')}`);
        }
        return lines;
      }),
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
console.log(`- Recursos RBAC com contrato de ações: ${expectedActionsByResource.size}`);
console.log(`- Recursos de permissão usados no frontend: ${frontendPermissionUsage.size}`);
