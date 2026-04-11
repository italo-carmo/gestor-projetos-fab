import type { Request } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';
export declare class BiBestPracticesCycleController {
    private readonly biBestPracticesCycle;
    constructor(biBestPracticesCycle: BiBestPracticesCycleService);
    private assertTiForSettings;
    dashboard(from: string | undefined, to: string | undefined, technicalRigorPerception: string | undefined, preparednessToLeadMixedClass: string | undefined, genderBiasImpact: string | undefined, interactionDifference: string | undefined, supportNeedRecognition: string | undefined, mainChallengeOption: string | undefined, identification: string | undefined, specialty: string | undefined, q: string | undefined, combineMode: string | undefined, user: RbacUser): Promise<{
        kpis: {
            totalResponses: any;
            totalRowsInDb: any;
            preparedPositiveCount: any;
            preparedPositiveRatePercent: number;
            interactionYesCount: any;
            interactionYesRatePercent: number;
            supportFrequentCount: any;
            supportFrequentRatePercent: number;
            lowPreparednessCount: any;
            lowPreparednessRatePercent: number;
        };
        filters: {
            technicalRigorPerception: string[];
            preparednessToLeadMixedClass: string[];
            genderBiasImpact: string[];
            interactionDifference: string[];
            supportNeedRecognition: string[];
            mainChallengeOptions: string[];
            identification: string[];
            specialty: string[];
        };
        charts: {
            technicalRigorDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            preparednessDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            genderBiasDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            interactionDifferenceDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            supportNeedDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            mainChallengeDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            preparednessTrendByDay: {
                options: string[];
                items: Record<string, string | number>[];
            };
        };
        textColumns: {
            interactionDifferenceComment: {
                total: number;
                displayed: number;
                items: {
                    id: string;
                    submittedAt: Date | null;
                    identification: string | null;
                    specialty: string | null;
                    text: string | null;
                }[];
            };
            specialtyFreeText: {
                totalUnique: number;
                totalResponses: number;
                displayed: number;
                items: {
                    text: string;
                    count: number;
                    percent: number;
                }[];
            };
        };
        insights: {
            topChallenge: {
                label: string;
                count: number;
                percent: number;
            } | null;
            mostFrequentSpecialty: {
                text: string;
                count: number;
                percent: number;
            } | null;
            preparednessAttentionPoint: {
                title: string;
                affectedCount: any;
                affectedRatePercent: number;
            };
        };
        latestImport: any;
        cardSettings: any;
    }>;
    listResponses(from: string | undefined, to: string | undefined, technicalRigorPerception: string | undefined, preparednessToLeadMixedClass: string | undefined, genderBiasImpact: string | undefined, interactionDifference: string | undefined, supportNeedRecognition: string | undefined, mainChallengeOption: string | undefined, identification: string | undefined, specialty: string | undefined, q: string | undefined, combineMode: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
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
            technicalRigorPerception: string | null;
            preparednessToLeadMixedClass: string | null;
            interactionDifference: string | null;
            supportNeedRecognition: string | null;
            mainChallengeOptions: string[];
            specialty: string | null;
        }[];
        importMode: string;
    }>;
    deleteResponses(body: {
        ids?: string[];
        allFiltered?: boolean;
        from?: string;
        to?: string;
        technicalRigorPerception?: string;
        preparednessToLeadMixedClass?: string;
        genderBiasImpact?: string;
        interactionDifference?: string;
        supportNeedRecognition?: string;
        mainChallengeOption?: string;
        identification?: string;
        specialty?: string;
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
