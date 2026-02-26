import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';

const prismaMock = {
  taskInstance: {
    findUnique: jest.fn(),
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
});
