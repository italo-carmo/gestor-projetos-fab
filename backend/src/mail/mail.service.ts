import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailDeliveryFailureStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';

export type MailSendOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
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

type MailDeliveryTask = Omit<MailSendOptions, 'to' | 'cc' | 'bcc'> & {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  queuedAt: Date;
};

export type MailQueuedResult = {
  queued: true;
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
  queuedAt: Date;
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

function resolveDefaultFromName(value: string | undefined): string {
  const configured = String(value ?? '').trim();
  if (
    !configured ||
    configured.localeCompare('CPCA COMGEP', 'pt-BR', {
      sensitivity: 'base',
    }) === 0
  ) {
    return 'Gestor CIPAVD';
  }
  return configured;
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
  private readonly deliveryQueue: MailDeliveryTask[] = [];
  private processingQueue = false;
  private queueScheduled = false;
  private readonly idleResolvers: Array<() => void> = [];

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  isConfigured() {
    try {
      this.resolveConfig();
      return true;
    } catch {
      return false;
    }
  }

  async sendMail(options: MailSendOptions): Promise<MailQueuedResult> {
    const to = normalizeAddressList(options.to);
    if (to.length === 0) {
      throw new Error('MailService requires at least one recipient.');
    }

    const task: MailDeliveryTask = {
      ...options,
      id: randomUUID(),
      to,
      cc: normalizeAddressList(options.cc),
      bcc: normalizeAddressList(options.bcc),
      queuedAt: new Date(),
    };

    this.deliveryQueue.push(task);
    this.scheduleQueueProcessing();

    return {
      queued: true,
      messageId: `queued-${task.id}`,
      accepted: to,
      rejected: [],
      pending: to,
      response: 'queued',
      queuedAt: task.queuedAt,
    };
  }

  async sendMailImmediate(options: MailSendOptions) {
    const to = normalizeAddressList(options.to);
    if (to.length === 0) {
      throw new Error('MailService requires at least one recipient.');
    }

    const task: MailDeliveryTask = {
      ...options,
      id: randomUUID(),
      to,
      cc: normalizeAddressList(options.cc),
      bcc: normalizeAddressList(options.bcc),
      queuedAt: new Date(),
    };

    return this.deliver(task);
  }

  async waitForIdle(): Promise<void> {
    if (
      !this.queueScheduled &&
      !this.processingQueue &&
      this.deliveryQueue.length === 0
    ) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  async listDeliveryFailures(input: {
    status?: string | null;
    page?: number | string | null;
    pageSize?: number | string | null;
  }) {
    const prisma = this.requirePrisma();
    const status = this.normalizeFailureStatus(input.status);
    const page = this.normalizePositiveInteger(input.page, 1, 1, 10_000);
    const pageSize = this.normalizePositiveInteger(
      input.pageSize,
      20,
      1,
      100,
    );
    const where =
      status === 'ALL'
        ? {}
        : {
            status,
          };

    const [items, total, openCount] = await Promise.all([
      prisma.emailDeliveryFailure.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          resolvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.emailDeliveryFailure.count({ where }),
      prisma.emailDeliveryFailure.count({
        where: { status: EmailDeliveryFailureStatus.OPEN },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        to: item.to,
        cc: item.cc,
        bcc: item.bcc,
        subject: item.subject,
        errorMessage: item.errorMessage,
        errorStack: item.errorStack,
        status: item.status,
        occurredAt: item.occurredAt.toISOString(),
        resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
        resolvedBy: item.resolvedBy
          ? {
              id: item.resolvedBy.id,
              name: item.resolvedBy.name,
              email: item.resolvedBy.email,
            }
          : null,
      })),
      total,
      page,
      pageSize,
      openCount,
    };
  }

  async resolveDeliveryFailure(idRaw: string, userId: string) {
    const prisma = this.requirePrisma();
    const id = String(idRaw ?? '').trim();
    if (!id) {
      throwError('VALIDATION_ERROR', {
        field: 'id',
        reason: 'REQUIRED',
      });
    }

    const existing = await prisma.emailDeliveryFailure.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throwError('NOT_FOUND');
    }

    const resolvedAt = new Date();
    const updated = await prisma.emailDeliveryFailure.update({
      where: { id },
      data: {
        status: EmailDeliveryFailureStatus.RESOLVED,
        resolvedAt,
        resolvedById: userId,
      },
      include: {
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        resolvedBy: updated.resolvedBy
          ? {
              id: updated.resolvedBy.id,
              name: updated.resolvedBy.name,
              email: updated.resolvedBy.email,
            }
          : null,
      },
    };
  }

  private scheduleQueueProcessing() {
    if (this.queueScheduled || this.processingQueue) {
      return;
    }

    this.queueScheduled = true;
    setTimeout(() => {
      this.queueScheduled = false;
      void this.processQueue();
    }, 0);
  }

  private async processQueue() {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;
    try {
      while (this.deliveryQueue.length > 0) {
        const task = this.deliveryQueue.shift();
        if (!task) continue;
        await this.deliver(task);
      }
    } finally {
      this.processingQueue = false;
      if (this.deliveryQueue.length > 0) {
        this.scheduleQueueProcessing();
      } else {
        this.resolveIdleWaiters();
      }
    }
  }

  private async deliver(task: MailDeliveryTask) {
    try {
      const runtime = this.resolveConfig();
      const result = await this.getTransporter(runtime).sendMail({
        from: {
          name: task.fromName ?? runtime.fromName,
          address: task.fromEmail ?? runtime.fromEmail,
        },
        to: task.to,
        cc: task.cc,
        bcc: task.bcc,
        replyTo: task.replyTo,
        subject: task.subject,
        html: task.html,
        text: task.text,
        attachments: task.attachments,
      });

      this.logger.log(
        `Email enviado para ${task.to.join(', ')} com assunto "${task.subject}".`,
      );
      return { ok: true as const, result };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'falha desconhecida';
      this.logger.warn(
        `Falha ao enviar e-mail para ${task.to.join(', ')} com assunto "${task.subject}": ${detail}.`,
      );
      await this.recordDeliveryFailure(task, error);
      return {
        ok: false as const,
        error,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async recordDeliveryFailure(task: MailDeliveryTask, error: unknown) {
    if (!this.prisma) {
      return;
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error ?? 'Falha desconhecida no envio do e-mail.');
    const errorStack = error instanceof Error ? error.stack : null;

    try {
      await this.prisma.emailDeliveryFailure.create({
        data: {
          to: task.to,
          cc: task.cc,
          bcc: task.bcc,
          subject: task.subject,
          errorMessage: errorMessage.slice(0, 4000),
          errorStack: errorStack ? errorStack.slice(0, 12_000) : null,
          occurredAt: new Date(),
        },
      });
    } catch (recordError) {
      const detail =
        recordError instanceof Error
          ? recordError.message
          : 'falha desconhecida';
      this.logger.warn(
        `Falha ao registrar erro de envio de e-mail: ${detail}.`,
      );
    }
  }

  private resolveIdleWaiters() {
    const resolvers = this.idleResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  private requirePrisma() {
    if (!this.prisma) {
      throwError('VALIDATION_ERROR', {
        reason: 'PRISMA_NOT_AVAILABLE',
      });
    }
    return this.prisma;
  }

  private normalizeFailureStatus(value: string | null | undefined) {
    const normalized = String(value ?? 'OPEN')
      .trim()
      .toUpperCase();
    if (!normalized || normalized === 'OPEN') {
      return EmailDeliveryFailureStatus.OPEN;
    }
    if (normalized === 'RESOLVED') {
      return EmailDeliveryFailureStatus.RESOLVED;
    }
    if (normalized === 'ALL') {
      return 'ALL' as const;
    }
    throwError('VALIDATION_ERROR', {
      field: 'status',
      reason: 'INVALID_STATUS',
    });
  }

  private normalizePositiveInteger(
    value: number | string | null | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(parsed)));
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
    const fromName = resolveDefaultFromName(
      firstConfig(this.config, 'SMTP_FROM_NAME'),
    );
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
