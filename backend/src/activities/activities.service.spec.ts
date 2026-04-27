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

describe('ActivitiesService activity types', () => {
  const service = new ActivitiesService(prismaMock, auditMock, configMock);

  beforeEach(() => {
    jest.clearAllMocks();
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
    await expect(service.deleteType('type-1', 'SMIF', tiUser)).rejects.toMatchObject({
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

    await expect(service.deleteType('type-1', 'CIPAVD', tiUser)).resolves.toEqual({
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
