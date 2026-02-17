// e2e/PLAYWRIGHT_CORE_AND_SECONDARY.spec.ts
import { test, expect } from "@playwright/test";

/**
 * Fluxos E2E: core + avisos + reuniões + checklists.
 * Pré-condição: seed_demo rodado.
 */
test.describe("Core + Secondary Modules", () => {
  test("Tarefas core + edição no drawer", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "admin@smif.local");
    await page.fill("input[name=password]", "Smif@2026");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/tasks");
    await expect(page.locator("[data-testid=filter-q]")).toBeVisible();
    await page.fill("[data-testid=filter-q]", "Briefing");
    await page.locator(".MuiDataGrid-row").first().click();
    await expect(page.locator("[data-testid=task-drawer]")).toBeVisible();
    await expect(page.locator("[data-testid=task-status]")).toBeVisible();
    await expect(page.locator("[data-testid=task-progress]")).toBeVisible();
    await expect(page.locator("[data-testid=task-assign]")).toBeVisible();
  });

  test("Cria aviso e reunião", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "admin@smif.local");
    await page.fill("input[name=password]", "Smif@2026");
    await page.click("button[type=submit]");

    await page.click("text=Avisos");
    await page.click("text=Novo aviso");
    await page.getByLabel("Título").fill("Aviso E2E");
    await page.getByLabel("Mensagem").fill("Mensagem automatizada");
    await page.click("button:has-text('Salvar')");
    await expect(page.getByText("Aviso E2E").first()).toBeVisible();

    await page.click("text=Reuniões");
    await page.click("text=Nova reunião");
    await page.fill("input[type=datetime-local]", new Date().toISOString().slice(0, 16));
    await page.getByLabel("Escopo (o que será tratado)").fill("Escopo E2E");
    await page.getByLabel("Pauta").fill("Pauta E2E");
    await page.click("button:has-text('Salvar')");
    await expect(page.getByText("Escopo E2E").first()).toBeVisible();
  });

  test("Checklist visão por fase", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "admin@smif.local");
    await page.fill("input[name=password]", "Smif@2026");
    await page.click("button[type=submit]");

    await page.click("text=Checklists");
    await expect(page.locator("text=Checklists")).toBeVisible();
    await expect(page.locator("text=Checklist")).toBeVisible();
  });
});
