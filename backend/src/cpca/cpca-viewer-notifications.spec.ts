import { CpcaService, CPCA_WORKFLOW_CONTEXT } from './cpca.service';

function createPrismaMock() {
  return {
    cpcComplaintCase: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    cpcComplaintCipavdThread: {
      findMany: jest.fn(),
    },
    cpcComplaintCaseRead: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input({});
    }),
  } as any;
}

function createAuditMock() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

function makeManagementUser() {
  return {
    id: 'user-1',
    name: 'Coordenação CIPAVD',
    email: 'coord@test.mil.br',
    omId: null,
    localityId: null,
    roles: [{ id: 'role-1', name: 'Coordenação CIPAVD', permissions: [] }],
    allRoles: [{ id: 'role-1', name: 'Coordenação CIPAVD', permissions: [] }],
    permissions: [
      { resource: 'cpca_cases', action: 'view', scope: 'NATIONAL' },
    ],
    moduleAccessOverrides: [],
  };
}

function makeComplaint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    caseNumber: 'CPCA-2026-BACO-00001',
    workflowScope: 'CPCA',
    omId: 'om-1',
    localityId: null,
    complaintType: 'MORAL',
    status: 'RECEIVED',
    procedureType: 'NOT_DEFINED',
    procedureCurrentSituation: null,
    reportedAt: new Date('2026-05-01T10:00:00.000Z'),
    createdAt: new Date('2026-05-01T10:05:00.000Z'),
    updatedAt: new Date('2026-05-01T10:05:00.000Z'),
    comments: [],
    om: { id: 'om-1', code: 'CCA BR', name: 'CCA BR' },
    locality: null,
    ...overrides,
  };
}

describe('CpcaService viewer notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marca denuncia nova na lista para perfil de gestao sem leitura', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);

    prisma.cpcComplaintCase.findMany.mockResolvedValue([makeComplaint()]);
    prisma.cpcComplaintCase.count.mockResolvedValue(1);
    prisma.cpcComplaintCipavdThread.findMany.mockResolvedValue([]);
    prisma.cpcComplaintCaseRead.findMany.mockResolvedValue([]);

    const result = await service.list(
      {},
      makeManagementUser() as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result.items[0]).toMatchObject({
      id: 'case-1',
      isNewForViewer: true,
      viewerNotification: {
        tracked: true,
        isNew: true,
        reason: 'NEW_COMPLAINT',
        label: 'Nova denúncia',
        seenAt: null,
      },
    });
  });

  it('marca solucao de pendencia como nova quando ocorreu depois da leitura', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);

    prisma.cpcComplaintCase.findMany.mockResolvedValue([makeComplaint()]);
    prisma.cpcComplaintCase.count.mockResolvedValue(1);
    prisma.cpcComplaintCipavdThread.findMany.mockResolvedValue([
      {
        complaintCaseId: 'case-1',
        type: 'PENDENCY',
        status: 'RESOLVED',
        resolvedAt: new Date('2026-05-03T14:00:00.000Z'),
        lastMessageAt: new Date('2026-05-03T14:00:00.000Z'),
      },
    ]);
    prisma.cpcComplaintCaseRead.findMany.mockResolvedValue([
      {
        complaintCaseId: 'case-1',
        seenAt: new Date('2026-05-02T10:00:00.000Z'),
      },
    ]);

    const result = await service.list(
      {},
      makeManagementUser() as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result.items[0]).toMatchObject({
      isNewForViewer: true,
      viewerNotification: {
        reason: 'PENDENCY_RESOLVED',
        label: 'Solução de pendência',
        seenAt: '2026-05-02T10:00:00.000Z',
      },
    });
  });

  it('registra leitura ao abrir a denuncia', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);
    const complaint = makeComplaint({ cipavdThreads: [] });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue(complaint);
    prisma.cpcComplaintCaseRead.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCaseRead.upsert.mockResolvedValue({});

    const result = await service.markComplaintSeen(
      'case-1',
      makeManagementUser() as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toMatchObject({
      ok: true,
      tracked: true,
      viewerNotification: {
        tracked: true,
        wasNew: true,
        isNew: false,
      },
    });
    expect(prisma.cpcComplaintCaseRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_complaintCaseId: {
            userId: 'user-1',
            complaintCaseId: 'case-1',
          },
        },
      }),
    );
  });
});
