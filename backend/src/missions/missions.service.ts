import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { selectTargetLocalities } from '../common/priority-localities';
import {
  DEFAULT_MISSION_CHECKLIST_CLASSIFICATION,
  MISSION_CHECKLIST_CLASSIFICATION_DEFAULT_META,
  MISSION_CHECKLIST_CLASSIFICATIONS,
  MISSION_CHECKLIST_DEFAULT_SECTIONS,
  MISSION_CHECKLIST_SECTION_IDS,
  MISSION_CHECKLIST_SECTION_TITLE_BY_ID,
  type MissionChecklistSectionId,
  type MissionChecklistClassification,
} from './mission-checklist.constants';

const scheduleLogoCandidates = [
  path.resolve(process.cwd(), 'frontend', 'public', 'brand', 'cipavd-7.png'),
  path.resolve(process.cwd(), 'public', 'brand', 'cipavd-7.png'),
  path.resolve(
    process.cwd(),
    '..',
    'frontend',
    'public',
    'brand',
    'cipavd-7.png',
  ),
];

type MissionChecklistStoredItem = {
  id: string;
  classification: MissionChecklistClassification;
  notes: string;
  photos: string[];
};

type MissionChecklistSectionRuntime = {
  id: MissionChecklistSectionId;
  title: string;
  items: Array<{
    id: string;
    title: string;
    prompt: string | null;
    sortOrder: number;
  }>;
};

type MissionChecklistConfigRuntime = {
  sections: MissionChecklistSectionRuntime[];
  itemIds: string[];
  itemIdSet: Set<string>;
  classifications: Array<{
    id: MissionChecklistClassification;
    label: string;
    colorHex: string | null;
    sortOrder: number;
  }>;
  classificationIdSet: Set<MissionChecklistClassification>;
  defaultClassification: MissionChecklistClassification;
};

type ChecklistDimensionRow = {
  id: string;
  sectionId: string;
  title: string;
  prompt: string | null;
  sortOrder: number;
  createdAt: Date;
};

type ChecklistClassificationRow = {
  id: string;
  label: string;
  colorHex: string | null;
  sortOrder: number;
  createdAt: Date;
};

