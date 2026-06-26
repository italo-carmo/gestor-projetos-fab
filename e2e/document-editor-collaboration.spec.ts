import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

const ACCESS_TOKEN = process.env.E2E_ACCESS_TOKEN ?? '';
const ACTIVE_ROLE_ID = process.env.E2E_ACTIVE_ROLE_ID ?? '';

test.skip(!ACCESS_TOKEN, 'Defina E2E_ACCESS_TOKEN para testar o editor de documentos.');

type CreatedDocument = {
  id: string;
  title: string;
};

function authHeaders() {
  return {
    authorization: `Bearer ${ACCESS_TOKEN}`,
    ...(ACTIVE_ROLE_ID ? { 'x-active-role-id': ACTIVE_ROLE_ID } : {}),
  };
}

async function createOnlineDocument(request: APIRequestContext, suffix: string): Promise<CreatedDocument> {
  const title = `E2E Docs ${suffix} ${Date.now()}`;
  const response = await request.post('/api/documents/online', {
    headers: authHeaders(),
    data: {
      title,
      category: 'GENERAL',
      sourcePath: 'E2E/Documentos colaborativos',
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  return {
    id: payload.document?.id ?? payload.id,
    title: payload.document?.title ?? payload.title ?? title,
  };
}

async function deleteDocument(request: APIRequestContext, documentId: string) {
  const response = await request.delete(`/api/documents/${documentId}`, {
    headers: authHeaders(),
  });
  expect([200, 204, 404]).toContain(response.status());
}

async function primeSession(context: BrowserContext) {
  await context.addInitScript(
    ({ token, roleId }) => {
      localStorage.setItem('accessToken', token);
      if (roleId) {
        localStorage.setItem('activeRoleId', roleId);
      } else {
        localStorage.removeItem('activeRoleId');
      }
    },
    { token: ACCESS_TOKEN, roleId: ACTIVE_ROLE_ID },
  );
}

async function openEditor(page: Page, documentId: string) {
  const websocketUrlPromise = page
    .waitForEvent('websocket', { timeout: 15_000 })
    .then((socket) => socket.url());

  await page.goto(`/documents/editor/${documentId}`, {
    waitUntil: 'domcontentloaded',
  });

  const editor = page.locator('.gestor-document-editor');
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Reconectando...')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(editor).toHaveAttribute('contenteditable', 'true', {
    timeout: 20_000,
  });

  const websocketUrl = await websocketUrlPromise;
  expect(websocketUrl).toContain('/api/document-collaboration');
  return { editor, websocketUrl };
}

async function appendTextAndWaitForSave(page: Page, documentId: string, text: string) {
  const saveResponsePromise = page.waitForResponse(
    (response) => {
      if (!response.url().includes(`/api/documents/${documentId}/editor`)) {
        return false;
      }
      if (response.request().method() !== 'PUT') return false;
      if (response.status() < 200 || response.status() >= 300) return false;
      return response.request().postData()?.includes(text) ?? false;
    },
    { timeout: 20_000 },
  );

  const editor = page.locator('.gestor-document-editor');
  await editor.click();
  await page.keyboard.type(`\n${text}`, { delay: 5 });
  await saveResponsePromise;
}

async function expectPersistedText(request: APIRequestContext, documentId: string, text: string) {
  const response = await request.get(`/api/documents/${documentId}/editor`, {
    headers: authHeaders(),
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  expect(JSON.stringify(payload)).toContain(text);
}

test.describe('Editor colaborativo de documentos', () => {
  test('salva alteracoes digitadas e mantem conteudo apos reload', async ({
    browser,
    request,
  }) => {
    const doc = await createOnlineDocument(request, 'autosave');
    const marker = `conteudo autosave ${Date.now()}`;

    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await primeSession(context);
      const page = await context.newPage();

      await openEditor(page, doc.id);
      await appendTextAndWaitForSave(page, doc.id, marker);
      await expectPersistedText(request, doc.id, marker);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.gestor-document-editor')).toContainText(marker, {
        timeout: 20_000,
      });
      await context.close();
    } finally {
      await deleteDocument(request, doc.id);
    }
  });

  test('sincroniza edicoes entre duas abas em tempo real', async ({
    browser,
    request,
  }) => {
    const doc = await createOnlineDocument(request, 'realtime');
    const markerA = `aba um ${Date.now()}`;
    const markerB = `aba dois ${Date.now()}`;

    try {
      const contextA = await browser.newContext({
        viewport: { width: 1366, height: 900 },
      });
      const contextB = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
      });
      await primeSession(contextA);
      await primeSession(contextB);
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      await openEditor(pageA, doc.id);
      await openEditor(pageB, doc.id);

      await appendTextAndWaitForSave(pageA, doc.id, markerA);
      await expect(pageB.locator('.gestor-document-editor')).toContainText(markerA, {
        timeout: 20_000,
      });

      await appendTextAndWaitForSave(pageB, doc.id, markerB);
      await expect(pageA.locator('.gestor-document-editor')).toContainText(markerB, {
        timeout: 20_000,
      });
      await expectPersistedText(request, doc.id, markerA);
      await expectPersistedText(request, doc.id, markerB);

      await contextA.close();
      await contextB.close();
    } finally {
      await deleteDocument(request, doc.id);
    }
  });
});
