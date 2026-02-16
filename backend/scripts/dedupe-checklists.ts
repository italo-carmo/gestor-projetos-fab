import path from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL ?? 'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function checklistKey(item: { title: string; phaseId: string | null; specialtyId: string | null; eloRoleId: string | null }) {
  return [normalizeText(item.title), item.phaseId ?? '', item.specialtyId ?? '', item.eloRoleId ?? ''].join('|');
}

function checklistItemKey(item: { title: string; taskTemplateId: string | null }) {
  return [normalizeText(item.title), item.taskTemplateId ?? ''].join('|');
}

async function main() {
  const apply = process.argv.includes('--apply');

  const checklists = await prisma.checklist.findMany({
    include: {
      items: {
        select: {
          id: true,
          title: true,
          taskTemplateId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const groups = new Map<string, typeof checklists>();
  for (const checklist of checklists) {
    const key = checklistKey(checklist);
    const list = groups.get(key) ?? [];
    list.push(checklist);
    groups.set(key, list);
  }

  const duplicateGroups = Array.from(groups.values()).filter((g) => g.length > 1);

  let movedItems = 0;
  let skippedItems = 0;
  let deletedChecklists = 0;

  for (const group of duplicateGroups) {
    const sorted = [...group].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const keeper = sorted[0];
    const duplicates = sorted.slice(1);
    const keeperItemKeys = new Set(keeper.items.map((item) => checklistItemKey(item)));

    for (const duplicate of duplicates) {
      for (const item of duplicate.items) {
        const key = checklistItemKey(item);
        if (keeperItemKeys.has(key)) {
          skippedItems += 1;
          continue;
        }

        if (apply) {
          await prisma.checklistItem.update({
            where: { id: item.id },
            data: { checklistId: keeper.id },
          });
        }

        keeperItemKeys.add(key);
        movedItems += 1;
      }

      if (apply) {
        await prisma.checklist.delete({ where: { id: duplicate.id } });
      }
      deletedChecklists += 1;
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    totalChecklists: checklists.length,
    duplicateGroups: duplicateGroups.length,
    deletedChecklists,
    movedItems,
    skippedItems,
  };

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
