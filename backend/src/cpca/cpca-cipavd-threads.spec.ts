import { HttpException } from '@nestjs/common';
import { CpcaService, CPCA_WORKFLOW_CONTEXT } from './cpca.service';

function createPrismaMock() {
  const tx = {
    cpcComplaintCipavdThread: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    cpcComplaintCipavdMessage: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    cpcComplaintCase: {
      findUnique: jest.fn(),
    },
    cpcComplaintCipavdThread: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    cpcComplaintCipavdMessage: {
      findFirst: jest.fn(),
    },
    cpcaCommissionPresident: {
      findFirst: jest.fn(),
    },
    cpcaCommissionCoverageOm: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (input: any) => {
      if (typeof input === 'function') {
        return input(tx);
      }
      return Promise.all(input);
    }),
    __tx: tx,
  } as any;
}

function createAuditMock() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUser(args: {
  id?: string;
  omId?: string;
  roleName: string;
  scope: 'LOCALITY' | 'NATIONAL';
}) {
  return {
    id: args.id ?? 'user-1',
    name: 'Usuário Teste',
    email: 'teste@fab.mil.br',
    omId: args.omId ?? 'om-1',
    localityId: args.omId ?? 'om-1',
    roles: [{ id: 'role-1', name: args.roleName, permissions: [] }],
    allRoles: [{ id: 'role-1', name: args.roleName, permissions: [] }],
    permissions: [
      {
        resource: 'cpca_cases',
        action: 'view',
        scope: args.scope,
      },
    ],
    moduleAccessOverrides: [],
  };
}

