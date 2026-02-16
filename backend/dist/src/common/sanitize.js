"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeText = sanitizeText;
function sanitizeText(input) {
    if (!input)
        return '';
    return input
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
//# sourceMappingURL=sanitize.js.map