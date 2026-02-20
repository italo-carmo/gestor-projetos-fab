import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { resolveAccessProfile } from '../rbac/role-access';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createReport(
    params: {
      taskInstanceId: string;
      fileName: string;
      fileUrl: string;
      storageKey?: string | null;
      mimeType?: string | null;
      fileSize?: number | null;
      checksum?: string | null;
    },
    user?: RbacUser,
  ) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id: params.taskInstanceId },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

    const report = await this.prisma.report.create({
      data: {
        taskInstanceId: params.taskInstanceId,
        fileName: params.fileName,
        fileUrl: params.fileUrl,
        storageKey: params.storageKey ?? null,
        mimeType: params.mimeType ?? null,
        fileSize: params.fileSize ?? null,
        checksum: params.checksum ?? null,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'reports',
      action: 'upload',
      entityId: report.id,
      localityId: instance.localityId,
      diffJson: { taskInstanceId: params.taskInstanceId },
    });

    return report;
  }

  async getReport(id: string, user?: RbacUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throwError('NOT_FOUND');
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id: report.taskInstanceId },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskViewAccess(instance, user);
    return report;
  }

  async getSignedUrl(id: string, user?: RbacUser) {
    if (user?.executiveHidePii && this.config.get<string>('REPORTS_ALLOW_EXEC_DOWNLOAD') !== 'true') {
      throwError('RBAC_FORBIDDEN');
    }
    const report = await this.getReport(id, user);
    const secret = this.config.get<string>('REPORTS_SIGNED_URL_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET');
    const ttl = this.config.get<string>('REPORTS_SIGNED_URL_TTL') ?? '600s';
    const token = await this.jwt.signAsync(
      { rid: report.id },
      { secret, expiresIn: ttl } as any,
    );
    return { url: `/reports/${report.id}/download?token=${token}`, expiresIn: ttl };
  }

  async verifyDownloadToken(token: string) {
    const secret = this.config.get<string>('REPORTS_SIGNED_URL_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET');
    try {
      const payload = await this.jwt.verifyAsync<{ rid: string }>(token, { secret });
      return payload.rid;
    } catch {
      throwError('AUTH_INVALID_CREDENTIALS');
    }
  }

  async approveReport(id: string, approved: boolean, user?: RbacUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throwError('NOT_FOUND');

    const instance = await this.prisma.taskInstance.findUnique({
      where: { id: report.taskInstanceId },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskViewAccess(instance, user);

    const updated = await this.prisma.report.update({ where: { id }, data: { approved } });

    await this.audit.log({
      userId: user?.id,
      resource: 'reports',
      action: 'approve',
      entityId: id,
      localityId: instance?.localityId ?? undefined,
      diffJson: { approved },
    });

    return updated;
  }

  private isTaskResponsible(instance: any, user?: RbacUser) {
    if (!user?.id) return false;
    if (instance.assignedToId === user.id) return true;
    if (Array.isArray(instance.responsibles)) {
      return instance.responsibles.some((entry: any) => entry.userId === user.id);
    }
    return false;
  }

  private matchesTaskSpecialty(instance: any, specialtyId?: string | null) {
    if (!specialtyId) return false;
    const taskSpecialtyId = instance?.specialtyId ?? instance?.taskTemplate?.specialtyId ?? null;
    return !taskSpecialtyId || taskSpecialtyId === specialtyId;
  }

  private assertTaskOperateAccess(instance: any, user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const profile = resolveAccessProfile(user);
    if (profile.ti) return;
    if (!this.isTaskResponsible(instance, user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertTaskViewAccess(instance: any, user?: RbacUser) {
    if (!user?.id) return;
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;

    if (profile.localityAdmin) {
      if (!profile.localityId || instance.localityId === profile.localityId) return;
      throwError('RBAC_FORBIDDEN');
    }

    const specialtyMatch = this.matchesTaskSpecialty(instance, profile.groupSpecialtyId);
    const eloRoleMatch = profile.groupEloRoleId
      ? instance.eloRoleId === profile.groupEloRoleId ||
        instance.assignedElo?.eloRoleId === profile.groupEloRoleId
      : false;

    if (profile.specialtyAdmin) {
      if (profile.localityId && instance.localityId !== profile.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      if (specialtyMatch || eloRoleMatch) return;
      throwError('RBAC_FORBIDDEN');
    }

    if (this.isTaskResponsible(instance, user)) return;
    if (user.localityId && instance.localityId === user.localityId && (specialtyMatch || eloRoleMatch)) return;

    throwError('RBAC_FORBIDDEN');
  }
}
