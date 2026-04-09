import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class MenuUpdatesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(rawMenuKeys: string | string[] | undefined, user?: RbacUser): Promise<{
        items: Array<Record<string, unknown>>;
    } | {
        items: {
            menuKey: string;
            unreadCount: number;
            hasUnread: boolean;
            lastEventAt: string | null;
            seenAt: string | null;
        }[];
    }>;
    markSeen(menuKeyRaw: string, user?: RbacUser): Promise<{
        ok: boolean;
        menuKey: string;
        seenAt: string;
    }>;
    private toUnreadCount;
    private normalizeMenuKeys;
    private requireUserId;
}
