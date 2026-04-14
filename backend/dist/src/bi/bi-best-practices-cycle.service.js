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
exports.BiBestPracticesCycleService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const pagination_1 = require("../common/pagination");
const http_error_1 = require("../common/http-error");
const prisma_service_1 = require("../prisma/prisma.service");
const LIKERT_OPTIONS = [
    'Concordo totalmente',
    'Concordo parcialmente',
    'Nem concordo nem discordo',
    'Discordo parcialmente',
    'Discordo totalmente',
];
const YES_NO_OPTIONS = ['Sim', 'Não'];
const FREQUENCY_OPTIONS = [
    'Sempre',
    'Frequentemente',
    'Às vezes',
    'Raramente',
    'Nunca',
];
const DEFAULT_MAIN_CHALLENGE_OPTIONS = [
    'Ajustar condutas e linguagem sem comprometer o rigor técnico-militar',
    'Lidar com possíveis interpretações equivocadas de falas ou cobranças',
    'Manter critérios claros e uniformes de avaliação',
    'Gerenciar a interação entre recrutas masculinos e femininos',
    'Identificar situações que demandam apoio especializado (Assistente Social/Psicólogo)',
    'Não percebo desafios específicos',
];
const BEST_PRACTICE_CARD_IDS = new Set([
    'page-header',
    'kpi-total',
    'kpi-prepared',
    'kpi-interaction',
    'kpi-support',
    'insight-main',
    'chart-q1',
    'chart-q2',
    'chart-q3',
    'chart-q4',
    'chart-q6',
    'chart-q7',
    'chart-trend-q2',
    'list-q5',
    'list-specialty',
]);
let BiBestPracticesCycleService = class BiBestPracticesCycleService {
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
        const responseModel = this.prisma.biBestPracticeCycleResponse;
        const importModel = this.prisma.biBestPracticeCycleImportBatch;
        if (replaceAll) {
            await this.prisma.$transaction([
                responseModel.deleteMany(),
                importModel.deleteMany(),
            ]);
        }
        const batch = await importModel.create({
            data: {
                id: this.makeId('bibpcib_'),
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
            const created = await responseModel.createMany({
                data: parsed.map((item) => ({
                    id: this.makeId('bibpcr_'),
                    batchId: batch.id,
                    submittedAt: item.submittedAt,
                    technicalRigorPerception: item.technicalRigorPerception,
                    preparednessToLeadMixedClass: item.preparednessToLeadMixedClass,
                    genderBiasImpact: item.genderBiasImpact,
                    interactionDifference: item.interactionDifference,
                    interactionDifferenceComment: item.interactionDifferenceComment,
                    supportNeedRecognition: item.supportNeedRecognition,
                    mainChallengeOptions: item.mainChallengeOptions,
                    identification: item.identification,
                    specialty: item.specialty,
                    rawPayload: item.rawPayload,
                    sourceRow: item.sourceRow,
                    sourceHash: item.sourceHash,
                })),
                skipDuplicates: true,
            });
            insertedRows = Number(created?.count ?? 0);
        }
        const duplicateRows = parsed.length - insertedRows;
        const updatedBatch = await importModel.update({
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
                technicalRigorPerception: item.technicalRigorPerception,
                preparednessToLeadMixedClass: item.preparednessToLeadMixedClass,
                interactionDifference: item.interactionDifference,
                supportNeedRecognition: item.supportNeedRecognition,
                mainChallengeOptions: item.mainChallengeOptions,
                specialty: item.specialty,
            })),
            importMode: replaceAll ? 'REPLACE' : 'APPEND',
        };
    }
    async listImports(filters) {
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const importModel = this.prisma.biBestPracticeCycleImportBatch;
        const [items, total] = await this.prisma.$transaction([
            importModel.findMany({
                include: {
                    importedBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: [{ importedAt: 'desc' }],
                skip,
                take,
            }),
            importModel.count(),
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
        const responseModel = this.prisma.biBestPracticeCycleResponse;
        const [items, total] = await this.prisma.$transaction([
            responseModel.findMany({
                where,
                orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
                skip,
                take,
            }),
            responseModel.count({ where }),
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
        const responseModel = this.prisma.biBestPracticeCycleResponse;
        if (allFiltered) {
            const where = this.buildWhere(payload);
            const deleted = await responseModel.deleteMany({ where });
            return {
                mode: 'FILTERED',
                deletedCount: Number(deleted?.count ?? 0),
            };
        }
        const deleted = await responseModel.deleteMany({
            where: { id: { in: uniqueIds } },
        });
        return {
            mode: 'IDS',
            deletedCount: Number(deleted?.count ?? 0),
        };
    }
    async listCardSettings() {
        const cardSettingModel = this.prisma.biBestPracticeCycleCardSetting;
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
        if (!BEST_PRACTICE_CARD_IDS.has(cardId)) {
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
        const cardSettingModel = this.prisma.biBestPracticeCycleCardSetting;
        const updated = await cardSettingModel.upsert({
            where: { cardId },
            create: {
                id: this.makeId('bibpcs_'),
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
        const responseModel = this.prisma.biBestPracticeCycleResponse;
        const importModel = this.prisma.biBestPracticeCycleImportBatch;
        const cardSettingModel = this.prisma.biBestPracticeCycleCardSetting;
        const [rows, allRowsForFilters, totalRowsInDb, latestImport, cardSettings] = await this.prisma.$transaction([
            responseModel.findMany({
                where,
                select: {
                    id: true,
                    submittedAt: true,
                    technicalRigorPerception: true,
                    preparednessToLeadMixedClass: true,
                    genderBiasImpact: true,
                    interactionDifference: true,
                    interactionDifferenceComment: true,
                    supportNeedRecognition: true,
                    mainChallengeOptions: true,
                    identification: true,
                    specialty: true,
                },
            }),
            responseModel.findMany({
                select: {
                    technicalRigorPerception: true,
                    preparednessToLeadMixedClass: true,
                    genderBiasImpact: true,
                    interactionDifference: true,
                    supportNeedRecognition: true,
                    mainChallengeOptions: true,
                    identification: true,
                    specialty: true,
                },
            }),
            responseModel.count(),
            importModel.findFirst({
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
        const preparedPositiveCount = rows.filter((row) => this.isLikertPositive(row.preparednessToLeadMixedClass)).length;
        const interactionYesCount = rows.filter((row) => row.interactionDifference === 'Sim').length;
        const supportFrequentCount = rows.filter((row) => this.isSupportFrequent(row.supportNeedRecognition)).length;
        const technicalRigorDistribution = this.buildDistribution(rows, (row) => row.technicalRigorPerception ?? 'Não informado', 'technicalRigorPerception');
        const preparednessDistribution = this.buildDistribution(rows, (row) => row.preparednessToLeadMixedClass ?? 'Não informado', 'preparednessToLeadMixedClass');
        const genderBiasDistribution = this.buildDistribution(rows, (row) => row.genderBiasImpact ?? 'Não informado', 'genderBiasImpact');
        const interactionDifferenceDistribution = this.buildDistribution(rows, (row) => row.interactionDifference ?? 'Não informado', 'interactionDifference');
        const supportNeedDistribution = this.buildDistribution(rows, (row) => row.supportNeedRecognition ?? 'Não informado', 'supportNeedRecognition');
        const mainChallengeDistribution = this.buildMultiOptionDistribution(rows, (row) => row.mainChallengeOptions ?? [], 'mainChallenge');
        const preparednessTrendByDay = this.buildPreparednessTrendByDay(rows);
        const interactionDifferenceComment = this.buildFreeTextRows(rows, (row) => row.interactionDifferenceComment, 180);
        const specialtyFreeText = this.buildSpecialtyList(rows, 120);
        const topChallenge = mainChallengeDistribution[0] ?? null;
        const lowPreparednessCount = rows.filter((row) => row.preparednessToLeadMixedClass === 'Nem concordo nem discordo' ||
            row.preparednessToLeadMixedClass === 'Discordo parcialmente' ||
            row.preparednessToLeadMixedClass === 'Discordo totalmente').length;
        const mostFrequentSpecialty = specialtyFreeText.items[0] ?? null;
        return {
            kpis: {
                totalResponses: total,
                totalRowsInDb,
                preparedPositiveCount,
                preparedPositiveRatePercent: total > 0 ? Number(((preparedPositiveCount / total) * 100).toFixed(2)) : 0,
                interactionYesCount,
                interactionYesRatePercent: total > 0 ? Number(((interactionYesCount / total) * 100).toFixed(2)) : 0,
                supportFrequentCount,
                supportFrequentRatePercent: total > 0 ? Number(((supportFrequentCount / total) * 100).toFixed(2)) : 0,
                lowPreparednessCount,
                lowPreparednessRatePercent: total > 0 ? Number(((lowPreparednessCount / total) * 100).toFixed(2)) : 0,
            },
            filters: this.buildAvailableFilters(allRowsForFilters),
            charts: {
                technicalRigorDistribution,
                preparednessDistribution,
                genderBiasDistribution,
                interactionDifferenceDistribution,
                supportNeedDistribution,
                mainChallengeDistribution,
                preparednessTrendByDay,
            },
            textColumns: {
                interactionDifferenceComment,
                specialtyFreeText,
            },
            insights: {
                topChallenge: topChallenge
                    ? {
                        label: String(topChallenge.label),
                        count: Number(topChallenge.count),
                        percent: Number(topChallenge.percent),
                    }
                    : null,
                mostFrequentSpecialty: mostFrequentSpecialty
                    ? {
                        text: String(mostFrequentSpecialty.text),
                        count: Number(mostFrequentSpecialty.count),
                        percent: Number(mostFrequentSpecialty.percent),
                    }
                    : null,
                preparednessAttentionPoint: {
                    title: 'Grupo que ainda demanda reforço de preparo',
                    affectedCount: lowPreparednessCount,
                    affectedRatePercent: total > 0 ? Number(((lowPreparednessCount / total) * 100).toFixed(2)) : 0,
                },
            },
            latestImport,
            cardSettings,
        };
    }
    buildAvailableFilters(rows) {
        const technicalRigorPerception = new Set();
        const preparednessToLeadMixedClass = new Set();
        const genderBiasImpact = new Set();
        const interactionDifference = new Set();
        const supportNeedRecognition = new Set();
        const mainChallengeOptions = new Set();
        const identification = new Set();
        const specialty = new Set();
        for (const row of rows) {
            if (row.technicalRigorPerception?.trim()) {
                technicalRigorPerception.add(row.technicalRigorPerception.trim());
            }
            if (row.preparednessToLeadMixedClass?.trim()) {
                preparednessToLeadMixedClass.add(row.preparednessToLeadMixedClass.trim());
            }
            if (row.genderBiasImpact?.trim()) {
                genderBiasImpact.add(row.genderBiasImpact.trim());
            }
            if (row.interactionDifference?.trim()) {
                interactionDifference.add(row.interactionDifference.trim());
            }
            if (row.supportNeedRecognition?.trim()) {
                supportNeedRecognition.add(row.supportNeedRecognition.trim());
            }
            for (const option of row.mainChallengeOptions ?? []) {
                if (String(option ?? '').trim()) {
                    mainChallengeOptions.add(String(option).trim());
                }
            }
            if (row.identification?.trim()) {
                identification.add(row.identification.trim());
            }
            if (row.specialty?.trim()) {
                specialty.add(row.specialty.trim());
            }
        }
        return {
            technicalRigorPerception: this.sortLikert([...technicalRigorPerception]),
            preparednessToLeadMixedClass: this.sortLikert([
                ...preparednessToLeadMixedClass,
            ]),
            genderBiasImpact: this.sortLikert([...genderBiasImpact]),
            interactionDifference: this.sortYesNo([...interactionDifference]),
            supportNeedRecognition: this.sortFrequency([...supportNeedRecognition]),
            mainChallengeOptions: [...mainChallengeOptions].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            identification: [...identification].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            specialty: [...specialty].sort((a, b) => a.localeCompare(b, 'pt-BR')),
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
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
    }
    buildMultiOptionDistribution(rows, valuesSelector, keyName) {
        const map = new Map();
        let totalMentions = 0;
        for (const row of rows) {
            for (const option of valuesSelector(row)) {
                const normalized = String(option ?? '').trim();
                if (!normalized)
                    continue;
                map.set(normalized, (map.get(normalized) ?? 0) + 1);
                totalMentions += 1;
            }
        }
        return [...map.entries()]
            .map(([label, count]) => ({
            [keyName]: label,
            label,
            count,
            percent: totalMentions > 0
                ? Number(((count / totalMentions) * 100).toFixed(2))
                : 0,
        }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
    }
    buildPreparednessTrendByDay(rows) {
        const map = new Map();
        for (const row of rows) {
            const day = row.submittedAt
                ? `${row.submittedAt.getFullYear()}-${String(row.submittedAt.getMonth() + 1).padStart(2, '0')}-${String(row.submittedAt.getDate()).padStart(2, '0')}`
                : 'SEM_DATA';
            const current = map.get(day) ?? {
                total: 0,
                counters: new Map(),
            };
            current.total += 1;
            const option = row.preparednessToLeadMixedClass ?? 'Não informado';
            current.counters.set(option, (current.counters.get(option) ?? 0) + 1);
            map.set(day, current);
        }
        const discovered = new Set();
        for (const current of map.values()) {
            for (const option of current.counters.keys()) {
                discovered.add(option);
            }
        }
        const options = this.sortLikert([...discovered]);
        const items = [...map.entries()]
            .map(([day, value]) => {
            const item = {
                day,
                dayLabel: day === 'SEM_DATA'
                    ? 'Sem data'
                    : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`,
                total: value.total,
            };
            for (const option of options) {
                const count = value.counters.get(option) ?? 0;
                item[`${option}__count`] = count;
                item[`${option}__percent`] =
                    value.total > 0 ? Number(((count / value.total) * 100).toFixed(2)) : 0;
            }
            return item;
        })
            .sort((a, b) => {
            const aDay = String(a.day);
            const bDay = String(b.day);
            if (aDay === 'SEM_DATA')
                return 1;
            if (bDay === 'SEM_DATA')
                return -1;
            return aDay.localeCompare(bDay, 'pt-BR');
        });
        return {
            options,
            items,
        };
    }
    buildFreeTextRows(rows, textSelector, limit = 200) {
        const full = rows
            .map((row) => ({
            id: row.id,
            submittedAt: row.submittedAt,
            identification: row.identification,
            specialty: row.specialty,
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
    buildSpecialtyList(rows, limit = 120) {
        const map = new Map();
        let totalResponses = 0;
        for (const row of rows) {
            const value = String(row.specialty ?? '').trim();
            if (!value)
                continue;
            totalResponses += 1;
            map.set(value, (map.get(value) ?? 0) + 1);
        }
        const items = [...map.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
            .slice(0, limit)
            .map(([text, count]) => ({
            text,
            count,
            percent: totalResponses > 0 ? Number(((count / totalResponses) * 100).toFixed(2)) : 0,
        }));
        return {
            totalUnique: map.size,
            totalResponses,
            displayed: items.length,
            items,
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
        if (filters.technicalRigorPerception?.trim()) {
            conditions.push({
                technicalRigorPerception: filters.technicalRigorPerception.trim(),
            });
        }
        if (filters.preparednessToLeadMixedClass?.trim()) {
            conditions.push({
                preparednessToLeadMixedClass: filters.preparednessToLeadMixedClass.trim(),
            });
        }
        if (filters.genderBiasImpact?.trim()) {
            conditions.push({ genderBiasImpact: filters.genderBiasImpact.trim() });
        }
        if (filters.interactionDifference?.trim()) {
            conditions.push({ interactionDifference: filters.interactionDifference.trim() });
        }
        if (filters.supportNeedRecognition?.trim()) {
            conditions.push({ supportNeedRecognition: filters.supportNeedRecognition.trim() });
        }
        if (filters.mainChallengeOption?.trim()) {
            conditions.push({
                mainChallengeOptions: { has: filters.mainChallengeOption.trim() },
            });
        }
        if (filters.identification?.trim()) {
            conditions.push({ identification: filters.identification.trim() });
        }
        if (filters.specialty?.trim()) {
            conditions.push({ specialty: filters.specialty.trim() });
        }
        if (filters.q?.trim()) {
            const query = filters.q.trim();
            conditions.push({
                OR: [
                    { identification: { contains: query, mode: 'insensitive' } },
                    { specialty: { contains: query, mode: 'insensitive' } },
                    {
                        interactionDifferenceComment: {
                            contains: query,
                            mode: 'insensitive',
                        },
                    },
                    {
                        technicalRigorPerception: {
                            contains: query,
                            mode: 'insensitive',
                        },
                    },
                    {
                        preparednessToLeadMixedClass: {
                            contains: query,
                            mode: 'insensitive',
                        },
                    },
                    { genderBiasImpact: { contains: query, mode: 'insensitive' } },
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
            'Sheet1',
            'Respostas',
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
            technicalRigorPerception: findIndex([
                '1. E possível manter o rigor técnico-militar',
                '1. É possível manter o rigor técnico-militar',
            ]),
            preparednessToLeadMixedClass: findIndex([
                '2. Sinto-me preparado',
                '2. Sinto me preparado',
            ]),
            genderBiasImpact: findIndex([
                '3. Vieses de gênero',
                '3. Vieses de genero',
            ]),
            interactionDifference: findIndex([
                '4. Na sua avaliação, há diferença',
                '4. Na sua avaliacao, ha diferenca',
            ]),
            interactionDifferenceComment: findIndex([
                '5. Caso tenha assinalado "sim"',
                '5. Caso tenha assinalado',
            ]),
            supportNeedRecognition: findIndex([
                '6. Consigo identificar situações',
                '6. Consigo identificar situacoes',
            ]),
            mainChallengeOptions: findIndex([
                '7. Na sua avaliação, qual é o principal desafio',
                '7. Na sua avaliacao, qual e o principal desafio',
            ]),
            identification: findIndex(['Identificação', 'Identificacao']),
            specialty: findIndex(['Qual sua especialidade']),
        };
        if (map.technicalRigorPerception < 0 ||
            map.preparednessToLeadMixedClass < 0 ||
            map.genderBiasImpact < 0 ||
            map.interactionDifference < 0 ||
            map.supportNeedRecognition < 0 ||
            map.mainChallengeOptions < 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'missing_required_columns',
                required: [
                    '1. É possível manter o rigor técnico-militar...',
                    '2. Sinto-me preparado para conduzir a formação...',
                    '3. Vieses de gênero podem influenciar decisões...',
                    '4. Há diferença na forma como os recrutas interagem...',
                    '6. Consigo identificar situações que demandam apoio...',
                    '7. Principal desafio na condução da primeira turma feminina...',
                ],
            });
        }
        return map;
    }
    parseDataRow(row, map, sourceRow) {
        const submittedAtRaw = this.getCell(row, map.submittedAt);
        const technicalRigorPerceptionRaw = this.getCell(row, map.technicalRigorPerception);
        const preparednessToLeadMixedClassRaw = this.getCell(row, map.preparednessToLeadMixedClass);
        const genderBiasImpactRaw = this.getCell(row, map.genderBiasImpact);
        const interactionDifferenceRaw = this.getCell(row, map.interactionDifference);
        const interactionDifferenceCommentRaw = this.getCell(row, map.interactionDifferenceComment);
        const supportNeedRecognitionRaw = this.getCell(row, map.supportNeedRecognition);
        const mainChallengeOptionsRaw = this.getCell(row, map.mainChallengeOptions);
        const identificationRaw = this.getCell(row, map.identification);
        const specialtyRaw = this.getCell(row, map.specialty);
        const hasAnyValue = [
            submittedAtRaw,
            technicalRigorPerceptionRaw,
            preparednessToLeadMixedClassRaw,
            genderBiasImpactRaw,
            interactionDifferenceRaw,
            interactionDifferenceCommentRaw,
            supportNeedRecognitionRaw,
            mainChallengeOptionsRaw,
            identificationRaw,
            specialtyRaw,
        ].some((value) => Boolean(value && value.trim()));
        if (!hasAnyValue) {
            return { skip: true };
        }
        const submittedAt = this.parseSubmittedAt(submittedAtRaw);
        const technicalRigorPerception = this.normalizeLikert(technicalRigorPerceptionRaw);
        const preparednessToLeadMixedClass = this.normalizeLikert(preparednessToLeadMixedClassRaw);
        const genderBiasImpact = this.normalizeLikert(genderBiasImpactRaw);
        const interactionDifference = this.normalizeYesNo(interactionDifferenceRaw);
        const interactionDifferenceComment = this.cleanFreeText(interactionDifferenceCommentRaw);
        const supportNeedRecognition = this.normalizeFrequency(supportNeedRecognitionRaw);
        const mainChallengeOptions = this.normalizeMainChallengeOptions(mainChallengeOptionsRaw);
        const identification = this.cleanCategory(identificationRaw);
        const specialty = this.cleanCategory(specialtyRaw);
        const rawPayload = {
            submittedAtRaw,
            technicalRigorPerceptionRaw,
            preparednessToLeadMixedClassRaw,
            genderBiasImpactRaw,
            interactionDifferenceRaw,
            interactionDifferenceCommentRaw,
            supportNeedRecognitionRaw,
            mainChallengeOptionsRaw,
            identificationRaw,
            specialtyRaw,
        };
        const sourceHash = node_crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify({
            sourceRow,
            submittedAt: submittedAt?.toISOString() ?? null,
            technicalRigorPerception,
            preparednessToLeadMixedClass,
            genderBiasImpact,
            interactionDifference,
            interactionDifferenceComment,
            supportNeedRecognition,
            mainChallengeOptions,
            identification,
            specialty,
        }))
            .digest('hex');
        return {
            skip: false,
            value: {
                submittedAt,
                technicalRigorPerception,
                preparednessToLeadMixedClass,
                genderBiasImpact,
                interactionDifference,
                interactionDifferenceComment,
                supportNeedRecognition,
                mainChallengeOptions,
                identification,
                specialty,
                rawPayload,
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
    normalizeLikert(raw) {
        return this.normalizeChoice(raw, LIKERT_OPTIONS, [
            { match: 'CONCORDOTOTALMENTE', label: 'Concordo totalmente' },
            { match: 'CONCORDOPARCIALMENTE', label: 'Concordo parcialmente' },
            {
                match: 'NEMCONCORDONEMDISCORDO',
                label: 'Nem concordo nem discordo',
            },
            { match: 'DISCORDOPARCIALMENTE', label: 'Discordo parcialmente' },
            { match: 'DISCORDOTOTALMENTE', label: 'Discordo totalmente' },
        ]);
    }
    normalizeYesNo(raw) {
        return this.normalizeChoice(raw, YES_NO_OPTIONS, [
            { match: 'SIM', label: 'Sim' },
            { match: 'NAO', label: 'Não' },
            { match: 'NÃO', label: 'Não' },
        ]);
    }
    normalizeFrequency(raw) {
        return this.normalizeChoice(raw, FREQUENCY_OPTIONS, [
            { match: 'SEMPRE', label: 'Sempre' },
            { match: 'FREQUENTEMENTE', label: 'Frequentemente' },
            { match: 'ASVEZES', label: 'Às vezes' },
            { match: 'ASVEZ', label: 'Às vezes' },
            { match: 'RARAMENTE', label: 'Raramente' },
            { match: 'NUNCA', label: 'Nunca' },
        ]);
    }
    normalizeMainChallengeOptions(raw) {
        const value = this.cleanCategory(raw);
        if (!value)
            return [];
        const chunks = value
            .split(',')
            .map((item) => this.cleanCategory(item))
            .filter(Boolean);
        const normalized = chunks.map((chunk) => {
            const compact = this.compact(chunk);
            const matched = DEFAULT_MAIN_CHALLENGE_OPTIONS.find((option) => compact.includes(this.compact(option)));
            return matched ?? this.toTitleCaseWithAccents(chunk);
        });
        return [...new Set(normalized)];
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
    sortLikert(options) {
        const order = new Map(LIKERT_OPTIONS.map((item, index) => [item, index]));
        return [...options].sort((a, b) => {
            const ai = order.get(a);
            const bi = order.get(b);
            if (ai !== undefined && bi !== undefined)
                return ai - bi;
            if (ai !== undefined)
                return -1;
            if (bi !== undefined)
                return 1;
            return a.localeCompare(b, 'pt-BR');
        });
    }
    sortYesNo(options) {
        const order = new Map(YES_NO_OPTIONS.map((item, index) => [item, index]));
        return [...options].sort((a, b) => {
            const ai = order.get(a);
            const bi = order.get(b);
            if (ai !== undefined && bi !== undefined)
                return ai - bi;
            if (ai !== undefined)
                return -1;
            if (bi !== undefined)
                return 1;
            return a.localeCompare(b, 'pt-BR');
        });
    }
    sortFrequency(options) {
        const order = new Map(FREQUENCY_OPTIONS.map((item, index) => [item, index]));
        return [...options].sort((a, b) => {
            const ai = order.get(a);
            const bi = order.get(b);
            if (ai !== undefined && bi !== undefined)
                return ai - bi;
            if (ai !== undefined)
                return -1;
            if (bi !== undefined)
                return 1;
            return a.localeCompare(b, 'pt-BR');
        });
    }
    isLikertPositive(value) {
        return value === 'Concordo totalmente' || value === 'Concordo parcialmente';
    }
    isSupportFrequent(value) {
        return value === 'Sempre' || value === 'Frequentemente';
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
    makeId(prefix) {
        return `${prefix}${node_crypto_1.default.randomUUID()}`;
    }
};
exports.BiBestPracticesCycleService = BiBestPracticesCycleService;
exports.BiBestPracticesCycleService = BiBestPracticesCycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BiBestPracticesCycleService);
//# sourceMappingURL=bi-best-practices-cycle.service.js.map