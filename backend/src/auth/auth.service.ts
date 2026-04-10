import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtPayload, JwtRefreshPayload, Jwt2faPayload } from './auth.types';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { FabLdapService } from '../ldap/fab-ldap.service';
import {
  generateTotpSecret,
  buildTotpUri,
  generateQrCodeDataUrl,
  formatManualKey,
  encryptSecret,
  decryptSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
} from './totp.util';

const REFRESH_TOKEN_SALT_ROUNDS = 10;
const SIGPES_FOTO_TIMEOUT_MS = 8_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly fabLdap: FabLdapService,
  ) {}

  async login(login: string, password: string) {
    const normalizedLogin = String(login ?? '').trim();
    if (!normalizedLogin || !password) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    const user = await this.users.findForAuth(normalizedLogin);
    if (!user || !user.isActive) throwError('AUTH_INVALID_CREDENTIALS');

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throwError('AUTH_LOCKED', { until: user.lockUntil.toISOString() });
    }

    const ldapUid = user.ldapUid?.trim() || normalizedLogin;

    try {
      const ldapProfile = await this.fabLdap.authenticate(ldapUid, password);
      await this.registerSuccessfulLogin(user.id, {
        ldapUid,
        name: ldapProfile.name,
        email: ldapProfile.email,
      });
    } catch (error) {
      if (this.getHttpErrorCode(error) === 'AUTH_INVALID_CREDENTIALS') {
        await this.registerFailedLogin(user.id, user.loginFailedCount ?? 0);
      }
      throw error;
    }

    const refreshedUser = await this.users.findById(user.id);
    if (!refreshedUser || !refreshedUser.isActive) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }
    if (!refreshedUser.roles.length) {
      throwError('RBAC_FORBIDDEN');
    }

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

    const fullUser = await this.prisma.user.findUnique({
      where: { id: refreshedUser.id },
      select: { totpEnabled: true, totpSecret: true },
    });

    if (fullUser?.totpEnabled && fullUser?.totpSecret) {
      const twoFactorToken = await this.issue2faToken(refreshedUser.id, '2fa');
      return { requiresTwoFactor: true, twoFactorToken };
    }

    const secretBase32 = generateTotpSecret();
    const encKey = this.getTotpEncryptionKey();
    const encrypted = encryptSecret(secretBase32, encKey);
    const accountName = refreshedUser.email || refreshedUser.name || refreshedUser.id;
    const totpUri = buildTotpUri(secretBase32, accountName);
    const qrCodeDataUrl = await generateQrCodeDataUrl(totpUri);
    const manualEntryKey = formatManualKey(secretBase32);

    await this.prisma.user.update({
      where: { id: refreshedUser.id },
      data: { totpSecret: encrypted, totpEnabled: false, totpBackupCodes: [] },
    });

    const setupToken = await this.issue2faToken(refreshedUser.id, '2fa_setup');
    return {
      requiresTwoFactorSetup: true,
      setupToken,
      qrCodeDataUrl,
      manualEntryKey,
      totpUri,
    };
  }

  async refresh(refreshToken: string) {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });

    if (!stored || stored.userId !== payload.sub) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throwError('AUTH_TOKEN_EXPIRED');
    }

    const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!matches) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: stored.userId, email: stored.user.email } as JwtPayload,
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '24h',
      } as any,
    );

    const newRefreshId = await this.prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: 'pending',
        expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
      },
      select: { id: true },
    });

    const refreshPayload: JwtRefreshPayload = {
      sub: stored.userId,
      jti: newRefreshId.id,
    };
    const newRefreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
    } as any);

    const tokenHash = await bcrypt.hash(
      newRefreshToken,
      REFRESH_TOKEN_SALT_ROUNDS,
    );
    await this.prisma.refreshToken.update({
      where: { id: newRefreshId.id },
      data: { tokenHash },
    });

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async me(userId: string, activeRoleId?: string) {
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

  async meFabProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, ldapUid: true, email: true },
    });
    if (!user) {
      throwError('RBAC_FORBIDDEN');
    }

    let profile: Awaited<ReturnType<FabLdapService['lookupByUid']>> | null =
      null;
    try {
      profile = await this.resolveFabProfileForUser({
        ldapUid: user.ldapUid,
        email: user.email,
      });
    } catch {
      profile = null;
    }

    return {
      uid: profile?.uid ?? user.ldapUid ?? null,
      fabom: profile?.fabom ?? null,
      numeroOrdem: profile?.numeroOrdem ?? null,
    };
  }

  async getSigpesPhotoByOrder(numeroOrdem: string) {
    const rawNumeroOrdem = String(numeroOrdem ?? '').trim();
    const normalizedNumeroOrdem = this.normalizeNumeroOrdem(rawNumeroOrdem);
    if (!normalizedNumeroOrdem) {
      throwError('VALIDATION_ERROR', { reason: 'NUMERO_ORDEM_REQUIRED' });
    }

    const apiTargets = this.getSigpesFotoApiTargets();
    const candidates = [
      ...new Set([normalizedNumeroOrdem, rawNumeroOrdem]),
    ].filter(Boolean);
    let lastStatus: number | null = null;
    let sawInvalidPayload = false;
    let lastFetchErrorMessage: string | null = null;

    for (const target of apiTargets) {
      for (const candidate of candidates) {
        const endpoint = `${target.baseUrl}/${encodeURIComponent(candidate)}`;
        let statusCode: number;
        let rawBody: string;
        try {
          const response = await this.requestSigpesEndpoint(
            endpoint,
            target.hostHeader,
          );
          statusCode = response.status;
          rawBody = response.body;
        } catch (error) {
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
      throwError('VALIDATION_ERROR', {
        reason: 'SIGPES_FOTO_INVALID_RESPONSE',
      });
    }
    if (lastStatus !== null) {
      throwError('VALIDATION_ERROR', {
        reason: 'SIGPES_FOTO_API_ERROR',
        status: lastStatus,
      });
    }
    throwError('VALIDATION_ERROR', {
      reason: 'SIGPES_FOTO_API_UNREACHABLE',
      message: lastFetchErrorMessage ?? 'SIGPES_FOTO_NO_ROUTE',
    });
  }

  async confirmTwoFactorSetup(setupToken: string, code: string) {
    const payload = await this.verify2faToken(setupToken, '2fa_setup');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, totpSecret: true, totpEnabled: true },
    });
    if (!user || !user.totpSecret) throwError('AUTH_INVALID_CREDENTIALS');
    if (user.totpEnabled) throwError('AUTH_2FA_ALREADY_ENABLED');

    const encKey = this.getTotpEncryptionKey();
    const secretBase32 = decryptSecret(user.totpSecret, encKey);

    if (!verifyTotpCode(secretBase32, code)) {
      throwError('AUTH_2FA_INVALID_CODE');
    }

    const backupCodesPlain = generateBackupCodes();
    const backupCodesHashed = await hashBackupCodes(backupCodesPlain);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true, totpBackupCodes: backupCodesHashed },
    });

    await this.audit.log({
      userId: user.id,
      resource: 'auth',
      action: '2fa_setup',
      entityId: user.id,
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { ...tokens, backupCodes: backupCodesPlain };
  }

  async verifyTwoFactor(twoFactorToken: string, code: string) {
    const payload = await this.verify2faToken(twoFactorToken, '2fa');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, totpSecret: true, totpEnabled: true, totpBackupCodes: true },
    });
    if (!user || !user.totpSecret || !user.totpEnabled) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    const encKey = this.getTotpEncryptionKey();
    const secretBase32 = decryptSecret(user.totpSecret, encKey);
    const normalizedCode = code.replace(/[-\s]/g, '').trim();

    if (/^\d{6}$/.test(normalizedCode)) {
      if (!verifyTotpCode(secretBase32, normalizedCode)) {
        throwError('AUTH_2FA_INVALID_CODE');
      }
    } else {
      const idx = await verifyBackupCode(normalizedCode, user.totpBackupCodes);
      if (idx < 0) throwError('AUTH_2FA_INVALID_CODE');
      const remaining = [...user.totpBackupCodes];
      remaining.splice(idx, 1);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { totpBackupCodes: remaining },
      });
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { ...tokens };
  }

  async resetTwoFactor(targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) throwError('NOT_FOUND');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { totpSecret: null, totpEnabled: false, totpBackupCodes: [] },
    });

    await this.audit.log({
      userId: targetUserId,
      resource: 'auth',
      action: '2fa_reset',
      entityId: targetUserId,
    });

    return { ok: true };
  }

  async getUserTwoFactorStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true },
    });
    return { totpEnabled: user?.totpEnabled ?? false };
  }

  private async issue2faToken(userId: string, purpose: '2fa' | '2fa_setup') {
    const payload: Jwt2faPayload = { sub: userId, purpose };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '5m',
    } as any);
  }

  private async verify2faToken(token: string, expectedPurpose: '2fa' | '2fa_setup') {
    let payload: Jwt2faPayload;
    try {
      payload = await this.jwt.verifyAsync<Jwt2faPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throwError('AUTH_2FA_TOKEN_EXPIRED');
    }
    if (payload.purpose !== expectedPurpose) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }
    return payload;
  }

  private getTotpEncryptionKey(): string {
    return (
      this.config.get<string>('TOTP_ENCRYPTION_KEY') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      'fallback-totp-key'
    );
  }

  private async issueTokens(userId: string, email: string) {
    const accessPayload: JwtPayload = { sub: userId, email };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '24h',
    } as any);

    const refreshId = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: 'pending',
        expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
      },
      select: { id: true },
    });

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      jti: refreshId.id,
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
    } as any);

    const tokenHash = await bcrypt.hash(
      refreshToken,
      REFRESH_TOKEN_SALT_ROUNDS,
    );
    await this.prisma.refreshToken.update({
      where: { id: refreshId.id },
      data: { tokenHash },
    });

    return { accessToken, refreshToken };
  }

  private getRefreshTtlMs() {
    const raw = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
  }

  private async resolveFabProfileForUser(params: {
    ldapUid: string | null;
    email: string;
  }) {
    const normalizedUid = String(params.ldapUid ?? '').trim();
    if (normalizedUid) {
      const byUid = await this.fabLdap.lookupByUid(normalizedUid);
      if (byUid) return byUid;
    }

    const normalizedEmail = String(params.email ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) return null;
    return this.fabLdap.lookupByEmail(normalizedEmail);
  }

  /** Returns numeroOrdem for a user by ldapUid/email (for org-chart photos etc.). */
  async getNumeroOrdemForUser(
    ldapUid: string | null,
    email: string,
  ): Promise<string | null> {
    try {
      const profile = await this.resolveFabProfileForUser({ ldapUid, email });
      return profile?.numeroOrdem ?? null;
    } catch {
      return null;
    }
  }

  private normalizeNumeroOrdem(value: string) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

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

  private getSigpesFotoApiBaseUrl() {
    const configured = this.config
      .get<string>('SIGPES_FOTO_API_BASE_URL')
      ?.trim();
    const baseUrl =
      configured && configured.length > 0
        ? configured
        : 'http://api.servicos.ccarj.intraer/sigpesApi/fotoes';
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    try {
      const parsed = new URL(normalizedBaseUrl);
      if (
        parsed.hostname.toLowerCase() === 'api.servicos.ccarj.intraer' &&
        parsed.protocol === 'https:'
      ) {
        parsed.protocol = 'http:';
        return parsed.toString().replace(/\/+$/, '');
      }
    } catch {
      // keep configured value when URL parsing fails
    }
    return normalizedBaseUrl;
  }

  private getSigpesFotoApiTargets() {
    const primaryBaseUrl = this.getSigpesFotoApiBaseUrl();
    const fallbackIp =
      this.config.get<string>('SIGPES_FOTO_API_FALLBACK_IP')?.trim() ||
      '10.52.199.79';
    const preferredHostHeader =
      this.config.get<string>('SIGPES_FOTO_API_HOST_HEADER')?.trim() ||
      'api.servicos.ccarj.intraer';

    const targets: Array<{ baseUrl: string; hostHeader?: string }> = [
      { baseUrl: primaryBaseUrl },
    ];

    if (!fallbackIp) return targets;

    let fallbackPath = '/sigpesApi/fotoes';
    try {
      const parsedPrimary = new URL(primaryBaseUrl);
      const normalizedPath = parsedPrimary.pathname.replace(/\/+$/, '');
      if (normalizedPath) {
        fallbackPath = normalizedPath.startsWith('/')
          ? normalizedPath
          : `/${normalizedPath}`;
      }
    } catch {
      // keep default fallback path
    }

    const fallbackBaseUrl = `http://${fallbackIp}${fallbackPath}`;
    const fallbackHostHeader = preferredHostHeader || undefined;
    const signature = `${fallbackBaseUrl}::${fallbackHostHeader ?? ''}`;
    const existingSignatures = new Set(
      targets.map((target) => `${target.baseUrl}::${target.hostHeader ?? ''}`),
    );
    if (!existingSignatures.has(signature)) {
      targets.push({
        baseUrl: fallbackBaseUrl,
        hostHeader: fallbackHostHeader,
      });
    }

    return targets;
  }

  private async requestSigpesEndpoint(
    endpoint: string,
    hostHeader?: string,
  ): Promise<{ status: number; body: string }> {
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

    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : undefined,
          method: 'GET',
          path: `${url.pathname}${url.search}`,
          headers: {
            Host: hostHeader,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on('end', () => {
            resolve({
              status: Number(response.statusCode ?? 0),
              body: Buffer.concat(chunks).toString('utf-8'),
            });
          });
        },
      );

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

  private normalizeBase64(value: string) {
    return String(value ?? '').replace(/\s+/g, '');
  }

  private parseSigpesPayload(rawBody: string) {
    const text = String(rawBody ?? '').trim();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      const mimeMatch = text.match(/"tpArq"\s*:\s*"([^"]*)"/i);
      const nameMatch = text.match(/"txNomeArq"\s*:\s*"([^"]*)"/i);
      const fotoMatch = text.match(/"imFoto"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i);

      if (!fotoMatch) return null;

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

  private async registerFailedLogin(
    userId: string,
    currentFailedCount: number,
  ) {
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

  private async registerSuccessfulLogin(
    userId: string,
    profile: { ldapUid: string; name: string | null; email: string | null },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, ldapUid: true },
    });
    if (!user) return;

    const data: any = {
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

  private getHttpErrorCode(error: unknown): string | null {
    if (!(error instanceof HttpException)) return null;
    const response = error.getResponse();
    if (typeof response === 'object' && response && 'code' in response) {
      const code = (response as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
    return null;
  }

  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error ?? '');
  }
}
