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
exports.ActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const pdfkit_1 = __importDefault(require("pdfkit"));
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const sanitize_1 = require("../common/sanitize");
const pagination_1 = require("../common/pagination");
const activityPhotosDir = node_path_1.default.resolve(process.cwd(), 'storage', 'activity-reports');
const scheduleLogoCandidates = [
    node_path_1.default.resolve(process.cwd(), 'frontend', 'public', 'brand', 'cipavd-7.png'),
    node_path_1.default.resolve(process.cwd(), 'public', 'brand', 'cipavd-7.png'),
    node_path_1.default.resolve(process.cwd(), '..', 'frontend', 'public', 'brand', 'cipavd-7.png'),
];
let ActivitiesService = class ActivitiesService {
    prisma;
    audit;
    config;
    constructor(prisma, audit, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.config = config;
    }
    async list(filters, user) {
        const where = {};
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.status)
            where.status = filters.status;
        if (filters.q) {
            where.OR = [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { description: { contains: filters.q, mode: 'insensitive' } },
            ];
        }
        if (user?.localityId) {
            const andArr = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
            where.AND = [...andArr, { OR: [{ localityId: null }, { localityId: user.localityId }] }];
        }
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.activity.findMany({
                where,
                orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
                skip,
                take,
                include: {
                    locality: { select: { id: true, code: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                    report: {
                        include: {
                            photos: {
                                select: { id: true, fileName: true, fileUrl: true, createdAt: true },
                                orderBy: { createdAt: 'asc' },
                            },
                            signedBy: { select: { id: true, name: true, email: true } },
                        },
                    },
                },
            }),
            this.prisma.activity.count({ where }),
        ]);
        const withCommentSummary = await this.attachActivityCommentSummary(items, user);
        return {
            items: withCommentSummary.map((item) => this.mapActivity(item)),
            page,
            pageSize,
            total,
        };
    }
    async create(payload, user) {
        const localityId = payload.localityId ?? user?.localityId ?? null;
        this.assertLocalityConstraint(localityId, user);
        const created = await this.prisma.activity.create({
            data: {
                title: (0, sanitize_1.sanitizeText)(payload.title),
                description: payload.description ? (0, sanitize_1.sanitizeText)(payload.description) : null,
                localityId,
                eventDate: payload.eventDate ? new Date(payload.eventDate) : null,
                reportRequired: payload.reportRequired ?? false,
                createdById: user?.id ?? null,
            },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                report: {
                    include: {
                        photos: { select: { id: true, fileName: true, fileUrl: true, createdAt: true } },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'create',
            entityId: created.id,
            localityId: created.localityId ?? undefined,
            diffJson: { title: created.title, reportRequired: created.reportRequired },
        });
        return this.mapActivity(created);
    }
    async update(id, payload, user) {
        const existing = await this.prisma.activity.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(existing.localityId, user);
        const localityId = payload.localityId === undefined ? existing.localityId : payload.localityId;
        this.assertLocalityConstraint(localityId, user);
        const updated = await this.prisma.activity.update({
            where: { id },
            data: {
                title: payload.title ? (0, sanitize_1.sanitizeText)(payload.title) : undefined,
                description: payload.description === undefined
                    ? undefined
                    : payload.description === null
                        ? null
                        : (0, sanitize_1.sanitizeText)(payload.description),
                localityId,
                eventDate: payload.eventDate === undefined
                    ? undefined
                    : payload.eventDate === null
                        ? null
                        : new Date(payload.eventDate),
                reportRequired: payload.reportRequired ?? undefined,
            },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                report: {
                    include: {
                        photos: { select: { id: true, fileName: true, fileUrl: true, createdAt: true } },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'update',
            entityId: id,
            localityId: updated.localityId ?? undefined,
            diffJson: {
                title: updated.title,
                status: updated.status,
                reportRequired: updated.reportRequired,
            },
        });
        return this.mapActivity(updated);
    }
    async updateStatus(id, status, user) {
        const existing = await this.prisma.activity.findUnique({
            where: { id },
            include: {
                report: {
                    include: { photos: { select: { id: true } } },
                },
            },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(existing.localityId, user);
        if (status === client_1.ActivityStatus.DONE && existing.reportRequired) {
            if (!existing.report) {
                (0, http_error_1.throwError)('ACTIVITY_REPORT_REQUIRED');
            }
            if (!existing.report.signedAt || !existing.report.signatureHash) {
                (0, http_error_1.throwError)('ACTIVITY_REPORT_SIGNATURE_REQUIRED');
            }
        }
        const updated = await this.prisma.activity.update({
            where: { id },
            data: { status },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                report: {
                    include: {
                        photos: { select: { id: true, fileName: true, fileUrl: true, createdAt: true } },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'update_status',
            entityId: id,
            localityId: updated.localityId ?? undefined,
            diffJson: { status },
        });
        return this.mapActivity(updated);
    }
    async listComments(id, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            select: { id: true, localityId: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const [comments, readState] = await this.prisma.$transaction([
            this.prisma.activityComment.findMany({
                where: { activityId: id },
                include: { author: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            user?.id
                ? this.prisma.activityCommentRead.findUnique({
                    where: { activityId_userId: { activityId: id, userId: user.id } },
                })
                : this.prisma.activityCommentRead.findFirst({ where: { activityId: id, userId: '__none__' } }),
        ]);
        const seenAt = readState?.seenAt ?? null;
        const unread = user?.id
            ? comments.filter((comment) => comment.authorId !== user.id && (!seenAt || comment.createdAt > seenAt)).length
            : 0;
        return {
            items: comments.map((comment) => this.mapComment(comment, user?.executiveHidePii)),
            summary: {
                total: comments.length,
                unread,
                hasUnread: unread > 0,
            },
        };
    }
    async addComment(id, text, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            select: { id: true, localityId: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const normalized = this.sanitizeCommentText(text);
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'text', reason: 'COMMENT_REQUIRED' });
        }
        const created = await this.prisma.activityComment.create({
            data: {
                activityId: id,
                authorId: user.id,
                text: normalized,
            },
            include: { author: { select: { id: true, name: true, email: true } } },
        });
        await this.prisma.activityCommentRead.upsert({
            where: { activityId_userId: { activityId: id, userId: user.id } },
            update: { seenAt: new Date() },
            create: { activityId: id, userId: user.id, seenAt: new Date() },
        });
        await this.audit.log({
            userId: user.id,
            resource: 'activity_comments',
            action: 'create',
            entityId: created.id,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId: id },
        });
        return this.mapComment(created, user?.executiveHidePii);
    }
    async markCommentsSeen(id, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            select: { id: true, localityId: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const seenAt = new Date();
        await this.prisma.activityCommentRead.upsert({
            where: { activityId_userId: { activityId: id, userId: user.id } },
            update: { seenAt },
            create: { activityId: id, userId: user.id, seenAt },
        });
        return { ok: true, seenAt };
    }
    async listSchedule(activityId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: {
                id: true,
                title: true,
                eventDate: true,
                localityId: true,
                locality: { select: { id: true, code: true, name: true } },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const items = await this.prisma.activityVisitScheduleItem.findMany({
            where: { activityId },
            orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
        });
        return {
            activity: {
                id: activity.id,
                title: activity.title,
                eventDate: activity.eventDate,
                locality: activity.locality,
            },
            items: items.map((item) => this.mapScheduleItem(item)),
        };
    }
    async createScheduleItem(activityId, payload, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: { id: true, localityId: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const created = await this.prisma.activityVisitScheduleItem.create({
            data: {
                activityId,
                title: this.sanitizeRequiredText(payload.title, 'title'),
                startTime: this.normalizeScheduleTime(payload.startTime),
                durationMinutes: this.normalizeDurationMinutes(payload.durationMinutes),
                location: this.sanitizeRequiredText(payload.location, 'location'),
                responsible: this.sanitizeRequiredText(payload.responsible, 'responsible'),
                participants: this.sanitizeRequiredText(payload.participants, 'participants'),
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'create_schedule_item',
            entityId: created.id,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId, startTime: created.startTime },
        });
        return this.mapScheduleItem(created);
    }
    async updateScheduleItem(activityId, itemId, payload, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: { id: true, localityId: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const existing = await this.prisma.activityVisitScheduleItem.findFirst({
            where: { id: itemId, activityId },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const updated = await this.prisma.activityVisitScheduleItem.update({
            where: { id: itemId },
            data: {
                title: payload.title === undefined ? undefined : this.sanitizeRequiredText(payload.title, 'title'),
                startTime: payload.startTime === undefined ? undefined : this.normalizeScheduleTime(payload.startTime),
                durationMinutes: payload.durationMinutes === undefined
                    ? undefined
                    : this.normalizeDurationMinutes(payload.durationMinutes),
                location: payload.location === undefined ? undefined : this.sanitizeRequiredText(payload.location, 'location'),
                responsible: payload.responsible === undefined
                    ? undefined
                    : this.sanitizeRequiredText(payload.responsible, 'responsible'),
                participants: payload.participants === undefined
                    ? undefined
                    : this.sanitizeRequiredText(payload.participants, 'participants'),
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'update_schedule_item',
            entityId: itemId,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId },
        });
        return this.mapScheduleItem(updated);
    }
    async deleteScheduleItem(activityId, itemId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: { id: true, localityId: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const existing = await this.prisma.activityVisitScheduleItem.findFirst({
            where: { id: itemId, activityId },
            select: { id: true },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.activityVisitScheduleItem.delete({ where: { id: itemId } });
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'delete_schedule_item',
            entityId: itemId,
            localityId: activity.localityId ?? undefined,
            diffJson: { activityId },
        });
        return { ok: true };
    }
    async buildSchedulePdf(activityId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                visitScheduleItems: {
                    orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const doc = new pdfkit_1.default({ margin: 48, size: 'A4' });
        const chunks = [];
        const done = new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
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
            }
            catch {
                doc.y = logoY + 8;
            }
        }
        const writeLine = (label, value) => {
            doc.font('Helvetica-Bold').fontSize(10).text(label);
            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(11).text(value || '-', { align: 'left' });
            doc.moveDown(0.7);
        };
        doc.font('Helvetica-Bold').fontSize(16).text('Cronograma da Visita', { align: 'center' });
        doc.moveDown(1);
        writeLine('Atividade', activity.title);
        writeLine('Localidade', activity.locality ? `${activity.locality.name} (${activity.locality.code})` : 'Não vinculada');
        writeLine('Data da visita', activity.eventDate ? this.formatDate(activity.eventDate) : 'Não informada');
        doc.font('Helvetica-Bold').fontSize(12).text('Programação', { underline: true });
        doc.moveDown(0.4);
        if (activity.visitScheduleItems.length === 0) {
            doc.font('Helvetica').fontSize(11).text('Nenhum item de cronograma cadastrado para esta visita.');
        }
        else {
            activity.visitScheduleItems.forEach((item, index) => {
                if (doc.y > doc.page.height - 150) {
                    doc.addPage();
                }
                const rowY = doc.y;
                doc
                    .roundedRect(doc.page.margins.left, rowY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 96, 6)
                    .fillAndStroke('#F5F8FC', '#D7E0EC');
                const blockStart = rowY + 10;
                doc.fillColor('#111827');
                doc.font('Helvetica-Bold').fontSize(11).text(`${index + 1}. ${item.startTime} • ${this.formatDuration(item.durationMinutes)}`, doc.page.margins.left + 10, blockStart);
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
                doc.y = rowY + 106;
            });
        }
        doc.end();
        const buffer = await done;
        const sanitizedTitle = activity.title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60);
        const fileName = `cronograma_visita_${sanitizedTitle || activity.id}.pdf`;
        return { fileName, buffer };
    }
    async upsertReport(activityId, payload, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: { report: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        const reportData = {
            date: new Date(payload.date),
            location: (0, sanitize_1.sanitizeText)(payload.location),
            responsible: (0, sanitize_1.sanitizeText)(payload.responsible),
            missionSupport: (0, sanitize_1.sanitizeText)(payload.missionSupport),
            introduction: (0, sanitize_1.sanitizeText)(payload.introduction),
            missionObjectives: (0, sanitize_1.sanitizeText)(payload.missionObjectives),
            executionSchedule: (0, sanitize_1.sanitizeText)(payload.executionSchedule),
            activitiesPerformed: (0, sanitize_1.sanitizeText)(payload.activitiesPerformed),
            participantsCount: payload.participantsCount,
            participantsCharacteristics: (0, sanitize_1.sanitizeText)(payload.participantsCharacteristics),
            conclusion: (0, sanitize_1.sanitizeText)(payload.conclusion),
            city: (0, sanitize_1.sanitizeText)(payload.city),
            closingDate: new Date(payload.closingDate),
            signaturePayloadHash: null,
            signatureHash: null,
            signatureAlgorithm: null,
            signatureVersion: null,
            signedAt: null,
            signedById: null,
        };
        if (activity.report) {
            await this.prisma.activityReport.update({
                where: { activityId },
                data: reportData,
            });
        }
        else {
            await this.prisma.activityReport.create({
                data: {
                    activityId,
                    ...reportData,
                },
            });
        }
        const updated = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                        signedBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!updated)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'upsert_report',
            entityId: activityId,
            localityId: updated.localityId ?? undefined,
            diffJson: { reportSignedReset: true },
        });
        return this.mapActivity(updated);
    }
    async addReportPhoto(activityId, file, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: { report: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const created = await this.prisma.activityReportPhoto.create({
            data: {
                reportId: activity.report.id,
                fileName: file.fileName,
                fileUrl: file.fileUrl,
                storageKey: file.storageKey ?? null,
                mimeType: file.mimeType ?? null,
                fileSize: file.fileSize ?? null,
                checksum: file.checksum ?? null,
            },
        });
        await this.invalidateSignature(activity.report.id);
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'add_report_photo',
            entityId: activityId,
            localityId: activity.localityId ?? undefined,
            diffJson: { photoId: created.id, fileName: created.fileName },
        });
        return created;
    }
    async removeReportPhoto(activityId, photoId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: { report: true },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const photo = await this.prisma.activityReportPhoto.findFirst({
            where: { id: photoId, reportId: activity.report.id },
        });
        if (!photo)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.activityReportPhoto.delete({ where: { id: photoId } });
        await this.invalidateSignature(activity.report.id);
        await this.audit.log({
            userId: user?.id,
            resource: 'activities',
            action: 'remove_report_photo',
            entityId: activityId,
            localityId: activity.localityId ?? undefined,
            diffJson: { photoId },
        });
        return { ok: true };
    }
    async signReport(activityId, user) {
        if (!user?.id)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                report: {
                    include: {
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                checksum: true,
                                fileUrl: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const report = activity.report;
        if (!report.location ||
            !report.responsible ||
            !report.missionSupport ||
            !report.introduction ||
            !report.missionObjectives ||
            !report.executionSchedule ||
            !report.activitiesPerformed ||
            !report.participantsCharacteristics ||
            !report.conclusion ||
            !report.city) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'ACTIVITY_REPORT_INCOMPLETE' });
        }
        const signedAt = new Date();
        const payload = {
            activity: {
                id: activity.id,
                title: activity.title,
                localityId: activity.localityId,
                eventDate: activity.eventDate?.toISOString() ?? null,
            },
            report: {
                date: report.date.toISOString(),
                location: report.location,
                responsible: report.responsible,
                missionSupport: report.missionSupport,
                introduction: report.introduction,
                missionObjectives: report.missionObjectives,
                executionSchedule: report.executionSchedule,
                activitiesPerformed: report.activitiesPerformed,
                participantsCount: report.participantsCount,
                participantsCharacteristics: report.participantsCharacteristics,
                conclusion: report.conclusion,
                city: report.city,
                closingDate: report.closingDate.toISOString(),
            },
            photos: report.photos.map((p) => ({ id: p.id, fileName: p.fileName, checksum: p.checksum ?? null })),
            signer: {
                userId: user.id,
                signedAt: signedAt.toISOString(),
            },
        };
        const serialized = JSON.stringify(payload);
        const payloadHash = (0, node_crypto_1.createHash)('sha256').update(serialized).digest('hex');
        const secret = this.config.get('ACTIVITY_SIGNATURE_SECRET') ??
            this.config.get('JWT_ACCESS_SECRET') ??
            'smif-activity-signature';
        const signatureHash = (0, node_crypto_1.createHmac)('sha256', secret).update(payloadHash).digest('hex');
        const updated = await this.prisma.activityReport.update({
            where: { id: report.id },
            data: {
                signedAt,
                signedById: user.id,
                signaturePayloadHash: payloadHash,
                signatureHash,
                signatureAlgorithm: 'HMAC-SHA256',
                signatureVersion: 1,
            },
            include: {
                signedBy: { select: { id: true, name: true, email: true } },
                photos: { select: { id: true, fileName: true, fileUrl: true, createdAt: true } },
            },
        });
        await this.audit.log({
            userId: user.id,
            resource: 'activities',
            action: 'sign_report',
            entityId: activityId,
            localityId: activity.localityId ?? undefined,
            diffJson: {
                signatureAlgorithm: updated.signatureAlgorithm,
                signatureVersion: updated.signatureVersion,
            },
        });
        return {
            activityId,
            signedAt: updated.signedAt,
            signedBy: updated.signedBy,
            signatureHash: updated.signatureHash,
            signaturePayloadHash: updated.signaturePayloadHash,
            signatureAlgorithm: updated.signatureAlgorithm,
            signatureVersion: updated.signatureVersion,
        };
    }
    async buildReportPdf(activityId, user) {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                locality: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                report: {
                    include: {
                        signedBy: { select: { id: true, name: true, email: true } },
                        photos: {
                            select: {
                                id: true,
                                fileName: true,
                                storageKey: true,
                                fileUrl: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!activity)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertLocalityConstraint(activity.localityId, user);
        if (!activity.report)
            (0, http_error_1.throwError)('ACTIVITY_REPORT_NOT_FOUND');
        const report = activity.report;
        const doc = new pdfkit_1.default({ margin: 48, size: 'A4' });
        const chunks = [];
        const done = new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
        });
        const writeLine = (label, value) => {
            doc.font('Helvetica-Bold').fontSize(10).text(label);
            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(11).text(value || '-', { align: 'justify' });
            doc.moveDown(0.8);
        };
        doc.font('Helvetica-Bold').fontSize(16).text('Relatório de Atividade', { align: 'center' });
        doc.moveDown(0.8);
        writeLine('Atividade', activity.title);
        writeLine('Localidade', activity.locality ? `${activity.locality.name} (${activity.locality.code})` : 'Não vinculada');
        writeLine('Data da atividade', this.formatDate(report.date));
        writeLine('Local', report.location);
        writeLine('Responsável', report.responsible);
        writeLine('Amparo da missão', report.missionSupport);
        writeLine('Introdução', report.introduction);
        writeLine('Objetivos da missão', report.missionObjectives);
        writeLine('Cronograma de execução', report.executionSchedule);
        writeLine('Atividades realizadas', report.activitiesPerformed);
        writeLine('Participantes (número)', String(report.participantsCount));
        writeLine('Participantes (características)', report.participantsCharacteristics);
        writeLine('Conclusão', report.conclusion);
        writeLine('Cidade', report.city);
        writeLine('Data (fechamento)', this.formatDate(report.closingDate));
        doc.font('Helvetica-Bold').fontSize(12).text('Assinatura Digital', { underline: true });
        doc.moveDown(0.4);
        if (report.signedAt && report.signatureHash) {
            doc.font('Helvetica').fontSize(11).text('Status: ASSINADO');
            doc.text(`Assinado em: ${this.formatDateTime(report.signedAt)}`);
            doc.text(`Assinado por: ${report.signedBy?.name ?? report.signedById ?? 'N/A'}`);
            doc.text(`Algoritmo: ${report.signatureAlgorithm ?? 'HMAC-SHA256'} v${report.signatureVersion ?? 1}`);
            doc.text(`Hash da assinatura: ${report.signatureHash}`);
            doc.text(`Hash do conteúdo: ${report.signaturePayloadHash ?? '-'}`);
        }
        else {
            doc.font('Helvetica').fontSize(11).text('Status: NÃO ASSINADO');
        }
        if (report.photos.length > 0) {
            doc.addPage();
            doc.font('Helvetica-Bold').fontSize(14).text('Imagens da atividade', { align: 'left' });
            doc.moveDown(0.6);
            for (const photo of report.photos) {
                doc.font('Helvetica').fontSize(10).text(`• ${photo.fileName}`);
                const storageKey = photo.storageKey ?? node_path_1.default.basename(photo.fileUrl);
                const filePath = node_path_1.default.join(activityPhotosDir, storageKey);
                if (node_fs_1.default.existsSync(filePath)) {
                    try {
                        const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                        doc.image(filePath, {
                            fit: [availableWidth, 220],
                            align: 'center',
                        });
                        doc.moveDown(0.8);
                    }
                    catch {
                        doc.font('Helvetica-Oblique').text('  (Não foi possível renderizar esta imagem no PDF)');
                        doc.moveDown(0.6);
                    }
                }
                else {
                    doc.font('Helvetica-Oblique').text('  (Arquivo de imagem não encontrado no armazenamento)');
                    doc.moveDown(0.6);
                }
            }
        }
        doc.end();
        const buffer = await done;
        const sanitizedTitle = activity.title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60);
        const fileName = `relatorio_atividade_${sanitizedTitle || activity.id}.pdf`;
        return { fileName, buffer };
    }
    async attachActivityCommentSummary(items, user) {
        if (!Array.isArray(items) || items.length === 0)
            return items;
        const ids = items.map((item) => item.id);
        const [comments, reads] = await this.prisma.$transaction([
            this.prisma.activityComment.findMany({
                where: { activityId: { in: ids } },
                select: { activityId: true, authorId: true, createdAt: true },
            }),
            user?.id
                ? this.prisma.activityCommentRead.findMany({
                    where: { activityId: { in: ids }, userId: user.id },
                    select: { activityId: true, seenAt: true },
                })
                : this.prisma.activityCommentRead.findMany({
                    where: { activityId: { in: [] } },
                    select: { activityId: true, seenAt: true },
                }),
        ]);
        const seenAtByActivity = new Map();
        for (const read of reads)
            seenAtByActivity.set(read.activityId, read.seenAt);
        const summaryByActivity = new Map();
        for (const id of ids)
            summaryByActivity.set(id, { total: 0, unread: 0, lastCommentAt: null });
        for (const comment of comments) {
            const current = summaryByActivity.get(comment.activityId) ?? {
                total: 0,
                unread: 0,
                lastCommentAt: null,
            };
            current.total += 1;
            if (!current.lastCommentAt || comment.createdAt > current.lastCommentAt) {
                current.lastCommentAt = comment.createdAt;
            }
            if (user?.id && comment.authorId !== user.id) {
                const seenAt = seenAtByActivity.get(comment.activityId);
                if (!seenAt || comment.createdAt > seenAt) {
                    current.unread += 1;
                }
            }
            summaryByActivity.set(comment.activityId, current);
        }
        return items.map((item) => {
            const summary = summaryByActivity.get(item.id) ?? { total: 0, unread: 0, lastCommentAt: null };
            return {
                ...item,
                comments: {
                    total: summary.total,
                    unread: summary.unread,
                    hasUnread: summary.unread > 0,
                    lastCommentAt: summary.lastCommentAt,
                },
            };
        });
    }
    mapActivity(activity) {
        return {
            ...activity,
            report: activity.report
                ? {
                    ...activity.report,
                    hasSignature: Boolean(activity.report.signedAt && activity.report.signatureHash),
                }
                : null,
        };
    }
    mapComment(comment, executiveHidePii) {
        return {
            id: comment.id,
            activityId: comment.activityId,
            text: comment.text,
            createdAt: comment.createdAt,
            author: executiveHidePii
                ? null
                : comment.author
                    ? {
                        id: comment.author.id,
                        name: comment.author.name ?? comment.author.email ?? 'Usuário',
                    }
                    : null,
            authorName: executiveHidePii
                ? 'Usuário interno'
                : comment.author?.name ?? comment.author?.email ?? 'Usuário',
        };
    }
    mapScheduleItem(item) {
        return {
            id: item.id,
            activityId: item.activityId,
            title: item.title,
            startTime: item.startTime,
            durationMinutes: item.durationMinutes,
            location: item.location,
            responsible: item.responsible,
            participants: item.participants,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }
    normalizeScheduleTime(value) {
        const normalized = String(value ?? '').trim();
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'startTime', reason: 'TIME_INVALID' });
        }
        return normalized;
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
    sanitizeRequiredText(value, field) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized.trim()) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
        }
        return normalized;
    }
    sanitizeCommentText(input) {
        return String(input ?? '')
            .replace(/[<>]/g, '')
            .replace(/\r\n/g, '\n')
            .trim();
    }
    assertLocalityConstraint(localityId, user) {
        if (user?.localityId && localityId && user.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async invalidateSignature(reportId) {
        await this.prisma.activityReport.update({
            where: { id: reportId },
            data: {
                signaturePayloadHash: null,
                signatureHash: null,
                signatureAlgorithm: null,
                signatureVersion: null,
                signedAt: null,
                signedById: null,
            },
        });
    }
    formatDate(value) {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(value);
    }
    formatDateTime(value) {
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(value);
    }
};
exports.ActivitiesService = ActivitiesService;
exports.ActivitiesService = ActivitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        config_1.ConfigService])
], ActivitiesService);
//# sourceMappingURL=activities.service.js.map