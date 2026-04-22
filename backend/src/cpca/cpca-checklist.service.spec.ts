import { HttpException } from '@nestjs/common';
import { CpcaChecklistService } from './cpca-checklist.service';
import { CPCA_CHECKLIST_ITEM_KEYS } from './cpca-checklist.constants';

function createPrismaMock() {
  const prisma: any = {
    om: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    cpcaCommissionPresident: {
      findFirst: jest.fn(),
    },
    cpcaChecklistItem: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    cpcaChecklistHistoryEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  prisma.$transaction = jest.fn(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(prisma);
    }
    return Promise.all(arg);
  });

  return prisma;
}

function createAuditMock() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUser(args: {
  id?: string;
  omId?: string | null;
  roles?: string[];
  permissions?: Array<{ resource: string; action: string; scope: string }>;
}) {
  return {
    id: args.id ?? 'user-1',
    name: 'Usuário Teste',
    email: 'user@test.mil.br',
    omId: args.omId ?? null,
    localityId: args.omId ?? null,
    roles: (args.roles ?? []).map((name) => ({
      id: name,
      name,
      permissions: [],
      wildcard: false,
    })),
    allRoles: (args.roles ?? []).map((name) => ({
      id: name,
      name,
      permissions: [],
      wildcard: false,
    })),
    permissions: args.permissions ?? [],
    moduleAccessOverrides: [],
    executiveHidePii: false,
  };
}

