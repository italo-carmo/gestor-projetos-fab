"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./users/users.module");
const auth_module_1 = require("./auth/auth.module");
const rbac_module_1 = require("./rbac/rbac.module");
const audit_module_1 = require("./audit/audit.module");
const tasks_module_1 = require("./tasks/tasks.module");
const reports_module_1 = require("./reports/reports.module");
const notices_module_1 = require("./notices/notices.module");
const meetings_module_1 = require("./meetings/meetings.module");
const checklists_module_1 = require("./checklists/checklists.module");
const elos_module_1 = require("./elos/elos.module");
const exports_module_1 = require("./exports/exports.module");
const health_module_1 = require("./health/health.module");
const throttler_1 = require("@nestjs/throttler");
const catalog_module_1 = require("./catalog/catalog.module");
const kpis_module_1 = require("./kpis/kpis.module");
const search_module_1 = require("./search/search.module");
const activities_module_1 = require("./activities/activities.module");
const documents_module_1 = require("./documents/documents.module");
const bi_module_1 = require("./bi/bi.module");
const fab_ldap_module_1 = require("./ldap/fab-ldap.module");
const missions_module_1 = require("./missions/missions.module");
const social_communication_module_1 = require("./social-communication/social-communication.module");
const cpca_module_1 = require("./cpca/cpca.module");
const library_module_1 = require("./library/library.module");
const best_practices_module_1 = require("./best-practices/best-practices.module");
const lessons_learned_module_1 = require("./lessons-learned/lessons-learned.module");
const smif_complaints_module_1 = require("./smif-complaints/smif-complaints.module");
const menu_updates_module_1 = require("./menu-updates/menu-updates.module");
const strategic_module_1 = require("./strategic/strategic.module");
const litellm_module_1 = require("./llm/litellm.module");
const settings_module_1 = require("./settings/settings.module");
const ai_module_1 = require("./ai/ai.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            litellm_module_1.LitellmModule,
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60_000,
                    limit: 120,
                },
            ]),
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            rbac_module_1.RbacModule,
            audit_module_1.AuditModule,
            tasks_module_1.TasksModule,
            reports_module_1.ReportsModule,
            notices_module_1.NoticesModule,
            meetings_module_1.MeetingsModule,
            checklists_module_1.ChecklistsModule,
            elos_module_1.ElosModule,
            exports_module_1.ExportsModule,
            health_module_1.HealthModule,
            catalog_module_1.CatalogModule,
            kpis_module_1.KpisModule,
            search_module_1.SearchModule,
            activities_module_1.ActivitiesModule,
            documents_module_1.DocumentsModule,
            bi_module_1.BiModule,
            fab_ldap_module_1.FabLdapModule,
            missions_module_1.MissionsModule,
            social_communication_module_1.SocialCommunicationModule,
            cpca_module_1.CpcaModule,
            library_module_1.LibraryModule,
            best_practices_module_1.BestPracticesModule,
            lessons_learned_module_1.LessonsLearnedModule,
            smif_complaints_module_1.SmifComplaintsModule,
            menu_updates_module_1.MenuUpdatesModule,
            strategic_module_1.StrategicModule,
            settings_module_1.SettingsModule,
            ai_module_1.AiModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map