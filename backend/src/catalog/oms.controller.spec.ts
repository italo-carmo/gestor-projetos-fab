import { HttpException } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { OmsController } from './oms.controller';
import { PERMISSION_METADATA_KEY } from '../rbac/require-permission.decorator';

describe('OmsController permissions', () => {
  const prisma = {
    om: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;

  const controller = new OmsController(prisma);

  it('declares cpca_coverage permissions on the coverage endpoints', () => {
    const listMetadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      OmsController.prototype.list,
    );
    const createMetadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      OmsController.prototype.create,
    );
    const batchMetadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      OmsController.prototype.updateHasCpcaBatch,
    );
    const updateMetadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      OmsController.prototype.update,
    );
    const deleteMetadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      OmsController.prototype.remove,
    );

    expect(listMetadata).toEqual({
      resource: 'cpca_coverage',
      action: 'view',
      scope: PermissionScope.NATIONAL,
    });
    expect(createMetadata).toEqual({
      resource: 'cpca_coverage',
      action: 'create',
      scope: PermissionScope.NATIONAL,
    });
    expect(batchMetadata).toEqual({
      resource: 'cpca_coverage',
      action: 'update',
      scope: PermissionScope.NATIONAL,
    });
    expect(updateMetadata).toEqual({
      resource: 'cpca_coverage',
      action: 'update',
      scope: PermissionScope.NATIONAL,
    });
    expect(deleteMetadata).toEqual({
      resource: 'cpca_coverage',
      action: 'delete',
      scope: PermissionScope.NATIONAL,
    });
  });

  it('keeps /oms/catalog under localities:view for shared catalogs', () => {
    const catalogMetadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      OmsController.prototype.listCatalog,
    );

    expect(catalogMetadata).toEqual({
      resource: 'localities',
      action: 'view',
    });
  });

  it('blocks deletion for non-TI roles even with endpoint access', async () => {
    await expect(
      controller.remove('om-1', {
        id: 'user-1',
        roles: [
          { id: 'role-1', name: 'COMGEP', wildcard: false, permissions: [] },
        ],
      } as any),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('returns the current CPCA president on the OM coverage listing', async () => {
    prisma.om.findMany.mockResolvedValue([
      {
        id: 'om-1',
        code: 'BASV',
        name: 'Base Aerea de Salvador',
        uf: 'BA',
        hasCpca: true,
        notes: null,
        cpcaCommissionPresident: {
          id: 'pres-1',
          assignedAt: new Date('2026-04-22T12:00:00.000Z'),
          user: {
            id: 'user-1',
            name: 'CAP JOAO SILVA BASV',
            email: 'joao.silva@fab.mil.br',
          },
        },
        cpcaCommissionMembers: [
          {
            id: 'member-rel-president',
            createdAt: new Date('2026-04-22T12:00:00.000Z'),
            userId: 'user-1',
            user: {
              id: 'user-1',
              name: 'CAP JOAO SILVA BASV',
              email: 'joao.silva@fab.mil.br',
              ldapUid: 'joao.silva',
            },
            addedByUser: null,
          },
          {
            id: 'member-rel-1',
            createdAt: new Date('2026-04-23T12:00:00.000Z'),
            userId: 'member-1',
            user: {
              id: 'member-1',
              name: 'TEN MARIA SOUZA',
              email: 'maria.souza@fab.mil.br',
              ldapUid: 'maria.souza',
            },
            addedByUser: {
              id: 'user-1',
              name: 'CAP JOAO SILVA BASV',
              email: 'joao.silva@fab.mil.br',
            },
          },
          {
            id: 'member-rel-2',
            createdAt: new Date('2026-04-24T12:00:00.000Z'),
            userId: 'member-2',
            user: {
              id: 'member-2',
              name: 'SGT ANA COSTA',
              email: 'ana.costa@fab.mil.br',
              ldapUid: 'ana.costa',
            },
            addedByUser: null,
          },
        ],
        cpcaCoverageAsManager: [],
        cpcaCoverageAsManaged: [],
      },
    ]);

    const result = await controller.list({
      id: 'user-1',
      omId: null,
      permissions: [
        {
          resource: 'cpca_coverage',
          action: 'view',
          scope: PermissionScope.NATIONAL,
        },
      ],
      roles: [],
    } as any);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'om-1',
      currentPresident: {
        id: 'pres-1',
        user: {
          id: 'user-1',
          name: 'CAP JOAO SILVA BASV',
          email: 'joao.silva@fab.mil.br',
        },
      },
      cpcaMembersCount: 2,
      cpcaMembers: [
        {
          id: 'member-rel-1',
          user: {
            id: 'member-1',
            name: 'TEN MARIA SOUZA',
            email: 'maria.souza@fab.mil.br',
          },
        },
        {
          id: 'member-rel-2',
          user: {
            id: 'member-2',
            name: 'SGT ANA COSTA',
            email: 'ana.costa@fab.mil.br',
          },
        },
      ],
    });
    expect(result.items[0].cpcaCommissionMembers).toBeUndefined();
  });
});
