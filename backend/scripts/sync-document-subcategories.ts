import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { DocumentCategory, PrismaClient } from '@prisma/client';

config({ path: path.join(__dirname, '..', '.env') });

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const repoRoot =
  process.env.REPOSITORIO_PATH ?? '/Users/italocarmo/Downloads/Repositório';

function normalize(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeRelPath(input: string) {
  return input
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPath(input: string) {
  const normalized = normalizeRelPath(input);
  if (!normalized || normalized === '.') return [];
  return normalized
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapCategory(relativePath: string): DocumentCategory {
  const norm = normalize(relativePath);
  if (norm.startsWith('1. CIPAVD - DOCUMENTOS GERAIS'))
    return DocumentCategory.GENERAL;
  if (norm.startsWith('2. APRESENTACOES - SLIDES'))
    return DocumentCategory.PRESENTATION;
  if (norm.startsWith('3. MISSOES - MANAUS')) return DocumentCategory.MISSION;
  if (norm.startsWith('4. HISTORICO - TRABALHOS REALIZADOS'))
    return DocumentCategory.HISTORY;
  if (norm.startsWith('5. PESQUISAS - DADOS')) return DocumentCategory.RESEARCH;
  if (norm.startsWith('6. IDENTIDADE VISUAL'))
    return DocumentCategory.VISUAL_IDENTITY;
  if (norm.startsWith('7. CIPAVD-SMIF')) return DocumentCategory.SMIF;
  return DocumentCategory.GENERAL;
}

function listAllDirectories(rootDir: string) {
  const result: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const abs = path.join(current, entry.name);
      result.push(abs);
      stack.push(abs);
    }
  }
  return result;
}

async function main() {
  if (!fs.existsSync(repoRoot)) {
    throw new Error(`Repositório não encontrado: ${repoRoot}`);
  }

  const existingSubcategories = await prisma.documentSubcategory.findMany({
    select: { id: true, category: true, name: true, parentId: true },
  });

  const idByKey = new Map<string, string>();
  for (const subcategory of existingSubcategories) {
    const key = `${subcategory.category}|${subcategory.parentId ?? ''}|${normalize(subcategory.name)}`;
    if (!idByKey.has(key)) idByKey.set(key, subcategory.id);
  }

  const folderIdByCategoryAndPath = new Map<string, string>();
  const ensureFolder = async (
    category: DocumentCategory,
    parentId: string | null,
    name: string,
  ) => {
    const key = `${category}|${parentId ?? ''}|${normalize(name)}`;
    const cachedId = idByKey.get(key);
    if (cachedId) return cachedId;

    const created = await prisma.documentSubcategory.create({
      data: {
        category,
        parentId,
        name: name.trim(),
      },
      select: { id: true },
    });
    idByKey.set(key, created.id);
    return created.id;
  };

  const docs = await prisma.documentAsset.findMany({
    select: { id: true, category: true, sourcePath: true, subcategoryId: true },
  });

  const relativeFolders = new Set<string>();
  for (const absFolder of listAllDirectories(repoRoot)) {
    const relative = normalizeRelPath(path.relative(repoRoot, absFolder));
    if (!relative || relative === '.') continue;
    relativeFolders.add(relative);
  }
  for (const doc of docs) {
    const sourceNorm = normalizeRelPath(doc.sourcePath);
    const dir = normalizeRelPath(path.posix.dirname(sourceNorm));
    if (!dir || dir === '.') continue;
    relativeFolders.add(dir);
  }

  const sortedFolders = Array.from(relativeFolders).sort((a, b) => {
    const depthDiff = splitPath(a).length - splitPath(b).length;
    if (depthDiff !== 0) return depthDiff;
    return a.localeCompare(b);
  });

  let createdFolders = 0;
  for (const relativeFolder of sortedFolders) {
    const parts = splitPath(relativeFolder);
    if (parts.length === 0) continue;
    const category = mapCategory(relativeFolder);

    let parentId: string | null = null;
    const pathSegments: string[] = [];
    for (const part of parts) {
      pathSegments.push(part);
      const currentPath = pathSegments.join('/');
      const mapKey = `${category}|${normalize(currentPath)}`;
      const existingId = folderIdByCategoryAndPath.get(mapKey);
      if (existingId) {
        parentId = existingId;
        continue;
      }

      const before = idByKey.size;
      const folderId = await ensureFolder(category, parentId, part);
      if (idByKey.size > before) createdFolders += 1;
      folderIdByCategoryAndPath.set(mapKey, folderId);
      parentId = folderId;
    }
  }

  let movedDocuments = 0;
  let clearedDocuments = 0;
  for (const doc of docs) {
    const sourceNorm = normalizeRelPath(doc.sourcePath);
    const dir = normalizeRelPath(path.posix.dirname(sourceNorm));
    let targetSubcategoryId: string | null = null;
    if (dir && dir !== '.') {
      const key = `${doc.category}|${normalize(dir)}`;
      targetSubcategoryId = folderIdByCategoryAndPath.get(key) ?? null;
    }

    if ((doc.subcategoryId ?? null) === targetSubcategoryId) continue;

    await prisma.documentAsset.update({
      where: { id: doc.id },
      data: { subcategoryId: targetSubcategoryId },
      select: { id: true },
    });
    if (targetSubcategoryId) movedDocuments += 1;
    else clearedDocuments += 1;
  }

  const totalFolders = await prisma.documentSubcategory.count();
  const linkedDocs = await prisma.documentAsset.count({
    where: { subcategoryId: { not: null } },
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        repoRoot,
        createdFolders,
        totalFolders,
        movedDocuments,
        clearedDocuments,
        linkedDocs,
        totalDocuments: docs.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
