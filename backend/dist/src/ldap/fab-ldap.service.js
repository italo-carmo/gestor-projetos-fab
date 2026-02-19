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
exports.FabLdapService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ldapts_1 = require("ldapts");
const http_error_1 = require("../common/http-error");
let FabLdapService = class FabLdapService {
    config;
    constructor(config) {
        this.config = config;
    }
    async authenticate(uid, password) {
        const normalizedUid = this.normalizeUid(uid);
        if (!normalizedUid || !password) {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        const client = this.createClient();
        try {
            await client.bind(this.buildUserDn(normalizedUid), password);
            const profile = await this.searchByUid(client, normalizedUid);
            if (profile)
                return profile;
            return {
                uid: normalizedUid,
                dn: this.buildUserDn(normalizedUid),
                name: null,
                email: null,
                fabom: null,
            };
        }
        catch (error) {
            this.handleLdapError(error, { invalidCredentials: true });
        }
        finally {
            await client.unbind().catch(() => undefined);
        }
    }
    async lookupByUid(uid) {
        const normalizedUid = this.normalizeUid(uid);
        if (!normalizedUid) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
        }
        const client = this.createClient();
        try {
            await this.bindForLookup(client);
            return await this.searchByUid(client, normalizedUid);
        }
        catch (error) {
            this.handleLdapError(error, { invalidCredentials: false });
        }
        finally {
            await client.unbind().catch(() => undefined);
        }
    }
    createClient() {
        return new ldapts_1.Client({
            url: this.getLdapUrl(),
            timeout: 8000,
            connectTimeout: 8000,
        });
    }
    async bindForLookup(client) {
        const bindDn = this.config.get('LDAP_FAB_BIND_DN')?.trim();
        const bindPassword = this.config.get('LDAP_FAB_BIND_PASSWORD')?.trim();
        if (bindDn && bindPassword) {
            await client.bind(bindDn, bindPassword);
        }
    }
    async searchByUid(client, uid) {
        const filter = `(uid=${this.escapeFilterValue(uid)})`;
        const { searchEntries } = await client.search(this.getBaseDn(), {
            scope: 'sub',
            filter,
            attributes: ['uid', 'cn', 'displayName', 'mail', 'fabom', 'givenName', 'sn'],
        });
        if (!searchEntries.length) {
            return null;
        }
        return this.mapEntry(searchEntries[0], uid);
    }
    mapEntry(entry, fallbackUid) {
        const uid = this.readAttribute(entry, 'uid') ?? fallbackUid;
        const givenName = this.readAttribute(entry, 'givenName');
        const surname = this.readAttribute(entry, 'sn');
        const composedName = [givenName, surname].filter(Boolean).join(' ').trim();
        return {
            uid,
            dn: typeof entry.dn === 'string' && entry.dn.trim() ? entry.dn : this.buildUserDn(uid),
            name: this.readAttribute(entry, 'displayName') ??
                this.readAttribute(entry, 'cn') ??
                (composedName || null),
            email: this.readAttribute(entry, 'mail')?.toLowerCase() ?? null,
            fabom: this.readAttribute(entry, 'fabom'),
        };
    }
    readAttribute(entry, attribute) {
        const value = entry[attribute];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed ? trimmed : null;
        }
        if (Buffer.isBuffer(value)) {
            const decoded = value.toString('utf-8').trim();
            return decoded ? decoded : null;
        }
        if (Array.isArray(value) && value.length > 0) {
            const first = value[0];
            if (typeof first === 'string') {
                const trimmed = first.trim();
                return trimmed ? trimmed : null;
            }
            if (Buffer.isBuffer(first)) {
                const decoded = first.toString('utf-8').trim();
                return decoded ? decoded : null;
            }
        }
        return null;
    }
    normalizeUid(uid) {
        return String(uid ?? '').trim();
    }
    buildUserDn(uid) {
        return `uid=${uid},${this.getBaseDn()}`;
    }
    getLdapUrl() {
        return this.config.get('LDAP_FAB_URL')?.trim() || 'ldap://10.228.64.168:389';
    }
    getBaseDn() {
        return this.config.get('LDAP_FAB_BASE_DN')?.trim() || 'ou=contas,dc=fab,dc=intraer';
    }
    escapeFilterValue(value) {
        return value
            .replace(/\\/g, '\\5c')
            .replace(/\*/g, '\\2a')
            .replace(/\(/g, '\\28')
            .replace(/\)/g, '\\29')
            .replace(/\u0000/g, '\\00');
    }
    handleLdapError(error, options) {
        if (this.isConnectivityError(error)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'LDAP_UNREACHABLE',
                host: this.getLdapUrl(),
                port: 389,
            });
        }
        if (options.invalidCredentials) {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
        (0, http_error_1.throwError)('VALIDATION_ERROR', {
            reason: 'LDAP_QUERY_FAILED',
            message: this.stringifyError(error),
        });
    }
    isConnectivityError(error) {
        const code = String(error?.code ?? '').toUpperCase();
        return (code === 'ECONNREFUSED' ||
            code === 'ENOTFOUND' ||
            code === 'EHOSTUNREACH' ||
            code === 'ECONNRESET' ||
            code === 'ETIMEDOUT');
    }
    stringifyError(error) {
        if (error instanceof Error)
            return error.message;
        return String(error ?? 'unknown');
    }
};
exports.FabLdapService = FabLdapService;
exports.FabLdapService = FabLdapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FabLdapService);
//# sourceMappingURL=fab-ldap.service.js.map