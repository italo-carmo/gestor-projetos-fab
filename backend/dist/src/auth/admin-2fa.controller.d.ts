import { AuthService } from './auth.service';
export declare class Admin2faController {
    private readonly auth;
    constructor(auth: AuthService);
    resetTwoFactor(id: string): Promise<{
        ok: boolean;
    }>;
    twoFactorStatus(id: string): Promise<{
        totpEnabled: any;
    }>;
}
