import type { RbacUser } from '../rbac/rbac.types';
import { CreateSmifComplaintDto } from './dto/create-smif-complaint.dto';
import { ListSmifComplaintDto } from './dto/list-smif-complaint.dto';
import { UpdateSmifComplaintDto } from './dto/update-smif-complaint.dto';
import { SmifComplaintsService } from './smif-complaints.service';
export declare class SmifComplaintsController {
    private readonly smifComplaints;
    constructor(smifComplaints: SmifComplaintsService);
    list(query: ListSmifComplaintDto, user: RbacUser): Promise<{
        items: ({
            locality: {
                id: string;
                name: string;
                code: string;
            };
            createdBy: {
                id: string;
                name: string;
            };
            updatedBy: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            localityId: string;
            status: import("@prisma/client").$Enums.SmifComplaintStatus;
            createdById: string;
            conclusion: string | null;
            reportedAt: Date;
            updatedById: string | null;
        })[];
    }>;
    create(dto: CreateSmifComplaintDto, user: RbacUser): Promise<{
        locality: {
            id: string;
            name: string;
            code: string;
        };
        createdBy: {
            id: string;
            name: string;
        };
        updatedBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        localityId: string;
        status: import("@prisma/client").$Enums.SmifComplaintStatus;
        createdById: string;
        conclusion: string | null;
        reportedAt: Date;
        updatedById: string | null;
    }>;
    update(id: string, dto: UpdateSmifComplaintDto, user: RbacUser): Promise<{
        locality: {
            id: string;
            name: string;
            code: string;
        };
        createdBy: {
            id: string;
            name: string;
        };
        updatedBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        localityId: string;
        status: import("@prisma/client").$Enums.SmifComplaintStatus;
        createdById: string;
        conclusion: string | null;
        reportedAt: Date;
        updatedById: string | null;
    }>;
}
