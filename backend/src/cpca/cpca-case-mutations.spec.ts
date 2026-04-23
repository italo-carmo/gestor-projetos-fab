import { HttpException } from '@nestjs/common';
import {
  CPCA_WORKFLOW_CONTEXT,
  CpcaService,
  SMIF_WORKFLOW_CONTEXT,
} from './cpca.service';

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
      { resource: 'cpca_cases', action: 'create', scope: 'NATIONAL' },
      { resource: 'cpca_cases', action: 'update', scope: 'NATIONAL' },
      { resource: 'smif_complaints', action: 'view', scope: 'NATIONAL' },
      { resource: 'smif_complaints', action: 'create', scope: 'NATIONAL' },
      { resource: 'smif_complaints', action: 'update', scope: 'NATIONAL' },
    ],
    moduleAccessOverrides: [],
  };
}

function makeCurrentComplaint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    omId: 'om-1',
    localityId: null,
    caseNumber: 'CPCA-2026-BACG-00001',
    workflowScope: 'CPCA',
    complaintType: 'MORAL',
    evidenceSummary: 'Resumo anterior.',
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
    ...overrides,
  };
}

function makePersistedComplaintFromCreate(
  data: any,
  extras: Record<string, unknown> = {},
) {
  const omId = String(data?.om?.connect?.id ?? 'om-1');
  const omCode = String(extras.omCode ?? 'BACG');
  const omName = String(extras.omName ?? 'Base Aérea');

  return {
    id: String(extras.id ?? 'case-1'),
    caseNumber: data.caseNumber,
    workflowScope: data.workflowScope,
    omId,
    localityId: null,
    complaintType: data.complaintType,
    notifierType: data.notifierType,
    status: data.status,
    procedureType: data.procedureType,
    procedureCurrentSituation: data.procedureCurrentSituation ?? null,
    reportedAt: data.reportedAt,
    incidentDate: data.incidentDate ?? null,
    occurrenceForm: data.occurrenceForm ?? null,
    occurrenceForms: data.occurrenceForms ?? [],
    victimIsNotifier: data.victimIsNotifier,
    notifierRank: data.notifierRank,
    notifierGender: data.notifierGender,
    notifierAgeRange: data.notifierAgeRange,
    evidenceSummary: data.evidenceSummary ?? null,
    archivedAt: data.archivedAt ?? null,
    om: { id: omId, code: omCode, name: omName },
    locality: null,
    ...extras,
  };
}

function makePersistedComplaintFromUpdate(
  data: any,
  extras: Record<string, unknown> = {},
) {
  const omId = String(data?.om?.connect?.id ?? extras.omId ?? 'om-1');
  const omCode = String(extras.omCode ?? 'BACG');
  const omName = String(extras.omName ?? 'Base Aérea');

  return {
    id: String(extras.id ?? 'case-1'),
    caseNumber: String(extras.caseNumber ?? 'CPCA-2026-BACG-00001'),
    workflowScope: String(extras.workflowScope ?? 'CPCA'),
    omId,
    localityId: null,
    complaintType: data.complaintType ?? extras.complaintType ?? 'MORAL',
    notifierType: data.notifierType ?? extras.notifierType ?? 'VITIMA',
    status: data.status ?? extras.status ?? 'RECEIVED',
    procedureType: data.procedureType ?? extras.procedureType ?? 'NOT_DEFINED',
    procedureCurrentSituation:
      data.procedureCurrentSituation ??
      extras.procedureCurrentSituation ??
      null,
    reportedAt: data.reportedAt ?? extras.reportedAt ?? null,
    incidentDate: data.incidentDate ?? extras.incidentDate ?? null,
    occurrenceForm:
      data.occurrenceForm !== undefined
        ? data.occurrenceForm
        : (extras.occurrenceForm ?? null),
    occurrenceForms:
      data.occurrenceForms !== undefined
        ? data.occurrenceForms
        : (extras.occurrenceForms ?? []),
    victimIsNotifier: data.victimIsNotifier ?? extras.victimIsNotifier ?? true,
    notifierRank: data.notifierRank ?? extras.notifierRank ?? '2S',
    notifierGender: data.notifierGender ?? extras.notifierGender ?? 'FEMININO',
    notifierAgeRange:
      data.notifierAgeRange !== undefined
        ? data.notifierAgeRange
        : (extras.notifierAgeRange ?? null),
    evidenceSummary:
      data.evidenceSummary !== undefined
        ? data.evidenceSummary
        : (extras.evidenceSummary ?? null),
    archivedAt:
      data.archivedAt !== undefined
        ? data.archivedAt
        : (extras.archivedAt ?? null),
    om: { id: omId, code: omCode, name: omName },
    locality: null,
    ...extras,
  };
}

