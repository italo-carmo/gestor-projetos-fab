import type { RbacUser } from '../rbac/rbac.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityRecruitDesignationsDto } from './dto/update-locality-recruit-designations.dto';
import { ReplaceLocalityRecruitsMembersDto } from './dto/replace-locality-recruits-members.dto';
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
    listOmsCatalog(): Promise<{
        items: {
            id: string;
            name: string;
            code: string;
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
        recruitsFemaleCountCurrent: number | null;
    } | {
        id: string;
        recruitsFemaleCountCurrent: number;
    }>;
    listRecruitDesignations(id: string, user: RbacUser): Promise<{
        localityId: string;
        totalRecruits: number;
        totalAssigned: number;
        remaining: number;
        items: {
            id: string;
            destinationLocalityId: string;
            destinationLocalityName: string;
            destinationLocalityCode: string;
            assignedCount: number;
        }[];
    }>;
    listRecruitMembers(id: string, user: RbacUser): Promise<{
        localityId: string;
        recruitsFemaleCountCurrent: number;
        items: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.RecruitFemaleStatus;
            dismissalReason: string | null;
            dismissedAt: string | null;
            destinationLocalityId: string | null;
            destinationLocalityName: string | null;
            destinationLocalityCode: string | null;
            designatedAt: string | null;
        }[];
    }>;
    replaceRecruitMembers(id: string, dto: ReplaceLocalityRecruitsMembersDto, user: RbacUser): Promise<{
        localityId: string;
        recruitsFemaleCountCurrent: number;
        items: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.RecruitFemaleStatus;
            dismissalReason: string | null;
            dismissedAt: string | null;
            destinationLocalityId: string | null;
            destinationLocalityName: string | null;
            destinationLocalityCode: string | null;
            designatedAt: string | null;
        }[];
    }>;
    replaceRecruitDesignations(id: string, dto: UpdateLocalityRecruitDesignationsDto, user: RbacUser): Promise<{
        localityId: string;
        totalRecruits: number;
        totalAssigned: number;
        remaining: number;
        items: {
            id: string;
            destinationLocalityId: string;
            destinationLocalityName: string;
            destinationLocalityCode: string;
            assignedCount: number;
        }[];
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    private assertLocalityAccess;
    private assertRecruitsMutationAccess;
    private assertRecruitsEditorAccess;
    private assertRecruitAssignmentsWithinTotal;
    private buildRecruitDesignationsResponse;
    private buildRecruitMembersResponse;
    private createInitialRecruits;
    private syncLocalityRecruitCount;
    private registerRecruitsHistory;
}
