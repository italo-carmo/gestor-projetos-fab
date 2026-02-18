"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = require("dotenv");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
(0, dotenv_1.config)({ path: node_path_1.default.join(__dirname, '..', '.env') });
const connectionString = process.env.DATABASE_URL ??
    'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
const prisma = new client_1.PrismaClient({ adapter });
const repoRoot = process.env.REPOSITORIO_PATH ?? '/Users/italocarmo/Downloads/Repositório';
function normalize(input) {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}
function normalizeRelPath(input) {
    return input
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function splitPath(input) {
    const normalized = normalizeRelPath(input);
    if (!normalized || normalized === '.')
        return [];
    return normalized
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean);
}
function canonicalPath(input) {
    const parts = splitPath(input);
    return parts.join('/');
}
function mapCategory(relativePath) {
    const norm = normalize(relativePath);
    if (norm.startsWith('1. CIPAVD - DOCUMENTOS GERAIS'))
        return client_1.DocumentCategory.GENERAL;
    if (norm.startsWith('2. APRESENTACOES - SLIDES'))
        return client_1.DocumentCategory.PRESENTATION;
    if (norm.startsWith('3. MISSOES - MANAUS'))
        return client_1.DocumentCategory.MISSION;
    if (norm.startsWith('4. HISTORICO - TRABALHOS REALIZADOS'))
        return client_1.DocumentCategory.HISTORY;
    if (norm.startsWith('5. PESQUISAS - DADOS'))
        return client_1.DocumentCategory.RESEARCH;
    if (norm.startsWith('6. IDENTIDADE VISUAL'))
        return client_1.DocumentCategory.VISUAL_IDENTITY;
    if (norm.startsWith('7. CIPAVD-SMIF'))
        return client_1.DocumentCategory.SMIF;
    return client_1.DocumentCategory.GENERAL;
}
function listAllDirectories(rootDir) {
    const result = [];
    const stack = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = node_fs_1.default.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const abs = node_path_1.default.join(current, entry.name);
            result.push(abs);
            stack.push(abs);
        }
    }
    return result;
}
async function main() {
    if (!node_fs_1.default.existsSync(repoRoot)) {
        throw new Error(`Repositório não encontrado: ${repoRoot}`);
    }
    const existingSubcategories = await prisma.documentSubcategory.findMany({
        select: { id: true, category: true, name: true, parentId: true },
    });
    const idByKey = new Map();
    for (const subcategory of existingSubcategories) {
        const key = `${subcategory.category}|${subcategory.parentId ?? ''}|${normalize(subcategory.name)}`;
        if (!idByKey.has(key))
            idByKey.set(key, subcategory.id);
    }
    const folderIdByCategoryAndPath = new Map();
    const ensureFolder = async (category, parentId, name) => {
        const key = `${category}|${parentId ?? ''}|${normalize(name)}`;
        const cachedId = idByKey.get(key);
        if (cachedId)
            return cachedId;
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
    const relativeFolders = new Set();
    for (const absFolder of listAllDirectories(repoRoot)) {
        const relative = canonicalPath(node_path_1.default.relative(repoRoot, absFolder));
        if (!relative || relative === '.')
            continue;
        relativeFolders.add(relative);
    }
    for (const doc of docs) {
        const sourceNorm = normalizeRelPath(doc.sourcePath);
        const dir = canonicalPath(node_path_1.default.posix.dirname(sourceNorm));
        if (!dir || dir === '.')
            continue;
        relativeFolders.add(dir);
    }
    const sortedFolders = Array.from(relativeFolders).sort((a, b) => {
        const depthDiff = splitPath(a).length - splitPath(b).length;
        if (depthDiff !== 0)
            return depthDiff;
        return a.localeCompare(b);
    });
    let createdFolders = 0;
    for (const relativeFolder of sortedFolders) {
        const parts = splitPath(relativeFolder);
        if (parts.length === 0)
            continue;
        const category = mapCategory(relativeFolder);
        let parentId = null;
        const pathSegments = [];
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
            if (idByKey.size > before)
                createdFolders += 1;
            folderIdByCategoryAndPath.set(mapKey, folderId);
            parentId = folderId;
        }
    }
    let movedDocuments = 0;
    let clearedDocuments = 0;
    for (const doc of docs) {
        const sourceNorm = normalizeRelPath(doc.sourcePath);
        const dir = canonicalPath(node_path_1.default.posix.dirname(sourceNorm));
        let targetSubcategoryId = null;
        if (dir && dir !== '.') {
            const key = `${doc.category}|${normalize(dir)}`;
            targetSubcategoryId = folderIdByCategoryAndPath.get(key) ?? null;
        }
        if ((doc.subcategoryId ?? null) === targetSubcategoryId)
            continue;
        await prisma.documentAsset.update({
            where: { id: doc.id },
            data: { subcategoryId: targetSubcategoryId },
            select: { id: true },
        });
        if (targetSubcategoryId)
            movedDocuments += 1;
        else
            clearedDocuments += 1;
    }
    const totalFolders = await prisma.documentSubcategory.count();
    const linkedDocs = await prisma.documentAsset.count({
        where: { subcategoryId: { not: null } },
    });
    console.log(JSON.stringify({
        repoRoot,
        createdFolders,
        totalFolders,
        movedDocuments,
        clearedDocuments,
        linkedDocs,
        totalDocuments: docs.length,
    }, null, 2));
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=sync-document-subcategories.js.map