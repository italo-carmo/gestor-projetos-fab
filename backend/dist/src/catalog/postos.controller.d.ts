import { PrismaService } from '../prisma/prisma.service';
import { CreatePostoDto } from './dto/create-posto.dto';
import { UpdatePostoDto } from './dto/update-posto.dto';
export declare class PostosController {
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
    create(dto: CreatePostoDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        sortOrder: number;
    }>;
    update(id: string, dto: UpdatePostoDto): Promise<{
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
