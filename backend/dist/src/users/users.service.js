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
    update(id, payload) {
        return this.prisma.user.update({
            where: { id },
            data: { eloRoleId: payload.eloRoleId ?? undefined },
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map