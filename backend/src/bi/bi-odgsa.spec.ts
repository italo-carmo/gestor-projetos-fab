import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BiService } from './bi.service';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';
import { BiRecruitsService } from './bi-recruits.service';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';
import { BiCpcaMeetingService } from './bi-cpca-meeting.service';
import { BiGsdEvaluationService } from './bi-gsd-evaluation.service';
import { BiNormalizationService } from './bi-normalization.service';
import { BiPdfService } from './bi-pdf.service';

const sources = [
  {
    C: BiService,
    model: 'biSurvey',
    template: 'survey',
    source: 'SURVEY_SCHOOLS',
    method: 'importSurvey',
  },
  {
    C: BiDomesticViolenceService,
    model: 'biDomesticViolence',
    template: 'domestic-violence',
    source: 'DOMESTIC_VIOLENCE',
  },
  {
    C: BiRecruitsService,
    model: 'biRecruits',
    template: 'recruits',
    source: 'RECRUITS',
  },
  {
    C: BiBestPracticesCycleService,
    model: 'biBestPracticeCycle',
    template: 'best-practices-cycle',
    source: 'BEST_PRACTICE_CYCLE',
  },
  {
    C: BiCpcaMeetingService,
    model: 'biCpcaMeeting',
    template: 'cpca-meeting',
    source: 'CPCA_MEETING',
  },
  {
    C: BiGsdEvaluationService,
    model: 'biGsdEvaluation',
    template: 'avaliacao-gsd',
    source: 'GSD_EVALUATION',
  },
];

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'AND') return value.every((part: any) => matches(row, part));
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (value?.in) return value.in.includes(row[key]);
    if (value?.not !== undefined) return row[key] !== value.not;
    if (value?.contains)
      return String(row[key] ?? '')
        .toLowerCase()
        .includes(value.contains.toLowerCase());
    if (value?.gte) return new Date(row[key]) >= value.gte;
    return row[key] === value;
  });
}

async function setup(source: (typeof sources)[number]) {
  let rows: any[] = [];
  const assignment = { current: 'group-a' };
  const responseModel = {
    createMany: jest.fn(async ({ data }) => {
      rows = data;
      return { count: data.length };
    }),
    findMany: jest.fn(async (args?: any) =>
      rows.filter((row) => matches(row, args?.where)),
    ),
    count: jest.fn(
      async (args?: any) =>
        rows.filter((row) => matches(row, args?.where)).length,
    ),
    deleteMany: jest.fn(async (args?: any) => ({
      count: rows.filter((row) => matches(row, args?.where)).length,
    })),
  };
  const batchModel = {
    create: jest.fn(async ({ data }) => ({ id: 'batch', ...data })),
    update: jest.fn(async ({ data }) => ({ id: 'batch', ...data })),
    findFirst: jest.fn().mockResolvedValue(null),
  };
  const p: any = {
    [`${source.model}Response`]: responseModel,
    [`${source.model}ImportBatch`]: batchModel,
    [`${source.model}CardSetting`]: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    biNormalizationLink: {
      findMany: jest.fn(async ({ where }) => {
        expect(where.sourceType).toBe(source.source);
        expect(where.status).toBe('MATCHED');
        if (source.source === 'RECRUITS') return [];
        const group = where.om.odgsaAssignment.odgsaId;
        return group === assignment.current
          ? [{ sourceRecordId: 'r-a' }]
          : group === 'group-b'
            ? [{ sourceRecordId: 'r-b' }]
            : [];
      }),
    },
    $transaction: jest.fn(async (input) =>
      typeof input === 'function' ? input(p) : Promise.all(input),
    ),
  };
  const normalization = new BiNormalizationService(p);
  jest
    .spyOn(normalization, 'previewImportRows')
    .mockImplementation(
      async ({ rows }) =>
        ({
          sourceType: source.source,
          totalRows: rows.length,
          suggestions: [],
          unresolved: [],
          summary: {
            suggestionCount: 0,
            unresolvedCount: 0,
            omSuggestionCount: 0,
            specialtySuggestionCount: 0,
          },
        }) as any,
    );
  jest.spyOn(normalization, 'rebuild').mockResolvedValue({} as any);
  const service: any = new source.C(p, normalization);
  const file = {
    originalname: 'test.csv',
    buffer: readFileSync(
      resolve(
        __dirname,
        '../../../frontend/public/templates',
        `bi-${source.template}-template.csv`,
      ),
    ),
  };
  await service[source.method ?? 'importResponses'](file);
  const base = rows[0];
  rows = ['r-a', 'r-b', 'r-without-om'].map((id) => ({
    ...base,
    id,
    createdAt: new Date(),
    submittedAt: new Date('2026-01-01'),
  }));
  return { service, p, assignment };
}

describe.each(sources)('ODGSA: $source', (source) => {
  it('restringe indicadores, total da base, tabela e exclusão pelo recorte', async () => {
    const { service } = await setup(source);
    const filters = { odgsaId: 'group-a' };
    const expected = source.source === 'RECRUITS' ? 0 : 1;
    const dashboard = await service.dashboard(filters);
    expect(dashboard.kpis.totalResponses).toBe(expected);
    expect(dashboard.kpis.totalRowsInDb).toBe(expected);
    const responses = await service.listResponses(filters);
    expect(responses.total).toBe(expected);
    expect(responses.items.map((row: any) => row.id)).toEqual(
      expected ? ['r-a'] : [],
    );
    const deleted = await service.deleteResponses({
      ...filters,
      allFiltered: true,
    });
    expect(deleted.deletedCount).toBe(expected);
  });

  it('ODGSA sem vínculo retorna vazio; remover o filtro restaura a base completa', async () => {
    const { service } = await setup(source);
    expect(
      (await service.dashboard({ odgsaId: 'unknown' })).kpis.totalResponses,
    ).toBe(0);
    expect((await service.dashboard({})).kpis.totalResponses).toBe(3);
  });

  it('usa o relacionamento atual da OM sem reimportar respostas', async () => {
    const { service, assignment } = await setup(source);
    assignment.current = 'group-c';
    expect((await service.listResponses({ odgsaId: 'group-a' })).total).toBe(0);
    expect((await service.listResponses({ odgsaId: 'group-c' })).total).toBe(
      source.source === 'RECRUITS' ? 0 : 1,
    );
  });
});

it.each(sources.slice(0, 4))(
  'o modo OU não amplia o ODGSA em $source',
  async (source) => {
    const { service } = await setup(source);
    const result = await service.listResponses({
      odgsaId: 'group-a',
      combineMode: 'OR',
      from: '2020-01-01',
      q: 'inexistente',
    });
    expect(result.items.map((row: any) => row.id)).toEqual(
      source.source === 'RECRUITS' ? [] : ['r-a'],
    );
  },
);

it('o PDF consulta o mesmo recorte e identifica o ODGSA pelo código', async () => {
  const { service } = await setup(sources[0]);
  service.listOdgsaFilterOptions = jest
    .fn()
    .mockResolvedValue([
      { id: 'group-a', code: 'COMGEP', name: 'Comando-Geral do Pessoal' },
    ]);
  const spy = jest.spyOn(service, 'dashboard');
  const pdf: any = new BiPdfService(
    service,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const result = await pdf.buildSurveysDashboardDefinition({
    odgsaId: 'group-a',
  });
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({ odgsaId: 'group-a' }),
  );
  expect(result.filters).toContainEqual({ label: 'ODGSA', value: 'COMGEP' });
});
