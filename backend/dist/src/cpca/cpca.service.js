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
exports.CpcaService = exports.SMIF_WORKFLOW_CONTEXT = exports.CPCA_WORKFLOW_CONTEXT = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const pagination_1 = require("../common/pagination");
const role_access_1 = require("../rbac/role-access");
const CPCA_STATUS_ORDER = [
    'RECEIVED',
    'PROTECTION_MEASURES',
    'PRELIMINARY_ANALYSIS',
    'PROCEDURE_DEFINED',
    'INVESTIGATION',
    'CONCLUDED',
    'ARCHIVED',
];
const CPCA_PROCEDURE_ORDER = [
    'NOT_DEFINED',
    'PATD',
    'SINDICANCIA',
    'PAD',
    'IPM',
    'BOLETIM_OCORRENCIA',
    'INQUERITO_CIVIL',
    'NAO_HOUVE',
    'INQUERITO_POLICIAL_COMUM',
    'NOTICIA_FATO',
    'CONSELHO_DISCIPLINA',
    'CONSELHO_JUSTIFICACAO',
];
const CPCA_COMPLAINT_TYPE_ORDER = ['MORAL', 'SEXUAL'];
const CPCA_OPEN_STATUS_SET = new Set([
    'RECEIVED',
    'PROTECTION_MEASURES',
    'PRELIMINARY_ANALYSIS',
    'PROCEDURE_DEFINED',
    'INVESTIGATION',
]);
const CPCA_TRIAGE_STATUS_SET = new Set([
    'RECEIVED',
    'PROTECTION_MEASURES',
    'PRELIMINARY_ANALYSIS',
]);
const CPCA_INVESTIGATION_STATUS_SET = new Set([
    'PROCEDURE_DEFINED',
    'INVESTIGATION',
]);
const DAY_MS = 24 * 60 * 60 * 1000;
exports.CPCA_WORKFLOW_CONTEXT = {
    workflowScope: 'CPCA',
    resource: 'cpca_cases',
    caseNumberPrefix: 'CPCA',
};
exports.SMIF_WORKFLOW_CONTEXT = {
    workflowScope: 'SMIF',
    resource: 'smif_complaints',
    caseNumberPrefix: 'SMIF',
};
let CpcaService = class CpcaService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const constraints = this.getScopeConstraints(user, workflowContext);
        const where = {
            workflowScope: workflowContext.workflowScope,
        };
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (constraints.localityId &&
            filters.localityId &&
            constraints.localityId !== filters.localityId) {
            where.localityId = '__none__';
        }
        else if (constraints.localityId) {
            where.localityId = constraints.localityId;
        }
        if (filters.status)
            where.status = filters.status;
        if (filters.complaintType)
            where.complaintType = filters.complaintType;
        if (filters.detailedViolenceType)
            where.detailedViolenceType = filters.detailedViolenceType;
        if (filters.procedureType)
            where.procedureType = filters.procedureType;
        if (filters.q) {
            where.caseNumber = { contains: filters.q.trim(), mode: 'insensitive' };
        }
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const complaintModel = this.prisma.cpcComplaintCase;
        const [items, total] = await this.prisma.$transaction([
            complaintModel.findMany({
                where,
                orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
                include: {
                    locality: { select: { id: true, code: true, name: true } },
                    comments: {
                        select: { createdAt: true },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
                skip,
                take,
            }),
            complaintModel.count({ where }),
        ]);
        return {
            items: (items ?? []).map((item) => ({
                ...item,
                lastCommentAt: item.comments?.[0]?.createdAt ?? null,
                comments: undefined,
            })),
            page,
            pageSize,
            total,
        };
    }
    async stats(filters, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const constraints = this.getScopeConstraints(user, workflowContext);
        const where = {
            workflowScope: workflowContext.workflowScope,
        };
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (constraints.localityId &&
            filters.localityId &&
            constraints.localityId !== filters.localityId) {
            where.localityId = '__none__';
        }
        else if (constraints.localityId) {
            where.localityId = constraints.localityId;
        }
        const fromDate = this.parseDateBoundary(filters.from, 'from', false);
        const toDate = this.parseDateBoundary(filters.to, 'to', true);
        if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'from',
                reason: 'INVALID_DATE_RANGE',
            });
        }
        if (fromDate || toDate) {
            where.reportedAt = {};
            if (fromDate)
                where.reportedAt.gte = fromDate;
            if (toDate)
                where.reportedAt.lte = toDate;
        }
        const complaintModel = this.prisma.cpcComplaintCase;
        const historyModel = this.prisma.cpcComplaintStatusHistory;
        const items = await complaintModel.findMany({
            where,
            select: {
                id: true,
                caseNumber: true,
                localityId: true,
                complaintType: true,
                status: true,
                procedureType: true,
                reportedAt: true,
                updatedAt: true,
                archivedAt: true,
                retaliationRisk: true,
                aggressorRank: true,
                aggressorAgeRange: true,
                victimRank: true,
                victimAgeRange: true,
                detailedViolenceType: true,
                locality: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });
        const statusCounter = new Map(CPCA_STATUS_ORDER.map((status) => [status, 0]));
        const procedureCounter = new Map(CPCA_PROCEDURE_ORDER.map((proc) => [proc, 0]));
        const complaintTypeCounter = new Map(CPCA_COMPLAINT_TYPE_ORDER.map((type) => [type, 0]));
        const detailedTypeCounter = new Map();
        const aggressorAgeRangeCounter = new Map();
        const victimAgeRangeCounter = new Map();
        if (!items.length) {
            return {
                filters: {
                    localityId: where.localityId ?? null,
                    from: fromDate ? fromDate.toISOString().slice(0, 10) : null,
                    to: toDate ? toDate.toISOString().slice(0, 10) : null,
                },
                generatedAt: new Date().toISOString(),
                summary: {
                    totalCases: 0,
                    openCases: 0,
                    concludedCases: 0,
                    archivedCases: 0,
                    closureRatePercent: 0,
                    averageDaysToClosure: 0,
                    moralCases: 0,
                    sexualCases: 0,
                    retaliationRiskCases: 0,
                    triageOver7Days: 0,
                    investigationOver30Days: 0,
                    stalledOver30Days: 0,
                    stalledOver60Days: 0,
                    noUpdateOver14Days: 0,
                },
                statusDistribution: Array.from(statusCounter.entries()).map(([status, count]) => ({
                    status,
                    count,
                })),
                procedureDistribution: Array.from(procedureCounter.entries()).map(([procedureType, count]) => ({
                    procedureType,
                    count,
                })),
                complaintTypeDistribution: Array.from(complaintTypeCounter.entries()).map(([complaintType, count]) => ({
                    complaintType,
                    count,
                })),
                detailedTypeDistribution: [],
                aggressorAgeRangeDistribution: [],
                victimAgeRangeDistribution: [],
                monthlyTrend: [],
                openByAgeBuckets: [
                    { bucket: '0-7', count: 0 },
                    { bucket: '8-14', count: 0 },
                    { bucket: '15-30', count: 0 },
                    { bucket: '31-60', count: 0 },
                    { bucket: '61+', count: 0 },
                ],
                topRiskLocalities: [],
                topAggressorRanks: [],
                topVictimRanks: [],
                criticalOpenCases: [],
                kpiDetails: {
                    totalCases: [],
                    openCases: [],
                    closureRate: [],
                    averageClosureTime: [],
                    triageOver7Days: [],
                    investigationOver30Days: [],
                },
            };
        }
        const caseIds = items.map((item) => item.id);
        const closureTransitions = await historyModel.findMany({
            where: {
                complaintCaseId: { in: caseIds },
                toStatus: { in: ['CONCLUDED', 'ARCHIVED'] },
            },
            select: {
                complaintCaseId: true,
                changedAt: true,
            },
            orderBy: { changedAt: 'asc' },
        });
        const closedAtByCaseId = new Map();
        for (const entry of closureTransitions ?? []) {
            const complaintCaseId = String(entry.complaintCaseId ?? '');
            if (!complaintCaseId || closedAtByCaseId.has(complaintCaseId))
                continue;
            if (entry.changedAt instanceof Date &&
                !Number.isNaN(entry.changedAt.getTime())) {
                closedAtByCaseId.set(complaintCaseId, entry.changedAt);
            }
        }
        const now = new Date();
        const KPI_DETAILS_LIMIT = 300;
        const toDateIso = (value) => value instanceof Date && !Number.isNaN(value.getTime())
            ? value.toISOString()
            : null;
        const toCaseDetailItem = (item) => {
            const status = String(item.status ?? '');
            const reportedAt = item.reportedAt instanceof Date &&
                !Number.isNaN(item.reportedAt.getTime())
                ? item.reportedAt
                : null;
            const updatedAt = item.updatedAt instanceof Date &&
                !Number.isNaN(item.updatedAt.getTime())
                ? item.updatedAt
                : null;
            const isOpen = CPCA_OPEN_STATUS_SET.has(status);
            const openDays = reportedAt && isOpen ? this.daysBetween(reportedAt, now) : 0;
            const idleDays = reportedAt && isOpen
                ? this.daysBetween(updatedAt ?? reportedAt, now)
                : 0;
            const closedAt = closedAtByCaseId.get(item.id) ??
                (status === 'ARCHIVED'
                    ? (item.archivedAt ?? updatedAt ?? null)
                    : status === 'CONCLUDED'
                        ? (updatedAt ?? null)
                        : null);
            const daysToClosure = reportedAt &&
                closedAt instanceof Date &&
                !Number.isNaN(closedAt.getTime())
                ? this.daysBetween(reportedAt, closedAt)
                : null;
            return {
                caseId: String(item.id ?? ''),
                caseNumber: String(item.caseNumber ?? ''),
                localityId: String(item.localityId ?? ''),
                localityCode: String(item.locality?.code ?? ''),
                localityName: String(item.locality?.name ?? ''),
                status,
                complaintType: String(item.complaintType ?? ''),
                detailedViolenceType: String(item.detailedViolenceType ?? ''),
                procedureType: String(item.procedureType ?? ''),
                retaliationRisk: Boolean(item.retaliationRisk),
                reportedAt: toDateIso(reportedAt),
                updatedAt: toDateIso(updatedAt),
                closedAt: toDateIso(closedAt instanceof Date ? closedAt : null),
                openDays,
                idleDays,
                daysToClosure,
            };
        };
        const sortByReportedAtDesc = (a, b) => new Date(b.reportedAt ?? 0).getTime() -
            new Date(a.reportedAt ?? 0).getTime();
        const sortByOpenCriticality = (a, b) => {
            if (Number(b.retaliationRisk) !== Number(a.retaliationRisk)) {
                return Number(b.retaliationRisk) - Number(a.retaliationRisk);
            }
            if (b.openDays !== a.openDays)
                return b.openDays - a.openDays;
            if (b.idleDays !== a.idleDays)
                return b.idleDays - a.idleDays;
            return sortByReportedAtDesc(a, b);
        };
        const sortByClosureTimeDesc = (a, b) => {
            if (Number(b.daysToClosure ?? 0) !== Number(a.daysToClosure ?? 0)) {
                return Number(b.daysToClosure ?? 0) - Number(a.daysToClosure ?? 0);
            }
            return sortByReportedAtDesc(a, b);
        };
        const caseDetailItems = items.map((item) => toCaseDetailItem(item));
        const totalCaseDetailItems = caseDetailItems
            .slice()
            .sort(sortByReportedAtDesc)
            .slice(0, KPI_DETAILS_LIMIT);
        const openCaseDetailItems = caseDetailItems
            .filter((item) => CPCA_OPEN_STATUS_SET.has(String(item.status ?? '')))
            .sort(sortByOpenCriticality)
            .slice(0, KPI_DETAILS_LIMIT);
        const closedCaseDetailItems = caseDetailItems
            .filter((item) => ['CONCLUDED', 'ARCHIVED'].includes(String(item.status ?? '')))
            .sort(sortByClosureTimeDesc)
            .slice(0, KPI_DETAILS_LIMIT);
        const triageOver7CaseDetailItems = openCaseDetailItems
            .filter((item) => CPCA_TRIAGE_STATUS_SET.has(String(item.status ?? '')) &&
            Number(item.openDays ?? 0) > 7)
            .slice(0, KPI_DETAILS_LIMIT);
        const investigationOver30CaseDetailItems = openCaseDetailItems
            .filter((item) => CPCA_INVESTIGATION_STATUS_SET.has(String(item.status ?? '')) &&
            Number(item.openDays ?? 0) > 30)
            .slice(0, KPI_DETAILS_LIMIT);
        const monthCounter = new Map();
        const localityCounter = new Map();
        const aggressorRankCounter = new Map();
        const victimRankCounter = new Map();
        const openAgeBuckets = {
            '0-7': 0,
            '8-14': 0,
            '15-30': 0,
            '31-60': 0,
            '61+': 0,
        };
        const criticalOpenCases = [];
        let openCases = 0;
        let concludedCases = 0;
        let archivedCases = 0;
        let retaliationRiskCases = 0;
        let triageOver7Days = 0;
        let investigationOver30Days = 0;
        let stalledOver30Days = 0;
        let stalledOver60Days = 0;
        let noUpdateOver14Days = 0;
        let closureDaysTotal = 0;
        let closureSamples = 0;
        for (const item of items) {
            const status = String(item.status ?? '');
            const procedureType = String(item.procedureType ?? '');
            const complaintType = String(item.complaintType ?? '');
            const detailedViolenceType = String(item.detailedViolenceType ?? '');
            statusCounter.set(status, (statusCounter.get(status) ?? 0) + 1);
            procedureCounter.set(procedureType, (procedureCounter.get(procedureType) ?? 0) + 1);
            complaintTypeCounter.set(complaintType, (complaintTypeCounter.get(complaintType) ?? 0) + 1);
            if (detailedViolenceType) {
                detailedTypeCounter.set(detailedViolenceType, (detailedTypeCounter.get(detailedViolenceType) ?? 0) + 1);
            }
            if (item.aggressorAgeRange) {
                const key = String(item.aggressorAgeRange);
                aggressorAgeRangeCounter.set(key, (aggressorAgeRangeCounter.get(key) ?? 0) + 1);
            }
            if (item.victimAgeRange) {
                const key = String(item.victimAgeRange);
                victimAgeRangeCounter.set(key, (victimAgeRangeCounter.get(key) ?? 0) + 1);
            }
            if (item.retaliationRisk) {
                retaliationRiskCases += 1;
            }
            const month = item.reportedAt.toISOString().slice(0, 7);
            const monthEntry = monthCounter.get(month) ?? {
                month,
                total: 0,
                moral: 0,
                sexual: 0,
                open: 0,
            };
            monthEntry.total += 1;
            if (complaintType === 'MORAL')
                monthEntry.moral += 1;
            if (complaintType === 'SEXUAL')
                monthEntry.sexual += 1;
            const localityEntry = localityCounter.get(item.localityId) ?? {
                localityId: item.localityId,
                localityCode: String(item.locality?.code ?? ''),
                localityName: String(item.locality?.name ?? item.localityId),
                totalCases: 0,
                openCases: 0,
                sexualCases: 0,
                retaliationRiskCases: 0,
                stalledOver30Days: 0,
                openDaysTotal: 0,
            };
            localityEntry.totalCases += 1;
            if (complaintType === 'SEXUAL')
                localityEntry.sexualCases += 1;
            if (item.retaliationRisk)
                localityEntry.retaliationRiskCases += 1;
            const aggressorRank = this.normalizeRankForStats(item.aggressorRank);
            const victimRank = this.normalizeRankForStats(item.victimRank);
            if (aggressorRank) {
                aggressorRankCounter.set(aggressorRank, (aggressorRankCounter.get(aggressorRank) ?? 0) + 1);
            }
            if (victimRank) {
                victimRankCounter.set(victimRank, (victimRankCounter.get(victimRank) ?? 0) + 1);
            }
            if (CPCA_OPEN_STATUS_SET.has(status)) {
                openCases += 1;
                monthEntry.open += 1;
                localityEntry.openCases += 1;
                const openDays = this.daysBetween(item.reportedAt, now);
                localityEntry.openDaysTotal += openDays;
                const idleDays = this.daysBetween(item.updatedAt ?? item.reportedAt, now);
                if (idleDays > 14) {
                    noUpdateOver14Days += 1;
                }
                if (CPCA_TRIAGE_STATUS_SET.has(status) && openDays > 7) {
                    triageOver7Days += 1;
                }
                if (CPCA_INVESTIGATION_STATUS_SET.has(status) && openDays > 30) {
                    investigationOver30Days += 1;
                }
                if (openDays > 30) {
                    stalledOver30Days += 1;
                    localityEntry.stalledOver30Days += 1;
                }
                if (openDays > 60) {
                    stalledOver60Days += 1;
                }
                if (openDays <= 7)
                    openAgeBuckets['0-7'] += 1;
                else if (openDays <= 14)
                    openAgeBuckets['8-14'] += 1;
                else if (openDays <= 30)
                    openAgeBuckets['15-30'] += 1;
                else if (openDays <= 60)
                    openAgeBuckets['31-60'] += 1;
                else
                    openAgeBuckets['61+'] += 1;
                criticalOpenCases.push({
                    caseId: item.id,
                    caseNumber: item.caseNumber,
                    localityId: item.localityId,
                    localityCode: String(item.locality?.code ?? ''),
                    localityName: String(item.locality?.name ?? ''),
                    status,
                    complaintType,
                    detailedViolenceType,
                    reportedAt: item.reportedAt.toISOString(),
                    openDays,
                    idleDays,
                    retaliationRisk: Boolean(item.retaliationRisk),
                });
            }
            else {
                if (status === 'CONCLUDED')
                    concludedCases += 1;
                if (status === 'ARCHIVED')
                    archivedCases += 1;
            }
            const closedAt = closedAtByCaseId.get(item.id) ??
                (status === 'ARCHIVED'
                    ? (item.archivedAt ?? item.updatedAt ?? null)
                    : status === 'CONCLUDED'
                        ? (item.updatedAt ?? null)
                        : null);
            if (closedAt instanceof Date && !Number.isNaN(closedAt.getTime())) {
                closureDaysTotal += this.daysBetween(item.reportedAt, closedAt);
                closureSamples += 1;
            }
            localityCounter.set(item.localityId, localityEntry);
            monthCounter.set(month, monthEntry);
        }
        const totalCases = items.length;
        const closedCases = concludedCases + archivedCases;
        const topRiskLocalities = Array.from(localityCounter.values())
            .map((entry) => {
            const averageOpenDays = entry.openCases
                ? Number((entry.openDaysTotal / entry.openCases).toFixed(1))
                : 0;
            const riskScore = entry.openCases * 2 +
                entry.retaliationRiskCases * 3 +
                entry.stalledOver30Days +
                entry.sexualCases;
            return {
                ...entry,
                averageOpenDays,
                riskScore,
            };
        })
            .sort((a, b) => {
            if (b.riskScore !== a.riskScore)
                return b.riskScore - a.riskScore;
            if (b.openCases !== a.openCases)
                return b.openCases - a.openCases;
            return a.localityName.localeCompare(b.localityName, 'pt-BR');
        })
            .slice(0, 12);
        const sortedCriticalOpenCases = criticalOpenCases
            .sort((a, b) => {
            if (Number(b.retaliationRisk) !== Number(a.retaliationRisk)) {
                return Number(b.retaliationRisk) - Number(a.retaliationRisk);
            }
            if (b.openDays !== a.openDays)
                return b.openDays - a.openDays;
            return b.idleDays - a.idleDays;
        })
            .slice(0, 20);
        return {
            filters: {
                localityId: where.localityId ?? null,
                from: fromDate ? fromDate.toISOString().slice(0, 10) : null,
                to: toDate ? toDate.toISOString().slice(0, 10) : null,
            },
            generatedAt: now.toISOString(),
            summary: {
                totalCases,
                openCases,
                concludedCases,
                archivedCases,
                closureRatePercent: totalCases
                    ? Math.round((closedCases / totalCases) * 100)
                    : 0,
                averageDaysToClosure: closureSamples
                    ? Number((closureDaysTotal / closureSamples).toFixed(1))
                    : 0,
                moralCases: complaintTypeCounter.get('MORAL') ?? 0,
                sexualCases: complaintTypeCounter.get('SEXUAL') ?? 0,
                retaliationRiskCases,
                triageOver7Days,
                investigationOver30Days,
                stalledOver30Days,
                stalledOver60Days,
                noUpdateOver14Days,
            },
            statusDistribution: Array.from(statusCounter.entries()).map(([status, count]) => ({
                status,
                count,
            })),
            procedureDistribution: Array.from(procedureCounter.entries()).map(([procedureType, count]) => ({
                procedureType,
                count,
            })),
            complaintTypeDistribution: Array.from(complaintTypeCounter.entries()).map(([complaintType, count]) => ({
                complaintType,
                count,
            })),
            detailedTypeDistribution: this.toSortedGenericDistribution(detailedTypeCounter, 'detailedViolenceType'),
            aggressorAgeRangeDistribution: this.toSortedGenericDistribution(aggressorAgeRangeCounter, 'ageRange'),
            victimAgeRangeDistribution: this.toSortedGenericDistribution(victimAgeRangeCounter, 'ageRange'),
            monthlyTrend: Array.from(monthCounter.values()).sort((a, b) => a.month.localeCompare(b.month)),
            openByAgeBuckets: [
                { bucket: '0-7', count: openAgeBuckets['0-7'] },
                { bucket: '8-14', count: openAgeBuckets['8-14'] },
                { bucket: '15-30', count: openAgeBuckets['15-30'] },
                { bucket: '31-60', count: openAgeBuckets['31-60'] },
                { bucket: '61+', count: openAgeBuckets['61+'] },
            ],
            topRiskLocalities,
            topAggressorRanks: this.toTopRankDistribution(aggressorRankCounter, 10),
            topVictimRanks: this.toTopRankDistribution(victimRankCounter, 10),
            criticalOpenCases: sortedCriticalOpenCases,
            kpiDetails: {
                totalCases: totalCaseDetailItems,
                openCases: openCaseDetailItems,
                closureRate: closedCaseDetailItems,
                averageClosureTime: closedCaseDetailItems,
                triageOver7Days: triageOver7CaseDetailItems,
                investigationOver30Days: investigationOver30CaseDetailItems,
            },
        };
    }
    async getById(id, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const complaintModel = this.prisma.cpcComplaintCase;
        const item = await complaintModel.findUnique({
            where: { id },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        createdBy: { select: { id: true, name: true, email: true } },
                    },
                },
                statusHistory: {
                    orderBy: { changedAt: 'asc' },
                    include: {
                        changedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!item)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (item.workflowScope !== workflowContext.workflowScope) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertCaseAccess(item.localityId, user, workflowContext);
        return item;
    }
    async create(payload, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const localityId = await this.resolveTargetLocalityId(payload.omId ?? payload.localityId, user, workflowContext);
        const actorId = this.requireUserId(user);
        const locality = await this.prisma.locality.findUnique({
            where: { id: localityId },
            select: { id: true, code: true },
        });
        if (!locality)
            (0, http_error_1.throwError)('NOT_FOUND');
        const complaintModel = this.prisma.cpcComplaintCase;
        const historyModel = this.prisma.cpcComplaintStatusHistory;
        const status = payload.status ?? 'RECEIVED';
        const procedureType = payload.procedureType ?? 'NOT_DEFINED';
        if (status === 'CONCLUDED' || status === 'ARCHIVED') {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'status',
                reason: 'INITIAL_STATUS_MUST_BE_OPEN',
            });
        }
        this.assertIcaConsistency({
            status,
            complaintType: payload.complaintType,
            confidentialityTermSigned: payload.confidentialityTermSigned ?? false,
            preliminaryReportGenerated: payload.preliminaryReportGenerated ?? false,
            preliminaryReportDate: payload.preliminaryReportDate,
            victimAccusedSeparationEvaluated: payload.victimAccusedSeparationEvaluated ?? false,
            victimAccusedSeparationApplied: payload.victimAccusedSeparationApplied ?? false,
            outsourcedAccused: payload.outsourcedAccused ?? false,
            contractorReferralDate: payload.contractorReferralDate,
            outcomeSummary: payload.outcomeSummary,
            accusedDefenseEnsured: payload.accusedDefenseEnsured ?? false,
        });
        const createData = {
            complaintType: payload.complaintType,
            notifierType: payload.notifierType ?? 'VITIMA',
            status,
            procedureType,
            incidentDate: payload.incidentDate
                ? new Date(payload.incidentDate)
                : null,
            aggressorRank: this.cleanText(payload.aggressorRank),
            aggressorGender: payload.aggressorGender,
            aggressorAgeRange: this.cleanOptional(payload.aggressorAgeRange),
            victimRank: this.cleanText(payload.victimRank),
            victimGender: payload.victimGender,
            victimAgeRange: this.cleanOptional(payload.victimAgeRange),
            detailedViolenceType: this.cleanOptional(payload.detailedViolenceType),
            harassmentContext: this.cleanOptional(payload.harassmentContext),
            occurrenceLocation: this.cleanOptional(payload.occurrenceLocation),
            incidentFrequency: this.cleanOptional(payload.incidentFrequency),
            hierarchicalFunctionalRelation: this.cleanOptional(payload.hierarchicalFunctionalRelation),
            occurrenceForm: this.cleanOptional(payload.occurrenceForm),
            administrativeProcedure: this.cleanOptional(payload.administrativeProcedure),
            procedureCurrentSituation: this.cleanOptional(payload.procedureCurrentSituation),
            retaliationReported: this.cleanOptional(payload.retaliationReported),
            retaliationAgainst: this.cleanOptional(payload.retaliationAgainst),
            evidenceCount: payload.evidenceCount ?? 0,
            evidenceSummary: this.cleanOptional(payload.evidenceSummary),
            confidentialityTermSigned: payload.confidentialityTermSigned ?? false,
            confidentialityHandlingNotes: this.cleanOptional(payload.confidentialityHandlingNotes),
            cpcaMembersExcludedFromInquiry: payload.cpcaMembersExcludedFromInquiry ?? true,
            immediateProtectionMeasures: this.cleanOptional(payload.immediateProtectionMeasures),
            privateSupportActions: this.cleanOptional(payload.privateSupportActions),
            psychologicalSupportProvided: payload.psychologicalSupportProvided ?? false,
            medicalSupportProvided: payload.medicalSupportProvided ?? false,
            socialSupportProvided: payload.socialSupportProvided ?? false,
            legalSupportProvided: payload.legalSupportProvided ?? false,
            contactRestrictionApplied: payload.contactRestrictionApplied ?? false,
            preliminaryAnalysis: this.cleanOptional(payload.preliminaryAnalysis),
            preliminaryReportGenerated: payload.preliminaryReportGenerated ?? false,
            preliminaryReportDate: payload.preliminaryReportDate
                ? new Date(payload.preliminaryReportDate)
                : null,
            procedureReference: this.cleanOptional(payload.procedureReference),
            procedureNotes: this.cleanOptional(payload.procedureNotes),
            womenLedHandlingPrioritized: payload.womenLedHandlingPrioritized === undefined
                ? null
                : payload.womenLedHandlingPrioritized,
            victimAccusedSeparationEvaluated: payload.victimAccusedSeparationEvaluated ?? false,
            victimAccusedSeparationApplied: payload.victimAccusedSeparationApplied ?? false,
            accusedDefenseEnsured: payload.accusedDefenseEnsured ?? false,
            outcomeSummary: this.cleanOptional(payload.outcomeSummary),
            notifierFeedbackSummary: this.cleanOptional(payload.notifierFeedbackSummary),
            victimFeedbackSummary: this.cleanOptional(payload.victimFeedbackSummary),
            notifierFeedbackDate: payload.notifierFeedbackDate
                ? new Date(payload.notifierFeedbackDate)
                : null,
            victimFeedbackDate: payload.victimFeedbackDate
                ? new Date(payload.victimFeedbackDate)
                : null,
            retaliationRisk: payload.retaliationRisk ?? false,
            retaliationNotes: this.cleanOptional(payload.retaliationNotes),
            outsourcedAccused: payload.outsourcedAccused ?? false,
            contractorReferralDate: payload.contractorReferralDate
                ? new Date(payload.contractorReferralDate)
                : null,
            contractorFollowUpNotes: this.cleanOptional(payload.contractorFollowUpNotes),
            archivedAt: null,
        };
        let created = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const nextCaseNumber = await this.generateCaseNumber(locality.code ?? 'OM', workflowContext.caseNumberPrefix);
            try {
                created = await complaintModel.create({
                    data: {
                        caseNumber: nextCaseNumber,
                        workflowScope: workflowContext.workflowScope,
                        locality: { connect: { id: localityId } },
                        createdBy: { connect: { id: actorId } },
                        updatedBy: { connect: { id: actorId } },
                        ...createData,
                    },
                    include: {
                        locality: { select: { id: true, code: true, name: true } },
                    },
                });
                break;
            }
            catch (error) {
                if (this.isCaseNumberConflict(error)) {
                    continue;
                }
                throw error;
            }
        }
        if (!created) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'CASE_NUMBER_GENERATION_FAILED',
            });
        }
        await historyModel.create({
            data: {
                complaintCaseId: created.id,
                fromStatus: null,
                toStatus: status,
                fromProcedure: null,
                toProcedure: procedureType,
                note: 'Registro inicial da notificação.',
                changedById: actorId,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: workflowContext.resource,
            action: 'create',
            entityId: created.id,
            localityId: created.localityId,
            diffJson: {
                caseNumber: created.caseNumber,
                workflowScope: workflowContext.workflowScope,
                complaintType: created.complaintType,
                status: created.status,
                procedureType: created.procedureType,
            },
        });
        return created;
    }
    async update(id, payload, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const complaintModel = this.prisma.cpcComplaintCase;
        const historyModel = this.prisma.cpcComplaintStatusHistory;
        const actorId = this.requireUserId(user);
        const current = await complaintModel.findUnique({
            where: { id },
            select: {
                id: true,
                localityId: true,
                workflowScope: true,
                complaintType: true,
                confidentialityTermSigned: true,
                status: true,
                procedureType: true,
                preliminaryReportGenerated: true,
                preliminaryReportDate: true,
                victimAccusedSeparationEvaluated: true,
                victimAccusedSeparationApplied: true,
                outsourcedAccused: true,
                contractorReferralDate: true,
                accusedDefenseEnsured: true,
                outcomeSummary: true,
            },
        });
        if (!current)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (current.workflowScope !== workflowContext.workflowScope) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertCaseAccess(current.localityId, user, workflowContext);
        const targetLocalityIdRaw = payload.omId ?? payload.localityId;
        const nextLocalityId = targetLocalityIdRaw
            ? await this.resolveTargetLocalityId(targetLocalityIdRaw, user, workflowContext)
            : current.localityId;
        const nextStatus = payload.status ?? current.status;
        const nextProcedure = payload.procedureType ?? current.procedureType;
        this.assertStatusTransition(current.status, nextStatus);
        const nextComplaintType = payload.complaintType ?? current.complaintType;
        const nextConfidentialityTermSigned = payload.confidentialityTermSigned ?? current.confidentialityTermSigned;
        const nextPreliminaryReportGenerated = payload.preliminaryReportGenerated ?? current.preliminaryReportGenerated;
        const nextPreliminaryReportDate = payload.preliminaryReportDate === undefined
            ? current.preliminaryReportDate
            : payload.preliminaryReportDate
                ? new Date(payload.preliminaryReportDate)
                : null;
        const nextVictimAccusedSeparationEvaluated = payload.victimAccusedSeparationEvaluated ??
            current.victimAccusedSeparationEvaluated;
        const nextVictimAccusedSeparationApplied = payload.victimAccusedSeparationApplied ??
            current.victimAccusedSeparationApplied;
        const nextOutsourcedAccused = payload.outsourcedAccused ?? current.outsourcedAccused;
        const nextContractorReferralDate = payload.contractorReferralDate === undefined
            ? current.contractorReferralDate
            : payload.contractorReferralDate
                ? new Date(payload.contractorReferralDate)
                : null;
        const nextAccusedDefenseEnsured = payload.accusedDefenseEnsured ?? current.accusedDefenseEnsured;
        const nextOutcomeSummary = payload.outcomeSummary === undefined
            ? current.outcomeSummary
            : this.cleanOptional(payload.outcomeSummary);
        this.assertIcaConsistency({
            status: nextStatus,
            complaintType: nextComplaintType,
            confidentialityTermSigned: nextConfidentialityTermSigned,
            preliminaryReportGenerated: nextPreliminaryReportGenerated,
            preliminaryReportDate: nextPreliminaryReportDate,
            victimAccusedSeparationEvaluated: nextVictimAccusedSeparationEvaluated,
            victimAccusedSeparationApplied: nextVictimAccusedSeparationApplied,
            outsourcedAccused: nextOutsourcedAccused,
            contractorReferralDate: nextContractorReferralDate,
            outcomeSummary: nextOutcomeSummary,
            accusedDefenseEnsured: nextAccusedDefenseEnsured,
        });
        const updated = await complaintModel.update({
            where: { id },
            data: {
                locality: { connect: { id: nextLocalityId } },
                complaintType: payload.complaintType,
                notifierType: payload.notifierType,
                status: payload.status,
                procedureType: payload.procedureType,
                incidentDate: payload.incidentDate
                    ? new Date(payload.incidentDate)
                    : undefined,
                aggressorRank: payload.aggressorRank
                    ? this.cleanText(payload.aggressorRank)
                    : undefined,
                aggressorGender: payload.aggressorGender,
                aggressorAgeRange: payload.aggressorAgeRange !== undefined
                    ? this.cleanOptional(payload.aggressorAgeRange)
                    : undefined,
                victimRank: payload.victimRank
                    ? this.cleanText(payload.victimRank)
                    : undefined,
                victimGender: payload.victimGender,
                victimAgeRange: payload.victimAgeRange !== undefined
                    ? this.cleanOptional(payload.victimAgeRange)
                    : undefined,
                detailedViolenceType: payload.detailedViolenceType !== undefined
                    ? this.cleanOptional(payload.detailedViolenceType)
                    : undefined,
                harassmentContext: payload.harassmentContext !== undefined
                    ? this.cleanOptional(payload.harassmentContext)
                    : undefined,
                occurrenceLocation: payload.occurrenceLocation !== undefined
                    ? this.cleanOptional(payload.occurrenceLocation)
                    : undefined,
                incidentFrequency: payload.incidentFrequency !== undefined
                    ? this.cleanOptional(payload.incidentFrequency)
                    : undefined,
                hierarchicalFunctionalRelation: payload.hierarchicalFunctionalRelation !== undefined
                    ? this.cleanOptional(payload.hierarchicalFunctionalRelation)
                    : undefined,
                occurrenceForm: payload.occurrenceForm !== undefined
                    ? this.cleanOptional(payload.occurrenceForm)
                    : undefined,
                administrativeProcedure: payload.administrativeProcedure !== undefined
                    ? this.cleanOptional(payload.administrativeProcedure)
                    : undefined,
                procedureCurrentSituation: payload.procedureCurrentSituation !== undefined
                    ? this.cleanOptional(payload.procedureCurrentSituation)
                    : undefined,
                retaliationReported: payload.retaliationReported !== undefined
                    ? this.cleanOptional(payload.retaliationReported)
                    : undefined,
                retaliationAgainst: payload.retaliationAgainst !== undefined
                    ? this.cleanOptional(payload.retaliationAgainst)
                    : undefined,
                evidenceCount: payload.evidenceCount,
                evidenceSummary: payload.evidenceSummary !== undefined
                    ? this.cleanOptional(payload.evidenceSummary)
                    : undefined,
                confidentialityTermSigned: payload.confidentialityTermSigned,
                confidentialityHandlingNotes: payload.confidentialityHandlingNotes !== undefined
                    ? this.cleanOptional(payload.confidentialityHandlingNotes)
                    : undefined,
                cpcaMembersExcludedFromInquiry: payload.cpcaMembersExcludedFromInquiry,
                immediateProtectionMeasures: payload.immediateProtectionMeasures !== undefined
                    ? this.cleanOptional(payload.immediateProtectionMeasures)
                    : undefined,
                privateSupportActions: payload.privateSupportActions !== undefined
                    ? this.cleanOptional(payload.privateSupportActions)
                    : undefined,
                psychologicalSupportProvided: payload.psychologicalSupportProvided,
                medicalSupportProvided: payload.medicalSupportProvided,
                socialSupportProvided: payload.socialSupportProvided,
                legalSupportProvided: payload.legalSupportProvided,
                contactRestrictionApplied: payload.contactRestrictionApplied,
                preliminaryAnalysis: payload.preliminaryAnalysis !== undefined
                    ? this.cleanOptional(payload.preliminaryAnalysis)
                    : undefined,
                preliminaryReportGenerated: payload.preliminaryReportGenerated,
                preliminaryReportDate: payload.preliminaryReportDate !== undefined
                    ? payload.preliminaryReportDate
                        ? new Date(payload.preliminaryReportDate)
                        : null
                    : undefined,
                procedureReference: payload.procedureReference !== undefined
                    ? this.cleanOptional(payload.procedureReference)
                    : undefined,
                procedureNotes: payload.procedureNotes !== undefined
                    ? this.cleanOptional(payload.procedureNotes)
                    : undefined,
                womenLedHandlingPrioritized: payload.womenLedHandlingPrioritized,
                victimAccusedSeparationEvaluated: payload.victimAccusedSeparationEvaluated,
                victimAccusedSeparationApplied: payload.victimAccusedSeparationApplied,
                accusedDefenseEnsured: payload.accusedDefenseEnsured,
                outcomeSummary: payload.outcomeSummary !== undefined
                    ? this.cleanOptional(payload.outcomeSummary)
                    : undefined,
                notifierFeedbackSummary: payload.notifierFeedbackSummary !== undefined
                    ? this.cleanOptional(payload.notifierFeedbackSummary)
                    : undefined,
                victimFeedbackSummary: payload.victimFeedbackSummary !== undefined
                    ? this.cleanOptional(payload.victimFeedbackSummary)
                    : undefined,
                notifierFeedbackDate: payload.notifierFeedbackDate !== undefined
                    ? payload.notifierFeedbackDate
                        ? new Date(payload.notifierFeedbackDate)
                        : null
                    : undefined,
                victimFeedbackDate: payload.victimFeedbackDate !== undefined
                    ? payload.victimFeedbackDate
                        ? new Date(payload.victimFeedbackDate)
                        : null
                    : undefined,
                retaliationRisk: payload.retaliationRisk,
                retaliationNotes: payload.retaliationNotes !== undefined
                    ? this.cleanOptional(payload.retaliationNotes)
                    : undefined,
                outsourcedAccused: payload.outsourcedAccused,
                contractorReferralDate: payload.contractorReferralDate !== undefined
                    ? payload.contractorReferralDate
                        ? new Date(payload.contractorReferralDate)
                        : null
                    : undefined,
                contractorFollowUpNotes: payload.contractorFollowUpNotes !== undefined
                    ? this.cleanOptional(payload.contractorFollowUpNotes)
                    : undefined,
                archivedAt: payload.archivedAt !== undefined
                    ? payload.archivedAt
                        ? new Date(payload.archivedAt)
                        : null
                    : nextStatus === 'ARCHIVED'
                        ? new Date()
                        : undefined,
                updatedBy: { connect: { id: actorId } },
            },
            include: {
                locality: { select: { id: true, code: true, name: true } },
            },
        });
        if (current.status !== nextStatus ||
            current.procedureType !== nextProcedure) {
            await historyModel.create({
                data: {
                    complaintCaseId: id,
                    fromStatus: current.status,
                    toStatus: nextStatus,
                    fromProcedure: current.procedureType,
                    toProcedure: nextProcedure,
                    note: this.cleanOptional(payload.statusChangeNote),
                    changedById: actorId,
                },
            });
        }
        await this.audit.log({
            userId: user?.id,
            resource: workflowContext.resource,
            action: 'update',
            entityId: id,
            localityId: updated.localityId,
            diffJson: {
                workflowScope: workflowContext.workflowScope,
                status: updated.status,
                procedureType: updated.procedureType,
            },
        });
        return updated;
    }
    async remove(id, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const complaintModel = this.prisma.cpcComplaintCase;
        const current = await complaintModel.findUnique({
            where: { id },
            select: {
                id: true,
                workflowScope: true,
                caseNumber: true,
                localityId: true,
                complaintType: true,
                status: true,
                procedureType: true,
            },
        });
        if (!current)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (current.workflowScope !== workflowContext.workflowScope) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertCaseAccess(current.localityId, user, workflowContext);
        await complaintModel.delete({ where: { id } });
        await this.audit.log({
            userId: user?.id,
            resource: workflowContext.resource,
            action: 'delete',
            entityId: current.id,
            localityId: current.localityId,
            diffJson: {
                caseNumber: current.caseNumber,
                workflowScope: workflowContext.workflowScope,
                complaintType: current.complaintType,
                status: current.status,
                procedureType: current.procedureType,
            },
        });
        return { ok: true };
    }
    async addComment(id, text, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const complaintModel = this.prisma.cpcComplaintCase;
        const commentModel = this.prisma.cpcComplaintComment;
        const complaint = await complaintModel.findUnique({
            where: { id },
            select: { id: true, localityId: true, workflowScope: true },
        });
        if (!complaint)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (complaint.workflowScope !== workflowContext.workflowScope) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertCaseAccess(complaint.localityId, user, workflowContext);
        const normalizedText = this.cleanText(text);
        if (!normalizedText) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'text', reason: 'required' });
        }
        const created = await commentModel.create({
            data: {
                complaintCaseId: id,
                text: normalizedText,
                createdById: user?.id,
            },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: workflowContext.resource,
            action: 'comment',
            entityId: id,
            localityId: complaint.localityId,
            diffJson: {
                commentId: created.id,
                workflowScope: workflowContext.workflowScope,
            },
        });
        return created;
    }
    async listComments(id, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const workflowContext = this.resolveContext(context);
        const complaintModel = this.prisma.cpcComplaintCase;
        const commentModel = this.prisma.cpcComplaintComment;
        const complaint = await complaintModel.findUnique({
            where: { id },
            select: { id: true, localityId: true, workflowScope: true },
        });
        if (!complaint)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (complaint.workflowScope !== workflowContext.workflowScope) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertCaseAccess(complaint.localityId, user, workflowContext);
        const items = await commentModel.findMany({
            where: { complaintCaseId: id },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        return { items };
    }
    getScopeConstraints(user, context) {
        if (!user) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (this.hasNationalScope(user, context)) {
            return {};
        }
        if (this.hasLocalityScope(user, context)) {
            if (!user.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            return { localityId: user.localityId };
        }
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    hasCasePermission(user, context, scope) {
        if (!user)
            return false;
        return ['view', 'create', 'update', 'comment', 'delete'].some((action) => (0, role_access_1.hasPermission)(user, context.resource, action, scope));
    }
    hasNationalScope(user, context) {
        return this.hasCasePermission(user, context, 'NATIONAL');
    }
    hasLocalityScope(user, context) {
        return this.hasCasePermission(user, context, 'LOCALITY');
    }
    assertCaseAccess(localityId, user, context) {
        const constraints = this.getScopeConstraints(user, context);
        if (constraints.localityId && constraints.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async resolveTargetLocalityId(localityIdRaw, user, context = exports.CPCA_WORKFLOW_CONTEXT) {
        const constraints = this.getScopeConstraints(user, context);
        const localityId = String(localityIdRaw ?? '').trim();
        if (constraints.localityId) {
            if (localityId && localityId !== constraints.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            return constraints.localityId;
        }
        if (!localityId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityId',
                reason: 'required',
            });
        }
        return localityId;
    }
    resolveContext(context) {
        return context ?? exports.CPCA_WORKFLOW_CONTEXT;
    }
    cleanText(value) {
        return (0, sanitize_1.sanitizeText)(String(value ?? '')).trim();
    }
    cleanOptional(value) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        const normalized = this.cleanText(value);
        return normalized || null;
    }
    parseDateBoundary(rawValue, field, endOfDay) {
        const value = String(rawValue ?? '').trim();
        if (!value)
            return null;
        const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'INVALID_DATE' });
        }
        if (endOfDay && value.length === 10) {
            parsed.setUTCHours(23, 59, 59, 999);
        }
        return parsed;
    }
    daysBetween(start, end) {
        const diff = end.getTime() - start.getTime();
        if (!Number.isFinite(diff) || diff <= 0)
            return 0;
        return Math.ceil(diff / DAY_MS);
    }
    normalizeRankForStats(value) {
        const normalized = this.cleanText(String(value ?? ''));
        return normalized ? normalized.toUpperCase() : null;
    }
    toTopRankDistribution(counter, limit = 10) {
        return Array.from(counter.entries())
            .map(([rank, count]) => ({ rank, count }))
            .sort((a, b) => {
            if (b.count !== a.count)
                return b.count - a.count;
            return a.rank.localeCompare(b.rank, 'pt-BR');
        })
            .slice(0, limit);
    }
    toSortedGenericDistribution(counter, key) {
        return Array.from(counter.entries())
            .map(([value, count]) => ({ [key]: value, count }))
            .sort((a, b) => {
            if (b.count !== a.count)
                return b.count - a.count;
            return String(a[key]).localeCompare(String(b[key]), 'pt-BR');
        });
    }
    assertIcaConsistency(input) {
        if (input.complaintType === 'SEXUAL' && !input.confidentialityTermSigned) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'confidentialityTermSigned',
                reason: 'CONFIDENTIALITY_TERM_REQUIRED_FOR_SEXUAL',
            });
        }
        if (input.preliminaryReportDate && !input.preliminaryReportGenerated) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'preliminaryReportGenerated',
                reason: 'PRELIMINARY_REPORT_DATE_REQUIRES_FLAG',
            });
        }
        if (Boolean(input.victimAccusedSeparationApplied) &&
            !input.victimAccusedSeparationEvaluated) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'victimAccusedSeparationEvaluated',
                reason: 'SEPARATION_APPLIED_REQUIRES_EVALUATION',
            });
        }
        if (input.contractorReferralDate && !input.outsourcedAccused) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'outsourcedAccused',
                reason: 'CONTRACTOR_REFERRAL_REQUIRES_OUTSOURCED_FLAG',
            });
        }
        if (input.status === 'CONCLUDED' || input.status === 'ARCHIVED') {
            if (!this.cleanOptional(input.outcomeSummary)) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', {
                    field: 'outcomeSummary',
                    reason: 'OUTCOME_SUMMARY_REQUIRED_FOR_CLOSURE',
                });
            }
            if (!input.accusedDefenseEnsured) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', {
                    field: 'accusedDefenseEnsured',
                    reason: 'DEFENSE_CONFIRMATION_REQUIRED_FOR_CLOSURE',
                });
            }
        }
    }
    assertStatusTransition(currentStatus, nextStatus) {
        if (!nextStatus || currentStatus === nextStatus)
            return;
        const allowed = {
            RECEIVED: ['PROTECTION_MEASURES', 'PRELIMINARY_ANALYSIS'],
            PROTECTION_MEASURES: ['PRELIMINARY_ANALYSIS'],
            PRELIMINARY_ANALYSIS: ['PROCEDURE_DEFINED', 'INVESTIGATION'],
            PROCEDURE_DEFINED: ['INVESTIGATION', 'CONCLUDED'],
            INVESTIGATION: ['CONCLUDED'],
            CONCLUDED: ['ARCHIVED'],
            ARCHIVED: [],
        };
        const nextAllowed = allowed[currentStatus] ?? [];
        if (!nextAllowed.includes(nextStatus)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'status',
                reason: 'INVALID_STATUS_TRANSITION',
                from: currentStatus,
                to: nextStatus,
            });
        }
    }
    requireUserId(user) {
        if (!user?.id) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        return user.id;
    }
    async generateCaseNumber(localityCode, caseNumberPrefix) {
        const complaintModel = this.prisma.cpcComplaintCase;
        const year = new Date().getUTCFullYear();
        const localityToken = String(localityCode || 'OM')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase()
            .slice(0, 6) || 'OM';
        const prefix = `${caseNumberPrefix}-${year}-${localityToken}-`;
        const pattern = new RegExp(`^${prefix}(\\d{5})$`);
        const existing = await complaintModel.findMany({
            where: {
                caseNumber: { startsWith: prefix },
            },
            select: { caseNumber: true },
        });
        let maxSequence = 0;
        for (const item of existing ?? []) {
            const match = pattern.exec(String(item.caseNumber ?? ''));
            if (!match)
                continue;
            const value = Number.parseInt(match[1], 10);
            if (Number.isFinite(value) && value > maxSequence) {
                maxSequence = value;
            }
        }
        const nextSequence = String(maxSequence + 1).padStart(5, '0');
        return `${prefix}${nextSequence}`;
    }
    isCaseNumberConflict(error) {
        const code = String(error?.code ?? '');
        if (code !== 'P2002')
            return false;
        const target = error?.meta?.target;
        if (Array.isArray(target)) {
            return target.includes('caseNumber');
        }
        if (typeof target === 'string') {
            return target.includes('caseNumber');
        }
        return true;
    }
};
exports.CpcaService = CpcaService;
exports.CpcaService = CpcaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CpcaService);
//# sourceMappingURL=cpca.service.js.map