import { expect, test, type Page } from "@playwright/test";
import dashboards from "./fixtures/bi-empty-dashboards.json";

const options = [
  { id: "group-a", code: "COMGEP", name: "Comando-Geral do Pessoal" },
  { id: "group-b", code: "COMGAP", name: "Comando-Geral de Apoio" },
];
const paths: Record<string, keyof typeof dashboards> = {
  surveys: "schools",
  "domestic-violence": "domestic-violence",
  recruits: "recruits",
  "best-practices-cycle": "best-practices-cycle",
  "cpca-meeting": "cpca-meeting",
  "gsd-evaluation": "gsd-evaluation",
};

async function setup(page: Page) {
  const reads: URL[] = [];
  const notebooks: any[] = [];
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (!["fetch", "xhr"].includes(req.resourceType())) return route.continue();
    const url = new URL(req.url());
    const path = url.pathname;
    reads.push(url);
    let body: unknown = { items: [], total: 0 };
    if (path.endsWith("/auth/me"))
      body = {
        id: "test",
        name: "Teste BI",
        roles: [{ id: "ti", name: "TI" }],
        permissions: [{ resource: "*", action: "*", scope: "NATIONAL" }],
      };
    else if (path.endsWith("/localities")) body = [];
    else if (path.endsWith("/bi/odgsas")) body = options;
    else if (path.endsWith("/dashboard") && path.includes("/bi/")) {
      const tab = paths[path.split("/").at(-2)!];
      body = dashboards[tab];
    } else if (path.endsWith("/pdf")) {
      if (req.method() === "POST") notebooks.push(req.postDataJSON());
      return route.fulfill({
        contentType: "application/pdf",
        body: "%PDF-1.4\n%%EOF",
        headers: { "content-disposition": 'attachment; filename="bi.pdf"' },
      });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { reads, notebooks };
}

for (const [path, tab] of Object.entries(paths)) {
  test(`${tab}: respeita a aplicabilidade de ODGSA nas consultas e no PDF`, async ({ page }) => {
    const { reads } = await setup(page);
    await page.goto(`/dashboard/bi?tab=${tab}&odgsaId=group-a`);
    await expect(
      page.getByRole("combobox", { name: "ODGSA", exact: true }),
    ).toHaveValue(/COMGEP/);
    await expect
      .poll(() =>
        reads.some(
          (url) =>
            url.pathname.endsWith(`/bi/${path}/dashboard`) &&
            url.searchParams.get("odgsaId") === (tab === "recruits" ? null : "group-a"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        reads.some(
          (url) =>
            url.pathname.endsWith(`/bi/${path}/responses`) &&
            url.searchParams.get("odgsaId") === (tab === "recruits" ? null : "group-a"),
        ),
      )
      .toBe(true);
    if (tab === "recruits")
      await expect(
        page.getByText(
          "A pesquisa de Recrutas não identifica a OM das respostas.",
          { exact: false },
        ),
      ).toBeVisible();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: /Exportar PDF|Exportar painel|^PDF$/ })
      .click();
    await download;
    expect(
      reads.some(
        (url) =>
          url.pathname.endsWith("/dashboard/pdf") &&
          url.searchParams.get("odgsaId") === (tab === "recruits" ? null : "group-a"),
      ),
    ).toBe(true);
  });
}

test("seleção acompanha abas e o caderno executivo; limpar restaura a consulta geral", async ({
  page,
}) => {
  const { reads, notebooks } = await setup(page);
  await page.goto("/dashboard/bi");
  const select = page.getByRole("combobox", { name: "ODGSA", exact: true });
  await select.fill("COMGEP");
  await page.getByRole("option", { name: /COMGEP/ }).click();
  await expect(page).toHaveURL(/odgsaId=group-a/);
  await page.getByRole("tab", { name: "Escolas", exact: true }).click();
  await expect(select).toHaveValue(/COMGEP/);
  await expect
    .poll(() =>
      reads.some(
        (url) =>
          url.pathname.endsWith("/bi/surveys/dashboard") &&
          url.searchParams.get("odgsaId") === "group-a",
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Caderno PDF", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(
      /O ODGSA selecionado será aplicado aos painéis deste caderno, exceto/,
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Selecionar todos/ }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /Gerar caderno/ }).click();
  await download;
  expect(notebooks.at(-1).panels.length).toBe(6);
  expect(
    notebooks
      .at(-1)
      .panels.every((panel: any) => panel.key === "recruits" ? !panel.filters.odgsaId : panel.filters.odgsaId === "group-a"),
  ).toBe(true);
  await expect(dialog).toBeHidden();
  await select.hover();
  await page.getByRole("button", { name: "Limpar ODGSA", exact: true }).click();
  await expect(page).not.toHaveURL(/odgsaId=/);
  await expect
    .poll(() =>
      reads.some(
        (url) =>
          url.pathname.endsWith("/bi/surveys/dashboard") &&
          !url.searchParams.has("odgsaId"),
      ),
    )
    .toBe(true);
});
