import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../rbac/role-access';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { selectTargetLocalities } from '../common/priority-localities';

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
        location: sanitizeText(payload.location ?? ''),
        responsible: this.sanitizeRequiredText(payload.responsible, 'responsible'),
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
        location: payload.location === undefined ? undefined : sanitizeText(payload.location ?? ''),
        responsible:
          payload.responsible === undefined ? undefined : this.sanitizeRequiredText(payload.responsible, 'responsible'),
        participants:
          payload.participants === undefined ? undefined : sanitizeText(payload.participants ?? ''),
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

    const doc = new PDFDocument({ margin: 32, size: 'A4', layout: 'landscape' });
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
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableBottomLimit = doc.page.height - doc.page.margins.bottom - 16;
    let cursorY = doc.page.margins.top;
    let pageNumber = 1;
    let isFirstPage = true;

    const logoPath = this.findScheduleLogoPath();
    const missionTitle = mission.title || 'Missão sem título';
    const missionLocality = mission.locality ? `${mission.locality.name} (${mission.locality.code})` : '-';
    const missionPeriod = `${this.formatDate(mission.startDate)} a ${this.formatDate(mission.endDate)}`;
    const missionDescription = mission.description?.trim() || '-';
    const participantsLabel =
      mission.participants.length > 0
        ? mission.participants
            .map((participant) => participant.name || participant.email || participant.cpf || 'Participante')
            .join(', ')
        : 'Nenhum participante cadastrado';

    const drawPageFooter = () => {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(palette.muted)
        .text(
          `Página ${pageNumber} • Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`,
          tableX,
          doc.page.height - doc.page.margins.bottom + 4,
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
        .text('Quadro de Trabalho Semanal', textStartX, cursorY + 10, {
          width: contentWidth - (textStartX - tableX) - 12,
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#E6EEF7')
        .text('Cronograma operacional da missão • Comissão de Iniciação', textStartX, cursorY + 28, {
          width: contentWidth - (textStartX - tableX) - 12,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#FFFFFF')
        .text(missionTitle, textStartX, cursorY + 42, {
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
      const cardWidth = (contentWidth - gap * (infoCards.length - 1)) / infoCards.length;

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
          .text(card.value || '-', x + 8, cursorY + 18, { width: cardWidth - 16, height: 18 });
        x += cardWidth + gap;
      }

      cursorY += cardHeight + 6;

      const descriptionHeight = 38;
      doc
        .roundedRect(tableX, cursorY, contentWidth, descriptionHeight, 6)
        .fillAndStroke(palette.paper, palette.cardBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(palette.muted)
        .text('Descrição', tableX + 8, cursorY + 6, { width: contentWidth - 16 });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(palette.text)
        .text(missionDescription, tableX + 8, cursorY + 16, {
          width: contentWidth - 16,
          height: 16,
        });

      cursorY += descriptionHeight + 6;

      const participantsHeight = Math.max(
        32,
        doc.heightOfString(participantsLabel, { width: contentWidth - 16, align: 'left' }) + 16,
      );
      doc
        .roundedRect(tableX, cursorY, contentWidth, participantsHeight, 6)
        .fillAndStroke(palette.paper, palette.cardBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(palette.muted)
        .text('Participantes', tableX + 8, cursorY + 6, { width: contentWidth - 16 });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(palette.text)
        .text(participantsLabel, tableX + 8, cursorY + 16, { width: contentWidth - 16 });

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
        .text(`Quadro de Trabalho Semanal • ${missionTitle}`, tableX + 10, cursorY + 8, {
          width: contentWidth - 20,
        });
      cursorY += barHeight + 8;
    };

    const columnDefs = [
      { key: 'day', label: 'Dia', width: 92, align: 'left' as const },
      { key: 'time', label: 'Horário', width: 82, align: 'left' as const },
      { key: 'duration', label: 'Duração', width: 64, align: 'center' as const },
      { key: 'activity', label: 'Atividade', width: 228, align: 'left' as const },
      { key: 'location', label: 'Local', width: 102, align: 'left' as const },
      { key: 'responsible', label: 'Responsável', width: 102, align: 'left' as const },
      { key: 'participants', label: 'Participantes', width: 0, align: 'left' as const },
    ];
    const fixedWidth = columnDefs.slice(0, -1).reduce((acc, col) => acc + col.width, 0);
    columnDefs[columnDefs.length - 1].width = contentWidth - fixedWidth;

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

    const openNewPage = (forceTableHeader = true) => {
      if (!isFirstPage) {
        drawPageFooter();
        doc.addPage();
        pageNumber += 1;
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
      const safetyMargin = 5;
      if (cursorY + rowHeight + safetyMargin <= tableBottomLimit) return;
      openNewPage(true);
    };

    const drawWeekSection = (label: string) => {
      const sectionHeight = 20;
      // Verificar se há espaço para a seção + pelo menos uma linha mínima
      const minRowHeight = 22;
      if (cursorY + sectionHeight + minRowHeight > tableBottomLimit) {
        openNewPage(true);
      }
      doc
        .rect(tableX, cursorY, contentWidth, sectionHeight)
        .fillAndStroke(palette.sectionBg, palette.sectionBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(palette.brandDark)
        .text(label, tableX + 6, cursorY + 6, { width: contentWidth - 12 });
      cursorY += sectionHeight;
    };

    const drawAfternoonDivider = () => {
      const dividerHeight = 20;
      // Verificar se há espaço para a divisória + pelo menos uma linha mínima
      const minRowHeight = 22;
      if (cursorY + dividerHeight + minRowHeight > tableBottomLimit) {
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

    const drawScheduleRow = (rowIndex: number, row: Record<string, string>) => {
      const textPaddingX = 5;
      const textPaddingY = 4;
      const minHeight = 22;

      let rowHeight = minHeight;
      for (const col of columnDefs) {
        const value = String(row[col.key] ?? '-');
        const height = doc
          .font('Helvetica')
          .fontSize(8.5)
          .heightOfString(value, {
            width: col.width - textPaddingX * 2,
            align: col.align,
          });
        rowHeight = Math.max(rowHeight, height + textPaddingY * 2);
      }

      ensureRowFits(rowHeight);

      const background = rowIndex % 2 === 0 ? palette.rowOdd : palette.rowEven;
      doc.rect(tableX, cursorY, contentWidth, rowHeight).fillAndStroke(background, palette.rowBorder);

      let x = tableX;
      for (const col of columnDefs) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(palette.text)
          .text(String(row[col.key] ?? '-'), x + textPaddingX, cursorY + textPaddingY, {
            width: col.width - textPaddingX * 2,
            align: col.align,
          });
        x += col.width;
      }

      cursorY += rowHeight;
    };

    openNewPage(true);

    if (mission.scheduleItems.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(palette.muted)
        .text('Nenhum item de cronograma cadastrado para esta missão.', tableX, cursorY + 12, {
          width: contentWidth,
          align: 'center',
        });
    } else {
      let weekCursor = '';
      let rowIndex = 0;
      let lastItemDate: Date | null = null;
      let lastItemHour = -1;

      mission.scheduleItems.forEach((item) => {
        const weekStart = this.getWeekStartDate(item.startAt);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekKey = weekStart.toISOString().slice(0, 10);
        if (weekKey !== weekCursor) {
          weekCursor = weekKey;
          drawWeekSection(
            `Semana de ${this.formatDateNoYear(weekStart)} a ${this.formatDateNoYear(weekEnd)}`,
          );
          lastItemDate = null;
          lastItemHour = -1;
        }

        // Verificar se precisa adicionar divisória entre manhã e tarde
        const itemDate = new Date(item.startAt);
        const itemHour = itemDate.getHours();
        const itemDateStr = itemDate.toDateString();
        
        // Adicionar divisória quando:
        // 1. Primeiro item do dia e já é >= 12h
        // 2. Mesmo dia e passou de manhã (< 12h) para tarde (>= 12h)
        // 3. Mudou de dia e o novo item é >= 12h
        const shouldAddDivider =
          (!lastItemDate && itemHour >= 12) ||
          (lastItemDate &&
            itemDateStr === lastItemDate.toDateString() &&
            lastItemHour < 12 &&
            itemHour >= 12) ||
          (lastItemDate && itemDateStr !== lastItemDate.toDateString() && itemHour >= 12);
        
        if (shouldAddDivider) {
          drawAfternoonDivider();
        }

        const endAt = new Date(item.startAt.getTime() + item.durationMinutes * 60_000);
        drawScheduleRow(rowIndex, {
          day: this.formatWeekdayDate(item.startAt),
          time: `${this.formatTime(item.startAt)} - ${this.formatTime(endAt)}`,
          duration: this.formatDuration(item.durationMinutes),
          activity: item.title || '-',
          location: item.location || '-',
          responsible: item.responsible || '-',
          participants: item.participants || '-',
        });
        
        lastItemDate = itemDate;
        lastItemHour = itemHour;
        rowIndex += 1;
      });
    }

    drawPageFooter();

    doc.end();
    const buffer = await done;
    const sanitizedTitle = mission.title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60);
    const fileName = `cronograma_missao_${sanitizedTitle || mission.id}.pdf`;
    return { fileName, buffer };
  }

  private assertMissionAccess(user?: RbacUser) {
    if (hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private async getTargetLocalityIds() {
    const localities = await this.prisma.locality.findMany({
      select: { id: true, name: true, recruitsFemaleCountCurrent: true, updatedAt: true },
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

  private getWeekStartDate(value: Date) {
    const date = new Date(value);
    const day = (date.getDay() + 6) % 7; // Monday = 0
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private formatDateNoYear(value: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(value);
  }

  private formatWeekdayDate(value: Date) {
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
      .format(value)
      .replace('.', '')
      .toUpperCase();
    return `${weekday} ${this.formatDateNoYear(value)}`;
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
    // Garantir que usa o horário local, não UTC
    const localDate = new Date(value);
    const hours = localDate.getHours().toString().padStart(2, '0');
    const minutes = localDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private extractCpf(value: string | null | undefined) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 11) return digits;
    return null;
  }
}
