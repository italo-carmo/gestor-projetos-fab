import {
  ComplaintSummaryPrivacyService,
  detectHeuristicComplaintSummaryFindings,
} from './complaint-summary-privacy.service';

function createPrismaMock() {
  return {
    posto: {
      findMany: jest.fn(),
    },
  } as any;
}

function createLitellmMock() {
  return {
    isConfigured: jest.fn(),
    chatCompletion: jest.fn(),
  } as any;
}

describe('ComplaintSummaryPrivacyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detecta por heurística posto associado a nome e ignora posto isolado', async () => {
    const prisma = createPrismaMock();
    const litellm = createLitellmMock();
    const service = new ComplaintSummaryPrivacyService(prisma, litellm);

    prisma.posto.findMany.mockResolvedValue([]);
    litellm.isConfigured.mockReturnValue(false);

    const review = await service.reviewSummary(
      'O CAP Silva entrou em contato com a comissão e depois o capitão informou o protocolo.',
    );

    expect(review.status).toBe('flagged');
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0]).toMatchObject({
      excerpt: 'CAP Silva',
      category: 'RANK_PLUS_NAME',
      source: 'heuristic',
    });
  });

  it('faz retry quando o LiteLLM responde formato inválido e aproveita a resposta corrigida', async () => {
    const prisma = createPrismaMock();
    const litellm = createLitellmMock();
    const service = new ComplaintSummaryPrivacyService(prisma, litellm);

    prisma.posto.findMany.mockResolvedValue([
      { code: 'CAP', name: 'Capitão' },
      { code: 'MAJ', name: 'Major' },
    ]);
    litellm.isConfigured.mockReturnValue(true);
    litellm.chatCompletion
      .mockResolvedValueOnce({
        content: 'resposta inválida',
        model: 'openai/gpt-4.1-mini',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          hasPossibleMilitaryNames: true,
          findings: [
            {
              excerpt: 'Capitão Silva',
              start: 2,
              end: 16,
              category: 'RANK_PLUS_NAME',
              confidence: 'HIGH',
              explanation: 'posto associado a sobrenome',
            },
          ],
        }),
        model: 'openai/gpt-4.1-mini',
      });

    const review = await service.reviewSummary(
      'O Capitão Silva entrou em contato com a comissão.',
    );

    expect(litellm.chatCompletion).toHaveBeenCalledTimes(2);
    expect(review.status).toBe('flagged');
    expect(review.engine).toBe('llm');
    expect(review.model).toBe('openai/gpt-4.1-mini');
    expect(review.findings[0]).toMatchObject({
      excerpt: 'Capitão Silva',
      start: 2,
      end: 15,
      source: 'llm',
    });
  });

  it('expõe a heurística como utilitário puro para os testes de integração do texto', () => {
    const findings = detectHeuristicComplaintSummaryFindings(
      'Relato: MAJ Oliveira determinou a alteração.',
      ['MAJ', 'MAJOR'],
    );

    expect(findings).toEqual([
      expect.objectContaining({
        excerpt: 'MAJ Oliveira',
        category: 'RANK_PLUS_NAME',
      }),
    ]);
  });
});
