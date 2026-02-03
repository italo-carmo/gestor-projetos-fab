import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createReport(params: { taskInstanceId: string; fileName: string; fileUrl: string }, user?: RbacUser) {
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
