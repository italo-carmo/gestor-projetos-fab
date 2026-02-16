import type { RbacUser } from '../rbac/rbac.types';
import { ElosService } from './elos.service';
import { CreateEloDto } from './dto/create-elo.dto';
import { UpdateEloDto } from './dto/update-elo.dto';
export declare class ElosController {
    private readonly elos;
    constructor(elos: ElosService);
    list(localityId: string | undefined, roleType: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
        executive_hide_pii: boolean;
    }>;
    create(dto: CreateEloDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateEloDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
export declare class OrgChartController {
    private readonly elos;
    constructor(elos: ElosService);
    orgChart(localityId: string | undefined, roleType: string | undefined, user: RbacUser): Promise<{
        items: {
            localityName: string;
            elos: any[];
        }[];
        executive_hide_pii: boolean;
    }>;
}
