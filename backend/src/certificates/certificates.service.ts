import { Injectable } from '@nestjs/common';
import {
  CertificateEmailDeliveryStatus,
  CertificateQuestionType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { throwError } from '../common/http-error';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import {
  renderCertificatePdf,
  renderCertificatePng,
} from './certificate.renderer';
import type {
  CertificateQuestionDto,
  CreateCertificateEventDto,
  CreateCertificateTemplateDto,
  SendCertificateEmailsDto,
  SubmitCertificateFormDto,
  UpdateCertificateEventDto,
  UpdateCertificateFormDto,
  UpdateCertificateTemplateDto,
} from './dto/certificates.dto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value: unknown, max = 500) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function sanitizeLongText(value: unknown, max = 4000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function normalizeDate(value: unknown, field = 'eventDate') {
  const raw = sanitizeText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throwError('VALIDATION_ERROR', { field, reason: 'INVALID_DATE' });
  }
  return raw;
}

function normalizeTime(value: unknown, field = 'eventTime') {
  const raw = sanitizeText(value, 10);
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throwError('VALIDATION_ERROR', { field, reason: 'INVALID_TIME' });
  }
  return raw;
}

function normalizeEmail(value: unknown) {
  const email = sanitizeText(value, 240).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throwError('VALIDATION_ERROR', { field: 'email', reason: 'INVALID_EMAIL' });
  }
  return email;
}

export function normalizeCertificateFullName(value: unknown) {
  const normalized = String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
  if (!normalized) {
    throwError('VALIDATION_ERROR', { field: 'fullName', reason: 'REQUIRED' });
  }
  return normalized
    .split(' ')
    .map((word) => {
      const [first = '', ...rest] = Array.from(word);
      return `${first.toLocaleUpperCase('pt-BR')}${rest.join('')}`;
    })
    .join(' ')
    .slice(0, 240);
}

function normalizeLayoutJson(value: unknown) {
  if (!value || typeof value !== 'object') {
    throwError('VALIDATION_ERROR', {
      field: 'layoutJson',
      reason: 'INVALID_LAYOUT',
    });
  }
  return value as Prisma.InputJsonValue;
}

function normalizeQuestionType(value: unknown) {
  const raw = sanitizeText(value, 40).toUpperCase();
  if (raw === 'TEXT') return CertificateQuestionType.TEXT;
  if (raw === 'MULTIPLE_CHOICE') return CertificateQuestionType.MULTIPLE_CHOICE;
  if (raw === 'CHECKBOXES') return CertificateQuestionType.CHECKBOXES;
  throwError('VALIDATION_ERROR', {
    field: 'type',
    reason: 'INVALID_QUESTION_TYPE',
  });
}

function normalizeOptions(question: CertificateQuestionDto) {
  const type = normalizeQuestionType(question.type);
  if (type === CertificateQuestionType.TEXT) return [];
  const options = Array.from(
    new Set(
      (question.options ?? [])
        .map((option) => sanitizeText(option, 180))
        .filter(Boolean),
    ),
  );
  if (options.length < 2) {
    throwError('VALIDATION_ERROR', {
      field: 'options',
      reason: 'AT_LEAST_TWO_OPTIONS',
    });
  }
  return options;
}

function serializeQuestion(question: any) {
  return {
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    options: Array.isArray(question.optionsJson) ? question.optionsJson : [],
    sortOrder: question.sortOrder,
  };
}

