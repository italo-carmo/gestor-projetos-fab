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
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';

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
    const localityId = await this.resolveTargetLocalityId(payload.localityId, user);
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
    this.assertIcaConsistency({
      complaintType: payload.complaintType,
      confidentialityTermSigned: payload.confidentialityTermSigned ?? false,
      preliminaryReportGenerated: payload.preliminaryReportGenerated ?? false,
      preliminaryReportDate: payload.preliminaryReportDate,
      victimAccusedSeparationEvaluated: payload.victimAccusedSeparationEvaluated ?? false,
      victimAccusedSeparationApplied: payload.victimAccusedSeparationApplied ?? false,
      outsourcedAccused: payload.outsourcedAccused ?? false,
      contractorReferralDate: payload.contractorReferralDate,
    });

    const created = await complaintModel.create({
      data: {
        caseNumber: await this.generateCaseNumber(locality.code ?? 'OM'),
        localityId,
        complaintType: payload.complaintType,
        notifierType: payload.notifierType ?? 'VITIMA',
        status,
        procedureType,
        incidentDate: payload.incidentDate ? new Date(payload.incidentDate) : null,
        aggressorRank: this.cleanText(payload.aggressorRank),
        aggressorGender: payload.aggressorGender,
        victimRank: this.cleanText(payload.victimRank),
        victimGender: payload.victimGender,
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
        archivedAt: status === 'ARCHIVED' ? new Date() : null,
        createdById: actorId,
        updatedById: actorId,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
      },
    });

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
      },
    });
    if (!current) throwError('NOT_FOUND');

    this.assertCaseAccess(current.localityId, user);

    const nextLocalityId = payload.localityId
      ? await this.resolveTargetLocalityId(payload.localityId, user)
      : current.localityId;

    const nextStatus = payload.status ?? current.status;
    const nextProcedure = payload.procedureType ?? current.procedureType;
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

    this.assertIcaConsistency({
      complaintType: nextComplaintType,
      confidentialityTermSigned: nextConfidentialityTermSigned,
      preliminaryReportGenerated: nextPreliminaryReportGenerated,
      preliminaryReportDate: nextPreliminaryReportDate,
      victimAccusedSeparationEvaluated: nextVictimAccusedSeparationEvaluated,
      victimAccusedSeparationApplied: nextVictimAccusedSeparationApplied,
      outsourcedAccused: nextOutsourcedAccused,
      contractorReferralDate: nextContractorReferralDate,
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
        victimRank: payload.victimRank ? this.cleanText(payload.victimRank) : undefined,
        victimGender: payload.victimGender,
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

    if (hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP])) {
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
    return hasAnyRole(user, [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP]);
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

  private assertIcaConsistency(input: {
    complaintType: string;
    confidentialityTermSigned: boolean | null | undefined;
    preliminaryReportGenerated: boolean | null | undefined;
    preliminaryReportDate: Date | string | null | undefined;
    victimAccusedSeparationEvaluated: boolean | null | undefined;
    victimAccusedSeparationApplied: boolean | null | undefined;
    outsourcedAccused: boolean | null | undefined;
    contractorReferralDate: Date | string | null | undefined;
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

    for (let i = 0; i < 5; i += 1) {
      const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const candidate = `CPCA-${year}-${localityToken}-${suffix}`;
      const exists = await complaintModel.findUnique({
        where: { caseNumber: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }

    throwError('VALIDATION_ERROR', {
      reason: 'CASE_NUMBER_GENERATION_FAILED',
    });
  }
}
