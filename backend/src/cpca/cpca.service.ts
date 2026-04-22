import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import {
  hasAnyRole,
  hasPermission,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import {
  getCpcaCaseInconsistencies,
  type CpcaCaseInconsistency,
} from './cpca-case-inconsistency';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';
import {
  isJudicialArchiveProcedureSituation,
  syncWorkflowStatusWithProcedureSituation,
} from './cpca-workflow';

const CPCA_STATUS_ORDER = [
  'RECEIVED',
  'PROTECTION_MEASURES',
  'PRELIMINARY_ANALYSIS',
  'PROCEDURE_DEFINED',
  'INVESTIGATION',
  'CONCLUDED',
  'ARCHIVED',
] as const;
const CPCA_PROCEDURE_ORDER = [
  'NOT_DEFINED',
  'PATD',
  'APF',
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
] as const;
const CPCA_COMPLAINT_TYPE_ORDER = ['MORAL', 'SEXUAL'] as const;
const CPCA_OPEN_STATUS_SET = new Set<string>([
  'RECEIVED',
  'PROTECTION_MEASURES',
  'PRELIMINARY_ANALYSIS',
  'PROCEDURE_DEFINED',
  'INVESTIGATION',
]);
const CPCA_TRIAGE_STATUS_SET = new Set<string>([
  'RECEIVED',
  'PROTECTION_MEASURES',
  'PRELIMINARY_ANALYSIS',
]);
const CPCA_INVESTIGATION_STATUS_SET = new Set<string>([
  'PROCEDURE_DEFINED',
  'INVESTIGATION',
]);
const CIPAVD_MANAGEMENT_ROLES = [
  ROLE_COORDENACAO_CIPAVD,
  ROLE_COMANDANTE_COMGEP,
  ROLE_TI,
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ComplaintWorkflowScope = 'CPCA' | 'SMIF';

export type ComplaintWorkflowContext = {
  workflowScope: ComplaintWorkflowScope;
  resource: 'cpca_cases' | 'smif_complaints';
  caseNumberPrefix: 'CPCA' | 'SMIF';
};

type ComplaintListFilters = {
  localityId?: string;
  status?: string;
  complaintType?: string;
  detailedViolenceType?: string;
  procedureType?: string;
  q?: string;
  page?: string;
  pageSize?: string;
};

export type CpcaAiContextReference = {
  id: string;
  label: string;
  description?: string;
  href: string;
};

export type CpcaAiContextCase = {
  caseId: string;
  caseNumber: string;
  omId: string | null;
  omLabel: string;
  status: string;
  complaintType: string;
  detailedViolenceType: string;
  procedureType: string;
  procedureCurrentSituation: string;
  reportedAt: string | null;
  incidentDate: string | null;
  openDays: number;
  retaliationRisk: boolean;
  link: string;
  inconsistencyCodes: string[];
  inconsistencies: Array<{
    code: string;
    badgeLabel: string;
    headline: string;
    summary: string;
    referenceTitle: string;
    tone: 'warning' | 'info';
  }>;
};

export type CpcaAiContext = {
  generatedAt: string;
  summary: {
    totalCases: number;
    openCases: number;
    concludedCases: number;
    archivedCases: number;
    moralCases: number;
    sexualCases: number;
    inconsistentCases: number;
  };
  topStatus: Array<{ status: string; count: number }>;
  topProcedures: Array<{ procedureType: string; count: number }>;
  topOms: Array<{ omId: string; omLabel: string; count: number }>;
  recentCases: CpcaAiContextCase[];
  matchedCases: CpcaAiContextCase[];
  criticalCases: CpcaAiContextCase[];
  inconsistentCases: CpcaAiContextCase[];
  inconsistencySummary: Array<{
    code: string;
    badgeLabel: string;
    headline: string;
    tone: 'warning' | 'info';
    count: number;
  }>;
  normativeReferences: Array<{
    code: string;
    referenceTitle: string;
    referenceBody: string;
  }>;
  references: CpcaAiContextReference[];
};

export const CPCA_WORKFLOW_CONTEXT: ComplaintWorkflowContext = {
  workflowScope: 'CPCA',
  resource: 'cpca_cases',
  caseNumberPrefix: 'CPCA',
};

export const SMIF_WORKFLOW_CONTEXT: ComplaintWorkflowContext = {
  workflowScope: 'SMIF',
  resource: 'smif_complaints',
  caseNumberPrefix: 'SMIF',
};

@Injectable()
export class CpcaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async localityOptions(user?: RbacUser) {
    const constraints = this.getScopeConstraints(user, CPCA_WORKFLOW_CONTEXT);
    const allowedLocalityIds = await this.resolveCpcaScopedLocalityIds(
      constraints,
      CPCA_WORKFLOW_CONTEXT,
    );
    const items = await this.prisma.om.findMany({
      where: {
        ...(allowedLocalityIds ? { id: { in: allowedLocalityIds } } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async list(
    filters: ComplaintListFilters,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const where = await this.buildComplaintWhere(
      filters,
      user,
      workflowContext,
    );
    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const threadModel = (this.prisma as any).cpcComplaintCipavdThread;

    const [items, total] = await this.prisma.$transaction([
      complaintModel.findMany({
        where,
        orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          om: { select: { id: true, code: true, name: true } },
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

    const complaintCaseIds = (items ?? [])
      .map((item: any) => String(item?.id ?? '').trim())
      .filter(Boolean);
    const cipavdThreads = complaintCaseIds.length
      ? await threadModel.findMany({
          where: { complaintCaseId: { in: complaintCaseIds } },
          select: {
            complaintCaseId: true,
            type: true,
            status: true,
            lastMessageAt: true,
          },
        })
      : [];
    const cipavdSummaryByCaseId =
      this.buildCipavdSummaryByCaseId(cipavdThreads);

    return {
      items: (items ?? []).map((item: any) => {
        const serialized = this.serializeComplaint(item);
        const cipavdCommentsSummary =
          cipavdSummaryByCaseId.get(String(item?.id ?? '')) ??
          this.buildEmptyCipavdSummary();
        const inconsistencies =
          workflowContext.workflowScope === 'CPCA'
            ? getCpcaCaseInconsistencies(serialized)
            : [];

        return {
          ...serialized,
          lastCommentAt: this.resolveLatestIsoDate(
            item.comments?.[0]?.createdAt ?? null,
            cipavdCommentsSummary.lastActivityAt,
          ),
          comments: undefined,
          cipavdCommentsSummary,
          inconsistencies,
        };
      }),
      page,
      pageSize,
      total,
    };
  }

  async pendingSummary(
    filters: ComplaintListFilters,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const where = await this.buildComplaintWhere(
      filters,
      user,
      workflowContext,
    );
    const threadModel = (this.prisma as any).cpcComplaintCipavdThread;
    const canReviewResolvedPendencies = this.isCipavdManagementUser(user);
    const detailsLimit = 200;

    const [
      openPendingCount,
      resolvedPendingCount,
      openThreads,
      resolvedThreads,
    ] = await Promise.all([
      threadModel.count({
        where: {
          type: 'PENDENCY',
          status: 'OPEN',
          complaintCase: where,
        },
      }),
      canReviewResolvedPendencies
        ? threadModel.count({
            where: {
              type: 'PENDENCY',
              status: 'RESOLVED',
              complaintCase: where,
            },
          })
        : Promise.resolve(0),
      threadModel.findMany({
        where: {
          type: 'PENDENCY',
          status: 'OPEN',
          complaintCase: where,
        },
        include: {
          complaintCase: {
            select: {
              id: true,
              caseNumber: true,
              status: true,
              procedureType: true,
              reportedAt: true,
              workflowScope: true,
              om: { select: { id: true, code: true, name: true } },
              locality: { select: { id: true, code: true, name: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: detailsLimit,
      }),
      canReviewResolvedPendencies
        ? threadModel.findMany({
            where: {
              type: 'PENDENCY',
              status: 'RESOLVED',
              complaintCase: where,
            },
            include: {
              complaintCase: {
                select: {
                  id: true,
                  caseNumber: true,
                  status: true,
                  procedureType: true,
                  reportedAt: true,
                  workflowScope: true,
                  om: { select: { id: true, code: true, name: true } },
                  locality: { select: { id: true, code: true, name: true } },
                },
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                  createdBy: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
            orderBy: { lastMessageAt: 'desc' },
            take: detailsLimit,
          })
        : Promise.resolve([]),
    ]);

    return {
      summary: {
        openPendingCount: Number(openPendingCount ?? 0),
        resolvedPendingCount: canReviewResolvedPendencies
          ? Number(resolvedPendingCount ?? 0)
          : 0,
        totalPendingCount:
          Number(openPendingCount ?? 0) +
          (canReviewResolvedPendencies ? Number(resolvedPendingCount ?? 0) : 0),
      },
      openItems: (openThreads ?? []).map((item: any) =>
        this.serializePendingSummaryItem(item),
      ),
      resolvedItems: canReviewResolvedPendencies
        ? (resolvedThreads ?? []).map((item: any) =>
            this.serializePendingSummaryItem(item),
          )
        : [],
    };
  }

  async stats(
    filters: {
      localityId?: string;
      from?: string;
      to?: string;
    },
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const constraints = this.getScopeConstraints(user, workflowContext);
    const cpcaScopedLocalityIds = await this.resolveCpcaScopedLocalityIds(
      constraints,
      workflowContext,
    );
    const where: any = {
      workflowScope: workflowContext.workflowScope,
    };
    const andConditions: any[] = [];

    if (filters.localityId) {
      where.omId = filters.localityId;
    }
    if (constraints.localityId) {
      if (workflowContext.workflowScope === 'CPCA') {
        if (
          filters.localityId &&
          (!cpcaScopedLocalityIds ||
            !cpcaScopedLocalityIds.includes(filters.localityId))
        ) {
          where.omId = '__none__';
        } else if (cpcaScopedLocalityIds?.length) {
          where.omId = filters.localityId
            ? filters.localityId
            : { in: cpcaScopedLocalityIds };
        }
      } else if (
        filters.localityId &&
        constraints.localityId !== filters.localityId
      ) {
        where.omId = '__none__';
      } else {
        where.omId = constraints.localityId;
      }
    }
    if (andConditions.length === 1) {
      Object.assign(where, andConditions[0]);
    } else if (andConditions.length > 1) {
      where.AND = andConditions;
    }

    const fromDate = this.parseDateBoundary(filters.from, 'from', false);
    const toDate = this.parseDateBoundary(filters.to, 'to', true);
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throwError('VALIDATION_ERROR', {
        field: 'from',
        reason: 'INVALID_DATE_RANGE',
      });
    }
    if (fromDate || toDate) {
      where.reportedAt = {};
      if (fromDate) where.reportedAt.gte = fromDate;
      if (toDate) where.reportedAt.lte = toDate;
    }

    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const historyModel = (this.prisma as any).cpcComplaintStatusHistory;
    const rawItems = await complaintModel.findMany({
      where,
      select: {
        id: true,
        caseNumber: true,
        omId: true,
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
        om: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
    const items = (rawItems ?? []).map((item: any) =>
      this.serializeComplaint(item),
    );

    const statusCounter = new Map<string, number>(
      CPCA_STATUS_ORDER.map((status) => [status, 0]),
    );
    const procedureCounter = new Map<string, number>(
      CPCA_PROCEDURE_ORDER.map((proc) => [proc, 0]),
    );
    const complaintTypeCounter = new Map<string, number>(
      CPCA_COMPLAINT_TYPE_ORDER.map((type) => [type, 0]),
    );
    const detailedTypeCounter = new Map<string, number>();
    const aggressorAgeRangeCounter = new Map<string, number>();
    const victimAgeRangeCounter = new Map<string, number>();

    if (!items.length) {
      return {
        filters: {
          localityId: where.omId ?? null,
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
        statusDistribution: Array.from(statusCounter.entries()).map(
          ([status, count]) => ({
            status,
            count,
          }),
        ),
        procedureDistribution: Array.from(procedureCounter.entries()).map(
          ([procedureType, count]) => ({
            procedureType,
            count,
          }),
        ),
        complaintTypeDistribution: Array.from(
          complaintTypeCounter.entries(),
        ).map(([complaintType, count]) => ({
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

    const caseIds = items.map((item: any) => item.id);
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
    const closedAtByCaseId = new Map<string, Date>();
    for (const entry of closureTransitions ?? []) {
      const complaintCaseId = String(entry.complaintCaseId ?? '');
      if (!complaintCaseId || closedAtByCaseId.has(complaintCaseId)) continue;
      if (
        entry.changedAt instanceof Date &&
        !Number.isNaN(entry.changedAt.getTime())
      ) {
        closedAtByCaseId.set(complaintCaseId, entry.changedAt);
      }
    }

    const now = new Date();
    const KPI_DETAILS_LIMIT = 300;
    const toDateIso = (value: Date | null | undefined) =>
      value instanceof Date && !Number.isNaN(value.getTime())
        ? value.toISOString()
        : null;
    const toCaseDetailItem = (item: any) => {
      const status = String(item.status ?? '');
      const reportedAt =
        item.reportedAt instanceof Date &&
        !Number.isNaN(item.reportedAt.getTime())
          ? item.reportedAt
          : null;
      const updatedAt =
        item.updatedAt instanceof Date &&
        !Number.isNaN(item.updatedAt.getTime())
          ? item.updatedAt
          : null;
      const isOpen = CPCA_OPEN_STATUS_SET.has(status);
      const openDays =
        reportedAt && isOpen ? this.daysBetween(reportedAt, now) : 0;
      const idleDays =
        reportedAt && isOpen
          ? this.daysBetween(updatedAt ?? reportedAt, now)
          : 0;
      const closedAt =
        closedAtByCaseId.get(item.id) ??
        (status === 'ARCHIVED'
          ? (item.archivedAt ?? updatedAt ?? null)
          : status === 'CONCLUDED'
            ? (updatedAt ?? null)
            : null);
      const daysToClosure =
        reportedAt &&
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
    const sortByReportedAtDesc = (a: any, b: any) =>
      new Date(b.reportedAt ?? 0).getTime() -
      new Date(a.reportedAt ?? 0).getTime();
    const sortByOpenCriticality = (a: any, b: any) => {
      if (Number(b.retaliationRisk) !== Number(a.retaliationRisk)) {
        return Number(b.retaliationRisk) - Number(a.retaliationRisk);
      }
      if (b.openDays !== a.openDays) return b.openDays - a.openDays;
      if (b.idleDays !== a.idleDays) return b.idleDays - a.idleDays;
      return sortByReportedAtDesc(a, b);
    };
    const sortByClosureTimeDesc = (a: any, b: any) => {
      if (Number(b.daysToClosure ?? 0) !== Number(a.daysToClosure ?? 0)) {
        return Number(b.daysToClosure ?? 0) - Number(a.daysToClosure ?? 0);
      }
      return sortByReportedAtDesc(a, b);
    };
    const caseDetailItems = items.map((item: any) => toCaseDetailItem(item));
    const totalCaseDetailItems = caseDetailItems
      .slice()
      .sort(sortByReportedAtDesc)
      .slice(0, KPI_DETAILS_LIMIT);
    const openCaseDetailItems = caseDetailItems
      .filter((item: any) =>
        CPCA_OPEN_STATUS_SET.has(String(item.status ?? '')),
      )
      .sort(sortByOpenCriticality)
      .slice(0, KPI_DETAILS_LIMIT);
    const closedCaseDetailItems = caseDetailItems
      .filter((item: any) =>
        ['CONCLUDED', 'ARCHIVED'].includes(String(item.status ?? '')),
      )
      .sort(sortByClosureTimeDesc)
      .slice(0, KPI_DETAILS_LIMIT);
    const triageOver7CaseDetailItems = openCaseDetailItems
      .filter(
        (item: any) =>
          CPCA_TRIAGE_STATUS_SET.has(String(item.status ?? '')) &&
          Number(item.openDays ?? 0) > 7,
      )
      .slice(0, KPI_DETAILS_LIMIT);
    const investigationOver30CaseDetailItems = openCaseDetailItems
      .filter(
        (item: any) =>
          CPCA_INVESTIGATION_STATUS_SET.has(String(item.status ?? '')) &&
          Number(item.openDays ?? 0) > 30,
      )
      .slice(0, KPI_DETAILS_LIMIT);

    const monthCounter = new Map<
      string,
      {
        month: string;
        total: number;
        moral: number;
        sexual: number;
        open: number;
      }
    >();
    const localityCounter = new Map<
      string,
      {
        localityId: string;
        localityCode: string;
        localityName: string;
        totalCases: number;
        openCases: number;
        sexualCases: number;
        retaliationRiskCases: number;
        stalledOver30Days: number;
        openDaysTotal: number;
      }
    >();
    const aggressorRankCounter = new Map<string, number>();
    const victimRankCounter = new Map<string, number>();
    const openAgeBuckets = {
      '0-7': 0,
      '8-14': 0,
      '15-30': 0,
      '31-60': 0,
      '61+': 0,
    };
    const criticalOpenCases: Array<{
      caseId: string;
      caseNumber: string;
      localityId: string;
      localityCode: string;
      localityName: string;
      status: string;
      complaintType: string;
      detailedViolenceType: string;
      reportedAt: string;
      openDays: number;
      idleDays: number;
      retaliationRisk: boolean;
    }> = [];

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
      procedureCounter.set(
        procedureType,
        (procedureCounter.get(procedureType) ?? 0) + 1,
      );
      complaintTypeCounter.set(
        complaintType,
        (complaintTypeCounter.get(complaintType) ?? 0) + 1,
      );
      if (detailedViolenceType) {
        detailedTypeCounter.set(
          detailedViolenceType,
          (detailedTypeCounter.get(detailedViolenceType) ?? 0) + 1,
        );
      }
      if (item.aggressorAgeRange) {
        const key = String(item.aggressorAgeRange);
        aggressorAgeRangeCounter.set(
          key,
          (aggressorAgeRangeCounter.get(key) ?? 0) + 1,
        );
      }
      if (item.victimAgeRange) {
        const key = String(item.victimAgeRange);
        victimAgeRangeCounter.set(
          key,
          (victimAgeRangeCounter.get(key) ?? 0) + 1,
        );
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
      if (complaintType === 'MORAL') monthEntry.moral += 1;
      if (complaintType === 'SEXUAL') monthEntry.sexual += 1;

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
      if (complaintType === 'SEXUAL') localityEntry.sexualCases += 1;
      if (item.retaliationRisk) localityEntry.retaliationRiskCases += 1;

      const aggressorRank = this.normalizeRankForStats(item.aggressorRank);
      const victimRank = this.normalizeRankForStats(item.victimRank);
      if (aggressorRank) {
        aggressorRankCounter.set(
          aggressorRank,
          (aggressorRankCounter.get(aggressorRank) ?? 0) + 1,
        );
      }
      if (victimRank) {
        victimRankCounter.set(
          victimRank,
          (victimRankCounter.get(victimRank) ?? 0) + 1,
        );
      }

      if (CPCA_OPEN_STATUS_SET.has(status)) {
        openCases += 1;
        monthEntry.open += 1;
        localityEntry.openCases += 1;

        const openDays = this.daysBetween(item.reportedAt, now);
        localityEntry.openDaysTotal += openDays;

        const idleDays = this.daysBetween(
          item.updatedAt ?? item.reportedAt,
          now,
        );
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

        if (openDays <= 7) openAgeBuckets['0-7'] += 1;
        else if (openDays <= 14) openAgeBuckets['8-14'] += 1;
        else if (openDays <= 30) openAgeBuckets['15-30'] += 1;
        else if (openDays <= 60) openAgeBuckets['31-60'] += 1;
        else openAgeBuckets['61+'] += 1;

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
      } else {
        if (status === 'CONCLUDED') concludedCases += 1;
        if (status === 'ARCHIVED') archivedCases += 1;
      }

      const closedAt =
        closedAtByCaseId.get(item.id) ??
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
        const riskScore =
          entry.openCases * 2 +
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
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        if (b.openCases !== a.openCases) return b.openCases - a.openCases;
        return a.localityName.localeCompare(b.localityName, 'pt-BR');
      })
      .slice(0, 12);
    const sortedCriticalOpenCases = criticalOpenCases
      .sort((a, b) => {
        if (Number(b.retaliationRisk) !== Number(a.retaliationRisk)) {
          return Number(b.retaliationRisk) - Number(a.retaliationRisk);
        }
        if (b.openDays !== a.openDays) return b.openDays - a.openDays;
        return b.idleDays - a.idleDays;
      })
      .slice(0, 20);

    return {
      filters: {
        localityId: where.omId ?? null,
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
      statusDistribution: Array.from(statusCounter.entries()).map(
        ([status, count]) => ({
          status,
          count,
        }),
      ),
      procedureDistribution: Array.from(procedureCounter.entries()).map(
        ([procedureType, count]) => ({
          procedureType,
          count,
        }),
      ),
      complaintTypeDistribution: Array.from(complaintTypeCounter.entries()).map(
        ([complaintType, count]) => ({
          complaintType,
          count,
        }),
      ),
      detailedTypeDistribution: this.toSortedGenericDistribution(
        detailedTypeCounter,
        'detailedViolenceType',
      ),
      aggressorAgeRangeDistribution: this.toSortedGenericDistribution(
        aggressorAgeRangeCounter,
        'ageRange',
      ),
      victimAgeRangeDistribution: this.toSortedGenericDistribution(
        victimAgeRangeCounter,
        'ageRange',
      ),
      monthlyTrend: Array.from(monthCounter.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
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

  async buildAiContext(args?: {
    query?: string;
    includeInconsistencies?: boolean;
    limit?: number;
  }): Promise<CpcaAiContext> {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const now = new Date();
    const safeLimit = Math.min(12, Math.max(4, Number(args?.limit ?? 8) || 8));
    const includeInconsistencies = args?.includeInconsistencies !== false;
    const rows = await complaintModel.findMany({
      where: { workflowScope: CPCA_WORKFLOW_CONTEXT.workflowScope },
      select: {
        id: true,
        caseNumber: true,
        omId: true,
        localityId: true,
        complaintType: true,
        detailedViolenceType: true,
        incidentFrequency: true,
        hierarchicalFunctionalRelation: true,
        status: true,
        procedureType: true,
        procedureCurrentSituation: true,
        reportedAt: true,
        incidentDate: true,
        updatedAt: true,
        retaliationRisk: true,
        om: { select: { id: true, code: true, name: true } },
        locality: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const statusCounter = new Map<string, number>();
    const procedureCounter = new Map<string, number>();
    const omCounter = new Map<
      string,
      { omId: string; omLabel: string; count: number }
    >();
    const inconsistencyCounter = new Map<
      string,
      {
        code: string;
        badgeLabel: string;
        headline: string;
        tone: 'warning' | 'info';
        count: number;
      }
    >();
    const normativeReferences = new Map<
      string,
      { code: string; referenceTitle: string; referenceBody: string }
    >();

    let moralCases = 0;
    let sexualCases = 0;
    let openCases = 0;
    let concludedCases = 0;
    let archivedCases = 0;

    const caseItems: CpcaAiContextCase[] = (rows ?? []).map((raw: any) => {
      const item = this.serializeComplaint(raw);
      const status = String(item.status ?? '').trim();
      const complaintType = String(item.complaintType ?? '').trim();
      const reportedAt =
        item.reportedAt instanceof Date &&
        !Number.isNaN(item.reportedAt.getTime())
          ? item.reportedAt
          : null;
      const incidentDate =
        item.incidentDate instanceof Date &&
        !Number.isNaN(item.incidentDate.getTime())
          ? item.incidentDate
          : null;
      const isOpen = CPCA_OPEN_STATUS_SET.has(status);
      const om = item.locality ?? item.om ?? null;
      const omId =
        String(item.omId ?? item.localityId ?? om?.id ?? '').trim() || null;
      const omLabel = this.formatCpcaAiOmLabel(om);
      const inconsistencies = includeInconsistencies
        ? getCpcaCaseInconsistencies(
            {
              complaintType,
              detailedViolenceType: item.detailedViolenceType,
              incidentFrequency: item.incidentFrequency,
              hierarchicalFunctionalRelation:
                item.hierarchicalFunctionalRelation,
              reportedAt,
              incidentDate,
            },
            now,
          )
        : [];

      statusCounter.set(
        status || 'NAO_INFORMADO',
        (statusCounter.get(status || 'NAO_INFORMADO') ?? 0) + 1,
      );
      const procedureType =
        String(item.procedureType ?? '').trim() || 'NAO_INFORMADO';
      procedureCounter.set(
        procedureType,
        (procedureCounter.get(procedureType) ?? 0) + 1,
      );
      if (complaintType === 'MORAL') moralCases += 1;
      if (complaintType === 'SEXUAL') sexualCases += 1;
      if (isOpen) openCases += 1;
      if (status === 'CONCLUDED') concludedCases += 1;
      if (status === 'ARCHIVED') archivedCases += 1;
      if (omId) {
        const current = omCounter.get(omId) ?? { omId, omLabel, count: 0 };
        current.count += 1;
        omCounter.set(omId, current);
      }
      for (const inconsistency of inconsistencies) {
        const current = inconsistencyCounter.get(inconsistency.code) ?? {
          code: inconsistency.code,
          badgeLabel: inconsistency.badgeLabel,
          headline: inconsistency.headline,
          tone: inconsistency.tone,
          count: 0,
        };
        current.count += 1;
        inconsistencyCounter.set(inconsistency.code, current);
        if (!normativeReferences.has(inconsistency.code)) {
          normativeReferences.set(inconsistency.code, {
            code: inconsistency.code,
            referenceTitle: inconsistency.referenceTitle,
            referenceBody: inconsistency.referenceBody,
          });
        }
      }

      return {
        caseId: String(item.id ?? ''),
        caseNumber: String(item.caseNumber ?? ''),
        omId,
        omLabel,
        status,
        complaintType,
        detailedViolenceType: String(item.detailedViolenceType ?? ''),
        procedureType,
        procedureCurrentSituation:
          String(item.procedureCurrentSituation ?? '').trim() ||
          'NAO_INFORMADO',
        reportedAt: reportedAt ? reportedAt.toISOString() : null,
        incidentDate: incidentDate ? incidentDate.toISOString() : null,
        openDays: reportedAt && isOpen ? this.daysBetween(reportedAt, now) : 0,
        retaliationRisk: Boolean(item.retaliationRisk),
        link: `/cpca-cases?q=${encodeURIComponent(String(item.caseNumber ?? ''))}`,
        inconsistencyCodes: inconsistencies.map((entry) => entry.code),
        inconsistencies: inconsistencies.map((entry) => ({
          code: entry.code,
          badgeLabel: entry.badgeLabel,
          headline: entry.headline,
          summary: entry.summary,
          referenceTitle: entry.referenceTitle,
          tone: entry.tone,
        })),
      };
    });

    const query = String(args?.query ?? '').trim();
    const matchedCases = caseItems
      .filter((item) => this.matchesCpcaAiQuery(item, query))
      .slice(0, safeLimit);
    const recentCases = caseItems
      .slice()
      .sort(
        (a, b) =>
          new Date(b.reportedAt ?? 0).getTime() -
          new Date(a.reportedAt ?? 0).getTime(),
      )
      .slice(0, safeLimit);
    const criticalCases = caseItems
      .filter((item) => CPCA_OPEN_STATUS_SET.has(item.status))
      .sort((a, b) => {
        if (Number(b.retaliationRisk) !== Number(a.retaliationRisk)) {
          return Number(b.retaliationRisk) - Number(a.retaliationRisk);
        }
        if (b.openDays !== a.openDays) return b.openDays - a.openDays;
        return a.caseNumber.localeCompare(b.caseNumber, 'pt-BR');
      })
      .slice(0, safeLimit);
    const allInconsistentCases = caseItems.filter(
      (item) => item.inconsistencyCodes.length > 0,
    );
    const inconsistentCases = allInconsistentCases
      .filter((item) => item.inconsistencyCodes.length > 0)
      .sort((a, b) => {
        if (b.inconsistencyCodes.length !== a.inconsistencyCodes.length) {
          return b.inconsistencyCodes.length - a.inconsistencyCodes.length;
        }
        if (Number(b.retaliationRisk) !== Number(a.retaliationRisk)) {
          return Number(b.retaliationRisk) - Number(a.retaliationRisk);
        }
        return (
          new Date(b.reportedAt ?? 0).getTime() -
          new Date(a.reportedAt ?? 0).getTime()
        );
      })
      .slice(0, safeLimit);

    const references = Array.from(
      new Map<string, CpcaAiContextReference>(
        [...matchedCases, ...inconsistentCases, ...criticalCases].map(
          (item) => [
            item.link,
            {
              id: item.caseId,
              label: `${item.caseNumber} • ${item.omLabel}`,
              description:
                item.inconsistencies[0]?.headline ??
                `${item.status} • ${item.complaintType || 'tipo não informado'}`,
              href: item.link,
            },
          ],
        ),
      ).values(),
    ).slice(0, safeLimit + 4);

    return {
      generatedAt: now.toISOString(),
      summary: {
        totalCases: caseItems.length,
        openCases,
        concludedCases,
        archivedCases,
        moralCases,
        sexualCases,
        inconsistentCases: allInconsistentCases.length,
      },
      topStatus: Array.from(statusCounter.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      topProcedures: Array.from(procedureCounter.entries())
        .map(([procedureType, count]) => ({ procedureType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      topOms: Array.from(omCounter.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      recentCases,
      matchedCases,
      criticalCases,
      inconsistentCases,
      inconsistencySummary: Array.from(inconsistencyCounter.values()).sort(
        (a, b) => b.count - a.count,
      ),
      normativeReferences: Array.from(normativeReferences.values()),
      references,
    };
  }

  async getById(
    id: string,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const item = await complaintModel.findUnique({
      where: { id },
      include: {
        om: { select: { id: true, code: true, name: true } },
        locality: { select: { id: true, code: true, name: true } },
        cipavdThreads: {
          orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            resolvedBy: { select: { id: true, name: true, email: true } },
            closedBy: { select: { id: true, name: true, email: true } },
            messages: {
              orderBy: { createdAt: 'asc' },
              include: {
                createdBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
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

    if (!item) throwError('NOT_FOUND');
    if (item.workflowScope !== workflowContext.workflowScope) {
      throwError('NOT_FOUND');
    }
    await this.assertCaseAccess(
      {
        localityId: item.omId ?? item.localityId ?? '',
        caseNumber: item.caseNumber,
      },
      user,
      workflowContext,
    );

    const cipavdAccess = await this.resolveCipavdAccess(item, user);
    return {
      ...this.serializeComplaint(item),
      cipavdComments: {
        access: cipavdAccess,
        summary: this.buildCipavdSummary(item.cipavdThreads ?? []),
        threads: (item.cipavdThreads ?? []).map((thread: any) =>
          this.serializeCipavdThread(thread),
        ),
      },
    };
  }

  async create(
    payload: CreateCpcaCaseDto,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const constraints = this.getScopeConstraints(user, workflowContext);
    const localityId = await this.resolveTargetLocalityId(
      payload.omId ?? payload.localityId,
      user,
      workflowContext,
    );
    const actorId = this.requireUserId(user);
    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: { id: true, code: true },
    });
    if (!locality) throwError('NOT_FOUND');
    const cpcaManagerLocalityCode = await this.resolveCpcaManagerLocalityCode(
      constraints,
      workflowContext,
    );

    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const historyModel = (this.prisma as any).cpcComplaintStatusHistory;

    const status = payload.status ?? 'RECEIVED';
    const procedureType = payload.procedureType ?? 'NOT_DEFINED';
    if (status === 'CONCLUDED' || status === 'ARCHIVED') {
      throwError('VALIDATION_ERROR', {
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
      victimAccusedSeparationEvaluated:
        payload.victimAccusedSeparationEvaluated ?? false,
      victimAccusedSeparationApplied:
        payload.victimAccusedSeparationApplied ?? false,
      outsourcedAccused: payload.outsourcedAccused ?? false,
      contractorReferralDate: payload.contractorReferralDate,
      outcomeSummary: payload.outcomeSummary,
      accusedDefenseEnsured: payload.accusedDefenseEnsured ?? false,
    });

    const victimRank = this.cleanText(payload.victimRank);
    const victimGender = payload.victimGender;
    const victimAgeRange = this.cleanOptional(payload.victimAgeRange);
    const notifierProfile = this.resolveNotifierProfile({
      victimIsNotifier: payload.victimIsNotifier ?? true,
      victimRank,
      victimGender,
      victimAgeRange,
      notifierRank: payload.notifierRank,
      notifierGender: payload.notifierGender,
      notifierAgeRange: payload.notifierAgeRange,
    });
    const occurrenceForms = this.cleanMultiSelect(
      payload.occurrenceForms ?? payload.occurrenceForm,
    );

    const createData = {
      complaintType: payload.complaintType,
      notifierType: payload.notifierType ?? 'VITIMA',
      status,
      procedureType,
      reportedAt:
        this.parseOptionalIsoDateInput(payload.reportedAt, 'reportedAt') ??
        new Date(),
      incidentDate: payload.incidentDate
        ? this.parseOptionalIsoDateInput(payload.incidentDate, 'incidentDate')
        : null,
      aggressorRank: this.cleanText(payload.aggressorRank),
      aggressorGender: payload.aggressorGender,
      aggressorAgeRange: this.cleanOptional(payload.aggressorAgeRange),
      victimRank,
      victimGender,
      victimAgeRange,
      victimIsNotifier: notifierProfile.victimIsNotifier,
      notifierRank: notifierProfile.notifierRank,
      notifierGender: notifierProfile.notifierGender,
      notifierAgeRange: notifierProfile.notifierAgeRange,
      detailedViolenceType: this.cleanOptional(payload.detailedViolenceType),
      harassmentContext: this.cleanOptional(payload.harassmentContext),
      occurrenceLocation: this.cleanOptional(payload.occurrenceLocation),
      incidentFrequency: this.cleanOptional(payload.incidentFrequency),
      hierarchicalFunctionalRelation: this.cleanOptional(
        payload.hierarchicalFunctionalRelation,
      ),
      occurrenceForm: occurrenceForms[0] ?? null,
      occurrenceForms,
      administrativeProcedure: this.cleanOptional(
        payload.administrativeProcedure,
      ),
      procedureCurrentSituation: this.cleanOptional(
        payload.procedureCurrentSituation,
      ),
      retaliationReported: this.cleanOptional(payload.retaliationReported),
      retaliationAgainst: this.cleanOptional(payload.retaliationAgainst),
      evidenceCount: payload.evidenceCount ?? 0,
      evidenceSummary: this.cleanOptional(payload.evidenceSummary),
      confidentialityTermSigned: payload.confidentialityTermSigned ?? false,
      confidentialityHandlingNotes: this.cleanOptional(
        payload.confidentialityHandlingNotes,
      ),
      cpcaMembersExcludedFromInquiry:
        payload.cpcaMembersExcludedFromInquiry ?? true,
      immediateProtectionMeasures: this.cleanOptional(
        payload.immediateProtectionMeasures,
      ),
      privateSupportActions: this.cleanOptional(payload.privateSupportActions),
      psychologicalSupportProvided:
        payload.psychologicalSupportProvided ?? false,
      medicalSupportProvided: payload.medicalSupportProvided ?? false,
      socialSupportProvided: payload.socialSupportProvided ?? false,
      legalSupportProvided: payload.legalSupportProvided ?? false,
      contactRestrictionApplied: payload.contactRestrictionApplied ?? false,
      preliminaryAnalysis: this.cleanOptional(payload.preliminaryAnalysis),
      preliminaryReportGenerated: payload.preliminaryReportGenerated ?? false,
      preliminaryReportDate:
        this.parseOptionalIsoDateInput(
          payload.preliminaryReportDate,
          'preliminaryReportDate',
        ) ?? null,
      procedureReference: this.cleanOptional(payload.procedureReference),
      procedureNotes: this.cleanOptional(payload.procedureNotes),
      womenLedHandlingPrioritized:
        payload.womenLedHandlingPrioritized === undefined
          ? null
          : payload.womenLedHandlingPrioritized,
      victimAccusedSeparationEvaluated:
        payload.victimAccusedSeparationEvaluated ?? false,
      victimAccusedSeparationApplied:
        payload.victimAccusedSeparationApplied ?? false,
      accusedDefenseEnsured: payload.accusedDefenseEnsured ?? false,
      outcomeSummary: this.cleanOptional(payload.outcomeSummary),
      notifierFeedbackSummary: this.cleanOptional(
        payload.notifierFeedbackSummary,
      ),
      victimFeedbackSummary: this.cleanOptional(payload.victimFeedbackSummary),
      notifierFeedbackDate:
        this.parseOptionalIsoDateInput(
          payload.notifierFeedbackDate,
          'notifierFeedbackDate',
        ) ?? null,
      victimFeedbackDate:
        this.parseOptionalIsoDateInput(
          payload.victimFeedbackDate,
          'victimFeedbackDate',
        ) ?? null,
      retaliationRisk: payload.retaliationRisk ?? false,
      retaliationNotes: this.cleanOptional(payload.retaliationNotes),
      outsourcedAccused: payload.outsourcedAccused ?? false,
      contractorReferralDate:
        this.parseOptionalIsoDateInput(
          payload.contractorReferralDate,
          'contractorReferralDate',
        ) ?? null,
      contractorFollowUpNotes: this.cleanOptional(
        payload.contractorFollowUpNotes,
      ),
      archivedAt: null,
    } as const;

    let created: any = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const nextCaseNumber = await this.generateCaseNumber(
        cpcaManagerLocalityCode ?? locality.code ?? 'OM',
        workflowContext.caseNumberPrefix,
      );
      try {
        created = await complaintModel.create({
          data: {
            caseNumber: nextCaseNumber,
            workflowScope: workflowContext.workflowScope,
            om: { connect: { id: localityId } },
            localityId: null,
            createdBy: { connect: { id: actorId } },
            updatedBy: { connect: { id: actorId } },
            ...createData,
          },
          include: {
            om: { select: { id: true, code: true, name: true } },
            locality: { select: { id: true, code: true, name: true } },
          },
        });
        break;
      } catch (error) {
        if (this.isCaseNumberConflict(error)) {
          continue;
        }
        throw error;
      }
    }
    if (!created) {
      throwError('VALIDATION_ERROR', {
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
      diffJson: {
        omId: created.omId,
        caseNumber: created.caseNumber,
        workflowScope: workflowContext.workflowScope,
        complaintType: created.complaintType,
        status: created.status,
        procedureType: created.procedureType,
      },
    });

    return {
      ...created,
      localityId: created.omId ?? created.localityId ?? null,
      locality: created.om ?? created.locality ?? null,
    };
  }

  async update(
    id: string,
    payload: UpdateCpcaCaseDto,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const historyModel = (this.prisma as any).cpcComplaintStatusHistory;
    const actorId = this.requireUserId(user);

    const current = await complaintModel.findUnique({
      where: { id },
      select: {
        id: true,
        omId: true,
        localityId: true,
        caseNumber: true,
        workflowScope: true,
        complaintType: true,
        victimIsNotifier: true,
        victimRank: true,
        victimGender: true,
        victimAgeRange: true,
        notifierRank: true,
        notifierGender: true,
        notifierAgeRange: true,
        confidentialityTermSigned: true,
        status: true,
        procedureType: true,
        procedureCurrentSituation: true,
        preliminaryReportGenerated: true,
        preliminaryReportDate: true,
        victimAccusedSeparationEvaluated: true,
        victimAccusedSeparationApplied: true,
        outsourcedAccused: true,
        contractorReferralDate: true,
        accusedDefenseEnsured: true,
        outcomeSummary: true,
        archivedAt: true,
      },
    });
    if (!current) throwError('NOT_FOUND');
    if (current.workflowScope !== workflowContext.workflowScope) {
      throwError('NOT_FOUND');
    }

    await this.assertCaseAccess(
      {
        localityId: current.omId ?? current.localityId ?? '',
        caseNumber: current.caseNumber,
      },
      user,
      workflowContext,
    );

    const targetLocalityIdRaw = payload.omId ?? payload.localityId;
    const nextLocalityId = targetLocalityIdRaw
      ? await this.resolveTargetLocalityId(
          targetLocalityIdRaw,
          user,
          workflowContext,
        )
      : (current.omId ?? current.localityId ?? null);

    const nextProcedureCurrentSituation =
      payload.procedureCurrentSituation === undefined
        ? this.cleanOptional(current.procedureCurrentSituation)
        : this.cleanOptional(payload.procedureCurrentSituation);
    const nextStatus = syncWorkflowStatusWithProcedureSituation({
      status: payload.status ?? current.status,
      procedureCurrentSituation: nextProcedureCurrentSituation,
    });
    const nextProcedure = payload.procedureType ?? current.procedureType;
    this.assertStatusTransition(
      current.status,
      nextStatus,
      nextProcedureCurrentSituation,
    );
    const nextComplaintType = payload.complaintType ?? current.complaintType;
    const nextConfidentialityTermSigned =
      payload.confidentialityTermSigned ?? current.confidentialityTermSigned;
    const nextPreliminaryReportGenerated =
      payload.preliminaryReportGenerated ?? current.preliminaryReportGenerated;
    const nextPreliminaryReportDate =
      payload.preliminaryReportDate === undefined
        ? current.preliminaryReportDate
        : this.parseOptionalIsoDateInput(
            payload.preliminaryReportDate,
            'preliminaryReportDate',
          );
    const nextVictimAccusedSeparationEvaluated =
      payload.victimAccusedSeparationEvaluated ??
      current.victimAccusedSeparationEvaluated;
    const nextVictimAccusedSeparationApplied =
      payload.victimAccusedSeparationApplied ??
      current.victimAccusedSeparationApplied;
    const nextOutsourcedAccused =
      payload.outsourcedAccused ?? current.outsourcedAccused;
    const nextContractorReferralDate =
      payload.contractorReferralDate === undefined
        ? current.contractorReferralDate
        : this.parseOptionalIsoDateInput(
            payload.contractorReferralDate,
            'contractorReferralDate',
          );
    const nextAccusedDefenseEnsured =
      payload.accusedDefenseEnsured ?? current.accusedDefenseEnsured;
    const nextOutcomeSummary =
      payload.outcomeSummary === undefined
        ? current.outcomeSummary
        : this.cleanOptional(payload.outcomeSummary);
    const nextVictimRank =
      payload.victimRank === undefined
        ? current.victimRank
        : this.cleanText(payload.victimRank);
    if (!nextVictimRank) {
      throwError('VALIDATION_ERROR', {
        field: 'victimRank',
        reason: 'required',
      });
    }
    const nextVictimGender = payload.victimGender ?? current.victimGender;
    const nextVictimAgeRange =
      payload.victimAgeRange === undefined
        ? current.victimAgeRange
        : this.cleanOptional(payload.victimAgeRange);
    const notifierProfile = this.resolveNotifierProfile({
      victimIsNotifier: payload.victimIsNotifier ?? current.victimIsNotifier,
      victimRank: nextVictimRank,
      victimGender: nextVictimGender,
      victimAgeRange: nextVictimAgeRange,
      notifierRank:
        payload.notifierRank === undefined
          ? current.notifierRank
          : payload.notifierRank,
      notifierGender:
        payload.notifierGender === undefined
          ? current.notifierGender
          : payload.notifierGender,
      notifierAgeRange:
        payload.notifierAgeRange === undefined
          ? current.notifierAgeRange
          : payload.notifierAgeRange,
    });
    const nextOccurrenceForms =
      payload.occurrenceForms !== undefined
        ? this.cleanMultiSelect(payload.occurrenceForms)
        : payload.occurrenceForm !== undefined
          ? this.cleanMultiSelect(payload.occurrenceForm)
          : undefined;

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
      procedureCurrentSituation: nextProcedureCurrentSituation,
    });

    const updated = await complaintModel.update({
      where: { id },
      data: {
        om: nextLocalityId ? { connect: { id: nextLocalityId } } : undefined,
        locality: { disconnect: true },
        localityId: null,
        complaintType: payload.complaintType,
        notifierType: payload.notifierType,
        status: nextStatus,
        procedureType: payload.procedureType,
        reportedAt:
          payload.reportedAt !== undefined
            ? this.parseOptionalIsoDateInput(payload.reportedAt, 'reportedAt')
            : undefined,
        incidentDate: payload.incidentDate
          ? this.parseOptionalIsoDateInput(payload.incidentDate, 'incidentDate')
          : undefined,
        aggressorRank: payload.aggressorRank
          ? this.cleanText(payload.aggressorRank)
          : undefined,
        aggressorGender: payload.aggressorGender,
        aggressorAgeRange:
          payload.aggressorAgeRange !== undefined
            ? this.cleanOptional(payload.aggressorAgeRange)
            : undefined,
        victimRank: nextVictimRank,
        victimGender: nextVictimGender,
        victimAgeRange: nextVictimAgeRange,
        victimIsNotifier: notifierProfile.victimIsNotifier,
        notifierRank: notifierProfile.notifierRank,
        notifierGender: notifierProfile.notifierGender,
        notifierAgeRange: notifierProfile.notifierAgeRange,
        detailedViolenceType:
          payload.detailedViolenceType !== undefined
            ? this.cleanOptional(payload.detailedViolenceType)
            : undefined,
        harassmentContext:
          payload.harassmentContext !== undefined
            ? this.cleanOptional(payload.harassmentContext)
            : undefined,
        occurrenceLocation:
          payload.occurrenceLocation !== undefined
            ? this.cleanOptional(payload.occurrenceLocation)
            : undefined,
        incidentFrequency:
          payload.incidentFrequency !== undefined
            ? this.cleanOptional(payload.incidentFrequency)
            : undefined,
        hierarchicalFunctionalRelation:
          payload.hierarchicalFunctionalRelation !== undefined
            ? this.cleanOptional(payload.hierarchicalFunctionalRelation)
            : undefined,
        occurrenceForm:
          nextOccurrenceForms !== undefined
            ? (nextOccurrenceForms[0] ?? null)
            : undefined,
        occurrenceForms:
          nextOccurrenceForms !== undefined ? nextOccurrenceForms : undefined,
        administrativeProcedure:
          payload.administrativeProcedure !== undefined
            ? this.cleanOptional(payload.administrativeProcedure)
            : undefined,
        procedureCurrentSituation: nextProcedureCurrentSituation,
        retaliationReported:
          payload.retaliationReported !== undefined
            ? this.cleanOptional(payload.retaliationReported)
            : undefined,
        retaliationAgainst:
          payload.retaliationAgainst !== undefined
            ? this.cleanOptional(payload.retaliationAgainst)
            : undefined,
        evidenceCount: payload.evidenceCount,
        evidenceSummary:
          payload.evidenceSummary !== undefined
            ? this.cleanOptional(payload.evidenceSummary)
            : undefined,
        confidentialityTermSigned: payload.confidentialityTermSigned,
        confidentialityHandlingNotes:
          payload.confidentialityHandlingNotes !== undefined
            ? this.cleanOptional(payload.confidentialityHandlingNotes)
            : undefined,
        cpcaMembersExcludedFromInquiry: payload.cpcaMembersExcludedFromInquiry,
        immediateProtectionMeasures:
          payload.immediateProtectionMeasures !== undefined
            ? this.cleanOptional(payload.immediateProtectionMeasures)
            : undefined,
        privateSupportActions:
          payload.privateSupportActions !== undefined
            ? this.cleanOptional(payload.privateSupportActions)
            : undefined,
        psychologicalSupportProvided: payload.psychologicalSupportProvided,
        medicalSupportProvided: payload.medicalSupportProvided,
        socialSupportProvided: payload.socialSupportProvided,
        legalSupportProvided: payload.legalSupportProvided,
        contactRestrictionApplied: payload.contactRestrictionApplied,
        preliminaryAnalysis:
          payload.preliminaryAnalysis !== undefined
            ? this.cleanOptional(payload.preliminaryAnalysis)
            : undefined,
        preliminaryReportGenerated: payload.preliminaryReportGenerated,
        preliminaryReportDate:
          payload.preliminaryReportDate !== undefined
            ? this.parseOptionalIsoDateInput(
                payload.preliminaryReportDate,
                'preliminaryReportDate',
              )
            : undefined,
        procedureReference:
          payload.procedureReference !== undefined
            ? this.cleanOptional(payload.procedureReference)
            : undefined,
        procedureNotes:
          payload.procedureNotes !== undefined
            ? this.cleanOptional(payload.procedureNotes)
            : undefined,
        womenLedHandlingPrioritized: payload.womenLedHandlingPrioritized,
        victimAccusedSeparationEvaluated:
          payload.victimAccusedSeparationEvaluated,
        victimAccusedSeparationApplied: payload.victimAccusedSeparationApplied,
        accusedDefenseEnsured: payload.accusedDefenseEnsured,
        outcomeSummary:
          payload.outcomeSummary !== undefined
            ? this.cleanOptional(payload.outcomeSummary)
            : undefined,
        notifierFeedbackSummary:
          payload.notifierFeedbackSummary !== undefined
            ? this.cleanOptional(payload.notifierFeedbackSummary)
            : undefined,
        victimFeedbackSummary:
          payload.victimFeedbackSummary !== undefined
            ? this.cleanOptional(payload.victimFeedbackSummary)
            : undefined,
        notifierFeedbackDate:
          payload.notifierFeedbackDate !== undefined
            ? this.parseOptionalIsoDateInput(
                payload.notifierFeedbackDate,
                'notifierFeedbackDate',
              )
            : undefined,
        victimFeedbackDate:
          payload.victimFeedbackDate !== undefined
            ? this.parseOptionalIsoDateInput(
                payload.victimFeedbackDate,
                'victimFeedbackDate',
              )
            : undefined,
        retaliationRisk: payload.retaliationRisk,
        retaliationNotes:
          payload.retaliationNotes !== undefined
            ? this.cleanOptional(payload.retaliationNotes)
            : undefined,
        outsourcedAccused: payload.outsourcedAccused,
        contractorReferralDate:
          payload.contractorReferralDate !== undefined
            ? this.parseOptionalIsoDateInput(
                payload.contractorReferralDate,
                'contractorReferralDate',
              )
            : undefined,
        contractorFollowUpNotes:
          payload.contractorFollowUpNotes !== undefined
            ? this.cleanOptional(payload.contractorFollowUpNotes)
            : undefined,
        archivedAt:
          payload.archivedAt !== undefined
            ? this.parseOptionalIsoDateInput(payload.archivedAt, 'archivedAt')
            : nextStatus === 'ARCHIVED'
              ? (current.archivedAt ?? new Date())
              : undefined,
        updatedBy: { connect: { id: actorId } },
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        locality: { select: { id: true, code: true, name: true } },
      },
    });

    if (
      current.status !== nextStatus ||
      current.procedureType !== nextProcedure
    ) {
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
      diffJson: {
        omId: updated.omId,
        workflowScope: workflowContext.workflowScope,
        status: updated.status,
        procedureType: updated.procedureType,
      },
    });

    return {
      ...this.serializeComplaint(updated),
    };
  }

  async remove(
    id: string,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaintModel = (this.prisma as any).cpcComplaintCase;

    const current = await complaintModel.findUnique({
      where: { id },
      select: {
        id: true,
        workflowScope: true,
        caseNumber: true,
        omId: true,
        localityId: true,
        complaintType: true,
        status: true,
        procedureType: true,
      },
    });
    if (!current) throwError('NOT_FOUND');
    if (current.workflowScope !== workflowContext.workflowScope) {
      throwError('NOT_FOUND');
    }

    await this.assertCaseAccess(
      {
        localityId: current.omId ?? current.localityId ?? '',
        caseNumber: current.caseNumber,
      },
      user,
      workflowContext,
    );

    await complaintModel.delete({ where: { id } });

    await this.audit.log({
      userId: user?.id,
      resource: workflowContext.resource,
      action: 'delete',
      entityId: current.id,
      diffJson: {
        omId: current.omId,
        caseNumber: current.caseNumber,
        workflowScope: workflowContext.workflowScope,
        complaintType: current.complaintType,
        status: current.status,
        procedureType: current.procedureType,
      },
    });

    return { ok: true };
  }

  async createCipavdThread(
    id: string,
    payload: { text: string; isPending?: boolean },
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaint = await this.findComplaintCaseForCipavdAction(
      id,
      user,
      workflowContext,
    );
    const cipavdAccess = await this.resolveCipavdAccess(complaint, user);
    if (!cipavdAccess.canCreateThread) {
      throwError('RBAC_FORBIDDEN');
    }

    const text = this.cleanText(payload.text);
    if (!text) {
      throwError('VALIDATION_ERROR', { field: 'text', reason: 'required' });
    }

    const actorId = this.requireUserId(user);
    const isPending = payload.isPending !== false;
    const threadType = isPending ? 'PENDENCY' : 'NOTE';
    const threadStatus = isPending ? 'OPEN' : 'CLOSED';
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx: any) => {
      const thread = await tx.cpcComplaintCipavdThread.create({
        data: {
          complaintCaseId: complaint.id,
          type: threadType,
          status: threadStatus,
          createdById: actorId,
          lastMessageAt: now,
        },
      });

      await tx.cpcComplaintCipavdMessage.create({
        data: {
          threadId: thread.id,
          body: text,
          createdById: actorId,
          authorKind: 'MANAGEMENT',
          type: 'MESSAGE',
        },
      });

      return tx.cpcComplaintCipavdThread.findUnique({
        where: { id: thread.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
          closedBy: { select: { id: true, name: true, email: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      userId: user?.id,
      resource: workflowContext.resource,
      action: isPending ? 'cipavd_pendency_create' : 'cipavd_comment_create',
      entityId: complaint.id,
      diffJson: {
        caseId: complaint.id,
        threadId: created?.id,
        omId: complaint.omId,
        workflowScope: workflowContext.workflowScope,
      },
    });

    return this.serializeCipavdThread(created);
  }

  async resolveCipavdThread(
    id: string,
    threadId: string,
    payload: { text: string },
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaint = await this.findComplaintCaseForCipavdAction(
      id,
      user,
      workflowContext,
    );
    const cipavdAccess = await this.resolveCipavdAccess(complaint, user);
    if (!cipavdAccess.canResolvePending) {
      throwError('RBAC_FORBIDDEN');
    }

    const thread = await this.findCipavdThreadForComplaint(
      threadId,
      complaint.id,
      workflowContext,
    );
    if (thread.type !== 'PENDENCY' || thread.status !== 'OPEN') {
      throwError('VALIDATION_ERROR', {
        field: 'threadId',
        reason: 'PENDENCY_MUST_BE_OPEN',
      });
    }

    const text = this.cleanText(payload.text);
    if (!text) {
      throwError('VALIDATION_ERROR', { field: 'text', reason: 'required' });
    }

    const actorId = this.requireUserId(user);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx: any) => {
      await tx.cpcComplaintCipavdMessage.create({
        data: {
          threadId,
          body: text,
          createdById: actorId,
          authorKind: 'PRESIDENT',
          type: 'RESOLUTION',
        },
      });

      await tx.cpcComplaintCipavdThread.update({
        where: { id: threadId },
        data: {
          status: 'RESOLVED',
          resolvedById: actorId,
          resolvedAt: now,
          lastMessageAt: now,
        },
      });

      return tx.cpcComplaintCipavdThread.findUnique({
        where: { id: threadId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
          closedBy: { select: { id: true, name: true, email: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      userId: user?.id,
      resource: workflowContext.resource,
      action: 'cipavd_pendency_resolve',
      entityId: complaint.id,
      diffJson: {
        caseId: complaint.id,
        threadId,
        omId: complaint.omId,
        workflowScope: workflowContext.workflowScope,
      },
    });

    return this.serializeCipavdThread(updated);
  }

  async reopenCipavdThread(
    id: string,
    threadId: string,
    payload: { text: string },
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaint = await this.findComplaintCaseForCipavdAction(
      id,
      user,
      workflowContext,
    );
    const cipavdAccess = await this.resolveCipavdAccess(complaint, user);
    if (!cipavdAccess.canReviewResolvedPendencies) {
      throwError('RBAC_FORBIDDEN');
    }

    const thread = await this.findCipavdThreadForComplaint(
      threadId,
      complaint.id,
      workflowContext,
    );
    if (thread.type !== 'PENDENCY' || thread.status !== 'RESOLVED') {
      throwError('VALIDATION_ERROR', {
        field: 'threadId',
        reason: 'PENDENCY_MUST_BE_RESOLVED',
      });
    }

    const text = this.cleanText(payload.text);
    if (!text) {
      throwError('VALIDATION_ERROR', { field: 'text', reason: 'required' });
    }

    const actorId = this.requireUserId(user);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx: any) => {
      await tx.cpcComplaintCipavdMessage.create({
        data: {
          threadId,
          body: text,
          createdById: actorId,
          authorKind: 'MANAGEMENT',
          type: 'REOPEN',
        },
      });

      await tx.cpcComplaintCipavdThread.update({
        where: { id: threadId },
        data: {
          status: 'OPEN',
          resolvedById: null,
          resolvedAt: null,
          closedById: null,
          closedAt: null,
          reopenedCount: Number(thread.reopenedCount ?? 0) + 1,
          lastMessageAt: now,
        },
      });

      return tx.cpcComplaintCipavdThread.findUnique({
        where: { id: threadId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
          closedBy: { select: { id: true, name: true, email: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      userId: user?.id,
      resource: workflowContext.resource,
      action: 'cipavd_pendency_reopen',
      entityId: complaint.id,
      diffJson: {
        caseId: complaint.id,
        threadId,
        omId: complaint.omId,
        workflowScope: workflowContext.workflowScope,
      },
    });

    return this.serializeCipavdThread(updated);
  }

  async finalizeCipavdThread(
    id: string,
    threadId: string,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaint = await this.findComplaintCaseForCipavdAction(
      id,
      user,
      workflowContext,
    );
    const cipavdAccess = await this.resolveCipavdAccess(complaint, user);
    if (!cipavdAccess.canReviewResolvedPendencies) {
      throwError('RBAC_FORBIDDEN');
    }

    const thread = await this.findCipavdThreadForComplaint(
      threadId,
      complaint.id,
      workflowContext,
    );
    if (thread.type !== 'PENDENCY' || thread.status !== 'RESOLVED') {
      throwError('VALIDATION_ERROR', {
        field: 'threadId',
        reason: 'PENDENCY_MUST_BE_RESOLVED',
      });
    }

    const actorId = this.requireUserId(user);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx: any) => {
      await tx.cpcComplaintCipavdThread.update({
        where: { id: threadId },
        data: {
          status: 'CLOSED',
          closedById: actorId,
          closedAt: now,
          lastMessageAt: now,
        },
      });

      return tx.cpcComplaintCipavdThread.findUnique({
        where: { id: threadId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
          closedBy: { select: { id: true, name: true, email: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      userId: user?.id,
      resource: workflowContext.resource,
      action: 'cipavd_pendency_finalize',
      entityId: complaint.id,
      diffJson: {
        caseId: complaint.id,
        threadId,
        omId: complaint.omId,
        workflowScope: workflowContext.workflowScope,
      },
    });

    return this.serializeCipavdThread(updated);
  }

  async addComment(
    id: string,
    text: string,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const commentModel = (this.prisma as any).cpcComplaintComment;

    const complaint = await complaintModel.findUnique({
      where: { id },
      select: {
        id: true,
        omId: true,
        localityId: true,
        caseNumber: true,
        workflowScope: true,
      },
    });
    if (!complaint) throwError('NOT_FOUND');
    if (complaint.workflowScope !== workflowContext.workflowScope) {
      throwError('NOT_FOUND');
    }
    await this.assertCaseAccess(
      {
        localityId: complaint.omId ?? complaint.localityId ?? '',
        caseNumber: complaint.caseNumber,
      },
      user,
      workflowContext,
    );

    const normalizedText = this.cleanText(text);
    if (!normalizedText) {
      throwError('VALIDATION_ERROR', { field: 'text', reason: 'required' });
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
      diffJson: {
        commentId: created.id,
        omId: complaint.omId,
        workflowScope: workflowContext.workflowScope,
      },
    });

    return created;
  }

  async listComments(
    id: string,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const workflowContext = this.resolveContext(context);
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const commentModel = (this.prisma as any).cpcComplaintComment;

    const complaint = await complaintModel.findUnique({
      where: { id },
      select: {
        id: true,
        omId: true,
        localityId: true,
        caseNumber: true,
        workflowScope: true,
      },
    });
    if (!complaint) throwError('NOT_FOUND');
    if (complaint.workflowScope !== workflowContext.workflowScope) {
      throwError('NOT_FOUND');
    }
    await this.assertCaseAccess(
      {
        localityId: complaint.omId ?? complaint.localityId ?? '',
        caseNumber: complaint.caseNumber,
      },
      user,
      workflowContext,
    );

    const items = await commentModel.findMany({
      where: { complaintCaseId: id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { items };
  }

  private async buildComplaintWhere(
    filters: ComplaintListFilters,
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
  ) {
    const constraints = this.getScopeConstraints(user, context);
    const cpcaScopedLocalityIds = await this.resolveCpcaScopedLocalityIds(
      constraints,
      context,
    );
    const where: any = {
      workflowScope: context.workflowScope,
    };
    const andConditions: any[] = [];

    if (filters.localityId) {
      where.omId = filters.localityId;
    }
    if (constraints.localityId) {
      if (context.workflowScope === 'CPCA') {
        if (
          filters.localityId &&
          (!cpcaScopedLocalityIds ||
            !cpcaScopedLocalityIds.includes(filters.localityId))
        ) {
          where.omId = '__none__';
        } else if (cpcaScopedLocalityIds?.length) {
          where.omId = filters.localityId
            ? filters.localityId
            : { in: cpcaScopedLocalityIds };
        }
      } else if (
        filters.localityId &&
        constraints.localityId !== filters.localityId
      ) {
        where.omId = '__none__';
      } else {
        where.omId = constraints.localityId;
      }
    }

    if (filters.status) where.status = filters.status;
    if (filters.complaintType) where.complaintType = filters.complaintType;
    if (filters.detailedViolenceType) {
      where.detailedViolenceType = filters.detailedViolenceType;
    }
    if (filters.procedureType) where.procedureType = filters.procedureType;
    if (filters.q) {
      andConditions.push({
        caseNumber: { contains: filters.q.trim(), mode: 'insensitive' },
      });
    }
    if (andConditions.length === 1) {
      Object.assign(where, andConditions[0]);
    } else if (andConditions.length > 1) {
      where.AND = andConditions;
    }

    return where;
  }

  private buildEmptyCipavdSummary() {
    return {
      totalThreads: 0,
      noteCount: 0,
      totalPendingCount: 0,
      openPendingCount: 0,
      resolvedPendingCount: 0,
      closedPendingCount: 0,
      lastActivityAt: null as string | null,
    };
  }

  private buildCipavdSummary(threads: any[]) {
    const summary = this.buildEmptyCipavdSummary();

    for (const thread of threads ?? []) {
      summary.totalThreads += 1;

      if (String(thread?.type ?? '') === 'NOTE') {
        summary.noteCount += 1;
      } else if (String(thread?.type ?? '') === 'PENDENCY') {
        summary.totalPendingCount += 1;
        const status = String(thread?.status ?? '');
        if (status === 'OPEN') summary.openPendingCount += 1;
        if (status === 'RESOLVED') summary.resolvedPendingCount += 1;
        if (status === 'CLOSED') summary.closedPendingCount += 1;
      }

      summary.lastActivityAt = this.resolveLatestIsoDate(
        summary.lastActivityAt,
        thread?.lastMessageAt ?? null,
      );
    }

    return summary;
  }

  private buildCipavdSummaryByCaseId(threads: any[]) {
    const threadGroups = new Map<string, any[]>();
    for (const thread of threads ?? []) {
      const complaintCaseId = String(thread?.complaintCaseId ?? '').trim();
      if (!complaintCaseId) continue;
      const group = threadGroups.get(complaintCaseId) ?? [];
      group.push(thread);
      threadGroups.set(complaintCaseId, group);
    }

    const summaryByCaseId = new Map<string, any>();
    for (const [complaintCaseId, group] of threadGroups.entries()) {
      summaryByCaseId.set(complaintCaseId, this.buildCipavdSummary(group));
    }

    return summaryByCaseId;
  }

  private resolveLatestIsoDate(
    left: string | Date | null | undefined,
    right: string | Date | null | undefined,
  ) {
    const leftDate = this.parseDateValue(left);
    const rightDate = this.parseDateValue(right);
    if (!leftDate && !rightDate) return null;
    if (!leftDate) return rightDate?.toISOString() ?? null;
    if (!rightDate) return leftDate.toISOString();
    return leftDate.getTime() >= rightDate.getTime()
      ? leftDate.toISOString()
      : rightDate.toISOString();
  }

  private parseDateValue(value: string | Date | null | undefined) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private isCipavdManagementUser(user?: RbacUser) {
    return hasAnyRole(user, [...CIPAVD_MANAGEMENT_ROLES]);
  }

  private async resolveCipavdAccess(
    complaint: {
      omId?: string | null;
      localityId?: string | null;
    },
    user?: RbacUser,
  ) {
    const omId = String(complaint.omId ?? complaint.localityId ?? '').trim();
    const userId = String(user?.id ?? '').trim();
    const userIsManagement = this.isCipavdManagementUser(user);
    const userIsPresident =
      Boolean(userId) &&
      Boolean(omId) &&
      Boolean(
        await this.prisma.cpcaCommissionPresident.findFirst({
          where: {
            omId,
            userId,
          },
          select: { id: true },
        }),
      );

    return {
      userIsManagement,
      userIsPresident,
      canCreateThread: userIsManagement,
      canResolvePending: userIsPresident,
      canReviewResolvedPendencies: userIsManagement,
    };
  }

  private async findComplaintCaseForCipavdAction(
    id: string,
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
  ) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const complaint = await complaintModel.findUnique({
      where: { id },
      select: {
        id: true,
        omId: true,
        localityId: true,
        caseNumber: true,
        workflowScope: true,
      },
    });

    if (!complaint) throwError('NOT_FOUND');
    if (complaint.workflowScope !== context.workflowScope) {
      throwError('NOT_FOUND');
    }

    await this.assertCaseAccess(
      {
        localityId: complaint.omId ?? complaint.localityId ?? '',
        caseNumber: complaint.caseNumber,
      },
      user,
      context,
    );

    return complaint;
  }

  private async findCipavdThreadForComplaint(
    threadId: string,
    complaintCaseId: string,
    context: ComplaintWorkflowContext,
  ) {
    const threadModel = (this.prisma as any).cpcComplaintCipavdThread;
    const thread = await threadModel.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        complaintCaseId: true,
        type: true,
        status: true,
        reopenedCount: true,
        complaintCase: {
          select: { workflowScope: true },
        },
      },
    });

    if (!thread) throwError('NOT_FOUND');
    if (thread.complaintCaseId !== complaintCaseId) {
      throwError('NOT_FOUND');
    }
    if (thread.complaintCase?.workflowScope !== context.workflowScope) {
      throwError('NOT_FOUND');
    }

    return thread;
  }

  private serializePendingSummaryItem(item: any) {
    const complaint = this.serializeComplaint(item?.complaintCase ?? {});
    const lastMessage = Array.isArray(item?.messages) ? item.messages[0] : null;

    return {
      threadId: item.id,
      type: item.type,
      typeLabel: this.getCipavdThreadTypeLabel(item.type),
      status: item.status,
      statusLabel: this.getCipavdThreadStatusLabel(item.status),
      reopenedCount: Number(item.reopenedCount ?? 0),
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : (item.createdAt ?? null),
      resolvedAt:
        item.resolvedAt instanceof Date
          ? item.resolvedAt.toISOString()
          : (item.resolvedAt ?? null),
      closedAt:
        item.closedAt instanceof Date
          ? item.closedAt.toISOString()
          : (item.closedAt ?? null),
      lastMessageAt:
        item.lastMessageAt instanceof Date
          ? item.lastMessageAt.toISOString()
          : (item.lastMessageAt ?? null),
      case: {
        id: complaint.id,
        caseNumber: complaint.caseNumber,
        status: complaint.status,
        procedureType: complaint.procedureType,
        reportedAt: complaint.reportedAt,
        locality: complaint.locality,
      },
      lastMessage: lastMessage
        ? this.serializeCipavdMessage(lastMessage)
        : null,
    };
  }

  private serializeCipavdThread(thread: any) {
    return {
      id: thread.id,
      type: thread.type,
      typeLabel: this.getCipavdThreadTypeLabel(thread.type),
      status: thread.status,
      statusLabel:
        String(thread?.type ?? '')
          .trim()
          .toUpperCase() === 'NOTE'
          ? 'Registrado'
          : this.getCipavdThreadStatusLabel(thread.status),
      reopenedCount: Number(thread.reopenedCount ?? 0),
      createdAt:
        thread.createdAt instanceof Date
          ? thread.createdAt.toISOString()
          : (thread.createdAt ?? null),
      resolvedAt:
        thread.resolvedAt instanceof Date
          ? thread.resolvedAt.toISOString()
          : (thread.resolvedAt ?? null),
      closedAt:
        thread.closedAt instanceof Date
          ? thread.closedAt.toISOString()
          : (thread.closedAt ?? null),
      lastMessageAt:
        thread.lastMessageAt instanceof Date
          ? thread.lastMessageAt.toISOString()
          : (thread.lastMessageAt ?? null),
      createdBy: thread.createdBy ?? null,
      resolvedBy: thread.resolvedBy ?? null,
      closedBy: thread.closedBy ?? null,
      messages: Array.isArray(thread?.messages)
        ? thread.messages.map((message: any) =>
            this.serializeCipavdMessage(message),
          )
        : [],
    };
  }

  private serializeCipavdMessage(message: any) {
    return {
      id: message.id,
      body: message.body,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : (message.createdAt ?? null),
      authorKind: message.authorKind,
      authorLabel: this.getCipavdAuthorLabel(message.authorKind),
      type: message.type,
      typeLabel: this.getCipavdMessageTypeLabel(message.type),
      createdBy: message.createdBy ?? null,
    };
  }

  private getCipavdThreadTypeLabel(type: string | null | undefined) {
    return String(type ?? '')
      .trim()
      .toUpperCase() === 'PENDENCY'
      ? 'Pendência'
      : 'Comentário';
  }

  private getCipavdThreadStatusLabel(status: string | null | undefined) {
    const normalized = String(status ?? '')
      .trim()
      .toUpperCase();
    if (normalized === 'OPEN') return 'Em aberto';
    if (normalized === 'RESOLVED') return 'Resolvida';
    if (normalized === 'CLOSED') return 'Finalizada';
    return normalized || 'Sem status';
  }

  private getCipavdAuthorLabel(authorKind: string | null | undefined) {
    const normalized = String(authorKind ?? '')
      .trim()
      .toUpperCase();
    if (normalized === 'PRESIDENT') return 'Presidente da CPCA';
    if (normalized === 'SYSTEM') return 'Sistema';
    return 'CIPAVD / COMGEP / TI';
  }

  private getCipavdMessageTypeLabel(type: string | null | undefined) {
    const normalized = String(type ?? '')
      .trim()
      .toUpperCase();
    if (normalized === 'RESOLUTION') return 'Resposta da comissão';
    if (normalized === 'REOPEN') return 'Nova pendência';
    if (normalized === 'FINALIZATION') return 'Pendência finalizada';
    return 'Mensagem';
  }

  private getScopeConstraints(
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
  ) {
    if (!user) {
      throwError('RBAC_FORBIDDEN');
    }

    if (this.hasNationalScope(user, context)) {
      return {};
    }

    if (this.hasLocalityScope(user, context)) {
      if (!user.omId) {
        throwError('RBAC_FORBIDDEN');
      }
      return { localityId: user.omId };
    }

    throwError('RBAC_FORBIDDEN');
  }

  private hasCasePermission(
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
    scope?: 'NATIONAL' | 'LOCALITY',
  ) {
    if (!user) return false;
    return ['view', 'create', 'update', 'comment', 'delete'].some((action) =>
      hasPermission(user, context.resource, action, scope),
    );
  }

  private hasNationalScope(
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
  ) {
    return this.hasCasePermission(user, context, 'NATIONAL');
  }

  private hasLocalityScope(
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
  ) {
    return this.hasCasePermission(user, context, 'LOCALITY');
  }

  private async assertCaseAccess(
    item: { localityId: string; caseNumber?: string | null },
    user: RbacUser | undefined,
    context: ComplaintWorkflowContext,
  ) {
    const constraints = this.getScopeConstraints(user, context);
    if (!constraints.localityId) {
      return;
    }

    if (context.workflowScope === 'CPCA') {
      const allowedLocalityIds = await this.resolveCpcaScopedLocalityIds(
        constraints,
        context,
      );
      if (allowedLocalityIds?.includes(String(item.localityId ?? '').trim())) {
        return;
      }
    }

    if (constraints.localityId !== item.localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async resolveTargetLocalityId(
    localityIdRaw: string | undefined,
    user?: RbacUser,
    context: ComplaintWorkflowContext = CPCA_WORKFLOW_CONTEXT,
  ) {
    const constraints = this.getScopeConstraints(user, context);
    const localityId = String(localityIdRaw ?? '').trim();

    if (constraints.localityId) {
      if (context.workflowScope === 'CPCA') {
        if (!localityId) {
          throwError('VALIDATION_ERROR', {
            field: 'localityId',
            reason: 'required',
          });
        }
        const allowedLocalityIds = await this.resolveCpcaScopedLocalityIds(
          constraints,
          context,
        );
        if (allowedLocalityIds && !allowedLocalityIds.includes(localityId)) {
          throwError('RBAC_FORBIDDEN');
        }
        return localityId;
      }
      if (localityId && localityId !== constraints.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      return constraints.localityId;
    }

    if (!localityId) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'required',
      });
    }

    return localityId;
  }

  private resolveContext(
    context: ComplaintWorkflowContext | undefined,
  ): ComplaintWorkflowContext {
    return context ?? CPCA_WORKFLOW_CONTEXT;
  }

  private async resolveCpcaManagerCaseMarker(
    constraints: { localityId?: string },
    context: ComplaintWorkflowContext,
  ) {
    if (context.workflowScope !== 'CPCA') {
      return null;
    }
    const managerLocalityCode = await this.resolveCpcaManagerLocalityCode(
      constraints,
      context,
    );
    if (!managerLocalityCode) {
      return null;
    }
    const managerLocalityToken =
      this.normalizeCaseNumberLocalityToken(managerLocalityCode);
    return managerLocalityToken ? `-${managerLocalityToken}-` : null;
  }

  private async resolveCpcaManagerLocalityCode(
    constraints: { localityId?: string },
    context: ComplaintWorkflowContext,
  ) {
    if (context.workflowScope !== 'CPCA') {
      return null;
    }
    const managerLocalityId = String(constraints.localityId ?? '').trim();
    if (!managerLocalityId) {
      return null;
    }
    const managerLocality = await this.prisma.om.findUnique({
      where: { id: managerLocalityId },
      select: { code: true },
    });
    return String(managerLocality?.code ?? '').trim() || null;
  }

  private async resolveCpcaScopedLocalityIds(
    constraints: { localityId?: string },
    context: ComplaintWorkflowContext,
  ) {
    if (context.workflowScope !== 'CPCA') {
      return null;
    }

    const managerLocalityId = String(constraints.localityId ?? '').trim();
    if (!managerLocalityId) {
      return null;
    }

    const coverage = await this.prisma.cpcaCommissionCoverageOm.findMany({
      where: { managerOmId: managerLocalityId },
      select: { managedOmId: true },
    });

    return Array.from(
      new Set([
        managerLocalityId,
        ...coverage.map((item) => String(item.managedOmId ?? '').trim()),
      ]),
    ).filter(Boolean);
  }

  private normalizeCaseNumberLocalityToken(localityCode: string) {
    return (
      String(localityCode || 'OM')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6) || 'OM'
    );
  }

  private cleanText(value: string) {
    return sanitizeText(String(value ?? '')).trim();
  }

  private formatCpcaAiOmLabel(item: any) {
    const code = String(item?.code ?? '').trim();
    const name = String(item?.name ?? '').trim();
    if (code && name && code !== name) {
      return `${code} • ${name}`;
    }
    return code || name || 'OM não identificada';
  }

  private matchesCpcaAiQuery(item: CpcaAiContextCase, query: string) {
    const normalizedQuery = this.cleanText(query).toUpperCase();
    if (!normalizedQuery) return false;

    const caseMatches =
      normalizedQuery.match(/CPCA-\d{4}-[A-Z0-9]+-\d+/g) ?? [];
    if (
      caseMatches.length > 0 &&
      caseMatches.some(
        (caseNumber) =>
          caseNumber === String(item.caseNumber ?? '').toUpperCase(),
      )
    ) {
      return true;
    }

    const tokens = normalizedQuery
      .split(/[^A-Z0-9À-Ü]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4);
    if (!tokens.length) return false;

    const haystack = [
      item.caseNumber,
      item.omLabel,
      item.status,
      item.complaintType,
      item.detailedViolenceType,
      item.procedureType,
      item.procedureCurrentSituation,
      ...item.inconsistencyCodes,
      ...item.inconsistencies.map((entry) => entry.headline),
    ]
      .join(' ')
      .toUpperCase();

    return tokens.some((token) => haystack.includes(token));
  }

  private serializeComplaint(item: any) {
    return {
      ...item,
      status: syncWorkflowStatusWithProcedureSituation({
        status: item?.status,
        procedureCurrentSituation: item?.procedureCurrentSituation,
      }),
      localityId: item?.omId ?? item?.localityId ?? null,
      locality: item?.om ?? item?.locality ?? null,
    };
  }

  private cleanOptional(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = this.cleanText(value);
    return normalized || null;
  }

  private cleanMultiSelect(value?: string[] | string | null) {
    const rawItems = Array.isArray(value)
      ? value
      : value === undefined || value === null
        ? []
        : [value];

    const normalized = rawItems
      .map((item) => this.cleanText(String(item ?? '')))
      .filter(Boolean);

    return Array.from(new Set(normalized));
  }

  private resolveNotifierProfile(input: {
    victimIsNotifier: boolean | null | undefined;
    victimRank: string;
    victimGender: string;
    victimAgeRange: string | null | undefined;
    notifierRank?: string | null;
    notifierGender?: string | null;
    notifierAgeRange?: string | null;
  }) {
    const victimIsNotifier = input.victimIsNotifier !== false;

    if (victimIsNotifier) {
      return {
        victimIsNotifier: true,
        notifierRank: input.victimRank,
        notifierGender: input.victimGender,
        notifierAgeRange: input.victimAgeRange ?? null,
      };
    }

    const notifierRank = this.cleanText(String(input.notifierRank ?? ''));
    if (!notifierRank) {
      throwError('VALIDATION_ERROR', {
        field: 'notifierRank',
        reason: 'NOTIFIER_RANK_REQUIRED_WHEN_DIFFERENT',
      });
    }

    const notifierGender = String(input.notifierGender ?? '').trim();
    if (!notifierGender) {
      throwError('VALIDATION_ERROR', {
        field: 'notifierGender',
        reason: 'NOTIFIER_GENDER_REQUIRED_WHEN_DIFFERENT',
      });
    }

    return {
      victimIsNotifier: false,
      notifierRank,
      notifierGender,
      notifierAgeRange: this.cleanOptional(input.notifierAgeRange),
    };
  }

  private parseDateBoundary(
    rawValue: string | undefined,
    field: 'from' | 'to',
    endOfDay: boolean,
  ) {
    const value = String(rawValue ?? '').trim();
    if (!value) return null;

    const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throwError('VALIDATION_ERROR', { field, reason: 'INVALID_DATE' });
    }

    if (endOfDay && value.length === 10) {
      parsed.setUTCHours(23, 59, 59, 999);
    }

    return parsed;
  }

  private parseOptionalIsoDateInput(
    rawValue: string | null | undefined,
    field: string,
  ) {
    const value = String(rawValue ?? '').trim();
    if (!value) return null;

    const normalized = value.length === 10 ? `${value}T12:00:00.000Z` : value;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throwError('VALIDATION_ERROR', { field, reason: 'INVALID_DATE' });
    }

    return parsed;
  }

  private daysBetween(start: Date, end: Date) {
    const diff = end.getTime() - start.getTime();
    if (!Number.isFinite(diff) || diff <= 0) return 0;
    return Math.ceil(diff / DAY_MS);
  }

  private normalizeRankForStats(value: string | null | undefined) {
    const normalized = this.cleanText(String(value ?? ''));
    return normalized ? normalized.toUpperCase() : null;
  }

  private toTopRankDistribution(counter: Map<string, number>, limit = 10) {
    return Array.from(counter.entries())
      .map(([rank, count]) => ({ rank, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.rank.localeCompare(b.rank, 'pt-BR');
      })
      .slice(0, limit);
  }

  private toSortedGenericDistribution(
    counter: Map<string, number>,
    key: string,
  ) {
    return Array.from(counter.entries())
      .map(([value, count]) => ({ [key]: value, count }))
      .sort((a: any, b: any) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a[key]).localeCompare(String(b[key]), 'pt-BR');
      });
  }

  private assertIcaConsistency(input: {
    status: string;
    complaintType: string;
    procedureCurrentSituation?: string | null | undefined;
    confidentialityTermSigned: boolean | null | undefined;
    preliminaryReportGenerated: boolean | null | undefined;
    preliminaryReportDate: Date | string | null | undefined;
    victimAccusedSeparationEvaluated: boolean | null | undefined;
    victimAccusedSeparationApplied: boolean | null | undefined;
    outsourcedAccused: boolean | null | undefined;
    contractorReferralDate: Date | string | null | undefined;
    outcomeSummary: string | null | undefined;
    accusedDefenseEnsured: boolean | null | undefined;
  }) {
    if (input.complaintType === 'SEXUAL' && !input.confidentialityTermSigned) {
      throwError('VALIDATION_ERROR', {
        field: 'confidentialityTermSigned',
        reason: 'CONFIDENTIALITY_TERM_REQUIRED_FOR_SEXUAL',
      });
    }

    if (input.preliminaryReportDate && !input.preliminaryReportGenerated) {
      throwError('VALIDATION_ERROR', {
        field: 'preliminaryReportGenerated',
        reason: 'PRELIMINARY_REPORT_DATE_REQUIRES_FLAG',
      });
    }

    if (
      Boolean(input.victimAccusedSeparationApplied) &&
      !input.victimAccusedSeparationEvaluated
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'victimAccusedSeparationEvaluated',
        reason: 'SEPARATION_APPLIED_REQUIRES_EVALUATION',
      });
    }

    if (input.contractorReferralDate && !input.outsourcedAccused) {
      throwError('VALIDATION_ERROR', {
        field: 'outsourcedAccused',
        reason: 'CONTRACTOR_REFERRAL_REQUIRES_OUTSOURCED_FLAG',
      });
    }

    if (
      (input.status === 'CONCLUDED' || input.status === 'ARCHIVED') &&
      !isJudicialArchiveProcedureSituation(input.procedureCurrentSituation)
    ) {
      if (!this.cleanOptional(input.outcomeSummary)) {
        throwError('VALIDATION_ERROR', {
          field: 'outcomeSummary',
          reason: 'OUTCOME_SUMMARY_REQUIRED_FOR_CLOSURE',
        });
      }
      if (!input.accusedDefenseEnsured) {
        throwError('VALIDATION_ERROR', {
          field: 'accusedDefenseEnsured',
          reason: 'DEFENSE_CONFIRMATION_REQUIRED_FOR_CLOSURE',
        });
      }
    }
  }

  private assertStatusTransition(
    currentStatus: string,
    nextStatus: string,
    nextProcedureCurrentSituation?: string | null,
  ) {
    if (!nextStatus || currentStatus === nextStatus) return;
    if (
      nextStatus === 'ARCHIVED' &&
      isJudicialArchiveProcedureSituation(nextProcedureCurrentSituation)
    ) {
      return;
    }

    const allowed: Record<string, string[]> = {
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
      throwError('VALIDATION_ERROR', {
        field: 'status',
        reason: 'INVALID_STATUS_TRANSITION',
        from: currentStatus,
        to: nextStatus,
      });
    }
  }

  private requireUserId(user?: RbacUser) {
    if (!user?.id) {
      throwError('RBAC_FORBIDDEN');
    }
    return user.id;
  }

  private async generateCaseNumber(
    localityCode: string,
    caseNumberPrefix: 'CPCA' | 'SMIF',
  ) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const year = new Date().getUTCFullYear();
    const localityToken = this.normalizeCaseNumberLocalityToken(localityCode);
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
      if (!match) continue;
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > maxSequence) {
        maxSequence = value;
      }
    }

    const nextSequence = String(maxSequence + 1).padStart(5, '0');
    return `${prefix}${nextSequence}`;
  }

  private isCaseNumberConflict(error: unknown) {
    const code = String((error as any)?.code ?? '');
    if (code !== 'P2002') return false;
    const target = (error as any)?.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('caseNumber');
    }
    if (typeof target === 'string') {
      return target.includes('caseNumber');
    }
    return true;
  }
}
