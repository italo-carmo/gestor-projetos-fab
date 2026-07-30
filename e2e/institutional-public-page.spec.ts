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
          { id: 'm1', name: 'Cel Aviadora Maria Silva', function: 'Coordenadora', seniority: 1 },
          { id: 'm2', name: 'Maj Ana Souza', function: 'Psicologia', seniority: 2 },
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
            activities: [{ id: 'at1', title: 'Palestra', startAt: '2026-08-10T12:00:00.000Z', location: 'Auditório' }],
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
            activities: [],
          },
        ],
        agenda: [
          {
            id: 'a1',
            title: 'Missão CIPAVD Natal',
            activity: 'Palestra',
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
            title: 'Militar em destaque',
            role: 'Multiplicadora',
            organization: 'BAAN',
            impact: 'MULTIPLICADOR',
            text: 'Uma iniciativa que fortaleceu a prevenção e o acolhimento.',
            publishedAt: '2026-07-20T12:00:00.000Z',
            locality: { id: 'l1', code: 'BAAN', name: 'Base Aérea de Natal', uf: 'RN' },
            photoUrl: '/institutional/news/n1/photo',
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
              title: 'BAAN',
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
  await expect(page.getByRole('heading', { name: 'Membros da CIPAVD' })).toBeVisible();
  const actionsSection = page.locator('#acoes');
  await expect(actionsSection.getByText('Missão CIPAVD Natal', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Rio de Janeiro: 1 ação(ões)' }).click();
  await expect(actionsSection.getByText('Missão SMIF Rio de Janeiro', { exact: true })).toBeVisible();
  await expect(actionsSection.getByText('Missão CIPAVD Natal', { exact: true })).not.toBeVisible();

  await page.getByPlaceholder(/Digite a sigla/).fill('1 GDA');
  await expect(page.getByText('Atendida pela CPCA BAAN')).toBeVisible();
  await expect(page.getByText('cpca.baan@fab.mil.br')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ampliar Palestra na BAAN' })).toBeVisible();
});
