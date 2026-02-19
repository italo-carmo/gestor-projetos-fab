import { ConfigService } from '@nestjs/config';
export type FabLdapProfile = {
    uid: string;
    dn: string;
    name: string | null;
    email: string | null;
    fabom: string | null;
};
export declare class FabLdapService {
    private readonly config;
    constructor(config: ConfigService);
    authenticate(uid: string, password: string): Promise<FabLdapProfile>;
    lookupByUid(uid: string): Promise<FabLdapProfile | null>;
    private createClient;
    private bindForLookup;
    private searchByUid;
    private mapEntry;
    private readAttribute;
    private normalizeUid;
    private buildUserDn;
    private getLdapUrl;
    private getBaseDn;
    private escapeFilterValue;
    private handleLdapError;
    private isConnectivityError;
    private stringifyError;
}
