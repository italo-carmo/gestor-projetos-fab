jest.mock('../auth/totp.util', () => ({
  decryptSecret: jest.fn(() => 'BASE32SECRET'),
  verifyTotpCode: jest.fn(() => true),
}));

import { ActivityScope } from '@prisma/client';
import { MissionsService } from './missions.service';

const auditMock = {
  log: jest.fn(),
} as any;

const fabLdapMock = {} as any;

const user = {
  id: 'user-creator',
  permissions: [
    { resource: 'missions', action: 'view', scope: 'NATIONAL' },
    { resource: 'missions', action: 'update', scope: 'NATIONAL' },
    { resource: 'task_instances', action: 'create', scope: 'NATIONAL' },
    { resource: 'task_instances', action: 'update', scope: 'NATIONAL' },
  ],
  roles: [],
} as any;

const admMissionsUser = {
  ...user,
  permissions: [
    { resource: 'missions', action: 'view', scope: 'NATIONAL' },
    { resource: 'missions', action: 'create', scope: 'NATIONAL' },
    { resource: 'missions', action: 'update', scope: 'NATIONAL' },
    { resource: 'missions', action: 'download', scope: 'NATIONAL' },
  ],
  roles: [
    {
      id: 'role-adm-missoes',
      name: 'Adm Missões',
      wildcard: false,
      permissions: [],
    },
  ],
} as any;

function buildPrismaMock() {
  const tx = {
    activity: {
      create: jest.fn().mockResolvedValue({
        id: 'activity-created',
        title: 'Palestra ajustada',
      }),
    },
    missionScheduleItem: {
      update: jest.fn().mockResolvedValue({}),
    },
    missionScheduleItemActivity: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    missionReport: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    missionReportSignature: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return {
    mission: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    missionReport: {
      findUnique: jest.fn(),
    },
    missionReportSignature: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    locality: {
      findMany: jest.fn().mockResolvedValue([{ id: 'loc-1' }]),
    },
    activity: {
      findMany: jest.fn(),
    },
    activityType: {
      findUnique: jest.fn(),
    },
    specialty: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (input: any) =>
      Array.isArray(input) ? Promise.all(input) : input(tx),
    ),
    __tx: tx,
  } as any;
}

function buildMission(scheduleOverrides: any[] = []) {
  return {
    id: 'mission-1',
    title: 'Missão CIPAVD',
    scope: ActivityScope.CIPAVD,
    localityId: 'loc-1',
    locality: { id: 'loc-1', name: 'OM Alfa', code: 'ALFA' },
    scheduleItems: [
      {
        id: 'schedule-1',
        title: 'Palestra base',
        startAt: new Date('2026-04-28T12:00:00.000Z'),
        durationMinutes: 60,
        location: 'Auditório',
        responsible: 'Maj Silva',
        participants: 'Turma A',
        activityId: null,
        activity: null,
        activityLinks: [],
      },
      {
        id: 'schedule-2',
        title: 'Reunião de curadoria',
        startAt: new Date('2026-04-28T14:00:00.000Z'),
        durationMinutes: 45,
        location: 'Sala 2',
        responsible: 'Cap Lima',
        participants: 'Equipe',
        activityId: null,
        activity: null,
        activityLinks: [],
      },
      ...scheduleOverrides,
    ],
  };
}

function buildMissionForReport(overrides: Record<string, any> = {}) {
  return {
    id: 'mission-1',
    title: 'Missão CIPAVD',
    scope: ActivityScope.CIPAVD,
    localityId: 'loc-1',
    startDate: new Date('2026-05-10T00:00:00.000Z'),
    endDate: new Date('2026-05-11T00:00:00.000Z'),
    locality: { id: 'loc-1', name: 'OM Alfa', code: 'ALFA' },
    ...overrides,
  };
}

