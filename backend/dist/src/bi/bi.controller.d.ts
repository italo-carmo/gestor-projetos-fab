import type { Request } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { BiService } from './bi.service';
export declare class BiController {
    private readonly bi;
    constructor(bi: BiService);
    private assertTiForSettings;
    dashboard(from: string | undefined, to: string | undefined, mission: string | undefined, om: string | undefined, posto: string | undefined, postoGraduacao: string | undefined, autodeclara: string | undefined, suffered: string | undefined, violenceType: string | undefined, combineMode: string | undefined, user: RbacUser): Promise<{
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
            mission: string[];
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
            violenceTypeByPostoPercent: {
                types: string[];
                items: Record<string, string | number>[];
            };
            monthlyTrend: {
                yesRatePercent: number;
                total: number;
                yesCount: number;
                noCount: number;
                unknownCount: number;
                month: string;
            }[];
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
            topMissionByMentions: {
                om: string;
                mentions: number;
                sharePercent: number;
            } | null;
            topProfileByMentions: {
                posto: string;
                mentions: number;
                sharePercent: number;
            } | null;
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
    listResponses(from: string | undefined, to: string | undefined, mission: string | undefined, om: string | undefined, posto: string | undefined, postoGraduacao: string | undefined, autodeclara: string | undefined, suffered: string | undefined, violenceType: string | undefined, q: string | undefined, combineMode: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            posto: string | null;
            violenceTypes: string[];
            postoGraduacao: string | null;
            batchId: string | null;
            submittedAt: Date | null;
            sufferedViolenceRaw: string | null;
            sufferedViolence: boolean | null;
            om: string | null;
            autodeclara: string | null;
            extraColumn: string | null;
            rawPayload: import("@prisma/client/runtime/client").JsonValue | null;
            sourceRow: number | null;
            sourceHash: string;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    listQuestions(from: string | undefined, to: string | undefined, mission: string | undefined, om: string | undefined, posto: string | undefined, postoGraduacao: string | undefined, autodeclara: string | undefined, suffered: string | undefined, violenceType: string | undefined, q: string | undefined, combineMode: string | undefined, user: RbacUser): Promise<{
        mission: string | null;
        totalResponses: number;
        items: {
            id: string;
            label: string;
            answeredCount: number;
            emptyCount: number;
            answerRatePercent: number;
            topAnswers: {
                label: string;
                count: number;
                percent: number;
            }[];
        }[];
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
    importSurvey(file: Express.Multer.File, replace: string | undefined, req: Request & {
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
            sufferedViolenceRaw: string | null;
            violenceTypes: string[];
            postoGraduacao: string | null;
            om: string | null;
            posto: string | null;
            autodeclara: string | null;
        }[];
        importMode: string;
        correlatedViolence: {
            sheetName: string;
            totalRows: number;
            mentionRows: number;
            byType: Array<{
                type: string;
                count: number;
                percent: number;
            }>;
        } | null;
    }>;
    deleteResponses(body: {
        ids?: string[];
        allFiltered?: boolean;
        from?: string;
        to?: string;
        mission?: string;
        om?: string;
        posto?: string;
        postoGraduacao?: string;
        autodeclara?: string;
        suffered?: string;
        violenceType?: string;
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
