import { ConfigService } from '@nestjs/config';
import {
  LitellmService,
  normalizeLitellmModelId,
  setLitellmDbOverrides,
  stripEnvQuotes,
  stripReasoningPrefix,
} from './litellm.service';

describe('LitellmService', () => {
  const configMock = {
    get: jest.fn(),
  } as unknown as ConfigService;
  const service = new LitellmService(configMock);

  beforeEach(() => {
    jest.clearAllMocks();
    setLitellmDbOverrides({});
    for (const key of [
      'API_LITELLM',
      'LITELLM_API_KEY',
      'OPENAI_API_KEY',
      'API_LITELLM_BASE_URL',
      'LITELLM_BASE_URL',
      'OPENAI_BASE_URL',
      'API_LITELLM_MODEL',
      'LITELLM_MODEL',
      'OPENAI_MODEL',
      'API_LITELLM_OPENAI_STYLE_MODEL',
      'LITELLM_OPENAI_STYLE_MODEL',
    ]) {
      delete process.env[key];
    }
    (global as any).fetch = jest.fn();
  });

  afterAll(() => {
    setLitellmDbOverrides({});
  });

  it('normalizes quoted env values and OpenAI style model ids', () => {
    configMock.get = jest.fn((key: string) =>
      key === 'API_LITELLM_OPENAI_STYLE_MODEL' ? 'true' : undefined,
    ) as any;

    expect(stripEnvQuotes('  "abc"  ')).toBe('abc');
    expect(stripEnvQuotes(" 'abc' ")).toBe('abc');
    expect(normalizeLitellmModelId('gpt-oss:20b', configMock)).toBe(
      'openai/gpt-oss-20b',
    );
  });

  it('removes reasoning prefixes before returning the final answer', () => {
    expect(
      stripReasoningPrefix(
        'analysis preciso revisar os dados assistantfinal## Resposta final',
      ),
    ).toBe('## Resposta final');
  });

  it('creates embeddings through the LiteLLM OpenAI-compatible endpoint', async () => {
    configMock.get = jest.fn((key: string) => {
      switch (key) {
        case 'LITELLM_API_KEY':
          return 'secret-key';
        case 'LITELLM_BASE_URL':
          return 'http://litellm.local';
        default:
          return undefined;
      }
    }) as any;

    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          model: 'bge-m3',
          data: [{ embedding: [0.12, 0.34, 0.56] }],
        }),
    } as Response);

    await expect(
      service.createEmbeddings({
        model: 'bge-m3',
        input: ['Art. 1', ''],
      }),
    ).resolves.toEqual({
      embeddings: [[0.12, 0.34, 0.56]],
      model: 'bge-m3',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://litellm.local/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
        }),
      }),
    );
  });
});