describe('MissionsService schedule field activities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates new field activities and links selected schedule items in the mission scope', async () => {
    const prisma = buildPrismaMock();
    prisma.mission.findUnique.mockResolvedValue(buildMission());
    prisma.activity.findMany.mockResolvedValue([
      {
        id: 'activity-existing',
        title: 'Atividade existente',
        scope: ActivityScope.CIPAVD,
        localityId: 'loc-1',
      },
    ]);
    prisma.activityType.findUnique.mockResolvedValue({
      id: 'type-1',
      scope: ActivityScope.CIPAVD,
    });
    prisma.specialty.findMany.mockResolvedValue([{ id: 'spec-1' }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'responsible-1' }]);

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    const result = await service.upsertScheduleFieldActivities(
      'mission-1',
      {
        items: [
          {
            scheduleItemId: 'schedule-1',
            action: 'CREATE',
            title: 'Palestra ajustada',
            activityTypeId: 'type-1',
            specialtyIds: ['spec-1'],
            responsibleUserIds: ['responsible-1'],
            eventDate: '2026-04-28',
            reportRequired: true,
          },
          {
            scheduleItemId: 'schedule-2',
            action: 'LINK',
            activityId: 'activity-existing',
          },
        ],
      },
      user,
    );

    expect(result).toMatchObject({
      missionId: 'mission-1',
      scope: ActivityScope.CIPAVD,
      created: 1,
      linked: 1,
    });
    expect(prisma.__tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Palestra ajustada',
          scope: ActivityScope.CIPAVD,
          localityId: 'loc-1',
          activityTypeId: 'type-1',
          specialtyId: 'spec-1',
          reportRequired: true,
          visitScheduleItems: {
            create: expect.objectContaining({
              startTime: '09:00',
              location: 'Auditório',
              responsible: 'Maj Silva',
              participants: 'Turma A',
            }),
          },
        }),
        select: { id: true, title: true },
      }),
    );
    expect(prisma.__tx.missionScheduleItem.update).toHaveBeenCalledWith({
      where: { id: 'schedule-1' },
      data: { activityId: 'activity-created' },
    });
    expect(prisma.__tx.missionScheduleItemActivity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scheduleItemId_activityId: {
            scheduleItemId: 'schedule-1',
            activityId: 'activity-created',
          },
        },
      }),
    );
    expect(prisma.__tx.missionScheduleItem.update).toHaveBeenCalledWith({
      where: { id: 'schedule-2' },
      data: { activityId: 'activity-existing' },
    });
    expect(prisma.__tx.missionScheduleItemActivity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scheduleItemId_activityId: {
            scheduleItemId: 'schedule-2',
            activityId: 'activity-existing',
          },
        },
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'missions',
        action: 'upsert_schedule_field_activities',
        entityId: 'mission-1',
      }),
    );
  });

  it('creates an additional field activity when the schedule item is already linked', async () => {
    const prisma = buildPrismaMock();
    prisma.mission.findUnique.mockResolvedValue(
      buildMission([
        {
          id: 'schedule-linked',
          title: 'Item vinculado',
          startAt: new Date('2026-04-28T12:00:00.000Z'),
          durationMinutes: 60,
          location: 'Auditório',
          responsible: 'Maj Silva',
          participants: 'Turma A',
          activityId: 'activity-existing',
          activity: { id: 'activity-existing', title: 'Atividade existente' },
          activityLinks: [
            {
              activity: {
                id: 'activity-existing',
                title: 'Atividade existente',
              },
            },
          ],
        },
      ]),
    );

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    const result = await service.upsertScheduleFieldActivities(
      'mission-1',
      {
        items: [
          {
            scheduleItemId: 'schedule-linked',
            action: 'CREATE',
            title: 'Questionário CPCA',
          },
        ],
      },
      user,
    );

    expect(result).toMatchObject({ created: 1, linked: 0 });
    expect(prisma.__tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Questionário CPCA',
        }),
      }),
    );
    expect(prisma.__tx.missionScheduleItemActivity.upsert).toHaveBeenCalledWith({
      where: {
        scheduleItemId_activityId: {
          scheduleItemId: 'schedule-linked',
          activityId: 'activity-created',
        },
      },
      update: {},
      create: {
        scheduleItemId: 'schedule-linked',
        activityId: 'activity-created',
      },
    });
    expect(prisma.__tx.missionScheduleItem.update).not.toHaveBeenCalledWith({
      where: { id: 'schedule-linked' },
      data: { activityId: 'activity-created' },
    });
  });

  it('rejects linking a schedule item to an activity from another scope', async () => {
    const prisma = buildPrismaMock();
    prisma.mission.findUnique.mockResolvedValue(buildMission());
    prisma.activity.findMany.mockResolvedValue([
      {
        id: 'activity-smif',
        title: 'Atividade SMIF',
        scope: ActivityScope.SMIF,
        localityId: 'loc-1',
      },
    ]);

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    await expect(
      service.upsertScheduleFieldActivities(
        'mission-1',
        {
          items: [
            {
              scheduleItemId: 'schedule-1',
              action: 'LINK',
              activityId: 'activity-smif',
            },
          ],
        },
        user,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          field: 'activityId',
          reason: 'ACTIVITY_NOT_FOUND_FOR_SCOPE',
        }),
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('MissionsService Adm Missões access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips report data from the mission list', async () => {
    const prisma = buildPrismaMock();
    prisma.mission.findMany.mockResolvedValue([
      {
        id: 'mission-1',
        title: 'Missão CIPAVD',
        scope: ActivityScope.CIPAVD,
        localityId: 'loc-1',
        participants: [],
        scheduleItems: [{ id: 'schedule-1' }],
        report: {
          id: 'report-1',
          contentHtml: '<p>Relatório reservado</p>',
          contentText: 'Relatório reservado',
          signatures: [{ id: 'sig-1' }],
        },
      },
    ]);
    prisma.mission.count.mockResolvedValue(1);

    const service = new MissionsService(prisma, auditMock, fabLdapMock);

    await expect(
      service.list({ scope: 'CIPAVD' }, admMissionsUser),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'mission-1',
          report: null,
          reportFilled: false,
          reportSignaturesCount: 0,
        },
      ],
      total: 1,
    });
  });

  it('strips report and field-activity links from mission details', async () => {
    const prisma = buildPrismaMock();
    prisma.mission.findUnique.mockResolvedValue({
      ...buildMissionForReport(),
      participants: [],
      banners: [],
      scheduleItems: [
        {
          id: 'schedule-1',
          title: 'Palestra base',
          activity: { id: 'activity-1', title: 'Atividade vinculada' },
          activityLinks: [
            {
              activity: {
                id: 'activity-1',
                title: 'Atividade vinculada',
              },
            },
          ],
        },
      ],
      report: {
        id: 'report-1',
        contentHtml: '<p>Relatório reservado</p>',
        contentText: 'Relatório reservado',
        signatures: [{ id: 'sig-1', removedAt: null }],
      },
    });

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    const result = await service.getById('mission-1', admMissionsUser);

    expect(result).toMatchObject({
      id: 'mission-1',
      report: null,
      reportFilled: false,
      reportSignaturesCount: 0,
    });
    expect(result.scheduleItems[0]).toMatchObject({
      id: 'schedule-1',
      activity: null,
      activityLinks: [],
    });
  });

  it('blocks advanced mission tabs even with missions update permission', async () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    );

    await expect(
      service.upsertReport(
        'mission-1',
        { contentHtml: '<p>Relatório</p>', contentText: 'Relatório' },
        admMissionsUser,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RBAC_FORBIDDEN' }),
    });

    await expect(
      service.getChecklist('mission-1', admMissionsUser),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RBAC_FORBIDDEN' }),
    });
  });
});

