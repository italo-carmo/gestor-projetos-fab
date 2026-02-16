"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = require("dotenv");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
(0, dotenv_1.config)({ path: node_path_1.default.join(__dirname, '..', '.env') });
const connectionString = process.env.DATABASE_URL ?? 'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
const prisma = new client_1.PrismaClient({ adapter });
const CANDIDATE_ROLES = ['Coordenação CIPAVD', 'Administração Nacional'];
async function main() {
    const permission = await prisma.permission.upsert({
        where: {
            resource_action_scope: {
                resource: 'phases',
                action: 'update',
                scope: client_1.PermissionScope.NATIONAL,
            },
        },
        update: {},
        create: {
            resource: 'phases',
            action: 'update',
            scope: client_1.PermissionScope.NATIONAL,
            description: 'Atualizar nome exibido das fases',
        },
    });
    const roles = await prisma.role.findMany({
        where: { name: { in: CANDIDATE_ROLES } },
        select: { id: true, name: true },
    });
    let grants = 0;
    for (const role of roles) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
            update: {},
            create: { roleId: role.id, permissionId: permission.id },
        });
        grants += 1;
    }
    console.log(JSON.stringify({
        permissionId: permission.id,
        grantedRoles: roles.map((r) => r.name),
        grants,
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
//# sourceMappingURL=grant-phases-update.js.map