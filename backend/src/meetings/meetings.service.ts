import { Injectable } from '@nestjs/common';
import { Prisma, MeetingStatus, MeetingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: {
    status?: string;
    scope?: string;
    localityId?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }, user?: RbacUser) {
    const where: Prisma.MeetingWhereInput = {};
    if (filters.status) where.status = filters.status as MeetingStatus;
    if (filters.scope) where.scope = { contains: filters.scope, mode: 'insensitive' };
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.from || filters.to) {
      where.datetime = {};
      if (filters.from) where.datetime.gte = new Date(filters.from);
      if (filters.to) where.datetime.lte = new Date(filters.to);
    }

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) {
      const andArr = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
      where.AND = [
        ...andArr,
        {
          OR: [{ localityId: null }, { localityId: constraints.localityId }],
        },
      ];
    }

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.meeting.findMany({
        where,
        orderBy: { datetime: 'desc' },
        include: {
          locality: true,
          participants: { include: { user: { select: { id: true, name: true, email: true } } } },
          decisions: true,
          tasks: {
            include: { taskTemplate: true },
            orderBy: { dueDate: 'asc' },
          },
        },
        skip,
        take,
      }),
      this.prisma.meeting.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async create(payload: {
    datetime: string;
    scope: string;
    status: string;
    meetingType?: string;
    meetingLink?: string | null;
    agenda?: string | null;
    localityId?: string | null;
    participantIds?: string[];
  }, user?: RbacUser) {
    const meetingType = (payload.meetingType as MeetingType) ?? MeetingType.PRESENCIAL;
    if (meetingType === MeetingType.PRESENCIAL && !payload.localityId) {
      throwError('VALIDATION_ERROR', { reason: 'LOCALITY_REQUIRED_FOR_PRESENCIAL' });
    }
    if (meetingType === MeetingType.ONLINE && !payload.meetingLink?.trim()) {
      throwError('VALIDATION_ERROR', { reason: 'MEETING_LINK_REQUIRED_FOR_ONLINE' });
    }
    this.assertLocality(payload.localityId ?? null, user);

    const created = await this.prisma.meeting.create({
      data: {
        datetime: new Date(payload.datetime),
        scope: sanitizeText(payload.scope ?? '') || '',
        status: payload.status as MeetingStatus,
        meetingType,
        meetingLink: payload.meetingLink?.trim() || null,
        agenda: payload.agenda ? sanitizeText(payload.agenda) : null,
        localityId: payload.localityId ?? null,
        participants: payload.participantIds?.length
          ? { create: payload.participantIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        locality: true,
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'meetings',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId ?? undefined,
      diffJson: { scope: created.scope, status: created.status },
    });

    return created;
  }

  async update(id: string, payload: {
    datetime?: string;
    scope?: string;
    status?: string;
    meetingType?: string;
    meetingLink?: string | null;
    agenda?: string | null;
    localityId?: string | null;
    participantIds?: string[];
  }, user?: RbacUser) {
    const existing = await this.prisma.meeting.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const meetingType = (payload.meetingType as MeetingType | undefined) ?? existing.meetingType;
    const localityId = payload.localityId ?? existing.localityId ?? null;
    const meetingLink = payload.meetingLink !== undefined ? payload.meetingLink?.trim() || null : existing.meetingLink;

    if (meetingType === MeetingType.PRESENCIAL && !localityId) {
      throwError('VALIDATION_ERROR', { reason: 'LOCALITY_REQUIRED_FOR_PRESENCIAL' });
    }
    if (meetingType === MeetingType.ONLINE && !meetingLink) {
      throwError('VALIDATION_ERROR', { reason: 'MEETING_LINK_REQUIRED_FOR_ONLINE' });
    }
    this.assertLocality(localityId, user);

    if (payload.participantIds !== undefined) {
      await this.prisma.meetingParticipant.deleteMany({ where: { meetingId: id } });
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        datetime: payload.datetime ? new Date(payload.datetime) : undefined,
        scope: payload.scope !== undefined ? (sanitizeText(payload.scope) || '') : undefined,
        status: payload.status ? (payload.status as MeetingStatus) : undefined,
        meetingType: payload.meetingType ? (payload.meetingType as MeetingType) : undefined,
        meetingLink: payload.meetingLink !== undefined ? meetingLink : undefined,
        agenda: payload.agenda ? sanitizeText(payload.agenda) : payload.agenda === null ? null : undefined,
        localityId: payload.localityId !== undefined ? localityId : undefined,
        participants:
          payload.participantIds?.length
            ? { create: payload.participantIds.map((userId) => ({ userId })) }
            : undefined,
      },
      include: {
        locality: true,
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'meetings',
      action: 'update',
      entityId: id,
      localityId: updated.localityId ?? undefined,
      diffJson: { status: updated.status },
    });

    return updated;
  }

  async addDecision(meetingId: string, text: string, user?: RbacUser) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throwError('NOT_FOUND');
    this.assertLocality(meeting.localityId ?? null, user);

    const created = await this.prisma.meetingDecision.create({
      data: {
        meetingId,
        text: sanitizeText(text),
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'meetings',
      action: 'add_decision',
      entityId: meetingId,
      localityId: meeting.localityId ?? undefined,
      diffJson: { decisionId: created.id },
    });

    return created;
  }

  async generateTasks(meetingId: string, payload: {
    templateId?: string;
    title?: string;
    description?: string | null;
    phaseId?: string;
    specialtyId?: string | null;
    reportRequired?: boolean;
    priority?: string;
    assigneeId?: string | null;
    assigneeIds?: string[];
    localities: { localityId: string; dueDate: string }[];
  }, user?: RbacUser) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throwError('NOT_FOUND');
    this.assertLocality(meeting.localityId ?? null, user);

    let templateId = payload.templateId;
    if (!templateId) {
      if (!payload.title || !payload.phaseId) {
        throwError('VALIDATION_ERROR', { hint: 'title e phaseId são obrigatórios para template ad-hoc' });
      }
      const createdTemplate = await this.prisma.taskTemplate.create({
        data: {
          title: sanitizeText(payload.title),
          description: payload.description ? sanitizeText(payload.description) : null,
          phaseId: payload.phaseId,
          specialtyId: payload.specialtyId ?? null,
          appliesToAllLocalities: false,
          reportRequiredDefault: payload.reportRequired ?? false,
        },
      });
      templateId = createdTemplate.id;
    }

    const result = await this.tasks.generateInstances(
      templateId,
      {
        localities: payload.localities,
        reportRequired: payload.reportRequired,
        priority: payload.priority,
        meetingId,
        assignedToId: payload.assigneeId ?? null,
        assigneeIds: payload.assigneeIds ?? [],
      },
      user,
    );

    await this.audit.log({
      userId: user?.id,
      resource: 'meetings',
      action: 'generate_tasks',
      entityId: meetingId,
      localityId: meeting.localityId ?? undefined,
      diffJson: { count: result.items.length },
    });

    return result;
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    return {
      localityId: user.localityId ?? undefined,
    };
  }

  private assertLocality(localityId: string | null, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (!constraints.localityId) return;
    if (localityId != null && localityId !== constraints.localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
