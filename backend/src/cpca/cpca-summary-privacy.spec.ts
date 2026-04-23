import { HttpException } from '@nestjs/common';
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

function createSummaryPrivacyMock() {
  return {
    reviewSummary: jest.fn(),
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
      { resource: 'cpca_cases', action: 'create', scope: 'NATIONAL' },
      { resource: 'cpca_cases', action: 'update', scope: 'NATIONAL' },
    ],
    moduleAccessOverrides: [],
  };
}

async function expectReason(promise: Promise<unknown>, reason: string) {
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

describe('CpcaService summary privacy enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloqueia a criação quando a análise aponta possível nome militar e não há override', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const summaryPrivacy = createSummaryPrivacyMock();
    const service = new CpcaService(
      prisma,
      audit as any,
      summaryPrivacy as any,
    );

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
    });
    summaryPrivacy.reviewSummary.mockResolvedValue({
      status: 'flagged',
      checkedText: 'CAP SILVA entrou em contato com a comissão.',
      findings: [
        {
          excerpt: 'CAP SILVA',
          start: 0,
          end: 9,
          category: 'RANK_PLUS_NAME',
          confidence: 'HIGH',
          explanation: 'posto associado a sobrenome',
          source: 'heuristic',
        },
      ],
      engine: 'heuristic',
      model: null,
      userMessage:
        'A Inteligência Artificial identificou a presença de possíveis nomes no texto.',
    });

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

    await expectReason(
      service.create(
        {
          complaintType: 'MORAL',
          aggressorRank: '1S',
          aggressorGender: 'MASCULINO',
          victimRank: '2S',
          victimGender: 'FEMININO',
          evidenceSummary: 'CAP SILVA entrou em contato com a comissão.',
        } as any,
        makeUser() as any,
      ),
      'AI_POSSIBLE_MILITARY_NAMES_DETECTED',
    );

    expect(prisma.cpcComplaintCase.create).not.toHaveBeenCalled();
  });

  it('permite salvar com override explícito sem reprocessar a análise novamente', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const summaryPrivacy = createSummaryPrivacyMock();
    const service = new CpcaService(
      prisma,
      audit as any,
      summaryPrivacy as any,
    );

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: null,
      caseNumber: 'CPCA-2026-BACG-00001',
      workflowScope: 'CPCA',
      complaintType: 'MORAL',
      evidenceSummary: null,
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
        evidenceSummary: data.evidenceSummary,
        om: { id: 'om-1', code: 'BACG', name: 'Base Aérea' },
        locality: null,
      }),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    await expect(
      service.update(
        'case-1',
        {
          evidenceSummary: 'CAP SILVA entrou em contato com a comissão.',
          evidenceSummaryPrivacyOverride: true,
        } as any,
        makeUser() as any,
      ),
    ).resolves.toMatchObject({
      id: 'case-1',
      evidenceSummary: 'CAP SILVA entrou em contato com a comissão.',
    });

    expect(summaryPrivacy.reviewSummary).not.toHaveBeenCalled();
  });

  it('não reprocessa a IA quando o resumo do fato não sofreu mudança real', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const summaryPrivacy = createSummaryPrivacyMock();
    const service = new CpcaService(
      prisma,
      audit as any,
      summaryPrivacy as any,
    );

    prisma.cpcComplaintCase.findUnique.mockResolvedValue({
      id: 'case-1',
      omId: 'om-1',
      localityId: null,
      caseNumber: 'CPCA-2026-BACG-00001',
      workflowScope: 'CPCA',
      complaintType: 'MORAL',
      evidenceSummary: 'CAP entrou em contato com a comissão.',
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
        evidenceSummary: data.evidenceSummary,
        om: { id: 'om-1', code: 'BACG', name: 'Base Aérea' },
        locality: null,
        status: data.status ?? 'RECEIVED',
        procedureType: data.procedureType ?? 'NOT_DEFINED',
        procedureCurrentSituation: null,
      }),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    await expect(
      service.update(
        'case-1',
        {
          evidenceSummary: '  CAP entrou em contato com a comissão.  ',
        } as any,
        makeUser() as any,
      ),
    ).resolves.toMatchObject({
      id: 'case-1',
      evidenceSummary: 'CAP entrou em contato com a comissão.',
    });

    expect(summaryPrivacy.reviewSummary).not.toHaveBeenCalled();
  });
});
