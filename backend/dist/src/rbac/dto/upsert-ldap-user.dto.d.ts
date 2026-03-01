export declare class UpsertLdapUserDto {
    uid: string;
    roleId?: string;
    roleIds?: string[];
    replaceExistingRoles?: boolean;
    localityId?: string | null;
    specialtyId?: string | null;
    eloRoleId?: string | null;
}
