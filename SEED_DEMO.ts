/**
 * seed_demo.ts — Carrega sample_data/ no banco (Prisma)
 *
 * Objetivo: “apertar botões e ver andar” (tarefas, prazos diferentes, alguns atrasos, responsáveis, dashboards).
 *
 * Uso:
 *  - `node prisma/seed_demo.ts` (ou via ts-node)
 */
import { PrismaClient, PermissionScope, TaskPriority, TaskStatus } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const dataDir = path.join(__dirname, "docs", "sample_data");
const rbacPath = path.join(__dirname, "RBAC_MATRIX.json");

function readJson<T>(fileName: string): T {
  const full = path.join(dataDir, fileName);
  return JSON.parse(fs.readFileSync(full, "utf-8"));
}

async function main() {
  const rbacMatrix = JSON.parse(fs.readFileSync(rbacPath, "utf-8"));
  const localities = readJson<any[]>("localities.json");
  const specialties = readJson<any[]>("specialties.json");
  const phases = readJson<any[]>("phases.json");
  const users = readJson<any[]>("users.json");
  const taskTemplates = readJson<any[]>("task_templates.json");
  const taskInstances = readJson<any[]>("task_instances.json");
  const meetings = readJson<any[]>("meetings.json");
  const recruitsHistory = readJson<any[]>("recruits_history.json");
  const notices = readJson<any[]>("notices.json");
  const checklists = readJson<any[]>("checklists.json");
  const checklistItems = readJson<any[]>("checklist_items.json");
  const elos = readJson<any[]>("elos.json");

  // Permissions catalog
  const matrixPermissions = new Map<string, { resource: string; action: string; scope: PermissionScope }>();
  for (const role of rbacMatrix.roles ?? []) {
    for (const perm of role.permissions ?? []) {
      const key = `${perm.resource}:${perm.action}:${perm.scope}`;
      if (!matrixPermissions.has(key)) {
        matrixPermissions.set(key, {
          resource: perm.resource,
          action: perm.action,
          scope: perm.scope as PermissionScope,
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

  // Roles
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
        OR: role.permissions.map((perm: any) => ({
          resource: perm.resource,
          action: perm.action,
          scope: perm.scope,
        })),
      },
      select: { id: true },
    });

    const roleRecord = await prisma.role.findUnique({ where: { name: role.name } });
    if (!roleRecord) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId: roleRecord.id } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map((perm: { id: string }) => ({ roleId: roleRecord.id, permissionId: perm.id })),
    });
  }

  // Specialties
  for (const s of specialties) {
    await prisma.specialty.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name },
    });
  }

  // Localities
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

  // Phases
  for (const p of phases) {
    await prisma.phase.upsert({
      where: { name: p.name },
      update: { order: p.order },
      create: { name: p.name, order: p.order },
    });
  }

  // Users
  for (const u of users) {
    const role = await prisma.role.findUnique({ where: { name: u.roleName } });
    if (!role) continue;
    const locality = u.localityCode ? await prisma.locality.findUnique({ where: { code: u.localityCode } }) : null;
    const hash = await bcrypt.hash(u.password, 10);
    const execFlag = role.flagsJson && (role.flagsJson as any).executive_hide_pii === true;

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

  // Meetings (nacional)
  for (const m of meetings) {
    await prisma.meeting.create({
      data: {
        datetime: new Date(m.datetime),
        scope: m.scope,
        status: m.status,
        agenda: m.agenda ?? null,
      } as any,
    });
  }

  // TaskTemplates
  for (const tt of taskTemplates) {
    const phase = await prisma.phase.findUnique({ where: { name: tt.phaseName } });
    const specialty = tt.specialtyName ? await prisma.specialty.findUnique({ where: { name: tt.specialtyName } }) : null;
    if (!phase) continue;

    await prisma.taskTemplate.create({
      data: {
        title: tt.title,
        description: tt.description ?? null,
        phaseId: phase.id,
        specialtyId: specialty?.id ?? null,
        appliesToAllLocalities: !!tt.appliesToAllLocalities,
        reportRequiredDefault: !!tt.reportRequiredDefault,
      } as any,
    });
  }

  // TaskInstances (por localidade)
  const templatesInDb = await prisma.taskTemplate.findMany({ include: { phase: true, specialty: true } });
  const templateByTitle = new Map<string, { id: string; title: string }>(
    templatesInDb.map((t: { id: string; title: string }) => [t.title, t]),
  );

  for (const ti of taskInstances) {
    const tmpl = templateByTitle.get(ti.taskTitle);
    if (!tmpl) continue;

    const locality = await prisma.locality.findUnique({ where: { code: ti.localityCode } });
    if (!locality) continue;

    const assignee = ti.assignedToEmail ? await prisma.user.findUnique({ where: { email: ti.assignedToEmail } }) : null;

    await prisma.taskInstance.create({
      data: {
        taskTemplateId: tmpl.id,
        localityId: locality.id,
        dueDate: new Date(ti.dueDate),
        status: ti.status as TaskStatus,
        priority: ti.priority as TaskPriority,
        progressPercent: ti.progressPercent ?? 0,
        assignedToId: assignee?.id ?? null,
        reportRequired: !!ti.reportRequired,
      } as any,
    });
  }

  // Recruits history
  for (const entry of recruitsHistory) {
    const locality = await prisma.locality.findUnique({ where: { code: entry.localityCode } });
    if (!locality) continue;
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

  // Notices
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
      } as any,
    });
  }

  // Checklists
  const checklistByTitle = new Map<string, string>();
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

  // Checklist items
  for (const item of checklistItems) {
    const checklistId = checklistByTitle.get(item.checklistTitle);
    if (!checklistId) continue;
    const template = item.taskTitle ? templateByTitle.get(item.taskTitle) : null;
    await prisma.checklistItem.create({
      data: {
        checklistId,
        title: item.title,
        taskTemplateId: template?.id ?? null,
      },
    });
  }

  // Elos
  for (const elo of elos) {
    const locality = await prisma.locality.findUnique({ where: { code: elo.localityCode } });
    if (!locality) continue;
    await prisma.elo.create({
      data: {
        localityId: locality.id,
        roleType: elo.roleType,
        name: elo.name,
        rank: elo.rank ?? null,
        phone: elo.phone ?? null,
        email: elo.email ?? null,
        om: elo.om ?? null,
      } as any,
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
