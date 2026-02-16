import { PrismaService } from '../prisma/prisma.service';
import { CreateEloRoleDto } from './dto/create-elo-role.dto';
import { UpdateEloRoleDto } from './dto/update-elo-role.dto';
export declare class EloRolesController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            sortOrder: number;
        }[];
    }>;
    create(dto: CreateEloRoleDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        sortOrder: number;
    }>;
    update(id: string, dto: UpdateEloRoleDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        sortOrder: number;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
}
