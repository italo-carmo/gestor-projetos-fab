import { expect, test, type Page } from "@playwright/test";

function report(id: string, status: string) {
  return {
    id,
    caseNumber: id,
    status,
    workflowScope: "CPCA",
    localityId: "om",
    omId: "om",
    locality: { id: "om", code: "OM", name: "Organização" },
    complaintType: "MORAL",
    detailedViolenceType: "ASSEDIO_MORAL",
    notifierType: "VITIMA",
    aggressorRank: "CAPITAO",
    aggressorGender: "MASCULINO",
    victimRank: "SOLDADO",
    victimGender: "FEMININO",
    victimIsNotifier: true,
    reportedAt: "2026-11-10T12:00:00Z",
    incidentDate: "2026-11-09T12:00:00Z",
    updatedAt: "2026-11-11T12:00:00Z",
    processOpened: true,
    procedureType: "IPM",
    procedureCurrentSituation: "",
    procedureStartDate: "2026-11-10T12:00:00Z",
    occurrenceForms: ["HUMILHACAO_PUBLICA"],
    incidentFrequency: "DUAS_VEZES",
    outcomeSummary: "",
    accusedDefenseEnsured: false,
    validation: { isValidated: true },
    comments: [],
    statusHistory: [],
  };
}

async function setup(page: Page, scope = "CPCA") {
  const rows = [
    report("ABERTO", "INVESTIGATION"),
    report("TRIAGEM", "RECEIVED"),
    report("FECHADO", "CONCLUDED"),
    report("LEGADO", "ARCHIVED"),
  ].map((row) => ({ ...row, workflowScope: scope }));
  const writes: Record<string, unknown>[] = [];
  const statusOf = (row: { status: string }) =>
    ["CONCLUDED", "ARCHIVED"].includes(row.status)
      ? "CONCLUDED"
      : "INVESTIGATION";
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!["xhr", "fetch"].includes(request.resourceType()))
      return route.continue();
    const url = new URL(request.url());
    const path = url.pathname;
    const filter = url.searchParams.get("status");
    let body: unknown = { items: [], total: 0 };
    if (path.endsWith("/auth/me"))
      body = {
        id: "user",
        name: "Teste Reportes",
        roles: [{ id: "ti", name: "TI" }],
        permissions: [{ resource: "*", action: "*", scope: "NATIONAL" }],
      };
    else if (path.endsWith("/localities")) body = [rows[0].locality];
    else if (path.endsWith("/locality-options"))
      body = { items: [rows[0].locality] };
    else if (path.endsWith("/postos/options"))
      body = { items: [{ name: "CAPITAO" }, { name: "SOLDADO" }] };
    else if (path.endsWith("/cpca-cases/stats"))
      body = {
        summary: {
          totalCases: 4,
          openCases: 2,
          concludedCases: 2,
          archivedCases: 0,
          closureRatePercent: 50,
        },
        statusDistribution: [
          { status: "INVESTIGATION", count: 2 },
          { status: "CONCLUDED", count: 2 },
        ],
      };
    else if (/\/(cpca-cases|smif-complaints)$/.test(path))
      body = {
        items: rows.filter((row) => !filter || statusOf(row) === filter),
        total: rows.filter((row) => !filter || statusOf(row) === filter).length,
      };
    else {
      const row = rows.find((item) => path.endsWith(`/${item.id}`));
      if (row) {
        if (request.method() === "PUT") {
          const payload = request.postDataJSON();
          writes.push(payload);
          Object.assign(row, payload);
        }
        body = row;
      }
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { writes };
}