async function expectReason(promise: Promise<unknown>, reason: string) {
  try {
    await promise;
    throw new Error(`Expected rejection with reason ${reason}.`);
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

describe('CpcaService case mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cria denúncia CPCA com defaults, vínculo em OM e histórico inicial', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
    });
    prisma.cpcComplaintCase.create.mockImplementation(async ({ data }: any) =>
      makePersistedComplaintFromCreate(data),
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

    const result = await service.create(
      {
        complaintType: 'MORAL',
        aggressorRank: '1S',
        aggressorGender: 'MASCULINO',
        victimRank: '2S',
        victimGender: 'FEMININO',
        occurrenceForms: [' APP ', 'EMAIL', 'APP '],
        evidenceSummary: 'Fato objetivo sem identificação nominal.',
      } as any,
      makeUser() as any,
    );

    const createCall = prisma.cpcComplaintCase.create.mock.calls[0]?.[0];
    expect(createCall.data.workflowScope).toBe('CPCA');
    expect(createCall.data.om).toEqual({ connect: { id: 'om-1' } });
    expect(createCall.data).not.toHaveProperty('localityId');
    expect(createCall.data.status).toBe('RECEIVED');
    expect(createCall.data.procedureType).toBe('NOT_DEFINED');
    expect(createCall.data.occurrenceForm).toBe('APP');
    expect(createCall.data.occurrenceForms).toEqual(['APP', 'EMAIL']);
    expect(createCall.data.victimIsNotifier).toBe(true);
    expect(createCall.data.notifierRank).toBe('2S');
    expect(prisma.cpcComplaintStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintCaseId: 'case-1',
        toStatus: 'RECEIVED',
        toProcedure: 'NOT_DEFINED',
        note: 'Registro inicial da notificação.',
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'cpca_cases',
        action: 'create',
        entityId: 'case-1',
      }),
    );
    expect(result).toMatchObject({
      caseNumber: 'CPCA-2026-BACG-00001',
      workflowScope: 'CPCA',
      localityId: 'om-1',
      locality: { id: 'om-1', code: 'BACG', name: 'Base Aérea' },
    });
  });

  it('cria denúncia SMIF com notificador distinto da vítima', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
    });
    prisma.cpcComplaintCase.create.mockImplementation(async ({ data }: any) =>
      makePersistedComplaintFromCreate(data, {
        caseNumber: data.caseNumber,
        workflowScope: data.workflowScope,
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
      .mockResolvedValue('SMIF-2026-BACG-00001');

    const result = await service.create(
      {
        complaintType: 'SEXUAL',
        aggressorRank: '1S',
        aggressorGender: 'MASCULINO',
        victimRank: '2S',
        victimGender: 'FEMININO',
        victimIsNotifier: false,
        notifierRank: '1T',
        notifierGender: 'MASCULINO',
        notifierAgeRange: '31_35',
        confidentialityTermSigned: true,
        occurrenceForm: ' email ',
      } as any,
      makeUser() as any,
      SMIF_WORKFLOW_CONTEXT,
    );

    const createCall = prisma.cpcComplaintCase.create.mock.calls[0]?.[0];
    expect(createCall.data.workflowScope).toBe('SMIF');
    expect(createCall.data.caseNumber).toBe('SMIF-2026-BACG-00001');
    expect(createCall.data.occurrenceForm).toBe('email');
    expect(createCall.data.occurrenceForms).toEqual(['email']);
    expect(createCall.data.victimIsNotifier).toBe(false);
    expect(createCall.data.notifierRank).toBe('1T');
    expect(createCall.data.notifierGender).toBe('MASCULINO');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'smif_complaints',
        action: 'create',
        entityId: 'case-1',
      }),
    );
    expect(result).toMatchObject({
      caseNumber: 'SMIF-2026-BACG-00001',
      workflowScope: 'SMIF',
      localityId: 'om-1',
    });
  });

  it('rejeita criação com status terminal inicial', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
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
          status: 'ARCHIVED',
        } as any,
        makeUser() as any,
      ),
      'INITIAL_STATUS_MUST_BE_OPEN',
    );

    expect(prisma.cpcComplaintCase.create).not.toHaveBeenCalled();
    expect(prisma.cpcComplaintStatusHistory.create).not.toHaveBeenCalled();
  });

  it('refaz a geração do número do caso quando ocorre conflito de caseNumber', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
    });
    prisma.cpcComplaintCase.create
      .mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['caseNumber'] },
      })
      .mockImplementationOnce(async ({ data }: any) =>
        makePersistedComplaintFromCreate(data),
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
      .mockResolvedValueOnce('CPCA-2026-BACG-00001')
      .mockResolvedValueOnce('CPCA-2026-BACG-00002');

    const result = await service.create(
      {
        complaintType: 'MORAL',
        aggressorRank: '1S',
        aggressorGender: 'MASCULINO',
        victimRank: '2S',
        victimGender: 'FEMININO',
      } as any,
      makeUser() as any,
    );

    expect((service as any).generateCaseNumber).toHaveBeenCalledTimes(2);
    expect(prisma.cpcComplaintCase.create).toHaveBeenCalledTimes(2);
    expect(result.caseNumber).toBe('CPCA-2026-BACG-00002');
  });

  it('rejeita criação quando o notificador é diferente e os dados obrigatórios não vieram', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.om.findUnique.mockResolvedValue({
      id: 'om-1',
      code: 'BACG',
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
          victimIsNotifier: false,
          notifierGender: 'MASCULINO',
        } as any,
        makeUser() as any,
      ),
      'NOTIFIER_RANK_REQUIRED_WHEN_DIFFERENT',
    );

    expect(prisma.cpcComplaintCase.create).not.toHaveBeenCalled();
  });

  it('atualiza denúncia sem transição de status e sem criar novo histórico', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.cpcComplaintCase.findUnique.mockResolvedValue(
      makeCurrentComplaint(),
    );
    prisma.cpcComplaintCase.update.mockImplementation(async ({ data }: any) =>
      makePersistedComplaintFromUpdate(data, {
        omId: 'om-2',
        omCode: 'BASP',
        omName: 'Base Aérea de São Paulo',
        evidenceSummary: data.evidenceSummary,
      }),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'resolveTargetLocalityId')
      .mockResolvedValue('om-2');

    const result = await service.update(
      'case-1',
      {
        omId: 'om-2',
        occurrenceForms: [' APP ', 'EMAIL', 'APP '],
        victimIsNotifier: false,
        notifierRank: '1T',
        notifierGender: 'MASCULINO',
        notifierAgeRange: '31_35',
        evidenceSummary: 'Resumo atualizado sem mudança de fluxo.',
      } as any,
      makeUser() as any,
    );

    const updateCall = prisma.cpcComplaintCase.update.mock.calls[0]?.[0];
    expect(updateCall.data.om).toEqual({ connect: { id: 'om-2' } });
    expect(updateCall.data.locality).toEqual({ disconnect: true });
    expect(updateCall.data).not.toHaveProperty('localityId');
    expect(updateCall.data.occurrenceForm).toBe('APP');
    expect(updateCall.data.occurrenceForms).toEqual(['APP', 'EMAIL']);
    expect(updateCall.data.victimIsNotifier).toBe(false);
    expect(updateCall.data.notifierRank).toBe('1T');
    expect(updateCall.data.notifierGender).toBe('MASCULINO');
    expect(updateCall.data.updatedBy).toEqual({ connect: { id: 'user-1' } });
    expect(prisma.cpcComplaintStatusHistory.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'cpca_cases',
        action: 'update',
        entityId: 'case-1',
      }),
    );
    expect(result).toMatchObject({
      localityId: 'om-2',
      locality: {
        id: 'om-2',
        code: 'BASP',
        name: 'Base Aérea de São Paulo',
      },
    });
  });

  it('registra histórico e archivedAt ao arquivar uma denúncia já concluída', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-23T12:00:00.000Z'));

    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.cpcComplaintCase.findUnique.mockResolvedValue(
      makeCurrentComplaint({
        status: 'CONCLUDED',
        procedureType: 'SINDICANCIA',
        caseNumber: 'CPCA-2026-BACG-00019',
      }),
    );
    prisma.cpcComplaintCase.update.mockImplementation(async ({ data }: any) =>
      makePersistedComplaintFromUpdate(data, {
        status: data.status,
        procedureType: data.procedureType,
        archivedAt: data.archivedAt,
      }),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    const result = await service.update(
      'case-1',
      {
        status: 'ARCHIVED',
        procedureType: 'SINDICANCIA',
        outcomeSummary: 'Procedimento concluído e encerrado.',
        accusedDefenseEnsured: true,
        statusChangeNote: 'Encerrado após validação final.',
      } as any,
      makeUser() as any,
    );

    const updateCall = prisma.cpcComplaintCase.update.mock.calls[0]?.[0];
    expect(updateCall.data.status).toBe('ARCHIVED');
    expect(updateCall.data.archivedAt).toBeInstanceOf(Date);
    expect(updateCall.data.archivedAt.toISOString()).toBe(
      '2026-04-23T12:00:00.000Z',
    );
    expect(prisma.cpcComplaintStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintCaseId: 'case-1',
        fromStatus: 'CONCLUDED',
        toStatus: 'ARCHIVED',
        fromProcedure: 'SINDICANCIA',
        toProcedure: 'SINDICANCIA',
        note: 'Encerrado após validação final.',
      }),
    });
    expect(result.status).toBe('ARCHIVED');
  });

  it('sincroniza o status para arquivado quando a situação do procedimento é judicial', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-23T15:00:00.000Z'));

    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.cpcComplaintCase.findUnique.mockResolvedValue(
      makeCurrentComplaint({
        status: 'RECEIVED',
        procedureType: 'NOT_DEFINED',
      }),
    );
    prisma.cpcComplaintCase.update.mockImplementation(async ({ data }: any) =>
      makePersistedComplaintFromUpdate(data, {
        status: data.status,
        procedureCurrentSituation: data.procedureCurrentSituation,
        archivedAt: data.archivedAt,
      }),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    const result = await service.update(
      'case-1',
      {
        status: 'RECEIVED',
        procedureCurrentSituation: 'ARQUIVADO_PELA_JUSTICA',
        statusChangeNote: 'Arquivamento determinado por decisão judicial.',
      } as any,
      makeUser() as any,
    );

    const updateCall = prisma.cpcComplaintCase.update.mock.calls[0]?.[0];
    expect(updateCall.data.status).toBe('ARCHIVED');
    expect(updateCall.data.procedureCurrentSituation).toBe(
      'ARQUIVADO_PELA_JUSTICA',
    );
    expect(updateCall.data.archivedAt).toBeInstanceOf(Date);
    expect(prisma.cpcComplaintStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: 'RECEIVED',
        toStatus: 'ARCHIVED',
        note: 'Arquivamento determinado por decisão judicial.',
      }),
    });
    expect(result.status).toBe('ARCHIVED');
  });

  it('bloqueia transição inválida de status na edição', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.cpcComplaintCase.findUnique.mockResolvedValue(
      makeCurrentComplaint(),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    await expectReason(
      service.update(
        'case-1',
        {
          status: 'ARCHIVED',
        } as any,
        makeUser() as any,
      ),
      'INVALID_STATUS_TRANSITION',
    );

    expect(prisma.cpcComplaintCase.update).not.toHaveBeenCalled();
    expect(prisma.cpcComplaintStatusHistory.create).not.toHaveBeenCalled();
  });

  it('rejeita edição quando o notificador é diferente e falta o posto', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new CpcaService(prisma, audit as any);

    prisma.cpcComplaintCase.findUnique.mockResolvedValue(
      makeCurrentComplaint(),
    );

    jest.spyOn(service as any, 'requireUserId').mockReturnValue('user-1');
    jest.spyOn(service as any, 'assertCaseAccess').mockResolvedValue(undefined);

    await expectReason(
      service.update(
        'case-1',
        {
          victimIsNotifier: false,
          notifierRank: '   ',
          notifierGender: 'MASCULINO',
        } as any,
        makeUser() as any,
      ),
      'NOTIFIER_RANK_REQUIRED_WHEN_DIFFERENT',
    );

    expect(prisma.cpcComplaintCase.update).not.toHaveBeenCalled();
  });
});
