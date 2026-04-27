import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';

describe('AiAssistantService', () => {
  const reportsMock = {
    renderPdf: jest.fn(),
    buildFileName: jest.fn(),
  } as any;

  const service = new AiAssistantService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    reportsMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes the configured quick actions', () => {
    const actions = service.listQuickActions();
    const reportAction = actions.find((item) => item.id === 'create_report');
    const taskAction = actions.find((item) => item.id === 'create_task');

    expect(reportAction?.title).toContain('relatório');
    expect(taskAction?.title).toContain('tarefa');
  });

  it('resets an existing assistant session', () => {
    (service as any).sessions.set('session-1', { id: 'session-1' });

    expect((service as any).sessions.size).toBe(1);
    expect(service.resetSession('session-1')).toEqual({ ok: true });
    expect((service as any).sessions.size).toBe(0);
  });

  it('throws when trying to export a report without a prepared draft', async () => {
    await expect(service.buildReportPdfForSession('missing-session')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    (service as any).sessions.set('session-2', {
      id: 'session-2',
      workflow: {
        intent: 'create_report',
        draft: {},
      },
    });

    await expect(service.buildReportPdfForSession('session-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds the report PDF from a prepared assistant session draft', async () => {
    const buffer = Buffer.from('pdf-binary');
    reportsMock.renderPdf.mockResolvedValue(buffer);
    reportsMock.buildFileName.mockReturnValue('relatorio.pdf');
    (service as any).sessions.set('session-3', {
      id: 'session-3',
      workflow: {
        intent: 'create_report',
        draft: {
          generatedReport: {
            title: 'Relatório COMGEP',
            subtitle: 'Síntese nacional',
            executiveSummary: 'Resumo executivo.',
            kind: 'STRATEGIC',
            scope: 'COMGEP',
            tone: 'EXECUTIVE',
            generatedAt: '2026-04-20T10:00:00.000Z',
            periodLabel: 'Abril de 2026',
            sections: [
              {
                id: 'STRATEGIC_OVERVIEW',
                title: 'Panorama',
                body: 'Texto consolidado.',
                bullets: [],
                chartIds: [],
                tableIds: [],
                imageIds: [],
              },
            ],
          },
        },
      },
    });

    await expect(service.buildReportPdfForSession('session-3')).resolves.toEqual({
      buffer,
      filename: 'relatorio.pdf',
      title: 'Relatório COMGEP',
    });
  });
});
