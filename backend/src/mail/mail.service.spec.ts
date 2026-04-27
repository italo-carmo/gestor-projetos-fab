import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailService', () => {
  const configMock = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const transporterMock = {
    sendMail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue(transporterMock);
    transporterMock.sendMail.mockResolvedValue({
      messageId: '<test-message-id>',
      accepted: ['destinatario@fab.mil.br'],
    });

    for (const key of [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_SECURE',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM_NAME',
      'SMTP_FROM_EMAIL',
      'SMTP_REJECT_UNAUTHORIZED',
    ]) {
      delete process.env[key];
    }
  });

  it('envia email usando a configuracao SMTP e normaliza o remetente legado', async () => {
    configMock.get = jest.fn((key: string) => {
      switch (key) {
        case 'SMTP_HOST':
          return 'smtp.mail.intraer';
        case 'SMTP_PORT':
          return '587';
        case 'SMTP_USER':
          return 'italoibsc@fab.mil.br';
        case 'SMTP_PASS':
          return 'senha-teste';
        case 'SMTP_FROM_NAME':
          return 'CPCA COMGEP';
        default:
          return undefined;
      }
    }) as any;

    const service = new MailService(configMock);
    const result = await service.sendMail({
      to: 'destinatario@fab.mil.br',
      subject: 'Teste SMTP',
      html: '<p>Teste</p>',
      text: 'Teste',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.mail.intraer',
        port: 587,
        secure: false,
        auth: {
          user: 'italoibsc@fab.mil.br',
          pass: 'senha-teste',
        },
        tls: {
          rejectUnauthorized: true,
        },
      }),
    );
    expect(transporterMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: {
          name: 'Gestor CIPAVD',
          address: 'italoibsc@fab.mil.br',
        },
        to: ['destinatario@fab.mil.br'],
        subject: 'Teste SMTP',
        html: '<p>Teste</p>',
        text: 'Teste',
      }),
    );
    expect(result).toMatchObject({
      messageId: '<test-message-id>',
    });
  });

  it('falha explicitamente quando a configuracao SMTP esta incompleta', async () => {
    configMock.get = jest.fn((key: string) => {
      switch (key) {
        case 'SMTP_HOST':
          return 'smtp.mail.intraer';
        case 'SMTP_PORT':
          return '587';
        default:
          return undefined;
      }
    }) as any;

    const service = new MailService(configMock);

    await expect(
      service.sendMail({
        to: 'destinatario@fab.mil.br',
        subject: 'Teste SMTP',
        html: '<p>Teste</p>',
      }),
    ).rejects.toThrow(/SMTP is not configured/i);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
