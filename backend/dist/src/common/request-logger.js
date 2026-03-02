"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestLogger = createRequestLogger;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const node_crypto_1 = require("node:crypto");
function createRequestLogger() {
    const logger = (0, pino_1.default)({
        level: process.env.LOG_LEVEL ?? 'info',
    });
    return (0, pino_http_1.default)({
        logger,
        genReqId: (req, res) => {
            const id = req.headers['x-request-id']?.toString() ?? (0, node_crypto_1.randomUUID)();
            res.setHeader('x-request-id', id);
            return id;
        },
        serializers: {
            req(req) {
                return {
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    remoteAddress: req.remoteAddress,
                };
            },
        },
    });
}
//# sourceMappingURL=request-logger.js.map