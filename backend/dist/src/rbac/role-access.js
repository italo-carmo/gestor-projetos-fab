"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_ADMINISTRACAO_LOCAL = exports.ROLE_ADMIN_LOCALIDADE = exports.ROLE_ADMIN_ESPECIALIDADE_NACIONAL = exports.ROLE_ADMIN_ESPECIALIDADE_LOCAL = exports.ROLE_GSD_LOCALIDADE = exports.ROLE_TI = exports.ROLE_COMANDANTE_COMGEP = exports.ROLE_COORDENACAO_CIPAVD = void 0;
exports.hasRole = hasRole;
exports.hasAnyRole = hasAnyRole;
exports.isNationalCommissionMember = isNationalCommissionMember;
exports.isTiUser = isTiUser;
exports.isLocalityAdmin = isLocalityAdmin;
exports.isSpecialtyAdmin = isSpecialtyAdmin;
exports.isNationalSpecialtyAdmin = isNationalSpecialtyAdmin;
exports.isLocalSpecialtyAdmin = isLocalSpecialtyAdmin;
exports.resolveAccessProfile = resolveAccessProfile;
exports.canEditRecruitsByRole = canEditRecruitsByRole;
exports.ROLE_COORDENACAO_CIPAVD = 'Coordenação CIPAVD';
exports.ROLE_COMANDANTE_COMGEP = 'Comandante COMGEP';
exports.ROLE_TI = 'TI';
exports.ROLE_GSD_LOCALIDADE = 'GSD Localidade';
exports.ROLE_ADMIN_ESPECIALIDADE_LOCAL = 'Admin Especialidade Local';
exports.ROLE_ADMIN_ESPECIALIDADE_NACIONAL = 'Admin Especialidade Nacional';
exports.ROLE_ADMIN_LOCALIDADE = 'Admin Localidade';
exports.ROLE_ADMINISTRACAO_LOCAL = 'Administração Local';
function hasRole(user, roleName) {
    if (!user)
        return false;
    return user.roles.some((role) => role.name === roleName);
}
function hasAnyRole(user, roleNames) {
    if (!user || roleNames.length === 0)
        return false;
    return user.roles.some((role) => roleNames.includes(role.name));
}
function isNationalCommissionMember(user) {
    return hasAnyRole(user, [
        exports.ROLE_COORDENACAO_CIPAVD,
        exports.ROLE_COMANDANTE_COMGEP,
    ]);
}
function isTiUser(user) {
    return hasRole(user, exports.ROLE_TI);
}
function isLocalityAdmin(user) {
    return hasAnyRole(user, [
        exports.ROLE_GSD_LOCALIDADE,
        exports.ROLE_ADMIN_LOCALIDADE,
        exports.ROLE_ADMINISTRACAO_LOCAL,
    ]);
}
function isSpecialtyAdmin(user) {
    if (!user)
        return false;
    if (hasAnyRole(user, [exports.ROLE_ADMIN_ESPECIALIDADE_LOCAL, exports.ROLE_ADMIN_ESPECIALIDADE_NACIONAL])) {
        return true;
    }
    return user.roles.some((role) => role.name.toLowerCase().includes('admin especialidade'));
}
function isNationalSpecialtyAdmin(user) {
    return isSpecialtyAdmin(user) && !user?.localityId;
}
function isLocalSpecialtyAdmin(user) {
    return isSpecialtyAdmin(user) && Boolean(user?.localityId);
}
function resolveAccessProfile(user) {
    const ti = isTiUser(user);
    const nationalCommission = isNationalCommissionMember(user);
    const localityAdmin = isLocalityAdmin(user);
    const specialtyAdmin = isSpecialtyAdmin(user);
    const nationalSpecialtyAdmin = isNationalSpecialtyAdmin(user);
    const localSpecialtyAdmin = isLocalSpecialtyAdmin(user);
    return {
        ti,
        nationalCommission,
        localityAdmin,
        specialtyAdmin,
        nationalSpecialtyAdmin,
        localSpecialtyAdmin,
        groupSpecialtyId: user?.specialtyId ?? undefined,
        groupEloRoleId: user?.eloRoleId ?? undefined,
        localityId: user?.localityId ?? undefined,
        isAdminLike: ti ||
            nationalCommission ||
            localityAdmin ||
            specialtyAdmin,
    };
}
function canEditRecruitsByRole(user, targetLocalityId) {
    if (!user)
        return false;
    if (hasRole(user, exports.ROLE_TI))
        return true;
    if (isNationalCommissionMember(user))
        return true;
    if (hasRole(user, exports.ROLE_GSD_LOCALIDADE) && user.localityId === targetLocalityId) {
        return true;
    }
    return false;
}
//# sourceMappingURL=role-access.js.map