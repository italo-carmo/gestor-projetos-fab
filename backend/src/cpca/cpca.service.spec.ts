import { CpcaService, CPCA_WORKFLOW_CONTEXT } from './cpca.service';
import { HttpException } from '@nestjs/common';

function createPrismaMock() {
  return {
    cpcaCommissionCoverageOm: {
      findMany: jest.fn(),
    },
    om: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;
}

function createAuditMock() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

function makeCpcaUser(args: { id?: string; omId: string; national?: boolean }) {
  return {
    id: args.id ?? 'user-1',
    name: 'Usuário CPCA',
    email: 'cpca@test.mil.br',
    omId: args.omId,
    localityId: args.omId,
    roles: [{ id: 'cpca-role', name: 'CPCA', permissions: [] }],
    allRoles: [{ id: 'cpca-role', name: 'CPCA', permissions: [] }],
    permissions: args.national
      ? [{ resource: 'cpca_cases', action: 'view', scope: 'NATIONAL' }]
      : [{ resource: 'cpca_cases', action: 'view', scope: 'LOCALITY' }],
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

describe('CpcaService security scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inclui a própria OM e as OMs geridas no escopo CPCA local', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);

    prisma.cpcaCommissionCoverageOm.findMany.mockResolvedValue([
      { managedOmId: 'om-2' },
      { managedOmId: 'om-3' },
    ]);

    const result = await (service as any).resolveCpcaScopedLocalityIds(
      { localityId: 'om-1' },
      CPCA_WORKFLOW_CONTEXT,
    );

    expect(result).toEqual(['om-1', 'om-2', 'om-3']);
  });

  it('bloqueia acesso de usuário CPCA local a caso fora da própria OM e das OMs geridas', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);

    prisma.cpcaCommissionCoverageOm.findMany.mockResolvedValue([
      { managedOmId: 'om-2' },
    ]);

    await expectReason(
      (service as any).assertCaseAccess(
        { localityId: 'om-9', caseNumber: 'CPCA-TESTE-1' },
        makeCpcaUser({ omId: 'om-1' }),
        CPCA_WORKFLOW_CONTEXT,
      ),
      'RBAC_FORBIDDEN',
    );
  });

  it('permite acesso nacional sem restringir por OM', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);

    await expect(
      (service as any).assertCaseAccess(
        { localityId: 'om-9', caseNumber: 'CPCA-TESTE-2' },
        makeCpcaUser({ omId: 'om-1', national: true }),
        CPCA_WORKFLOW_CONTEXT,
      ),
    ).resolves.toBeUndefined();
  });
});
