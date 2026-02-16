"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorCatalog = getErrorCatalog;
exports.getErrorCode = getErrorCode;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
let cache = null;
function getErrorCatalog() {
    if (cache)
        return cache;
    const catalogPath = node_path_1.default.resolve(process.cwd(), '..', 'ERROR_CODES.json');
    const raw = node_fs_1.default.readFileSync(catalogPath, 'utf-8');
    cache = JSON.parse(raw);
    return cache;
}
function getErrorCode(code) {
    const catalog = getErrorCatalog();
    const entry = catalog[code];
    if (!entry) {
        return { httpStatus: 500, message: 'Erro interno.' };
    }
    return entry;
}
//# sourceMappingURL=error-codes.js.map