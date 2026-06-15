import { CipavdReportsService } from './cipavd-reports.service';

const makeUser = (roles: string[]) =>
  ({
    id: 'user-1',
    name: 'Usuário',
    email: 'user@example.test',
    executiveHidePii: false,
    permissions: [],
    moduleAccessOverrides: [],
    roles: roles.map((name) => ({
      id: name,
      name,
      wildcard: false,
      permissions: [],
    })),
  }) as any;

describe('CipavdReportsService', () => {
  const prisma = {
    cipavdReportFolder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cipavdReportFile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
  const audit = { log: jest.fn() } as any;
  const service = new CipavdReportsService(prisma, audit);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows only active COMGEP or TI roles', () => {
    expect(() => service.assertAccess(makeUser(['COMGEP']))).not.toThrow();
    expect(() => service.assertAccess(makeUser(['TI']))).not.toThrow();
    expect(() =>
      service.assertAccess(makeUser(['Coordenação CIPAVD'])),
    ).toThrow();
  });

  it('rejects duplicate folder names within the same parent', async () => {
    prisma.cipavdReportFolder.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createFolder({ name: 'Relatórios Junho' }, makeUser(['COMGEP'])),
    ).rejects.toThrow();

    expect(prisma.cipavdReportFolder.create).not.toHaveBeenCalled();
  });

  it('prevents moving a folder into its own descendant', async () => {
    prisma.cipavdReportFolder.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === 'folder-a') {
          return { id: 'folder-a', name: 'A', parentId: null };
        }
        if (where.id === 'folder-b') {
          return { id: 'folder-b', name: 'B', parentId: 'folder-a' };
        }
        return null;
      },
    );

    await expect(
      service.updateFolder(
        'folder-a',
        { parentId: 'folder-b' },
        makeUser(['COMGEP']),
      ),
    ).rejects.toThrow();

    expect(prisma.cipavdReportFolder.update).not.toHaveBeenCalled();
  });

  it('returns report paths for knowledge-base import candidates', async () => {
    prisma.cipavdReportFile.findMany.mockResolvedValue([
      {
        id: 'file-1',
        name: 'ata.pdf',
        folderId: 'folder-child',
        fileName: 'ata.pdf',
        fileUrl: '/cipavd-reports/files/file-1/download',
        storageKey: 'stored.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        checksum: 'sha',
        createdAt: new Date('2026-06-01T00:00:00Z'),
        updatedAt: new Date('2026-06-02T00:00:00Z'),
        createdBy: null,
      },
    ]);
    prisma.cipavdReportFolder.findMany.mockResolvedValue([
      { id: 'folder-parent', name: '2026', parentId: null },
      { id: 'folder-child', name: 'Junho', parentId: 'folder-parent' },
    ]);

    const result = await service.listKnowledgeBaseCandidates(
      {},
      makeUser(['COMGEP']),
    );

    expect(result.items[0]).toMatchObject({
      id: 'file-1',
      path: 'Acervo / 2026 / Junho / ata.pdf',
      folderPath: 'Acervo / 2026 / Junho',
    });
  });
});