async function expectReason(promise: Promise<unknown>, reason: string) {
  expect.assertions(1);
  try {
    await promise;
  } catch (error) {
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

describe('CpcaService CIPAVD threads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite que a gestão nacional abra uma pendência no caso', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);
    const user = makeUser({
      roleName: 'Coordenação CIPAVD',
      scope: 'NATIONAL',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);
    prisma.__tx.cpcComplaintCipavdThread.create.mockResolvedValue({
      id: 'thread-1',
    });
    prisma.__tx.cpcComplaintCipavdMessage.create.mockResolvedValue({
      id: 'message-1',
    });
    prisma.__tx.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 0,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      resolvedAt: null,
      closedAt: null,
      lastMessageAt: new Date('2026-04-22T10:00:00.000Z'),
      createdBy: { id: user.id, name: user.name, email: user.email },
      resolvedBy: null,
      closedBy: null,
      messages: [
        {
          id: 'message-1',
          body: 'Ajustar documentação pendente.',
          authorKind: 'MANAGEMENT',
          type: 'MESSAGE',
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
      ],
    });

    const result = await service.createCipavdThread(
      'case-1',
      {
        text: 'Ajustar documentação pendente.',
        isPending: true,
      },
      user as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toMatchObject({
      id: 'thread-1',
      type: 'PENDENCY',
      status: 'OPEN',
      statusLabel: 'Em aberto',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cipavd_pendency_create',
        entityId: 'case-1',
      }),
    );
  });

  it('permite que o presidente responda e resolva a pendência', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);
    const user = makeUser({
      id: 'president-1',
      omId: 'om-1',
      roleName: 'CPCA',
      scope: 'LOCALITY',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionCoverageOm.findMany.mockResolvedValue([]);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'pres-1',
    });
    prisma.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      complaintCaseId: 'case-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 0,
      complaintCase: { workflowScope: 'CPCA' },
    });
    prisma.__tx.cpcComplaintCipavdMessage.create.mockResolvedValue({
      id: 'message-2',
    });
    prisma.__tx.cpcComplaintCipavdThread.update.mockResolvedValue({
      id: 'thread-1',
    });
    prisma.__tx.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      type: 'PENDENCY',
      status: 'RESOLVED',
      reopenedCount: 0,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      resolvedAt: new Date('2026-04-22T11:00:00.000Z'),
      closedAt: null,
      lastMessageAt: new Date('2026-04-22T11:00:00.000Z'),
      createdBy: {
        id: 'manager-1',
        name: 'Coordenação CIPAVD',
        email: 'coord@fab.mil.br',
      },
      resolvedBy: { id: user.id, name: user.name, email: user.email },
      closedBy: null,
      messages: [
        {
          id: 'message-1',
          body: 'Falta anexar o despacho.',
          authorKind: 'MANAGEMENT',
          type: 'MESSAGE',
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          createdBy: {
            id: 'manager-1',
            name: 'Coordenação CIPAVD',
            email: 'coord@fab.mil.br',
          },
        },
        {
          id: 'message-2',
          body: 'Despacho anexado e procedimento atualizado.',
          authorKind: 'PRESIDENT',
          type: 'RESOLUTION',
          createdAt: new Date('2026-04-22T11:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
      ],
    });

    const result = await service.resolveCipavdThread(
      'case-1',
      'thread-1',
      {
        text: 'Despacho anexado e procedimento atualizado.',
      },
      user as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toMatchObject({
      id: 'thread-1',
      status: 'RESOLVED',
      statusLabel: 'Resolvida',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cipavd_pendency_resolve',
        entityId: 'case-1',
      }),
    );
  });

  it('permite que a gestão edite o texto da pendência em aberto', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);
    const user = makeUser({
      id: 'manager-1',
      roleName: 'COMGEP',
      scope: 'NATIONAL',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      complaintCaseId: 'case-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 0,
      complaintCase: { workflowScope: 'CPCA' },
    });
    prisma.cpcComplaintCipavdMessage.findFirst.mockResolvedValue({
      id: 'message-1',
      body: 'Texto original da pendência.',
    });
    prisma.__tx.cpcComplaintCipavdMessage.update.mockResolvedValue({
      id: 'message-1',
    });
    prisma.__tx.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 0,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      resolvedAt: null,
      closedAt: null,
      lastMessageAt: new Date('2026-04-22T10:00:00.000Z'),
      createdBy: { id: user.id, name: user.name, email: user.email },
      resolvedBy: null,
      closedBy: null,
      messages: [
        {
          id: 'message-1',
          body: 'Texto ajustado da pendência.',
          authorKind: 'MANAGEMENT',
          type: 'MESSAGE',
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
      ],
    });

    const result = await service.updateCipavdThread(
      'case-1',
      'thread-1',
      { text: 'Texto ajustado da pendência.' },
      user as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toMatchObject({
      id: 'thread-1',
      status: 'OPEN',
      messages: [
        expect.objectContaining({
          body: 'Texto ajustado da pendência.',
        }),
      ],
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cipavd_pendency_update',
        entityId: 'case-1',
      }),
    );
  });

  it('bloqueia a resolução da pendência quando o usuário não é o presidente da OM', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);
    const user = makeUser({
      id: 'member-1',
      omId: 'om-1',
      roleName: 'CPCA',
      scope: 'LOCALITY',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionCoverageOm.findMany.mockResolvedValue([]);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);

    await expectReason(
      service.resolveCipavdThread(
        'case-1',
        'thread-1',
        { text: 'Tentativa sem autorização.' },
        user as any,
        CPCA_WORKFLOW_CONTEXT,
      ),
      'RBAC_FORBIDDEN',
    );
  });

  it('permite que a gestão reabra uma pendência resolvida mantendo o histórico', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);
    const user = makeUser({
      id: 'manager-1',
      roleName: 'TI',
      scope: 'NATIONAL',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      complaintCaseId: 'case-1',
      type: 'PENDENCY',
      status: 'RESOLVED',
      reopenedCount: 1,
      complaintCase: { workflowScope: 'CPCA' },
    });
    prisma.__tx.cpcComplaintCipavdMessage.create.mockResolvedValue({
      id: 'message-3',
    });
    prisma.__tx.cpcComplaintCipavdThread.update.mockResolvedValue({
      id: 'thread-1',
    });
    prisma.__tx.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 2,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      resolvedAt: null,
      closedAt: null,
      lastMessageAt: new Date('2026-04-22T12:00:00.000Z'),
      createdBy: { id: user.id, name: user.name, email: user.email },
      resolvedBy: null,
      closedBy: null,
      messages: [
        {
          id: 'message-1',
          body: 'Primeira pendência.',
          authorKind: 'MANAGEMENT',
          type: 'MESSAGE',
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
        {
          id: 'message-3',
          body: 'Ainda falta complementar o despacho final.',
          authorKind: 'MANAGEMENT',
          type: 'REOPEN',
          createdAt: new Date('2026-04-22T12:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
      ],
    });

    const result = await service.reopenCipavdThread(
      'case-1',
      'thread-1',
      {
        text: 'Ainda falta complementar o despacho final.',
      },
      user as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toMatchObject({
      id: 'thread-1',
      status: 'OPEN',
      reopenedCount: 2,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cipavd_pendency_reopen',
        entityId: 'case-1',
      }),
    );
  });

  it('permite que a gestão valide e finalize a pendência com solução registrada', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);
    const user = makeUser({
      id: 'manager-1',
      roleName: 'TI',
      scope: 'NATIONAL',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      complaintCaseId: 'case-1',
      type: 'PENDENCY',
      status: 'RESOLVED',
      reopenedCount: 0,
      complaintCase: { workflowScope: 'CPCA' },
    });
    prisma.__tx.cpcComplaintCipavdMessage.create.mockResolvedValue({
      id: 'message-3',
    });
    prisma.__tx.cpcComplaintCipavdThread.update.mockResolvedValue({
      id: 'thread-1',
    });
    prisma.__tx.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      type: 'PENDENCY',
      status: 'CLOSED',
      reopenedCount: 0,
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
      resolvedAt: new Date('2026-04-22T11:00:00.000Z'),
      closedAt: new Date('2026-04-22T12:00:00.000Z'),
      lastMessageAt: new Date('2026-04-22T12:00:00.000Z'),
      createdBy: { id: user.id, name: user.name, email: user.email },
      resolvedBy: {
        id: 'president-1',
        name: 'Presidente',
        email: 'pres@fab.mil.br',
      },
      closedBy: { id: user.id, name: user.name, email: user.email },
      messages: [
        {
          id: 'message-1',
          body: 'Pendência inicial.',
          authorKind: 'MANAGEMENT',
          type: 'MESSAGE',
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
        {
          id: 'message-2',
          body: 'Pendência tratada pela OM.',
          authorKind: 'PRESIDENT',
          type: 'RESOLUTION',
          createdAt: new Date('2026-04-22T11:00:00.000Z'),
          createdBy: {
            id: 'president-1',
            name: 'Presidente',
            email: 'pres@fab.mil.br',
          },
        },
        {
          id: 'message-3',
          body: 'Validação concluída pela gestão nacional.',
          authorKind: 'MANAGEMENT',
          type: 'FINALIZATION',
          createdAt: new Date('2026-04-22T12:00:00.000Z'),
          createdBy: { id: user.id, name: user.name, email: user.email },
        },
      ],
    });

    const result = await service.finalizeCipavdThread(
      'case-1',
      'thread-1',
      { text: 'Validação concluída pela gestão nacional.' },
      user as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toMatchObject({
      id: 'thread-1',
      status: 'CLOSED',
      statusLabel: 'Finalizada',
    });
    expect(prisma.__tx.cpcComplaintCipavdMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'FINALIZATION',
          body: 'Validação concluída pela gestão nacional.',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cipavd_pendency_finalize',
        entityId: 'case-1',
      }),
    );
  });

  it('permite que a gestão exclua pendência aberta sem histórico da comissão', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);
    const user = makeUser({
      id: 'manager-1',
      roleName: 'Coordenação CIPAVD',
      scope: 'NATIONAL',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      complaintCaseId: 'case-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 0,
      complaintCase: { workflowScope: 'CPCA' },
    });
    prisma.cpcComplaintCipavdMessage.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCipavdThread.delete.mockResolvedValue({
      id: 'thread-1',
    });

    const result = await service.removeCipavdThread(
      'case-1',
      'thread-1',
      user as any,
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toEqual({ ok: true });
    expect(prisma.cpcComplaintCipavdThread.delete).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cipavd_pendency_delete',
        entityId: 'case-1',
      }),
    );
  });

  it('bloqueia a exclusão quando a pendência já possui histórico da comissão', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);
    const user = makeUser({
      id: 'manager-1',
      roleName: 'Coordenação CIPAVD',
      scope: 'NATIONAL',
    });

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: 'om-1',
      caseNumber: 'CPCA-2026-BACO-00001',
      workflowScope: 'CPCA',
    });
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);
    prisma.cpcComplaintCipavdThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      complaintCaseId: 'case-1',
      type: 'PENDENCY',
      status: 'OPEN',
      reopenedCount: 0,
      complaintCase: { workflowScope: 'CPCA' },
    });
    prisma.cpcComplaintCipavdMessage.findFirst.mockResolvedValue({
      id: 'message-president-1',
    });

    await expectReason(
      service.removeCipavdThread(
        'case-1',
        'thread-1',
        user as any,
        CPCA_WORKFLOW_CONTEXT,
      ),
      'PENDENCY_DELETE_WITH_HISTORY_NOT_ALLOWED',
    );
  });
});
