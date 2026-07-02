jest.mock('../auth/totp.util', () => ({
  decryptSecret: jest.fn(() => 'BASE32SECRET'),
  verifyTotpCode: jest.fn(() => true),
}));

import { ActivityScope } from '@prisma/client';
import { HttpException } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

const prismaMock = {
  activityType: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  activity: {
    findUnique: jest.fn(),
  },
  activityReport: {
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  role: {
    findMany: jest.fn(),
  },
} as any;

const auditMock = {
  log: jest.fn(),
} as any;

const configMock = {
  get: jest.fn(),
} as any;

const tiUser = {
  id: 'ti-1',
  roles: [{ name: 'TI' }],
} as any;

const reportSigner = {
  id: 'signer-1',
  roles: [],
  permissions: [
    { resource: 'reports', action: 'approve', scope: 'NATIONAL' },
    { resource: 'task_instances', action: 'update', scope: 'NATIONAL' },
  ],
} as any;

function buildCipavdActivityReport(overrides: Record<string, any> = {}) {
  const date = new Date('2026-05-10T00:00:00.000Z');
  return {
    id: 'report-1',
    date,
    location: '',
    responsible: '',
    missionSupport: '',
    activitiesPerformed: '',
    participantsCount: 0,
    instructorsCount: 0,
    recruitsCount: 0,
    eloPsychologyCount: 0,
    eloSocialAssistanceCount: 0,
    eloJuridicoCount: 0,
    eloCpcaCount: 0,
    eloGraduadoMasterCount: 0,
    participantsCharacteristics: '',
    conclusion: '',
    city: '',
    closingDate: date,
    photos: [],
    ...overrides,
  };
}

describe('ActivitiesService activity types', () => {
  const service = new ActivitiesService(prismaMock, auditMock, configMock);

  beforeEach(() => {
    jest.clearAllMocks();
    configMock.get.mockReturnValue(undefined);
  });

  it('lists activity types by scope and exposes usage counts', async () => {
    prismaMock.activityType.findMany.mockResolvedValue([
      {
        id: 'type-1',
        name: 'Palestra',
        scope: ActivityScope.CIPAVD,
        _count: { activities: 3 },
      },
    ]);

    await expect(service.listTypes('CIPAVD')).resolves.toEqual({
      items: [
        {
          id: 'type-1',
          name: 'Palestra',
          scope: ActivityScope.CIPAVD,
          usageCount: 3,
        },
      ],
    });
    expect(prismaMock.activityType.findMany).toHaveBeenCalledWith({
      where: { scope: ActivityScope.CIPAVD },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        scope: true,
        _count: { select: { activities: true } },
      },
    });
  });

  it('creates the same type name independently per scope', async () => {
    prismaMock.activityType.findFirst.mockResolvedValue(null);
    prismaMock.activityType.create.mockResolvedValue({
      id: 'type-cipavd',
      name: 'Reunião técnica',
      scope: ActivityScope.CIPAVD,
    });

    await expect(
      service.createType(' Reunião técnica ', 'CIPAVD'),
    ).resolves.toEqual({
      id: 'type-cipavd',
      name: 'Reunião técnica',
      scope: ActivityScope.CIPAVD,
    });
    expect(prismaMock.activityType.findFirst).toHaveBeenCalledWith({
      where: {
        scope: ActivityScope.CIPAVD,
        name: { equals: 'Reunião técnica', mode: 'insensitive' },
      },
      select: { id: true, name: true, scope: true },
    });
    expect(prismaMock.activityType.create).toHaveBeenCalledWith({
      data: { name: 'Reunião técnica', scope: ActivityScope.CIPAVD },
      select: { id: true, name: true, scope: true },
    });
  });

  it('returns an existing type only within the requested scope', async () => {
    prismaMock.activityType.findFirst.mockResolvedValue({
      id: 'type-smif',
      name: 'Palestra',
      scope: ActivityScope.SMIF,
    });

    await expect(service.createType('Palestra', 'SMIF')).resolves.toEqual({
      id: 'type-smif',
      name: 'Palestra',
      scope: ActivityScope.SMIF,
    });
    expect(prismaMock.activityType.create).not.toHaveBeenCalled();
  });

  it('rejects activity types from a different scope when resolving an activity payload', async () => {
    prismaMock.activityType.findUnique.mockResolvedValue({
      id: 'type-smif',
      scope: ActivityScope.SMIF,
    });

    await expect(
      (service as any).resolveActivityTypeId('type-smif', 'CIPAVD'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          field: 'activityTypeId',
          reason: 'NOT_FOUND',
        }),
      }),
    });
  });

  it('lists responsible users only from the org chart commission role', async () => {
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-cipavd', name: 'Coordenação CIPAVD' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        name: 'Militar Um',
        email: 'militar.um@example.mil',
        localityId: null,
        specialtyId: null,
        eloRoleId: null,
      },
    ]);

    await expect(service.listResponsibleUsers({}, tiUser)).resolves.toEqual({
      items: [
        {
          id: 'user-1',
          name: 'Militar Um',
          email: 'militar.um@example.mil',
          localityId: null,
          specialtyId: null,
          eloRoleId: null,
        },
      ],
    });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          roles: { some: { roleId: 'role-cipavd' } },
        }),
      }),
    );
  });

  it('rejects activity responsible users outside the org chart', async () => {
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-cipavd', name: 'Coordenação CIPAVD' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([]);

    await expect(
      (service as any).resolveActivityResponsibleIds(
        'loc-1',
        ['user-outside'],
        tiUser,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          field: 'responsibleUserIds',
          reason: 'ACTIVITY_RESPONSIBLE_NOT_IN_ORG_CHART',
        }),
      }),
    });
  });

  it('blocks deletion when an activity type is in use', async () => {
    prismaMock.activityType.findUnique.mockResolvedValue({
      id: 'type-1',
      name: 'Palestra',
      scope: ActivityScope.SMIF,
      _count: { activities: 2 },
    });

    await expect(service.deleteType('type-1', 'SMIF', tiUser)).rejects.toThrow(
      HttpException,
    );
    await expect(
      service.deleteType('type-1', 'SMIF', tiUser),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          reason: 'ACTIVITY_TYPE_IN_USE',
          count: 2,
        }),
      }),
    });
    expect(prismaMock.activityType.delete).not.toHaveBeenCalled();
  });

  it('deletes an unused type and writes an audit entry', async () => {
    prismaMock.activityType.findUnique.mockResolvedValue({
      id: 'type-1',
      name: 'Palestra',
      scope: ActivityScope.CIPAVD,
      _count: { activities: 0 },
    });
    prismaMock.activityType.delete.mockResolvedValue({ id: 'type-1' });

    await expect(
      service.deleteType('type-1', 'CIPAVD', tiUser),
    ).resolves.toEqual({
      ok: true,
    });
    expect(prismaMock.activityType.delete).toHaveBeenCalledWith({
      where: { id: 'type-1' },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'ti-1',
        resource: 'activities',
        action: 'delete_type',
        entityId: 'type-1',
        diffJson: { name: 'Palestra', scope: ActivityScope.CIPAVD },
      }),
    );
  });
});