for (const scope of ["CPCA", "SMIF"]) {
  test(`${scope}: adiciona vítimas com ocorrências próprias, salva, reabre e remove mantendo os dados`, async ({
    page,
  }, testInfo) => {
    const { writes } = await setup(page, scope);
    await page.goto(`/cpca-cases${scope === "SMIF" ? "?scope=SMIF" : ""}`);
    await page.locator("tr").filter({ hasText: "ABERTO" }).click();
    const first = page.getByRole("region", { name: "Vítima 1", exact: true });
    const second = page.getByRole("region", { name: "Vítima 2", exact: true });
    const select = async (
      region: typeof first,
      name: RegExp,
      label: string,
    ) => {
      await region.getByRole("combobox", { name }).click();
      await page.getByRole("option", { name: label, exact: true }).click();
    };
    await expect(
      first.getByRole("combobox", { name: /^Frequência/ }),
    ).toHaveText("Duas vezes");
    await select(first, /^Relação hierárquica/, "Superior hierárquico");
    await page
      .getByRole("button", { name: "Adicionar mais vítimas", exact: true })
      .click();
    await expect(second).toBeVisible();
    await expect(
      second.getByRole("combobox", { name: /^Posto\/grad/ }),
    ).toHaveText(/^[\s\u200b]*$/);
    await expect(
      second.getByRole("combobox", { name: /^Forma de ocorrência/ }),
    ).toHaveText("Selecionar");
    await expect(
      second.getByRole("combobox", { name: /^Posto\/grad/ }),
    ).toHaveAttribute("aria-invalid", "true");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert", { includeHidden: true })
        .filter({ hasText: "Informe o posto/graduação da vítima 2." }),
    ).toBeVisible();
    expect(writes).toHaveLength(0);
    await select(second, /^Posto\/grad/, "CAPITAO");
    await select(second, /^Sexo da vítima/, "Masculino");
    await select(second, /^Faixa etária/, "31 a 35 anos");
    await select(second, /^Frequência/, "Uma vez");
    await select(second, /^Relação hierárquica/, "Mesma Graduação");
    await select(second, /^Forma de ocorrência/, "Ameaças/Intimidação");
    await page.keyboard.press("Escape");
    await second
      .getByRole("radio", { name: "Esta vítima é a noticiante" })
      .check();
    await expect(
      first.getByRole("combobox", { name: /^Frequência/ }),
    ).toHaveText("Duas vezes");
    await expect(
      first.getByRole("combobox", { name: /^Forma de ocorrência/ }),
    ).toHaveText("Humilhação Pública");
    await first
      .locator("..")
      .screenshot({ path: testInfo.outputPath("victims.png") });
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({
      victimRank: "SOLDADO",
      notifierRank: "CAPITAO",
      notifierGender: "MASCULINO",
      victims: [
        {
          victimRank: "SOLDADO",
          victimGender: "FEMININO",
          incidentFrequency: "DUAS_VEZES",
          hierarchicalFunctionalRelation: "SUPERIOR_HIERARQUICO",
          occurrenceForms: ["HUMILHACAO_PUBLICA"],
          isNotifier: false,
        },
        {
          victimRank: "CAPITAO",
          victimGender: "MASCULINO",
          victimAgeRange: "31_35",
          incidentFrequency: "UMA_VEZ",
          hierarchicalFunctionalRelation: "MESMA_GRADUACAO",
          occurrenceForms: ["AMEACAS_INTIMIDACAO"],
          isNotifier: true,
        },
      ],
    });
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.locator(".MuiDrawer-modal")).not.toBeVisible();
    await expect(
      page.locator("tr").filter({ hasText: "ABERTO" }),
    ).toContainText("2 vítimas");
    await page.locator("tr").filter({ hasText: "ABERTO" }).click();
    await expect(
      second.getByRole("combobox", { name: /^Frequência/ }),
    ).toHaveText("Uma vez");
    await expect(
      second.getByRole("radio", { name: "Esta vítima é a noticiante" }),
    ).toBeChecked();
    await first.getByRole("button", { name: "Remover vítima 1" }).click();
    await expect(second).toHaveCount(0);
    await expect(
      first.getByRole("combobox", { name: /^Posto\/grad/ }),
    ).toHaveText("CAPITAO");
    await expect(
      first.getByRole("combobox", { name: /^Forma de ocorrência/ }),
    ).toHaveText("Ameaças/Intimidação");
    await expect(first.getByRole("button", { name: /Remover/ })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].victims).toHaveLength(1);
    expect(writes[1]).toMatchObject({
      victimRank: "CAPITAO",
      incidentFrequency: "UMA_VEZ",
      occurrenceForms: ["AMEACAS_INTIMIDACAO"],
    });
    if (scope === "SMIF") {
      await page.setViewportSize({ width: 390, height: 844 });
      const drawer = page.locator(".MuiDrawer-paperAnchorRight");
      await expect(first).toBeVisible();
      expect(
        await drawer.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    }
  });

  test(`${scope}: processo aberto exige data de início e sinaliza o campo vazio em vermelho`, async ({
    page,
  }) => {
    const { writes } = await setup(page, scope);
    await page.goto(`/cpca-cases${scope === "SMIF" ? "?scope=SMIF" : ""}`);
    await page.locator("tr").filter({ hasText: "ABERTO" }).click();
    await page.getByRole("button", { name: /3\) Triagem e apuração/ }).click();
    const process = page.getByRole("combobox", {
      name: /^Abriu processo apuratório/,
    });
    const start = page.getByLabel("Data de início do procedimento", {
      exact: false,
    });
    await process.click();
    await page.getByRole("option", { name: "Não", exact: true }).click();
    await expect(start).toHaveCount(0);
    await process.click();
    await page.getByRole("option", { name: "Sim", exact: true }).click();
    await expect(start).toHaveValue("");
    await expect(start).toHaveAttribute("required", "");
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await expect(start.locator("..")).toHaveClass(/Mui-error/);
    await page
      .getByRole("combobox", { name: /^Procedimento administrativo/ })
      .click();
    await page.getByRole("option", { name: "IPM", exact: true }).click();
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert", { includeHidden: true })
        .filter({ hasText: "Informe a data de início do procedimento." }),
    ).toBeVisible();
    expect(writes).toHaveLength(0);
    await start.fill("2026-11-12");
    await expect(start).toHaveAttribute("aria-invalid", "false");
    await expect(start.locator("..")).not.toHaveClass(/Mui-error/);
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({
      processOpened: true,
      procedureStartDate: "2026-11-12",
    });
  });

  test(`${scope}: etapa 4 e filtros oferecem dois status; salvar usa concluído e legado é exibido como concluído`, async ({
    page,
  }) => {
    const { writes } = await setup(page, scope);
    await page.goto(`/cpca-cases${scope === "SMIF" ? "?scope=SMIF" : ""}`);
    await page.locator("tr").filter({ hasText: "ABERTO" }).click();
    await page.getByRole("button", { name: /4\) Acompanhamento/ }).click();
    const conclusion = page.getByRole("combobox", {
      name: /^Status de conclusão/,
    });
    await expect(conclusion).toHaveText("Em apuração");
    await conclusion.click();
    await expect(page.getByRole("option")).toHaveText([
      "Em apuração",
      "Concluído",
    ]);
    await page.getByRole("option", { name: "Concluído", exact: true }).click();
    await page
      .getByLabel("Ampla defesa e contraditório assegurados", { exact: true })
      .check();
    await page
      .getByRole("textbox", { name: "Síntese do resultado", exact: true })
      .fill("Apuração finalizada e resultado comunicado.");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].status).toBe("CONCLUDED");
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.locator(".MuiDrawer-modal")).not.toBeVisible();

    await page.locator("tr").filter({ hasText: "LEGADO" }).click();
    await page.getByRole("button", { name: /4\) Acompanhamento/ }).click();
    await expect(conclusion).toHaveText("Concluído");
    await conclusion.click();
    await expect(page.getByRole("option")).toHaveText([
      "Em apuração",
      "Concluído",
    ]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.locator(".MuiDrawer-modal")).not.toBeVisible();

    const status = page
      .getByRole("combobox", { name: /^Status(?:\s|$)/ })
      .first();
    await status.click();
    await expect(page.getByRole("option")).toHaveText([
      "Todos",
      "Em apuração",
      "Concluído",
    ]);
    await page.getByRole("option", { name: "Concluído", exact: true }).click();
    await expect(page).toHaveURL(/status=CONCLUDED/);
    await expect(
      page.locator("tr").filter({ hasText: "LEGADO" }),
    ).toContainText("Concluído");
    await expect(page.locator("tr").filter({ hasText: "TRIAGEM" })).toHaveCount(
      0,
    );
  });
}

test("indicadores e gráfico separam somente em apuração e concluído", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/dashboard/cpca");
  await expect(
    page.getByText("2 casos concluídos", { exact: false }),
  ).toBeVisible();
  const chart = page.locator(".MuiCard-root").filter({
    has: page.getByText("Distribuição por status", { exact: true }),
  });
  await expect(
    chart.locator(".recharts-xAxis").getByText("Em apuração", { exact: true }),
  ).toBeVisible();
  await expect(
    chart.locator(".recharts-xAxis").getByText("Concluído", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Arquivadas|arquivadas|Arquivada/, { exact: false }),
  ).toHaveCount(0);
});
