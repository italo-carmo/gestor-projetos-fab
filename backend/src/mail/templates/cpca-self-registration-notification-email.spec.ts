import { buildCpcaSelfRegistrationNotificationEmail } from './cpca-self-registration-notification-email';

describe('buildCpcaSelfRegistrationNotificationEmail', () => {
  it('monta o email com a marca do sistema e sem duplicar a OM', () => {
    const message = buildCpcaSelfRegistrationNotificationEmail({
      applicantName: '1T Denise',
      applicantEmail: 'denise@fab.mil.br',
      applicantUid: '12345678900',
      locality: {
        code: 'CCA BR',
        name: 'CCA BR',
      },
      bulletinNumber: 'BOL 001',
      requestedAsSubstitution: true,
      attemptNumber: 1,
      createdAt: new Date('2026-04-27T14:44:21.504Z'),
    });

    expect(message.subject).toBe(
      'Gestor CIPAVD | Novo cadastro de presidente CPCA | CCA BR',
    );
    expect(message.subject).not.toContain('CCA BR · CCA BR');
    expect(message.html).toContain('Gestor CIPAVD');
    expect(message.html).toContain('Um usuário se cadastrou como presidente CPCA');
    expect(message.html).not.toContain('CCA BR · CCA BR');
    expect(message.text).toContain('OM: CCA BR');
    expect(message.text).toContain('Substituição: Sim');
    expect(message.text).not.toContain('CCA BR · CCA BR');
  });
});
