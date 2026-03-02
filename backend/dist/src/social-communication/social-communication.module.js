"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialCommunicationModule = void 0;
const common_1 = require("@nestjs/common");
const rbac_module_1 = require("../rbac/rbac.module");
const social_communication_controller_1 = require("./social-communication.controller");
const social_communication_proxy_controller_1 = require("./social-communication-proxy.controller");
const social_communication_service_1 = require("./social-communication.service");
let SocialCommunicationModule = class SocialCommunicationModule {
};
exports.SocialCommunicationModule = SocialCommunicationModule;
exports.SocialCommunicationModule = SocialCommunicationModule = __decorate([
    (0, common_1.Module)({
        imports: [rbac_module_1.RbacModule],
        controllers: [
            social_communication_controller_1.SocialCommunicationController,
            social_communication_proxy_controller_1.SocialCommunicationProxyController,
        ],
        providers: [social_communication_service_1.SocialCommunicationService],
    })
], SocialCommunicationModule);
//# sourceMappingURL=social-communication.module.js.map