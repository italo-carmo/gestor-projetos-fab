import type { Request } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';
export declare class BiDomesticViolenceController {
    private readonly biDomesticViolence;
    constructor(biDomesticViolence: BiDomesticViolenceService);
    private assertTiForSettings;
    dashboard(from: string | undefined, to: string | undefined, organization: string | undefined, rank: string | undefined, maritalStatus: string | undefined, education: string | undefined, naturality: string | undefined, fabBond: string | undefined, situationScope: string | undefined, sufferedLifetime: string | undefined, sufferedLast12Months: string | undefined, frequency: string | undefined, affectiveBond: string | undefined, violenceType: string | undefined, authorRelation: string | undefined, impactIntensity: string | undefined, impactArea: string | undefined, soughtHelp: string | undefined, complaintChannel: string | undefined, noComplaintReason: string | undefined, authorMilitaryLink: string | undefined, occurrencePlace: string | undefined, witnesses: string | undefined, q: string | undefined, combineMode: string | undefined, user: RbacUser): Promise<{
        kpis: {
            totalResponses: number;
            totalRowsInDb: number;
            lifetimeYesCount: number;
            lifetimeNoCount: number;
            lifetimeUnknownCount: number;
            last12MonthsYesCount: number;
            last12MonthsNoCount: number;
            last12MonthsUnknownCount: number;
            soughtHelpYesCount: number;
            soughtHelpRatePercent: number;
            recurringCount: number;
            recurringRatePercent: number;
            totalViolenceMentions: number;
            avgTypesPerVictim: number;
        };
        filters: {
            organization: string[];
            rank: string[];
            maritalStatus: string[];
            education: string[];
            naturality: string[];
            fabBond: string[];
            situationScope: string[];
            frequency: string[];
            affectiveBond: string[];
            violenceTypes: string[];
            authorRelation: string[];
            impactIntensity: string[];
            impactAreas: string[];
            complaintChannels: string[];
            noComplaintReasons: string[];
            authorMilitaryLink: string[];
            occurrencePlace: string[];
            sufferedLifetime: {
                value: string;
                label: string;
            }[];
            sufferedLast12Months: {
                value: string;
                label: string;
            }[];
            soughtHelp: {
                value: string;
                label: string;
            }[];
            witnesses: {
                value: string;
                label: string;
            }[];
        };
        charts: {
            lifetimeDonut: {
                label: string;
                count: number;
                percent: number;
            }[];
            last12MonthsDonut: {
                label: string;
                count: number;
                percent: number;
            }[];
            violenceTypeDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            organizationDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            rankDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            maritalStatusDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            educationDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            naturalityDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            fabBondDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            ageRangeDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            situationScopeDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            frequencyDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            affectiveBondDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            authorRelationDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            authorMilitaryLinkDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            occurrencePlaceDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            witnessesDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            soughtHelpDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            impactIntensityDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            impactAreaDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            complaintChannelDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            noComplaintReasonDistribution: {
                [x: string]: string | number;
                label: string;
                count: number;
                percent: number;
            }[];
            violenceByOrganization: {
                types: string[];
                items: Record<string, string | number>[];
            };
            responseTrend: {
                day: string;
                dayLabel: string;
                total: number;
                positiveCount: number;
                positiveRatePercent: number;
            }[];
        };
        insights: {
            topViolenceType: {
                type: string;
                mentions: number;
                sharePercent: number;
            } | null;
            highestOrganizationRisk: {
                organization: string;
                lifetimeRatePercent: number;
                total: number;
            } | null;
            mostImpactedArea: {
                area: string;
                mentions: number;
                sharePercent: number;
            } | null;
            mainNoReportReason: {
                reason: string;
                mentions: number;
                sharePercent: number;
            } | null;
            preferredChannel: {
                channel: string;
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
    listResponses(from: string | undefined, to: string | undefined, organization: string | undefined, rank: string | undefined, maritalStatus: string | undefined, education: string | undefined, naturality: string | undefined, fabBond: string | undefined, situationScope: string | undefined, sufferedLifetime: string | undefined, sufferedLast12Months: string | undefined, frequency: string | undefined, affectiveBond: string | undefined, violenceType: string | undefined, authorRelation: string | undefined, impactIntensity: string | undefined, impactArea: string | undefined, soughtHelp: string | undefined, complaintChannel: string | undefined, noComplaintReason: string | undefined, authorMilitaryLink: string | undefined, occurrencePlace: string | undefined, witnesses: string | undefined, q: string | undefined, combineMode: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            violenceTypes: string[];
            batchId: string | null;
            submittedAt: Date | null;
            rawPayload: import("@prisma/client/runtime/client").JsonValue | null;
            sourceRow: number | null;
            sourceHash: string;
            rank: string | null;
            age: number | null;
            organization: string | null;
            maritalStatus: string | null;
            education: string | null;
            naturality: string | null;
            fabBond: string | null;
            situationScope: string | null;
            sufferedLifetimeRaw: string | null;
            sufferedLifetime: boolean | null;
            sufferedLast12MonthsRaw: string | null;
            sufferedLast12Months: boolean | null;
            frequency: string | null;
            affectiveBond: string | null;
            authorRelation: string | null;
            authorMilitaryLink: string | null;
            occurrencePlace: string | null;
            witnessesRaw: string | null;
            witnesses: boolean | null;
            impactIntensity: string | null;
            impactAreas: string[];
            soughtHelpRaw: string | null;
            soughtHelp: boolean | null;
            complaintChannels: string[];
            noComplaintReasons: string[];
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
            age: number | null;
            organization: string | null;
            rank: string | null;
            naturality: string | null;
            situationScope: string | null;
            sufferedLifetimeRaw: string | null;
            sufferedLast12MonthsRaw: string | null;
            affectiveBond: string | null;
            violenceTypes: string[];
            authorRelation: string | null;
            impactIntensity: string | null;
            soughtHelpRaw: string | null;
        }[];
        importMode: string;
    }>;
    deleteResponses(body: {
        ids?: string[];
        allFiltered?: boolean;
        from?: string;
        to?: string;
        organization?: string;
        rank?: string;
        maritalStatus?: string;
        education?: string;
        naturality?: string;
        fabBond?: string;
        situationScope?: string;
        sufferedLifetime?: string;
        sufferedLast12Months?: string;
        frequency?: string;
        affectiveBond?: string;
        violenceType?: string;
        authorRelation?: string;
        impactIntensity?: string;
        impactArea?: string;
        soughtHelp?: string;
        complaintChannel?: string;
        noComplaintReason?: string;
        authorMilitaryLink?: string;
        occurrencePlace?: string;
        witnesses?: string;
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
