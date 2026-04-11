import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
type RecruitsFilters = {
    from?: string;
    to?: string;
    education?: string;
    gender?: string;
    identifyHarassment?: string;
    conductLimits?: string;
    knowOrientation?: string;
    knowReportProcess?: string;
    willingnessOrientation?: string;
    willingnessReport?: string;
    enlistmentDecisionInfluence?: string;
    q?: string;
    combineMode?: string;
};
type ImportRecruitsOptions = {
    replaceAll?: boolean;
};
type RecruitsCardSettingInput = {
    title?: string;
    description?: string | null;
};
export declare class BiRecruitsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    importResponses(file: Express.Multer.File, user?: RbacUser, options?: ImportRecruitsOptions): Promise<{
        batch: {
            importedBy: {
                id: string;
                name: string;
                email: string;
            } | null;
        } & {
            id: string;
            sheetName: string | null;
            fileName: string;
            format: import("@prisma/client").$Enums.BiImportFormat;
            totalRows: number;
            insertedRows: number;
            duplicateRows: number;
            invalidRows: number;
            importedAt: Date;
            importedById: string | null;
        };
        preview: {
            submittedAt: Date | null;
            education: string | null;
            gender: string | null;
            identifyHarassment: string | null;
            knowOrientation: string | null;
            knowReportProcess: string | null;
            willingnessReport: string | null;
        }[];
        importMode: string;
    }>;
    listImports(filters: {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: ({
            importedBy: {
                id: string;
                name: string;
                email: string;
            } | null;
        } & {
            id: string;
            sheetName: string | null;
            fileName: string;
            format: import("@prisma/client").$Enums.BiImportFormat;
            totalRows: number;
            insertedRows: number;
            duplicateRows: number;
            invalidRows: number;
            importedAt: Date;
            importedById: string | null;
        })[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    listResponses(filters: RecruitsFilters & {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            batchId: string | null;
            submittedAt: Date | null;
            rawPayload: Prisma.JsonValue | null;
            sourceRow: number | null;
            sourceHash: string;
            education: string | null;
            gender: string | null;
            identifyHarassment: string | null;
            conductLimits: string | null;
            knowOrientation: string | null;
            knowReportProcess: string | null;
            willingnessOrientation: string | null;
            willingnessReport: string | null;
            enlistmentDecisionInfluenceText: string | null;
            suggestionComment: string | null;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    deleteResponses(payload: RecruitsFilters & {
        ids?: string[];
        allFiltered?: boolean;
    }): Promise<{
        mode: string;
        deletedCount: number;
    }>;
    listCardSettings(): Promise<{
        items: any;
    }>;
    updateCardSetting(cardIdRaw: string, payload: RecruitsCardSettingInput, user?: RbacUser): Promise<any>;
    dashboard(filters: RecruitsFilters): Promise<{
        kpis: {
            totalResponses: number;
            totalRowsInDb: number;
            secureGuidanceCount: number;
            secureGuidanceRatePercent: number;
            secureReportCount: number;
            secureReportRatePercent: number;
            knowOrientationYesCount: number;
            knowOrientationYesRatePercent: number;
            knowReportYesCount: number;
            knowReportYesRatePercent: number;
        };
        filters: {
            education: string[];
            gender: string[];
            identifyHarassment: string[];
            conductLimits: string[];
            knowOrientation: string[];
            knowReportProcess: string[];
            willingnessOrientation: string[];
            willingnessReport: string[];
            enlistmentDecisionInfluence: string[];
        };
        charts: {
            educationDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            genderDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            identifyHarassmentDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            conductLimitsDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            knowOrientationDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            knowReportProcessDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            willingnessOrientationDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            willingnessReportDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            enlistmentDecisionInfluenceDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            responseTrend: {
                day: string;
                dayLabel: string;
                total: number;
                positiveCount: number;
                positiveRatePercent: number;
            }[];
        };
        textColumns: {
            suggestionComment: {
                total: number;
                displayed: number;
                items: {
                    id: string;
                    submittedAt: Date | null;
                    education: string | null;
                    gender: string | null;
                    text: string | null;
                }[];
            };
        };
        insights: {
            topEducation: {
                label: string;
                count: number;
                percent: number;
            } | null;
            topDecisionDriver: {
                label: string;
                count: number;
                percent: number;
            } | null;
            weakestPoint: {
                title: string;
                affectedCount: number;
                affectedRatePercent: number;
            };
        };
        cardSettings: any;
        latestImport: ({
            importedBy: {
                id: string;
                name: string;
                email: string;
            } | null;
        } & {
            id: string;
            sheetName: string | null;
            fileName: string;
            format: import("@prisma/client").$Enums.BiImportFormat;
            totalRows: number;
            insertedRows: number;
            duplicateRows: number;
            invalidRows: number;
            importedAt: Date;
            importedById: string | null;
        }) | null;
    }>;
    private buildAvailableFilters;
    private buildDistribution;
    private buildResponseTrend;
    private buildFreeTextRows;
    private buildTopTextFrequency;
    private buildWhere;
    private parseCombineMode;
    private parseDate;
    private extractRows;
    private readWorkbook;
    private findPreferredSheetName;
    private sheetToMatrix;
    private resolveHeaderMap;
    private parseDataRow;
    private parseSubmittedAt;
    private normalizeGender;
    private normalizeYesNoPartial;
    private normalizeWillingness;
    private normalizeEnlistmentDecisionInfluence;
    private normalizeChoice;
    private cleanCategory;
    private cleanFreeText;
    private fileExtension;
    private normalizeForMatch;
    private compact;
    private isNotApplicable;
    private toTitleCaseWithAccents;
    private cleanCell;
    private getCell;
}
export {};
