"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistsModule = void 0;
const common_1 = require("@nestjs/common");
const rbac_module_1 = require("../rbac/rbac.module");
const checklists_controller_1 = require("./checklists.controller");
const checklists_service_1 = require("./checklists.service");
let ChecklistsModule = class ChecklistsModule {
};
exports.ChecklistsModule = ChecklistsModule;
exports.ChecklistsModule = ChecklistsModule = __decorate([
    (0, common_1.Module)({
        imports: [rbac_module_1.RbacModule],
        controllers: [checklists_controller_1.ChecklistsController, checklists_controller_1.ChecklistItemStatusController],
        providers: [checklists_service_1.ChecklistsService],
        exports: [checklists_service_1.ChecklistsService],
    })
], ChecklistsModule);
//# sourceMappingURL=checklists.module.js.map