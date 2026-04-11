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
exports.SmifComplaintsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const add_cpca_case_comment_dto_1 = require("../cpca/dto/add-cpca-case-comment.dto");
const create_cpca_case_dto_1 = require("../cpca/dto/create-cpca-case.dto");
const update_cpca_case_dto_1 = require("../cpca/dto/update-cpca-case.dto");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const smif_complaints_service_1 = require("./smif-complaints.service");
let SmifComplaintsController = class SmifComplaintsController {
    smifComplaints;
    constructor(smifComplaints) {
        this.smifComplaints = smifComplaints;
    }
    list(omId, localityId, status, complaintType, detailedViolenceType, procedureType, q, page, pageSize, user) {
        return this.smifComplaints.list({
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
    getById(id, user) {
        return this.smifComplaints.getById(id, user);
    }
    create(dto, user) {
        return this.smifComplaints.create(dto, user);
    }
    update(id, dto, user) {
        return this.smifComplaints.update(id, dto, user);
    }
    remove(id, user) {
        return this.smifComplaints.remove(id, user);
    }
    comments(id, user) {
        return this.smifComplaints.listComments(id, user);
    }
    addComment(id, dto, user) {
        return this.smifComplaints.addComment(id, dto, user);
    }
};
exports.SmifComplaintsController = SmifComplaintsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'view'),
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
], SmifComplaintsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_cpca_case_dto_1.CreateCpcaCaseDto, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_cpca_case_dto_1.UpdateCpcaCaseDto, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "comments", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('smif_complaints', 'comment'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, add_cpca_case_comment_dto_1.AddCpcaCaseCommentDto, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "addComment", null);
exports.SmifComplaintsController = SmifComplaintsController = __decorate([
    (0, common_1.Controller)('smif-complaints'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [smif_complaints_service_1.SmifComplaintsService])
], SmifComplaintsController);
//# sourceMappingURL=smif-complaints.controller.js.map