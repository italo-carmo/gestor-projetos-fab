import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

function createPrismaMock() {
  return {
    locality: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
  };
}

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persiste o localityId quando ele referencia uma localidade existente', async () => {
    const prisma = createPrismaMock();
    prisma.locality.findUnique.mockResolvedValue({ id: 'loc-1' });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    const service = new AuditService(prisma as any);

    await service.log({
      userId: 'user-1',
      localityId: 'loc-1',
      resource: 'cpca_cases',
      action: 'created',
      entityId: 'entity-1',
      diffJson: { ok: true },
    });

    expect(prisma.locality.findUnique).toHaveBeenCalledWith({
      where: { id: 'loc-1' },
      select: { id: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        localityId: 'loc-1',
        diffJson: { ok: true },
      }),
    });
  });

  it('zera o localityId quando recebe um id que nao pertence a Locality', async () => {
    const prisma = createPrismaMock();
    prisma.locality.findUnique.mockResolvedValue(null);
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });
    const service = new AuditService(prisma as any);

    await service.log({
      userId: 'user-1',
      localityId: 'om_a9f202650996ddc828e604b0',
      resource: 'cpca_cases',
      action: 'cpca_commission_coverage_update',
      entityId: 'om_a9f202650996ddc828e604b0',
      diffJson: { omId: 'om_a9f202650996ddc828e604b0' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        localityId: null,
      }),
    });
  });

  it('usa JsonNull quando nao recebe diffJson', async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-3' });
    const service = new AuditService(prisma as any);

    await service.log({
      userId: 'user-1',
      resource: 'auth',
      action: 'login',
    });

    expect(prisma.locality.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        localityId: null,
        diffJson: Prisma.JsonNull,
      }),
    });
  });
});
