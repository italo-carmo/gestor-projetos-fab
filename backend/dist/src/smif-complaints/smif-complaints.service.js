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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmifComplaintsService = void 0;
const common_1 = require("@nestjs/common");
const cpca_service_1 = require("../cpca/cpca.service");
let SmifComplaintsService = class SmifComplaintsService {
    cpca;
    constructor(cpca) {
        this.cpca = cpca;
    }
    async list(filters, user) {
        return this.cpca.list(filters, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
    async getById(id, user) {
        return this.cpca.getById(id, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
    async create(payload, user) {
        return this.cpca.create(payload, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
    async update(id, payload, user) {
        return this.cpca.update(id, payload, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
    async remove(id, user) {
        return this.cpca.remove(id, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
    async listComments(id, user) {
        return this.cpca.listComments(id, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
    async addComment(id, payload, user) {
        return this.cpca.addComment(id, payload.text, user, cpca_service_1.SMIF_WORKFLOW_CONTEXT);
    }
};
exports.SmifComplaintsService = SmifComplaintsService;
exports.SmifComplaintsService = SmifComplaintsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cpca_service_1.CpcaService])
], SmifComplaintsService);
//# sourceMappingURL=smif-complaints.service.js.map