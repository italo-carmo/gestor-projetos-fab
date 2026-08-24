import { HttpException } from '@nestjs/common';
import { OdgsaService } from './odgsa.service';

function createPrismaMock() {
  const prisma: any = {
    odgsa: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'odgsa-1',
        code: 'ODGSA-1',
        name: 'Primeiro ODGSA',
        role: { id: 'role-odgsa-1', name: 'ODGSA · ODGSA-1' },
      }),
    },
    odgsaOm: {
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    om: {
      findMany: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) =>
    callback(prisma),
  );
  return prisma;
}

function createUser() {
  return {
    id: 'user-1',
    name: 'Usuário ODGSA',
    email: 'odgsa@fab.mil.br',
    roles: [
      {
        id: 'role-odgsa-1',
        name: 'ODGSA · ODGSA-1',
        wildcard: false,
        permissions: [],
      },
    ],
    permissions: [],
    moduleAccessOverrides: [],
    executiveHidePii: false,
  } as any;
}

async function expectReason(promise: Promise<unknown>, reason: string) {
  try {
    await promise;
    throw new Error(`Expected request to fail with ${reason}`);
  } catch (error) {
    const response =
      typeof (error as HttpException).getResponse === 'function'
        ? ((error as HttpException).getResponse() as any)
        : null;
    expect(response?.details?.reason ?? response?.code).toBe(reason);
  }
}

describe('OdgsaService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria o papel sistêmico e suas permissões junto com o ODGSA', async () => {
    const prisma = createPrismaMock();
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new OdgsaService(prisma, audit as any);
    prisma.permission = {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1' },
          { id: 'p2' },
          { id: 'p3' },
          { id: 'p4' },
        ]),
    };
    prisma.role = {
      create: jest.fn().mockResolvedValue({ id: 'role-new' }),
      update: jest.fn().mockResolvedValue({ id: 'role-new' }),
    };
    prisma.rolePermission = {
      createMany: jest.fn().mockResolvedValue({ count: 4 }),
    };
    prisma.odgsa.create = jest.fn().mockResolvedValue({
      id: 'odgsa-new',
      code: 'III COMAR',
      name: 'Terceiro Comando Aéreo Regional',
      roleId: 'role-new',
    });
    prisma.odgsa.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'odgsa-new',
      code: 'III COMAR',
      name: 'Terceiro Comando Aéreo Regional',
      roleId: 'role-new',
      role: {
        id: 'role-new',
        name: 'ODGSA · III COMAR',
        description: 'Acompanhamento CPCA',
        _count: { users: 0 },
      },
      _count: { oms: 0 },
    });

    const result = await service.create(
      { code: 'iii comar', name: 'Terceiro Comando Aéreo Regional' },
      'ti-user',
    );

    expect(prisma.role.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'ODGSA · III COMAR',
        isSystemRole: true,
        wildcard: false,
      }),
    });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { roleId: 'role-new', permissionId: 'p1' },
        { roleId: 'role-new', permissionId: 'p4' },
      ]),
    });
    expect(result).toEqual(
      expect.objectContaining({
        code: 'III COMAR',
        role: expect.objectContaining({ name: 'ODGSA · III COMAR' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'odgsa_admin', action: 'create' }),
    );
  });

  it('inclui em massa somente OMs ainda sem vínculo', async () => {
    const prisma = createPrismaMock();
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new OdgsaService(prisma, audit as any);
    prisma.om.findMany.mockResolvedValue([
      { id: 'om-1', code: 'OM1' },
      { id: 'om-2', code: 'OM2' },
    ]);
    prisma.odgsaOm.findMany.mockResolvedValue([
      { omId: 'om-1', odgsaId: 'odgsa-1' },
    ]);
    prisma.odgsaOm.createMany.mockResolvedValue({ count: 1 });

    const result = await service.updateMineOms(createUser(), {
      action: 'ASSIGN',
      omIds: ['om-1', 'om-2', 'om-2'],
    });

    expect(prisma.odgsaOm.createMany).toHaveBeenCalledWith({
      data: [
        {
          odgsaId: 'odgsa-1',
          omId: 'om-2',
          assignedById: 'user-1',
        },
      ],
    });
    expect(result).toEqual(
      expect.objectContaining({ requestedCount: 2, updatedCount: 1 }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assign_batch' }),
    );
  });

  it('rejeita o lote inteiro quando uma OM pertence a outro ODGSA', async () => {
    const prisma = createPrismaMock();
    const service = new OdgsaService(prisma, { log: jest.fn() } as any);
    prisma.om.findMany.mockResolvedValue([
      { id: 'om-1', code: 'OM1' },
      { id: 'om-2', code: 'OM2' },
    ]);
    prisma.odgsaOm.findMany.mockResolvedValue([
      { omId: 'om-2', odgsaId: 'outro-odgsa' },
    ]);

    await expectReason(
      service.updateMineOms(createUser(), {
        action: 'ASSIGN',
        omIds: ['om-1', 'om-2'],
      }),
      'OM_ALREADY_ASSIGNED_TO_ANOTHER_ODGSA',
    );
    expect(prisma.odgsaOm.createMany).not.toHaveBeenCalled();
  });

  it('remove somente vínculos do próprio ODGSA', async () => {
    const prisma = createPrismaMock();
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new OdgsaService(prisma, audit as any);
    prisma.om.findMany.mockResolvedValue([
      { id: 'om-1', code: 'OM1' },
      { id: 'om-2', code: 'OM2' },
    ]);
    prisma.odgsaOm.deleteMany.mockResolvedValue({ count: 1 });

    await service.updateMineOms(createUser(), {
      action: 'UNASSIGN',
      omIds: ['om-1', 'om-2'],
    });

    expect(prisma.odgsaOm.deleteMany).toHaveBeenCalledWith({
      where: {
        odgsaId: 'odgsa-1',
        omId: { in: ['om-1', 'om-2'] },
      },
    });
  });
});
