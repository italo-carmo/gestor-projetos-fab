import { Injectable } from '@nestjs/common';
import { Prisma, MeetingScope, MeetingStatus } from '@prisma/client';
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
    if (filters.scope) where.scope = filters.scope as MeetingScope;
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.from || filters.to) {
      where.datetime = {};
      if (filters.from) where.datetime.gte = new Date(filters.from);
      if (filters.to) where.datetime.lte = new Date(filters.to);
    }

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) {
      where.AND = [
        ...(where.AND ?? []),
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
    agenda?: string | null;
    localityId?: string | null;
    participantsJson?: any[] | null;
  }, user?: RbacUser) {
    if (payload.scope === MeetingScope.LOCALITY && !payload.localityId) {
      throwError('VALIDATION_ERROR', { reason: 'LOCALITY_REQUIRED' });
    }
    this.assertScope(payload.scope as MeetingScope, payload.localityId ?? null, user);

    const created = await this.prisma.meeting.create({
      data: {
        datetime: new Date(payload.datetime),
        scope: payload.scope as MeetingScope,
        status: payload.status as MeetingStatus,
        agenda: payload.agenda ? sanitizeText(payload.agenda) : null,
        localityId: payload.localityId ?? null,
        participantsJson: payload.participantsJson ?? null,
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
    agenda?: string | null;
    localityId?: string | null;
    participantsJson?: any[] | null;
  }, user?: RbacUser) {
    const existing = await this.prisma.meeting.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const scope = (payload.scope as MeetingScope | undefined) ?? existing.scope;
    const localityId = payload.localityId ?? existing.localityId ?? null;
    if (scope === MeetingScope.LOCALITY && !localityId) {
      throwError('VALIDATION_ERROR', { reason: 'LOCALITY_REQUIRED' });
    }
    this.assertScope(scope, localityId, user);

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        datetime: payload.datetime ? new Date(payload.datetime) : undefined,
        scope: payload.scope ? (payload.scope as MeetingScope) : undefined,
        status: payload.status ? (payload.status as MeetingStatus) : undefined,
        agenda: payload.agenda ? sanitizeText(payload.agenda) : payload.agenda === null ? null : undefined,
        localityId,
        participantsJson: payload.participantsJson ?? undefined,
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
    this.assertScope(meeting.scope, meeting.localityId ?? null, user);

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
    localities: { localityId: string; dueDate: string }[];
  }, user?: RbacUser) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throwError('NOT_FOUND');
    this.assertScope(meeting.scope, meeting.localityId ?? null, user);

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

  private assertScope(scope: MeetingScope, localityId: string | null, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (!constraints.localityId) return;
    if (scope === MeetingScope.NATIONAL) {
      throwError('RBAC_FORBIDDEN');
    }
    if (localityId !== constraints.localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
