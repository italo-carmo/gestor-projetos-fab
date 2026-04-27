import { deleteCpcaPresidentBulletinFile } from '../cpca/cpca-president-bulletin-file';
import { UsersService } from './users.service';

jest.mock('../cpca/cpca-president-bulletin-file', () => ({
  deleteCpcaPresidentBulletinFile: jest.fn(),
}));

function createPrismaMock() {
  const prisma: any = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
    },
    userModuleAccessOverride: {
      deleteMany: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    cpcaPresidentSelfRegistration: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    cpcaPresidentNominationRequest: {
      deleteMany: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

describe('UsersService deleteUserAccessAndPresidentHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes permissions, sessions and CPCA president request history', async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any, {} as any);

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.cpcaPresidentSelfRegistration.findMany.mockResolvedValue([
      { bulletinStorageKey: 'bulletin-1.pdf' },
      { bulletinStorageKey: 'bulletin-1.pdf' },
      { bulletinStorageKey: 'bulletin-2.pdf' },
      { bulletinStorageKey: null },
    ]);
    prisma.userRole.deleteMany.mockResolvedValue({ count: 2 });
    prisma.userModuleAccessOverride.deleteMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
    prisma.cpcaPresidentSelfRegistration.deleteMany.mockResolvedValue({
      count: 4,
    });
    prisma.cpcaPresidentNominationRequest.deleteMany.mockResolvedValue({
      count: 2,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });

    const result = await service.deleteUserAccessAndPresidentHistory('user-1');

    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.userModuleAccessOverride.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.cpcaPresidentSelfRegistration.deleteMany).toHaveBeenCalledWith(
      {
        where: { applicantUserId: 'user-1' },
      },
    );
    expect(prisma.cpcaPresidentNominationRequest.deleteMany).toHaveBeenCalledWith(
      {
        where: {
          OR: [
            { requestedByUserId: 'user-1' },
            { nomineeUserId: 'user-1' },
          ],
        },
      },
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        isActive: false,
        omId: null,
        localityId: null,
        specialtyId: null,
        eloRoleId: null,
        totpSecret: null,
        totpEnabled: false,
        totpBackupCodes: [],
      }),
    });
    expect(deleteCpcaPresidentBulletinFile).toHaveBeenCalledTimes(2);
    expect(deleteCpcaPresidentBulletinFile).toHaveBeenCalledWith(
      'bulletin-1.pdf',
    );
    expect(deleteCpcaPresidentBulletinFile).toHaveBeenCalledWith(
      'bulletin-2.pdf',
    );
    expect(result).toMatchObject({
      ok: true,
      userId: 'user-1',
      removedRoles: 2,
      removedModuleOverrides: 1,
      removedRefreshTokens: 3,
      removedPresidentSelfRegistrations: 4,
      removedPresidentNominationRequests: 2,
      removedPresidentBulletinFiles: 2,
    });
  });

  it('fails when the target user does not exist', async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any, {} as any);

    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.deleteUserAccessAndPresidentHistory('missing-user'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });
});
