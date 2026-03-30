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
const tasks_service_1 = require("../tasks/tasks.service");
const activities_service_1 = require("../activities/activities.service");
const role_access_1 = require("../rbac/role-access");
const priority_localities_1 = require("../common/priority-localities");
let ChecklistsService = class ChecklistsService {
    prisma;
    audit;
    tasks;
    activities;
    constructor(prisma, audit, tasks, activities) {
        this.prisma = prisma;
        this.audit = audit;
        this.tasks = tasks;
        this.activities = activities;
    }
    async list(filters, user) {
        const constraints = this.getScopeConstraints(user);
        const localityWhere = {};
        if (filters.localityId)
            localityWhere.id = filters.localityId;
        if (constraints.localityId)
            localityWhere.id = constraints.localityId;
        const localitiesRaw = await this.prisma.locality.findMany({
            where: localityWhere,
            orderBy: { name: 'asc' },
        });
        const localityGroups = (0, priority_localities_1.groupTargetLocalities)(localitiesRaw);
        const localities = localityGroups.map((group) => group.canonical);
        const { aliasIdsByCanonicalId } = (0, priority_localities_1.createTargetLocalityAliasMap)(localityGroups);
        const autoItems = await this.buildAutomaticChecklistItems(localities, filters, constraints, aliasIdsByCanonicalId);
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
                        title: 'Tarefas e atividades por localidade',
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
        const checklist = await this.prisma.checklist.findUnique({
            where: { id: checklistId },
        });
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
    async updateStatuses(updates, user) {
        if (!updates?.length) {
            return { updatedTasks: 0, updatedActivities: 0 };
        }
        const normalized = updates
            .map((entry) => ({
            checklistItemId: String(entry.checklistItemId ?? '').trim(),
            localityId: String(entry.localityId ?? '').trim(),
            status: String(entry.status ?? '')
                .trim()
                .toUpperCase(),
        }))
            .filter((entry) => entry.checklistItemId && entry.localityId);
        if (!normalized.length) {
            return { updatedTasks: 0, updatedActivities: 0 };
        }
        const autoUpdates = normalized.filter((entry) => entry.checklistItemId.startsWith('auto-'));
        const dbUpdates = normalized.filter((entry) => !entry.checklistItemId.startsWith('auto-'));
        const itemIds = Array.from(new Set(dbUpdates.map((entry) => entry.checklistItemId)));
        const items = itemIds.length
            ? await this.prisma.checklistItem.findMany({
                where: { id: { in: itemIds } },
                select: {
                    id: true,
                    title: true,
                    taskTemplateId: true,
                },
            })
            : [];
        const itemById = new Map(items.map((item) => [item.id, item]));
        const canonicalLocalityIds = Array.from(new Set(normalized.map((entry) => entry.localityId)));
        const allLocalities = await this.prisma.locality.findMany({
            where: { id: { in: canonicalLocalityIds } },
            select: {
                id: true,
                name: true,
                code: true,
                recruitsFemaleCountCurrent: true,
                updatedAt: true,
            },
        });
        const localityGroups = (0, priority_localities_1.groupTargetLocalities)(allLocalities);
        const { aliasIdsByCanonicalId } = (0, priority_localities_1.createTargetLocalityAliasMap)(localityGroups);
        let updatedTasks = 0;
        let updatedActivities = 0;
        for (const entry of dbUpdates) {
            const item = itemById.get(entry.checklistItemId);
            if (!item)
                continue;
            const targetLocalityIds = aliasIdsByCanonicalId.get(entry.localityId) ?? [
                entry.localityId,
            ];
            const checklistStatus = this.normalizeChecklistTargetStatus(entry.status);
            const targetTaskStatus = this.mapChecklistToTaskStatus(checklistStatus);
            const targetActivityStatus = this.mapChecklistToActivityStatus(checklistStatus);
            if (item.taskTemplateId) {
                const instances = await this.prisma.taskInstance.findMany({
                    where: {
                        taskTemplateId: item.taskTemplateId,
                        localityId: { in: targetLocalityIds },
                    },
                    select: { id: true },
                });
                for (const instance of instances) {
                    await this.tasks.updateStatus(instance.id, targetTaskStatus, user);
                    updatedTasks += 1;
                }
                continue;
            }
            const normalizedTitle = this.normalizeChecklistActivityTitle(item.title);
            const activities = await this.prisma.activity.findMany({
                where: {
                    localityId: { in: targetLocalityIds },
                },
                select: {
                    id: true,
                    title: true,
                },
            });
            for (const activity of activities) {
                if (this.normalizeChecklistActivityTitle(activity.title) !==
                    normalizedTitle) {
                    continue;
                }
                await this.activities.updateStatus(activity.id, targetActivityStatus, user);
                updatedActivities += 1;
            }
        }
        for (const entry of autoUpdates) {
            const checklistStatus = this.normalizeChecklistTargetStatus(entry.status);
            const targetTaskStatus = this.mapChecklistToTaskStatus(checklistStatus);
            const targetActivityStatus = this.mapChecklistToActivityStatus(checklistStatus);
            const targetLocalityIds = aliasIdsByCanonicalId.get(entry.localityId) ?? [
                entry.localityId,
            ];
            if (entry.checklistItemId.startsWith('auto-task:')) {
                const taskTemplateId = entry.checklistItemId.slice('auto-task:'.length);
                if (!taskTemplateId)
                    continue;
                const instances = await this.prisma.taskInstance.findMany({
                    where: {
                        taskTemplateId,
                        localityId: { in: targetLocalityIds },
                    },
                    select: { id: true },
                });
                for (const instance of instances) {
                    await this.tasks.updateStatus(instance.id, targetTaskStatus, user);
                    updatedTasks += 1;
                }
                continue;
            }
            if (entry.checklistItemId.startsWith('auto-activity:')) {
                const titleKey = entry.checklistItemId.slice('auto-activity:'.length);
                if (!titleKey)
                    continue;
                const activities = await this.prisma.activity.findMany({
                    where: {
                        localityId: { in: targetLocalityIds },
                    },
                    select: {
                        id: true,
                        title: true,
                    },
                });
                for (const activity of activities) {
                    if (this.normalizeChecklistActivityTitle(activity.title) !== titleKey) {
                        continue;
                    }
                    await this.activities.updateStatus(activity.id, targetActivityStatus, user);
                    updatedActivities += 1;
                }
            }
        }
        return { updatedTasks, updatedActivities };
    }
    normalizeChecklistTargetStatus(rawStatus) {
        const value = String(rawStatus ?? '')
            .trim()
            .toUpperCase();
        if (value === client_1.ChecklistItemStatusType.DONE)
            return client_1.ChecklistItemStatusType.DONE;
        if (value === client_1.ChecklistItemStatusType.IN_PROGRESS)
            return client_1.ChecklistItemStatusType.IN_PROGRESS;
        return client_1.ChecklistItemStatusType.NOT_STARTED;
    }
    mapChecklistToTaskStatus(status) {
        if (status === client_1.ChecklistItemStatusType.DONE)
            return client_1.TaskStatus.DONE;
        if (status === client_1.ChecklistItemStatusType.IN_PROGRESS)
            return client_1.TaskStatus.IN_PROGRESS;
        return client_1.TaskStatus.NOT_STARTED;
    }
    mapChecklistToActivityStatus(status) {
        if (status === client_1.ChecklistItemStatusType.DONE)
            return client_1.ActivityStatus.DONE;
        if (status === client_1.ChecklistItemStatusType.IN_PROGRESS)
            return client_1.ActivityStatus.IN_PROGRESS;
        return client_1.ActivityStatus.NOT_STARTED;
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
        const anyProgress = statuses.some((status) => [
            client_1.ActivityStatus.IN_PROGRESS,
            client_1.ActivityStatus.DONE,
            client_1.ActivityStatus.CANCELLED,
        ].includes(status));
        if (anyProgress)
            return client_1.ChecklistItemStatusType.IN_PROGRESS;
        return client_1.ChecklistItemStatusType.NOT_STARTED;
    }
    normalizeChecklistActivityTitle(value) {
        return (value ?? '').trim().toLocaleLowerCase('pt-BR');
    }
    async buildAutomaticChecklistItems(localities, filters, constraints, aliasIdsByCanonicalId) {
        const canonicalLocalityIds = localities.map((locality) => locality.id);
        if (canonicalLocalityIds.length === 0)
            return [];
        const localityIds = aliasIdsByCanonicalId
            ? Array.from(new Set(canonicalLocalityIds.flatMap((id) => aliasIdsByCanonicalId.get(id) ?? [id])))
            : canonicalLocalityIds;
        const canonicalByAliasId = new Map();
        if (aliasIdsByCanonicalId) {
            for (const [canonicalId, aliases] of aliasIdsByCanonicalId.entries()) {
                for (const aliasId of aliases) {
                    canonicalByAliasId.set(aliasId, canonicalId);
                }
            }
        }
        const selectedEloRoleId = filters.eloRoleId ?? constraints.eloRoleId;
        const selectedSpecialtyId = filters.specialtyId ?? constraints.specialtyId;
        const taskInstances = await this.prisma.taskInstance.findMany({
            where: {
                localityId: { in: localityIds },
                ...(selectedSpecialtyId || selectedEloRoleId
                    ? {
                        AND: [
                            ...(selectedSpecialtyId
                                ? [
                                    {
                                        OR: [
                                            { specialtyId: null },
                                            { specialtyId: selectedSpecialtyId },
                                        ],
                                    },
                                ]
                                : []),
                            ...(selectedEloRoleId
                                ? [
                                    {
                                        OR: [
                                            { eloRoleId: selectedEloRoleId },
                                            { taskTemplate: { eloRoleId: selectedEloRoleId } },
                                        ],
                                    },
                                ]
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
                scope: client_1.ActivityScope.SMIF,
                NOT: {
                    title: { contains: 'CIPAVD', mode: 'insensitive' },
                },
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
            select: {
                title: true,
                localityId: true,
                status: true,
                specialtyId: true,
                activityType: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        const templateById = new Map();
        const taskStatusByTemplateLocality = new Map();
        for (const instance of taskInstances) {
            if (!instance.taskTemplateId || !instance.taskTemplate?.title)
                continue;
            templateById.set(instance.taskTemplateId, instance.taskTemplate.title);
            const canonicalId = canonicalByAliasId.get(instance.localityId) ?? instance.localityId;
            const key = `${instance.taskTemplateId}:${canonicalId}`;
            const list = taskStatusByTemplateLocality.get(key) ?? [];
            list.push(instance.status);
            taskStatusByTemplateLocality.set(key, list);
        }
        const activityStatusByTitleLocality = new Map();
        const activityTypeByTitle = new Map();
        for (const activity of activities) {
            if (!activity.localityId)
                continue;
            const titleKey = this.normalizeChecklistActivityTitle(activity.title);
            const canonicalId = canonicalByAliasId.get(activity.localityId) ?? activity.localityId;
            const key = `${titleKey}:${canonicalId}`;
            const list = activityStatusByTitleLocality.get(key) ?? [];
            list.push(activity.status);
            activityStatusByTitleLocality.set(key, list);
            if (!activityTypeByTitle.has(titleKey)) {
                activityTypeByTitle.set(titleKey, activity.activityType?.name ?? null);
            }
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
            const availabilityByLocality = {};
            for (const locality of localities) {
                const key = `${titleKey}:${locality.id}`;
                const statuses = activityStatusByTitleLocality.get(key) ?? [];
                availabilityByLocality[locality.id] = statuses.length > 0;
                statusesByLocality[locality.id] =
                    this.aggregateActivityStatus(statuses);
            }
            return {
                id: `auto-activity:${titleKey}`,
                title: activities.find((item) => this.normalizeChecklistActivityTitle(item.title) === titleKey)?.title ?? titleKey,
                taskTemplateId: null,
                sourceType: 'ACTIVITY',
                statuses: statusesByLocality,
                availabilityByLocality,
                activityTypeName: activityTypeByTitle.get(titleKey) ?? null,
            };
        })
            .filter((item) => Object.values(item.availabilityByLocality ?? {}).some(Boolean));
        return [...automaticTaskItems, ...automaticActivityItems];
    }
};
exports.ChecklistsService = ChecklistsService;
exports.ChecklistsService = ChecklistsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tasks_service_1.TasksService,
        activities_service_1.ActivitiesService])
], ChecklistsService);
//# sourceMappingURL=checklists.service.js.map