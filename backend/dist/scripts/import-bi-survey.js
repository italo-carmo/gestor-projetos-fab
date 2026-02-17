"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = require("dotenv");
const bi_service_1 = require("../src/bi/bi.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
(0, dotenv_1.config)({ path: node_path_1.default.join(__dirname, '..', '.env') });
function parseArgs() {
    const args = process.argv.slice(2);
    const fileArgIndex = args.findIndex((item) => item === '--file');
    const filePath = fileArgIndex >= 0 && args[fileArgIndex + 1]
        ? args[fileArgIndex + 1]
        : '/Users/italocarmo/Downloads/Repositório/5. PESQUISAS - Dados/SLIDES_BD_EEAR_CIAAR_COMGEP_AFA/Banco_de_dados_tabelas_graficos.xlsx';
    return {
        filePath,
        reset: args.includes('--reset'),
    };
}
async function main() {
    const { filePath, reset } = parseArgs();
    const resolved = node_path_1.default.resolve(filePath);
    if (!node_fs_1.default.existsSync(resolved)) {
        throw new Error(`Arquivo nao encontrado: ${resolved}`);
    }
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    try {
        if (reset) {
            await prisma.biSurveyResponse.deleteMany();
            await prisma.biSurveyImportBatch.deleteMany();
        }
        const service = new bi_service_1.BiService(prisma);
        const result = await service.importSurvey({
            originalname: node_path_1.default.basename(resolved),
            buffer: node_fs_1.default.readFileSync(resolved),
        }, undefined);
        console.log(JSON.stringify({
            file: resolved,
            batchId: result.batch.id,
            totalRows: result.batch.totalRows,
            insertedRows: result.batch.insertedRows,
            duplicateRows: result.batch.duplicateRows,
            invalidRows: result.batch.invalidRows,
        }, null, 2));
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=import-bi-survey.js.map