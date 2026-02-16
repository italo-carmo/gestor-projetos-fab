"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksModule = void 0;
const common_1 = require("@nestjs/common");
const rbac_module_1 = require("../rbac/rbac.module");
const tasks_service_1 = require("./tasks.service");
const phases_controller_1 = require("./phases.controller");
const task_templates_controller_1 = require("./task-templates.controller");
const task_instances_controller_1 = require("./task-instances.controller");
const dashboards_controller_1 = require("./dashboards.controller");
let TasksModule = class TasksModule {
};
exports.TasksModule = TasksModule;
exports.TasksModule = TasksModule = __decorate([
    (0, common_1.Module)({
        imports: [rbac_module_1.RbacModule],
        controllers: [phases_controller_1.PhasesController, task_templates_controller_1.TaskTemplatesController, task_instances_controller_1.TaskInstancesController, dashboards_controller_1.DashboardsController],
        providers: [tasks_service_1.TasksService],
        exports: [tasks_service_1.TasksService],
    })
], TasksModule);
//# sourceMappingURL=tasks.module.js.map