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
exports.BiCpcaMeetingService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const pagination_1 = require("../common/pagination");
const http_error_1 = require("../common/http-error");
const prisma_service_1 = require("../prisma/prisma.service");
const HEADER_TEXT_HINTS = [
    'comentario',
    'comentário',
    'observacao',
    'observação',
    'sugestao',
    'sugestão',
    'justificativa',
    'detalhe',
    'texto',
    'relato',
    'descreva',
    'explique',
    'percepcao',
    'percepção',
    'outro',
    'outra',
];
const HEADER_MULTI_HINTS = [
    'opcao',
    'opção',
    'opcoes',
    'opções',
    'marque',
    'selecione',
    'quais',
    'quais sao',
    'quais são',
    'assinale',
];
let BiCpcaMeetingService = class BiCpcaMeetingService {
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
        const headers = this.normalizeHeaderRow(headerRow);
        if (!headers.length) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'missing_header_row' });
        }
        const headerDefs = this.buildHeaderDefinitions(headers);
        const submittedAtKey = this.detectSubmittedAtKey(headerDefs);
        const parsed = [];
        let invalidRows = 0;
        for (let index = 0; index < dataRows.length; index += 1) {
            const sourceRow = index + 2;
            const row = this.parseDataRow(dataRows[index], headerDefs, submittedAtKey, sourceRow);
            if (row.skip)
                continue;
            if (!row.value) {
                invalidRows += 1;
                continue;
            }
            parsed.push(row.value);
        }
        const responseModel = this.prisma.biCpcaMeetingResponse;
        const importModel = this.prisma.biCpcaMeetingImportBatch;
        if (replaceAll) {
            await this.prisma.$transaction([
                responseModel.deleteMany(),
                importModel.deleteMany(),
            ]);
        }
        const columnsJson = {
            order: headerDefs.map((item) => item.key),
            labels: headerDefs.reduce((acc, item) => {
                acc[item.key] = item.label;
                return acc;
            }, {}),
            submittedAtKey,
        };
        const batch = await importModel.create({
            data: {
                id: this.makeId('bicmib_'),
                fileName: file.originalname,
                format,
                sheetName,
                columnsJson,
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
                data: parsed.map((row) => ({
                    id: this.makeId('bicmr_'),
                    batchId: batch.id,
                    submittedAt: row.submittedAt,
                    answersJson: row.answers,
                    rawPayload: row.rawPayload,
                    sourceRow: row.sourceRow,
                    sourceHash: row.sourceHash,
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
                answers: item.answers,
            })),
            importMode: replaceAll ? 'REPLACE' : 'APPEND',
        };
    }
    async listImports(filters) {
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const importModel = this.prisma.biCpcaMeetingImportBatch;
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
        const compiled = this.compileFilters(filters);
        const allRows = await this.fetchRows();
        const filteredRows = allRows.filter((row) => this.matchesFilters(row, compiled));
        filteredRows.sort((a, b) => {
            const bv = b.submittedAt?.getTime() ?? b.createdAt.getTime();
            const av = a.submittedAt?.getTime() ?? a.createdAt.getTime();
            return bv - av;
        });
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        return {
            items: filteredRows.slice(skip, skip + take).map((row) => ({
                id: row.id,
                submittedAt: row.submittedAt,
                answers: row.answers,
                rawPayload: row.rawPayload,
            })),
            page,
            pageSize,
            total: filteredRows.length,
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
        const responseModel = this.prisma.biCpcaMeetingResponse;
        if (!allFiltered) {
            const deleted = await responseModel.deleteMany({
                where: { id: { in: uniqueIds } },
            });
            return {
                mode: 'IDS',
                deletedCount: Number(deleted?.count ?? 0),
            };
        }
        const compiled = this.compileFilters(payload);
        const allRows = await this.fetchRows();
        const filteredIds = allRows
            .filter((row) => this.matchesFilters(row, compiled))
            .map((row) => row.id);
        if (filteredIds.length === 0) {
            return {
                mode: 'FILTERED',
                deletedCount: 0,
            };
        }
        const deleted = await responseModel.deleteMany({
            where: { id: { in: filteredIds } },
        });
        return {
            mode: 'FILTERED',
            deletedCount: Number(deleted?.count ?? 0),
        };
    }
    async listCardSettings() {
        const cardSettingModel = this.prisma.biCpcaMeetingCardSetting;
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
        return { items };
    }
    async updateCardSetting(cardIdRaw, payload, user) {
        const cardId = String(cardIdRaw ?? '').trim();
        if (!cardId || cardId.length > 120) {
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
        const cardSettingModel = this.prisma.biCpcaMeetingCardSetting;
        return cardSettingModel.upsert({
            where: { cardId },
            create: {
                id: this.makeId('bicmcs_'),
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
    }
    async dashboard(filters) {
        const compiled = this.compileFilters(filters);
        const responseModel = this.prisma.biCpcaMeetingResponse;
        const importModel = this.prisma.biCpcaMeetingImportBatch;
        const cardSettingModel = this.prisma.biCpcaMeetingCardSetting;
        const [allRowsRaw, latestImport, cardSettings] = await this.prisma.$transaction([
            responseModel.findMany({
                select: {
                    id: true,
                    submittedAt: true,
                    createdAt: true,
                    answersJson: true,
                    rawPayload: true,
                },
            }),
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
        const allRows = allRowsRaw.map((row) => this.mapRow(row));
        const filteredRows = allRows.filter((row) => this.matchesFilters(row, compiled));
        const latestColumns = this.parseColumnsJson(latestImport?.columnsJson);
        const columns = this.buildColumnsMeta(allRows, filteredRows, latestColumns);
        const categoricalColumns = columns.filter((item) => item.type === 'CATEGORICAL' || item.type === 'MULTI_SELECT');
        const textColumns = columns.filter((item) => item.type === 'FREE_TEXT');
        const categoricalDistributions = categoricalColumns.map((column) => {
            const distribution = this.buildDistribution(filteredRows, column);
            return {
                key: column.key,
                label: column.label,
                type: column.type,
                totalMentions: distribution.totalMentions,
                data: distribution.data,
            };
        });
        const freeTextLists = textColumns.map((column) => ({
            key: column.key,
            label: column.label,
            ...this.buildTextList(filteredRows, column.key),
        }));
        const question2Column = columns.find((column) => column.questionNumber === 2 &&
            (column.type === 'CATEGORICAL' || column.type === 'MULTI_SELECT'));
        const question2TrendByDay = question2Column
            ? this.buildQuestionTrendByDay(filteredRows, question2Column)
            : {
                questionKey: null,
                questionLabel: null,
                options: [],
                items: [],
            };
        const totalCells = filteredRows.length * columns.length;
        const filledCells = columns.reduce((sum, column) => {
            const count = filteredRows.reduce((acc, row) => {
                const value = this.cleanCell(row.answers[column.key]);
                return acc + (value ? 1 : 0);
            }, 0);
            return sum + count;
        }, 0);
        const completionRatePercent = totalCells > 0 ? Number(((filledCells / totalCells) * 100).toFixed(2)) : 0;
        const topDistribution = categoricalDistributions
            .map((item) => {
            const top = item.data[0];
            if (!top)
                return null;
            return {
                questionLabel: item.label,
                optionLabel: String(top.label),
                count: Number(top.count),
                percent: Number(top.percent),
            };
        })
            .filter(Boolean)
            .sort((a, b) => b.percent - a.percent)[0] ?? null;
        const topFreeText = freeTextLists
            .map((item) => ({
            key: item.key,
            label: item.label,
            totalResponses: item.totalResponses,
        }))
            .sort((a, b) => b.totalResponses - a.totalResponses)[0] ?? null;
        return {
            kpis: {
                totalResponses: filteredRows.length,
                totalRowsInDb: allRows.length,
                completionRatePercent,
                categoricalQuestions: categoricalColumns.length,
                freeTextQuestions: textColumns.length,
            },
            filters: {
                columns: columns
                    .filter((column) => column.options.length > 0)
                    .map((column) => ({
                    key: column.key,
                    label: column.label,
                    options: column.options,
                })),
            },
            charts: {
                categoricalDistributions,
                question2TrendByDay,
            },
            textColumns: {
                freeTextLists,
            },
            insights: {
                topDistribution,
                topFreeText,
                completion: {
                    title: 'Taxa de preenchimento do recorte',
                    answeredRatePercent: completionRatePercent,
                    filledCells,
                    totalCells,
                },
            },
            latestImport,
            cardSettings,
            columnsMeta: columns.map((column) => ({
                key: column.key,
                label: column.label,
                type: column.type,
                questionNumber: column.questionNumber,
            })),
        };
    }
    fetchRows() {
        const responseModel = this.prisma.biCpcaMeetingResponse;
        return responseModel
            .findMany({
            select: {
                id: true,
                submittedAt: true,
                createdAt: true,
                answersJson: true,
                rawPayload: true,
            },
        })
            .then((rows) => rows.map((row) => this.mapRow(row)));
    }
    mapRow(row) {
        const answers = this.toStringRecord(row.answersJson);
        const rawPayload = this.toNullableStringRecord(row.rawPayload);
        const submittedAt = row.submittedAt
            ? new Date(row.submittedAt)
            : this.inferSubmittedAtFromPayload(answers, rawPayload);
        return {
            id: String(row.id),
            submittedAt,
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(0),
            answers,
            rawPayload,
        };
    }
    buildColumnsMeta(allRows, filteredRows, latestColumns) {
        const labelsByKey = new Map();
        const order = [];
        if (latestColumns) {
            for (const key of latestColumns.order) {
                const normalizedKey = this.normalizeHeaderKey(key);
                if (!normalizedKey)
                    continue;
                if (!order.includes(normalizedKey))
                    order.push(normalizedKey);
            }
            for (const [key, label] of Object.entries(latestColumns.labels ?? {})) {
                const normalizedKey = this.normalizeHeaderKey(key);
                if (!normalizedKey)
                    continue;
                labelsByKey.set(normalizedKey, String(label ?? '').trim() || normalizedKey);
            }
        }
        for (const row of allRows) {
            for (const key of Object.keys(row.answers)) {
                if (!order.includes(key))
                    order.push(key);
            }
            for (const [header, value] of Object.entries(row.rawPayload)) {
                if (!this.cleanCell(value))
                    continue;
                const key = this.normalizeHeaderKey(header);
                if (!key)
                    continue;
                if (!labelsByKey.has(key)) {
                    labelsByKey.set(key, String(header).trim());
                }
            }
        }
        const columns = [];
        for (const key of order) {
            const sourceValues = filteredRows
                .map((row) => this.cleanCell(row.answers[key]))
                .filter((value) => Boolean(value));
            const allValues = allRows
                .map((row) => this.cleanCell(row.answers[key]))
                .filter((value) => Boolean(value));
            const label = labelsByKey.get(key) ?? this.humanizeHeaderKey(key);
            if (this.isSubmittedAtColumn(key, label, latestColumns?.submittedAtKey ?? null)) {
                continue;
            }
            const questionNumber = this.extractQuestionNumber(label);
            const uniqueValues = new Set(allValues.map((item) => this.normalizeForMatch(item)));
            const avgLength = allValues.length > 0
                ? Number((allValues.reduce((sum, item) => sum + item.length, 0) /
                    allValues.length).toFixed(2))
                : 0;
            const multi = this.isLikelyMultiSelect(label, allValues);
            const forceCategorical = questionNumber === 2 || questionNumber === 4;
            const freeText = forceCategorical
                ? false
                : this.isLikelyFreeText(label, allValues, uniqueValues.size);
            const type = freeText
                ? 'FREE_TEXT'
                : multi
                    ? 'MULTI_SELECT'
                    : 'CATEGORICAL';
            const options = type === 'FREE_TEXT'
                ? []
                : this.buildOptionsList(sourceValues, type === 'MULTI_SELECT');
            columns.push({
                key,
                label,
                type,
                questionNumber,
                options,
                nonEmptyCount: allValues.length,
                uniqueCount: uniqueValues.size,
                avgLength,
            });
        }
        return columns;
    }
    buildDistribution(rows, column) {
        const counter = new Map();
        for (const row of rows) {
            const raw = this.cleanCell(row.answers[column.key]);
            if (!raw)
                continue;
            if (column.type === 'MULTI_SELECT') {
                for (const token of this.splitMultiValues(raw, true)) {
                    counter.set(token, (counter.get(token) ?? 0) + 1);
                }
                continue;
            }
            counter.set(raw, (counter.get(raw) ?? 0) + 1);
        }
        const totalMentions = Array.from(counter.values()).reduce((sum, count) => sum + count, 0);
        const data = Array.from(counter.entries())
            .map(([label, count]) => ({
            label,
            count,
            percent: totalMentions > 0 ? Number(((count / totalMentions) * 100).toFixed(2)) : 0,
        }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            .slice(0, 20);
        return {
            totalMentions,
            data,
        };
    }
    buildTextList(rows, key) {
        const counter = new Map();
        let totalResponses = 0;
        for (const row of rows) {
            const value = this.cleanCell(row.answers[key]);
            if (!value)
                continue;
            totalResponses += 1;
            const normalized = this.normalizeForMatch(value);
            const current = counter.get(normalized);
            if (current) {
                current.count += 1;
            }
            else {
                counter.set(normalized, { text: value, count: 1 });
            }
        }
        const items = Array.from(counter.values())
            .map((item) => ({
            text: item.text,
            count: item.count,
            percent: totalResponses > 0
                ? Number(((item.count / totalResponses) * 100).toFixed(2))
                : 0,
        }))
            .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
        return {
            totalUnique: items.length,
            totalResponses,
            displayed: Math.min(items.length, 25),
            items: items.slice(0, 25),
        };
    }
    buildQuestionTrendByDay(rows, column) {
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
            const option = this.cleanCell(row.answers[column.key]) ?? 'Não informado';
            current.counters.set(option, (current.counters.get(option) ?? 0) + 1);
            map.set(day, current);
        }
        const discovered = new Set();
        for (const value of map.values()) {
            for (const option of value.counters.keys()) {
                discovered.add(option);
            }
        }
        const options = [...discovered].sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
            questionKey: column.key,
            questionLabel: column.label,
            options,
            items,
        };
    }
    buildOptionsList(values, allowMultiSplit) {
        const counter = new Map();
        for (const value of values) {
            const parts = allowMultiSplit ? this.splitMultiValues(value, true) : [value];
            for (const part of parts) {
                counter.set(part, (counter.get(part) ?? 0) + 1);
            }
        }
        return Array.from(counter.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 120)
            .map(([label]) => label);
    }
    compileFilters(filters) {
        const from = this.parseDate(filters.from);
        const to = this.parseDate(filters.to);
        const query = this.cleanCell(filters.q);
        const mode = this.parseCombineMode(filters.combineMode);
        const columnFilters = this.parseColumnFilters(filters.columnFilters);
        return {
            from,
            to,
            query,
            mode,
            columnFilters,
        };
    }
    matchesFilters(row, filters) {
        if (filters.from || filters.to) {
            if (!row.submittedAt)
                return false;
            if (filters.from && row.submittedAt < filters.from)
                return false;
            if (filters.to) {
                const toEnd = new Date(filters.to);
                toEnd.setHours(23, 59, 59, 999);
                if (row.submittedAt > toEnd)
                    return false;
            }
        }
        const conditions = [];
        if (filters.query) {
            const q = this.normalizeForMatch(filters.query);
            const matchesQuery = Object.values(row.answers).some((value) => this.normalizeForMatch(value).includes(q));
            conditions.push(matchesQuery);
        }
        for (const [key, expectedValue] of Object.entries(filters.columnFilters)) {
            const value = this.cleanCell(row.answers[key]);
            if (!value) {
                conditions.push(false);
                continue;
            }
            const expected = this.normalizeForMatch(expectedValue);
            const direct = this.normalizeForMatch(value) === expected;
            const split = this.splitMultiValues(value, true).some((item) => this.normalizeForMatch(item) === expected);
            conditions.push(direct || split);
        }
        if (conditions.length === 0)
            return true;
        if (filters.mode === 'OR')
            return conditions.some(Boolean);
        return conditions.every(Boolean);
    }
    parseColumnFilters(raw) {
        const parsed = typeof raw === 'string'
            ? this.parseJsonObject(raw)
            : raw && typeof raw === 'object'
                ? raw
                : {};
        const output = {};
        for (const [keyRaw, valueRaw] of Object.entries(parsed)) {
            const key = this.normalizeHeaderKey(keyRaw);
            const value = this.cleanCell(valueRaw);
            if (!key || !value)
                continue;
            output[key] = value;
        }
        return output;
    }
    parseJsonObject(raw) {
        const text = raw.trim();
        if (!text)
            return {};
        try {
            const value = JSON.parse(text);
            if (!value || typeof value !== 'object' || Array.isArray(value))
                return {};
            return value;
        }
        catch {
            return {};
        }
    }
    parseColumnsJson(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return null;
        const value = raw;
        const order = Array.isArray(value.order)
            ? value.order.map((item) => this.normalizeHeaderKey(String(item ?? ''))).filter(Boolean)
            : [];
        const labelsInput = value.labels && typeof value.labels === 'object' && !Array.isArray(value.labels)
            ? value.labels
            : {};
        const labels = {};
        for (const [key, label] of Object.entries(labelsInput)) {
            const normalizedKey = this.normalizeHeaderKey(key);
            if (!normalizedKey)
                continue;
            labels[normalizedKey] = String(label ?? '').trim();
        }
        const submittedAtRaw = value.submittedAtKey;
        const submittedAtKey = submittedAtRaw === null || submittedAtRaw === undefined
            ? null
            : this.normalizeHeaderKey(String(submittedAtRaw));
        return {
            order,
            labels,
            submittedAtKey,
        };
    }
    parseCombineMode(value) {
        const normalized = this.compact(value ?? 'AND');
        return normalized === 'OR' ? 'OR' : 'AND';
    }
    parseDate(value) {
        if (!value)
            return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime()))
            return null;
        return parsed;
    }
    extractRows(buffer, format) {
        const workbook = this.readWorkbook(buffer, format);
        const sheetNames = workbook.SheetNames ?? [];
        if (sheetNames.length === 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'empty_workbook' });
        }
        const selectedName = this.findPreferredSheetName(sheetNames, [
            'Respostas ao formulário',
            'Respostas',
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
        const preferred = preferredNames.map((name) => this.normalizeForMatch(name));
        const match = sheetNames.find((name) => {
            const normalized = this.normalizeForMatch(name);
            return preferred.some((item) => normalized.includes(item));
        });
        return match ?? sheetNames[0];
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
    normalizeHeaderRow(row) {
        return row
            .map((value, index) => this.cleanHeaderCell(value, index))
            .filter((value) => Boolean(value));
    }
    buildHeaderDefinitions(headers) {
        const usedKeys = new Set();
        const defs = [];
        for (let index = 0; index < headers.length; index += 1) {
            const label = headers[index];
            const base = this.normalizeHeaderKey(label) || `coluna_${index + 1}`;
            let key = base;
            let suffix = 2;
            while (usedKeys.has(key)) {
                key = `${base}_${suffix}`;
                suffix += 1;
            }
            usedKeys.add(key);
            defs.push({ index, key, label });
        }
        return defs;
    }
    detectSubmittedAtKey(headerDefs) {
        const score = (value) => {
            const normalized = this.normalizeForMatch(value.label);
            if (normalized.includes('carimbodedatahora'))
                return 5;
            if (normalized.includes('timestamp'))
                return 5;
            if (normalized === 'data')
                return 4;
            if (normalized.includes('submittedat'))
                return 4;
            if (normalized.includes('datadeenvio'))
                return 4;
            if (normalized.includes('datahora'))
                return 3;
            if (normalized.includes('data'))
                return 2;
            return 0;
        };
        const sorted = [...headerDefs].sort((a, b) => score(b) - score(a));
        return score(sorted[0]) > 0 ? sorted[0].key : null;
    }
    parseDataRow(row, headers, submittedAtKey, sourceRow) {
        const answers = {};
        const rawPayload = {};
        for (const header of headers) {
            const raw = this.getCell(row, header.index);
            const cleaned = this.cleanCell(raw);
            rawPayload[header.label] = cleaned;
            if (cleaned) {
                answers[header.key] = cleaned;
            }
        }
        if (Object.keys(answers).length === 0) {
            return { skip: true };
        }
        const submittedAtRaw = submittedAtKey ? answers[submittedAtKey] : null;
        const submittedAt = this.parseSubmittedAt(submittedAtRaw ?? null);
        const hashPayload = {
            submittedAt: submittedAt?.toISOString() ?? null,
            answers: Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)),
        };
        const sourceHash = node_crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(hashPayload))
            .digest('hex');
        return {
            skip: false,
            value: {
                submittedAt,
                answers,
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
        const direct = new Date(raw);
        if (!Number.isNaN(direct.getTime()))
            return direct;
        const match = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (!match)
            return null;
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
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    isLikelyMultiSelect(label, values) {
        const normalizedLabel = this.normalizeForMatch(label);
        const hinted = HEADER_MULTI_HINTS.some((hint) => normalizedLabel.includes(this.normalizeForMatch(hint)));
        const multiCandidateCount = values.filter((value) => this.splitMultiValues(value, hinted).length > 1).length;
        if (hinted && multiCandidateCount >= 1)
            return true;
        return multiCandidateCount >= Math.max(3, Math.floor(values.length * 0.15));
    }
    isLikelyFreeText(label, values, uniqueCount) {
        if (values.length === 0)
            return false;
        const normalizedLabel = this.normalizeForMatch(label);
        if (HEADER_TEXT_HINTS.some((hint) => normalizedLabel.includes(this.normalizeForMatch(hint)))) {
            return true;
        }
        const maxLength = values.reduce((max, value) => Math.max(max, value.length), 0);
        const avgLength = values.reduce((sum, value) => sum + value.length, 0) / values.length;
        const uniqueRate = uniqueCount / values.length;
        if (maxLength >= 120)
            return true;
        if (avgLength >= 42)
            return true;
        if (uniqueCount >= 12 && uniqueRate >= 0.45)
            return true;
        return false;
    }
    splitMultiValues(value, allowComma) {
        const clean = this.cleanCell(value);
        if (!clean)
            return [];
        const explicitSeparators = ['|', ';', '\\n', ' / '];
        for (const separator of explicitSeparators) {
            if (!clean.includes(separator))
                continue;
            const items = clean
                .split(separator)
                .map((item) => this.cleanCell(item))
                .filter((item) => Boolean(item));
            if (items.length > 1)
                return [...new Set(items)];
        }
        if (allowComma && clean.includes(',')) {
            const items = clean
                .split(',')
                .map((item) => this.cleanCell(item))
                .filter((item) => Boolean(item));
            if (items.length > 1)
                return [...new Set(items)];
        }
        return [clean];
    }
    inferSubmittedAtFromPayload(answers, rawPayload) {
        for (const [key, value] of Object.entries(answers)) {
            if (!value)
                continue;
            if (!this.isSubmittedAtColumn(key, key, null))
                continue;
            const parsed = this.parseSubmittedAt(value);
            if (parsed)
                return parsed;
        }
        for (const [label, value] of Object.entries(rawPayload)) {
            if (!value)
                continue;
            if (!this.isSubmittedAtColumn(this.normalizeHeaderKey(label), label, null)) {
                continue;
            }
            const parsed = this.parseSubmittedAt(value);
            if (parsed)
                return parsed;
        }
        return null;
    }
    isSubmittedAtColumn(key, label, submittedAtKey) {
        if (submittedAtKey && key === submittedAtKey)
            return true;
        const normalizedLabel = this.normalizeForMatch(label);
        return (normalizedLabel.includes('CARIMBODEDATAHORA') ||
            normalizedLabel.includes('TIMESTAMP') ||
            normalizedLabel.includes('SUBMITTEDAT'));
    }
    extractQuestionNumber(label) {
        const match = String(label ?? '').trim().match(/^(\d{1,2})[\).\-\s]/);
        if (!match)
            return null;
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? parsed : null;
    }
    toStringRecord(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return {};
        const output = {};
        for (const [key, raw] of Object.entries(value)) {
            const normalizedKey = this.normalizeHeaderKey(key);
            const cleanedValue = this.cleanCell(raw);
            if (!normalizedKey || !cleanedValue)
                continue;
            output[normalizedKey] = cleanedValue;
        }
        return output;
    }
    toNullableStringRecord(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return {};
        const output = {};
        for (const [key, raw] of Object.entries(value)) {
            output[String(key)] = this.cleanCell(raw);
        }
        return output;
    }
    cleanHeaderCell(value, index) {
        const raw = this.cleanCell(value);
        return raw || `Coluna ${index + 1}`;
    }
    getCell(row, index) {
        if (index < 0 || index >= row.length)
            return null;
        return this.cleanCell(row[index]);
    }
    cleanCell(value) {
        if (value === undefined || value === null)
            return null;
        const text = String(value)
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return text || null;
    }
    normalizeHeaderKey(value) {
        const raw = String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 96);
        return raw || '';
    }
    normalizeForMatch(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
    }
    humanizeHeaderKey(value) {
        return value
            .split('_')
            .filter(Boolean)
            .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
            .join(' ');
    }
    formatDayLabel(day) {
        const [year, month, date] = day.split('-').map((item) => Number(item));
        if (!year || !month || !date)
            return day;
        return `${String(date).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    fileExtension(fileName) {
        const lower = String(fileName ?? '').toLowerCase().trim();
        if (lower.endsWith('.csv'))
            return 'csv';
        if (lower.endsWith('.xls'))
            return 'xls';
        return 'xlsx';
    }
    compact(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase();
    }
    makeId(prefix) {
        return `${prefix}${node_crypto_1.default.randomBytes(10).toString('hex')}`;
    }
};
exports.BiCpcaMeetingService = BiCpcaMeetingService;
exports.BiCpcaMeetingService = BiCpcaMeetingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BiCpcaMeetingService);
//# sourceMappingURL=bi-cpca-meeting.service.js.map