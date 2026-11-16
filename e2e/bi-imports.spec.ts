import { expect, test, type Page } from "@playwright/test";
import dashboards from "./fixtures/bi-empty-dashboards.json";

const sources = [
  ["domestic-violence", "domestic_violence"],
  ["recruits", "recruits"],
  ["best-practices-cycle", "best_practices_cycle"],
  ["cpca-meeting", "cpca_meeting"],
] as const;

async function mockApi(page: Page, tab: keyof typeof dashboards, prefix = "") {
  const state = { mode: "empty", writes: 0, dashboardReads: 0 };
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType()))
      return route.continue();
    const path = new URL(request.url()).pathname;
    let body: unknown = { items: [], total: 0 };
    let status = 200;
    if (path.endsWith("/bi/odgsas")) {
      body = [];
    } else if (path.endsWith("/auth/me")) {
      body = {
        id: "test",
        name: "Teste BI",
        roles: [{ id: "ti", name: "TI" }],
        permissions: [{ resource: "*", action: "*", scope: "NATIONAL" }],
      };
    } else if (path.endsWith("/localities")) body = [];
    else if (path.endsWith("/dashboard") && path.includes("/bi/")) {
      state.dashboardReads++;
      body = dashboards[tab];
    } else if (path.endsWith("/import-api") || path.endsWith("/import")) {
      const payload = request.postData() ?? "";
      const preview =
        payload.includes('"preview":true') ||
        /name="preview"\r\n\r\ntrue/.test(payload);
      if (state.mode === "error") {
        status = 400;
        body = {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos.",
          details: { reason: `${prefix}_api_timeout` },
        };
      } else if (preview) {
        body = {
          previewOnly: true,
          sync: { fetchedRows: state.mode === "empty" ? 0 : 1 },
          normalization: {
            totalRows: 1,
            suggestions: [],
            unresolved: [],
            summary: { suggestionCount: 0, unresolvedCount: 0 },
          },
        };
      } else {
        state.writes++;
        body = {
          batch: { insertedRows: 1, duplicateRows: 0, invalidRows: 0 },
          normalization: { updatedFields: 0 },
          sync: { fetchedRows: 1 },
        };
      }
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto(`/dashboard/bi?tab=${tab}`);
  return state;
}

for (const [tab, prefix] of sources) {
  test(`${tab}: botão informa ausência de novidades, erro e confirma importação`, async ({
    page,
  }) => {
    const state = await mockApi(page, tab, prefix);
    await page.getByText("Sincronização via API", { exact: true }).click();
    const action = page.getByRole("button", {
      name: /Buscar novos registros|Sincronizar/i,
    });
    const readsBeforeEmpty = state.dashboardReads;
    await action.click();
    await expect(page.getByRole("status")).toContainText(
      "não retornou novos registros",
    );
    await expect.poll(() => state.dashboardReads).toBeGreaterThan(readsBeforeEmpty);
    expect(state.writes).toBe(0);
    state.mode = "error";
    await action.click();
    await expect(page.getByRole("status")).toContainText(
      "Google Sheets demorou para responder",
    );
    state.mode = "new";
    await action.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const before = state.dashboardReads;
    await dialog
      .getByRole("button", {
        name:
          tab === "recruits" ? "Importar" : "Importar sem aplicar correções",
      })
      .click();
    await expect(page.getByRole("status")).toContainText("Inseridos: 1");
    expect(state.writes).toBe(1);
    await expect.poll(() => state.dashboardReads).toBeGreaterThan(before);
  });
}

for (const tab of ["schools", "gsd-evaluation"] as const) {
  test(`${tab}: importa arquivo e atualiza o painel`, async ({ page }) => {
    const state = await mockApi(page, tab);
    state.mode = "new";
    await page.getByText("Ingestão de dados", { exact: true }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(
        tab === "schools"
          ? "frontend/public/templates/bi-survey-template.csv"
          : "frontend/public/templates/bi-avaliacao-gsd-template.csv",
      );
    const before = state.dashboardReads;
    await page
      .getByRole("button", {
        name: tab === "schools" ? "Substituir base no banco" : "Importar",
        exact: true,
      })
      .click();
    if (tab === "schools")
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Importar sem aplicar correções" })
        .click();
    await expect(page.getByRole("status")).toContainText("Inseridos: 1");
    expect(state.writes).toBe(1);
    await expect.poll(() => state.dashboardReads).toBeGreaterThan(before);
  });
}
