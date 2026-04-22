import { CpcaCommissionService } from './cpca-commission.service';
import { HttpException } from '@nestjs/common';
import { resolveBestOmByFabOm } from '../catalog/om-resolver';
import {
  deleteCpcaPresidentBulletinFile,
  persistCpcaPresidentBulletinFile,
  validateCpcaPresidentBulletinUpload,
} from './cpca-president-bulletin-file';

jest.mock('../catalog/om-resolver', () => ({
  resolveBestOmByFabOm: jest.fn(),
}));
jest.mock('./cpca-president-bulletin-file', () => ({
  validateCpcaPresidentBulletinUpload: jest.fn(),
  persistCpcaPresidentBulletinFile: jest.fn(),
  deleteCpcaPresidentBulletinFile: jest.fn(),
  resolveExistingCpcaPresidentBulletinPath: jest.fn(
    () => '/tmp/publicacao.pdf',
  ),
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
      updateMany: jest.fn(),
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
    (validateCpcaPresidentBulletinUpload as jest.Mock).mockReturnValue({
      fileName: 'boletim-publicacao.pdf',
      storageKey: 'bulletin-1.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      checksum: 'checksum-1',
      buffer: Buffer.from('%PDF-1.4'),
    });
    (persistCpcaPresidentBulletinFile as jest.Mock).mockReturnValue({
      fileName: 'boletim-publicacao.pdf',
      storageKey: 'bulletin-1.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      checksum: 'checksum-1',
    });
    (deleteCpcaPresidentBulletinFile as jest.Mock).mockReturnValue(true);
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
      attemptNumber: 1,
      om,
    });

    const result = await service.createSelfRegistration(
      {
        identifier: 'presidente@fab.mil.br',
        isSubstitution: false,
        bulletinNumber: 'BOL 001',
        bulletinFile: {
          originalname: 'boletim-publicacao.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('%PDF-1.4'),
        } as any,
      },
      '127.0.0.1',
    );

    expect(validateCpcaPresidentBulletinUpload).toHaveBeenCalled();
    expect(persistCpcaPresidentBulletinFile).toHaveBeenCalled();
    expect(prisma.cpcaPresidentSelfRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          omId: om.id,
          bulletinFileName: 'boletim-publicacao.pdf',
          bulletinStorageKey: 'bulletin-1.pdf',
        }),
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

  it('remove o arquivo de publicação anterior quando um novo presidente substitui o registro atual', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaPresidentSelfRegistration.findUnique.mockResolvedValue({
      id: 'req-approve-2',
      status: 'PENDING',
      omId: om.id,
      requestedAsSubstitution: true,
      bulletinNumber: 'BOL 020',
      bulletinFileName: 'novo-boletim.pdf',
      bulletinStorageKey: 'new-storage.pdf',
      bulletinMimeType: 'application/pdf',
      bulletinFileSize: 2048,
      bulletinChecksum: 'checksum-new',
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
      designationBulletinStorageKey: 'old-storage.pdf',
      user: {
        id: 'user-current',
        name: 'Cel Atual',
        email: 'atual@fab.mil.br',
        ldapUid: 'uid-atual',
        omId: om.id,
        localityId: om.id,
      },
    });
    prisma.role.findMany.mockResolvedValue([{ id: 'role-cpca', name: 'CPCA' }]);
    prisma.user.update.mockResolvedValue({
      id: 'user-target',
      name: 'Maj Novo',
      email: 'novo@fab.mil.br',
      ldapUid: 'uid-novo',
      omId: om.id,
      localityId: om.id,
    });
    prisma.userRole.createMany.mockResolvedValue({ count: 1 });
    prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cpcaCommissionMember.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cpcaCommissionPresident.upsert.mockResolvedValue({
      id: 'president-1',
      user: {
        id: 'user-target',
        name: 'Maj Novo',
        email: 'novo@fab.mil.br',
        ldapUid: 'uid-novo',
        omId: om.id,
        localityId: om.id,
      },
      assignedByUser: {
        id: 'approver',
        name: 'Aprovador',
        email: 'approver@fab.mil.br',
      },
    });
    prisma.cpcaPresidentSelfRegistration.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.cpcaPresidentSelfRegistration.update.mockResolvedValue({
      id: 'req-approve-2',
      status: 'APPROVED',
      om,
      applicantUser: {
        id: 'user-target',
        name: 'Maj Novo',
        email: 'novo@fab.mil.br',
        ldapUid: 'uid-novo',
      },
      decidedByUser: {
        id: 'approver',
        name: 'Aprovador',
        email: 'approver@fab.mil.br',
      },
    });

    await service.approvePresidentRequest(
      'req-approve-2',
      { proceedWithExistingPresident: true },
      makeUser({ id: 'approver', roles: ['COMGEP'] }) as any,
    );

    expect(prisma.cpcaCommissionPresident.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          designationBulletinStorageKey: 'new-storage.pdf',
        }),
      }),
    );
    expect(
      prisma.cpcaPresidentSelfRegistration.updateMany,
    ).toHaveBeenCalledWith({
      where: { bulletinStorageKey: 'old-storage.pdf' },
      data: {
        bulletinStorageKey: null,
        bulletinMimeType: null,
        bulletinFileSize: null,
        bulletinChecksum: null,
      },
    });
    expect(deleteCpcaPresidentBulletinFile).toHaveBeenCalledWith(
      'old-storage.pdf',
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

  it('permite reenviar uma autoinscrição rejeitada preservando o vínculo com a tentativa anterior', async () => {
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
    prisma.cpcaPresidentSelfRegistration.findUnique.mockResolvedValue({
      id: 'req-rejected-1',
      omId: om.id,
      applicantUserId: 'user-pres-1',
      status: 'REJECTED',
      retryRootRequestId: null,
      attemptNumber: 1,
    });
    prisma.cpcaPresidentSelfRegistration.create.mockResolvedValue({
      id: 'req-retry-2',
      status: 'PENDING',
      createdAt: new Date('2026-04-22T13:00:00Z'),
      attemptNumber: 2,
      om,
    });

    const result = await service.createSelfRegistration(
      {
        identifier: 'presidente@fab.mil.br',
        resubmissionOfId: 'req-rejected-1',
        isSubstitution: true,
        bulletinNumber: 'BOL 099',
        bulletinFile: {
          originalname: 'boletim-publicacao.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('%PDF-1.4'),
        } as any,
      },
      '127.0.0.1',
    );

    expect(prisma.cpcaPresidentSelfRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          retryRootRequestId: 'req-rejected-1',
          previousAttemptId: 'req-rejected-1',
          attemptNumber: 2,
        }),
      }),
    );
    expect(result.request.attemptNumber).toBe(2);
  });

  it('retorna o status público da autoinscrição com histórico e sinal de acesso liberado', async () => {
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
      numeroOrdem: '123456',
    });
    prisma.cpcaPresidentSelfRegistration.findMany.mockResolvedValue([
      {
        id: 'req-approved-2',
        omId: om.id,
        applicantUserId: 'user-pres-1',
        retryRootRequestId: 'req-rejected-1',
        attemptNumber: 2,
        status: 'APPROVED',
        applicantIdentifier: 'presidente@fab.mil.br',
        applicantUid: 'uid-pres-1',
        applicantEmail: 'presidente@fab.mil.br',
        applicantName: 'Cel Presidente',
        requestedAsSubstitution: false,
        bulletinNumber: 'BOL 100',
        createdAt: new Date('2026-04-22T14:00:00Z'),
        decidedAt: new Date('2026-04-22T15:00:00Z'),
        decisionNotes: null,
        om,
        applicantUser: {
          id: 'user-pres-1',
          name: 'Cel Presidente',
          email: 'presidente@fab.mil.br',
          ldapUid: 'uid-pres-1',
        },
        decidedByUser: {
          id: 'approver-1',
          name: 'Aprovador',
          email: 'approver@fab.mil.br',
        },
      },
      {
        id: 'req-rejected-1',
        omId: om.id,
        applicantUserId: 'user-pres-1',
        retryRootRequestId: null,
        attemptNumber: 1,
        status: 'REJECTED',
        applicantIdentifier: 'presidente@fab.mil.br',
        applicantUid: 'uid-pres-1',
        applicantEmail: 'presidente@fab.mil.br',
        applicantName: 'Cel Presidente',
        requestedAsSubstitution: false,
        bulletinNumber: 'BOL 095',
        createdAt: new Date('2026-04-21T14:00:00Z'),
        decidedAt: new Date('2026-04-21T16:00:00Z'),
        decisionNotes: 'Anexe a página do boletim com o nome completo.',
        om,
        applicantUser: {
          id: 'user-pres-1',
          name: 'Cel Presidente',
          email: 'presidente@fab.mil.br',
          ldapUid: 'uid-pres-1',
        },
        decidedByUser: {
          id: 'approver-1',
          name: 'Aprovador',
          email: 'approver@fab.mil.br',
        },
      },
    ]);
    prisma.cpcaCommissionPresident.findFirst.mockResolvedValue({
      id: 'assignment-1',
    });

    const result = await service.lookupSelfRegistrationStatus(
      'presidente@fab.mil.br',
    );

    expect(result.accessGranted).toBe(true);
    expect(result.latestRequest).toMatchObject({
      id: 'req-approved-2',
      status: 'APPROVED',
      accessGranted: true,
    });
    expect(result.history).toHaveLength(2);
    expect(result.history.map((entry: any) => entry.attemptNumber)).toEqual([
      1, 2,
    ]);
  });

  it('exige motivo obrigatório ao rejeitar uma autoinscrição de presidente', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaPresidentSelfRegistration.findUnique.mockResolvedValue({
      id: 'req-pending-1',
      status: 'PENDING',
    });

    try {
      await service.rejectPresidentRequest(
        'req-pending-1',
        {},
        makeUser({ id: 'approver', roles: ['COMGEP'] }) as any,
      );
      throw new Error('expected rejectPresidentRequest to fail');
    } catch (error) {
      const err = error as HttpException & {
        response?: { code?: string; details?: { reason?: string } };
      };
      const response =
        typeof err.getResponse === 'function'
          ? (err.getResponse() as any)
          : err.response;
      expect(response?.details?.reason ?? response?.code).toBe('required');
    }
    expect(prisma.cpcaPresidentSelfRegistration.update).not.toHaveBeenCalled();
  });

  it('inclui o histórico completo da autoinscrição na fila de homologação', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const ldap = createLdapMock();
    const service = new CpcaCommissionService(
      prisma as any,
      audit as any,
      ldap as any,
    );

    prisma.cpcaPresidentSelfRegistration.findMany
      .mockResolvedValueOnce([
        {
          id: 'req-pending-2',
          omId: om.id,
          applicantUserId: 'user-pres-1',
          retryRootRequestId: 'req-rejected-1',
          attemptNumber: 2,
          status: 'PENDING',
          applicantIdentifier: 'presidente@fab.mil.br',
          applicantUid: 'uid-pres-1',
          applicantEmail: 'presidente@fab.mil.br',
          applicantName: 'Cel Presidente',
          requestedAsSubstitution: true,
          bulletinNumber: 'BOL 101',
          bulletinFileName: 'novo-boletim.pdf',
          bulletinStorageKey: 'novo-boletim.pdf',
          bulletinMimeType: 'application/pdf',
          bulletinFileSize: 2048,
          bulletinChecksum: 'checksum-2',
          createdAt: new Date('2026-04-22T14:00:00Z'),
          decidedAt: null,
          decisionNotes: null,
          om,
          applicantUser: {
            id: 'user-pres-1',
            name: 'Cel Presidente',
            email: 'presidente@fab.mil.br',
            ldapUid: 'uid-pres-1',
          },
          decidedByUser: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'req-rejected-1',
          omId: om.id,
          applicantUserId: 'user-pres-1',
          retryRootRequestId: null,
          attemptNumber: 1,
          status: 'REJECTED',
          requestedAsSubstitution: false,
          bulletinNumber: 'BOL 095',
          bulletinFileName: 'boletim-antigo.pdf',
          bulletinStorageKey: 'boletim-antigo.pdf',
          bulletinMimeType: 'application/pdf',
          bulletinFileSize: 1024,
          bulletinChecksum: 'checksum-1',
          createdAt: new Date('2026-04-21T14:00:00Z'),
          decidedAt: new Date('2026-04-21T16:00:00Z'),
          decisionNotes: 'Faltou a publicação completa.',
          om,
          decidedByUser: {
            id: 'approver-1',
            name: 'Aprovador',
            email: 'approver@fab.mil.br',
          },
        },
        {
          id: 'req-pending-2',
          omId: om.id,
          applicantUserId: 'user-pres-1',
          retryRootRequestId: 'req-rejected-1',
          attemptNumber: 2,
          status: 'PENDING',
          requestedAsSubstitution: true,
          bulletinNumber: 'BOL 101',
          bulletinFileName: 'novo-boletim.pdf',
          bulletinStorageKey: 'novo-boletim.pdf',
          bulletinMimeType: 'application/pdf',
          bulletinFileSize: 2048,
          bulletinChecksum: 'checksum-2',
          createdAt: new Date('2026-04-22T14:00:00Z'),
          decidedAt: null,
          decisionNotes: null,
          om,
          decidedByUser: null,
        },
      ]);
    prisma.cpcaPresidentNominationRequest.findMany.mockResolvedValue([]);
    prisma.cpcaCommissionCoverageRequest.findMany.mockResolvedValue([]);
    prisma.cpcaPresidentSelfRegistration.count.mockResolvedValue(1);
    prisma.cpcaPresidentNominationRequest.count.mockResolvedValue(0);
    prisma.cpcaCommissionCoverageRequest.count.mockResolvedValue(0);

    const result = await service.listApprovalRequests(
      makeUser({ id: 'approver', roles: ['COMGEP'] }) as any,
      'PENDING',
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'req-pending-2',
      attemptNumber: 2,
    });
    expect((result.items[0] as any).history).toHaveLength(2);
    expect(
      (result.items[0] as any).history.map((entry: any) => entry.attemptNumber),
    ).toEqual([1, 2]);
  });
});
