import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtPayload, JwtRefreshPayload } from './auth.types';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';

const REFRESH_TOKEN_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);
    if (!user || !user.isActive) throwError('AUTH_INVALID_CREDENTIALS');

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throwError('AUTH_LOCKED', { until: user.lockUntil.toISOString() });
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
      throwError('AUTH_INVALID_CREDENTIALS');
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
    const user = await this.users.findById(userId);
    if (!user) throwError('AUTH_INVALID_CREDENTIALS');

    const roleFlags = user.roles.map((userRole) => userRole.role.flagsJson ?? {});
    const executiveFlag =
      user.executiveHidePii ||
      roleFlags.some((flags) => flags && (flags as any).executive_hide_pii === true);

    const permissions = user.roles.flatMap((userRole) =>
      userRole.role.permissions.map((rp) => ({
        resource: rp.permission.resource,
        action: rp.permission.action,
        scope: rp.permission.scope,
      })),
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      executive_hide_pii: executiveFlag,
      elo_role_id: (user as any).eloRoleId ?? null,
      permissions,
      scopes: [],
      flags: {
        executive_hide_pii: executiveFlag,
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
}
