import type { RbacUser } from '../rbac/rbac.types';
import { BestPracticesService } from './best-practices.service';
import { CreateBestPracticeDto } from './dto/create-best-practice.dto';
import { ListBestPracticeDto } from './dto/list-best-practice.dto';
import { UpdateBestPracticeDto } from './dto/update-best-practice.dto';
export declare class BestPracticesController {
    private readonly bestPractices;
    constructor(bestPractices: BestPracticesService);
    list(query: ListBestPracticeDto, user: RbacUser): Promise<{
        items: any;
    }>;
    create(dto: CreateBestPracticeDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateBestPracticeDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
