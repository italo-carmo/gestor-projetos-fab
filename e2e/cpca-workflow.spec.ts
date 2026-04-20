import { test, expect, type Page } from '@playwright/test';
import {
  cleanupCpcaE2eNamespace,
  disposeCpcaTestUtils,
  installCpcaApiMocks,
  seedCpcaE2eScenario,
  type CpcaE2eScenario,
} from './utils/cpcaTestUtils';

async function selectOm(page: Page, label: string) {
  await page.getByRole('combobox', { name: /^OM\s/ }).click();
  await page.getByRole('option', { name: label }).click();
}

async function loginWithScenarioActor(
  page: Page,
  actor:
    | CpcaE2eScenario['ti']
    | CpcaE2eScenario['approvedPresident']
    | CpcaE2eScenario['member']
    | CpcaE2eScenario['currentPresidentActor'],
  loginAs: (
    actor:
      | CpcaE2eScenario['ti']
      | CpcaE2eScenario['approvedPresident']
      | CpcaE2eScenario['member']
      | CpcaE2eScenario['currentPresidentActor'],
  ) => Promise<void>,
) {
  await loginAs(actor);
}

test.describe.serial('CPCA workflow', () => {
  let scenario: CpcaE2eScenario;

  test.beforeAll(async () => {
    const namespace = `E2ECPCA${Date.now().toString(36).toUpperCase()}`;
    scenario = await seedCpcaE2eScenario(namespace);
  });

  test.afterAll(async () => {
    if (scenario?.namespace) {
      await cleanupCpcaE2eNamespace(scenario.namespace);
    }
    await disposeCpcaTestUtils();
  });

  test('TI homologa autoinscrição com aviso de presidente existente e vê a procedência', async ({ page }) => {
    const session = await installCpcaApiMocks(page, scenario);
    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/cpca-president-approvals');

    await expect(
      page.getByRole('heading', { name: 'Homologações CPCA' }),
    ).toBeVisible();

    const requestRow = page.locator('tr').filter({
      hasText: scenario.selfRegistrationApplicantName,
    });

    await expect(requestRow).toContainText('Autoinscrição');
    await expect(requestRow).toContainText(scenario.managerOm.code);

    await requestRow.getByRole('button', { name: 'Homologar' }).click();
    await page
      .getByRole('dialog', { name: 'Homologar solicitação CPCA' })
      .getByRole('button', { name: 'Homologar' })
      .click();

    await page
      .getByRole('dialog', { name: 'OM já possui presidente' })
      .getByRole('button', { name: 'Prosseguir' })
      .click();

    await expect(
      page.getByText('Solicitação homologada com sucesso.'),
    ).toBeVisible();

    await page.goto('/cpca-commission');
    await selectOm(page, `${scenario.managerOm.code} - ${scenario.managerOm.name}`);

    await expect(
      page.getByText(scenario.selfRegistrationApplicantName, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Homologado por autoinscrição', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Presidente definido', { exact: true }).first(),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/admin/oms');
    const omRow = page.locator('tr').filter({ hasText: scenario.managerOm.code });
    await omRow.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByText('Homologado por autoinscrição')).toBeVisible();
    await expect(
      page.getByText(`Presidente atual: ${scenario.selfRegistrationApplicantName}`),
    ).toBeVisible();
  });

  test('Presidente envia cobertura para homologação e TI aprova', async ({ page }) => {
    const session = await installCpcaApiMocks(page, scenario);
    await loginWithScenarioActor(page, scenario.approvedPresident, session.loginAs);
    await page.goto('/cpca-commission');

    const coverageInput = page.getByRole('combobox', {
      name: /^OMs adicionais cobertas por esta comissão/,
    });
    await coverageInput.click();
    await coverageInput.fill(scenario.managedOm.code);
    await page
      .getByRole('option', {
        name: new RegExp(`${scenario.managedOm.code}.*${scenario.managedOm.name}`),
      })
      .click();

    await page
      .locator('button:not([disabled])')
      .filter({ hasText: 'Enviar para homologação' })
      .click();
    await expect(
      page.getByText('Solicitação de cobertura enviada para homologação.'),
    ).toBeVisible();
    await expect(
      page.getByText('Existe uma solicitação pendente de cobertura para esta OM'),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/cpca-president-approvals');

    const coverageRow = page
      .locator('tr')
      .filter({ hasText: 'Cobertura de OM' })
      .filter({ hasText: scenario.managerOm.code });

    await expect(coverageRow).toContainText('1 OM(s) na cobertura proposta');
    await coverageRow.getByRole('button', { name: 'Homologar' }).click();
    await page
      .getByRole('dialog', { name: 'Homologar solicitação CPCA' })
      .getByRole('button', { name: 'Homologar' })
      .click();

    await expect(
      page.getByText('Solicitação homologada com sucesso.'),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.approvedPresident, session.loginAs);
    await page.goto('/cpca-commission');

    await expect(
      page.getByText('Solicitação de cobertura criada', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Solicitação de cobertura homologada', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Cobertura atualizada para 1 OM(s).', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Membro adicionado', { exact: true }).first(),
    ).toBeVisible();
  });

  test('Presidente solicita sucessão e TI homologa com procedência visível', async ({ page }) => {
    const session = await installCpcaApiMocks(page, scenario);
    await loginWithScenarioActor(page, scenario.approvedPresident, session.loginAs);
    await page.goto('/cpca-commission');

    const nominationCard = page
      .locator('div.MuiCardContent-root')
      .filter({ has: page.getByText('Solicitar sucessão da presidência') });

    await page.getByLabel('E-mail ou CPF do indicado').fill(scenario.member.email);
    await page.getByLabel('Boletim da sucessão').fill(`${scenario.namespace}/SUC`);
    await nominationCard
      .getByRole('button', { name: 'Enviar para homologação' })
      .click();

    await expect(
      page.getByText('Solicitação de sucessão enviada para homologação.'),
    ).toBeVisible();
    await expect(
      page.getByText('Existe uma solicitação pendente de sucessão para esta OM.'),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/cpca-president-approvals');

    const nominationRow = page
      .locator('tr')
      .filter({ hasText: 'Sucessão de presidente' })
      .filter({ hasText: scenario.member.name });

    await nominationRow.getByRole('button', { name: 'Homologar' }).click();
    await page
      .getByRole('dialog', { name: 'Homologar solicitação CPCA' })
      .getByRole('button', { name: 'Homologar' })
      .click();

    await expect(
      page.getByText('Solicitação homologada com sucesso.'),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.approvedPresident, session.loginAs);
    await page.goto('/cpca-commission');

    await expect(
      page.getByText(scenario.member.name, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Homologado por sucessão/).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Solicitação de sucessão homologada', { exact: true }).first(),
    ).toBeVisible();
  });

  test('Presidente atual envia nova cobertura e TI rejeita a solicitação', async ({ page }) => {
    const session = await installCpcaApiMocks(page, scenario);
    await loginWithScenarioActor(page, scenario.member, session.loginAs);
    await page.goto('/cpca-commission');

    const coverageInput = page.getByRole('combobox', {
      name: /^OMs adicionais cobertas por esta comissão/,
    });
    await coverageInput.click();
    await coverageInput.fill(scenario.outsiderOm.code);
    await page
      .getByRole('option', {
        name: new RegExp(`${scenario.outsiderOm.code}.*${scenario.outsiderOm.name}`),
      })
      .click();

    await page
      .locator('button:not([disabled])')
      .filter({ hasText: 'Enviar para homologação' })
      .click();

    await expect(
      page.getByText('Solicitação de cobertura enviada para homologação.'),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/cpca-president-approvals');

    const coverageRow = page
      .locator('tr')
      .filter({ hasText: 'Cobertura de OM' })
      .filter({ hasText: scenario.outsiderOm.code });

    await coverageRow.getByRole('button', { name: 'Rejeitar' }).click();
    await page
      .getByRole('dialog', { name: 'Rejeitar solicitação' })
      .getByRole('button', { name: 'Rejeitar' })
      .click();

    await expect(page.getByText('Solicitação rejeitada.')).toBeVisible();

    await loginWithScenarioActor(page, scenario.member, session.loginAs);
    await page.goto('/cpca-commission');

    await expect(
      page.getByText('Solicitação de cobertura rejeitada', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Existe uma solicitação pendente de cobertura para esta OM'),
    ).toHaveCount(0);
  });

  test('Membro CPCA vê apenas a própria OM e as OMs geridas e não acessa áreas sensíveis fora do escopo', async ({ page }) => {
    const session = await installCpcaApiMocks(page, scenario);
    await loginWithScenarioActor(page, scenario.member, session.loginAs);

    await page.goto(`/cpca-cases?q=${encodeURIComponent(scenario.caseOwnNumber)}`);
    await expect(page.getByText(scenario.caseOwnNumber)).toBeVisible();

    await page.goto(`/cpca-cases?q=${encodeURIComponent(scenario.caseManagedNumber)}`);
    await expect(page.getByText(scenario.caseManagedNumber)).toBeVisible();

    await page.goto(`/cpca-cases?q=${encodeURIComponent(scenario.caseOutsiderNumber)}`);
    await expect(page.getByText('Nenhuma notificação')).toBeVisible();
    await expect(page.getByText(scenario.caseOutsiderNumber)).toHaveCount(0);

    await page.goto('/cpca-president-approvals');
    await expect(page).not.toHaveURL(/cpca-president-approvals/);

    await page.goto('/dashboard/estrategico');
    await expect(page).not.toHaveURL(/dashboard\/estrategico/);
    await expect(page.getByText('Homologações CPCA')).toHaveCount(0);
  });

  test('Presidente atual remove membro da comissão e o histórico registra a alteração', async ({ page }) => {
    const session = await installCpcaApiMocks(page, scenario);
    await loginWithScenarioActor(page, scenario.member, session.loginAs);
    await page.goto('/cpca-commission');

    const memberRow = page.locator('tr').filter({
      hasText: scenario.removableMemberName,
    });

    await expect(memberRow).toBeVisible();
    await memberRow.getByRole('button').click();

    await page
      .getByRole('dialog', { name: 'Remover membro da comissão' })
      .getByRole('button', { name: 'Remover' })
      .click();

    await expect(page.getByText('Membro removido da comissão.')).toBeVisible();
    await expect(
      page.getByText('Membro removido', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        `${scenario.removableMemberName} foi removido da comissão da OM.`,
        { exact: true },
      ).first(),
    ).toBeVisible();
    await expect(
      page.locator('tr').filter({ hasText: scenario.removableMemberName }),
    ).toHaveCount(0);
  });
});

test.describe('CPCA rejection workflow', () => {
  test('TI rejeita autoinscrição e mantém o presidente anterior da OM', async ({ page }) => {
    const scenario = await seedCpcaE2eScenario(
      `E2ECPCAREJ${Date.now().toString(36).toUpperCase()}`,
    );
    const session = await installCpcaApiMocks(page, scenario);

    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/cpca-president-approvals');

    const requestRow = page.locator('tr').filter({
      hasText: scenario.selfRegistrationApplicantName,
    });

    await requestRow.getByRole('button', { name: 'Rejeitar' }).click();
    await page
      .getByRole('dialog', { name: 'Rejeitar solicitação' })
      .getByRole('button', { name: 'Rejeitar' })
      .click();

    await expect(page.getByText('Solicitação rejeitada.')).toBeVisible();
    await expect(
      page.locator('tr').filter({ hasText: scenario.selfRegistrationApplicantName }),
    ).toHaveCount(0);

    await page.goto('/cpca-commission');
    await selectOm(page, `${scenario.managerOm.code} - ${scenario.managerOm.name}`);
    await expect(
      page.getByText(scenario.originalPresidentName, { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Cadastro direto por TI/)).toBeVisible();
    await expect(
      page.getByText('Autoinscrição rejeitada', { exact: true }).first(),
    ).toBeVisible();
  });

  test('TI rejeita sucessão e mantém a presidência atual', async ({ page }) => {
    const scenario = await seedCpcaE2eScenario(
      `E2ECPCANOM${Date.now().toString(36).toUpperCase()}`,
    );
    const session = await installCpcaApiMocks(page, scenario);

    await loginWithScenarioActor(page, scenario.currentPresidentActor, session.loginAs);
    await page.goto('/cpca-commission');

    const nominationCard = page
      .locator('div.MuiCardContent-root')
      .filter({ has: page.getByText('Solicitar sucessão da presidência') });

    await page.getByLabel('E-mail ou CPF do indicado').fill(scenario.member.email);
    await page.getByLabel('Boletim da sucessão').fill(`${scenario.namespace}/SUC-REJ`);
    await nominationCard
      .getByRole('button', { name: 'Enviar para homologação' })
      .click();

    await expect(
      page.getByText('Solicitação de sucessão enviada para homologação.'),
    ).toBeVisible();

    await loginWithScenarioActor(page, scenario.ti, session.loginAs);
    await page.goto('/cpca-president-approvals');

    const nominationRow = page
      .locator('tr')
      .filter({ hasText: 'Sucessão de presidente' })
      .filter({ hasText: scenario.member.name });

    await nominationRow.getByRole('button', { name: 'Rejeitar' }).click();
    await page
      .getByRole('dialog', { name: 'Rejeitar solicitação' })
      .getByRole('button', { name: 'Rejeitar' })
      .click();

    await expect(page.getByText('Solicitação rejeitada.')).toBeVisible();
    await expect(
      page.locator('tr').filter({ hasText: 'Sucessão de presidente' }),
    ).toHaveCount(0);

    await page.goto('/cpca-commission');
    await selectOm(page, `${scenario.managerOm.code} - ${scenario.managerOm.name}`);
    await expect(
      page.getByText(scenario.originalPresidentName, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Solicitação de sucessão rejeitada', { exact: true }).first(),
    ).toBeVisible();
  });
});
