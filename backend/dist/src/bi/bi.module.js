"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiModule = void 0;
const common_1 = require("@nestjs/common");
const rbac_module_1 = require("../rbac/rbac.module");
const bi_best_practices_cycle_controller_1 = require("./bi-best-practices-cycle.controller");
const bi_best_practices_cycle_service_1 = require("./bi-best-practices-cycle.service");
const bi_cpca_meeting_controller_1 = require("./bi-cpca-meeting.controller");
const bi_cpca_meeting_service_1 = require("./bi-cpca-meeting.service");
const bi_gsd_evaluation_controller_1 = require("./bi-gsd-evaluation.controller");
const bi_gsd_evaluation_service_1 = require("./bi-gsd-evaluation.service");
const bi_domestic_violence_controller_1 = require("./bi-domestic-violence.controller");
const bi_domestic_violence_service_1 = require("./bi-domestic-violence.service");
const bi_recruits_controller_1 = require("./bi-recruits.controller");
const bi_recruits_service_1 = require("./bi-recruits.service");
const bi_controller_1 = require("./bi.controller");
const bi_service_1 = require("./bi.service");
let BiModule = class BiModule {
};
exports.BiModule = BiModule;
exports.BiModule = BiModule = __decorate([
    (0, common_1.Module)({
        imports: [rbac_module_1.RbacModule],
        controllers: [
            bi_controller_1.BiController,
            bi_domestic_violence_controller_1.BiDomesticViolenceController,
            bi_recruits_controller_1.BiRecruitsController,
            bi_best_practices_cycle_controller_1.BiBestPracticesCycleController,
            bi_cpca_meeting_controller_1.BiCpcaMeetingController,
            bi_gsd_evaluation_controller_1.BiGsdEvaluationController,
        ],
        providers: [
            bi_service_1.BiService,
            bi_domestic_violence_service_1.BiDomesticViolenceService,
            bi_recruits_service_1.BiRecruitsService,
            bi_best_practices_cycle_service_1.BiBestPracticesCycleService,
            bi_cpca_meeting_service_1.BiCpcaMeetingService,
            bi_gsd_evaluation_service_1.BiGsdEvaluationService,
        ],
    })
], BiModule);
//# sourceMappingURL=bi.module.js.map