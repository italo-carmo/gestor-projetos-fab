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
const role_access_1 = require("../rbac/role-access");
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
        if (checklists.length === 0) {
            const autoItems = await this.buildAutomaticChecklistItems(localities, filters, constraints);
            const localityProgress = localities.map((locality) => {
                if (autoItems.length === 0)
                    return { localityId: locality.id, percent: 0 };
                const doneCount = autoItems.filter((item) => item.statuses[locality.id] === client_1.ChecklistItemStatusType.DONE).length;
                return {
                    localityId: locality.id,
                    percent: Math.round((doneCount / autoItems.length) * 100),
                };
            });
            return {
                items: autoItems.length
                    ? [
                        {
                            id: 'auto-checklist',
                            title: 'Checklist Automático',
                            phaseId: filters.phaseId ?? null,
                            specialtyId: filters.specialtyId ?? null,
                            eloRoleId: filters.eloRoleId ?? null,
                            eloRole: null,
                            items: autoItems,
                            localityProgress,
                        },
                    ]
                    : [],
                localities,
            };
        }
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
        const selectedEloRoleId = filters.eloRoleId ?? constraints.eloRoleId;
        const selectedSpecialtyId = filters.specialtyId ?? constraints.specialtyId;
        const activities = activityChecklistKeys.size > 0 && localityIds.length > 0
            ? await this.prisma.activity.findMany({
                where: {
                    localityId: { in: localityIds },
                    ...(selectedSpecialtyId
                        ? {
                            OR: [{ specialtyId: null }, { specialtyId: selectedSpecialtyId }],
                        }
                        : {}),
                    ...(selectedEloRoleId
                        ? {
                            responsibles: {
                                some: {
                                    user: { eloRoleId: selectedEloRoleId },
                                },
                            },
                        }
                        : {}),
                },
                select: { title: true, localityId: true, status: true, specialtyId: true },
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
        this.assertConstraints(payload.specialtyId ?? null, payload.eloRoleId ?? null, user);
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
        this.assertConstraints(checklist.specialtyId ?? null, checklist.eloRoleId ?? null, user);
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
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission) {
            return {};
        }
        if (profile.localityAdmin) {
            return {
                localityId: profile.localityId ?? undefined,
                specialtyId: undefined,
                eloRoleId: undefined,
            };
        }
        if (profile.specialtyAdmin) {
            return {
                localityId: profile.localityId ?? undefined,
                specialtyId: profile.groupSpecialtyId ?? undefined,
                eloRoleId: profile.groupEloRoleId ?? undefined,
            };
        }
        return {
            localityId: user.localityId ?? undefined,
            specialtyId: user.specialtyId ?? undefined,
            eloRoleId: user.eloRoleId ?? undefined,
        };
    }
    assertConstraints(specialtyId, eloRoleId, user) {
        const constraints = this.getScopeConstraints(user);
        if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (constraints.eloRoleId && constraints.eloRoleId !== eloRoleId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    aggregateTaskStatus(statuses) {
        if (statuses.length === 0)
            return client_1.ChecklistItemStatusType.NOT_STARTED;
        const allDone = statuses.every((status) => status === client_1.TaskStatus.DONE);
        if (allDone)
            return client_1.ChecklistItemStatusType.DONE;
        const anyProgress = statuses.some((status) => status !== client_1.TaskStatus.NOT_STARTED);
        if (anyProgress)
            return client_1.ChecklistItemStatusType.IN_PROGRESS;
        return client_1.ChecklistItemStatusType.NOT_STARTED;
    }
    aggregateActivityStatus(statuses) {
        if (statuses.length === 0)
            return client_1.ChecklistItemStatusType.NOT_STARTED;
        const allDone = statuses.every((status) => status === client_1.ActivityStatus.DONE);
        if (allDone)
            return client_1.ChecklistItemStatusType.DONE;
        const anyProgress = statuses.some((status) => [client_1.ActivityStatus.IN_PROGRESS, client_1.ActivityStatus.DONE, client_1.ActivityStatus.CANCELLED].includes(status));
        if (anyProgress)
            return client_1.ChecklistItemStatusType.IN_PROGRESS;
        return client_1.ChecklistItemStatusType.NOT_STARTED;
    }
    normalizeChecklistActivityTitle(value) {
        return (value ?? '').trim().toLocaleLowerCase('pt-BR');
    }
    async buildAutomaticChecklistItems(localities, filters, constraints) {
        const localityIds = localities.map((locality) => locality.id);
        if (localityIds.length === 0)
            return [];
        const selectedEloRoleId = filters.eloRoleId ?? constraints.eloRoleId;
        const selectedSpecialtyId = filters.specialtyId ?? constraints.specialtyId;
        const taskInstances = await this.prisma.taskInstance.findMany({
            where: {
                localityId: { in: localityIds },
                ...(selectedSpecialtyId || selectedEloRoleId
                    ? {
                        AND: [
                            ...(selectedSpecialtyId
                                ? [{ OR: [{ specialtyId: null }, { specialtyId: selectedSpecialtyId }] }]
                                : []),
                            ...(selectedEloRoleId
                                ? [{ OR: [{ eloRoleId: selectedEloRoleId }, { taskTemplate: { eloRoleId: selectedEloRoleId } }] }]
                                : []),
                        ],
                    }
                    : {}),
                taskTemplate: {
                    ...(filters.phaseId ? { phaseId: filters.phaseId } : {}),
                },
            },
            select: {
                taskTemplateId: true,
                localityId: true,
                status: true,
                taskTemplate: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });
        const activities = await this.prisma.activity.findMany({
            where: {
                localityId: { in: localityIds },
                ...(selectedSpecialtyId
                    ? {
                        OR: [{ specialtyId: null }, { specialtyId: selectedSpecialtyId }],
                    }
                    : {}),
                ...(selectedEloRoleId
                    ? {
                        responsibles: {
                            some: {
                                user: { eloRoleId: selectedEloRoleId },
                            },
                        },
                    }
                    : {}),
            },
            select: { title: true, localityId: true, status: true, specialtyId: true },
        });
        const templateById = new Map();
        const taskStatusByTemplateLocality = new Map();
        for (const instance of taskInstances) {
            if (!instance.taskTemplateId || !instance.taskTemplate?.title)
                continue;
            templateById.set(instance.taskTemplateId, instance.taskTemplate.title);
            const key = `${instance.taskTemplateId}:${instance.localityId}`;
            const list = taskStatusByTemplateLocality.get(key) ?? [];
            list.push(instance.status);
            taskStatusByTemplateLocality.set(key, list);
        }
        const activityStatusByTitleLocality = new Map();
        for (const activity of activities) {
            const titleKey = this.normalizeChecklistActivityTitle(activity.title);
            const key = `${titleKey}:${activity.localityId}`;
            const list = activityStatusByTitleLocality.get(key) ?? [];
            list.push(activity.status);
            activityStatusByTitleLocality.set(key, list);
        }
        const automaticTaskItems = Array.from(templateById.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([taskTemplateId, title]) => {
            const statusesByLocality = {};
            for (const locality of localities) {
                const key = `${taskTemplateId}:${locality.id}`;
                const statuses = taskStatusByTemplateLocality.get(key) ?? [];
                statusesByLocality[locality.id] = this.aggregateTaskStatus(statuses);
            }
            return {
                id: `auto-task:${taskTemplateId}`,
                title,
                taskTemplateId,
                sourceType: 'TASK',
                statuses: statusesByLocality,
            };
        });
        const activityTitles = Array.from(new Set(activities.map((activity) => this.normalizeChecklistActivityTitle(activity.title)))).filter(Boolean);
        const automaticActivityItems = activityTitles
            .sort((a, b) => a.localeCompare(b))
            .map((titleKey) => {
            const statusesByLocality = {};
            for (const locality of localities) {
                const key = `${titleKey}:${locality.id}`;
                const statuses = activityStatusByTitleLocality.get(key) ?? [];
                statusesByLocality[locality.id] = this.aggregateActivityStatus(statuses);
            }
            return {
                id: `auto-activity:${titleKey}`,
                title: activities.find((item) => this.normalizeChecklistActivityTitle(item.title) === titleKey)?.title ?? titleKey,
                taskTemplateId: null,
                sourceType: 'ACTIVITY',
                statuses: statusesByLocality,
            };
        });
        return [...automaticTaskItems, ...automaticActivityItems];
    }
};
exports.ChecklistsService = ChecklistsService;
exports.ChecklistsService = ChecklistsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ChecklistsService);
//# sourceMappingURL=checklists.service.js.map