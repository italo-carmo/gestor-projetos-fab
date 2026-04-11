import { CpcaService } from '../cpca/cpca.service';
import { AddCpcaCaseCommentDto } from '../cpca/dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseDto } from '../cpca/dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from '../cpca/dto/update-cpca-case.dto';
import type { RbacUser } from '../rbac/rbac.types';
export declare class SmifComplaintsService {
    private readonly cpca;
    constructor(cpca: CpcaService);
    list(filters: {
        localityId?: string;
        status?: string;
        complaintType?: string;
        detailedViolenceType?: string;
        procedureType?: string;
        q?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    getById(id: string, user?: RbacUser): Promise<any>;
    create(payload: CreateCpcaCaseDto, user?: RbacUser): Promise<any>;
    update(id: string, payload: UpdateCpcaCaseDto, user?: RbacUser): Promise<any>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    listComments(id: string, user?: RbacUser): Promise<{
        items: any;
    }>;
    addComment(id: string, payload: AddCpcaCaseCommentDto, user?: RbacUser): Promise<any>;
}