async function expectReason(promise: Promise<unknown>, reason: string) {
  try {
    await promise;
    throw new Error(`Expected promise to reject with reason ${reason}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Expected promise')
    ) {
      throw error;
    }
    const err = error as HttpException & {
      response?: { code?: string; details?: { reason?: string } };
    };
    const response =
      typeof err.getResponse === 'function'
        ? (err.getResponse() as any)
        : err.response;
    expect(response?.details?.reason ?? response?.code).toBe(reason);
  }
}

function buildPayload(
  overrides?: Record<
    string,
    Partial<{
      isCompleted: boolean;
      completedAt: string | null;
      details: string | null;
      speakerName: string | null;
      historyEntries: Array<{
        id?: string | null;
        completedAt: string;
        details?: string | null;
        speakerName?: string | null;
      }>;
    }>
  >,
) {
  return CPCA_CHECKLIST_ITEM_KEYS.map((itemKey) => {
    const override = overrides?.[itemKey] ?? {};
    return {
      itemKey,
      isCompleted: override.isCompleted ?? false,
      completedAt: override.completedAt ?? null,
      details: override.details ?? null,
      speakerName: override.speakerName ?? null,
      historyEntries: override.historyEntries ?? undefined,
    };
  });
}

describe('CpcaChecklistService', () => {
  const om = {
    id: 'om-1',
    code: 'BACO',
    name: 'Base Aérea de Canoas',
    uf: 'RS',
    hasCpca: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna checklist vazio por padrão para a OM do usuário', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'president-1',
    });
    prisma.cpcaChecklistItem.findMany.mockResolvedValue([]);
    prisma.cpcaChecklistHistoryEntry.findMany.mockResolvedValue([]);

    const result = await service.getLocalityChecklist(
      makeUser({
        id: 'president-1',
        omId: om.id,
        permissions: [
          { resource: 'cpca_cases', action: 'view', scope: 'LOCALITY' },
          { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
        ],
      }) as any,
      undefined,
    );

    expect(result.locality).toEqual(om);
    expect(result.canEdit).toBe(true);
    expect(result.checklist.summary.status).toBe('NOT_STARTED');
    expect(result.checklist.items).toHaveLength(
      CPCA_CHECKLIST_ITEM_KEYS.length,
    );
    expect(
      result.checklist.items.every((item: any) => item.isCompleted === false),
    ).toBe(true);
  });

  it('impede atualização por usuário que não é o presidente atual', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);

    await expectReason(
      service.updateLocalityChecklist(
        {
          items: buildPayload(),
        },
        makeUser({
          id: 'member-1',
          omId: om.id,
          permissions: [
            { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
          ],
        }) as any,
      ),
      'RBAC_FORBIDDEN',
    );
  });

  it('exige detalhamento e palestrante quando a palestra é marcada como concluída', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'president-1',
    });
    prisma.cpcaChecklistHistoryEntry.findMany.mockResolvedValue([]);

    await expectReason(
      service.updateLocalityChecklist(
        {
          items: buildPayload({
            PALESTRA: {
              isCompleted: true,
              completedAt: '2026-04-21',
              details: null,
              speakerName: 'Cel Palestrante',
            },
          }),
        },
        makeUser({
          id: 'president-1',
          omId: om.id,
          permissions: [
            { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
          ],
        }) as any,
      ),
      'CPCA_CHECKLIST_PALESTRA_DETAILS_REQUIRED',
    );
  });

  it('exige e-mail válido quando o item de e-mail direto é marcado como concluído', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'president-1',
    });
    prisma.cpcaChecklistHistoryEntry.findMany.mockResolvedValue([]);

    await expectReason(
      service.updateLocalityChecklist(
        {
          items: buildPayload({
            EMAIL_DIRETO_RELATOS: {
              isCompleted: true,
              completedAt: '2026-04-21',
              details: 'email-invalido',
            },
          }),
        },
        makeUser({
          id: 'president-1',
          omId: om.id,
          permissions: [
            { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
          ],
        }) as any,
      ),
      'INVALID_CPCA_CHECKLIST_EMAIL',
    );
  });

  it('exige URL válida quando o item de divulgação na intraer é marcado como concluído', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'president-1',
    });
    prisma.cpcaChecklistHistoryEntry.findMany.mockResolvedValue([]);

    await expectReason(
      service.updateLocalityChecklist(
        {
          items: buildPayload({
            LINK_INTRAER_CPCA: {
              isCompleted: true,
              completedAt: '2026-04-21',
              details: 'link sem espaco invalido .fab',
            },
          }),
        },
        makeUser({
          id: 'president-1',
          omId: om.id,
          permissions: [
            { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
          ],
        }) as any,
      ),
      'INVALID_CPCA_CHECKLIST_URL',
    );
  });

  it('salva checklist completo e gera resumo/auditoria', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'president-1',
    });
    prisma.cpcaChecklistHistoryEntry.findMany.mockResolvedValue([]);
    prisma.cpcaChecklistItem.findMany.mockResolvedValue([
      {
        itemKey: 'PALESTRA',
        isCompleted: true,
        completedAt: new Date('2026-04-21T12:00:00.000Z'),
        details: 'Palestra sobre prevenção.',
        speakerName: 'Maj Silva',
        updatedAt: new Date('2026-04-21T13:00:00.000Z'),
      },
      {
        itemKey: 'MATERIAIS_INFORMATIVOS',
        isCompleted: true,
        completedAt: new Date('2026-04-20T12:00:00.000Z'),
        details: 'Cartilha distribuída no efetivo.',
        speakerName: null,
        updatedAt: new Date('2026-04-20T12:30:00.000Z'),
      },
    ]);
    prisma.cpcaChecklistHistoryEntry.create
      .mockResolvedValueOnce({
        id: 'hist-1',
        itemKey: 'PALESTRA',
        completedAt: new Date('2026-04-21T12:00:00.000Z'),
        details: 'Palestra sobre prevenção.',
        speakerName: 'Maj Silva',
        createdAt: new Date('2026-04-21T12:05:00.000Z'),
        updatedAt: new Date('2026-04-21T12:05:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'hist-2',
        itemKey: 'MATERIAIS_INFORMATIVOS',
        completedAt: new Date('2026-04-20T12:00:00.000Z'),
        details: 'Cartilha distribuída no efetivo.',
        speakerName: null,
        createdAt: new Date('2026-04-20T12:05:00.000Z'),
        updatedAt: new Date('2026-04-20T12:05:00.000Z'),
      });
    prisma.cpcaChecklistHistoryEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: 'hist-1',
          itemKey: 'PALESTRA',
          completedAt: new Date('2026-04-21T12:00:00.000Z'),
          details: 'Palestra sobre prevenção.',
          speakerName: 'Maj Silva',
          createdAt: new Date('2026-04-21T12:05:00.000Z'),
          updatedAt: new Date('2026-04-21T12:05:00.000Z'),
        },
        {
          id: 'hist-2',
          itemKey: 'MATERIAIS_INFORMATIVOS',
          completedAt: new Date('2026-04-20T12:00:00.000Z'),
          details: 'Cartilha distribuída no efetivo.',
          speakerName: null,
          createdAt: new Date('2026-04-20T12:05:00.000Z'),
          updatedAt: new Date('2026-04-20T12:05:00.000Z'),
        },
      ]);

    const result = await service.updateLocalityChecklist(
      {
        items: buildPayload({
          PALESTRA: {
            isCompleted: true,
            completedAt: '2026-04-21',
            details: 'Palestra sobre prevenção.',
            speakerName: 'Maj Silva',
          },
          MATERIAIS_INFORMATIVOS: {
            isCompleted: true,
            completedAt: '2026-04-20',
            details: 'Cartilha distribuída no efetivo.',
          },
        }),
      },
      makeUser({
        id: 'president-1',
        omId: om.id,
        permissions: [
          { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
        ],
      }) as any,
    );

    expect(prisma.cpcaChecklistItem.upsert).toHaveBeenCalledTimes(
      CPCA_CHECKLIST_ITEM_KEYS.length,
    );
    expect(prisma.cpcaChecklistHistoryEntry.create).toHaveBeenCalledTimes(2);
    expect(result.checklist.summary.completedCount).toBe(2);
    expect(result.checklist.summary.pendingCount).toBe(
      CPCA_CHECKLIST_ITEM_KEYS.length - 2,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cpca_commission_checklist_update',
        localityId: om.id,
      }),
    );
  });

  it('rejeita payload sem o conjunto completo de itens do checklist', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'president-1',
    });
    prisma.cpcaChecklistHistoryEntry.findMany.mockResolvedValue([]);

    await expectReason(
      service.updateLocalityChecklist(
        {
          items: buildPayload().slice(0, CPCA_CHECKLIST_ITEM_KEYS.length - 1),
        },
        makeUser({
          id: 'president-1',
          omId: om.id,
          permissions: [
            { resource: 'cpca_cases', action: 'update', scope: 'LOCALITY' },
          ],
        }) as any,
      ),
      'CPCA_CHECKLIST_ITEMS_REQUIRED',
    );
  });

  it('lista visão nacional apenas para quem possui permissão nacional do checklist', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaChecklistService(prisma as any, audit as any);

    prisma.om.findMany.mockResolvedValue([
      {
        ...om,
        cpcaCommissionPresident: {
          assignedAt: new Date('2026-04-19T10:00:00.000Z'),
          isSubstitution: false,
          designationBulletin: 'BOL 001',
          user: {
            id: 'president-1',
            name: 'Cel Presidente',
            email: 'pres@fab.mil.br',
          },
        },
        cpcaChecklistItems: [
          {
            itemKey: 'PALESTRA',
            isCompleted: true,
            completedAt: new Date('2026-04-21T12:00:00.000Z'),
            details: 'Palestra concluída.',
            speakerName: 'Maj Silva',
            updatedAt: new Date('2026-04-21T12:00:00.000Z'),
          },
        ],
        cpcaChecklistHistoryEntries: [
          {
            id: 'hist-1',
            itemKey: 'PALESTRA',
            completedAt: new Date('2026-04-21T12:00:00.000Z'),
            details: 'Palestra concluída.',
            speakerName: 'Maj Silva',
            createdAt: new Date('2026-04-21T12:05:00.000Z'),
            updatedAt: new Date('2026-04-21T12:05:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.listNationalChecklistOverview(
      makeUser({
        id: 'ti-1',
        permissions: [
          { resource: 'cpca_checklist', action: 'view', scope: 'NATIONAL' },
        ],
      }) as any,
      {},
    );

    expect(result.items).toHaveLength(1);
    expect(result.summary.totalCount).toBe(1);
    expect(result.items[0].checklist.summary.status).toBe('IN_PROGRESS');
    expect(
      result.items[0].checklist.items.find(
        (item: any) => item.itemKey === 'PALESTRA',
      )?.historyCount,
    ).toBe(1);

    await expectReason(
      service.listNationalChecklistOverview(
        makeUser({
          id: 'cpca-local',
          omId: om.id,
          permissions: [
            { resource: 'cpca_cases', action: 'view', scope: 'LOCALITY' },
          ],
        }) as any,
        {},
      ),
      'RBAC_FORBIDDEN',
    );
  });
});
