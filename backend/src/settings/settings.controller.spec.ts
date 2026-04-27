import { SettingsController } from './settings.controller';

describe('SettingsController email settings', () => {
  const settings = {
    getEmailSettings: jest.fn(),
    updateEmailSettings: jest.fn(),
  };
  const litellm = {
    testConnection: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeUser(roles: string[]) {
    return {
      id: 'user-1',
      roles: roles.map((name) => ({ id: name, name, permissions: [] })),
      permissions: [],
    } as any;
  }

  it('blocks email settings for non-TI users', async () => {
    const controller = new SettingsController(settings as any, litellm as any);

    await expect(
      controller.updateEmailSettings(makeUser(['COMGEP']), {
        cpcaPresidentSelfRegistrationRecipientEmail: 'ti@fab.mil.br',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RBAC_FORBIDDEN' }),
    });
    expect(settings.updateEmailSettings).not.toHaveBeenCalled();
  });

  it('allows TI users to update email settings', async () => {
    const controller = new SettingsController(settings as any, litellm as any);
    settings.updateEmailSettings.mockResolvedValue(undefined);

    await expect(
      controller.updateEmailSettings(makeUser(['TI']), {
        cpcaPresidentSelfRegistrationRecipientEmail: 'ti@fab.mil.br',
      }),
    ).resolves.toEqual({ ok: true });

    expect(settings.updateEmailSettings).toHaveBeenCalledWith({
      cpcaPresidentSelfRegistrationRecipientEmail: 'ti@fab.mil.br',
    });
  });
});
