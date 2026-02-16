"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_METADATA_KEY = void 0;
exports.RequirePermission = RequirePermission;
const common_1 = require("@nestjs/common");
exports.PERMISSION_METADATA_KEY = 'rbac:permission';
function RequirePermission(resource, action, scope) {
    const requirement = { resource, action, scope };
    return (0, common_1.SetMetadata)(exports.PERMISSION_METADATA_KEY, requirement);
}
//# sourceMappingURL=require-permission.decorator.js.map