import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: {
                id: string;
                name: string;
            } | undefined;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    me(req: Request & {
        user?: {
            userId: string;
        };
    }): Promise<{
        id: string;
        email: string;
        name: string;
        executive_hide_pii: boolean;
        elo_role_id: any;
        permissions: {
            resource: string;
            action: string;
            scope: import("@prisma/client").$Enums.PermissionScope;
        }[];
        scopes: never[];
        flags: {
            executive_hide_pii: boolean;
        };
    }>;
}
