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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalitiesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const role_access_1 = require("../rbac/role-access");
const prisma_service_1 = require("../prisma/prisma.service");
const sanitize_1 = require("../common/sanitize");
const fab_ldap_service_1 = require("../ldap/fab-ldap.service");
const rbac_service_1 = require("../rbac/rbac.service");
const create_locality_dto_1 = require("./dto/create-locality.dto");
const set_locality_commander_from_ldap_dto_1 = require("./dto/set-locality-commander-from-ldap.dto");
const update_locality_recruit_designations_dto_1 = require("./dto/update-locality-recruit-designations.dto");
const replace_locality_recruits_members_dto_1 = require("./dto/replace-locality-recruits-members.dto");
const update_locality_recruits_dto_1 = require("./dto/update-locality-recruits.dto");
const update_locality_dto_1 = require("./dto/update-locality.dto");
let LocalitiesController = class LocalitiesController {
    prisma;
    fabLdap;
    rbac;
    constructor(prisma, fabLdap, rbac) {
        this.prisma = prisma;
        this.fabLdap = fabLdap;
        this.rbac = rbac;
    }
    async list(user) {
        const canViewAll = (0, role_access_1.isNationalCommissionMember)(user) || (0, role_access_1.hasRole)(user, role_access_1.ROLE_TI);
        const where = !canViewAll && user?.localityId ? { id: user.localityId } : undefined;
        const items = await this.prisma.locality.findMany({ where, orderBy: { name: 'asc' } });
        return { items };
    }
    async listOmsCatalog() {
        const items = await this.prisma.locality.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { name: 'asc' },
        });
        return { items };
    }
    async create(dto) {
        const created = await this.prisma.locality.create({
            data: {
                code: (0, sanitize_1.sanitizeText)(dto.code),
                name: (0, sanitize_1.sanitizeText)(dto.name),
                commandName: dto.commandName ? (0, sanitize_1.sanitizeText)(dto.commandName) : null,
                commanderName: dto.commanderName ? (0, sanitize_1.sanitizeText)(dto.commanderName) : null,
                individualMeetingDate: dto.individualMeetingDate ? new Date(dto.individualMeetingDate) : null,
                visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
                recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? null,
                notes: dto.notes ? (0, sanitize_1.sanitizeText)(dto.notes) : null,
            },
        });
        if (dto.recruitsFemaleCountCurrent && dto.recruitsFemaleCountCurrent > 0) {
            await this.createInitialRecruits(created.id, dto.recruitsFemaleCountCurrent);
            await this.syncLocalityRecruitCount(created.id);
        }
        return created;
    }
    async update(id, dto, user) {
        this.assertLocalityAccess(id, user);
        this.assertRecruitsMutationAccess(id, user, dto.recruitsFemaleCountCurrent);
        if (dto.recruitsFemaleCountCurrent !== undefined && dto.recruitsFemaleCountCurrent !== null) {
            await this.assertRecruitAssignmentsWithinTotal(id, dto.recruitsFemaleCountCurrent);
        }
        const currentLocality = await this.prisma.locality.findUnique({
            where: { id },
            select: { recruitsFemaleCountCurrent: true },
        });
        if (!currentLocality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const updated = await this.prisma.locality.update({
            where: { id },
            data: {
                code: dto.code ? (0, sanitize_1.sanitizeText)(dto.code) : undefined,
                name: dto.name ? (0, sanitize_1.sanitizeText)(dto.name) : undefined,
                commandName: dto.commandName ? (0, sanitize_1.sanitizeText)(dto.commandName) : dto.commandName === null ? null : undefined,
                commanderName: dto.commanderName ? (0, sanitize_1.sanitizeText)(dto.commanderName) : dto.commanderName === null ? null : undefined,
                individualMeetingDate: dto.individualMeetingDate ? new Date(dto.individualMeetingDate) : dto.individualMeetingDate === null ? null : undefined,
                visitDate: dto.visitDate ? new Date(dto.visitDate) : dto.visitDate === null ? null : undefined,
                recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? undefined,
                notes: dto.notes ? (0, sanitize_1.sanitizeText)(dto.notes) : dto.notes === null ? null : undefined,
            },
        });
        if (dto.recruitsFemaleCountCurrent !== undefined && dto.recruitsFemaleCountCurrent !== null) {
            const currentActiveCount = await this.prisma.recruitFemale.count({
                where: {
                    localityId: id,
                    status: {
                        in: [client_1.RecruitFemaleStatus.RECRUITMENT_TO_START, client_1.RecruitFemaleStatus.RECRUITMENT_STARTED],
                    },
                },
            });
            const targetCount = dto.recruitsFemaleCountCurrent;
            if (targetCount > currentActiveCount) {
                await this.createInitialRecruits(id, targetCount - currentActiveCount);
            }
            await this.syncLocalityRecruitCount(id);
            await this.registerRecruitsHistory(id, dto.recruitsFemaleCountCurrent, currentLocality.recruitsFemaleCountCurrent ?? 0, null);
        }
        return updated;
    }
    async updateRecruits(id, dto, user) {
        this.assertRecruitsMutationAccess(id, user, dto.recruitsFemaleCountCurrent);
        await this.assertRecruitAssignmentsWithinTotal(id, dto.recruitsFemaleCountCurrent);
        const currentLocality = await this.prisma.locality.findUnique({
            where: { id },
            select: { recruitsFemaleCountCurrent: true },
        });
        if (!currentLocality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const previousCount = currentLocality.recruitsFemaleCountCurrent ?? 0;
        const currentActiveCount = await this.prisma.recruitFemale.count({
            where: {
                localityId: id,
                status: {
                    in: [client_1.RecruitFemaleStatus.RECRUITMENT_TO_START, client_1.RecruitFemaleStatus.RECRUITMENT_STARTED],
                },
            },
        });
        const targetCount = dto.recruitsFemaleCountCurrent;
        if (targetCount > currentActiveCount) {
            await this.createInitialRecruits(id, targetCount - currentActiveCount);
        }
        else if (targetCount < currentActiveCount) {
            const toRemove = currentActiveCount - targetCount;
            const activeRecruits = await this.prisma.recruitFemale.findMany({
                where: {
                    localityId: id,
                    status: {
                        in: [client_1.RecruitFemaleStatus.RECRUITMENT_TO_START, client_1.RecruitFemaleStatus.RECRUITMENT_STARTED],
                    },
                },
                orderBy: { createdAt: 'asc' },
                take: toRemove,
            });
            if (activeRecruits.length > 0) {
                const dismissalReason = dto.dismissalReason ? (0, sanitize_1.sanitizeText)(dto.dismissalReason).trim() : null;
                if (!dismissalReason) {
                    (0, http_error_1.throwError)('VALIDATION_ERROR', {
                        field: 'dismissalReason',
                        reason: 'DISMISSAL_REASON_REQUIRED',
                    });
                }
                const now = new Date();
                await this.prisma.recruitFemale.updateMany({
                    where: {
                        id: { in: activeRecruits.map((r) => r.id) },
                    },
                    data: {
                        status: client_1.RecruitFemaleStatus.DISMISSED,
                        dismissalReason,
                        dismissedAt: now,
                        destinationLocalityId: null,
                        designatedAt: null,
                    },
                });
            }
        }
        await this.syncLocalityRecruitCount(id);
        const updated = await this.prisma.locality.findUnique({
            where: { id },
            select: { recruitsFemaleCountCurrent: true },
        });
        await this.registerRecruitsHistory(id, updated?.recruitsFemaleCountCurrent ?? targetCount, previousCount, dto.dismissalReason ?? null, true);
        return updated ?? { id, recruitsFemaleCountCurrent: targetCount };
    }
    async listRecruitDesignations(id, user) {
        this.assertRecruitsEditorAccess(id, user);
        return this.buildRecruitDesignationsResponse(id);
    }
    async listRecruitMembers(id, user) {
        this.assertRecruitsEditorAccess(id, user);
        return this.buildRecruitMembersResponse(id);
    }
    async replaceRecruitMembers(id, dto, user) {
        this.assertRecruitsEditorAccess(id, user);
        const sourceLocality = await this.prisma.locality.findUnique({
            where: { id },
            select: { id: true, recruitsFemaleCountCurrent: true },
        });
        if (!sourceLocality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const previousCount = sourceLocality.recruitsFemaleCountCurrent ?? 0;
        const incoming = dto.items ?? [];
        const incomingIds = incoming
            .map((item) => String(item.id ?? '').trim())
            .filter(Boolean);
        const existingMembers = await this.prisma.recruitFemale.findMany({
            where: { localityId: id },
            select: {
                id: true,
                status: true,
                dismissedAt: true,
                designatedAt: true,
            },
        });
        const existingById = new Map(existingMembers.map((item) => [item.id, item]));
        const hasUnknownId = incomingIds.some((memberId) => !existingById.has(memberId));
        if (hasUnknownId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'items',
                reason: 'RECRUIT_MEMBER_INVALID_ID',
            });
        }
        const destinationIds = Array.from(new Set(incoming
            .map((item) => String(item.destinationLocalityId ?? '').trim())
            .filter(Boolean)));
        if (destinationIds.length > 0) {
            const destinations = await this.prisma.locality.findMany({
                where: { id: { in: destinationIds } },
                select: { id: true },
            });
            if (destinations.length !== destinationIds.length) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', {
                    field: 'items',
                    reason: 'RECRUIT_MEMBER_INVALID_DESTINATION',
                });
            }
        }
        const now = new Date();
        const dismissedReasons = [];
        await this.prisma.$transaction(async (tx) => {
            for (const item of incoming) {
                const memberId = String(item.id ?? '').trim();
                const existing = memberId ? existingById.get(memberId) : null;
                const name = (0, sanitize_1.sanitizeText)(String(item.name ?? '').trim());
                if (!name) {
                    (0, http_error_1.throwError)('VALIDATION_ERROR', {
                        field: 'items.name',
                        reason: 'required',
                    });
                }
                const nextStatus = item.status;
                const dismissalReasonRaw = (0, sanitize_1.sanitizeText)(String(item.dismissalReason ?? '').trim());
                const dismissalReason = dismissalReasonRaw || null;
                const destinationLocalityId = (0, sanitize_1.sanitizeText)(String(item.destinationLocalityId ?? '').trim()) || null;
                if (nextStatus === client_1.RecruitFemaleStatus.DISMISSED && !dismissalReason) {
                    (0, http_error_1.throwError)('VALIDATION_ERROR', {
                        field: 'items.dismissalReason',
                        reason: 'DISMISSAL_REASON_REQUIRED',
                    });
                }
                if (nextStatus === client_1.RecruitFemaleStatus.ASSIGNED_TO_OM &&
                    !destinationLocalityId) {
                    (0, http_error_1.throwError)('VALIDATION_ERROR', {
                        field: 'items.destinationLocalityId',
                        reason: 'DESTINATION_REQUIRED',
                    });
                }
                const isDismissTransition = nextStatus === client_1.RecruitFemaleStatus.DISMISSED &&
                    existing?.status !== client_1.RecruitFemaleStatus.DISMISSED;
                if (isDismissTransition && dismissalReason) {
                    dismissedReasons.push(dismissalReason);
                }
                const payload = {
                    id: memberId || `rf_${(0, crypto_1.randomUUID)().replace(/-/g, '')}`,
                    localityId: id,
                    name,
                    status: nextStatus,
                    dismissalReason: nextStatus === client_1.RecruitFemaleStatus.DISMISSED ? dismissalReason : null,
                    dismissedAt: nextStatus === client_1.RecruitFemaleStatus.DISMISSED
                        ? existing?.dismissedAt ?? now
                        : null,
                    destinationLocalityId: nextStatus === client_1.RecruitFemaleStatus.ASSIGNED_TO_OM
                        ? destinationLocalityId
                        : null,
                    designatedAt: nextStatus === client_1.RecruitFemaleStatus.ASSIGNED_TO_OM
                        ? existing?.designatedAt ?? now
                        : null,
                    createdAt: now,
                    updatedAt: now,
                };
                await tx.recruitFemale.upsert({
                    where: { id: payload.id },
                    create: payload,
                    update: {
                        name: payload.name,
                        status: payload.status,
                        dismissalReason: payload.dismissalReason,
                        dismissedAt: payload.dismissedAt,
                        destinationLocalityId: payload.destinationLocalityId,
                        designatedAt: payload.designatedAt,
                    },
                });
            }
        });
        await this.syncLocalityRecruitCount(id);
        const localityAfter = await this.prisma.locality.findUnique({
            where: { id },
            select: { recruitsFemaleCountCurrent: true },
        });
        const nextCount = localityAfter?.recruitsFemaleCountCurrent ?? 0;
        if (nextCount !== previousCount) {
            await this.registerRecruitsHistory(id, nextCount, previousCount, dismissedReasons.length ? dismissedReasons.join('; ') : null, false);
        }
        return this.buildRecruitMembersResponse(id);
    }
    async setCommanderFromLdap(id, dto, user) {
        this.assertRecruitsEditorAccess(id, user);
        const locality = await this.prisma.locality.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
        if (!locality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const identifier = String(dto.uidOrEmail ?? '').trim();
        if (!identifier) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'uidOrEmail',
                reason: 'LDAP_IDENTIFIER_REQUIRED',
            });
        }
        const profile = identifier.includes('@')
            ? await this.fabLdap.lookupByEmail(identifier)
            : await this.fabLdap.lookupByUid(identifier);
        if (!profile) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'uidOrEmail',
                reason: 'LDAP_USER_NOT_FOUND',
            });
        }
        const commanderName = (0, sanitize_1.sanitizeText)(profile.name ?? '');
        if (!commanderName) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'uidOrEmail',
                reason: 'LDAP_USER_NAME_NOT_FOUND',
            });
        }
        const gsdRole = await this.prisma.role.findFirst({
            where: { name: role_access_1.ROLE_GSD_LOCALIDADE },
            select: { id: true },
        });
        if (!gsdRole) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'GSD_ROLE_NOT_FOUND',
            });
        }
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ ldapUid: profile.uid }, { email: profile.email }],
            },
            include: {
                roles: {
                    include: { role: { select: { id: true, name: true } } },
                },
            },
        });
        if (existingUser) {
            const hasGsdRole = existingUser.roles.some((ur) => ur.role.id === gsdRole.id || ur.role.name === role_access_1.ROLE_GSD_LOCALIDADE);
            if (!hasGsdRole) {
                await this.prisma.userRole.create({
                    data: { userId: existingUser.id, roleId: gsdRole.id },
                });
            }
            if (existingUser.localityId !== id) {
                await this.prisma.user.update({
                    where: { id: existingUser.id },
                    data: { localityId: id },
                });
            }
        }
        else {
            await this.rbac.upsertLdapUser({
                uid: profile.uid,
                roleIds: [gsdRole.id],
                localityId: id,
                replaceExistingRoles: false,
            }, user.id);
        }
        const updated = await this.prisma.locality.update({
            where: { id },
            data: { commanderName },
            select: { id: true, commanderName: true },
        });
        return {
            localityId: updated.id,
            commanderName: updated.commanderName,
            uid: profile.uid,
            fabom: profile.fabom,
            email: profile.email,
        };
    }
    async replaceRecruitDesignations(id, dto, user) {
        this.assertRecruitsEditorAccess(id, user);
        const sourceLocality = await this.prisma.locality.findUnique({
            where: { id },
            select: { id: true, recruitsFemaleCountCurrent: true },
        });
        if (!sourceLocality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const merged = new Map();
        for (const item of dto.items ?? []) {
            const destinationLocalityId = String(item.destinationLocalityId ?? '').trim();
            if (!destinationLocalityId)
                continue;
            const nextCount = Number(item.assignedCount ?? 0);
            if (!Number.isInteger(nextCount) || nextCount <= 0)
                continue;
            merged.set(destinationLocalityId, (merged.get(destinationLocalityId) ?? 0) + nextCount);
        }
        const normalizedItems = Array.from(merged.entries()).map(([destinationLocalityId, assignedCount]) => ({
            destinationLocalityId,
            assignedCount,
        }));
        const totalAssigned = normalizedItems.reduce((acc, item) => acc + item.assignedCount, 0);
        const totalRecruits = sourceLocality.recruitsFemaleCountCurrent ?? 0;
        if (totalAssigned > totalRecruits) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'items',
                reason: 'RECRUIT_OM_ASSIGNMENTS_EXCEED_TOTAL',
                totalAssigned,
                totalRecruits,
            });
        }
        if (normalizedItems.length > 0) {
            const destinationIds = normalizedItems.map((item) => item.destinationLocalityId);
            const destinationLocalities = await this.prisma.locality.findMany({
                where: { id: { in: destinationIds } },
                select: { id: true },
            });
            if (destinationLocalities.length !== destinationIds.length) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', {
                    field: 'items',
                    reason: 'RECRUIT_OM_ASSIGNMENT_INVALID_DESTINATION',
                });
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `DELETE FROM "RecruitOmAssignment" WHERE "sourceLocalityId" = ${id}`;
            if (!normalizedItems.length)
                return;
            const now = new Date();
            const values = normalizedItems.map((item) => client_1.Prisma.sql `(
          ${`rasg_${(0, crypto_1.randomUUID)()}`},
          ${id},
          ${item.destinationLocalityId},
          ${item.assignedCount},
          ${now},
          ${now}
        )`);
            await tx.$executeRaw(client_1.Prisma.sql `
        INSERT INTO "RecruitOmAssignment" (
          "id",
          "sourceLocalityId",
          "destinationLocalityId",
          "assignedCount",
          "createdAt",
          "updatedAt"
        )
        VALUES ${client_1.Prisma.join(values)}
      `);
        });
        return this.buildRecruitDesignationsResponse(id);
    }
    async remove(id) {
        await this.prisma.locality.delete({ where: { id } });
        return { ok: true };
    }
    assertLocalityAccess(localityId, user) {
        const bypassLocalityConstraint = (0, role_access_1.isNationalCommissionMember)(user) || (0, role_access_1.hasRole)(user, role_access_1.ROLE_TI);
        if (bypassLocalityConstraint)
            return;
        if (!user?.localityId)
            return;
        if (user.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertRecruitsMutationAccess(localityId, user, recruitsFemaleCountCurrent) {
        if (recruitsFemaleCountCurrent === undefined || recruitsFemaleCountCurrent === null)
            return;
        if (!(0, role_access_1.canEditRecruitsByRole)(user, localityId)) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertRecruitsEditorAccess(localityId, user) {
        if (!(0, role_access_1.canEditRecruitsByRole)(user, localityId)) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async assertRecruitAssignmentsWithinTotal(localityId, recruitsFemaleCountCurrent) {
        const aggregate = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT COALESCE(SUM("assignedCount"), 0)::int AS "totalAssigned"
        FROM "RecruitOmAssignment"
        WHERE "sourceLocalityId" = ${localityId}
      `);
        const totalAssigned = Number(aggregate[0]?.totalAssigned ?? 0);
        if (totalAssigned > recruitsFemaleCountCurrent) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'recruitsFemaleCountCurrent',
                reason: 'RECRUIT_COUNT_BELOW_ASSIGNED_OM_TOTAL',
                totalAssigned,
            });
        }
    }
    async buildRecruitDesignationsResponse(localityId) {
        const locality = await this.prisma.locality.findUnique({
            where: { id: localityId },
            select: { id: true, recruitsFemaleCountCurrent: true },
        });
        if (!locality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const items = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT
          a."id",
          a."destinationLocalityId",
          a."assignedCount",
          l."name" AS "destinationLocalityName",
          l."code" AS "destinationLocalityCode"
        FROM "RecruitOmAssignment" a
        LEFT JOIN "Locality" l
          ON l."id" = a."destinationLocalityId"
        WHERE a."sourceLocalityId" = ${localityId}
        ORDER BY l."name" ASC, a."destinationLocalityId" ASC
      `);
        const totalAssigned = items.reduce((acc, item) => acc + item.assignedCount, 0);
        const totalRecruits = locality.recruitsFemaleCountCurrent ?? 0;
        return {
            localityId,
            totalRecruits,
            totalAssigned,
            remaining: Math.max(0, totalRecruits - totalAssigned),
            items: items.map((item) => ({
                id: item.id,
                destinationLocalityId: item.destinationLocalityId,
                destinationLocalityName: item.destinationLocalityName ?? item.destinationLocalityId,
                destinationLocalityCode: item.destinationLocalityCode ?? '',
                assignedCount: item.assignedCount,
            })),
        };
    }
    async buildRecruitMembersResponse(localityId) {
        const locality = await this.prisma.locality.findUnique({
            where: { id: localityId },
            select: {
                id: true,
                recruitsFemaleCountCurrent: true,
            },
        });
        if (!locality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const items = await this.prisma.recruitFemale.findMany({
            where: { localityId },
            select: {
                id: true,
                name: true,
                status: true,
                dismissalReason: true,
                dismissedAt: true,
                destinationLocalityId: true,
                designatedAt: true,
                destinationLocality: {
                    select: { id: true, name: true, code: true },
                },
            },
            orderBy: [{ name: 'asc' }],
        });
        return {
            localityId,
            recruitsFemaleCountCurrent: locality.recruitsFemaleCountCurrent ?? 0,
            items: items.map((item) => ({
                id: item.id,
                name: item.name,
                status: item.status,
                dismissalReason: item.dismissalReason ?? null,
                dismissedAt: item.dismissedAt?.toISOString() ?? null,
                destinationLocalityId: item.destinationLocalityId ?? null,
                destinationLocalityName: item.destinationLocality?.name ?? item.destinationLocalityId ?? null,
                destinationLocalityCode: item.destinationLocality?.code ?? null,
                designatedAt: item.designatedAt?.toISOString() ?? null,
            })),
        };
    }
    async createInitialRecruits(localityId, count) {
        if (count <= 0)
            return;
        const locality = await this.prisma.locality.findUnique({
            where: { id: localityId },
            select: { code: true, name: true },
        });
        if (!locality)
            return;
        const now = new Date();
        const recruits = Array.from({ length: count }, (_, index) => ({
            id: `rf_${(0, crypto_1.randomUUID)().replace(/-/g, '')}`,
            localityId,
            name: `Recruta ${index + 1} - ${locality.code || locality.name.substring(0, 8)}`,
            status: client_1.RecruitFemaleStatus.RECRUITMENT_TO_START,
            createdAt: now,
            updatedAt: now,
        }));
        if (recruits.length > 0) {
            await this.prisma.recruitFemale.createMany({ data: recruits });
        }
    }
    async syncLocalityRecruitCount(localityId) {
        const aggregate = await this.prisma.recruitFemale.count({
            where: {
                localityId,
                status: {
                    in: [
                        client_1.RecruitFemaleStatus.RECRUITMENT_TO_START,
                        client_1.RecruitFemaleStatus.RECRUITMENT_STARTED,
                    ],
                },
            },
        });
        await this.prisma.locality.update({
            where: { id: localityId },
            data: { recruitsFemaleCountCurrent: aggregate },
        });
        return aggregate;
    }
    async registerRecruitsHistory(localityId, nextCount, previousCount, dismissalReason, enforceDismissalReason = false) {
        const normalizedReason = dismissalReason
            ? (0, sanitize_1.sanitizeText)(String(dismissalReason)).trim()
            : '';
        const turnoverCount = Math.max(0, previousCount - nextCount);
        if (enforceDismissalReason && turnoverCount > 0 && !normalizedReason) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'dismissalReason',
                reason: 'DISMISSAL_REASON_REQUIRED',
            });
        }
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        await this.prisma.recruitsHistory.upsert({
            where: {
                localityId_date: { localityId, date: today },
            },
            create: {
                localityId,
                date: today,
                recruitsFemaleCount: nextCount,
                turnoverCount,
                dismissalReason: turnoverCount > 0 ? normalizedReason || null : null,
            },
            update: {
                recruitsFemaleCount: nextCount,
                turnoverCount,
                dismissalReason: turnoverCount > 0 ? normalizedReason || null : null,
            },
        });
    }
};
exports.LocalitiesController = LocalitiesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('oms-catalog'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "listOmsCatalog", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_locality_dto_1.CreateLocalityDto]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_locality_dto_1.UpdateLocalityDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/recruits'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_locality_recruits_dto_1.UpdateLocalityRecruitsDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "updateRecruits", null);
__decorate([
    (0, common_1.Get)(':id/recruit-designations'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "listRecruitDesignations", null);
__decorate([
    (0, common_1.Get)(':id/recruits-members'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "listRecruitMembers", null);
__decorate([
    (0, common_1.Put)(':id/recruits-members'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, replace_locality_recruits_members_dto_1.ReplaceLocalityRecruitsMembersDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "replaceRecruitMembers", null);
__decorate([
    (0, common_1.Put)(':id/commander-from-ldap'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_locality_commander_from_ldap_dto_1.SetLocalityCommanderFromLdapDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "setCommanderFromLdap", null);
__decorate([
    (0, common_1.Put)(':id/recruit-designations'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_locality_recruit_designations_dto_1.UpdateLocalityRecruitDesignationsDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "replaceRecruitDesignations", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "remove", null);
exports.LocalitiesController = LocalitiesController = __decorate([
    (0, common_1.Controller)('localities'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        fab_ldap_service_1.FabLdapService,
        rbac_service_1.RbacService])
], LocalitiesController);
//# sourceMappingURL=localities.controller.js.map