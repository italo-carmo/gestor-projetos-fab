"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeForExecutive = sanitizeForExecutive;
const PII_KEYS = new Set([
    'name',
    'email',
    'phone',
    'contact',
    'contato',
    'commanderName',
]);
function sanitizeForExecutive(payload) {
    if (payload === null || payload === undefined)
        return payload;
    if (Array.isArray(payload)) {
        return payload.map((item) => sanitizeForExecutive(item));
    }
    if (typeof payload === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(payload)) {
            if (PII_KEYS.has(key))
                continue;
            result[key] = sanitizeForExecutive(value);
        }
        return result;
    }
    return payload;
}
//# sourceMappingURL=executive.js.map