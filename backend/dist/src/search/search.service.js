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
var SearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const executive_1 = require("../common/executive");
const role_access_1 = require("../rbac/role-access");
const litellm_service_1 = require("../llm/litellm.service");
let SearchService = SearchService_1 = class SearchService {
    prisma;
    litellm;
    logger = new common_1.Logger(SearchService_1.name);
    maxItemsPerEntity = 20;
    maxSemanticCandidates = 70;
    maxSemanticResults = 15;
    constructor(prisma, litellm) {
        this.prisma = prisma;
        this.litellm = litellm;
    }
    async query(q, user) {
        const query = q?.trim();
        if (!query) {
            return this.emptyPayload();
        }
        const constraints = this.getScopeConstraints(user);
        const permissions = this.resolveSearchPermissions(user);
        const queryTokens = this.extractQueryTokens(query);
        const taskWhere = permissions.canViewTasks
            ? this.buildTaskWhere(query, queryTokens, constraints, user)
            : null;
        const noticeWhere = permissions.canViewNotices
            ? this.buildNoticeWhere(query, queryTokens, constraints)
            : null;
        const meetingWhere = permissions.canViewMeetings
            ? this.buildMeetingWhere(query, queryTokens, constraints)
            : null;
        const localityWhere = permissions.canViewLocalities
            ? this.buildLocalityWhere(query, queryTokens, constraints)
            : null;
        const documentWhere = permissions.canViewDocuments
            ? this.buildDocumentWhere(query, queryTokens, user)
            : null;
        const [tasks, notices, meetings, localities, documents] = await Promise.all([
            taskWhere
                ? this.prisma.taskInstance.findMany({
                    where: taskWhere,
                    include: { taskTemplate: true, locality: true },
                    orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
                    take: this.maxItemsPerEntity,
                })
                : Promise.resolve([]),
            noticeWhere
                ? this.prisma.notice.findMany({
                    where: noticeWhere,
                    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
                    take: this.maxItemsPerEntity,
                })
                : Promise.resolve([]),
            meetingWhere
                ? this.prisma.meeting.findMany({
                    where: meetingWhere,
                    orderBy: [{ datetime: 'desc' }, { updatedAt: 'desc' }],
                    take: this.maxItemsPerEntity,
                })
                : Promise.resolve([]),
            localityWhere
                ? this.prisma.locality.findMany({
                    where: localityWhere,
                    orderBy: { name: 'asc' },
                    take: this.maxItemsPerEntity,
                })
                : Promise.resolve([]),
            documentWhere
                ? this.prisma.documentAsset.findMany({
                    where: documentWhere,
                    include: {
                        locality: { select: { id: true, name: true, code: true } },
                    },
                    orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
                    take: this.maxItemsPerEntity,
                })
                : Promise.resolve([]),
        ]);
        const payload = {
            tasks: tasks.map((task) => ({
                id: task.id,
                title: this.resolveTaskTitle(task),
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
            semantic: await this.buildSemanticResults({
                query,
                payload: {
                    tasks: tasks.map((task) => ({
                        id: task.id,
                        title: this.resolveTaskTitle(task),
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
                },
            }),
        };
        return user?.executiveHidePii ? (0, executive_1.sanitizeForExecutive)(payload) : payload;
    }
    emptyPayload() {
        return {
            tasks: [],
            notices: [],
            meetings: [],
            localities: [],
            documents: [],
            semantic: {
                usedAi: false,
                model: null,
                items: [],
            },
        };
    }
    resolveSearchPermissions(user) {
        return {
            canViewTasks: (0, role_access_1.hasPermission)(user, 'task_instances', 'view'),
            canViewNotices: (0, role_access_1.hasPermission)(user, 'notices', 'view'),
            canViewMeetings: (0, role_access_1.hasPermission)(user, 'meetings', 'view'),
            canViewLocalities: (0, role_access_1.hasPermission)(user, 'dashboard', 'view') ||
                (0, role_access_1.hasPermission)(user, 'localities', 'view'),
            canViewDocuments: (0, role_access_1.hasPermission)(user, 'documents', 'view'),
        };
    }
    buildTaskWhere(query, tokens, constraints, user) {
        const and = [
            {
                OR: [
                    { titleOverride: { contains: query, mode: 'insensitive' } },
                    { taskTemplate: { title: { contains: query, mode: 'insensitive' } } },
                    { locality: { name: { contains: query, mode: 'insensitive' } } },
                    { locality: { code: { contains: query, mode: 'insensitive' } } },
                ],
            },
        ];
        for (const token of tokens) {
            and.push({
                OR: [
                    { titleOverride: { contains: token, mode: 'insensitive' } },
                    { taskTemplate: { title: { contains: token, mode: 'insensitive' } } },
                    { locality: { name: { contains: token, mode: 'insensitive' } } },
                    { locality: { code: { contains: token, mode: 'insensitive' } } },
                ],
            });
        }
        if (constraints.localityId)
            and.push({ localityId: constraints.localityId });
        if (constraints.specialtyId) {
            and.push({
                OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
            });
        }
        const accessWhere = this.buildTaskViewAccessWhere(user);
        if (Object.keys(accessWhere).length > 0)
            and.push(accessWhere);
        return and.length === 1 ? and[0] : { AND: and };
    }
    buildNoticeWhere(query, tokens, constraints) {
        const and = [
            {
                OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { body: { contains: query, mode: 'insensitive' } },
                ],
            },
        ];
        for (const token of tokens) {
            and.push({
                OR: [
                    { title: { contains: token, mode: 'insensitive' } },
                    { body: { contains: token, mode: 'insensitive' } },
                ],
            });
        }
        if (constraints.localityId) {
            and.push({
                OR: [{ localityId: null }, { localityId: constraints.localityId }],
            });
        }
        if (constraints.specialtyId) {
            and.push({
                OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
            });
        }
        return and.length === 1 ? and[0] : { AND: and };
    }
    buildMeetingWhere(query, tokens, constraints) {
        const and = [
            {
                OR: [
                    { scope: { contains: query, mode: 'insensitive' } },
                    { agenda: { contains: query, mode: 'insensitive' } },
                    { location: { contains: query, mode: 'insensitive' } },
                ],
            },
        ];
        for (const token of tokens) {
            and.push({
                OR: [
                    { scope: { contains: token, mode: 'insensitive' } },
                    { agenda: { contains: token, mode: 'insensitive' } },
                    { location: { contains: token, mode: 'insensitive' } },
                ],
            });
        }
        if (constraints.localityId) {
            and.push({
                OR: [{ localityId: null }, { localityId: constraints.localityId }],
            });
        }
        return and.length === 1 ? and[0] : { AND: and };
    }
    buildLocalityWhere(query, tokens, constraints) {
        const and = [
            { catalogType: client_1.LocalityCatalogType.SMIF },
            {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } },
                ],
            },
        ];
        for (const token of tokens) {
            and.push({
                OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { code: { contains: token, mode: 'insensitive' } },
                ],
            });
        }
        if (constraints.localityId)
            and.push({ id: constraints.localityId });
        return { AND: and };
    }
    buildDocumentWhere(query, tokens, user) {
        const and = [
            {
                OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { sourcePath: { contains: query, mode: 'insensitive' } },
                    { fileName: { contains: query, mode: 'insensitive' } },
                    {
                        subcategory: { name: { contains: query, mode: 'insensitive' } },
                    },
                ],
            },
        ];
        for (const token of tokens) {
            and.push({
                OR: [
                    { title: { contains: token, mode: 'insensitive' } },
                    { sourcePath: { contains: token, mode: 'insensitive' } },
                    { fileName: { contains: token, mode: 'insensitive' } },
                    {
                        subcategory: { name: { contains: token, mode: 'insensitive' } },
                    },
                ],
            });
        }
        const scopeWhere = this.documentScopeWhere(user);
        if (Object.keys(scopeWhere).length > 0)
            and.push(scopeWhere);
        return and.length === 1 ? and[0] : { AND: and };
    }
    buildTaskViewAccessWhere(user) {
        if (!user?.id)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return {};
        if (profile.localityAdmin && profile.localityId) {
            return { localityId: profile.localityId };
        }
        if (profile.specialtyAdmin) {
            const and = [];
            if (profile.localityId)
                and.push({ localityId: profile.localityId });
            const groupOr = [];
            if (profile.groupSpecialtyId) {
                groupOr.push({
                    OR: [
                        { specialtyId: null },
                        { specialtyId: profile.groupSpecialtyId },
                    ],
                });
            }
            if (profile.groupEloRoleId) {
                groupOr.push({ eloRoleId: profile.groupEloRoleId });
                groupOr.push({ assignedElo: { eloRoleId: profile.groupEloRoleId } });
            }
            if (groupOr.length > 0)
                and.push({ OR: groupOr });
            if (and.length === 0)
                return { id: '__forbidden__' };
            return and.length === 1 ? and[0] : { AND: and };
        }
        const viewerOr = [
            { assignedToId: user.id },
            { responsibles: { some: { userId: user.id } } },
        ];
        if (user.localityId) {
            const groupOr = [];
            if (user.specialtyId) {
                groupOr.push({
                    OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }],
                });
            }
            if (user.eloRoleId) {
                groupOr.push({ eloRoleId: user.eloRoleId });
                groupOr.push({ assignedElo: { eloRoleId: user.eloRoleId } });
            }
            if (groupOr.length > 0) {
                viewerOr.push({
                    localityId: user.localityId,
                    OR: groupOr,
                });
            }
        }
        return { OR: viewerOr };
    }
    isAdminUser(user) {
        if (!user)
            return false;
        const hasPermissionEntry = (resource, action) => user.permissions.some((permission) => (permission.resource === resource || permission.resource === '*') &&
            (permission.action === action || permission.action === '*'));
        if (hasPermissionEntry('roles', 'view') ||
            hasPermissionEntry('roles', 'update') ||
            hasPermissionEntry('admin_rbac', 'export')) {
            return true;
        }
        return user.roles.some((role) => role.name.toLowerCase().includes('admin'));
    }
    shouldApplyDocumentLocalityScope(user) {
        if (!user?.localityId)
            return false;
        if (this.isAdminUser(user))
            return false;
        const hasNationalDocumentsViewScope = user.permissions.some((permission) => (permission.resource === 'documents' || permission.resource === '*') &&
            (permission.action === 'view' || permission.action === '*') &&
            permission.scope === client_1.PermissionScope.NATIONAL);
        return !hasNationalDocumentsViewScope;
    }
    documentScopeWhere(user) {
        if (!this.shouldApplyDocumentLocalityScope(user))
            return {};
        return {
            OR: [{ localityId: null }, { localityId: user?.localityId }],
        };
    }
    resolveTaskTitle(task) {
        const titleOverride = String(task.titleOverride ?? '').trim();
        if (titleOverride)
            return titleOverride;
        return String(task.taskTemplate?.title ?? '').trim() || 'Tarefa';
    }
    extractQueryTokens(query) {
        return Array.from(new Set(query
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3))).slice(0, 5);
    }
    async buildSemanticResults(args) {
        const candidates = this.buildSemanticCandidates(args.query, args.payload)
            .sort((a, b) => b.fallbackProbability - a.fallbackProbability)
            .slice(0, this.maxSemanticCandidates);
        if (candidates.length === 0) {
            return { usedAi: false, model: null, items: [] };
        }
        const aiRank = await this.rankWithAi(args.query, candidates);
        const orderedByFallback = [...candidates].sort((a, b) => b.fallbackProbability - a.fallbackProbability);
        const merged = new Map();
        if (aiRank?.results?.length) {
            for (const result of aiRank.results) {
                const candidate = candidates.find((item) => item.candidateId === result.candidateId);
                if (!candidate)
                    continue;
                merged.set(candidate.candidateId, {
                    id: candidate.id,
                    entityType: candidate.entityType,
                    entityTypeLabel: candidate.entityTypeLabel,
                    title: candidate.title,
                    subtitle: candidate.subtitle,
                    url: candidate.url,
                    probability: result.probability,
                });
                if (merged.size >= this.maxSemanticResults)
                    break;
            }
        }
        for (const fallback of orderedByFallback) {
            if (merged.size >= this.maxSemanticResults)
                break;
            if (merged.has(fallback.candidateId))
                continue;
            merged.set(fallback.candidateId, {
                id: fallback.id,
                entityType: fallback.entityType,
                entityTypeLabel: fallback.entityTypeLabel,
                title: fallback.title,
                subtitle: fallback.subtitle,
                url: fallback.url,
                probability: fallback.fallbackProbability,
            });
        }
        const items = Array.from(merged.values())
            .sort((a, b) => b.probability - a.probability)
            .slice(0, this.maxSemanticResults);
        return {
            usedAi: Boolean(aiRank?.results?.length),
            model: aiRank?.model ?? null,
            items,
        };
    }
    buildSemanticCandidates(query, payload) {
        const candidates = [];
        const pushCandidate = (candidate) => {
            const fallbackProbability = this.fallbackProbability(query, [
                candidate.title,
                candidate.subtitle ?? '',
                candidate.entityTypeLabel,
                ...candidate.keywords,
            ]);
            candidates.push({
                ...candidate,
                fallbackProbability,
            });
        };
        for (const task of payload.tasks) {
            pushCandidate({
                candidateId: `task:${task.id}`,
                id: task.id,
                entityType: 'TASK',
                entityTypeLabel: 'Tarefa',
                title: task.title,
                subtitle: task.localityName || null,
                url: `/tasks?taskId=${encodeURIComponent(task.id)}`,
                keywords: [task.status, task.localityName ?? ''],
            });
        }
        for (const meeting of payload.meetings) {
            pushCandidate({
                candidateId: `meeting:${meeting.id}`,
                id: meeting.id,
                entityType: 'MEETING',
                entityTypeLabel: 'Reunião',
                title: meeting.scope?.trim() || 'Reunião',
                subtitle: meeting.datetime?.toISOString() ?? null,
                url: `/meetings?meetingId=${encodeURIComponent(meeting.id)}`,
                keywords: [meeting.status],
            });
        }
        for (const locality of payload.localities) {
            pushCandidate({
                candidateId: `locality:${locality.id}`,
                id: locality.id,
                entityType: 'LOCALITY',
                entityTypeLabel: 'Localidade',
                title: locality.name,
                subtitle: locality.code || null,
                url: `/dashboard/locality/${encodeURIComponent(locality.id)}`,
                keywords: [locality.code],
            });
        }
        for (const document of payload.documents) {
            pushCandidate({
                candidateId: `document:${document.id}`,
                id: document.id,
                entityType: 'DOCUMENT',
                entityTypeLabel: 'Documento',
                title: document.title,
                subtitle: document.localityName ?? null,
                url: `/documents?docId=${encodeURIComponent(document.id)}`,
                keywords: [document.category, document.fileName],
            });
        }
        return candidates;
    }
    async rankWithAi(query, candidates) {
        if (!this.litellm.isConfigured())
            return null;
        const compactCandidates = candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            type: candidate.entityTypeLabel,
            title: String(candidate.title ?? '').slice(0, 180),
            subtitle: String(candidate.subtitle ?? '').slice(0, 180),
            url: candidate.url,
            keywords: candidate.keywords
                .map((keyword) => String(keyword ?? '').trim())
                .filter(Boolean)
                .slice(0, 4),
        }));
        const prompt = JSON.stringify({
            query,
            candidates: compactCandidates,
        }, null, 2);
        try {
            const { content, model } = await this.litellm.chatCompletion({
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um motor de ranking semântico para busca interna. ' +
                            'Responda estritamente em JSON válido, sem markdown e sem texto extra.',
                    },
                    {
                        role: 'user',
                        content: 'Classifique os candidatos mais prováveis para a consulta do usuário.\n' +
                            'Regras obrigatórias:\n' +
                            '- Use apenas candidateId da lista.\n' +
                            '- Não invente links nem IDs.\n' +
                            '- Retorne no máximo 15 resultados.\n' +
                            '- probability deve ser número entre 0 e 1.\n' +
                            '- Ordene por probability desc.\n' +
                            'Formato obrigatório de saída JSON:\n' +
                            '{ "results": [ { "candidateId": "...", "probability": 0.0 } ] }\n\n' +
                            prompt,
                    },
                ],
                temperature: 0,
                max_tokens: 900,
            });
            const parsed = this.parseSemanticResponse(content);
            if (!parsed?.length)
                return null;
            const candidateIdSet = new Set(candidates.map((item) => item.candidateId));
            const dedup = new Map();
            for (const item of parsed) {
                if (!candidateIdSet.has(item.candidateId))
                    continue;
                if (dedup.has(item.candidateId))
                    continue;
                dedup.set(item.candidateId, item);
            }
            return {
                model,
                results: Array.from(dedup.values()).sort((a, b) => b.probability - a.probability),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Busca semântica IA indisponível: ${message}`);
            return null;
        }
    }
    parseSemanticResponse(raw) {
        const parsed = this.parseJsonLoose(raw);
        if (!parsed)
            return null;
        const list = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.results)
                ? parsed.results
                : null;
        if (!list)
            return null;
        const items = [];
        for (const row of list) {
            const candidateId = String(row?.candidateId ?? '').trim();
            if (!candidateId)
                continue;
            const probabilityRaw = Number(row?.probability);
            if (!Number.isFinite(probabilityRaw))
                continue;
            const probability = Math.max(0, Math.min(1, probabilityRaw));
            items.push({
                candidateId,
                probability: Number(probability.toFixed(4)),
            });
        }
        return items;
    }
    parseJsonLoose(raw) {
        const source = String(raw ?? '').trim();
        if (!source)
            return null;
        const tryParse = (input) => {
            try {
                return JSON.parse(input);
            }
            catch {
                return null;
            }
        };
        const direct = tryParse(source);
        if (direct !== null)
            return direct;
        const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fencedMatch?.[1]) {
            const fenced = tryParse(fencedMatch[1].trim());
            if (fenced !== null)
                return fenced;
        }
        const firstBrace = source.indexOf('{');
        const lastBrace = source.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const objectLike = tryParse(source.slice(firstBrace, lastBrace + 1));
            if (objectLike !== null)
                return objectLike;
        }
        const firstBracket = source.indexOf('[');
        const lastBracket = source.lastIndexOf(']');
        if (firstBracket !== -1 &&
            lastBracket !== -1 &&
            lastBracket > firstBracket) {
            const arrayLike = tryParse(source.slice(firstBracket, lastBracket + 1));
            if (arrayLike !== null)
                return arrayLike;
        }
        return null;
    }
    fallbackProbability(query, fragments) {
        const normalizedQuery = this.normalizeSearchText(query);
        const normalizedContent = this.normalizeSearchText(fragments.join(' '));
        if (!normalizedQuery || !normalizedContent)
            return 0.05;
        const tokens = normalizedQuery
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2);
        let score = 0;
        if (normalizedContent.includes(normalizedQuery))
            score += 0.55;
        const uniqueTokenMatches = new Set();
        for (const token of tokens) {
            if (normalizedContent.includes(token)) {
                uniqueTokenMatches.add(token);
                score += 0.12;
            }
        }
        if (tokens.length > 0 && uniqueTokenMatches.size === tokens.length) {
            score += 0.18;
        }
        return Number(Math.max(0.05, Math.min(0.98, score)).toFixed(4));
    }
    normalizeSearchText(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    getScopeConstraints(user) {
        if (!user)
            return {};
        const profile = (0, role_access_1.resolveAccessProfile)(user);
        if (profile.ti || profile.nationalCommission)
            return {};
        if (profile.localityAdmin) {
            return {
                localityId: profile.localityId ?? undefined,
                specialtyId: undefined,
            };
        }
        if (profile.specialtyAdmin) {
            return {
                localityId: profile.localityId ?? undefined,
                specialtyId: profile.groupSpecialtyId ?? undefined,
            };
        }
        return {
            localityId: user.localityId ?? undefined,
            specialtyId: user.specialtyId ?? undefined,
        };
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = SearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        litellm_service_1.LitellmService])
], SearchService);
//# sourceMappingURL=search.service.js.map