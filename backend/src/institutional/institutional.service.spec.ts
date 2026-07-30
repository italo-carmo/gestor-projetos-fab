import { buildPublicCpcaContacts } from './institutional.service';

describe('buildPublicCpcaContacts', () => {
  const contactItems = (email?: string, intraerUrl?: string) => [
    {
      itemKey: 'EMAIL_DIRETO_RELATOS',
      isCompleted: Boolean(email),
      details: email ?? null,
    },
    {
      itemKey: 'LINK_INTRAER_CPCA',
      isCompleted: Boolean(intraerUrl),
      details: intraerUrl ?? null,
    },
  ];

  it('inherits the manager CPCA contacts for an OM covered by another commission', () => {
    const result = buildPublicCpcaContacts([
      {
        id: '1gda',
        code: '1 GDA',
        name: 'Primeiro Grupo de Defesa Aérea',
        uf: 'RN',
        hasCpca: false,
        cpcaChecklistItems: [],
        cpcaCoverageAsManaged: [
          {
            managerOm: {
              id: 'baan',
              code: 'BAAN',
              name: 'Base Aérea de Natal',
              uf: 'RN',
              cpcaChecklistItems: contactItems(
                'cpca.baan@fab.mil.br',
                'https://intraer.fab.mil.br/cpca-baan',
              ),
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        coverageType: 'MANAGED_BY_OTHER',
        email: 'cpca.baan@fab.mil.br',
        intraerUrl: 'https://intraer.fab.mil.br/cpca-baan',
        servedOm: expect.objectContaining({ code: '1 GDA' }),
        responsibleCpca: expect.objectContaining({ code: 'BAAN' }),
      }),
    ]);
  });

  it('publishes only completed contact items with valid values', () => {
    const result = buildPublicCpcaContacts([
      {
        id: 'om-1',
        code: 'OM1',
        name: 'Organização 1',
        uf: 'DF',
        hasCpca: true,
        cpcaChecklistItems: [
          {
            itemKey: 'EMAIL_DIRETO_RELATOS',
            isCompleted: false,
            details: 'nao-publicar@fab.mil.br',
          },
          {
            itemKey: 'LINK_INTRAER_CPCA',
            isCompleted: true,
            details: 'endereço inválido',
          },
        ],
        cpcaCoverageAsManaged: [],
      },
    ]);

    expect(result).toEqual([]);
  });
});
