import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  LocalityCatalogType,
  PermissionScope,
  Prisma,
  RecruitFemaleStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import {
  hasPermission,
  ROLE_GSD_LOCALIDADE,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText } from '../common/sanitize';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateCipavdLocalityDto } from './dto/create-cipavd-locality.dto';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { SetLocalityCommanderFromLdapDto } from './dto/set-locality-commander-from-ldap.dto';
import { UpdateLocalityRecruitDesignationsDto } from './dto/update-locality-recruit-designations.dto';
import { UpdateCipavdLocalityDto } from './dto/update-cipavd-locality.dto';
import { ReplaceLocalityRecruitsMembersDto } from './dto/replace-locality-recruits-members.dto';
import { UpdateLocalityRecruitsDto } from './dto/update-locality-recruits.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';

@Controller('localities')
@UseGuards(JwtAuthGuard, RbacGuard)
export class LocalitiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fabLdap: FabLdapService,
    private readonly rbac: RbacService,
  ) {}

  @Get()
  @RequirePermission('localities', 'view')
  async list(@CurrentUser() user: RbacUser) {
    const canViewAll = hasPermission(
      user,
      'localities',
      'view',
      PermissionScope.NATIONAL,
    );
    const where: Prisma.LocalityWhereInput = {
      catalogType: LocalityCatalogType.SMIF,
    };
    if (!canViewAll && user?.localityId) {
      where.id = user.localityId;
    }
    const items = await this.prisma.locality.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  @Get('oms-catalog')
  @RequirePermission('localities', 'view')
  async listOmsCatalog() {
    const items = await this.prisma.locality.findMany({
      where: { catalogType: LocalityCatalogType.SMIF },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  @Get('cipavd')
  @RequirePermission('localities_cipavd', 'view')
  async listCipavdLocalities() {
    const items = await this.prisma.locality.findMany({
      where: { catalogType: LocalityCatalogType.CIPAVD },
      select: { id: true, code: true, name: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  @Get('cipavd-catalog')
  @RequirePermission('task_instances', 'view')
  async listCipavdCatalog() {
    const items = await this.prisma.locality.findMany({
      where: { catalogType: LocalityCatalogType.CIPAVD },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  @Post('cipavd')
  @RequirePermission('localities_cipavd', 'create')
  async createCipavdLocality(@Body() dto: CreateCipavdLocalityDto) {
    return this.prisma.locality.create({
      data: {
        code: sanitizeText(dto.code).toUpperCase(),
        name: sanitizeText(dto.name),
        catalogType: LocalityCatalogType.CIPAVD,
      },
      select: { id: true, code: true, name: true, createdAt: true },
    });
  }

  @Put('cipavd/:id')
  @RequirePermission('localities_cipavd', 'update')
  async updateCipavdLocality(
    @Param('id') id: string,
    @Body() dto: UpdateCipavdLocalityDto,
  ) {
    const existing = await this.prisma.locality.findFirst({
      where: { id, catalogType: LocalityCatalogType.CIPAVD },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');

    return this.prisma.locality.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code).toUpperCase() : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
      },
      select: { id: true, code: true, name: true, createdAt: true },
    });
  }

  @Delete('cipavd/:id')
  @RequirePermission('localities_cipavd', 'delete')
  async removeCipavdLocality(@Param('id') id: string) {
    const existing = await this.prisma.locality.findFirst({
      where: { id, catalogType: LocalityCatalogType.CIPAVD },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');
    await this.prisma.locality.delete({ where: { id } });
    return { ok: true };
  }

  @Post()
  @RequirePermission('localities', 'create')
  async create(@Body() dto: CreateLocalityDto) {
    const created = await this.prisma.locality.create({
      data: {
        code: sanitizeText(dto.code),
        name: sanitizeText(dto.name),
        catalogType: LocalityCatalogType.SMIF,
        commandName: dto.commandName ? sanitizeText(dto.commandName) : null,
        commanderName: dto.commanderName
          ? sanitizeText(dto.commanderName)
          : null,
        individualMeetingDate: dto.individualMeetingDate
          ? new Date(dto.individualMeetingDate)
          : null,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? null,
        notes: dto.notes ? sanitizeText(dto.notes) : null,
      },
    });
    if (dto.recruitsFemaleCountCurrent && dto.recruitsFemaleCountCurrent > 0) {
      await this.createInitialRecruits(
        created.id,
        dto.recruitsFemaleCountCurrent,
      );
      await this.syncLocalityRecruitCount(created.id);
    }
    return created;
  }

  @Put(':id')
  @RequirePermission('localities', 'update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocalityDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertLocalityAccess(id, user);
    this.assertRecruitsMutationAccess(id, user, dto.recruitsFemaleCountCurrent);
    if (
      dto.recruitsFemaleCountCurrent !== undefined &&
      dto.recruitsFemaleCountCurrent !== null
    ) {
      await this.assertRecruitAssignmentsWithinTotal(
        id,
        dto.recruitsFemaleCountCurrent,
      );
    }
    const currentLocality = await this.prisma.locality.findUnique({
      where: { id },
      select: { recruitsFemaleCountCurrent: true, catalogType: true },
    });
    if (!currentLocality) throwError('NOT_FOUND');
    if (currentLocality.catalogType !== LocalityCatalogType.SMIF) {
      throwError('NOT_FOUND');
    }

    const updated = await this.prisma.locality.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code) : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
        commandName: dto.commandName
          ? sanitizeText(dto.commandName)
          : dto.commandName === null
            ? null
            : undefined,
        commanderName: dto.commanderName
          ? sanitizeText(dto.commanderName)
          : dto.commanderName === null
            ? null
            : undefined,
        individualMeetingDate: dto.individualMeetingDate
          ? new Date(dto.individualMeetingDate)
          : dto.individualMeetingDate === null
            ? null
            : undefined,
        visitDate: dto.visitDate
          ? new Date(dto.visitDate)
          : dto.visitDate === null
            ? null
            : undefined,
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? undefined,
        notes: dto.notes
          ? sanitizeText(dto.notes)
          : dto.notes === null
            ? null
            : undefined,
      },
    });
    if (
      dto.recruitsFemaleCountCurrent !== undefined &&
      dto.recruitsFemaleCountCurrent !== null
    ) {
      const currentActiveCount = await this.prisma.recruitFemale.count({
        where: {
          localityId: id,
          status: {
            in: [
              RecruitFemaleStatus.RECRUITMENT_TO_START,
              RecruitFemaleStatus.RECRUITMENT_STARTED,
            ],
          },
        },
      });
      const targetCount = dto.recruitsFemaleCountCurrent;
      if (targetCount > currentActiveCount) {
        await this.createInitialRecruits(id, targetCount - currentActiveCount);
      }
      await this.syncLocalityRecruitCount(id);
      await this.registerRecruitsHistory(
        id,
        dto.recruitsFemaleCountCurrent,
        currentLocality.recruitsFemaleCountCurrent ?? 0,
        null,
      );
    }
    return updated;
  }

  @Put(':id/recruits')
  @RequirePermission('localities', 'update')
  async updateRecruits(
    @Param('id') id: string,
    @Body() dto: UpdateLocalityRecruitsDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsMutationAccess(id, user, dto.recruitsFemaleCountCurrent);
    await this.assertRecruitAssignmentsWithinTotal(
      id,
      dto.recruitsFemaleCountCurrent,
    );
    const currentLocality = await this.prisma.locality.findUnique({
      where: { id },
      select: { recruitsFemaleCountCurrent: true },
    });
    if (!currentLocality) throwError('NOT_FOUND');
    const previousCount = currentLocality.recruitsFemaleCountCurrent ?? 0;

    const currentActiveCount = await this.prisma.recruitFemale.count({
      where: {
        localityId: id,
        status: {
          in: [
            RecruitFemaleStatus.RECRUITMENT_TO_START,
            RecruitFemaleStatus.RECRUITMENT_STARTED,
          ],
        },
      },
    });
    const targetCount = dto.recruitsFemaleCountCurrent;

    if (targetCount > currentActiveCount) {
      await this.createInitialRecruits(id, targetCount - currentActiveCount);
    } else if (targetCount < currentActiveCount) {
      const toRemove = currentActiveCount - targetCount;
      const activeRecruits = await this.prisma.recruitFemale.findMany({
        where: {
          localityId: id,
          status: {
            in: [
              RecruitFemaleStatus.RECRUITMENT_TO_START,
              RecruitFemaleStatus.RECRUITMENT_STARTED,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
        take: toRemove,
      });
      if (activeRecruits.length > 0) {
        const dismissalReason = dto.dismissalReason
          ? sanitizeText(dto.dismissalReason).trim()
          : null;
        if (!dismissalReason) {
          throwError('VALIDATION_ERROR', {
            field: 'dismissalReason',
            reason: 'DISMISSAL_REASON_REQUIRED',
          });
        }
        const now = new Date();
        await this.prisma.recruitFemale.updateMany({
          where: {
            id: { in: activeRecruits.map((r) => r.id) },
          },
          data: {
            status: RecruitFemaleStatus.DISMISSED,
            dismissalReason,
            dismissedAt: now,
            destinationLocalityId: null,
            designatedAt: null,
          },
        });
      }
    }

    await this.syncLocalityRecruitCount(id);
    const updated = await this.prisma.locality.findUnique({
      where: { id },
      select: { recruitsFemaleCountCurrent: true },
    });

    await this.registerRecruitsHistory(
      id,
      updated?.recruitsFemaleCountCurrent ?? targetCount,
      previousCount,
      dto.dismissalReason ?? null,
      true,
    );

    return updated ?? { id, recruitsFemaleCountCurrent: targetCount };
  }

  @Get(':id/recruit-designations')
  @RequirePermission('localities', 'view')
  async listRecruitDesignations(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsEditorAccess(id, user);
    return this.buildRecruitDesignationsResponse(id);
  }

  @Get(':id/recruits-members')
  @RequirePermission('localities', 'view')
  async listRecruitMembers(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsEditorAccess(id, user);
    return this.buildRecruitMembersResponse(id);
  }

  @Put(':id/recruits-members')
  @RequirePermission('localities', 'update')
  async replaceRecruitMembers(
    @Param('id') id: string,
    @Body() dto: ReplaceLocalityRecruitsMembersDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsEditorAccess(id, user);
    const sourceLocality = await this.prisma.locality.findUnique({
      where: { id },
      select: { id: true, recruitsFemaleCountCurrent: true },
    });
    if (!sourceLocality) throwError('NOT_FOUND');

    const previousCount = sourceLocality.recruitsFemaleCountCurrent ?? 0;
    const incoming = dto.items ?? [];
    const incomingIds = incoming
      .map((item) => String(item.id ?? '').trim())
      .filter(Boolean);
    const existingMembers = await this.prisma.recruitFemale.findMany({
      where: { localityId: id },
      select: {
        id: true,
        status: true,
        dismissedAt: true,
        designatedAt: true,
      },
    });
    const existingById = new Map(
      existingMembers.map((item) => [item.id, item]),
    );
    const hasUnknownId = incomingIds.some(
      (memberId) => !existingById.has(memberId),
    );
    if (hasUnknownId) {
      throwError('VALIDATION_ERROR', {
        field: 'items',
        reason: 'RECRUIT_MEMBER_INVALID_ID',
      });
    }

    const destinationIds = Array.from(
      new Set(
        incoming
          .map((item) => String(item.destinationLocalityId ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (destinationIds.length > 0) {
      const destinations = await this.prisma.locality.findMany({
        where: {
          id: { in: destinationIds },
          catalogType: LocalityCatalogType.SMIF,
        },
        select: { id: true },
      });
      if (destinations.length !== destinationIds.length) {
        throwError('VALIDATION_ERROR', {
          field: 'items',
          reason: 'RECRUIT_MEMBER_INVALID_DESTINATION',
        });
      }
    }

    const now = new Date();
    const dismissedReasons: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const item of incoming) {
        const memberId = String(item.id ?? '').trim();
        const existing = memberId ? existingById.get(memberId) : null;
        const name = sanitizeText(String(item.name ?? '').trim());
        if (!name) {
          throwError('VALIDATION_ERROR', {
            field: 'items.name',
            reason: 'required',
          });
        }

        const nextStatus = item.status as RecruitFemaleStatus;
        const dismissalReasonRaw = sanitizeText(
          String(item.dismissalReason ?? '').trim(),
        );
        const dismissalReason = dismissalReasonRaw || null;
        const destinationLocalityId =
          sanitizeText(String(item.destinationLocalityId ?? '').trim()) || null;
        const commentRaw = sanitizeText(String(item.comment ?? '').trim());
        const comment = commentRaw || null;

        if (nextStatus === RecruitFemaleStatus.DISMISSED && !dismissalReason) {
          throwError('VALIDATION_ERROR', {
            field: 'items.dismissalReason',
            reason: 'DISMISSAL_REASON_REQUIRED',
          });
        }
        if (
          nextStatus === RecruitFemaleStatus.ASSIGNED_TO_OM &&
          !destinationLocalityId
        ) {
          throwError('VALIDATION_ERROR', {
            field: 'items.destinationLocalityId',
            reason: 'DESTINATION_REQUIRED',
          });
        }

        const isDismissTransition =
          nextStatus === RecruitFemaleStatus.DISMISSED &&
          existing?.status !== RecruitFemaleStatus.DISMISSED;
        if (isDismissTransition && dismissalReason) {
          dismissedReasons.push(dismissalReason);
        }

        const payload: Prisma.RecruitFemaleUncheckedCreateInput & {
          comment?: string | null;
        } = {
          id: memberId || `rf_${randomUUID().replace(/-/g, '')}`,
          localityId: id,
          name,
          status: nextStatus,
          dismissalReason:
            nextStatus === RecruitFemaleStatus.DISMISSED
              ? dismissalReason
              : null,
          dismissedAt:
            nextStatus === RecruitFemaleStatus.DISMISSED
              ? (existing?.dismissedAt ?? now)
              : null,
          destinationLocalityId:
            nextStatus === RecruitFemaleStatus.ASSIGNED_TO_OM
              ? destinationLocalityId
              : null,
          designatedAt:
            nextStatus === RecruitFemaleStatus.ASSIGNED_TO_OM
              ? (existing?.designatedAt ?? now)
              : null,
          comment,
          createdAt: now,
          updatedAt: now,
        };

        await tx.recruitFemale.upsert({
          where: { id: payload.id },
          create: payload as any,
          update: {
            name: payload.name,
            status: payload.status,
            dismissalReason: payload.dismissalReason,
            dismissedAt: payload.dismissedAt,
            destinationLocalityId: payload.destinationLocalityId,
            designatedAt: payload.designatedAt,
            comment: payload.comment,
          } as any,
        });
      }
    });

    await this.syncLocalityRecruitCount(id);
    const localityAfter = await this.prisma.locality.findUnique({
      where: { id },
      select: { recruitsFemaleCountCurrent: true },
    });
    const nextCount = localityAfter?.recruitsFemaleCountCurrent ?? 0;
    if (nextCount !== previousCount) {
      await this.registerRecruitsHistory(
        id,
        nextCount,
        previousCount,
        dismissedReasons.length ? dismissedReasons.join('; ') : null,
        false,
      );
    }

    return this.buildRecruitMembersResponse(id);
  }

  @Put(':id/commander-from-ldap')
  @RequirePermission('localities', 'update')
  async setCommanderFromLdap(
    @Param('id') id: string,
    @Body() dto: SetLocalityCommanderFromLdapDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsEditorAccess(id, user);
    const locality = await this.prisma.locality.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!locality) throwError('NOT_FOUND');

    // Buscar perfil no LDAP por UID ou email
    const identifier = String(dto.uidOrEmail ?? '').trim();
    if (!identifier) {
      throwError('VALIDATION_ERROR', {
        field: 'uidOrEmail',
        reason: 'LDAP_IDENTIFIER_REQUIRED',
      });
    }

    const profile = identifier.includes('@')
      ? await this.fabLdap.lookupByEmail(identifier)
      : await this.fabLdap.lookupByUid(identifier);

    if (!profile) {
      throwError('VALIDATION_ERROR', {
        field: 'uidOrEmail',
        reason: 'LDAP_USER_NOT_FOUND',
      });
    }

    const commanderName = sanitizeText(profile.name ?? '');
    if (!commanderName) {
      throwError('VALIDATION_ERROR', {
        field: 'uidOrEmail',
        reason: 'LDAP_USER_NAME_NOT_FOUND',
      });
    }

    // Buscar role GSD Localidade
    const gsdRole = await this.prisma.role.findFirst({
      where: { name: ROLE_GSD_LOCALIDADE },
      select: { id: true },
    });
    if (!gsdRole) {
      throwError('VALIDATION_ERROR', {
        reason: 'GSD_ROLE_NOT_FOUND',
      });
    }

    // Verificar se usuário já existe (uid sempre, email quando disponível).
    const userWhereOr: Array<{ ldapUid?: string; email?: string }> = [
      { ldapUid: profile.uid },
    ];
    if (profile.email) {
      userWhereOr.push({ email: profile.email });
    }
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: userWhereOr },
      select: { id: true, localityId: true },
    });

    // Se usuário existe, verificar se já tem role GSD e adicionar se necessário
    if (existingUser) {
      const hasGsdRole = await this.prisma.userRole.findFirst({
        where: { userId: existingUser.id, roleId: gsdRole.id },
        select: { userId: true },
      });
      if (!hasGsdRole) {
        await this.prisma.userRole.create({
          data: { userId: existingUser.id, roleId: gsdRole.id },
        });
      }
      // Atualizar localidade do usuário se necessário
      if (existingUser.localityId !== id) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { localityId: id },
        });
      }
    } else {
      // Criar novo usuário com role GSD para esta localidade
      await this.rbac.upsertLdapUser(
        {
          uid: profile.uid,
          roleIds: [gsdRole.id],
          localityId: id,
          replaceExistingRoles: false,
        },
        user.id,
      );
    }

    // Atualizar commanderName na localidade
    const updated = await this.prisma.locality.update({
      where: { id },
      data: { commanderName },
      select: { id: true, commanderName: true },
    });

    return {
      localityId: updated.id,
      commanderName: updated.commanderName,
      uid: profile.uid,
      fabom: profile.fabom,
      email: profile.email,
    };
  }

  @Put(':id/recruit-designations')
  @RequirePermission('localities', 'update')
  async replaceRecruitDesignations(
    @Param('id') id: string,
    @Body() dto: UpdateLocalityRecruitDesignationsDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsEditorAccess(id, user);

    const sourceLocality = await this.prisma.locality.findUnique({
      where: { id },
      select: { id: true, recruitsFemaleCountCurrent: true },
    });
    if (!sourceLocality) throwError('NOT_FOUND');

    const merged = new Map<string, number>();
    for (const item of dto.items ?? []) {
      const destinationLocalityId = String(
        item.destinationLocalityId ?? '',
      ).trim();
      if (!destinationLocalityId) continue;
      const nextCount = Number(item.assignedCount ?? 0);
      if (!Number.isInteger(nextCount) || nextCount <= 0) continue;
      merged.set(
        destinationLocalityId,
        (merged.get(destinationLocalityId) ?? 0) + nextCount,
      );
    }

    const normalizedItems = Array.from(merged.entries()).map(
      ([destinationLocalityId, assignedCount]) => ({
        destinationLocalityId,
        assignedCount,
      }),
    );
    const totalAssigned = normalizedItems.reduce(
      (acc, item) => acc + item.assignedCount,
      0,
    );
    const totalRecruits = sourceLocality.recruitsFemaleCountCurrent ?? 0;
    if (totalAssigned > totalRecruits) {
      throwError('VALIDATION_ERROR', {
        field: 'items',
        reason: 'RECRUIT_OM_ASSIGNMENTS_EXCEED_TOTAL',
        totalAssigned,
        totalRecruits,
      });
    }

    if (normalizedItems.length > 0) {
      const destinationIds = normalizedItems.map(
        (item) => item.destinationLocalityId,
      );
      const destinationLocalities = await this.prisma.locality.findMany({
        where: {
          id: { in: destinationIds },
          catalogType: LocalityCatalogType.SMIF,
        },
        select: { id: true },
      });
      if (destinationLocalities.length !== destinationIds.length) {
        throwError('VALIDATION_ERROR', {
          field: 'items',
          reason: 'RECRUIT_OM_ASSIGNMENT_INVALID_DESTINATION',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM "RecruitOmAssignment" WHERE "sourceLocalityId" = ${id}`;
      if (!normalizedItems.length) return;
      const now = new Date();
      const values = normalizedItems.map(
        (item) =>
          Prisma.sql`(
          ${`rasg_${randomUUID()}`},
          ${id},
          ${item.destinationLocalityId},
          ${item.assignedCount},
          ${now},
          ${now}
        )`,
      );
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "RecruitOmAssignment" (
          "id",
          "sourceLocalityId",
          "destinationLocalityId",
          "assignedCount",
          "createdAt",
          "updatedAt"
        )
        VALUES ${Prisma.join(values)}
      `);
    });

    return this.buildRecruitDesignationsResponse(id);
  }

  @Delete(':id')
  @RequirePermission('localities', 'delete')
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.locality.findFirst({
      where: { id, catalogType: LocalityCatalogType.SMIF },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');
    await this.prisma.locality.delete({ where: { id } });
    return { ok: true };
  }

  private assertLocalityAccess(localityId: string, user?: RbacUser) {
    const bypassLocalityConstraint = this.hasNationalLocalitiesAccess(user);
    if (bypassLocalityConstraint) return;
    if (!user?.localityId) return;
    if (user.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertRecruitsMutationAccess(
    localityId: string,
    user: RbacUser | undefined,
    recruitsFemaleCountCurrent: number | null | undefined,
  ) {
    if (
      recruitsFemaleCountCurrent === undefined ||
      recruitsFemaleCountCurrent === null
    )
      return;
    if (!hasPermission(user, 'localities', 'update')) {
      throwError('RBAC_FORBIDDEN');
    }
    this.assertLocalityAccess(localityId, user);
  }

  private assertRecruitsEditorAccess(localityId: string, user?: RbacUser) {
    if (!hasPermission(user, 'localities', 'update')) {
      throwError('RBAC_FORBIDDEN');
    }
    this.assertLocalityAccess(localityId, user);
  }

  private hasNationalLocalitiesAccess(user?: RbacUser) {
    return (
      hasPermission(user, 'localities', 'view', PermissionScope.NATIONAL) ||
      hasPermission(user, 'localities', 'create', PermissionScope.NATIONAL) ||
      hasPermission(user, 'localities', 'update', PermissionScope.NATIONAL) ||
      hasPermission(user, 'localities', 'delete', PermissionScope.NATIONAL)
    );
  }

  private async assertRecruitAssignmentsWithinTotal(
    localityId: string,
    recruitsFemaleCountCurrent: number,
  ) {
    const aggregate = await this.prisma.$queryRaw<
      Array<{ totalAssigned: number }>
    >(
      Prisma.sql`
        SELECT COALESCE(SUM("assignedCount"), 0)::int AS "totalAssigned"
        FROM "RecruitOmAssignment"
        WHERE "sourceLocalityId" = ${localityId}
      `,
    );
    const totalAssigned = Number(aggregate[0]?.totalAssigned ?? 0);
    if (totalAssigned > recruitsFemaleCountCurrent) {
      throwError('VALIDATION_ERROR', {
        field: 'recruitsFemaleCountCurrent',
        reason: 'RECRUIT_COUNT_BELOW_ASSIGNED_OM_TOTAL',
        totalAssigned,
      });
    }
  }

  private async buildRecruitDesignationsResponse(localityId: string) {
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: { id: true, recruitsFemaleCountCurrent: true },
    });
    if (!locality) throwError('NOT_FOUND');

    const items = await this.prisma.$queryRaw<
      Array<{
        id: string;
        destinationLocalityId: string;
        assignedCount: number;
        destinationLocalityName: string | null;
        destinationLocalityCode: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          a."id",
          a."destinationLocalityId",
          a."assignedCount",
          l."name" AS "destinationLocalityName",
          l."code" AS "destinationLocalityCode"
        FROM "RecruitOmAssignment" a
        LEFT JOIN "Locality" l
          ON l."id" = a."destinationLocalityId"
        WHERE a."sourceLocalityId" = ${localityId}
        ORDER BY l."name" ASC, a."destinationLocalityId" ASC
      `,
    );
    const totalAssigned = items.reduce(
      (acc: number, item) => acc + item.assignedCount,
      0,
    );
    const totalRecruits = locality.recruitsFemaleCountCurrent ?? 0;

    return {
      localityId,
      totalRecruits,
      totalAssigned,
      remaining: Math.max(0, totalRecruits - totalAssigned),
      items: items.map((item) => ({
        id: item.id,
        destinationLocalityId: item.destinationLocalityId,
        destinationLocalityName:
          item.destinationLocalityName ?? item.destinationLocalityId,
        destinationLocalityCode: item.destinationLocalityCode ?? '',
        assignedCount: item.assignedCount,
      })),
    };
  }

  private async buildRecruitMembersResponse(localityId: string) {
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        recruitsFemaleCountCurrent: true,
      },
    });
    if (!locality) throwError('NOT_FOUND');

    const items = (await this.prisma.recruitFemale.findMany({
      where: { localityId },
      select: {
        id: true,
        name: true,
        status: true,
        dismissalReason: true,
        dismissedAt: true,
        destinationLocalityId: true,
        designatedAt: true,
        comment: true,
        destinationLocality: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    } as any)) as Array<any>;

    return {
      localityId,
      recruitsFemaleCountCurrent: locality.recruitsFemaleCountCurrent ?? 0,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        dismissalReason: item.dismissalReason ?? null,
        dismissedAt: item.dismissedAt?.toISOString() ?? null,
        destinationLocalityId: item.destinationLocalityId ?? null,
        destinationLocalityName:
          item.destinationLocality?.name ?? item.destinationLocalityId ?? null,
        destinationLocalityCode: item.destinationLocality?.code ?? null,
        designatedAt: item.designatedAt?.toISOString() ?? null,
        comment: item.comment ?? null,
      })),
    };
  }

  private async createInitialRecruits(localityId: string, count: number) {
    if (count <= 0) return;
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: { code: true, name: true },
    });
    if (!locality) return;
    const now = new Date();
    const recruits = Array.from({ length: count }, (_, index) => ({
      id: `rf_${randomUUID().replace(/-/g, '')}`,
      localityId,
      name: `Recruta ${index + 1} - ${locality.code || locality.name.substring(0, 8)}`,
      status: RecruitFemaleStatus.RECRUITMENT_TO_START,
      createdAt: now,
      updatedAt: now,
    }));
    if (recruits.length > 0) {
      await this.prisma.recruitFemale.createMany({ data: recruits });
    }
  }

  private async syncLocalityRecruitCount(localityId: string) {
    const aggregate = await this.prisma.recruitFemale.count({
      where: {
        localityId,
        status: {
          in: [
            RecruitFemaleStatus.RECRUITMENT_TO_START,
            RecruitFemaleStatus.RECRUITMENT_STARTED,
          ],
        },
      },
    });
    await this.prisma.locality.update({
      where: { id: localityId },
      data: { recruitsFemaleCountCurrent: aggregate },
    });
    return aggregate;
  }

  private async registerRecruitsHistory(
    localityId: string,
    nextCount: number,
    previousCount: number,
    dismissalReason?: string | null,
    enforceDismissalReason = false,
  ) {
    const normalizedReason = dismissalReason
      ? sanitizeText(String(dismissalReason)).trim()
      : '';
    const turnoverCount = Math.max(0, previousCount - nextCount);
    if (enforceDismissalReason && turnoverCount > 0 && !normalizedReason) {
      throwError('VALIDATION_ERROR', {
        field: 'dismissalReason',
        reason: 'DISMISSAL_REASON_REQUIRED',
      });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await (this.prisma.recruitsHistory as any).upsert({
      where: {
        localityId_date: { localityId, date: today },
      },
      create: {
        localityId,
        date: today,
        recruitsFemaleCount: nextCount,
        turnoverCount,
        dismissalReason: turnoverCount > 0 ? normalizedReason || null : null,
      },
      update: {
        recruitsFemaleCount: nextCount,
        turnoverCount,
        dismissalReason: turnoverCount > 0 ? normalizedReason || null : null,
      },
    });
  }
}
