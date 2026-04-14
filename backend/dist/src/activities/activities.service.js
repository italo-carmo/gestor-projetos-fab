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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const pdfkit_1 = __importDefault(require("pdfkit"));
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const sanitize_1 = require("../common/sanitize");
const pagination_1 = require("../common/pagination");
const role_access_1 = require("../rbac/role-access");
const priority_localities_1 = require("../common/priority-localities");
const totp_util_1 = require("../auth/totp.util");
const activityPhotosDir = node_path_1.default.resolve(process.cwd(), 'storage', 'activity-reports');
const scheduleLogoCandidates = [
    node_path_1.default.resolve(process.cwd(), 'frontend', 'public', 'brand', 'cipavd-7.png'),
    node_path_1.default.resolve(process.cwd(), 'public', 'brand', 'cipavd-7.png'),
    node_path_1.default.resolve(process.cwd(), '..', 'frontend', 'public', 'brand', 'cipavd-7.png'),
];
let ActivitiesService = class ActivitiesService {
    prisma;
    audit;
    config;
    constructor(prisma, audit, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.config = config;
    }
    async list(filters, user) {
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const scopeFilter = String(filters.scope ?? '').toUpperCase() === 'CIPAVD'
            ? 'CIPAVD'
            : 'SMIF';
        const targetLocalityIds = scopeFilter === 'SMIF' ? await this.getTargetLocalityIds() : [];
        if (scopeFilter === 'SMIF' && targetLocalityIds.length === 0) {
            return { items: [], page, pageSize, total: 0 };
        }
        const andClauses = [];
        if (scopeFilter === 'SMIF') {
            andClauses.push({ localityId: { in: targetLocalityIds } });
        }
        andClauses.push({ scope: scopeFilter });
        if (filters.localityId)
            andClauses.push({ localityId: filters.localityId });
        if (filters.specialtyId) {
            andClauses.push({
                OR: [
                    { specialtyId: filters.specialtyId },
                    { specialties: { some: { specialtyId: filters.specialtyId } } },
                ],
            });
        }
        if (filters.status)
            andClauses.push({ status: filters.status });
        if (filters.q) {
            andClauses.push({
                OR: [
                    { title: { contains: filters.q, mode: 'insensitive' } },
                    { description: { contains: filters.q, mode: 'insensitive' } },
                ],
            });
        }
        const accessWhere = this.buildActivityAccessWhere(user, 'view');
        if (Object.keys(accessWhere).length > 0) {
            andClauses.push(accessWhere);
        }
        const where = andClauses.length > 0 ? { AND: andClauses } : {};
        const [items, total] = await this.prisma.$transaction([
            this.prisma.activity.findMany({
                where,
                orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
                skip,
                take,
                include: {
                    locality: { select: { id: true, code: true, name: true } },
                    activityType: { select: { id: true, name: true } },
                    specialty: { select: { id: true, name: true, color: true } },
                    specialties: {
                        include: {
                            specialty: { select: { id: true, name: true, color: true } },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    createdBy: { select: { id: true, name: true } },
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
                    report: {
                        include: {
                            photos: {
                                select: {
                                    id: true,
                                    fileName: true,
                                    fileUrl: true,
                                    createdAt: true,
                                },
                                orderBy: { createdAt: 'asc' },
                            },
                            signedBy: { select: { id: true, name: true, email: true } },
                        },
                    },
                },
            }),
            this.prisma.activity.count({ where }),
        ]);
        const withCommentSummary = await this.attachActivityCommentSummary(items, user);
        return {
            items: withCommentSummary.map((item) => this.mapActivity(item, user?.executiveHidePii)),
            page,
            pageSize,
            total,
        };
    }
    async getById(id, user) {
        const normalizedId = String(id ?? '').trim();
        if (!normalizedId)
            (0, http_error_1.throwError)('NOT_FOUND');
        const accessWhere = this.buildActivityAccessWhere(user, 'view');
        const andClauses = [{ id: normalizedId }];
        if (Object.keys(accessWhere).length > 0) {
            andClauses.push(accessWhere);
        }
        const where = andClauses.length > 1 ? { AND: andClauses } : andClauses[0];
        const activity = await this.prisma.activity.findFirst({
            where,
            include: {
                locality: { select: { id: true, code: true, name: true } },
                activityType: { select: { id: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                createdBy: { select: { id: true, name: true } },
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
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        const [withCommentSummary] = await this.attachActivityCommentSummary([activity], user);
        return this.mapActivity(withCommentSummary, user?.executiveHidePii);
    }
    async listResponsibleUsers(filters, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const localityId = String(filters.localityId ?? '').trim();
        const specialtyId = String(filters.specialtyId ?? '').trim();
        const andClauses = [{ isActive: true }];
        if (localityId) {
            andClauses.push({ localityId });
        }
        if (specialtyId) {
            andClauses.push({
                OR: [{ specialtyId: null }, { specialtyId }],
            });
        }
        andClauses.push({ ldapUid: { not: null } });
        const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
        const users = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
            },
            orderBy: { name: 'asc' },
        });
        return {
            items: users.map((item) => ({
                id: item.id,
                name: String(item.name ?? '').trim() ||
                    String(item.email ?? '').trim() ||
                    `Usuário ${item.id.slice(0, 8)}`,
                email: item.email ?? null,
                localityId: item.localityId ?? null,
                specialtyId: item.specialtyId ?? null,
                eloRoleId: item.eloRoleId ?? null,
            })),
        };
    }
    async create(payload, user) {
        const scope = String(payload.scope ?? '').toUpperCase() === 'CIPAVD'
            ? 'CIPAVD'
            : 'SMIF';
        this.assertActivityOperateAccess(scope === 'CIPAVD' ? { scope: 'CIPAVD' } : null, user);
        const normalizedLocalityIds = Array.from(new Set((payload.localityIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        const fallbackLocalityId = payload.localityId ?? user?.localityId ?? null;
        const createLocalityIds = normalizedLocalityIds.length > 0
            ? normalizedLocalityIds
            : [fallbackLocalityId];
        const activitySpecialtyIds = await this.resolveActivitySpecialtyIds({
            specialtyId: payload.specialtyId,
            specialtyIds: payload.specialtyIds,
            fallbackToCommission: true,
        });
        const primarySpecialtyId = activitySpecialtyIds[0] ?? null;
        for (const localityId of createLocalityIds) {
            this.assertScopeConstraint(localityId, primarySpecialtyId, user, activitySpecialtyIds);
        }
        const normalizedResponsibleIds = Array.from(new Set((payload.responsibleUserIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (createLocalityIds.length > 1 && normalizedResponsibleIds.length > 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'responsibleUserIds',
                reason: 'ACTIVITY_RESPONSIBLE_SINGLE_LOCALITY_REQUIRED',
            });
        }
        const singleLocalityId = createLocalityIds.length === 1 ? createLocalityIds[0] : null;
        const activityTypeId = await this.resolveActivityTypeId(payload.activityTypeId);
        const responsibleUserIds = await this.resolveActivityResponsibleIds(singleLocalityId, normalizedResponsibleIds, user);
        const createdItems = await this.prisma.$transaction(createLocalityIds.map((localityId) => this.prisma.activity.create({
            data: {
                title: (0, sanitize_1.sanitizeText)(payload.title),
                description: payload.description
                    ? (0, sanitize_1.sanitizeText)(payload.description)
                    : null,
                localityId,
                activityTypeId: activityTypeId,
                specialtyId: primarySpecialtyId,
                eventDate: payload.eventDate ? new Date(payload.eventDate) : null,
                reportRequired: payload.reportRequired ?? false,
                scope,
                createdById: user?.id ?? null,
                specialties: activitySpecialtyIds.length > 0
                    ? {
                        createMany: {
                            data: activitySpecialtyIds.map((itemId) => ({
                                specialtyId: itemId,
                            })),
                            skipDuplicates: true,
                        },
                    }
                    : undefined,
                responsibles: responsibleUserIds.length > 0
                    ? {
                        create: responsibleUserIds.map((userId) => ({
                            userId,
                            assignedById: user?.id ?? null,
                        })),
                    }
                    : undefined,
            },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                activityType: { select: { id: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                createdBy: { select: { id: true, name: true } },
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
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                        },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        })));
        for (const created of createdItems) {
            await this.audit.log({
                userId: user?.id,
                resource: 'activities',
                action: 'create',
                entityId: created.id,
                localityId: created.localityId ?? undefined,
                diffJson: {
                    title: created.title,
                    reportRequired: created.reportRequired,
                },
            });
        }
        const mapped = createdItems.map((item) => this.mapActivity(item, user?.executiveHidePii));
        const first = mapped[0] ?? null;
        if (!first) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'ACTIVITY_CREATE_FAILED',
            });
        }
        if (mapped.length === 1)
            return first;
        return {
            ...first,
            createdCount: mapped.length,
            createdIds: mapped.map((item) => item.id),
        };
    }
    async update(id, payload, user) {
        const existing = await this.prisma.activity.findUnique({
            where: { id },
            include: {
                responsibles: { select: { userId: true } },
                specialties: { select: { specialtyId: true } },
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(existing, user);
        const localityId = payload.localityId === undefined
            ? existing.localityId
            : payload.localityId;
        const currentSpecialtyIds = this.extractActivitySpecialtyIds(existing);
        const specialtyInputWasProvided = payload.specialtyIds !== undefined || payload.specialtyId !== undefined;
        const activitySpecialtyIds = specialtyInputWasProvided
            ? await this.resolveActivitySpecialtyIds({
                specialtyId: payload.specialtyId,
                specialtyIds: payload.specialtyIds,
                fallbackToCommission: true,
            })
            : currentSpecialtyIds;
        const specialtyId = activitySpecialtyIds[0] ?? null;
        const activityTypeId = await this.resolveActivityTypeId(payload.activityTypeId === undefined
            ? (existing.activityTypeId ?? null)
            : payload.activityTypeId);
        this.assertScopeConstraint(localityId, specialtyId, user, activitySpecialtyIds);
        const responsibleUserIds = await this.resolveActivityResponsibleIds(localityId, payload.responsibleUserIds ??
            (existing.responsibles ?? []).map((entry) => entry.userId), user);
        const updated = await this.prisma.activity.update({
            where: { id },
            data: {
                title: payload.title ? (0, sanitize_1.sanitizeText)(payload.title) : undefined,
                description: payload.description === undefined
                    ? undefined
                    : payload.description === null
                        ? null
                        : (0, sanitize_1.sanitizeText)(payload.description),
                localityId,
                activityTypeId: activityTypeId,
                specialtyId,
                eventDate: payload.eventDate === undefined
                    ? undefined
                    : payload.eventDate === null
                        ? null
                        : new Date(payload.eventDate),
                reportRequired: payload.reportRequired ?? undefined,
                specialties: {
                    deleteMany: {},
                    ...(activitySpecialtyIds.length > 0
                        ? {
                            createMany: {
                                data: activitySpecialtyIds.map((itemId) => ({
                                    specialtyId: itemId,
                                })),
                                skipDuplicates: true,
                            },
                        }
                        : {}),
                },
                responsibles: {
                    deleteMany: {},
                    ...(responsibleUserIds.length > 0
                        ? {
                            create: responsibleUserIds.map((userId) => ({
                                userId,
                                assignedById: user?.id ?? null,
                            })),
                        }
                        : {}),
                },
            },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                activityType: { select: { id: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                createdBy: { select: { id: true, name: true } },
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
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                        },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'update',
            entityId: id,
            localityId: updated.localityId ?? undefined,
            diffJson: {
                title: updated.title,
                status: updated.status,
                reportRequired: updated.reportRequired,
            },
        });
        return this.mapActivity(updated, user?.executiveHidePii);
    }
    async updateStatus(id, status, user) {
        const existing = await this.prisma.activity.findUnique({
            where: { id },
            include: {
                responsibles: { select: { userId: true } },
                report: {
                    include: { photos: { select: { id: true } } },
                },
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(existing, user);
        if (status === client_1.ActivityStatus.DONE && existing.reportRequired) {
            if (!existing.report) {
                (0, http_error_1.throwError)('ACTIVITY_REPORT_REQUIRED');
            }
            if (!existing.report.signedAt ||
                !existing.report.signatureHash) {
                (0, http_error_1.throwError)('ACTIVITY_REPORT_SIGNATURE_REQUIRED');
            }
        }
        const updated = await this.prisma.activity.update({
            where: { id },
            data: { status },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                activityType: { select: { id: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                createdBy: { select: { id: true, name: true } },
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
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                        },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'update_status',
            entityId: id,
            localityId: updated.localityId ?? undefined,
            diffJson: { status },
        });
        return this.mapActivity(updated, user?.executiveHidePii);
    }
    async delete(id, user) {
        const existing = await this.prisma.activity.findUnique({
            where: { id },
            include: {
                report: {
                    include: {
                        photos: {
                            select: { id: true, storageKey: true, fileUrl: true },
                        },
                    },
                },
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertDeleteAccess(user);
        const photos = existing.report?.photos ?? [];
        await this.prisma.$transaction(async (tx) => {
            if (existing.report) {
                await tx.activityReportPhoto.deleteMany({
                    where: { reportId: existing.report.id },
                });
                await tx.activityReport.delete({
                    where: { id: existing.report.id },
                });
            }
            await tx.activity.delete({ where: { id } });
        });
        for (const photo of photos) {
            const storageKey = photo.storageKey ?? node_path_1.default.basename(photo.fileUrl ?? '');
            if (!storageKey)
                continue;
            const filePath = node_path_1.default.join(activityPhotosDir, storageKey);
            try {
                if (node_fs_1.default.existsSync(filePath)) {
                    node_fs_1.default.unlinkSync(filePath);
                }
            }
            catch {
            }
        }
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'delete',
            entityId: id,
            localityId: existing.localityId ?? undefined,
            diffJson: {
                title: existing.title,
                localityId: existing.localityId ?? null,
                specialtyId: existing.specialtyId ?? null,
            },
        });
        return { ok: true };
    }
    async batchUpdateStatus(ids, status, user) {
        this.assertActivityOperateAccess(null, user);
        const normalizedIds = this.normalizeActivityIds(ids);
        if (!normalizedIds.length)
            return { updated: 0 };
        if (!Object.values(client_1.ActivityStatus).includes(status)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'status',
                reason: 'INVALID',
            });
        }
        const existing = await this.prisma.activity.findMany({
            where: { id: { in: normalizedIds } },
            select: {
                id: true,
                localityId: true,
                reportRequired: true,
                report: {
                    select: {
                        id: true,
                        signedAt: true,
                        signatureHash: true,
                    },
                },
            },
        });
        if (!existing.length)
            return { updated: 0 };
        for (const activity of existing) {
            this.assertActivityOperateAccess(activity, user);
            if (status === client_1.ActivityStatus.DONE && activity.reportRequired) {
                if (!activity.report) {
                    (0, http_error_1.throwError)('ACTIVITY_REPORT_REQUIRED');
                }
                if (!activity.report.signedAt ||
                    !activity.report.signatureHash) {
                    (0, http_error_1.throwError)('ACTIVITY_REPORT_SIGNATURE_REQUIRED');
                }
            }
        }
        const targetIds = existing.map((item) => item.id);
        await this.prisma.activity.updateMany({
            where: { id: { in: targetIds } },
            data: { status },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'batch_update_status',
            diffJson: {
                count: targetIds.length,
                status,
                ids: targetIds,
            },
        });
        return { updated: targetIds.length };
    }
    async batchUpdateSpecialty(ids, specialtyIdsInput, user) {
        this.assertActivityOperateAccess(null, user);
        const normalizedIds = this.normalizeActivityIds(ids);
        if (!normalizedIds.length)
            return { updated: 0 };
        const specialtyIds = await this.resolveActivitySpecialtyIds({
            specialtyIds: specialtyIdsInput,
            fallbackToCommission: true,
        });
        const primarySpecialtyId = specialtyIds[0] ?? null;
        const existing = await this.prisma.activity.findMany({
            where: { id: { in: normalizedIds } },
            select: {
                id: true,
                localityId: true,
            },
        });
        if (!existing.length)
            return { updated: 0 };
        for (const activity of existing) {
            this.assertActivityOperateAccess(activity, user);
            this.assertScopeConstraint(activity.localityId, primarySpecialtyId, user, specialtyIds);
        }
        const targetIds = existing.map((item) => item.id);
        await this.prisma.$transaction(async (tx) => {
            for (const targetId of targetIds) {
                await tx.activity.update({
                    where: { id: targetId },
                    data: {
                        specialtyId: primarySpecialtyId,
                        specialties: {
                            deleteMany: {},
                            ...(specialtyIds.length > 0
                                ? {
                                    createMany: {
                                        data: specialtyIds.map((itemId) => ({
                                            specialtyId: itemId,
                                        })),
                                        skipDuplicates: true,
                                    },
                                }
                                : {}),
                        },
                    },
                });
            }
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'batch_update_specialty',
            diffJson: {
                count: targetIds.length,
                specialtyIds,
                specialtyId: primarySpecialtyId,
                ids: targetIds,
            },
        });
        return { updated: targetIds.length };
    }
    async batchUpdateResponsible(ids, responsibleUserId, user) {
        this.assertActivityOperateAccess(null, user);
        const normalizedIds = this.normalizeActivityIds(ids);
        if (!normalizedIds.length)
            return { updated: 0 };
        const existing = await this.prisma.activity.findMany({
            where: { id: { in: normalizedIds } },
            select: {
                id: true,
                localityId: true,
            },
        });
        if (!existing.length)
            return { updated: 0 };
        const responsibleByActivityId = new Map();
        for (const activity of existing) {
            this.assertActivityOperateAccess(activity, user);
            const resolved = responsibleUserId
                ? await this.resolveActivityResponsibleIds(activity.localityId, [responsibleUserId], user)
                : [];
            responsibleByActivityId.set(activity.id, resolved);
        }
        await this.prisma.$transaction(async (tx) => {
            for (const activity of existing) {
                await tx.activityResponsible.deleteMany({
                    where: { activityId: activity.id },
                });
                const responsibleIds = responsibleByActivityId.get(activity.id) ?? [];
                if (responsibleIds.length > 0) {
                    await tx.activityResponsible.createMany({
                        data: responsibleIds.map((candidateId) => ({
                            activityId: activity.id,
                            userId: candidateId,
                            assignedById: user?.id ?? null,
                        })),
                        skipDuplicates: true,
                    });
                }
            }
        });
        const targetIds = existing.map((item) => item.id);
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'batch_update_responsible',
            diffJson: {
                count: targetIds.length,
                responsibleUserId: responsibleUserId ?? null,
                ids: targetIds,
            },
        });
        return { updated: targetIds.length };
    }
    async batchDelete(ids, user) {
        this.assertDeleteAccess(user);
        const normalizedIds = this.normalizeActivityIds(ids);
        if (!normalizedIds.length)
            return { deleted: 0 };
        const existing = await this.prisma.activity.findMany({
            where: { id: { in: normalizedIds } },
            select: {
                id: true,
                report: {
                    select: {
                        photos: {
                            select: { storageKey: true, fileUrl: true },
                        },
                    },
                },
            },
        });
        if (!existing.length)
            return { deleted: 0 };
        const targetIds = existing.map((item) => item.id);
        const photos = existing.flatMap((item) => item.report?.photos ?? []);
        await this.prisma.activity.deleteMany({
            where: { id: { in: targetIds } },
        });
        for (const photo of photos) {
            const storageKey = photo.storageKey ?? node_path_1.default.basename(photo.fileUrl ?? '');
            if (!storageKey)
                continue;
            const filePath = node_path_1.default.join(activityPhotosDir, storageKey);
            try {
                if (node_fs_1.default.existsSync(filePath)) {
                    node_fs_1.default.unlinkSync(filePath);
                }
            }
            catch {
            }
        }
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'batch_delete',
            diffJson: {
                count: targetIds.length,
                ids: targetIds,
            },
        });
        return { deleted: targetIds.length };
    }
    async batchReplicate(ids, targetLocalityIds, options, user) {
        this.assertActivityOperateAccess(null, user);
        const normalizedIds = this.normalizeActivityIds(ids);
        const normalizedTargetLocalityIds = Array.from(new Set((targetLocalityIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (!normalizedIds.length || !normalizedTargetLocalityIds.length) {
            return { created: 0, skippedSameLocality: 0, requestedPairs: 0 };
        }
        const statusMode = options?.statusMode === 'KEEP' ? 'KEEP' : 'RESET';
        const dateMode = options?.dateMode === 'CLEAR' || options?.dateMode === 'SET_DATE'
            ? options.dateMode
            : 'KEEP';
        const targetDate = dateMode === 'SET_DATE' && options?.targetDate
            ? new Date(String(options.targetDate))
            : null;
        const existing = await this.prisma.activity.findMany({
            where: { id: { in: normalizedIds } },
            select: {
                id: true,
                title: true,
                description: true,
                localityId: true,
                activityTypeId: true,
                specialtyId: true,
                eventDate: true,
                status: true,
                reportRequired: true,
                specialties: { select: { specialtyId: true } },
            },
        });
        if (!existing.length) {
            return { created: 0, skippedSameLocality: 0, requestedPairs: 0 };
        }
        const allowedTargetLocalityIds = await this.getTargetLocalityIds();
        const targetLocalities = await this.prisma.locality.findMany({
            where: {
                AND: [
                    { id: { in: normalizedTargetLocalityIds } },
                    { id: { in: allowedTargetLocalityIds } },
                    { catalogType: client_1.LocalityCatalogType.SMIF },
                ],
            },
            select: { id: true },
        });
        if (targetLocalities.length !== normalizedTargetLocalityIds.length) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'targetLocalityIds',
                reason: 'LOCALITY_INVALID',
            });
        }
        for (const activity of existing) {
            const activitySpecialtyIds = this.extractActivitySpecialtyIds(activity);
            this.assertActivityOperateAccess(activity, user);
            this.assertScopeConstraint(activity.localityId, activity.specialtyId, user, activitySpecialtyIds);
            for (const localityId of normalizedTargetLocalityIds) {
                this.assertScopeConstraint(localityId, activity.specialtyId, user, activitySpecialtyIds);
            }
        }
        let skippedSameLocality = 0;
        const clonePayloads = [];
        for (const activity of existing) {
            const specialtyIds = this.extractActivitySpecialtyIds(activity);
            const activityScope = activity.scope === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
            for (const targetLocalityId of normalizedTargetLocalityIds) {
                if (activity.localityId && activity.localityId === targetLocalityId) {
                    skippedSameLocality += 1;
                    continue;
                }
                const eventDate = dateMode === 'CLEAR'
                    ? null
                    : dateMode === 'SET_DATE' && targetDate
                        ? targetDate
                        : (activity.eventDate ?? null);
                clonePayloads.push({
                    title: activity.title,
                    description: activity.description ?? null,
                    localityId: targetLocalityId,
                    activityTypeId: activity.activityTypeId ?? null,
                    specialtyId: (specialtyIds[0] ?? activity.specialtyId ?? null),
                    specialtyIds,
                    eventDate,
                    status: statusMode === 'KEEP'
                        ? activity.status
                        : client_1.ActivityStatus.NOT_STARTED,
                    reportRequired: activity.reportRequired,
                    scope: activityScope,
                    createdById: user?.id ?? null,
                });
            }
        }
        if (!clonePayloads.length) {
            return {
                created: 0,
                skippedSameLocality,
                requestedPairs: existing.length * normalizedTargetLocalityIds.length,
            };
        }
        await this.prisma.$transaction(async (tx) => {
            for (const payload of clonePayloads) {
                await tx.activity.create({
                    data: {
                        title: payload.title,
                        description: payload.description,
                        localityId: payload.localityId,
                        activityTypeId: payload.activityTypeId,
                        specialtyId: payload.specialtyId,
                        eventDate: payload.eventDate,
                        status: payload.status,
                        reportRequired: payload.reportRequired,
                        scope: payload.scope,
                        createdById: payload.createdById,
                        specialties: payload.specialtyIds.length > 0
                            ? {
                                createMany: {
                                    data: payload.specialtyIds.map((itemId) => ({
                                        specialtyId: itemId,
                                    })),
                                    skipDuplicates: true,
                                },
                            }
                            : undefined,
                    },
                });
            }
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'batch_replicate',
            diffJson: {
                sourceCount: existing.length,
                targetLocalityIds: normalizedTargetLocalityIds,
                statusMode,
                dateMode,
                targetDate: targetDate ? targetDate.toISOString().slice(0, 10) : null,
                created: clonePayloads.length,
                skippedSameLocality,
            },
        });
        return {
            created: clonePayloads.length,
            skippedSameLocality,
            requestedPairs: existing.length * normalizedTargetLocalityIds.length,
        };
    }
    async batchReorder(ids, user) {
        this.assertActivityOperateAccess(null, user);
        const normalizedIds = this.normalizeActivityIds(ids);
        if (!normalizedIds.length)
            return { updated: 0 };
        const existing = await this.prisma.activity.findMany({
            where: { id: { in: normalizedIds } },
            select: { id: true, localityId: true, scope: true },
        });
        if (!existing.length)
            return { updated: 0 };
        for (const activity of existing) {
            this.assertActivityOperateAccess(activity, user);
        }
        const idSet = new Set(existing.map((item) => item.id));
        const orderedIds = normalizedIds.filter((id) => idSet.has(id));
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'batch_reorder',
            diffJson: {
                updated: orderedIds.length,
                ids: orderedIds,
            },
        });
        return { updated: orderedIds.length };
    }
    async listComments(id, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                specialties: { select: { specialtyId: true } },
                responsibles: {
                    select: {
                        userId: true,
                        user: { select: { id: true, specialtyId: true, eloRoleId: true } },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityViewAccess(activity, user);
        const [comments, readState] = await this.prisma.$transaction([
            this.prisma.activityComment.findMany({
                where: { activityId: id },
                include: { author: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            user?.id
                ? this.prisma.activityCommentRead.findUnique({
                    where: { activityId_userId: { activityId: id, userId: user.id } },
                })
                : this.prisma.activityCommentRead.findFirst({
                    where: { activityId: id, userId: '__none__' },
                }),
        ]);
        const seenAt = readState?.seenAt ?? null;
        const unread = user?.id
            ? comments.filter((comment) => comment.authorId !== user.id &&
                (!seenAt || comment.createdAt > seenAt)).length
            : 0;
        return {
            items: comments.map((comment) => this.mapComment(comment, user?.executiveHidePii)),
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
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                specialties: { select: { specialtyId: true } },
                responsibles: {
                    select: {
                        userId: true,
                        user: { select: { id: true, specialtyId: true, eloRoleId: true } },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        const normalized = this.sanitizeCommentText(text);
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'text',
                reason: 'COMMENT_REQUIRED',
            });
        }
        const created = await this.prisma.activityComment.create({
            data: {
                activityId: id,
                authorId: user.id,
                text: normalized,
            },
            include: { author: { select: { id: true, name: true, email: true } } },
        });
        await this.prisma.activityCommentRead.upsert({
            where: { activityId_userId: { activityId: id, userId: user.id } },
            update: { seenAt: new Date() },
            create: { activityId: id, userId: user.id, seenAt: new Date() },
        });
        await this.audit.log({
            userId: user.id,
            resource: 'activity_comments',
            action: 'create',
            entityId: created.id,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId: id },
        });
        return this.mapComment(created, user?.executiveHidePii);
    }
    async markCommentsSeen(id, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                specialties: { select: { specialtyId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityViewAccess(activity, user);
        const seenAt = new Date();
        await this.prisma.activityCommentRead.upsert({
            where: { activityId_userId: { activityId: id, userId: user.id } },
            update: { seenAt },
            create: { activityId: id, userId: user.id, seenAt },
        });
        return { ok: true, seenAt };
    }
    async listSchedule(activityId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: {
                id: true,
                title: true,
                eventDate: true,
                localityId: true,
                specialtyId: true,
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                responsibles: {
                    select: {
                        userId: true,
                        user: { select: { id: true, specialtyId: true, eloRoleId: true } },
                    },
                },
                locality: { select: { id: true, code: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityViewAccess(activity, user);
        const items = await this.prisma.activityVisitScheduleItem.findMany({
            where: { activityId },
            orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
        });
        return {
            activity: {
                id: activity.id,
                title: activity.title,
                eventDate: activity.eventDate,
                locality: activity.locality,
                specialty: activity.specialty,
                specialties: this.mapActivitySpecialties(activity),
            },
            items: items.map((item) => this.mapScheduleItem(item)),
        };
    }
    async createScheduleItem(activityId, payload, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                specialties: { select: { specialtyId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        const created = await this.prisma.activityVisitScheduleItem.create({
            data: {
                activityId,
                title: this.sanitizeRequiredText(payload.title, 'title'),
                startTime: this.normalizeScheduleTime(payload.startTime),
                durationMinutes: this.normalizeDurationMinutes(payload.durationMinutes),
                location: this.sanitizeRequiredText(payload.location, 'location'),
                responsible: this.sanitizeRequiredText(payload.responsible, 'responsible'),
                participants: this.sanitizeRequiredText(payload.participants, 'participants'),
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'create_schedule_item',
            entityId: created.id,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId, startTime: created.startTime },
        });
        return this.mapScheduleItem(created);
    }
    async updateScheduleItem(activityId, itemId, payload, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                specialties: { select: { specialtyId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        const existing = await this.prisma.activityVisitScheduleItem.findFirst({
            where: { id: itemId, activityId },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const updated = await this.prisma.activityVisitScheduleItem.update({
            where: { id: itemId },
            data: {
                title: payload.title === undefined
                    ? undefined
                    : this.sanitizeRequiredText(payload.title, 'title'),
                startTime: payload.startTime === undefined
                    ? undefined
                    : this.normalizeScheduleTime(payload.startTime),
                durationMinutes: payload.durationMinutes === undefined
                    ? undefined
                    : this.normalizeDurationMinutes(payload.durationMinutes),
                location: payload.location === undefined
                    ? undefined
                    : this.sanitizeRequiredText(payload.location, 'location'),
                responsible: payload.responsible === undefined
                    ? undefined
                    : this.sanitizeRequiredText(payload.responsible, 'responsible'),
                participants: payload.participants === undefined
                    ? undefined
                    : this.sanitizeRequiredText(payload.participants, 'participants'),
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'update_schedule_item',
            entityId: itemId,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId },
        });
        return this.mapScheduleItem(updated);
    }
    async deleteScheduleItem(activityId, itemId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                specialties: { select: { specialtyId: true } },
                responsibles: { select: { userId: true } },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        const existing = await this.prisma.activityVisitScheduleItem.findFirst({
            where: { id: itemId, activityId },
            select: { id: true },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.activityVisitScheduleItem.delete({
            where: { id: itemId },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'delete_schedule_item',
            entityId: itemId,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId },
        });
        return { ok: true };
    }
    async buildSchedulePdf(activityId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                responsibles: {
                    select: {
                        userId: true,
                        user: { select: { id: true, specialtyId: true, eloRoleId: true } },
                    },
                },
                locality: { select: { id: true, code: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                visitScheduleItems: {
                    orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityViewAccess(activity, user);
        const doc = new pdfkit_1.default({ margin: 48, size: 'A4' });
        const chunks = [];
        const done = new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
        });
        const logoPath = this.findScheduleLogoPath();
        if (logoPath) {
            const logoY = doc.y;
            try {
                doc.image(logoPath, (doc.page.width - 150) / 2, logoY, {
                    fit: [150, 150],
                    align: 'center',
                });
                doc.y = logoY + 160;
            }
            catch {
                doc.y = logoY + 8;
            }
        }
        const writeLine = (label, value) => {
            doc.font('Helvetica-Bold').fontSize(10).text(label);
            doc.moveDown(0.2);
            doc
                .font('Helvetica')
                .fontSize(11)
                .text(value || '-', { align: 'left' });
            doc.moveDown(0.7);
        };
        doc
            .font('Helvetica-Bold')
            .fontSize(16)
            .text('Cronograma da Visita', { align: 'center' });
        doc.moveDown(1);
        writeLine('Atividade', activity.title);
        writeLine('Localidade', activity.locality
            ? `${activity.locality.name} (${activity.locality.code})`
            : 'Não vinculada');
        writeLine('Especialidade', this.formatActivitySpecialtiesLabel(activity));
        writeLine('Data da visita', activity.eventDate
            ? this.formatDate(activity.eventDate)
            : 'Não informada');
        doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text('Programação', { underline: true });
        doc.moveDown(0.4);
        if ((activity.visitScheduleItems ?? []).length === 0) {
            doc
                .font('Helvetica')
                .fontSize(11)
                .text('Nenhum item de cronograma cadastrado para esta visita.');
        }
        else {
            (activity.visitScheduleItems ?? []).forEach((item, index) => {
                if (doc.y > doc.page.height - 150) {
                    doc.addPage();
                }
                const rowY = doc.y;
                doc
                    .roundedRect(doc.page.margins.left, rowY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 96, 6)
                    .fillAndStroke('#F5F8FC', '#D7E0EC');
                const blockStart = rowY + 10;
                doc.fillColor('#111827');
                doc
                    .font('Helvetica-Bold')
                    .fontSize(11)
                    .text(`${index + 1}. ${item.startTime} • ${this.formatDuration(item.durationMinutes)}`, doc.page.margins.left + 10, blockStart);
                doc
                    .font('Helvetica')
                    .fontSize(10)
                    .text(`Atividade: ${item.title}`, doc.page.margins.left + 10, blockStart + 18, {
                    width: doc.page.width -
                        doc.page.margins.left -
                        doc.page.margins.right -
                        20,
                })
                    .text(`Local: ${item.location}`, {
                    width: doc.page.width -
                        doc.page.margins.left -
                        doc.page.margins.right -
                        20,
                })
                    .text(`Responsável: ${item.responsible}`, {
                    width: doc.page.width -
                        doc.page.margins.left -
                        doc.page.margins.right -
                        20,
                })
                    .text(`Participantes: ${item.participants}`, {
                    width: doc.page.width -
                        doc.page.margins.left -
                        doc.page.margins.right -
                        20,
                });
                doc.y = rowY + 106;
            });
        }
        doc.end();
        const buffer = await done;
        const sanitizedTitle = activity.title
            .replace(/[^a-zA-Z0-9-_]+/g, '_')
            .slice(0, 60);
        const fileName = `cronograma_visita_${sanitizedTitle || activity.id}.pdf`;
        return { fileName, buffer };
    }
    async upsertReport(activityId, payload, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: { report: true, responsibles: { select: { userId: true } } },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        const reportData = {
            date: new Date(payload.date),
            location: (0, sanitize_1.sanitizeText)(payload.location),
            responsible: (0, sanitize_1.sanitizeText)(payload.responsible),
            missionSupport: (0, sanitize_1.sanitizeText)(payload.activityAnalysis),
            introduction: (0, sanitize_1.sanitizeText)(payload.introduction ?? ''),
            missionObjectives: (0, sanitize_1.sanitizeText)(payload.missionObjectives ?? ''),
            executionSchedule: (0, sanitize_1.sanitizeText)(payload.executionSchedule ?? ''),
            activitiesPerformed: (0, sanitize_1.sanitizeText)(payload.activitiesPerformed),
            participantsCount: Math.max(0, Number(payload.participantsCount) || 0),
            participantsMaleCount: payload.participantsMaleCount != null
                ? Math.max(0, Number(payload.participantsMaleCount) || 0)
                : null,
            participantsFemaleCount: payload.participantsFemaleCount != null
                ? Math.max(0, Number(payload.participantsFemaleCount) || 0)
                : null,
            publicProfile: payload.publicProfile
                ? (0, sanitize_1.sanitizeText)(payload.publicProfile)
                : null,
            instructorsCount: Math.max(0, Number(payload.instructorsCount) || 0),
            recruitsCount: Math.max(0, Number(payload.recruitsCount) || 0),
            eloPsychologyCount: Math.max(0, Number(payload.eloPsychologyCount) || 0),
            eloSocialAssistanceCount: Math.max(0, Number(payload.eloSocialAssistanceCount) || 0),
            eloJuridicoCount: Math.max(0, Number(payload.eloJuridicoCount) || 0),
            eloCpcaCount: Math.max(0, Number(payload.eloCpcaCount) || 0),
            eloGraduadoMasterCount: Math.max(0, Number(payload.eloGraduadoMasterCount) || 0),
            participantsCharacteristics: (0, sanitize_1.sanitizeText)(payload.participantsCharacteristics),
            mainPointsObserved: payload.mainPointsObserved
                ? (0, sanitize_1.sanitizeText)(payload.mainPointsObserved)
                : null,
            attentionPoints: payload.attentionPoints
                ? (0, sanitize_1.sanitizeText)(payload.attentionPoints)
                : null,
            nextSteps: payload.nextSteps ? (0, sanitize_1.sanitizeText)(payload.nextSteps) : null,
            referencesAndAttachments: payload.referencesAndAttachments
                ? (0, sanitize_1.sanitizeText)(payload.referencesAndAttachments)
                : null,
            conclusion: (0, sanitize_1.sanitizeText)(payload.conclusion),
            city: (0, sanitize_1.sanitizeText)(payload.city),
            closingDate: new Date(payload.closingDate),
            signaturePayloadHash: null,
            signatureHash: null,
            signatureAlgorithm: null,
            signatureVersion: null,
            signedAt: null,
            signedById: null,
        };
        if (activity.report) {
            await this.prisma.activityReport.update({
                where: { activityId },
                data: reportData,
            });
        }
        else {
            await this.prisma.activityReport.create({
                data: {
                    activityId,
                    ...reportData,
                },
            });
        }
        const updated = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                activityType: { select: { id: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                createdBy: { select: { id: true, name: true } },
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
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!updated)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'upsert_report',
            entityId: activityId,
            localityId: updated.localityId ?? undefined,
            diffJson: { reportSignedReset: true },
        });
        return this.mapActivity(updated, user?.executiveHidePii);
    }
    async addReportPhoto(activityId, file, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: { report: true, responsibles: { select: { userId: true } } },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const created = await this.prisma.activityReportPhoto.create({
            data: {
                reportId: activity.report.id,
                fileName: file.fileName,
                fileUrl: file.fileUrl,
                storageKey: file.storageKey ?? null,
                mimeType: file.mimeType ?? null,
                fileSize: file.fileSize ?? null,
                checksum: file.checksum ?? null,
            },
        });
        await this.invalidateSignature(activity.report.id);
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'add_report_photo',
            entityId: activityId,
            localityId: activity.localityId ?? undefined,
            diffJson: { photoId: created.id, fileName: created.fileName },
        });
        return created;
    }
    async removeReportPhoto(activityId, photoId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: { report: true, responsibles: { select: { userId: true } } },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const photo = await this.prisma.activityReportPhoto.findFirst({
            where: { id: photoId, reportId: activity.report.id },
        });
        if (!photo)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.activityReportPhoto.delete({ where: { id: photoId } });
        await this.invalidateSignature(activity.report.id);
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'remove_report_photo',
            entityId: activityId,
            localityId: activity.localityId ?? undefined,
            diffJson: { photoId },
        });
        return { ok: true };
    }
    async signReport(activityId, user, totpCode) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        if (!(0, role_access_1.hasPermission)(user, 'reports', 'approve')) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const code = String(totpCode ?? '').replace(/\s/g, '').trim();
        if (!code)
            (0, http_error_1.throwError)('AUTH_2FA_INVALID_CODE');
        const signer = await this.prisma.user.findUnique({
            where: { id: user.id },
            select: { totpSecret: true, totpEnabled: true },
        });
        if (!signer?.totpEnabled || !signer?.totpSecret) {
            (0, http_error_1.throwError)('AUTH_2FA_INVALID_CODE');
        }
        const encKey = this.config.get('TOTP_ENCRYPTION_KEY') ??
            this.config.get('JWT_ACCESS_SECRET') ??
            'fallback-totp-key';
        const secretBase32 = (0, totp_util_1.decryptSecret)(signer.totpSecret, encKey);
        if (!(0, totp_util_1.verifyTotpCode)(secretBase32, code)) {
            (0, http_error_1.throwError)('AUTH_2FA_INVALID_CODE');
        }
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                responsibles: { select: { userId: true } },
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                checksum: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityOperateAccess(activity, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const report = activity.report;
        if (!report.location ||
            !report.responsible ||
            !report.missionSupport ||
            !report.activitiesPerformed ||
            !report.participantsCharacteristics ||
            !report.conclusion ||
            !report.city) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'ACTIVITY_REPORT_INCOMPLETE' });
        }
        const signedAt = new Date();
        const payload = {
            activity: {
                id: activity.id,
                title: activity.title,
                localityId: activity.localityId,
                eventDate: activity.eventDate?.toISOString() ?? null,
            },
            report: {
                date: report.date.toISOString(),
                location: report.location,
                responsible: report.responsible,
                activityAnalysis: report.missionSupport,
                activitiesPerformed: report.activitiesPerformed,
                participantsCount: report.participantsCount,
                instructorsCount: report.instructorsCount ?? 0,
                recruitsCount: report.recruitsCount ?? 0,
                eloPsychologyCount: report.eloPsychologyCount ?? 0,
                eloSocialAssistanceCount: report.eloSocialAssistanceCount ?? 0,
                eloJuridicoCount: report.eloJuridicoCount ?? 0,
                eloCpcaCount: report.eloCpcaCount ?? 0,
                eloGraduadoMasterCount: report.eloGraduadoMasterCount ?? 0,
                participantsCharacteristics: report.participantsCharacteristics,
                conclusion: report.conclusion,
                city: report.city,
                closingDate: report.closingDate.toISOString(),
            },
            photos: report.photos.map((p) => ({
                id: p.id,
                fileName: p.fileName,
                checksum: p.checksum ?? null,
            })),
            signer: {
                userId: user.id,
                signedAt: signedAt.toISOString(),
            },
        };
        const serialized = JSON.stringify(payload);
        const payloadHash = (0, node_crypto_1.createHash)('sha256').update(serialized).digest('hex');
        const secret = this.config.get('ACTIVITY_SIGNATURE_SECRET') ??
            this.config.get('JWT_ACCESS_SECRET') ??
            'smif-activity-signature';
        const signatureHash = (0, node_crypto_1.createHmac)('sha256', secret)
            .update(payloadHash)
            .digest('hex');
        const updated = await this.prisma.activityReport.update({
            where: { id: report.id },
            data: {
                signedAt,
                signedById: user.id,
                signaturePayloadHash: payloadHash,
                signatureHash,
                signatureAlgorithm: 'HMAC-SHA256',
                signatureVersion: 1,
            },
            include: {
                signedBy: { select: { id: true, name: true, email: true } },
                photos: {
                    select: { id: true, fileName: true, fileUrl: true, createdAt: true },
                },
            },
        });
        await this.audit.log({
            userId: user.id,
            resource: 'activities',
            action: 'sign_report',
            entityId: activityId,
            localityId: activity.localityId ?? undefined,
            diffJson: {
                signatureAlgorithm: updated.signatureAlgorithm,
                signatureVersion: updated.signatureVersion,
            },
        });
        return {
            activityId,
            signedAt: updated.signedAt,
            signedBy: updated.signedBy,
            signatureHash: updated.signatureHash,
            signaturePayloadHash: updated.signaturePayloadHash,
            signatureAlgorithm: updated.signatureAlgorithm,
            signatureVersion: updated.signatureVersion,
        };
    }
    async buildReportPdf(activityId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                responsibles: {
                    select: {
                        userId: true,
                        user: { select: { id: true, specialtyId: true, eloRoleId: true } },
                    },
                },
                locality: { select: { id: true, code: true, name: true } },
                specialty: { select: { id: true, name: true, color: true } },
                specialties: {
                    include: {
                        specialty: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                activityType: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                report: {
                    include: {
                        signedBy: { select: { id: true, name: true, email: true } },
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                storageKey: true,
                                fileUrl: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertActivityViewAccess(activity, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const report = activity.report;
        const doc = new pdfkit_1.default({ margin: 44, size: 'A4' });
        const chunks = [];
        const done = new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
        });
        const colors = {
            primary: '#1F365D',
            primarySoft: '#D7E2EF',
            section: '#2B4B75',
            border: '#A9B8C8',
            text: '#1E2A36',
            muted: '#5A6B7D',
            warning: '#B26A00',
        };
        const contentLeft = doc.page.margins.left;
        const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const pageBottomLimit = () => doc.page.height - doc.page.margins.bottom;
        const normalizeText = (value) => String(value ?? '').trim() || '-';
        const sectionGap = 6;
        const ensureSpace = (needed) => {
            if (doc.y + needed <= pageBottomLimit())
                return;
            doc.addPage();
            doc.y = doc.page.margins.top;
        };
        const drawHeader = () => {
            const yearSource = report.closingDate ?? report.date;
            const reportYear = !Number.isNaN(new Date(yearSource).getTime())
                ? new Date(yearSource).getFullYear()
                : new Date().getFullYear();
            const logoPath = this.findScheduleLogoPath();
            const headerY = doc.y;
            if (logoPath) {
                try {
                    doc.image(logoPath, contentLeft, headerY, { fit: [84, 36] });
                }
                catch {
                }
            }
            const barX = contentLeft + (logoPath ? 94 : 0);
            const barW = contentWidth - (logoPath ? 94 : 0);
            const barH = 32;
            doc.save();
            doc.fillColor(colors.primary).rect(barX, headerY, barW, barH).fill();
            doc.restore();
            doc
                .fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .fontSize(13)
                .text(`RELATÓRIO DE ATIVIDADE — CIPAVD / SMIF ${reportYear}`, barX, headerY + 9, {
                width: barW,
                align: 'center',
            });
            doc
                .fillColor(colors.muted)
                .font('Helvetica')
                .fontSize(9)
                .text(`${normalizeText(activity.locality?.name)} • ${normalizeText(this.formatActivitySpecialtiesLabel(activity))}`, contentLeft, headerY + barH + 6, { width: contentWidth, align: 'left' });
            doc.y = headerY + barH + 18;
        };
        const drawSectionTitle = (title) => {
            ensureSpace(26);
            doc.moveDown(0.2);
            const y = doc.y;
            doc
                .fillColor(colors.section)
                .font('Helvetica-Bold')
                .fontSize(10.5)
                .text(title, contentLeft, y, { width: contentWidth, align: 'left' });
            const lineY = y + 15;
            doc
                .strokeColor(colors.section)
                .lineWidth(1)
                .moveTo(contentLeft, lineY)
                .lineTo(contentLeft + contentWidth, lineY)
                .stroke();
            doc.y = lineY + sectionGap;
            doc.fillColor(colors.text);
        };
        const drawTableRow = (cells, opts) => {
            const minHeight = opts?.minHeight ?? 22;
            const ratioSum = cells.reduce((sum, cell) => sum + (cell.ratio ?? 1), 0);
            const horizontalPadding = 6;
            const metrics = cells.map((cell) => {
                const width = (contentWidth * (cell.ratio ?? 1)) / ratioSum;
                const labelWidth = Math.min(124, Math.max(76, width * 0.38));
                const valueWidth = Math.max(40, width - labelWidth - horizontalPadding * 2);
                const labelHeight = doc.heightOfString(normalizeText(cell.label), {
                    width: Math.max(30, labelWidth - horizontalPadding * 2),
                });
                const valueHeight = doc.heightOfString(normalizeText(cell.value), {
                    width: valueWidth,
                    align: 'left',
                });
                return {
                    width,
                    labelWidth,
                    cellHeight: Math.max(minHeight, labelHeight + 8, valueHeight + 8),
                };
            });
            const rowHeight = metrics.reduce((max, metric) => Math.max(max, metric.cellHeight), minHeight);
            ensureSpace(rowHeight + 2);
            const rowY = doc.y;
            let cursorX = contentLeft;
            cells.forEach((cell, index) => {
                const metric = metrics[index];
                const label = normalizeText(cell.label);
                const value = normalizeText(cell.value);
                const valueWidth = metric.width - metric.labelWidth - horizontalPadding * 2;
                doc.save();
                doc
                    .fillColor(colors.primarySoft)
                    .rect(cursorX, rowY, metric.labelWidth, rowHeight)
                    .fill();
                doc.restore();
                doc
                    .strokeColor(colors.border)
                    .lineWidth(0.8)
                    .rect(cursorX, rowY, metric.labelWidth, rowHeight)
                    .stroke();
                doc
                    .strokeColor(colors.border)
                    .lineWidth(0.8)
                    .rect(cursorX + metric.labelWidth, rowY, metric.width - metric.labelWidth, rowHeight)
                    .stroke();
                doc
                    .fillColor(colors.text)
                    .font('Helvetica-Bold')
                    .fontSize(8.8)
                    .text(label, cursorX + horizontalPadding, rowY + 4, {
                    width: Math.max(20, metric.labelWidth - horizontalPadding * 2),
                    align: 'left',
                });
                doc
                    .fillColor(colors.text)
                    .font('Helvetica')
                    .fontSize(9.2)
                    .text(value, cursorX + metric.labelWidth + horizontalPadding, rowY + 4, {
                    width: valueWidth,
                    align: 'left',
                });
                cursorX += metric.width;
            });
            doc.y = rowY + rowHeight + 5;
        };
        const drawNarrativeBlock = (title, content) => {
            const normalizedTitle = normalizeText(title);
            const normalizedContent = normalizeText(content);
            const titleHeight = 17;
            const textPadding = 7;
            const textHeight = doc.heightOfString(normalizedContent, {
                width: contentWidth - textPadding * 2,
                align: 'justify',
            });
            const contentHeight = Math.max(38, textHeight + textPadding * 2);
            ensureSpace(titleHeight + contentHeight + 4);
            const blockY = doc.y;
            doc.save();
            doc
                .fillColor(colors.primarySoft)
                .rect(contentLeft, blockY, contentWidth, titleHeight)
                .fill();
            doc.restore();
            doc
                .strokeColor(colors.border)
                .lineWidth(0.8)
                .rect(contentLeft, blockY, contentWidth, titleHeight)
                .stroke();
            doc
                .fillColor(colors.text)
                .font('Helvetica-Bold')
                .fontSize(9)
                .text(normalizedTitle, contentLeft + 6, blockY + 4, {
                width: contentWidth - 12,
                align: 'left',
            });
            doc
                .strokeColor(colors.border)
                .lineWidth(0.8)
                .rect(contentLeft, blockY + titleHeight, contentWidth, contentHeight)
                .stroke();
            doc
                .fillColor(colors.text)
                .font('Helvetica')
                .fontSize(9.4)
                .text(normalizedContent, contentLeft + textPadding, blockY + titleHeight + textPadding, {
                width: contentWidth - textPadding * 2,
                align: 'justify',
            });
            doc.y = blockY + titleHeight + contentHeight + 6;
        };
        drawHeader();
        drawSectionTitle('1. IDENTIFICAÇÃO DA ATIVIDADE');
        drawTableRow([
            {
                label: 'Tipo de Atividade',
                value: normalizeText(activity.activityType?.name),
            },
        ]);
        drawTableRow([
            { label: 'Título / Tema', value: normalizeText(activity.title) },
        ]);
        drawTableRow([
            { label: 'Data', value: this.formatDate(report.date), ratio: 1 },
            { label: 'Local', value: normalizeText(report.location), ratio: 1 },
        ]);
        drawSectionTitle('2. EQUIPE RESPONSÁVEL');
        drawTableRow([
            { label: 'Responsável(is)', value: normalizeText(report.responsible) },
        ]);
        if (report.missionSupport) {
            drawTableRow([
                {
                    label: 'Apoio à Missão',
                    value: normalizeText(report.missionSupport),
                },
            ]);
        }
        drawSectionTitle('3. PÚBLICO PARTICIPANTE');
        const compositionParts = [];
        if (report.participantsMaleCount != null &&
            report.participantsMaleCount > 0) {
            compositionParts.push(`${report.participantsMaleCount} homens`);
        }
        if (report.participantsFemaleCount != null &&
            report.participantsFemaleCount > 0) {
            compositionParts.push(`${report.participantsFemaleCount} mulheres`);
        }
        drawTableRow([
            {
                label: 'Total de Participantes',
                value: String(report.participantsCount ?? 0),
            },
            {
                label: 'Composição',
                value: compositionParts.length > 0
                    ? compositionParts.join(' e ')
                    : 'Não informada',
            },
        ]);
        drawTableRow([
            {
                label: 'Participantes por Perfil',
                value: `Instrutores: ${report.instructorsCount ?? 0} | ` +
                    `Recrutas: ${report.recruitsCount ?? 0} | ` +
                    `Elo Psicologia: ${report.eloPsychologyCount ?? 0} | ` +
                    `Elo Assistência Social: ${report.eloSocialAssistanceCount ?? 0} | ` +
                    `Elo Jurídico: ${report.eloJuridicoCount ?? 0} | ` +
                    `Elo CPCA: ${report.eloCpcaCount ?? 0} | ` +
                    `Elo Graduado Master: ${report.eloGraduadoMasterCount ?? 0}`,
            },
        ]);
        drawSectionTitle('4. DESCRIÇÃO DA ATIVIDADE');
        if (report.introduction) {
            drawNarrativeBlock('Introdução', report.introduction);
        }
        if (report.missionObjectives) {
            drawNarrativeBlock('Objetivos da Missão', report.missionObjectives);
        }
        if (report.executionSchedule) {
            drawNarrativeBlock('Cronograma de Execução', report.executionSchedule);
        }
        drawNarrativeBlock('Desenvolvimento', report.activitiesPerformed);
        if (report.mainPointsObserved) {
            drawSectionTitle('5. PRINCIPAIS PONTOS OBSERVADOS');
            drawNarrativeBlock('Principais questionamentos levantados pelos participantes', report.mainPointsObserved);
        }
        if (report.attentionPoints) {
            drawSectionTitle('6. PONTOS DE ATENÇÃO');
            drawNarrativeBlock('Lacunas / Riscos / Encaminhamentos necessários', report.attentionPoints);
        }
        if (report.nextSteps) {
            drawSectionTitle('7. ENCAMINHAMENTOS E PRÓXIMOS PASSOS');
            drawNarrativeBlock('Ações previstas', report.nextSteps);
        }
        if (report.referencesAndAttachments) {
            drawSectionTitle('8. REFERÊNCIAS E ANEXOS');
            drawNarrativeBlock('Links e registros', report.referencesAndAttachments);
        }
        if (report.conclusion) {
            drawSectionTitle('CONCLUSÃO');
            drawNarrativeBlock('Síntese conclusiva', report.conclusion);
        }
        drawTableRow([
            {
                label: 'Local e Data',
                value: `${normalizeText(report.city)}, ${this.formatDate(report.closingDate)}`,
            },
            {
                label: 'Responsável pelo Relatório',
                value: normalizeText(report.responsible),
            },
        ]);
        drawSectionTitle('ASSINATURA DIGITAL');
        if (report.signedAt && report.signatureHash) {
            drawTableRow([
                { label: 'Status', value: 'ASSINADO' },
                { label: 'Assinado em', value: this.formatDateTime(report.signedAt) },
            ]);
            drawTableRow([
                {
                    label: 'Assinado por',
                    value: normalizeText(report.signedBy?.name ?? report.signedById),
                },
            ]);
            drawTableRow([
                {
                    label: 'Algoritmo',
                    value: `${report.signatureAlgorithm ?? 'HMAC-SHA256'} v${report.signatureVersion ?? 1}`,
                },
            ]);
            drawNarrativeBlock('Hash de verificação', `Hash da assinatura: ${normalizeText(report.signatureHash)}\n` +
                `Hash do conteúdo: ${normalizeText(report.signaturePayloadHash)}`);
        }
        else {
            drawNarrativeBlock('Status da assinatura', 'NÃO ASSINADO. Este relatório ainda não possui assinatura digital de validação.');
        }
        if (report.photos.length > 0) {
            doc.addPage();
            doc.y = doc.page.margins.top;
            drawSectionTitle('ANEXOS FOTOGRÁFICOS');
            for (const [index, photo] of report.photos.entries()) {
                ensureSpace(262);
                drawTableRow([
                    {
                        label: `Imagem ${index + 1}`,
                        value: normalizeText(photo.fileName),
                    },
                ]);
                const imageY = doc.y;
                const imageHeight = 230;
                const storageKey = photo.storageKey ?? node_path_1.default.basename(photo.fileUrl);
                const filePath = node_path_1.default.join(activityPhotosDir, storageKey);
                doc
                    .strokeColor(colors.border)
                    .lineWidth(0.8)
                    .rect(contentLeft, imageY, contentWidth, imageHeight)
                    .stroke();
                if (node_fs_1.default.existsSync(filePath)) {
                    try {
                        doc.image(filePath, contentLeft + 4, imageY + 4, {
                            fit: [contentWidth - 8, imageHeight - 8],
                            align: 'center',
                            valign: 'center',
                        });
                    }
                    catch {
                        doc
                            .fillColor(colors.warning)
                            .font('Helvetica-Oblique')
                            .fontSize(9.5)
                            .text('(Não foi possível renderizar esta imagem no PDF)', contentLeft + 8, imageY + 12, { width: contentWidth - 16, align: 'left' });
                        doc.fillColor(colors.text);
                    }
                }
                else {
                    doc
                        .fillColor(colors.warning)
                        .font('Helvetica-Oblique')
                        .fontSize(9.5)
                        .text('(Arquivo de imagem não encontrado no armazenamento)', contentLeft + 8, imageY + 12, { width: contentWidth - 16, align: 'left' });
                    doc.fillColor(colors.text);
                }
                doc.y = imageY + imageHeight + 8;
            }
        }
        doc.end();
        const buffer = await done;
        const sanitizedTitle = activity.title
            .replace(/[^a-zA-Z0-9-_]+/g, '_')
            .slice(0, 60);
        const fileName = `relatorio_atividade_${sanitizedTitle || activity.id}.pdf`;
        return { fileName, buffer };
    }
    async attachActivityCommentSummary(items, user) {
        if (!Array.isArray(items) || items.length === 0)
            return items;
        const ids = items.map((item) => item.id);
        const [comments, reads] = await this.prisma.$transaction([
            this.prisma.activityComment.findMany({
                where: { activityId: { in: ids } },
                select: { activityId: true, authorId: true, createdAt: true },
            }),
            user?.id
                ? this.prisma.activityCommentRead.findMany({
                    where: { activityId: { in: ids }, userId: user.id },
                    select: { activityId: true, seenAt: true },
                })
                : this.prisma.activityCommentRead.findMany({
                    where: { activityId: { in: [] } },
                    select: { activityId: true, seenAt: true },
                }),
        ]);
        const seenAtByActivity = new Map();
        for (const read of reads)
            seenAtByActivity.set(read.activityId, read.seenAt);
        const summaryByActivity = new Map();
        for (const id of ids)
            summaryByActivity.set(id, { total: 0, unread: 0, lastCommentAt: null });
        for (const comment of comments) {
            const current = summaryByActivity.get(comment.activityId) ?? {
                total: 0,
                unread: 0,
                lastCommentAt: null,
            };
            current.total += 1;
            if (!current.lastCommentAt || comment.createdAt > current.lastCommentAt) {
                current.lastCommentAt = comment.createdAt;
            }
            if (user?.id && comment.authorId !== user.id) {
                const seenAt = seenAtByActivity.get(comment.activityId);
                if (!seenAt || comment.createdAt > seenAt) {
                    current.unread += 1;
                }
            }
            summaryByActivity.set(comment.activityId, current);
        }
        return items.map((item) => {
            const summary = summaryByActivity.get(item.id) ?? {
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
    mapActivity(activity, executiveHidePii) {
        const { responsibles, ...rest } = activity ?? {};
        const specialties = this.mapActivitySpecialties(activity);
        const primarySpecialty = specialties[0] ?? null;
        const responsibleUsers = Array.isArray(activity?.responsibles)
            ? activity.responsibles
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
        return {
            ...rest,
            specialtyId: primarySpecialty?.id ?? activity?.specialtyId ?? null,
            specialty: primarySpecialty,
            specialtyIds: specialties.map((item) => item.id),
            specialties,
            activityType: activity?.activityType
                ? {
                    id: activity.activityType.id,
                    name: activity.activityType.name,
                }
                : null,
            responsibleUsers: executiveHidePii ? [] : responsibleUsers,
            report: activity.report
                ? {
                    ...activity.report,
                    activityAnalysis: activity.report.missionSupport ?? '',
                    hasSignature: Boolean(activity.report.signedAt && activity.report.signatureHash),
                }
                : null,
        };
    }
    mapActivitySpecialties(activity) {
        const links = Array.isArray(activity?.specialties)
            ? activity.specialties
            : [];
        const fromLinks = links
            .map((entry) => entry?.specialty)
            .filter((entry) => Boolean(entry?.id))
            .map((entry) => ({
            id: String(entry.id),
            name: String(entry.name ?? '').trim() || 'Especialidade',
            color: entry.color ?? null,
        }));
        const fallback = activity?.specialty && String(activity.specialty?.id ?? '').trim()
            ? [
                {
                    id: String(activity.specialty.id),
                    name: String(activity.specialty.name ?? '').trim() || 'Especialidade',
                    color: activity.specialty.color ?? null,
                },
            ]
            : [];
        const merged = [...fromLinks, ...fallback];
        const unique = new Map();
        for (const specialty of merged) {
            if (!specialty.id)
                continue;
            if (!unique.has(specialty.id)) {
                unique.set(specialty.id, specialty);
            }
        }
        return Array.from(unique.values());
    }
    extractActivitySpecialtyIds(activity) {
        const linkIds = Array.isArray(activity?.specialties)
            ? activity.specialties
                .map((entry) => String(entry?.specialtyId ?? '').trim())
                .filter(Boolean)
            : [];
        const fallbackId = String(activity?.specialtyId ?? '').trim();
        const normalized = Array.from(new Set([...linkIds, ...(fallbackId ? [fallbackId] : [])]));
        return normalized;
    }
    formatActivitySpecialtiesLabel(activity) {
        const names = this.mapActivitySpecialties(activity)
            .map((entry) => String(entry.name ?? '').trim())
            .filter(Boolean);
        if (!names.length)
            return 'Comissão CIPAVD';
        return names.join(' / ');
    }
    async listTypes() {
        const items = await this.prisma.activityType.findMany({
            orderBy: { name: 'asc' },
        });
        return { items };
    }
    async createType(name) {
        const normalized = (0, sanitize_1.sanitizeText)(name ?? '');
        if (!normalized.trim()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'name',
                reason: 'REQUIRED',
            });
        }
        const existing = await this.prisma.activityType.findFirst({
            where: { name: { equals: normalized, mode: 'insensitive' } },
            select: { id: true, name: true },
        });
        if (existing)
            return existing;
        return this.prisma.activityType.create({
            data: { name: normalized },
            select: { id: true, name: true },
        });
    }
    mapComment(comment, executiveHidePii) {
        return {
            id: comment.id,
            activityId: comment.activityId,
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
    mapScheduleItem(item) {
        return {
            id: item.id,
            activityId: item.activityId,
            title: item.title,
            startTime: item.startTime,
            durationMinutes: item.durationMinutes,
            location: item.location,
            responsible: item.responsible,
            participants: item.participants,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }
    normalizeScheduleTime(value) {
        const normalized = String(value ?? '').trim();
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'startTime',
                reason: 'TIME_INVALID',
            });
        }
        return normalized;
    }
    normalizeDurationMinutes(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 1) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'durationMinutes',
                reason: 'DURATION_INVALID',
            });
        }
        return Math.round(parsed);
    }
    findScheduleLogoPath() {
        for (const candidate of scheduleLogoCandidates) {
            if (node_fs_1.default.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    formatDuration(minutes) {
        const rounded = Math.max(1, Math.round(minutes));
        const hours = Math.floor(rounded / 60);
        const mins = rounded % 60;
        if (hours <= 0)
            return `${mins} min`;
        if (mins === 0)
            return `${hours}h`;
        return `${hours}h ${mins}min`;
    }
    sanitizeRequiredText(value, field) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized.trim()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
        }
        return normalized;
    }
    sanitizeCommentText(input) {
        return String(input ?? '')
            .replace(/[<>]/g, '')
            .replace(/\r\n/g, '\n')
            .trim();
    }
    normalizeActivityIds(ids) {
        return Array.from(new Set((ids ?? []).map((value) => String(value ?? '').trim()).filter(Boolean)));
    }
    async getTargetLocalityIds() {
        const localities = await this.prisma.locality.findMany({
            where: { catalogType: client_1.LocalityCatalogType.SMIF },
            select: {
                id: true,
                name: true,
                recruitsFemaleCountCurrent: true,
                updatedAt: true,
            },
        });
        return (0, priority_localities_1.selectTargetLocalities)(localities).map((locality) => locality.id);
    }
    getScopeConstraints(user) {
        if (!user)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return {};
        if (profile.localityAdmin) {
            return {
                localityId: profile.localityId ?? undefined,
                specialtyId: undefined,
            };
        }
        if (profile.specialtyAdmin) {
            return {
                localityId: profile.localityId ?? undefined,
                specialtyId: profile.groupSpecialtyId ?? undefined,
            };
        }
        return {
            localityId: user.localityId ?? undefined,
            specialtyId: user.specialtyId ?? undefined,
        };
    }
    assertScopeConstraint(localityId, specialtyId, user, specialtyIds) {
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId &&
            localityId &&
            constraints.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (constraints.specialtyId) {
            const normalizedSpecialtyIds = new Set([
                String(specialtyId ?? '').trim(),
                ...(specialtyIds ?? [])
                    .map((value) => String(value ?? '').trim())
                    .filter(Boolean),
            ].filter(Boolean));
            if (normalizedSpecialtyIds.size > 0 &&
                !normalizedSpecialtyIds.has(constraints.specialtyId)) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
        }
    }
    buildActivityAccessWhere(user, mode) {
        if (!user?.id)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (mode === 'operate') {
            if (profile.ti || profile.nationalCommission)
                return {};
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
                        {
                            specialties: {
                                some: { specialtyId: profile.groupSpecialtyId },
                            },
                        },
                    ],
                });
            }
            if (profile.groupEloRoleId) {
                groupOr.push({
                    responsibles: {
                        some: { user: { eloRoleId: profile.groupEloRoleId } },
                    },
                });
            }
            if (groupOr.length > 0)
                and.push({ OR: groupOr });
            if (and.length === 0)
                return { id: '__forbidden__' };
            return and.length === 1 ? and[0] : { AND: and };
        }
        const viewerOr = [
            { responsibles: { some: { userId: user.id } } },
        ];
        if (user.localityId) {
            const groupOr = [];
            if (user.specialtyId) {
                groupOr.push({
                    OR: [
                        { specialtyId: null },
                        { specialtyId: user.specialtyId },
                        { specialties: { some: { specialtyId: user.specialtyId } } },
                    ],
                });
            }
            if (user.eloRoleId) {
                groupOr.push({
                    responsibles: { some: { user: { eloRoleId: user.eloRoleId } } },
                });
            }
            if (groupOr.length > 0) {
                viewerOr.push({ localityId: user.localityId, OR: groupOr });
            }
        }
        return { OR: viewerOr };
    }
    isActivityResponsible(activity, user) {
        if (!user?.id)
            return false;
        if (Array.isArray(activity?.responsibles)) {
            return activity.responsibles.some((entry) => entry.userId === user.id);
        }
        return false;
    }
    hasActivityGroupMatch(activity, specialtyId, eloRoleId) {
        let specialtyMatch = false;
        if (specialtyId) {
            const activitySpecialtyIds = this.extractActivitySpecialtyIds(activity);
            if (activitySpecialtyIds.length === 0) {
                specialtyMatch = true;
            }
            else {
                specialtyMatch = activitySpecialtyIds.includes(String(specialtyId));
            }
        }
        let eloMatch = false;
        if (eloRoleId && Array.isArray(activity?.responsibles)) {
            eloMatch = activity.responsibles.some((entry) => entry?.user?.eloRoleId === eloRoleId);
        }
        return specialtyMatch || eloMatch;
    }
    assertActivityViewAccess(activity, user) {
        if (!user?.id)
            return;
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return;
        if (profile.localityAdmin) {
            if (!profile.localityId || activity.localityId === profile.localityId)
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (profile.specialtyAdmin) {
            if (profile.localityId && activity.localityId !== profile.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            if (this.hasActivityGroupMatch(activity, profile.groupSpecialtyId, profile.groupEloRoleId))
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (this.isActivityResponsible(activity, user))
            return;
        if (user.localityId &&
            activity.localityId === user.localityId &&
            this.hasActivityGroupMatch(activity, user.specialtyId, user.eloRoleId)) {
            return;
        }
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    assertActivityOperateAccess(activityOrScope, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const scope = activityOrScope?.scope;
        if (scope === 'CIPAVD') {
            if ((0, role_access_1.hasPermission)(user, 'task_instances', 'update'))
                return;
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
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
    async resolveActivitySpecialtyIds(args) {
        const normalized = Array.from(new Set([
            ...(args.specialtyIds ?? [])
                .map((value) => String(value ?? '').trim())
                .filter(Boolean),
            String(args.specialtyId ?? '').trim(),
        ].filter(Boolean)));
        if (normalized.length === 0 && args.fallbackToCommission) {
            const commission = await this.prisma.specialty.findFirst({
                where: {
                    OR: [
                        { name: { equals: 'Comissão CIPAVD', mode: 'insensitive' } },
                        { name: { equals: 'Comissao CIPAVD', mode: 'insensitive' } },
                        { name: { contains: 'Comissão CIPAVD', mode: 'insensitive' } },
                        { name: { contains: 'Comissao CIPAVD', mode: 'insensitive' } },
                    ],
                },
                select: { id: true },
            });
            if (!commission)
                return [];
            normalized.push(commission.id);
        }
        if (normalized.length === 0)
            return [];
        const existing = await this.prisma.specialty.findMany({
            where: { id: { in: normalized } },
            select: { id: true },
        });
        const existingIds = new Set(existing.map((item) => item.id));
        const invalid = normalized.filter((id) => !existingIds.has(id));
        if (invalid.length > 0)
            (0, http_error_1.throwError)('NOT_FOUND');
        return normalized;
    }
    async resolveActivityResponsibleIds(localityId, responsibleUserIds, user) {
        const normalized = Array.from(new Set((responsibleUserIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)));
        if (normalized.length === 0)
            return [];
        if (!localityId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityId',
                reason: 'REQUIRED_FOR_RESPONSIBLES',
            });
        }
        const users = await this.prisma.user.findMany({
            where: { id: { in: normalized }, isActive: true },
            select: { id: true, localityId: true, specialtyId: true },
        });
        if (users.length !== normalized.length) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'ACTIVITY_RESPONSIBLE_INVALID',
            });
        }
        this.assertScopeConstraint(localityId, null, user);
        return users.map((candidate) => candidate.id);
    }
    async resolveActivityTypeId(activityTypeId) {
        const normalized = String(activityTypeId ?? '').trim();
        if (!normalized)
            return null;
        const existing = await this.prisma.activityType.findUnique({
            where: { id: normalized },
            select: { id: true },
        });
        if (!existing) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'activityTypeId',
                reason: 'NOT_FOUND',
            });
        }
        return existing.id;
    }
    async invalidateSignature(reportId) {
        await this.prisma.activityReport.update({
            where: { id: reportId },
            data: {
                signaturePayloadHash: null,
                signatureHash: null,
                signatureAlgorithm: null,
                signatureVersion: null,
                signedAt: null,
                signedById: null,
            },
        });
    }
    formatDate(value) {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(value);
    }
    formatDateTime(value) {
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(value);
    }
};
exports.ActivitiesService = ActivitiesService;
exports.ActivitiesService = ActivitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        config_1.ConfigService])
], ActivitiesService);
//# sourceMappingURL=activities.service.js.map