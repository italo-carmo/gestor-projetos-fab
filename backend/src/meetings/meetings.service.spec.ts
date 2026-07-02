import { DocumentCategory, DocumentLinkEntity } from '@prisma/client';
import { MeetingsService } from './meetings.service';

const prismaMock = {
  meeting: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  role: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  taskTemplate: {
    create: jest.fn(),
  },
  documentAsset: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

const txMock = {
  documentAsset: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  documentLink: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

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
    prismaMock.$transaction.mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(txMock);
    });
  });

  it('creates meetings only with active org-chart participants', async () => {
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-cipavd', name: 'Coordenação CIPAVD' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
    prismaMock.meeting.create.mockResolvedValue({
      id: 'meeting-1',
      localityId: null,
      scope: 'Alinhamento CIPAVD',
      status: 'PLANNED',
      participants: [],
    });

    await service.create({
      datetime: '2026-07-02T12:00:00.000Z',
      scope: 'Alinhamento CIPAVD',
      status: 'PLANNED',
      meetingType: 'ONLINE',
      meetingLink: 'https://meet.example/reuniao',
      participantIds: ['user-1', 'user-1', ' '],
    });

    expect(prismaMock.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participants: { create: [{ userId: 'user-1' }] },
        }),
      }),
    );
  });

  it('rejects meeting participants outside the org chart', async () => {
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-cipavd', name: 'Coordenação CIPAVD' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([]);

    await expect(
      service.create({
        datetime: '2026-07-02T12:00:00.000Z',
        scope: 'Alinhamento CIPAVD',
        status: 'PLANNED',
        meetingType: 'ONLINE',
        meetingLink: 'https://meet.example/reuniao',
        participantIds: ['user-fora'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: {
          field: 'participantIds',
          reason: 'PARTICIPANTS_NOT_IN_ORG_CHART',
        },
      }),
    });
    expect(prismaMock.meeting.create).not.toHaveBeenCalled();
  });

  it('saves optional free-text minutes without requiring files', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      localityId: null,
    });
    prismaMock.meeting.update.mockResolvedValue({
      id: 'meeting-1',
      localityId: null,
      minutes: 'Ata registrada com encaminhamentos',
      participants: [],
      decisions: [],
      tasks: [],
      documents: [],
    });

    await expect(
      service.updateMinutes(
        'meeting-1',
        '  Ata registrada\ncom encaminhamentos  ',
      ),
    ).resolves.toMatchObject({
      id: 'meeting-1',
      minutes: 'Ata registrada com encaminhamentos',
    });

    expect(prismaMock.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'meeting-1' },
        data: { minutes: 'Ata registrada com encaminhamentos' },
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'meetings',
        action: 'update_minutes',
        entityId: 'meeting-1',
        diffJson: { hasMinutes: true },
      }),
    );
  });

  it('clears minutes when the free-text field is empty', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      localityId: null,
    });
    prismaMock.meeting.update.mockResolvedValue({
      id: 'meeting-1',
      localityId: null,
      minutes: null,
      participants: [],
      decisions: [],
      tasks: [],
      documents: [],
    });

    await service.updateMinutes('meeting-1', '   ');

    expect(prismaMock.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { minutes: null },
      }),
    );
  });

  it('uploads one or more minutes files and links them to the meeting', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      scope: 'CIPAVD',
      localityId: 'loc-1',
    });
    txMock.documentAsset.create
      .mockResolvedValueOnce({
        id: 'doc-1',
        fileName: 'ata.pdf',
      })
      .mockResolvedValueOnce({
        id: 'doc-2',
        fileName: 'lista.xlsx',
      });
    txMock.documentLink.upsert.mockResolvedValue({});

    const result = await service.uploadMinutesFiles('meeting-1', [
      {
        fileName: 'ata.pdf',
        fileUrl: '/documents/ata.pdf',
        storageKey: 'ata-storage.pdf',
        mimeType: 'application/pdf',
        fileSize: 1234,
      },
      {
        fileName: 'lista.xlsx',
        fileUrl: '/documents/lista.xlsx',
        storageKey: 'lista-storage.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 987,
      },
    ]);

    expect(result.items).toHaveLength(2);
    expect(txMock.documentAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'ata.pdf',
        category: DocumentCategory.GENERAL,
        sourcePath: 'Reuniões / Ata / CIPAVD',
        fileName: 'ata.pdf',
        fileUrl: '/documents/ata.pdf',
        storageKey: 'ata-storage.pdf',
        localityId: 'loc-1',
        meetingId: 'meeting-1',
      }),
    });
    expect(txMock.documentLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          documentId_entityType_entityId: {
            documentId: 'doc-1',
            entityType: DocumentLinkEntity.MEETING,
            entityId: 'meeting-1',
          },
        },
        create: expect.objectContaining({ label: 'Ata' }),
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'meetings',
        action: 'upload_minutes_files',
        entityId: 'meeting-1',
        diffJson: {
          count: 2,
          fileNames: ['ata.pdf', 'lista.xlsx'],
        },
      }),
    );
  });

  it('rejects minutes upload without files', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      scope: 'CIPAVD',
      localityId: null,
    });

    await expect(
      service.uploadMinutesFiles('meeting-1', []),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: { field: 'files', reason: 'required' },
      }),
    });
    expect(txMock.documentAsset.create).not.toHaveBeenCalled();
  });

  it('deletes a minutes file and unlinks it from the meeting', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      localityId: 'loc-1',
    });
    prismaMock.documentAsset.findFirst.mockResolvedValue({
      id: 'doc-1',
      fileName: 'ata.pdf',
      fileUrl: '/documents/ata-storage.pdf',
      storageKey: 'ata-storage.pdf',
      meetingId: 'meeting-1',
    });
    txMock.documentLink.deleteMany.mockResolvedValue({ count: 1 });
    txMock.documentAsset.delete.mockResolvedValue({
      id: 'doc-1',
      fileName: 'ata.pdf',
    });

    await expect(
      service.deleteMinutesFile('meeting-1', 'doc-1'),
    ).resolves.toMatchObject({
      id: 'doc-1',
      storageKey: 'ata-storage.pdf',
    });

    expect(txMock.documentLink.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: 'doc-1',
        entityType: DocumentLinkEntity.MEETING,
        entityId: 'meeting-1',
      },
    });
    expect(txMock.documentAsset.delete).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'meetings',
        action: 'delete_minutes_file',
        entityId: 'meeting-1',
        localityId: 'loc-1',
        diffJson: { documentId: 'doc-1', fileName: 'ata.pdf' },
      }),
    );
  });

  it('rejects minutes file deletion when the document is not from the meeting', async () => {
    prismaMock.meeting.findUnique.mockResolvedValue({
      id: 'meeting-1',
      localityId: null,
    });
    prismaMock.documentAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteMinutesFile('meeting-1', 'doc-outside'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
    expect(txMock.documentLink.deleteMany).not.toHaveBeenCalled();
    expect(txMock.documentAsset.delete).not.toHaveBeenCalled();
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
