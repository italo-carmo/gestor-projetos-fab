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
const role_access_1 = require("../rbac/role-access");
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
        const responsibleIds = Array.from(new Set((payload.assigneeIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (payload.assignedToId && !responsibleIds.includes(payload.assignedToId)) {
            responsibleIds.push(payload.assignedToId);
        }
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
    async listTaskInstances(filters, user) {
        const { where } = this.buildTaskWhere(filters, user);
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
                    taskTemplate: { select: { id: true, title: true, phaseId: true } },
                    assignedTo: { select: { id: true, name: true, email: true } },
                    assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
                    responsibles: {
                        include: {
                            user: { select: { id: true, name: true, email: true, localityId: true, specialtyId: true, eloRoleId: true } },
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
                taskTemplate: { include: { phase: true, specialty: true, eloRole: true } },
                locality: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
                responsibles: {
                    include: {
                        user: { select: { id: true, name: true, email: true, localityId: true, specialtyId: true, eloRoleId: true } },
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
                reports: true,
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertTaskOperateAccess(instance, user);
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
    async listAssignees(localityIdRaw, user) {
        const localityId = localityIdRaw?.trim();
        if (!localityId) {
            return { localityId: null, localityName: null, items: [] };
        }
        this.assertCanAssignInLocality(localityId, user);
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
            taskTemplate: { specialtyId: instance.taskTemplate?.specialtyId ?? null },
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
                select: { id: true, localityId: true, specialtyId: true, eloRoleId: true, isActive: true },
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
                assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
                responsibles: {
                    include: {
                        user: { select: { id: true, name: true, email: true, localityId: true, specialtyId: true, eloRoleId: true } },
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
            await this.prisma.taskResponsible.deleteMany({ where: { taskInstanceId: instance.id } });
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
                reports: true,
                taskTemplate: { select: { specialtyId: true } },
                assignedElo: { select: { id: true, eloRoleId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        for (const instance of instances) {
            this.assertTaskOperateAccess(instance, user);
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
        const andClauses = [];
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
        return { items: items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)) };
    }
    async getCalendar(year, localityId, user) {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1));
        const andClauses = [
            { dueDate: { gte: start, lt: end } },
        ];
        if (localityId)
            andClauses.push({ localityId });
        const accessWhere = this.buildTaskAccessWhere(user, 'view');
        if (Object.keys(accessWhere).length > 0)
            andClauses.push(accessWhere);
        const where = { AND: andClauses };
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
        const localityById = new Map(localities.map((locality) => [locality.id, locality]));
        const mapNationalTaskDetail = (task) => {
            const locality = localityById.get(task.localityId);
            const isLate = this.isLate(task);
            const isUnassigned = this.isTaskUnassigned(task);
            const isBlocked = this.isBlocked(task.blockedByIdsJson, statusById);
            return {
                taskId: task.id,
                title: task.taskTemplate?.title ?? 'Tarefa',
                localityId: task.localityId,
                localityCode: locality?.code ?? '',
                localityName: locality?.name ?? '',
                phaseId: task.taskTemplate?.phaseId ?? null,
                dueDate: task.dueDate,
                status: task.status,
                priority: task.priority,
                progressPercent: task.progressPercent,
                isLate,
                isUnassigned,
                isBlocked,
            };
        };
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
        const lateItems = tasks
            .filter((task) => this.isLate(task))
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .map((task) => mapNationalTaskDetail(task));
        const unassignedItems = tasks
            .filter((task) => this.isTaskUnassigned(task))
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .map((task) => mapNationalTaskDetail(task));
        const riskTasks = tasks
            .filter((task) => this.isLate(task) ||
            this.isTaskUnassigned(task) ||
            this.isBlocked(task.blockedByIdsJson, statusById))
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .slice(0, 10)
            .map((task) => mapNationalTaskDetail(task));
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
            lateItems,
            unassignedItems,
            riskTasks,
            executive_hide_pii: user?.executiveHidePii ?? false,
        };
    }
    async getDashboardRecruits(user) {
        const localityWhere = {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        const hasNationalRecruitScope = profile.ti || profile.nationalCommission;
        const constraints = this.getScopeConstraints(user);
        if (!hasNationalRecruitScope && constraints.localityId)
            localityWhere.id = constraints.localityId;
        const [localities, history] = await this.prisma.$transaction([
            this.prisma.locality.findMany({
                where: localityWhere,
                orderBy: { name: 'asc' },
                select: { id: true, name: true, code: true, recruitsFemaleCountCurrent: true },
            }),
            this.prisma.recruitsHistory.findMany({
                where: !hasNationalRecruitScope && constraints.localityId
                    ? { localityId: constraints.localityId }
                    : undefined,
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
        const localityById = new Map(localities.map((locality) => [locality.id, locality]));
        const statusById = new Map(filteredTasks.map((task) => [task.id, task.status]));
        const dayMs = 1000 * 60 * 60 * 24;
        const mapExecutiveTaskItem = (task) => {
            const locality = localityById.get(task.localityId);
            const late = this.isLate(task);
            const blocked = this.isBlocked(task.blockedByIdsJson, statusById);
            return {
                taskId: task.id,
                title: task.taskTemplate?.title ?? 'Tarefa',
                phaseId: task.taskTemplate?.phaseId ?? null,
                phaseName: task.taskTemplate?.phase?.name ?? '',
                localityId: task.localityId,
                localityCode: locality?.code ?? '',
                localityName: locality?.name ?? '',
                dueDate: task.dueDate,
                status: task.status,
                priority: task.priority,
                progressPercent: task.progressPercent,
                reportRequired: task.reportRequired,
                isLate: late,
                daysLate: late ? Math.max(1, Math.ceil((Date.now() - task.dueDate.getTime()) / dayMs)) : 0,
                isUnassigned: this.isTaskUnassigned(task),
                isBlocked: blocked,
            };
        };
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
                return {
                    localityId: locality.id,
                    localityCode: locality.code,
                    localityName: locality.name,
                    progress: Math.round(avg),
                };
            });
            const localitiesAbove = perLocality
                .filter((entry) => entry.progress >= threshold)
                .sort((a, b) => b.progress - a.progress);
            const localitiesBelow = perLocality
                .filter((entry) => entry.progress < threshold)
                .sort((a, b) => a.progress - b.progress);
            return {
                phaseId: phase.id,
                phaseName: phase.name,
                threshold,
                localitiesAboveCount: localitiesAbove.length,
                localitiesBelowCount: localitiesBelow.length,
                percentLocalitiesAbove: localities.length ? Math.round((localitiesAbove.length / localities.length) * 100) : 0,
                localitiesAbove,
                localitiesBelow,
            };
        });
        const progressByLocality = localities
            .map((locality) => {
            const localityTasks = filteredTasks.filter((task) => task.localityId === locality.id);
            const avg = localityTasks.length
                ? localityTasks.reduce((acc, task) => acc + task.progressPercent, 0) / localityTasks.length
                : 0;
            return {
                localityId: locality.id,
                localityCode: locality.code,
                localityName: locality.name,
                progress: Math.round(avg),
                tasksCount: localityTasks.length,
            };
        })
            .sort((a, b) => b.progress - a.progress);
        const lateTasks = filteredTasks.filter((task) => task.status !== client_1.TaskStatus.DONE && task.dueDate < new Date());
        const lateTaskItems = lateTasks
            .slice()
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .map((task) => mapExecutiveTaskItem(task));
        const weeklyTrend = [];
        for (let i = 7; i >= 0; i -= 1) {
            const start = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
            const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
            const weekItems = filteredTasks.filter((task) => task.dueDate >= start && task.dueDate < end && task.status !== client_1.TaskStatus.DONE);
            const byLocality = new Map();
            for (const task of weekItems) {
                const locality = localityById.get(task.localityId);
                const key = locality?.id ?? task.localityId;
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
        const unassigned = filteredTasks.filter((task) => this.isTaskUnassigned(task));
        const unassignedTaskItems = unassigned
            .slice()
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
            .map((task) => mapExecutiveTaskItem(task));
        const unassignedByCommand = new Map();
        const unassignedByLocality = new Map();
        for (const task of unassigned) {
            const locality = localityById.get(task.localityId);
            const key = locality?.commandName ?? 'Sem comando';
            unassignedByCommand.set(key, (unassignedByCommand.get(key) ?? 0) + 1);
            const localityKey = locality?.id ?? task.localityId;
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
        const blockedTasks = filteredTasks.filter((task) => this.isBlocked(task.blockedByIdsJson, statusById));
        const blockedByLocality = new Map();
        for (const task of blockedTasks) {
            const locality = localityById.get(task.localityId);
            const localityKey = locality?.id ?? task.localityId;
            const current = blockedByLocality.get(localityKey);
            if (current) {
                current.count += 1;
            }
            else {
                blockedByLocality.set(localityKey, {
                    localityId: localityKey,
                    localityCode: locality?.code ?? '',
                    localityName: locality?.name ?? '',
                    commandName: locality?.commandName ?? 'Sem comando',
                    count: 1,
                });
            }
        }
        const leadTimesByPhase = phases.map((phase) => {
            const doneTasks = filteredTasks.filter((task) => task.taskTemplate.phaseId === phase.id && task.status === client_1.TaskStatus.DONE);
            const avgDays = doneTasks.length
                ? doneTasks.reduce((acc, task) => acc + (task.updatedAt.getTime() - task.createdAt.getTime()), 0) /
                    doneTasks.length /
                    (1000 * 60 * 60 * 24)
                : 0;
            const sampleTasks = doneTasks
                .map((task) => ({
                ...mapExecutiveTaskItem(task),
                leadDays: Number(((task.updatedAt.getTime() - task.createdAt.getTime()) / dayMs).toFixed(1)),
            }))
                .sort((a, b) => b.leadDays - a.leadDays)
                .slice(0, 12);
            return {
                phaseId: phase.id,
                phaseName: phase.name,
                avgLeadDays: Number(avgDays.toFixed(1)),
                doneCount: doneTasks.length,
                sampleTasks,
            };
        });
        const reportRequiredTasks = filteredTasks.filter((task) => task.reportRequired && task.status === client_1.TaskStatus.DONE);
        const approvedReports = new Set(reports.filter((report) => report.approved).map((report) => report.taskInstanceId));
        const complianceApproved = reportRequiredTasks.filter((task) => approvedReports.has(task.id)).length;
        const compliancePending = reportRequiredTasks.length - complianceApproved;
        const reportPendingItems = reportRequiredTasks
            .filter((task) => !approvedReports.has(task.id))
            .map((task) => mapExecutiveTaskItem(task));
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
            const blocked = localityTasks.filter((task) => this.isBlocked(task.blockedByIdsJson, statusById)).length;
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
                byLocality: progressByLocality,
            },
            localityAboveThreshold: localityProgressByPhase,
            late: {
                total: lateTasks.length,
                trend: weeklyTrend,
                items: lateTaskItems,
            },
            unassigned: {
                total: unassigned.length,
                byCommand: Array.from(unassignedByCommand.entries()).map(([commandName, count]) => ({
                    commandName,
                    count,
                })),
                byLocality: Array.from(unassignedByLocality.values()).sort((a, b) => b.count - a.count),
                items: unassignedTaskItems,
            },
            blocked: {
                total: blockedTasks.length,
                byLocality: Array.from(blockedByLocality.values()).sort((a, b) => b.count - a.count),
                items: blockedTasks
                    .slice()
                    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                    .map((task) => mapExecutiveTaskItem(task)),
            },
            leadTime: leadTimesByPhase,
            reportsCompliance: {
                approved: complianceApproved,
                pending: compliancePending,
                total: reportRequiredTasks.length,
                pendingItems: reportPendingItems,
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
        const hasResponsibleUsers = Array.isArray(task.responsibles) &&
            task.responsibles.some((entry) => Boolean(entry?.userId));
        return !task.assignedToId && !task.assignedEloId && !task.externalAssigneeName && !hasResponsibleUsers;
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
        const responsibleUsers = Array.isArray(instance.responsibles)
            ? instance.responsibles
                .map((entry) => entry?.user)
                .filter(Boolean)
                .map((user) => ({
                id: user.id,
                name: user.name ?? user.email ?? `Usuário ${String(user.id).slice(0, 8)}`,
                email: user.email ?? null,
            }))
            : [];
        const mapped = {
            ...instance,
            localityName: instance.localityName ?? instance.locality?.name ?? null,
            localityCode: instance.localityCode ?? instance.locality?.code ?? null,
            isLate: this.isLate(instance),
            blockedByIds: instance.blockedByIdsJson ?? null,
            hasAssignee: !this.isTaskUnassigned(instance),
            responsibleUsers: executiveHidePii ? [] : responsibleUsers,
            assignee: executiveHidePii ? null : assignee,
            assigneeLabel: executiveHidePii ? null : assignee?.label ?? null,
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
        const responsibleUsers = Array.isArray(instance.responsibles)
            ? instance.responsibles
                .map((entry) => entry?.user)
                .filter(Boolean)
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
            const name = responsible.name || responsible.email || `Usuário ${String(responsible.id).slice(0, 8)}`;
            return {
                type: client_1.TaskAssigneeType.USER,
                id: responsible.id,
                name,
                label: name,
            };
        }
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
        if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    buildTaskAccessWhere(user, mode) {
        if (!user?.id)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (mode === 'operate') {
            if (profile.ti)
                return {};
            return {
                OR: [
                    { assignedToId: user.id },
                    { responsibles: { some: { userId: user.id } } },
                ],
            };
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
                    groupOr.push({ taskTemplate: { specialtyId: profile.groupSpecialtyId } });
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
                groupOr.push({ taskTemplate: { specialtyId: profile.groupSpecialtyId } });
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
                groupOr.push({ taskTemplate: { specialtyId: user.specialtyId } });
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
        const specialtyMatch = profile.groupSpecialtyId
            ? instance.taskTemplate?.specialtyId === profile.groupSpecialtyId
            : false;
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
        if (user.localityId && instance.localityId === user.localityId && (specialtyMatch || eloRoleMatch))
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertTaskOperateAccess(instance, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti)
            return;
        if (!this.isTaskResponsibleUser(instance, user)) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertCanAssignInLocality(localityId, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        if (profile.localityAdmin && profile.localityId === localityId)
            return;
        if (profile.specialtyAdmin && profile.localityId === localityId)
            return;
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertCanAssignInTaskScope(instance, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        if (profile.localityAdmin) {
            if (!profile.localityId || instance.localityId === profile.localityId)
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (profile.specialtyAdmin) {
            if (profile.localityId && instance.localityId !== profile.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            const specialtyMatch = profile.groupSpecialtyId
                ? instance.taskTemplate?.specialtyId === profile.groupSpecialtyId
                : false;
            const eloRoleMatch = profile.groupEloRoleId
                ? instance.eloRoleId === profile.groupEloRoleId ||
                    instance.assignedElo?.eloRoleId === profile.groupEloRoleId
                : false;
            if (specialtyMatch || eloRoleMatch)
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
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
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'TASK_RESPONSIBLE_LOCALITY_MISMATCH' });
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
        if (filters.localityId)
            andClauses.push({ localityId: filters.localityId });
        if (filters.eloRoleId)
            andClauses.push({ eloRoleId: filters.eloRoleId });
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
        const { where } = this.buildTaskWhere(filters, user);
        const items = await this.prisma.taskInstance.findMany({
            where,
            include: {
                taskTemplate: { include: { phase: true, specialty: true, eloRole: true } },
                locality: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                assignedElo: { include: { eloRole: { select: { id: true, code: true, name: true } } } },
                responsibles: {
                    include: {
                        user: { select: { id: true, name: true, email: true, localityId: true, specialtyId: true, eloRoleId: true } },
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
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map