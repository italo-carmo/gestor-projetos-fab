import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
type SurveyFilters = {
    from?: string;
    to?: string;
    om?: string;
    posto?: string;
    postoGraduacao?: string;
    autodeclara?: string;
    suffered?: string;
    violenceType?: string;
    q?: string;
    combineMode?: string;
};
export declare class BiService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    importSurvey(file: Express.Multer.File, user?: RbacUser): Promise<{
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
            sufferedViolenceRaw: string | null;
            violenceTypes: string[];
            postoGraduacao: string | null;
            om: string | null;
            posto: string | null;
            autodeclara: string | null;
        }[];
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
    listResponses(filters: SurveyFilters & {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            posto: string | null;
            batchId: string | null;
            submittedAt: Date | null;
            sufferedViolenceRaw: string | null;
            sufferedViolence: boolean | null;
            violenceTypes: string[];
            postoGraduacao: string | null;
            om: string | null;
            autodeclara: string | null;
            extraColumn: string | null;
            rawPayload: Prisma.JsonValue | null;
            sourceRow: number | null;
            sourceHash: string;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    deleteResponses(payload: SurveyFilters & {
        ids?: string[];
        allFiltered?: boolean;
    }): Promise<{
        mode: string;
        deletedCount: number;
    }>;
    dashboard(filters: SurveyFilters): Promise<{
        kpis: {
            totalResponses: number;
            totalRowsInDb: number;
            yesCount: number;
            noCount: number;
            unknownCount: number;
            violenceRatePercent: number;
            totalViolenceMentions: number;
            averageTypesPerVictim: number;
        };
        filters: {
            om: string[];
            posto: string[];
            postoGraduacao: string[];
            autodeclara: string[];
            violenceTypes: string[];
            suffered: {
                value: string;
                label: string;
            }[];
        };
        charts: {
            omViolencePercent: {
                simPercent: number;
                naoPercent: number;
                unknownPercent: number;
                simCount: number;
                naoCount: number;
                unknownCount: number;
                total: number;
                om: string;
            }[];
            omDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            postoDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            postoGraduacaoDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            autodeclaraDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            yesNoDonut: {
                label: string;
                count: number;
                percent: number;
            }[];
            violenceTypePercent: {
                type: string;
                count: number;
                percent: number;
            }[];
            violenceTypeByOmPercent: {
                types: string[];
                items: Record<string, string | number>[];
            };
        };
        insights: {
            mostCommonType: {
                type: string;
                mentions: number;
            } | null;
            riskiestOm: {
                om: string;
                simPercent: number;
                total: number;
            } | null;
        };
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
    private buildOmViolenceChart;
    private buildDistribution;
    private buildViolenceTypeChart;
    private buildViolenceTypeByOmChart;
    private sortOm;
    private buildWhere;
    private parseCombineMode;
    private extractRows;
    private resolveHeaderMap;
    private parseDataRow;
    private fileExtension;
    private parseDate;
    private parseSubmittedAt;
    private parseSufferedViolence;
    private parseViolenceTypes;
    private toTitleCase;
    private normalize;
    private cleanCell;
    private getCell;
}
export {};
