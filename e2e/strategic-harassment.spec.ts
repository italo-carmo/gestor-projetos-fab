import { expect, test, type Locator, type Page } from "@playwright/test";
import type { StrategicComplaintDetailItem } from "../frontend/src/features/strategicComplaintDetails";

const moralCases: StrategicComplaintDetailItem[] = [
  {
    id: "moral-1",
    caseNumber: "MORAL-001",
    title: "Reporte MORAL-001",
    complaintType: "MORAL",
    workflowScope: "CPCA",
    status: "INVESTIGATION",
    omId: "om-a",
    omLabel: "OM A - Organização A",
    date: "2026-11-10T12:00:00Z",
    processOpened: true,
    procedureType: "SINDICANCIA",
    subsequentProcedureOpened: true,
    subsequentProcedureType: "IPM",
    link: "/cpca-cases?q=MORAL-001",
  },
  {
    id: "moral-2",
    caseNumber: "MORAL-002",
    title: "Reporte MORAL-002",
    complaintType: "MORAL",
    workflowScope: "SMIF",
    status: "RECEIVED",
    omId: "om-b",
    omLabel: "OM B - Organização B",
    date: "2026-11-09T12:00:00Z",
    processOpened: false,
    procedureType: "NOT_DEFINED",
    subsequentProcedureOpened: false,
    subsequentProcedureType: null,
    link: "/cpca-cases?scope=SMIF&q=MORAL-002",
  },
  {
    id: "moral-3",
    caseNumber: "MORAL-003",
    title: "Reporte MORAL-003",
    complaintType: "MORAL",
    workflowScope: "SMIF",
    status: "CONCLUDED",
    omId: "om-b",
    omLabel: "OM B - Organização B",
    date: "2026-11-08T12:00:00Z",
    processOpened: true,
    procedureType: "PAD",
    subsequentProcedureOpened: false,
    subsequentProcedureType: null,
    link: "/cpca-cases?scope=SMIF&q=MORAL-003",
  },
];
const sexualCases: StrategicComplaintDetailItem[] = [
  {
    ...moralCases[0],
    id: "sexual-1",
    caseNumber: "SEXUAL-001",
    title: "Reporte SEXUAL-001",
    complaintType: "SEXUAL",
    procedureType: "APF",
    subsequentProcedureOpened: false,
    subsequentProcedureType: null,
    link: "/cpca-cases?q=SEXUAL-001",
  },
];

const chartDimensions = [
  "Posto autor",
  "Gênero autor",
  "Idade autor",
  "Posto vítima",
  "Gênero vítima",
  "Idade vítima",
  "Tipo detalhado",
  "Contexto",
  "Local",
  "Frequência",
  "Forma",
];

