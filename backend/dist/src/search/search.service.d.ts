import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
export declare class SearchService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    query(q: string, user?: RbacUser): Promise<{
        tasks: {
            id: string;
            title: string;
            localityId: string;
            localityName: string;
            dueDate: Date;
            status: import("@prisma/client").$Enums.TaskStatus;
        }[];
        notices: {
            id: string;
            title: string;
            priority: import("@prisma/client").$Enums.NoticePriority;
            dueDate: Date | null;
        }[];
        meetings: {
            id: string;
            datetime: Date;
            status: import("@prisma/client").$Enums.MeetingStatus;
            scope: string;
            localityId: string | null;
        }[];
        localities: {
            id: string;
            code: string;
            name: string;
        }[];
    }>;
}
