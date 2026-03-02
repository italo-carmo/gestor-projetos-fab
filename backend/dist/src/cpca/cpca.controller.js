"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CpcaController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const role_access_1 = require("../rbac/role-access");
const add_cpca_case_comment_dto_1 = require("./dto/add-cpca-case-comment.dto");
const create_cpca_case_dto_1 = require("./dto/create-cpca-case.dto");
const update_cpca_case_dto_1 = require("./dto/update-cpca-case.dto");
const cpca_service_1 = require("./cpca.service");
let CpcaController = class CpcaController {
    cpca;
    constructor(cpca) {
        this.cpca = cpca;
    }
    list(omId, localityId, status, complaintType, detailedViolenceType, procedureType, q, page, pageSize, user) {
        this.assertProcessAccess(user);
        return this.cpca.list({
            localityId: omId ?? localityId,
            status,
            complaintType,
            detailedViolenceType,
            procedureType,
            q,
            page,
            pageSize,
        }, user);
    }
    stats(omId, localityId, from, to, user) {
        this.assertProcessAccess(user);
        return this.cpca.stats({ localityId: omId ?? localityId, from, to }, user);
    }
    getById(id, user) {
        this.assertProcessAccess(user);
        return this.cpca.getById(id, user);
    }
    create(dto, user) {
        this.assertProcessAccess(user);
        return this.cpca.create(dto, user);
    }
    update(id, dto, user) {
        this.assertProcessAccess(user);
        return this.cpca.update(id, dto, user);
    }
    comments(id, user) {
        this.assertProcessAccess(user);
        return this.cpca.listComments(id, user);
    }
    addComment(id, dto, user) {
        this.assertProcessAccess(user);
        return this.cpca.addComment(id, dto.text, user);
    }
    assertProcessAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [
            role_access_1.ROLE_CPCA,
            role_access_1.ROLE_COORDENACAO_CIPAVD,
            role_access_1.ROLE_COMANDANTE_COMGEP,
            role_access_1.ROLE_TI,
        ])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
};
exports.CpcaController = CpcaController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'view'),
    __param(0, (0, common_1.Query)('omId')),
    __param(1, (0, common_1.Query)('localityId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('complaintType')),
    __param(4, (0, common_1.Query)('detailedViolenceType')),
    __param(5, (0, common_1.Query)('procedureType')),
    __param(6, (0, common_1.Query)('q')),
    __param(7, (0, common_1.Query)('page')),
    __param(8, (0, common_1.Query)('pageSize')),
    __param(9, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'view'),
    __param(0, (0, common_1.Query)('omId')),
    __param(1, (0, common_1.Query)('localityId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_cpca_case_dto_1.CreateCpcaCaseDto, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_cpca_case_dto_1.UpdateCpcaCaseDto, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "comments", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('cpca_cases', 'comment'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, add_cpca_case_comment_dto_1.AddCpcaCaseCommentDto, Object]),
    __metadata("design:returntype", void 0)
], CpcaController.prototype, "addComment", null);
exports.CpcaController = CpcaController = __decorate([
    (0, common_1.Controller)('cpca-cases'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [cpca_service_1.CpcaService])
], CpcaController);
//# sourceMappingURL=cpca.controller.js.map