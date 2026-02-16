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
exports.ChecklistsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const audit_service_1 = require("../audit/audit.service");
let ChecklistsService = class ChecklistsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters, user) {
        const constraints = this.getScopeConstraints(user);
        const localityWhere = {};
        if (constraints.localityId)
            localityWhere.id = constraints.localityId;
        const checklistWhere = {};
        if (filters.phaseId)
            checklistWhere.phaseId = filters.phaseId;
        if (filters.specialtyId)
            checklistWhere.specialtyId = filters.specialtyId;
        if (constraints.specialtyId)
            checklistWhere.specialtyId = constraints.specialtyId;
        if (constraints.eloRoleId)
            checklistWhere.eloRoleId = constraints.eloRoleId;
        if (filters.eloRoleId)
            checklistWhere.eloRoleId = filters.eloRoleId;
        const [localities, checklists] = await this.prisma.$transaction([
            this.prisma.locality.findMany({ where: localityWhere, orderBy: { name: 'asc' } }),
            this.prisma.checklist.findMany({
                where: checklistWhere,
                include: {
                    phase: true,
                    specialty: true,
                    eloRole: { select: { id: true, code: true, name: true } },
                    items: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const localityIds = localities.map((l) => l.id);
        const templateIds = checklists.flatMap((c) => c.items.filter((i) => i.taskTemplateId).map((i) => i.taskTemplateId));
        const activityChecklistKeys = new Set(checklists.flatMap((c) => c.items
            .filter((i) => !i.taskTemplateId)
            .map((i) => this.normalizeChecklistActivityTitle(i.title))));
        const taskInstances = templateIds.length
            ? await this.prisma.taskInstance.findMany({
                where: {
                    taskTemplateId: { in: templateIds },
                    localityId: localityIds.length ? { in: localityIds } : undefined,
                },
                select: { taskTemplateId: true, localityId: true, status: true },
            })
            : [];
        const activities = activityChecklistKeys.size > 0 && localityIds.length > 0
            ? await this.prisma.activity.findMany({
                where: { localityId: { in: localityIds } },
                select: { title: true, localityId: true, status: true },
            })
            : [];
        const instanceByTemplateLocality = new Map();
        for (const instance of taskInstances) {
            const key = `${instance.taskTemplateId}:${instance.localityId}`;
            const list = instanceByTemplateLocality.get(key) ?? [];
            list.push(instance.status);
            instanceByTemplateLocality.set(key, list);
        }
        const activityByTitleLocality = new Map();
        for (const activity of activities) {
            const normalizedTitle = this.normalizeChecklistActivityTitle(activity.title);
            if (!activityChecklistKeys.has(normalizedTitle))
                continue;
            const key = `${normalizedTitle}:${activity.localityId}`;
            const list = activityByTitleLocality.get(key) ?? [];
            list.push(activity.status);
            activityByTitleLocality.set(key, list);
        }
        const items = checklists.map((checklist) => {
            const mappedItems = checklist.items.map((item) => {
                const statusesByLocality = {};
                const activityTitleKey = this.normalizeChecklistActivityTitle(item.title);
                for (const locality of localities) {
                    const key = `${item.taskTemplateId}:${locality.id}`;
                    if (item.taskTemplateId && instanceByTemplateLocality.has(key)) {
                        const statuses = instanceByTemplateLocality.get(key) ?? [];
                        statusesByLocality[locality.id] = this.aggregateTaskStatus(statuses);
                    }
                    else if (item.taskTemplateId) {
                        statusesByLocality[locality.id] = client_1.ChecklistItemStatusType.NOT_STARTED;
                    }
                    else {
                        const activityKey = `${activityTitleKey}:${locality.id}`;
                        const statuses = activityByTitleLocality.get(activityKey) ?? [];
                        statusesByLocality[locality.id] = this.aggregateActivityStatus(statuses);
                    }
                }
                return {
                    id: item.id,
                    title: item.title,
                    taskTemplateId: item.taskTemplateId,
                    sourceType: item.taskTemplateId ? 'TASK' : 'ACTIVITY',
                    statuses: statusesByLocality,
                };
            });
            const localityProgress = localities.map((locality) => {
                if (mappedItems.length === 0) {
                    return { localityId: locality.id, percent: 0 };
                }
                const doneCount = mappedItems.filter((item) => item.statuses[locality.id] === client_1.ChecklistItemStatusType.DONE).length;
                return {
                    localityId: locality.id,
                    percent: Math.round((doneCount / mappedItems.length) * 100),
                };
            });
            return {
                id: checklist.id,
                title: checklist.title,
                phaseId: checklist.phaseId,
                specialtyId: checklist.specialtyId,
                eloRoleId: checklist.eloRoleId,
                eloRole: checklist.eloRole,
                items: mappedItems,
                localityProgress,
            };
        });
        return { items, localities };
    }
    async create(payload, user) {
        this.assertConstraints(payload.specialtyId ?? null, user);
        const title = (0, sanitize_1.sanitizeText)(payload.title).trim();
        const existing = await this.prisma.checklist.findFirst({
            where: {
                title: { equals: title, mode: 'insensitive' },
                phaseId: payload.phaseId ?? null,
                specialtyId: payload.specialtyId ?? null,
                eloRoleId: payload.eloRoleId ?? null,
            },
            select: { id: true },
        });
        if (existing) {
            (0, http_error_1.throwError)('CONFLICT_UNIQUE', {
                resource: 'checklists',
                field: 'title+phaseId+specialtyId+eloRoleId',
                existingId: existing.id,
            });
        }
        const created = await this.prisma.checklist.create({
            data: {
                title,
                phaseId: payload.phaseId ?? null,
                specialtyId: payload.specialtyId ?? null,
                eloRoleId: payload.eloRoleId ?? null,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'checklists',
            action: 'create',
            entityId: created.id,
            diffJson: { title: created.title },
        });
        return created;
    }
    async addItem(checklistId, payload, user) {
        const checklist = await this.prisma.checklist.findUnique({ where: { id: checklistId } });
        if (!checklist)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(checklist.specialtyId ?? null, user);
        const created = await this.prisma.checklistItem.create({
            data: {
                checklistId,
                title: (0, sanitize_1.sanitizeText)(payload.title),
                taskTemplateId: payload.taskTemplateId ?? null,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'checklists',
            action: 'add_item',
            entityId: checklistId,
            diffJson: { itemId: created.id },
        });
        return created;
    }
    async updateStatuses(_updates, _user) {
        (0, http_error_1.throwError)('CHECKLIST_AUTOMATIC_ONLY');
    }
    getScopeConstraints(user) {
        if (!user)
            return {};
        return {
            localityId: user.localityId ?? undefined,
            specialtyId: user.specialtyId ?? undefined,
            eloRoleId: user.eloRoleId ?? undefined,
        };
    }
    assertConstraints(specialtyId, user) {
        const constraints = this.getScopeConstraints(user);
        if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    aggregateTaskStatus(statuses) {
        if (statuses.length === 0)
            return client_1.ChecklistItemStatusType.NOT_STARTED;
        const anyDone = statuses.some((status) => status === client_1.TaskStatus.DONE);
        if (anyDone)
            return client_1.ChecklistItemStatusType.DONE;
        const anyProgress = statuses.some((status) => [client_1.TaskStatus.STARTED, client_1.TaskStatus.IN_PROGRESS, client_1.TaskStatus.BLOCKED].includes(status));
        if (anyProgress)
            return client_1.ChecklistItemStatusType.IN_PROGRESS;
        return client_1.ChecklistItemStatusType.NOT_STARTED;
    }
    aggregateActivityStatus(statuses) {
        if (statuses.length === 0)
            return client_1.ChecklistItemStatusType.NOT_STARTED;
        const anyDone = statuses.some((status) => status === client_1.ActivityStatus.DONE);
        if (anyDone)
            return client_1.ChecklistItemStatusType.DONE;
        const anyProgress = statuses.some((status) => [client_1.ActivityStatus.IN_PROGRESS].includes(status));
        if (anyProgress)
            return client_1.ChecklistItemStatusType.IN_PROGRESS;
        return client_1.ChecklistItemStatusType.NOT_STARTED;
    }
    normalizeChecklistActivityTitle(value) {
        return (value ?? '').trim().toLocaleLowerCase('pt-BR');
    }
};
exports.ChecklistsService = ChecklistsService;
exports.ChecklistsService = ChecklistsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ChecklistsService);
//# sourceMappingURL=checklists.service.js.map