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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const role_access_1 = require("../rbac/role-access");
const LOCALITY_REQUIRED_ROLE_NAMES = new Set([
    'admin especialidade local',
    'gsd localidade',
    'admin localidade',
    'administracao local',
    'cpca',
]);
const SPECIALTY_REQUIRED_ROLE_NAMES = new Set([
    'admin especialidade local',
    'admin especialidade nacional',
]);
function normalizeRoleName(roleName) {
    return String(roleName ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}
function roleRequiresLocality(roleName) {
    return LOCALITY_REQUIRED_ROLE_NAMES.has(normalizeRoleName(roleName));
}
function roleRequiresSpecialty(roleName) {
    return SPECIALTY_REQUIRED_ROLE_NAMES.has(normalizeRoleName(roleName));
}
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    toRoleResponse(role) {
        return {
            id: role.id,
            name: (0, role_access_1.canonicalRoleName)(role.name),
        };
    }
    mapUserRoles(user) {
        return {
            ...user,
            roles: user.roles.map((item) => ({
                role: this.toRoleResponse(item.role),
            })),
        };
    }
    authInclude = {
        roles: {
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        },
    };
    findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
            include: this.authInclude,
        });
    }
    findByLdapUid(ldapUid) {
        return this.prisma.user.findUnique({
            where: { ldapUid },
            include: this.authInclude,
        });
    }
    findForAuth(identifier) {
        const value = String(identifier ?? '').trim();
        const normalizedEmail = value.toLowerCase();
        return this.prisma.user.findFirst({
            where: {
                OR: [{ ldapUid: value }, { email: normalizedEmail }],
            },
            include: this.authInclude,
        });
    }
    findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
            include: this.authInclude,
        });
    }
    async list() {
        const users = await this.prisma.user.findMany({
            where: {
                ldapUid: { not: null },
                roles: { some: {} },
            },
            select: {
                id: true,
                name: true,
                email: true,
                ldapUid: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
                eloRole: { select: { id: true, code: true, name: true } },
                roles: {
                    orderBy: { role: { name: 'asc' } },
                    select: {
                        role: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
        return users
            .filter((user) => String(user.ldapUid ?? '').trim().length > 0)
            .map((user) => this.mapUserRoles(user));
    }
    async update(id, payload) {
        const existingUser = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
                roles: {
                    select: {
                        role: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        if (!existingUser) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        const requestedRoleIdsRaw = payload.roleIds !== undefined
            ? payload.roleIds
            : payload.roleId !== undefined
                ? payload.roleId
                    ? [payload.roleId]
                    : []
                : undefined;
        let targetRoleNames = [];
        let requestedRoleIds = undefined;
        if (requestedRoleIdsRaw !== undefined) {
            requestedRoleIds = Array.from(new Set(requestedRoleIdsRaw
                .map((value) => String(value ?? '').trim())
                .filter(Boolean)));
            if (requestedRoleIds.length > 0) {
                const roleRecords = await this.prisma.role.findMany({
                    where: { id: { in: requestedRoleIds } },
                    select: { id: true, name: true },
                });
                if (roleRecords.length !== requestedRoleIds.length) {
                    (0, http_error_1.throwError)('NOT_FOUND');
                }
                targetRoleNames = roleRecords.map((item) => item.name);
            }
        }
        else {
            targetRoleNames = existingUser.roles.map((item) => item.role.name);
        }
        const targetLocalityId = payload.localityId !== undefined ? payload.localityId : existingUser.localityId;
        if (targetRoleNames.some((roleName) => roleRequiresLocality(roleName)) && !targetLocalityId) {
            (0, http_error_1.throwError)('USER_LOCAL_ROLE_REQUIRES_LOCALITY');
        }
        const targetSpecialtyId = payload.specialtyId !== undefined ? payload.specialtyId : existingUser.specialtyId;
        const targetEloRoleId = payload.eloRoleId !== undefined ? payload.eloRoleId : existingUser.eloRoleId;
        if (targetRoleNames.some((roleName) => roleRequiresSpecialty(roleName)) &&
            !targetSpecialtyId &&
            !targetEloRoleId) {
            (0, http_error_1.throwError)('USER_SPECIALTY_ROLE_REQUIRES_SPECIALTY');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: {
                    eloRoleId: payload.eloRoleId !== undefined ? payload.eloRoleId : undefined,
                    specialtyId: payload.specialtyId !== undefined ? payload.specialtyId : undefined,
                    localityId: payload.localityId !== undefined ? payload.localityId : undefined,
                },
            });
            if (requestedRoleIds !== undefined) {
                await tx.userRole.deleteMany({
                    where: { userId: id },
                });
                if (requestedRoleIds.length > 0) {
                    await tx.userRole.createMany({
                        data: requestedRoleIds.map((roleId) => ({
                            userId: id,
                            roleId,
                        })),
                        skipDuplicates: true,
                    });
                }
            }
        });
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                ldapUid: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
                eloRole: { select: { id: true, code: true, name: true } },
                roles: {
                    orderBy: { role: { name: 'asc' } },
                    select: {
                        role: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        return user ? this.mapUserRoles(user) : null;
    }
    async removeRole(userId, roleId) {
        return this.prisma.$transaction(async (tx) => {
            const deleted = await tx.userRole.deleteMany({
                where: {
                    userId,
                    roleId,
                },
            });
            const targetUser = await tx.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    ldapUid: true,
                    _count: {
                        select: { roles: true },
                    },
                },
            });
            let userRemoved = false;
            let userDeactivated = false;
            if (targetUser &&
                targetUser._count.roles === 0 &&
                String(targetUser.ldapUid ?? '').trim().length === 0) {
                await tx.userModuleAccessOverride.deleteMany({ where: { userId } });
                await tx.refreshToken.deleteMany({ where: { userId } });
                try {
                    await tx.user.delete({ where: { id: userId } });
                    userRemoved = true;
                }
                catch {
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            isActive: false,
                            localityId: null,
                            specialtyId: null,
                            eloRoleId: null,
                        },
                    });
                    userDeactivated = true;
                }
            }
            return {
                ok: true,
                removed: deleted.count,
                userRemoved,
                userDeactivated,
            };
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map