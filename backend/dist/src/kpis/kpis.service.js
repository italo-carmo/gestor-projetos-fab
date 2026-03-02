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
exports.KpisService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const executive_1 = require("../common/executive");
let KpisService = class KpisService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(user) {
        const where = {};
        if (user?.executiveHidePii) {
            where.visibility = client_1.KpiVisibility.EXECUTIVE;
        }
        const items = await this.prisma.kpi.findMany({ where, orderBy: { key: 'asc' } });
        return { items };
    }
    create(payload) {
        return this.prisma.kpi.create({
            data: {
                key: payload.key,
                label: payload.label,
                visibility: payload.visibility,
            },
        });
    }
    addValue(kpiId, payload) {
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
    async dashboard(filters, user) {
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
        const overallProgress = progressByPhase.length > 0
            ? Math.round(progressByPhase.reduce((acc, entry) => acc + entry.progress, 0) / progressByPhase.length)
            : 0;
        const lateTasks = tasks.filter((task) => task.status !== client_1.TaskStatus.DONE && task.dueDate < new Date());
        const leadTimesByPhase = phases.map((phase) => {
            const doneTasks = tasks.filter((task) => task.taskTemplate.phaseId === phase.id && task.status === client_1.TaskStatus.DONE);
            const avgDays = doneTasks.length
                ? doneTasks.reduce((acc, task) => acc + (task.updatedAt.getTime() - task.createdAt.getTime()), 0) /
                    doneTasks.length /
                    (1000 * 60 * 60 * 24)
                : 0;
            return { phaseId: phase.id, phaseName: phase.name, avgLeadDays: Number(avgDays.toFixed(1)) };
        });
        const reportRequiredTasks = tasks.filter((task) => task.reportRequired && task.status === client_1.TaskStatus.DONE);
        const approvedReports = new Set(reports.filter((report) => report.approved).map((report) => report.taskInstanceId));
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
        return user?.executiveHidePii ? (0, executive_1.sanitizeForExecutive)(dashboard) : dashboard;
    }
};
exports.KpisService = KpisService;
exports.KpisService = KpisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KpisService);
//# sourceMappingURL=kpis.service.js.map