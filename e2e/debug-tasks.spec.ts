/**
 * Debug: abre o browser, faz login, clica em Tarefas e captura erros do console.
 * Rodar: E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/debug-tasks.spec.ts --headed
 */
import { test, expect } from '@playwright/test';

test('abrir tarefas e capturar console', async ({ page }) => {
  const consoleLogs: { type: string; text: string }[] = [];
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      console.error('[BROWSER CONSOLE ERROR]', text);
    }
  });

  await page.goto('/login');
  await page.fill('input[name=email]', 'cipavd@smif.local');
  await page.fill('input[name=password]', 'Admin123');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL(/dashboard/);
  await page.click('text=Tarefas');
  await page.waitForURL(/\/tasks/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const errors = consoleLogs.filter((e) => e.type === 'error');
  if (errors.length > 0) {
    console.log('--- Erros do console ---');
    errors.forEach((e) => console.log(e.text));
    throw new Error(errors.map((e) => e.text).join('\n'));
  }
});
