import { Injectable, Logger, Optional } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  CpcaCommissionPresidentAssignmentSource,
  CpcaPresidentRequestStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { resolveBestOmByFabOm } from '../catalog/om-resolver';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { FabLdapProfile, FabLdapService } from '../ldap/fab-ldap.service';
import { MailService } from '../mail/mail.service';
import { buildCpcaApprovalDecisionEmail } from '../mail/templates/cpca-approval-decision-email';
import { buildCpcaSelfRegistrationNotificationEmail } from '../mail/templates/cpca-self-registration-notification-email';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeRoleName,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_CIPAVD,
  ROLE_CPCA,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { SettingsService } from '../settings/settings.service';
import {
  deleteCpcaPresidentBulletinFile,
  persistCpcaPresidentBulletinFile,
  resolveExistingCpcaPresidentBulletinPath,
  type StoredCpcaPresidentBulletinFile,
  validateCpcaPresidentBulletinUpload,
} from './cpca-president-bulletin-file';

const ROLE_NAMES_ALLOWED_TO_APPROVE = new Set([
  normalizeRoleName(ROLE_TI),
  normalizeRoleName(ROLE_COMANDANTE_COMGEP),
]);
const ROLE_NAMES_ALLOWED_TO_VIEW_APPROVALS = new Set([
  ...ROLE_NAMES_ALLOWED_TO_APPROVE,
  normalizeRoleName(ROLE_COORDENACAO_CIPAVD),
  normalizeRoleName(ROLE_CIPAVD),
]);
const CPCA_APPROVAL_REQUEST_TYPES = [
  'SELF_REGISTRATION',
  'PRESIDENT_NOMINATION',
  'COVERAGE',
] as const;
type CpcaApprovalRequestType = (typeof CPCA_APPROVAL_REQUEST_TYPES)[number];
const MILITARY_RANK_PREFIX =
  /^(ALUNO|SD|CB|3S|2S|1S|SO|ASP|CP|CL|MB|TB|2T|1T|CAP|MAJ|TCEL|TEN CEL|CEL|BRIG|BRIGADEIRO|GEN)\b/i;

function formatOmLabel(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  const codeValue = String(code ?? '').trim();
  const nameValue = String(name ?? '').trim();
  if (codeValue && nameValue) {
    if (
      codeValue.localeCompare(nameValue, 'pt-BR', { sensitivity: 'base' }) === 0
    ) {
      return codeValue;
    }
    return `${codeValue} · ${nameValue}`;
  }
  return codeValue || nameValue;
}

@Injectable()
export class CpcaCommissionService {
  private readonly logger = new Logger(CpcaCommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
    @Optional() private readonly mail?: MailService,
    @Optional() private readonly settings?: SettingsService,
  ) {}

