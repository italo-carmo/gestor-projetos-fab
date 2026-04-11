import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto): Promise<{
        requiresTwoFactor: boolean;
        twoFactorToken: string;
        requiresTwoFactorSetup?: undefined;
        setupToken?: undefined;
        qrCodeDataUrl?: undefined;
        manualEntryKey?: undefined;
        totpUri?: undefined;
    } | {
        requiresTwoFactorSetup: boolean;
        setupToken: string;
        qrCodeDataUrl: string;
        manualEntryKey: string;
        totpUri: string;
        requiresTwoFactor?: undefined;
        twoFactorToken?: undefined;
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
        localityId: string | null;
        executive_hide_pii: boolean;
        elo_role_id: string | null;
        roles: {
            id: string;
            name: string;
        }[];
        activeRoleId: string;
        activeRole: {
            id: string;
            name: string;
        } | null;
        permissions: {
            resource: string;
            action: string;
            scope: import("@prisma/client").PermissionScope;
        }[];
        scopes: never[];
        flags: {
            executive_hide_pii: boolean;
        };
    }>;
    meFabProfile(req: Request & {
        user?: {
            userId: string;
        };
    }): Promise<{
        uid: string | null;
        fabom: string | null;
        numeroOrdem: string | null;
    }>;
    getSigpesPhoto(numeroOrdem: string): Promise<{
        numeroOrdem: string;
        mimeType: null;
        fileName: string | null;
        base64: null;
        dataUrl: null;
    } | {
        numeroOrdem: string;
        mimeType: string;
        fileName: string | null;
        base64: string;
        dataUrl: string;
    }>;
    confirmTwoFactorSetup(setupToken: string, code: string): Promise<{
        backupCodes: string[];
        accessToken: string;
        refreshToken: string;
    }>;
    verifyTwoFactor(twoFactorToken: string, code: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    twoFactorStatus(req: Request & {
        user?: {
            userId: string;
        };
    }): Promise<{
        totpEnabled: any;
    }>;
}
