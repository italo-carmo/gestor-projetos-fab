import { CpcaCommissionService } from './cpca-commission.service';
import { HttpException } from '@nestjs/common';
import { resolveBestOmByFabOm } from '../catalog/om-resolver';

jest.mock('../catalog/om-resolver', () => ({
  resolveBestOmByFabOm: jest.fn(),
}));

function createPrismaMock() {
  const prisma: any = {
    om: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    userRole: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    cpcaPresidentSelfRegistration: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    cpcaPresidentNominationRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    cpcaCommissionCoverageRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    cpcaCommissionPresident: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    cpcaCommissionMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    cpcaCommissionCoverageOm: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
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

function createLdapMock() {
  return {
    lookupByEmail: jest.fn(),
    lookupByCpf: jest.fn(),
    lookupByUid: jest.fn(),
  };
}

function makeUser(args: {
  id?: string;
  omId?: string | null;
  roles?: string[];
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
    })),
    allRoles: (args.roles ?? []).map((name) => ({
      id: name,
      name,
      permissions: [],
    })),
    permissions: [],
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

describe('CpcaCommissionService', () => {
  const om = {
    id: 'om-1',
    code: 'BACO',
    name: 'Base Aérea de Canoas',
    hasCpca: true,
  };
  const managedOm = {
    id: 'om-2',
    code: 'CLBI',
    name: 'Centro de Lançamento da Barreira do Inferno',
    uf: 'RN',
    hasCpca: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite autoinscrição de presidente usando a OM resolvida do LDAP mesmo com presidente já existente', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    (resolveBestOmByFabOm as jest.Mock).mockResolvedValue(om);
    ldap.lookupByEmail.mockResolvedValue({
      uid: 'uid-pres-1',
      email: 'presidente@fab.mil.br',
      name: 'Cel Presidente',
      fabom: 'BACO',
    });
    prisma.om.findUnique.mockResolvedValue(om);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-pres-1',
      name: 'Cel Presidente',
      email: 'presidente@fab.mil.br',
      ldapUid: 'uid-pres-1',
      omId: om.id,
      localityId: om.id,
    });
    prisma.cpcaPresidentSelfRegistration.findFirst.mockResolvedValue(null);
    prisma.cpcaPresidentSelfRegistration.create.mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      createdAt: new Date('2026-04-19T10:00:00Z'),
      om,
    });

    const result = await service.createSelfRegistration(
      {
        identifier: 'presidente@fab.mil.br',
        isSubstitution: false,
        bulletinNumber: 'BOL 001',
      },
      '127.0.0.1',
    );

    expect(prisma.cpcaPresidentSelfRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ omId: om.id }),
      }),
    );
    expect(result.request.locality).toEqual(om);
  });

  it('exige confirmação explícita ao homologar presidente quando a OM já possui outro presidente', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaPresidentSelfRegistration.findUnique.mockResolvedValue({
      id: 'req-approve-1',
      status: 'PENDING',
      omId: om.id,
      requestedAsSubstitution: true,
      bulletinNumber: 'BOL 010',
      applicantUserId: 'user-target',
      om,
      applicantUser: {
        id: 'user-target',
        name: 'Maj Novo',
        email: 'novo@fab.mil.br',
        ldapUid: 'uid-novo',
        omId: om.id,
        localityId: om.id,
      },
    });
    prisma.om.findUnique.mockResolvedValue(om);
    prisma.cpcaCommissionPresident.findUnique.mockResolvedValue({
      id: 'current-president',
      userId: 'user-current',
      user: {
        id: 'user-current',
        name: 'Cel Atual',
        email: 'atual@fab.mil.br',
        ldapUid: 'uid-atual',
        omId: om.id,
        localityId: om.id,
      },
    });

    await expectReason(
      service.approvePresidentRequest(
        'req-approve-1',
        {},
        makeUser({ id: 'approver', roles: ['COMGEP'] }) as any,
      ),
      'CPCA_LOCALITY_ALREADY_HAS_PRESIDENT',
    );
  });

  it('presidente local envia alteração de cobertura para homologação sem aplicar a cobertura diretamente', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'pres-link',
    });
    prisma.om.findUnique.mockResolvedValue(om);
    prisma.om.findMany.mockResolvedValue([managedOm]);
    prisma.cpcaCommissionCoverageOm.findMany.mockResolvedValue([]);
    prisma.cpcaCommissionCoverageRequest.findFirst.mockResolvedValue(null);
    prisma.cpcaCommissionCoverageRequest.create.mockResolvedValue({
      id: 'coverage-request-1',
      omId: om.id,
      requestedManagedOmIds: [managedOm.id],
      status: 'PENDING',
      createdAt: new Date('2026-04-19T11:00:00Z'),
      requestedByUser: {
        id: 'president-1',
        name: 'Cel Presidente',
        email: 'presidente@fab.mil.br',
      },
      om,
    });

    const result = await service.updateCoverage(
      {
        localityId: om.id,
        managedLocalityIds: [managedOm.id],
      },
      makeUser({ id: 'president-1', omId: om.id, roles: ['CPCA'] }) as any,
    );

    expect(result.mode).toBe('REQUESTED');
    expect(prisma.cpcaCommissionCoverageOm.deleteMany).not.toHaveBeenCalled();
    expect(prisma.cpcaCommissionCoverageRequest.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cpca_commission_coverage_request_create',
      }),
    );
  });

  it('TI/COMGEP aplicam cobertura diretamente', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.om.findUnique.mockResolvedValueOnce(om).mockResolvedValueOnce(om);
    prisma.om.findMany
      .mockResolvedValueOnce([managedOm])
      .mockResolvedValueOnce([managedOm]);
    prisma.cpcaCommissionCoverageOm.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ managedOm: managedOm }]);

    const result = await service.updateCoverage(
      {
        localityId: om.id,
        managedLocalityIds: [managedOm.id],
      },
      makeUser({ id: 'ti-1', roles: ['TI'] }) as any,
    );

    expect(result.mode).toBe('APPLIED');
    expect(prisma.cpcaCommissionCoverageOm.deleteMany).toHaveBeenCalled();
    expect(prisma.cpcaCommissionCoverageOm.createMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cpca_commission_coverage_update' }),
    );
  });

  it('só o presidente da OM pode abrir solicitação de sucessão', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue(null);

    await expectReason(
      service.createPresidentNominationRequest(
        {
          identifier: 'substituto@fab.mil.br',
        },
        makeUser({ id: 'member-1', omId: om.id, roles: ['CPCA'] }) as any,
      ),
      'RBAC_FORBIDDEN',
    );
  });

  it('agrega pendências de autoinscrição, sucessão e cobertura na fila de homologação', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaPresidentSelfRegistration.count.mockResolvedValue(2);
    prisma.cpcaPresidentNominationRequest.count.mockResolvedValue(1);
    prisma.cpcaCommissionCoverageRequest.count.mockResolvedValue(3);

    const result = await service.pendingApprovalRequestsCount(
      makeUser({ id: 'approver', roles: ['COMGEP'] }) as any,
    );

    expect(result.pendingCount).toBe(6);
  });
});
