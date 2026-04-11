import type { Request } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { BiGsdEvaluationService } from './bi-gsd-evaluation.service';
export declare class BiGsdEvaluationController {
    private readonly biGsdEvaluation;
    constructor(biGsdEvaluation: BiGsdEvaluationService);
    private assertTiForSettings;
    dashboard(from: string | undefined, to: string | undefined, q: string | undefined, combineMode: string | undefined, columnFilters: string | undefined, user: RbacUser): Promise<{
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
                type: "CATEGORICAL" | "MULTI_SELECT" | "FREE_TEXT";
                totalMentions: number;
                data: {
                    label: string;
                    count: number;
                    percent: number;
                    localities: string[];
                }[];
            }[];
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
            type: "CATEGORICAL" | "MULTI_SELECT" | "FREE_TEXT";
            questionNumber: number | null;
        }[];
    }>;
    listResponses(from: string | undefined, to: string | undefined, q: string | undefined, combineMode: string | undefined, columnFilters: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
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
    listImports(page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    importResponses(file: Express.Multer.File, replace: string | undefined, req: Request & {
        fileValidationError?: string;
    }, user: RbacUser): Promise<{
        batch: any;
        preview: {
            submittedAt: Date | null;
            answers: Record<string, string>;
        }[];
        importMode: string;
    }>;
    deleteResponses(body: {
        ids?: string[];
        allFiltered?: boolean;
        from?: string;
        to?: string;
        q?: string;
        combineMode?: string;
        columnFilters?: Record<string, string> | string;
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
