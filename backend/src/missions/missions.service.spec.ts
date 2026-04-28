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
  };
  return {
    mission: {
      findUnique: jest.fn(),
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
    },
    $transaction: jest.fn(async (callback: any) => callback(tx)),
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
      },
      ...scheduleOverrides,
    ],
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
    expect(prisma.__tx.missionScheduleItem.update).toHaveBeenCalledWith({
      where: { id: 'schedule-2' },
      data: { activityId: 'activity-existing' },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'missions',
        action: 'upsert_schedule_field_activities',
        entityId: 'mission-1',
      }),
    );
  });

  it('does not create a duplicate activity when the schedule item is already linked', async () => {
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
        },
      ]),
    );

    const service = new MissionsService(prisma, auditMock, fabLdapMock);
    await expect(
      service.upsertScheduleFieldActivities(
        'mission-1',
        {
          items: [
            {
              scheduleItemId: 'schedule-linked',
              action: 'CREATE',
              title: 'Duplicada',
            },
          ],
        },
        user,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          reason: 'SCHEDULE_ITEM_ALREADY_LINKED',
          activityId: 'activity-existing',
        }),
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
