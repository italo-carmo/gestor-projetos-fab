"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionsService = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const role_access_1 = require("../rbac/role-access");
const sanitize_1 = require("../common/sanitize");
const pagination_1 = require("../common/pagination");
const fab_ldap_service_1 = require("../ldap/fab-ldap.service");
const priority_localities_1 = require("../common/priority-localities");
const scheduleLogoCandidates = [
    node_path_1.default.resolve(process.cwd(), 'frontend', 'public', 'brand', 'cipavd-7.png'),
    node_path_1.default.resolve(process.cwd(), 'public', 'brand', 'cipavd-7.png'),
    node_path_1.default.resolve(process.cwd(), '..', 'frontend', 'public', 'brand', 'cipavd-7.png'),
];
let MissionsService = class MissionsService {
    prisma;
    audit;
    fabLdap;
    missionPdfTimeZone = 'America/Sao_Paulo';
    constructor(prisma, audit, fabLdap) {
        this.prisma = prisma;
        this.audit = audit;
        this.fabLdap = fabLdap;
    }
    async list(filters, user) {
        this.assertMissionAccess(user);
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const targetLocalityIds = await this.getTargetLocalityIds();
        if (targetLocalityIds.length === 0) {
            return { items: [], page, pageSize, total: 0 };
        }
        const andClauses = [{ localityId: { in: targetLocalityIds } }];
        if (filters.localityId)
            andClauses.push({ localityId: filters.localityId });
        if (filters.q) {
            andClauses.push({
                OR: [
                    { title: { contains: filters.q, mode: 'insensitive' } },
                    { description: { contains: filters.q, mode: 'insensitive' } },
                ],
            });
        }
        const where = { AND: andClauses };
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
    async getStatistics(user) {
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
        const totalParticipants = missions.reduce((acc, m) => acc + m.participants.length, 0);
        const averageParticipantsPerMission = totalMissions > 0 ? totalParticipants / totalMissions : 0;
        const missionsWithoutParticipants = missions.filter((m) => m.participants.length === 0).length;
        const totalMissionDays = missions.reduce((acc, mission) => acc + this.calculateInclusiveDays(mission.startDate, mission.endDate), 0);
        const averageMissionDays = totalMissions > 0 ? totalMissionDays / totalMissions : 0;
        const totalParticipantDays = missions.reduce((acc, mission) => acc + this.calculateInclusiveDays(mission.startDate, mission.endDate) * mission.participants.length, 0);
        const userMissionCount = new Map();
        for (const mission of missions) {
            const missionDays = this.calculateInclusiveDays(mission.startDate, mission.endDate);
            for (const participant of mission.participants) {
                if (participant.userId) {
                    const existing = userMissionCount.get(participant.userId);
                    if (existing) {
                        existing.count += 1;
                        existing.totalDays += missionDays;
                    }
                    else {
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
            averageParticipantsPerMission: Math.round(averageParticipantsPerMission * 10) / 10,
            averageMissionDays: Math.round(averageMissionDays * 10) / 10,
            missionsWithoutParticipants,
            missionsWithMostParticipants,
        };
    }
    async getById(id, user) {
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
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        return mission;
    }
    async create(payload, user) {
        this.assertMissionAccess(user);
        const targetLocalityIds = await this.getTargetLocalityIds();
        if (!targetLocalityIds.includes(payload.localityId)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'localityId', reason: 'LOCALITY_NOT_ALLOWED' });
        }
        const startDate = this.parseRequiredDate(payload.startDate, 'startDate');
        const endDate = this.parseRequiredDate(payload.endDate, 'endDate');
        if (endDate.getTime() < startDate.getTime()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'endDate', reason: 'END_DATE_BEFORE_START_DATE' });
        }
        const created = await this.prisma.mission.create({
            data: {
                title: this.sanitizeRequiredText(payload.title, 'title'),
                description: payload.description ? (0, sanitize_1.sanitizeText)(payload.description) : null,
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
    async update(id, payload, user) {
        this.assertMissionAccess(user);
        const existing = await this.prisma.mission.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const targetLocalityIds = await this.getTargetLocalityIds();
        const localityId = payload.localityId ?? existing.localityId;
        if (!targetLocalityIds.includes(localityId)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'localityId', reason: 'LOCALITY_NOT_ALLOWED' });
        }
        const startDate = payload.startDate
            ? this.parseRequiredDate(payload.startDate, 'startDate')
            : existing.startDate;
        const endDate = payload.endDate
            ? this.parseRequiredDate(payload.endDate, 'endDate')
            : existing.endDate;
        if (endDate.getTime() < startDate.getTime()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'endDate', reason: 'END_DATE_BEFORE_START_DATE' });
        }
        const updated = await this.prisma.mission.update({
            where: { id },
            data: {
                title: payload.title === undefined ? undefined : this.sanitizeRequiredText(payload.title, 'title'),
                description: payload.description === undefined
                    ? undefined
                    : payload.description === null
                        ? null
                        : (0, sanitize_1.sanitizeText)(payload.description),
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
    async delete(id, user) {
        this.assertMissionAccess(user);
        const existing = await this.prisma.mission.findUnique({
            where: { id },
            include: {
                participants: { select: { id: true } },
                scheduleItems: { select: { id: true } },
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    async lookupLdapParticipant(rawQuery, user) {
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
    async addParticipantFromLdap(missionId, identifier, user) {
        this.assertMissionAccess(user);
        const mission = await this.prisma.mission.findUnique({
            where: { id: missionId },
            include: { participants: true },
        });
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const normalized = String(identifier ?? '').trim();
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'identifier', reason: 'REQUIRED' });
        }
        const profile = normalized.includes('@')
            ? await this.fabLdap.lookupByEmail(normalized)
            : await this.fabLdap.lookupByUid(normalized.replace(/\D/g, '') || normalized);
        if (!profile) {
            (0, http_error_1.throwError)('NOT_FOUND', { resource: 'ldap_user' });
        }
        const normalizedEmail = profile.email?.toLowerCase() ?? null;
        const cpf = this.extractCpf(profile.uid);
        const duplicate = mission.participants.find((participant) => (profile.uid && participant.ldapUid === profile.uid) ||
            (normalizedEmail && participant.email?.toLowerCase() === normalizedEmail) ||
            (cpf && participant.cpf === cpf));
        if (duplicate) {
            return duplicate;
        }
        const linkedUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    profile.uid ? { ldapUid: profile.uid } : undefined,
                    normalizedEmail ? { email: normalizedEmail } : undefined,
                ].filter(Boolean),
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
    async addParticipantFromUser(missionId, userId, user) {
        this.assertMissionAccess(user);
        const mission = await this.prisma.mission.findUnique({
            where: { id: missionId },
            include: { participants: true },
        });
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const systemUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                ldapUid: true,
            },
        });
        if (!systemUser)
            (0, http_error_1.throwError)('NOT_FOUND');
        const duplicate = mission.participants.find((participant) => participant.userId === userId ||
            (systemUser.ldapUid && participant.ldapUid === systemUser.ldapUid) ||
            (systemUser.email && participant.email?.toLowerCase() === systemUser.email.toLowerCase()));
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
    async removeParticipant(missionId, participantId, user) {
        this.assertMissionAccess(user);
        const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const participant = await this.prisma.missionParticipant.findFirst({
            where: { id: participantId, missionId },
        });
        if (!participant)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    async listSchedule(missionId, user) {
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
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    async createScheduleItem(missionId, payload, user) {
        this.assertMissionAccess(user);
        const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const created = await this.prisma.missionScheduleItem.create({
            data: {
                missionId,
                title: this.sanitizeRequiredText(payload.title, 'title'),
                startAt: this.parseRequiredDate(payload.startAt, 'startAt'),
                durationMinutes: this.normalizeDurationMinutes(payload.durationMinutes),
                location: (0, sanitize_1.sanitizeText)(payload.location ?? ''),
                responsible: this.sanitizeRequiredText(payload.responsible, 'responsible'),
                participants: (0, sanitize_1.sanitizeText)(payload.participants ?? ''),
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
    async updateScheduleItem(missionId, itemId, payload, user) {
        this.assertMissionAccess(user);
        const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const existing = await this.prisma.missionScheduleItem.findFirst({
            where: { id: itemId, missionId },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const updated = await this.prisma.missionScheduleItem.update({
            where: { id: itemId },
            data: {
                title: payload.title === undefined ? undefined : this.sanitizeRequiredText(payload.title, 'title'),
                startAt: payload.startAt === undefined ? undefined : this.parseRequiredDate(payload.startAt, 'startAt'),
                durationMinutes: payload.durationMinutes === undefined ? undefined : this.normalizeDurationMinutes(payload.durationMinutes),
                location: payload.location === undefined ? undefined : (0, sanitize_1.sanitizeText)(payload.location ?? ''),
                responsible: payload.responsible === undefined ? undefined : this.sanitizeRequiredText(payload.responsible, 'responsible'),
                participants: payload.participants === undefined ? undefined : (0, sanitize_1.sanitizeText)(payload.participants ?? ''),
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
    async deleteScheduleItem(missionId, itemId, user) {
        this.assertMissionAccess(user);
        const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const existing = await this.prisma.missionScheduleItem.findFirst({
            where: { id: itemId, missionId },
            select: { id: true },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    async buildSchedulePdf(missionId, user) {
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
        if (!mission)
            (0, http_error_1.throwError)('NOT_FOUND');
        const doc = new pdfkit_1.default({ margin: 32, size: 'A4', layout: 'landscape' });
        const chunks = [];
        const done = new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
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
        const missionTimeZone = this.missionPdfTimeZone;
        const missionPeriod = `${this.formatDate(mission.startDate, missionTimeZone)} a ${this.formatDate(mission.endDate, missionTimeZone)}`;
        const participantsLabel = mission.participants.length > 0
            ? mission.participants
                .map((participant) => {
                const baseName = participant.name || participant.email || participant.cpf || 'Participante';
                return this.removeOmFromParticipantName(baseName, participant.fabom);
            })
                .join(', ')
            : 'Nenhum participante cadastrado';
        const drawPageFooter = () => {
            const footerY = doc.page.height - doc.page.margins.bottom - 10;
            doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(palette.muted)
                .text(`Página ${pageNumber} • Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`, tableX, footerY, { width: contentWidth, align: 'right' });
        };
        const drawCoverHeader = () => {
            const headerHeight = 64;
            doc
                .roundedRect(tableX, cursorY, contentWidth, headerHeight, 10)
                .fillAndStroke(palette.brandDark, palette.brandDark);
            if (logoPath) {
                try {
                    doc.image(logoPath, tableX + 12, cursorY + 10, { fit: [40, 40] });
                }
                catch {
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
            const participantsHeight = Math.max(32, doc.heightOfString(participantsLabel, { width: contentWidth - 16, align: 'left' }) + 16);
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
                .text(`Cronograma da Missão • ${missionTitle}`, tableX + 10, cursorY + 8, {
                width: contentWidth - 20,
            });
            cursorY += barHeight + 8;
        };
        const columnDefs = [
            { key: 'day', label: 'Dia', width: 92, align: 'left' },
            { key: 'time', label: 'Horário', width: 82, align: 'left' },
            { key: 'duration', label: 'Duração', width: 64, align: 'center' },
            { key: 'activity', label: 'Atividade', width: 228, align: 'left' },
            { key: 'location', label: 'Local', width: 102, align: 'left' },
            { key: 'responsible', label: 'Responsável', width: 102, align: 'left' },
            { key: 'participants', label: 'Participantes', width: 0, align: 'left' },
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
                const minContentHeight = 100;
                if (cursorY > doc.page.margins.top + minContentHeight) {
                    drawPageFooter();
                    doc.addPage();
                    pageNumber += 1;
                }
                else {
                    cursorY = doc.page.margins.top;
                    if (forceTableHeader)
                        drawTableHeader();
                    return;
                }
            }
            cursorY = doc.page.margins.top;
            if (isFirstPage) {
                drawCoverHeader();
                drawMetaCards();
            }
            else {
                drawContinuationHeader();
            }
            if (forceTableHeader)
                drawTableHeader();
            isFirstPage = false;
        };
        const ensureRowFits = (rowHeight) => {
            const safetyMargin = 20;
            if (cursorY + rowHeight + safetyMargin <= tableBottomLimit)
                return;
            const minContentHeight = 100;
            if (cursorY > doc.page.margins.top + minContentHeight) {
                openNewPage(true);
            }
            else {
                const availableSpace = tableBottomLimit - cursorY - safetyMargin;
                if (availableSpace < rowHeight * 0.5) {
                    openNewPage(true);
                }
                else {
                    cursorY = tableBottomLimit - rowHeight - safetyMargin;
                }
            }
        };
        const drawMorningDivider = (requiredContentHeight = 22) => {
            const dividerHeight = 20;
            const safetyMargin = 15;
            if (cursorY + dividerHeight + requiredContentHeight + safetyMargin > tableBottomLimit) {
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
            if (cursorY + dividerHeight + requiredContentHeight + safetyMargin > tableBottomLimit) {
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
        const measureScheduleRowHeight = (row) => {
            const textPaddingX = 5;
            const textPaddingY = 4;
            const minHeight = 22;
            const lineGap = 3;
            const rowSpacing = 1;
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
        const drawScheduleRow = (rowIndex, row) => {
            const textPaddingX = 5;
            const textPaddingY = 4;
            const lineGap = 3;
            const rowSpacing = 1;
            const measured = measureScheduleRowHeight(row);
            const rowHeight = measured - rowSpacing;
            ensureRowFits(measured);
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
                    lineGap: lineGap,
                });
                x += col.width;
            }
            cursorY += rowHeight + rowSpacing;
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
        }
        else {
            let rowIndex = 0;
            let lastItemDate = null;
            let lastItemHour = -1;
            mission.scheduleItems.forEach((item) => {
                const itemDateParts = this.getDateTimePartsInTimeZone(item.startAt, missionTimeZone);
                const itemHour = Number(itemDateParts.hour);
                const itemDateStr = `${itemDateParts.year}-${itemDateParts.month}-${itemDateParts.day}`;
                const endAt = new Date(item.startAt.getTime() + item.durationMinutes * 60_000);
                const rowData = {
                    day: this.formatWeekdayDate(item.startAt, missionTimeZone),
                    time: `${this.formatTime(item.startAt, missionTimeZone)} - ${this.formatTime(endAt, missionTimeZone)}`,
                    duration: this.formatDuration(item.durationMinutes),
                    activity: item.title || '-',
                    location: item.location || '-',
                    responsible: item.responsible || '-',
                    participants: item.participants || '-',
                };
                const requiredRowHeight = measureScheduleRowHeight(rowData);
                const shouldAddMorningDivider = (!lastItemDate && itemHour < 12) ||
                    (lastItemDate && itemDateStr !== lastItemDate && itemHour < 12);
                const shouldAddAfternoonDivider = (!lastItemDate && itemHour >= 12) ||
                    (lastItemDate &&
                        itemDateStr === lastItemDate &&
                        lastItemHour < 12 &&
                        itemHour >= 12) ||
                    (lastItemDate && itemDateStr !== lastItemDate && itemHour >= 12);
                if (shouldAddMorningDivider) {
                    drawMorningDivider(requiredRowHeight);
                }
                if (shouldAddAfternoonDivider) {
                    drawAfternoonDivider(requiredRowHeight);
                }
                drawScheduleRow(rowIndex, rowData);
                lastItemDate = itemDateStr;
                lastItemHour = itemHour;
                rowIndex += 1;
            });
        }
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
    assertMissionAccess(user) {
        if ((0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_COORDENACAO_CIPAVD, role_access_1.ROLE_COMANDANTE_COMGEP, role_access_1.ROLE_TI])) {
            return;
        }
        (0, http_error_1.throwError)('RBAC_FORBIDDEN');
    }
    async getTargetLocalityIds() {
        const localities = await this.prisma.locality.findMany({
            select: { id: true, name: true, recruitsFemaleCountCurrent: true, updatedAt: true },
        });
        return (0, priority_localities_1.selectTargetLocalities)(localities).map((locality) => locality.id);
    }
    sanitizeRequiredText(value, field) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized.trim()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
        }
        return normalized;
    }
    parseRequiredDate(value, field) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'DATE_INVALID' });
        }
        return parsed;
    }
    normalizeDurationMinutes(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 1) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'durationMinutes', reason: 'DURATION_INVALID' });
        }
        return Math.round(parsed);
    }
    findScheduleLogoPath() {
        for (const candidate of scheduleLogoCandidates) {
            if (node_fs_1.default.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    getWeekStartDate(value) {
        const date = new Date(value);
        const day = (date.getUTCDay() + 6) % 7;
        date.setUTCDate(date.getUTCDate() - day);
        date.setUTCHours(0, 0, 0, 0);
        return date;
    }
    formatDateNoYear(value, timeZone = this.missionPdfTimeZone) {
        const { month, day } = this.getDateTimePartsInTimeZone(value, timeZone);
        return `${day}/${month}`;
    }
    formatWeekdayDate(value, timeZone = this.missionPdfTimeZone) {
        const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone })
            .format(value)
            .replace('.', '')
            .toUpperCase();
        return `${weekday} ${this.formatDateNoYear(value, timeZone)}`;
    }
    formatDuration(minutes) {
        const rounded = Math.max(1, Math.round(minutes));
        const hours = Math.floor(rounded / 60);
        const mins = rounded % 60;
        if (hours <= 0)
            return `${mins} min`;
        if (mins === 0)
            return `${hours}h`;
        return `${hours}h ${mins}min`;
    }
    formatDate(value, timeZone = this.missionPdfTimeZone) {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone }).format(value);
    }
    formatTime(value, timeZone = this.missionPdfTimeZone) {
        const { hour: hours, minute: minutes } = this.getDateTimePartsInTimeZone(value, timeZone);
        return `${hours}:${minutes}`;
    }
    getDateTimePartsInTimeZone(value, timeZone = this.missionPdfTimeZone) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(value);
        const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return {
            year: byType.year ?? '0000',
            month: byType.month ?? '01',
            day: byType.day ?? '01',
            hour: byType.hour ?? '00',
            minute: byType.minute ?? '00',
        };
    }
    removeOmFromParticipantName(name, fabom) {
        const normalizedName = (0, sanitize_1.sanitizeText)(name ?? '').trim();
        if (!normalizedName)
            return 'Participante';
        const normalizedFabom = (0, sanitize_1.sanitizeText)(fabom ?? '').trim();
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
        return normalizedName.replace(new RegExp(`\\s+${escapedFabom}$`, 'i'), '').trim() || normalizedName;
    }
    extractCpf(value) {
        const digits = String(value ?? '').replace(/\D/g, '');
        if (digits.length === 11)
            return digits;
        return null;
    }
    calculateInclusiveDays(startDate, endDate) {
        const startUtc = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
        const endUtc = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
        const diffMs = endUtc - startUtc;
        const diffDays = Math.floor(diffMs / 86_400_000);
        return Math.max(1, diffDays + 1);
    }
};
exports.MissionsService = MissionsService;
exports.MissionsService = MissionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        fab_ldap_service_1.FabLdapService])
], MissionsService);
//# sourceMappingURL=missions.service.js.map