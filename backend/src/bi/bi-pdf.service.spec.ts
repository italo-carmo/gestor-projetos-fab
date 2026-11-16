import PDFDocument from 'pdfkit';
import { BiPdfService } from './bi-pdf.service';

describe('BI PDF rendering', () => {
  it('draws distinct pie sectors and keeps footers on content pages', async () => {
    const arc = jest.spyOn(PDFDocument.prototype, 'arc');
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    const service = new BiPdfService(
      ...(Array(6).fill({}) as [any, any, any, any, any, any]),
    );
    const definition = {
      title: 'Violência doméstica',
      subtitle: 'Relatório de teste',
      theme: {
        primary: '#0F4C5C',
        secondary: '#2D6A4F',
        accent: '#E76F51',
        text: '#1F2937',
        muted: '#607085',
        border: '#D7E0EA',
        panel: '#F7FAFC',
      },
      generatedAt: '2026-09-28T12:00:00Z',
      filters: [],
      stats: [{ label: 'Total', value: '100' }],
      insights: [],
      sections: Array.from({ length: 6 }, (_, index) => ({
        title: `Distribuição ${index + 1}`,
        rows: [],
        pieChart: {
          slices: [
            { label: 'Sim', value: 25, percent: 25, color: '#FF0000' },
            { label: 'Não', value: 75, percent: 75, color: '#0000FF' },
          ],
        },
      })),
    };
    try {
      const buffer = await (service as any).renderDashboardPdf(definition);
      expect(arc.mock.calls[0].slice(3, 5)).toEqual([-Math.PI / 2, 0]);
      expect(arc.mock.calls[1].slice(3, 5)).toEqual([0, Math.PI * 1.5]);
      const pageCount = (
        buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []
      ).length;
      const footers = text.mock.calls.filter((call) =>
        String(call[0]).includes(' • Página '),
      );
      expect(pageCount).toBeGreaterThan(1);
      expect(footers).toHaveLength(pageCount);
      footers.forEach((call, index) => {
        expect(call[0]).toContain(`Página ${index + 1}/${pageCount}`);
      });
    } finally {
      arc.mockRestore();
      text.mockRestore();
    }
  });
});
