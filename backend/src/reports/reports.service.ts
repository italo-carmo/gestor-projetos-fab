import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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
      include: { taskTemplate: { select: { specialtyId: true } } },
    });
    if (!instance) throwError('NOT_FOUND');
    if (user?.localityId && user.localityId !== instance.localityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (user?.specialtyId && user.specialtyId !== instance.taskTemplate?.specialtyId) {
      throwError('RBAC_FORBIDDEN');
    }

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
    if (user?.localityId || user?.specialtyId) {
      const instance = await this.prisma.taskInstance.findUnique({
        where: { id: report.taskInstanceId },
        include: { taskTemplate: { select: { specialtyId: true } } },
      });
      if (instance && user?.localityId && instance.localityId !== user.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      if (instance && user?.specialtyId && instance.taskTemplate?.specialtyId !== user.specialtyId) {
        throwError('RBAC_FORBIDDEN');
      }
    }
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

    let instance: { localityId: string; taskTemplate?: { specialtyId: string | null } } | null = null;
    if (user?.localityId || user?.specialtyId) {
      instance = await this.prisma.taskInstance.findUnique({
        where: { id: report.taskInstanceId },
        include: { taskTemplate: { select: { specialtyId: true } } },
      });
      if (instance && user?.localityId && instance.localityId !== user.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      if (instance && user?.specialtyId && instance.taskTemplate?.specialtyId !== user.specialtyId) {
        throwError('RBAC_FORBIDDEN');
      }
    }

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
}
