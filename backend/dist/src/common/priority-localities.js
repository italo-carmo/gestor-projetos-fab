"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_LOCALITY_NAME_KEYS = void 0;
exports.normalizeLocalityName = normalizeLocalityName;
exports.getTargetLocalityKey = getTargetLocalityKey;
exports.isTargetLocalityName = isTargetLocalityName;
exports.groupTargetLocalities = groupTargetLocalities;
exports.selectTargetLocalities = selectTargetLocalities;
exports.createTargetLocalityAliasMap = createTargetLocalityAliasMap;
exports.TARGET_LOCALITY_NAME_KEYS = new Set([
    'brasilia',
    'canoas',
    'guaratingueta',
    'lagoa santa',
    'manaus',
    'pirassununga',
    'rio de janeiro',
    'sao paulo',
]);
function normalizeLocalityName(name) {
    return String(name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
function getTargetLocalityKey(name) {
    const normalized = normalizeLocalityName(name);
    if (!normalized)
        return null;
    for (const key of exports.TARGET_LOCALITY_NAME_KEYS) {
        if (normalized === key ||
            normalized.startsWith(`${key} `) ||
            normalized.endsWith(` ${key}`) ||
            normalized.includes(` ${key} `)) {
            return key;
        }
    }
    return null;
}
function isTargetLocalityName(name) {
    return Boolean(getTargetLocalityKey(name));
}
function parseTimestamp(value) {
    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : 0;
    }
    if (typeof value === 'string' && value.trim()) {
        const time = new Date(value).getTime();
        return Number.isFinite(time) ? time : 0;
    }
    return 0;
}
function toRecruitsScore(value) {
    if (value === null || value === undefined)
        return -1;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : -1;
}
function compareCandidates(next, current) {
    const recruitsDiff = toRecruitsScore(next.recruitsFemaleCountCurrent) -
        toRecruitsScore(current.recruitsFemaleCountCurrent);
    if (recruitsDiff !== 0)
        return recruitsDiff;
    const updatedDiff = parseTimestamp(next.updatedAt) - parseTimestamp(current.updatedAt);
    if (updatedDiff !== 0)
        return updatedDiff;
    return 0;
}
function groupTargetLocalities(localities) {
    const grouped = new Map();
    for (const locality of localities) {
        const key = getTargetLocalityKey(locality?.name);
        if (!key)
            continue;
        const existing = grouped.get(key);
        if (!existing) {
            grouped.set(key, { key, canonical: locality, members: [locality] });
            continue;
        }
        existing.members.push(locality);
        if (compareCandidates(locality, existing.canonical) > 0) {
            existing.canonical = locality;
        }
    }
    return Array.from(grouped.values());
}
function selectTargetLocalities(localities) {
    return groupTargetLocalities(localities).map((group) => group.canonical);
}
function createTargetLocalityAliasMap(groups) {
    const aliasByLocalityId = new Map();
    const aliasIdsByCanonicalId = new Map();
    for (const group of groups) {
        const canonicalId = String(group.canonical.id ?? '');
        if (!canonicalId)
            continue;
        const aliasIds = [];
        for (const member of group.members) {
            const aliasId = String(member.id ?? '');
            if (!aliasId)
                continue;
            aliasIds.push(aliasId);
            aliasByLocalityId.set(aliasId, canonicalId);
        }
        aliasIdsByCanonicalId.set(canonicalId, aliasIds);
    }
    return { aliasByLocalityId, aliasIdsByCanonicalId };
}
//# sourceMappingURL=priority-localities.js.map