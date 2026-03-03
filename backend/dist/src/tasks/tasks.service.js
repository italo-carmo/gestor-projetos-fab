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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const role_access_1 = require("../rbac/role-access");
const executive_1 = require("../common/executive");
const sanitize_1 = require("../common/sanitize");
const priority_localities_1 = require("../common/priority-localities");
let TasksService = class TasksService {
    prisma;
    audit;
    manualTaskTemplateTitle = 'Tarefa manual';
    manualTaskTemplateDescription = 'Template técnico para tarefas criadas manualmente no módulo.';
    phaseLabelByCode = {
        PREPARACAO: 'Preparação',
        EXECUCAO: 'Execução',
        ACOMPANHAMENTO: 'Acompanhamento',
    };
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async listPhases() {
        const phases = await this.prisma.phase.findMany({
            orderBy: { order: 'asc' },
        });
        return phases.map((phase) => this.mapPhase(phase));
    }
    async updatePhase(id, payload, user) {
        const existing = await this.prisma.phase.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const normalized = payload.displayName === undefined
            ? existing.displayName
            : payload.displayName && payload.displayName.trim()
                ? (0, sanitize_1.sanitizeText)(payload.displayName.trim())
                : null;
        const updated = await this.prisma.phase.update({
            where: { id },
            data: { displayName: normalized },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'phases',
            action: 'update',
            entityId: id,
            diffJson: { displayName: updated.displayName ?? null },
        });
        return this.mapPhase(updated);
    }
    listTaskTemplates() {
        return this.prisma.taskTemplate.findMany({
            orderBy: { title: 'asc' },
            include: { eloRole: { select: { id: true, code: true, name: true } } },
        });
    }
    async createTaskTemplate(data, user) {
        const payload = data;
        const phaseId = payload.phase?.connect?.id;
        const specialtyId = payload.specialty?.connect?.id;
        const eloRoleId = payload.eloRole?.connect?.id;
        const title = String(payload.title ?? '').trim();
        if (phaseId && title) {
            const existing = await this.prisma.taskTemplate.findFirst({
                where: {
                    title: { equals: title, mode: 'insensitive' },
                    phaseId,
                    specialtyId: specialtyId ?? null,
                    eloRoleId: eloRoleId ?? null,
                },
                select: { id: true },
            });
            if (existing) {
                (0, http_error_1.throwError)('CONFLICT_UNIQUE', {
                    resource: 'task_templates',
                    field: 'title+phaseId+specialtyId+eloRoleId',
                    existingId: existing.id,
                });
            }
        }
        const created = await this.prisma.taskTemplate.create({ data });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_templates',
            action: 'create',
            entityId: created.id,
            localityId: user?.localityId ?? undefined,
        });
        return created;
    }
    async updateTaskTemplate(id, payload, user) {
        this.assertTemplateManageAccess(user);
        const existing = await this.prisma.taskTemplate.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                description: true,
                phaseId: true,
                specialtyId: true,
                eloRoleId: true,
                appliesToAllLocalities: true,
                reportRequiredDefault: true,
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const normalizedTitle = payload.title === undefined
            ? existing.title
            : (0, sanitize_1.sanitizeText)(payload.title);
        if (!normalizedTitle) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'title', reason: 'required' });
        }
        const normalizedDescription = payload.description === undefined
            ? existing.description
            : payload.description === null
                ? null
                : (0, sanitize_1.sanitizeText)(payload.description);
        const phaseId = payload.phaseId ?? existing.phaseId;
        const specialtyId = payload.specialtyId === undefined
            ? existing.specialtyId
            : payload.specialtyId;
        const eloRoleId = payload.eloRoleId === undefined ? existing.eloRoleId : payload.eloRoleId;
        const appliesToAllLocalities = payload.appliesToAllLocalities ?? existing.appliesToAllLocalities;
        const reportRequiredDefault = payload.reportRequiredDefault ?? existing.reportRequiredDefault;
        const duplicate = await this.prisma.taskTemplate.findFirst({
            where: {
                id: { not: id },
                title: { equals: normalizedTitle, mode: 'insensitive' },
                phaseId,
                specialtyId,
                eloRoleId,
            },
            select: { id: true },
        });
        if (duplicate) {
            (0, http_error_1.throwError)('CONFLICT_UNIQUE', {
                resource: 'task_templates',
                field: 'title+phaseId+specialtyId+eloRoleId',
                existingId: duplicate.id,
            });
        }
        const updated = await this.prisma.taskTemplate.update({
            where: { id },
            data: {
                title: normalizedTitle,
                description: normalizedDescription,
                phaseId,
                specialtyId,
                eloRoleId,
                appliesToAllLocalities,
                reportRequiredDefault,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_templates',
            action: 'update',
            entityId: updated.id,
            localityId: user?.localityId ?? undefined,
            diffJson: {
                title: updated.title,
                phaseId: updated.phaseId,
                specialtyId: updated.specialtyId ?? null,
                eloRoleId: updated.eloRoleId ?? null,
                reportRequiredDefault: updated.reportRequiredDefault,
                appliesToAllLocalities: updated.appliesToAllLocalities,
            },
        });
        return updated;
    }
    async cloneTaskTemplate(id, user) {
        const template = await this.prisma.taskTemplate.findUnique({
            where: { id },
        });
        if (!template)
            (0, http_error_1.throwError)('NOT_FOUND');
        const cloned = await this.prisma.taskTemplate.create({
            data: {
                title: `${template.title} (copia)`,
                description: template.description,
                phaseId: template.phaseId,
                specialtyId: template.specialtyId,
                eloRoleId: template.eloRoleId,
                appliesToAllLocalities: template.appliesToAllLocalities,
                reportRequiredDefault: template.reportRequiredDefault,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_templates',
            action: 'clone',
            entityId: cloned.id,
            diffJson: { sourceId: id },
        });
        return cloned;
    }
    async deleteTaskTemplate(id, user) {
        this.assertTemplateManageAccess(user);
        const template = await this.prisma.taskTemplate.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                _count: {
                    select: {
                        instances: true,
                        checklistItems: true,
                    },
                },
            },
        });
        if (!template)
            (0, http_error_1.throwError)('NOT_FOUND');
        const linkedInstances = template._count.instances ?? 0;
        const linkedChecklistItems = template._count.checklistItems ?? 0;
        if (linkedInstances > 0) {
            (0, http_error_1.throwError)('TASK_TEMPLATE_IN_USE', {
                linkedInstances,
            });
        }
        await this.prisma.$transaction(async (tx) => {
            if (linkedChecklistItems > 0) {
                await tx.checklistItem.deleteMany({
                    where: { taskTemplateId: id },
                });
            }
            await tx.taskTemplate.delete({ where: { id } });
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_templates',
            action: 'delete',
            entityId: id,
            localityId: user?.localityId ?? undefined,
            diffJson: {
                title: template.title,
                removedChecklistLinks: linkedChecklistItems,
            },
        });
        return { ok: true };
    }
    async generateInstances(templateId, payload, user) {
        const template = await this.prisma.taskTemplate.findUnique({
            where: { id: templateId },
        });
        if (!template)
            (0, http_error_1.throwError)('NOT_FOUND');
        const reportRequired = payload.reportRequired ?? template.reportRequiredDefault;
        const priority = payload.priority ?? client_1.TaskPriority.MEDIUM;
        const groupKey = payload.localities.length > 1 ? (0, node_crypto_1.randomUUID)() : null;
        const responsibleIds = Array.from(new Set((payload.assigneeIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (payload.assignedToId &&
            !responsibleIds.includes(payload.assignedToId)) {
            responsibleIds.push(payload.assignedToId);
        }
        const created = await this.prisma.$transaction(payload.localities.map((entry) => this.prisma.taskInstance.create({
            data: {
                taskTemplateId: templateId,
                localityId: entry.localityId,
                specialtyId: template.specialtyId ?? null,
                dueDate: new Date(entry.dueDate),
                status: client_1.TaskStatus.NOT_STARTED,
                priority,
                progressPercent: 0,
                assignedToId: payload.assignedToId ?? null,
                assigneeType: payload.assignedToId ? client_1.TaskAssigneeType.USER : null,
                reportRequired,
                groupKey,
                meetingId: payload.meetingId ?? null,
                eloRoleId: template.eloRoleId ?? null,
                responsibles: responsibleIds.length > 0
                    ? {
                        create: responsibleIds.map((userId) => ({
                            userId,
                            assignedById: user?.id ?? null,
                        })),
                    }
                    : undefined,
            },
        })));
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'create_batch',
            localityId: user?.localityId ?? undefined,
            diffJson: { templateId, count: created.length },
        });
        return { items: created };
    }
    async createTaskInstancesManual(payload, user) {
        const title = (0, sanitize_1.sanitizeText)(String(payload.title ?? '').trim());
        if (!title) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'title',
                reason: 'REQUIRED',
            });
        }
        const dueDate = new Date(payload.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'dueDate',
                reason: 'INVALID_DATE',
            });
        }
        const localityIds = Array.from(new Set((payload.localityIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (!localityIds.length) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityIds',
                reason: 'REQUIRED',
            });
        }
        const phaseId = String(payload.phaseId ?? '').trim();
        if (!phaseId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'phaseId',
                reason: 'REQUIRED',
            });
        }
        const phase = await this.prisma.phase.findUnique({
            where: { id: phaseId },
            select: { id: true },
        });
        if (!phase)
            (0, http_error_1.throwError)('NOT_FOUND');
        const priorityValues = Object.values(client_1.TaskPriority);
        const priority = priorityValues.includes(payload.priority)
            ? payload.priority
            : client_1.TaskPriority.MEDIUM;
        for (const localityId of localityIds) {
            this.assertConstraints(localityId, null, user);
        }
        const normalizedAssigneeIds = Array.from(new Set([payload.assignedToId, ...(payload.assigneeIds ?? [])]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (normalizedAssigneeIds.length > 0) {
            for (const localityId of localityIds) {
                this.assertCanAssignInLocality(localityId, user);
            }
        }
        const users = normalizedAssigneeIds.length
            ? await this.prisma.user.findMany({
                where: { id: { in: normalizedAssigneeIds }, isActive: true },
                select: { id: true, localityId: true },
            })
            : [];
        if (users.length !== normalizedAssigneeIds.length) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        const selectedAssignedToId = String(payload.assignedToId ?? '').trim();
        const template = await this.resolveManualTaskTemplate(phaseId);
        const groupKey = localityIds.length > 1 ? (0, node_crypto_1.randomUUID)() : null;
        const created = await this.prisma.$transaction(localityIds.map((localityId) => {
            const localityResponsibleIds = users
                .filter((candidate) => candidate.localityId === localityId)
                .map((candidate) => candidate.id);
            const assignedToId = users.some((candidate) => candidate.id === selectedAssignedToId &&
                candidate.localityId === localityId)
                ? selectedAssignedToId
                : null;
            return this.prisma.taskInstance.create({
                data: {
                    taskTemplateId: template.id,
                    localityId,
                    titleOverride: title,
                    groupKey,
                    dueDate,
                    status: client_1.TaskStatus.NOT_STARTED,
                    priority,
                    progressPercent: 0,
                    assignedToId: assignedToId || null,
                    assigneeType: assignedToId ? client_1.TaskAssigneeType.USER : null,
                    reportRequired: false,
                    responsibles: localityResponsibleIds.length > 0
                        ? {
                            create: localityResponsibleIds.map((userId) => ({
                                userId,
                                assignedById: user?.id ?? null,
                            })),
                        }
                        : undefined,
                },
            });
        }));
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'create_batch_manual',
            localityId: user?.localityId ?? undefined,
            diffJson: {
                title,
                phaseId,
                count: created.length,
                localityIds,
            },
        });
        return { items: created };
    }
    async listTaskInstances(filters, user) {
        const allowedLocalityIds = await this.getTargetLocalityIds();
        if (allowedLocalityIds.length === 0) {
            const { page, pageSize } = this.parsePagination(filters.page, filters.pageSize);
            return { items: [], page, pageSize, total: 0 };
        }
        const { where } = this.buildTaskWhere({ ...filters, allowedLocalityIds }, user);
        if (filters.meetingId)
            where.meetingId = filters.meetingId;
        if (filters.eloRoleId)
            where.eloRoleId = filters.eloRoleId;
        const { page, pageSize, skip, take } = this.parsePagination(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.taskInstance.findMany({
                where,
                orderBy: { dueDate: 'asc' },
                skip,
                take,
                include: {
                    locality: { select: { id: true, name: true, code: true } },
                    specialty: { select: { id: true, name: true, color: true } },
                    taskTemplate: { select: { id: true, title: true, phaseId: true } },
                    assignedTo: { select: { id: true, name: true, email: true } },
                    assignedElo: {
                        include: {
                            eloRole: { select: { id: true, code: true, name: true } },
                        },
                    },
                    responsibles: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    localityId: true,
                                    specialtyId: true,
                                    eloRoleId: true,
                                },
                            },
                        },
                        orderBy: [{ createdAt: 'asc' }],
                    },
                    meeting: { select: { id: true, datetime: true, scope: true } },
                    eloRole: { select: { id: true, code: true, name: true } },
                },
            }),
            this.prisma.taskInstance.count({ where }),
        ]);
        const withCommentSummary = await this.attachTaskCommentSummary(items, user);
        return {
            items: withCommentSummary.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)),
            page,
            pageSize,
            total,
        };
    }
    async getTaskInstanceById(id, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: {
                    include: { phase: true, specialty: true, eloRole: true },
                },
                locality: true,
                specialty: { select: { id: true, name: true, color: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: {
                    include: {
                        eloRole: { select: { id: true, code: true, name: true } },
                    },
                },
                responsibles: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                localityId: true,
                                specialtyId: true,
                                eloRoleId: true,
                            },
                        },
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                meeting: { select: { id: true, datetime: true, scope: true } },
                eloRole: { select: { id: true, code: true, name: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskViewAccess(instance, user);
        const [withCommentSummary] = await this.attachTaskCommentSummary([instance], user);
        return this.mapTaskInstance(withCommentSummary, user?.executiveHidePii);
    }
    async listComments(id, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskViewAccess(instance, user);
        const [comments, readState] = await this.prisma.$transaction([
            this.prisma.taskComment.findMany({
                where: { taskInstanceId: id },
                include: { author: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            user?.id
                ? this.prisma.taskCommentRead.findUnique({
                    where: {
                        taskInstanceId_userId: { taskInstanceId: id, userId: user.id },
                    },
                })
                : this.prisma.taskCommentRead.findFirst({
                    where: { taskInstanceId: id, userId: '__none__' },
                }),
        ]);
        const seenAt = readState?.seenAt ?? null;
        const unread = user?.id
            ? comments.filter((comment) => comment.authorId !== user.id &&
                (!seenAt || comment.createdAt > seenAt)).length
            : 0;
        return {
            items: comments.map((comment) => this.mapTaskComment(comment, user?.executiveHidePii)),
            summary: {
                total: comments.length,
                unread,
                hasUnread: unread > 0,
            },
        };
    }
    async addComment(id, text, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        const normalized = this.sanitizeCommentText(text);
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'text',
                reason: 'COMMENT_REQUIRED',
            });
        }
        const created = await this.prisma.taskComment.create({
            data: {
                taskInstanceId: id,
                authorId: user.id,
                text: normalized,
            },
            include: { author: { select: { id: true, name: true, email: true } } },
        });
        await this.prisma.taskCommentRead.upsert({
            where: { taskInstanceId_userId: { taskInstanceId: id, userId: user.id } },
            update: { seenAt: new Date() },
            create: { taskInstanceId: id, userId: user.id, seenAt: new Date() },
        });
        await this.audit.log({
            userId: user.id,
            resource: 'task_comments',
            action: 'create',
            entityId: created.id,
            localityId: instance.localityId,
            diffJson: { taskInstanceId: id },
        });
        return this.mapTaskComment(created, user?.executiveHidePii);
    }
    async markCommentsSeen(id, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskViewAccess(instance, user);
        const seenAt = new Date();
        await this.prisma.taskCommentRead.upsert({
            where: { taskInstanceId_userId: { taskInstanceId: id, userId: user.id } },
            update: { seenAt },
            create: { taskInstanceId: id, userId: user.id, seenAt },
        });
        return { ok: true, seenAt };
    }
    async updateStatus(id, status, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        const progressPercent = this.applyProgressRules(status, instance.progressPercent);
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { status, progressPercent },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_status',
            entityId: id,
            localityId: instance.localityId,
            diffJson: { status },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async updateProgress(id, progressPercent, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        const adjusted = this.applyProgressRules(instance.status, progressPercent);
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { progressPercent: adjusted },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_progress',
            entityId: id,
            localityId: instance.localityId,
            diffJson: { progressPercent: adjusted },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async updateTaskTitle(id, title, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        const normalizedTitle = (0, sanitize_1.sanitizeText)(String(title ?? '').trim());
        if (!normalizedTitle) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'title',
                reason: 'REQUIRED',
            });
        }
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { titleOverride: normalizedTitle },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_title',
            entityId: id,
            localityId: instance.localityId,
            diffJson: { title: normalizedTitle },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async listAssignees(localityIdRaw, user) {
        const localityId = localityIdRaw?.trim();
        if (!localityId) {
            return { localityId: null, localityName: null, items: [] };
        }
        this.assertCanAssignInLocality(localityId, user);
        const [locality, users, elos] = await this.prisma.$transaction([
            this.prisma.locality.findUnique({
                where: { id: localityId },
                select: {
                    id: true,
                    name: true,
                    commandName: true,
                    commanderName: true,
                },
            }),
            this.prisma.user.findMany({
                where: { localityId, isActive: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    eloRole: { select: { name: true, code: true } },
                },
            }),
            this.prisma.elo.findMany({
                where: { localityId },
                orderBy: [{ eloRole: { sortOrder: 'asc' } }, { name: 'asc' }],
                include: { eloRole: { select: { id: true, code: true, name: true } } },
            }),
        ]);
        if (!locality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const items = [];
        for (const u of users) {
            items.push({
                type: client_1.TaskAssigneeType.USER,
                id: u.id,
                label: u.name || u.email,
                subtitle: u.eloRole?.name ? `Usuário • ${u.eloRole.name}` : 'Usuário',
            });
        }
        for (const elo of elos) {
            items.push({
                type: client_1.TaskAssigneeType.ELO,
                id: elo.id,
                label: elo.name,
                subtitle: elo.eloRole?.name ?? elo.eloRole?.code ?? 'Elo',
            });
        }
        if (locality.commandName) {
            items.push({
                type: client_1.TaskAssigneeType.LOCALITY_COMMAND,
                id: 'LOCALITY_COMMAND',
                label: locality.commandName,
                subtitle: 'GSD / Comando',
            });
        }
        if (locality.commanderName) {
            items.push({
                type: client_1.TaskAssigneeType.LOCALITY_COMMANDER,
                id: 'LOCALITY_COMMANDER',
                label: locality.commanderName,
                subtitle: 'Comandante',
            });
        }
        return {
            localityId: locality.id,
            localityName: locality.name,
            items,
        };
    }
    async assignTask(id, payload, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
                meeting: { select: { id: true, localityId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        const targetLocalityId = payload.localityId?.trim() || instance.localityId;
        this.assertCanAssignInTaskScope({
            localityId: targetLocalityId,
            specialtyId: instance.specialtyId ?? instance.taskTemplate?.specialtyId ?? null,
            taskTemplate: {
                specialtyId: instance.taskTemplate?.specialtyId ?? null,
            },
            eloRoleId: instance.eloRoleId ?? null,
            assignedElo: instance.assignedElo,
        }, user);
        const selection = this.normalizeAssigneeSelection(payload);
        let assignedToId = null;
        let assignedEloId = null;
        let assigneeType = null;
        let externalAssigneeName = null;
        let externalAssigneeRole = null;
        if (selection.type === client_1.TaskAssigneeType.USER && selection.id) {
            const targetUser = await this.prisma.user.findUnique({
                where: { id: selection.id },
                select: {
                    id: true,
                    localityId: true,
                    specialtyId: true,
                    eloRoleId: true,
                    isActive: true,
                },
            });
            if (!targetUser)
                (0, http_error_1.throwError)('NOT_FOUND');
            if (!targetUser.isActive)
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            if (targetUser.localityId !== targetLocalityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            assignedToId = targetUser.id;
            assigneeType = client_1.TaskAssigneeType.USER;
        }
        else if (selection.type === client_1.TaskAssigneeType.ELO && selection.id) {
            const targetElo = await this.prisma.elo.findUnique({
                where: { id: selection.id },
                select: {
                    id: true,
                    localityId: true,
                    name: true,
                    eloRole: { select: { name: true, code: true } },
                },
            });
            if (!targetElo)
                (0, http_error_1.throwError)('NOT_FOUND');
            if (targetElo.localityId !== targetLocalityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            assignedEloId = targetElo.id;
            assigneeType = client_1.TaskAssigneeType.ELO;
        }
        else if (selection.type === client_1.TaskAssigneeType.LOCALITY_COMMAND) {
            const locality = await this.prisma.locality.findUnique({
                where: { id: targetLocalityId },
                select: { commandName: true },
            });
            externalAssigneeName = locality?.commandName?.trim() ?? null;
            externalAssigneeRole = externalAssigneeName ? 'GSD / Comando' : null;
            assigneeType = externalAssigneeName
                ? client_1.TaskAssigneeType.LOCALITY_COMMAND
                : null;
        }
        else if (selection.type === client_1.TaskAssigneeType.LOCALITY_COMMANDER) {
            const locality = await this.prisma.locality.findUnique({
                where: { id: targetLocalityId },
                select: { commanderName: true },
            });
            externalAssigneeName = locality?.commanderName?.trim() ?? null;
            externalAssigneeRole = externalAssigneeName ? 'Comandante' : null;
            assigneeType = externalAssigneeName
                ? client_1.TaskAssigneeType.LOCALITY_COMMANDER
                : null;
        }
        const keepMeeting = !instance.meeting ||
            !instance.meeting.localityId ||
            instance.meeting.localityId === targetLocalityId;
        const responsibleIds = await this.resolveTaskResponsibleIds(targetLocalityId, {
            assigneeIds: payload.assigneeIds,
            assignedToId,
            selectionType: selection.type,
        }, user);
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: {
                localityId: targetLocalityId,
                meetingId: keepMeeting ? instance.meetingId : null,
                assignedToId,
                assignedEloId,
                assigneeType,
                externalAssigneeName,
                externalAssigneeRole,
                responsibles: {
                    deleteMany: {},
                    ...(responsibleIds.length > 0
                        ? {
                            create: responsibleIds.map((userId) => ({
                                userId,
                                assignedById: user?.id ?? null,
                            })),
                        }
                        : {}),
                },
            },
            include: {
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: {
                    include: {
                        eloRole: { select: { id: true, code: true, name: true } },
                    },
                },
                responsibles: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                localityId: true,
                                specialtyId: true,
                                eloRoleId: true,
                            },
                        },
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                meeting: { select: { id: true, datetime: true, scope: true } },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'assign',
            entityId: id,
            localityId: targetLocalityId,
            diffJson: {
                localityId: targetLocalityId,
                assigneeType,
                assignedToId,
                assignedEloId,
                responsibleIds,
                externalAssigneeName,
            },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async updateTaskLocalities(id, localityIdsRaw, sourceTaskIdsRaw = [], user) {
        const desiredLocalityIds = Array.from(new Set((localityIdsRaw ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (!desiredLocalityIds.length) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityIds',
                reason: 'required',
            });
        }
        const baseInstance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { id: true, specialtyId: true } },
                assignedTo: { select: { id: true, localityId: true } },
                assignedElo: { select: { id: true, localityId: true } },
                responsibles: {
                    include: { user: { select: { id: true, localityId: true } } },
                    orderBy: [{ createdAt: 'asc' }],
                },
                meeting: { select: { id: true, localityId: true } },
            },
        });
        if (!baseInstance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(baseInstance, user);
        const baseSpecialtyId = baseInstance.specialtyId ?? baseInstance.taskTemplate?.specialtyId ?? null;
        for (const localityId of desiredLocalityIds) {
            this.assertConstraints(localityId, baseSpecialtyId, user);
            this.assertCanAssignInLocality(localityId, user);
        }
        const sourceTaskIds = Array.from(new Set([id, ...(sourceTaskIdsRaw ?? [])]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        let sourceInstances = sourceTaskIds.length > 1
            ? await this.prisma.taskInstance.findMany({
                where: { id: { in: sourceTaskIds } },
                include: {
                    taskTemplate: { select: { specialtyId: true } },
                    assignedElo: { select: { id: true, eloRoleId: true } },
                    responsibles: { select: { userId: true } },
                },
            })
            : [];
        if (sourceInstances.length <= 1 && baseInstance.groupKey) {
            sourceInstances = await this.prisma.taskInstance.findMany({
                where: { groupKey: baseInstance.groupKey },
                include: {
                    taskTemplate: { select: { specialtyId: true } },
                    assignedElo: { select: { id: true, eloRoleId: true } },
                    responsibles: { select: { userId: true } },
                },
            });
        }
        if (sourceInstances.length === 0) {
            sourceInstances = [
                {
                    ...baseInstance,
                    taskTemplate: {
                        specialtyId: baseInstance.taskTemplate?.specialtyId ?? null,
                    },
                    assignedElo: baseInstance.assignedElo
                        ? { id: baseInstance.assignedElo.id, eloRoleId: null }
                        : null,
                    responsibles: baseInstance.responsibles.map((entry) => ({
                        userId: entry.userId,
                    })),
                },
            ];
        }
        for (const instance of sourceInstances) {
            this.assertTaskOperateAccess(instance, user);
            if (instance.taskTemplateId !== baseInstance.taskTemplateId) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', {
                    field: 'sourceTaskIds',
                    reason: 'TASK_LOCALITIES_GROUP_MISMATCH',
                });
            }
        }
        const primaryLocalityId = desiredLocalityIds.includes(baseInstance.localityId)
            ? baseInstance.localityId
            : desiredLocalityIds[0];
        const localityRecords = await this.prisma.locality.findMany({
            where: { id: { in: desiredLocalityIds } },
            select: { id: true, commandName: true, commanderName: true },
        });
        if (localityRecords.length !== desiredLocalityIds.length) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        const localityById = new Map(localityRecords.map((locality) => [locality.id, locality]));
        const resolveAssignmentForLocality = (localityId) => {
            const locality = localityById.get(localityId);
            if (!locality)
                (0, http_error_1.throwError)('NOT_FOUND');
            const assignedToId = baseInstance.assignedToId &&
                baseInstance.assignedTo?.localityId === localityId
                ? baseInstance.assignedToId
                : null;
            const assignedEloId = baseInstance.assignedEloId &&
                baseInstance.assignedElo?.localityId === localityId
                ? baseInstance.assignedEloId
                : null;
            const responsibles = (baseInstance.responsibles ?? [])
                .filter((entry) => entry?.user?.localityId === localityId)
                .map((entry) => String(entry.userId ?? '').trim())
                .filter(Boolean);
            if (assignedToId) {
                return {
                    assignedToId,
                    assignedEloId: null,
                    assigneeType: client_1.TaskAssigneeType.USER,
                    externalAssigneeName: null,
                    externalAssigneeRole: null,
                    responsibles,
                    meetingId: !baseInstance.meeting ||
                        !baseInstance.meeting.localityId ||
                        baseInstance.meeting.localityId === localityId
                        ? baseInstance.meetingId
                        : null,
                };
            }
            if (assignedEloId) {
                return {
                    assignedToId: null,
                    assignedEloId,
                    assigneeType: client_1.TaskAssigneeType.ELO,
                    externalAssigneeName: null,
                    externalAssigneeRole: null,
                    responsibles,
                    meetingId: !baseInstance.meeting ||
                        !baseInstance.meeting.localityId ||
                        baseInstance.meeting.localityId === localityId
                        ? baseInstance.meetingId
                        : null,
                };
            }
            if (baseInstance.assigneeType === client_1.TaskAssigneeType.LOCALITY_COMMAND) {
                const name = locality.commandName?.trim() || null;
                return {
                    assignedToId: null,
                    assignedEloId: null,
                    assigneeType: name ? client_1.TaskAssigneeType.LOCALITY_COMMAND : null,
                    externalAssigneeName: name,
                    externalAssigneeRole: name ? 'GSD / Comando' : null,
                    responsibles: [],
                    meetingId: !baseInstance.meeting ||
                        !baseInstance.meeting.localityId ||
                        baseInstance.meeting.localityId === localityId
                        ? baseInstance.meetingId
                        : null,
                };
            }
            if (baseInstance.assigneeType === client_1.TaskAssigneeType.LOCALITY_COMMANDER) {
                const name = locality.commanderName?.trim() || null;
                return {
                    assignedToId: null,
                    assignedEloId: null,
                    assigneeType: name ? client_1.TaskAssigneeType.LOCALITY_COMMANDER : null,
                    externalAssigneeName: name,
                    externalAssigneeRole: name ? 'Comandante' : null,
                    responsibles: [],
                    meetingId: !baseInstance.meeting ||
                        !baseInstance.meeting.localityId ||
                        baseInstance.meeting.localityId === localityId
                        ? baseInstance.meetingId
                        : null,
                };
            }
            return {
                assignedToId: null,
                assignedEloId: null,
                assigneeType: null,
                externalAssigneeName: null,
                externalAssigneeRole: null,
                responsibles: [],
                meetingId: !baseInstance.meeting ||
                    !baseInstance.meeting.localityId ||
                    baseInstance.meeting.localityId === localityId
                    ? baseInstance.meetingId
                    : null,
            };
        };
        const nonPrimarySource = sourceInstances
            .filter((instance) => instance.id !== baseInstance.id)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const reusableByLocality = new Map();
        nonPrimarySource.forEach((instance) => {
            if (!reusableByLocality.has(instance.localityId)) {
                reusableByLocality.set(instance.localityId, instance);
            }
        });
        const keptIds = new Set([baseInstance.id]);
        const keptLocalityIds = new Set([primaryLocalityId]);
        const missingLocalityIds = [];
        const deletedIds = new Set();
        for (const localityId of desiredLocalityIds) {
            if (localityId === primaryLocalityId)
                continue;
            const reusable = reusableByLocality.get(localityId);
            if (reusable) {
                keptIds.add(reusable.id);
                keptLocalityIds.add(localityId);
                reusableByLocality.delete(localityId);
            }
            else {
                missingLocalityIds.push(localityId);
            }
        }
        for (const instance of nonPrimarySource) {
            if (!keptIds.has(instance.id))
                deletedIds.add(instance.id);
        }
        const persisted = await this.prisma.$transaction(async (tx) => {
            const createdIds = [];
            if (baseInstance.localityId !== primaryLocalityId) {
                const assignment = resolveAssignmentForLocality(primaryLocalityId);
                await tx.taskInstance.update({
                    where: { id: baseInstance.id },
                    data: {
                        localityId: primaryLocalityId,
                        meetingId: assignment.meetingId,
                        assignedToId: assignment.assignedToId,
                        assignedEloId: assignment.assignedEloId,
                        assigneeType: assignment.assigneeType,
                        externalAssigneeName: assignment.externalAssigneeName,
                        externalAssigneeRole: assignment.externalAssigneeRole,
                        responsibles: {
                            deleteMany: {},
                            ...(assignment.responsibles.length > 0
                                ? {
                                    create: assignment.responsibles.map((userId) => ({
                                        userId,
                                        assignedById: user?.id ?? null,
                                    })),
                                }
                                : {}),
                        },
                    },
                });
            }
            for (const localityId of missingLocalityIds) {
                const assignment = resolveAssignmentForLocality(localityId);
                const created = await tx.taskInstance.create({
                    data: {
                        taskTemplateId: baseInstance.taskTemplateId,
                        localityId,
                        specialtyId: baseInstance.specialtyId,
                        dueDate: baseInstance.dueDate,
                        status: baseInstance.status,
                        priority: baseInstance.priority,
                        progressPercent: baseInstance.progressPercent,
                        reportRequired: baseInstance.reportRequired,
                        titleOverride: baseInstance.titleOverride,
                        meetingId: assignment.meetingId,
                        assignedToId: assignment.assignedToId,
                        assignedEloId: assignment.assignedEloId,
                        assigneeType: assignment.assigneeType,
                        externalAssigneeName: assignment.externalAssigneeName,
                        externalAssigneeRole: assignment.externalAssigneeRole,
                        groupKey: null,
                        eloRoleId: baseInstance.eloRoleId,
                        responsibles: assignment.responsibles.length > 0
                            ? {
                                create: assignment.responsibles.map((userId) => ({
                                    userId,
                                    assignedById: user?.id ?? null,
                                })),
                            }
                            : undefined,
                    },
                    select: { id: true },
                });
                createdIds.push(created.id);
            }
            const idsToDelete = Array.from(deletedIds);
            if (idsToDelete.length > 0) {
                await tx.taskCommentRead.deleteMany({
                    where: { taskInstanceId: { in: idsToDelete } },
                });
                await tx.taskComment.deleteMany({
                    where: { taskInstanceId: { in: idsToDelete } },
                });
                await tx.taskResponsible.deleteMany({
                    where: { taskInstanceId: { in: idsToDelete } },
                });
                await tx.report.deleteMany({
                    where: { taskInstanceId: { in: idsToDelete } },
                });
                await tx.taskInstance.deleteMany({
                    where: { id: { in: idsToDelete } },
                });
            }
            const finalIds = Array.from(new Set([baseInstance.id, ...Array.from(keptIds), ...createdIds]));
            const nextGroupKey = finalIds.length > 1
                ? String(baseInstance.groupKey ?? '').trim() || (0, node_crypto_1.randomUUID)()
                : null;
            await tx.taskInstance.updateMany({
                where: { id: { in: finalIds } },
                data: { groupKey: nextGroupKey },
            });
            return { finalIds, nextGroupKey };
        });
        const updated = await this.prisma.taskInstance.findMany({
            where: { id: { in: persisted.finalIds } },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            include: {
                locality: { select: { id: true, name: true, code: true } },
                specialty: { select: { id: true, name: true, color: true } },
                taskTemplate: { select: { id: true, title: true, phaseId: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: {
                    include: {
                        eloRole: { select: { id: true, code: true, name: true } },
                    },
                },
                responsibles: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                localityId: true,
                                specialtyId: true,
                                eloRoleId: true,
                            },
                        },
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                meeting: { select: { id: true, datetime: true, scope: true } },
                eloRole: { select: { id: true, code: true, name: true } },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_localities',
            entityId: id,
            localityId: primaryLocalityId,
            diffJson: {
                sourceTaskIds: sourceTaskIds,
                keptTaskIds: Array.from(keptIds),
                deletedTaskIds: Array.from(deletedIds),
                localityIds: desiredLocalityIds,
                groupKey: persisted.nextGroupKey,
            },
        });
        return {
            primaryTaskId: id,
            items: updated.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)),
        };
    }
    async batchAssign(ids, assignedToId, assigneeIds = [], user) {
        const instances = await this.prisma.taskInstance.findMany({
            where: { id: { in: ids } },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
            },
        });
        for (const instance of instances) {
            this.assertCanAssignInTaskScope(instance, user);
        }
        const normalized = Array.from(new Set([assignedToId, ...assigneeIds]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        const users = normalized.length
            ? await this.prisma.user.findMany({
                where: { id: { in: normalized }, isActive: true },
                select: { id: true, localityId: true },
            })
            : [];
        if (users.length !== normalized.length) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        await this.prisma.taskInstance.updateMany({
            where: { id: { in: ids } },
            data: {
                assignedToId,
                assignedEloId: null,
                assigneeType: assignedToId ? client_1.TaskAssigneeType.USER : null,
                externalAssigneeName: null,
                externalAssigneeRole: null,
            },
        });
        for (const instance of instances) {
            const localityResponsibleIds = users
                .filter((candidate) => candidate.localityId === instance.localityId)
                .map((candidate) => candidate.id);
            await this.prisma.taskResponsible.deleteMany({
                where: { taskInstanceId: instance.id },
            });
            if (localityResponsibleIds.length > 0) {
                await this.prisma.taskResponsible.createMany({
                    data: localityResponsibleIds.map((userId) => ({
                        taskInstanceId: instance.id,
                        userId,
                        assignedById: user?.id ?? null,
                    })),
                    skipDuplicates: true,
                });
            }
        }
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'batch_assign',
            diffJson: { count: ids.length, assignedToId, assigneeIds: normalized },
        });
        return { updated: ids.length };
    }
    async batchStatus(ids, status, user) {
        const instances = await this.prisma.taskInstance.findMany({
            where: { id: { in: ids } },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        for (const instance of instances) {
            this.assertTaskOperateAccess(instance, user);
        }
        await this.prisma.taskInstance.updateMany({
            where: { id: { in: ids } },
            data: { status, progressPercent: this.applyProgressRules(status, 100) },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'batch_status',
            diffJson: { count: ids.length, status },
        });
        return { updated: ids.length };
    }
    async batchProgress(ids, progressPercent, user) {
        const instances = await this.prisma.taskInstance.findMany({
            where: { id: { in: ids } },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        for (const instance of instances) {
            this.assertTaskOperateAccess(instance, user);
        }
        await this.prisma.$transaction(instances.map((instance) => this.prisma.taskInstance.update({
            where: { id: instance.id },
            data: {
                progressPercent: this.applyProgressRules(instance.status, progressPercent),
            },
        })));
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'batch_progress',
            diffJson: { count: ids.length, progressPercent },
        });
        return { updated: ids.length };
    }
    async batchDeleteTaskInstances(ids, user) {
        const normalizedIds = Array.from(new Set((ids ?? []).map((value) => String(value ?? '').trim()).filter(Boolean)));
        if (!normalizedIds.length) {
            return { deleted: 0 };
        }
        const existing = await this.prisma.taskInstance.findMany({
            where: { id: { in: normalizedIds } },
            select: {
                id: true,
                localityId: true,
                taskTemplate: { select: { title: true } },
            },
        });
        if (!existing.length) {
            return { deleted: 0 };
        }
        this.assertDeleteAccess(user);
        await this.prisma.$transaction([
            this.prisma.taskCommentRead.deleteMany({
                where: { taskInstanceId: { in: normalizedIds } },
            }),
            this.prisma.taskComment.deleteMany({
                where: { taskInstanceId: { in: normalizedIds } },
            }),
            this.prisma.taskResponsible.deleteMany({
                where: { taskInstanceId: { in: normalizedIds } },
            }),
            this.prisma.report.deleteMany({
                where: { taskInstanceId: { in: normalizedIds } },
            }),
            this.prisma.taskInstance.deleteMany({
                where: { id: { in: normalizedIds } },
            }),
        ]);
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'batch_delete',
            diffJson: {
                count: existing.length,
                ids: existing.map((item) => item.id),
            },
        });
        return { deleted: existing.length };
    }
    async getGantt(params, user) {
        const allowedLocalityIds = await this.getTargetLocalityIds();
        if (allowedLocalityIds.length === 0) {
            return { items: [] };
        }
        const andClauses = [];
        andClauses.push({ localityId: { in: allowedLocalityIds } });
        if (params.localityId)
            andClauses.push({ localityId: params.localityId });
        if (params.from || params.to) {
            const dueDate = {};
            if (params.from)
                dueDate.gte = new Date(params.from);
            if (params.to)
                dueDate.lte = new Date(params.to);
            andClauses.push({ dueDate });
        }
        const accessWhere = this.buildTaskAccessWhere(user, 'view');
        if (Object.keys(accessWhere).length > 0)
            andClauses.push(accessWhere);
        const where = andClauses.length > 0 ? { AND: andClauses } : {};
        const items = await this.prisma.taskInstance.findMany({
            where,
            include: {
                locality: { select: { id: true, name: true, code: true } },
                taskTemplate: {
                    select: {
                        id: true,
                        title: true,
                        phaseId: true,
                        phase: { select: { id: true, name: true, displayName: true } },
                    },
                },
            },
        });
        return {
            items: items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)),
        };
    }
    async getCalendar(year, localityId, user) {
        const allowedLocalityIds = await this.getTargetLocalityIds();
        if (allowedLocalityIds.length === 0) {
            return { items: [] };
        }
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1));
        const andClauses = [
            { dueDate: { gte: start, lt: end } },
            { localityId: { in: allowedLocalityIds } },
        ];
        if (localityId)
            andClauses.push({ localityId });
        const accessWhere = this.buildTaskAccessWhere(user, 'view');
        if (Object.keys(accessWhere).length > 0)
            andClauses.push(accessWhere);
        const where = { AND: andClauses };
        const items = await this.prisma.taskInstance.findMany({
            where,
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            include: { taskTemplate: { include: { phase: true } } },
        });
        const uniqueByCalendarKey = new Map();
        for (const item of items) {
            const groupKey = String(item.groupKey ?? '').trim();
            const calendarKey = groupKey ? `group:${groupKey}` : `task:${item.id}`;
            if (!uniqueByCalendarKey.has(calendarKey)) {
                uniqueByCalendarKey.set(calendarKey, item);
            }
        }
        const dedupedItems = Array.from(uniqueByCalendarKey.values());
        return {
            items: dedupedItems.map((item) => ({
                taskInstanceId: item.id,
                date: item.dueDate,
                title: `[${item.taskTemplate.phase.name}] ${item.taskTemplate.title}`,
            })),
        };
    }
    async getLocalityProgress(localityId, user) {
        this.assertConstraints(localityId, null, user);
        const taskWhere = { localityId };
        const constraints = this.getScopeConstraints(user);
        if (constraints.specialtyId) {
            taskWhere.OR = [
                { specialtyId: null },
                { specialtyId: constraints.specialtyId },
            ];
        }
        const tasks = await this.prisma.taskInstance.findMany({
            where: taskWhere,
            include: { taskTemplate: { include: { phase: true } } },
        });
        const byPhase = new Map();
        for (const task of tasks) {
            const phaseName = task.taskTemplate.phase.name;
            const entry = byPhase.get(phaseName) ?? { total: 0, count: 0 };
            entry.total += task.progressPercent;
            entry.count += 1;
            byPhase.set(phaseName, entry);
        }
        const phaseEntries = Array.from(byPhase.entries()).map(([phaseName, stats]) => ({
            phaseName,
            progress: stats.count === 0 ? 0 : stats.total / stats.count,
        }));
        const overallProgress = phaseEntries.length === 0
            ? 0
            : phaseEntries.reduce((acc, entry) => acc + entry.progress, 0) /
                phaseEntries.length;
        return {
            localityId,
            overallProgress,
            byPhase: phaseEntries,
        };
    }
    async getDashboardNational(user, localityId) {
        const allowedLocalityIds = await this.getTargetLocalityIds();
        if (allowedLocalityIds.length === 0) {
            return {
                items: [],
                totals: {
                    localities: 0,
                    late: 0,
                    blocked: 0,
                    unassigned: 0,
                    recruitsFemale: 0,
                    reportsProduced: 0,
                    smifNewsCount: 0,
                    visitsCompleted: 0,
                },
                lateItems: [],
                unassignedItems: [],
                riskTasks: [],
                executive_hide_pii: user?.executiveHidePii ?? false,
            };
        }
        const where = {};
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId &&
            localityId &&
            constraints.localityId !== localityId) {
            where.id = '__none__';
        }
        else if (constraints.localityId) {
            where.id = constraints.localityId;
        }
        else if (localityId) {
            where.id = localityId;
        }
        const localityWhere = Object.keys(where).length > 0
            ? { AND: [where, { id: { in: allowedLocalityIds } }] }
            : { id: { in: allowedLocalityIds } };
        const rawLocalities = await this.prisma.locality.findMany({
            where: localityWhere,
            select: {
                id: true,
                name: true,
                code: true,
                recruitsFemaleCountCurrent: true,
                commanderName: true,
                individualMeetingDate: true,
                visitDate: true,
                commandName: true,
                notes: true,
                updatedAt: true,
            },
        });
        const localityGroups = (0, priority_localities_1.groupTargetLocalities)(rawLocalities);
        const localities = localityGroups.map((group) => group.canonical);
        const { aliasByLocalityId } = (0, priority_localities_1.createTargetLocalityAliasMap)(localityGroups);
        const localityAliasIds = Array.from(aliasByLocalityId.keys());
        const activityWhereClauses = [];
        if (localityAliasIds.length === 0) {
            activityWhereClauses.push({ localityId: '__none__' });
        }
        else {
            activityWhereClauses.push({ localityId: { in: localityAliasIds } });
        }
        if (constraints.specialtyId) {
            activityWhereClauses.push({
                OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
            });
        }
        const activityWhere = activityWhereClauses.length === 1
            ? activityWhereClauses[0]
            : { AND: activityWhereClauses };
        const activities = await this.prisma.activity.findMany({
            where: activityWhere,
            include: {
                locality: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
                specialty: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                activityType: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                responsibles: {
                    select: {
                        userId: true,
                    },
                },
                report: {
                    select: {
                        id: true,
                        signedAt: true,
                        signatureHash: true,
                    },
                },
            },
        });
        const localityById = new Map(localities.map((locality) => [locality.id, locality]));
        const filteredActivities = activities.filter((activity) => activity.localityId ? aliasByLocalityId.has(activity.localityId) : false);
        const canonicalLocalityIdByActivityId = new Map();
        const activitiesByLocalityId = new Map();
        for (const activity of filteredActivities) {
            const canonicalId = aliasByLocalityId.get(activity.localityId ?? '');
            if (!canonicalId)
                continue;
            canonicalLocalityIdByActivityId.set(activity.id, canonicalId);
            const list = activitiesByLocalityId.get(canonicalId) ?? [];
            list.push(activity);
            activitiesByLocalityId.set(canonicalId, list);
        }
        const now = Date.now();
        const progressWeightByStatus = {
            [client_1.ActivityStatus.NOT_STARTED]: 0,
            [client_1.ActivityStatus.IN_PROGRESS]: 50,
            [client_1.ActivityStatus.DONE]: 100,
            [client_1.ActivityStatus.CANCELLED]: 100,
        };
        const isLateActivity = (activity) => {
            if (!activity.eventDate)
                return false;
            if (activity.status === client_1.ActivityStatus.DONE ||
                activity.status === client_1.ActivityStatus.CANCELLED) {
                return false;
            }
            return activity.eventDate.getTime() < now;
        };
        const hasResponsible = (activity) => Array.isArray(activity.responsibles) &&
            activity.responsibles.some((entry) => Boolean(entry?.userId));
        const hasSignedReport = (activity) => Boolean(activity.report?.signedAt && activity.report?.signatureHash);
        const isVisitActivity = (activity) => {
            const typeName = String(activity.activityType?.name ?? '')
                .trim()
                .toLowerCase();
            if (typeName === 'visita')
                return true;
            const title = String(activity.title ?? '').toLowerCase();
            return /\bvisita\b/.test(title);
        };
        const mapNationalActivityDetail = (activity) => {
            const canonicalId = canonicalLocalityIdByActivityId.get(activity.id) ??
                activity.localityId ??
                '';
            const locality = localityById.get(canonicalId);
            const isLate = isLateActivity(activity);
            return {
                activityId: activity.id,
                title: activity.title ?? 'Atividade',
                localityId: canonicalId,
                localityCode: locality?.code ?? '',
                localityName: locality?.name ?? '',
                specialtyId: activity.specialtyId ?? null,
                specialtyName: activity.specialty?.name ?? '',
                eventDate: activity.eventDate ?? null,
                createdAt: activity.createdAt,
                status: activity.status,
                reportRequired: activity.reportRequired,
                hasSignedReport: hasSignedReport(activity),
                isLate,
                isUnassigned: !hasResponsible(activity),
            };
        };
        const perLocality = localities.map((locality) => {
            const localityActivities = activitiesByLocalityId.get(locality.id) ?? [];
            const visitActivities = localityActivities.filter((activity) => isVisitActivity(activity));
            const latestVisitDate = visitActivities
                .map((activity) => activity.eventDate)
                .filter((value) => value instanceof Date)
                .sort((a, b) => b.getTime() - a.getTime())[0];
            const visitCompleted = visitActivities.some((activity) => activity.status === client_1.ActivityStatus.DONE);
            const late = localityActivities.filter((activity) => isLateActivity(activity)).length;
            const unassigned = localityActivities.filter((activity) => !hasResponsible(activity)).length;
            const progress = localityActivities.length
                ? Math.round(localityActivities.reduce((acc, activity) => acc + progressWeightByStatus[activity.status], 0) / localityActivities.length)
                : 0;
            return {
                localityId: locality.id,
                localityCode: locality.code,
                localityName: locality.name,
                recruitsFemaleCountCurrent: locality.recruitsFemaleCountCurrent ?? 0,
                commanderName: locality.commanderName ?? null,
                individualMeetingDate: locality.individualMeetingDate
                    ? locality.individualMeetingDate.toISOString().slice(0, 10)
                    : null,
                visitDate: latestVisitDate
                    ? latestVisitDate.toISOString().slice(0, 10)
                    : null,
                commandName: locality.commandName ?? null,
                notes: locality.notes ?? null,
                progress,
                late,
                blocked: 0,
                unassigned,
                visitCompleted,
            };
        });
        const totalRecruits = localities.reduce((acc, l) => acc + (l.recruitsFemaleCountCurrent ?? 0), 0);
        const sortByEventDate = (a, b) => {
            const left = (a.eventDate ?? a.createdAt).getTime();
            const right = (b.eventDate ?? b.createdAt).getTime();
            return left - right;
        };
        const lateItems = filteredActivities
            .filter((activity) => isLateActivity(activity))
            .sort(sortByEventDate)
            .map((activity) => mapNationalActivityDetail(activity));
        const unassignedItems = filteredActivities
            .filter((activity) => !hasResponsible(activity))
            .sort(sortByEventDate)
            .map((activity) => mapNationalActivityDetail(activity));
        const isOpenActivity = (activity) => activity.status !== client_1.ActivityStatus.DONE &&
            activity.status !== client_1.ActivityStatus.CANCELLED;
        const riskTasks = filteredActivities
            .filter((activity) => isOpenActivity(activity) &&
            (isLateActivity(activity) || !hasResponsible(activity)))
            .sort(sortByEventDate)
            .slice(0, 10)
            .map((activity) => mapNationalActivityDetail(activity));
        const reportsCount = filteredActivities.filter((activity) => Boolean(activity.report?.id)).length;
        const smifNewsCount = await this.prisma.socialCommunicationArticle.count({
            where: { tags: { has: 'smif' } },
        });
        const visitsCompleted = perLocality.filter((item) => item.visitCompleted).length;
        return {
            items: perLocality,
            totals: {
                localities: perLocality.length,
                late: perLocality.reduce((acc, item) => acc + item.late, 0),
                blocked: perLocality.reduce((acc, item) => acc + item.blocked, 0),
                unassigned: perLocality.reduce((acc, item) => acc + item.unassigned, 0),
                recruitsFemale: totalRecruits,
                reportsProduced: reportsCount,
                smifNewsCount,
                visitsCompleted,
            },
            lateItems,
            unassignedItems,
            riskTasks,
            executive_hide_pii: user?.executiveHidePii ?? false,
        };
    }
    async getDashboardRecruits(user, localityId) {
        const localityWhere = {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        const hasNationalRecruitScope = profile.ti || profile.nationalCommission;
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId &&
            localityId &&
            constraints.localityId !== localityId) {
            localityWhere.id = '__none__';
        }
        else if (!hasNationalRecruitScope && constraints.localityId) {
            localityWhere.id = constraints.localityId;
        }
        else if (localityId) {
            localityWhere.id = localityId;
        }
        const [localitiesRaw, historyRaw, recruitMembersRaw] = await this.prisma.$transaction([
            this.prisma.locality.findMany({
                where: localityWhere,
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    commanderName: true,
                    recruitsFemaleCountCurrent: true,
                    updatedAt: true,
                },
            }),
            this.prisma.recruitsHistory.findMany({
                where: !hasNationalRecruitScope && constraints.localityId
                    ? { localityId: constraints.localityId }
                    : undefined,
                orderBy: { date: 'asc' },
            }),
            this.prisma.recruitFemale.findMany({
                where: !hasNationalRecruitScope && constraints.localityId
                    ? { localityId: constraints.localityId }
                    : undefined,
                select: {
                    id: true,
                    localityId: true,
                    name: true,
                    status: true,
                    dismissalReason: true,
                    dismissedAt: true,
                    destinationLocalityId: true,
                    designatedAt: true,
                    destinationLocality: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
                orderBy: [{ name: 'asc' }],
            }),
        ]);
        const history = historyRaw;
        const localityGroups = (0, priority_localities_1.groupTargetLocalities)(localitiesRaw);
        const localities = localityGroups.map((group) => group.canonical);
        const { aliasByLocalityId } = (0, priority_localities_1.createTargetLocalityAliasMap)(localityGroups);
        const recruitMembers = recruitMembersRaw.filter((item) => aliasByLocalityId.has(item.localityId));
        const filteredHistory = history.filter((entry) => aliasByLocalityId.has(entry.localityId));
        const normalizedHistoryMap = new Map();
        for (const entry of filteredHistory) {
            const canonicalId = aliasByLocalityId.get(entry.localityId);
            if (!canonicalId)
                continue;
            const dateKey = entry.date.toISOString().slice(0, 10);
            const key = `${canonicalId}:${dateKey}`;
            const current = normalizedHistoryMap.get(key);
            const entryCreatedAt = entry.createdAt.toISOString();
            if (!current ||
                entryCreatedAt > current.createdAt ||
                (entryCreatedAt === current.createdAt &&
                    entry.recruitsFemaleCount > current.value)) {
                normalizedHistoryMap.set(key, {
                    localityId: canonicalId,
                    date: dateKey,
                    value: entry.recruitsFemaleCount,
                    turnoverCount: entry.turnoverCount ?? 0,
                    dismissalReason: entry.dismissalReason ?? null,
                    createdAt: entryCreatedAt,
                });
            }
        }
        const normalizedHistory = Array.from(normalizedHistoryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const currentPerLocality = localities.map((loc) => {
            const locMembers = recruitMembers.filter((member) => aliasByLocalityId.get(member.localityId) === loc.id);
            const activeCount = locMembers.filter((member) => member.status === 'RECRUITMENT_TO_START' || member.status === 'RECRUITMENT_STARTED').length;
            return {
                localityId: loc.id,
                localityName: loc.name,
                code: loc.code,
                commanderName: loc.commanderName ?? null,
                recruitsFemaleCountCurrent: activeCount,
                recruitsByStatus: {
                    toStart: locMembers.filter((member) => member.status === 'RECRUITMENT_TO_START').length,
                    started: locMembers.filter((member) => member.status === 'RECRUITMENT_STARTED').length,
                    dismissed: locMembers.filter((member) => member.status === 'DISMISSED').length,
                    assignedToOm: locMembers.filter((member) => member.status === 'ASSIGNED_TO_OM').length,
                },
            };
        });
        const aggregateByMonth = [];
        const monthMap = new Map();
        for (const entry of normalizedHistory) {
            const monthKey = entry.date.slice(0, 7);
            monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + entry.value);
        }
        for (const [month, value] of Array.from(monthMap.entries()).sort()) {
            aggregateByMonth.push({ month, value });
        }
        const byLocalityMap = new Map();
        for (const entry of normalizedHistory) {
            const key = entry.localityId;
            if (!byLocalityMap.has(key))
                byLocalityMap.set(key, []);
            byLocalityMap.get(key).push({
                date: entry.date,
                value: entry.value,
                turnoverCount: entry.turnoverCount,
                dismissalReason: entry.dismissalReason,
            });
        }
        const localityById = new Map(localities.map((l) => [l.id, l]));
        const byLocality = Array.from(byLocalityMap.entries()).map(([localityId, series]) => ({
            localityId,
            localityName: localityById.get(localityId)?.name ?? localityId,
            code: localityById.get(localityId)?.code ?? '',
            series,
        }));
        const historyLog = normalizedHistory
            .map((entry) => ({
            localityId: entry.localityId,
            localityName: localityById.get(entry.localityId)?.name ?? entry.localityId,
            code: localityById.get(entry.localityId)?.code ?? '',
            date: entry.date,
            recruitsFemaleCount: entry.value,
            turnoverCount: entry.turnoverCount,
            dismissalReason: entry.dismissalReason,
        }))
            .sort((a, b) => b.date.localeCompare(a.date));
        const dismissedRecruitsLog = recruitMembers
            .filter((member) => member.status === 'DISMISSED')
            .map((member) => {
            const canonicalId = aliasByLocalityId.get(member.localityId);
            return {
                recruitId: member.id,
                recruitName: member.name,
                localityId: canonicalId ?? member.localityId,
                localityName: localityById.get(canonicalId ?? member.localityId)?.name ??
                    member.localityId,
                code: localityById.get(canonicalId ?? member.localityId)?.code ?? '',
                dismissalReason: member.dismissalReason ?? null,
                dismissedAt: member.dismissedAt?.toISOString() ?? null,
            };
        })
            .sort((a, b) => String(b.dismissedAt ?? '').localeCompare(String(a.dismissedAt ?? '')));
        return {
            currentPerLocality,
            aggregateByMonth,
            byLocality,
            historyLog,
            dismissedRecruitsLog,
        };
    }
    async getDashboardExecutive(params, user) {
        const emptyResponse = {
            summary: {
                totalActivities: 0,
                completedActivities: 0,
                completionPercent: 0,
                lateActivities: 0,
                unassignedActivities: 0,
                reportPending: 0,
                reportApproved: 0,
                reportTotal: 0,
            },
            status: {
                items: [],
            },
            progress: {
                overall: 0,
                byLocality: [],
            },
            localityAboveThreshold: {
                threshold: 0,
                count: 0,
                total: 0,
                items: [],
            },
            specialties: {
                items: [],
            },
            late: {
                total: 0,
                trend: [],
                items: [],
            },
            unassigned: {
                total: 0,
                byLocality: [],
                items: [],
            },
            reportsCompliance: {
                approved: 0,
                pending: 0,
                total: 0,
                pendingItems: [],
            },
            risk: {
                top10: [],
            },
        };
        const allowedLocalityIds = await this.getTargetLocalityIds();
        if (allowedLocalityIds.length === 0) {
            return user?.executiveHidePii
                ? (0, executive_1.sanitizeForExecutive)(emptyResponse)
                : emptyResponse;
        }
        const from = params.from
            ? new Date(params.from)
            : new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
        const to = params.to ? new Date(params.to) : new Date();
        const thresholdRaw = Number(params.threshold ?? 70);
        const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 70;
        const localityWhere = {
            id: { in: allowedLocalityIds },
        };
        if (params.command) {
            localityWhere.commandName = params.command;
        }
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId &&
            params.localityId &&
            constraints.localityId !== params.localityId) {
            localityWhere.id = '__none__';
        }
        else if (constraints.localityId) {
            localityWhere.id = constraints.localityId;
        }
        else if (params.localityId) {
            localityWhere.id = params.localityId;
        }
        const localitiesRaw = await this.prisma.locality.findMany({
            where: localityWhere,
            orderBy: { name: 'asc' },
        });
        const localityGroups = (0, priority_localities_1.groupTargetLocalities)(localitiesRaw);
        const localities = localityGroups.map((group) => group.canonical);
        const { aliasByLocalityId } = (0, priority_localities_1.createTargetLocalityAliasMap)(localityGroups);
        const localityIds = Array.from(aliasByLocalityId.keys());
        if (!localityIds.length) {
            return user?.executiveHidePii
                ? (0, executive_1.sanitizeForExecutive)(emptyResponse)
                : emptyResponse;
        }
        const activities = await this.prisma.activity.findMany({
            where: {
                localityId: { in: localityIds },
                OR: [
                    { eventDate: { gte: from, lte: to } },
                    { eventDate: null, createdAt: { gte: from, lte: to } },
                ],
            },
            include: {
                locality: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        commandName: true,
                    },
                },
                specialty: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                responsibles: {
                    select: {
                        userId: true,
                    },
                },
                report: {
                    select: {
                        id: true,
                        signedAt: true,
                        signatureHash: true,
                    },
                },
            },
            orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
        });
        const filteredActivities = activities.filter((activity) => activity.localityId ? aliasByLocalityId.has(activity.localityId) : false);
        const statusOrder = [
            client_1.ActivityStatus.NOT_STARTED,
            client_1.ActivityStatus.IN_PROGRESS,
            client_1.ActivityStatus.DONE,
            client_1.ActivityStatus.CANCELLED,
        ];
        const progressWeightByStatus = {
            [client_1.ActivityStatus.NOT_STARTED]: 0,
            [client_1.ActivityStatus.IN_PROGRESS]: 50,
            [client_1.ActivityStatus.DONE]: 100,
            [client_1.ActivityStatus.CANCELLED]: 100,
        };
        const localityById = new Map(localities.map((locality) => [locality.id, locality]));
        const canonicalLocalityIdByActivityId = new Map();
        const activitiesByLocalityId = new Map();
        for (const activity of filteredActivities) {
            const canonicalId = aliasByLocalityId.get(activity.localityId ?? '');
            if (!canonicalId)
                continue;
            canonicalLocalityIdByActivityId.set(activity.id, canonicalId);
            const list = activitiesByLocalityId.get(canonicalId) ?? [];
            list.push(activity);
            activitiesByLocalityId.set(canonicalId, list);
        }
        const dayMs = 1000 * 60 * 60 * 24;
        const now = Date.now();
        const isLate = (activity) => {
            if (!activity.eventDate)
                return false;
            if (activity.status === client_1.ActivityStatus.DONE ||
                activity.status === client_1.ActivityStatus.CANCELLED) {
                return false;
            }
            return activity.eventDate.getTime() < now;
        };
        const hasResponsible = (activity) => Array.isArray(activity.responsibles) &&
            activity.responsibles.some((entry) => Boolean(entry?.userId));
        const hasSignedReport = (activity) => Boolean(activity.report?.signedAt && activity.report?.signatureHash);
        const mapExecutiveActivityItem = (activity) => {
            const canonicalId = canonicalLocalityIdByActivityId.get(activity.id) ??
                activity.localityId ??
                '';
            const locality = localityById.get(canonicalId);
            const late = isLate(activity);
            return {
                activityId: activity.id,
                title: activity.title ?? 'Atividade',
                specialtyId: activity.specialtyId ?? null,
                specialtyName: activity.specialty?.name ?? '',
                localityId: canonicalId,
                localityCode: locality?.code ?? '',
                localityName: locality?.name ?? '',
                commandName: locality?.commandName ?? '',
                eventDate: activity.eventDate,
                createdAt: activity.createdAt,
                status: activity.status,
                reportRequired: activity.reportRequired,
                hasSignedReport: hasSignedReport(activity),
                isLate: late,
                daysLate: late
                    ? Math.max(1, Math.ceil((now - (activity.eventDate?.getTime() ?? now)) / dayMs))
                    : 0,
                isUnassigned: !hasResponsible(activity),
            };
        };
        const activityItems = filteredActivities.map((activity) => mapExecutiveActivityItem(activity));
        const totalActivities = activityItems.length;
        const completedActivities = activityItems.filter((activity) => activity.status === client_1.ActivityStatus.DONE ||
            activity.status === client_1.ActivityStatus.CANCELLED).length;
        const completionPercent = totalActivities
            ? Math.round((completedActivities / totalActivities) * 100)
            : 0;
        const overallProgress = totalActivities
            ? Math.round(activityItems.reduce((acc, activity) => acc + progressWeightByStatus[activity.status], 0) / totalActivities)
            : 0;
        const progressByLocality = localities
            .map((locality) => {
            const localityActivities = activitiesByLocalityId.get(locality.id) ?? [];
            const done = localityActivities.filter((activity) => activity.status === client_1.ActivityStatus.DONE ||
                activity.status === client_1.ActivityStatus.CANCELLED).length;
            const late = localityActivities.filter((activity) => isLate(activity)).length;
            const unassigned = localityActivities.filter((activity) => !hasResponsible(activity)).length;
            const reportPending = localityActivities.filter((activity) => activity.reportRequired &&
                activity.status === client_1.ActivityStatus.DONE &&
                !hasSignedReport(activity)).length;
            const avg = localityActivities.length
                ? localityActivities.reduce((acc, activity) => acc + progressWeightByStatus[activity.status], 0) / localityActivities.length
                : 0;
            return {
                localityId: locality.id,
                localityCode: locality.code,
                localityName: locality.name,
                commandName: locality.commandName ?? '',
                progress: Math.round(avg),
                activitiesCount: localityActivities.length,
                done,
                late,
                unassigned,
                reportPending,
            };
        })
            .sort((a, b) => b.progress - a.progress);
        const localitiesAboveThreshold = progressByLocality.filter((entry) => entry.progress >= threshold);
        const lateActivities = filteredActivities.filter((activity) => isLate(activity));
        const lateItems = lateActivities
            .slice()
            .sort((a, b) => {
            const left = a.eventDate?.getTime() ?? 0;
            const right = b.eventDate?.getTime() ?? 0;
            return left - right;
        })
            .map((activity) => mapExecutiveActivityItem(activity));
        const weeklyTrend = [];
        for (let i = 7; i >= 0; i -= 1) {
            const start = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
            const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
            const weekItems = filteredActivities.filter((activity) => activity.eventDate &&
                activity.eventDate >= start &&
                activity.eventDate < end &&
                isLate(activity));
            const byLocality = new Map();
            for (const activity of weekItems) {
                const canonicalId = canonicalLocalityIdByActivityId.get(activity.id) ??
                    activity.localityId ??
                    '';
                const locality = localityById.get(canonicalId);
                const key = locality?.id ?? canonicalId;
                const current = byLocality.get(key);
                if (current) {
                    current.count += 1;
                    continue;
                }
                byLocality.set(key, {
                    localityId: key,
                    localityCode: locality?.code ?? '',
                    localityName: locality?.name ?? '',
                    count: 1,
                });
            }
            weeklyTrend.push({
                week: start.toISOString().slice(0, 10),
                late: weekItems.length,
                localities: Array.from(byLocality.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 6),
            });
        }
        const unassigned = filteredActivities.filter((activity) => !hasResponsible(activity));
        const unassignedItems = unassigned
            .slice()
            .sort((a, b) => {
            const left = a.eventDate?.getTime() ?? 0;
            const right = b.eventDate?.getTime() ?? 0;
            return left - right;
        })
            .map((activity) => mapExecutiveActivityItem(activity));
        const unassignedByLocality = new Map();
        for (const activity of unassigned) {
            const canonicalId = canonicalLocalityIdByActivityId.get(activity.id) ??
                activity.localityId ??
                '';
            const locality = localityById.get(canonicalId);
            const localityKey = locality?.id ?? canonicalId;
            const current = unassignedByLocality.get(localityKey);
            if (current) {
                current.count += 1;
            }
            else {
                unassignedByLocality.set(localityKey, {
                    localityId: localityKey,
                    localityCode: locality?.code ?? '',
                    localityName: locality?.name ?? '',
                    commandName: locality?.commandName ?? 'Sem comando',
                    count: 1,
                });
            }
        }
        const reportRequiredActivities = filteredActivities.filter((activity) => activity.reportRequired && activity.status === client_1.ActivityStatus.DONE);
        const complianceApproved = reportRequiredActivities.filter((activity) => hasSignedReport(activity)).length;
        const compliancePending = reportRequiredActivities.length - complianceApproved;
        const reportPendingItems = reportRequiredActivities
            .filter((activity) => !hasSignedReport(activity))
            .map((activity) => mapExecutiveActivityItem(activity));
        const specialtiesMap = new Map();
        for (const activity of filteredActivities) {
            const specialtyId = activity.specialtyId ?? null;
            const specialtyName = activity.specialty?.name ?? 'Todas';
            const key = specialtyId ?? '__none__';
            const current = specialtiesMap.get(key);
            if (current) {
                current.count += 1;
            }
            else {
                specialtiesMap.set(key, { specialtyId, specialtyName, count: 1 });
            }
        }
        const riskScores = localities.map((locality) => {
            const localityActivities = activitiesByLocalityId.get(locality.id) ?? [];
            const late = localityActivities.filter((activity) => isLate(activity)).length;
            const unassignedCount = localityActivities.filter((activity) => !hasResponsible(activity)).length;
            const reportPending = localityActivities.filter((activity) => activity.reportRequired &&
                activity.status === client_1.ActivityStatus.DONE &&
                !hasSignedReport(activity)).length;
            const score = late * 2 + unassignedCount + reportPending * 2;
            return {
                localityId: locality.id,
                localityCode: locality.code,
                commandName: locality.commandName ?? '',
                score,
                breakdown: {
                    late,
                    unassigned: unassignedCount,
                    reportPending,
                },
            };
        });
        const statusItems = statusOrder.map((status) => ({
            status,
            count: activityItems.filter((item) => item.status === status).length,
        }));
        const response = {
            summary: {
                totalActivities,
                completedActivities,
                completionPercent,
                lateActivities: lateItems.length,
                unassignedActivities: unassignedItems.length,
                reportPending: compliancePending,
                reportApproved: complianceApproved,
                reportTotal: reportRequiredActivities.length,
            },
            status: {
                items: statusItems,
            },
            progress: {
                overall: overallProgress,
                byLocality: progressByLocality,
            },
            localityAboveThreshold: {
                threshold,
                count: localitiesAboveThreshold.length,
                total: progressByLocality.length,
                items: localitiesAboveThreshold.sort((a, b) => b.progress - a.progress),
            },
            specialties: {
                items: Array.from(specialtiesMap.values()).sort((a, b) => b.count - a.count),
            },
            late: {
                total: lateItems.length,
                trend: weeklyTrend,
                items: lateItems,
            },
            unassigned: {
                total: unassigned.length,
                byLocality: Array.from(unassignedByLocality.values()).sort((a, b) => b.count - a.count),
                items: unassignedItems,
            },
            reportsCompliance: {
                approved: complianceApproved,
                pending: compliancePending,
                total: reportRequiredActivities.length,
                pendingItems: reportPendingItems,
            },
            risk: {
                top10: riskScores.sort((a, b) => b.score - a.score).slice(0, 10),
            },
        };
        return user?.executiveHidePii ? (0, executive_1.sanitizeForExecutive)(response) : response;
    }
    applyProgressRules(status, progressPercent) {
        if (status === client_1.TaskStatus.NOT_STARTED)
            return 0;
        if (status === client_1.TaskStatus.DONE)
            return 100;
        if (progressPercent >= 100)
            return 99;
        if (progressPercent < 0)
            return 0;
        return progressPercent;
    }
    isLate(instance) {
        return (instance.status !== client_1.TaskStatus.DONE &&
            instance.dueDate.getTime() < Date.now());
    }
    isBlocked(blockedByIds, statusById) {
        if (!Array.isArray(blockedByIds) || blockedByIds.length === 0)
            return false;
        if (!statusById)
            return true;
        return blockedByIds.some((id) => statusById.get(id) !== client_1.TaskStatus.DONE);
    }
    isTaskUnassigned(task) {
        const hasResponsibleUsers = Array.isArray(task.responsibles) &&
            task.responsibles.some((entry) => Boolean(entry?.userId));
        return (!task.assignedToId &&
            !task.assignedEloId &&
            !task.externalAssigneeName &&
            !hasResponsibleUsers);
    }
    normalizeAssigneeSelection(payload) {
        if (payload.assigneeType) {
            if (payload.assigneeType === 'USER' || payload.assigneeType === 'ELO') {
                return {
                    type: payload.assigneeType,
                    id: payload.assigneeId?.trim() || null,
                };
            }
            return { type: payload.assigneeType, id: null };
        }
        if (payload.assignedToId !== undefined) {
            const legacyId = payload.assignedToId?.trim() || null;
            if (!legacyId)
                return { type: null, id: null };
            return { type: client_1.TaskAssigneeType.USER, id: legacyId };
        }
        return { type: null, id: null };
    }
    async attachTaskCommentSummary(items, user) {
        if (!Array.isArray(items) || items.length === 0)
            return items;
        const ids = items.map((item) => item.id);
        const [comments, reads] = await this.prisma.$transaction([
            this.prisma.taskComment.findMany({
                where: { taskInstanceId: { in: ids } },
                select: { taskInstanceId: true, authorId: true, createdAt: true },
            }),
            user?.id
                ? this.prisma.taskCommentRead.findMany({
                    where: { taskInstanceId: { in: ids }, userId: user.id },
                    select: { taskInstanceId: true, seenAt: true },
                })
                : this.prisma.taskCommentRead.findMany({
                    where: { taskInstanceId: { in: [] } },
                    select: { taskInstanceId: true, seenAt: true },
                }),
        ]);
        const seenAtByTask = new Map();
        for (const read of reads)
            seenAtByTask.set(read.taskInstanceId, read.seenAt);
        const summaryByTask = new Map();
        for (const id of ids) {
            summaryByTask.set(id, { total: 0, unread: 0, lastCommentAt: null });
        }
        for (const comment of comments) {
            const current = summaryByTask.get(comment.taskInstanceId) ?? {
                total: 0,
                unread: 0,
                lastCommentAt: null,
            };
            current.total += 1;
            if (!current.lastCommentAt || comment.createdAt > current.lastCommentAt) {
                current.lastCommentAt = comment.createdAt;
            }
            if (user?.id && comment.authorId !== user.id) {
                const seenAt = seenAtByTask.get(comment.taskInstanceId);
                if (!seenAt || comment.createdAt > seenAt) {
                    current.unread += 1;
                }
            }
            summaryByTask.set(comment.taskInstanceId, current);
        }
        return items.map((item) => {
            const summary = summaryByTask.get(item.id) ?? {
                total: 0,
                unread: 0,
                lastCommentAt: null,
            };
            return {
                ...item,
                comments: {
                    total: summary.total,
                    unread: summary.unread,
                    hasUnread: summary.unread > 0,
                    lastCommentAt: summary.lastCommentAt,
                },
            };
        });
    }
    async resolveManualTaskTemplate(phaseId) {
        const existing = await this.prisma.taskTemplate.findFirst({
            where: {
                title: this.manualTaskTemplateTitle,
                description: this.manualTaskTemplateDescription,
                phaseId,
                specialtyId: null,
                eloRoleId: null,
            },
            select: { id: true },
        });
        if (existing)
            return existing;
        return this.prisma.taskTemplate.create({
            data: {
                title: this.manualTaskTemplateTitle,
                description: this.manualTaskTemplateDescription,
                phase: { connect: { id: phaseId } },
                appliesToAllLocalities: false,
                reportRequiredDefault: false,
            },
            select: { id: true },
        });
    }
    mapTaskInstance(instance, executiveHidePii) {
        const assignee = this.resolveAssignee(instance);
        const responsibleUsers = Array.isArray(instance.responsibles)
            ? instance.responsibles
                .map((entry) => entry?.user)
                .filter(Boolean)
                .map((user) => ({
                id: user.id,
                name: user.name ??
                    user.email ??
                    `Usuário ${String(user.id).slice(0, 8)}`,
                email: user.email ?? null,
            }))
            : [];
        const mapped = {
            ...instance,
            title: instance.title ??
                instance.titleOverride ??
                instance.taskTemplate?.title ??
                null,
            localityName: instance.localityName ?? instance.locality?.name ?? null,
            localityCode: instance.localityCode ?? instance.locality?.code ?? null,
            specialtyId: instance.specialtyId ?? instance.taskTemplate?.specialtyId ?? null,
            specialtyName: instance.specialty?.name ??
                instance.taskTemplate?.specialty?.name ??
                null,
            isLate: this.isLate(instance),
            blockedByIds: instance.blockedByIdsJson ?? null,
            hasAssignee: !this.isTaskUnassigned(instance),
            responsibleUsers: executiveHidePii ? [] : responsibleUsers,
            assignee: executiveHidePii ? null : assignee,
            assigneeLabel: executiveHidePii ? null : (assignee?.label ?? null),
        };
        delete mapped.blockedByIdsJson;
        delete mapped.responsibles;
        if (executiveHidePii) {
            delete mapped.assignedTo;
            delete mapped.assignedToId;
            delete mapped.assignedElo;
            delete mapped.assignedEloId;
            delete mapped.externalAssigneeName;
            delete mapped.externalAssigneeRole;
        }
        return mapped;
    }
    mapTaskComment(comment, executiveHidePii) {
        return {
            id: comment.id,
            taskInstanceId: comment.taskInstanceId,
            text: comment.text,
            createdAt: comment.createdAt,
            author: executiveHidePii
                ? null
                : comment.author
                    ? {
                        id: comment.author.id,
                        name: comment.author.name ?? comment.author.email ?? 'Usuário',
                    }
                    : null,
            authorName: executiveHidePii
                ? 'Usuário interno'
                : (comment.author?.name ?? comment.author?.email ?? 'Usuário'),
        };
    }
    sanitizeCommentText(input) {
        return String(input ?? '')
            .replace(/[<>]/g, '')
            .replace(/\r\n/g, '\n')
            .trim();
    }
    resolveAssignee(instance) {
        const responsibleUsers = Array.isArray(instance.responsibles)
            ? instance.responsibles.map((entry) => entry?.user).filter(Boolean)
            : [];
        if (responsibleUsers.length > 1) {
            const labels = responsibleUsers.map((user) => user.name || user.email || `Usuário ${String(user.id).slice(0, 8)}`);
            return {
                type: 'USERS',
                id: null,
                name: labels.join(', '),
                label: labels.join(', '),
            };
        }
        if (responsibleUsers.length === 1) {
            const responsible = responsibleUsers[0];
            const name = responsible.name ||
                responsible.email ||
                `Usuário ${String(responsible.id).slice(0, 8)}`;
            return {
                type: client_1.TaskAssigneeType.USER,
                id: responsible.id,
                name,
                label: name,
            };
        }
        if (instance.assignedTo) {
            const name = instance.assignedTo.name ||
                instance.assignedTo.email ||
                `Usuário ${String(instance.assignedTo.id).slice(0, 8)}`;
            return {
                type: client_1.TaskAssigneeType.USER,
                id: instance.assignedTo.id,
                name,
                label: name,
            };
        }
        if (instance.assignedElo) {
            const role = instance.assignedElo.eloRole?.name ??
                instance.assignedElo.eloRole?.code ??
                'Elo';
            const name = instance.assignedElo.name || 'Elo';
            return {
                type: client_1.TaskAssigneeType.ELO,
                id: instance.assignedElo.id,
                name,
                label: `${role}: ${name}`,
            };
        }
        if (instance.externalAssigneeName) {
            const role = instance.externalAssigneeRole?.trim();
            const name = String(instance.externalAssigneeName);
            return {
                type: instance.assigneeType ?? 'EXTERNAL',
                id: null,
                name,
                label: role ? `${role}: ${name}` : name,
            };
        }
        return null;
    }
    mapPhase(phase) {
        const fallback = this.phaseLabelByCode[phase.name] ?? phase.name;
        const display = phase.displayName?.trim();
        return {
            ...phase,
            code: phase.name,
            defaultName: fallback,
            name: display || fallback,
            displayName: display || null,
        };
    }
    getScopeConstraints(user) {
        if (!user)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return {};
        if (profile.localityAdmin) {
            return {
                localityId: user.localityId ?? undefined,
                specialtyId: undefined,
            };
        }
        if (profile.specialtyAdmin) {
            return {
                localityId: user.localityId ?? undefined,
                specialtyId: user.specialtyId ?? undefined,
            };
        }
        return {
            localityId: user.localityId ?? undefined,
            specialtyId: user.specialtyId ?? undefined,
        };
    }
    assertConstraints(localityId, specialtyId, user) {
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId && constraints.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (constraints.specialtyId &&
            specialtyId &&
            constraints.specialtyId !== specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    buildTaskAccessWhere(user, mode) {
        if (!user?.id)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (mode === 'operate') {
            if (profile.ti || profile.nationalCommission)
                return {};
            return { id: '__forbidden__' };
        }
        if (mode === 'assign') {
            if (profile.ti || profile.nationalCommission)
                return {};
            if (profile.localityAdmin && profile.localityId) {
                return { localityId: profile.localityId };
            }
            if (profile.specialtyAdmin) {
                const and = [];
                if (profile.localityId)
                    and.push({ localityId: profile.localityId });
                const groupOr = [];
                if (profile.groupSpecialtyId) {
                    groupOr.push({
                        OR: [
                            { specialtyId: null },
                            { specialtyId: profile.groupSpecialtyId },
                        ],
                    });
                }
                if (profile.groupEloRoleId) {
                    groupOr.push({ eloRoleId: profile.groupEloRoleId });
                    groupOr.push({ assignedElo: { eloRoleId: profile.groupEloRoleId } });
                }
                if (groupOr.length > 0)
                    and.push({ OR: groupOr });
                if (and.length === 0)
                    return { id: '__forbidden__' };
                return and.length === 1 ? and[0] : { AND: and };
            }
            return { id: '__forbidden__' };
        }
        if (profile.ti || profile.nationalCommission)
            return {};
        if (profile.localityAdmin && profile.localityId) {
            return { localityId: profile.localityId };
        }
        if (profile.specialtyAdmin) {
            const and = [];
            if (profile.localityId)
                and.push({ localityId: profile.localityId });
            const groupOr = [];
            if (profile.groupSpecialtyId) {
                groupOr.push({
                    OR: [
                        { specialtyId: null },
                        { specialtyId: profile.groupSpecialtyId },
                    ],
                });
            }
            if (profile.groupEloRoleId) {
                groupOr.push({ eloRoleId: profile.groupEloRoleId });
                groupOr.push({ assignedElo: { eloRoleId: profile.groupEloRoleId } });
            }
            if (groupOr.length > 0)
                and.push({ OR: groupOr });
            if (and.length === 0)
                return { id: '__forbidden__' };
            return and.length === 1 ? and[0] : { AND: and };
        }
        const viewerOr = [
            { assignedToId: user.id },
            { responsibles: { some: { userId: user.id } } },
        ];
        if (user.localityId) {
            const groupOr = [];
            if (user.specialtyId) {
                groupOr.push({
                    OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }],
                });
            }
            if (user.eloRoleId) {
                groupOr.push({ eloRoleId: user.eloRoleId });
                groupOr.push({ assignedElo: { eloRoleId: user.eloRoleId } });
            }
            if (groupOr.length > 0) {
                viewerOr.push({
                    localityId: user.localityId,
                    OR: groupOr,
                });
            }
        }
        return { OR: viewerOr };
    }
    isTaskResponsibleUser(instance, user) {
        if (!user?.id)
            return false;
        if (instance?.assignedToId === user.id)
            return true;
        if (Array.isArray(instance?.responsibles)) {
            return instance.responsibles.some((entry) => (entry?.userId ?? entry?.user?.id) === user.id);
        }
        return false;
    }
    matchesTaskSpecialty(instance, specialtyId) {
        if (!specialtyId)
            return false;
        const taskSpecialtyId = instance?.specialtyId ?? instance?.taskTemplate?.specialtyId ?? null;
        return !taskSpecialtyId || taskSpecialtyId === specialtyId;
    }
    assertTaskViewAccess(instance, user) {
        if (!user?.id)
            return;
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        if (profile.localityAdmin) {
            if (!profile.localityId || instance.localityId === profile.localityId)
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const specialtyMatch = this.matchesTaskSpecialty(instance, profile.groupSpecialtyId);
        const eloRoleMatch = profile.groupEloRoleId
            ? instance.eloRoleId === profile.groupEloRoleId ||
                instance.assignedElo?.eloRoleId === profile.groupEloRoleId
            : false;
        if (profile.specialtyAdmin) {
            if (profile.localityId && instance.localityId !== profile.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            if (specialtyMatch || eloRoleMatch)
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (this.isTaskResponsibleUser(instance, user))
            return;
        if (user.localityId &&
            instance.localityId === user.localityId &&
            (specialtyMatch || eloRoleMatch))
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertTaskOperateAccess(_instance, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertCanAssignInLocality(_localityId, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertCanAssignInTaskScope(_instance, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertDeleteAccess(user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertTemplateManageAccess(user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    async resolveTaskResponsibleIds(localityId, input, user) {
        const explicitIds = Array.from(new Set((input.assigneeIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (input.assignedToId && !explicitIds.includes(input.assignedToId)) {
            explicitIds.push(input.assignedToId);
        }
        if (input.selectionType && input.selectionType !== client_1.TaskAssigneeType.USER) {
            return [];
        }
        if (explicitIds.length === 0)
            return [];
        const users = await this.prisma.user.findMany({
            where: { id: { in: explicitIds }, isActive: true },
            select: { id: true, localityId: true },
        });
        if (users.length !== explicitIds.length) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'TASK_RESPONSIBLE_INVALID' });
        }
        const mismatched = users.some((candidate) => candidate.localityId !== localityId);
        if (mismatched) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'TASK_RESPONSIBLE_LOCALITY_MISMATCH',
            });
        }
        this.assertCanAssignInLocality(localityId, user);
        return users.map((candidate) => candidate.id);
    }
    async updateTaskMeeting(id, meetingId, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { meetingId },
            include: {
                meeting: { select: { id: true, datetime: true, scope: true } },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_meeting',
            entityId: id,
            localityId: instance.localityId,
            diffJson: { meetingId },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async updateTaskEloRole(id, eloRoleId, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { eloRoleId },
            include: { eloRole: { select: { id: true, code: true, name: true } } },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_elo_role',
            entityId: id,
            localityId: instance.localityId,
            diffJson: { eloRoleId },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async updateTaskSpecialty(id, specialtyId, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
        this.assertConstraints(instance.localityId, specialtyId, user);
        if (specialtyId) {
            const existing = await this.prisma.specialty.findUnique({
                where: { id: specialtyId },
                select: { id: true },
            });
            if (!existing)
                (0, http_error_1.throwError)('NOT_FOUND');
        }
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { specialtyId },
            include: { specialty: { select: { id: true, name: true, color: true } } },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'update_specialty',
            entityId: id,
            localityId: instance.localityId,
            diffJson: { specialtyId },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async deleteTaskInstance(id, user) {
        const existing = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: {
                taskTemplate: { select: { title: true } },
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertDeleteAccess(user);
        await this.prisma.$transaction([
            this.prisma.taskCommentRead.deleteMany({ where: { taskInstanceId: id } }),
            this.prisma.taskComment.deleteMany({ where: { taskInstanceId: id } }),
            this.prisma.taskResponsible.deleteMany({ where: { taskInstanceId: id } }),
            this.prisma.report.deleteMany({ where: { taskInstanceId: id } }),
            this.prisma.taskInstance.delete({ where: { id } }),
        ]);
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'delete',
            entityId: id,
            localityId: existing.localityId,
            diffJson: {
                title: existing.taskTemplate?.title ?? null,
                localityId: existing.localityId,
            },
        });
        return { ok: true };
    }
    async hasBlockingDependencies(blockedByIds) {
        if (!Array.isArray(blockedByIds) || blockedByIds.length === 0)
            return false;
        const blockers = await this.prisma.taskInstance.findMany({
            where: { id: { in: blockedByIds } },
            select: { status: true },
        });
        return blockers.some((blocker) => blocker.status !== client_1.TaskStatus.DONE);
    }
    buildTaskWhere(filters, user) {
        const andClauses = [];
        if (Array.isArray(filters.allowedLocalityIds)) {
            if (filters.allowedLocalityIds.length === 0) {
                andClauses.push({ localityId: '__none__' });
            }
            else {
                andClauses.push({ localityId: { in: filters.allowedLocalityIds } });
            }
        }
        if (filters.localityId)
            andClauses.push({ localityId: filters.localityId });
        if (filters.eloRoleId)
            andClauses.push({ eloRoleId: filters.eloRoleId });
        if (filters.specialtyId)
            andClauses.push({ specialtyId: filters.specialtyId });
        if (filters.status)
            andClauses.push({ status: filters.status });
        const assigneeIds = (filters.assigneeIds ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        if (assigneeIds.length > 0) {
            andClauses.push({
                OR: [
                    { assignedToId: { in: assigneeIds } },
                    { responsibles: { some: { userId: { in: assigneeIds } } } },
                ],
            });
        }
        else if (filters.assigneeId) {
            andClauses.push({
                OR: [
                    { assignedToId: filters.assigneeId },
                    { responsibles: { some: { userId: filters.assigneeId } } },
                ],
            });
        }
        if (filters.dueFrom || filters.dueTo) {
            const dueDate = {};
            if (filters.dueFrom)
                dueDate.gte = new Date(filters.dueFrom);
            if (filters.dueTo)
                dueDate.lte = new Date(filters.dueTo);
            andClauses.push({ dueDate });
        }
        if (filters.phaseId) {
            andClauses.push({ taskTemplate: { phaseId: filters.phaseId } });
        }
        const accessWhere = this.buildTaskAccessWhere(user, 'view');
        if (Object.keys(accessWhere).length > 0) {
            andClauses.push(accessWhere);
        }
        const where = andClauses.length > 0 ? { AND: andClauses } : {};
        return { where };
    }
    async listTaskInstancesForExport(filters, user) {
        const allowedLocalityIds = await this.getTargetLocalityIds();
        if (allowedLocalityIds.length === 0)
            return [];
        const { where } = this.buildTaskWhere({ ...filters, allowedLocalityIds }, user);
        const items = await this.prisma.taskInstance.findMany({
            where,
            include: {
                taskTemplate: {
                    include: { phase: true, specialty: true, eloRole: true },
                },
                locality: true,
                specialty: { select: { id: true, name: true, color: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: {
                    include: {
                        eloRole: { select: { id: true, code: true, name: true } },
                    },
                },
                responsibles: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                localityId: true,
                                specialtyId: true,
                                eloRoleId: true,
                            },
                        },
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                meeting: { select: { id: true, datetime: true, scope: true } },
                eloRole: { select: { id: true, code: true, name: true } },
            },
            orderBy: { dueDate: 'asc' },
        });
        return items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii));
    }
    parsePagination(pageRaw, pageSizeRaw) {
        const page = Math.max(1, Number(pageRaw ?? 1) || 1);
        const pageSize = Math.min(100, Math.max(10, Number(pageSizeRaw ?? 20) || 20));
        const skip = (page - 1) * pageSize;
        return { page, pageSize, skip, take: pageSize };
    }
    async getTargetLocalityIds() {
        const localities = await this.prisma.locality.findMany({
            select: {
                id: true,
                name: true,
                recruitsFemaleCountCurrent: true,
                updatedAt: true,
            },
        });
        return (0, priority_localities_1.selectTargetLocalities)(localities).map((locality) => locality.id);
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map