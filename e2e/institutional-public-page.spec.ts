import { expect, test } from '@playwright/test';

const transparentPixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WQAAAABJRU5ErkJggg==',
  'base64',
);

test('renders the public institutional page without authentication', async ({
  page,
}) => {
  await page.route('**/api/institutional', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-07-30T12:00:00.000Z',
        lastUpdatedAt: '2026-07-30T12:00:00.000Z',
        members: [
          {
            id: 'm1',
            name: 'Cel Aviadora Maria Silva',
            function: 'Coordenadora',
            seniority: 1,
            photoUrl: '/institutional/members/m1/photo',
          },
          {
            id: 'm2',
            name: '2S FLAVIA',
            function: 'Psicologia',
            seniority: 2,
            photoUrl: '/institutional/members/m2/photo',
          },
        ],
        actions: [
          {
            id: 'a1',
            title: 'Missão CIPAVD Natal',
            summary: 'Ações educativas e de orientação para o efetivo.',
            scope: 'CIPAVD',
            startDate: '2026-08-10T12:00:00.000Z',
            endDate: '2026-08-12T12:00:00.000Z',
            year: 2026,
            status: 'PROGRAMADA',
            locality: { id: 'l1', code: 'BAAN', name: 'Base Aérea de Natal', uf: 'RN' },
          },
          {
            id: 'a2',
            title: 'Missão SMIF Rio de Janeiro',
            summary: 'Acompanhamento institucional.',
            scope: 'SMIF',
            startDate: '2026-06-10T12:00:00.000Z',
            endDate: '2026-06-12T12:00:00.000Z',
            year: 2026,
            status: 'REALIZADA',
            locality: { id: 'l2', code: 'GAP-RJ', name: 'Grupamento de Apoio do Rio de Janeiro', uf: 'RJ' },
          },
        ],
        agenda: [
          {
            id: 'a1',
            title: 'Missão CIPAVD Natal',
            scope: 'CIPAVD',
            startDate: '2026-08-10T12:00:00.000Z',
            endDate: '2026-08-12T12:00:00.000Z',
            status: 'PROGRAMADA',
            location: 'Auditório',
            locality: { id: 'l1', code: 'BAAN', name: 'Base Aérea de Natal', uf: 'RN' },
          },
        ],
        news: [
          {
            id: 'n1',
            title: 'Campanha fortalece ambiente de respeito',
            summary: 'Uma iniciativa que fortaleceu a prevenção e o acolhimento.',
            audience: 'INTERNAL',
            publishedAt: '2026-07-20T12:00:00.000Z',
            sourceUrl: 'https://www.fab.mil.br/noticia-interna',
            coverImageUrl: null,
          },
          {
            id: 'n2',
            title: 'FAB amplia ações de prevenção',
            summary: 'Ações institucionais chegam a novas localidades.',
            audience: 'EXTERNAL',
            publishedAt: '2026-07-18T12:00:00.000Z',
            sourceUrl: 'https://www.fab.mil.br/noticia-externa',
            coverImageUrl: null,
          },
        ],
        supportChannels: [
          {
            servedOm: { id: '1gda', code: '1 GDA', name: 'Primeiro Grupo de Defesa Aérea', uf: 'RN' },
            responsibleCpca: { id: 'baan', code: 'BAAN', name: 'Base Aérea de Natal', uf: 'RN' },
            coverageType: 'MANAGED_BY_OTHER',
            email: 'cpca.baan@fab.mil.br',
            intraerUrl: 'https://intraer.fab.mil.br/cpca-baan',
          },
        ],
        materials: [],
        library: {
          totalPhotos: 1,
          groups: [
            {
              id: 'gallery:CIPAVD:l1',
              title: 'Base Aérea de Natal',
              scope: 'CIPAVD',
              locality: { id: 'l1', code: 'BAAN', name: 'Base Aérea de Natal', uf: 'RN' },
              photos: [{ id: 'p1', title: 'Palestra na BAAN', imageUrl: '/institutional/library-photos/p1', mimeType: 'image/png' }],
            },
          ],
        },
        totals: { members: 2, actions: 2, states: 2, supportChannels: 1, libraryPhotos: 1 },
      }),
    });
  });

  await page.route('**/api/institutional/**', async (route) => {
    await route.fulfill({ contentType: 'image/png', body: transparentPixel });
  });

  await page.goto('/institucional');

  await expect(page).toHaveURL(/\/institucional$/);
  await expect(page.getByRole('heading', { name: /Informação, prevenção/i })).toBeVisible();
  await expect(page.getByText('Comissão Itinerante', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nosso compromisso', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Membros da CIPAVD' })).toBeVisible();
  await expect(page.getByText(/Composição atualizada automaticamente/)).toHaveCount(0);
  const membersSection = page.locator('#membros');
  await expect(membersSection.locator('.institutional-member-card__avatar img')).toHaveCount(2);
  await expect(membersSection.getByRole('img', { name: '2S FLAVIA' })).toBeVisible();
  await expect(membersSection.getByText(/FLAVIA COMGEP/)).toHaveCount(0);
  const areasSection = page.locator('#areas-atuacao');
  await expect(areasSection.getByRole('heading', { name: 'Principais áreas de atuação' })).toBeVisible();
  await expect(areasSection.locator('.institutional-area-card')).toHaveCount(5);
  await expect(areasSection.getByRole('heading', { name: 'Educação e conscientização' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Áreas de atuação', exact: true }).first()).toHaveAttribute('href', '#areas-atuacao');
  const actionsSection = page.locator('#acoes');
  await expect(actionsSection.getByText('Missão CIPAVD Natal', { exact: true })).toBeVisible();
  await expect(actionsSection.getByText('Palestra', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rio Grande do Norte: 1 ação(ões)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rio de Janeiro: 1 ação(ões)' })).toBeVisible();

  await actionsSection.getByRole('button', { name: 'CIPAVD', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rio Grande do Norte: 1 ação(ões)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rio de Janeiro: 0 ação(ões)' })).toBeVisible();
  await expect(actionsSection.getByText('Missão CIPAVD Natal', { exact: true })).toBeVisible();
  await expect(actionsSection.getByText('Missão SMIF Rio de Janeiro', { exact: true })).not.toBeVisible();

  await actionsSection.getByRole('button', { name: 'SMIF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rio Grande do Norte: 0 ação(ões)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rio de Janeiro: 1 ação(ões)' })).toBeVisible();
  await expect(actionsSection.getByText('Missão SMIF Rio de Janeiro', { exact: true })).toBeVisible();
  await expect(actionsSection.getByText('Missão CIPAVD Natal', { exact: true })).not.toBeVisible();

  await page
    .getByRole('button', { name: 'Rio de Janeiro: 1 ação(ões)' })
    .click({ force: true });
  await expect(actionsSection.getByText('Missão SMIF Rio de Janeiro', { exact: true })).toBeVisible();
  await expect(actionsSection.getByText('Missão CIPAVD Natal', { exact: true })).not.toBeVisible();

  await page.getByPlaceholder(/Digite a sigla/).fill('1 GDA');
  await expect(page.getByText('Atendida pela CPCA BAAN')).toBeVisible();
  await expect(page.getByText('cpca.baan@fab.mil.br')).toBeVisible();

  const newsSection = page.locator('#noticias');
  await expect(newsSection.getByText('Público interno')).toBeVisible();
  await expect(newsSection.getByText('Público externo')).toBeVisible();

  const agendaSection = page.locator('#agenda');
  await expect(agendaSection.getByRole('heading', { name: 'Missão CIPAVD Natal' })).toBeVisible();
  await expect(agendaSection.getByText('Palestra', { exact: true })).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(page.locator('#biblioteca').getByRole('heading', { name: 'Base Aérea de Natal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ampliar Palestra na BAAN' })).toBeVisible();
});
