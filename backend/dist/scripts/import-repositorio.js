"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_child_process_1 = require("node:child_process");
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = require("dotenv");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
(0, dotenv_1.config)({ path: node_path_1.default.join(__dirname, '..', '.env') });
const connectionString = process.env.DATABASE_URL ??
    'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
const prisma = new client_1.PrismaClient({ adapter });
const repoRoot = process.env.REPOSITORIO_PATH ?? '/Users/italocarmo/Downloads/Repositório';
const storageRoot = node_path_1.default.join(process.cwd(), 'storage', 'documents');
const rootDir = node_path_1.default.join(__dirname, '..', '..');
const rbacPath = node_path_1.default.join(rootDir, 'RBAC_MATRIX.json');
function normalize(input) {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}
function decodeXml(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#10;/g, '\n')
        .replace(/&#13;/g, '');
}
function cleanExtractedText(value) {
    return decodeXml(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function readDocxLines(filePath) {
    const xml = (0, node_child_process_1.execFileSync)('unzip', ['-p', filePath, 'word/document.xml'], {
        encoding: 'utf-8',
    });
    const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
    const lines = [];
    for (const p of paragraphs) {
        const runs = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
            .map((m) => cleanExtractedText(m[1]))
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
        if (runs) {
            lines.push(runs);
        }
    }
    return lines;
}
function readPptxLines(filePath) {
    const entries = (0, node_child_process_1.execFileSync)('unzip', ['-Z1', filePath], {
        encoding: 'utf-8',
    })
        .split('\n')
        .filter((line) => /^ppt\/slides\/slide\d+\.xml$/.test(line));
    const lines = [];
    for (const entry of entries) {
        const xml = (0, node_child_process_1.execFileSync)('unzip', ['-p', filePath, entry], {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
        });
        const parts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
            .map((match) => cleanExtractedText(match[1]))
            .filter(Boolean);
        if (parts.length)
            lines.push(parts.join(' '));
    }
    return lines;
}
function readXlsxLines(filePath) {
    const list = (0, node_child_process_1.execFileSync)('unzip', ['-Z1', filePath], {
        encoding: 'utf-8',
    })
        .split('\n')
        .filter(Boolean);
    let sharedStrings = [];
    if (list.includes('xl/sharedStrings.xml')) {
        const sharedXml = (0, node_child_process_1.execFileSync)('unzip', ['-p', filePath, 'xl/sharedStrings.xml'], {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
        });
        const entries = sharedXml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
        sharedStrings = entries.map((entry) => {
            const content = [...entry.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
                .map((m) => cleanExtractedText(m[1]))
                .join(' ')
                .trim();
            return content;
        });
    }
    const sheetEntries = list.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry));
    const lines = [];
    for (const sheetEntry of sheetEntries) {
        const xml = (0, node_child_process_1.execFileSync)('unzip', ['-p', filePath, sheetEntry], {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
        });
        const rows = xml.match(/<row[\s\S]*?<\/row>/g) ?? [];
        for (const row of rows) {
            const cells = row.match(/<c[\s\S]*?<\/c>/g) ?? [];
            const values = [];
            for (const cell of cells) {
                const cellType = cell.match(/\bt="([^"]+)"/)?.[1] ?? '';
                const v = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1];
                const inline = cell.match(/<is>[\s\S]*?<\/is>/)?.[0];
                let value = '';
                if (cellType === 's' && typeof v === 'string') {
                    value = sharedStrings[Number(v)] ?? '';
                }
                else if (inline) {
                    value = [...inline.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
                        .map((m) => cleanExtractedText(m[1]))
                        .join(' ')
                        .trim();
                }
                else if (typeof v === 'string') {
                    value = cleanExtractedText(v);
                }
                if (value)
                    values.push(value);
            }
            if (values.length)
                lines.push(values.join(' | '));
        }
    }
    return lines;
}
function readPdfText(filePath) {
    try {
        const output = (0, node_child_process_1.execFileSync)('python3', [
            '-c',
            [
                'from pypdf import PdfReader',
                'import sys',
                'fp=sys.argv[1]',
                'reader=PdfReader(fp)',
                'text=[]',
                'for page in reader.pages:',
                '  text.append(page.extract_text() or "")',
                'joined="\\n".join(text)',
                'print(joined)',
            ].join('\n'),
            filePath,
        ], {
            encoding: 'utf-8',
            maxBuffer: 80 * 1024 * 1024,
        });
        const normalized = output.replace(/\r/g, '').trim();
        return normalized;
    }
    catch {
        return '';
    }
}
function toDateISO(year, ddmm) {
    const [dd, mm] = ddmm.split('.').map((item) => Number(item));
    const date = new Date(Date.UTC(year, mm - 1, dd));
    return date;
}
function inferMimeType(fileName) {
    const ext = node_path_1.default.extname(fileName).toLowerCase();
    const map = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.heic': 'image/heic',
        '.mov': 'video/quicktime',
        '.mp4': 'video/mp4',
    };
    return map[ext] ?? 'application/octet-stream';
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
async function clearStorage() {
    const folders = [
        node_path_1.default.join(process.cwd(), 'storage', 'reports'),
        node_path_1.default.join(process.cwd(), 'storage', 'activity-reports'),
        node_path_1.default.join(process.cwd(), 'storage', 'documents'),
    ];
    for (const folder of folders) {
        if (!node_fs_1.default.existsSync(folder))
            continue;
        for (const entry of node_fs_1.default.readdirSync(folder)) {
            const filePath = node_path_1.default.join(folder, entry);
            if (node_fs_1.default.lstatSync(filePath).isFile()) {
                node_fs_1.default.unlinkSync(filePath);
            }
        }
    }
}
async function resetDatabase() {
    await prisma.activityCommentRead.deleteMany();
    await prisma.activityComment.deleteMany();
    await prisma.taskCommentRead.deleteMany();
    await prisma.taskComment.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.documentLink.deleteMany();
    await prisma.documentContent.deleteMany();
    await prisma.documentAsset.deleteMany();
    await prisma.documentSubcategory.deleteMany();
    await prisma.activityReportPhoto.deleteMany();
    await prisma.activityReport.deleteMany();
    await prisma.report.deleteMany();
    await prisma.checklistItemStatus.deleteMany();
    await prisma.checklistItem.deleteMany();
    await prisma.checklist.deleteMany();
    await prisma.notice.deleteMany();
    await prisma.taskInstance.deleteMany();
    await prisma.taskTemplate.deleteMany();
    await prisma.meetingDecision.deleteMany();
    await prisma.meetingParticipant.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.recruitsHistory.deleteMany();
    await prisma.kpiValue.deleteMany();
    await prisma.kpi.deleteMany();
    await prisma.elo.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.eloRole.deleteMany();
    await prisma.phase.deleteMany();
    await prisma.specialty.deleteMany();
    await prisma.posto.deleteMany();
    await prisma.locality.deleteMany();
}
async function seedRbac() {
    const rbacMatrix = JSON.parse(node_fs_1.default.readFileSync(rbacPath, 'utf-8'));
    const matrixPermissions = new Map();
    for (const role of rbacMatrix.roles ?? []) {
        for (const perm of role.permissions ?? []) {
            const key = `${perm.resource}:${perm.action}:${perm.scope}`;
            if (!matrixPermissions.has(key)) {
                matrixPermissions.set(key, {
                    resource: perm.resource,
                    action: perm.action,
                    scope: perm.scope,
                });
            }
        }
    }
    for (const perm of matrixPermissions.values()) {
        await prisma.permission.upsert({
            where: {
                resource_action_scope: {
                    resource: perm.resource,
                    action: perm.action,
                    scope: perm.scope,
                },
            },
            update: {},
            create: {
                resource: perm.resource,
                action: perm.action,
                scope: perm.scope,
            },
        });
    }
    for (const role of rbacMatrix.roles ?? []) {
        const roleRecord = await prisma.role.upsert({
            where: { name: role.name },
            update: {
                description: role.description ?? null,
                isSystemRole: role.isSystemRole ?? false,
                wildcard: role.wildcard ?? false,
                flagsJson: role.flags ?? undefined,
                constraintsTemplateJson: role.constraintsTemplate ?? undefined,
            },
            create: {
                name: role.name,
                description: role.description ?? null,
                isSystemRole: role.isSystemRole ?? false,
                wildcard: role.wildcard ?? false,
                flagsJson: role.flags ?? undefined,
                constraintsTemplateJson: role.constraintsTemplate ?? undefined,
            },
        });
        const permissions = await prisma.permission.findMany({
            where: {
                OR: role.permissions.map((perm) => ({
                    resource: perm.resource,
                    action: perm.action,
                    scope: perm.scope,
                })),
            },
            select: { id: true },
        });
        await prisma.rolePermission.deleteMany({
            where: { roleId: roleRecord.id },
        });
        if (permissions.length > 0) {
            await prisma.rolePermission.createMany({
                data: permissions.map((perm) => ({
                    roleId: roleRecord.id,
                    permissionId: perm.id,
                })),
            });
        }
    }
}
function extractDistributionLocalities() {
    const distributionDoc = node_path_1.default.join(repoRoot, '7. CIPAVD-SMIF/Plano de Ação_CMTAER/PLANO DE AÇÃO JUNTO AO SMIF_CMTAER.docx');
    const lines = readDocxLines(distributionDoc);
    const localities = [];
    for (let i = 0; i < lines.length - 1; i += 1) {
        const line = lines[i].trim();
        const next = lines[i + 1].trim();
        if (!line || !next)
            continue;
        if (/^TOTAL DE VAGAS$/i.test(normalize(line)))
            break;
        const looksLikeLocality = /[A-Za-zÀ-ÿ\s]+-[A-Z]{2}/.test(line);
        const looksLikeNumber = /^\d+$/.test(next);
        if (!looksLikeLocality || !looksLikeNumber)
            continue;
        const recruits = Number(next);
        const city = line.replace(/\s+/g, ' ').trim();
        const generatedCode = makeCodeFromName(city);
        localities.push({ code: generatedCode, name: city, recruits });
    }
    return localities;
}
function makeCodeFromName(name) {
    const normalized = normalize(name)
        .replace(/\s*-\s*/g, '-')
        .replace(/[^A-Z\-\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const explicit = {
        'BRASILIA-DF': 'BR',
        'MANAUS-AM': 'MN',
        'SAO PAULO-SP': 'SP',
        'CANOAS-RS': 'CO',
        'GUARATINGUETA-SP': 'GW',
        'AFONSOS-RJ': 'AF',
        'PIRASSUNUNGA-SP': 'YS',
        'LAGOA SANTA-MG': 'LS',
        'RIO DE JANEIRO-RJ': 'RJ',
    };
    if (explicit[normalized])
        return explicit[normalized];
    const parts = normalized.split('-');
    const city = (parts[0] ?? normalized).replace(/\s+/g, '');
    const uf = (parts[1] ?? '').replace(/\s+/g, '');
    const base = city.slice(0, 2) + uf.slice(0, 1);
    return base.padEnd(2, 'X').slice(0, 3);
}
function extractScheduleVisits() {
    const scheduleDocs = [
        node_path_1.default.join(repoRoot, '7. CIPAVD-SMIF/Proposta de Trabalho/CRONOGRAMA DE VISITAS DA CIPAVD AO SMIF.docx'),
        node_path_1.default.join(repoRoot, '7. CIPAVD-SMIF/Cronograma de Viagens e Equipe/CRONOGRAMA DE VISITAS DA CIPAVD AO SMIF_versão Equipe.docx'),
    ];
    const items = [];
    for (const scheduleDoc of scheduleDocs) {
        if (!node_fs_1.default.existsSync(scheduleDoc))
            continue;
        const lines = readDocxLines(scheduleDoc);
        const joined = lines.join(' | ');
        const matches = [
            ...joined.matchAll(/(\d{2}[./]\d{2})(?:\s*a\s*(\d{2}[./]\d{2}))?\s*\|\s*([A-Za-zÀ-ÿ\s]+-\s*[A-Z]{2})/g),
            ...joined.matchAll(/(\d{2}[./]\d{2})(?:\s*a\s*(\d{2}[./]\d{2}))?\s*\|\s*([A-Za-zÀ-ÿ\s]+-\s*[A-Z]{2})\s*-/g),
        ];
        for (const match of matches) {
            const startRaw = match[1].replace('/', '.');
            const endRaw = (match[2] ?? match[1]).replace('/', '.');
            const localityName = match[3].replace(/\s+/g, ' ').trim();
            if (!/[A-Za-zÀ-ÿ\s]+-\s*[A-Z]{2}/.test(localityName))
                continue;
            const startDate = toDateISO(2026, startRaw);
            const endDate = toDateISO(2026, endRaw);
            items.push({
                localityName,
                startDate,
                endDate,
                description: `${localityName} (${startRaw} a ${endRaw})`,
            });
        }
    }
    const uniq = new Map();
    for (const item of items) {
        uniq.set(`${item.localityName}:${item.startDate.toISOString().slice(0, 10)}`, item);
    }
    return Array.from(uniq.values()).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}
function extractAdditionalLocalities() {
    const source = node_path_1.default.join(repoRoot, '1. CIPAVD - Documentos Gerais /Atividades CIPAVD 2026.docx');
    const lines = readDocxLines(source);
    const set = new Map();
    for (const line of lines) {
        const matches = line.match(/[A-Za-zÀ-ÿ\s]+\s-\s[A-Z]{2}/g) ?? [];
        for (const match of matches) {
            const name = match.replace(/\s+/g, ' ').trim();
            const code = makeCodeFromName(name);
            if (!set.has(code)) {
                set.set(code, { code, name });
            }
        }
    }
    return Array.from(set.values());
}
async function upsertCatalog() {
    const specialties = [
        'Psicologia',
        'Serviço Social',
        'Jurídico',
        'Comunicação Social',
        'Estatística',
    ];
    for (const name of specialties) {
        await prisma.specialty.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    const phases = [
        { name: client_1.PhaseName.PREPARACAO, order: 1, displayName: 'Preparação' },
        { name: client_1.PhaseName.EXECUCAO, order: 2, displayName: 'Execução' },
        {
            name: client_1.PhaseName.ACOMPANHAMENTO,
            order: 3,
            displayName: 'Acompanhamento',
        },
    ];
    for (const phase of phases) {
        await prisma.phase.upsert({
            where: { name: phase.name },
            update: { order: phase.order, displayName: phase.displayName },
            create: phase,
        });
    }
    const postos = [
        { code: 'TEN_BRIG', name: 'Tenente-Brigadeiro do Ar', sortOrder: 1 },
        { code: 'MAJ_BRIG', name: 'Major-Brigadeiro', sortOrder: 2 },
        { code: 'BRIG', name: 'Brigadeiro', sortOrder: 3 },
        { code: 'CEL', name: 'Coronel', sortOrder: 4 },
        { code: 'TEN_CEL', name: 'Tenente-Coronel', sortOrder: 5 },
        { code: 'MAJ', name: 'Major', sortOrder: 6 },
        { code: 'CAP', name: 'Capitão', sortOrder: 7 },
        { code: '1TEN', name: 'Primeiro-Tenente', sortOrder: 8 },
        { code: '2TEN', name: 'Segundo-Tenente', sortOrder: 9 },
        { code: 'ASP', name: 'Aspirante a Oficial', sortOrder: 10 },
        { code: 'SO', name: 'Suboficial', sortOrder: 11 },
        { code: '1SGT', name: 'Primeiro-Sargento', sortOrder: 12 },
        { code: '2SGT', name: 'Segundo-Sargento', sortOrder: 13 },
        { code: '3SGT', name: 'Terceiro-Sargento', sortOrder: 14 },
        { code: 'CB', name: 'Cabo', sortOrder: 15 },
        { code: 'S1', name: 'Soldado de Primeira Classe', sortOrder: 16 },
        { code: 'S2', name: 'Soldado de Segunda Classe', sortOrder: 17 },
    ];
    for (const posto of postos) {
        await prisma.posto.upsert({
            where: { code: posto.code },
            update: { name: posto.name, sortOrder: posto.sortOrder },
            create: posto,
        });
    }
}
async function upsertLocalities() {
    const distribution = extractDistributionLocalities();
    const additional = extractAdditionalLocalities();
    const all = new Map();
    for (const item of [...distribution, ...additional]) {
        const existing = all.get(item.code);
        if (!existing) {
            all.set(item.code, item);
        }
        else if (!existing.recruits && item.recruits) {
            all.set(item.code, { ...existing, recruits: item.recruits });
        }
    }
    const forced = [
        { code: 'BR', name: 'Brasília-DF' },
        { code: 'MN', name: 'Manaus-AM' },
        { code: 'SP', name: 'São Paulo-SP' },
        { code: 'CO', name: 'Canoas-RS' },
        { code: 'GW', name: 'Guaratinguetá-SP' },
        { code: 'AF', name: 'Afonsos-RJ' },
        { code: 'YS', name: 'Pirassununga-SP' },
        { code: 'LS', name: 'Lagoa Santa-MG' },
    ];
    for (const item of forced) {
        if (!all.has(item.code))
            all.set(item.code, item);
    }
    const map = new Map();
    for (const locality of all.values()) {
        const saved = await prisma.locality.upsert({
            where: { code: locality.code },
            update: {
                name: locality.name,
                recruitsFemaleCountCurrent: locality.recruits ?? undefined,
            },
            create: {
                code: locality.code,
                name: locality.name,
                recruitsFemaleCountCurrent: locality.recruits ?? null,
            },
        });
        map.set(saved.code, { id: saved.id, code: saved.code, name: saved.name });
        if (typeof locality.recruits === 'number') {
            await prisma.recruitsHistory.upsert({
                where: {
                    localityId_date: {
                        localityId: saved.id,
                        date: new Date(Date.UTC(2026, 0, 1)),
                    },
                },
                update: { recruitsFemaleCount: locality.recruits },
                create: {
                    localityId: saved.id,
                    date: new Date(Date.UTC(2026, 0, 1)),
                    recruitsFemaleCount: locality.recruits,
                    turnoverCount: 0,
                },
            });
        }
    }
    return map;
}
async function upsertUsers(localityByCode) {
    const password = process.env.IMPORT_DEFAULT_PASSWORD ?? 'Smif@2026';
    const hash = await bcrypt_1.default.hash(password, 10);
    const roleTI = await prisma.role.findUnique({ where: { name: 'TI' } });
    const roleCoord = await prisma.role.findUnique({
        where: { name: 'Coordenação CIPAVD' },
    });
    const roleGsd = await prisma.role.findUnique({
        where: { name: 'GSD Localidade' },
    });
    if (!roleTI || !roleCoord || !roleGsd) {
        throw new Error('Papéis base não encontrados após seed RBAC.');
    }
    const admin = await prisma.user.upsert({
        where: { email: process.env.IMPORT_ADMIN_EMAIL ?? 'admin@smif.local' },
        update: {
            name: 'Administrador SMIF',
            passwordHash: hash,
            isActive: true,
            executiveHidePii: false,
        },
        create: {
            email: process.env.IMPORT_ADMIN_EMAIL ?? 'admin@smif.local',
            name: 'Administrador SMIF',
            passwordHash: hash,
            isActive: true,
            executiveHidePii: false,
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: admin.id, roleId: roleTI.id } },
        update: {},
        create: { userId: admin.id, roleId: roleTI.id },
    });
    const legacyTiEmail = process.env.IMPORT_TI_EMAIL ?? 'ti@smif.local';
    let tiUser = admin;
    if (legacyTiEmail !== admin.email) {
        tiUser = await prisma.user.upsert({
            where: { email: legacyTiEmail },
            update: {
                name: 'TI SMIF',
                passwordHash: hash,
                isActive: true,
                executiveHidePii: false,
            },
            create: {
                email: legacyTiEmail,
                name: 'TI SMIF',
                passwordHash: hash,
                isActive: true,
                executiveHidePii: false,
            },
        });
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: tiUser.id, roleId: roleTI.id } },
            update: {},
            create: { userId: tiUser.id, roleId: roleTI.id },
        });
    }
    const localityBR = localityByCode.get('BR');
    const coordinator = await prisma.user.upsert({
        where: { email: 'cipavd.coordenacao@smif.local' },
        update: {
            name: 'Coordenação CIPAVD',
            localityId: localityBR?.id ?? null,
            passwordHash: hash,
            isActive: true,
            executiveHidePii: false,
        },
        create: {
            email: 'cipavd.coordenacao@smif.local',
            name: 'Coordenação CIPAVD',
            localityId: localityBR?.id ?? null,
            passwordHash: hash,
            isActive: true,
            executiveHidePii: false,
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: coordinator.id, roleId: roleCoord.id } },
        update: {},
        create: { userId: coordinator.id, roleId: roleCoord.id },
    });
    const gsdUsers = new Map();
    for (const locality of localityByCode.values()) {
        const email = `gsd-${locality.code.toLowerCase()}@smif.local`;
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                name: `GSD ${locality.code}`,
                localityId: locality.id,
                passwordHash: hash,
                isActive: true,
            },
            create: {
                email,
                name: `GSD ${locality.code}`,
                localityId: locality.id,
                passwordHash: hash,
                isActive: true,
            },
        });
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: roleGsd.id } },
            update: {},
            create: { userId: user.id, roleId: roleGsd.id },
        });
        gsdUsers.set(locality.code, {
            id: user.id,
            name: user.name,
            email: user.email,
        });
    }
    return { admin, tiUser, coordinator, gsdUsers };
}
async function createMeetings() {
    const meeting = await prisma.meeting.create({
        data: {
            datetime: new Date('2026-01-29T14:00:00.000Z'),
            scope: '1ª Reunião Geral CIPAVD-SMIF',
            status: client_1.MeetingStatus.PLANNED,
            meetingType: 'ONLINE',
            meetingLink: 'https://fab.webex.com/fab/ldr.php?RCID=42c8592a11f27ff9e40c674a82f9ca96',
            agenda: 'Alinhamento do plano de apoio da CIPAVD no SMIF, definição de elos locais e cronograma de visitas.',
        },
    });
    return { meeting };
}
async function createActivities(localityByCode) {
    const schedule = extractScheduleVisits();
    const created = new Map();
    for (const visit of schedule) {
        const code = makeCodeFromName(visit.localityName);
        const locality = localityByCode.get(code) ?? null;
        const status = visit.endDate.getTime() < Date.now() ? 'DONE' : 'NOT_STARTED';
        const activity = await prisma.activity.create({
            data: {
                title: `Palestra CIPAVD - ${visit.localityName}`,
                description: 'Atividade oficial do cronograma CIPAVD/SMIF: palestra de prevenção e enfrentamento ao assédio moral e sexual, com equipe presencial e coleta de dados.',
                localityId: locality?.id ?? null,
                eventDate: visit.startDate,
                reportRequired: true,
                status: status,
            },
        });
        created.set(code, {
            id: activity.id,
            localityId: activity.localityId ?? null,
        });
    }
    const manaus = localityByCode.get('MN');
    if (manaus) {
        const mission = await prisma.activity.create({
            data: {
                title: 'Missão Piloto CIPAVD - Manaus (COMAR VII)',
                description: 'Missão realizada em 24 e 25 de novembro de 2025, com debriefing, palestras e consolidação de resultados.',
                localityId: manaus.id,
                eventDate: new Date('2025-11-24T00:00:00.000Z'),
                reportRequired: true,
                status: 'DONE',
            },
        });
        created.set('MN_MISSAO', {
            id: mission.id,
            localityId: mission.localityId,
        });
    }
    return created;
}
async function createTaskBacklog(localityByCode, gsdUsers) {
    const phases = await prisma.phase.findMany();
    const phaseByName = new Map(phases.map((p) => [p.name, p]));
    const templatesSeed = [
        {
            title: 'Enviar cronograma de preparação/eventos do SMIF',
            phase: client_1.PhaseName.PREPARACAO,
            reportRequiredDefault: false,
            priority: client_1.TaskPriority.MEDIUM,
            offsetDays: -21,
        },
        {
            title: 'Indicar elos locais (doutrina, psicologia, serviço social e jurídico)',
            phase: client_1.PhaseName.PREPARACAO,
            reportRequiredDefault: false,
            priority: client_1.TaskPriority.HIGH,
            offsetDays: -18,
        },
        {
            title: 'Garantir conclusão do CPEAMS por todos os envolvidos',
            phase: client_1.PhaseName.PREPARACAO,
            reportRequiredDefault: false,
            priority: client_1.TaskPriority.HIGH,
            offsetDays: -10,
        },
        {
            title: 'Realizar palestra de assédio moral e sexual para recrutas',
            phase: client_1.PhaseName.EXECUCAO,
            reportRequiredDefault: true,
            priority: client_1.TaskPriority.HIGH,
            offsetDays: 0,
        },
        {
            title: 'Registrar visita técnica in loco (Psicologia e Serviço Social)',
            phase: client_1.PhaseName.EXECUCAO,
            reportRequiredDefault: true,
            priority: client_1.TaskPriority.MEDIUM,
            offsetDays: 1,
        },
        {
            title: 'Enviar relatório consolidado da atividade CIPAVD',
            phase: client_1.PhaseName.ACOMPANHAMENTO,
            reportRequiredDefault: true,
            priority: client_1.TaskPriority.HIGH,
            offsetDays: 5,
        },
    ];
    const templates = new Map();
    for (const seed of templatesSeed) {
        const phase = phaseByName.get(seed.phase);
        if (!phase)
            continue;
        const created = await prisma.taskTemplate.create({
            data: {
                title: seed.title,
                description: 'Tarefa importada do planejamento real CIPAVD/SMIF para centralização do acompanhamento no sistema.',
                phaseId: phase.id,
                appliesToAllLocalities: false,
                reportRequiredDefault: seed.reportRequiredDefault,
            },
        });
        templates.set(seed.title, created.id);
    }
    const visits = extractScheduleVisits();
    for (const visit of visits) {
        const code = makeCodeFromName(visit.localityName);
        const locality = localityByCode.get(code);
        if (!locality)
            continue;
        const assignee = gsdUsers.get(locality.code);
        for (const templateSeed of templatesSeed) {
            const templateId = templates.get(templateSeed.title);
            if (!templateId)
                continue;
            const dueDate = new Date(visit.startDate.getTime());
            dueDate.setUTCDate(dueDate.getUTCDate() + templateSeed.offsetDays);
            const done = dueDate.getTime() < Date.now() - 2 * 24 * 60 * 60 * 1000;
            await prisma.taskInstance.create({
                data: {
                    taskTemplateId: templateId,
                    localityId: locality.id,
                    dueDate,
                    status: done ? client_1.TaskStatus.DONE : client_1.TaskStatus.NOT_STARTED,
                    priority: templateSeed.priority,
                    progressPercent: done ? 100 : 0,
                    assignedToId: assignee?.id ?? null,
                    reportRequired: templateSeed.reportRequiredDefault,
                },
            });
        }
    }
    const backlogSeeds = [
        {
            title: 'Evolução do Acervo: OCR e indexação textual dos documentos',
            description: 'Implementar OCR e indexação de conteúdo para busca por texto dentro de PDF/Word e histórico de versões.',
            dueDate: new Date('2026-04-30T00:00:00.000Z'),
        },
        {
            title: 'Evolução do Acervo: versionamento e trilha de alteração de arquivos',
            description: 'Permitir controle de versões por documento, comparação de versões e restauração.',
            dueDate: new Date('2026-05-15T00:00:00.000Z'),
        },
        {
            title: 'Evolução do Acervo: fluxo formal de aprovação/publicação',
            description: 'Adicionar workflow de rascunho, revisão e publicação oficial para documentos sensíveis.',
            dueDate: new Date('2026-05-31T00:00:00.000Z'),
        },
        {
            title: 'Evolução do Acervo: assinatura digital com certificado ICP-Brasil',
            description: 'Integrar assinatura eletrônica avançada para documentos oficiais com validação jurídica reforçada.',
            dueDate: new Date('2026-06-30T00:00:00.000Z'),
        },
        {
            title: 'Evolução do Acervo: política de retenção e descarte documental',
            description: 'Implementar prazos de guarda, arquivamento e descarte para eliminar dependência operacional do Drive.',
            dueDate: new Date('2026-07-15T00:00:00.000Z'),
        },
    ];
    const br = localityByCode.get('BR');
    if (br) {
        for (const seed of backlogSeeds) {
            const backlogTemplate = await prisma.taskTemplate.create({
                data: {
                    title: seed.title,
                    description: seed.description,
                    phaseId: phaseByName.get(client_1.PhaseName.ACOMPANHAMENTO).id,
                    appliesToAllLocalities: false,
                    reportRequiredDefault: false,
                },
            });
            await prisma.taskInstance.create({
                data: {
                    taskTemplateId: backlogTemplate.id,
                    localityId: br.id,
                    dueDate: seed.dueDate,
                    status: client_1.TaskStatus.NOT_STARTED,
                    priority: client_1.TaskPriority.MEDIUM,
                    progressPercent: 0,
                    reportRequired: false,
                },
            });
        }
    }
}
async function importDocuments(localityByCode, meetingId, activitiesByCode) {
    node_fs_1.default.mkdirSync(storageRoot, { recursive: true });
    const files = [];
    const walk = (dir) => {
        for (const entry of node_fs_1.default.readdirSync(dir)) {
            const full = node_path_1.default.join(dir, entry);
            const stat = node_fs_1.default.statSync(full);
            if (stat.isDirectory()) {
                walk(full);
            }
            else if (stat.isFile()) {
                files.push(full);
            }
        }
    };
    walk(repoRoot);
    let imported = 0;
    for (const absPath of files) {
        const relativePath = node_path_1.default.relative(repoRoot, absPath);
        const storageKey = `${Date.now()}-${node_crypto_1.default.randomUUID()}${node_path_1.default.extname(absPath).toLowerCase()}`;
        const dest = node_path_1.default.join(storageRoot, storageKey);
        node_fs_1.default.copyFileSync(absPath, dest);
        const buffer = node_fs_1.default.readFileSync(dest);
        const checksum = node_crypto_1.default.createHash('sha256').update(buffer).digest('hex');
        const relNorm = normalize(relativePath);
        let localityCode = null;
        const gsdMatch = relNorm.match(/GSD-([A-Z]{2})/);
        if (gsdMatch) {
            localityCode = gsdMatch[1];
        }
        if (!localityCode) {
            for (const locality of localityByCode.values()) {
                const key = normalize(locality.name).replace(/[^A-Z\s\-]/g, '');
                const city = key.split('-')[0].trim();
                if (city && relNorm.includes(city)) {
                    localityCode = locality.code;
                    break;
                }
            }
        }
        const locality = localityCode
            ? (localityByCode.get(localityCode) ?? null)
            : null;
        let linkMeetingId = null;
        let linkActivityId = null;
        if (relNorm.includes('REUNIO')) {
            linkMeetingId = meetingId;
        }
        if (relNorm.includes('MISSOES - MANAUS')) {
            linkActivityId = activitiesByCode.get('MN_MISSAO')?.id ?? null;
        }
        else if (localityCode && activitiesByCode.get(localityCode)) {
            linkActivityId = activitiesByCode.get(localityCode)?.id ?? null;
        }
        const title = node_path_1.default.basename(absPath, node_path_1.default.extname(absPath));
        await prisma.documentAsset.create({
            data: {
                title,
                category: mapCategory(relativePath),
                sourcePath: relativePath,
                fileName: node_path_1.default.basename(absPath),
                fileUrl: `/documents/${storageKey}`,
                storageKey,
                mimeType: inferMimeType(absPath),
                fileSize: node_fs_1.default.statSync(dest).size,
                checksum,
                localityId: locality?.id ?? null,
                activityId: linkActivityId,
                meetingId: linkMeetingId,
                tagsJson: {
                    importedFrom: 'google-drive-repositorio',
                    relativePath,
                },
            },
        });
        imported += 1;
    }
    return { imported };
}
function extractDateToken(raw, fallbackYear = 2026) {
    const match = raw.match(/(\d{2})[./-](\d{2})(?:[./-](\d{2,4}))?/);
    if (!match)
        return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12)
        return null;
    const yearToken = match[3];
    const year = yearToken
        ? yearToken.length === 2
            ? 2000 + Number(yearToken)
            : Number(yearToken)
        : fallbackYear;
    return new Date(Date.UTC(year, month - 1, day));
}
function inferLocalityCodeFromText(sourcePath, text, localityByCode) {
    const relNorm = normalize(sourcePath);
    const gsdMatch = relNorm.match(/GSD-([A-Z]{2,3})/);
    if (gsdMatch && localityByCode.has(gsdMatch[1])) {
        return gsdMatch[1];
    }
    const textNorm = normalize(text);
    for (const locality of localityByCode.values()) {
        const city = normalize(locality.name).split('-')[0].trim();
        if (city && textNorm.includes(city))
            return locality.code;
    }
    return null;
}
async function ensureEloRoles() {
    const seeds = [
        { code: 'PSICOLOGIA', name: 'Psicologia', sortOrder: 1 },
        { code: 'SSO', name: 'Serviço Social', sortOrder: 2 },
        { code: 'JURIDICO', name: 'Jurídico', sortOrder: 3 },
        { code: 'CPCA', name: 'CPCA', sortOrder: 4 },
        { code: 'GRAD_MASTER', name: 'Graduado-Master', sortOrder: 5 },
        { code: 'DOUTRINA', name: 'Doutrina', sortOrder: 6 },
    ];
    const result = new Map();
    for (const seed of seeds) {
        const role = await prisma.eloRole.upsert({
            where: { code: seed.code },
            update: { name: seed.name, sortOrder: seed.sortOrder },
            create: seed,
        });
        result.set(role.code, { id: role.id, code: role.code, name: role.name });
    }
    return result;
}
async function linkDocumentEntity(documentId, entityType, entityId, label) {
    await prisma.documentLink.upsert({
        where: {
            documentId_entityType_entityId: {
                documentId,
                entityType,
                entityId,
            },
        },
        update: {
            label: label ?? undefined,
        },
        create: {
            documentId,
            entityType,
            entityId,
            label: label ?? null,
        },
    });
}
function extractTextByFile(absPath) {
    const ext = node_path_1.default.extname(absPath).toLowerCase();
    if (ext === '.docx') {
        const lines = readDocxLines(absPath);
        const text = lines.join('\n').trim();
        return {
            status: text ? client_1.DocumentParseStatus.EXTRACTED : client_1.DocumentParseStatus.FAILED,
            text,
            metadata: { extractor: 'docx-xml', lines: lines.length },
        };
    }
    if (ext === '.xlsx') {
        const lines = readXlsxLines(absPath);
        const text = lines.join('\n').trim();
        return {
            status: text ? client_1.DocumentParseStatus.EXTRACTED : client_1.DocumentParseStatus.FAILED,
            text,
            metadata: { extractor: 'xlsx-xml', lines: lines.length },
        };
    }
    if (ext === '.pptx') {
        const lines = readPptxLines(absPath);
        const text = lines.join('\n').trim();
        return {
            status: text
                ? client_1.DocumentParseStatus.EXTRACTED
                : client_1.DocumentParseStatus.PARTIAL,
            text,
            metadata: { extractor: 'pptx-xml', lines: lines.length },
        };
    }
    if (ext === '.pdf') {
        const raw = readPdfText(absPath);
        const text = raw.replace(/\r/g, '').trim();
        return {
            status: text.length > 60
                ? client_1.DocumentParseStatus.EXTRACTED
                : client_1.DocumentParseStatus.PARTIAL,
            text,
            metadata: { extractor: 'python-pypdf', chars: text.length },
        };
    }
    return {
        status: client_1.DocumentParseStatus.NOT_SUPPORTED,
        text: '',
        metadata: { extractor: 'binary-not-supported' },
    };
}
function parseEloCandidates(text) {
    const chunks = text
        .split(/[\n|]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    const candidates = [];
    let currentRole = 'CPCA';
    for (const chunk of chunks) {
        const norm = normalize(chunk);
        if (norm.includes('PSICOLOG'))
            currentRole = 'PSICOLOGIA';
        else if (norm.includes('JURID'))
            currentRole = 'JURIDICO';
        else if (norm.includes('SERVICO SOCIAL') ||
            norm.includes('ASSISTENCIA SOCIAL'))
            currentRole = 'SSO';
        else if (norm.includes('CPCA'))
            currentRole = 'CPCA';
        else if (norm.includes('GRADUADO-MASTER') ||
            norm.includes('GRADUADO MASTER'))
            currentRole = 'GRAD_MASTER';
        else if (norm.includes('DOUTRINA'))
            currentRole = 'DOUTRINA';
        const nameMatch = chunk.match(/\b(MJ|MAJ|CAP|TEN|1T|2T|1S|2S|3S|SO|SGT)\s+([A-Za-zÀ-ÿ'.-]+(?:\s+[A-Za-zÀ-ÿ'.-]+){0,5})/i);
        if (!nameMatch)
            continue;
        const rank = nameMatch[1].toUpperCase();
        const name = `${rank} ${nameMatch[2].trim().replace(/\s+/g, ' ')}`.trim();
        const invalidWords = [
            'PALESTRA',
            'PROJETO',
            'RELATORIO',
            'COMISSAO',
            'ATIVIDADE',
        ];
        const normName = normalize(name);
        if (invalidWords.some((w) => normName.includes(w)))
            continue;
        if (name.split(' ').length < 2)
            continue;
        const phone = chunk.match(/\(\d{2}\)\s*\d{4,5}-?\d{4}/)?.[0] ??
            chunk.match(/\(\d{2}\)\s*\d{4,5}\s*-?\s*\d{4}/)?.[0] ??
            null;
        const hasRoleHint = norm.includes('ELO') ||
            norm.includes('PSICOLOG') ||
            norm.includes('JURID') ||
            norm.includes('SERVICO SOCIAL') ||
            norm.includes('ASSISTENCIA SOCIAL') ||
            norm.includes('CPCA') ||
            norm.includes('GRADUADO');
        if (!phone && !hasRoleHint)
            continue;
        candidates.push({ name, rank, phone, roleCode: currentRole });
    }
    return candidates;
}
function parseMonthDueDate(raw) {
    const norm = normalize(raw);
    if (norm.includes('FEV'))
        return new Date(Date.UTC(2026, 1, 20));
    if (norm.includes('MAR'))
        return new Date(Date.UTC(2026, 2, 20));
    if (norm.includes('ABR'))
        return new Date(Date.UTC(2026, 3, 20));
    if (norm.includes('MAI'))
        return new Date(Date.UTC(2026, 4, 20));
    if (norm.includes('JUN'))
        return new Date(Date.UTC(2026, 5, 20));
    return null;
}
async function syncOperationalDataFromDocuments(localityByCode) {
    const docs = await prisma.documentAsset.findMany({
        orderBy: { createdAt: 'asc' },
    });
    const phases = await prisma.phase.findMany({ orderBy: { order: 'asc' } });
    const phaseByName = new Map(phases.map((p) => [p.name, p]));
    const eloRoleByCode = await ensureEloRoles();
    const summary = {
        parsedDocuments: 0,
        extractedDocuments: 0,
        linkedEntities: 0,
        createdElos: 0,
        createdMeetings: 0,
        createdActivities: 0,
        createdTaskTemplates: 0,
        createdTaskInstances: 0,
    };
    for (const doc of docs) {
        const absPath = node_path_1.default.join(repoRoot, doc.sourcePath);
        if (!node_fs_1.default.existsSync(absPath)) {
            await prisma.documentContent.upsert({
                where: { documentId: doc.id },
                update: {
                    parseStatus: client_1.DocumentParseStatus.FAILED,
                    parsedAt: new Date(),
                    metadataJson: { reason: 'source-file-missing' },
                },
                create: {
                    documentId: doc.id,
                    parseStatus: client_1.DocumentParseStatus.FAILED,
                    parsedAt: new Date(),
                    metadataJson: { reason: 'source-file-missing' },
                },
            });
            continue;
        }
        const extraction = extractTextByFile(absPath);
        const text = extraction.text.trim();
        summary.parsedDocuments += 1;
        if (extraction.status === client_1.DocumentParseStatus.EXTRACTED) {
            summary.extractedDocuments += 1;
        }
        await prisma.documentContent.upsert({
            where: { documentId: doc.id },
            update: {
                parseStatus: extraction.status,
                textContent: text || null,
                parsedAt: new Date(),
                metadataJson: extraction.metadata,
            },
            create: {
                documentId: doc.id,
                parseStatus: extraction.status,
                textContent: text || null,
                parsedAt: new Date(),
                metadataJson: extraction.metadata,
            },
        });
        if (doc.localityId) {
            await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.LOCALITY, doc.localityId, 'Localidade vinculada');
            summary.linkedEntities += 1;
        }
        if (doc.activityId) {
            await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.ACTIVITY, doc.activityId, 'Atividade vinculada');
            summary.linkedEntities += 1;
        }
        if (doc.meetingId) {
            await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.MEETING, doc.meetingId, 'Reunião vinculada');
            summary.linkedEntities += 1;
        }
        if (!text)
            continue;
        const sourceNorm = normalize(doc.sourcePath);
        const localityCode = inferLocalityCodeFromText(doc.sourcePath, text, localityByCode);
        const locality = localityCode
            ? (localityByCode.get(localityCode) ?? null)
            : null;
        if (sourceNorm.includes('REUNIO') ||
            sourceNorm.includes('PAUTA DA REUNIAO')) {
            const dateByPath = extractDateToken(doc.sourcePath, 2026) ??
                extractDateToken(text.match(/DIA\s+\d{2}[./]\d{2}/i)?.[0] ?? '', 2026) ??
                new Date('2026-02-03T14:00:00.000Z');
            const meetingDate = dateByPath ?? new Date('2026-02-03T14:00:00.000Z');
            const scope = doc.title.includes('Reunião')
                ? doc.title
                : `Reunião - ${doc.title}`;
            const link = text.match(/https?:\/\/\S+/)?.[0] ?? null;
            const existing = await prisma.meeting.findFirst({
                where: {
                    scope,
                    datetime: meetingDate,
                },
            });
            const meeting = existing ??
                (await prisma.meeting.create({
                    data: {
                        datetime: meetingDate,
                        scope,
                        status: meetingDate.getTime() < Date.now()
                            ? client_1.MeetingStatus.HELD
                            : client_1.MeetingStatus.PLANNED,
                        meetingType: link ? 'ONLINE' : 'PRESENCIAL',
                        meetingLink: link,
                        localityId: locality?.id ?? null,
                        agenda: text.slice(0, 1600),
                    },
                }));
            if (!existing)
                summary.createdMeetings += 1;
            await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.MEETING, meeting.id, 'Reunião extraída do documento');
            summary.linkedEntities += 1;
            if (sourceNorm.includes('PAUTA DA REUNIAO')) {
                const milestones = [
                    ...text.matchAll(/(FEV(?:EREIRO)?|MAR[ÇC]O|ABRIL(?:\/JUN)?|MAIO|JUNHO)\s*:\s*\d+\.\s*([^;.\n]+)/gi),
                ];
                for (const milestone of milestones) {
                    const title = `Pauta 03.02: ${milestone[2].trim().replace(/\s+/g, ' ')}`;
                    const dueDate = parseMonthDueDate(milestone[1]) ?? new Date(Date.UTC(2026, 1, 20));
                    const phaseName = dueDate.getUTCMonth() <= 1
                        ? client_1.PhaseName.PREPARACAO
                        : dueDate.getUTCMonth() <= 4
                            ? client_1.PhaseName.EXECUCAO
                            : client_1.PhaseName.ACOMPANHAMENTO;
                    const phase = phaseByName.get(phaseName);
                    const br = localityByCode.get('BR');
                    if (!phase || !br)
                        continue;
                    let template = await prisma.taskTemplate.findFirst({
                        where: { title },
                    });
                    if (!template) {
                        template = await prisma.taskTemplate.create({
                            data: {
                                title,
                                description: 'Item de execução importado da pauta de reunião do repositório oficial.',
                                phaseId: phase.id,
                                appliesToAllLocalities: false,
                                reportRequiredDefault: false,
                            },
                        });
                        summary.createdTaskTemplates += 1;
                    }
                    const instanceExists = await prisma.taskInstance.findFirst({
                        where: {
                            taskTemplateId: template.id,
                            localityId: br.id,
                            meetingId: meeting.id,
                        },
                    });
                    if (!instanceExists) {
                        const task = await prisma.taskInstance.create({
                            data: {
                                taskTemplateId: template.id,
                                localityId: br.id,
                                meetingId: meeting.id,
                                dueDate,
                                status: dueDate.getTime() < Date.now()
                                    ? client_1.TaskStatus.DONE
                                    : client_1.TaskStatus.NOT_STARTED,
                                priority: client_1.TaskPriority.MEDIUM,
                                progressPercent: dueDate.getTime() < Date.now() ? 100 : 0,
                                reportRequired: false,
                            },
                        });
                        summary.createdTaskInstances += 1;
                        await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.TASK_INSTANCE, task.id, 'Tarefa extraída da pauta');
                        summary.linkedEntities += 1;
                    }
                }
            }
        }
        if (sourceNorm.includes('7. CIPAVD-SMIF/RESPOSTAS DOS GSD') &&
            (sourceNorm.includes('ELO') ||
                sourceNorm.includes('DUVID') ||
                sourceNorm.includes('QTS') ||
                sourceNorm.includes('ANEXO 3') ||
                sourceNorm.includes('CALENDARIO') ||
                sourceNorm.includes('COLMEIA'))) {
            const eloCandidates = parseEloCandidates(text);
            if (locality && eloCandidates.length) {
                for (const candidate of eloCandidates) {
                    if (!candidate.phone && !sourceNorm.includes('ELOS'))
                        continue;
                    const role = eloRoleByCode.get(candidate.roleCode) ?? eloRoleByCode.get('CPCA');
                    if (!role)
                        continue;
                    const existing = await prisma.elo.findFirst({
                        where: {
                            localityId: locality.id,
                            name: candidate.name,
                        },
                    });
                    const elo = existing ??
                        (await prisma.elo.create({
                            data: {
                                localityId: locality.id,
                                eloRoleId: role.id,
                                name: candidate.name,
                                rank: candidate.rank,
                                phone: candidate.phone,
                                om: locality.name,
                            },
                        }));
                    if (!existing)
                        summary.createdElos += 1;
                    await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.ELO, elo.id, 'Elo extraído do documento');
                    summary.linkedEntities += 1;
                }
            }
        }
        if (sourceNorm.includes('ATIVIDADES CIPAVD 2026') ||
            sourceNorm.includes('CRONOGRAMA DE VISITAS') ||
            sourceNorm.includes('CRONOGRAMA DE CICLO')) {
            const flattened = text.replace(/\n/g, ' ');
            const ranges = [
                ...flattened.matchAll(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]+-\s*[A-Z]{2})[\s\S]{0,30}?(\d{2}[./]\d{2})\s*a\s*(\d{2}[./]\d{2})/g),
            ];
            for (const range of ranges) {
                const localityName = range[1].replace(/\s+/g, ' ').trim();
                const start = extractDateToken(range[2], 2026);
                const end = extractDateToken(range[3], 2026);
                if (!start || !end)
                    continue;
                const code = makeCodeFromName(localityName);
                const mappedLocality = localityByCode.get(code) ?? locality ?? null;
                const title = `Ciclo CIPAVD - ${localityName}`;
                const existing = await prisma.activity.findFirst({
                    where: {
                        title,
                        eventDate: start,
                        localityId: mappedLocality?.id ?? null,
                    },
                });
                const activity = existing ??
                    (await prisma.activity.create({
                        data: {
                            title,
                            description: 'Atividade extraída automaticamente do cronograma oficial do repositório CIPAVD.',
                            localityId: mappedLocality?.id ?? null,
                            eventDate: start,
                            reportRequired: true,
                            status: end.getTime() < Date.now() ? 'DONE' : 'NOT_STARTED',
                        },
                    }));
                if (!existing)
                    summary.createdActivities += 1;
                await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.ACTIVITY, activity.id, 'Atividade extraída do cronograma');
                summary.linkedEntities += 1;
            }
        }
        if (sourceNorm.includes('ATIVIDADES DA CIPAVD NO SMIF') &&
            sourceNorm.includes('VERSAO EQUIPE')) {
            const tokens = text
                .split('|')
                .map((token) => token.trim())
                .filter(Boolean);
            const br = localityByCode.get('BR');
            const phasePrep = phaseByName.get(client_1.PhaseName.PREPARACAO);
            if (br && phasePrep) {
                for (let i = 0; i < tokens.length - 4; i += 1) {
                    const title = tokens[i];
                    const assignee = tokens[i + 2];
                    const dueToken = tokens[i + 3];
                    const execToken = tokens[i + 4];
                    if (!title || title.length < 12)
                        continue;
                    if (normalize(title).includes('RESPONSAVEL') ||
                        normalize(title).includes('ATIVIDADE'))
                        continue;
                    const dueDate = extractDateToken(dueToken, 2026) ??
                        extractDateToken(execToken, 2026) ??
                        parseMonthDueDate(dueToken) ??
                        new Date(Date.UTC(2026, 1, 28));
                    const done = normalize(dueToken).includes('FEITO') ||
                        normalize(execToken).includes('FEITO');
                    let template = await prisma.taskTemplate.findFirst({
                        where: { title },
                    });
                    if (!template) {
                        template = await prisma.taskTemplate.create({
                            data: {
                                title,
                                description: 'Tarefa de execução interna extraída do plano de equipe da CIPAVD.',
                                phaseId: phasePrep.id,
                                appliesToAllLocalities: false,
                                reportRequiredDefault: false,
                            },
                        });
                        summary.createdTaskTemplates += 1;
                        await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.TASK_TEMPLATE, template.id, 'Template extraído do plano de equipe');
                        summary.linkedEntities += 1;
                    }
                    const existingInstance = await prisma.taskInstance.findFirst({
                        where: {
                            taskTemplateId: template.id,
                            localityId: br.id,
                        },
                    });
                    if (!existingInstance) {
                        const task = await prisma.taskInstance.create({
                            data: {
                                taskTemplateId: template.id,
                                localityId: br.id,
                                dueDate,
                                status: done ? client_1.TaskStatus.DONE : client_1.TaskStatus.NOT_STARTED,
                                priority: client_1.TaskPriority.MEDIUM,
                                progressPercent: done ? 100 : 0,
                                reportRequired: false,
                                externalAssigneeName: assignee || null,
                                externalAssigneeRole: 'Comissão CIPAVD',
                            },
                        });
                        summary.createdTaskInstances += 1;
                        await linkDocumentEntity(doc.id, client_1.DocumentLinkEntity.TASK_INSTANCE, task.id, 'Tarefa extraída do plano de equipe');
                        summary.linkedEntities += 1;
                    }
                }
            }
        }
    }
    const [docsWithoutLinks, parseStatusCounts] = await prisma.$transaction([
        prisma.documentAsset.count({
            where: { links: { none: {} } },
        }),
        prisma.documentContent.groupBy({
            by: ['parseStatus'],
            _count: { _all: true },
            orderBy: { parseStatus: 'asc' },
        }),
    ]);
    const notSupportedRow = parseStatusCounts.find((row) => row.parseStatus === client_1.DocumentParseStatus.NOT_SUPPORTED);
    const notSupportedCount = Number(notSupportedRow?._count?._all ?? 0);
    const br = localityByCode.get('BR');
    const phaseFollowUp = phaseByName.get(client_1.PhaseName.ACOMPANHAMENTO);
    if (br && phaseFollowUp) {
        const title = 'Revisar documentos sem vínculo operacional após importação';
        const description = `Validação manual necessária para ${docsWithoutLinks} documento(s) sem vínculo e ${notSupportedCount} arquivo(s) sem extração automática de texto.`;
        let template = await prisma.taskTemplate.findFirst({ where: { title } });
        if (!template) {
            template = await prisma.taskTemplate.create({
                data: {
                    title,
                    description,
                    phaseId: phaseFollowUp.id,
                    appliesToAllLocalities: false,
                    reportRequiredDefault: false,
                },
            });
            summary.createdTaskTemplates += 1;
        }
        if (template.description !== description) {
            await prisma.taskTemplate.update({
                where: { id: template.id },
                data: { description },
            });
        }
        const existing = await prisma.taskInstance.findFirst({
            where: {
                taskTemplateId: template.id,
                localityId: br.id,
            },
        });
        if (!existing) {
            await prisma.taskInstance.create({
                data: {
                    taskTemplateId: template.id,
                    localityId: br.id,
                    dueDate: new Date('2026-03-31T00:00:00.000Z'),
                    status: client_1.TaskStatus.NOT_STARTED,
                    priority: client_1.TaskPriority.HIGH,
                    progressPercent: 0,
                    reportRequired: false,
                },
            });
            summary.createdTaskInstances += 1;
        }
    }
    return summary;
}
async function main() {
    const args = new Set(process.argv.slice(2));
    const shouldReset = args.has('--reset');
    if (!node_fs_1.default.existsSync(repoRoot)) {
        throw new Error(`Repositório não encontrado: ${repoRoot}`);
    }
    if (shouldReset) {
        await clearStorage();
        await resetDatabase();
    }
    await seedRbac();
    await upsertCatalog();
    const localityByCode = await upsertLocalities();
    const { admin, tiUser, gsdUsers } = await upsertUsers(localityByCode);
    const { meeting } = await createMeetings();
    const activitiesByCode = await createActivities(localityByCode);
    await createTaskBacklog(localityByCode, gsdUsers);
    const documents = await importDocuments(localityByCode, meeting.id, activitiesByCode);
    const operationalSync = await syncOperationalDataFromDocuments(localityByCode);
    const summary = {
        repositoryPath: repoRoot,
        resetExecuted: shouldReset,
        localities: localityByCode.size,
        users: await prisma.user.count(),
        taskTemplates: await prisma.taskTemplate.count(),
        taskInstances: await prisma.taskInstance.count(),
        activities: await prisma.activity.count(),
        meetings: await prisma.meeting.count(),
        elos: await prisma.elo.count(),
        documents: await prisma.documentAsset.count(),
        documentContents: await prisma.documentContent.count(),
        documentLinks: await prisma.documentLink.count(),
        importedDocumentsInThisRun: documents.imported,
        operationalSync,
        defaultCredentials: {
            adminEmail: admin.email,
            tiEmail: tiUser.email,
            password: process.env.IMPORT_DEFAULT_PASSWORD ?? 'Smif@2026',
        },
    };
    const outFile = node_path_1.default.join(rootDir, 'docs', 'migration-summary.json');
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(outFile), { recursive: true });
    node_fs_1.default.writeFileSync(outFile, JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import-repositorio.js.map