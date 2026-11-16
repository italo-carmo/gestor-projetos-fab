import { StrategicService } from './strategic.service';

describe('StrategicService.geoMap: pressão territorial', () => {
  function setup({
    schoolCount = 0,
    schoolUf = 'SP',
    domesticTotal = 100,
    domesticPositive = 30,
    withComplaints = true,
    missions = 0,
    activities = 0,
  } = {}) {
    const oms = ['SP', 'RJ', 'DF'].map((uf) => ({
      id: `om-${uf}`,
      code: `OM ${uf}`,
      name: `Organização ${uf}`,
      uf,
      hasCpca: true,
      cpcaCoverageAsManaged: [],
    }));
    const localities = oms.map((om) => ({
      ...om,
      id: `loc-${om.uf}`,
      catalogType: 'CIPAVD',
    }));
    const schoolRows = Array.from({ length: schoolCount }, (_, index) => ({
      id: `school-${index}`,
      sufferedViolence: true,
    }));
    const domesticRows = Array.from({ length: domesticTotal }, (_, index) => ({
      id: `domestic-${index}`,
      sufferedLast12Months: index < domesticPositive,
    }));
    const complaints = withComplaints
      ? [
          {
            omId: 'om-SP',
            workflowScope: 'CPCA',
            status: 'INVESTIGATION',
            caseNumber: 'CPCA-001',
          },
          {
            omId: 'om-SP',
            workflowScope: 'SMIF',
            status: 'RECEIVED',
            caseNumber: 'SMIF-001',
          },
          {
            omId: 'om-SP',
            workflowScope: 'CPCA',
            status: 'CONCLUDED',
            caseNumber: 'CPCA-002',
          },
        ]
      : [];
    const prisma = {
      locality: { findMany: jest.fn().mockResolvedValue(localities) },
      om: { findMany: jest.fn().mockResolvedValue(oms) },
      cpcComplaintCase: { findMany: jest.fn().mockResolvedValue(complaints) },
      activity: {
        findMany: jest.fn().mockResolvedValue(
          Array.from({ length: activities }, () => ({
            localityId: 'loc-DF',
          })),
        ),
      },
      mission: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            Array.from({ length: missions }, () => ({ localityId: 'loc-DF' })),
          ),
      },
      biSurveyResponse: { findMany: jest.fn().mockResolvedValue(schoolRows) },
      biDomesticViolenceResponse: {
        findMany: jest.fn().mockResolvedValue(domesticRows),
      },
      biNormalizationLink: {
        findMany: jest.fn(async ({ where }) =>
          (where.sourceType === 'SURVEY_SCHOOLS'
            ? schoolRows
            : domesticRows
          ).map((row) => ({
            sourceRecordId: row.id,
            uf: where.sourceType === 'SURVEY_SCHOOLS' ? schoolUf : 'SP',
          })),
        ),
      },
    };
    return new StrategicService(prisma as any, {} as any, {} as any, {} as any);
  }

  it('pesquisa de escolas sozinha não gera pressão nem sinal de VD', async () => {
    const data = await setup({
      schoolCount: 500,
      schoolUf: 'RJ',
      domesticTotal: 0,
      withComplaints: false,
    }).geoMap();
    const rj = data.states.find((state) => state.uf === 'RJ');
    expect(rj).toMatchObject({
      schoolSurveyYes: 500,
      pressureScore: 0,
      researchSignals: 0,
      hasResearch: false,
    });
    expect(data.states.every((state) => state.pressureScore === 0)).toBe(true);
    expect(data.summary?.statesWithResearch).toBe(0);
  });

  it('volume de escolas não altera a pontuação nem a ordenação dos estados', async () => {
    const baseline = await setup().geoMap();
    for (const schoolUf of ['SP', 'RJ']) {
      const withSchools = await setup({ schoolCount: 1000, schoolUf }).geoMap();
      const scores = (states: typeof baseline.states) =>
        states.map(({ uf, pressureScore }) => ({ uf, pressureScore }));
      expect(scores(withSchools.states)).toEqual(scores(baseline.states));
      expect(withSchools.states[0]).toMatchObject({
        uf: 'SP',
        pressureScore: 44,
        researchSignals: 30,
      });
    }
  });

  it('mantém os pesos de CPCA, SMIF, casos concluídos e violência doméstica', async () => {
    const withoutVd = await setup({ domesticTotal: 0 }).geoMap();
    expect(withoutVd.states[0]).toMatchObject({
      uf: 'SP',
      cpcaOpenComplaints: 1,
      smifOpenComplaints: 1,
      complaints: 3,
      pressureScore: 8.8,
    });
    const withVd = await setup().geoMap();
    expect(withVd.states[0]).toMatchObject({
      domesticSurveyTotal: 100,
      domesticLast12MonthsYes: 30,
      pressureScore: 44,
      hasResearch: true,
    });
  });

  it('escolas não preenchem a lacuna de pesquisa de VD para reportes formais', async () => {
    const data = await setup({ schoolCount: 100, domesticTotal: 0 }).geoMap();
    expect(data.states[0]).toMatchObject({
      uf: 'SP',
      hasResearch: false,
      pressureScore: 8.8,
    });
    expect(data.summary?.statesWithComplaintsWithoutResearch).toBe(1);
  });

  it('missões e atividades permanecem como resposta sem alterar pressão', async () => {
    const data = await setup({ missions: 4, activities: 2 }).geoMap();
    expect(data.states.find((state) => state.uf === 'DF')).toMatchObject({
      pressureScore: 0,
      responseScore: 3,
      missions: 4,
      activities: 2,
    });
    expect(data.summary?.statesWithResponseOnly).toBe(1);
  });
});
