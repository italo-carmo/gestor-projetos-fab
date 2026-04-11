import type { Request } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { BiRecruitsService } from './bi-recruits.service';
export declare class BiRecruitsController {
    private readonly biRecruits;
    constructor(biRecruits: BiRecruitsService);
    private assertRecruitsAccess;
    private assertTiForSettings;
    dashboard(from: string | undefined, to: string | undefined, education: string | undefined, gender: string | undefined, identifyHarassment: string | undefined, conductLimits: string | undefined, knowOrientation: string | undefined, knowReportProcess: string | undefined, willingnessOrientation: string | undefined, willingnessReport: string | undefined, enlistmentDecisionInfluence: string | undefined, q: string | undefined, combineMode: string | undefined, user: RbacUser): Promise<{
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
    listResponses(from: string | undefined, to: string | undefined, education: string | undefined, gender: string | undefined, identifyHarassment: string | undefined, conductLimits: string | undefined, knowOrientation: string | undefined, knowReportProcess: string | undefined, willingnessOrientation: string | undefined, willingnessReport: string | undefined, enlistmentDecisionInfluence: string | undefined, q: string | undefined, combineMode: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            batchId: string | null;
            submittedAt: Date | null;
            rawPayload: import("@prisma/client/runtime/client").JsonValue | null;
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
    listImports(page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
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
    importResponses(file: Express.Multer.File, replace: string | undefined, req: Request & {
        fileValidationError?: string;
    }, user: RbacUser): Promise<{
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
    deleteResponses(body: {
        ids?: string[];
        allFiltered?: boolean;
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
    }, user: RbacUser): Promise<{
        mode: string;
        deletedCount: number;
    }>;
    listCardSettings(user: RbacUser): Promise<{
        items: any;
    }>;
    updateCardSetting(cardId: string, body: {
        title?: string;
        description?: string | null;
    }, user: RbacUser): Promise<any>;
}
