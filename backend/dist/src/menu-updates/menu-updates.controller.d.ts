import type { RbacUser } from '../rbac/rbac.types';
import { MenuUpdatesService } from './menu-updates.service';
export declare class MenuUpdatesController {
    private readonly menuUpdates;
    constructor(menuUpdates: MenuUpdatesService);
    list(menuKeys: string | string[] | undefined, user: RbacUser): Promise<{
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
    markSeen(menuKey: string, user: RbacUser): Promise<{
        ok: boolean;
        menuKey: string;
        seenAt: string;
    }>;
}
