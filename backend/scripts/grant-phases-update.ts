import path from 'node:path';
import { config } from 'dotenv';
import { PrismaClient, PermissionScope } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL ?? 'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const CANDIDATE_ROLES = ['Coordenação CIPAVD', 'Administração Nacional'];

async function main() {
  const permission = await prisma.permission.upsert({
    where: {
      resource_action_scope: {
        resource: 'phases',
        action: 'update',
        scope: PermissionScope.NATIONAL,
      },
    },
    update: {},
    create: {
      resource: 'phases',
      action: 'update',
      scope: PermissionScope.NATIONAL,
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

  console.log(
    JSON.stringify(
      {
        permissionId: permission.id,
        grantedRoles: roles.map((r) => r.name),
        grants,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
