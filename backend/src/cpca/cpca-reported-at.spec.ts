import { CpcaService } from './cpca.service';

function createPrismaMock() {
  return {
    om: {
      findUnique: jest.fn(),
    },
    cpcComplaintCase: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cpcComplaintStatusHistory: {
      create: jest.fn(),
    },
  } as any;
}

function createAuditMock() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUser() {
  return {
    id: 'user-1',
    name: 'Usuário Teste',
    email: 'user@test.mil.br',
    omId: 'om-1',
    localityId: 'om-1',
    roles: [{ id: 'role-1', name: 'CPCA', permissions: [] }],
    allRoles: [{ id: 'role-1', name: 'CPCA', permissions: [] }],
    permissions: [
      { resource: 'cpca_cases', action: 'view', scope: 'NATIONAL' },
    ],
    moduleAccessOverrides: [],
  };
}

describe('CpcaService reportedAt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persiste a data da notificação informada na criação do caso', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
    });
    prisma.cpcComplaintCase.create.mockImplementation(
      async ({ data }: any) => ({
        id: 'case-1',
        caseNumber: data.caseNumber,
        workflowScope: data.workflowScope,
        omId: 'om-1',
        localityId: null,
        complaintType: data.complaintType,
        status: data.status,
        procedureType: data.procedureType,
        reportedAt: data.reportedAt,
        om: { id: 'om-1', code: 'BACG', name: 'Base Aérea' },
        locality: null,
      }),
    );

    jest
      .spyOn(service as any, 'getScopeConstraints')
      .mockReturnValue({ localityId: 'om-1' });
    jest
      .spyOn(service as any, 'resolveTargetLocalityId')
      .mockResolvedValue('om-1');
    jest
      .spyOn(service as any, 'resolveCpcaManagerLocalityCode')
      .mockResolvedValue('BACG');
    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest
      .spyOn(service as any, 'generateCaseNumber')
      .mockResolvedValue('CPCA-2026-BACG-00001');

    await service.create(
      {
        complaintType: 'MORAL',
        aggressorRank: '1S',
        aggressorGender: 'MASCULINO',
        victimRank: '2S',
        victimGender: 'FEMININO',
        reportedAt: '2024-01-15',
      } as any,
      makeUser() as any,
    );

    const createCall = prisma.cpcComplaintCase.create.mock.calls[0]?.[0];
    expect(createCall).toBeTruthy();
    expect(createCall.data.reportedAt).toBeInstanceOf(Date);
    expect(createCall.data.reportedAt.toISOString()).toBe(
      '2024-01-15T12:00:00.000Z',
    );
    expect(createCall.data).not.toHaveProperty('localityId');
  });

  it('atualiza a data da notificação informada na edição do caso', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: null,
      caseNumber: 'CPCA-2026-BACG-00001',
      workflowScope: 'CPCA',
      complaintType: 'MORAL',
      victimIsNotifier: true,
      victimRank: '2S',
      victimGender: 'FEMININO',
      victimAgeRange: null,
      notifierRank: '2S',
      notifierGender: 'FEMININO',
      notifierAgeRange: null,
      confidentialityTermSigned: false,
      status: 'RECEIVED',
      procedureType: 'NOT_DEFINED',
      procedureCurrentSituation: null,
      preliminaryReportGenerated: false,
      preliminaryReportDate: null,
      victimAccusedSeparationEvaluated: false,
      victimAccusedSeparationApplied: false,
      outsourcedAccused: false,
      contractorReferralDate: null,
      accusedDefenseEnsured: false,
      outcomeSummary: null,
      archivedAt: null,
    });
    prisma.cpcComplaintCase.update.mockImplementation(
      async ({ data }: any) => ({
        id: 'case-1',
        omId: 'om-1',
        localityId: null,
        complaintType: 'MORAL',
        status: data.status ?? 'RECEIVED',
        procedureType: data.procedureType ?? 'NOT_DEFINED',
        procedureCurrentSituation: null,
        reportedAt: data.reportedAt,
        om: { id: 'om-1', code: 'BACG', name: 'Base Aérea' },
        locality: null,
      }),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    await service.update(
      'case-1',
      {
        reportedAt: '2023-08-20',
      } as any,
      makeUser() as any,
    );

    const updateCall = prisma.cpcComplaintCase.update.mock.calls[0]?.[0];
    expect(updateCall).toBeTruthy();
    expect(updateCall.data.reportedAt).toBeInstanceOf(Date);
    expect(updateCall.data.reportedAt.toISOString()).toBe(
      '2023-08-20T12:00:00.000Z',
    );
    expect(updateCall.data).not.toHaveProperty('localityId');
  });
});
