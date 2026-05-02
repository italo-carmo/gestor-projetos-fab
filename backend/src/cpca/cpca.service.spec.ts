import { CpcaService, CPCA_WORKFLOW_CONTEXT } from './cpca.service';
import { HttpException } from '@nestjs/common';

function createPrismaMock() {
  return {
    cpcaCommissionCoverageOm: {
      findMany: jest.fn(),
    },
    cpcComplaintCase: {
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

describe('CpcaService AI context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resume casos CPCA, casos críticos e inconsistências para a IA', async () => {
    const prisma = createPrismaMock();
    const service = new CpcaService(prisma, createAuditMock() as any);
    const futureReportedAt = new Date();
    futureReportedAt.setUTCDate(futureReportedAt.getUTCDate() + 2);
    futureReportedAt.setUTCHours(12, 0, 0, 0);
    const futureIncidentDate = new Date(futureReportedAt);
    futureIncidentDate.setUTCDate(futureIncidentDate.getUTCDate() + 1);

    prisma.cpcComplaintCase.findMany.mockResolvedValue([
      {
        id: 'case-1',
        caseNumber: 'CPCA-2026-BACG-00001',
        omId: 'om-1',
        localityId: 'om-1',
        complaintType: 'MORAL',
        detailedViolenceType: 'ASSEDIO_MORAL',
        incidentFrequency: 'UMA_VEZ',
        hierarchicalFunctionalRelation: 'SUPERIOR_HIERARQUICO',
        status: 'RECEIVED',
        procedureType: 'NOT_DEFINED',
        procedureCurrentSituation: null,
        reportedAt: new Date('2026-04-10T12:00:00.000Z'),
        incidentDate: new Date('2026-04-08T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
        retaliationRisk: true,
        om: { id: 'om-1', code: 'BACG', name: 'Base Aérea de Campo Grande' },
        locality: null,
      },
      {
        id: 'case-2',
        caseNumber: 'CPCA-2026-DCTA-00002',
        omId: 'om-2',
        localityId: 'om-2',
        complaintType: 'SEXUAL',
        detailedViolenceType: 'IMPORTUNACAO_SEXUAL',
        incidentFrequency: 'MAIS_DE_UMA_VEZ',
        hierarchicalFunctionalRelation: 'MESMA_GRADUACAO',
        status: 'ARCHIVED',
        procedureType: 'IPM',
        procedureCurrentSituation: 'ARQUIVADO_PELA_JUSTICA',
        reportedAt: futureReportedAt,
        incidentDate: futureIncidentDate,
        updatedAt: new Date('2026-04-20T12:00:00.000Z'),
        retaliationRisk: false,
        om: {
          id: 'om-2',
          code: 'DCTA',
          name: 'Departamento de Ciência e Tecnologia Aeroespacial',
        },
        locality: null,
      },
    ]);

    const result = await service.buildAiContext({
      query: 'Verifique o caso CPCA-2026-BACG-00001 e inconsistências',
      includeInconsistencies: true,
      limit: 6,
    });

    expect(result.summary.totalCases).toBe(2);
    expect(result.summary.openCases).toBe(1);
    expect(result.summary.archivedCases).toBe(1);
    expect(result.summary.inconsistentCases).toBe(2);
    expect(result.inconsistencySummary.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'ICA_25_26',
        'DATE_IN_FUTURE',
        'INCIDENT_AFTER_REPORT',
        'ICA_32_II_IMPORTUNACAO',
      ]),
    );
    expect(result.matchedCases[0]?.caseNumber).toBe('CPCA-2026-BACG-00001');
    expect(result.references[0]?.href).toContain(
      '/cpca-cases?q=CPCA-2026-BACG-00001',
    );
    expect(result.normativeReferences.map((item) => item.code)).toContain(
      'ICA_25_26',
    );
  });
});