  async listSelfRegistrationLocalities() {
    const items = await this.prisma.om.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
        hasCpca: true,
      },
      orderBy: { code: 'asc' },
    });

    return { items };
  }

  /**
   * Garante attemptNumber 1..n e retryRootRequestId coerentes para todas as
   * autoinscrições do candidato na OM (corrige reenvios sem resubmissionOfId).
   */
  private async alignPresidentSelfRegistrationAttemptChain(
    prisma: Pick<PrismaClient, 'cpcaPresidentSelfRegistration'>,
    where: Prisma.CpcaPresidentSelfRegistrationWhereInput,
  ) {
    const priorSameOmApplicant =
      (await prisma.cpcaPresidentSelfRegistration.findMany({
        where,
        select: {
          id: true,
          retryRootRequestId: true,
          previousAttemptId: true,
          attemptNumber: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { attemptNumber: 'asc' }],
      })) ?? [];
    if (priorSameOmApplicant.length === 0) {
      return;
    }
    const chainRootId =
      String(priorSameOmApplicant[0].retryRootRequestId ?? '').trim() ||
      priorSameOmApplicant[0].id;
    let previousAttemptId: string | null = null;
    for (let index = 0; index < priorSameOmApplicant.length; index += 1) {
      const row = priorSameOmApplicant[index];
      const wantAttemptNumber = index + 1;
      const wantRetryRoot = index === 0 ? null : chainRootId;
      const patch: {
        attemptNumber?: number;
        retryRootRequestId?: string | null;
        previousAttemptId?: string | null;
      } = {};
      if (Number(row.attemptNumber) !== wantAttemptNumber) {
        patch.attemptNumber = wantAttemptNumber;
      }
      if (
        (String(row.retryRootRequestId ?? '').trim() || null) !== wantRetryRoot
      ) {
        patch.retryRootRequestId = wantRetryRoot;
      }
      if (
        (String(row.previousAttemptId ?? '').trim() || null) !==
        previousAttemptId
      ) {
        patch.previousAttemptId = previousAttemptId;
      }
      if (Object.keys(patch).length > 0) {
        await prisma.cpcaPresidentSelfRegistration.update({
          where: { id: row.id },
          data: patch,
        });
      }
      previousAttemptId = row.id;
    }
  }

  async createSelfRegistration(
    payload: {
      identifier: string;
      localityId?: string;
      resubmissionOfId?: string;
      isSubstitution: boolean;
      bulletinNumber: string;
      bulletinFile?: Express.Multer.File | null;
    },
    ip?: string | null,
  ) {
    const identifier = this.normalizeIdentifier(payload.identifier);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const bulletinNumber = this.cleanRequiredText(payload.bulletinNumber, {
      field: 'bulletinNumber',
      maxLength: 220,
    });

    const requestedLocalityId = String(payload.localityId ?? '').trim();
    if (!requestedLocalityId) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'CPCA_SELF_REGISTRATION_LOCALITY_REQUIRED',
      });
    }

    const ldapProfile = await this.resolveLdapProfile(identifier);
    const ldapLocality = await this.resolveOmFromFabOm(ldapProfile.fabom);
    const locality = await this.assertOmExistsForSelfRegistration(
      requestedLocalityId,
    );

    const user = await this.upsertLdapBackedUser(
      ldapProfile,
      ldapLocality?.id ?? null,
    );
    const applicantName = ldapProfile.name?.trim() || user.name;
    const resubmissionOfId = String(payload.resubmissionOfId ?? '').trim();
    const attemptChainWhere = this.buildSelfRegistrationAttemptChainWhere({
      omId: locality.id,
      applicantUserId: user.id,
      identifier,
      applicantUid: ldapProfile.uid,
      applicantEmail: ldapProfile.email,
    });

    type PriorSelfRegistrationRow = {
      id: string;
      omId: string | null;
      applicantUserId: string;
      status: CpcaPresidentRequestStatus;
      retryRootRequestId: string | null;
      attemptNumber: number;
      createdAt: Date;
    };

    const priorSameOmApplicant: PriorSelfRegistrationRow[] =
      (await this.prisma.cpcaPresidentSelfRegistration.findMany({
        where: attemptChainWhere,
        select: {
          id: true,
          omId: true,
          applicantUserId: true,
          status: true,
          retryRootRequestId: true,
          attemptNumber: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { attemptNumber: 'asc' }],
      })) ?? [];

    if (priorSameOmApplicant.some((row) => row.status === 'PENDING')) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PENDING',
      });
    }

    if (resubmissionOfId) {
      const validatedResubmission =
        await this.prisma.cpcaPresidentSelfRegistration.findUnique({
          where: { id: resubmissionOfId },
          select: {
            id: true,
            omId: true,
            applicantUserId: true,
            applicantIdentifier: true,
            applicantUid: true,
            applicantEmail: true,
            status: true,
            retryRootRequestId: true,
            attemptNumber: true,
            createdAt: true,
          },
        });
      if (!validatedResubmission) {
        throwError('NOT_FOUND');
      }
      if (
        !this.isSameSelfRegistrationApplicant(validatedResubmission, {
          applicantUserId: user.id,
          identifier,
          applicantUid: ldapProfile.uid,
          applicantEmail: ldapProfile.email,
        })
      ) {
        throwError('RBAC_FORBIDDEN');
      }
      if (validatedResubmission.omId !== locality.id) {
        throwError('VALIDATION_ERROR', {
          reason: 'CPCA_SELF_REGISTRATION_RESUBMISSION_LOCALITY_MISMATCH',
          selectedLocalityId: locality.id,
          previousLocalityId: validatedResubmission.omId,
        });
      }
      if (validatedResubmission.status !== 'REJECTED') {
        throwError('VALIDATION_ERROR', {
          reason: 'CPCA_PRESIDENT_REQUEST_RESUBMISSION_ONLY_AFTER_REJECTION',
        });
      }
    }

    const priorTail =
      priorSameOmApplicant.length > 0
        ? priorSameOmApplicant[priorSameOmApplicant.length - 1]
        : null;
    if (priorTail && priorTail.status !== 'REJECTED') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_RESUBMISSION_ONLY_AFTER_REJECTION',
      });
    }

    const chainRootId =
      priorSameOmApplicant.length > 0
        ? String(priorSameOmApplicant[0].retryRootRequestId ?? '').trim() ||
          priorSameOmApplicant[0].id
        : null;
    const nextAttemptNumber = priorSameOmApplicant.length + 1;
    const linkedPreviousAttemptId = priorTail ? priorTail.id : null;
    const linkedRetryRootRequestId = chainRootId;

    const validatedBulletinFile = validateCpcaPresidentBulletinUpload(
      payload.bulletinFile,
    );
    const storedBulletinFile = persistCpcaPresidentBulletinFile(
      validatedBulletinFile,
    );

    let created: {
      id: string;
      status: CpcaPresidentRequestStatus;
      createdAt: Date;
      attemptNumber: number;
      om: { id: string; code: string; name: string } | null;
    };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await this.alignPresidentSelfRegistrationAttemptChain(
          tx,
          attemptChainWhere,
        );

        return tx.cpcaPresidentSelfRegistration.create({
          data: {
            omId: locality.id,
            applicantUserId: user.id,
            retryRootRequestId: linkedRetryRootRequestId,
            previousAttemptId: linkedPreviousAttemptId,
            attemptNumber: nextAttemptNumber,
            applicantIdentifier: identifier,
            applicantUid: ldapProfile.uid,
            applicantEmail: ldapProfile.email,
            applicantName,
            requestedAsSubstitution: Boolean(payload.isSubstitution),
            bulletinNumber,
            bulletinFileName: storedBulletinFile.fileName,
            bulletinStorageKey: storedBulletinFile.storageKey,
            bulletinMimeType: storedBulletinFile.mimeType,
            bulletinFileSize: storedBulletinFile.fileSize,
            bulletinChecksum: storedBulletinFile.checksum,
          },
          include: {
            om: { select: { id: true, code: true, name: true } },
          },
        });
      });
    } catch (error) {
      deleteCpcaPresidentBulletinFile(storedBulletinFile.storageKey);
      throw error;
    }

    await this.audit.log({
      userId: user.id,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_president_self_registration_create',
      entityId: created.id,
      diffJson: {
        omId: locality.id,
        omCode: locality.code,
        omName: locality.name,
        applicantName,
        requestedAsSubstitution: Boolean(payload.isSubstitution),
        bulletinNumber,
        bulletinFileName: storedBulletinFile.fileName,
        bulletinMimeType: storedBulletinFile.mimeType,
        bulletinFileSize: storedBulletinFile.fileSize,
        bulletinChecksum: storedBulletinFile.checksum,
        attemptNumber: created.attemptNumber,
        resubmissionOfId: resubmissionOfId || null,
        previousAttemptId: linkedPreviousAttemptId,
        ip: ip || null,
      },
    });

    await this.notifySelfRegistrationCreatedByEmail({
      requestId: created.id,
      applicantName,
      applicantEmail: ldapProfile.email,
      applicantUid: ldapProfile.uid,
      locality: created.om ?? locality,
      bulletinNumber,
      requestedAsSubstitution: Boolean(payload.isSubstitution),
      attemptNumber: created.attemptNumber,
      createdAt: created.createdAt,
    });

    return {
      request: {
        id: created.id,
        status: created.status,
        createdAt: created.createdAt,
        attemptNumber: created.attemptNumber,
        locality: created.om,
      },
    };
  }

  async lookupSelfRegistrationCandidate(identifierRaw: string) {
    const identifier = this.normalizeIdentifier(identifierRaw);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const profile = await this.resolveLdapProfile(identifier);
    const militaryIdentity = this.extractMilitaryIdentity(profile.name);
    const locality = await this.resolveOmFromFabOm(profile.fabom);

    return {
      profile: {
        uid: profile.uid,
        name: profile.name,
        email: this.normalizeEmail(profile.email),
        fabom: profile.fabom,
        numeroOrdem: profile.numeroOrdem,
        postoGraduacao: militaryIdentity.postoGraduacao,
        warName: militaryIdentity.warName,
      },
      locality: locality
        ? {
            id: locality.id,
            code: locality.code,
            name: locality.name,
            hasCpca: locality.hasCpca,
          }
        : null,
    };
  }

  async lookupSelfRegistrationStatus(identifierRaw: string) {
    const identifier = this.normalizeIdentifier(identifierRaw);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const profile = await this.resolveLdapProfile(identifier);
    const militaryIdentity = this.extractMilitaryIdentity(profile.name);
    const locality = await this.resolveOmFromFabOm(profile.fabom);
    const applicantWhere = this.buildSelfRegistrationApplicantWhere({
      identifier,
      applicantUid: profile.uid,
      applicantEmail: profile.email,
    });
    const history = await this.prisma.cpcaPresidentSelfRegistration.findMany({
      where: applicantWhere,
      include: {
        om: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: { id: true, name: true, email: true, ldapUid: true },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { attemptNumber: 'desc' }],
    });

    const serializedHistory = this.serializeSelfRegistrationHistory(history, {
      includeBulletinFile: false,
    });
    const latestHistoryEntry =
      serializedHistory.length > 0
        ? serializedHistory[serializedHistory.length - 1]
        : null;
    const latestRequest = history[0] ?? null;
    const accessGranted =
      latestRequest && latestRequest.omId
        ? Boolean(
            await this.prisma.cpcaCommissionPresident.findFirst({
              where: {
                omId: latestRequest.omId,
                userId: latestRequest.applicantUserId,
              },
              select: { id: true },
            }),
          )
        : false;

    return {
      profile: {
        uid: profile.uid,
        name: profile.name,
        email: this.normalizeEmail(profile.email),
        fabom: profile.fabom,
        numeroOrdem: profile.numeroOrdem,
        postoGraduacao: militaryIdentity.postoGraduacao,
        warName: militaryIdentity.warName,
      },
      locality: locality
        ? {
            id: locality.id,
            code: locality.code,
            name: locality.name,
            hasCpca: locality.hasCpca,
          }
        : null,
      latestRequest: latestRequest
        ? {
            ...(latestHistoryEntry ??
              this.serializeSelfRegistrationHistoryEntry(latestRequest, {
                includeBulletinFile: false,
              })),
            accessGranted,
          }
        : null,
      history: serializedHistory,
      accessGranted,
      canResubmit: latestRequest?.status === 'REJECTED',
      hasPendingRequest: latestRequest?.status === 'PENDING',
    };
  }

  async commissionOverview(
    user: RbacUser | undefined,
    requestedLocalityId?: string,
  ) {
    const userId = this.requireUserId(user);
    const isApprover = this.isApproverUser(user);

    let localityId = String(requestedLocalityId ?? '').trim();
    if (isApprover) {
      if (!localityId) {
        const firstLocality = await this.prisma.om.findFirst({
          where: { hasCpca: true },
          select: { id: true },
          orderBy: { name: 'asc' },
        });
        localityId = String(firstLocality?.id ?? '');
      }
    } else {
      localityId = String(user?.omId ?? '').trim();
      if (!localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      if (requestedLocalityId && requestedLocalityId !== localityId) {
        throwError('RBAC_FORBIDDEN');
      }
    }

    if (!localityId) {
      return {
        locality: null,
        currentPresident: null,
        members: [],
        canAssignPresident: isApprover,
        canNominatePresident: false,
        canManageMembers: false,
        canManageCoverage: false,
        managesCoverageByApproval: false,
        pendingCoverageRequest: null,
        pendingPresidentNominationRequest: null,
        history: [],
        userIsPresident: false,
      };
    }

    const locality = await this.assertOmSupportsCpca(localityId);
    const [
      currentPresident,
      members,
      managedLocalities,
      availableManagedLocalities,
      pendingCoverageRequest,
      pendingPresidentNominationRequest,
      history,
    ] = await Promise.all([
      this.prisma.cpcaCommissionPresident.findUnique({
        where: { omId: localityId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              ldapUid: true,
              omId: true,
              localityId: true,
            },
          },
          assignedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.cpcaCommissionMember.findMany({
        where: { omId: localityId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              ldapUid: true,
              omId: true,
              localityId: true,
            },
          },
          addedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { user: { name: 'asc' } },
      }),
      this.listManagedLocalities(localityId),
      this.listAvailableManagedLocalities(localityId),
      this.findPendingCoverageRequest(localityId),
      this.findPendingPresidentNominationRequest(localityId),
      this.listCommissionHistory(localityId),
    ]);

    const userIsPresident =
      Boolean(currentPresident) && currentPresident?.userId === userId;
    const canManageCoverage = isApprover || userIsPresident;

    return {
      locality,
      currentPresident: currentPresident
        ? {
            id: currentPresident.id,
            designationBulletin: currentPresident.designationBulletin,
            isSubstitution: currentPresident.isSubstitution,
            assignedAt: currentPresident.assignedAt,
            assignmentSource: currentPresident.assignmentSource,
            assignmentSourceLabel: this.getPresidentAssignmentSourceLabel(
              currentPresident.assignmentSource,
            ),
            user: currentPresident.user,
            assignedByUser: currentPresident.assignedByUser,
          }
        : null,
      members: members.map((member) => ({
        id: member.id,
        createdAt: member.createdAt,
        user: member.user,
        addedByUser: member.addedByUser,
      })),
      managedLocalities,
      availableManagedLocalities,
      canAssignPresident: isApprover,
      canNominatePresident: userIsPresident,
      canManageMembers: isApprover || userIsPresident,
      canManageCoverage,
      managesCoverageByApproval: !isApprover && userIsPresident,
      pendingCoverageRequest,
      pendingPresidentNominationRequest,
      history,
      userIsPresident,
    };
  }

  async updateCoverage(
    payload: {
      localityId: string;
      managedLocalityIds: string[];
    },
    user: RbacUser | undefined,
  ) {
    const actorUserId = this.requireUserId(user);
    const isApprover = this.isApproverUser(user);
    const localityId = String(payload.localityId ?? '').trim();
    if (!localityId) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'required',
      });
    }

    await this.assertCanManageCoverage(user, localityId);

    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
      },
    });
    if (!locality) {
      throwError('NOT_FOUND');
    }

    const managedLocalityIds = Array.from(
      new Set(
        (payload.managedLocalityIds ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
          .filter((value) => value !== localityId),
      ),
    );

    if (!locality.hasCpca && managedLocalityIds.length > 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_NOT_ENABLED_FOR_LOCALITY',
      });
    }

    const managedLocalities = managedLocalityIds.length
      ? await this.prisma.om.findMany({
          where: {
            id: { in: managedLocalityIds },
          },
          select: {
            id: true,
            code: true,
            name: true,
            uf: true,
            hasCpca: true,
          },
        })
      : [];

    if (managedLocalities.length !== managedLocalityIds.length) {
      throwError('VALIDATION_ERROR', {
        field: 'managedLocalityIds',
        reason: 'LOCALITY_INVALID_ID',
      });
    }

    const localityWithOwnCpca = managedLocalities.find((item) => item.hasCpca);
    if (localityWithOwnCpca) {
      throwError('VALIDATION_ERROR', {
        field: 'managedLocalityIds',
        reason: 'CPCA_COVERAGE_TARGET_ALREADY_HAS_CPCA',
        localityId: localityWithOwnCpca.id,
        localityCode: localityWithOwnCpca.code,
        localityName: localityWithOwnCpca.name,
      });
    }

    const conflictingCoverage = managedLocalityIds.length
      ? await this.prisma.cpcaCommissionCoverageOm.findMany({
          where: {
            managedOmId: { in: managedLocalityIds },
            managerOmId: { not: localityId },
          },
          include: {
            managerOm: {
              select: { id: true, code: true, name: true },
            },
            managedOm: {
              select: { id: true, code: true, name: true },
            },
          },
        })
      : [];
    if (conflictingCoverage.length > 0) {
      const firstConflict = conflictingCoverage[0];
      throwError('VALIDATION_ERROR', {
        field: 'managedLocalityIds',
        reason: 'CPCA_COVERAGE_TARGET_ALREADY_ASSIGNED',
        managedLocalityId: firstConflict.managedOm.id,
        managedLocalityCode: firstConflict.managedOm.code,
        managedLocalityName: firstConflict.managedOm.name,
        managerLocalityId: firstConflict.managerOm.id,
        managerLocalityCode: firstConflict.managerOm.code,
        managerLocalityName: firstConflict.managerOm.name,
      });
    }

    if (!isApprover) {
      const pendingRequest =
        await this.prisma.cpcaCommissionCoverageRequest.findFirst({
          where: {
            omId: localityId,
            status: 'PENDING',
          },
          select: { id: true },
        });
      if (pendingRequest) {
        throwError('VALIDATION_ERROR', {
          reason: 'CPCA_COVERAGE_REQUEST_ALREADY_PENDING',
        });
      }

      const request = await this.prisma.cpcaCommissionCoverageRequest.create({
        data: {
          omId: localityId,
          requestedByUserId: actorUserId,
          requestedManagedOmIds: managedLocalityIds,
        },
        include: {
          requestedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await this.audit.log({
        userId: actorUserId,
        localityId: null,
        resource: 'cpca_cases',
        action: 'cpca_commission_coverage_request_create',
        entityId: request.id,
        diffJson: {
          omId: localityId,
          managedLocalityIds,
        },
      });

      return {
        mode: 'REQUESTED',
        request: await this.serializeCoverageRequest(request),
      };
    }

    const nextManagedLocalities = await this.applyCoverageAssignment(
      localityId,
      managedLocalityIds,
    );

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_commission_coverage_update',
      entityId: localityId,
      diffJson: {
        omId: localityId,
        managedLocalityIds,
      },
    });

    return {
      mode: 'APPLIED',
      locality: {
        id: locality.id,
        code: locality.code,
        name: locality.name,
        hasCpca: locality.hasCpca,
      },
      managedLocalities: nextManagedLocalities,
    };
  }

  async assignPresident(
    payload: {
      identifier: string;
      localityId: string;
      isSubstitution?: boolean;
      proceedWithExistingPresident?: boolean;
      designationBulletin?: string;
    },
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const localityId = String(payload.localityId ?? '').trim();
    if (!localityId) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'required',
      });
    }

    const identifier = this.normalizeIdentifier(payload.identifier);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const ldapProfile = await this.resolveLdapProfile(identifier);
    const targetUser = await this.upsertLdapBackedUser(ldapProfile);

    const assignment = await this.assignPresidentToLocality({
      localityId,
      targetUserId: targetUser.id,
      actorUserId,
      isSubstitution: Boolean(payload.isSubstitution),
      proceedWithExistingPresident: Boolean(
        payload.proceedWithExistingPresident,
      ),
      designationBulletin: this.cleanOptionalText(payload.designationBulletin, {
        maxLength: 220,
      }),
      designationBulletinFile: null,
      requestId: null,
      assignmentSource: 'DIRECT_ASSIGNMENT',
    });

    return assignment;
  }

  async lookupPresidentCandidate(
    identifierRaw: string,
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);

    const identifier = this.normalizeIdentifier(identifierRaw);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const profile = await this.resolveLdapProfile(identifier);
    const normalizedEmail = this.normalizeEmail(profile.email);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { ldapUid: profile.uid },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        ldapUid: true,
        omId: true,
        localityId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      profile: {
        uid: profile.uid,
        name: profile.name,
        email: normalizedEmail,
        fabom: profile.fabom,
        numeroOrdem: profile.numeroOrdem,
      },
      existingUser,
    };
  }

  async listPresidentRequests(user: RbacUser | undefined, statusRaw?: string) {
    this.assertApproverUser(user);
    const normalizedStatus = String(statusRaw ?? '')
      .trim()
      .toUpperCase();
    const status: CpcaPresidentRequestStatus | null =
      normalizedStatus === 'PENDING' ||
      normalizedStatus === 'APPROVED' ||
      normalizedStatus === 'REJECTED'
        ? (normalizedStatus as CpcaPresidentRequestStatus)
        : null;

    const where: Prisma.CpcaPresidentSelfRegistrationWhereInput | undefined =
      status ? { status } : undefined;

    const [items, pendingCount] = await Promise.all([
      this.prisma.cpcaPresidentSelfRegistration.findMany({
        where,
        include: {
          om: { select: { id: true, code: true, name: true } },
          applicantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              ldapUid: true,
              omId: true,
              localityId: true,
            },
          },
          decidedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.cpcaPresidentSelfRegistration.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      items,
      pendingCount,
    };
  }

  async pendingPresidentRequestsCount(user: RbacUser | undefined) {
    if (!this.isApproverUser(user)) {
      return { pendingCount: 0 };
    }

    const pendingCount = await this.prisma.cpcaPresidentSelfRegistration.count({
      where: { status: 'PENDING' },
    });
    return { pendingCount };
  }

  async approvePresidentRequest(
    requestId: string,
    payload: { proceedWithExistingPresident?: boolean },
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const request = await this.prisma.cpcaPresidentSelfRegistration.findUnique({
      where: { id: requestId },
      include: {
        om: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
      },
    });
    if (!request) {
      throwError('NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED',
      });
    }

    const requestOmId = this.requireCommissionOmId(
      request.omId,
      'CPCA_PRESIDENT_REQUEST_OM_REMOVED',
    );

    const assignment = await this.assignPresidentToLocality({
      localityId: requestOmId,
      targetUserId: request.applicantUserId,
      actorUserId,
      isSubstitution: Boolean(request.requestedAsSubstitution),
      proceedWithExistingPresident: Boolean(
        payload.proceedWithExistingPresident,
      ),
      designationBulletin: request.bulletinNumber,
      designationBulletinFile:
        this.extractSelfRegistrationBulletinFile(request),
      requestId: request.id,
      assignmentSource: 'SELF_REGISTRATION_APPROVAL',
    });

    const approved = await this.prisma.cpcaPresidentSelfRegistration.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNotes: null,
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.alignPresidentSelfRegistrationAttemptChain(
      this.prisma,
      this.buildSelfRegistrationAttemptChainWhere({
        omId: requestOmId,
        applicantUserId: request.applicantUserId,
        identifier: request.applicantIdentifier,
        applicantUid: request.applicantUid,
        applicantEmail: request.applicantEmail,
      }),
    );
    await this.notifySelfRegistrationDecisionByEmail(approved);

    return {
      request: approved,
      assignment,
    };
  }

  async rejectPresidentRequest(
    requestId: string,
    payload: { notes?: string },
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const request = await this.prisma.cpcaPresidentSelfRegistration.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });
    if (!request) {
      throwError('NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED',
      });
    }

    const rejected = await this.prisma.cpcaPresidentSelfRegistration.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNotes: this.cleanRequiredText(payload.notes ?? '', {
          field: 'notes',
          maxLength: 320,
        }),
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (rejected.omId) {
      await this.alignPresidentSelfRegistrationAttemptChain(
        this.prisma,
        this.buildSelfRegistrationAttemptChainWhere({
          omId: rejected.omId,
          applicantUserId: rejected.applicantUserId,
          identifier: rejected.applicantIdentifier,
          applicantUid: rejected.applicantUid,
          applicantEmail: rejected.applicantEmail,
        }),
      );
    }

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_president_request_reject',
      entityId: rejected.id,
      diffJson: {
        omId: rejected.omId,
        applicantUserId: rejected.applicantUserId,
        decisionNotes: rejected.decisionNotes,
      },
    });
    await this.notifySelfRegistrationDecisionByEmail(rejected);

    return { request: rejected };
  }

  async createPresidentNominationRequest(
    payload: {
      identifier: string;
      localityId?: string;
      isSubstitution?: boolean;
      bulletinNumber?: string;
    },
    user: RbacUser | undefined,
  ) {
    const requesterUserId = this.requireUserId(user);
    const localityId = await this.resolveLocalityForPresidentNomination(
      user,
      payload.localityId,
    );

    const identifier = this.normalizeIdentifier(payload.identifier);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const pendingExisting =
      await this.prisma.cpcaPresidentNominationRequest.findFirst({
        where: {
          omId: localityId,
          status: 'PENDING',
        },
        select: { id: true },
      });
    if (pendingExisting) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_NOMINATION_ALREADY_PENDING',
      });
    }

    const profile = await this.resolveLdapProfile(identifier);
    const nomineeUser = await this.upsertLdapBackedUser(profile);
    const locality = await this.assertOmSupportsCpca(localityId);

    const request = await this.prisma.cpcaPresidentNominationRequest.create({
      data: {
        omId: localityId,
        requestedByUserId: requesterUserId,
        nomineeUserId: nomineeUser.id,
        nomineeIdentifier: identifier,
        nomineeUid: profile.uid,
        nomineeEmail: this.normalizeEmail(profile.email),
        nomineeName: profile.name?.trim() || nomineeUser.name,
        requestedAsSubstitution: payload.isSubstitution ?? true,
        bulletinNumber: this.cleanOptionalText(payload.bulletinNumber, {
          maxLength: 220,
        }),
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
        nomineeUser: {
          select: { id: true, name: true, email: true, ldapUid: true },
        },
      },
    });

    await this.audit.log({
      userId: requesterUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_president_nomination_request_create',
      entityId: request.id,
      diffJson: {
        omId: localityId,
        omCode: locality.code,
        omName: locality.name,
        nomineeUserId: nomineeUser.id,
        nomineeName: request.nomineeName,
        requestedAsSubstitution: request.requestedAsSubstitution,
        bulletinNumber: request.bulletinNumber,
      },
    });

    return {
      request: this.serializePresidentNominationRequest(request),
    };
  }

  async listApprovalRequests(user: RbacUser | undefined, statusRaw?: string) {
    this.assertApprovalViewerUser(user);
    const status = this.normalizeCpcaRequestStatus(statusRaw);
    const where = status ? { status } : undefined;

    const [selfRegistrations, nominations, coverageRequests, pendingCounts] =
      await Promise.all([
        this.prisma.cpcaPresidentSelfRegistration.findMany({
          where,
          include: {
            om: { select: { id: true, code: true, name: true } },
            applicantUser: {
              select: { id: true, name: true, email: true, ldapUid: true },
            },
            decidedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }),
        this.prisma.cpcaPresidentNominationRequest.findMany({
          where,
          include: {
            om: { select: { id: true, code: true, name: true } },
            requestedByUser: {
              select: { id: true, name: true, email: true },
            },
            nomineeUser: {
              select: { id: true, name: true, email: true, ldapUid: true },
            },
            decidedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }),
        this.prisma.cpcaCommissionCoverageRequest.findMany({
          where,
          include: {
            om: { select: { id: true, code: true, name: true } },
            requestedByUser: {
              select: { id: true, name: true, email: true },
            },
            decidedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }),
        Promise.all([
          this.prisma.cpcaPresidentSelfRegistration.count({
            where: { status: 'PENDING' },
          }),
          this.prisma.cpcaPresidentNominationRequest.count({
            where: { status: 'PENDING' },
          }),
          this.prisma.cpcaCommissionCoverageRequest.count({
            where: { status: 'PENDING' },
          }),
        ]),
      ]);

    const selfRegistrationHistoryByGroupId =
      await this.loadSelfRegistrationHistoryByGroupId(
        selfRegistrations.map((item) => this.getSelfRegistrationGroupId(item)),
      );

    const items = [
      ...selfRegistrations.map((item) =>
        this.serializeApprovalSelfRegistration(
          item,
          selfRegistrationHistoryByGroupId.get(
            this.getSelfRegistrationGroupId(item),
          ) ?? [],
        ),
      ),
      ...nominations.map((item) => this.serializeApprovalNomination(item)),
      ...(await Promise.all(
        coverageRequests.map((item) => this.serializeApprovalCoverage(item)),
      )),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      items,
      pendingCount: pendingCounts.reduce((sum, value) => sum + value, 0),
      canDecide: this.isApproverUser(user),
    };
  }

  async pendingApprovalRequestsCount(user: RbacUser | undefined) {
    if (!this.isApprovalViewerUser(user)) {
      return { pendingCount: 0 };
    }

    const [selfRegistrations, nominations, coverageRequests] =
      await Promise.all([
        this.prisma.cpcaPresidentSelfRegistration.count({
          where: { status: 'PENDING' },
        }),
        this.prisma.cpcaPresidentNominationRequest.count({
          where: { status: 'PENDING' },
        }),
        this.prisma.cpcaCommissionCoverageRequest.count({
          where: { status: 'PENDING' },
        }),
      ]);

    return {
      pendingCount: selfRegistrations + nominations + coverageRequests,
    };
  }

  async approveApprovalRequest(
    requestTypeRaw: string,
    requestId: string,
    payload: { proceedWithExistingPresident?: boolean },
    user: RbacUser | undefined,
  ) {
    const requestType = this.normalizeApprovalRequestType(requestTypeRaw);
    if (requestType === 'SELF_REGISTRATION') {
      return this.approvePresidentRequest(requestId, payload, user);
    }
    if (requestType === 'PRESIDENT_NOMINATION') {
      return this.approvePresidentNominationRequest(requestId, payload, user);
    }
    return this.approveCoverageRequest(requestId, user);
  }

  async rejectApprovalRequest(
    requestTypeRaw: string,
    requestId: string,
    payload: { notes?: string },
    user: RbacUser | undefined,
  ) {
    const requestType = this.normalizeApprovalRequestType(requestTypeRaw);
    if (requestType === 'SELF_REGISTRATION') {
      return this.rejectPresidentRequest(requestId, payload, user);
    }
    if (requestType === 'PRESIDENT_NOMINATION') {
      return this.rejectPresidentNominationRequest(requestId, payload, user);
    }
    return this.rejectCoverageRequest(requestId, payload, user);
  }

  async approvePresidentNominationRequest(
    requestId: string,
    payload: { proceedWithExistingPresident?: boolean },
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const request = await this.prisma.cpcaPresidentNominationRequest.findUnique(
      {
        where: { id: requestId },
        include: {
          om: { select: { id: true, code: true, name: true } },
          requestedByUser: {
            select: { id: true, name: true, email: true },
          },
          nomineeUser: {
            select: { id: true, name: true, email: true, ldapUid: true },
          },
        },
      },
    );
    if (!request) {
      throwError('NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED',
      });
    }

    const requestOmId = this.requireCommissionOmId(
      request.omId,
      'CPCA_PRESIDENT_REQUEST_OM_REMOVED',
    );

    const assignment = await this.assignPresidentToLocality({
      localityId: requestOmId,
      targetUserId: request.nomineeUserId,
      actorUserId,
      isSubstitution: Boolean(request.requestedAsSubstitution),
      proceedWithExistingPresident: Boolean(
        payload.proceedWithExistingPresident,
      ),
      designationBulletin: request.bulletinNumber,
      designationBulletinFile: null,
      requestId: request.id,
      assignmentSource: 'PRESIDENT_NOMINATION_APPROVAL',
    });

    const approved = await this.prisma.cpcaPresidentNominationRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNotes: null,
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
        nomineeUser: {
          select: { id: true, name: true, email: true, ldapUid: true },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_president_nomination_request_approve',
      entityId: approved.id,
      diffJson: {
        omId: requestOmId,
        nomineeUserId: approved.nomineeUserId,
      },
    });
    await this.notifyNominationDecisionByEmail(approved);

    return {
      request: this.serializePresidentNominationRequest(approved),
      assignment,
    };
  }

  async rejectPresidentNominationRequest(
    requestId: string,
    payload: { notes?: string },
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const request = await this.prisma.cpcaPresidentNominationRequest.findUnique(
      {
        where: { id: requestId },
        select: { id: true, omId: true, status: true },
      },
    );
    if (!request) {
      throwError('NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED',
      });
    }

    const rejected = await this.prisma.cpcaPresidentNominationRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNotes: this.cleanOptionalText(payload.notes, {
          maxLength: 320,
        }),
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
        nomineeUser: {
          select: { id: true, name: true, email: true, ldapUid: true },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_president_nomination_request_reject',
      entityId: rejected.id,
      diffJson: {
        omId: rejected.omId,
        decisionNotes: rejected.decisionNotes,
      },
    });
    await this.notifyNominationDecisionByEmail(rejected);

    return { request: this.serializePresidentNominationRequest(rejected) };
  }

  async approveCoverageRequest(requestId: string, user: RbacUser | undefined) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const request = await this.prisma.cpcaCommissionCoverageRequest.findUnique({
      where: { id: requestId },
      include: {
        om: { select: { id: true, code: true, name: true, hasCpca: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!request) {
      throwError('NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED',
      });
    }

    const requestOmId = this.requireCommissionOmId(
      request.omId,
      'CPCA_PRESIDENT_REQUEST_OM_REMOVED',
    );

    const managedLocalities = await this.applyCoverageAssignment(
      requestOmId,
      request.requestedManagedOmIds,
    );

    const approved = await this.prisma.cpcaCommissionCoverageRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNotes: null,
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_commission_coverage_request_approve',
      entityId: approved.id,
      diffJson: {
        omId: requestOmId,
        managedLocalityIds: request.requestedManagedOmIds,
      },
    });
    await this.notifyCoverageDecisionByEmail(approved, managedLocalities);

    return {
      request: await this.serializeCoverageRequest(approved),
      managedLocalities,
    };
  }

  async rejectCoverageRequest(
    requestId: string,
    payload: { notes?: string },
    user: RbacUser | undefined,
  ) {
    this.assertApproverUser(user);
    const actorUserId = this.requireUserId(user);

    const request = await this.prisma.cpcaCommissionCoverageRequest.findUnique({
      where: { id: requestId },
      select: { id: true, omId: true, status: true },
    });
    if (!request) {
      throwError('NOT_FOUND');
    }
    if (request.status !== 'PENDING') {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED',
      });
    }

    const rejected = await this.prisma.cpcaCommissionCoverageRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNotes: this.cleanOptionalText(payload.notes, {
          maxLength: 320,
        }),
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_commission_coverage_request_reject',
      entityId: rejected.id,
      diffJson: {
        omId: rejected.omId,
        decisionNotes: rejected.decisionNotes,
      },
    });
    await this.notifyCoverageDecisionByEmail(rejected);

    return { request: await this.serializeCoverageRequest(rejected) };
  }

  async addMember(
    payload: {
      identifier: string;
      localityId?: string;
    },
    user: RbacUser | undefined,
  ) {
    const actorUserId = this.requireUserId(user);
    const localityId = this.resolveLocalityForMemberManagement(
      user,
      payload.localityId,
    );

    await this.assertCanManageMembers(user, localityId);

    const identifier = this.normalizeIdentifier(payload.identifier);
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'required',
      });
    }

    const profile = await this.resolveLdapProfile(identifier);
    const memberUser = await this.upsertLdapBackedUser(profile);

    const isPresident = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        omId: localityId,
        userId: memberUser.id,
      },
      select: { id: true },
    });
    if (isPresident) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_CANNOT_BE_MEMBER',
      });
    }

    const existingMember = await this.prisma.cpcaCommissionMember.findUnique({
      where: {
        omId_userId: {
          omId: localityId,
          userId: memberUser.id,
        },
      },
      select: { id: true },
    });

    await this.grantCpcaRole(memberUser.id, localityId);

    const created = await this.prisma.cpcaCommissionMember.upsert({
      where: {
        omId_userId: {
          omId: localityId,
          userId: memberUser.id,
        },
      },
      update: {
        addedByUserId: actorUserId,
      },
      create: {
        omId: localityId,
        userId: memberUser.id,
        addedByUserId: actorUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
        addedByUser: {
          select: { id: true, name: true, email: true },
        },
        om: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_commission_member_add',
      entityId: created.id,
      diffJson: {
        omId: localityId,
        memberUserId: memberUser.id,
        memberUserName: memberUser.name,
      },
    });

    if (!existingMember) {
      await this.notifyMemberAddedByEmail(created);
    }

    return { member: created };
  }

  async removeMember(memberId: string, user: RbacUser | undefined) {
    const actorUserId = this.requireUserId(user);
    const member = await this.prisma.cpcaCommissionMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
      },
    });

    if (!member) {
      throwError('NOT_FOUND');
    }

    const memberOmId = this.requireCommissionOmId(
      member.omId,
      'CPCA_COMMISSION_MEMBER_OM_REMOVED',
    );

    await this.assertCanManageMembers(user, memberOmId);

    await this.prisma.cpcaCommissionMember.delete({ where: { id: memberId } });

    const [remainingMemberships, remainsPresident] = await Promise.all([
      this.prisma.cpcaCommissionMember.count({
        where: { userId: member.userId },
      }),
      this.prisma.cpcaCommissionPresident.count({
        where: { userId: member.userId },
      }),
    ]);

    if (remainingMemberships === 0 && remainsPresident === 0) {
      await this.revokeCpcaRole(member.userId);
    }

    await this.audit.log({
      userId: actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_commission_member_remove',
      entityId: member.id,
      diffJson: {
        omId: member.omId,
        memberUserId: member.userId,
        memberUserName: member.user.name,
      },
    });

    return {
      ok: true,
      removedId: member.id,
      removedUser: member.user,
    };
  }

  async getApprovalRequestBulletinFile(
    requestTypeRaw: string,
    requestId: string,
    user: RbacUser | undefined,
  ) {
    this.assertApprovalViewerUser(user);
    const requestType = this.normalizeApprovalRequestType(requestTypeRaw);
    if (requestType !== 'SELF_REGISTRATION') {
      throwError('NOT_FOUND');
    }

    const request = await this.prisma.cpcaPresidentSelfRegistration.findUnique({
      where: { id: requestId },
      select: {
        bulletinFileName: true,
        bulletinStorageKey: true,
        bulletinMimeType: true,
      },
    });
    if (!request) {
      throwError('NOT_FOUND');
    }

    const storageKey = String(request.bulletinStorageKey ?? '').trim();
    const mimeType = String(request.bulletinMimeType ?? '').trim();
    const fileName = String(request.bulletinFileName ?? '').trim();
    const filePath = resolveExistingCpcaPresidentBulletinPath(storageKey);
    if (!storageKey || !mimeType || !filePath) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_BULLETIN_UNAVAILABLE',
      });
    }

    return {
      filePath,
      mimeType,
      fileName: fileName || 'publicacao-cpca',
    };
  }

  private async assignPresidentToLocality(input: {
    localityId: string;
    targetUserId: string;
    actorUserId: string;
    isSubstitution: boolean;
    proceedWithExistingPresident: boolean;
    designationBulletin: string | null;
    designationBulletinFile: StoredCpcaPresidentBulletinFile | null;
    requestId: string | null;
    assignmentSource: CpcaCommissionPresidentAssignmentSource;
  }) {
    const locality = await this.ensureOmSupportsCpcaForPresidentAssignment(
      input.localityId,
    );

    const existing = await this.prisma.cpcaCommissionPresident.findUnique({
      where: { omId: input.localityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
      },
    });

    if (
      existing &&
      existing.userId !== input.targetUserId &&
      !input.proceedWithExistingPresident
    ) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_LOCALITY_ALREADY_HAS_PRESIDENT',
        localityId: input.localityId,
        localityName: locality.name,
        currentPresident: existing.user?.name ?? null,
      });
    }

    if (
      existing &&
      existing.userId !== input.targetUserId &&
      Boolean(input.isSubstitution)
    ) {
      await this.revokeCpcaRole(existing.userId);
      await this.prisma.cpcaCommissionMember.deleteMany({
        where: {
          omId: input.localityId,
          userId: existing.userId,
        },
      });
    }

    await this.grantCpcaRole(input.targetUserId, input.localityId);

    const previousStorageKey =
      String(existing?.designationBulletinStorageKey ?? '').trim() || null;
    const nextStorageKey =
      input.designationBulletinFile?.storageKey?.trim() || null;

    const assigned = await this.prisma.cpcaCommissionPresident.upsert({
      where: { omId: input.localityId },
      update: {
        userId: input.targetUserId,
        assignedByUserId: input.actorUserId,
        assignmentSource: input.assignmentSource,
        designationBulletin: input.designationBulletin,
        designationBulletinFileName:
          input.designationBulletinFile?.fileName ?? null,
        designationBulletinStorageKey: nextStorageKey,
        designationBulletinMimeType:
          input.designationBulletinFile?.mimeType ?? null,
        designationBulletinFileSize:
          input.designationBulletinFile?.fileSize ?? null,
        designationBulletinChecksum:
          input.designationBulletinFile?.checksum ?? null,
        isSubstitution: Boolean(input.isSubstitution),
        assignedAt: new Date(),
      },
      create: {
        omId: input.localityId,
        userId: input.targetUserId,
        assignedByUserId: input.actorUserId,
        assignmentSource: input.assignmentSource,
        designationBulletin: input.designationBulletin,
        designationBulletinFileName:
          input.designationBulletinFile?.fileName ?? null,
        designationBulletinStorageKey: nextStorageKey,
        designationBulletinMimeType:
          input.designationBulletinFile?.mimeType ?? null,
        designationBulletinFileSize:
          input.designationBulletinFile?.fileSize ?? null,
        designationBulletinChecksum:
          input.designationBulletinFile?.checksum ?? null,
        isSubstitution: Boolean(input.isSubstitution),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
            omId: true,
            localityId: true,
          },
        },
        assignedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (previousStorageKey && previousStorageKey !== nextStorageKey) {
      await this.prisma.cpcaPresidentSelfRegistration.updateMany({
        where: { bulletinStorageKey: previousStorageKey },
        data: {
          bulletinStorageKey: null,
          bulletinMimeType: null,
          bulletinFileSize: null,
          bulletinChecksum: null,
        },
      });
      deleteCpcaPresidentBulletinFile(previousStorageKey);
    }

    await this.prisma.cpcaCommissionMember.deleteMany({
      where: {
        omId: input.localityId,
        userId: input.targetUserId,
      },
    });

    await this.audit.log({
      userId: input.actorUserId,
      localityId: null,
      resource: 'cpca_cases',
      action: 'cpca_commission_president_assign',
      entityId: assigned.id,
      diffJson: {
        omId: input.localityId,
        requestId: input.requestId,
        assignedUserId: assigned.user.id,
        assignedUserName: assigned.user.name,
        assignmentSource: input.assignmentSource,
        replacedUserId:
          existing && existing.userId !== input.targetUserId
            ? existing.userId
            : null,
        replacedUserName:
          existing && existing.userId !== input.targetUserId
            ? (existing.user?.name ?? null)
            : null,
        isSubstitution: Boolean(input.isSubstitution),
        designationBulletin: input.designationBulletin,
        designationBulletinFileName:
          input.designationBulletinFile?.fileName ?? null,
        designationBulletinStorageKey: nextStorageKey,
      },
    });

    return {
      locality: {
        id: locality.id,
        code: locality.code,
        name: locality.name,
      },
      president: assigned,
      replacedPresident:
        existing && existing.userId !== input.targetUserId
          ? existing.user
          : null,
      proceededOverExistingPresident:
        existing && existing.userId !== input.targetUserId
          ? input.proceedWithExistingPresident
          : false,
      requestId: input.requestId,
    };
  }

  private resolveLocalityForMemberManagement(
    user: RbacUser | undefined,
    requestedLocalityId?: string,
  ) {
    const requested = String(requestedLocalityId ?? '').trim();
    if (this.isApproverUser(user)) {
      if (!requested) {
        throwError('VALIDATION_ERROR', {
          field: 'localityId',
          reason: 'required',
        });
      }
      return requested;
    }

    const userLocalityId = String(user?.omId ?? '').trim();
    if (!userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (requested && requested !== userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }
    return userLocalityId;
  }

  private async assertCanManageMembers(
    user: RbacUser | undefined,
    localityId: string,
  ) {
    await this.assertOmSupportsCpca(localityId);

    if (this.isApproverUser(user)) {
      return;
    }

    const userId = this.requireUserId(user);
    const isPresident = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        omId: localityId,
        userId,
      },
      select: { id: true },
    });

    if (!isPresident) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async assertCanManageCoverage(
    user: RbacUser | undefined,
    localityId: string,
  ) {
    if (this.isApproverUser(user)) {
      return;
    }

    const userId = this.requireUserId(user);
    const isPresident = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        omId: localityId,
        userId,
      },
      select: { id: true },
    });

    if (!isPresident) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async listManagedLocalities(localityId: string) {
    const items = await this.prisma.cpcaCommissionCoverageOm.findMany({
      where: { managerOmId: localityId },
      select: {
        managedOm: {
          select: {
            id: true,
            code: true,
            name: true,
            uf: true,
            hasCpca: true,
          },
        },
      },
      orderBy: {
        managedOm: {
          name: 'asc',
        },
      },
    });

    return items.map((entry) => entry.managedOm);
  }

  private async listAvailableManagedLocalities(localityId: string) {
    return this.prisma.om.findMany({
      where: {
        id: { not: localityId },
      },
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
        hasCpca: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  private async assertOmSupportsCpca(localityId: string) {
    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
      },
    });

    if (!locality) {
      throwError('NOT_FOUND');
    }

    if (!locality.hasCpca) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_NOT_ENABLED_FOR_LOCALITY',
      });
    }

    return locality;
  }

  private async assertOmExistsForSelfRegistration(localityId: string) {
    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
      },
    });

    if (!locality) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'CPCA_SELF_REGISTRATION_LOCALITY_NOT_FOUND',
      });
    }

    return locality;
  }

  private async ensureOmSupportsCpcaForPresidentAssignment(localityId: string) {
    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
      },
    });

    if (!locality) {
      throwError('NOT_FOUND');
    }

    if (locality.hasCpca) {
      return locality;
    }

    return this.prisma.om.update({
      where: { id: localityId },
      data: { hasCpca: true },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
      },
    });
  }

  private async resolveLdapProfile(identifier: string) {
    let profile: FabLdapProfile | null = null;

    if (identifier.includes('@')) {
      profile = await this.fabLdap.lookupByEmail(identifier);
    } else {
      const digits = identifier.replace(/\D/g, '');
      if (digits.length === 11) {
        profile = await this.fabLdap.lookupByCpf(digits);
      }
      if (!profile) {
        profile = await this.fabLdap.lookupByUid(this.normalizeUid(identifier));
      }
    }

    if (!profile) {
      throwError('VALIDATION_ERROR', {
        reason: 'LDAP_USER_NOT_FOUND',
        uid: identifier,
      });
    }

    return profile;
  }

  private extractMilitaryIdentity(name: string | null | undefined) {
    const fullName = String(name ?? '').trim();
    if (!fullName) {
      return {
        postoGraduacao: null as string | null,
        warName: null as string | null,
      };
    }

    const match = fullName.match(MILITARY_RANK_PREFIX);
    if (!match) {
      return {
        postoGraduacao: null as string | null,
        warName: fullName,
      };
    }

    const postoGraduacao =
      String(match[1] ?? '')
        .trim()
        .toUpperCase() || null;
    const warNameRaw = fullName.slice(match[0].length).trim();
    return {
      postoGraduacao,
      warName: warNameRaw || fullName,
    };
  }

  private normalizeFabOm(value: string | null | undefined) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private async resolveOmFromFabOm(fabom: string | null | undefined) {
    return resolveBestOmByFabOm(this.prisma, fabom);
  }

  private async upsertLdapBackedUser(
    profile: FabLdapProfile,
    resolvedLdapLocalityId?: string | null,
  ) {
    const ldapLocalityId =
      resolvedLdapLocalityId ??
      (await this.resolveOmFromFabOm(profile.fabom))?.id ??
      null;
    const uid = this.normalizeUid(profile.uid);
    const preferredEmail =
      this.normalizeEmail(profile.email) ?? `${uid}@fab.intraer`;
    const preferredName = profile.name?.trim() || `Militar ${uid}`;

    const existingCandidates = await this.prisma.user.findMany({
      where: {
        OR: [{ ldapUid: uid }, { email: preferredEmail }],
      },
      select: {
        id: true,
        email: true,
        omId: true,
        localityId: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });

    const existing =
      existingCandidates.find(
        (candidate) => candidate.email === preferredEmail,
      ) ??
      existingCandidates[0] ??
      null;

    const uniqueEmail = await this.resolveUniqueEmail(
      preferredEmail,
      uid,
      existing?.id,
    );

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          ldapUid: uid,
          email: uniqueEmail,
          name: preferredName,
          isActive: true,
          omId: ldapLocalityId !== null ? ldapLocalityId : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          ldapUid: true,
          omId: true,
          localityId: true,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        ldapUid: uid,
        email: uniqueEmail,
        name: preferredName,
        isActive: true,
        omId: ldapLocalityId,
        passwordHash: await this.createTemporaryPasswordHash(uid),
      },
      select: {
        id: true,
        name: true,
        email: true,
        ldapUid: true,
        omId: true,
        localityId: true,
      },
    });
  }

  private async grantCpcaRole(userId: string, localityId: string) {
    const cpcaRoleId = await this.resolveCpcaRoleId();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        omId: localityId,
      },
    });

    await this.prisma.userRole.createMany({
      data: [{ userId, roleId: cpcaRoleId }],
      skipDuplicates: true,
    });
  }

  private async revokeCpcaRole(userId: string) {
    const cpcaRoleId = await this.resolveCpcaRoleId();
    await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: cpcaRoleId,
      },
    });
  }

  private async resolveCpcaRoleId() {
    const roles = await this.prisma.role.findMany({
      select: { id: true, name: true },
    });

    const cpcaRole = roles.find(
      (role) => normalizeRoleName(role.name) === normalizeRoleName(ROLE_CPCA),
    );

    if (!cpcaRole) {
      throwError('NOT_FOUND');
    }

    return cpcaRole.id;
  }

  private requireUserId(user: RbacUser | undefined) {
    const userId = String(user?.id ?? '').trim();
    if (!userId) {
      throwError('RBAC_FORBIDDEN');
    }
    return userId;
  }

  private isApproverUser(user: RbacUser | undefined) {
    return this.userHasAnyRole(user, ROLE_NAMES_ALLOWED_TO_APPROVE);
  }

  private isApprovalViewerUser(user: RbacUser | undefined) {
    return this.userHasAnyRole(user, ROLE_NAMES_ALLOWED_TO_VIEW_APPROVALS);
  }

  private userHasAnyRole(
    user: RbacUser | undefined,
    allowedRoles: Set<string>,
  ) {
    const normalizedRoleNames = new Set(
      [...(user?.roles ?? []), ...(user?.allRoles ?? [])].map((role) =>
        normalizeRoleName(role.name),
      ),
    );

    for (const roleName of allowedRoles) {
      if (normalizedRoleNames.has(roleName)) {
        return true;
      }
    }

    return false;
  }

  private assertApproverUser(user: RbacUser | undefined) {
    if (!this.isApproverUser(user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertApprovalViewerUser(user: RbacUser | undefined) {
    if (!this.isApprovalViewerUser(user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private normalizeApprovalRequestType(
    value: string | null | undefined,
  ): CpcaApprovalRequestType {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (
      CPCA_APPROVAL_REQUEST_TYPES.includes(
        normalized as CpcaApprovalRequestType,
      )
    ) {
      return normalized as CpcaApprovalRequestType;
    }
    throwError('VALIDATION_ERROR', {
      field: 'type',
      reason: 'INVALID_CPCA_APPROVAL_REQUEST_TYPE',
    });
  }

  private normalizeCpcaRequestStatus(
    value: string | null | undefined,
  ): CpcaPresidentRequestStatus | null {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (
      normalized === 'PENDING' ||
      normalized === 'APPROVED' ||
      normalized === 'REJECTED'
    ) {
      return normalized as CpcaPresidentRequestStatus;
    }
    return null;
  }

  private getPresidentAssignmentSourceLabel(
    source: CpcaCommissionPresidentAssignmentSource | string | null | undefined,
  ) {
    const normalized = String(source ?? '')
      .trim()
      .toUpperCase();
    if (normalized === 'SELF_REGISTRATION_APPROVAL') {
      return 'Homologado por autoinscrição';
    }
    if (normalized === 'PRESIDENT_NOMINATION_APPROVAL') {
      return 'Homologado por indicação do presidente';
    }
    return 'Cadastrado diretamente';
  }

  private async findPendingCoverageRequest(localityId: string) {
    const request = await this.prisma.cpcaCommissionCoverageRequest.findFirst({
      where: {
        omId: localityId,
        status: 'PENDING',
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return request ? this.serializeCoverageRequest(request) : null;
  }

  private async findPendingPresidentNominationRequest(localityId: string) {
    const request = await this.prisma.cpcaPresidentNominationRequest.findFirst({
      where: {
        omId: localityId,
        status: 'PENDING',
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        requestedByUser: {
          select: { id: true, name: true, email: true },
        },
        nomineeUser: {
          select: { id: true, name: true, email: true, ldapUid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return request ? this.serializePresidentNominationRequest(request) : null;
  }

  private async listCommissionHistory(localityId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        createdAt: Date;
        diffJson: Prisma.JsonValue | null;
        userId: string | null;
        userName: string | null;
        userEmail: string | null;
      }>
    >(Prisma.sql`
      SELECT
        al."id" AS "id",
        al."action" AS "action",
        al."createdAt" AS "createdAt",
        al."diffJson" AS "diffJson",
        u."id" AS "userId",
        u."name" AS "userName",
        u."email" AS "userEmail"
      FROM "AuditLog" al
      LEFT JOIN "User" u
        ON u."id" = al."userId"
      WHERE al."resource" = 'cpca_cases'
        AND (
          al."localityId" = ${localityId}
          OR COALESCE(al."diffJson"->>'omId', '') = ${localityId}
        )
        AND (
          al."action" LIKE 'cpca_commission_%'
          OR al."action" LIKE 'cpca_president_%'
        )
      ORDER BY al."createdAt" DESC
      LIMIT 30
    `);

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actionLabel: this.describeCommissionHistoryAction(row.action),
      summary: this.describeCommissionHistorySummary(
        row.action,
        row.diffJson as Record<string, unknown> | null,
      ),
      createdAt: row.createdAt.toISOString(),
      actor: row.userId
        ? {
            id: row.userId,
            name: row.userName,
            email: row.userEmail,
          }
        : null,
      diffJson: row.diffJson,
    }));
  }

  private describeCommissionHistoryAction(action: string) {
    switch (action) {
      case 'cpca_commission_president_assign':
        return 'Presidente definido';
      case 'cpca_president_self_registration_create':
        return 'Autoinscrição de presidente';
      case 'cpca_president_request_reject':
        return 'Solicitação de presidente rejeitada';
      case 'cpca_president_nomination_request_create':
        return 'Solicitação de sucessão criada';
      case 'cpca_president_nomination_request_approve':
        return 'Solicitação de sucessão homologada';
      case 'cpca_president_nomination_request_reject':
        return 'Solicitação de sucessão rejeitada';
      case 'cpca_commission_member_add':
        return 'Membro adicionado';
      case 'cpca_commission_member_remove':
        return 'Membro removido';
      case 'cpca_commission_checklist_update':
        return 'Checklist atualizado';
      case 'cpca_commission_coverage_request_create':
        return 'Solicitação de cobertura criada';
      case 'cpca_commission_coverage_request_approve':
        return 'Solicitação de cobertura homologada';
      case 'cpca_commission_coverage_request_reject':
        return 'Solicitação de cobertura rejeitada';
      case 'cpca_commission_coverage_update':
        return 'Cobertura atualizada';
      default:
        return action;
    }
  }

  private describeCommissionHistorySummary(
    action: string,
    diffJson: Record<string, unknown> | null,
  ) {
    const nomineeName = String(diffJson?.nomineeName ?? '').trim();
    const assignedUserName = String(diffJson?.assignedUserName ?? '').trim();
    const applicantName = String(diffJson?.applicantName ?? '').trim();
    const memberUserName = String(diffJson?.memberUserName ?? '').trim();
    const bulletinNumber = String(
      diffJson?.bulletinNumber ?? diffJson?.designationBulletin ?? '',
    ).trim();
    const replacedUserId = String(diffJson?.replacedUserId ?? '').trim();
    const memberUserId = String(diffJson?.memberUserId ?? '').trim();
    const completedCount = Number(diffJson?.completedCount ?? 0);
    const pendingCount = Number(diffJson?.pendingCount ?? 0);
    const managedLocalityIds = Array.isArray(diffJson?.managedLocalityIds)
      ? diffJson.managedLocalityIds
      : [];

    switch (action) {
      case 'cpca_commission_president_assign':
        return replacedUserId
          ? `Presidência transferida para ${assignedUserName || 'novo presidente'}${bulletinNumber ? ` • boletim ${bulletinNumber}` : ''}.`
          : `Presidência definida para ${assignedUserName || 'militar designado'}${bulletinNumber ? ` • boletim ${bulletinNumber}` : ''}.`;
      case 'cpca_president_self_registration_create':
        return `${applicantName || 'Militar'} solicitou homologação como presidente${bulletinNumber ? ` • boletim ${bulletinNumber}` : ''}.`;
      case 'cpca_president_request_reject':
        return 'Solicitação de presidente rejeitada.';
      case 'cpca_president_nomination_request_create':
        return nomineeName
          ? `Sucessão proposta para ${nomineeName}${bulletinNumber ? ` • boletim ${bulletinNumber}` : ''}.`
          : 'Sucessão proposta para homologação.';
      case 'cpca_president_nomination_request_approve':
        return 'Sucessão homologada.';
      case 'cpca_president_nomination_request_reject':
        return 'Sucessão rejeitada.';
      case 'cpca_commission_member_add':
        return memberUserName
          ? `${memberUserName} incluído na comissão.`
          : memberUserId
            ? `Membro incluído na comissão.`
            : 'Membro incluído na comissão.';
      case 'cpca_commission_member_remove':
        return memberUserName
          ? `${memberUserName} removido da comissão.`
          : memberUserId
            ? `Membro removido da comissão.`
            : 'Membro removido da comissão.';
      case 'cpca_commission_checklist_update':
        return `Checklist atualizado: ${completedCount} concluídos e ${pendingCount} pendentes.`;
      case 'cpca_commission_coverage_request_create':
        return `Cobertura proposta para ${managedLocalityIds.length} OM(s).`;
      case 'cpca_commission_coverage_request_approve':
      case 'cpca_commission_coverage_update':
        return `Cobertura atualizada para ${managedLocalityIds.length} OM(s).`;
      case 'cpca_commission_coverage_request_reject':
        return 'Solicitação de cobertura rejeitada.';
      default:
        return 'Alteração registrada na comissão CPCA.';
    }
  }

  private async serializeCoverageRequest(request: {
    id: string;
    omId?: string | null;
    requestedManagedOmIds: string[];
    status: CpcaPresidentRequestStatus;
    createdAt: Date;
    decidedAt?: Date | null;
    decisionNotes?: string | null;
    om?: { id: string; code: string; name: string } | null;
    requestedByUser?: { id: string; name: string; email: string } | null;
    decidedByUser?: { id: string; name: string; email: string } | null;
  }) {
    const requestedIds = Array.from(
      new Set(
        (request.requestedManagedOmIds ?? [])
          .map((item) => String(item ?? '').trim())
          .filter(Boolean),
      ),
    );
    const managedLocalities = requestedIds.length
      ? await this.prisma.om.findMany({
          where: { id: { in: requestedIds } },
          select: { id: true, code: true, name: true, uf: true, hasCpca: true },
          orderBy: { name: 'asc' },
        })
      : [];

    return {
      id: request.id,
      type: 'COVERAGE' as const,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
      decisionNotes: request.decisionNotes ?? null,
      locality: request.om ?? null,
      requestedByUser: request.requestedByUser ?? null,
      decidedByUser: request.decidedByUser ?? null,
      requestedManagedLocalities: managedLocalities,
    };
  }

  private async notifySelfRegistrationDecisionByEmail(request: {
    id: string;
    status: CpcaPresidentRequestStatus;
    applicantName: string;
    applicantEmail?: string | null;
    requestedAsSubstitution: boolean;
    bulletinNumber: string;
    attemptNumber: number;
    decidedAt?: Date | null;
    decisionNotes?: string | null;
    om?: { id: string; code: string; name: string } | null;
    applicantUser?: { email?: string | null } | null;
  }) {
    await this.sendCpcaApprovalDecisionEmail({
      requestId: request.id,
      requestTypeLabel: 'Solicitação de presidência CPCA',
      to: request.applicantEmail ?? request.applicantUser?.email ?? null,
      recipientName: request.applicantName,
      status: request.status,
      locality: request.om ?? null,
      bulletinNumber: request.bulletinNumber,
      attemptLabel: `Tentativa ${Number(request.attemptNumber ?? 1)}`,
      requestedAsSubstitution: request.requestedAsSubstitution,
      decidedAt: request.decidedAt ?? null,
      decisionReason: request.decisionNotes ?? null,
    });
  }

  private async notifyNominationDecisionByEmail(request: {
    id: string;
    status: CpcaPresidentRequestStatus;
    nomineeName: string;
    requestedAsSubstitution: boolean;
    bulletinNumber?: string | null;
    decidedAt?: Date | null;
    decisionNotes?: string | null;
    om?: { id: string; code: string; name: string } | null;
    requestedByUser?: { name: string; email: string } | null;
  }) {
    await this.sendCpcaApprovalDecisionEmail({
      requestId: request.id,
      requestTypeLabel: 'Solicitação de sucessão da presidência CPCA',
      to: request.requestedByUser?.email ?? null,
      recipientName: request.requestedByUser?.name ?? null,
      status: request.status,
      locality: request.om ?? null,
      bulletinNumber: request.bulletinNumber ?? null,
      nomineeName: request.nomineeName,
      requestedAsSubstitution: request.requestedAsSubstitution,
      decidedAt: request.decidedAt ?? null,
      decisionReason: request.decisionNotes ?? null,
    });
  }

  private async notifyCoverageDecisionByEmail(
    request: {
      id: string;
      status: CpcaPresidentRequestStatus;
      decidedAt?: Date | null;
      decisionNotes?: string | null;
      om?: { id: string; code: string; name: string } | null;
      requestedByUser?: { name: string; email: string } | null;
    },
    managedLocalities?: Array<{
      id: string;
      code: string;
      name: string;
    }>,
  ) {
    const managedLocalitiesLabel =
      managedLocalities && managedLocalities.length > 0
        ? managedLocalities
            .map((item) => formatOmLabel(item.code, item.name))
            .filter(Boolean)
            .join(', ')
        : null;

    await this.sendCpcaApprovalDecisionEmail({
      requestId: request.id,
      requestTypeLabel: 'Solicitação de cobertura CPCA',
      to: request.requestedByUser?.email ?? null,
      recipientName: request.requestedByUser?.name ?? null,
      status: request.status,
      locality: request.om ?? null,
      managedLocalitiesLabel,
      decidedAt: request.decidedAt ?? null,
      decisionReason: request.decisionNotes ?? null,
    });
  }

  private async sendCpcaApprovalDecisionEmail(input: {
    requestId: string;
    requestTypeLabel: string;
    to?: string | null;
    recipientName?: string | null;
    status: CpcaPresidentRequestStatus;
    locality?: { code?: string | null; name?: string | null } | null;
    bulletinNumber?: string | null;
    attemptLabel?: string | null;
    requestedAsSubstitution?: boolean;
    nomineeName?: string | null;
    managedLocalitiesLabel?: string | null;
    decidedAt?: Date | null;
    decisionReason?: string | null;
    heading?: string | null;
    badgeLabel?: string | null;
    intro?: string | null;
    bodyText?: string | null;
    nextSteps?: string[];
    extraDetails?: Array<{
      label: string;
      value?: string | null;
    }>;
  }) {
    if (!this.mail) {
      return;
    }

    const to = this.normalizeEmail(input.to);
    if (!to) {
      this.logger.warn(
        `Notificacao por e-mail ignorada para ${input.requestTypeLabel} ${input.requestId}: destinatario ausente.`,
      );
      return;
    }

    if (input.status !== 'APPROVED' && input.status !== 'REJECTED') {
      return;
    }

    try {
      const message = buildCpcaApprovalDecisionEmail({
        requestTypeLabel: input.requestTypeLabel,
        recipientName: input.recipientName,
        status: input.status,
        locality: input.locality,
        bulletinNumber: input.bulletinNumber,
        attemptLabel: input.attemptLabel,
        requestedAsSubstitution: input.requestedAsSubstitution,
        nomineeName: input.nomineeName,
        managedLocalitiesLabel: input.managedLocalitiesLabel,
        decidedAt: input.decidedAt,
        decisionReason: input.decisionReason,
        heading: input.heading,
        badgeLabel: input.badgeLabel,
        intro: input.intro,
        bodyText: input.bodyText,
        nextSteps: input.nextSteps,
        extraDetails: input.extraDetails,
      });

      await this.mail.sendMail({
        to,
        ...message,
      });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'falha desconhecida';
      this.logger.warn(
        `Falha ao enviar e-mail de decisao CPCA para ${to} (${input.requestTypeLabel} ${input.requestId}): ${detail}.`,
      );
    }
  }

  private async notifyMemberAddedByEmail(member: {
    id: string;
    user: { name?: string | null; email?: string | null };
    addedByUser?: { name?: string | null; email?: string | null } | null;
    om?: { code?: string | null; name?: string | null } | null;
  }) {
    await this.sendCpcaApprovalDecisionEmail({
      requestId: member.id,
      requestTypeLabel: 'Cadastro como membro da CPCA',
      to: member.user.email ?? null,
      recipientName: member.user.name ?? null,
      status: 'APPROVED',
      locality: member.om ?? null,
      heading: 'Cadastro como membro da CPCA registrado',
      badgeLabel: 'Cadastro registrado',
      intro: 'Você foi cadastrado como membro da CPCA desta OM no sistema.',
      bodyText:
        'Este aviso confirma o seu cadastro como membro da comissão CPCA. Abaixo estão os principais detalhes para consulta rápida.',
      nextSteps: [
        'A atualização já foi registrada no sistema.',
        'Acesse novamente o sistema caso o perfil ou a tela da CPCA ainda não apareçam.',
        'Procure o presidente da CPCA da sua OM em caso de dúvida sobre a atuação na comissão.',
      ],
      extraDetails: [
        {
          label: 'Cadastrado por',
          value: member.addedByUser?.name ?? null,
        },
      ],
    });
  }

  private async notifySelfRegistrationCreatedByEmail(input: {
    requestId: string;
    applicantName: string;
    applicantEmail?: string | null;
    applicantUid?: string | null;
    locality?: { code?: string | null; name?: string | null } | null;
    bulletinNumber?: string | null;
    requestedAsSubstitution?: boolean;
    attemptNumber?: number | null;
    createdAt?: Date | null;
  }) {
    if (!this.mail || !this.settings) {
      return;
    }

    try {
      const emailSettings = await this.settings.getEmailSettings();
      const to = this.normalizeEmail(
        emailSettings.cpcaPresidentSelfRegistrationRecipientEmail,
      );
      if (!to) {
        return;
      }

      const message = buildCpcaSelfRegistrationNotificationEmail({
        applicantName: input.applicantName,
        applicantEmail: input.applicantEmail,
        applicantUid: input.applicantUid,
        locality: input.locality,
        bulletinNumber: input.bulletinNumber,
        requestedAsSubstitution: input.requestedAsSubstitution,
        attemptNumber: input.attemptNumber,
        createdAt: input.createdAt,
      });

      await this.mail.sendMail({
        to,
        ...message,
      });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'falha desconhecida';
      this.logger.warn(
        `Falha ao enviar e-mail de autoinscricao CPCA (${input.requestId}): ${detail}.`,
      );
    }
  }

  private serializePresidentNominationRequest(request: {
    id: string;
    om?: { id: string; code: string; name: string } | null;
    requestedByUser?: { id: string; name: string; email: string } | null;
    nomineeUser?: {
      id: string;
      name: string;
      email: string;
      ldapUid?: string | null;
    } | null;
    nomineeName: string;
    nomineeIdentifier: string;
    nomineeEmail?: string | null;
    requestedAsSubstitution: boolean;
    bulletinNumber?: string | null;
    status: CpcaPresidentRequestStatus;
    createdAt: Date;
    decidedAt?: Date | null;
    decisionNotes?: string | null;
    decidedByUser?: { id: string; name: string; email: string } | null;
  }) {
    return {
      id: request.id,
      type: 'PRESIDENT_NOMINATION' as const,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
      decisionNotes: request.decisionNotes ?? null,
      locality: request.om ?? null,
      requestedByUser: request.requestedByUser ?? null,
      nominee: request.nomineeUser
        ? {
            ...request.nomineeUser,
            displayName: request.nomineeUser.name ?? request.nomineeName,
          }
        : {
            id: '',
            name: request.nomineeName,
            email: request.nomineeEmail ?? '',
            ldapUid: null,
            displayName: request.nomineeName,
          },
      nomineeIdentifier: request.nomineeIdentifier,
      requestedAsSubstitution: request.requestedAsSubstitution,
      bulletinNumber: request.bulletinNumber ?? null,
      decidedByUser: request.decidedByUser ?? null,
    };
  }

  private buildSelfRegistrationApplicantIdentityConditions(args: {
    identifier: string;
    applicantUid: string;
    applicantEmail?: string | null;
  }): Prisma.CpcaPresidentSelfRegistrationWhereInput[] {
    const orConditions: Prisma.CpcaPresidentSelfRegistrationWhereInput[] = [
      { applicantIdentifier: args.identifier },
      { applicantUid: args.applicantUid },
    ];
    const normalizedEmail = this.normalizeEmail(args.applicantEmail);
    if (normalizedEmail) {
      orConditions.push({ applicantEmail: normalizedEmail });
    }
    return orConditions;
  }

  private buildSelfRegistrationAttemptChainWhere(args: {
    omId: string;
    applicantUserId?: string | null;
    identifier: string;
    applicantUid: string;
    applicantEmail?: string | null;
  }): Prisma.CpcaPresidentSelfRegistrationWhereInput {
    const orConditions = this.buildSelfRegistrationApplicantIdentityConditions({
      identifier: args.identifier,
      applicantUid: args.applicantUid,
      applicantEmail: args.applicantEmail,
    });
    const applicantUserId = String(args.applicantUserId ?? '').trim();
    if (applicantUserId) {
      orConditions.unshift({ applicantUserId });
    }
    return {
      omId: args.omId,
      OR: orConditions,
    };
  }

  private buildSelfRegistrationApplicantWhere(args: {
    identifier: string;
    applicantUid: string;
    applicantEmail?: string | null;
  }): Prisma.CpcaPresidentSelfRegistrationWhereInput {
    return {
      OR: this.buildSelfRegistrationApplicantIdentityConditions(args),
    };
  }

  private isSameSelfRegistrationApplicant(
    request: {
      applicantUserId?: string | null;
      applicantIdentifier?: string | null;
      applicantUid?: string | null;
      applicantEmail?: string | null;
    },
    applicant: {
      applicantUserId?: string | null;
      identifier: string;
      applicantUid: string;
      applicantEmail?: string | null;
    },
  ) {
    const applicantUserId = String(applicant.applicantUserId ?? '').trim();
    if (
      applicantUserId &&
      String(request.applicantUserId ?? '').trim() === applicantUserId
    ) {
      return true;
    }

    if (
      String(request.applicantIdentifier ?? '').trim() === applicant.identifier
    ) {
      return true;
    }

    if (String(request.applicantUid ?? '').trim() === applicant.applicantUid) {
      return true;
    }

    const applicantEmail = this.normalizeEmail(applicant.applicantEmail);
    if (!applicantEmail) {
      return false;
    }

    return this.normalizeEmail(request.applicantEmail) === applicantEmail;
  }

  private getSelfRegistrationGroupId(request: {
    id: string;
    retryRootRequestId?: string | null;
  }) {
    const retryRootRequestId = String(request.retryRootRequestId ?? '').trim();
    return retryRootRequestId || request.id;
  }

  private serializeSelfRegistrationHistoryEntry(
    request: {
      id: string;
      retryRootRequestId?: string | null;
      attemptNumber: number;
      status: CpcaPresidentRequestStatus;
      requestedAsSubstitution: boolean;
      bulletinNumber: string;
      bulletinFileName?: string | null;
      bulletinStorageKey?: string | null;
      bulletinMimeType?: string | null;
      bulletinFileSize?: number | null;
      bulletinChecksum?: string | null;
      createdAt: Date;
      decidedAt?: Date | null;
      decisionNotes?: string | null;
      om?: { id: string; code: string; name: string } | null;
      decidedByUser?: { id: string; name: string; email: string } | null;
    },
    options?: { includeBulletinFile?: boolean },
  ) {
    return {
      id: request.id,
      groupId: this.getSelfRegistrationGroupId(request),
      attemptNumber:
        typeof request.attemptNumber === 'number'
          ? request.attemptNumber
          : Number(request.attemptNumber ?? 1),
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
      decisionNotes: request.decisionNotes ?? null,
      locality: request.om ?? null,
      requestedAsSubstitution: request.requestedAsSubstitution,
      bulletinNumber: request.bulletinNumber,
      bulletinFile: options?.includeBulletinFile
        ? this.serializeBulletinFile({
            fileName: request.bulletinFileName,
            storageKey: request.bulletinStorageKey,
            mimeType: request.bulletinMimeType,
            fileSize: request.bulletinFileSize,
            checksum: request.bulletinChecksum,
          })
        : null,
      decidedByUser: request.decidedByUser ?? null,
    };
  }

  private serializeSelfRegistrationHistory(
    requests: Array<{
      id: string;
      retryRootRequestId?: string | null;
      attemptNumber: number;
      status: CpcaPresidentRequestStatus;
      requestedAsSubstitution: boolean;
      bulletinNumber: string;
      bulletinFileName?: string | null;
      bulletinStorageKey?: string | null;
      bulletinMimeType?: string | null;
      bulletinFileSize?: number | null;
      bulletinChecksum?: string | null;
      createdAt: Date;
      decidedAt?: Date | null;
      decisionNotes?: string | null;
      om?: { id: string; code: string; name: string } | null;
      decidedByUser?: { id: string; name: string; email: string } | null;
    }>,
    options?: { includeBulletinFile?: boolean },
  ) {
    const sortedRequests = [...requests].sort((a, b) => {
      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) return createdAtDiff;
      return Number(a.attemptNumber ?? 1) - Number(b.attemptNumber ?? 1);
    });

    return sortedRequests.map((entry, index) =>
      this.serializeSelfRegistrationHistoryEntry(
        {
          ...entry,
          retryRootRequestId:
            index === 0
              ? null
              : (sortedRequests[0].retryRootRequestId ?? sortedRequests[0].id),
          attemptNumber: index + 1,
        },
        options,
      ),
    );
  }

  private async loadSelfRegistrationHistoryByGroupId(groupIdsRaw: string[]) {
    const groupIds = Array.from(
      new Set(
        (groupIdsRaw ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    const empty = new Map<
      string,
      Array<{
        id: string;
        retryRootRequestId: string | null;
        attemptNumber: number;
        status: CpcaPresidentRequestStatus;
        requestedAsSubstitution: boolean;
        bulletinNumber: string;
        bulletinFileName: string | null;
        bulletinStorageKey: string | null;
        bulletinMimeType: string | null;
        bulletinFileSize: number | null;
        bulletinChecksum: string | null;
        createdAt: Date;
        decidedAt: Date | null;
        decisionNotes: string | null;
        om: { id: string; code: string; name: string } | null;
        decidedByUser: { id: string; name: string; email: string } | null;
      }>
    >();
    if (groupIds.length === 0) {
      return empty;
    }

    const rows = await this.prisma.cpcaPresidentSelfRegistration.findMany({
      where: {
        OR: [
          { id: { in: groupIds } },
          { retryRootRequestId: { in: groupIds } },
        ],
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
        decidedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { attemptNumber: 'asc' }],
    });

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const groupId = this.getSelfRegistrationGroupId(row);
      const existing = grouped.get(groupId);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(groupId, [row]);
      }
    }

    return grouped;
  }

  private serializeApprovalSelfRegistration(
    request: {
      id: string;
      retryRootRequestId?: string | null;
      attemptNumber: number;
      status: CpcaPresidentRequestStatus;
      applicantIdentifier: string;
      applicantUid: string;
      applicantEmail?: string | null;
      applicantName: string;
      requestedAsSubstitution: boolean;
      bulletinNumber: string;
      bulletinFileName?: string | null;
      bulletinStorageKey?: string | null;
      bulletinMimeType?: string | null;
      bulletinFileSize?: number | null;
      bulletinChecksum?: string | null;
      createdAt: Date;
      decidedAt?: Date | null;
      decisionNotes?: string | null;
      om: { id: string; code: string; name: string } | null;
      applicantUser: {
        id: string;
        name: string;
        email: string;
        ldapUid?: string | null;
      };
      decidedByUser?: { id: string; name: string; email: string } | null;
    },
    history: Array<{
      id: string;
      retryRootRequestId?: string | null;
      attemptNumber: number;
      status: CpcaPresidentRequestStatus;
      requestedAsSubstitution: boolean;
      bulletinNumber: string;
      bulletinFileName?: string | null;
      bulletinStorageKey?: string | null;
      bulletinMimeType?: string | null;
      bulletinFileSize?: number | null;
      bulletinChecksum?: string | null;
      createdAt: Date;
      decidedAt?: Date | null;
      decisionNotes?: string | null;
      om?: { id: string; code: string; name: string } | null;
      decidedByUser?: { id: string; name: string; email: string } | null;
    }> = [],
  ) {
    return {
      id: request.id,
      type: 'SELF_REGISTRATION' as const,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
      decisionNotes: request.decisionNotes ?? null,
      attemptNumber: Number(request.attemptNumber ?? 1),
      attemptGroupId: this.getSelfRegistrationGroupId(request),
      history: this.serializeSelfRegistrationHistory(history, {
        includeBulletinFile: true,
      }),
      locality: request.om,
      applicant: {
        id: request.applicantUser.id,
        name: request.applicantName || request.applicantUser.name,
        email: request.applicantEmail ?? request.applicantUser.email,
        ldapUid: request.applicantUid || request.applicantUser.ldapUid,
      },
      applicantIdentifier: request.applicantIdentifier,
      applicantUid: request.applicantUid,
      requestedAsSubstitution: request.requestedAsSubstitution,
      bulletinNumber: request.bulletinNumber,
      bulletinFile: this.serializeBulletinFile({
        fileName: request.bulletinFileName,
        storageKey: request.bulletinStorageKey,
        mimeType: request.bulletinMimeType,
        fileSize: request.bulletinFileSize,
        checksum: request.bulletinChecksum,
      }),
      decidedByUser: request.decidedByUser ?? null,
    };
  }

  private extractSelfRegistrationBulletinFile(request: {
    bulletinFileName?: string | null;
    bulletinStorageKey?: string | null;
    bulletinMimeType?: string | null;
    bulletinFileSize?: number | null;
    bulletinChecksum?: string | null;
  }): StoredCpcaPresidentBulletinFile | null {
    const storageKey = String(request.bulletinStorageKey ?? '').trim();
    const mimeType = String(request.bulletinMimeType ?? '').trim();
    const fileName = String(request.bulletinFileName ?? '').trim();
    const fileSize =
      typeof request.bulletinFileSize === 'number'
        ? request.bulletinFileSize
        : Number(request.bulletinFileSize ?? 0);
    const checksum = String(request.bulletinChecksum ?? '').trim();
    if (!storageKey || !mimeType || !fileName || !checksum || fileSize <= 0) {
      return null;
    }
    return {
      fileName,
      storageKey,
      mimeType,
      fileSize,
      checksum,
    };
  }

  private serializeBulletinFile(input: {
    fileName?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
    checksum?: string | null;
  }) {
    const storageKey = String(input.storageKey ?? '').trim();
    const mimeType = String(input.mimeType ?? '').trim();
    const fileName = String(input.fileName ?? '').trim();
    const fileSize =
      typeof input.fileSize === 'number'
        ? input.fileSize
        : Number(input.fileSize ?? 0);
    const checksum = String(input.checksum ?? '').trim();
    if (!storageKey || !mimeType || !fileName || fileSize <= 0) {
      return null;
    }
    return {
      fileName,
      mimeType,
      fileSize,
      checksum: checksum || null,
      available: Boolean(resolveExistingCpcaPresidentBulletinPath(storageKey)),
    };
  }

  private serializeApprovalNomination(request: {
    id: string;
    status: CpcaPresidentRequestStatus;
    createdAt: Date;
    decidedAt?: Date | null;
    decisionNotes?: string | null;
    requestedAsSubstitution: boolean;
    bulletinNumber?: string | null;
    om: { id: string; code: string; name: string } | null;
    requestedByUser: { id: string; name: string; email: string };
    nomineeUser: {
      id: string;
      name: string;
      email: string;
      ldapUid?: string | null;
    };
    nomineeName: string;
    nomineeIdentifier: string;
    decidedByUser?: { id: string; name: string; email: string } | null;
  }) {
    const base = this.serializePresidentNominationRequest({
      ...request,
      requestedByUser: request.requestedByUser,
      nomineeUser: request.nomineeUser,
      om: request.om,
      decidedByUser: request.decidedByUser ?? null,
    });
    return base;
  }

  private async serializeApprovalCoverage(request: {
    id: string;
    status: CpcaPresidentRequestStatus;
    createdAt: Date;
    decidedAt?: Date | null;
    decisionNotes?: string | null;
    om: { id: string; code: string; name: string } | null;
    requestedByUser: { id: string; name: string; email: string };
    decidedByUser?: { id: string; name: string; email: string } | null;
    requestedManagedOmIds: string[];
  }) {
    return this.serializeCoverageRequest({
      ...request,
      om: request.om,
      requestedByUser: request.requestedByUser,
      decidedByUser: request.decidedByUser ?? null,
    });
  }

  private async resolveLocalityForPresidentNomination(
    user: RbacUser | undefined,
    requestedLocalityId?: string,
  ) {
    if (this.isApproverUser(user)) {
      throwError('RBAC_FORBIDDEN');
    }

    const requested = String(requestedLocalityId ?? '').trim();
    const userLocalityId = String(user?.omId ?? '').trim();
    if (!userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (requested && requested !== userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }

    const userId = this.requireUserId(user);
    const isPresident = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        omId: userLocalityId,
        userId,
      },
      select: { id: true },
    });
    if (!isPresident) {
      throwError('RBAC_FORBIDDEN');
    }

    return userLocalityId;
  }

  private async applyCoverageAssignment(
    localityId: string,
    managedLocalityIdsRaw: string[],
  ) {
    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
      },
    });
    if (!locality) {
      throwError('NOT_FOUND');
    }

    const managedLocalityIds = Array.from(
      new Set(
        (managedLocalityIdsRaw ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
          .filter((value) => value !== localityId),
      ),
    );

    if (!locality.hasCpca && managedLocalityIds.length > 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_NOT_ENABLED_FOR_LOCALITY',
      });
    }

    const managedLocalities = managedLocalityIds.length
      ? await this.prisma.om.findMany({
          where: {
            id: { in: managedLocalityIds },
          },
          select: {
            id: true,
            code: true,
            name: true,
            uf: true,
            hasCpca: true,
          },
        })
      : [];

    if (managedLocalities.length !== managedLocalityIds.length) {
      throwError('VALIDATION_ERROR', {
        field: 'managedLocalityIds',
        reason: 'LOCALITY_INVALID_ID',
      });
    }

    const localityWithOwnCpca = managedLocalities.find((item) => item.hasCpca);
    if (localityWithOwnCpca) {
      throwError('VALIDATION_ERROR', {
        field: 'managedLocalityIds',
        reason: 'CPCA_COVERAGE_TARGET_ALREADY_HAS_CPCA',
        localityId: localityWithOwnCpca.id,
        localityCode: localityWithOwnCpca.code,
        localityName: localityWithOwnCpca.name,
      });
    }

    const conflictingCoverage = managedLocalityIds.length
      ? await this.prisma.cpcaCommissionCoverageOm.findMany({
          where: {
            managedOmId: { in: managedLocalityIds },
            managerOmId: { not: localityId },
          },
          include: {
            managerOm: {
              select: { id: true, code: true, name: true },
            },
            managedOm: {
              select: { id: true, code: true, name: true },
            },
          },
        })
      : [];
    if (conflictingCoverage.length > 0) {
      const firstConflict = conflictingCoverage[0];
      throwError('VALIDATION_ERROR', {
        field: 'managedLocalityIds',
        reason: 'CPCA_COVERAGE_TARGET_ALREADY_ASSIGNED',
        managedLocalityId: firstConflict.managedOm.id,
        managedLocalityCode: firstConflict.managedOm.code,
        managedLocalityName: firstConflict.managedOm.name,
        managerLocalityId: firstConflict.managerOm.id,
        managerLocalityCode: firstConflict.managerOm.code,
        managerLocalityName: firstConflict.managerOm.name,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cpcaCommissionCoverageOm.deleteMany({
        where: { managerOmId: localityId },
      });
      if (managedLocalityIds.length > 0) {
        await tx.cpcaCommissionCoverageOm.createMany({
          data: managedLocalityIds.map((managedLocalityId) => ({
            managerOmId: localityId,
            managedOmId: managedLocalityId,
          })),
        });
      }
    });

    return this.listManagedLocalities(localityId);
  }

  private normalizeIdentifier(value: string) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('@')) {
      return raw.toLowerCase();
    }
    const digits = raw.replace(/\D/g, '');
    return digits || raw;
  }

  private normalizeUid(value: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', {
        reason: 'LDAP_UID_REQUIRED',
      });
    }
    return normalized;
  }

  private normalizeEmail(value: string | null | undefined) {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized || null;
  }

  private cleanRequiredText(
    value: string,
    options: { field: string; maxLength: number },
  ) {
    const cleaned = sanitizeText(String(value ?? '')).trim();
    if (!cleaned) {
      throwError('VALIDATION_ERROR', {
        field: options.field,
        reason: 'required',
      });
    }
    if (cleaned.length > options.maxLength) {
      throwError('VALIDATION_ERROR', {
        field: options.field,
        reason: 'maxLength',
        maxLength: options.maxLength,
      });
    }
    return cleaned;
  }

  private cleanOptionalText(
    value: string | null | undefined,
    options: { maxLength: number },
  ) {
    if (value === undefined || value === null) return null;
    const cleaned = sanitizeText(String(value ?? '')).trim();
    if (!cleaned) return null;
    if (cleaned.length > options.maxLength) {
      throwError('VALIDATION_ERROR', {
        reason: 'maxLength',
        maxLength: options.maxLength,
      });
    }
    return cleaned;
  }

  private async resolveUniqueEmail(
    preferredEmail: string,
    uid: string,
    excludeUserId?: string,
  ) {
    const base = this.normalizeEmail(preferredEmail) ?? `${uid}@fab.intraer`;
    const alreadyExists = async (email: string) => {
      const existing = await this.prisma.user.findFirst({
        where: {
          email,
          ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        },
        select: { id: true },
      });
      return Boolean(existing);
    };

    if (!(await alreadyExists(base))) {
      return base;
    }

    const fallbackBase = `${uid}@fab.intraer`;
    if (!(await alreadyExists(fallbackBase))) {
      return fallbackBase;
    }

    let attempt = 1;
    while (attempt <= 1000) {
      const candidate = `${uid}+${attempt}@fab.intraer`;
      if (!(await alreadyExists(candidate))) {
        return candidate;
      }
      attempt += 1;
    }

    throwError('CONFLICT_UNIQUE', { field: 'email', uid });
  }

  private async createTemporaryPasswordHash(uid: string) {
    const raw = `ldap:${uid}:${Date.now()}:${randomBytes(12).toString('hex')}`;
    return bcrypt.hash(raw, 10);
  }

  private requireCommissionOmId(
    omId: string | null | undefined,
    reason: string,
  ) {
    const normalized = String(omId ?? '').trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { reason });
    }
    return normalized;
  }
}
