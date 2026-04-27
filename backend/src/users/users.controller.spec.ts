import { UsersController } from './users.controller';

describe('UsersController deleteUserAccess', () => {
  const users = {
    deleteUserAccessAndPresidentHistory: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeUser(id: string, roles: string[]) {
    return {
      id,
      roles: roles.map((name) => ({ id: name, name, permissions: [] })),
      permissions: [],
    } as any;
  }

  it('blocks non-TI users', async () => {
    const controller = new UsersController(users as any);

    await expect(
      controller.deleteUserAccess('target-user', makeUser('actor', ['COMGEP'])),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RBAC_FORBIDDEN' }),
    });
    expect(users.deleteUserAccessAndPresidentHistory).not.toHaveBeenCalled();
  });

  it('blocks self deletion', async () => {
    const controller = new UsersController(users as any);

    await expect(
      controller.deleteUserAccess('ti-user', makeUser('ti-user', ['TI'])),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        details: expect.objectContaining({ reason: 'USER_CANNOT_DELETE_SELF' }),
      }),
    });
    expect(users.deleteUserAccessAndPresidentHistory).not.toHaveBeenCalled();
  });

  it('allows TI users to delete another user access', async () => {
    const controller = new UsersController(users as any);
    users.deleteUserAccessAndPresidentHistory.mockResolvedValue({
      ok: true,
    });

    await expect(
      controller.deleteUserAccess('target-user', makeUser('ti-user', ['TI'])),
    ).resolves.toEqual({ ok: true });
    expect(users.deleteUserAccessAndPresidentHistory).toHaveBeenCalledWith(
      'target-user',
    );
  });
});
