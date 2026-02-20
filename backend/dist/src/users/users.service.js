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
const LOCALITY_REQUIRED_ROLE_NAMES = new Set([
    'admin especialidade local',
    'gsd localidade',
    'admin localidade',
    'administracao local',
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
    list() {
        return this.prisma.user.findMany({
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
        let targetRoleName = null;
        if (payload.roleId !== undefined && payload.roleId !== null) {
            const roleExists = await this.prisma.role.findUnique({
                where: { id: payload.roleId },
                select: { id: true, name: true },
            });
            if (!roleExists) {
                (0, http_error_1.throwError)('NOT_FOUND');
            }
            targetRoleName = roleExists.name;
        }
        else {
            targetRoleName = existingUser.roles[0]?.role?.name ?? null;
        }
        const targetLocalityId = payload.localityId !== undefined ? payload.localityId : existingUser.localityId;
        if (roleRequiresLocality(targetRoleName) && !targetLocalityId) {
            (0, http_error_1.throwError)('USER_LOCAL_ROLE_REQUIRES_LOCALITY');
        }
        const targetSpecialtyId = payload.specialtyId !== undefined ? payload.specialtyId : existingUser.specialtyId;
        const targetEloRoleId = payload.eloRoleId !== undefined ? payload.eloRoleId : existingUser.eloRoleId;
        if (roleRequiresSpecialty(targetRoleName) && !targetSpecialtyId && !targetEloRoleId) {
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
            if (payload.roleId !== undefined) {
                await tx.userRole.deleteMany({
                    where: { userId: id },
                });
                if (payload.roleId) {
                    await tx.userRole.create({
                        data: {
                            userId: id,
                            roleId: payload.roleId,
                        },
                    });
                }
            }
        });
        return this.prisma.user.findUnique({
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
    }
    async removeRole(userId, roleId) {
        const deleted = await this.prisma.userRole.deleteMany({
            where: {
                userId,
                roleId,
            },
        });
        return {
            ok: true,
            removed: deleted.count,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map