"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripOmSuffixFromLdapName = stripOmSuffixFromLdapName;
function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}
function stripOmSuffixFromLdapName(rawName, fabom) {
    const name = normalizeWhitespace(rawName ?? '');
    if (!name)
        return '';
    const om = normalizeWhitespace(fabom ?? '').toUpperCase();
    if (!om)
        return name;
    const upperName = name.toUpperCase();
    if (upperName === om)
        return '';
    if (upperName.endsWith(` (${om})`)) {
        return name.slice(0, name.length - (` (${om})`.length)).trim();
    }
    if (upperName.endsWith(` - ${om}`)) {
        return name.slice(0, name.length - (` - ${om}`.length)).trim();
    }
    if (upperName.endsWith(` / ${om}`)) {
        return name.slice(0, name.length - (` / ${om}`.length)).trim();
    }
    if (upperName.endsWith(` ${om}`)) {
        return name.slice(0, name.length - (` ${om}`.length)).trim();
    }
    return name;
}
//# sourceMappingURL=military-name.js.map