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
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const rbac_service_1 = require("../rbac/rbac.service");
const fab_ldap_service_1 = require("../ldap/fab-ldap.service");
const REFRESH_TOKEN_SALT_ROUNDS = 10;
const SIGPES_FOTO_TIMEOUT_MS = 8_000;
let AuthService = class AuthService {
    users;
    prisma;
    jwt;
    config;
    audit;
    rbac;
    fabLdap;
    constructor(users, prisma, jwt, config, audit, rbac, fabLdap) {
        this.users = users;
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
        this.rbac = rbac;
        this.fabLdap = fabLdap;
    }
    async login(login, password) {
        const normalizedLogin = String(login ?? '').trim();
        if (!normalizedLogin || !password) {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        const user = await this.users.findForAuth(normalizedLogin);
        if (!user || !user.isActive)
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
            (0, http_error_1.throwError)('AUTH_LOCKED', { until: user.lockUntil.toISOString() });
        }
        const ldapUid = user.ldapUid?.trim() || normalizedLogin;
        try {
            const ldapProfile = await this.fabLdap.authenticate(ldapUid, password);
            await this.registerSuccessfulLogin(user.id, {
                ldapUid,
                name: ldapProfile.name,
                email: ldapProfile.email,
            });
        }
        catch (error) {
            if (this.getHttpErrorCode(error) === 'AUTH_INVALID_CREDENTIALS') {
                await this.registerFailedLogin(user.id, user.loginFailedCount ?? 0);
            }
            throw error;
        }
        const refreshedUser = await this.users.findById(user.id);
        if (!refreshedUser || !refreshedUser.isActive) {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        if (!refreshedUser.roles.length) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const tokens = await this.issueTokens(refreshedUser.id, refreshedUser.email);
        const role = refreshedUser.roles[0]?.role
            ? {
                id: refreshedUser.roles[0].role.id,
                name: refreshedUser.roles[0].role.name,
            }
            : null;
        await this.audit.log({
            userId: refreshedUser.id,
            resource: 'auth',
            action: 'login_ldap',
            entityId: refreshedUser.id,
            localityId: refreshedUser.localityId ?? undefined,
        });
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: refreshedUser.id,
                name: refreshedUser.name,
                email: refreshedUser.email,
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
            expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '24h',
        });
        const newRefreshId = await this.prisma.refreshToken.create({
            data: {
                userId: stored.userId,
                tokenHash: 'pending',
                expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
            },
            select: { id: true },
        });
        const refreshPayload = {
            sub: stored.userId,
            jti: newRefreshId.id,
        };
        const newRefreshToken = await this.jwt.signAsync(refreshPayload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '30d',
        });
        const tokenHash = await bcrypt.hash(newRefreshToken, REFRESH_TOKEN_SALT_ROUNDS);
        await this.prisma.refreshToken.update({
            where: { id: newRefreshId.id },
            data: { tokenHash },
        });
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
        return { accessToken, refreshToken: newRefreshToken };
    }
    async me(userId, activeRoleId) {
        const access = await this.rbac.getUserAccess(userId, activeRoleId);
        const allRoles = access.allRoles ?? access.roles;
        const activeRole = access.roles[0] ?? null;
        return {
            id: access.id,
            email: access.email,
            name: access.name,
            localityId: access.localityId ?? null,
            executive_hide_pii: access.executiveHidePii,
            elo_role_id: access.eloRoleId ?? null,
            roles: allRoles.map((role) => ({
                id: role.id,
                name: role.name,
            })),
            activeRoleId: activeRole?.id ?? null,
            activeRole: activeRole
                ? {
                    id: activeRole.id,
                    name: activeRole.name,
                }
                : null,
            permissions: access.permissions,
            scopes: [],
            flags: {
                executive_hide_pii: access.executiveHidePii,
            },
        };
    }
    async meFabProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, ldapUid: true, email: true },
        });
        if (!user) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        let profile = null;
        try {
            profile = await this.resolveFabProfileForUser({
                ldapUid: user.ldapUid,
                email: user.email,
            });
        }
        catch {
            profile = null;
        }
        return {
            uid: profile?.uid ?? user.ldapUid ?? null,
            fabom: profile?.fabom ?? null,
            numeroOrdem: profile?.numeroOrdem ?? null,
        };
    }
    async getSigpesPhotoByOrder(numeroOrdem) {
        const rawNumeroOrdem = String(numeroOrdem ?? '').trim();
        const normalizedNumeroOrdem = this.normalizeNumeroOrdem(rawNumeroOrdem);
        if (!normalizedNumeroOrdem) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'NUMERO_ORDEM_REQUIRED' });
        }
        const apiTargets = this.getSigpesFotoApiTargets();
        const candidates = [...new Set([normalizedNumeroOrdem, rawNumeroOrdem])].filter(Boolean);
        let lastStatus = null;
        let sawInvalidPayload = false;
        let lastFetchErrorMessage = null;
        for (const target of apiTargets) {
            for (const candidate of candidates) {
                const endpoint = `${target.baseUrl}/${encodeURIComponent(candidate)}`;
                let statusCode;
                let rawBody;
                try {
                    const response = await this.requestSigpesEndpoint(endpoint, target.hostHeader);
                    statusCode = response.status;
                    rawBody = response.body;
                }
                catch (error) {
                    lastFetchErrorMessage = this.stringifyError(error);
                    continue;
                }
                if (statusCode < 200 || statusCode >= 300) {
                    lastStatus = statusCode;
                    continue;
                }
                const payload = this.parseSigpesPayload(rawBody);
                if (!payload) {
                    sawInvalidPayload = true;
                    continue;
                }
                const mimeType = String(payload?.tpArq ?? '').trim() || 'image/jpeg';
                const fileName = String(payload?.txNomeArq ?? '').trim() || null;
                const base64 = this.normalizeBase64(String(payload?.imFoto ?? ''));
                if (!base64) {
                    return {
                        numeroOrdem: candidate,
                        mimeType: null,
                        fileName,
                        base64: null,
                        dataUrl: null,
                    };
                }
                return {
                    numeroOrdem: candidate,
                    mimeType,
                    fileName,
                    base64,
                    dataUrl: `data:${mimeType};base64,${base64}`,
                };
            }
        }
        if (sawInvalidPayload) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'SIGPES_FOTO_INVALID_RESPONSE',
            });
        }
        if (lastStatus !== null) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'SIGPES_FOTO_API_ERROR',
                status: lastStatus,
            });
        }
        (0, http_error_1.throwError)('VALIDATION_ERROR', {
            reason: 'SIGPES_FOTO_API_UNREACHABLE',
            message: lastFetchErrorMessage ?? 'SIGPES_FOTO_NO_ROUTE',
        });
    }
    async issueTokens(userId, email) {
        const accessPayload = { sub: userId, email };
        const accessToken = await this.jwt.signAsync(accessPayload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '24h',
        });
        const refreshId = await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash: 'pending',
                expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
            },
            select: { id: true },
        });
        const refreshPayload = {
            sub: userId,
            jti: refreshId.id,
        };
        const refreshToken = await this.jwt.signAsync(refreshPayload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '30d',
        });
        const tokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
        await this.prisma.refreshToken.update({
            where: { id: refreshId.id },
            data: { tokenHash },
        });
        return { accessToken, refreshToken };
    }
    getRefreshTtlMs() {
        const raw = this.config.get('JWT_REFRESH_TTL') ?? '30d';
        const match = raw.match(/^(\d+)([smhd])$/);
        if (!match)
            return 30 * 24 * 60 * 60 * 1000;
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
    async resolveFabProfileForUser(params) {
        const normalizedUid = String(params.ldapUid ?? '').trim();
        if (normalizedUid) {
            const byUid = await this.fabLdap.lookupByUid(normalizedUid);
            if (byUid)
                return byUid;
        }
        const normalizedEmail = String(params.email ?? '')
            .trim()
            .toLowerCase();
        if (!normalizedEmail)
            return null;
        return this.fabLdap.lookupByEmail(normalizedEmail);
    }
    async getNumeroOrdemForUser(ldapUid, email) {
        try {
            const profile = await this.resolveFabProfileForUser({ ldapUid, email });
            return profile?.numeroOrdem ?? null;
        }
        catch {
            return null;
        }
    }
    normalizeNumeroOrdem(value) {
        const raw = String(value ?? '').trim();
        if (!raw)
            return '';
        if (/^\d+[.,]\d+$/.test(raw)) {
            const parsed = Number.parseFloat(raw.replace(',', '.'));
            if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
                return String(parsed);
            }
        }
        const trailingZeroSuffix = raw.match(/^(\d+)[-\s]0+$/);
        if (trailingZeroSuffix) {
            return trailingZeroSuffix[1];
        }
        const digits = raw.replace(/\D/g, '');
        return digits || raw;
    }
    getSigpesFotoApiBaseUrl() {
        const configured = this.config
            .get('SIGPES_FOTO_API_BASE_URL')
            ?.trim();
        const baseUrl = configured && configured.length > 0
            ? configured
            : 'http://api.servicos.ccarj.intraer/sigpesApi/fotoes';
        const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
        try {
            const parsed = new URL(normalizedBaseUrl);
            if (parsed.hostname.toLowerCase() === 'api.servicos.ccarj.intraer' &&
                parsed.protocol === 'https:') {
                parsed.protocol = 'http:';
                return parsed.toString().replace(/\/+$/, '');
            }
        }
        catch {
        }
        return normalizedBaseUrl;
    }
    getSigpesFotoApiTargets() {
        const primaryBaseUrl = this.getSigpesFotoApiBaseUrl();
        const fallbackIp = this.config.get('SIGPES_FOTO_API_FALLBACK_IP')?.trim() ||
            '10.52.199.79';
        const preferredHostHeader = this.config.get('SIGPES_FOTO_API_HOST_HEADER')?.trim() ||
            'api.servicos.ccarj.intraer';
        const targets = [
            { baseUrl: primaryBaseUrl },
        ];
        if (!fallbackIp)
            return targets;
        let fallbackPath = '/sigpesApi/fotoes';
        try {
            const parsedPrimary = new URL(primaryBaseUrl);
            const normalizedPath = parsedPrimary.pathname.replace(/\/+$/, '');
            if (normalizedPath) {
                fallbackPath = normalizedPath.startsWith('/')
                    ? normalizedPath
                    : `/${normalizedPath}`;
            }
        }
        catch {
        }
        const fallbackBaseUrl = `http://${fallbackIp}${fallbackPath}`;
        const fallbackHostHeader = preferredHostHeader || undefined;
        const signature = `${fallbackBaseUrl}::${fallbackHostHeader ?? ''}`;
        const existingSignatures = new Set(targets.map((target) => `${target.baseUrl}::${target.hostHeader ?? ''}`));
        if (!existingSignatures.has(signature)) {
            targets.push({ baseUrl: fallbackBaseUrl, hostHeader: fallbackHostHeader });
        }
        return targets;
    }
    async requestSigpesEndpoint(endpoint, hostHeader) {
        if (!hostHeader) {
            const response = await fetch(endpoint, {
                method: 'GET',
                signal: AbortSignal.timeout(SIGPES_FOTO_TIMEOUT_MS),
            });
            return {
                status: response.status,
                body: await response.text(),
            };
        }
        const url = new URL(endpoint);
        const transport = url.protocol === 'https:' ? https : http;
        return new Promise((resolve, reject) => {
            const request = transport.request({
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port ? Number(url.port) : undefined,
                method: 'GET',
                path: `${url.pathname}${url.search}`,
                headers: {
                    Host: hostHeader,
                },
            }, (response) => {
                const chunks = [];
                response.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                response.on('end', () => {
                    resolve({
                        status: Number(response.statusCode ?? 0),
                        body: Buffer.concat(chunks).toString('utf-8'),
                    });
                });
            });
            request.on('timeout', () => {
                request.destroy(new Error('SIGPES_REQUEST_TIMEOUT'));
            });
            request.on('error', (error) => {
                reject(error);
            });
            request.setTimeout(SIGPES_FOTO_TIMEOUT_MS);
            request.end();
        });
    }
    normalizeBase64(value) {
        return String(value ?? '').replace(/\s+/g, '');
    }
    parseSigpesPayload(rawBody) {
        const text = String(rawBody ?? '').trim();
        if (!text)
            return null;
        try {
            return JSON.parse(text);
        }
        catch {
            const mimeMatch = text.match(/"tpArq"\s*:\s*"([^"]*)"/i);
            const nameMatch = text.match(/"txNomeArq"\s*:\s*"([^"]*)"/i);
            const fotoMatch = text.match(/"imFoto"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i);
            if (!fotoMatch)
                return null;
            return {
                tpArq: mimeMatch?.[1] ?? 'image/jpeg',
                txNomeArq: nameMatch?.[1] ?? null,
                imFoto: String(fotoMatch[1] ?? '')
                    .replace(/\\\//g, '/')
                    .replace(/\\r/g, '')
                    .replace(/\\n/g, ''),
            };
        }
    }
    async registerFailedLogin(userId, currentFailedCount) {
        const nextCount = currentFailedCount + 1;
        const shouldLock = nextCount >= 5;
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                loginFailedCount: nextCount,
                lockUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
            },
        });
    }
    async registerSuccessfulLogin(userId, profile) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, ldapUid: true },
        });
        if (!user)
            return;
        const data = {
            loginFailedCount: 0,
            lockUntil: null,
        };
        if (profile.ldapUid && user.ldapUid !== profile.ldapUid) {
            data.ldapUid = profile.ldapUid;
        }
        const normalizedName = profile.name?.trim();
        if (normalizedName && normalizedName !== user.name) {
            data.name = normalizedName;
        }
        const normalizedEmail = profile.email?.trim().toLowerCase() ?? null;
        if (normalizedEmail && normalizedEmail !== user.email) {
            const emailConflict = await this.prisma.user.findFirst({
                where: {
                    email: normalizedEmail,
                    id: { not: userId },
                },
                select: { id: true },
            });
            if (!emailConflict) {
                data.email = normalizedEmail;
            }
        }
        await this.prisma.user.update({
            where: { id: userId },
            data,
        });
    }
    getHttpErrorCode(error) {
        if (!(error instanceof common_1.HttpException))
            return null;
        const response = error.getResponse();
        if (typeof response === 'object' && response && 'code' in response) {
            const code = response.code;
            return typeof code === 'string' ? code : null;
        }
        return null;
    }
    stringifyError(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error ?? '');
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
        rbac_service_1.RbacService,
        fab_ldap_service_1.FabLdapService])
], AuthService);
//# sourceMappingURL=auth.service.js.map