"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiRecruitsService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const pagination_1 = require("../common/pagination");
const http_error_1 = require("../common/http-error");
const prisma_service_1 = require("../prisma/prisma.service");
const YES_NO_PARTIAL_OPTIONS = ['Sim', 'Parcialmente', 'Não'];
const WILLINGNESS_OPTIONS = [
    'Seguro(a)',
    'Nem seguro(a) nem inseguro(a)',
    'Inseguro(a)',
];
const ENLISTMENT_DECISION_OPTIONS = [
    'Interesse em seguir carreira militar',
    'Desenvolvimento pessoal',
    'Disciplina e organização',
    'Experiência profissional',
    'Cumprimento do serviço obrigatório',
    'Estabilidade financeira',
];
const RECRUITS_CARD_IDS = new Set([
    'page-header',
    'panel-ingestion',
    'panel-filters',
    'kpi-total',
    'kpi-guidance',
    'kpi-report',
    'kpi-attention',
    'chart-response-trend',
    'chart-education',
    'chart-gender',
    'chart-identify-harassment',
    'chart-conduct-limits',
    'chart-know-orientation',
    'chart-know-report-process',
    'chart-willingness-orientation',
    'chart-willingness-report',
    'chart-enlistment-influence',
    'insight-main',
    'list-free-text',
    'list-responses',
    'list-imports',
]);
let BiRecruitsService = class BiRecruitsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async importResponses(file, user, options = {}) {
        const extension = this.fileExtension(file.originalname);
        const format = extension === 'csv' ? client_1.BiImportFormat.CSV : client_1.BiImportFormat.XLSX;
        const replaceAll = options.replaceAll === true;
        const { sheetName, rows } = this.extractRows(file.buffer, format);
        if (rows.length === 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'empty_file' });
        }
        const [headerRow, ...dataRows] = rows;
        const headerMap = this.resolveHeaderMap(headerRow);
        const parsed = [];
        let invalidRows = 0;
        for (let index = 0; index < dataRows.length; index += 1) {
            const row = dataRows[index];
            const parsedRow = this.parseDataRow(row, headerMap, index + 2);
            if (parsedRow.skip)
                continue;
            if (!parsedRow.value) {
                invalidRows += 1;
                continue;
            }
            parsed.push(parsedRow.value);
        }
        if (replaceAll) {
            await this.prisma.$transaction([
                this.prisma.biRecruitsResponse.deleteMany(),
                this.prisma.biRecruitsImportBatch.deleteMany(),
            ]);
        }
        const batch = await this.prisma.biRecruitsImportBatch.create({
            data: {
                fileName: file.originalname,
                format,
                sheetName,
                totalRows: parsed.length,
                insertedRows: 0,
                duplicateRows: 0,
                invalidRows,
                importedById: user?.id ?? null,
            },
        });
        let insertedRows = 0;
        if (parsed.length > 0) {
            const created = await this.prisma.biRecruitsResponse.createMany({
                data: parsed.map((item) => ({
                    batchId: batch.id,
                    submittedAt: item.submittedAt,
                    education: item.education,
                    gender: item.gender,
                    identifyHarassment: item.identifyHarassment,
                    conductLimits: item.conductLimits,
                    knowOrientation: item.knowOrientation,
                    knowReportProcess: item.knowReportProcess,
                    willingnessOrientation: item.willingnessOrientation,
                    willingnessReport: item.willingnessReport,
                    enlistmentDecisionInfluenceText: item.enlistmentDecisionInfluenceText,
                    suggestionComment: item.suggestionComment,
                    rawPayload: item.rawPayload,
                    sourceRow: item.sourceRow,
                    sourceHash: item.sourceHash,
                })),
                skipDuplicates: true,
            });
            insertedRows = created.count;
        }
        const duplicateRows = parsed.length - insertedRows;
        const updatedBatch = await this.prisma.biRecruitsImportBatch.update({
            where: { id: batch.id },
            data: {
                insertedRows,
                duplicateRows,
            },
            include: {
                importedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        return {
            batch: updatedBatch,
            preview: parsed.slice(0, 5).map((item) => ({
                submittedAt: item.submittedAt,
                education: item.education,
                gender: item.gender,
                identifyHarassment: item.identifyHarassment,
                knowOrientation: item.knowOrientation,
                knowReportProcess: item.knowReportProcess,
                willingnessReport: item.willingnessReport,
            })),
            importMode: replaceAll ? 'REPLACE' : 'APPEND',
        };
    }
    async listImports(filters) {
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.biRecruitsImportBatch.findMany({
                include: {
                    importedBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: [{ importedAt: 'desc' }],
                skip,
                take,
            }),
            this.prisma.biRecruitsImportBatch.count(),
        ]);
        return {
            items,
            page,
            pageSize,
            total,
        };
    }
    async listResponses(filters) {
        const where = this.buildWhere(filters);
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.biRecruitsResponse.findMany({
                where,
                orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
                skip,
                take,
            }),
            this.prisma.biRecruitsResponse.count({ where }),
        ]);
        return {
            items,
            page,
            pageSize,
            total,
        };
    }
    async deleteResponses(payload) {
        const ids = (payload.ids ?? [])
            .map((value) => value.trim())
            .filter(Boolean);
        const uniqueIds = [...new Set(ids)];
        const allFiltered = Boolean(payload.allFiltered);
        if (!allFiltered && uniqueIds.length === 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'delete_requires_ids_or_filtered',
            });
        }
        if (allFiltered) {
            const where = this.buildWhere(payload);
            const deleted = await this.prisma.biRecruitsResponse.deleteMany({
                where,
            });
            return {
                mode: 'FILTERED',
                deletedCount: deleted.count,
            };
        }
        const deleted = await this.prisma.biRecruitsResponse.deleteMany({
            where: { id: { in: uniqueIds } },
        });
        return {
            mode: 'IDS',
            deletedCount: deleted.count,
        };
    }
    async listCardSettings() {
        const cardSettingModel = this.prisma.biRecruitsCardSetting;
        const items = await cardSettingModel.findMany({
            orderBy: { cardId: 'asc' },
            select: {
                cardId: true,
                title: true,
                description: true,
                updatedAt: true,
                updatedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        return {
            items,
        };
    }
    async updateCardSetting(cardIdRaw, payload, user) {
        const cardId = String(cardIdRaw ?? '').trim();
        if (!RECRUITS_CARD_IDS.has(cardId)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'cardId',
                reason: 'invalid_card_id',
            });
        }
        const title = String(payload.title ?? '').trim();
        if (!title) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'title',
                reason: 'required',
            });
        }
        const descriptionRaw = payload.description;
        const description = descriptionRaw === undefined || descriptionRaw === null
            ? null
            : String(descriptionRaw).trim() || null;
        const cardSettingModel = this.prisma.biRecruitsCardSetting;
        const updated = await cardSettingModel.upsert({
            where: { cardId },
            create: {
                cardId,
                title,
                description,
                updatedById: user?.id ?? null,
            },
            update: {
                title,
                description,
                updatedById: user?.id ?? null,
            },
            select: {
                cardId: true,
                title: true,
                description: true,
                updatedAt: true,
                updatedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        return updated;
    }
    async dashboard(filters) {
        const where = this.buildWhere(filters);
        const cardSettingModel = this.prisma.biRecruitsCardSetting;
        const [rows, allRowsForFilters, totalRowsInDb, latestImport, cardSettings] = await this.prisma.$transaction([
            this.prisma.biRecruitsResponse.findMany({
                where,
                select: {
                    id: true,
                    submittedAt: true,
                    education: true,
                    gender: true,
                    identifyHarassment: true,
                    conductLimits: true,
                    knowOrientation: true,
                    knowReportProcess: true,
                    willingnessOrientation: true,
                    willingnessReport: true,
                    enlistmentDecisionInfluenceText: true,
                    suggestionComment: true,
                },
            }),
            this.prisma.biRecruitsResponse.findMany({
                select: {
                    education: true,
                    gender: true,
                    identifyHarassment: true,
                    conductLimits: true,
                    knowOrientation: true,
                    knowReportProcess: true,
                    willingnessOrientation: true,
                    willingnessReport: true,
                    enlistmentDecisionInfluenceText: true,
                },
            }),
            this.prisma.biRecruitsResponse.count(),
            this.prisma.biRecruitsImportBatch.findFirst({
                orderBy: { importedAt: 'desc' },
                include: {
                    importedBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
            }),
            cardSettingModel.findMany({
                orderBy: { cardId: 'asc' },
                select: {
                    cardId: true,
                    title: true,
                    description: true,
                    updatedAt: true,
                    updatedBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
            }),
        ]);
        const total = rows.length;
        const secureGuidanceCount = rows.filter((row) => row.willingnessOrientation === 'Seguro(a)').length;
        const secureReportCount = rows.filter((row) => row.willingnessReport === 'Seguro(a)').length;
        const knowOrientationYesCount = rows.filter((row) => row.knowOrientation === 'Sim').length;
        const knowReportYesCount = rows.filter((row) => row.knowReportProcess === 'Sim').length;
        const educationDistribution = this.buildDistribution(rows, (row) => row.education ?? 'Não informado', 'education');
        const genderDistribution = this.buildDistribution(rows, (row) => row.gender ?? 'Não informado', 'gender');
        const identifyHarassmentDistribution = this.buildDistribution(rows, (row) => row.identifyHarassment ?? 'Não informado', 'identifyHarassment');
        const conductLimitsDistribution = this.buildDistribution(rows, (row) => row.conductLimits ?? 'Não informado', 'conductLimits');
        const knowOrientationDistribution = this.buildDistribution(rows, (row) => row.knowOrientation ?? 'Não informado', 'knowOrientation');
        const knowReportProcessDistribution = this.buildDistribution(rows, (row) => row.knowReportProcess ?? 'Não informado', 'knowReportProcess');
        const willingnessOrientationDistribution = this.buildDistribution(rows, (row) => row.willingnessOrientation ?? 'Não informado', 'willingnessOrientation');
        const willingnessReportDistribution = this.buildDistribution(rows, (row) => row.willingnessReport ?? 'Não informado', 'willingnessReport');
        const enlistmentDecisionInfluenceDistribution = this.buildDistribution(rows, (row) => row.enlistmentDecisionInfluenceText ?? 'Não informado', 'enlistmentDecisionInfluence');
        const responseTrend = this.buildResponseTrend(rows);
        const suggestionComment = this.buildFreeTextRows(rows, (row) => row.suggestionComment, 220);
        const topEducation = educationDistribution[0] ?? null;
        const topDecisionDriver = enlistmentDecisionInfluenceDistribution[0] ?? null;
        const reportInsecureCount = rows.filter((row) => row.willingnessReport === 'Inseguro(a)').length;
        const reportNotReadyCount = rows.filter((row) => row.knowReportProcess !== 'Sim').length;
        const weakestPoint = reportNotReadyCount >= reportInsecureCount
            ? {
                title: 'Conhecimento sobre registro formal',
                affectedCount: reportNotReadyCount,
                affectedRatePercent: total > 0
                    ? Number(((reportNotReadyCount / total) * 100).toFixed(2))
                    : 0,
            }
            : {
                title: 'Disposição para registrar ocorrência',
                affectedCount: reportInsecureCount,
                affectedRatePercent: total > 0
                    ? Number(((reportInsecureCount / total) * 100).toFixed(2))
                    : 0,
            };
        return {
            kpis: {
                totalResponses: total,
                totalRowsInDb,
                secureGuidanceCount,
                secureGuidanceRatePercent: total > 0 ? Number(((secureGuidanceCount / total) * 100).toFixed(2)) : 0,
                secureReportCount,
                secureReportRatePercent: total > 0 ? Number(((secureReportCount / total) * 100).toFixed(2)) : 0,
                knowOrientationYesCount,
                knowOrientationYesRatePercent: total > 0
                    ? Number(((knowOrientationYesCount / total) * 100).toFixed(2))
                    : 0,
                knowReportYesCount,
                knowReportYesRatePercent: total > 0
                    ? Number(((knowReportYesCount / total) * 100).toFixed(2))
                    : 0,
            },
            filters: this.buildAvailableFilters(allRowsForFilters),
            charts: {
                educationDistribution,
                genderDistribution,
                identifyHarassmentDistribution,
                conductLimitsDistribution,
                knowOrientationDistribution,
                knowReportProcessDistribution,
                willingnessOrientationDistribution,
                willingnessReportDistribution,
                enlistmentDecisionInfluenceDistribution,
                responseTrend,
            },
            textColumns: {
                suggestionComment,
            },
            insights: {
                topEducation: topEducation
                    ? {
                        label: String(topEducation.education),
                        count: Number(topEducation.count),
                        percent: Number(topEducation.percent),
                    }
                    : null,
                topDecisionDriver: topDecisionDriver
                    ? {
                        label: String(topDecisionDriver.enlistmentDecisionInfluence),
                        count: Number(topDecisionDriver.count),
                        percent: Number(topDecisionDriver.percent),
                    }
                    : null,
                weakestPoint,
            },
            cardSettings,
            latestImport,
        };
    }
    buildAvailableFilters(rows) {
        const education = new Set();
        const gender = new Set();
        const identifyHarassment = new Set();
        const conductLimits = new Set();
        const knowOrientation = new Set();
        const knowReportProcess = new Set();
        const willingnessOrientation = new Set();
        const willingnessReport = new Set();
        const enlistmentDecisionInfluence = new Set();
        for (const row of rows) {
            if (row.education?.trim())
                education.add(row.education.trim());
            if (row.gender?.trim())
                gender.add(row.gender.trim());
            if (row.identifyHarassment?.trim()) {
                identifyHarassment.add(row.identifyHarassment.trim());
            }
            if (row.conductLimits?.trim()) {
                conductLimits.add(row.conductLimits.trim());
            }
            if (row.knowOrientation?.trim()) {
                knowOrientation.add(row.knowOrientation.trim());
            }
            if (row.knowReportProcess?.trim()) {
                knowReportProcess.add(row.knowReportProcess.trim());
            }
            if (row.willingnessOrientation?.trim()) {
                willingnessOrientation.add(row.willingnessOrientation.trim());
            }
            if (row.willingnessReport?.trim()) {
                willingnessReport.add(row.willingnessReport.trim());
            }
            if (row.enlistmentDecisionInfluenceText?.trim()) {
                enlistmentDecisionInfluence.add(row.enlistmentDecisionInfluenceText.trim());
            }
        }
        return {
            education: [...education].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            gender: [...gender].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            identifyHarassment: [...identifyHarassment].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            conductLimits: [...conductLimits].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            knowOrientation: [...knowOrientation].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            knowReportProcess: [...knowReportProcess].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            willingnessOrientation: [...willingnessOrientation].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            willingnessReport: [...willingnessReport].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            enlistmentDecisionInfluence: [...enlistmentDecisionInfluence].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        };
    }
    buildDistribution(rows, keySelector, keyName) {
        const map = new Map();
        for (const row of rows) {
            const key = keySelector(row);
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        const total = rows.length;
        return [...map.entries()]
            .map(([label, count]) => ({
            [keyName]: label,
            label,
            count,
            percent: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
        }))
            .sort((a, b) => b.count - a.count);
    }
    buildResponseTrend(rows) {
        const map = new Map();
        for (const row of rows) {
            const day = row.submittedAt
                ? `${row.submittedAt.getFullYear()}-${String(row.submittedAt.getMonth() + 1).padStart(2, '0')}-${String(row.submittedAt.getDate()).padStart(2, '0')}`
                : 'SEM_DATA';
            const current = map.get(day) ?? {
                total: 0,
                positiveCount: 0,
            };
            current.total += 1;
            if (row.willingnessReport === 'Seguro(a)') {
                current.positiveCount += 1;
            }
            map.set(day, current);
        }
        return [...map.entries()]
            .map(([day, value]) => ({
            day,
            dayLabel: day === 'SEM_DATA'
                ? 'Sem data'
                : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`,
            total: value.total,
            positiveCount: value.positiveCount,
            positiveRatePercent: value.total > 0
                ? Number(((value.positiveCount / value.total) * 100).toFixed(2))
                : 0,
        }))
            .sort((a, b) => {
            if (a.day === 'SEM_DATA')
                return 1;
            if (b.day === 'SEM_DATA')
                return -1;
            return a.day.localeCompare(b.day, 'pt-BR');
        });
    }
    buildFreeTextRows(rows, textSelector, limit = 220) {
        const full = rows
            .map((row) => ({
            id: row.id,
            submittedAt: row.submittedAt,
            education: row.education,
            gender: row.gender,
            text: textSelector(row)?.trim() ?? null,
        }))
            .filter((item) => Boolean(item.text));
        const sorted = full.sort((a, b) => {
            const av = a.submittedAt?.getTime() ?? 0;
            const bv = b.submittedAt?.getTime() ?? 0;
            return bv - av;
        });
        return {
            total: sorted.length,
            displayed: Math.min(sorted.length, limit),
            items: sorted.slice(0, limit),
        };
    }
    buildTopTextFrequency(rows, textSelector) {
        const map = new Map();
        for (const row of rows) {
            const text = textSelector(row)?.trim();
            if (!text)
                continue;
            map.set(text, (map.get(text) ?? 0) + 1);
        }
        const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
        if (!top)
            return null;
        return {
            text: top[0],
            mentions: top[1],
            percent: rows.length > 0 ? Number(((top[1] / rows.length) * 100).toFixed(2)) : 0,
        };
    }
    buildWhere(filters) {
        const mode = this.parseCombineMode(filters.combineMode);
        const conditions = [];
        const from = this.parseDate(filters.from);
        const to = this.parseDate(filters.to);
        if (from || to) {
            const dateFilter = {};
            if (from)
                dateFilter.gte = from;
            if (to) {
                const end = new Date(to);
                end.setHours(23, 59, 59, 999);
                dateFilter.lte = end;
            }
            conditions.push({ submittedAt: dateFilter });
        }
        if (filters.education?.trim()) {
            conditions.push({ education: filters.education.trim() });
        }
        if (filters.gender?.trim()) {
            conditions.push({ gender: filters.gender.trim() });
        }
        if (filters.identifyHarassment?.trim()) {
            conditions.push({ identifyHarassment: filters.identifyHarassment.trim() });
        }
        if (filters.conductLimits?.trim()) {
            conditions.push({ conductLimits: filters.conductLimits.trim() });
        }
        if (filters.knowOrientation?.trim()) {
            conditions.push({ knowOrientation: filters.knowOrientation.trim() });
        }
        if (filters.knowReportProcess?.trim()) {
            conditions.push({ knowReportProcess: filters.knowReportProcess.trim() });
        }
        if (filters.willingnessOrientation?.trim()) {
            conditions.push({
                willingnessOrientation: filters.willingnessOrientation.trim(),
            });
        }
        if (filters.willingnessReport?.trim()) {
            conditions.push({ willingnessReport: filters.willingnessReport.trim() });
        }
        if (filters.enlistmentDecisionInfluence?.trim()) {
            conditions.push({
                enlistmentDecisionInfluenceText: filters.enlistmentDecisionInfluence.trim(),
            });
        }
        if (filters.q?.trim()) {
            const query = filters.q.trim();
            conditions.push({
                OR: [
                    { education: { contains: query, mode: 'insensitive' } },
                    { gender: { contains: query, mode: 'insensitive' } },
                    { identifyHarassment: { contains: query, mode: 'insensitive' } },
                    { conductLimits: { contains: query, mode: 'insensitive' } },
                    { knowOrientation: { contains: query, mode: 'insensitive' } },
                    { knowReportProcess: { contains: query, mode: 'insensitive' } },
                    { willingnessOrientation: { contains: query, mode: 'insensitive' } },
                    { willingnessReport: { contains: query, mode: 'insensitive' } },
                    {
                        enlistmentDecisionInfluenceText: {
                            contains: query,
                            mode: 'insensitive',
                        },
                    },
                    { suggestionComment: { contains: query, mode: 'insensitive' } },
                ],
            });
        }
        if (conditions.length === 0)
            return {};
        if (conditions.length === 1)
            return conditions[0];
        if (mode === 'OR')
            return { OR: conditions };
        return { AND: conditions };
    }
    parseCombineMode(value) {
        const normalized = this.compact(value ?? 'AND');
        return normalized === 'OR' ? 'OR' : 'AND';
    }
    parseDate(value) {
        if (!value)
            return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return null;
        return date;
    }
    extractRows(buffer, format) {
        const workbook = this.readWorkbook(buffer, format);
        const sheetNames = workbook.SheetNames ?? [];
        if (sheetNames.length === 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'empty_workbook' });
        }
        const selectedName = this.findPreferredSheetName(sheetNames, [
            'Respostas ao formulário',
            'BANCO_DADOS',
            'Sheet1',
        ]);
        const sheet = workbook.Sheets[selectedName];
        if (!sheet) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'missing_sheet' });
        }
        const rows = this.sheetToMatrix(sheet);
        return {
            sheetName: format === client_1.BiImportFormat.CSV ? 'CSV' : selectedName,
            rows,
        };
    }
    readWorkbook(buffer, format) {
        try {
            if (format === client_1.BiImportFormat.CSV) {
                const utf8 = buffer.toString('utf8');
                return XLSX.read(utf8, {
                    type: 'string',
                    cellDates: false,
                    raw: false,
                    codepage: 65001,
                });
            }
            return XLSX.read(buffer, {
                type: 'buffer',
                cellDates: false,
                raw: false,
            });
        }
        catch {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'invalid_spreadsheet' });
        }
    }
    findPreferredSheetName(sheetNames, preferredNames) {
        const normalizedPreferred = preferredNames.map((name) => this.normalizeForMatch(name));
        const selected = sheetNames.find((name) => {
            const current = this.normalizeForMatch(name);
            return normalizedPreferred.some((preferred) => current.includes(preferred));
        });
        return selected ?? sheetNames[0];
    }
    sheetToMatrix(sheet) {
        const matrix = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            blankrows: false,
            raw: false,
        });
        return matrix.map((row) => row.map((cell) => this.cleanCell(cell) ?? ''));
    }
    resolveHeaderMap(headerRow) {
        const normalizedHeaders = headerRow.map((value) => this.normalizeForMatch(value));
        const findIndex = (predicates) => {
            const needles = predicates
                .map((item) => this.normalizeForMatch(item))
                .filter(Boolean);
            return normalizedHeaders.findIndex((header) => needles.some((needle) => header.includes(needle)));
        };
        const map = {
            submittedAt: findIndex(['Carimbo de data/hora', 'Timestamp']),
            education: findIndex([
                'Perfil do Entrevistado (a) - Escolaridade',
                'Escolaridade',
            ]),
            gender: findIndex(['Perfil do Entrevistado (a) - Gênero', 'Genero']),
            identifyHarassment: findIndex([
                '1.1',
                'identificar situações de ASSÉDIO',
                'identificar situacoes de assedio',
            ]),
            conductLimits: findIndex(['1.2', 'limites de conduta']),
            knowOrientation: findIndex([
                '2.1',
                'a quem recorrer',
                'ORIENTAÇÃO relacionada ao assédio',
            ]),
            knowReportProcess: findIndex([
                '2.2',
                'REGISTRAR formalmente',
                'ocorrência relacionada ao assédio',
            ]),
            willingnessOrientation: findIndex([
                '3.1',
                'procurar ORIENTAÇÃO institucional',
            ]),
            willingnessReport: findIndex(['3.2', 'REGISTRAR uma ocorrência']),
            enlistmentDecisionInfluenceText: findIndex([
                '4. Expectativa ao Ingressar na FAB',
                'o que mais influenciou sua decisão',
            ]),
            suggestionComment: findIndex([
                '5. Se desejar, registre sugestão ou comentário',
                'sugestao ou comentario',
            ]),
        };
        if (map.education < 0 ||
            map.gender < 0 ||
            map.identifyHarassment < 0 ||
            map.conductLimits < 0 ||
            map.knowOrientation < 0 ||
            map.knowReportProcess < 0 ||
            map.willingnessOrientation < 0 ||
            map.willingnessReport < 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'missing_required_columns',
                required: [
                    'Perfil do Entrevistado (a) - Escolaridade',
                    'Perfil do Entrevistado (a) - Gênero',
                    '1.1 Você consegue identificar situações de ASSÉDIO no ambiente militar?',
                    '1.2 Você compreende os limites de conduta no ambiente militar?',
                    '2.1 Você sabe a quem recorrer caso precise de orientação?',
                    '2.2 Você sabe como registrar formalmente uma ocorrência?',
                    '3.1 Disposição para procurar orientação institucional',
                    '3.2 Disposição para registrar ocorrência',
                ],
            });
        }
        return map;
    }
    parseDataRow(row, map, sourceRow) {
        const submittedAtRaw = this.getCell(row, map.submittedAt);
        const educationRaw = this.getCell(row, map.education);
        const genderRaw = this.getCell(row, map.gender);
        const identifyHarassmentRaw = this.getCell(row, map.identifyHarassment);
        const conductLimitsRaw = this.getCell(row, map.conductLimits);
        const knowOrientationRaw = this.getCell(row, map.knowOrientation);
        const knowReportProcessRaw = this.getCell(row, map.knowReportProcess);
        const willingnessOrientationRaw = this.getCell(row, map.willingnessOrientation);
        const willingnessReportRaw = this.getCell(row, map.willingnessReport);
        const enlistmentDecisionInfluenceTextRaw = this.getCell(row, map.enlistmentDecisionInfluenceText);
        const suggestionCommentRaw = this.getCell(row, map.suggestionComment);
        const hasAnyValue = [
            submittedAtRaw,
            educationRaw,
            genderRaw,
            identifyHarassmentRaw,
            conductLimitsRaw,
            knowOrientationRaw,
            knowReportProcessRaw,
            willingnessOrientationRaw,
            willingnessReportRaw,
            enlistmentDecisionInfluenceTextRaw,
            suggestionCommentRaw,
        ].some((value) => Boolean(value && value.trim()));
        if (!hasAnyValue) {
            return { skip: true };
        }
        const submittedAt = this.parseSubmittedAt(submittedAtRaw);
        const education = this.cleanCategory(educationRaw);
        const gender = this.normalizeGender(genderRaw);
        const identifyHarassment = this.normalizeYesNoPartial(identifyHarassmentRaw);
        const conductLimits = this.normalizeYesNoPartial(conductLimitsRaw);
        const knowOrientation = this.normalizeYesNoPartial(knowOrientationRaw);
        const knowReportProcess = this.normalizeYesNoPartial(knowReportProcessRaw);
        const willingnessOrientation = this.normalizeWillingness(willingnessOrientationRaw);
        const willingnessReport = this.normalizeWillingness(willingnessReportRaw);
        const enlistmentDecisionInfluenceText = this.normalizeEnlistmentDecisionInfluence(enlistmentDecisionInfluenceTextRaw);
        const suggestionComment = this.cleanFreeText(suggestionCommentRaw);
        const payload = {
            submittedAtRaw,
            educationRaw,
            genderRaw,
            identifyHarassmentRaw,
            conductLimitsRaw,
            knowOrientationRaw,
            knowReportProcessRaw,
            willingnessOrientationRaw,
            willingnessReportRaw,
            enlistmentDecisionInfluenceTextRaw,
            suggestionCommentRaw,
        };
        const sourceHash = node_crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify({
            sourceRow,
            submittedAt: submittedAt?.toISOString() ?? null,
            education,
            gender,
            identifyHarassment,
            conductLimits,
            knowOrientation,
            knowReportProcess,
            willingnessOrientation,
            willingnessReport,
            enlistmentDecisionInfluenceText,
            suggestionComment,
        }))
            .digest('hex');
        return {
            skip: false,
            value: {
                submittedAt,
                education,
                gender,
                identifyHarassment,
                conductLimits,
                knowOrientation,
                knowReportProcess,
                willingnessOrientation,
                willingnessReport,
                enlistmentDecisionInfluenceText,
                suggestionComment,
                rawPayload: payload,
                sourceRow,
                sourceHash,
            },
        };
    }
    parseSubmittedAt(raw) {
        if (!raw)
            return null;
        const normalized = raw.replace(',', '.').trim();
        const numeric = Number(normalized);
        if (Number.isFinite(numeric) && numeric > 25000 && numeric < 70000) {
            const excelEpochUtc = Date.UTC(1899, 11, 30);
            return new Date(excelEpochUtc + numeric * 24 * 60 * 60 * 1000);
        }
        const match = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (match) {
            const p1 = Number(match[1]);
            const p2 = Number(match[2]);
            const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
            const hour = Number(match[4] ?? 0);
            const minute = Number(match[5] ?? 0);
            const second = Number(match[6] ?? 0);
            let day = p1;
            let month = p2;
            if (raw.includes('-') && !raw.includes('/')) {
                month = p1;
                day = p2;
            }
            else if (p1 > 12 && p2 <= 12) {
                day = p1;
                month = p2;
            }
            else if (p2 > 12 && p1 <= 12) {
                month = p1;
                day = p2;
            }
            const parsed = new Date(year, month - 1, day, hour, minute, second);
            if (!Number.isNaN(parsed.getTime()))
                return parsed;
        }
        const direct = new Date(raw);
        if (!Number.isNaN(direct.getTime()))
            return direct;
        return null;
    }
    normalizeGender(raw) {
        const value = this.cleanCategory(raw);
        if (!value)
            return null;
        const compact = this.compact(value);
        if (compact.startsWith('MASC'))
            return 'Masculino';
        if (compact.startsWith('FEM'))
            return 'Feminino';
        return this.toTitleCaseWithAccents(value);
    }
    normalizeYesNoPartial(raw) {
        return this.normalizeChoice(raw, YES_NO_PARTIAL_OPTIONS, [
            { match: 'SIM', label: 'Sim' },
            { match: 'PARCIAL', label: 'Parcialmente' },
            { match: 'NAO', label: 'Não' },
        ]);
    }
    normalizeWillingness(raw) {
        return this.normalizeChoice(raw, WILLINGNESS_OPTIONS, [
            {
                match: 'NEMSEGUROANEMINSEGUROA',
                label: 'Nem seguro(a) nem inseguro(a)',
            },
            { match: 'INSEGURO', label: 'Inseguro(a)' },
            { match: 'SEGURO', label: 'Seguro(a)' },
        ]);
    }
    normalizeEnlistmentDecisionInfluence(raw) {
        const value = this.cleanCategory(raw);
        if (!value)
            return null;
        const compact = this.compact(value);
        if (compact.includes('INTERESSE') && compact.includes('CARREIRAMILITAR')) {
            return ENLISTMENT_DECISION_OPTIONS[0];
        }
        if (compact.includes('DESENVOLVIMENTOPERSONAL')) {
            return ENLISTMENT_DECISION_OPTIONS[1];
        }
        if (compact.includes('DISCIPLINA') || compact.includes('ORGANIZACAO')) {
            return ENLISTMENT_DECISION_OPTIONS[2];
        }
        if (compact.includes('EXPERIENCIAPROFISSIONAL') ||
            compact.includes('EXPERIENCIA') ||
            compact.includes('PROFISSIONAL')) {
            return ENLISTMENT_DECISION_OPTIONS[3];
        }
        if (compact.includes('SERVICOOBRIGATORIO') ||
            compact.includes('CUMPRIMENTO') ||
            compact.includes('OBRIGATORIO')) {
            return ENLISTMENT_DECISION_OPTIONS[4];
        }
        if (compact.includes('ESTABILIDADEFINANCEIRA')) {
            return ENLISTMENT_DECISION_OPTIONS[5];
        }
        return this.toTitleCaseWithAccents(value);
    }
    normalizeChoice(raw, options, aliases) {
        const value = this.cleanCategory(raw);
        if (!value)
            return null;
        const normalizedValue = this.normalizeForMatch(value);
        for (const option of options) {
            const normalizedOption = this.normalizeForMatch(option);
            if (normalizedValue === normalizedOption)
                return option;
        }
        for (const alias of aliases) {
            const normalizedMatch = this.normalizeForMatch(alias.match);
            if (!normalizedMatch)
                continue;
            if (normalizedValue.includes(normalizedMatch))
                return alias.label;
        }
        return this.toTitleCaseWithAccents(value);
    }
    cleanCategory(raw) {
        if (!raw)
            return null;
        const value = String(raw).replace(/\s+/g, ' ').trim();
        if (!value)
            return null;
        if (this.isNotApplicable(value))
            return null;
        return value;
    }
    cleanFreeText(raw) {
        if (!raw)
            return null;
        const value = String(raw).replace(/\s+/g, ' ').trim();
        if (!value)
            return null;
        if (this.isNotApplicable(value))
            return null;
        if (/^[.\-_,;:!?]+$/.test(value))
            return null;
        return value;
    }
    fileExtension(fileName) {
        const ext = (fileName.split('.').pop() ?? '').toLowerCase();
        if (!['csv', 'xls', 'xlsx'].includes(ext)) {
            (0, http_error_1.throwError)('BI_FILE_TYPE_INVALID');
        }
        return ext;
    }
    normalizeForMatch(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ')
            .toUpperCase();
    }
    compact(value) {
        return this.normalizeForMatch(value).replace(/\s+/g, '');
    }
    isNotApplicable(value) {
        const compact = this.compact(value);
        if (!compact)
            return true;
        if (compact === 'NA')
            return true;
        if (compact === 'NASEAPLICA')
            return true;
        if (compact.includes('NAOSEAPLICA'))
            return true;
        return false;
    }
    toTitleCaseWithAccents(value) {
        return value
            .toLowerCase()
            .split(' ')
            .filter(Boolean)
            .map((chunk) => `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`)
            .join(' ')
            .trim();
    }
    cleanCell(value) {
        if (value === null || value === undefined)
            return null;
        if (value instanceof Date)
            return value.toISOString();
        if (typeof value === 'boolean')
            return value ? 'SIM' : 'NAO';
        return String(value).trim() || null;
    }
    getCell(row, index) {
        if (index < 0 || index >= row.length)
            return null;
        const value = row[index] ?? '';
        return String(value).trim() || null;
    }
};
exports.BiRecruitsService = BiRecruitsService;
exports.BiRecruitsService = BiRecruitsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BiRecruitsService);
//# sourceMappingURL=bi-recruits.service.js.map