describe('MissionsService mission reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves rich-text report content and invalidates active signatures when content changes', async () => {
    const prisma = buildPrismaMock();
    prisma.mission.findUnique.mockResolvedValue(
      buildMissionForReport({ locality: undefined }),
    );
    prisma.missionReport.findUnique.mockResolvedValue({
      id: 'report-1',
      contentHtml: '<p>Anterior</p>',
      contentText: 'Anterior',
    });
    prisma.__tx.missionReport.upsert.mockResolvedValue({ id: 'report-1' });
    prisma.__tx.missionReport.findUnique.mockResolvedValue({
      id: 'report-1',
      missionId: 'mission-1',
      contentHtml: '<p>Novo relatório</p>',
      contentText: 'Novo relatório',
      signatures: [
        {
          id: 'sig-1',
          removedAt: new Date('2026-05-12T10:00:00.000Z'),
        },
      ],
    });

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    await expect(
      service.upsertReport(
        'mission-1',
        {
          contentHtml:
            '<p onclick="alert(1)">Novo relatório</p><script>alert(1)</script>',
          contentText: 'Novo relatório',
        },
        user,
      ),
    ).resolves.toMatchObject({
      id: 'report-1',
      filled: true,
    });

    expect(prisma.__tx.missionReport.upsert).toHaveBeenCalledWith({
      where: { missionId: 'mission-1' },
      create: {
        missionId: 'mission-1',
        contentHtml: '<p>Novo relatório</p>',
        contentText: 'Novo relatório',
      },
      update: {
        contentHtml: '<p>Novo relatório</p>',
        contentText: 'Novo relatório',
      },
    });
    expect(prisma.__tx.missionReportSignature.updateMany).toHaveBeenCalledWith({
      where: { reportId: 'report-1', removedAt: null },
      data: {
        removedAt: expect.any(Date),
        removedById: 'user-creator',
      },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'missions',
        action: 'upsert_report',
        entityId: 'mission-1',
      }),
    );
  });

  it('rejects mission reports outside CIPAVD scope', async () => {
    const prisma = buildPrismaMock();
    prisma.locality.findMany.mockResolvedValue([
      {
        id: 'loc-1',
        name: 'Brasília',
        recruitsFemaleCountCurrent: 10,
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    prisma.mission.findUnique.mockResolvedValue(
      buildMissionForReport({ scope: ActivityScope.SMIF }),
    );

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    await expect(
      service.upsertReport(
        'mission-1',
        { contentHtml: '<p>Relatório</p>', contentText: 'Relatório' },
        user,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          reason: 'MISSION_REPORT_ONLY_CIPAVD',
          field: 'scope',
        }),
      }),
    });
    expect(prisma.__tx.missionReport.upsert).not.toHaveBeenCalled();
  });

  it('creates a report signature for the current user without replacing other signatures', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-creator',
      name: 'Usuário',
      email: 'user@example.com',
      totpEnabled: true,
      totpSecret: 'encrypted-secret',
    });
    prisma.mission.findUnique.mockResolvedValue(
      buildMissionForReport({
        report: {
          id: 'report-1',
          contentHtml: '<p>Relatório final</p>',
          contentText: 'Relatório final',
          updatedAt: new Date('2026-05-12T10:00:00.000Z'),
          signatures: [
            {
              id: 'sig-other',
              signedById: 'other-user',
            },
          ],
        },
      }),
    );
    prisma.missionReportSignature.create.mockResolvedValue({
      id: 'sig-user',
      reportId: 'report-1',
      signedById: 'user-creator',
      signedAt: new Date('2026-05-12T11:00:00.000Z'),
      removedAt: null,
      signaturePayloadHash: 'payload-hash',
      signatureHash: 'signature-hash',
      signatureAlgorithm: 'HMAC-SHA256',
      signatureVersion: 1,
      signedBy: { id: 'user-creator', name: 'Usuário' },
      removedBy: null,
    });

    const service = new MissionsService(prisma, auditMock, fabLdapMock, {
      get: jest.fn(() => undefined),
    } as any);

    await expect(
      service.signReport('mission-1', user, '123456'),
    ).resolves.toMatchObject({
      id: 'sig-user',
      signedById: 'user-creator',
      signatureHash: 'signature-hash',
    });
    expect(prisma.missionReportSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report-1',
          signedById: 'user-creator',
          signatureHash: expect.any(String),
          signaturePayloadHash: expect.any(String),
          signatureAlgorithm: 'HMAC-SHA256',
          signatureVersion: 1,
        }),
      }),
    );
  });

  it('rejects a second active signature from the same user', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      totpEnabled: true,
      totpSecret: 'encrypted-secret',
    });
    prisma.mission.findUnique.mockResolvedValue(
      buildMissionForReport({
        report: {
          id: 'report-1',
          contentHtml: '<p>Relatório final</p>',
          contentText: 'Relatório final',
          updatedAt: new Date('2026-05-12T10:00:00.000Z'),
          signatures: [
            {
              id: 'sig-user',
              signedById: 'user-creator',
            },
          ],
        },
      }),
    );

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    await expect(
      service.signReport('mission-1', user, '123456'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          reason: 'MISSION_REPORT_ALREADY_SIGNED',
          field: 'signedById',
        }),
      }),
    });
    expect(prisma.missionReportSignature.create).not.toHaveBeenCalled();
  });

  it('soft-removes a report signature and keeps it in history', async () => {
    const prisma = buildPrismaMock();
    prisma.missionReportSignature.findFirst.mockResolvedValue({
      id: 'sig-user',
      removedAt: null,
      report: {
        mission: {
          id: 'mission-1',
          localityId: 'loc-1',
          scope: ActivityScope.CIPAVD,
        },
      },
      signedBy: { id: 'user-creator', name: 'Usuário' },
      removedBy: null,
    });
    prisma.missionReportSignature.update.mockResolvedValue({
      id: 'sig-user',
      removedAt: new Date('2026-05-12T12:00:00.000Z'),
      removedById: 'user-creator',
      signedBy: { id: 'user-creator', name: 'Usuário' },
      removedBy: { id: 'user-creator', name: 'Usuário' },
    });

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    await expect(
      service.removeReportSignature('mission-1', 'sig-user', user),
    ).resolves.toMatchObject({
      id: 'sig-user',
      removedById: 'user-creator',
    });
    expect(prisma.missionReportSignature.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sig-user' },
        data: {
          removedAt: expect.any(Date),
          removedById: 'user-creator',
        },
      }),
    );
  });
});

