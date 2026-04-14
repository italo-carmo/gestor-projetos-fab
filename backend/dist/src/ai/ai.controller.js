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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const rbac_guard_1 = require("../rbac/rbac.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const ai_service_1 = require("./ai.service");
let AiController = class AiController {
    ai;
    constructor(ai) {
        this.ai = ai;
    }
    listAnalyses() {
        return this.ai.getAnalysesCatalog();
    }
    async analyze(body, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        try {
            for await (const chunk of this.ai.analyzeStream(body.type ?? 'executive')) {
                res.write(chunk);
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
        }
        res.end();
    }
    async analyzePdf(body, res) {
        const type = body.type ?? 'executive';
        const buffer = await this.ai.analysisPdf(type, {
            narrative: body.narrative,
            model: body.model,
            generatedAt: body.generatedAt,
        });
        const filename = `analise-ia-${type}-${new Date().toISOString().slice(0, 10)}.pdf`;
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async chat(body, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const history = (body.history ?? []).map((m) => ({
            role: m.role,
            content: m.content,
        }));
        try {
            for await (const chunk of this.ai.chatStream(body.message ?? '', history)) {
                res.write(chunk);
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
        }
        res.end();
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Get)('analyses'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiController.prototype, "listAnalyses", null);
__decorate([
    (0, common_1.Post)('analyze'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "analyze", null);
__decorate([
    (0, common_1.Post)('analyze/pdf'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "analyzePdf", null);
__decorate([
    (0, common_1.Post)('chat'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "chat", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map