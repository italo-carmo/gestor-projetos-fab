import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import {
  hasAnyRole,
  hasRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_CPCA,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';

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
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CpcaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    filters: {
      localityId?: string;
      status?: string;
      complaintType?: string;
      procedureType?: string;
      q?: string;
      page?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    const constraints = this.getScopeConstraints(user);
    const where: any = {};

    if (filters.localityId) where.localityId = filters.localityId;
    if (constraints.localityId && filters.localityId && constraints.localityId !== filters.localityId) {
      where.localityId = '__none__';
    } else if (constraints.localityId) {
      where.localityId = constraints.localityId;
    }

    if (filters.status) where.status = filters.status;
    if (filters.complaintType) where.complaintType = filters.complaintType;
    if (filters.procedureType) where.procedureType = filters.procedureType;
    if (filters.q) {
      where.caseNumber = { contains: filters.q.trim(), mode: 'insensitive' };
    }

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);

    const complaintModel = (this.prisma as any).cpcComplaintCase;

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
      items: (items ?? []).map((item: any) => ({
        ...item,
        lastCommentAt: item.comments?.[0]?.createdAt ?? null,
        comments: undefined,
      })),
      page,
      pageSize,
      total,
    };
  }

  async stats(
    filters: {
      localityId?: string;
      from?: string;
      to?: string;
    },
    user?: RbacUser,
  ) {
    const constraints = this.getScopeConstraints(user);
    const where: any = {};

    if (filters.localityId) where.localityId = filters.localityId;
    if (constraints.localityId && filters.localityId && constraints.localityId !== filters.localityId) {
      where.localityId = '__none__';
    } else if (constraints.localityId) {
      where.localityId = constraints.localityId;
    }

    const fromDate = this.parseDateBoundary(filters.from, 'from', false);
    const toDate = this.parseDateBoundary(filters.to, 'to', true);
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throwError('VALIDATION_ERROR', { field: 'from', reason: 'INVALID_DATE_RANGE' });
    }
    if (fromDate || toDate) {
      where.reportedAt = {};
      if (fromDate) where.reportedAt.gte = fromDate;
      if (toDate) where.reportedAt.lte = toDate;
    }

    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const historyModel = (this.prisma as any).cpcComplaintStatusHistory;
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
        victimRank: true,
        locality: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    const statusCounter = new Map<string, number>(CPCA_STATUS_ORDER.map((status) => [status, 0]));
    const procedureCounter = new Map<string, number>(CPCA_PROCEDURE_ORDER.map((proc) => [proc, 0]));
    const complaintTypeCounter = new Map<string, number>(
      CPCA_COMPLAINT_TYPE_ORDER.map((type) => [type, 0]),
    );

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
        complaintTypeDistribution: Array.from(complaintTypeCounter.entries()).map(
          ([complaintType, count]) => ({
            complaintType,
            count,
          }),
        ),
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
      if (entry.changedAt instanceof Date && !Number.isNaN(entry.changedAt.getTime())) {
        closedAtByCaseId.set(complaintCaseId, entry.changedAt);
      }
    }

    const now = new Date();
    const monthCounter = new Map<
      string,
      { month: string; total: number; moral: number; sexual: number; open: number }
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

      statusCounter.set(status, (statusCounter.get(status) ?? 0) + 1);
      procedureCounter.set(procedureType, (procedureCounter.get(procedureType) ?? 0) + 1);
      complaintTypeCounter.set(complaintType, (complaintTypeCounter.get(complaintType) ?? 0) + 1);

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
          ? item.archivedAt ?? item.updatedAt ?? null
          : status === 'CONCLUDED'
            ? item.updatedAt ?? null
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
        closureRatePercent: totalCases ? Math.round((closedCases / totalCases) * 100) : 0,
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
    };
  }

  async getById(id: string, user?: RbacUser) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
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

    if (!item) throwError('NOT_FOUND');
    this.assertCaseAccess(item.localityId, user);
    return item;
  }

  async create(payload: CreateCpcaCaseDto, user?: RbacUser) {
    const localityId = await this.resolveTargetLocalityId(payload.omId ?? payload.localityId, user);
    const actorId = this.requireUserId(user);
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: { id: true, code: true },
    });
    if (!locality) throwError('NOT_FOUND');

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
      victimAccusedSeparationEvaluated: payload.victimAccusedSeparationEvaluated ?? false,
      victimAccusedSeparationApplied: payload.victimAccusedSeparationApplied ?? false,
      outsourcedAccused: payload.outsourcedAccused ?? false,
      contractorReferralDate: payload.contractorReferralDate,
      outcomeSummary: payload.outcomeSummary,
      accusedDefenseEnsured: payload.accusedDefenseEnsured ?? false,
    });

    const createData = {
      localityId,
      complaintType: payload.complaintType,
      notifierType: payload.notifierType ?? 'VITIMA',
      status,
      procedureType,
      incidentDate: payload.incidentDate ? new Date(payload.incidentDate) : null,
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
      preliminaryReportDate: payload.preliminaryReportDate ? new Date(payload.preliminaryReportDate) : null,
      procedureReference: this.cleanOptional(payload.procedureReference),
      procedureNotes: this.cleanOptional(payload.procedureNotes),
      womenLedHandlingPrioritized:
        payload.womenLedHandlingPrioritized === undefined ? null : payload.womenLedHandlingPrioritized,
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
      createdById: actorId,
      updatedById: actorId,
    } as const;

    let created: any = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const nextCaseNumber = await this.generateCaseNumber(locality.code ?? 'OM');
      try {
        created = await complaintModel.create({
          data: {
            caseNumber: nextCaseNumber,
            ...createData,
          },
          include: {
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
      throwError('VALIDATION_ERROR', { reason: 'CASE_NUMBER_GENERATION_FAILED' });
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
      resource: 'cpca_cases',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId,
      diffJson: {
        caseNumber: created.caseNumber,
        complaintType: created.complaintType,
        status: created.status,
        procedureType: created.procedureType,
      },
    });

    return created;
  }

  async update(id: string, payload: UpdateCpcaCaseDto, user?: RbacUser) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const historyModel = (this.prisma as any).cpcComplaintStatusHistory;
    const actorId = this.requireUserId(user);

    const current = await complaintModel.findUnique({
      where: { id },
      select: {
        id: true,
        localityId: true,
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
    if (!current) throwError('NOT_FOUND');

    this.assertCaseAccess(current.localityId, user);

    const targetLocalityIdRaw = payload.omId ?? payload.localityId;
    const nextLocalityId = targetLocalityIdRaw
      ? await this.resolveTargetLocalityId(targetLocalityIdRaw, user)
      : current.localityId;

    const nextStatus = payload.status ?? current.status;
    const nextProcedure = payload.procedureType ?? current.procedureType;
    this.assertStatusTransition(current.status, nextStatus);
    const nextComplaintType = payload.complaintType ?? current.complaintType;
    const nextConfidentialityTermSigned =
      payload.confidentialityTermSigned ?? current.confidentialityTermSigned;
    const nextPreliminaryReportGenerated =
      payload.preliminaryReportGenerated ?? current.preliminaryReportGenerated;
    const nextPreliminaryReportDate =
      payload.preliminaryReportDate === undefined
        ? current.preliminaryReportDate
        : payload.preliminaryReportDate
          ? new Date(payload.preliminaryReportDate)
          : null;
    const nextVictimAccusedSeparationEvaluated =
      payload.victimAccusedSeparationEvaluated ?? current.victimAccusedSeparationEvaluated;
    const nextVictimAccusedSeparationApplied =
      payload.victimAccusedSeparationApplied ?? current.victimAccusedSeparationApplied;
    const nextOutsourcedAccused = payload.outsourcedAccused ?? current.outsourcedAccused;
    const nextContractorReferralDate =
      payload.contractorReferralDate === undefined
        ? current.contractorReferralDate
        : payload.contractorReferralDate
          ? new Date(payload.contractorReferralDate)
          : null;
    const nextAccusedDefenseEnsured =
      payload.accusedDefenseEnsured ?? current.accusedDefenseEnsured;
    const nextOutcomeSummary =
      payload.outcomeSummary === undefined
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
        localityId: nextLocalityId,
        complaintType: payload.complaintType,
        notifierType: payload.notifierType,
        status: payload.status,
        procedureType: payload.procedureType,
        incidentDate: payload.incidentDate ? new Date(payload.incidentDate) : undefined,
        aggressorRank: payload.aggressorRank ? this.cleanText(payload.aggressorRank) : undefined,
        aggressorGender: payload.aggressorGender,
        aggressorAgeRange:
          payload.aggressorAgeRange !== undefined
            ? this.cleanOptional(payload.aggressorAgeRange)
            : undefined,
        victimRank: payload.victimRank ? this.cleanText(payload.victimRank) : undefined,
        victimGender: payload.victimGender,
        victimAgeRange:
          payload.victimAgeRange !== undefined
            ? this.cleanOptional(payload.victimAgeRange)
            : undefined,
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
          payload.occurrenceForm !== undefined
            ? this.cleanOptional(payload.occurrenceForm)
            : undefined,
        administrativeProcedure:
          payload.administrativeProcedure !== undefined
            ? this.cleanOptional(payload.administrativeProcedure)
            : undefined,
        procedureCurrentSituation:
          payload.procedureCurrentSituation !== undefined
            ? this.cleanOptional(payload.procedureCurrentSituation)
            : undefined,
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
            ? payload.preliminaryReportDate
              ? new Date(payload.preliminaryReportDate)
              : null
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
        victimAccusedSeparationEvaluated: payload.victimAccusedSeparationEvaluated,
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
            ? payload.notifierFeedbackDate
              ? new Date(payload.notifierFeedbackDate)
              : null
            : undefined,
        victimFeedbackDate:
          payload.victimFeedbackDate !== undefined
            ? payload.victimFeedbackDate
              ? new Date(payload.victimFeedbackDate)
              : null
            : undefined,
        retaliationRisk: payload.retaliationRisk,
        retaliationNotes:
          payload.retaliationNotes !== undefined
            ? this.cleanOptional(payload.retaliationNotes)
            : undefined,
        outsourcedAccused: payload.outsourcedAccused,
        contractorReferralDate:
          payload.contractorReferralDate !== undefined
            ? payload.contractorReferralDate
              ? new Date(payload.contractorReferralDate)
              : null
            : undefined,
        contractorFollowUpNotes:
          payload.contractorFollowUpNotes !== undefined
            ? this.cleanOptional(payload.contractorFollowUpNotes)
            : undefined,
        archivedAt:
          payload.archivedAt !== undefined
            ? payload.archivedAt
              ? new Date(payload.archivedAt)
              : null
            : nextStatus === 'ARCHIVED'
              ? new Date()
              : undefined,
        updatedById: actorId,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
      },
    });

    if (current.status !== nextStatus || current.procedureType !== nextProcedure) {
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
      resource: 'cpca_cases',
      action: 'update',
      entityId: id,
      localityId: updated.localityId,
      diffJson: {
        status: updated.status,
        procedureType: updated.procedureType,
      },
    });

    return updated;
  }

  async addComment(id: string, text: string, user?: RbacUser) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const commentModel = (this.prisma as any).cpcComplaintComment;

    const complaint = await complaintModel.findUnique({
      where: { id },
      select: { id: true, localityId: true },
    });
    if (!complaint) throwError('NOT_FOUND');
    this.assertCaseAccess(complaint.localityId, user);

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
      resource: 'cpca_cases',
      action: 'comment',
      entityId: id,
      localityId: complaint.localityId,
      diffJson: { commentId: created.id },
    });

    return created;
  }

  async listComments(id: string, user?: RbacUser) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const commentModel = (this.prisma as any).cpcComplaintComment;

    const complaint = await complaintModel.findUnique({
      where: { id },
      select: { id: true, localityId: true },
    });
    if (!complaint) throwError('NOT_FOUND');
    this.assertCaseAccess(complaint.localityId, user);

    const items = await commentModel.findMany({
      where: { complaintCaseId: id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { items };
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user || !this.hasWorkflowAccess(user)) {
      throwError('RBAC_FORBIDDEN');
    }

    if (hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])) {
      return {};
    }

    if (hasRole(user, ROLE_CPCA)) {
      if (!user.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      return { localityId: user.localityId };
    }

    throwError('RBAC_FORBIDDEN');
  }

  private hasWorkflowAccess(user?: RbacUser) {
    return hasAnyRole(user, [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI]);
  }

  private assertCaseAccess(localityId: string, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId && constraints.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async resolveTargetLocalityId(localityIdRaw: string | undefined, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    const localityId = String(localityIdRaw ?? '').trim();

    if (constraints.localityId) {
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

  private cleanText(value: string) {
    return sanitizeText(String(value ?? '')).trim();
  }

  private cleanOptional(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = this.cleanText(value);
    return normalized || null;
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

  private assertIcaConsistency(input: {
    status: string;
    complaintType: string;
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
    if (input.complaintType === 'SEXUAL' && !Boolean(input.confidentialityTermSigned)) {
      throwError('VALIDATION_ERROR', {
        field: 'confidentialityTermSigned',
        reason: 'CONFIDENTIALITY_TERM_REQUIRED_FOR_SEXUAL',
      });
    }

    if (input.preliminaryReportDate && !Boolean(input.preliminaryReportGenerated)) {
      throwError('VALIDATION_ERROR', {
        field: 'preliminaryReportGenerated',
        reason: 'PRELIMINARY_REPORT_DATE_REQUIRES_FLAG',
      });
    }

    if (
      Boolean(input.victimAccusedSeparationApplied) &&
      !Boolean(input.victimAccusedSeparationEvaluated)
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'victimAccusedSeparationEvaluated',
        reason: 'SEPARATION_APPLIED_REQUIRES_EVALUATION',
      });
    }

    if (input.contractorReferralDate && !Boolean(input.outsourcedAccused)) {
      throwError('VALIDATION_ERROR', {
        field: 'outsourcedAccused',
        reason: 'CONTRACTOR_REFERRAL_REQUIRES_OUTSOURCED_FLAG',
      });
    }

    if (input.status === 'CONCLUDED' || input.status === 'ARCHIVED') {
      if (!this.cleanOptional(input.outcomeSummary)) {
        throwError('VALIDATION_ERROR', {
          field: 'outcomeSummary',
          reason: 'OUTCOME_SUMMARY_REQUIRED_FOR_CLOSURE',
        });
      }
      if (!Boolean(input.accusedDefenseEnsured)) {
        throwError('VALIDATION_ERROR', {
          field: 'accusedDefenseEnsured',
          reason: 'DEFENSE_CONFIRMATION_REQUIRED_FOR_CLOSURE',
        });
      }
    }
  }

  private assertStatusTransition(currentStatus: string, nextStatus: string) {
    if (!nextStatus || currentStatus === nextStatus) return;

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

  private async generateCaseNumber(localityCode: string) {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const year = new Date().getUTCFullYear();
    const localityToken = String(localityCode || 'OM')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'OM';
    const prefix = `CPCA-${year}-${localityToken}-`;
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
