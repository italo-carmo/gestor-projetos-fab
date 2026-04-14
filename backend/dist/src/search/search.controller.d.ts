import type { RbacUser } from '../rbac/rbac.types';
import { SearchService } from './search.service';
export declare class SearchController {
    private readonly search;
    constructor(search: SearchService);
    query(q: string, user: RbacUser): Promise<{
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
    } & {
        semantic: {
            usedAi: boolean;
            model: string | null;
            items: {
                id: string;
                entityType: "TASK" | "MEETING" | "LOCALITY" | "DOCUMENT";
                entityTypeLabel: string;
                title: string;
                subtitle: string | null;
                url: string;
                probability: number;
            }[];
        };
    }>;
}
