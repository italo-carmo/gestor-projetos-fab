/**
 * Debug: login, navega para /meetings e verifica se carrega sem erro de hooks.
 */
import { test, expect } from '@playwright/test';

test('meetings page loads without hooks error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/login');
  await page.fill('input[name=email]', 'admin@smif.local');
  await page.fill('input[name=password]', 'Smif@2026');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/dashboard/);

  await page.goto('/meetings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const hooksError = errors.find((t) => t.includes('Rendered more hooks'));
  if (hooksError) throw new Error(hooksError);
  await expect(page.getByRole('heading', { name: 'Reuniões' })).toBeVisible({ timeout: 5000 });
});
