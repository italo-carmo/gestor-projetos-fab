import type { RbacUser } from '../rbac/rbac.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityRecruitsDto } from './dto/update-locality-recruits.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
export declare class LocalitiesController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(user: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            commandName: string | null;
            commanderName: string | null;
            individualMeetingDate: Date | null;
            visitDate: Date | null;
            recruitsFemaleCountCurrent: number | null;
            notes: string | null;
        }[];
    }>;
    create(dto: CreateLocalityDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        commandName: string | null;
        commanderName: string | null;
        individualMeetingDate: Date | null;
        visitDate: Date | null;
        recruitsFemaleCountCurrent: number | null;
        notes: string | null;
    }>;
    update(id: string, dto: UpdateLocalityDto, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        commandName: string | null;
        commanderName: string | null;
        individualMeetingDate: Date | null;
        visitDate: Date | null;
        recruitsFemaleCountCurrent: number | null;
        notes: string | null;
    }>;
    updateRecruits(id: string, dto: UpdateLocalityRecruitsDto, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        commandName: string | null;
        commanderName: string | null;
        individualMeetingDate: Date | null;
        visitDate: Date | null;
        recruitsFemaleCountCurrent: number | null;
        notes: string | null;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    private assertLocalityAccess;
    private assertRecruitsMutationAccess;
}
