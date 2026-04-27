import { MeetingsService } from './meetings.service';

const prismaMock = {
  meeting: {
    findUnique: jest.fn(),
  },
  taskTemplate: {
    create: jest.fn(),
  },
} as any;

const tasksMock = {
  generateInstances: jest.fn(),
} as any;

const auditMock = {
  log: jest.fn(),
} as any;

describe('MeetingsService task generation', () => {
  const service = new MeetingsService(prismaMock, tasksMock, auditMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the meeting scope when generating task instances', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      scope: 'CIPAVD',
      localityId: null,
    });
    tasksMock.generateInstances.mockResolvedValue({
      items: [{ id: 'task-1' }, { id: 'task-2' }],
    });

    await service.generateTasks(
      'meeting-1',
      {
        templateId: 'tpl-1',
        priority: 'HIGH',
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

    expect(tasksMock.generateInstances).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({
        scope: 'CIPAVD',
        meetingId: 'meeting-1',
        localities: [
          {
            localityId: 'cipavd-loc-1',
            dueDate: '2026-05-01T00:00:00.000Z',
          },
        ],
      }),
      expect.objectContaining({ id: 'ti-1' }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'meetings',
        action: 'generate_tasks',
        entityId: 'meeting-1',
        diffJson: { count: 2 },
      }),
    );
  });
});
