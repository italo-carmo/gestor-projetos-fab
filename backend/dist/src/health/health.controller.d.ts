import { PrismaService } from '../prisma/prisma.service';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    health(): Promise<{
        status: string;
        db: {
            ok: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: string;
        };
        storage: {
            ok: boolean;
            error?: undefined;
        } | {
            ok: boolean;
            error: string;
        };
        timestamp: string;
    }>;
    private checkDb;
    private checkStorage;
}
