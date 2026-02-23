import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD } from '../rbac/role-access';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { isTargetLocalityName } from '../common/priority-localities';

const scheduleLogoCandidates = [
  path.resolve(process.cwd(), 'frontend', 'public', 'brand', 'cipavd-7.png'),
  path.resolve(process.cwd(), 'public', 'brand', 'cipavd-7.png'),
  path.resolve(process.cwd(), '..', 'frontend', 'public', 'brand', 'cipavd-7.png'),
];

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
  ) {}

  async list(
    filters: { localityId?: string; q?: string; page?: string; pageSize?: string },
    user?: RbacUser,
  ) {
    this.assertMissionAccess(user);

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);
    const targetLocalityIds = await this.getTargetLocalityIds();
    if (targetLocalityIds.length === 0) {
      return { items: [], page, pageSize, total: 0 };
    }

    const andClauses: Prisma.MissionWhereInput[] = [{ localityId: { in: targetLocalityIds } }];
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
      throwError('VALIDATION_ERROR', { field: 'localityId', reason: 'LOCALITY_NOT_ALLOWED' });
    }

    const startDate = this.parseRequiredDate(payload.startDate, 'startDate');
    const endDate = this.parseRequiredDate(payload.endDate, 'endDate');
    if (endDate.getTime() < startDate.getTime()) {
      throwError('VALIDATION_ERROR', { field: 'endDate', reason: 'END_DATE_BEFORE_START_DATE' });
    }

    const created = await this.prisma.mission.create({
      data: {
        title: this.sanitizeRequiredText(payload.title, 'title'),
        description: payload.description ? sanitizeText(payload.description) : null,
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
      throwError('VALIDATION_ERROR', { field: 'localityId', reason: 'LOCALITY_NOT_ALLOWED' });
    }

    const startDate = payload.startDate
      ? this.parseRequiredDate(payload.startDate, 'startDate')
      : existing.startDate;
    const endDate = payload.endDate
      ? this.parseRequiredDate(payload.endDate, 'endDate')
      : existing.endDate;

    if (endDate.getTime() < startDate.getTime()) {
      throwError('VALIDATION_ERROR', { field: 'endDate', reason: 'END_DATE_BEFORE_START_DATE' });
    }

    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        title: payload.title === undefined ? undefined : this.sanitizeRequiredText(payload.title, 'title'),
        description: payload.description === undefined
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

  async addParticipantFromLdap(missionId: string, identifier: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: { participants: true },
    });
    if (!mission) throwError('NOT_FOUND');

    const normalized = String(identifier ?? '').trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field: 'identifier', reason: 'REQUIRED' });
    }

    const profile = normalized.includes('@')
      ? await this.fabLdap.lookupByEmail(normalized)
      : await this.fabLdap.lookupByUid(normalized.replace(/\D/g, '') || normalized);

    if (!profile) {
      throwError('NOT_FOUND', { resource: 'ldap_user' });
    }

    const normalizedEmail = profile.email?.toLowerCase() ?? null;
    const cpf = this.extractCpf(profile.uid);

    const duplicate = mission.participants.find(
      (participant) =>
        (profile.uid && participant.ldapUid === profile.uid) ||
        (normalizedEmail && participant.email?.toLowerCase() === normalizedEmail) ||
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

  async removeParticipant(missionId: string, participantId: string, user?: RbacUser) {
    this.assertMissionAccess(user);

    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throwError('NOT_FOUND');

    const participant = await this.prisma.missionParticipant.findFirst({
      where: { id: participantId, missionId },
    });
    if (!participant) throwError('NOT_FOUND');

    await this.prisma.missionParticipant.delete({ where: { id: participantId } });

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
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throwError('NOT_FOUND');

    const created = await this.prisma.missionScheduleItem.create({
      data: {
        missionId,
        title: this.sanitizeRequiredText(payload.title, 'title'),
        startAt: this.parseRequiredDate(payload.startAt, 'startAt'),
        durationMinutes: this.normalizeDurationMinutes(payload.durationMinutes),
        location: this.sanitizeRequiredText(payload.location, 'location'),
        responsible: this.sanitizeRequiredText(payload.responsible, 'responsible'),
        participants: this.sanitizeRequiredText(payload.participants, 'participants'),
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
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throwError('NOT_FOUND');

    const existing = await this.prisma.missionScheduleItem.findFirst({
      where: { id: itemId, missionId },
    });
    if (!existing) throwError('NOT_FOUND');

    const updated = await this.prisma.missionScheduleItem.update({
      where: { id: itemId },
      data: {
        title: payload.title === undefined ? undefined : this.sanitizeRequiredText(payload.title, 'title'),
        startAt: payload.startAt === undefined ? undefined : this.parseRequiredDate(payload.startAt, 'startAt'),
        durationMinutes:
          payload.durationMinutes === undefined ? undefined : this.normalizeDurationMinutes(payload.durationMinutes),
        location: payload.location === undefined ? undefined : this.sanitizeRequiredText(payload.location, 'location'),
        responsible:
          payload.responsible === undefined ? undefined : this.sanitizeRequiredText(payload.responsible, 'responsible'),
        participants:
          payload.participants === undefined ? undefined : this.sanitizeRequiredText(payload.participants, 'participants'),
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
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
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
          select: { name: true, email: true, cpf: true },
          orderBy: [{ createdAt: 'asc' }],
        },
        scheduleItems: {
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!mission) throwError('NOT_FOUND');

    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const logoPath = this.findScheduleLogoPath();
    if (logoPath) {
      const logoY = doc.y;
      try {
        doc.image(logoPath, (doc.page.width - 150) / 2, logoY, {
          fit: [150, 150],
          align: 'center',
        });
        doc.y = logoY + 160;
      } catch {
        doc.y = logoY + 8;
      }
    }

    const writeLine = (label: string, value: string) => {
      doc.font('Helvetica-Bold').fontSize(10).text(label);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(11).text(value || '-', { align: 'left' });
      doc.moveDown(0.7);
    };

    doc.font('Helvetica-Bold').fontSize(16).text('Cronograma da Missão', { align: 'center' });
    doc.moveDown(1);

    writeLine('Missão', mission.title);
    writeLine('Localidade', mission.locality ? `${mission.locality.name} (${mission.locality.code})` : '-');
    writeLine('Período', `${this.formatDate(mission.startDate)} a ${this.formatDate(mission.endDate)}`);
    writeLine('Descrição', mission.description ?? '-');

    const participantsLabel =
      mission.participants.length > 0
        ? mission.participants
            .map((participant) => participant.name || participant.email || participant.cpf || 'Participante')
            .join(', ')
        : 'Nenhum participante cadastrado';
    writeLine('Participantes', participantsLabel);

    doc.font('Helvetica-Bold').fontSize(12).text('Programação', { underline: true });
    doc.moveDown(0.4);

    if (mission.scheduleItems.length === 0) {
      doc.font('Helvetica').fontSize(11).text('Nenhum item de cronograma cadastrado para esta missão.');
    } else {
      mission.scheduleItems.forEach((item, index) => {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }

        const rowY = doc.y;
        doc
          .roundedRect(doc.page.margins.left, rowY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 104, 6)
          .fillAndStroke('#F5F8FC', '#D7E0EC');

        const blockStart = rowY + 10;
        doc.fillColor('#111827');
        doc.font('Helvetica-Bold').fontSize(11).text(
          `${index + 1}. ${this.formatTime(item.startAt)} • ${this.formatDuration(item.durationMinutes)}`,
          doc.page.margins.left + 10,
          blockStart,
        );
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(`Atividade: ${item.title}`, doc.page.margins.left + 10, blockStart + 18, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20,
          })
          .text(`Local: ${item.location}`, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20 })
          .text(`Responsável: ${item.responsible}`, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20 })
          .text(`Participantes: ${item.participants}`, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20,
          });
        doc.y = rowY + 114;
      });
    }

    doc.end();
    const buffer = await done;
    const sanitizedTitle = mission.title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60);
    const fileName = `cronograma_missao_${sanitizedTitle || mission.id}.pdf`;
    return { fileName, buffer };
  }

  private assertMissionAccess(user?: RbacUser) {
    if (hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP])) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private async getTargetLocalityIds() {
    const localities = await this.prisma.locality.findMany({
      select: { id: true, name: true },
    });
    return localities.filter((locality) => isTargetLocalityName(locality.name)).map((locality) => locality.id);
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
      throwError('VALIDATION_ERROR', { field: 'durationMinutes', reason: 'DURATION_INVALID' });
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

  private formatDuration(minutes: number) {
    const rounded = Math.max(1, Math.round(minutes));
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours <= 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(value);
  }

  private formatTime(value: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  }

  private extractCpf(value: string | null | undefined) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 11) return digits;
    return null;
  }
}
