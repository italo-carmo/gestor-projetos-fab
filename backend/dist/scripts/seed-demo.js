"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ path: node_path_1.default.join(__dirname, "..", ".env") });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const node_fs_1 = __importDefault(require("node:fs"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const connectionString = process.env.DATABASE_URL ?? "postgresql://smif:smif@localhost:5432/smif_gestao";
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
const prisma = new client_1.PrismaClient({ adapter });
const rootDir = node_path_1.default.join(__dirname, "..", "..");
const dataDir = node_path_1.default.join(rootDir, "docs", "sample_data");
const rbacPath = node_path_1.default.join(rootDir, "RBAC_MATRIX.json");
function readJson(fileName) {
    const full = node_path_1.default.join(dataDir, fileName);
    return JSON.parse(node_fs_1.default.readFileSync(full, "utf-8"));
}
async function main() {
    const rbacMatrix = JSON.parse(node_fs_1.default.readFileSync(rbacPath, "utf-8"));
    const localities = readJson("localities.json");
    const specialties = readJson("specialties.json");
    const phases = readJson("phases.json");
    const users = readJson("users.json");
    const taskTemplates = readJson("task_templates.json");
    const taskInstances = readJson("task_instances.json");
    const meetings = readJson("meetings.json");
    const recruitsHistory = readJson("recruits_history.json");
    const notices = readJson("notices.json");
    const checklists = readJson("checklists.json");
    const checklistItems = readJson("checklist_items.json");
    const elos = readJson("elos.json");
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
        await prisma.role.upsert({
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
        const permissionIds = await prisma.permission.findMany({
            where: {
                OR: role.permissions.map((perm) => ({
                    resource: perm.resource,
                    action: perm.action,
                    scope: perm.scope,
                })),
            },
            select: { id: true },
        });
        const roleRecord = await prisma.role.findUnique({ where: { name: role.name } });
        if (!roleRecord)
            continue;
        await prisma.rolePermission.deleteMany({ where: { roleId: roleRecord.id } });
        await prisma.rolePermission.createMany({
            data: permissionIds.map((perm) => ({ roleId: roleRecord.id, permissionId: perm.id })),
        });
    }
    for (const s of specialties) {
        await prisma.specialty.upsert({
            where: { name: s.name },
            update: {},
            create: { name: s.name },
        });
    }
    for (const l of localities) {
        await prisma.locality.upsert({
            where: { code: l.code },
            update: {
                name: l.name,
                commandName: l.commandName ?? null,
                commanderName: l.commanderName ?? null,
                visitDate: l.visitDate ? new Date(l.visitDate) : null,
                recruitsFemaleCountCurrent: l.recruitsFemaleCountCurrent ?? null,
                notes: l.notes ?? null,
            },
            create: {
                code: l.code,
                name: l.name,
                commandName: l.commandName ?? null,
                commanderName: l.commanderName ?? null,
                visitDate: l.visitDate ? new Date(l.visitDate) : null,
                recruitsFemaleCountCurrent: l.recruitsFemaleCountCurrent ?? null,
                notes: l.notes ?? null,
            },
        });
    }
    for (const p of phases) {
        await prisma.phase.upsert({
            where: { name: p.name },
            update: { order: p.order },
            create: { name: p.name, order: p.order },
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
    for (const u of users) {
        const role = await prisma.role.findUnique({ where: { name: u.roleName } });
        if (!role)
            continue;
        const locality = u.localityCode ? await prisma.locality.findUnique({ where: { code: u.localityCode } }) : null;
        const hash = await bcrypt_1.default.hash(u.password, 10);
        const execFlag = !!(role.flagsJson && role.flagsJson.executive_hide_pii === true);
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                name: u.name,
                localityId: locality?.id ?? null,
                passwordHash: hash,
                isActive: true,
                executiveHidePii: execFlag,
            },
            create: {
                name: u.name,
                email: u.email,
                passwordHash: hash,
                localityId: locality?.id ?? null,
                isActive: true,
                executiveHidePii: execFlag,
            },
        });
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: role.id } },
            update: {},
            create: { userId: user.id, roleId: role.id },
        });
    }
    for (const m of meetings) {
        await prisma.meeting.create({
            data: {
                datetime: new Date(m.datetime),
                scope: typeof m.scope === 'string' ? m.scope : (m.scope ?? ''),
                status: m.status,
                meetingType: m.meetingType ?? 'PRESENCIAL',
                meetingLink: m.meetingLink ?? null,
                agenda: m.agenda ?? null,
                localityId: m.localityId ?? null,
            },
        });
    }
    for (const tt of taskTemplates) {
        const phase = await prisma.phase.findUnique({ where: { name: tt.phaseName } });
        const specialty = tt.specialtyName ? await prisma.specialty.findUnique({ where: { name: tt.specialtyName } }) : null;
        if (!phase)
            continue;
        await prisma.taskTemplate.create({
            data: {
                title: tt.title,
                description: tt.description ?? null,
                phaseId: phase.id,
                specialtyId: specialty?.id ?? null,
                appliesToAllLocalities: !!tt.appliesToAllLocalities,
                reportRequiredDefault: !!tt.reportRequiredDefault,
            },
        });
    }
    const templatesInDb = await prisma.taskTemplate.findMany({ include: { phase: true, specialty: true } });
    const templateByTitle = new Map(templatesInDb.map((t) => [t.title, t]));
    for (const ti of taskInstances) {
        const tmpl = templateByTitle.get(ti.taskTitle);
        if (!tmpl)
            continue;
        const locality = await prisma.locality.findUnique({ where: { code: ti.localityCode } });
        if (!locality)
            continue;
        const assignee = ti.assignedToEmail ? await prisma.user.findUnique({ where: { email: ti.assignedToEmail } }) : null;
        await prisma.taskInstance.create({
            data: {
                taskTemplateId: tmpl.id,
                localityId: locality.id,
                dueDate: new Date(ti.dueDate),
                status: ti.status,
                priority: ti.priority,
                progressPercent: ti.progressPercent ?? 0,
                assignedToId: assignee?.id ?? null,
                reportRequired: !!ti.reportRequired,
            },
        });
    }
    for (const entry of recruitsHistory) {
        const locality = await prisma.locality.findUnique({ where: { code: entry.localityCode } });
        if (!locality)
            continue;
        await prisma.recruitsHistory.upsert({
            where: { localityId_date: { localityId: locality.id, date: new Date(entry.date) } },
            update: {
                recruitsFemaleCount: entry.recruitsFemaleCount,
                turnoverCount: entry.turnoverCount,
            },
            create: {
                localityId: locality.id,
                date: new Date(entry.date),
                recruitsFemaleCount: entry.recruitsFemaleCount,
                turnoverCount: entry.turnoverCount,
            },
        });
    }
    for (const notice of notices) {
        const locality = notice.localityCode
            ? await prisma.locality.findUnique({ where: { code: notice.localityCode } })
            : null;
        const specialty = notice.specialtyName
            ? await prisma.specialty.findUnique({ where: { name: notice.specialtyName } })
            : null;
        await prisma.notice.create({
            data: {
                title: notice.title,
                body: notice.body,
                localityId: locality?.id ?? null,
                specialtyId: specialty?.id ?? null,
                dueDate: notice.dueDate ? new Date(notice.dueDate) : null,
                priority: notice.priority ?? 'MEDIUM',
                pinned: !!notice.pinned,
            },
        });
    }
    const checklistByTitle = new Map();
    for (const checklist of checklists) {
        const phase = checklist.phaseName
            ? await prisma.phase.findUnique({ where: { name: checklist.phaseName } })
            : null;
        const specialty = checklist.specialtyName
            ? await prisma.specialty.findUnique({ where: { name: checklist.specialtyName } })
            : null;
        const created = await prisma.checklist.create({
            data: {
                title: checklist.title,
                phaseId: phase?.id ?? null,
                specialtyId: specialty?.id ?? null,
            },
        });
        checklistByTitle.set(checklist.title, created.id);
    }
    for (const item of checklistItems) {
        const checklistId = checklistByTitle.get(item.checklistTitle);
        if (!checklistId)
            continue;
        const template = item.taskTitle ? templateByTitle.get(item.taskTitle) : null;
        await prisma.checklistItem.create({
            data: {
                checklistId,
                title: item.title,
                taskTemplateId: template?.id ?? null,
            },
        });
    }
    const eloRoleLabelByCode = {
        PSICOLOGIA: 'Psicologia',
        SSO: 'SSO',
        JURIDICO: 'Jurídico',
        CPCA: 'CPCA',
        GRAD_MASTER: 'Graduado Master',
    };
    for (const code of Object.keys(eloRoleLabelByCode)) {
        await prisma.eloRole.upsert({
            where: { code },
            update: {
                name: eloRoleLabelByCode[code],
            },
            create: {
                code,
                name: eloRoleLabelByCode[code],
            },
        });
    }
    for (const elo of elos) {
        const locality = await prisma.locality.findUnique({ where: { code: elo.localityCode } });
        const eloRole = await prisma.eloRole.findUnique({ where: { code: elo.roleType } });
        if (!locality)
            continue;
        if (!eloRole)
            continue;
        await prisma.elo.create({
            data: {
                localityId: locality.id,
                eloRoleId: eloRole.id,
                name: elo.name,
                rank: elo.rank ?? null,
                phone: elo.phone ?? null,
                email: elo.email ?? null,
                om: elo.om ?? null,
            },
        });
    }
    console.log("Seed demo finalizado ✅");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-demo.js.map