@Injectable()
export class MissionsService {
  private readonly missionPdfTimeZone = 'America/Sao_Paulo';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
  ) {}

  async list(
    filters: {
      localityId?: string;
      q?: string;
      page?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );
    const targetLocalityIds = await this.getTargetLocalityIds();
    if (targetLocalityIds.length === 0) {
      return { items: [], page, pageSize, total: 0 };
    }

    const andClauses: Prisma.MissionWhereInput[] = [
      { localityId: { in: targetLocalityIds } },
    ];
    if (filters.localityId) andClauses.push({ localityId: filters.localityId });
    if (filters.q) {
      andClauses.push({
        OR: [
          { title: { contains: filters.q, mode: 'insensitive' } },
          { description: { contains: filters.q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.MissionWhereInput = { AND: andClauses };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mission.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: {
          locality: { select: { id: true, code: true, name: true } },
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              cpf: true,
              ldapUid: true,
              fabom: true,
              userId: true,
            },
            orderBy: [{ createdAt: 'asc' }],
          },
          scheduleItems: {
            select: { id: true },
          },
        },
      }),
      this.prisma.mission.count({ where }),
    ]);

    return {
      items: items.map((mission) => ({
        ...mission,
        participantsCount: mission.participants.length,
        scheduleItemsCount: mission.scheduleItems.length,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getStatistics(user?: RbacUser) {
    this.assertMissionAccess(user);

    const targetLocalityIds = await this.getTargetLocalityIds();
    if (targetLocalityIds.length === 0) {
      return {
        totalMissions: 0,
        totalParticipants: 0,
        totalMissionDays: 0,
        totalParticipantDays: 0,
        missionsByUser: [],
        usersByMissionDays: [],
        participantsByMission: [],
        averageParticipantsPerMission: 0,
        averageMissionDays: 0,
        missionsWithoutParticipants: 0,
        missionsWithMostParticipants: [],
      };
    }

    const missions = await this.prisma.mission.findMany({
      where: { localityId: { in: targetLocalityIds } },
      include: {
        participants: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const totalMissions = missions.length;
    const totalParticipants = missions.reduce(
      (acc, m) => acc + m.participants.length,
      0,
    );
    const averageParticipantsPerMission =
      totalMissions > 0 ? totalParticipants / totalMissions : 0;
    const missionsWithoutParticipants = missions.filter(
      (m) => m.participants.length === 0,
    ).length;
    const totalMissionDays = missions.reduce(
      (acc, mission) =>
        acc + this.calculateInclusiveDays(mission.startDate, mission.endDate),
      0,
    );
    const averageMissionDays =
      totalMissions > 0 ? totalMissionDays / totalMissions : 0;
    const totalParticipantDays = missions.reduce(
      (acc, mission) =>
        acc +
        this.calculateInclusiveDays(mission.startDate, mission.endDate) *
          mission.participants.length,
      0,
    );

    // Estatísticas por usuário (participantes que são usuários do sistema)
    const userMissionCount = new Map<
      string,
      {
        userId: string;
        userName: string;
        userEmail: string;
        count: number;
        totalDays: number;
      }
    >();
    for (const mission of missions) {
      const missionDays = this.calculateInclusiveDays(
        mission.startDate,
        mission.endDate,
      );
      for (const participant of mission.participants) {
        if (participant.userId) {
          const existing = userMissionCount.get(participant.userId);
          if (existing) {
            existing.count += 1;
            existing.totalDays += missionDays;
          } else {
            userMissionCount.set(participant.userId, {
              userId: participant.userId,
              userName: participant.name || 'Sem nome',
              userEmail: participant.email || '',
              count: 1,
              totalDays: missionDays,
            });
          }
        }
      }
    }

    const missionsByUser = Array.from(userMissionCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const usersByMissionDays = Array.from(userMissionCount.values())
      .sort((a, b) => b.totalDays - a.totalDays || b.count - a.count)
      .slice(0, 10);

    // Estatísticas por missão
    const participantsByMission = missions
      .map((m) => ({
        missionId: m.id,
        missionTitle: m.title,
        participantsCount: m.participants.length,
        missionDays: this.calculateInclusiveDays(m.startDate, m.endDate),
      }))
      .sort((a, b) => b.participantsCount - a.participantsCount)
      .slice(0, 10);

    const missionsWithMostParticipants = missions
      .filter((m) => m.participants.length > 0)
      .sort((a, b) => b.participants.length - a.participants.length)
      .slice(0, 5)
      .map((m) => ({
        missionId: m.id,
        missionTitle: m.title,
        participantsCount: m.participants.length,
      }));

    return {
      totalMissions,
      totalParticipants,
      totalMissionDays,
      totalParticipantDays,
      missionsByUser,
      usersByMissionDays,
      participantsByMission,
      averageParticipantsPerMission:
        Math.round(averageParticipantsPerMission * 10) / 10,
      averageMissionDays: Math.round(averageMissionDays * 10) / 10,
      missionsWithoutParticipants,
      missionsWithMostParticipants,
    };
  }

  async getChecklistMapping(
    filters: {
      localityId?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const selectedOmId = String(filters.localityId ?? '').trim() || null;
    const checklistConfig = await this.getMissionChecklistConfig();

    const [omsCatalog, missions] = await this.prisma.$transaction([
      this.prisma.locality.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.mission.findMany({
        include: {
          locality: { select: { id: true, name: true, code: true } },
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              cpf: true,
              fabom: true,
              ldapUid: true,
            },
            orderBy: [{ createdAt: 'asc' }],
          },
          scheduleItems: {
            select: {
              id: true,
              title: true,
              startAt: true,
              durationMinutes: true,
              location: true,
              responsible: true,
              participants: true,
            },
            orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const omById = new Map(omsCatalog.map((om) => [om.id, om]));
    const latestMissionByOm = new Map<
      string,
      {
        om: { id: string; name: string; code: string | null };
        mission: (typeof missions)[number];
        checklistSections: MissionChecklistSectionRuntime[];
        checklistItemById: Map<
          string,
          {
            classification: MissionChecklistClassification;
            notes: string;
            photos: string[];
          }
        >;
      }
    >();

    for (const mission of missions) {
      const storedChecklistItems = this.readStoredMissionChecklistItems(
        mission.checklistJson,
        checklistConfig,
      );
      if (storedChecklistItems.size === 0) continue;

      const checklistOmId =
        this.readStoredMissionChecklistOmId(mission.checklistJson) ??
        mission.localityId;
      if (!checklistOmId) continue;
      if (selectedOmId && checklistOmId !== selectedOmId) continue;
      if (latestMissionByOm.has(checklistOmId)) continue;

      const om = omById.get(checklistOmId) ?? null;
      if (!om) continue;

      const checklistSections = this.buildMissionChecklistSections(
        mission.checklistJson,
        checklistConfig,
      );
      const checklistItemById = new Map<
        string,
        {
          classification: MissionChecklistClassification;
          notes: string;
          photos: string[];
        }
      >();
      for (const section of checklistSections) {
        for (const item of section.items) {
          checklistItemById.set(item.id, {
            classification: item.classification,
            notes: item.notes,
            photos: item.photos ?? [],
          });
        }
      }

      latestMissionByOm.set(checklistOmId, {
        om,
        mission,
        checklistSections,
        checklistItemById,
      });
    }

    const localities = Array.from(latestMissionByOm.entries())
      .map(([omId, entry]) => ({
        id: omId,
        name: entry.om.name,
        code: entry.om.code ?? null,
      }))
      .sort((a, b) =>
        (a.code?.trim() || a.name).localeCompare(
          b.code?.trim() || b.name,
          'pt-BR',
        ),
      );

    if (localities.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        localities: [],
        classifications: checklistConfig.classifications,
        defaultClassification: checklistConfig.defaultClassification,
        sections: [],
        missionsByLocality: [],
      };
    }

    const sections = checklistConfig.sections.map((section) => ({
      id: section.id,
      title: section.title,
      items: section.items.map((item) => ({
        id: item.id,
        title: item.title,
        prompt: item.prompt ?? null,
        cells: localities.map((locality) => {
          const missionEntry = latestMissionByOm.get(locality.id);
          if (!missionEntry) {
            return {
              localityId: locality.id,
              missionId: null,
              classification: null,
              notes: '',
              hasNotes: false,
              photos: [],
              hasPhotos: false,
            };
          }
          const checklistItem = missionEntry.checklistItemById.get(item.id);
          if (!checklistItem) {
            return {
              localityId: locality.id,
              missionId: missionEntry.mission.id,
              classification: null,
              notes: '',
              hasNotes: false,
              photos: [],
              hasPhotos: false,
            };
          }
          return {
            localityId: locality.id,
            missionId: missionEntry.mission.id,
            classification: checklistItem.classification,
            notes: checklistItem.notes,
            hasNotes: Boolean(checklistItem.notes.trim()),
            photos: checklistItem.photos ?? [],
            hasPhotos: Boolean((checklistItem.photos ?? []).length),
          };
        }),
      })),
    }));

    const missionsByLocality = localities.map((locality) => {
      const missionEntry = latestMissionByOm.get(locality.id);
      if (!missionEntry) {
        return {
          localityId: locality.id,
          mission: null,
        };
      }
      const mission = missionEntry.mission;
      return {
        localityId: locality.id,
        mission: {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          startDate: mission.startDate,
          endDate: mission.endDate,
          updatedAt: mission.updatedAt,
          locality: mission.locality,
          checklistOm: missionEntry.om,
          participants: mission.participants,
          participantsCount: mission.participants.length,
          scheduleItems: mission.scheduleItems,
          scheduleItemsCount: mission.scheduleItems.length,
          checklistSections: missionEntry.checklistSections,
        },
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      localities,
      classifications: checklistConfig.classifications,
      defaultClassification: checklistConfig.defaultClassification,
      sections,
      missionsByLocality,
    };
  }

  async getChecklistConfig(user?: RbacUser) {
    this.assertMissionAccess(user);
    const checklistConfig = await this.getMissionChecklistConfig();
    return {
      generatedAt: new Date().toISOString(),
      classifications: checklistConfig.classifications,
      defaultClassification: checklistConfig.defaultClassification,
      sections: checklistConfig.sections,
    };
  }

  async createChecklistDimension(
    payload: {
      sectionId: MissionChecklistSectionId;
      title: string;
      prompt?: string;
      sortOrder?: number;
    },
    user?: RbacUser,
  ) {
    this.assertMissionChecklistConfigAccess(user);
    const sectionId = this.normalizeChecklistSectionId(payload.sectionId);
    const title = this.sanitizeRequiredText(payload.title, 'title');
    const prompt =
      payload.prompt === undefined ? null : sanitizeText(payload.prompt ?? '');

    const sortOrder =
      typeof payload.sortOrder === 'number' && Number.isFinite(payload.sortOrder)
        ? Math.max(0, Math.floor(payload.sortOrder))
        : await this.nextChecklistDimensionSortOrder(sectionId);
    const id = `dim_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const [created] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
      }>
    >(Prisma.sql`
      INSERT INTO "MissionChecklistDimension"
        ("id", "sectionId", "title", "prompt", "sortOrder", "isActive", "createdAt", "updatedAt")
      VALUES
        (${id}, ${sectionId}, ${title}, ${prompt ? prompt : null}, ${sortOrder}, true, NOW(), NOW())
      RETURNING "id", "sectionId", "title", "prompt", "sortOrder"
    `);
    if (!created) throwError('UNEXPECTED');

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'create_checklist_dimension',
      entityId: created.id,
      diffJson: created,
    });

    return created;
  }

  async updateChecklistDimension(
    id: string,
    payload: {
      sectionId?: MissionChecklistSectionId;
      title?: string;
      prompt?: string;
      sortOrder?: number;
    },
    user?: RbacUser,
  ) {
    this.assertMissionChecklistConfigAccess(user);
    const dimensionId = String(id ?? '').trim();
    if (!dimensionId) {
      throwError('VALIDATION_ERROR', { field: 'id', reason: 'REQUIRED' });
    }

    const [existing] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
      }>
    >(Prisma.sql`
      SELECT "id", "sectionId", "title", "prompt", "sortOrder"
      FROM "MissionChecklistDimension"
      WHERE "id" = ${dimensionId} AND "isActive" = true
      LIMIT 1
    `);
    if (!existing) throwError('NOT_FOUND');

    const nextSectionId =
      payload.sectionId === undefined
        ? existing.sectionId
        : this.normalizeChecklistSectionId(payload.sectionId);

    const nextSortOrder =
      typeof payload.sortOrder === 'number' && Number.isFinite(payload.sortOrder)
        ? Math.max(0, Math.floor(payload.sortOrder))
        : existing.sortOrder;
    const nextTitle =
      payload.title === undefined
        ? existing.title
        : this.sanitizeRequiredText(payload.title, 'title');
    const nextPrompt =
      payload.prompt === undefined
        ? existing.prompt
        : (() => {
            const normalizedPrompt = sanitizeText(payload.prompt ?? '');
            return normalizedPrompt ? normalizedPrompt : null;
          })();

    const [updated] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
      }>
    >(Prisma.sql`
      UPDATE "MissionChecklistDimension"
      SET
        "sectionId" = ${nextSectionId},
        "title" = ${nextTitle},
        "prompt" = ${nextPrompt},
        "sortOrder" = ${nextSortOrder},
        "updatedAt" = NOW()
      WHERE "id" = ${dimensionId} AND "isActive" = true
      RETURNING "id", "sectionId", "title", "prompt", "sortOrder"
    `);
    if (!updated) throwError('NOT_FOUND');

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'update_checklist_dimension',
      entityId: updated.id,
      diffJson: {
        before: existing,
        after: updated,
      },
    });

    return updated;
  }

  async deleteChecklistDimension(id: string, user?: RbacUser) {
    this.assertMissionChecklistConfigAccess(user);
    const dimensionId = String(id ?? '').trim();
    if (!dimensionId) {
      throwError('VALIDATION_ERROR', { field: 'id', reason: 'REQUIRED' });
    }

    const [existing] = await this.prisma.$queryRaw<
      Array<{ id: string; sectionId: string; title: string }>
    >(Prisma.sql`
      SELECT "id", "sectionId", "title"
      FROM "MissionChecklistDimension"
      WHERE "id" = ${dimensionId} AND "isActive" = true
      LIMIT 1
    `);
    if (!existing) throwError('NOT_FOUND');

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "MissionChecklistDimension"
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE "id" = ${dimensionId}
    `);

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'delete_checklist_dimension',
      entityId: dimensionId,
      diffJson: existing,
    });

    return { ok: true };
  }

  async updateChecklistClassification(
    id: string,
    payload: {
      label: string;
      colorHex?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionChecklistConfigAccess(user);
    const classificationId = String(id ?? '').trim();
    if (!this.isMissionChecklistClassification(classificationId)) {
      throwError('VALIDATION_ERROR', {
        field: 'id',
        reason: 'INVALID_CLASSIFICATION',
      });
    }

    const label = this.sanitizeRequiredText(payload.label, 'label');
    const normalizedColor =
      payload.colorHex === undefined
        ? undefined
        : this.normalizeHexColor(payload.colorHex, 'colorHex');
    const defaults =
      MISSION_CHECKLIST_CLASSIFICATION_DEFAULT_META[classificationId];

    const [existing] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        label: string;
        colorHex: string | null;
        sortOrder: number;
      }>
    >(Prisma.sql`
      SELECT "id", "label", "colorHex", "sortOrder"
      FROM "MissionChecklistClassificationSetting"
      WHERE "id" = ${classificationId}
      LIMIT 1
    `);

    if (!existing) {
      const [created] = await this.prisma.$queryRaw<
        Array<{
          id: string;
          label: string;
          colorHex: string | null;
          sortOrder: number;
        }>
      >(Prisma.sql`
        INSERT INTO "MissionChecklistClassificationSetting"
          ("id", "label", "colorHex", "sortOrder", "createdAt", "updatedAt")
        VALUES
          (${classificationId}, ${label}, ${normalizedColor === undefined ? defaults.colorHex : normalizedColor}, ${defaults.sortOrder}, NOW(), NOW())
        RETURNING "id", "label", "colorHex", "sortOrder"
      `);
      if (!created) throwError('UNEXPECTED');
      await this.audit.log({
        userId: user?.id,
        resource: 'missions',
        action: 'update_checklist_classification',
        entityId: created.id,
        diffJson: created,
      });
      return created;
    }

    const [updated] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        label: string;
        colorHex: string | null;
        sortOrder: number;
      }>
    >(Prisma.sql`
      UPDATE "MissionChecklistClassificationSetting"
      SET
        "label" = ${label},
        "colorHex" = ${
          normalizedColor === undefined ? existing.colorHex : normalizedColor
        },
        "updatedAt" = NOW()
      WHERE "id" = ${classificationId}
      RETURNING "id", "label", "colorHex", "sortOrder"
    `);
    if (!updated) throwError('UNEXPECTED');

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'update_checklist_classification',
      entityId: updated.id,
      diffJson: updated,
    });

    return updated;
  }

  async getById(id: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        participants: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        scheduleItems: {
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');
    return mission;
  }

  async getChecklist(id: string, user?: RbacUser) {
    this.assertMissionAccess(user);
    const checklistConfig = await this.getMissionChecklistConfig();

    const mission = await this.prisma.mission.findUnique({
      where: { id },
      select: {
        id: true,
        localityId: true,
        updatedAt: true,
        checklistJson: true,
      },
    });

    if (!mission) throwError('NOT_FOUND');

    const checklistOmId =
      this.readStoredMissionChecklistOmId(mission.checklistJson) ??
      mission.localityId;
    const checklistOm =
      checklistOmId && (await this.prisma.locality.findUnique({
        where: { id: checklistOmId },
        select: { id: true, code: true, name: true },
      }));

    return {
      missionId: mission.id,
      localityId: mission.localityId,
      omId: checklistOmId,
      om: checklistOm,
      updatedAt: mission.updatedAt,
      classifications: checklistConfig.classifications,
      defaultClassification: checklistConfig.defaultClassification,
      sections: this.buildMissionChecklistSections(
        mission.checklistJson,
        checklistConfig,
      ),
    };
  }

  async upsertChecklist(
    id: string,
    payload: {
      omId: string;
      items: {
        id: string;
        classification: MissionChecklistClassification;
        notes?: string;
        photos?: string[];
      }[];
    },
    user?: RbacUser,
  ) {
    this.assertMissionChecklistEditAccess(user);
    const checklistConfig = await this.getMissionChecklistConfig();

    const mission = await this.prisma.mission.findUnique({
      where: { id },
      select: { id: true, localityId: true },
    });
    if (!mission) throwError('NOT_FOUND');

    const checklistOmId = String(payload.omId ?? '').trim();
    if (!checklistOmId) {
      throwError('VALIDATION_ERROR', {
        field: 'omId',
        reason: 'REQUIRED',
      });
    }
    const omExists = await this.prisma.locality.findUnique({
      where: { id: checklistOmId },
      select: { id: true },
    });
    if (!omExists) {
      throwError('VALIDATION_ERROR', {
        field: 'omId',
        reason: 'OM_NOT_FOUND',
      });
    }

    const normalizedItems = this.normalizeMissionChecklistItems(
      payload.items,
      checklistConfig,
    );

    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        checklistJson: {
          version: 2,
          omId: checklistOmId,
          items: normalizedItems,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        localityId: true,
        updatedAt: true,
        checklistJson: true,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'update_checklist',
      entityId: updated.id,
      localityId: updated.localityId,
      diffJson: {
        checklistOmId,
        checklistItemsCount: normalizedItems.length,
        checklistNotesFilledCount: normalizedItems.filter((item) =>
          item.notes.trim(),
        ).length,
        checklistPhotosCount: normalizedItems.reduce(
          (acc, item) => acc + (item.photos?.length ?? 0),
          0,
        ),
      },
    });

    return {
      missionId: updated.id,
      localityId: updated.localityId,
      omId: checklistOmId,
      updatedAt: updated.updatedAt,
      classifications: checklistConfig.classifications,
      defaultClassification: checklistConfig.defaultClassification,
      sections: this.buildMissionChecklistSections(
        updated.checklistJson,
        checklistConfig,
      ),
    };
  }

  async create(
    payload: {
      title: string;
      description?: string | null;
      localityId: string;
      startDate: string;
      endDate: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const targetLocalityIds = await this.getTargetLocalityIds();
    if (!targetLocalityIds.includes(payload.localityId)) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'LOCALITY_NOT_ALLOWED',
      });
    }

    const startDate = this.parseRequiredDate(payload.startDate, 'startDate');
    const endDate = this.parseRequiredDate(payload.endDate, 'endDate');
    if (endDate.getTime() < startDate.getTime()) {
      throwError('VALIDATION_ERROR', {
        field: 'endDate',
        reason: 'END_DATE_BEFORE_START_DATE',
      });
    }

    const created = await this.prisma.mission.create({
      data: {
        title: this.sanitizeRequiredText(payload.title, 'title'),
        description: payload.description
          ? sanitizeText(payload.description)
          : null,
        localityId: payload.localityId,
        startDate,
        endDate,
        createdById: user?.id ?? null,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        participants: true,
        scheduleItems: true,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId,
      diffJson: {
        title: created.title,
        startDate: created.startDate.toISOString(),
        endDate: created.endDate.toISOString(),
      },
    });

    return {
      ...created,
      participantsCount: created.participants.length,
      scheduleItemsCount: created.scheduleItems.length,
    };
  }

  async update(
    id: string,
    payload: {
      title?: string;
      description?: string | null;
      localityId?: string;
      startDate?: string;
      endDate?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const existing = await this.prisma.mission.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const targetLocalityIds = await this.getTargetLocalityIds();
    const localityId = payload.localityId ?? existing.localityId;
    if (!targetLocalityIds.includes(localityId)) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'LOCALITY_NOT_ALLOWED',
      });
    }

    const startDate = payload.startDate
      ? this.parseRequiredDate(payload.startDate, 'startDate')
      : existing.startDate;
    const endDate = payload.endDate
      ? this.parseRequiredDate(payload.endDate, 'endDate')
      : existing.endDate;

    if (endDate.getTime() < startDate.getTime()) {
      throwError('VALIDATION_ERROR', {
        field: 'endDate',
        reason: 'END_DATE_BEFORE_START_DATE',
      });
    }

    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        title:
          payload.title === undefined
            ? undefined
            : this.sanitizeRequiredText(payload.title, 'title'),
        description:
          payload.description === undefined
            ? undefined
            : payload.description === null
              ? null
              : sanitizeText(payload.description),
        localityId,
        startDate,
        endDate,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        participants: true,
        scheduleItems: true,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'update',
      entityId: id,
      localityId: updated.localityId,
      diffJson: {
        title: updated.title,
        startDate: updated.startDate.toISOString(),
        endDate: updated.endDate.toISOString(),
      },
    });

    return {
      ...updated,
      participantsCount: updated.participants.length,
      scheduleItemsCount: updated.scheduleItems.length,
    };
  }

  async delete(id: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const existing = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        participants: { select: { id: true } },
        scheduleItems: { select: { id: true } },
      },
    });
    if (!existing) throwError('NOT_FOUND');

    await this.prisma.mission.delete({ where: { id } });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'delete',
      entityId: id,
      localityId: existing.localityId,
      diffJson: {
        title: existing.title,
        participantsCount: existing.participants.length,
        scheduleItemsCount: existing.scheduleItems.length,
      },
    });

    return { ok: true };
  }

  async lookupLdapParticipant(rawQuery: string | undefined, user?: RbacUser) {
    this.assertMissionAccess(user);

    const query = String(rawQuery ?? '').trim();
    if (!query) {
      return { item: null };
    }

    const normalized = query.toLowerCase();
    const profile = normalized.includes('@')
      ? await this.fabLdap.lookupByEmail(query)
      : await this.fabLdap.lookupByUid(query.replace(/\D/g, '') || query);

    if (!profile) {
      return { item: null };
    }

    return {
      item: {
        uid: profile.uid,
        name: profile.name,
        email: profile.email,
        fabom: profile.fabom,
        cpf: this.extractCpf(profile.uid),
      },
    };
  }

  async addParticipantFromLdap(
    missionId: string,
    identifier: string,
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: { participants: true },
    });
    if (!mission) throwError('NOT_FOUND');

    const normalized = String(identifier ?? '').trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', {
        field: 'identifier',
        reason: 'REQUIRED',
      });
    }

    const profile = normalized.includes('@')
      ? await this.fabLdap.lookupByEmail(normalized)
      : await this.fabLdap.lookupByUid(
          normalized.replace(/\D/g, '') || normalized,
        );

    if (!profile) {
      throwError('NOT_FOUND', { resource: 'ldap_user' });
    }

    const normalizedEmail = profile.email?.toLowerCase() ?? null;
    const cpf = this.extractCpf(profile.uid);

    const duplicate = mission.participants.find(
      (participant) =>
        (profile.uid && participant.ldapUid === profile.uid) ||
        (normalizedEmail &&
          participant.email?.toLowerCase() === normalizedEmail) ||
        (cpf && participant.cpf === cpf),
    );
    if (duplicate) {
      return duplicate;
    }

    const linkedUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          profile.uid ? { ldapUid: profile.uid } : undefined,
          normalizedEmail ? { email: normalizedEmail } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: { id: true },
    });

    const created = await this.prisma.missionParticipant.create({
      data: {
        missionId,
        userId: linkedUser?.id ?? null,
        ldapUid: profile.uid,
        cpf,
        email: normalizedEmail,
        name: profile.name ?? normalizedEmail ?? profile.uid,
        fabom: profile.fabom,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'add_participant',
      entityId: missionId,
      localityId: mission.localityId,
      diffJson: {
        participantId: created.id,
        participantUid: created.ldapUid,
        participantEmail: created.email,
      },
    });

    return created;
  }

  async addParticipantFromUser(
    missionId: string,
    userId: string,
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: { participants: true },
    });
    if (!mission) throwError('NOT_FOUND');

    const systemUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        ldapUid: true,
      },
    });
    if (!systemUser) throwError('NOT_FOUND');

    const duplicate = mission.participants.find(
      (participant) =>
        participant.userId === userId ||
        (systemUser.ldapUid && participant.ldapUid === systemUser.ldapUid) ||
        (systemUser.email &&
          participant.email?.toLowerCase() === systemUser.email.toLowerCase()),
    );
    if (duplicate) {
      return duplicate;
    }

    const cpf = this.extractCpf(systemUser.ldapUid);

    const created = await this.prisma.missionParticipant.create({
      data: {
        missionId,
        userId: systemUser.id,
        ldapUid: systemUser.ldapUid,
        cpf,
        email: systemUser.email,
        name: systemUser.name,
        fabom: null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'add_participant',
      entityId: missionId,
      localityId: mission.localityId,
      diffJson: {
        participantId: created.id,
        participantUserId: created.userId,
        participantEmail: created.email,
      },
    });

    return created;
  }

  async removeParticipant(
    missionId: string,
    participantId: string,
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');

    const participant = await this.prisma.missionParticipant.findFirst({
      where: { id: participantId, missionId },
    });
    if (!participant) throwError('NOT_FOUND');

    await this.prisma.missionParticipant.delete({
      where: { id: participantId },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'remove_participant',
      entityId: missionId,
      localityId: mission.localityId,
      diffJson: {
        participantId,
        participantUid: participant.ldapUid,
        participantEmail: participant.email,
      },
    });

    return { ok: true };
  }

  async listSchedule(missionId: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        scheduleItems: {
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');

    return {
      mission: {
        id: mission.id,
        title: mission.title,
        description: mission.description,
        startDate: mission.startDate,
        endDate: mission.endDate,
        locality: mission.locality,
      },
      items: mission.scheduleItems,
    };
  }

  async createScheduleItem(
    missionId: string,
    payload: {
      title: string;
      startAt: string;
      durationMinutes: number;
      location: string;
      responsible: string;
      participants: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');

    const created = await this.prisma.missionScheduleItem.create({
      data: {
        missionId,
        title: this.sanitizeRequiredText(payload.title, 'title'),
        startAt: this.parseRequiredDate(payload.startAt, 'startAt'),
        durationMinutes: this.normalizeDurationMinutes(payload.durationMinutes),
        location: sanitizeText(payload.location ?? ''),
        responsible: this.sanitizeRequiredText(
          payload.responsible,
          'responsible',
        ),
        participants: sanitizeText(payload.participants ?? ''),
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'create_schedule_item',
      entityId: created.id,
      localityId: mission.localityId,
      diffJson: { missionId, startAt: created.startAt.toISOString() },
    });

    return created;
  }

  async updateScheduleItem(
    missionId: string,
    itemId: string,
    payload: {
      title?: string;
      startAt?: string;
      durationMinutes?: number;
      location?: string;
      responsible?: string;
      participants?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');

    const existing = await this.prisma.missionScheduleItem.findFirst({
      where: { id: itemId, missionId },
    });
    if (!existing) throwError('NOT_FOUND');

    const updated = await this.prisma.missionScheduleItem.update({
      where: { id: itemId },
      data: {
        title:
          payload.title === undefined
            ? undefined
            : this.sanitizeRequiredText(payload.title, 'title'),
        startAt:
          payload.startAt === undefined
            ? undefined
            : this.parseRequiredDate(payload.startAt, 'startAt'),
        durationMinutes:
          payload.durationMinutes === undefined
            ? undefined
            : this.normalizeDurationMinutes(payload.durationMinutes),
        location:
          payload.location === undefined
            ? undefined
            : sanitizeText(payload.location ?? ''),
        responsible:
          payload.responsible === undefined
            ? undefined
            : this.sanitizeRequiredText(payload.responsible, 'responsible'),
        participants:
          payload.participants === undefined
            ? undefined
            : sanitizeText(payload.participants ?? ''),
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'update_schedule_item',
      entityId: itemId,
      localityId: mission.localityId,
      diffJson: { missionId },
    });

    return updated;
  }

  async deleteScheduleItem(missionId: string, itemId: string, user?: RbacUser) {
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');

    const existing = await this.prisma.missionScheduleItem.findFirst({
      where: { id: itemId, missionId },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');

    await this.prisma.missionScheduleItem.delete({ where: { id: itemId } });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'delete_schedule_item',
      entityId: itemId,
      localityId: mission.localityId,
      diffJson: { missionId },
    });

    return { ok: true };
  }

  async buildSchedulePdf(missionId: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        participants: {
          select: { name: true, email: true, cpf: true, fabom: true },
          orderBy: [{ createdAt: 'asc' }],
        },
        scheduleItems: {
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');

    const doc = new PDFDocument({
      margin: 32,
      size: 'A4',
      layout: 'landscape',
    });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const palette = {
      brandDark: '#123A63',
      brand: '#0C657E',
      paper: '#F8FBFF',
      card: '#EEF4FB',
      cardBorder: '#D2E0F0',
      tableHeader: '#1F4F7A',
      tableHeaderText: '#FFFFFF',
      sectionBg: '#E3EDF9',
      sectionBorder: '#BCD1E8',
      rowOdd: '#FFFFFF',
      rowEven: '#F6F9FD',
      rowBorder: '#D7E1EC',
      text: '#0F172A',
      muted: '#4B5563',
    };

    const tableX = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableBottomLimit = doc.page.height - doc.page.margins.bottom - 16;
    let cursorY = doc.page.margins.top;
    let pageNumber = 1;
    let isFirstPage = true;

    const logoPath = this.findScheduleLogoPath();
    const missionTitle = mission.title || 'Missão sem título';
    const missionLocality = mission.locality
      ? `${mission.locality.name} (${mission.locality.code})`
      : '-';
    const missionTimeZone = this.missionPdfTimeZone;
    const missionPeriod = `${this.formatDate(mission.startDate, missionTimeZone)} a ${this.formatDate(mission.endDate, missionTimeZone)}`;
    const participantsLabel =
      mission.participants.length > 0
        ? mission.participants
            .map((participant) => {
              const baseName =
                participant.name ||
                participant.email ||
                participant.cpf ||
                'Participante';
              return this.removeOmFromParticipantName(
                baseName,
                participant.fabom,
              );
            })
            .join(', ')
        : 'Nenhum participante cadastrado';

    const drawPageFooter = () => {
      const footerY = doc.page.height - doc.page.margins.bottom - 10;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(palette.muted)
        .text(
          `Página ${pageNumber} • Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`,
          tableX,
          footerY,
          { width: contentWidth, align: 'right' },
        );
    };

    const drawCoverHeader = () => {
      const headerHeight = 64;
      doc
        .roundedRect(tableX, cursorY, contentWidth, headerHeight, 10)
        .fillAndStroke(palette.brandDark, palette.brandDark);

      if (logoPath) {
        try {
          doc.image(logoPath, tableX + 12, cursorY + 10, { fit: [40, 40] });
        } catch {
          // no-op
        }
      }

      const textStartX = tableX + 60;
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#FFFFFF')
        .text('Cronograma da Missão', textStartX, cursorY + 10, {
          width: contentWidth - (textStartX - tableX) - 12,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#FFFFFF')
        .text(missionTitle, textStartX, cursorY + 32, {
          width: contentWidth - (textStartX - tableX) - 12,
        });

      cursorY += headerHeight + 8;
    };

    const drawMetaCards = () => {
      const gap = 6;
      const cardHeight = 42;
      const infoCards = [
        { label: 'Localidade', value: missionLocality },
        { label: 'Período', value: missionPeriod },
        { label: 'Participantes', value: String(mission.participants.length) },
      ];
      const cardWidth =
        (contentWidth - gap * (infoCards.length - 1)) / infoCards.length;

      let x = tableX;
      for (const card of infoCards) {
        doc
          .roundedRect(x, cursorY, cardWidth, cardHeight, 6)
          .fillAndStroke(palette.card, palette.cardBorder);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(palette.muted)
          .text(card.label, x + 8, cursorY + 6, { width: cardWidth - 16 });
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(palette.text)
          .text(card.value || '-', x + 8, cursorY + 18, {
            width: cardWidth - 16,
            height: 18,
          });
        x += cardWidth + gap;
      }

      cursorY += cardHeight + 6;

      const participantsHeight = Math.max(
        32,
        doc.heightOfString(participantsLabel, {
          width: contentWidth - 16,
          align: 'left',
        }) + 16,
      );
      doc
        .roundedRect(tableX, cursorY, contentWidth, participantsHeight, 6)
        .fillAndStroke(palette.paper, palette.cardBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(palette.muted)
        .text('Participantes', tableX + 8, cursorY + 6, {
          width: contentWidth - 16,
        });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(palette.text)
        .text(participantsLabel, tableX + 8, cursorY + 16, {
          width: contentWidth - 16,
        });

      cursorY += participantsHeight + 8;
    };

    const drawContinuationHeader = () => {
      const barHeight = 28;
      doc
        .roundedRect(tableX, cursorY, contentWidth, barHeight, 6)
        .fillAndStroke(palette.brandDark, palette.brandDark);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#FFFFFF')
        .text(
          `Cronograma da Missão • ${missionTitle}`,
          tableX + 10,
          cursorY + 8,
          {
            width: contentWidth - 20,
          },
        );
      cursorY += barHeight + 8;
    };

    const columnDefs = [
      { key: 'time', label: 'Horário', width: 90, align: 'left' as const },
      {
        key: 'duration',
        label: 'Duração',
        width: 64,
        align: 'center' as const,
      },
      {
        key: 'activity',
        label: 'Atividade',
        width: 235,
        align: 'left' as const,
      },
      { key: 'location', label: 'Local', width: 105, align: 'left' as const },
      {
        key: 'responsible',
        label: 'Responsável',
        width: 105,
        align: 'left' as const,
      },
      {
        key: 'participants',
        label: 'Participantes',
        width: 0,
        align: 'left' as const,
      },
    ];
    const fixedWidth = columnDefs
      .slice(0, -1)
      .reduce((acc, col) => acc + col.width, 0);
    columnDefs[columnDefs.length - 1].width = contentWidth - fixedWidth;
    const dayBlockGap = 18;

    const drawTableHeader = () => {
      const headerHeight = 22;
      doc
        .rect(tableX, cursorY, contentWidth, headerHeight)
        .fillAndStroke(palette.tableHeader, palette.tableHeader);
      let x = tableX;
      for (const col of columnDefs) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(palette.tableHeaderText)
          .text(col.label, x + 5, cursorY + 7, {
            width: col.width - 10,
            align: col.align,
          });
        x += col.width;
      }
      cursorY += headerHeight;
    };

    const drawDayBlockHeader = (
      dayLabel: string,
      requiredContentHeight = 22,
    ) => {
      const blockHeight = 20;
      const tableHeaderHeight = 22;
      const safetyMargin = 15;
      let needsGap = cursorY > doc.page.margins.top + 20;
      const requiredHeight =
        (needsGap ? dayBlockGap : 0) +
        blockHeight +
        tableHeaderHeight +
        requiredContentHeight +
        safetyMargin;

      if (cursorY + requiredHeight > tableBottomLimit) {
        openNewPage(false);
        needsGap = false;
      }

      if (needsGap) {
        cursorY += dayBlockGap;
      }

      doc
        .rect(tableX, cursorY, contentWidth, blockHeight)
        .fillAndStroke(palette.sectionBg, palette.sectionBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(palette.brandDark)
        .text(`DIA • ${dayLabel}`, tableX + 8, cursorY + 6, {
          width: contentWidth - 16,
        });
      cursorY += blockHeight;
      drawTableHeader();
    };

    const getContinuationPageAvailableHeight = () => {
      const continuationHeaderHeight = 28;
      const continuationHeaderGap = 8;
      const continuationStartY =
        doc.page.margins.top + continuationHeaderHeight + continuationHeaderGap;
      return tableBottomLimit - continuationStartY;
    };

    const openNewPage = (forceTableHeader = true) => {
      if (!isFirstPage) {
        // Só desenhar footer e criar nova página se houver conteúdo significativo na página atual
        // Verificar se há pelo menos 100px de conteúdo para evitar páginas quase vazias
        const minContentHeight = 100;
        if (cursorY > doc.page.margins.top + minContentHeight) {
          drawPageFooter();
          doc.addPage();
          pageNumber += 1;
        } else {
          // Se não há conteúdo suficiente, não criar nova página - apenas resetar cursor
          // Isso evita páginas em branco no meio do documento
          cursorY = doc.page.margins.top;
          if (forceTableHeader) drawTableHeader();
          return;
        }
      }
      cursorY = doc.page.margins.top;
      if (isFirstPage) {
        drawCoverHeader();
        drawMetaCards();
      } else {
        drawContinuationHeader();
      }
      if (forceTableHeader) drawTableHeader();
      isFirstPage = false;
    };

    const ensureRowFits = (rowHeight: number) => {
      // Adicionar margem de segurança para evitar quebras no meio de elementos
      const safetyMargin = 20;
      if (cursorY + rowHeight + safetyMargin <= tableBottomLimit) return;
      // Só criar nova página se realmente não couber e houver conteúdo suficiente na página atual
      // Exigir pelo menos 100px de conteúdo antes de criar nova página
      const minContentHeight = 100;
      if (cursorY > doc.page.margins.top + minContentHeight) {
        openNewPage(true);
      } else {
        // Se não há espaço suficiente mas também não há conteúdo suficiente na página,
        // tentar ajustar o cursorY para o limite da tabela para evitar página em branco
        // Se mesmo assim não couber, forçar a quebra apenas se absolutamente necessário
        const availableSpace = tableBottomLimit - cursorY - safetyMargin;
        if (availableSpace < rowHeight * 0.5) {
          // Se não há nem metade do espaço necessário, forçar nova página mesmo sem conteúdo suficiente
          // Mas só se realmente não couber nada
          openNewPage(true);
        } else {
          cursorY = tableBottomLimit - rowHeight - safetyMargin;
        }
      }
    };

    const drawMorningDivider = (requiredContentHeight = 22) => {
      const dividerHeight = 20;
      const safetyMargin = 15;
      // Garante que a divisória não fique "órfã": deve caber ao menos 1 item após ela.
      if (
        cursorY + dividerHeight + requiredContentHeight + safetyMargin >
        tableBottomLimit
      ) {
        openNewPage(true);
      }
      doc
        .rect(tableX, cursorY, contentWidth, dividerHeight)
        .fillAndStroke(palette.sectionBg, palette.sectionBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(palette.brandDark)
        .text('MANHÃ', tableX + 6, cursorY + 6, { width: contentWidth - 12 });
      cursorY += dividerHeight;
    };

    const drawAfternoonDivider = (requiredContentHeight = 22) => {
      const dividerHeight = 20;
      const safetyMargin = 15;
      // Garante que a divisória não fique "órfã": deve caber ao menos 1 item após ela.
      if (
        cursorY + dividerHeight + requiredContentHeight + safetyMargin >
        tableBottomLimit
      ) {
        openNewPage(true);
      }
      doc
        .rect(tableX, cursorY, contentWidth, dividerHeight)
        .fillAndStroke(palette.sectionBg, palette.sectionBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(palette.brandDark)
        .text('TARDE', tableX + 6, cursorY + 6, { width: contentWidth - 12 });
      cursorY += dividerHeight;
    };

    const measureScheduleRowHeight = (row: Record<string, string>) => {
      const textPaddingX = 5;
      const textPaddingY = 4;
      const minHeight = 22;
      const lineGap = 3; // Espaçamento adicional entre linhas para melhor legibilidade
      const rowSpacing = 1; // Espaçamento vertical entre linhas da tabela

      let rowHeight = minHeight;
      for (const col of columnDefs) {
        const value = String(row[col.key] ?? '-');
        const height = doc
          .font('Helvetica')
          .fontSize(8.5)
          .heightOfString(value, {
            width: col.width - textPaddingX * 2,
            align: col.align,
            lineGap: lineGap,
          });
        rowHeight = Math.max(rowHeight, height + textPaddingY * 2);
      }
      return rowHeight + rowSpacing;
    };

    const drawScheduleRow = (rowIndex: number, row: Record<string, string>) => {
      const textPaddingX = 5;
      const textPaddingY = 4;
      const lineGap = 3;
      const rowSpacing = 1;
      const measured = measureScheduleRowHeight(row);
      const rowHeight = measured - rowSpacing;

      ensureRowFits(measured);

      const background = rowIndex % 2 === 0 ? palette.rowOdd : palette.rowEven;
      doc
        .rect(tableX, cursorY, contentWidth, rowHeight)
        .fillAndStroke(background, palette.rowBorder);

      let x = tableX;
      for (const col of columnDefs) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(palette.text)
          .text(
            String(row[col.key] ?? '-'),
            x + textPaddingX,
            cursorY + textPaddingY,
            {
              width: col.width - textPaddingX * 2,
              align: col.align,
              lineGap: lineGap,
            },
          );
        x += col.width;
      }

      cursorY += rowHeight + rowSpacing;
    };

    const buildScheduleRowData = (item: (typeof mission.scheduleItems)[number]) => {
      const endAt = new Date(item.startAt.getTime() + item.durationMinutes * 60_000);
      return {
        time: `${this.formatTime(item.startAt, missionTimeZone)} - ${this.formatTime(endAt, missionTimeZone)}`,
        duration: this.formatDuration(item.durationMinutes),
        activity: item.title || '-',
        location: item.location || '-',
        responsible: item.responsible || '-',
        participants: item.participants || '-',
      };
    };

    const measureDayBlockHeight = (
      dayItems: Array<(typeof mission.scheduleItems)[number]>,
    ) => {
      if (dayItems.length === 0) return 0;

      const dayHeaderHeight = 20;
      const tableHeaderHeight = 22;
      const periodDividerHeight = 20;
      let totalHeight = dayHeaderHeight + tableHeaderHeight;
      let lastItemHour = -1;
      let rowIndex = 0;

      for (const item of dayItems) {
        const itemDateParts = this.getDateTimePartsInTimeZone(
          item.startAt,
          missionTimeZone,
        );
        const itemHour = Number(itemDateParts.hour);
        const rowData = buildScheduleRowData(item);
        const rowHeight = measureScheduleRowHeight(rowData);
        const shouldAddMorningDivider = rowIndex === 0 && itemHour < 12;
        const shouldAddAfternoonDivider =
          (rowIndex === 0 && itemHour >= 12) ||
          (rowIndex > 0 && lastItemHour < 12 && itemHour >= 12);

        if (shouldAddMorningDivider) {
          totalHeight += periodDividerHeight;
        }
        if (shouldAddAfternoonDivider) {
          totalHeight += periodDividerHeight;
        }

        totalHeight += rowHeight;
        lastItemHour = itemHour;
        rowIndex += 1;
      }

      return totalHeight;
    };

    const moveDayBlockToNextPageWhenPossible = (dayBlockHeight: number) => {
      if (dayBlockHeight <= 0) return;

      const blockGap = cursorY > doc.page.margins.top + 20 ? dayBlockGap : 0;
      const requiredOnCurrentPage = dayBlockHeight + blockGap;
      if (cursorY + requiredOnCurrentPage <= tableBottomLimit) return;

      // Só quebra antes do bloco quando ele cabe por inteiro em uma nova página.
      if (dayBlockHeight <= getContinuationPageAvailableHeight()) {
        openNewPage(false);
      }
    };

    openNewPage(false);

    if (mission.scheduleItems.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(palette.muted)
        .text(
          'Nenhum item de cronograma cadastrado para esta missão.',
          tableX,
          cursorY + 12,
          {
            width: contentWidth,
            align: 'center',
          },
        );
    } else {
      const groupedByDay: Array<{
        key: string;
        label: string;
        items: Array<(typeof mission.scheduleItems)[number]>;
      }> = [];

      for (const item of mission.scheduleItems) {
        const dateParts = this.getDateTimePartsInTimeZone(
          item.startAt,
          missionTimeZone,
        );
        const dayKey = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
        const dayLabel = `${this.formatWeekdayDate(item.startAt, missionTimeZone)}/${dateParts.year}`;
        const currentGroup = groupedByDay[groupedByDay.length - 1];
        if (currentGroup && currentGroup.key === dayKey) {
          currentGroup.items.push(item);
          continue;
        }
        groupedByDay.push({
          key: dayKey,
          label: dayLabel,
          items: [item],
        });
      }

      for (const dayGroup of groupedByDay) {
        const firstItem = dayGroup.items[0];
        if (!firstItem) continue;
        moveDayBlockToNextPageWhenPossible(measureDayBlockHeight(dayGroup.items));
        const firstRowData = buildScheduleRowData(firstItem);
        drawDayBlockHeader(dayGroup.label, measureScheduleRowHeight(firstRowData));

        let rowIndex = 0;
        let lastItemHour = -1;

        for (const item of dayGroup.items) {
          const itemDateParts = this.getDateTimePartsInTimeZone(
            item.startAt,
            missionTimeZone,
          );
          const itemHour = Number(itemDateParts.hour);
          const rowData = buildScheduleRowData(item);
          const requiredRowHeight = measureScheduleRowHeight(rowData);

          // Adiciona divisória no primeiro item do período, dentro do bloco do dia.
          const shouldAddMorningDivider = rowIndex === 0 && itemHour < 12;
          const shouldAddAfternoonDivider =
            (rowIndex === 0 && itemHour >= 12) ||
            (rowIndex > 0 && lastItemHour < 12 && itemHour >= 12);

          if (shouldAddMorningDivider) {
            drawMorningDivider(requiredRowHeight);
          }

          if (shouldAddAfternoonDivider) {
            drawAfternoonDivider(requiredRowHeight);
          }

          drawScheduleRow(rowIndex, rowData);
          lastItemHour = itemHour;
          rowIndex += 1;
        }
      }
    }

    // Só desenhar o footer se houver conteúdo suficiente na página atual
    // Evitar página em branco ao final
    if (cursorY > doc.page.margins.top + 20) {
      drawPageFooter();
    }

    doc.end();
    const buffer = await done;
    const sanitizedTitle = mission.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
      .toLowerCase();
    const fileName = `cronograma-missao-${sanitizedTitle || mission.id}.pdf`;
    return { fileName, buffer };
  }

  private buildMissionChecklistSections(
    checklistJson: Prisma.JsonValue | null | undefined,
    checklistConfig: MissionChecklistConfigRuntime,
  ) {
    const storedItemsById = this.readStoredMissionChecklistItems(
      checklistJson,
      checklistConfig,
    );

    return checklistConfig.sections.map((section) => ({
      id: section.id,
      title: section.title,
      items: section.items.map((item) => {
        const stored = storedItemsById.get(item.id);
        return {
          id: item.id,
          title: item.title,
          prompt: item.prompt ?? null,
          sortOrder: item.sortOrder,
          classification:
            stored?.classification ?? checklistConfig.defaultClassification,
          notes: stored?.notes ?? '',
          photos: stored?.photos ?? [],
        };
      }),
    }));
  }

  private normalizeMissionChecklistItems(
    rawItems: {
      id: string;
      classification: MissionChecklistClassification;
      notes?: string;
      photos?: string[];
    }[],
    checklistConfig: MissionChecklistConfigRuntime,
  ): MissionChecklistStoredItem[] {
    const normalizedById = new Map<string, MissionChecklistStoredItem>();

    for (const item of rawItems) {
      if (!checklistConfig.itemIdSet.has(item.id)) {
        throwError('VALIDATION_ERROR', {
          field: 'items',
          reason: 'INVALID_CHECKLIST_ITEM',
          itemId: item.id,
        });
      }

      const classification = String(item.classification ?? '');
      if (!checklistConfig.classificationIdSet.has(classification as any)) {
        throwError('VALIDATION_ERROR', {
          field: 'classification',
          reason: 'INVALID_CLASSIFICATION',
          itemId: item.id,
        });
      }

      normalizedById.set(item.id, {
        id: item.id,
        classification: classification as MissionChecklistClassification,
        notes: sanitizeText(item.notes ?? ''),
        photos: this.normalizeMissionChecklistPhotos(item.photos),
      });
    }

    return checklistConfig.itemIds.map((itemId) => {
      const existing = normalizedById.get(itemId);
      if (existing) return existing;
      return {
        id: itemId,
        classification: checklistConfig.defaultClassification,
        notes: '',
        photos: [],
      };
    });
  }

  private readStoredMissionChecklistItems(
    checklistJson: Prisma.JsonValue | null | undefined,
    checklistConfig: MissionChecklistConfigRuntime,
  ) {
    const result = new Map<string, MissionChecklistStoredItem>();
    if (!this.isJsonObject(checklistJson)) return result;

    const rawItems = checklistJson.items;
    if (!Array.isArray(rawItems)) return result;

    for (const rawItem of rawItems) {
      if (!this.isJsonObject(rawItem)) continue;

      const itemId = typeof rawItem.id === 'string' ? rawItem.id : '';
      const classificationRaw =
        typeof rawItem.classification === 'string' ? rawItem.classification : '';

      if (!checklistConfig.itemIdSet.has(itemId)) continue;
      if (
        !checklistConfig.classificationIdSet.has(
          classificationRaw as MissionChecklistClassification,
        )
      ) {
        continue;
      }

      result.set(itemId, {
        id: itemId,
        classification: classificationRaw as MissionChecklistClassification,
        notes: typeof rawItem.notes === 'string' ? rawItem.notes : '',
        photos: this.normalizeMissionChecklistPhotos(
          Array.isArray(rawItem.photos)
            ? (rawItem.photos as Prisma.JsonValue[])
                .filter((entry): entry is string => typeof entry === 'string')
            : [],
        ),
      });
    }

    return result;
  }

  private normalizeMissionChecklistPhotos(rawPhotos: string[] | undefined) {
    if (!Array.isArray(rawPhotos)) return [];
    const dedup = new Set<string>();
    const normalized: string[] = [];
    for (const raw of rawPhotos) {
      const value = sanitizeText(String(raw ?? '')).trim();
      if (!value) continue;
      if (
        !value.startsWith('/missions/checklist/uploads/') &&
        !/^https?:\/\//i.test(value)
      ) {
        continue;
      }
      if (dedup.has(value)) continue;
      dedup.add(value);
      normalized.push(value);
      if (normalized.length >= 12) break;
    }
    return normalized;
  }

  private async getMissionChecklistConfig(): Promise<MissionChecklistConfigRuntime> {
    const [dimensionRows, classificationRows] = await Promise.all([
      this.prisma.$queryRaw<ChecklistDimensionRow[]>(Prisma.sql`
        SELECT
          "id",
          "sectionId",
          "title",
          "prompt",
          "sortOrder",
          "createdAt"
        FROM "MissionChecklistDimension"
        WHERE "isActive" = true
        ORDER BY "sectionId" ASC, "sortOrder" ASC, "createdAt" ASC
      `),
      this.prisma.$queryRaw<ChecklistClassificationRow[]>(Prisma.sql`
        SELECT
          "id",
          "label",
          "colorHex",
          "sortOrder",
          "createdAt"
        FROM "MissionChecklistClassificationSetting"
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      `),
    ]);

    const sectionGroups = new Map<MissionChecklistSectionId, MissionChecklistSectionRuntime['items']>(
      MISSION_CHECKLIST_SECTION_IDS.map((sectionId) => [sectionId, []]),
    );

    for (const row of dimensionRows) {
      if (!this.isMissionChecklistSectionId(row.sectionId)) continue;
      const title = sanitizeText(row.title ?? '').trim();
      if (!title) continue;

      sectionGroups.get(row.sectionId)?.push({
        id: row.id,
        title,
        prompt: row.prompt ? sanitizeText(row.prompt).trim() || null : null,
        sortOrder: row.sortOrder,
      });
    }

    let sections: MissionChecklistSectionRuntime[] = MISSION_CHECKLIST_SECTION_IDS.map(
      (sectionId) => ({
        id: sectionId,
        title: MISSION_CHECKLIST_SECTION_TITLE_BY_ID[sectionId],
        items: sectionGroups.get(sectionId) ?? [],
      }),
    );

    const hasAtLeastOneDimension = sections.some(
      (section) => section.items.length > 0,
    );
    if (!hasAtLeastOneDimension) {
      sections = MISSION_CHECKLIST_DEFAULT_SECTIONS.map((section) => ({
        id: section.id,
        title: section.title,
        items: section.items.map((item, index) => ({
          id: item.id,
          title: item.title,
          prompt: item.prompt ?? null,
          sortOrder: (index + 1) * 10,
        })),
      }));
    }

    const classificationById = new Map<string, ChecklistClassificationRow>(
      classificationRows.map((row) => [row.id, row]),
    );
    const classifications = (
      MISSION_CHECKLIST_CLASSIFICATIONS as readonly MissionChecklistClassification[]
    )
      .map((id) => {
        const dbRow = classificationById.get(id);
        const defaults = MISSION_CHECKLIST_CLASSIFICATION_DEFAULT_META[id];
        const normalizedDbColor = this.sanitizeHexColorOrNull(dbRow?.colorHex);
        const resolvedColor =
          dbRow === undefined ? defaults.colorHex : normalizedDbColor;
        return {
          id,
          label: sanitizeText(dbRow?.label ?? '').trim() || defaults.label,
          colorHex: resolvedColor,
          sortOrder:
            typeof dbRow?.sortOrder === 'number'
              ? dbRow.sortOrder
              : defaults.sortOrder,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'pt-BR'));

    const itemIds = sections.flatMap((section) =>
      section.items.map((item) => item.id),
    );
    const itemIdSet = new Set(itemIds);
    const classificationIdSet = new Set(
      classifications.map((classification) => classification.id),
    );
    const defaultClassification = classificationIdSet.has(
      DEFAULT_MISSION_CHECKLIST_CLASSIFICATION,
    )
      ? DEFAULT_MISSION_CHECKLIST_CLASSIFICATION
      : classifications[0]?.id ?? DEFAULT_MISSION_CHECKLIST_CLASSIFICATION;

    return {
      sections,
      itemIds,
      itemIdSet,
      classifications,
      classificationIdSet,
      defaultClassification,
    };
  }

  private readStoredMissionChecklistOmId(
    checklistJson: Prisma.JsonValue | null | undefined,
  ) {
    if (!this.isJsonObject(checklistJson)) return null;
    const rawOmId = checklistJson.omId;
    if (typeof rawOmId !== 'string') return null;
    const normalizedOmId = rawOmId.trim();
    return normalizedOmId || null;
  }

  private isMissionChecklistClassification(
    value: string,
  ): value is MissionChecklistClassification {
    return (
      MISSION_CHECKLIST_CLASSIFICATIONS as readonly string[]
    ).includes(value);
  }

  private isMissionChecklistSectionId(
    value: string,
  ): value is MissionChecklistSectionId {
    return (MISSION_CHECKLIST_SECTION_IDS as readonly string[]).includes(value);
  }

  private normalizeChecklistSectionId(value: string) {
    const normalized = String(value ?? '').trim();
    if (!this.isMissionChecklistSectionId(normalized)) {
      throwError('VALIDATION_ERROR', {
        field: 'sectionId',
        reason: 'INVALID_SECTION',
      });
    }
    return normalized;
  }

  private async nextChecklistDimensionSortOrder(
    sectionId: MissionChecklistSectionId,
  ) {
    const [row] = await this.prisma.$queryRaw<Array<{ sortOrder: number }>>(
      Prisma.sql`
        SELECT "sortOrder"
        FROM "MissionChecklistDimension"
        WHERE "sectionId" = ${sectionId}
          AND "isActive" = true
        ORDER BY "sortOrder" DESC, "createdAt" DESC
        LIMIT 1
      `,
    );
    return (row?.sortOrder ?? 0) + 10;
  }

  private normalizeHexColor(value: string, field: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(normalized)) {
      throwError('VALIDATION_ERROR', {
        field,
        reason: 'INVALID_HEX_COLOR',
      });
    }
    return normalized.toUpperCase();
  }

  private sanitizeHexColorOrNull(value: string | null | undefined) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(normalized)) return null;
    return normalized.toUpperCase();
  }

  private isJsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private assertMissionAccess(user?: RbacUser) {
    if (
      hasAnyRole(user, [
        ROLE_COORDENACAO_CIPAVD,
        ROLE_COMANDANTE_COMGEP,
        ROLE_TI,
      ])
    ) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private assertMissionChecklistEditAccess(user?: RbacUser) {
    if (hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  async assertChecklistUploadAccess(id: string, user?: RbacUser) {
    this.assertMissionChecklistEditAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!mission) throwError('NOT_FOUND');
  }

  private assertMissionChecklistConfigAccess(user?: RbacUser) {
    if (hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private async getTargetLocalityIds() {
    const localities = await this.prisma.locality.findMany({
      select: {
        id: true,
        name: true,
        recruitsFemaleCountCurrent: true,
        updatedAt: true,
      },
    });
    return selectTargetLocalities(localities).map((locality) => locality.id);
  }

  private sanitizeRequiredText(value: string, field: string) {
    const normalized = sanitizeText(value ?? '');
    if (!normalized.trim()) {
      throwError('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
    }
    return normalized;
  }

  private parseRequiredDate(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throwError('VALIDATION_ERROR', { field, reason: 'DATE_INVALID' });
    }
    return parsed;
  }

  private normalizeDurationMinutes(value: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throwError('VALIDATION_ERROR', {
        field: 'durationMinutes',
        reason: 'DURATION_INVALID',
      });
    }
    return Math.round(parsed);
  }

  private findScheduleLogoPath() {
    for (const candidate of scheduleLogoCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private getWeekStartDate(value: Date) {
    // Usar UTC para manter consistência
    const date = new Date(value);
    const day = (date.getUTCDay() + 6) % 7; // Monday = 0
    date.setUTCDate(date.getUTCDate() - day);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private formatDateNoYear(value: Date, timeZone = this.missionPdfTimeZone) {
    const { month, day } = this.getDateTimePartsInTimeZone(value, timeZone);
    return `${day}/${month}`;
  }

  private formatWeekdayDate(value: Date, timeZone = this.missionPdfTimeZone) {
    const weekday = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      timeZone,
    })
      .format(value)
      .replace('.', '')
      .toUpperCase();
    return `${weekday} ${this.formatDateNoYear(value, timeZone)}`;
  }

  private formatDuration(minutes: number) {
    const rounded = Math.max(1, Math.round(minutes));
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours <= 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  }

  private formatDate(value: Date, timeZone = this.missionPdfTimeZone) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeZone,
    }).format(value);
  }

  private formatTime(value: Date, timeZone = this.missionPdfTimeZone) {
    const { hour: hours, minute: minutes } = this.getDateTimePartsInTimeZone(
      value,
      timeZone,
    );
    return `${hours}:${minutes}`;
  }

  private getDateTimePartsInTimeZone(
    value: Date,
    timeZone = this.missionPdfTimeZone,
  ) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(value);

    const byType = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return {
      year: byType.year ?? '0000',
      month: byType.month ?? '01',
      day: byType.day ?? '01',
      hour: byType.hour ?? '00',
      minute: byType.minute ?? '00',
    };
  }

  private removeOmFromParticipantName(name: string, fabom?: string | null) {
    const normalizedName = sanitizeText(name ?? '').trim();
    if (!normalizedName) return 'Participante';
    const normalizedFabom = sanitizeText(fabom ?? '').trim();
    if (!normalizedFabom) {
      const parts = normalizedName.split(/\s+/).filter(Boolean);
      if (parts.length >= 3) {
        const lastToken = parts[parts.length - 1];
        const looksLikeOm = /^[A-Z]{2,5}$/.test(lastToken);
        if (looksLikeOm) {
          return parts.slice(0, -1).join(' ').trim() || normalizedName;
        }
      }
      return normalizedName;
    }

    const escapedFabom = normalizedFabom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      normalizedName
        .replace(new RegExp(`\\s+${escapedFabom}$`, 'i'), '')
        .trim() || normalizedName
    );
  }

  private extractCpf(value: string | null | undefined) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 11) return digits;
    return null;
  }

  private calculateInclusiveDays(startDate: Date, endDate: Date) {
    const startUtc = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    );
    const endUtc = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    );
    const diffMs = endUtc - startUtc;
    const diffDays = Math.floor(diffMs / 86_400_000);
    return Math.max(1, diffDays + 1);
  }
}
