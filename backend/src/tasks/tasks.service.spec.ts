import { ActivityScope, LocalityCatalogType, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';

const prismaMock = {
  $transaction: jest.fn(),
  phase: {
    findUnique: jest.fn(),
  },
  locality: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  taskTemplate: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  taskInstance: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
} as any;

const auditMock = {
  log: jest.fn(),
  prisma: null,
  truncateDiff: jest.fn(),
  list: jest.fn(),
} as any;

describe('TasksService rules', () => {
  const service = new TasksService(prismaMock, auditMock);

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((ops: any[]) =>
      Promise.all(ops),
    );
  });

  it('applies progress rules for status', () => {
    expect(
      (service as any).applyProgressRules(TaskStatus.NOT_STARTED, 50),
    ).toBe(0);
    expect((service as any).applyProgressRules(TaskStatus.DONE, 10)).toBe(100);
    expect(
      (service as any).applyProgressRules(TaskStatus.IN_PROGRESS, 120),
    ).toBe(99);
    expect(
      (service as any).applyProgressRules(TaskStatus.IN_PROGRESS, -5),
    ).toBe(0);
  });

  it('flags late tasks correctly', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      (service as any).isLate({
        dueDate: past,
        status: TaskStatus.NOT_STARTED,
      }),
    ).toBe(true);
    expect(
      (service as any).isLate({ dueDate: past, status: TaskStatus.DONE }),
    ).toBe(false);
    expect(
      (service as any).isLate({
        dueDate: future,
        status: TaskStatus.IN_PROGRESS,
      }),
    ).toBe(false);
  });

  it('allows finishing task even without report', async () => {
    prismaMock.taskInstance.findUnique.mockResolvedValue({
      id: 't1',
      localityId: 'loc1',
      reportRequired: true,
      taskTemplate: { specialtyId: null },
      status: TaskStatus.IN_PROGRESS,
      progressPercent: 50,
      blockedByIdsJson: null,
    });
    prismaMock.taskInstance.update.mockResolvedValue({
      id: 't1',
      localityId: 'loc1',
      status: TaskStatus.DONE,
      progressPercent: 100,
    });

    await expect(
      service.updateStatus(
        't1',
        TaskStatus.DONE as any,
        {
          id: 'u1',
          roles: [{ name: 'TI' }],
        } as any,
      ),
    ).resolves.toMatchObject({
      status: TaskStatus.DONE,
      progressPercent: 100,
    });
  });

  it('adds scope to task list filters and keeps SMIF as default', () => {
    expect((service as any).buildTaskWhere({}).where).toMatchObject({
      AND: [{ scope: ActivityScope.SMIF }],
    });

    expect(
      (service as any).buildTaskWhere({ scope: 'CIPAVD' }).where,
    ).toMatchObject({
      AND: [{ scope: ActivityScope.CIPAVD }],
    });
  });

  it('accepts pageSize all for full task exports or grouped queries', () => {
    expect((service as any).parsePagination('3', 'all')).toEqual({
      page: 1,
      pageSize: -1,
      skip: 0,
      take: undefined,
    });
  });

  it('creates manual CIPAVD tasks only with CIPAVD localities', async () => {
    prismaMock.phase.findUnique.mockResolvedValue({ id: 'phase-1' });
    prismaMock.locality.findMany.mockResolvedValue([{ id: 'cipavd-loc-1' }]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.taskTemplate.findFirst.mockResolvedValue({ id: 'manual-tpl' });
    prismaMock.taskInstance.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `task-${data.localityId}`, ...data }),
    );
    jest
      .spyOn(service as any, 'loadTaskInstancesMapped')
      .mockResolvedValueOnce([{ id: 'task-cipavd-loc-1', scope: 'CIPAVD' }]);

    await expect(
      service.createTaskInstancesManual(
        {
          scope: 'CIPAVD',
          title: 'Tarefa CPCA',
          phaseId: 'phase-1',
          dueDate: '2026-04-30T00:00:00.000Z',
          localityIds: ['cipavd-loc-1'],
        },
        {
          id: 'ti-1',
          roles: [{ name: 'TI' }],
        } as any,
      ),
    ).resolves.toEqual({
      items: [{ id: 'task-cipavd-loc-1', scope: 'CIPAVD' }],
    });

    expect(prismaMock.locality.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['cipavd-loc-1'] },
        catalogType: LocalityCatalogType.CIPAVD,
      },
      select: { id: true },
    });
    expect(prismaMock.taskInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          localityId: 'cipavd-loc-1',
          scope: ActivityScope.CIPAVD,
        }),
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_batch_manual',
        diffJson: expect.objectContaining({ scope: ActivityScope.CIPAVD }),
      }),
    );
  });

  it('rejects manual CIPAVD tasks when selected localities are not in the CIPAVD catalog', async () => {
    prismaMock.phase.findUnique.mockResolvedValue({ id: 'phase-1' });
    prismaMock.locality.findMany.mockResolvedValue([]);

    await expect(
      service.createTaskInstancesManual(
        {
          scope: 'CIPAVD',
          title: 'Tarefa CPCA',
          phaseId: 'phase-1',
          dueDate: '2026-04-30T00:00:00.000Z',
          localityIds: ['smif-loc-1'],
        },
        {
          id: 'ti-1',
          roles: [{ name: 'TI' }],
        } as any,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
    expect(prismaMock.taskInstance.create).not.toHaveBeenCalled();
  });

  it('generates template instances with the requested task scope', async () => {
    prismaMock.taskTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      specialtyId: null,
      reportRequiredDefault: true,
      eloRoleId: null,
    });
    prismaMock.locality.findMany.mockResolvedValue([{ id: 'cipavd-loc-1' }]);
    prismaMock.taskInstance.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `task-${data.localityId}`, ...data }),
    );
    jest
      .spyOn(service as any, 'loadTaskInstancesMapped')
      .mockResolvedValueOnce([{ id: 'task-cipavd-loc-1', scope: 'CIPAVD' }]);

    await service.generateInstances(
      'tpl-1',
      {
        scope: 'CIPAVD',
        localities: [
          {
            localityId: 'cipavd-loc-1',
            dueDate: '2026-05-01T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'ti-1',
        roles: [{ name: 'TI' }],
      } as any,
    );

    expect(prismaMock.locality.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['cipavd-loc-1'] },
        catalogType: LocalityCatalogType.CIPAVD,
      },
      select: { id: true },
    });
    expect(prismaMock.taskInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskTemplateId: 'tpl-1',
          localityId: 'cipavd-loc-1',
          scope: ActivityScope.CIPAVD,
        }),
      }),
    );
  });
});
