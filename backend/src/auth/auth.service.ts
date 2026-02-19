import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtPayload, JwtRefreshPayload } from './auth.types';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { FabLdapService } from '../ldap/fab-ldap.service';

const REFRESH_TOKEN_SALT_ROUNDS = 10;

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

    const tokens = await this.issueTokens(refreshedUser.id, refreshedUser.email);
    const role = refreshedUser.roles[0]?.role
      ? { id: refreshedUser.roles[0].role.id, name: refreshedUser.roles[0].role.name }
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
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '900s',
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

    const refreshPayload: JwtRefreshPayload = { sub: stored.userId, jti: newRefreshId.id };
    const newRefreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    } as any);

    const tokenHash = await bcrypt.hash(newRefreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await this.prisma.refreshToken.update({
      where: { id: newRefreshId.id },
      data: { tokenHash },
    });

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async me(userId: string) {
    const access = await this.rbac.getUserAccess(userId);

    return {
      id: access.id,
      email: access.email,
      name: access.name,
      localityId: access.localityId ?? null,
      executive_hide_pii: access.executiveHidePii,
      elo_role_id: access.eloRoleId ?? null,
      roles: access.roles.map((role) => ({
        id: role.id,
        name: role.name,
      })),
      permissions: access.permissions,
      scopes: [],
      flags: {
        executive_hide_pii: access.executiveHidePii,
      },
    };
  }

  private async issueTokens(userId: string, email: string) {
    const accessPayload: JwtPayload = { sub: userId, email };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '900s',
    } as any);

    const refreshId = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: 'pending',
        expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
      },
      select: { id: true },
    });

    const refreshPayload: JwtRefreshPayload = { sub: userId, jti: refreshId.id };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    } as any);

    const tokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await this.prisma.refreshToken.update({
      where: { id: refreshId.id },
      data: { tokenHash },
    });

    return { accessToken, refreshToken };
  }

  private getRefreshTtlMs() {
    const raw = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
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

  private async registerFailedLogin(userId: string, currentFailedCount: number) {
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
}
