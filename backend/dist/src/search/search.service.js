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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const executive_1 = require("../common/executive");
let SearchService = class SearchService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async query(q, user) {
        const query = q?.trim();
        if (!query) {
            return { tasks: [], notices: [], meetings: [], localities: [], documents: [] };
        }
        const taskWhere = {
            taskTemplate: { title: { contains: query, mode: 'insensitive' } },
        };
        if (user?.localityId)
            taskWhere.localityId = user.localityId;
        const noticeWhere = {
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { body: { contains: query, mode: 'insensitive' } },
            ],
        };
        if (user?.localityId) {
            noticeWhere.AND = [
                { OR: [{ localityId: null }, { localityId: user.localityId }] },
            ];
        }
        if (user?.specialtyId) {
            noticeWhere.AND = [
                ...(noticeWhere.AND ?? []),
                { OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }] },
            ];
        }
        const meetingWhere = {
            OR: [
                { agenda: { contains: query, mode: 'insensitive' } },
            ],
        };
        if (user?.localityId) {
            meetingWhere.AND = [{ OR: [{ localityId: null }, { localityId: user.localityId }] }];
        }
        const localityWhere = {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
            ],
        };
        if (user?.localityId)
            localityWhere.id = user.localityId;
        const documentWhere = {
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { sourcePath: { contains: query, mode: 'insensitive' } },
            ],
        };
        if (user?.localityId) {
            documentWhere.AND = [{ OR: [{ localityId: null }, { localityId: user.localityId }] }];
        }
        const [tasks, notices, meetings, localities, documents] = await this.prisma.$transaction([
            this.prisma.taskInstance.findMany({
                where: taskWhere,
                include: { taskTemplate: true, locality: true },
                take: 10,
            }),
            this.prisma.notice.findMany({
                where: noticeWhere,
                take: 10,
            }),
            this.prisma.meeting.findMany({
                where: meetingWhere,
                take: 10,
            }),
            this.prisma.locality.findMany({
                where: localityWhere,
                take: 10,
            }),
            this.prisma.documentAsset.findMany({
                where: documentWhere,
                include: { locality: { select: { id: true, name: true, code: true } } },
                take: 10,
            }),
        ]);
        const payload = {
            tasks: tasks.map((task) => ({
                id: task.id,
                title: task.taskTemplate?.title ?? '',
                localityId: task.localityId,
                localityName: task.locality?.name ?? '',
                dueDate: task.dueDate,
                status: task.status,
            })),
            notices: notices.map((notice) => ({
                id: notice.id,
                title: notice.title,
                priority: notice.priority,
                dueDate: notice.dueDate,
            })),
            meetings: meetings.map((meeting) => ({
                id: meeting.id,
                datetime: meeting.datetime,
                status: meeting.status,
                scope: meeting.scope,
                localityId: meeting.localityId,
            })),
            localities: localities.map((loc) => ({
                id: loc.id,
                code: loc.code,
                name: loc.name,
            })),
            documents: documents.map((doc) => ({
                id: doc.id,
                title: doc.title,
                category: doc.category,
                localityId: doc.localityId,
                localityName: doc.locality?.name ?? null,
                fileName: doc.fileName,
            })),
        };
        return user?.executiveHidePii ? (0, executive_1.sanitizeForExecutive)(payload) : payload;
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SearchService);
//# sourceMappingURL=search.service.js.map