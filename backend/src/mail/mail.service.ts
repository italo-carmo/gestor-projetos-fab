import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type MailSendOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  fromName?: string;
  fromEmail?: string;
};

type MailRuntimeConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  rejectUnauthorized: boolean;
};

function stripEnvQuotes(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function firstConfig(config: ConfigService, key: string): string | undefined {
  return (
    stripEnvQuotes(process.env[key]) ?? stripEnvQuotes(config.get<string>(key))
  );
}

function normalizeAddressList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      items
        .flatMap((item) => String(item ?? '').split(','))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter<nodemailer.SentMessageInfo> | null =
    null;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    try {
      this.resolveConfig();
      return true;
    } catch {
      return false;
    }
  }

  async sendMail(options: MailSendOptions) {
    const runtime = this.resolveConfig();
    const to = normalizeAddressList(options.to);
    if (to.length === 0) {
      throw new Error('MailService requires at least one recipient.');
    }

    const info = await this.getTransporter(runtime).sendMail({
      from: {
        name: options.fromName ?? runtime.fromName,
        address: options.fromEmail ?? runtime.fromEmail,
      },
      to,
      cc: normalizeAddressList(options.cc),
      bcc: normalizeAddressList(options.bcc),
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    this.logger.log(
      `Email enviado para ${to.join(', ')} com assunto "${options.subject}".`,
    );

    return info;
  }

  private getTransporter(runtime: MailRuntimeConfig) {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: runtime.host,
        port: runtime.port,
        secure: runtime.secure,
        auth: {
          user: runtime.user,
          pass: runtime.pass,
        },
        tls: {
          rejectUnauthorized: runtime.rejectUnauthorized,
        },
      });
    }
    return this.transporter;
  }

  private resolveConfig(): MailRuntimeConfig {
    const host = firstConfig(this.config, 'SMTP_HOST');
    const portRaw = firstConfig(this.config, 'SMTP_PORT');
    const user = firstConfig(this.config, 'SMTP_USER');
    const pass = firstConfig(this.config, 'SMTP_PASS');
    const fromName =
      firstConfig(this.config, 'SMTP_FROM_NAME') ?? 'CPCA COMGEP';
    const fromEmail =
      firstConfig(this.config, 'SMTP_FROM_EMAIL') ?? user ?? undefined;

    if (!host || !portRaw || !user || !pass || !fromEmail) {
      const missing = [
        !host ? 'SMTP_HOST' : null,
        !portRaw ? 'SMTP_PORT' : null,
        !user ? 'SMTP_USER' : null,
        !pass ? 'SMTP_PASS' : null,
        !fromEmail ? 'SMTP_FROM_EMAIL' : null,
      ].filter(Boolean);

      throw new Error(
        `SMTP is not configured. Missing: ${missing.join(', ')}.`,
      );
    }

    const port = Number(portRaw);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`SMTP_PORT is invalid: "${portRaw}".`);
    }

    const secure = parseBoolean(
      firstConfig(this.config, 'SMTP_SECURE'),
      port === 465,
    );
    const rejectUnauthorized = parseBoolean(
      firstConfig(this.config, 'SMTP_REJECT_UNAUTHORIZED'),
      true,
    );

    return {
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail,
      rejectUnauthorized,
    };
  }
}
