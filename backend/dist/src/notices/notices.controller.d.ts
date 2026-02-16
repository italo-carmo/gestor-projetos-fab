import type { RbacUser } from '../rbac/rbac.types';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { PinNoticeDto } from './dto/pin-notice.dto';
import { NoticesService } from './notices.service';
export declare class NoticesController {
    private readonly notices;
    constructor(notices: NoticesService);
    list(localityId: string | undefined, specialtyId: string | undefined, pinned: string | undefined, priority: string | undefined, dueFrom: string | undefined, dueTo: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: {
            isLate: boolean;
            id: string;
            title: string;
            specialtyId: string | null;
            createdAt: Date;
            updatedAt: Date;
            localityId: string | null;
            dueDate: Date | null;
            priority: import("@prisma/client").$Enums.NoticePriority;
            body: string;
            pinned: boolean;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(dto: CreateNoticeDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        specialtyId: string | null;
        createdAt: Date;
        updatedAt: Date;
        localityId: string | null;
        dueDate: Date | null;
        priority: import("@prisma/client").$Enums.NoticePriority;
        body: string;
        pinned: boolean;
    }>;
    update(id: string, dto: UpdateNoticeDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        specialtyId: string | null;
        createdAt: Date;
        updatedAt: Date;
        localityId: string | null;
        dueDate: Date | null;
        priority: import("@prisma/client").$Enums.NoticePriority;
        body: string;
        pinned: boolean;
    }>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    pin(id: string, dto: PinNoticeDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        specialtyId: string | null;
        createdAt: Date;
        updatedAt: Date;
        localityId: string | null;
        dueDate: Date | null;
        priority: import("@prisma/client").$Enums.NoticePriority;
        body: string;
        pinned: boolean;
    }>;
}
