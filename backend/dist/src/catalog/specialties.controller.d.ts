import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
export declare class SpecialtiesController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            color: string | null;
            icon: string | null;
        }[];
    }>;
    create(dto: CreateSpecialtyDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        color: string | null;
        icon: string | null;
    }>;
    update(id: string, dto: UpdateSpecialtyDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        color: string | null;
        icon: string | null;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
}
