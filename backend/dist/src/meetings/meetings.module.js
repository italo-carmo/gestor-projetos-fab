"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsModule = void 0;
const common_1 = require("@nestjs/common");
const rbac_module_1 = require("../rbac/rbac.module");
const tasks_module_1 = require("../tasks/tasks.module");
const meetings_controller_1 = require("./meetings.controller");
const meetings_service_1 = require("./meetings.service");
let MeetingsModule = class MeetingsModule {
};
exports.MeetingsModule = MeetingsModule;
exports.MeetingsModule = MeetingsModule = __decorate([
    (0, common_1.Module)({
        imports: [rbac_module_1.RbacModule, tasks_module_1.TasksModule],
        controllers: [meetings_controller_1.MeetingsController],
        providers: [meetings_service_1.MeetingsService],
    })
], MeetingsModule);
//# sourceMappingURL=meetings.module.js.map