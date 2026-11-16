import { fetchBiApiPage } from './bi-api-fetch';

describe('leitura das APIs de pesquisa', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('mantém o timeout durante o download do corpo e limita as tentativas', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async (_url, init) => ({
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    })) as any;
    const result = fetchBiApiPage('https://example.test', 'test_api', 100);
    const assertion = expect(result).rejects.toMatchObject({
      response: { details: { reason: 'test_api_timeout' } },
    });
    await jest.advanceTimersByTimeAsync(250);
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([403, 401, 400, 404])('não repete erro HTTP %s em outros servidores', async (status) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    await expect(
      fetchBiApiPage('https://example.test', 'test_api', 100),
    ).rejects.toMatchObject({ response: { details: { status } } });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('recupera o 404 intermitente do Apps Script sem reutilizar o redirecionamento', async () => {
    const payload = { ok: true, dados: [], has_more: false };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => payload });
    const url = 'https://script.google.com/macros/s/test/exec?since_id=230';
    await expect(fetchBiApiPage(url, 'test_api', 100)).resolves.toEqual(payload);
    expect((global.fetch as jest.Mock).mock.calls.map(([value]) => value)).toEqual([url, url]);
  });

  it('rejeita resposta sem indicação de paginação em vez de importar parcialmente', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, dados: [] }),
      });
    await expect(
      fetchBiApiPage('https://example.test', 'test_api', 100),
    ).rejects.toMatchObject({
      response: { details: { reason: 'test_api_invalid_payload' } },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
