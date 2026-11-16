import { StrategicService } from './strategic.service';

describe('StrategicService.aggressorProfile', () => {
  it('conta todas as vítimas nos perfis e ocorrências sem duplicar casos, agressor, OM ou procedimentos', async () => {
    const row = {
      id: 'multiple',
      caseNumber: 'MULTIPLE',
      complaintType: 'MORAL',
      workflowScope: 'CPCA',
      status: 'INVESTIGATION',
      aggressorRank: 'CAPITAO',
      aggressorGender: 'MASCULINO',
      omId: 'om-a',
      om: { code: 'OM A', name: 'Organização A' },
      processOpened: true,
      procedureType: 'IPM',
      victims: [
        {
          id: 'v1',
          victimRank: 'SOLDADO',
          victimGender: 'FEMININO',
          victimAgeRange: '19_25',
          incidentFrequency: 'DUAS_VEZES',
          occurrenceForms: ['HUMILHACAO_PUBLICA'],
          hierarchicalFunctionalRelation: 'MESMA_GRADUACAO',
        },
        {
          id: 'v2',
          victimRank: 'TENENTE',
          victimGender: 'MASCULINO',
          victimAgeRange: '31_35',
          incidentFrequency: 'UMA_VEZ',
          occurrenceForms: ['AMEACAS_INTIMIDACAO'],
          hierarchicalFunctionalRelation: 'SUPERIOR_HIERARQUICO',
        },
      ],
    };
    const service = new StrategicService(
      {
        cpcComplaintCase: { findMany: jest.fn().mockResolvedValue([row]) },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const data = await service.aggressorProfile();
    const distribution = (...labels: string[]) =>
      labels.map((label) => ({ label, count: 1, percent: 50 }));
    expect(data).toMatchObject({
      totalCases: 1,
      totalVictims: 2,
      hierarchicalRelation: { count: 1, percent: 100 },
    });
    expect(data.victimProfile).toEqual({
      byRank: distribution('SOLDADO', 'TENENTE'),
      byGender: distribution('FEMININO', 'MASCULINO'),
      byAgeRange: distribution('19_25', '31_35'),
    });
    expect(data.context?.byFrequency).toEqual(
      distribution('DUAS_VEZES', 'UMA_VEZ'),
    );
    expect(data.context?.byForm).toEqual(
      distribution('HUMILHACAO_PUBLICA', 'AMEACAS_INTIMIDACAO'),
    );
    expect(data.aggressorProfile?.byRank).toEqual([
      { label: 'CAPITAO', count: 1, percent: 100 },
    ]);
    expect(data.detailItems?.total).toHaveLength(1);
    expect(data.detailItems?.hierarchical).toHaveLength(1);
    expect(
      data.detailItems?.moral.filter((item) => item.processOpened),
    ).toHaveLength(1);
    expect(data.byLocality?.map((item) => item.count)).toEqual([1]);
    expect(data.crossTabulation?.map((item) => item.count)).toEqual([1, 1]);
  });

  function setup() {
    const moralDimensions = {
      aggressorRank: 'CAPITAO',
      aggressorGender: 'MASCULINO',
      aggressorAgeRange: '31_35',
      victimRank: 'SOLDADO',
      victimGender: 'FEMININO',
      victimAgeRange: '19_25',
      detailedViolenceType: 'ASSEDIO_MORAL',
      harassmentContext: 'PRESENCIAL',
      occurrenceLocation: 'INTERIOR_OM',
      incidentFrequency: 'MAIOR_CINCO',
      occurrenceForms: ['HUMILHACAO_PUBLICA', 'AMEACAS_INTIMIDACAO'],
      hierarchicalFunctionalRelation: 'Superior hierárquico',
    };
    const rows = [
      {
        ...moralDimensions,
        id: 'moral-1',
        caseNumber: 'MORAL-001',
        complaintType: 'MORAL',
        workflowScope: 'CPCA',
        status: 'INVESTIGATION',
        reportedAt: new Date('2026-11-10T12:00:00Z'),
        omId: 'om-a',
        om: { code: 'OM A', name: 'Organização A' },
        processOpened: true,
        procedureType: 'SINDICANCIA',
        subsequentProcedureOpened: true,
        subsequentProcedureType: 'IPM',
      },
      {
        aggressorRank: 'SARGENTO',
        aggressorGender: 'FEMININO',
        aggressorAgeRange: '41_45',
        victimRank: 'TENENTE',
        victimGender: 'MASCULINO',
        victimAgeRange: '26_30',
        detailedViolenceType: 'ASSEDIO_SEXUAL',
        harassmentContext: 'VIRTUAL',
        occurrenceLocation: 'APLICATIVOS_MENSAGERIA',
        incidentFrequency: 'UMA_VEZ',
        occurrenceForm: 'COMENTARIOS_SEXISTAS',
        hierarchicalFunctionalRelation: 'Superior hierárquico',
        id: 'sexual-1',
        caseNumber: 'SEXUAL-001',
        complaintType: 'SEXUAL',
        workflowScope: 'SMIF',
        status: 'RECEIVED',
        reportedAt: new Date('2026-11-09T12:00:00Z'),
        localityId: 'locality-b',
        locality: { code: 'LOCAL B', name: 'Localidade B' },
        processOpened: false,
        procedureType: 'NOT_DEFINED',
      },
      {
        ...moralDimensions,
        hierarchicalFunctionalRelation: 'Colega',
        id: 'moral-2',
        caseNumber: 'MORAL-002',
        complaintType: 'MORAL',
        workflowScope: 'SMIF',
        status: 'CONCLUDED',
        processOpened: null,
      },
    ];
    const findMany = jest.fn(async ({ select, where }) =>
      rows
        .filter(
          (row) =>
            (!where.workflowScope ||
              where.workflowScope.in.includes(row.workflowScope)) &&
            (!where.complaintType || row.complaintType === where.complaintType),
        )
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => select[key]),
          ),
        ),
    );
    const service = new StrategicService(
      { cpcComplaintCase: { findMany } } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, findMany };
  }

  it('separa as tipologias e retorna os campos de filtro e instauração', async () => {
    const { service, findMany } = setup();
    const profile = await service.aggressorProfile();
    expect(profile.byComplaintType).toEqual({
      moral: { count: 2, percent: 66.7 },
      sexual: { count: 1, percent: 33.3 },
    });
    expect(profile.detailItems?.moral[0]).toMatchObject({
      id: 'moral-1',
      caseNumber: 'MORAL-001',
      complaintType: 'MORAL',
      omId: 'om-a',
      omLabel: 'OM A - Organização A',
      workflowScope: 'CPCA',
      status: 'INVESTIGATION',
      processOpened: true,
      procedureType: 'SINDICANCIA',
      subsequentProcedureOpened: true,
      subsequentProcedureType: 'IPM',
      date: '2026-11-10T12:00:00.000Z',
      link: '/cpca-cases?q=MORAL-001',
    });
    expect(profile.detailItems?.sexual.map((item) => item.id)).toEqual([
      'sexual-1',
    ]);
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { reportedAt: 'desc' },
      { createdAt: 'desc' },
    ]);
  });

  it('usa a localidade legada e preserva ausência de instauração e OM', async () => {
    const { service } = setup();
    const profile = await service.aggressorProfile();
    expect(profile.detailItems?.sexual[0]).toMatchObject({
      omId: 'locality-b',
      omLabel: 'LOCAL B - Localidade B',
      processOpened: false,
      subsequentProcedureOpened: false,
      link: '/cpca-cases?scope=SMIF&q=SEXUAL-001',
    });
    expect(profile.detailItems?.moral[1]).toMatchObject({
      omId: 'NAO_INFORMADO',
      processOpened: null,
      procedureType: 'NOT_DEFINED',
      subsequentProcedureType: null,
    });
  });

  it('respeita o recorte das fontes CPCA/SMIF', async () => {
    const { service } = setup();
    const profile = await service.aggressorProfile({
      sources: ['complaints_smif'],
    });
    expect(profile.totalCases).toBe(2);
    expect(
      profile.detailItems?.total.every((item) => item.workflowScope === 'SMIF'),
    ).toBe(true);
  });

  it.each(['MORAL', 'SEXUAL'] as const)(
    'recalcula todos os gráficos e percentuais para reportes de %s',
    async (complaintType) => {
      const { service, findMany } = setup();
      const profile = await service.aggressorProfile({ complaintType });
      const isMoral = complaintType === 'MORAL';
      const count = isMoral ? 2 : 1;
      const distribution = (label: string) => [{ label, count, percent: 100 }];

      expect(findMany.mock.calls[0][0].where.complaintType).toBe(complaintType);
      expect(profile.totalCases).toBe(count);
      expect(profile.byComplaintType).toEqual({
        moral: { count: isMoral ? 2 : 0, percent: isMoral ? 100 : 0 },
        sexual: { count: isMoral ? 0 : 1, percent: isMoral ? 0 : 100 },
      });
      expect(profile.aggressorProfile).toEqual({
        byRank: distribution(isMoral ? 'CAPITAO' : 'SARGENTO'),
        byGender: distribution(isMoral ? 'MASCULINO' : 'FEMININO'),
        byAgeRange: distribution(isMoral ? '31_35' : '41_45'),
      });
      expect(profile.victimProfile).toEqual({
        byRank: distribution(isMoral ? 'SOLDADO' : 'TENENTE'),
        byGender: distribution(isMoral ? 'FEMININO' : 'MASCULINO'),
        byAgeRange: distribution(isMoral ? '19_25' : '26_30'),
      });
      expect(profile.context).toEqual({
        byViolenceType: distribution(
          isMoral ? 'ASSEDIO_MORAL' : 'ASSEDIO_SEXUAL',
        ),
        byHarassmentContext: distribution(isMoral ? 'PRESENCIAL' : 'VIRTUAL'),
        byLocation: distribution(
          isMoral ? 'INTERIOR_OM' : 'APLICATIVOS_MENSAGERIA',
        ),
        byFrequency: distribution(isMoral ? 'MAIOR_CINCO' : 'UMA_VEZ'),
        byForm: isMoral
          ? [
              ...distribution('HUMILHACAO_PUBLICA'),
              ...distribution('AMEACAS_INTIMIDACAO'),
            ]
          : distribution('COMENTARIOS_SEXISTAS'),
      });
      expect(profile.hierarchicalRelation).toMatchObject({
        count: 1,
        percent: isMoral ? 50 : 100,
      });
      expect(profile.detailItems?.total).toHaveLength(count);
      expect(
        profile.detailItems?.total.every(
          (item) => item.complaintType === complaintType,
        ),
      ).toBe(true);
      expect(
        profile.crossTabulation?.every(
          (item) => item.complaintType === complaintType,
        ),
      ).toBe(true);
      expect(
        profile.byLocality?.reduce((total, item) => total + item.count, 0),
      ).toBe(count);
    },
  );

  it('combina tipo de reporte com as fontes selecionadas', async () => {
    const { service } = setup();
    const profile = await service.aggressorProfile({
      sources: ['complaints_smif'],
      complaintType: 'MORAL',
    });
    expect(profile.totalCases).toBe(1);
    expect(profile.detailItems?.total.map((item) => item.id)).toEqual([
      'moral-2',
    ]);
  });

  it('retorna vazio quando não há casos do tipo no escopo selecionado', async () => {
    const { service } = setup();
    const profile = await service.aggressorProfile({
      sources: ['complaints_cpca'],
      complaintType: 'SEXUAL',
    });
    expect(profile.totalCases).toBe(0);
  });
});
