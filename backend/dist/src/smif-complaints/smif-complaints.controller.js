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
const rbac_guard_1 = require("../rbac/rbac.guard");
const create_smif_complaint_dto_1 = require("./dto/create-smif-complaint.dto");
const list_smif_complaint_dto_1 = require("./dto/list-smif-complaint.dto");
const update_smif_complaint_dto_1 = require("./dto/update-smif-complaint.dto");
const smif_complaints_service_1 = require("./smif-complaints.service");
let SmifComplaintsController = class SmifComplaintsController {
    smifComplaints;
    constructor(smifComplaints) {
        this.smifComplaints = smifComplaints;
    }
    list(query, user) {
        return this.smifComplaints.list(query, user);
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
};
exports.SmifComplaintsController = SmifComplaintsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_smif_complaint_dto_1.ListSmifComplaintDto, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_smif_complaint_dto_1.CreateSmifComplaintDto, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_smif_complaint_dto_1.UpdateSmifComplaintDto, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SmifComplaintsController.prototype, "remove", null);
exports.SmifComplaintsController = SmifComplaintsController = __decorate([
    (0, common_1.Controller)('smif-complaints'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [smif_complaints_service_1.SmifComplaintsService])
], SmifComplaintsController);
//# sourceMappingURL=smif-complaints.controller.js.map