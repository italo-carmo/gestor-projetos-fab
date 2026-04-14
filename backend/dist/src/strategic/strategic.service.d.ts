import { PrismaService } from '../prisma/prisma.service';
import { LitellmService } from '../llm/litellm.service';
type AiAnalysisType = 'executive' | 'situational' | 'aggressor' | 'text' | 'geo';
export type AiSourceReference = {
    id: string;
    label: string;
    href: string;
    description?: string;
};
export declare class StrategicService {
    private readonly prisma;
    private readonly litellm;
    constructor(prisma: PrismaService, litellm: LitellmService);
    situationalDashboard(): Promise<{
        generatedAt: string;
        surveys: {
            totalResponses: any;
            yesCount: any;
            noCount: number;
            violenceRatePercent: number;
        };
        domesticViolence: {
            totalResponses: number;
            lifetimeRatePercent: number;
            last12MonthsRatePercent: number;
            soughtHelpPercent: number;
            lifetimeYes?: undefined;
            last12MonthsYes?: undefined;
            soughtHelp?: undefined;
        } | {
            totalResponses: any;
            lifetimeYes: any;
            lifetimeRatePercent: number;
            last12MonthsYes: any;
            last12MonthsRatePercent: number;
            soughtHelp: any;
            soughtHelpPercent: number;
        };
        recruits: {
            totalResponses: number;
            safeToReportPercent: number;
            knowReportProcessPercent: number;
            safeCount?: undefined;
            knowProcess?: undefined;
        } | {
            totalResponses: any;
            safeCount: any;
            safeToReportPercent: number;
            knowProcess: any;
            knowReportProcessPercent: number;
        };
        complaints: {
            totalCases: any;
            openCases: any;
            concludedCases: number;
            byCpca: any;
            bySmif: any;
            moral: any;
            sexual: any;
            moralPercent: number;
            sexualPercent: number;
        };
        activities: {
            totalActivities: number;
            done: number;
            smif: number;
            cipavd: number;
            withReport: any;
            signed: any;
        };
        missions: {
            totalMissions: any;
            smif: any;
            cipavd: any;
            localitiesCovered: any;
        };
        localityCount: number;
    }>;
    geoMap(): Promise<{
        generatedAt: string;
        states: {
            uf: string;
            complaints: number;
            activities: number;
            missions: number;
            localities: string[];
            complaintDetails: {
                caseNumber: string;
                type: string;
                status: string;
                date: string;
                locality: string;
                scope: string;
            }[];
            activityDetails: {
                title: string;
                scope: string;
                status: string;
                date: string;
                locality: string;
            }[];
            missionDetails: {
                title: string;
                scope: string;
                startDate: string;
                endDate: string;
                locality: string;
            }[];
        }[];
        totalLocalitiesWithUf: number;
        totalLocalities: number;
    }>;
    aggressorProfile(): Promise<{
        totalCases: number;
        message: string;
        generatedAt?: undefined;
        byComplaintType?: undefined;
        hierarchicalRelation?: undefined;
        aggressorProfile?: undefined;
        victimProfile?: undefined;
        context?: undefined;
        crossTabulation?: undefined;
        byScope?: undefined;
        byLocality?: undefined;
    } | {
        generatedAt: string;
        totalCases: any;
        byComplaintType: {
            moral: {
                count: any;
                percent: number;
            };
            sexual: {
                count: any;
                percent: number;
            };
        };
        hierarchicalRelation: {
            count: any;
            percent: number;
            description: string;
        };
        aggressorProfile: {
            byRank: {
                label: string;
                count: number;
                percent: number;
            }[];
            byGender: {
                label: string;
                count: number;
                percent: number;
            }[];
            byAgeRange: {
                label: string;
                count: number;
                percent: number;
            }[];
        };
        victimProfile: {
            byRank: {
                label: string;
                count: number;
                percent: number;
            }[];
            byGender: {
                label: string;
                count: number;
                percent: number;
            }[];
            byAgeRange: {
                label: string;
                count: number;
                percent: number;
            }[];
        };
        context: {
            byViolenceType: {
                label: string;
                count: number;
                percent: number;
            }[];
            byHarassmentContext: {
                label: string;
                count: number;
                percent: number;
            }[];
            byLocation: {
                label: string;
                count: number;
                percent: number;
            }[];
            byFrequency: {
                label: string;
                count: number;
                percent: number;
            }[];
            byForm: {
                label: string;
                count: number;
                percent: number;
            }[];
        };
        crossTabulation: {
            complaintType: string;
            aggressorGender: string;
            victimGender: string;
            count: number;
        }[];
        byScope: {
            label: string;
            count: number;
            percent: number;
        }[];
        byLocality: {
            localityCode: any;
            localityName: any;
            label: string;
            count: number;
            percent: number;
        }[];
        message?: undefined;
    }>;
    textAnalysis(): Promise<{
        generatedAt: string;
        sources: {
            recruitsSuggestions: {
                count: number;
                topWords: {
                    word: string;
                    count: number;
                }[];
                rawTexts: string[];
            };
            reportObservations: {
                count: number;
                topWords: {
                    word: string;
                    count: number;
                }[];
                rawTexts: string[];
            };
            reportAttentionPoints: {
                count: number;
                topWords: {
                    word: string;
                    count: number;
                }[];
                rawTexts: string[];
            };
            reportConclusions: {
                count: number;
                topWords: {
                    word: string;
                    count: number;
                }[];
                rawTexts: string[];
            };
            bestPracticeComments: {
                count: number;
                topWords: {
                    word: string;
                    count: number;
                }[];
                rawTexts: string[];
            };
            cpcaComments: {
                count: number;
                topWords: {
                    word: string;
                    count: number;
                }[];
                rawTexts: string[];
            };
        };
        consolidated: {
            totalTexts: number;
            topWords: {
                word: string;
                count: number;
            }[];
            rawTexts: any[];
        };
    }>;
    aiSourceReferences(type: AiAnalysisType): Promise<AiSourceReference[]>;
    strategicAiNarrative(): Promise<{
        generatedAt: string;
        narrative: string;
        model: string;
    }>;
    executiveReportPdf(): Promise<Buffer>;
    private getSurveyKpis;
    private getDomesticViolenceKpis;
    private getRecruitsKpis;
    private getComplaintsKpis;
    private getActivitiesKpis;
    private getMissionsKpis;
}
export {};
