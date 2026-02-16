import { Injectable } from '@nestjs/common';
import { KpiVisibility, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { sanitizeForExecutive } from '../common/executive';

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user?: RbacUser) {
    const where: Prisma.KpiWhereInput = {};
    if (user?.executiveHidePii) {
      where.visibility = KpiVisibility.EXECUTIVE;
    }
    const items = await this.prisma.kpi.findMany({ where, orderBy: { key: 'asc' } });
    return { items };
  }

  create(payload: { key: string; label: string; visibility: string }) {
    return this.prisma.kpi.create({
      data: {
        key: payload.key,
        label: payload.label,
        visibility: payload.visibility as KpiVisibility,
      },
    });
  }

  addValue(kpiId: string, payload: { date: string; value: number; localityId?: string | null; specialtyId?: string | null }) {
    return this.prisma.kpiValue.create({
      data: {
        kpiId,
        date: new Date(payload.date),
        value: payload.value,
        localityId: payload.localityId ?? null,
        specialtyId: payload.specialtyId ?? null,
      },
    });
  }

  async dashboard(filters: { from?: string; to?: string }, user?: RbacUser) {
    const from = filters.from ? new Date(filters.from) : new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    const to = filters.to ? new Date(filters.to) : new Date();

    const [localities, tasks, phases, reports] = await this.prisma.$transaction([
      this.prisma.locality.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.taskInstance.findMany({
        where: {
          createdAt: { gte: from, lte: to },
        },
        include: { taskTemplate: { include: { phase: true } } },
      }),
      this.prisma.phase.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.report.findMany({ include: { taskInstance: true } }),
    ]);

    const progressByPhase = phases.map((phase) => {
      const phaseTasks = tasks.filter((task) => task.taskTemplate.phaseId === phase.id);
      const avg = phaseTasks.length
        ? phaseTasks.reduce((acc, task) => acc + task.progressPercent, 0) / phaseTasks.length
        : 0;
      return { phaseId: phase.id, phaseName: phase.name, progress: Math.round(avg) };
    });

    const overallProgress =
      progressByPhase.length > 0
        ? Math.round(progressByPhase.reduce((acc, entry) => acc + entry.progress, 0) / progressByPhase.length)
        : 0;

    const lateTasks = tasks.filter((task) => task.status !== TaskStatus.DONE && task.dueDate < new Date());

    const leadTimesByPhase = phases.map((phase) => {
      const doneTasks = tasks.filter(
        (task) => task.taskTemplate.phaseId === phase.id && task.status === TaskStatus.DONE,
      );
      const avgDays = doneTasks.length
        ? doneTasks.reduce((acc, task) => acc + (task.updatedAt.getTime() - task.createdAt.getTime()), 0) /
          doneTasks.length /
          (1000 * 60 * 60 * 24)
        : 0;
      return { phaseId: phase.id, phaseName: phase.name, avgLeadDays: Number(avgDays.toFixed(1)) };
    });

    const reportRequiredTasks = tasks.filter((task) => task.reportRequired && task.status === TaskStatus.DONE);
    const approvedReports = new Set(
      reports.filter((report) => report.approved).map((report) => report.taskInstanceId),
    );
    const complianceApproved = reportRequiredTasks.filter((task) => approvedReports.has(task.id)).length;
    const compliancePending = reportRequiredTasks.length - complianceApproved;

    const dashboard = {
      progress: {
        overall: overallProgress,
        byPhase: progressByPhase,
      },
      late: {
        total: lateTasks.length,
      },
      leadTime: leadTimesByPhase,
      reportsCompliance: {
        approved: complianceApproved,
        pending: compliancePending,
        total: reportRequiredTasks.length,
      },
      localities: localities.map((loc) => ({ id: loc.id, code: loc.code, name: loc.name })),
    };

    return user?.executiveHidePii ? sanitizeForExecutive(dashboard) : dashboard;
  }
}

