import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  CpcaCommissionPresidentAssignmentSource,
  CpcaPresidentRequestStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { resolveBestOmByFabOm } from '../catalog/om-resolver';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { FabLdapProfile, FabLdapService } from '../ldap/fab-ldap.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeRoleName,
  ROLE_COMANDANTE_COMGEP,
  ROLE_CPCA,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';

const ROLE_NAMES_ALLOWED_TO_APPROVE = new Set([
  normalizeRoleName(ROLE_TI),
  normalizeRoleName(ROLE_COMANDANTE_COMGEP),
]);
const CPCA_APPROVAL_REQUEST_TYPES = [
  'SELF_REGISTRATION',
  'PRESIDENT_NOMINATION',
  'COVERAGE',
] as const;
type CpcaApprovalRequestType = (typeof CPCA_APPROVAL_REQUEST_TYPES)[number];
const MILITARY_RANK_PREFIX =
  /^(ALUNO|SD|CB|3S|2S|1S|SO|ASP|CP|CL|MB|TB|2T|1T|CAP|MAJ|TCEL|TEN CEL|CEL|BRIG|BRIGADEIRO|GEN)\b/i;

@Injectable()
export class CpcaCommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
  ) {}

  async listSelfRegistrationLocalities() {
    const items = await this.prisma.om.findMany({
      where: {
        hasCpca: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return { items };
  }

  async createSelfRegistration(
    payload: {
      identifier: string;
      localityId?: string;
      isSubstitution: boolean;
      bulletinNumber: string;
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

    const ldapProfile = await this.resolveLdapProfile(identifier);
    const ldapLocality = await this.resolveOmFromFabOm(ldapProfile.fabom);
    if (!ldapLocality) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_SELF_REGISTRATION_LDAP_LOCALITY_NOT_FOUND',
      });
    }
    if (!ldapLocality.hasCpca) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_SELF_REGISTRATION_LDAP_LOCALITY_WITHOUT_CPCA',
      });
    }
    const requestedLocalityId = String(payload.localityId ?? '').trim();
    if (requestedLocalityId && ldapLocality.id !== requestedLocalityId) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_SELF_REGISTRATION_LOCALITY_MISMATCH',
        selectedLocalityId: requestedLocalityId,
        ldapLocalityId: ldapLocality.id,
        ldapLocalityCode: ldapLocality.code,
        ldapLocalityName: ldapLocality.name,
      });
    }
    const locality = await this.assertOmSupportsCpca(ldapLocality.id);

    const user = await this.upsertLdapBackedUser(ldapProfile, ldapLocality.id);

    const pendingExisting =
      await this.prisma.cpcaPresidentSelfRegistration.findFirst({
        where: {
          omId: locality.id,
          applicantUserId: user.id,
          status: 'PENDING',
        },
        select: { id: true },
      });
    if (pendingExisting) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_PRESIDENT_REQUEST_ALREADY_PENDING',
      });
    }

    const created = await this.prisma.cpcaPresidentSelfRegistration.create({
      data: {
        omId: locality.id,
        applicantUserId: user.id,
        applicantIdentifier: identifier,
        applicantUid: ldapProfile.uid,
        applicantEmail: ldapProfile.email,
        applicantName: ldapProfile.name?.trim() || user.name,
        requestedAsSubstitution: Boolean(payload.isSubstitution),
        bulletinNumber,
      },
      include: {
        om: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      localityId: locality.id,
      resource: 'cpca_cases',
      action: 'cpca_president_self_registration_create',
      entityId: created.id,
      diffJson: {
        omId: locality.id,
        omCode: locality.code,
        omName: locality.name,
        applicantName: created.applicantName,
        requestedAsSubstitution: Boolean(payload.isSubstitution),
        bulletinNumber,
        ip: ip || null,
      },
    });

    return {
      request: {
        id: created.id,
        status: created.status,
        createdAt: created.createdAt,
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
        localityId,
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
      localityId,
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
        decisionNotes: this.cleanOptionalText(payload.notes, {
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

    await this.audit.log({
      userId: actorUserId,
      localityId: rejected.omId ?? null,
      resource: 'cpca_cases',
      action: 'cpca_president_request_reject',
      entityId: rejected.id,
      diffJson: {
        omId: rejected.omId,
        applicantUserId: rejected.applicantUserId,
        decisionNotes: rejected.decisionNotes,
      },
    });

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
      localityId,
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
    this.assertApproverUser(user);
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

    const items = [
      ...selfRegistrations.map((item) =>
        this.serializeApprovalSelfRegistration(item),
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
    };
  }

  async pendingApprovalRequestsCount(user: RbacUser | undefined) {
    if (!this.isApproverUser(user)) {
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
      localityId: requestOmId,
      resource: 'cpca_cases',
      action: 'cpca_president_nomination_request_approve',
      entityId: approved.id,
      diffJson: {
        omId: requestOmId,
        nomineeUserId: approved.nomineeUserId,
      },
    });

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
      localityId: rejected.omId ?? null,
      resource: 'cpca_cases',
      action: 'cpca_president_nomination_request_reject',
      entityId: rejected.id,
      diffJson: {
        omId: rejected.omId,
        decisionNotes: rejected.decisionNotes,
      },
    });

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
      localityId: requestOmId,
      resource: 'cpca_cases',
      action: 'cpca_commission_coverage_request_approve',
      entityId: approved.id,
      diffJson: {
        omId: requestOmId,
        managedLocalityIds: request.requestedManagedOmIds,
      },
    });

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
      localityId: rejected.omId ?? null,
      resource: 'cpca_cases',
      action: 'cpca_commission_coverage_request_reject',
      entityId: rejected.id,
      diffJson: {
        omId: rejected.omId,
        decisionNotes: rejected.decisionNotes,
      },
    });

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
      },
    });

    await this.audit.log({
      userId: actorUserId,
      localityId,
      resource: 'cpca_cases',
      action: 'cpca_commission_member_add',
      entityId: created.id,
      diffJson: {
        omId: localityId,
        memberUserId: memberUser.id,
        memberUserName: memberUser.name,
      },
    });

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
      localityId: memberOmId,
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

  private async assignPresidentToLocality(input: {
    localityId: string;
    targetUserId: string;
    actorUserId: string;
    isSubstitution: boolean;
    proceedWithExistingPresident: boolean;
    designationBulletin: string | null;
    requestId: string | null;
    assignmentSource: CpcaCommissionPresidentAssignmentSource;
  }) {
    const locality = await this.assertOmSupportsCpca(input.localityId);

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

    const assigned = await this.prisma.cpcaCommissionPresident.upsert({
      where: { omId: input.localityId },
      update: {
        userId: input.targetUserId,
        assignedByUserId: input.actorUserId,
        assignmentSource: input.assignmentSource,
        designationBulletin: input.designationBulletin,
        isSubstitution: Boolean(input.isSubstitution),
        assignedAt: new Date(),
      },
      create: {
        omId: input.localityId,
        userId: input.targetUserId,
        assignedByUserId: input.actorUserId,
        assignmentSource: input.assignmentSource,
        designationBulletin: input.designationBulletin,
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

    await this.prisma.cpcaCommissionMember.deleteMany({
      where: {
        omId: input.localityId,
        userId: input.targetUserId,
      },
    });

    await this.audit.log({
      userId: input.actorUserId,
      localityId: input.localityId,
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
    const normalizedRoleNames = new Set(
      [...(user?.roles ?? []), ...(user?.allRoles ?? [])].map((role) =>
        normalizeRoleName(role.name),
      ),
    );

    for (const roleName of ROLE_NAMES_ALLOWED_TO_APPROVE) {
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

  private serializeApprovalSelfRegistration(request: {
    id: string;
    status: CpcaPresidentRequestStatus;
    applicantIdentifier: string;
    applicantUid: string;
    applicantEmail?: string | null;
    applicantName: string;
    requestedAsSubstitution: boolean;
    bulletinNumber: string;
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
  }) {
    return {
      id: request.id,
      type: 'SELF_REGISTRATION' as const,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
      decisionNotes: request.decisionNotes ?? null,
      locality: request.om,
      applicant: {
        id: request.applicantUser.id,
        name: request.applicantName || request.applicantUser.name,
        email: request.applicantEmail ?? request.applicantUser.email,
        ldapUid: request.applicantUid || request.applicantUser.ldapUid,
      },
      requestedAsSubstitution: request.requestedAsSubstitution,
      bulletinNumber: request.bulletinNumber,
      decidedByUser: request.decidedByUser ?? null,
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