function sanitizeFileName(value: string) {
  return (
    String(value ?? 'certificado')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 100) || 'certificado'
  );
}

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async listTemplates() {
    const items = await this.prisma.certificateTemplate.findMany({
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    return { items };
  }

  async createTemplate(payload: CreateCertificateTemplateDto, user?: RbacUser) {
    const created = await this.prisma.certificateTemplate.create({
      data: {
        name: this.required(payload.name, 'name'),
        description: this.optional(payload.description),
        layoutJson: normalizeLayoutJson(payload.layoutJson),
        isActive: payload.isActive !== false,
        createdById: user?.id ?? null,
      },
    });
    return created;
  }

  async updateTemplate(id: string, payload: UpdateCertificateTemplateDto) {
    await this.ensureTemplate(id);
    return this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        name:
          payload.name === undefined
            ? undefined
            : this.required(payload.name, 'name'),
        description:
          payload.description === undefined
            ? undefined
            : this.optional(payload.description),
        layoutJson:
          payload.layoutJson === undefined
            ? undefined
            : normalizeLayoutJson(payload.layoutJson),
        isActive: payload.isActive,
      },
    });
  }

  async deleteTemplate(id: string) {
    await this.ensureTemplate(id);
    await this.prisma.certificateTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }

  async previewTemplate(
    id: string,
    fullNameRaw?: string,
    eventNameRaw?: string,
  ) {
    const template = await this.ensureTemplate(id);
    return renderCertificatePng({
      layoutJson: template.layoutJson,
      recipientFullName: fullNameRaw
        ? normalizeCertificateFullName(fullNameRaw)
        : 'Nome Completo Do Participante',
      eventName: sanitizeText(eventNameRaw, 240) || 'Nome Do Evento',
    });
  }

  async listEvents() {
    const events = await this.prisma.certificateEvent.findMany({
      orderBy: [{ eventDate: 'desc' }, { eventTime: 'desc' }],
      include: {
        certificateTemplate: { select: { id: true, name: true } },
        _count: { select: { responses: true, questions: true } },
      },
    });
    return { items: events.map((event) => this.serializeEvent(event)) };
  }

  async getEvent(id: string) {
    const event = await this.prisma.certificateEvent.findUnique({
      where: { id },
      include: {
        certificateTemplate: { select: { id: true, name: true } },
        questions: { orderBy: { sortOrder: 'asc' } },
        responses: {
          orderBy: { submittedAt: 'desc' },
          include: {
            deliveries: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!event) throwError('NOT_FOUND');
    return this.serializeEventDetail(event);
  }

  async createEvent(payload: CreateCertificateEventDto, user?: RbacUser) {
    if (payload.certificateTemplateId) {
      await this.ensureTemplate(payload.certificateTemplateId);
    }
    const created = await this.prisma.certificateEvent.create({
      data: {
        name: this.required(payload.name, 'name'),
        location: this.required(payload.location, 'location'),
        eventDate: normalizeDate(payload.eventDate),
        eventTime: normalizeTime(payload.eventTime),
        description: this.optional(payload.description),
        publicSlug: await this.createUniqueSlug(payload.name),
        certificateTemplateId: payload.certificateTemplateId || null,
        createdById: user?.id ?? null,
        formTitle: this.required(payload.name, 'name'),
      },
    });
    return this.getEvent(created.id);
  }

  async updateEvent(id: string, payload: UpdateCertificateEventDto) {
    await this.ensureEvent(id);
    if (payload.certificateTemplateId) {
      await this.ensureTemplate(payload.certificateTemplateId);
    }
    await this.prisma.certificateEvent.update({
      where: { id },
      data: {
        name:
          payload.name === undefined
            ? undefined
            : this.required(payload.name, 'name'),
        location:
          payload.location === undefined
            ? undefined
            : this.required(payload.location, 'location'),
        eventDate:
          payload.eventDate === undefined
            ? undefined
            : normalizeDate(payload.eventDate),
        eventTime:
          payload.eventTime === undefined
            ? undefined
            : normalizeTime(payload.eventTime),
        description:
          payload.description === undefined
            ? undefined
            : this.optional(payload.description),
        certificateTemplateId:
          payload.certificateTemplateId === undefined
            ? undefined
            : payload.certificateTemplateId || null,
      },
    });
    return this.getEvent(id);
  }

  async deleteEvent(id: string) {
    await this.ensureEvent(id);
    await this.prisma.certificateEvent.delete({ where: { id } });
    return { ok: true };
  }

  async updateForm(id: string, payload: UpdateCertificateFormDto) {
    await this.ensureEvent(id);
    const questions = payload.questions ?? [];
    await this.prisma.$transaction(async (tx) => {
      await tx.certificateEvent.update({
        where: { id },
        data: {
          formTitle:
            payload.formTitle === undefined
              ? undefined
              : this.optional(payload.formTitle) || null,
          formDescription:
            payload.formDescription === undefined
              ? undefined
              : this.optional(payload.formDescription),
          formIsPublished: payload.formIsPublished,
        },
      });
      if (payload.questions) {
        await tx.certificateFormQuestion.deleteMany({ where: { eventId: id } });
        for (const [index, question] of questions.entries()) {
          const label = this.required(
            question.label,
            `questions.${index}.label`,
          );
          const type = normalizeQuestionType(question.type);
          await tx.certificateFormQuestion.create({
            data: {
              eventId: id,
              label,
              type,
              required: question.required === true,
              optionsJson:
                type === CertificateQuestionType.TEXT
                  ? Prisma.JsonNull
                  : normalizeOptions(question),
              sortOrder: index,
            },
          });
        }
      }
    });
    return this.getEvent(id);
  }

  async getPublicForm(slug: string) {
    const event = await this.prisma.certificateEvent.findUnique({
      where: { publicSlug: slug },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!event || !event.formIsPublished) throwError('NOT_FOUND');
    return {
      id: event.id,
      name: event.name,
      location: event.location,
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      description: event.description,
      formTitle: event.formTitle || event.name,
      formDescription: event.formDescription,
      questions: event.questions.map(serializeQuestion),
    };
  }

  async submitPublicForm(slug: string, payload: SubmitCertificateFormDto) {
    const event = await this.prisma.certificateEvent.findUnique({
      where: { publicSlug: slug },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!event || !event.formIsPublished) throwError('NOT_FOUND');
    const fullName = normalizeCertificateFullName(payload.fullName);
    const email = normalizeEmail(payload.email);
    const answers = this.normalizeAnswers(
      event.questions,
      payload.answers ?? {},
    );
    const created = await this.prisma.certificateFormResponse.create({
      data: {
        eventId: event.id,
        fullName,
        email,
        answersJson: answers,
      },
    });
    return {
      ok: true,
      id: created.id,
      fullName,
      email,
      submittedAt: created.submittedAt,
    };
  }

  async sendCertificates(eventId: string, payload: SendCertificateEmailsDto) {
    const event = await this.prisma.certificateEvent.findUnique({
      where: { id: eventId },
      include: {
        certificateTemplate: true,
        responses: true,
      },
    });
    if (!event) throwError('NOT_FOUND');
    if (!event.certificateTemplate) {
      throwError('VALIDATION_ERROR', {
        field: 'certificateTemplateId',
        reason: 'REQUIRED',
      });
    }
    const requestedIds = new Set(
      (payload.responseIds ?? [])
        .map((id) => String(id ?? '').trim())
        .filter(Boolean),
    );
    const responses = requestedIds.size
      ? event.responses.filter((response) => requestedIds.has(response.id))
      : event.responses;
    if (!responses.length) {
      throwError('VALIDATION_ERROR', { field: 'responseIds', reason: 'EMPTY' });
    }

    const results = [];
    for (const response of responses) {
      const delivery = await this.prisma.certificateEmailDelivery.create({
        data: {
          eventId,
          responseId: response.id,
          templateId: event.certificateTemplate.id,
          email: response.email,
          fullName: response.fullName,
          status: CertificateEmailDeliveryStatus.QUEUED,
        },
      });

      try {
        const pdf = await renderCertificatePdf({
          layoutJson: event.certificateTemplate.layoutJson,
          recipientFullName: response.fullName,
          eventName: event.name,
        });
        const fileName = `${sanitizeFileName(event.name)}-${sanitizeFileName(response.fullName)}.pdf`;
        const sent = await this.mail.sendMailImmediate({
          to: response.email,
          subject: `Certificado - ${event.name}`,
          html: `<p>Olá, ${response.fullName}.</p><p>Segue em anexo o seu certificado referente ao evento <strong>${event.name}</strong>.</p>`,
          text: `Olá, ${response.fullName}.\n\nSegue em anexo o seu certificado referente ao evento ${event.name}.`,
          attachments: [
            {
              filename: fileName,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
        });
        const updated = await this.prisma.certificateEmailDelivery.update({
          where: { id: delivery.id },
          data: sent.ok
            ? {
                status: CertificateEmailDeliveryStatus.SENT,
                sentAt: new Date(),
                errorMessage: null,
              }
            : {
                status: CertificateEmailDeliveryStatus.FAILED,
                errorMessage: sent.message?.slice(0, 2000) ?? 'Falha no envio.',
              },
        });
        results.push(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const updated = await this.prisma.certificateEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: CertificateEmailDeliveryStatus.FAILED,
            errorMessage: message.slice(0, 2000),
          },
        });
        results.push(updated);
      }
    }

    return {
      ok: true,
      sent: results.filter(
        (item) => item.status === CertificateEmailDeliveryStatus.SENT,
      ).length,
      failed: results.filter(
        (item) => item.status === CertificateEmailDeliveryStatus.FAILED,
      ).length,
      items: results,
    };
  }

  async buildCertificatePdf(eventId: string, responseId: string) {
    const event = await this.prisma.certificateEvent.findUnique({
      where: { id: eventId },
      include: {
        certificateTemplate: true,
        responses: { where: { id: responseId } },
      },
    });
    if (!event || !event.certificateTemplate || !event.responses[0]) {
      throwError('NOT_FOUND');
    }
    return renderCertificatePdf({
      layoutJson: event.certificateTemplate.layoutJson,
      recipientFullName: event.responses[0].fullName,
      eventName: event.name,
    });
  }

  private serializeEvent(event: any) {
    return {
      id: event.id,
      name: event.name,
      location: event.location,
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      description: event.description,
      publicSlug: event.publicSlug,
      formIsPublished: event.formIsPublished,
      formTitle: event.formTitle,
      certificateTemplateId: event.certificateTemplateId,
      certificateTemplate: event.certificateTemplate,
      questionsCount: event._count?.questions ?? 0,
      responsesCount: event._count?.responses ?? 0,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private serializeEventDetail(event: any) {
    return {
      ...this.serializeEvent({
        ...event,
        _count: {
          questions: event.questions?.length ?? 0,
          responses: event.responses?.length ?? 0,
        },
      }),
      formDescription: event.formDescription,
      questions: (event.questions ?? []).map(serializeQuestion),
      responses: (event.responses ?? []).map((response: any) => ({
        id: response.id,
        fullName: response.fullName,
        email: response.email,
        answers: response.answersJson ?? {},
        submittedAt: response.submittedAt,
        latestDelivery: response.deliveries?.[0] ?? null,
      })),
    };
  }

  private normalizeAnswers(
    questions: any[],
    rawAnswers: Record<string, unknown>,
  ) {
    const result: Record<string, unknown> = {};
    for (const question of questions) {
      const value = rawAnswers[question.id];
      if (question.type === CertificateQuestionType.TEXT) {
        const text = sanitizeLongText(value, 2000);
        if (question.required && !text) {
          throwError('VALIDATION_ERROR', {
            field: question.id,
            reason: 'REQUIRED',
          });
        }
        result[question.id] = text;
        continue;
      }
      const options = Array.isArray(question.optionsJson)
        ? question.optionsJson.map((option: unknown) => String(option))
        : [];
      if (question.type === CertificateQuestionType.MULTIPLE_CHOICE) {
        const selected = sanitizeText(value, 300);
        if (question.required && !selected) {
          throwError('VALIDATION_ERROR', {
            field: question.id,
            reason: 'REQUIRED',
          });
        }
        if (selected && !options.includes(selected)) {
          throwError('VALIDATION_ERROR', {
            field: question.id,
            reason: 'INVALID_OPTION',
          });
        }
        result[question.id] = selected;
        continue;
      }
      const selectedValues = Array.isArray(value)
        ? value.map((item) => sanitizeText(item, 300)).filter(Boolean)
        : [];
      if (question.required && selectedValues.length === 0) {
        throwError('VALIDATION_ERROR', {
          field: question.id,
          reason: 'REQUIRED',
        });
      }
      if (selectedValues.some((item) => !options.includes(item))) {
        throwError('VALIDATION_ERROR', {
          field: question.id,
          reason: 'INVALID_OPTION',
        });
      }
      result[question.id] = selectedValues;
    }
    return result as Prisma.InputJsonValue;
  }

  private async ensureTemplate(id: string) {
    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });
    if (!template) throwError('NOT_FOUND');
    return template;
  }

  private async ensureEvent(id: string) {
    const event = await this.prisma.certificateEvent.findUnique({
      where: { id },
    });
    if (!event) throwError('NOT_FOUND');
    return event;
  }

  private async createUniqueSlug(seed: string) {
    const base =
      sanitizeFileName(seed).slice(0, 48) ||
      `evento-${Date.now().toString(36)}`;
    for (let index = 0; index < 6; index += 1) {
      const suffix = randomUUID().slice(0, 8);
      const slug = `${base}-${suffix}`;
      const existing = await this.prisma.certificateEvent.findUnique({
        where: { publicSlug: slug },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private required(value: unknown, field: string) {
    const text = sanitizeText(value, 300);
    if (!text) throwError('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
    return text;
  }

  private optional(value: unknown) {
    const text = sanitizeLongText(value, 4000);
    return text || null;
  }
}
