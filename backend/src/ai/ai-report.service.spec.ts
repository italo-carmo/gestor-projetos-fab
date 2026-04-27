import {
  AiReportService,
  type AssistantGeneratedReportDraft,
} from './ai-report.service';

const draft: AssistantGeneratedReportDraft = {
  title: 'Relatório Estratégico COMGEP',
  subtitle: 'Síntese abril 2026',
  kind: 'STRATEGIC',
  scope: 'COMGEP',
  tone: 'EXECUTIVE',
  generatedAt: '2026-04-20T12:00:00.000Z',
  periodLabel: 'Abril de 2026',
  focusLabel: 'Visão nacional',
  executiveSummary: 'Resumo executivo consolidado.',
  highlights: [
    {
      label: 'Denúncias',
      value: '17',
      detail: '6 em aberto',
    },
  ],
  sections: [
    {
      id: 'STRATEGIC_OVERVIEW',
      title: 'Panorama',
      body: 'Leitura executiva com base nos dados internos.',
      bullets: ['Priorizar acompanhamento das UFs críticas.'],
      chartIds: ['chart-1'],
      tableIds: ['table-1'],
      imageIds: [],
    },
  ],
  charts: [
    {
      id: 'chart-1',
      title: 'Distribuição de denúncias',
      labels: ['CPCA', 'SMIF'],
      values: [10, 7],
      colorHex: '#1A3C6E',
    },
  ],
  tables: [
    {
      id: 'table-1',
      title: 'Resumo por escopo',
      columns: ['Escopo', 'Casos'],
      rows: [
        ['CPCA', '10'],
        ['SMIF', '7'],
      ],
      note: 'Base consolidada em abril de 2026.',
    },
  ],
  images: [],
  recommendations: ['Manter rastreabilidade das bases documentais usadas na análise.'],
  dataNotes: ['Documento gerado automaticamente para teste.'],
};

describe('AiReportService', () => {
  const service = new AiReportService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('renders a PDF buffer for a generated report draft', async () => {
    const buffer = await service.renderPdf(draft);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('builds a stable file name from the report title and date', () => {
    expect(service.buildFileName(draft)).toBe(
      'relatorio-estrategico-comgep-2026-04-20.pdf',
    );
  });
});
