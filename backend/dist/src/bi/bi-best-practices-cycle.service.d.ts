import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
type BestPracticeCycleFilters = {
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
};
type ImportBestPracticeCycleOptions = {
    replaceAll?: boolean;
};
type BestPracticeCardSettingInput = {
    title?: string;
    description?: string | null;
};
export declare class BiBestPracticesCycleService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    importResponses(file: Express.Multer.File, user?: RbacUser, options?: ImportBestPracticeCycleOptions): Promise<{
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
    listImports(filters: {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    listResponses(filters: BestPracticeCycleFilters & {
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    deleteResponses(payload: BestPracticeCycleFilters & {
        ids?: string[];
        allFiltered?: boolean;
    }): Promise<{
        mode: string;
        deletedCount: number;
    }>;
    listCardSettings(): Promise<{
        items: any;
    }>;
    updateCardSetting(cardIdRaw: string, payload: BestPracticeCardSettingInput, user?: RbacUser): Promise<any>;
    dashboard(filters: BestPracticeCycleFilters): Promise<{
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
    private buildAvailableFilters;
    private buildDistribution;
    private buildMultiOptionDistribution;
    private buildPreparednessTrendByDay;
    private buildFreeTextRows;
    private buildSpecialtyList;
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
    private normalizeLikert;
    private normalizeYesNo;
    private normalizeFrequency;
    private normalizeMainChallengeOptions;
    private normalizeChoice;
    private cleanCategory;
    private cleanFreeText;
    private sortLikert;
    private sortYesNo;
    private sortFrequency;
    private isLikertPositive;
    private isSupportFrequent;
    private fileExtension;
    private normalizeForMatch;
    private compact;
    private isNotApplicable;
    private toTitleCaseWithAccents;
    private cleanCell;
    private getCell;
    private makeId;
}
export {};
