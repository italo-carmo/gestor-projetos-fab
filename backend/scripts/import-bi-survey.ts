import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { BiService } from '../src/bi/bi.service';
import { PrismaService } from '../src/prisma/prisma.service';

config({ path: path.join(__dirname, '..', '.env') });

type Args = {
  filePath: string;
  reset: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const fileArgIndex = args.findIndex((item) => item === '--file');
  const filePath =
    fileArgIndex >= 0 && args[fileArgIndex + 1]
      ? args[fileArgIndex + 1]
      : '/home/italoibsc/Downloads/BD_FINAL_CIPAVD.xlsx';

  return {
    filePath,
    reset: args.includes('--reset'),
  };
}

async function main() {
  const { filePath, reset } = parseArgs();
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Arquivo nao encontrado: ${resolved}`);
  }

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const service = new BiService(prisma);
    const result = await service.importSurvey(
      {
        originalname: path.basename(resolved),
        buffer: fs.readFileSync(resolved),
      } as Express.Multer.File,
      undefined,
      { replaceAll: reset },
    );

    console.log(
      JSON.stringify(
        {
          file: resolved,
          batchId: result.batch.id,
          totalRows: result.batch.totalRows,
          insertedRows: result.batch.insertedRows,
          duplicateRows: result.batch.duplicateRows,
          invalidRows: result.batch.invalidRows,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
