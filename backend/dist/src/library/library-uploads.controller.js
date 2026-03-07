"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryUploadsController = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const http_error_1 = require("../common/http-error");
const library_controller_1 = require("./library.controller");
const library_storage_1 = require("./library-storage");
let LibraryUploadsController = class LibraryUploadsController {
    sendPhoto(filename, res) {
        const safeName = path.basename(String(filename ?? '').trim());
        const filePath = path.join(library_controller_1.libraryPhotosDir, safeName);
        if (!safeName || !fs.existsSync(filePath)) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(filePath);
    }
    sendDocument(filename, res) {
        const safeName = path.basename(String(filename ?? '').trim());
        const filePath = (0, library_storage_1.resolveExistingLibraryDocumentPath)(safeName);
        if (!safeName || !fs.existsSync(filePath)) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(filePath);
    }
};
exports.LibraryUploadsController = LibraryUploadsController;
__decorate([
    (0, common_1.Get)('photos/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LibraryUploadsController.prototype, "sendPhoto", null);
__decorate([
    (0, common_1.Get)('documents/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LibraryUploadsController.prototype, "sendDocument", null);
exports.LibraryUploadsController = LibraryUploadsController = __decorate([
    (0, common_1.Controller)('library/uploads')
], LibraryUploadsController);
//# sourceMappingURL=library-uploads.controller.js.map