async function setup(
  page: Page,
  cases = moralCases,
  options: {
    openMoral?: boolean;
    charts?: boolean;
    emptySexual?: boolean;
  } = {},
) {
  const allCases = [...cases, ...(options.emptySexual ? [] : sexualCases)];
  await page.route("**/*", async (route) => {
    if (!["xhr", "fetch"].includes(route.request().resourceType()))
      return route.continue();
    const url = new URL(route.request().url());
    const path = url.pathname;
    const complaintType = url.searchParams.get("complaintType");
    const filteredCases = allCases.filter(
      (item) => !complaintType || item.complaintType === complaintType,
    );
    const moral = filteredCases.filter(
      (item) => item.complaintType === "MORAL",
    );
    const sexual = filteredCases.filter(
      (item) => item.complaintType === "SEXUAL",
    );
    const percent = (count: number) =>
      filteredCases.length ? (count * 100) / filteredCases.length : 0;
    const distribution = (dimension: string) =>
      !options.charts
        ? []
        : [
            ...(moral.length
              ? [
                  {
                    label: `${dimension} moral`,
                    count: moral.length,
                    percent: percent(moral.length),
                  },
                ]
              : []),
            ...(sexual.length
              ? [
                  {
                    label: `${dimension} sexual`,
                    count: sexual.length,
                    percent: percent(sexual.length),
                  },
                ]
              : []),
          ];
    let body: unknown = { items: [], total: 0 };
    if (path.endsWith("/auth/me"))
      body = {
        id: "test",
        name: "Teste Painel",
        roles: [{ id: "ti", name: "TI" }],
        permissions: [{ resource: "*", action: "*", scope: "NATIONAL" }],
      };
    else if (path.endsWith("/localities")) body = [];
    else if (path.endsWith("/procedure-summary"))
      body = {
        items: filteredCases.filter(
          (item) =>
            item.processOpened &&
            item.workflowScope ===
              (path.includes("/smif-complaints/") ? "SMIF" : "CPCA"),
        ),
      };
    else if (path.endsWith("/strategic/aggressor-profile"))
      body = {
        totalCases: filteredCases.length,
        byComplaintType: {
          moral: { count: moral.length, percent: percent(moral.length) },
          sexual: { count: sexual.length, percent: percent(sexual.length) },
        },
        hierarchicalRelation: { count: 0, percent: 0 },
        aggressorProfile: {
          byRank: distribution("Posto autor"),
          byGender: distribution("Gênero autor"),
          byAgeRange: distribution("Idade autor"),
        },
        victimProfile: {
          byRank: distribution("Posto vítima"),
          byGender: distribution("Gênero vítima"),
          byAgeRange: distribution("Idade vítima"),
        },
        context: {
          byViolenceType: distribution("Tipo detalhado"),
          byHarassmentContext: distribution("Contexto"),
          byLocation: distribution("Local"),
          byFrequency: distribution("Frequência"),
          byForm: distribution("Forma"),
        },
        byScope: [],
        detailItems: {
          total: filteredCases,
          moral,
          sexual,
        },
      };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/dashboard/estrategico");
  if (options.openMoral !== false)
    await page.getByText("Assédio Moral", { exact: true }).click();
  return page.getByRole("dialog");
}

function metric(dialog: Locator, label: string) {
  return dialog
    .getByText(label, { exact: true })
    .first()
    .locator("..")
    .getByRole("heading");
}

async function select(
  page: Page,
  dialog: Locator,
  label: string,
  option: string,
) {
  await dialog.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("lista aberta separa os casos e os procedimentos de moral e sexual", async ({
  page,
}) => {
  const dialog = await setup(page);
  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(dialog.getByText("MORAL-001", { exact: true })).toBeVisible();
  await expect(dialog.getByText("MORAL-003", { exact: true })).toBeVisible();
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("3");
  await expect(
    dialog.getByRole("button", { name: "IPM: 1", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("SEXUAL-001", { exact: true })).toHaveCount(0);
  await expect(dialog.locator(".MuiAccordion-root")).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Abrir MORAL-001" }),
  ).toHaveAttribute("href", "/cpca-cases?q=MORAL-001");
  await page.screenshot({
    path: "/tmp/strategic-harassment-desktop.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByText("Assédio Sexual", { exact: true }).click();
  await expect(dialog.getByText("SEXUAL-001", { exact: true })).toBeVisible();
  await expect(dialog.getByText("MORAL-001", { exact: true })).toHaveCount(0);
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("1");
  await expect(
    dialog.getByRole("button", { name: "APF: 1", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "IPM: 1", exact: true }),
  ).toHaveCount(0);
});

test("combina filtros, atualiza contagens, trata vazio e limpa ao reabrir", async ({
  page,
}) => {
  const dialog = await setup(page);
  await dialog.getByRole("combobox", { name: "OM", exact: true }).fill("OM A");
  await page
    .getByRole("option", { name: "OM A - Organização A", exact: true })
    .click();
  await select(page, dialog, "Procedimento instaurado", "IPM");
  await select(page, dialog, "Situação do caso", "Em apuração");
  await select(page, dialog, "Escopo", "CPCA");
  await expect(
    dialog.getByText("Casos listados · 1 de 3", { exact: true }),
  ).toBeVisible();
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("2");
  await dialog
    .getByRole("textbox", { name: "Buscar caso" })
    .fill("inexistente");
  await expect(
    dialog.getByText("Nenhum caso encontrado com os filtros selecionados."),
  ).toBeVisible();
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("0");
  await dialog
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await select(
    page,
    dialog,
    "Procedimento instaurado",
    "Sem procedimento instaurado",
  );
  await expect(dialog.getByText("MORAL-002", { exact: true })).toBeVisible();
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("0");
  await expect(metric(dialog, "Sem procedimento instaurado")).toHaveText("1");
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByText("Assédio Moral", { exact: true }).click();
  await expect(
    dialog.getByText("Casos listados · 3 de 3", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "PAD: 1", exact: true }).click();
  await expect(dialog.getByText("MORAL-003", { exact: true })).toBeVisible();
  await expect(dialog.getByText("MORAL-001", { exact: true })).toHaveCount(0);
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("1");
});

test("paginação mantém o total do recorte e volta à primeira página ao buscar", async ({
  page,
}) => {
  const manyCases = Array.from({ length: 13 }, (_, index) => ({
    ...moralCases[0],
    id: `moral-${index + 1}`,
    caseNumber: `MORAL-${String(index + 1).padStart(3, "0")}`,
    title: `Reporte MORAL-${String(index + 1).padStart(3, "0")}`,
  }));
  const dialog = await setup(page, manyCases);
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("26");
  await expect(dialog.getByRole("row")).toHaveCount(11);
  await dialog.getByRole("button", { name: "Próxima página" }).click();
  await expect(dialog.getByText("MORAL-013", { exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Buscar caso" }).fill("MORAL-001");
  await expect(dialog.getByText("MORAL-001", { exact: true })).toBeVisible();
  await expect(metric(dialog, "Procedimentos instaurados")).toHaveText("2");
});

test("filtros e tabela continuam acessíveis no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await setup(page);
  await dialog.getByRole("textbox", { name: "Buscar caso" }).fill("moral-001");
  await expect(dialog.getByText("MORAL-001", { exact: true })).toBeVisible();
  const content = dialog.locator(".MuiDialogContent-root");
  expect(
    await content.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await dialog.getByText("MORAL-001", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "/tmp/strategic-harassment-mobile.png",
    animations: "disabled",
  });
});

test("tipo de reporte inicia em Todos e filtra os onze gráficos, indicadores e procedimentos", async ({
  page,
}) => {
  const requests: URL[] = [];
  page.on("request", (request) => {
    if (["xhr", "fetch"].includes(request.resourceType()))
      requests.push(new URL(request.url()));
  });
  await setup(page, moralCases, { openMoral: false, charts: true });
  const reportType = page.getByRole("combobox", {
    name: /^Tipo de Reporte/,
  });
  await expect(reportType).toHaveText("Todos");
  const total = page
    .getByText("Casos analisados", { exact: true })
    .locator("..")
    .getByRole("heading");
  const procedures = page
    .getByText("Procedimentos administrativos", { exact: true })
    .locator("..")
    .getByRole("heading");
  const axisLabels = page.locator(".recharts-yAxis");
  await expect(total).toHaveText("4");
  await expect(procedures).toHaveText("3");
  for (const dimension of chartDimensions) {
    await expect(
      axisLabels.getByText(`${dimension} moral`, { exact: true }),
    ).toBeVisible();
    await expect(
      axisLabels.getByText(`${dimension} sexual`, { exact: true }),
    ).toBeVisible();
  }

  for (const [label, type, totalCount, procedureCount] of [
    ["Moral", "MORAL", "3", "2"],
    ["Sexual", "SEXUAL", "1", "1"],
    ["Todos", null, "4", "3"],
  ] as const) {
    await reportType.click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(total).toHaveText(totalCount);
    await expect(procedures).toHaveText(procedureCount);
    for (const dimension of chartDimensions) {
      await expect(
        axisLabels.getByText(`${dimension} moral`, { exact: true }),
      ).toHaveCount(type === "SEXUAL" ? 0 : 1);
      await expect(
        axisLabels.getByText(`${dimension} sexual`, { exact: true }),
      ).toHaveCount(type === "MORAL" ? 0 : 1);
    }
    for (const path of [
      "/strategic/aggressor-profile",
      "/cpca-cases/procedure-summary",
      "/smif-complaints/procedure-summary",
    ]) {
      await expect
        .poll(() =>
          requests.some(
            (url) =>
              url.pathname.endsWith(path) &&
              url.searchParams.get("complaintType") === type,
          ),
        )
        .toBe(true);
    }
  }

  await page.screenshot({
    path: "/tmp/strategic-report-type-filter.png",
    animations: "disabled",
  });
});

test("permite voltar a Todos quando o tipo selecionado não tem reportes", async ({
  page,
}) => {
  await setup(page, moralCases, {
    openMoral: false,
    charts: true,
    emptySexual: true,
  });
  const reportType = page.getByRole("combobox", {
    name: /^Tipo de Reporte/,
  });
  await reportType.click();
  await page.getByRole("option", { name: "Sexual", exact: true }).click();
  await expect(
    page.getByText("Nenhum reporte encontrado para o tipo selecionado."),
  ).toBeVisible();
  await expect(reportType).toBeVisible();
  await expect(reportType).toHaveText("Sexual");
  await expect(page.locator(".recharts-wrapper")).toHaveCount(0);
  await reportType.click();
  await page.getByRole("option", { name: "Todos", exact: true }).click();
  await expect(
    page.getByText("Posto vítima moral", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum reporte encontrado para o tipo selecionado."),
  ).toHaveCount(0);
});
