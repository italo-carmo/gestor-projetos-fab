// e2e/PLAYWRIGHT_CORE_AND_SECONDARY.spec.ts
import { test, expect } from "@playwright/test";

/**
 * Fluxos E2E: core + avisos + reuniões + checklists.
 * Pré-condição: seed_demo rodado.
 */
test.describe("Core + Secondary Modules", () => {
  test("Tarefas core + relatório obrigatório", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "cipavd@smif.local");
    await page.fill("input[name=password]", "Admin123");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/dashboard/);

    await page.click("text=Tarefas");
    await page.fill("[data-testid=filter-q]", "Briefing");
    await page.click("[data-testid=tasks-table-row-0]");
    await expect(page.locator("[data-testid=task-drawer]")).toBeVisible();
    await page.click("[data-testid=task-status]");
    await page.click("text=IN_PROGRESS");
    await page.fill("[data-testid=task-progress]", "40");
    await page.click("[data-testid=task-save]");

    await page.goto("/login");
    await page.fill("input[name=email]", "gsd.bsb@smif.local");
    await page.fill("input[name=password]", "Admin123");
    await page.click("button[type=submit]");

    await page.click("text=Tarefas");
    await page.fill("[data-testid=filter-q]", "Briefing");
    await page.click("[data-testid=tasks-table-row-0]");

    await page.click("[data-testid=task-mark-done]");
    await expect(page.locator("text=Relatorio obrigatorio")).toBeVisible();

    const fileInput = page.locator("input[type=file]");
    await fileInput.setInputFiles("e2e/fixtures/relatorio_exemplo.pdf");
  });

  test("Cria aviso e reunião", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "cipavd@smif.local");
    await page.fill("input[name=password]", "Admin123");
    await page.click("button[type=submit]");

    await page.click("text=Avisos");
    await page.click("text=Novo aviso");
    await page.getByLabel("Título").fill("Aviso E2E");
    await page.getByLabel("Mensagem").fill("Mensagem automatizada");
    await page.click("button:has-text('Salvar')");
    await expect(page.locator("text=Aviso E2E")).toBeVisible();

    await page.click("text=Reunioes");
    await page.click("text=Nova reunião");
    await page.fill("input[type=datetime-local]", new Date().toISOString().slice(0, 16));
    await page.getByLabel("Pauta").fill("Pauta E2E");
    await page.click("button:has-text('Salvar')");
    await expect(page.locator("text=Pauta E2E")).toBeVisible();
  });

  test("Checklist visão por fase", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "cipavd@smif.local");
    await page.fill("input[name=password]", "Admin123");
    await page.click("button[type=submit]");

    await page.click("text=Checklists");
    await expect(page.locator("text=Checklists")).toBeVisible();
    await expect(page.locator("text=Checklist")).toBeVisible();
  });
});
