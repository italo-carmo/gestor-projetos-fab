import { Injectable } from '@nestjs/common';
import { ActivityScope } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { throwError } from '../common/http-error';
import { resolveExistingLibraryDocumentPath } from '../library/library-storage';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeRoleName,
  ROLE_COORDENACAO_CIPAVD,
} from '../rbac/role-access';

const CONTACT_ITEM_KEYS = ['EMAIL_DIRETO_RELATOS', 'LINK_INTRAER_CPCA'];
const PUBLIC_MATERIAL_TITLE = /(cartilha|ica\s*30\s*[-–—]?\s*13)/i;

type CpcaChecklistContact = {
  itemKey: string;
  isCompleted: boolean;
  details: string | null;
};

type ContactOm = {
  id: string;
  code: string;
  name: string;
  uf: string | null;
  hasCpca: boolean;
  cpcaChecklistItems: CpcaChecklistContact[];
  cpcaCoverageAsManaged: Array<{
    managerOm: {
      id: string;
      code: string;
      name: string;
      uf: string | null;
      cpcaChecklistItems: CpcaChecklistContact[];
    };
  }>;
};

function extractEmail(value: string | null | undefined) {
  const match = String(value ?? '').match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

function extractHttpUrl(value: string | null | undefined) {
  const match = String(value ?? '').match(/https?:\/\/[^\s<>'"]+/i);
  if (!match?.[0]) return null;
  try {
    const parsed = new URL(match[0]);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function readContact(items: CpcaChecklistContact[]) {
  const enabled = items.filter((item) => item.isCompleted && item.details);
  const emailItem = enabled.find(
    (item) => item.itemKey === 'EMAIL_DIRETO_RELATOS',
  );
  const intraerItem = enabled.find(
    (item) => item.itemKey === 'LINK_INTRAER_CPCA',
  );
  return {
    email: extractEmail(emailItem?.details),
    intraerUrl: extractHttpUrl(intraerItem?.details),
  };
}

export function buildPublicCpcaContacts(oms: ContactOm[]) {
  return oms
    .map((om) => {
      const ownContact = om.hasCpca ? readContact(om.cpcaChecklistItems) : null;
      const manager = om.cpcaCoverageAsManaged
        .map((coverage) => ({
          om: coverage.managerOm,
          contact: readContact(coverage.managerOm.cpcaChecklistItems),
        }))
        .find((candidate) =>
          Boolean(candidate.contact.email || candidate.contact.intraerUrl),
        );
      const responsible =
        ownContact && (ownContact.email || ownContact.intraerUrl)
          ? { om, contact: ownContact }
          : manager;
      if (!responsible) return null;

      return {
        servedOm: {
          id: om.id,
          code: om.code,
          name: om.name,
          uf: om.uf,
        },
        responsibleCpca: {
          id: responsible.om.id,
          code: responsible.om.code,
          name: responsible.om.name,
          uf: responsible.om.uf,
        },
        coverageType:
          responsible.om.id === om.id ? 'OWN_CPCA' : 'MANAGED_BY_OTHER',
        email: responsible.contact.email,
        intraerUrl: responsible.contact.intraerUrl,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) =>
      `${a.servedOm.code} ${a.servedOm.name}`.localeCompare(
        `${b.servedOm.code} ${b.servedOm.name}`,
        'pt-BR',
      ),
    );
}

function missionStatus(startDate: Date, endDate: Date, now: Date) {
  if (now < startDate) return 'PROGRAMADA';
  const inclusiveEndDate = new Date(endDate);
  inclusiveEndDate.setHours(23, 59, 59, 999);
  if (now > inclusiveEndDate) return 'REALIZADA';
  return 'EM_ANDAMENTO';
}

@Injectable()
export class InstitutionalService {
  constructor(private readonly prisma: PrismaService) {}

  async getPageData() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const roles = await this.prisma.role.findMany({
      select: { id: true, name: true },
    });
    const commissionRole = roles.find(
      (role) =>
        normalizeRoleName(role.name) ===
        normalizeRoleName(ROLE_COORDENACAO_CIPAVD),
    );

    const [
      members,
      actionMissions,
      agendaMissions,
      highlights,
      contactOms,
      libraryPhotos,
      materials,
    ] = await Promise.all([
      commissionRole
        ? this.prisma.user.findMany({
            where: {
              isActive: true,
              roles: { some: { roleId: commissionRole.id } },
            },
            select: {
              id: true,
              name: true,
              commissionFunction: true,
              commissionSeniority: true,
              updatedAt: true,
            },
            orderBy: [{ commissionSeniority: 'asc' }, { name: 'asc' }],
            take: 100,
          })
        : Promise.resolve([]),
      this.prisma.mission.findMany({
        where: { scope: { in: [ActivityScope.SMIF, ActivityScope.CIPAVD] } },
        select: {
          id: true,
          title: true,
          description: true,
          scope: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          locality: { select: { id: true, code: true, name: true, uf: true } },
          scheduleItems: {
            select: { id: true, title: true, startAt: true, location: true },
            orderBy: { startAt: 'asc' },
          },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        take: 80,
      }),
      this.prisma.mission.findMany({
        where: {
          scope: { in: [ActivityScope.SMIF, ActivityScope.CIPAVD] },
          endDate: { gte: startOfToday },
        },
        select: {
          id: true,
          title: true,
          scope: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          locality: { select: { id: true, code: true, name: true, uf: true } },
          scheduleItems: {
            select: { id: true, title: true, startAt: true, location: true },
            orderBy: { startAt: 'asc' },
          },
        },
        orderBy: [{ startDate: 'asc' }],
        take: 40,
      }),
      this.prisma.socialCommunicationHighlight.findMany({
        select: {
          id: true,
          militaryName: true,
          highlightRole: true,
          fabom: true,
          photoMimeType: true,
          impact: true,
          highlightText: true,
          createdAt: true,
          updatedAt: true,
          locality: { select: { id: true, code: true, name: true, uf: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 12,
      }),
      this.prisma.om.findMany({
        where: {
          OR: [{ hasCpca: true }, { cpcaCoverageAsManaged: { some: {} } }],
        },
        select: {
          id: true,
          code: true,
          name: true,
          uf: true,
          hasCpca: true,
          cpcaChecklistItems: {
            where: { itemKey: { in: CONTACT_ITEM_KEYS } },
            select: {
              itemKey: true,
              isCompleted: true,
              details: true,
            },
          },
          cpcaCoverageAsManaged: {
            orderBy: { createdAt: 'asc' },
            select: {
              managerOm: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  uf: true,
                  cpcaChecklistItems: {
                    where: { itemKey: { in: CONTACT_ITEM_KEYS } },
                    select: {
                      itemKey: true,
                      isCompleted: true,
                      details: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.libraryPhoto.findMany({
        where: { scope: { in: [ActivityScope.SMIF, ActivityScope.CIPAVD] } },
        select: {
          id: true,
          title: true,
          scope: true,
          mimeType: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          locality: { select: { id: true, code: true, name: true, uf: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 300,
      }),
      this.prisma.libraryDocument.findMany({
        where: {
          scope: { in: [ActivityScope.SMIF, ActivityScope.CIPAVD] },
          title: { not: '' },
        },
        select: {
          id: true,
          title: true,
          scope: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
      }),
    ]);

    const libraryGroups = new Map<
      string,
      {
        id: string;
        title: string;
        scope: ActivityScope;
        locality: (typeof libraryPhotos)[number]['locality'];
        photos: Array<{
          id: string;
          title: string;
          imageUrl: string;
          mimeType: string | null;
        }>;
      }
    >();

    for (const photo of libraryPhotos) {
      const key = `gallery:${photo.scope}:${photo.locality?.id ?? 'all'}`;
      const existing = libraryGroups.get(key);
      const group =
        existing ??
        {
          id: key,
          title: photo.locality
            ? photo.locality.code || photo.locality.name
            : `Acervo geral — ${photo.scope}`,
          scope: photo.scope,
          locality: photo.locality,
          photos: [],
        };
      group.photos.push({
        id: photo.id,
        title: photo.title,
        imageUrl: `/institutional/library-photos/${photo.id}`,
        mimeType: photo.mimeType,
      });
      libraryGroups.set(key, group);
    }

    const publicMaterials = materials
      .filter((material) => PUBLIC_MATERIAL_TITLE.test(material.title))
      .map((material) => ({
        id: material.id,
        title: material.title,
        scope: material.scope,
        fileName: material.fileName,
        mimeType: material.mimeType,
        fileSize: material.fileSize,
        publishedAt: material.createdAt,
        downloadUrl: `/institutional/materials/${material.id}`,
      }));
    const publicContacts = buildPublicCpcaContacts(contactOms as ContactOm[]);

    const updateDates = [
      ...members.map((item) => item.updatedAt),
      ...actionMissions.map((item) => item.updatedAt),
      ...agendaMissions.map((item) => item.updatedAt),
      ...highlights.map((item) => item.updatedAt),
      ...libraryPhotos.map((item) => item.updatedAt),
      ...materials.map((item) => item.updatedAt),
    ];

    return {
      generatedAt: now.toISOString(),
      lastUpdatedAt:
        updateDates.sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ??
        now.toISOString(),
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        function: member.commissionFunction,
        seniority: member.commissionSeniority,
      })),
      actions: actionMissions.map((mission) => ({
        id: mission.id,
        title: mission.title,
        summary: mission.description,
        scope: mission.scope,
        startDate: mission.startDate,
        endDate: mission.endDate,
        year: mission.startDate.getFullYear(),
        status: missionStatus(mission.startDate, mission.endDate, now),
        locality: mission.locality,
        activities: mission.scheduleItems.map((item) => ({
          id: item.id,
          title: item.title,
          startAt: item.startAt,
          location: item.location,
        })),
      })),
      agenda: agendaMissions.map((mission) => ({
        id: mission.id,
        missionId: mission.id,
        title: mission.title,
        activity: mission.scheduleItems[0]?.title ?? mission.title,
        scope: mission.scope,
        startDate: mission.startDate,
        endDate: mission.endDate,
        status: missionStatus(mission.startDate, mission.endDate, now),
        location:
          mission.scheduleItems[0]?.location ||
          mission.locality.code ||
          mission.locality.name,
        locality: mission.locality,
      })),
      news: highlights.map((highlight) => ({
        id: highlight.id,
        title: highlight.militaryName,
        role: highlight.highlightRole,
        organization: highlight.fabom,
        impact: highlight.impact,
        text: highlight.highlightText,
        publishedAt: highlight.createdAt,
        locality: highlight.locality,
        photoUrl: highlight.photoMimeType
          ? `/institutional/news/${highlight.id}/photo`
          : null,
      })),
      supportChannels: publicContacts,
      materials: publicMaterials,
      library: {
        totalPhotos: libraryPhotos.length,
        groups: Array.from(libraryGroups.values()).sort((a, b) => {
          if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
          return a.title.localeCompare(b.title, 'pt-BR');
        }),
      },
      totals: {
        members: members.length,
        actions: actionMissions.length,
        states: new Set(
          actionMissions.map((mission) => mission.locality.uf).filter(Boolean),
        ).size,
        supportChannels: publicContacts.length,
        libraryPhotos: libraryPhotos.length,
      },
    };
  }

  async getLibraryPhoto(id: string) {
    const photo = await this.prisma.libraryPhoto.findUnique({
      where: { id },
      select: { imageData: true, mimeType: true, fileUrl: true },
    });
    if (!photo) throwError('NOT_FOUND');
    if (photo.imageData) {
      return {
        buffer: Buffer.from(photo.imageData, 'base64'),
        contentType: photo.mimeType || 'image/jpeg',
      };
    }

    const safeName = path.basename(String(photo.fileUrl ?? '').trim());
    const filePath = path.resolve(process.cwd(), 'storage', 'library-photos', safeName);
    if (!safeName || !fs.existsSync(filePath)) throwError('NOT_FOUND');
    return {
      buffer: fs.readFileSync(filePath),
      contentType: photo.mimeType || 'image/jpeg',
    };
  }

  async getNewsPhoto(id: string) {
    const highlight = await this.prisma.socialCommunicationHighlight.findUnique({
      where: { id },
      select: { photoBase64: true, photoMimeType: true },
    });
    if (!highlight?.photoBase64) throwError('NOT_FOUND');
    return {
      buffer: Buffer.from(highlight.photoBase64, 'base64'),
      contentType: highlight.photoMimeType || 'image/jpeg',
    };
  }

  async getMaterial(id: string) {
    const material = await this.prisma.libraryDocument.findUnique({
      where: { id },
      select: {
        title: true,
        fileName: true,
        fileUrl: true,
        storageKey: true,
        mimeType: true,
      },
    });
    if (!material || !PUBLIC_MATERIAL_TITLE.test(material.title)) {
      throwError('NOT_FOUND');
    }
    const storageKey =
      String(material.storageKey ?? '').trim() ||
      path.basename(String(material.fileUrl ?? '').trim());
    const filePath = resolveExistingLibraryDocumentPath(storageKey);
    if (!filePath) throwError('NOT_FOUND');
    return {
      filePath,
      fileName: material.fileName || material.title,
      mimeType: material.mimeType,
    };
  }
}
