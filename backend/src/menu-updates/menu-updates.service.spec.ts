import { MenuUpdatesService } from './menu-updates.service';
import type { RbacUser } from '../rbac/rbac.types';

function buildCpcaUser(overrides: Partial<RbacUser> = {}): RbacUser {
  return {
    id: 'user-1',
    name: 'Presidente CPCA',
    email: 'cpca@example.mil.br',
    omId: 'om-1',
    localityId: null,
    specialtyId: null,
    eloRoleId: null,
    executiveHidePii: false,
    permissions: [],
    moduleAccessOverrides: [],
    roles: [
      {
        id: 'role-cpca',
        name: 'CPCA',
        wildcard: false,
        permissions: [],
      },
    ],
    allRoles: [],
    ...overrides,
  };
}

function buildPrismaMock() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    cpcaCommissionPresident: {
      count: jest.fn().mockResolvedValue(0),
    },
    cpcaCommissionMember: {
      count: jest.fn().mockResolvedValue(0),
    },
    cpcaCommissionCoverageOm: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    cpcComplaintCipavdThread: {
      count: jest.fn().mockResolvedValue(0),
    },
    cpcaPresidentSelfRegistration: {
      count: jest.fn().mockResolvedValue(0),
    },
    cpcaPresidentNominationRequest: {
      count: jest.fn().mockResolvedValue(0),
    },
    cpcaCommissionCoverageRequest: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('MenuUpdatesService CPCA badges', () => {
  it('nao mostra badge de CPCA para usuario que nao e membro nem presidente da comissao', async () => {
    const prisma = buildPrismaMock();
    const service = new MenuUpdatesService(prisma as any);

    const result = await service.list(
      'cpca_cases,cpca_commission',
      buildCpcaUser(),
    );

    expect(result.items).toEqual([
      expect.objectContaining({ menuKey: 'cpca_cases', unreadCount: 0 }),
      expect.objectContaining({ menuKey: 'cpca_commission', unreadCount: 0 }),
    ]);
    expect(prisma.cpcComplaintCipavdThread.count).not.toHaveBeenCalled();
    expect(prisma.cpcaPresidentNominationRequest.count).not.toHaveBeenCalled();
    expect(prisma.cpcaCommissionCoverageRequest.count).not.toHaveBeenCalled();
  });

  it('conta pendencias e homologacoes locais para membro ou presidente CPCA', async () => {
    const prisma = buildPrismaMock();
    prisma.cpcaCommissionPresident.count.mockResolvedValue(1);
    prisma.cpcaCommissionCoverageOm.findMany.mockResolvedValue([
      { managedOmId: 'om-2' },
    ]);
    prisma.cpcComplaintCipavdThread.count.mockResolvedValue(2);
    prisma.cpcaPresidentNominationRequest.count.mockResolvedValue(1);
    prisma.cpcaCommissionCoverageRequest.count.mockResolvedValue(1);
    const service = new MenuUpdatesService(prisma as any);

    const result = await service.list(
      'cpca_cases,cpca_commission',
      buildCpcaUser(),
    );

    expect(result.items).toEqual([
      expect.objectContaining({ menuKey: 'cpca_cases', unreadCount: 2 }),
      expect.objectContaining({ menuKey: 'cpca_commission', unreadCount: 2 }),
    ]);
    expect(prisma.cpcComplaintCipavdThread.count).toHaveBeenCalledWith({
      where: {
        type: 'PENDENCY',
        status: 'OPEN',
        complaintCase: {
          workflowScope: 'CPCA',
          omId: { in: ['om-1', 'om-2'] },
        },
      },
    });
    expect(prisma.cpcaPresidentNominationRequest.count).toHaveBeenCalledWith({
      where: { omId: 'om-1', status: 'PENDING' },
    });
    expect(prisma.cpcaCommissionCoverageRequest.count).toHaveBeenCalledWith({
      where: { omId: 'om-1', status: 'PENDING' },
    });
  });

  it('mantem badge de denuncias para gestao ate a denuncia ser aberta', async () => {
    const prisma = buildPrismaMock();
    const lastEventAt = new Date('2026-05-04T12:00:00.000Z');
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { menuKey: 'smif_complaints', unreadCount: 0, lastEventAt: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { menuKey: 'cpca_cases', unreadCount: 2, lastEventAt },
        { menuKey: 'smif_complaints', unreadCount: 1, lastEventAt },
      ]);
    const service = new MenuUpdatesService(prisma as any);

    const result = await service.list(
      'cpca_cases,smif_complaints',
      buildCpcaUser({
        roles: [
          {
            id: 'role-coord',
            name: 'Coordenação CIPAVD',
            wildcard: false,
            permissions: [],
          },
        ],
        permissions: [
          { resource: 'cpca_cases', action: 'view', scope: 'NATIONAL' },
          { resource: 'smif_complaints', action: 'view', scope: 'NATIONAL' },
        ],
      }),
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        menuKey: 'cpca_cases',
        unreadCount: 2,
        hasUnread: true,
        clearedByMenuSeen: false,
        lastEventAt: lastEventAt.toISOString(),
      }),
      expect.objectContaining({
        menuKey: 'smif_complaints',
        unreadCount: 1,
        hasUnread: true,
        clearedByMenuSeen: false,
        lastEventAt: lastEventAt.toISOString(),
      }),
    ]);
  });
});
