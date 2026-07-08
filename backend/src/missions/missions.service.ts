import { Injectable } from '@nestjs/common';
import { ActivityScope, LocalityCatalogType, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import {
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  ROLE_ADM_MISSOES,
} from '../rbac/role-access';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { selectTargetLocalities } from '../common/priority-localities';
import { decryptSecret, verifyTotpCode } from '../auth/totp.util';
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
import {
  missionBannerLayoutKeys,
  type MissionBannerLayoutOverrides,
  renderMissionBannerPdf,
  renderMissionBannerPng,
  type MissionBannerRenderable,
} from './mission-banner.renderer';

const MISSION_PARTICIPANT_OM_SUFFIXES = new Set([
  'CENIPA',
  'COMAE',
  'COMAER',
  'COMAR',
  'COMGAP',
  'COMGEP',
  'COMPREP',
  'DCTA',
  'DECEA',
  'DIRENS',
  'DIRAP',
  'DIRSA',
  'EMAER',
  'GABAER',
]);

const MISSION_PARTICIPANT_RANK_ORDER_ENTRIES: Array<readonly [string, number]> =
  [
    ['GEN', 0],
    ['TEN BRIG', 1],
    ['TENBRIG', 1],
    ['TB', 1],
    ['MAJ BRIG', 2],
    ['MAJBRIG', 2],
    ['MB', 2],
    ['BRIG', 3],
    ['BRIGADEIRO', 3],
    ['CEL', 4],
    ['CORONEL', 4],
    ['TEN CEL', 5],
    ['TENCEL', 5],
    ['TENENTE CORONEL', 5],
    ['TCEL', 5],
    ['MJ', 6],
    ['MAJ', 6],
    ['MAJOR', 6],
    ['CAP', 7],
    ['CAPITAO', 7],
    ['CL', 7],
    ['CAPELAO', 7],
    ['CP', 7],
    ['1 TEN', 8],
    ['1TEN', 8],
    ['1 TENENTE', 8],
    ['PRIMEIRO TENENTE', 8],
    ['TEN', 8],
    ['1T', 8],
    ['2 TEN', 9],
    ['2TEN', 9],
    ['2 TENENTE', 9],
    ['SEGUNDO TENENTE', 9],
    ['2T', 9],
    ['ASP', 10],
    ['ASPIRANTE', 10],
    ['SO', 11],
    ['SUBOFICIAL', 11],
    ['1 SGT', 12],
    ['1SGT', 12],
    ['1 SARGENTO', 12],
    ['PRIMEIRO SARGENTO', 12],
    ['1S', 12],
    ['2 SGT', 13],
    ['2SGT', 13],
    ['2 SARGENTO', 13],
    ['SEGUNDO SARGENTO', 13],
    ['2S', 13],
    ['3 SGT', 14],
    ['3SGT', 14],
    ['3 SARGENTO', 14],
    ['TERCEIRO SARGENTO', 14],
    ['3S', 14],
    ['CB', 15],
    ['CABO', 15],
    ['SD1', 16],
    ['S1', 16],
    ['SD2', 17],
    ['S2', 17],
    ['SD', 17],
    ['SOLDADO', 17],
    ['ALUNO', 18],
  ];

const MISSION_PARTICIPANT_RANK_ORDER = new Map(
  MISSION_PARTICIPANT_RANK_ORDER_ENTRIES,
);

const MISSION_PARTICIPANT_RANK_PREFIXES =
  MISSION_PARTICIPANT_RANK_ORDER_ENTRIES.map(([rank]) => rank).sort(
    (a, b) => b.length - a.length,
  );

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

type MissionScheduleFieldActivityPayload = {
  scheduleItemId: string;
  action: 'CREATE' | 'LINK';
  activityId?: string | null;
  title?: string;
  activityTypeId?: string | null;
  specialtyIds?: string[];
  responsibleUserIds?: string[];
  eventDate?: string | null;
  reportRequired?: boolean;
};

type MissionReportFieldKey =
  | 'title'
  | 'date'
  | 'time'
  | 'location'
  | 'responsible'
  | 'participants';

type MissionReportFieldValues = Record<MissionReportFieldKey, string>;

type MissionReportBlockType = 'free_text' | 'day_heading' | 'field_activity';

type MissionReportBlock = {
  id: string;
  type: MissionReportBlockType;
  sortOrder: number;
  contentHtml?: string;
  contentText?: string;
  dayKey?: string | null;
  dayLabel?: string | null;
  sourceScheduleItemId?: string | null;
  sourceActivityId?: string | null;
  fields?: MissionReportFieldValues;
  manualOverrides?: Partial<Record<MissionReportFieldKey, boolean>>;
  createdFrom?: string | null;
};

type MissionReportBlocksDocument = {
  version: 1;
  blocks: MissionReportBlock[];
};

type MissionReportSourceActivity = {
  sourceKey: string;
  scheduleItemId: string;
  activityId: string | null;
  dayKey: string;
  dayLabel: string;
  fields: MissionReportFieldValues;
};

@Injectable()
export class MissionsService {
  private readonly missionPdfTimeZone = 'America/Sao_Paulo';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
    private readonly config?: ConfigService,
  ) {}

  async listLocalityOptions(scopeParam: string | undefined, user?: RbacUser) {
    this.assertMissionAccess(user);
    const scope = this.normalizeMissionScope(scopeParam);
    const ids = await this.resolveAllowedLocalityIds(scope);
    if (ids.length === 0) {
      return {
        items: [] as Array<{
          id: string;
          code: string | null;
          name: string;
          uf: string | null;
        }>,
      };
    }
    const items = await this.prisma.locality.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, name: true, uf: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async list(
    filters: {
      localityId?: string;
      q?: string;
      page?: string;
      pageSize?: string;
      scope?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );
    const scope = this.normalizeMissionScope(filters.scope);
    const targetLocalityIds = await this.resolveAllowedLocalityIds(scope);
    if (targetLocalityIds.length === 0) {
      return { items: [], page, pageSize, total: 0 };
    }

    const andClauses: Prisma.MissionWhereInput[] = [
      { localityId: { in: targetLocalityIds } },
      { scope },
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
          report: {
            select: {
              id: true,
              contentHtml: true,
              contentText: true,
              signatures: {
                where: { removedAt: null },
                select: { id: true },
              },
            },
          },
        },
      }),
      this.prisma.mission.count({ where }),
    ]);

    return {
      items: items.map((mission) => {
        if (this.isAdmMissionsProfile(user)) {
          return {
            ...mission,
            report: null,
            participantsCount: mission.participants.length,
            scheduleItemsCount: mission.scheduleItems.length,
            reportFilled: false,
            reportSignaturesCount: 0,
          };
        }
        return {
          ...mission,
          participantsCount: mission.participants.length,
          scheduleItemsCount: mission.scheduleItems.length,
          reportFilled: this.isMissionReportFilled(mission.report),
          reportSignaturesCount: mission.report?.signatures.length ?? 0,
        };
      }),
      page,
      pageSize,
      total,
    };
  }

  async getStatistics(user?: RbacUser, scopeParam?: string) {
    this.assertMissionAccess(user);

    const scope = this.normalizeMissionScope(scopeParam);
    const targetLocalityIds = await this.resolveAllowedLocalityIds(scope);
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
      where: { localityId: { in: targetLocalityIds }, scope },
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
      scope?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAdvancedTabAccess(user);
    this.assertMissionAccess(user);
    const selectedOmId = String(filters.localityId ?? '').trim() || null;
    const scope = this.normalizeMissionScope(filters.scope);
    const catalogType =
      scope === ActivityScope.CIPAVD
        ? LocalityCatalogType.CIPAVD
        : LocalityCatalogType.SMIF;
    const checklistConfig = await this.getMissionChecklistConfig();

    const [omsCatalog, missions] = await this.prisma.$transaction([
      this.prisma.locality.findMany({
        where: { catalogType },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.mission.findMany({
        where: { scope },
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
    this.assertMissionAdvancedTabAccess(user);
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
      typeof payload.sortOrder === 'number' &&
      Number.isFinite(payload.sortOrder)
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
      typeof payload.sortOrder === 'number' &&
      Number.isFinite(payload.sortOrder)
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
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                scope: true,
                eventDate: true,
                status: true,
                localityId: true,
                activityType: { select: { id: true, name: true } },
              },
            },
            activityLinks: {
              orderBy: [{ createdAt: 'asc' }],
              include: {
                activity: {
                  select: {
                    id: true,
                    title: true,
                    scope: true,
                    eventDate: true,
                    status: true,
                    localityId: true,
                    activityType: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        banners: {
          orderBy: [
            { eventDate: 'asc' },
            { eventTime: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        report: {
          include: {
            signatures: {
              orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
              include: {
                signedBy: { select: { id: true, name: true, email: true } },
                removedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    if (this.isAdmMissionsProfile(user)) {
      return {
        ...mission,
        scheduleItems: this.stripMissionScheduleActivityLinks(
          mission.scheduleItems,
        ),
        report: null,
        reportFilled: false,
        reportSignaturesCount: 0,
      };
    }
    const report =
      mission.scope === ActivityScope.CIPAVD
        ? await this.ensureMissionReportSynchronized(id, user)
        : mission.report;
    return {
      ...mission,
      report,
      reportFilled: this.isMissionReportFilled(report),
      reportSignaturesCount:
        report?.signatures.filter((signature) => !signature.removedAt).length ??
        0,
    };
  }

  async upsertReport(
    id: string,
    dto: {
      contentHtml?: string | null;
      contentText?: string | null;
      blocks?: unknown[] | null;
    },
    user?: RbacUser,
  ) {
    this.assertMissionReportEditAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id },
      select: { id: true, localityId: true, scope: true },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    this.assertMissionReportScope(mission);

    const existing = await (this.prisma.missionReport as any).findUnique({
      where: { missionId: id },
      select: {
        id: true,
        contentHtml: true,
        contentText: true,
        blocksJson: true,
      },
    });

    const hasStructuredBlocks = Array.isArray(dto.blocks);
    let blocksDocument: MissionReportBlocksDocument;
    let rendered: { contentHtml: string; contentText: string };

    if (hasStructuredBlocks) {
      const sourceContext = await this.prisma.mission.findUnique({
        where: { id },
        include: {
          locality: { select: { id: true, code: true, name: true } },
          scheduleItems: {
            orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
            include: {
              activity: {
                include: {
                  visitScheduleItems: {
                    orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
                  },
                },
              },
              activityLinks: {
                orderBy: [{ createdAt: 'asc' }],
                include: {
                  activity: {
                    include: {
                      activityType: { select: { id: true, name: true } },
                      visitScheduleItems: {
                        orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
                      },
                    },
                  },
                },
              },
            },
          },
        } as any,
      } as any);
      if (!sourceContext) throwError('NOT_FOUND');
      blocksDocument = this.synchronizeMissionReportBlocks(
        this.normalizeMissionReportBlocksDocument({
          version: 1,
          blocks: dto.blocks ?? [],
        }),
        this.buildMissionReportSourceActivities(sourceContext),
      );
      rendered = this.renderMissionReportDocument(blocksDocument);
    } else {
      const contentHtml = this.sanitizeMissionReportHtml(dto.contentHtml);
      const contentText = this.sanitizeMissionReportContentText(
        dto.contentText ?? this.stripMissionReportHtml(contentHtml),
      );
      blocksDocument = {
        version: 1,
        blocks: [
          {
            id: `free-${existing?.id ?? randomUUID()}`,
            type: 'free_text',
            sortOrder: 0,
            contentHtml,
            contentText,
            createdFrom: 'legacy_payload',
          },
        ],
      };
      rendered = { contentHtml, contentText };
    }

    const nextBlocksJson = blocksDocument as unknown as Prisma.JsonObject;
    const contentChanged =
      !existing ||
      existing.contentHtml !== rendered.contentHtml ||
      existing.contentText !== rendered.contentText ||
      JSON.stringify(existing.blocksJson ?? null) !==
        JSON.stringify(nextBlocksJson);

    const report = await this.prisma.$transaction(async (tx) => {
      const saved = await (tx.missionReport as any).upsert({
        where: { missionId: id },
        create: {
          missionId: id,
          blocksJson: nextBlocksJson,
          contentHtml: rendered.contentHtml,
          contentText: rendered.contentText,
        },
        update: {
          blocksJson: nextBlocksJson,
          contentHtml: rendered.contentHtml,
          contentText: rendered.contentText,
        },
      });

      if (contentChanged) {
        await tx.missionReportSignature.updateMany({
          where: { reportId: saved.id, removedAt: null },
          data: {
            removedAt: new Date(),
            removedById: user?.id ?? null,
          },
        });
      }

      return tx.missionReport.findUnique({
        where: { id: saved.id },
        include: {
          signatures: {
            orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
            include: {
              signedBy: { select: { id: true, name: true, email: true } },
              removedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });
    if (!report) throwError('UNEXPECTED');

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'upsert_report',
      entityId: id,
      localityId: mission.localityId,
      diffJson: {
        reportId: report.id,
        contentChanged,
        activeSignatures: report.signatures.filter((item) => !item.removedAt)
          .length,
      },
    });

    return {
      ...report,
      filled: this.isMissionReportFilled(report),
    };
  }

  async signReport(id: string, user?: RbacUser, totpCode?: string) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    this.assertMissionReportEditAccess(user);

    const code = String(totpCode ?? '')
      .replace(/\s/g, '')
      .trim();
    if (!code) throwError('AUTH_2FA_INVALID_CODE');

    const signer = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        totpSecret: true,
        totpEnabled: true,
      },
    });
    if (!signer?.totpEnabled || !signer?.totpSecret) {
      throwError('AUTH_2FA_INVALID_CODE');
    }
    const encKey =
      this.getConfigValue('TOTP_ENCRYPTION_KEY') ??
      this.getConfigValue('JWT_ACCESS_SECRET') ??
      'fallback-totp-key';
    const secretBase32 = decryptSecret(signer.totpSecret, encKey);
    if (!verifyTotpCode(secretBase32, code)) {
      throwError('AUTH_2FA_INVALID_CODE');
    }

    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        report: {
          include: {
            signatures: {
              where: { removedAt: null },
              select: { id: true, signedById: true },
            },
          },
        },
      },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    this.assertMissionReportScope(mission);
    if (!mission.report || !this.isMissionReportFilled(mission.report)) {
      throwError('VALIDATION_ERROR', {
        reason: 'MISSION_REPORT_EMPTY',
        field: 'contentHtml',
      });
    }
    if (
      mission.report.signatures.some(
        (signature) => signature.signedById === user.id,
      )
    ) {
      throwError('VALIDATION_ERROR', {
        reason: 'MISSION_REPORT_ALREADY_SIGNED',
        field: 'signedById',
      });
    }

    const signedAt = new Date();
    const payload = {
      mission: {
        id: mission.id,
        title: mission.title,
        localityId: mission.localityId,
        locality: mission.locality,
        startDate: mission.startDate.toISOString(),
        endDate: mission.endDate.toISOString(),
      },
      report: {
        id: mission.report.id,
        contentHash: createHash('sha256')
          .update(mission.report.contentHtml)
          .digest('hex'),
        textHash: createHash('sha256')
          .update(mission.report.contentText)
          .digest('hex'),
        updatedAt: mission.report.updatedAt.toISOString(),
      },
      signer: {
        userId: user.id,
        signedAt: signedAt.toISOString(),
      },
    };
    const serialized = JSON.stringify(payload);
    const payloadHash = createHash('sha256').update(serialized).digest('hex');
    const secret =
      this.getConfigValue('MISSION_SIGNATURE_SECRET') ??
      this.getConfigValue('JWT_ACCESS_SECRET') ??
      'cipavd-mission-signature';
    const signatureHash = createHmac('sha256', secret)
      .update(payloadHash)
      .digest('hex');

    const signature = await this.prisma.missionReportSignature.create({
      data: {
        reportId: mission.report.id,
        signedById: user.id,
        signedAt,
        signaturePayloadHash: payloadHash,
        signatureHash,
        signatureAlgorithm: 'HMAC-SHA256',
        signatureVersion: 1,
      },
      include: {
        signedBy: { select: { id: true, name: true, email: true } },
        removedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      resource: 'missions',
      action: 'sign_report',
      entityId: id,
      localityId: mission.localityId,
      diffJson: {
        signatureId: signature.id,
        signatureAlgorithm: signature.signatureAlgorithm,
        signatureVersion: signature.signatureVersion,
      },
    });

    return signature;
  }

  async removeReportSignature(
    id: string,
    signatureId: string,
    user?: RbacUser,
  ) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    this.assertMissionReportEditAccess(user);

    const signature = await this.prisma.missionReportSignature.findFirst({
      where: {
        id: signatureId,
        report: { missionId: id },
      },
      include: {
        report: {
          include: {
            mission: {
              select: { id: true, localityId: true, scope: true },
            },
          },
        },
        signedBy: { select: { id: true, name: true, email: true } },
        removedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!signature) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(signature.report.mission);
    this.assertMissionReportScope(signature.report.mission);

    if (signature.removedAt) {
      return signature;
    }

    const updated = await this.prisma.missionReportSignature.update({
      where: { id: signature.id },
      data: {
        removedAt: new Date(),
        removedById: user.id,
      },
      include: {
        signedBy: { select: { id: true, name: true, email: true } },
        removedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      resource: 'missions',
      action: 'remove_report_signature',
      entityId: id,
      localityId: signature.report.mission.localityId,
      diffJson: { signatureId: signature.id },
    });

    return updated;
  }

  async getChecklist(id: string, user?: RbacUser) {
    this.assertMissionAdvancedTabAccess(user);
    this.assertMissionAccess(user);
    const checklistConfig = await this.getMissionChecklistConfig();

    const mission = await this.prisma.mission.findUnique({
      where: { id },
      select: {
        id: true,
        localityId: true,
        scope: true,
        updatedAt: true,
        checklistJson: true,
      },
    });

    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    const checklistOmId =
      this.readStoredMissionChecklistOmId(mission.checklistJson) ??
      mission.localityId;
    const checklistOm =
      checklistOmId &&
      (await this.prisma.locality.findUnique({
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
      select: { id: true, localityId: true, scope: true },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    const checklistOmId = String(payload.omId ?? '').trim();
    if (!checklistOmId) {
      throwError('VALIDATION_ERROR', {
        field: 'omId',
        reason: 'REQUIRED',
      });
    }
    const omRow = await this.prisma.locality.findUnique({
      where: { id: checklistOmId },
      select: { id: true, catalogType: true },
    });
    if (!omRow) {
      throwError('VALIDATION_ERROR', {
        field: 'omId',
        reason: 'OM_NOT_FOUND',
      });
    }
    const expectedCatalog =
      mission.scope === ActivityScope.CIPAVD
        ? LocalityCatalogType.CIPAVD
        : LocalityCatalogType.SMIF;
    if (omRow.catalogType !== expectedCatalog) {
      throwError('VALIDATION_ERROR', {
        field: 'omId',
        reason: 'OM_CATALOG_MISMATCH',
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
      scope?: string;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const scope = this.normalizeMissionScope(payload.scope);
    const targetLocalityIds = await this.resolveAllowedLocalityIds(scope);
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
        scope,
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
    await this.assertMissionLocalityAllowed(existing);

    const targetLocalityIds = await this.resolveAllowedLocalityIds(
      existing.scope,
    );
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
    await this.assertMissionLocalityAllowed(existing);

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
    await this.assertMissionLocalityAllowed(mission);

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
    await this.assertMissionLocalityAllowed(mission);

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
    await this.assertMissionLocalityAllowed(mission);

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
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                scope: true,
                eventDate: true,
                status: true,
                localityId: true,
                activityType: { select: { id: true, name: true } },
              },
            },
            activityLinks: {
              orderBy: [{ createdAt: 'asc' }],
              include: {
                activity: {
                  select: {
                    id: true,
                    title: true,
                    scope: true,
                    eventDate: true,
                    status: true,
                    localityId: true,
                    activityType: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    return {
      mission: {
        id: mission.id,
        title: mission.title,
        description: mission.description,
        startDate: mission.startDate,
        endDate: mission.endDate,
        locality: mission.locality,
      },
      items: this.isAdmMissionsProfile(user)
        ? this.stripMissionScheduleActivityLinks(mission.scheduleItems)
        : mission.scheduleItems,
    };
  }

  async listBanners(missionId: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        banners: {
          orderBy: [
            { eventDate: 'asc' },
            { eventTime: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    return {
      mission: {
        id: mission.id,
        title: mission.title,
        scope: mission.scope,
        localityId: mission.localityId,
      },
      items: mission.banners,
    };
  }

  async createBanner(
    missionId: string,
    payload: {
      name: string;
      eventDate: string;
      eventTime: string;
      locationPrimary: string;
      locationSecondary?: string;
      layoutOverrides?: Record<string, unknown>;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    const normalizedLayoutOverrides =
      this.normalizeMissionBannerLayoutOverrides(payload.layoutOverrides);

    const created = await this.prisma.missionBanner.create({
      data: {
        missionId,
        name: this.sanitizeRequiredText(payload.name, 'name'),
        eventDate: this.normalizeBannerDate(payload.eventDate, 'eventDate'),
        eventTime: this.normalizeBannerTime(payload.eventTime, 'eventTime'),
        locationPrimary: this.sanitizeRequiredText(
          payload.locationPrimary,
          'locationPrimary',
        ),
        locationSecondary: this.normalizeOptionalBannerText(
          payload.locationSecondary,
        ),
        layoutOverrides: normalizedLayoutOverrides ?? Prisma.JsonNull,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'create_banner',
      entityId: created.id,
      localityId: mission.localityId,
      diffJson: {
        missionId,
        eventDate: created.eventDate,
        eventTime: created.eventTime,
      },
    });

    return created;
  }

  async updateBanner(
    missionId: string,
    bannerId: string,
    payload: {
      name?: string;
      eventDate?: string;
      eventTime?: string;
      locationPrimary?: string;
      locationSecondary?: string;
      layoutOverrides?: Record<string, unknown>;
    },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    const normalizedLayoutOverrides =
      payload.layoutOverrides === undefined
        ? undefined
        : this.normalizeMissionBannerLayoutOverrides(payload.layoutOverrides);

    const existing = await this.prisma.missionBanner.findFirst({
      where: { id: bannerId, missionId },
    });
    if (!existing) throwError('NOT_FOUND');

    const updated = await this.prisma.missionBanner.update({
      where: { id: bannerId },
      data: {
        name:
          payload.name === undefined
            ? undefined
            : this.sanitizeRequiredText(payload.name, 'name'),
        eventDate:
          payload.eventDate === undefined
            ? undefined
            : this.normalizeBannerDate(payload.eventDate, 'eventDate'),
        eventTime:
          payload.eventTime === undefined
            ? undefined
            : this.normalizeBannerTime(payload.eventTime, 'eventTime'),
        locationPrimary:
          payload.locationPrimary === undefined
            ? undefined
            : this.sanitizeRequiredText(
                payload.locationPrimary,
                'locationPrimary',
              ),
        locationSecondary:
          payload.locationSecondary === undefined
            ? undefined
            : this.normalizeOptionalBannerText(payload.locationSecondary),
        layoutOverrides:
          normalizedLayoutOverrides === undefined
            ? undefined
            : (normalizedLayoutOverrides ?? Prisma.JsonNull),
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'update_banner',
      entityId: bannerId,
      localityId: mission.localityId,
      diffJson: {
        missionId,
        before: {
          eventDate: existing.eventDate,
          eventTime: existing.eventTime,
          locationPrimary: existing.locationPrimary,
          locationSecondary: existing.locationSecondary,
          layoutOverrides: existing.layoutOverrides,
        },
        after: {
          eventDate: updated.eventDate,
          eventTime: updated.eventTime,
          locationPrimary: updated.locationPrimary,
          locationSecondary: updated.locationSecondary,
          layoutOverrides: updated.layoutOverrides,
        },
      },
    });

    return updated;
  }

  async deleteBanner(missionId: string, bannerId: string, user?: RbacUser) {
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    const existing = await this.prisma.missionBanner.findFirst({
      where: { id: bannerId, missionId },
      select: { id: true, name: true },
    });
    if (!existing) throwError('NOT_FOUND');

    await this.prisma.missionBanner.delete({ where: { id: bannerId } });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'delete_banner',
      entityId: bannerId,
      localityId: mission.localityId,
      diffJson: { missionId, name: existing.name },
    });

    return { ok: true };
  }

  async buildBannerPng(missionId: string, bannerId: string, user?: RbacUser) {
    this.assertMissionAccess(user);
    const result = await this.getMissionBannerOrThrow(missionId, bannerId);
    return renderMissionBannerPng(this.serializeBanner(result.banner));
  }

  async buildBannerDownload(
    missionId: string,
    bannerId: string,
    formatRaw: string | undefined,
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const banner = await this.getMissionBannerOrThrow(missionId, bannerId);
    const format = this.normalizeBannerDownloadFormat(formatRaw);
    const renderable = this.serializeBanner(banner.banner);
    const baseFileName = this.sanitizeBannerFileName(
      banner.mission.title,
      banner.banner.name,
    );

    if (format === 'pdf') {
      return {
        contentType: 'application/pdf',
        fileName: `${baseFileName}.pdf`,
        buffer: await renderMissionBannerPdf(renderable),
      };
    }

    return {
      contentType: 'image/png',
      fileName: `${baseFileName}.png`,
      buffer: await renderMissionBannerPng(renderable),
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
    await this.assertMissionLocalityAllowed(mission);

    const created = await this.prisma.missionScheduleItem.create({
      data: {
        missionId,
        title: this.sanitizeRequiredText(payload.title, 'title'),
        startAt: this.parseScheduleDateTime(payload.startAt, 'startAt'),
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
    await this.assertMissionLocalityAllowed(mission);

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
            : this.parseScheduleDateTime(payload.startAt, 'startAt'),
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
    this.assertMissionScheduleDeleteAccess(user);
    this.assertMissionAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

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

  async upsertScheduleFieldActivities(
    missionId: string,
    payload: { items: MissionScheduleFieldActivityPayload[] },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);
    const normalizedItems = this.normalizeScheduleFieldActivityItems(
      payload.items,
    );
    if (normalizedItems.length === 0) {
      throwError('VALIDATION_ERROR', {
        field: 'items',
        reason: 'REQUIRED',
      });
    }

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        scheduleItems: {
          where: {
            id: {
              in: normalizedItems.map((item) => item.scheduleItemId),
            },
          },
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                scope: true,
                eventDate: true,
                status: true,
                localityId: true,
              },
            },
            activityLinks: {
              orderBy: [{ createdAt: 'asc' }],
              include: {
                activity: {
                  select: {
                    id: true,
                    title: true,
                    scope: true,
                    eventDate: true,
                    status: true,
                    localityId: true,
                    activityType: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      } as any,
    } as any);
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    const scheduleItemById = new Map<string, any>(
      ((mission as any).scheduleItems ?? []).map(
        (item: any) => [String(item.id), item] as [string, any],
      ),
    );
    const missingScheduleItemIds = normalizedItems
      .map((item) => item.scheduleItemId)
      .filter((itemId) => !scheduleItemById.has(itemId));
    if (missingScheduleItemIds.length > 0) {
      throwError('VALIDATION_ERROR', {
        field: 'scheduleItemId',
        reason: 'SCHEDULE_ITEM_NOT_FOUND',
        ids: missingScheduleItemIds,
      });
    }

    const existingActivityIds = normalizedItems
      .filter((item) => item.action === 'LINK')
      .map((item) => String(item.activityId ?? '').trim())
      .filter(Boolean);
    const existingActivities =
      existingActivityIds.length > 0
        ? await this.prisma.activity.findMany({
            where: { id: { in: existingActivityIds } },
            select: {
              id: true,
              title: true,
              scope: true,
              localityId: true,
              eventDate: true,
              status: true,
              activityType: { select: { id: true, name: true } },
            } as any,
          } as any)
        : [];
    const activityById = new Map(
      existingActivities.map((activity: any) => [
        String(activity.id),
        activity,
      ]),
    );

    const preparedCreates: Array<{
      input: MissionScheduleFieldActivityPayload;
      scheduleItem: any;
      title: string;
      eventDate: Date | null;
      activityTypeId: string | null;
      specialtyIds: string[];
      primarySpecialtyId: string | null;
      responsibleUserIds: string[];
    }> = [];
    const preparedLinks: Array<{
      input: MissionScheduleFieldActivityPayload;
      scheduleItem: any;
      activity: any;
    }> = [];

    for (const input of normalizedItems) {
      const scheduleItem = scheduleItemById.get(input.scheduleItemId);
      if (!scheduleItem) continue;

      if (input.action === 'LINK') {
        this.assertMissionFieldActivityPermission('LINK', user);
        const activityId = String(input.activityId ?? '').trim();
        if (!activityId) {
          throwError('VALIDATION_ERROR', {
            field: 'activityId',
            reason: 'REQUIRED',
            scheduleItemId: input.scheduleItemId,
          });
        }
        const activity = activityById.get(activityId);
        if (!activity || activity.scope !== mission.scope) {
          throwError('VALIDATION_ERROR', {
            field: 'activityId',
            reason: 'ACTIVITY_NOT_FOUND_FOR_SCOPE',
            scheduleItemId: input.scheduleItemId,
          });
        }
        if (
          activity.localityId &&
          String(activity.localityId) !== String(mission.localityId)
        ) {
          throwError('VALIDATION_ERROR', {
            field: 'activityId',
            reason: 'ACTIVITY_LOCALITY_MISMATCH',
            scheduleItemId: input.scheduleItemId,
          });
        }
        preparedLinks.push({ input, scheduleItem, activity });
        continue;
      }

      this.assertMissionFieldActivityPermission('CREATE', user);

      const specialtyIds = await this.resolveMissionActivitySpecialtyIds(
        input.specialtyIds,
      );
      preparedCreates.push({
        input,
        scheduleItem,
        title: this.sanitizeRequiredText(
          input.title ?? scheduleItem.title ?? '',
          'title',
        ),
        eventDate: this.normalizeMissionFieldActivityDate(
          input.eventDate,
          scheduleItem.startAt,
        ),
        activityTypeId: await this.resolveMissionActivityTypeId(
          input.activityTypeId,
          mission.scope,
        ),
        specialtyIds,
        primarySpecialtyId: specialtyIds[0] ?? null,
        responsibleUserIds: await this.resolveMissionActivityResponsibleIds(
          input.responsibleUserIds ?? [],
        ),
      });
    }

    const legacyLinkedScheduleItemIds = new Set(
      Array.from(scheduleItemById.values())
        .filter((item: any) => String(item?.activityId ?? '').trim())
        .map((item: any) => String(item.id)),
    );

    const results = await this.prisma.$transaction(async (tx) => {
      const createdResults: Array<{
        scheduleItemId: string;
        activityId: string;
        activityTitle: string;
        action: 'CREATE';
      }> = [];
      const linkedResults: Array<{
        scheduleItemId: string;
        activityId: string;
        activityTitle: string;
        action: 'LINK';
      }> = [];

      for (const prepared of preparedCreates) {
        const activity = await (tx as any).activity.create({
          data: {
            title: prepared.title,
            description: this.buildMissionFieldActivityDescription(
              mission,
              prepared.scheduleItem,
            ),
            localityId: mission.localityId,
            activityTypeId: prepared.activityTypeId,
            specialtyId: prepared.primarySpecialtyId,
            eventDate: prepared.eventDate,
            reportRequired: prepared.input.reportRequired ?? true,
            scope: mission.scope,
            createdById: user?.id ?? null,
            specialties:
              prepared.specialtyIds.length > 0
                ? {
                    createMany: {
                      data: prepared.specialtyIds.map((specialtyId) => ({
                        specialtyId,
                      })),
                      skipDuplicates: true,
                    },
                  }
                : undefined,
            responsibles:
              prepared.responsibleUserIds.length > 0
                ? {
                    create: prepared.responsibleUserIds.map((userId) => ({
                      userId,
                      assignedById: user?.id ?? null,
                    })),
                  }
                : undefined,
            visitScheduleItems: {
              create: {
                title:
                  String(prepared.scheduleItem.title ?? '').trim() ||
                  prepared.title,
                startTime: this.formatMissionScheduleItemTime(
                  prepared.scheduleItem.startAt,
                ),
                durationMinutes: prepared.scheduleItem.durationMinutes,
                location:
                  String(prepared.scheduleItem.location ?? '').trim() ||
                  String((mission as any).locality?.name ?? '').trim() ||
                  'Local não informado',
                responsible:
                  String(prepared.scheduleItem.responsible ?? '').trim() ||
                  'Responsável não informado',
                participants:
                  String(prepared.scheduleItem.participants ?? '').trim() ||
                  'Participantes não informados',
              },
            },
          } as any,
          select: { id: true, title: true },
        });

        await (tx as any).missionScheduleItemActivity.upsert({
          where: {
            scheduleItemId_activityId: {
              scheduleItemId: prepared.scheduleItem.id,
              activityId: activity.id,
            },
          },
          update: {},
          create: {
            scheduleItemId: prepared.scheduleItem.id,
            activityId: activity.id,
          },
        });
        if (
          !legacyLinkedScheduleItemIds.has(String(prepared.scheduleItem.id))
        ) {
          await (tx as any).missionScheduleItem.update({
            where: { id: prepared.scheduleItem.id },
            data: { activityId: activity.id },
          });
          legacyLinkedScheduleItemIds.add(String(prepared.scheduleItem.id));
        }
        createdResults.push({
          scheduleItemId: prepared.scheduleItem.id,
          activityId: activity.id,
          activityTitle: activity.title,
          action: 'CREATE',
        });
      }

      for (const prepared of preparedLinks) {
        await (tx as any).missionScheduleItemActivity.upsert({
          where: {
            scheduleItemId_activityId: {
              scheduleItemId: prepared.scheduleItem.id,
              activityId: prepared.activity.id,
            },
          },
          update: {},
          create: {
            scheduleItemId: prepared.scheduleItem.id,
            activityId: prepared.activity.id,
          },
        });
        if (
          !legacyLinkedScheduleItemIds.has(String(prepared.scheduleItem.id))
        ) {
          await (tx as any).missionScheduleItem.update({
            where: { id: prepared.scheduleItem.id },
            data: { activityId: prepared.activity.id },
          });
          legacyLinkedScheduleItemIds.add(String(prepared.scheduleItem.id));
        }
        linkedResults.push({
          scheduleItemId: prepared.scheduleItem.id,
          activityId: prepared.activity.id,
          activityTitle: prepared.activity.title,
          action: 'LINK',
        });
      }

      return [...createdResults, ...linkedResults];
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'missions',
      action: 'upsert_schedule_field_activities',
      entityId: mission.id,
      localityId: mission.localityId,
      diffJson: {
        missionId: mission.id,
        scope: mission.scope,
        created: results.filter((item) => item.action === 'CREATE').length,
        linked: results.filter((item) => item.action === 'LINK').length,
        scheduleItemIds: results.map((item) => item.scheduleItemId),
        activityIds: results.map((item) => item.activityId),
      },
    });

    return {
      missionId: mission.id,
      scope: mission.scope,
      created: results.filter((item) => item.action === 'CREATE').length,
      linked: results.filter((item) => item.action === 'LINK').length,
      items: results,
    };
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
    await this.assertMissionLocalityAllowed(mission);

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
    const missionPeriod = `${this.formatMissionPeriodDate(mission.startDate)} a ${this.formatMissionPeriodDate(mission.endDate)}`;
    const participantOmSuffixes =
      await this.buildMissionParticipantOmSuffixSet();
    const participantNames = mission.participants.map((participant) => {
      const baseName =
        participant.name ||
        participant.email ||
        participant.cpf ||
        'Participante';
      return this.removeOmFromParticipantName(
        baseName,
        participant.fabom,
        participantOmSuffixes,
      );
    });
    const participantsLabel =
      mission.participants.length > 0
        ? this.sortParticipantsByRankSeniority(participantNames).join(', ')
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

    const buildScheduleRowData = (
      item: (typeof mission.scheduleItems)[number],
    ) => {
      const endAt = new Date(
        item.startAt.getTime() + item.durationMinutes * 60_000,
      );
      return {
        time: `${this.formatTime(item.startAt, missionTimeZone)} - ${this.formatTime(endAt, missionTimeZone)}`,
        duration: this.formatDuration(item.durationMinutes),
        activity: item.title || '-',
        location: item.location || '-',
        responsible: item.responsible || '-',
        participants: this.formatParticipantTextForPdf(
          item.participants,
          participantOmSuffixes,
        ),
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
        moveDayBlockToNextPageWhenPossible(
          measureDayBlockHeight(dayGroup.items),
        );
        const firstRowData = buildScheduleRowData(firstItem);
        drawDayBlockHeader(
          dayGroup.label,
          measureScheduleRowHeight(firstRowData),
        );

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

  async buildMissionReportPdf(missionId: string, user?: RbacUser) {
    this.assertMissionAccess(user);
    const syncedReport = await this.ensureMissionReportSynchronized(
      missionId,
      user,
    );
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        locality: { select: { id: true, code: true, name: true } },
      },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    this.assertMissionReportScope(mission);

    const document = this.normalizeMissionReportBlocksDocument(
      (syncedReport as any).blocksJson,
      syncedReport,
    );
    const activeSignatures = ((syncedReport as any).signatures ?? []).filter(
      (signature: any) => !signature.removedAt,
    );

    const doc = new PDFDocument({
      margin: 48,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Relatório da Missão - ${mission.title}`,
        Author: 'CIPAVD',
      },
    });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const palette = {
      primary: '#123A63',
      secondary: '#0C657E',
      soft: '#EEF5FA',
      border: '#CBD7E3',
      text: '#172033',
      muted: '#5B677A',
      success: '#1F7A4D',
      warning: '#9A6700',
    };
    const contentLeft = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footerReserve = 42;
    const pageBottom = () =>
      doc.page.height - doc.page.margins.bottom - footerReserve;
    const pageContentHeight = () => pageBottom() - doc.page.margins.top;
    const ensureSpace = (height: number) => {
      const neededHeight = Math.min(Math.max(height, 0), pageContentHeight());
      if (doc.y + neededHeight <= pageBottom()) return;
      doc.addPage();
      doc.y = doc.page.margins.top;
    };
    const writeMetadataRow = (label: string, value: string) => {
      const labelWidth = 118;
      const valueWidth = contentWidth - labelWidth - 16;
      const valueText = sanitizeText(value || '-').trim() || '-';
      doc.font('Helvetica').fontSize(9.5);
      const rowHeight = Math.max(
        26,
        doc.heightOfString(valueText, { width: valueWidth }) + 12,
      );

      if (rowHeight > pageContentHeight()) {
        ensureSpace(32);
        const headerY = doc.y;
        doc
          .fillColor(palette.soft)
          .rect(contentLeft, headerY, contentWidth, 24)
          .fill()
          .strokeColor(palette.border)
          .rect(contentLeft, headerY, contentWidth, 24)
          .stroke();
        doc
          .fillColor(palette.text)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(label, contentLeft + 8, headerY + 7, {
            width: contentWidth - 16,
          });
        doc.y = headerY + 30;
        doc
          .fillColor(palette.text)
          .font('Helvetica')
          .fontSize(9.5)
          .text(valueText, contentLeft, doc.y, {
            width: contentWidth,
            lineGap: 1,
          });
        doc.moveDown(0.6);
        return;
      }

      ensureSpace(rowHeight + 4);
      const y = doc.y;
      doc
        .fillColor(palette.soft)
        .rect(contentLeft, y, labelWidth, rowHeight)
        .fill()
        .strokeColor(palette.border)
        .rect(contentLeft, y, contentWidth, rowHeight)
        .stroke();
      doc
        .fillColor(palette.text)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(label, contentLeft + 8, y + 8, { width: labelWidth - 16 });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .text(valueText, contentLeft + labelWidth + 8, y + 8, {
          width: valueWidth,
        });
      doc.y = y + rowHeight + 4;
    };
    const writeSectionTitle = (title: string, level: 1 | 2 = 1) => {
      const gap = level === 1 ? 10 : 5;
      const fontSize = level === 1 ? 13 : 11.5;
      doc.font('Helvetica-Bold').fontSize(fontSize);
      const titleHeight = doc.heightOfString(title, { width: contentWidth });
      ensureSpace(gap + titleHeight + 14);
      doc.y += gap;
      const y = doc.y;
      doc
        .fillColor(level === 1 ? palette.primary : palette.secondary)
        .font('Helvetica-Bold')
        .fontSize(fontSize)
        .text(title, contentLeft, y, {
          width: contentWidth,
          align: 'left',
        });
      doc
        .moveTo(contentLeft, doc.y + 3)
        .lineTo(contentLeft + contentWidth, doc.y + 3)
        .strokeColor(level === 1 ? palette.primary : palette.secondary)
        .lineWidth(0.8)
        .stroke();
      doc.y += 10;
      doc.fillColor(palette.text);
    };
    const writeParagraph = (value: string) => {
      const text = sanitizeText(value ?? '').trim();
      if (!text) return;
      doc.font('Helvetica').fontSize(10.5);
      const height = doc.heightOfString(text, {
        width: contentWidth,
        align: 'justify',
        lineGap: 2,
      });
      ensureSpace(Math.min(height + 12, pageContentHeight()));
      doc
        .fillColor(palette.text)
        .font('Helvetica')
        .fontSize(10.5)
        .text(text, contentLeft, doc.y, {
          width: contentWidth,
          align: 'justify',
          lineGap: 2,
        });
      doc.moveDown(0.7);
    };
    const writeFieldBox = (fields: MissionReportFieldValues) => {
      const rows = [
        ['Horário', fields.time],
        ['Local', fields.location],
        ['Responsável', fields.responsible],
        ['Participantes', fields.participants],
      ];
      for (const [label, value] of rows) {
        writeMetadataRow(label, value || '-');
      }
    };

    const logoPath = this.findScheduleLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, contentLeft, doc.y, { fit: [92, 60] });
      } catch {
        // Mantém a capa mesmo se a imagem institucional não estiver disponível.
      }
    }
    doc
      .fillColor(palette.primary)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('RELATÓRIO DA MISSÃO', contentLeft + 108, doc.y + 8, {
        width: contentWidth - 108,
        align: 'right',
      });
    doc
      .fillColor(palette.secondary)
      .fontSize(11)
      .text('Comissão de Iniciação de Recrutamento Feminino', {
        width: contentWidth - 108,
        align: 'right',
      });
    doc.y = 150;
    doc
      .fillColor(palette.primary)
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(mission.title, contentLeft, doc.y, {
        width: contentWidth,
        align: 'center',
      });
    doc.moveDown(1.4);
    writeMetadataRow(
      'Localidade',
      mission.locality
        ? `${mission.locality.name} (${mission.locality.code ?? '-'})`
        : '-',
    );
    writeMetadataRow(
      'Período',
      `${this.formatMissionPeriodDate(mission.startDate)} a ${this.formatMissionPeriodDate(mission.endDate)}`,
    );
    writeMetadataRow('Escopo', 'CIPAVD');
    writeMetadataRow(
      'Status',
      activeSignatures.length > 0
        ? `Assinado digitalmente por ${activeSignatures.length} usuário(s)`
        : 'Não assinado',
    );
    writeMetadataRow(
      'Gerado em',
      this.formatDateTimeForMissionReport(new Date()),
    );

    doc.addPage();
    doc.y = doc.page.margins.top;
    let currentDayNumber = 0;
    let currentActivityNumber = 0;
    for (const block of document.blocks) {
      if (block.type === 'day_heading') {
        currentDayNumber += 1;
        currentActivityNumber = 0;
        const label =
          block.dayLabel?.trim() ||
          (block.dayKey
            ? this.formatMissionReportDayLabelFromKey(block.dayKey)
            : 'Dia da missão');
        writeSectionTitle(`${currentDayNumber} - ${label}`, 1);
        continue;
      }
      if (block.type === 'field_activity') {
        if (currentDayNumber === 0) currentDayNumber = 1;
        currentActivityNumber += 1;
        const fields = block.fields ?? this.emptyMissionReportFieldValues();
        writeSectionTitle(
          `${currentDayNumber}.${currentActivityNumber} - Atividade de Campo ${fields.title || 'Atividade'}`,
          2,
        );
        writeFieldBox(fields);
        writeParagraph(
          block.contentText || this.stripMissionReportHtml(block.contentHtml),
        );
        continue;
      }
      writeParagraph(
        block.contentText || this.stripMissionReportHtml(block.contentHtml),
      );
    }

    writeSectionTitle('Assinaturas Digitais', 1);
    if (activeSignatures.length === 0) {
      writeParagraph(
        'Este relatório ainda não possui assinatura digital ativa.',
      );
    } else {
      for (const signature of activeSignatures) {
        writeMetadataRow(
          signature.signedBy?.name ?? signature.signedById ?? 'Usuário',
          `Assinado em ${this.formatDateTimeForMissionReport(signature.signedAt)} | Hash ${String(
            signature.signatureHash ?? '',
          ).slice(0, 32)}...`,
        );
      }
    }

    const range = doc.bufferedPageRange();
    for (
      let pageIndex = range.start;
      pageIndex < range.start + range.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);
      const footerY = doc.page.height - doc.page.margins.bottom - 8;
      doc
        .strokeColor(palette.border)
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, footerY - 8)
        .lineTo(doc.page.width - doc.page.margins.right, footerY - 8)
        .stroke();
      doc
        .fillColor(palette.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Relatório da Missão | Página ${pageIndex + 1 - range.start} de ${range.count}`,
          doc.page.margins.left,
          footerY,
          {
            width:
              doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: 'center',
          },
        );
    }

    doc.end();
    const buffer = await done;
    const sanitizedTitle = mission.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70)
      .toLowerCase();
    return {
      fileName: `relatorio-missao-${sanitizedTitle || mission.id}.pdf`,
      buffer,
    };
  }

  private normalizeScheduleFieldActivityItems(
    items: MissionScheduleFieldActivityPayload[] | undefined,
  ) {
    const normalized: MissionScheduleFieldActivityPayload[] = [];
    for (const raw of items ?? []) {
      const scheduleItemId = String(raw?.scheduleItemId ?? '').trim();
      if (!scheduleItemId) continue;
      const action =
        String(raw?.action ?? '').toUpperCase() === 'LINK' ? 'LINK' : 'CREATE';
      normalized.push({
        scheduleItemId,
        action,
        activityId:
          raw.activityId === undefined
            ? undefined
            : String(raw.activityId ?? '').trim(),
        title: raw.title,
        activityTypeId:
          raw.activityTypeId === undefined
            ? undefined
            : String(raw.activityTypeId ?? '').trim(),
        specialtyIds: Array.isArray(raw.specialtyIds)
          ? raw.specialtyIds
              .map((value) => String(value ?? '').trim())
              .filter(Boolean)
          : [],
        responsibleUserIds: Array.isArray(raw.responsibleUserIds)
          ? raw.responsibleUserIds
              .map((value) => String(value ?? '').trim())
              .filter(Boolean)
          : [],
        eventDate:
          raw.eventDate === undefined
            ? undefined
            : String(raw.eventDate ?? '').trim(),
        reportRequired: raw.reportRequired,
      });
    }
    return normalized;
  }

  private assertMissionFieldActivityPermission(
    action: 'CREATE' | 'LINK',
    user?: RbacUser,
  ) {
    const requirement =
      action === 'CREATE'
        ? { resource: 'task_instances', action: 'create' }
        : { resource: 'task_instances', action: 'update' };
    if (hasPermission(user, requirement.resource, requirement.action)) return;
    throwError('RBAC_FORBIDDEN');
  }

  private async resolveMissionActivityTypeId(
    activityTypeId: string | null | undefined,
    scope: ActivityScope,
  ) {
    const normalized = String(activityTypeId ?? '').trim();
    if (!normalized) return null;
    const existing = await (this.prisma as any).activityType.findUnique({
      where: { id: normalized },
      select: { id: true, scope: true },
    });
    if (!existing || existing.scope !== scope) {
      throwError('VALIDATION_ERROR', {
        field: 'activityTypeId',
        reason: 'NOT_FOUND',
      });
    }
    return existing.id as string;
  }

  private async resolveMissionActivitySpecialtyIds(
    specialtyIdsRaw: string[] | undefined,
  ) {
    const normalized = Array.from(
      new Set(
        (specialtyIdsRaw ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    if (normalized.length === 0) {
      const commission = await this.prisma.specialty.findFirst({
        where: {
          OR: [
            { name: { equals: 'Comissão CIPAVD', mode: 'insensitive' } },
            { name: { equals: 'Comissao CIPAVD', mode: 'insensitive' } },
            { name: { contains: 'Comissão CIPAVD', mode: 'insensitive' } },
            { name: { contains: 'Comissao CIPAVD', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      return commission?.id ? [commission.id] : [];
    }

    const existing = await this.prisma.specialty.findMany({
      where: { id: { in: normalized } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((item) => item.id));
    const invalid = normalized.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) {
      throwError('VALIDATION_ERROR', {
        field: 'specialtyIds',
        reason: 'NOT_FOUND',
        ids: invalid,
      });
    }
    return normalized;
  }

  private async resolveMissionActivityResponsibleIds(
    responsibleUserIdsRaw: string[] | undefined,
  ) {
    const normalized = Array.from(
      new Set(
        (responsibleUserIdsRaw ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (normalized.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: normalized },
        isActive: true,
      },
      select: { id: true },
    });
    if (users.length !== normalized.length) {
      throwError('VALIDATION_ERROR', {
        field: 'responsibleUserIds',
        reason: 'ACTIVITY_RESPONSIBLE_INVALID',
      });
    }
    return normalized;
  }

  private normalizeMissionFieldActivityDate(
    rawDate: string | null | undefined,
    fallback: Date,
  ) {
    const value = String(rawDate ?? '').trim();
    if (!value) {
      return this.dateOnlyFromMissionScheduleStart(fallback);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return this.dateOnlyFromMissionScheduleStart(parsed);
    }
    throwError('VALIDATION_ERROR', {
      field: 'eventDate',
      reason: 'DATE_INVALID',
    });
  }

  private dateOnlyFromMissionScheduleStart(value: Date) {
    const { year, month, day } = this.getDateTimePartsInTimeZone(value);
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  private formatMissionScheduleItemTime(value: Date) {
    return this.formatTime(value);
  }

  private buildMissionFieldActivityDescription(
    mission: any,
    scheduleItem: any,
  ) {
    const lines = [
      `Gerada a partir do cronograma da missão "${mission.title}".`,
      String(scheduleItem.location ?? '').trim()
        ? `Local no cronograma: ${String(scheduleItem.location).trim()}`
        : '',
      String(scheduleItem.responsible ?? '').trim()
        ? `Responsável no cronograma: ${String(scheduleItem.responsible).trim()}`
        : '',
      String(scheduleItem.participants ?? '').trim()
        ? `Participantes no cronograma: ${String(scheduleItem.participants).trim()}`
        : '',
    ].filter(Boolean);
    return sanitizeText(lines.join('\n'));
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
        typeof rawItem.classification === 'string'
          ? rawItem.classification
          : '';

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
            ? (rawItem.photos as Prisma.JsonValue[]).filter(
                (entry): entry is string => typeof entry === 'string',
              )
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

    const sectionGroups = new Map<
      MissionChecklistSectionId,
      MissionChecklistSectionRuntime['items']
    >(MISSION_CHECKLIST_SECTION_IDS.map((sectionId) => [sectionId, []]));

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

    let sections: MissionChecklistSectionRuntime[] =
      MISSION_CHECKLIST_SECTION_IDS.map((sectionId) => ({
        id: sectionId,
        title: MISSION_CHECKLIST_SECTION_TITLE_BY_ID[sectionId],
        items: sectionGroups.get(sectionId) ?? [],
      }));

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
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'pt-BR'),
      );

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
      : (classifications[0]?.id ?? DEFAULT_MISSION_CHECKLIST_CLASSIFICATION);

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
    return (MISSION_CHECKLIST_CLASSIFICATIONS as readonly string[]).includes(
      value,
    );
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

  private async ensureMissionReportSynchronized(
    missionId: string,
    user?: RbacUser,
  ) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        scheduleItems: {
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
          include: {
            activity: {
              include: {
                visitScheduleItems: {
                  orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
            activityLinks: {
              orderBy: [{ createdAt: 'asc' }],
              include: {
                activity: {
                  include: {
                    activityType: { select: { id: true, name: true } },
                    visitScheduleItems: {
                      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
                    },
                  },
                },
              },
            },
          },
        },
        report: {
          include: {
            signatures: {
              orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
              include: {
                signedBy: { select: { id: true, name: true, email: true } },
                removedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      } as any,
    } as any);
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
    this.assertMissionReportScope(mission);

    const sourceActivities = this.buildMissionReportSourceActivities(mission);
    const currentDocument = this.normalizeMissionReportBlocksDocument(
      (mission as any).report?.blocksJson,
      (mission as any).report,
    );
    const nextDocument = this.synchronizeMissionReportBlocks(
      currentDocument,
      sourceActivities,
    );
    const rendered = this.renderMissionReportDocument(nextDocument);
    const currentReport = (mission as any).report ?? null;
    const nextBlocksJson = nextDocument as unknown as Prisma.JsonObject;
    const blocksChanged =
      JSON.stringify(currentReport?.blocksJson ?? null) !==
      JSON.stringify(nextBlocksJson);
    const contentChanged =
      !currentReport ||
      currentReport.contentHtml !== rendered.contentHtml ||
      currentReport.contentText !== rendered.contentText ||
      blocksChanged;

    const report = await this.prisma.$transaction(async (tx) => {
      const saved = currentReport
        ? await (tx.missionReport as any).update({
            where: { id: currentReport.id },
            data: {
              blocksJson: nextBlocksJson,
              contentHtml: rendered.contentHtml,
              contentText: rendered.contentText,
            },
          })
        : await (tx.missionReport as any).create({
            data: {
              missionId,
              blocksJson: nextBlocksJson,
              contentHtml: rendered.contentHtml,
              contentText: rendered.contentText,
            },
          });

      if (contentChanged) {
        await tx.missionReportSignature.updateMany({
          where: { reportId: saved.id, removedAt: null },
          data: {
            removedAt: new Date(),
            removedById: user?.id ?? null,
          },
        });
      }

      return tx.missionReport.findUnique({
        where: { id: saved.id },
        include: {
          signatures: {
            orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
            include: {
              signedBy: { select: { id: true, name: true, email: true } },
              removedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });
    if (!report) throwError('UNEXPECTED');
    return { ...report, filled: this.isMissionReportFilled(report) };
  }

  private buildMissionReportSourceActivities(
    mission: any,
  ): MissionReportSourceActivity[] {
    const sources = new Map<string, MissionReportSourceActivity>();
    const scheduleItems = Array.isArray(mission?.scheduleItems)
      ? mission.scheduleItems
      : [];

    for (const scheduleItem of scheduleItems) {
      const linkedActivities: any[] = [];
      if (scheduleItem?.activity) {
        linkedActivities.push(scheduleItem.activity);
      }
      for (const link of scheduleItem?.activityLinks ?? []) {
        if (link?.activity) linkedActivities.push(link.activity);
      }

      const uniqueActivities = new Map<string, any>();
      for (const activity of linkedActivities) {
        const activityId = String(activity?.id ?? '').trim();
        if (activityId) uniqueActivities.set(activityId, activity);
      }

      for (const activity of uniqueActivities.values()) {
        const activityId = String(activity?.id ?? '').trim();
        const sourceKey = this.buildMissionReportSourceKey(
          scheduleItem.id,
          activityId,
        );
        if (sources.has(sourceKey)) continue;
        const fields = this.buildMissionReportSourceFields(
          mission,
          scheduleItem,
          activity,
        );
        sources.set(sourceKey, {
          sourceKey,
          scheduleItemId: String(scheduleItem.id),
          activityId,
          dayKey: this.formatMissionReportDayKey(scheduleItem.startAt),
          dayLabel: this.formatMissionReportDayLabel(scheduleItem.startAt),
          fields,
        });
      }
    }

    return Array.from(sources.values()).sort((a, b) => {
      const dayCompare = a.dayKey.localeCompare(b.dayKey);
      if (dayCompare !== 0) return dayCompare;
      return a.sourceKey.localeCompare(b.sourceKey);
    });
  }

  private buildMissionReportSourceFields(
    mission: any,
    scheduleItem: any,
    activity: any,
  ): MissionReportFieldValues {
    const firstVisit = Array.isArray(activity?.visitScheduleItems)
      ? activity.visitScheduleItems[0]
      : null;
    const title =
      sanitizeText(activity?.title ?? '').trim() ||
      sanitizeText(scheduleItem?.title ?? '').trim() ||
      'Atividade';
    const endAt = new Date(
      new Date(scheduleItem.startAt).getTime() +
        Number(scheduleItem.durationMinutes ?? 0) * 60_000,
    );
    const scheduleTime = `${this.formatTime(scheduleItem.startAt)} - ${this.formatTime(endAt)}`;
    const visitTime = firstVisit?.startTime
      ? `${sanitizeText(firstVisit.startTime)} - ${this.addMinutesToTimeLabel(
          firstVisit.startTime,
          Number(firstVisit.durationMinutes ?? scheduleItem.durationMinutes),
        )}`
      : '';
    return {
      title,
      date: this.formatMissionReportDayLabel(scheduleItem.startAt),
      time: visitTime || scheduleTime,
      location:
        sanitizeText(firstVisit?.location ?? '').trim() ||
        sanitizeText(scheduleItem?.location ?? '').trim() ||
        sanitizeText(mission?.locality?.name ?? '').trim() ||
        'Local não informado',
      responsible:
        sanitizeText(firstVisit?.responsible ?? '').trim() ||
        sanitizeText(scheduleItem?.responsible ?? '').trim() ||
        'Responsável não informado',
      participants:
        sanitizeText(firstVisit?.participants ?? '').trim() ||
        sanitizeText(scheduleItem?.participants ?? '').trim() ||
        'Participantes não informados',
    };
  }

  private synchronizeMissionReportBlocks(
    document: MissionReportBlocksDocument,
    sources: MissionReportSourceActivity[],
  ): MissionReportBlocksDocument {
    const sourceByKey = new Map(
      sources.map((source) => [source.sourceKey, source]),
    );
    const dayByKey = new Map(sources.map((source) => [source.dayKey, source]));
    const existingBlocks = document.blocks.map((block, index) => ({
      ...block,
      sortOrder: index,
    }));

    const blocks = existingBlocks.map((block) => {
      if (block.type === 'day_heading' && block.dayKey) {
        const source = dayByKey.get(block.dayKey);
        if (source) {
          return {
            ...block,
            dayLabel: source.dayLabel,
          };
        }
      }
      if (block.type !== 'field_activity') return block;
      const key = this.buildMissionReportSourceKey(
        block.sourceScheduleItemId,
        block.sourceActivityId,
      );
      const source = sourceByKey.get(key);
      if (!source) return block;
      const manualOverrides = this.normalizeMissionReportManualOverrides(
        block.manualOverrides,
      );
      const nextFields: MissionReportFieldValues = {
        ...(block.fields ?? this.emptyMissionReportFieldValues()),
      };
      for (const field of this.missionReportFieldKeys()) {
        if (!manualOverrides[field]) {
          nextFields[field] = source.fields[field];
        }
      }
      return {
        ...block,
        dayKey: source.dayKey,
        dayLabel: source.dayLabel,
        fields: nextFields,
        manualOverrides,
      };
    });

    if (blocks.length === 0) {
      blocks.push(this.createFreeTextMissionReportBlock(0));
    }

    const existingDayKeys = new Set(
      blocks
        .filter((block) => block.type === 'day_heading' && block.dayKey)
        .map((block) => String(block.dayKey)),
    );
    const existingSourceKeys = new Set(
      blocks
        .filter((block) => block.type === 'field_activity')
        .map((block) =>
          this.buildMissionReportSourceKey(
            block.sourceScheduleItemId,
            block.sourceActivityId,
          ),
        ),
    );

    for (const source of sources) {
      if (!existingDayKeys.has(source.dayKey)) {
        blocks.push({
          id: `day-${source.dayKey}-${randomUUID()}`,
          type: 'day_heading',
          sortOrder: blocks.length,
          dayKey: source.dayKey,
          dayLabel: source.dayLabel,
          createdFrom: 'auto_sync',
        });
        existingDayKeys.add(source.dayKey);
      }
      if (!existingSourceKeys.has(source.sourceKey)) {
        blocks.push({
          id: `field-${source.scheduleItemId}-${source.activityId ?? 'activity'}-${randomUUID()}`,
          type: 'field_activity',
          sortOrder: blocks.length,
          dayKey: source.dayKey,
          dayLabel: source.dayLabel,
          sourceScheduleItemId: source.scheduleItemId,
          sourceActivityId: source.activityId,
          fields: source.fields,
          manualOverrides: {},
          contentHtml: '',
          contentText: '',
          createdFrom: 'auto_sync',
        });
        existingSourceKeys.add(source.sourceKey);
      }
    }

    return {
      version: 1,
      blocks: blocks.map((block, index) => ({
        ...block,
        sortOrder: index,
      })),
    };
  }

  private normalizeMissionReportBlocksDocument(
    value: unknown,
    legacyReport?: {
      id?: string;
      contentHtml?: string | null;
      contentText?: string | null;
    } | null,
  ): MissionReportBlocksDocument {
    const source = this.isJsonObject(value as any)
      ? (value as Record<string, unknown>)
      : null;
    const rawBlocks = Array.isArray(source?.blocks) ? source.blocks : null;
    const blocks = rawBlocks
      ? rawBlocks
          .map((block, index) => this.normalizeMissionReportBlock(block, index))
          .filter((block): block is MissionReportBlock => Boolean(block))
      : [];

    if (blocks.length > 0) {
      return {
        version: 1,
        blocks: blocks.map((block, index) => ({ ...block, sortOrder: index })),
      };
    }

    const legacyHtml = this.sanitizeMissionReportHtml(
      legacyReport?.contentHtml ?? '',
    );
    const legacyText = this.sanitizeMissionReportContentText(
      legacyReport?.contentText ?? this.stripMissionReportHtml(legacyHtml),
    );
    if (legacyHtml || legacyText) {
      return {
        version: 1,
        blocks: [
          {
            id: `legacy-${legacyReport?.id ?? randomUUID()}`,
            type: 'free_text',
            sortOrder: 0,
            contentHtml: legacyHtml,
            contentText: legacyText,
            createdFrom: 'legacy_content',
          },
        ],
      };
    }

    return { version: 1, blocks: [this.createFreeTextMissionReportBlock(0)] };
  }

  private normalizeMissionReportBlock(
    value: unknown,
    index: number,
  ): MissionReportBlock | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const raw = value as Record<string, unknown>;
    const rawType = String(raw.type ?? '').trim();
    const type: MissionReportBlockType =
      rawType === 'day_heading' || rawType === 'field_activity'
        ? rawType
        : 'free_text';
    const id =
      String(raw.id ?? '')
        .trim()
        .slice(0, 120) || `${type}-${Date.now()}-${index}-${randomUUID()}`;
    const contentHtml = this.sanitizeMissionReportHtml(raw.contentHtml as any);
    const contentText = this.sanitizeMissionReportContentText(
      (raw.contentText as any) ?? this.stripMissionReportHtml(contentHtml),
    );
    const fields =
      type === 'field_activity'
        ? this.normalizeMissionReportFieldValues(raw.fields)
        : undefined;
    return {
      id,
      type,
      sortOrder: index,
      contentHtml,
      contentText,
      dayKey: this.normalizeOptionalReportText(raw.dayKey, 40),
      dayLabel: this.normalizeOptionalReportText(raw.dayLabel, 140),
      sourceScheduleItemId: this.normalizeOptionalReportText(
        raw.sourceScheduleItemId,
        120,
      ),
      sourceActivityId: this.normalizeOptionalReportText(
        raw.sourceActivityId,
        120,
      ),
      fields,
      manualOverrides:
        type === 'field_activity'
          ? this.normalizeMissionReportManualOverrides(raw.manualOverrides)
          : undefined,
      createdFrom: this.normalizeOptionalReportText(raw.createdFrom, 80),
    };
  }

  private normalizeMissionReportFieldValues(
    value: unknown,
  ): MissionReportFieldValues {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const fields = this.emptyMissionReportFieldValues();
    for (const key of this.missionReportFieldKeys()) {
      fields[key] = sanitizeText(String(raw[key] ?? ''))
        .trim()
        .slice(0, 800);
    }
    return fields;
  }

  private normalizeMissionReportManualOverrides(
    value: unknown,
  ): Partial<Record<MissionReportFieldKey, boolean>> {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const overrides: Partial<Record<MissionReportFieldKey, boolean>> = {};
    for (const key of this.missionReportFieldKeys()) {
      if (raw[key] === true) overrides[key] = true;
    }
    return overrides;
  }

  private renderMissionReportDocument(document: MissionReportBlocksDocument) {
    let currentDayNumber = 0;
    let currentActivityNumber = 0;
    const htmlParts: string[] = [];
    const textParts: string[] = [];

    for (const block of document.blocks) {
      if (block.type === 'day_heading') {
        currentDayNumber += 1;
        currentActivityNumber = 0;
        const label =
          block.dayLabel?.trim() ||
          (block.dayKey
            ? this.formatMissionReportDayLabelFromKey(block.dayKey)
            : 'Dia da missão');
        const heading = `${currentDayNumber} - ${label}`;
        htmlParts.push(`<h2>${this.escapeHtml(heading)}</h2>`);
        textParts.push(heading);
        continue;
      }

      if (block.type === 'field_activity') {
        if (currentDayNumber === 0) currentDayNumber = 1;
        currentActivityNumber += 1;
        const fields = block.fields ?? this.emptyMissionReportFieldValues();
        const title = fields.title.trim() || 'Atividade';
        const heading = `${currentDayNumber}.${currentActivityNumber} - Atividade de Campo ${title}`;
        htmlParts.push(`<h3>${this.escapeHtml(heading)}</h3>`);
        htmlParts.push(
          [
            ['Horário', fields.time],
            ['Local', fields.location],
            ['Responsável', fields.responsible],
            ['Participantes', fields.participants],
          ]
            .map(
              ([label, fieldValue]) =>
                `<p><strong>${this.escapeHtml(label)}:</strong> ${this.escapeHtml(
                  fieldValue || '-',
                )}</p>`,
            )
            .join(''),
        );
        if (block.contentHtml?.trim()) {
          htmlParts.push(block.contentHtml);
        }
        textParts.push(
          [
            heading,
            `Horário: ${fields.time || '-'}`,
            `Local: ${fields.location || '-'}`,
            `Responsável: ${fields.responsible || '-'}`,
            `Participantes: ${fields.participants || '-'}`,
            block.contentText?.trim() ? block.contentText.trim() : '',
          ]
            .filter(Boolean)
            .join('\n'),
        );
        continue;
      }

      if (block.contentHtml?.trim()) {
        htmlParts.push(block.contentHtml);
      }
      const text = block.contentText?.trim();
      if (text) textParts.push(text);
    }

    return {
      contentHtml: htmlParts.join('\n').trim().slice(0, 240_000),
      contentText: textParts.join('\n\n').trim().slice(0, 240_000),
    };
  }

  private createFreeTextMissionReportBlock(
    sortOrder: number,
  ): MissionReportBlock {
    return {
      id: `free-${randomUUID()}`,
      type: 'free_text',
      sortOrder,
      contentHtml: '',
      contentText: '',
      createdFrom: 'initial_template',
    };
  }

  private buildMissionReportSourceKey(
    scheduleItemId: string | null | undefined,
    activityId: string | null | undefined,
  ) {
    return `${String(scheduleItemId ?? '').trim()}:${String(activityId ?? '').trim()}`;
  }

  private missionReportFieldKeys(): MissionReportFieldKey[] {
    return ['title', 'date', 'time', 'location', 'responsible', 'participants'];
  }

  private emptyMissionReportFieldValues(): MissionReportFieldValues {
    return {
      title: '',
      date: '',
      time: '',
      location: '',
      responsible: '',
      participants: '',
    };
  }

  private normalizeOptionalReportText(value: unknown, maxLength: number) {
    const normalized = sanitizeText(String(value ?? ''))
      .trim()
      .slice(0, maxLength);
    return normalized || null;
  }

  private formatMissionReportDayKey(value: Date) {
    const { year, month, day } = this.getDateTimePartsInTimeZone(value);
    return `${year}-${month}-${day}`;
  }

  private formatMissionReportDayLabel(value: Date) {
    const { year, month, day } = this.getDateTimePartsInTimeZone(value);
    const monthName = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      timeZone: this.missionPdfTimeZone,
    }).format(value);
    return `Dia ${Number(day)} do mês de ${monthName} do ano de ${year}`;
  }

  private formatMissionReportDayLabelFromKey(dayKey: string) {
    const match = String(dayKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dayKey;
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
    );
    return this.formatMissionReportDayLabel(date);
  }

  private addMinutesToTimeLabel(value: string, minutes: number) {
    const match = String(value ?? '')
      .trim()
      .match(/^(\d{2}):(\d{2})$/);
    if (!match) return value;
    const total =
      Number(match[1]) * 60 +
      Number(match[2]) +
      Math.max(1, Number(minutes) || 0);
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private escapeHtml(value: string | null | undefined) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isMissionReportFilled(
    report:
      | {
          contentHtml?: string | null;
          contentText?: string | null;
        }
      | null
      | undefined,
  ) {
    if (!report) return false;
    return Boolean(
      this.sanitizeMissionReportContentText(
        report.contentText ?? this.stripMissionReportHtml(report.contentHtml),
      ),
    );
  }

  private sanitizeMissionReportHtml(value: string | null | undefined) {
    const raw = String(value ?? '').slice(0, 120_000);
    return raw
      .replace(
        /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        '',
      )
      .replace(
        /<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi,
        '',
      )
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '')
      .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, '')
      .replace(/\s+style\s*=\s*(['"])([\s\S]*?)\1/gi, (_match, quote, css) => {
        const safeCss = String(css)
          .replace(/url\s*\([^)]*\)/gi, '')
          .replace(/expression\s*\([^)]*\)/gi, '')
          .replace(/javascript:/gi, '')
          .trim();
        return safeCss ? ` style=${quote}${safeCss}${quote}` : '';
      })
      .trim();
  }

  private stripMissionReportHtml(value: string | null | undefined) {
    return String(value ?? '')
      .replace(
        /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        ' ',
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  private sanitizeMissionReportContentText(value: string | null | undefined) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120_000);
  }

  private assertMissionReportScope(mission: { scope: ActivityScope }) {
    if (mission.scope !== ActivityScope.CIPAVD) {
      throwError('VALIDATION_ERROR', {
        reason: 'MISSION_REPORT_ONLY_CIPAVD',
        field: 'scope',
      });
    }
  }

  private assertMissionReportEditAccess(user?: RbacUser) {
    this.assertMissionAdvancedTabAccess(user);
    if (hasPermission(user, 'missions', 'update')) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private assertMissionAdvancedTabAccess(user?: RbacUser) {
    if (this.isAdmMissionsProfile(user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private isAdmMissionsProfile(user?: RbacUser) {
    return hasAnyRole(user, [ROLE_ADM_MISSOES]);
  }

  private stripMissionScheduleActivityLinks<
    T extends { activity?: unknown; activityLinks?: unknown },
  >(items: T[]) {
    return items.map((item) => ({
      ...item,
      activity: null,
      activityLinks: [],
    }));
  }

  private getConfigValue(key: string) {
    return this.config?.get<string>(key) ?? process.env[key];
  }

  private assertMissionAccess(user?: RbacUser) {
    if (
      hasAnyPermission(user, [
        { resource: 'missions', action: 'view' },
        { resource: 'missions', action: 'create' },
        { resource: 'missions', action: 'update' },
        { resource: 'missions', action: 'delete' },
        { resource: 'missions', action: 'upload' },
        { resource: 'missions', action: 'download' },
      ])
    ) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private assertMissionChecklistEditAccess(user?: RbacUser) {
    this.assertMissionAdvancedTabAccess(user);
    if (
      hasAnyPermission(user, [
        { resource: 'missions', action: 'update' },
        { resource: 'missions', action: 'upload' },
      ])
    ) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private assertMissionScheduleDeleteAccess(user?: RbacUser) {
    if (
      hasAnyPermission(user, [
        { resource: 'missions', action: 'update' },
        { resource: 'missions', action: 'delete' },
      ])
    ) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  async assertChecklistUploadAccess(id: string, user?: RbacUser) {
    this.assertMissionChecklistEditAccess(user);
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      select: { id: true, localityId: true, scope: true },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);
  }

  private assertMissionChecklistConfigAccess(user?: RbacUser) {
    this.assertMissionAdvancedTabAccess(user);
    if (hasPermission(user, 'missions', 'update')) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private normalizeMissionScope(raw?: string): ActivityScope {
    const value = String(raw ?? '')
      .trim()
      .toUpperCase();
    if (value === 'CIPAVD') return ActivityScope.CIPAVD;
    return ActivityScope.SMIF;
  }

  private async assertMissionLocalityAllowed(mission: {
    localityId: string;
    scope: ActivityScope;
  }) {
    const allowed = await this.resolveAllowedLocalityIds(mission.scope);
    if (!allowed.includes(mission.localityId)) {
      throwError('NOT_FOUND');
    }
  }

  private async resolveAllowedLocalityIds(scope: ActivityScope) {
    if (scope === ActivityScope.CIPAVD) {
      const rows = await this.prisma.locality.findMany({
        where: { catalogType: LocalityCatalogType.CIPAVD },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }

    const localities = await this.prisma.locality.findMany({
      where: { catalogType: LocalityCatalogType.SMIF },
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

  private normalizeOptionalBannerText(value: string | null | undefined) {
    const normalized = sanitizeText(value ?? '');
    return normalized.trim() ? normalized : null;
  }

  private normalizeBannerDate(value: string, field: string) {
    const safe = String(value ?? '').trim();
    const match = safe.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throwError('VALIDATION_ERROR', { field, reason: 'DATE_INVALID' });
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throwError('VALIDATION_ERROR', { field, reason: 'DATE_INVALID' });
    }
    return safe;
  }

  private normalizeBannerTime(value: string, field: string) {
    const safe = String(value ?? '').trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(safe)) {
      throwError('VALIDATION_ERROR', { field, reason: 'TIME_INVALID' });
    }
    return safe;
  }

  private parseRequiredDate(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throwError('VALIDATION_ERROR', { field, reason: 'DATE_INVALID' });
    }
    return parsed;
  }

  private parseScheduleDateTime(value: string, field: string) {
    const safe = String(value ?? '').trim();
    const localMatch = safe.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (!localMatch) {
      return this.parseRequiredDate(safe, field);
    }

    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);
    const second = Number(localMatch[6] ?? '0');

    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
    let resolved = utcGuess;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const offsetMinutes = this.getTimeZoneOffsetMinutes(
        new Date(resolved),
        this.missionPdfTimeZone,
      );
      const adjusted =
        Date.UTC(year, month - 1, day, hour, minute, second) -
        offsetMinutes * 60_000;
      if (adjusted === resolved) break;
      resolved = adjusted;
    }

    const parsed = new Date(resolved);
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

  private async getMissionBannerOrThrow(missionId: string, bannerId: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        title: true,
        localityId: true,
        scope: true,
      },
    });
    if (!mission) throwError('NOT_FOUND');
    await this.assertMissionLocalityAllowed(mission);

    const banner = await this.prisma.missionBanner.findFirst({
      where: { id: bannerId, missionId },
    });
    if (!banner) throwError('NOT_FOUND');

    return { mission, banner };
  }

  private serializeBanner(banner: {
    id: string;
    name: string;
    eventDate: string;
    eventTime: string;
    locationPrimary: string;
    locationSecondary: string | null;
    layoutOverrides: unknown;
  }): MissionBannerRenderable {
    return {
      id: banner.id,
      name: banner.name,
      eventDate: banner.eventDate,
      eventTime: banner.eventTime,
      locationPrimary: banner.locationPrimary,
      locationSecondary: banner.locationSecondary ?? null,
      layoutOverrides: this.normalizeMissionBannerLayoutOverrides(
        banner.layoutOverrides,
      ),
    };
  }

  private normalizeMissionBannerLayoutOverrides(
    value: unknown,
  ): MissionBannerLayoutOverrides | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, unknown>;
    const normalized: MissionBannerLayoutOverrides = {};

    for (const key of missionBannerLayoutKeys) {
      const block =
        source[key] && typeof source[key] === 'object'
          ? (source[key] as Record<string, unknown>)
          : null;
      if (!block) continue;

      const next: NonNullable<MissionBannerLayoutOverrides[typeof key]> = {};
      const xPct = this.normalizeFiniteNumber(block.xPct, 0.05, 0.92);
      const yPct = this.normalizeFiniteNumber(block.yPct, 0.05, 0.95);
      const fontScale = this.normalizeFiniteNumber(block.fontScale, 0.45, 1.8);
      const fontSizePx = this.normalizeFiniteNumber(block.fontSizePx, 8, 180);
      const colorHex =
        typeof block.colorHex === 'string' &&
        /^#([0-9a-f]{6})$/i.test(block.colorHex.trim())
          ? block.colorHex.trim().toUpperCase()
          : null;
      const textOverride =
        typeof block.textOverride === 'string'
          ? block.textOverride
              .split('\n')
              .map((line) =>
                sanitizeText(line).trim().replace(/\s+/g, ' ').slice(0, 120),
              )
              .join('\n')
              .trim()
          : '';

      if (xPct !== null) next.xPct = xPct;
      if (yPct !== null) next.yPct = yPct;
      if (fontSizePx !== null) next.fontSizePx = fontSizePx;
      if (fontScale !== null) next.fontScale = fontScale;
      if (colorHex) next.colorHex = colorHex;
      if (textOverride) next.textOverride = textOverride;

      if (Object.keys(next).length > 0) {
        normalized[key] = next;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  private normalizeFiniteNumber(value: unknown, min: number, max: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.min(max, Math.max(min, numeric));
  }

  private normalizeBannerDownloadFormat(formatRaw?: string) {
    const normalized = String(formatRaw ?? '')
      .trim()
      .toLowerCase();
    if (normalized === 'pdf') return 'pdf';
    return 'png';
  }

  private sanitizeBannerFileName(missionTitle: string, bannerName: string) {
    const safe = [missionTitle, bannerName]
      .join('-')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
      .toLowerCase();
    return safe || 'banner-missao';
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

  private formatMissionPeriodDate(value: Date) {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = String(value.getUTCFullYear());
    return `${day}/${month}/${year}`;
  }

  private formatDateTimeForMissionReport(
    value: Date | string | null | undefined,
  ) {
    const parsed = value instanceof Date ? value : new Date(value ?? '');
    if (Number.isNaN(parsed.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: this.missionPdfTimeZone,
    }).format(parsed);
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

  private getTimeZoneOffsetMinutes(
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
      second: '2-digit',
      hour12: false,
    }).formatToParts(value);

    const byType = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    const asUtc = Date.UTC(
      Number(byType.year ?? '0'),
      Number(byType.month ?? '1') - 1,
      Number(byType.day ?? '1'),
      Number(byType.hour ?? '0'),
      Number(byType.minute ?? '0'),
      Number(byType.second ?? '0'),
    );
    return (asUtc - value.getTime()) / 60_000;
  }

  private async buildMissionParticipantOmSuffixSet() {
    const suffixes = new Set(MISSION_PARTICIPANT_OM_SUFFIXES);
    const [oms, localities] = await Promise.all([
      this.prisma.om.findMany({ select: { code: true, name: true } }),
      this.prisma.locality.findMany({
        select: { code: true, name: true, commandName: true },
      }),
    ]);

    for (const om of oms) {
      this.addMissionParticipantOmSuffix(suffixes, om.code);
      this.addMissionParticipantOmSuffix(suffixes, om.name);
    }
    for (const locality of localities) {
      this.addMissionParticipantOmSuffix(suffixes, locality.code);
      this.addMissionParticipantOmSuffix(suffixes, locality.name);
      this.addMissionParticipantOmSuffix(suffixes, locality.commandName);
    }
    return suffixes;
  }

  private addMissionParticipantOmSuffix(
    suffixes: Set<string>,
    value: string | null | undefined,
  ) {
    const normalized = this.normalizeMissionParticipantOmToken(value);
    if (!normalized || /\s/.test(normalized)) return;
    if (/^[A-Z0-9][A-Z0-9-]{1,13}$/.test(normalized)) {
      suffixes.add(normalized);
    }
  }

  private normalizeMissionParticipantOmToken(value: string | null | undefined) {
    return sanitizeText(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private normalizeMissionParticipantRankText(
    value: string | null | undefined,
  ) {
    return sanitizeText(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ºª]/g, '')
      .replace(/[._/-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private getMissionParticipantRankSortOrder(name: string) {
    const normalized = this.normalizeMissionParticipantRankText(name);
    for (const rank of MISSION_PARTICIPANT_RANK_PREFIXES) {
      if (normalized === rank || normalized.startsWith(`${rank} `)) {
        return (
          MISSION_PARTICIPANT_RANK_ORDER.get(rank) ?? Number.MAX_SAFE_INTEGER
        );
      }
    }
    return Number.MAX_SAFE_INTEGER;
  }

  private sortParticipantsByRankSeniority(participants: string[]) {
    return participants
      .map((participant, index) => ({
        participant,
        index,
        sortOrder: this.getMissionParticipantRankSortOrder(participant),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.index - b.index)
      .map(({ participant }) => participant);
  }

  private removeOmFromParticipantName(
    name: string,
    fabom?: string | null,
    knownOmSuffixes = MISSION_PARTICIPANT_OM_SUFFIXES,
  ) {
    const normalizedName = sanitizeText(name ?? '').trim();
    if (!normalizedName) return 'Participante';
    const normalizedFabom = sanitizeText(fabom ?? '').trim();
    const withoutFabom = normalizedFabom
      ? this.stripExplicitOmSuffix(normalizedName, normalizedFabom)
      : normalizedName;
    return (
      this.stripKnownOmTokenSuffix(withoutFabom, knownOmSuffixes) ||
      withoutFabom ||
      normalizedName
    );
  }

  private stripExplicitOmSuffix(name: string, fabom: string) {
    const escapedFabom = fabom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      name
        .replace(new RegExp(`\\s+\\(${escapedFabom}\\)$`, 'i'), '')
        .replace(new RegExp(`\\s+-\\s+${escapedFabom}$`, 'i'), '')
        .replace(new RegExp(`\\s+/\\s+${escapedFabom}$`, 'i'), '')
        .replace(new RegExp(`\\s+${escapedFabom}$`, 'i'), '')
        .trim() || name
    );
  }

  private stripKnownOmTokenSuffix(name: string, knownOmSuffixes: Set<string>) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return name;
    if (
      this.getMissionParticipantRankSortOrder(name) === Number.MAX_SAFE_INTEGER
    ) {
      return name;
    }

    const lastToken = this.normalizeMissionParticipantOmToken(
      parts[parts.length - 1],
    );
    if (!knownOmSuffixes.has(lastToken)) return name;
    return parts.slice(0, -1).join(' ').trim() || name;
  }

  private formatParticipantTextForPdf(
    value: string | null | undefined,
    knownOmSuffixes = MISSION_PARTICIPANT_OM_SUFFIXES,
  ) {
    const normalized = sanitizeText(value ?? '').trim();
    if (!normalized) return '-';

    const separator = normalized.includes(',')
      ? ','
      : normalized.includes(';')
        ? ';'
        : null;
    if (!separator) {
      return this.removeOmFromParticipantName(
        normalized,
        null,
        knownOmSuffixes,
      );
    }

    const participants = normalized
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) =>
        this.removeOmFromParticipantName(item, null, knownOmSuffixes),
      );
    return participants.length
      ? this.sortParticipantsByRankSeniority(participants).join(`${separator} `)
      : '-';
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
