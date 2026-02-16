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
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const executive_1 = require("../common/executive");
const sanitize_1 = require("../common/sanitize");
let TasksService = class TasksService {
    prisma;
    audit;
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
        const phases = await this.prisma.phase.findMany({ orderBy: { order: 'asc' } });
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
    async cloneTaskTemplate(id, user) {
        const template = await this.prisma.taskTemplate.findUnique({ where: { id } });
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
    async generateInstances(templateId, payload, user) {
        const template = await this.prisma.taskTemplate.findUnique({ where: { id: templateId } });
        if (!template)
            (0, http_error_1.throwError)('NOT_FOUND');
        const reportRequired = payload.reportRequired ?? template.reportRequiredDefault;
        const priority = payload.priority ?? client_1.TaskPriority.MEDIUM;
        const created = await this.prisma.$transaction(payload.localities.map((entry) => this.prisma.taskInstance.create({
            data: {
                taskTemplateId: templateId,
                localityId: entry.localityId,
                dueDate: new Date(entry.dueDate),
                status: client_1.TaskStatus.NOT_STARTED,
                priority,
                progressPercent: 0,
                assignedToId: payload.assignedToId ?? null,
                assigneeType: payload.assignedToId ? client_1.TaskAssigneeType.USER : null,
                reportRequired,
                meetingId: payload.meetingId ?? null,
                eloRoleId: template.eloRoleId ?? null,
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
    async listTaskInstances(filters, user) {
        const { where, taskTemplateFilter } = this.buildTaskWhere(filters, user);
        if (filters.meetingId)
            where.meetingId = filters.meetingId;
        if (filters.eloRoleId)
            where.eloRoleId = filters.eloRoleId;
        if (Object.keys(taskTemplateFilter).length > 0) {
            where.taskTemplate = taskTemplateFilter;
        }
        const { page, pageSize, skip, take } = this.parsePagination(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.taskInstance.findMany({
                where,
                orderBy: { dueDate: 'asc' },
                skip,
                take,
                include: {
                    assignedTo: { select: { id: true, name: true, email: true } },
                    assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
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
                taskTemplate: { include: { phase: true, specialty: true, eloRole: true } },
                locality: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
                meeting: { select: { id: true, datetime: true, scope: true } },
                eloRole: { select: { id: true, code: true, name: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
        const [withCommentSummary] = await this.attachTaskCommentSummary([instance], user);
        return this.mapTaskInstance(withCommentSummary, user?.executiveHidePii);
    }
    async listComments(id, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
        const [comments, readState] = await this.prisma.$transaction([
            this.prisma.taskComment.findMany({
                where: { taskInstanceId: id },
                include: { author: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            user?.id
                ? this.prisma.taskCommentRead.findUnique({
                    where: { taskInstanceId_userId: { taskInstanceId: id, userId: user.id } },
                })
                : this.prisma.taskCommentRead.findFirst({ where: { taskInstanceId: id, userId: '__none__' } }),
        ]);
        const seenAt = readState?.seenAt ?? null;
        const unread = user?.id
            ? comments.filter((comment) => comment.authorId !== user.id && (!seenAt || comment.createdAt > seenAt)).length
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
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
        const normalized = this.sanitizeCommentText(text);
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'text', reason: 'COMMENT_REQUIRED' });
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
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
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
            include: { reports: true, taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
        if (status === client_1.TaskStatus.DONE && instance.reportRequired && instance.reports.length === 0) {
            (0, http_error_1.throwError)('REPORT_REQUIRED');
        }
        if (status === client_1.TaskStatus.IN_PROGRESS) {
            const blocked = await this.hasBlockingDependencies(instance.blockedByIdsJson);
            if (blocked) {
                (0, http_error_1.throwError)('TASK_BLOCKED');
            }
        }
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
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
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
    async listAssignees(localityIdRaw, user) {
        const localityId = localityIdRaw?.trim();
        if (!localityId) {
            return { localityId: null, localityName: null, items: [] };
        }
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId && constraints.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const [locality, users, elos] = await this.prisma.$transaction([
            this.prisma.locality.findUnique({
                where: { id: localityId },
                select: { id: true, name: true, commandName: true, commanderName: true },
            }),
            this.prisma.user.findMany({
                where: { localityId, isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, email: true, eloRole: { select: { name: true, code: true } } },
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
                meeting: { select: { id: true, localityId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        const targetLocalityId = payload.localityId?.trim() || instance.localityId;
        this.assertConstraints(targetLocalityId, instance.taskTemplate?.specialtyId ?? null, user);
        const selection = this.normalizeAssigneeSelection(payload);
        let assignedToId = null;
        let assignedEloId = null;
        let assigneeType = null;
        let externalAssigneeName = null;
        let externalAssigneeRole = null;
        if (selection.type === client_1.TaskAssigneeType.USER && selection.id) {
            const targetUser = await this.prisma.user.findUnique({
                where: { id: selection.id },
                select: { id: true, localityId: true },
            });
            if (!targetUser)
                (0, http_error_1.throwError)('NOT_FOUND');
            if (targetUser.localityId !== targetLocalityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            assignedToId = targetUser.id;
            assigneeType = client_1.TaskAssigneeType.USER;
        }
        else if (selection.type === client_1.TaskAssigneeType.ELO && selection.id) {
            const targetElo = await this.prisma.elo.findUnique({
                where: { id: selection.id },
                select: { id: true, localityId: true, name: true, eloRole: { select: { name: true, code: true } } },
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
            assigneeType = externalAssigneeName ? client_1.TaskAssigneeType.LOCALITY_COMMAND : null;
        }
        else if (selection.type === client_1.TaskAssigneeType.LOCALITY_COMMANDER) {
            const locality = await this.prisma.locality.findUnique({
                where: { id: targetLocalityId },
                select: { commanderName: true },
            });
            externalAssigneeName = locality?.commanderName?.trim() ?? null;
            externalAssigneeRole = externalAssigneeName ? 'Comandante' : null;
            assigneeType = externalAssigneeName ? client_1.TaskAssigneeType.LOCALITY_COMMANDER : null;
        }
        const keepMeeting = !instance.meeting ||
            !instance.meeting.localityId ||
            instance.meeting.localityId === targetLocalityId;
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
            },
            include: {
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
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
                externalAssigneeName,
            },
        });
        return this.mapTaskInstance(updated, user?.executiveHidePii);
    }
    async batchAssign(ids, assignedToId, user) {
        const instances = await this.prisma.taskInstance.findMany({
            where: { id: { in: ids } },
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        for (const instance of instances) {
            this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
        }
        if (assignedToId) {
            const assignee = await this.prisma.user.findUnique({
                where: { id: assignedToId },
                select: { id: true, localityId: true },
            });
            if (!assignee)
                (0, http_error_1.throwError)('NOT_FOUND');
            const mismatched = instances.some((instance) => instance.localityId !== assignee.localityId);
            if (mismatched)
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
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
        await this.audit.log({
            userId: user?.id,
            resource: 'task_instances',
            action: 'batch_assign',
            diffJson: { count: ids.length, assignedToId },
        });
        return { updated: ids.length };
    }
    async batchStatus(ids, status, user) {
        const instances = await this.prisma.taskInstance.findMany({
            where: { id: { in: ids } },
            include: { reports: true, taskTemplate: { select: { specialtyId: true } } },
        });
        for (const instance of instances) {
            this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
            if (status === client_1.TaskStatus.DONE && instance.reportRequired && instance.reports.length === 0) {
                (0, http_error_1.throwError)('REPORT_REQUIRED');
            }
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
    async getGantt(params, user) {
        const where = {};
        if (params.localityId)
            where.localityId = params.localityId;
        if (params.from || params.to) {
            where.dueDate = {};
            if (params.from)
                where.dueDate.gte = new Date(params.from);
            if (params.to)
                where.dueDate.lte = new Date(params.to);
        }
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId) {
            where.localityId = constraints.localityId;
        }
        if (constraints.specialtyId) {
            where.taskTemplate = { specialtyId: constraints.specialtyId };
        }
        const items = await this.prisma.taskInstance.findMany({ where });
        return { items: items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)) };
    }
    async getCalendar(year, localityId, user) {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1));
        const where = {
            dueDate: { gte: start, lt: end },
        };
        if (localityId)
            where.localityId = localityId;
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId) {
            where.localityId = constraints.localityId;
        }
        if (constraints.specialtyId) {
            where.taskTemplate = { specialtyId: constraints.specialtyId };
        }
        const items = await this.prisma.taskInstance.findMany({
            where,
            include: { taskTemplate: { include: { phase: true } } },
        });
        return {
            items: items.map((item) => ({
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
            taskWhere.taskTemplate = { specialtyId: constraints.specialtyId };
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
            : phaseEntries.reduce((acc, entry) => acc + entry.progress, 0) / phaseEntries.length;
        return {
            localityId,
            overallProgress,
            byPhase: phaseEntries,
        };
    }
    async getDashboardNational(user) {
        const where = {};
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId) {
            where.id = constraints.localityId;
        }
        const localities = await this.prisma.locality.findMany({
            where,
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
            },
        });
        const reportsCount = await this.prisma.report.count();
        const taskWhere = {};
        if (constraints.specialtyId) {
            taskWhere.taskTemplate = { specialtyId: constraints.specialtyId };
        }
        const tasks = await this.prisma.taskInstance.findMany({
            where: taskWhere,
            include: { locality: true, taskTemplate: true },
        });
        const statusById = new Map(tasks.map((task) => [task.id, task.status]));
        const perLocality = localities.map((locality) => {
            const localityTasks = tasks.filter((task) => task.localityId === locality.id);
            const late = localityTasks.filter((task) => this.isLate(task)).length;
            const blocked = localityTasks.filter((task) => this.isBlocked(task.blockedByIdsJson, statusById)).length;
            const unassigned = localityTasks.filter((task) => this.isTaskUnassigned(task)).length;
            const progress = localityTasks.length
                ? localityTasks.reduce((acc, task) => acc + task.progressPercent, 0) / localityTasks.length
                : 0;
            return {
                localityId: locality.id,
                localityCode: locality.code,
                localityName: locality.name,
                recruitsFemaleCountCurrent: locality.recruitsFemaleCountCurrent ?? 0,
                commanderName: locality.commanderName ?? null,
                individualMeetingDate: locality.individualMeetingDate ? locality.individualMeetingDate.toISOString().slice(0, 10) : null,
                visitDate: locality.visitDate ? locality.visitDate.toISOString().slice(0, 10) : null,
                commandName: locality.commandName ?? null,
                notes: locality.notes ?? null,
                progress,
                late,
                blocked,
                unassigned,
            };
        });
        const totalRecruits = localities.reduce((acc, l) => acc + (l.recruitsFemaleCountCurrent ?? 0), 0);
        return {
            items: perLocality,
            totals: {
                localities: perLocality.length,
                late: perLocality.reduce((acc, item) => acc + item.late, 0),
                blocked: perLocality.reduce((acc, item) => acc + item.blocked, 0),
                unassigned: perLocality.reduce((acc, item) => acc + item.unassigned, 0),
                recruitsFemale: totalRecruits,
                reportsProduced: reportsCount,
            },
            executive_hide_pii: user?.executiveHidePii ?? false,
        };
    }
    async getDashboardRecruits(user) {
        const localityWhere = {};
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId)
            localityWhere.id = constraints.localityId;
        const [localities, history] = await this.prisma.$transaction([
            this.prisma.locality.findMany({
                where: localityWhere,
                orderBy: { name: 'asc' },
                select: { id: true, name: true, code: true, recruitsFemaleCountCurrent: true },
            }),
            this.prisma.recruitsHistory.findMany({
                where: constraints.localityId ? { localityId: constraints.localityId } : undefined,
                orderBy: { date: 'asc' },
            }),
        ]);
        const currentPerLocality = localities.map((loc) => ({
            localityId: loc.id,
            localityName: loc.name,
            code: loc.code,
            recruitsFemaleCountCurrent: loc.recruitsFemaleCountCurrent ?? 0,
        }));
        const aggregateByMonth = [];
        const monthMap = new Map();
        for (const entry of history) {
            const monthKey = entry.date.toISOString().slice(0, 7);
            monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + entry.recruitsFemaleCount);
        }
        for (const [month, value] of Array.from(monthMap.entries()).sort()) {
            aggregateByMonth.push({ month, value });
        }
        const byLocalityMap = new Map();
        for (const entry of history) {
            const key = entry.localityId;
            if (!byLocalityMap.has(key))
                byLocalityMap.set(key, []);
            byLocalityMap.get(key).push({
                date: entry.date.toISOString().slice(0, 10),
                value: entry.recruitsFemaleCount,
            });
        }
        const localityById = new Map(localities.map((l) => [l.id, l]));
        const byLocality = Array.from(byLocalityMap.entries()).map(([localityId, series]) => ({
            localityId,
            localityName: localityById.get(localityId)?.name ?? localityId,
            code: localityById.get(localityId)?.code ?? '',
            series,
        }));
        return {
            currentPerLocality,
            aggregateByMonth,
            byLocality,
        };
    }
    async getDashboardExecutive(params, user) {
        const from = params.from ? new Date(params.from) : new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
        const to = params.to ? new Date(params.to) : new Date();
        const threshold = Number(params.threshold ?? 70);
        const localityWhere = {};
        if (params.command) {
            localityWhere.commandName = params.command;
        }
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId) {
            localityWhere.id = constraints.localityId;
        }
        const [localities, tasks, phases, reports, recruitsHistory] = await this.prisma.$transaction([
            this.prisma.locality.findMany({ where: localityWhere, orderBy: { name: 'asc' } }),
            this.prisma.taskInstance.findMany({
                where: {
                    createdAt: { gte: from, lte: to },
                    ...(params.phaseId ? { taskTemplate: { phaseId: params.phaseId } } : {}),
                },
                include: { taskTemplate: { include: { phase: true } } },
            }),
            this.prisma.phase.findMany({ orderBy: { order: 'asc' } }),
            this.prisma.report.findMany({ include: { taskInstance: true } }),
            this.prisma.recruitsHistory.findMany({ orderBy: { date: 'asc' } }),
        ]);
        const localityIds = localities.map((loc) => loc.id);
        const filteredTasks = tasks.filter((task) => localityIds.includes(task.localityId));
        const progressByPhase = phases.map((phase) => {
            const phaseTasks = filteredTasks.filter((task) => task.taskTemplate.phaseId === phase.id);
            const avg = phaseTasks.length
                ? phaseTasks.reduce((acc, task) => acc + task.progressPercent, 0) / phaseTasks.length
                : 0;
            return { phaseId: phase.id, phaseName: phase.name, progress: Math.round(avg) };
        });
        const overallProgress = progressByPhase.length > 0
            ? Math.round(progressByPhase.reduce((acc, entry) => acc + entry.progress, 0) / progressByPhase.length)
            : 0;
        const localityProgressByPhase = phases.map((phase) => {
            const perLocality = localities.map((locality) => {
                const phaseTasks = filteredTasks.filter((task) => task.localityId === locality.id && task.taskTemplate.phaseId === phase.id);
                const avg = phaseTasks.length
                    ? phaseTasks.reduce((acc, task) => acc + task.progressPercent, 0) / phaseTasks.length
                    : 0;
                return { localityId: locality.id, progress: avg };
            });
            const above = perLocality.filter((entry) => entry.progress >= threshold).length;
            return {
                phaseId: phase.id,
                phaseName: phase.name,
                threshold,
                percentLocalitiesAbove: localities.length ? Math.round((above / localities.length) * 100) : 0,
            };
        });
        const lateTasks = filteredTasks.filter((task) => task.status !== client_1.TaskStatus.DONE && task.dueDate < new Date());
        const weeklyTrend = [];
        for (let i = 7; i >= 0; i -= 1) {
            const start = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
            const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
            const count = filteredTasks.filter((task) => task.dueDate >= start && task.dueDate < end && task.status !== client_1.TaskStatus.DONE).length;
            weeklyTrend.push({ week: start.toISOString().slice(0, 10), late: count });
        }
        const unassigned = filteredTasks.filter((task) => this.isTaskUnassigned(task));
        const unassignedByCommand = new Map();
        for (const task of unassigned) {
            const locality = localities.find((loc) => loc.id === task.localityId);
            const key = locality?.commandName ?? 'Sem comando';
            unassignedByCommand.set(key, (unassignedByCommand.get(key) ?? 0) + 1);
        }
        const leadTimesByPhase = phases.map((phase) => {
            const doneTasks = filteredTasks.filter((task) => task.taskTemplate.phaseId === phase.id && task.status === client_1.TaskStatus.DONE);
            const avgDays = doneTasks.length
                ? doneTasks.reduce((acc, task) => acc + (task.updatedAt.getTime() - task.createdAt.getTime()), 0) /
                    doneTasks.length /
                    (1000 * 60 * 60 * 24)
                : 0;
            return { phaseId: phase.id, phaseName: phase.name, avgLeadDays: Number(avgDays.toFixed(1)) };
        });
        const reportRequiredTasks = filteredTasks.filter((task) => task.reportRequired && task.status === client_1.TaskStatus.DONE);
        const approvedReports = new Set(reports.filter((report) => report.approved).map((report) => report.taskInstanceId));
        const complianceApproved = reportRequiredTasks.filter((task) => approvedReports.has(task.id)).length;
        const compliancePending = reportRequiredTasks.length - complianceApproved;
        const recruitsByLocality = new Map();
        for (const entry of recruitsHistory) {
            const key = entry.localityId;
            if (!recruitsByLocality.has(key))
                recruitsByLocality.set(key, []);
            recruitsByLocality.get(key).push({
                date: entry.date.toISOString().slice(0, 10),
                value: entry.recruitsFemaleCount,
            });
        }
        const recruitsAggregate = [];
        for (const entry of recruitsHistory) {
            const dateKey = entry.date.toISOString().slice(0, 10);
            const existing = recruitsAggregate.find((item) => item.date === dateKey);
            if (existing)
                existing.value += entry.recruitsFemaleCount;
            else
                recruitsAggregate.push({ date: dateKey, value: entry.recruitsFemaleCount });
        }
        const riskScores = localities.map((locality) => {
            const localityTasks = filteredTasks.filter((task) => task.localityId === locality.id);
            const late = localityTasks.filter((task) => this.isLate(task)).length;
            const blocked = localityTasks.filter((task) => this.isBlocked(task.blockedByIdsJson)).length;
            const unassignedCount = localityTasks.filter((task) => this.isTaskUnassigned(task)).length;
            const reportPending = localityTasks.filter((task) => task.reportRequired && task.status === client_1.TaskStatus.DONE && !approvedReports.has(task.id)).length;
            const score = late * 2 + blocked * 2 + unassignedCount + reportPending * 2;
            return {
                localityId: locality.id,
                localityCode: locality.code,
                commandName: locality.commandName ?? '',
                score,
                breakdown: { late, blocked, unassigned: unassignedCount, reportPending },
            };
        });
        const response = {
            progress: {
                overall: overallProgress,
                byPhase: progressByPhase,
            },
            localityAboveThreshold: localityProgressByPhase,
            late: {
                total: lateTasks.length,
                trend: weeklyTrend,
            },
            unassigned: {
                total: unassigned.length,
                byCommand: Array.from(unassignedByCommand.entries()).map(([commandName, count]) => ({
                    commandName,
                    count,
                })),
            },
            leadTime: leadTimesByPhase,
            reportsCompliance: {
                approved: complianceApproved,
                pending: compliancePending,
                total: reportRequiredTasks.length,
            },
            recruits: {
                aggregate: recruitsAggregate,
                byLocality: Array.from(recruitsByLocality.entries()).map(([localityId, series]) => ({
                    localityId,
                    series,
                })),
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
        return instance.status !== client_1.TaskStatus.DONE && instance.dueDate.getTime() < Date.now();
    }
    isBlocked(blockedByIds, statusById) {
        if (!Array.isArray(blockedByIds) || blockedByIds.length === 0)
            return false;
        if (!statusById)
            return true;
        return blockedByIds.some((id) => statusById.get(id) !== client_1.TaskStatus.DONE);
    }
    isTaskUnassigned(task) {
        return !task.assignedToId && !task.assignedEloId && !task.externalAssigneeName;
    }
    normalizeAssigneeSelection(payload) {
        if (payload.assigneeType) {
            if (payload.assigneeType === 'USER' || payload.assigneeType === 'ELO') {
                return { type: payload.assigneeType, id: payload.assigneeId?.trim() || null };
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
            const summary = summaryByTask.get(item.id) ?? { total: 0, unread: 0, lastCommentAt: null };
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
    mapTaskInstance(instance, executiveHidePii) {
        const assignee = this.resolveAssignee(instance);
        const mapped = {
            ...instance,
            isLate: this.isLate(instance),
            blockedByIds: instance.blockedByIdsJson ?? null,
            hasAssignee: !this.isTaskUnassigned(instance),
            assignee: executiveHidePii ? null : assignee,
            assigneeLabel: executiveHidePii ? null : assignee?.label ?? null,
        };
        delete mapped.blockedByIdsJson;
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
                : comment.author?.name ?? comment.author?.email ?? 'Usuário',
        };
    }
    sanitizeCommentText(input) {
        return String(input ?? '')
            .replace(/[<>]/g, '')
            .replace(/\r\n/g, '\n')
            .trim();
    }
    resolveAssignee(instance) {
        if (instance.assignedTo) {
            const name = instance.assignedTo.name || instance.assignedTo.email || `Usuário ${String(instance.assignedTo.id).slice(0, 8)}`;
            return {
                type: client_1.TaskAssigneeType.USER,
                id: instance.assignedTo.id,
                name,
                label: name,
            };
        }
        if (instance.assignedElo) {
            const role = instance.assignedElo.eloRole?.name ?? instance.assignedElo.eloRole?.code ?? 'Elo';
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
        if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async updateTaskMeeting(id, meetingId, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id },
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
        const updated = await this.prisma.taskInstance.update({
            where: { id },
            data: { meetingId },
            include: { meeting: { select: { id: true, datetime: true, scope: true } } },
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
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);
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
        const where = {};
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.eloRoleId)
            where.eloRoleId = filters.eloRoleId;
        if (filters.status)
            where.status = filters.status;
        if (filters.assigneeId)
            where.assignedToId = filters.assigneeId;
        if (filters.dueFrom || filters.dueTo) {
            where.dueDate = {};
            if (filters.dueFrom)
                where.dueDate.gte = new Date(filters.dueFrom);
            if (filters.dueTo)
                where.dueDate.lte = new Date(filters.dueTo);
        }
        const taskTemplateFilter = {};
        if (filters.phaseId) {
            taskTemplateFilter.phaseId = filters.phaseId;
        }
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId) {
            where.localityId = constraints.localityId;
        }
        if (constraints.specialtyId) {
            taskTemplateFilter.specialtyId = constraints.specialtyId;
        }
        return { where, taskTemplateFilter };
    }
    async listTaskInstancesForExport(filters, user) {
        const { where, taskTemplateFilter } = this.buildTaskWhere(filters, user);
        if (Object.keys(taskTemplateFilter).length > 0) {
            where.taskTemplate = taskTemplateFilter;
        }
        const items = await this.prisma.taskInstance.findMany({
            where,
            include: {
                taskTemplate: { include: { phase: true, specialty: true, eloRole: true } },
                locality: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
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
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map