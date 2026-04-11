import { AddCpcaCaseCommentDto } from '../cpca/dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseDto } from '../cpca/dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from '../cpca/dto/update-cpca-case.dto';
import type { RbacUser } from '../rbac/rbac.types';
import { SmifComplaintsService } from './smif-complaints.service';
export declare class SmifComplaintsController {
    private readonly smifComplaints;
    constructor(smifComplaints: SmifComplaintsService);
    list(omId: string | undefined, localityId: string | undefined, status: string | undefined, complaintType: string | undefined, detailedViolenceType: string | undefined, procedureType: string | undefined, q: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    getById(id: string, user: RbacUser): Promise<any>;
    create(dto: CreateCpcaCaseDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateCpcaCaseDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    comments(id: string, user: RbacUser): Promise<{
        items: any;
    }>;
    addComment(id: string, dto: AddCpcaCaseCommentDto, user: RbacUser): Promise<any>;
}