describe('ActivitiesService CIPAVD reports', () => {
  const service = new ActivitiesService(prismaMock, auditMock, configMock);

  beforeEach(() => {
    jest.clearAllMocks();
    configMock.get.mockReturnValue(undefined);
    prismaMock.user.findUnique.mockResolvedValue({
      totpEnabled: true,
      totpSecret: 'encrypted-secret',
    });
  });

  it('requires public participants when a CIPAVD report is marked as required', async () => {
    prismaMock.activity.findUnique.mockResolvedValue({
      id: 'activity-1',
      title: 'Atividade CIPAVD',
      scope: ActivityScope.CIPAVD,
      reportRequired: true,
      localityId: 'loc-1',
      eventDate: new Date('2026-05-10T00:00:00.000Z'),
      responsibles: [],
      report: buildCipavdActivityReport({ participantsCount: 0 }),
    });

    await expect(
      service.signReport('activity-1', reportSigner, '123456'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          reason: 'ACTIVITY_REPORT_INCOMPLETE',
          missingFields: [
            {
              field: 'participantsCount',
              label: 'Total de Participantes',
            },
          ],
        }),
      }),
    });
    expect(prismaMock.activityReport.update).not.toHaveBeenCalled();
  });

  it('allows signing a CIPAVD report with optional textual fields empty', async () => {
    prismaMock.activity.findUnique.mockResolvedValue({
      id: 'activity-1',
      title: 'Atividade CIPAVD',
      scope: ActivityScope.CIPAVD,
      reportRequired: true,
      localityId: 'loc-1',
      eventDate: new Date('2026-05-10T00:00:00.000Z'),
      responsibles: [],
      report: buildCipavdActivityReport({ participantsCount: 12 }),
    });
    prismaMock.activityReport.update.mockResolvedValue({
      id: 'report-1',
      signedAt: new Date('2026-05-11T10:00:00.000Z'),
      signedBy: { id: 'signer-1', name: 'Signatário' },
      signatureHash: 'signature-hash',
      signaturePayloadHash: 'payload-hash',
      signatureAlgorithm: 'HMAC-SHA256',
      signatureVersion: 1,
      photos: [],
    });

    await expect(
      service.signReport('activity-1', reportSigner, '123456'),
    ).resolves.toMatchObject({
      activityId: 'activity-1',
      signatureHash: 'signature-hash',
      signaturePayloadHash: 'payload-hash',
      signatureAlgorithm: 'HMAC-SHA256',
      signatureVersion: 1,
    });
    expect(prismaMock.activityReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          signedById: 'signer-1',
          signatureHash: expect.any(String),
          signaturePayloadHash: expect.any(String),
          signatureAlgorithm: 'HMAC-SHA256',
          signatureVersion: 1,
        }),
      }),
    );
  });
});
