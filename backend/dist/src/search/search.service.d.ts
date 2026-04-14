import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { LitellmService } from '../llm/litellm.service';
type LegacySearchPayload = {
    tasks: Array<{
        id: string;
        title: string;
        localityId: string | null;
        localityName: string;
        dueDate: Date | null;
        status: string;
    }>;
    notices: Array<{
        id: string;
        title: string;
        priority: string;
        dueDate: Date | null;
    }>;
    meetings: Array<{
        id: string;
        datetime: Date;
        status: string;
        scope: string;
        localityId: string | null;
    }>;
    localities: Array<{
        id: string;
        code: string;
        name: string;
    }>;
    documents: Array<{
        id: string;
        title: string;
        category: string;
        localityId: string | null;
        localityName: string | null;
        fileName: string;
    }>;
};
type SemanticSearchItem = {
    id: string;
    entityType: 'TASK' | 'MEETING' | 'LOCALITY' | 'DOCUMENT';
    entityTypeLabel: string;
    title: string;
    subtitle: string | null;
    url: string;
    probability: number;
};
type SemanticSearchPayload = {
    usedAi: boolean;
    model: string | null;
    items: SemanticSearchItem[];
};
type SearchPayload = LegacySearchPayload & {
    semantic: SemanticSearchPayload;
};
export declare class SearchService {
    private readonly prisma;
    private readonly litellm;
    private readonly logger;
    private readonly maxItemsPerEntity;
    private readonly maxSemanticCandidates;
    private readonly maxSemanticResults;
    constructor(prisma: PrismaService, litellm: LitellmService);
    query(q: string, user?: RbacUser): Promise<SearchPayload>;
    private emptyPayload;
    private resolveSearchPermissions;
    private buildTaskWhere;
    private buildNoticeWhere;
    private buildMeetingWhere;
    private buildLocalityWhere;
    private buildDocumentWhere;
    private buildTaskViewAccessWhere;
    private isAdminUser;
    private shouldApplyDocumentLocalityScope;
    private documentScopeWhere;
    private resolveTaskTitle;
    private extractQueryTokens;
    private buildSemanticResults;
    private buildSemanticCandidates;
    private rankWithAi;
    private parseSemanticResponse;
    private parseJsonLoose;
    private fallbackProbability;
    private normalizeSearchText;
    private getScopeConstraints;
}
export {};
