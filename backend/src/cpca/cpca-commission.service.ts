import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { CpcaPresidentRequestStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
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
    const items = await this.prisma.locality.findMany({
      where: {
        hasCpca: true,
        catalogType: 'SMIF',
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
      localityId: string;
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

    const localityId = String(payload.localityId ?? '').trim();
    if (!localityId) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'required',
      });
    }
    const bulletinNumber = this.cleanRequiredText(payload.bulletinNumber, {
      field: 'bulletinNumber',
      maxLength: 220,
    });

    const locality = await this.assertLocalitySupportsCpca(localityId);
    const ldapProfile = await this.resolveLdapProfile(identifier);
    const ldapLocality = await this.resolveSmifLocalityFromFabOm(
      ldapProfile.fabom,
    );
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
    if (ldapLocality.id !== locality.id) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_SELF_REGISTRATION_LOCALITY_MISMATCH',
        selectedLocalityId: locality.id,
        selectedLocalityCode: locality.code,
        selectedLocalityName: locality.name,
        ldapLocalityId: ldapLocality.id,
        ldapLocalityCode: ldapLocality.code,
        ldapLocalityName: ldapLocality.name,
      });
    }

    const user = await this.upsertLdapBackedUser(ldapProfile, ldapLocality.id);

    const pendingExisting =
      await this.prisma.cpcaPresidentSelfRegistration.findFirst({
        where: {
          localityId,
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
        localityId,
        applicantUserId: user.id,
        applicantIdentifier: identifier,
        applicantUid: ldapProfile.uid,
        applicantEmail: ldapProfile.email,
        applicantName: ldapProfile.name?.trim() || user.name,
        requestedAsSubstitution: Boolean(payload.isSubstitution),
        bulletinNumber,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      resource: 'cpca_cases',
      action: 'cpca_president_self_registration_create',
      entityId: created.id,
      localityId,
      diffJson: {
        localityCode: locality.code,
        localityName: locality.name,
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
        locality: created.locality,
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
    const locality = await this.resolveSmifLocalityFromFabOm(profile.fabom);

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
        const firstLocality = await this.prisma.locality.findFirst({
          where: { hasCpca: true, catalogType: 'SMIF' },
          select: { id: true },
          orderBy: { name: 'asc' },
        });
        localityId = String(firstLocality?.id ?? '');
      }
    } else {
      localityId = String(user?.localityId ?? '').trim();
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
        canManageMembers: false,
        userIsPresident: false,
      };
    }

    const locality = await this.assertLocalitySupportsCpca(localityId);
    const [currentPresident, members] = await Promise.all([
      this.prisma.cpcaCommissionPresident.findUnique({
        where: { localityId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              ldapUid: true,
              localityId: true,
            },
          },
          assignedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.cpcaCommissionMember.findMany({
        where: { localityId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              ldapUid: true,
              localityId: true,
            },
          },
          addedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { user: { name: 'asc' } },
      }),
    ]);

    const userIsPresident =
      Boolean(currentPresident) && currentPresident?.userId === userId;

    return {
      locality,
      currentPresident: currentPresident
        ? {
            id: currentPresident.id,
            designationBulletin: currentPresident.designationBulletin,
            isSubstitution: currentPresident.isSubstitution,
            assignedAt: currentPresident.assignedAt,
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
      canAssignPresident: isApprover,
      canManageMembers: isApprover || userIsPresident,
      userIsPresident,
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
    const targetUser = await this.upsertLdapBackedUser(ldapProfile, localityId);

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
          locality: { select: { id: true, code: true, name: true } },
          applicantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              ldapUid: true,
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
        locality: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
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

    const assignment = await this.assignPresidentToLocality({
      localityId: request.localityId,
      targetUserId: request.applicantUserId,
      actorUserId,
      isSubstitution: Boolean(request.requestedAsSubstitution),
      proceedWithExistingPresident: Boolean(
        payload.proceedWithExistingPresident,
      ),
      designationBulletin: request.bulletinNumber,
      requestId: request.id,
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
        locality: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
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
        locality: { select: { id: true, code: true, name: true } },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
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
      resource: 'cpca_cases',
      action: 'cpca_president_request_reject',
      entityId: rejected.id,
      localityId: rejected.localityId,
      diffJson: {
        decisionNotes: rejected.decisionNotes,
      },
    });

    return { request: rejected };
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
    const memberUser = await this.upsertLdapBackedUser(profile, localityId);

    const isPresident = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        localityId,
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
        localityId_userId: {
          localityId,
          userId: memberUser.id,
        },
      },
      update: {
        addedByUserId: actorUserId,
      },
      create: {
        localityId,
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
      resource: 'cpca_cases',
      action: 'cpca_commission_member_add',
      entityId: created.id,
      localityId,
      diffJson: {
        memberUserId: memberUser.id,
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
            localityId: true,
          },
        },
      },
    });

    if (!member) {
      throwError('NOT_FOUND');
    }

    await this.assertCanManageMembers(user, member.localityId);

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
      resource: 'cpca_cases',
      action: 'cpca_commission_member_remove',
      entityId: member.id,
      localityId: member.localityId,
      diffJson: {
        memberUserId: member.userId,
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
  }) {
    const locality = await this.assertLocalitySupportsCpca(input.localityId);

    const existing = await this.prisma.cpcaCommissionPresident.findUnique({
      where: { localityId: input.localityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            ldapUid: true,
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
          localityId: input.localityId,
          userId: existing.userId,
        },
      });
    }

    await this.grantCpcaRole(input.targetUserId, input.localityId);

    const assigned = await this.prisma.cpcaCommissionPresident.upsert({
      where: { localityId: input.localityId },
      update: {
        userId: input.targetUserId,
        assignedByUserId: input.actorUserId,
        designationBulletin: input.designationBulletin,
        isSubstitution: Boolean(input.isSubstitution),
        assignedAt: new Date(),
      },
      create: {
        localityId: input.localityId,
        userId: input.targetUserId,
        assignedByUserId: input.actorUserId,
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
        localityId: input.localityId,
        userId: input.targetUserId,
      },
    });

    await this.audit.log({
      userId: input.actorUserId,
      resource: 'cpca_cases',
      action: 'cpca_commission_president_assign',
      entityId: assigned.id,
      localityId: input.localityId,
      diffJson: {
        requestId: input.requestId,
        replacedUserId:
          existing && existing.userId !== input.targetUserId
            ? existing.userId
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

    const userLocalityId = String(user?.localityId ?? '').trim();
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
    await this.assertLocalitySupportsCpca(localityId);

    if (this.isApproverUser(user)) {
      return;
    }

    const userId = this.requireUserId(user);
    const isPresident = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        localityId,
        userId,
      },
      select: { id: true },
    });

    if (!isPresident) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async assertLocalitySupportsCpca(localityId: string) {
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        hasCpca: true,
        catalogType: true,
      },
    });

    if (!locality || locality.catalogType !== 'SMIF') {
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

  private async resolveSmifLocalityFromFabOm(fabom: string | null | undefined) {
    const normalizedFabom = this.normalizeFabOm(fabom);
    if (!normalizedFabom) return null;

    const candidates = new Set<string>([normalizedFabom]);

    for (const token of normalizedFabom.split(/[/|;,]+/)) {
      const trimmed = token.trim();
      if (trimmed) candidates.add(trimmed);
    }

    if (normalizedFabom.includes('-')) {
      const parts = normalizedFabom
        .split('-')
        .map((part) => part.trim())
        .filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart) candidates.add(lastPart);
      for (const part of parts) candidates.add(part);
    }

    const localityRows = await this.prisma.locality.findMany({
      where: { catalogType: 'SMIF' },
      select: { id: true, code: true, name: true, hasCpca: true },
    });

    const normalize = (value: string) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    for (const candidate of candidates) {
      const direct = localityRows.find(
        (row) => normalize(row.code) === normalize(candidate),
      );
      if (direct) return direct;
    }

    for (const candidate of candidates) {
      const byName = localityRows.find(
        (row) => normalize(row.name) === normalize(candidate),
      );
      if (byName) return byName;
    }

    for (const candidate of candidates) {
      const bySuffix = localityRows.find((row) => {
        const rowCode = normalize(row.code);
        const c = normalize(candidate);
        return rowCode.endsWith(`-${c}`) || c.endsWith(`-${rowCode}`);
      });
      if (bySuffix) return bySuffix;
    }

    return null;
  }

  private async upsertLdapBackedUser(
    profile: FabLdapProfile,
    localityId: string | null,
  ) {
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
          localityId: localityId !== null ? localityId : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          ldapUid: true,
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
        localityId,
        passwordHash: await this.createTemporaryPasswordHash(uid),
      },
      select: {
        id: true,
        name: true,
        email: true,
        ldapUid: true,
        localityId: true,
      },
    });
  }

  private async grantCpcaRole(userId: string, localityId: string) {
    const cpcaRoleId = await this.resolveCpcaRoleId();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        localityId,
        isActive: true,
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
}
