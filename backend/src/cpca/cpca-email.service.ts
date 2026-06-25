import * as fs from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import {
  CpcaEmailDeliveryStatus,
  CpcaEmailDispatchStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COMGEP,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import {
  deleteCpcaEmailAttachmentFile,
  persistCpcaEmailAttachmentFile,
  resolveExistingCpcaEmailAttachmentPath,
  validateCpcaEmailAttachmentUpload,
} from './cpca-email-attachments';
import type {
  CreateCpcaEmailTemplateDto,
  SendCpcaEmailDto,
  UpdateCpcaEmailTemplateDto,
} from './dto/cpca-email.dto';

type UserSummary = {
  id: string;
  name: string | null;
  email: string | null;
};

type AttachmentRecord = {
  id: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
};

type TemplateRecord = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: UserSummary | null;
  updatedBy?: UserSummary | null;
  attachments?: AttachmentRecord[];
};

type DeliveryRecord = {
  id: string;
  omId: string | null;
  presidentUserId: string | null;
  omCode: string;
  omName: string;
  recipientName: string;
  recipientEmail: string;
  status: CpcaEmailDeliveryStatus;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DispatchRecord = {
  id: string;
  templateId: string | null;
  subject: string;
  bodyHtml: string;
  status: CpcaEmailDispatchStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
  template?: { id: string; name: string } | null;
  createdBy?: UserSummary | null;
  deliveries?: DeliveryRecord[];
};

type CpcaEmailRecipient = {
  omId: string;
  omCode: string;
  omName: string;
  omUf: string | null;
  presidentUserId: string;
  presidentName: string;
  presidentEmail: string;
};

@Injectable()
export class CpcaEmailService {
  private readonly logger = new Logger(CpcaEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async listTemplates(user: RbacUser) {
    this.assertAllowedProfile(user);
    const items = await this.prisma.cpcaEmailTemplate.findMany({
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      include: this.templateInclude(),
    });
    return { items: items.map((item) => this.serializeTemplate(item)) };
  }

  async createTemplate(dto: CreateCpcaEmailTemplateDto, user: RbacUser) {
    this.assertAllowedProfile(user);
    const data = {
      name: this.normalizeRequiredText(dto.name, 'name', 160),
      subject: this.normalizeRequiredText(dto.subject, 'subject', 220),
      bodyHtml: this.normalizeBodyHtml(dto.bodyHtml),
    };
    const item = await this.prisma.cpcaEmailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        createdById: user.id,
        updatedById: user.id,
      },
      include: this.templateInclude(),
    });
    await this.audit.log({
      userId: user.id,
      resource: 'cpca_emails',
      action: 'create',
      entityId: item.id,
      diffJson: { name: item.name, subject: item.subject },
    });
    return { item: this.serializeTemplate(item) };
  }

  async updateTemplate(
    idRaw: string,
    dto: UpdateCpcaEmailTemplateDto,
    user: RbacUser,
  ) {
    this.assertAllowedProfile(user);
    const id = this.normalizeId(idRaw, 'id');
    await this.ensureTemplateExists(id);
    const data = this.normalizeTemplatePayload(dto, {
      requireAll: false,
    });
    const item = await this.prisma.cpcaEmailTemplate.update({
      where: { id },
      data: {
        ...data,
        updatedById: user.id,
      },
      include: this.templateInclude(),
    });
    await this.audit.log({
      userId: user.id,
      resource: 'cpca_emails',
      action: 'update',
      entityId: item.id,
      diffJson: { name: item.name, subject: item.subject },
    });
    return { item: this.serializeTemplate(item) };
  }

  async deleteTemplate(idRaw: string, user: RbacUser) {
    this.assertAllowedProfile(user);
    const id = this.normalizeId(idRaw, 'id');
    const item = await this.prisma.cpcaEmailTemplate.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!item) throwError('NOT_FOUND');

    await this.prisma.cpcaEmailTemplate.delete({ where: { id } });
    for (const attachment of item.attachments) {
      deleteCpcaEmailAttachmentFile(attachment.storageKey);
    }
    await this.audit.log({
      userId: user.id,
      resource: 'cpca_emails',
      action: 'delete',
      entityId: id,
      diffJson: { name: item.name },
    });
    return { ok: true };
  }

  async uploadAttachment(
    templateIdRaw: string,
    file: Express.Multer.File | undefined,
    user: RbacUser,
  ) {
    this.assertAllowedProfile(user);
    const templateId = this.normalizeId(templateIdRaw, 'templateId');
    await this.ensureTemplateExists(templateId);
    const validated = validateCpcaEmailAttachmentUpload(file);
    const stored = persistCpcaEmailAttachmentFile(validated);
    try {
      const item = await this.prisma.cpcaEmailTemplateAttachment.create({
        data: {
          templateId,
          fileName: stored.fileName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
        },
      });
      await this.prisma.cpcaEmailTemplate.update({
        where: { id: templateId },
        data: { updatedById: user.id },
      });
      return { item: this.serializeAttachment(item) };
    } catch (error) {
      deleteCpcaEmailAttachmentFile(stored.storageKey);
      throw error;
    }
  }

  async deleteAttachment(
    templateIdRaw: string,
    attachmentIdRaw: string,
    user: RbacUser,
  ) {
    this.assertAllowedProfile(user);
    const templateId = this.normalizeId(templateIdRaw, 'templateId');
    const attachmentId = this.normalizeId(attachmentIdRaw, 'attachmentId');
    const attachment = await this.prisma.cpcaEmailTemplateAttachment.findFirst({
      where: { id: attachmentId, templateId },
    });
    if (!attachment) throwError('NOT_FOUND');

    await this.prisma.cpcaEmailTemplateAttachment.delete({
      where: { id: attachment.id },
    });
    deleteCpcaEmailAttachmentFile(attachment.storageKey);
    await this.prisma.cpcaEmailTemplate.update({
      where: { id: templateId },
      data: { updatedById: user.id },
    });
    return { ok: true };
  }

  async listRecipients(user: RbacUser) {
    this.assertAllowedProfile(user);
    const recipients = await this.resolveRecipients({ all: true });
    return {
      items: recipients,
      total: recipients.length,
      note: 'Somente OMs com presidente CPCA cadastrado aparecem nesta lista.',
    };
  }

  async sendTemplate(dto: SendCpcaEmailDto, user: RbacUser) {
    this.assertAllowedProfile(user);
    const templateId = this.normalizeId(dto.templateId, 'templateId');
    const template = await this.prisma.cpcaEmailTemplate.findUnique({
      where: { id: templateId },
      include: { attachments: true },
    });
    if (!template) throwError('NOT_FOUND');

    const recipients = await this.resolveRecipients({
      all: Boolean(dto.all),
      recipientOmIds: dto.recipientOmIds,
    });
    if (recipients.length === 0) {
      throwError('VALIDATION_ERROR', {
        field: 'recipientOmIds',
        reason: 'CPCA_EMAIL_RECIPIENTS_REQUIRED',
      });
    }

    const attachments = this.buildMailAttachments(template.attachments ?? []);
    const dispatch = await this.prisma.cpcaEmailDispatch.create({
      data: {
        templateId: template.id,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        status: CpcaEmailDispatchStatus.QUEUED,
        totalRecipients: recipients.length,
        createdById: user.id,
        deliveries: {
          create: recipients.map((recipient) => ({
            templateId: template.id,
            omId: recipient.omId,
            presidentUserId: recipient.presidentUserId,
            omCode: recipient.omCode,
            omName: recipient.omName,
            recipientName: recipient.presidentName,
            recipientEmail: recipient.presidentEmail,
          })),
        },
      },
      include: { deliveries: true },
    });

    let sentCount = 0;
    let failedCount = 0;
    const recipientsByOmId = new Map(
      recipients.map((recipient) => [recipient.omId, recipient]),
    );

    for (const delivery of dispatch.deliveries) {
      const recipient = recipientsByOmId.get(String(delivery.omId ?? ''));
      if (!recipient) continue;
      const subject = personalizeText(template.subject, recipient);
      const html = personalizeHtml(template.bodyHtml, recipient);
      const result = await this.mail.sendMailImmediate({
        to: recipient.presidentEmail,
        subject,
        html,
        text: htmlToText(html),
        attachments,
      });

      if (result.ok) {
        sentCount += 1;
        await this.prisma.cpcaEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: CpcaEmailDeliveryStatus.SENT,
            errorMessage: null,
            sentAt: new Date(),
          },
        });
      } else {
        failedCount += 1;
        await this.prisma.cpcaEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: CpcaEmailDeliveryStatus.FAILED,
            errorMessage: result.message.slice(0, 4000),
          },
        });
      }
    }

    const status =
      failedCount === 0
        ? CpcaEmailDispatchStatus.SENT
        : sentCount === 0
          ? CpcaEmailDispatchStatus.FAILED
          : CpcaEmailDispatchStatus.PARTIAL;

    await this.prisma.cpcaEmailDispatch.update({
      where: { id: dispatch.id },
      data: {
        status,
        sentCount,
        failedCount,
      },
    });

    await this.audit.log({
      userId: user.id,
      resource: 'cpca_emails',
      action: 'send',
      entityId: dispatch.id,
      diffJson: {
        templateId: template.id,
        templateName: template.name,
        totalRecipients: recipients.length,
        sentCount,
        failedCount,
      },
    });

    this.logger.log(
      `Disparo CPCA ${dispatch.id}: ${sentCount} enviados, ${failedCount} falhas.`,
    );
    return this.getDispatch(dispatch.id, user);
  }

  async listDispatches(
    user: RbacUser,
    filters: { limit?: number | string | null },
  ) {
    this.assertAllowedProfile(user);
    const limit = normalizeInteger(filters.limit, 12, 1, 50);
    const items = await this.prisma.cpcaEmailDispatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: this.dispatchInclude(),
    });
    return { items: items.map((item) => this.serializeDispatch(item)) };
  }

  async getDispatch(idRaw: string, user: RbacUser) {
    this.assertAllowedProfile(user);
    const id = this.normalizeId(idRaw, 'id');
    const item = await this.prisma.cpcaEmailDispatch.findUnique({
      where: { id },
      include: this.dispatchInclude(),
    });
    if (!item) throwError('NOT_FOUND');
    return { item: this.serializeDispatch(item) };
  }

  private assertAllowedProfile(user: RbacUser | undefined) {
    if (
      !hasAnyRole(user, [ROLE_TI, ROLE_COMGEP, ROLE_COMANDANTE_COMGEP])
    ) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private templateInclude() {
    return {
      attachments: { orderBy: { createdAt: 'asc' as const } },
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    };
  }

  private dispatchInclude() {
    return {
      template: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      deliveries: { orderBy: [{ omName: 'asc' as const }] },
    };
  }

  private async ensureTemplateExists(id: string) {
    const existing = await this.prisma.cpcaEmailTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');
  }

  private normalizeTemplatePayload(
    dto: CreateCpcaEmailTemplateDto | UpdateCpcaEmailTemplateDto,
    options: { requireAll: boolean },
  ) {
    const data: { name?: string; subject?: string; bodyHtml?: string } = {};
    if (options.requireAll || dto.name !== undefined) {
      data.name = this.normalizeRequiredText(dto.name, 'name', 160);
    }
    if (options.requireAll || dto.subject !== undefined) {
      data.subject = this.normalizeRequiredText(dto.subject, 'subject', 220);
    }
    if (options.requireAll || dto.bodyHtml !== undefined) {
      data.bodyHtml = this.normalizeBodyHtml(dto.bodyHtml);
    }
    return data;
  }

  private normalizeRequiredText(
    value: string | null | undefined,
    field: string,
    max: number,
  ) {
    const normalized = sanitizeText(value).slice(0, max);
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
    }
    return normalized;
  }

  private normalizeBodyHtml(value: string | null | undefined) {
    const normalized = sanitizeEmailHtml(value);
    if (!htmlToText(normalized) && !/<img\b/i.test(normalized)) {
      throwError('VALIDATION_ERROR', { field: 'bodyHtml', reason: 'REQUIRED' });
    }
    if (normalized.length > 1_000_000) {
      throwError('VALIDATION_ERROR', {
        field: 'bodyHtml',
        reason: 'TOO_LONG',
      });
    }
    return normalized;
  }

  private normalizeId(value: string | null | undefined, field: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
    }
    return normalized;
  }

  private async resolveRecipients(input: {
    all?: boolean;
    recipientOmIds?: string[] | null;
  }): Promise<CpcaEmailRecipient[]> {
    const selectedIds = Array.from(
      new Set(
        (input.recipientOmIds ?? [])
          .map((id) => String(id ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (!input.all && selectedIds.length === 0) {
      return [];
    }

    const items = await this.prisma.om.findMany({
      where: {
        ...(input.all ? {} : { id: { in: selectedIds } }),
        cpcaCommissionPresident: { isNot: null },
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      include: {
        cpcaCommissionPresident: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return items
      .map((item) => {
        const president = item.cpcaCommissionPresident;
        const email = String(president?.user?.email ?? '').trim();
        if (!president?.user?.id || !email) return null;
        return {
          omId: item.id,
          omCode: item.code,
          omName: item.name,
          omUf: item.uf ?? null,
          presidentUserId: president.user.id,
          presidentName: president.user.name || email,
          presidentEmail: email,
        };
      })
      .filter((item): item is CpcaEmailRecipient => item !== null);
  }

  private buildMailAttachments(attachments: AttachmentRecord[]) {
    return attachments.map((attachment) => {
      const filePath = resolveExistingCpcaEmailAttachmentPath(
        attachment.storageKey,
      );
      if (!filePath) {
        throwError('VALIDATION_ERROR', {
          field: 'attachments',
          reason: 'CPCA_EMAIL_ATTACHMENT_FILE_UNAVAILABLE',
          attachmentId: attachment.id,
        });
      }
      return {
        filename: attachment.fileName,
        content: fs.readFileSync(filePath),
        contentType: attachment.mimeType,
      };
    });
  }

  private serializeTemplate(item: TemplateRecord) {
    return {
      id: item.id,
      name: item.name,
      subject: item.subject,
      bodyHtml: item.bodyHtml,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      createdBy: item.createdBy ?? null,
      updatedBy: item.updatedBy ?? null,
      attachments: (item.attachments ?? []).map((attachment) =>
        this.serializeAttachment(attachment),
      ),
    };
  }

  private serializeAttachment(item: AttachmentRecord) {
    return {
      id: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private serializeDispatch(item: DispatchRecord) {
    return {
      id: item.id,
      templateId: item.templateId,
      template: item.template ?? null,
      subject: item.subject,
      bodyHtml: item.bodyHtml,
      status: item.status,
      totalRecipients: item.totalRecipients,
      sentCount: item.sentCount,
      failedCount: item.failedCount,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      createdBy: item.createdBy ?? null,
      deliveries: (item.deliveries ?? []).map((delivery) => ({
        id: delivery.id,
        omId: delivery.omId,
        presidentUserId: delivery.presidentUserId,
        omCode: delivery.omCode,
        omName: delivery.omName,
        recipientName: delivery.recipientName,
        recipientEmail: delivery.recipientEmail,
        status: delivery.status,
        errorMessage: delivery.errorMessage,
        sentAt: delivery.sentAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        updatedAt: delivery.updatedAt.toISOString(),
      })),
    };
  }
}

function sanitizeEmailHtml(value: string | null | undefined) {
  let html = String(value ?? '').trim();
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  );
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi,
    '',
  );
  html = html.replace(
    /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    '',
  );
  html = html.replace(
    /\s(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi,
    ' $1="#"',
  );
  return html;
}

function htmlToText(html: string | null | undefined) {
  return String(html ?? '')
    .replace(
      /<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ' ',
    )
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function personalizeText(value: string, recipient: CpcaEmailRecipient) {
  let next = value;
  for (const [token, replacement] of personalizationEntries(recipient, false)) {
    next = next.split(token).join(replacement);
  }
  return next;
}

function personalizeHtml(value: string, recipient: CpcaEmailRecipient) {
  let next = value;
  for (const [token, replacement] of personalizationEntries(recipient, true)) {
    next = next.split(token).join(replacement);
  }
  return next;
}

function personalizationEntries(
  recipient: CpcaEmailRecipient,
  html: boolean,
): Array<[string, string]> {
  const value = (input: string) => (html ? escapeHtml(input) : input);
  const omLabel = recipient.omCode
    ? `${recipient.omCode} - ${recipient.omName}`
    : recipient.omName;
  return [
    ['{{presidente}}', value(recipient.presidentName)],
    ['{{nome_presidente}}', value(recipient.presidentName)],
    ['{{email}}', value(recipient.presidentEmail)],
    ['{{om}}', value(omLabel)],
    ['{{codigo_om}}', value(recipient.omCode)],
    ['{{nome_om}}', value(recipient.omName)],
  ];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeInteger(
  value: number | string | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}
