"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const tasks_service_1 = require("../tasks/tasks.service");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const pagination_1 = require("../common/pagination");
let MeetingsService = class MeetingsService {
    prisma;
    tasks;
    audit;
    constructor(prisma, tasks, audit) {
        this.prisma = prisma;
        this.tasks = tasks;
        this.audit = audit;
    }
    async list(filters, user) {
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.scope)
            where.scope = { contains: filters.scope, mode: 'insensitive' };
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.from || filters.to) {
            where.datetime = {};
            if (filters.from)
                where.datetime.gte = new Date(filters.from);
            if (filters.to)
                where.datetime.lte = new Date(filters.to);
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
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
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
    async create(payload, user) {
        const meetingType = payload.meetingType ?? client_1.MeetingType.PRESENCIAL;
        if (meetingType === client_1.MeetingType.PRESENCIAL && !payload.localityId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'LOCALITY_REQUIRED_FOR_PRESENCIAL' });
        }
        if (meetingType === client_1.MeetingType.ONLINE && !payload.meetingLink?.trim()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'MEETING_LINK_REQUIRED_FOR_ONLINE' });
        }
        this.assertLocality(payload.localityId ?? null, user);
        const created = await this.prisma.meeting.create({
            data: {
                datetime: new Date(payload.datetime),
                scope: (0, sanitize_1.sanitizeText)(payload.scope ?? '') || '',
                status: payload.status,
                meetingType,
                meetingLink: payload.meetingLink?.trim() || null,
                agenda: payload.agenda ? (0, sanitize_1.sanitizeText)(payload.agenda) : null,
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
    async update(id, payload, user) {
        const existing = await this.prisma.meeting.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const meetingType = payload.meetingType ?? existing.meetingType;
        const localityId = payload.localityId ?? existing.localityId ?? null;
        const meetingLink = payload.meetingLink !== undefined ? payload.meetingLink?.trim() || null : existing.meetingLink;
        if (meetingType === client_1.MeetingType.PRESENCIAL && !localityId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'LOCALITY_REQUIRED_FOR_PRESENCIAL' });
        }
        if (meetingType === client_1.MeetingType.ONLINE && !meetingLink) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'MEETING_LINK_REQUIRED_FOR_ONLINE' });
        }
        this.assertLocality(localityId, user);
        if (payload.participantIds !== undefined) {
            await this.prisma.meetingParticipant.deleteMany({ where: { meetingId: id } });
        }
        const updated = await this.prisma.meeting.update({
            where: { id },
            data: {
                datetime: payload.datetime ? new Date(payload.datetime) : undefined,
                scope: payload.scope !== undefined ? ((0, sanitize_1.sanitizeText)(payload.scope) || '') : undefined,
                status: payload.status ? payload.status : undefined,
                meetingType: payload.meetingType ? payload.meetingType : undefined,
                meetingLink: payload.meetingLink !== undefined ? meetingLink : undefined,
                agenda: payload.agenda ? (0, sanitize_1.sanitizeText)(payload.agenda) : payload.agenda === null ? null : undefined,
                localityId: payload.localityId !== undefined ? localityId : undefined,
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
            action: 'update',
            entityId: id,
            localityId: updated.localityId ?? undefined,
            diffJson: { status: updated.status },
        });
        return updated;
    }
    async addDecision(meetingId, text, user) {
        const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
        if (!meeting)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocality(meeting.localityId ?? null, user);
        const created = await this.prisma.meetingDecision.create({
            data: {
                meetingId,
                text: (0, sanitize_1.sanitizeText)(text),
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
    async generateTasks(meetingId, payload, user) {
        const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
        if (!meeting)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocality(meeting.localityId ?? null, user);
        let templateId = payload.templateId;
        if (!templateId) {
            if (!payload.title || !payload.phaseId) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', { hint: 'title e phaseId são obrigatórios para template ad-hoc' });
            }
            const createdTemplate = await this.prisma.taskTemplate.create({
                data: {
                    title: (0, sanitize_1.sanitizeText)(payload.title),
                    description: payload.description ? (0, sanitize_1.sanitizeText)(payload.description) : null,
                    phaseId: payload.phaseId,
                    specialtyId: payload.specialtyId ?? null,
                    appliesToAllLocalities: false,
                    reportRequiredDefault: payload.reportRequired ?? false,
                },
            });
            templateId = createdTemplate.id;
        }
        const result = await this.tasks.generateInstances(templateId, {
            localities: payload.localities,
            reportRequired: payload.reportRequired,
            priority: payload.priority,
            meetingId,
            assignedToId: payload.assigneeId ?? null,
            assigneeIds: payload.assigneeIds ?? [],
        }, user);
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
    getScopeConstraints(user) {
        if (!user)
            return {};
        return {
            localityId: user.localityId ?? undefined,
        };
    }
    assertLocality(localityId, user) {
        const constraints = this.getScopeConstraints(user);
        if (!constraints.localityId)
            return;
        if (localityId != null && localityId !== constraints.localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
};
exports.MeetingsService = MeetingsService;
exports.MeetingsService = MeetingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tasks_service_1.TasksService,
        audit_service_1.AuditService])
], MeetingsService);
//# sourceMappingURL=meetings.service.js.map