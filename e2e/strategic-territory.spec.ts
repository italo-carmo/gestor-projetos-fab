import { expect, test, type Page } from "@playwright/test";

const states = [
  {
    uf: "SP",
    pressureScore: 44,
    responseScore: 5.75,
    complaints: 3,
    cpcaComplaints: 2,
    smifComplaints: 1,
    cpcaOpenComplaints: 1,
    smifOpenComplaints: 1,
    schoolSurveyTotal: 500,
    schoolSurveyYes: 500,
    domesticSurveyTotal: 100,
    domesticLast12MonthsYes: 30,
    researchSignals: 30,
    hasResearch: true,
    activities: 4,
    missions: 7,
    oms: ["OM SP"],
    localities: ["Localidade SP"],
  },
  {
    uf: "RJ",
    pressureScore: 0,
    responseScore: 0,
    complaints: 0,
    cpcaComplaints: 0,
    smifComplaints: 0,
    schoolSurveyTotal: 1000,
    schoolSurveyYes: 1000,
    domesticSurveyTotal: 0,
    domesticLast12MonthsYes: 0,
    researchSignals: 0,
    hasResearch: false,
    activities: 0,
    missions: 0,
    oms: ["OM RJ"],
    localities: [],
  },
];

async function setup(page: Page) {
  await page.route("**/*", async (route) => {
    if (!["xhr", "fetch"].includes(route.request().resourceType()))
      return route.continue();
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { items: [], total: 0 };
    if (path.endsWith("/auth/me"))
      body = {
        id: "test",
        name: "Teste Território",
        roles: [{ id: "ti", name: "TI" }],
        permissions: [{ resource: "*", action: "*", scope: "NATIONAL" }],
      };
    else if (path.endsWith("/localities")) body = [];
    else if (path.endsWith("/strategic/aggressor-profile"))
      body = { byLocality: [] };
    else if (path.endsWith("/strategic/geo-map"))
      body = {
        states,
        totalLocalitiesWithUf: 2,
        totalOmsCoveredByCpca: 1,
        summary: { statesWithCpcaComplaints: 1 },
        omsCatalog: [
          {
            id: "om-sp",
            code: "OM SP",
            name: "Organização SP",
            uf: "SP",
            hasCpca: true,
          },
        ],
      };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/dashboard/estrategico?tab=geo");
  await expect(
    page.getByText("Resumo por estado", { exact: true }),
  ).toBeVisible();
}

test("ranking exibe apenas CPCA, SMIF e VD e resumo não mostra escolas", async ({
  page,
}) => {
  await setup(page);
  const ranking = page.locator(".MuiCard-root").filter({
    has: page.getByText("Estados com maior pressão formal e amostral", {
      exact: true,
    }),
  });
  await expect(ranking.locator(".recharts-legend-item-text")).toHaveText([
    "Reportes CPCA",
    "Reportes SMIF",
    "VD 12m",
  ]);
  await expect(ranking.locator(".recharts-bar")).toHaveCount(3);
  await expect(
    ranking.locator(".recharts-yAxis").getByText("SP", { exact: true }),
  ).toBeVisible();
  await expect(
    ranking.locator(".recharts-yAxis").getByText("RJ", { exact: true }),
  ).toHaveCount(0);
  await ranking.locator(".recharts-bar-rectangle").first().hover();
  await expect(
    ranking.getByText("Pesq. escolas", { exact: false }),
  ).toHaveCount(0);
  await expect(
    ranking.getByText("Missões CIPAVD", { exact: false }),
  ).toHaveCount(0);

  const summary = page
    .locator(".MuiCard-root")
    .filter({ has: page.getByText("Resumo por estado", { exact: true }) });
  await expect(summary.getByRole("columnheader")).toHaveText([
    "UF",
    "Estado",
    "CPCA",
    "SMIF",
    "VD 12m",
    "Atividades",
    "Missões",
    "Pressão",
    "OMs",
  ]);
  const sp = summary.getByRole("row").filter({
    has: page.getByRole("cell", { name: "São Paulo", exact: true }),
  });
  await expect(
    sp.getByRole("cell", { name: "30/100", exact: true }),
  ).toBeVisible();
  await expect(
    sp.getByRole("cell", { name: "44.0", exact: true }),
  ).toBeVisible();
  await expect(sp.getByRole("cell", { name: "7", exact: true })).toBeVisible();
  await expect(
    page.getByText(/Pesq\. escolas|Pesquisa escolas|Escolas/, { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "/tmp/strategic-territory-pressure.png",
    animations: "disabled",
  });
});

test("detalhamento do estado e dos indicadores mantém a nova composição", async ({
  page,
}) => {
  await setup(page);
  const summary = page
    .locator(".MuiCard-root")
    .filter({ has: page.getByText("Resumo por estado", { exact: true }) });
  await summary.getByRole("cell", { name: "São Paulo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Reportes CPCA", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Reportes SMIF", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("VD 12m", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/escolas/i)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByText("UFs com reporte CPCA", { exact: true }).click();
  await expect(
    dialog.getByText(/pesquisa de violência doméstica/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Lista detalhada/ }).click();
  await expect(
    dialog.getByRole("columnheader", { name: "Escolas", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("columnheader", { name: "VD 12m", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "RJ", exact: true }),
  ).toHaveCount(0);
});