describe('MissionsService participant name formatting', () => {
  it('removes known OM suffixes from mission schedule PDF participant names', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;
    const knownOmSuffixes = new Set(['COMGEP', 'DIRENS']);

    expect(
      service.removeOmFromParticipantName(
        '2S FLAVIA COMGEP',
        null,
        knownOmSuffixes,
      ),
    ).toBe('2S FLAVIA');
    expect(
      service.removeOmFromParticipantName(
        '1T NATHALIA PANDINI DIRENS',
        null,
        knownOmSuffixes,
      ),
    ).toBe('1T NATHALIA PANDINI');
  });

  it('keeps uppercase surname tokens when they are not known OM suffixes', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;
    const knownOmSuffixes = new Set(['COMGEP', 'DIRENS']);

    expect(
      service.removeOmFromParticipantName(
        '1T ANA MARIA SILVA',
        null,
        knownOmSuffixes,
      ),
    ).toBe('1T ANA MARIA SILVA');
  });

  it('keeps group participant descriptions that end with known OM suffixes', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;
    const knownOmSuffixes = new Set(['COMGEP', 'DIRENS', 'CENIPA']);

    expect(
      service.formatParticipantTextForPdf(
        'Alunas do COMGEP, Corpo docente do DIRENS, Todas do CENIPA',
        knownOmSuffixes,
      ),
    ).toBe(
      'Alunas do COMGEP, Corpo docente do DIRENS, Todas do CENIPA',
    );
  });

  it('removes the explicit participant FAB OM even when it is not in the known suffix list', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;

    expect(
      service.removeOmFromParticipantName('2S FLAVIA COMGEP', 'COMGEP'),
    ).toBe('2S FLAVIA');
  });

  it('formats comma-separated schedule item participant text without known OM suffixes', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;
    const knownOmSuffixes = new Set(['COMGEP', 'DIRENS']);

    expect(
      service.formatParticipantTextForPdf(
        '2S FLAVIA COMGEP, CP ESTER, CP TAMIRES, 1T NATHALIA PANDINI DIRENS, 1T CAMARGO, SO ALVES',
        knownOmSuffixes,
      ),
    ).toBe(
      'CP ESTER, CP TAMIRES, 1T NATHALIA PANDINI, 1T CAMARGO, SO ALVES, 2S FLAVIA',
    );
  });

  it('keeps participant order inside the same rank while sorting by seniority', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;

    expect(
      service.formatParticipantTextForPdf(
        '2S BRAVO, CP ESTER, CP TAMIRES, 2S ALFA',
      ),
    ).toBe('CP ESTER, CP TAMIRES, 2S BRAVO, 2S ALFA');
  });
});

describe('MissionsService mission period formatting', () => {
  it('formats mission date-only values without shifting to the previous local day', () => {
    const service = new MissionsService(
      buildPrismaMock(),
      auditMock,
      fabLdapMock,
    ) as any;

    expect(
      service.formatMissionPeriodDate(new Date('2026-05-18T00:00:00.000Z')),
    ).toBe('18/05/2026');
    expect(
      service.formatMissionPeriodDate(new Date('2026-05-21T00:00:00.000Z')),
    ).toBe('21/05/2026');
  });
});
