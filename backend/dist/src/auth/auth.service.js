"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const rbac_service_1 = require("../rbac/rbac.service");
const REFRESH_TOKEN_SALT_ROUNDS = 10;
let AuthService = class AuthService {
    users;
    prisma;
    jwt;
    config;
    audit;
    rbac;
    constructor(users, prisma, jwt, config, audit, rbac) {
        this.users = users;
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
        this.rbac = rbac;
    }
    async login(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.users.findByEmail(normalizedEmail);
        if (!user || !user.isActive)
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
            (0, http_error_1.throwError)('AUTH_LOCKED', { until: user.lockUntil.toISOString() });
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            const nextCount = (user.loginFailedCount ?? 0) + 1;
            const shouldLock = nextCount >= 5;
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    loginFailedCount: nextCount,
                    lockUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
                },
            });
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { loginFailedCount: 0, lockUntil: null },
        });
        const tokens = await this.issueTokens(user.id, user.email);
        const role = user.roles[0]?.role
            ? { id: user.roles[0].role.id, name: user.roles[0].role.name }
            : null;
        await this.audit.log({
            userId: user.id,
            resource: 'auth',
            action: 'login',
            entityId: user.id,
            localityId: user.localityId ?? undefined,
        });
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: role ?? undefined,
            },
        };
    }
    async refresh(refreshToken) {
        let payload;
        try {
            payload = await this.jwt.verifyAsync(refreshToken, {
                secret: this.config.get('JWT_REFRESH_SECRET'),
            });
        }
        catch {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        const stored = await this.prisma.refreshToken.findUnique({
            where: { id: payload.jti },
            include: { user: true },
        });
        if (!stored || stored.userId !== payload.sub) {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        if (stored.expiresAt.getTime() < Date.now()) {
            await this.prisma.refreshToken.delete({ where: { id: stored.id } });
            (0, http_error_1.throwError)('AUTH_TOKEN_EXPIRED');
        }
        const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (!matches) {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        const accessToken = await this.jwt.signAsync({ sub: stored.userId, email: stored.user.email }, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '900s',
        });
        const newRefreshId = await this.prisma.refreshToken.create({
            data: {
                userId: stored.userId,
                tokenHash: 'pending',
                expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
            },
            select: { id: true },
        });
        const refreshPayload = { sub: stored.userId, jti: newRefreshId.id };
        const newRefreshToken = await this.jwt.signAsync(refreshPayload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '7d',
        });
        const tokenHash = await bcrypt.hash(newRefreshToken, REFRESH_TOKEN_SALT_ROUNDS);
        await this.prisma.refreshToken.update({
            where: { id: newRefreshId.id },
            data: { tokenHash },
        });
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
        return { accessToken, refreshToken: newRefreshToken };
    }
    async me(userId) {
        const access = await this.rbac.getUserAccess(userId);
        return {
            id: access.id,
            email: access.email,
            name: access.name,
            executive_hide_pii: access.executiveHidePii,
            elo_role_id: access.eloRoleId ?? null,
            permissions: access.permissions,
            scopes: [],
            flags: {
                executive_hide_pii: access.executiveHidePii,
            },
        };
    }
    async issueTokens(userId, email) {
        const accessPayload = { sub: userId, email };
        const accessToken = await this.jwt.signAsync(accessPayload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '900s',
        });
        const refreshId = await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash: 'pending',
                expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
            },
            select: { id: true },
        });
        const refreshPayload = { sub: userId, jti: refreshId.id };
        const refreshToken = await this.jwt.signAsync(refreshPayload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '7d',
        });
        const tokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
        await this.prisma.refreshToken.update({
            where: { id: refreshId.id },
            data: { tokenHash },
        });
        return { accessToken, refreshToken };
    }
    getRefreshTtlMs() {
        const raw = this.config.get('JWT_REFRESH_TTL') ?? '7d';
        const match = raw.match(/^(\d+)([smhd])$/);
        if (!match)
            return 7 * 24 * 60 * 60 * 1000;
        const value = Number(match[1]);
        const unit = match[2];
        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };
        return value * multipliers[unit];
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        rbac_service_1.RbacService])
], AuthService);
//# sourceMappingURL=auth.service.js.map