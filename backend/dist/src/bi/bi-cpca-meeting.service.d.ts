import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
type CpcaMeetingFilters = {
    from?: string;
    to?: string;
    q?: string;
    combineMode?: string;
    columnFilters?: string | Record<string, string>;
};
type ImportCpcaMeetingOptions = {
    replaceAll?: boolean;
};
type ColumnType = 'CATEGORICAL' | 'MULTI_SELECT' | 'FREE_TEXT';
export declare class BiCpcaMeetingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    importResponses(file: Express.Multer.File, user?: RbacUser, options?: ImportCpcaMeetingOptions): Promise<{
        batch: any;
        preview: {
            submittedAt: Date | null;
            answers: Record<string, string>;
        }[];
        importMode: string;
    }>;
    listImports(filters: {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    listResponses(filters: CpcaMeetingFilters & {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: {
            id: string;
            submittedAt: Date | null;
            answers: Record<string, string>;
            rawPayload: Record<string, string | null>;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    deleteResponses(payload: CpcaMeetingFilters & {
        ids?: string[];
        allFiltered?: boolean;
    }): Promise<{
        mode: string;
        deletedCount: number;
    }>;
    listCardSettings(): Promise<{
        items: any;
    }>;
    updateCardSetting(cardIdRaw: string, payload: {
        title?: string;
        description?: string | null;
    }, user?: RbacUser): Promise<any>;
    dashboard(filters: CpcaMeetingFilters): Promise<{
        kpis: {
            totalResponses: number;
            totalRowsInDb: number;
            completionRatePercent: number;
            categoricalQuestions: number;
            freeTextQuestions: number;
        };
        filters: {
            columns: {
                key: string;
                label: string;
                options: string[];
            }[];
        };
        charts: {
            categoricalDistributions: {
                key: string;
                label: string;
                type: ColumnType;
                totalMentions: number;
                data: {
                    label: string;
                    count: number;
                    percent: number;
                }[];
            }[];
            question2TrendByDay: {
                questionKey: string;
                questionLabel: string;
                options: string[];
                items: Record<string, string | number>[];
            } | {
                questionKey: null;
                questionLabel: null;
                options: string[];
                items: Array<Record<string, string | number>>;
            };
        };
        textColumns: {
            freeTextLists: {
                totalUnique: number;
                totalResponses: number;
                displayed: number;
                items: {
                    text: string;
                    count: number;
                    percent: number;
                }[];
                key: string;
                label: string;
            }[];
        };
        insights: {
            topDistribution: {
                questionLabel: string;
                optionLabel: string;
                count: number;
                percent: number;
            } | null;
            topFreeText: {
                key: string;
                label: string;
                totalResponses: number;
            };
            completion: {
                title: string;
                answeredRatePercent: number;
                filledCells: number;
                totalCells: number;
            };
        };
        latestImport: any;
        cardSettings: any;
        columnsMeta: {
            key: string;
            label: string;
            type: ColumnType;
            questionNumber: number | null;
        }[];
    }>;
    private fetchRows;
    private mapRow;
    private buildColumnsMeta;
    private buildDistribution;
    private buildTextList;
    private buildQuestionTrendByDay;
    private buildOptionsList;
    private compileFilters;
    private matchesFilters;
    private parseColumnFilters;
    private parseJsonObject;
    private parseColumnsJson;
    private parseCombineMode;
    private parseDate;
    private extractRows;
    private readWorkbook;
    private findPreferredSheetName;
    private sheetToMatrix;
    private normalizeHeaderRow;
    private buildHeaderDefinitions;
    private detectSubmittedAtKey;
    private parseDataRow;
    private parseSubmittedAt;
    private isLikelyMultiSelect;
    private isLikelyFreeText;
    private splitMultiValues;
    private inferSubmittedAtFromPayload;
    private isSubmittedAtColumn;
    private extractQuestionNumber;
    private toStringRecord;
    private toNullableStringRecord;
    private cleanHeaderCell;
    private getCell;
    private cleanCell;
    private normalizeHeaderKey;
    private normalizeForMatch;
    private humanizeHeaderKey;
    private formatDayLabel;
    private fileExtension;
    private compact;
    private makeId;
}
export {};
