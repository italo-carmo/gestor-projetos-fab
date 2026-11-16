import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { BiService } from './bi.service';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';
import { BiRecruitsService } from './bi-recruits.service';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';
import { BiCpcaMeetingService } from './bi-cpca-meeting.service';
import { BiGsdEvaluationService } from './bi-gsd-evaluation.service';

const sources = [
  {
    name: 'Escolas',
    C: BiService,
    template: 'survey',
    model: 'biSurvey',
    method: 'importSurvey',
  },
  {
    name: 'Violência Doméstica',
    C: BiDomesticViolenceService,
    template: 'domestic-violence',
    model: 'biDomesticViolence',
    api: 'DOMESTIC_VIOLENCE',
  },
  {
    name: 'Recrutas',
    C: BiRecruitsService,
    template: 'recruits',
    model: 'biRecruits',
    api: 'RECRUITS',
  },
  {
    name: 'Ciclo de Boas Práticas',
    C: BiBestPracticesCycleService,
    template: 'best-practices-cycle',
    model: 'biBestPracticeCycle',
    api: 'BEST_PRACTICES_CYCLE',
  },
  {
    name: 'Encontro CPCA',
    C: BiCpcaMeetingService,
    template: 'cpca-meeting',
    model: 'biCpcaMeeting',
    api: 'CPCA_MEETING',
  },
  {
    name: 'Avaliação GSD',
    C: BiGsdEvaluationService,
    template: 'avaliacao-gsd',
    model: 'biGsdEvaluation',
  },
];

function setup(source: (typeof sources)[number]) {
  const responses = {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    createMany: jest.fn(async ({ data }) => ({ count: data.length })),
  };
  const batches = {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn(async ({ data }) => ({ id: 'batch', ...data })),
    update: jest.fn(async ({ data }) => ({ id: 'batch', ...data })),
  };
  const tx = {
    [`${source.model}Response`]: responses,
    [`${source.model}ImportBatch`]: batches,
  };
  // Expose writes only inside the transaction, so accidental outside writes fail.
  const prisma = {
    [`${source.model}Response`]: {
      findFirst: jest.fn().mockResolvedValue({ apiId: 1 }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
  const normalization = {
    previewImportRows: jest.fn(async ({ rows }) => ({
      totalRows: rows.length,
      suggestions: [],
      unresolved: [],
      summary: { unresolvedCount: 0 },
    })),
    applyImportNormalization: jest.fn((rows) => ({
      rows,
      appliedSuggestions: 0,
      updatedFields: 0,
    })),
    rebuild: jest.fn().mockResolvedValue(undefined),
  };
  const service: any = new source.C(prisma as any, normalization as any);
  const buffer = readFileSync(
    resolve(
      __dirname,
      '../../../frontend/public/templates',
      `bi-${source.template}-template.csv`,
    ),
  );
  const file = { originalname: 'pesquisa.csv', buffer } as Express.Multer.File;
  const run = (input = file, options = { replaceAll: true }) =>
    service[source.method ?? 'importResponses'](input, undefined, options);
  return { responses, batches, prisma, normalization, service, file, run };
}

describe.each(sources)('importação de $name', (source) => {
  it('também importa XLSX com acentos preservados', async () => {
    const t = setup(source);
    const workbook = XLSX.read(t.file.buffer.toString('utf8'), { type: 'string' });
    const file = {
      ...t.file,
      originalname: 'pesquisa.xlsx',
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    };
    const result = await t.run(file);
    expect(result.batch.insertedRows).toBeGreaterThan(0);
  });

  it('importa o template publicado com exclusão e inserção na mesma transação', async () => {
    const t = setup(source);
    const result = await t.run();
    expect(result.batch.insertedRows).toBeGreaterThan(0);
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(t.responses.deleteMany).toHaveBeenCalledTimes(1);
    expect(t.responses.createMany).toHaveBeenCalledTimes(1);
    expect(t.normalization.rebuild).toHaveBeenCalledTimes(1);
  });

  it('rejeita arquivo apenas com cabeçalho antes de apagar a base', async () => {
    const t = setup(source);
    const empty = {
      ...t.file,
      buffer: Buffer.from(t.file.buffer.toString().split('\n')[0] + '\n'),
    };
    await expect(t.run(empty)).rejects.toBeDefined();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propaga a falha de gravação para abortar a transação e não anuncia sucesso', async () => {
    const t = setup(source);
    t.responses.createMany.mockRejectedValueOnce(new Error('write failed'));
    await expect(t.run()).rejects.toThrow('write failed');
    expect(t.batches.update).not.toHaveBeenCalled();
    expect(t.normalization.rebuild).not.toHaveBeenCalled();
  });
});

describe.each(sources.filter((source) => source.api))(
  'sincronização de $name',
  (source) => {
    const originalFetch = global.fetch;
    const envKey = `BI_${source.api}_API_URL`;
    const originalUrl = process.env[envKey];
    beforeEach(() => {
      process.env[envKey] = 'https://example.test/exec';
      global.fetch = jest.fn();
    });
    afterEach(() => {
      global.fetch = originalFetch;
      if (originalUrl === undefined) delete process.env[envKey];
      else process.env[envKey] = originalUrl;
    });

    it('repete falha temporária sem pular a página e busca todos os registros', async () => {
      const t = setup(source);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            dados: [{ api_id: 2 }],
            has_more: true,
            next_since_id: 2,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            dados: [{ api_id: 3 }],
            has_more: false,
            next_since_id: 3,
          }),
        });
      const result = await t.service.fetchApiRecords(1);
      expect(result.sync).toMatchObject({
        fetchedRows: 2,
        nextSinceId: 3,
        hasMore: false,
      });
      expect(
        (global.fetch as jest.Mock).mock.calls.map(([url]) =>
          new URL(url).searchParams.get('since_id'),
        ),
      ).toEqual(['1', '1', '2']);
    });

    it('rejeita registros inválidos sem avançar a importação', async () => {
      const t = setup(source);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          dados: [{}],
          has_more: false,
          next_since_id: 2,
        }),
      });
      await expect(t.service.importResponsesFromApi()).rejects.toMatchObject({
        response: { details: { reason: 'bi_import_invalid_rows' } },
      });
      expect(t.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('interrompe paginação que não avança', async () => {
      const t = setup(source);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          dados: [{ api_id: 2 }],
          has_more: true,
          next_since_id: 1,
        }),
      });
      await expect(t.service.fetchApiRecords(1)).rejects.toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(t.prisma.$transaction).not.toHaveBeenCalled();
    });
  },
);
