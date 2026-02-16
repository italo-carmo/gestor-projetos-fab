"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwError = throwError;
const common_1 = require("@nestjs/common");
const error_codes_1 = require("./error-codes");
function throwError(code, details) {
    const entry = (0, error_codes_1.getErrorCode)(code);
    const payload = {
        message: entry.message,
        code,
        details: details ?? entry.details ?? undefined,
    };
    throw new common_1.HttpException(payload, entry.httpStatus);
}
//# sourceMappingURL=http-error.js.map