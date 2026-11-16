import { getCpcaCaseInconsistencies } from './cpca-case-inconsistency';

describe('getCpcaCaseInconsistencies', () => {
  const referenceNow = new Date('2026-04-21T12:00:00.000Z');

  it('verifica a ocorrência de cada vítima e mantém os alertas comuns uma única vez', () => {
    const items = getCpcaCaseInconsistencies(
      {
        detailedViolenceType: 'ASSEDIO_MORAL',
        reportedAt: '2026-05-01',
        victims: [
          { incidentFrequency: 'DUAS_VEZES' },
          { incidentFrequency: 'UMA_VEZ' },
          { incidentFrequency: 'UMA_VEZ' },
        ],
      },
      referenceNow,
    );
    expect(items.map((item) => item.code)).toEqual([
      'DATE_IN_FUTURE',
      'ICA_25_26',
    ]);
    expect(items[1].summary).toMatch(/^Vítimas 2, 3:/);
  });

  it('detecta datas futuras e cronologia invertida', () => {
    const items = getCpcaCaseInconsistencies(
      {
        reportedAt: '2026-05-01',
        incidentDate: '2026-05-02',
      },
      referenceNow,
    );

    expect(items.map((item) => item.code)).toEqual([
      'DATE_IN_FUTURE',
      'INCIDENT_AFTER_REPORT',
    ]);
  });

  it('detecta assédio moral sem reiteração', () => {
    const items = getCpcaCaseInconsistencies(
      {
        detailedViolenceType: 'ASSEDIO_MORAL',
        incidentFrequency: 'UMA_VEZ',
      },
      referenceNow,
    );

    expect(items.map((item) => item.code)).toContain('ICA_25_26');
    expect(items[0]?.referenceTitle).toContain('arts. 25 e 26');
  });

  it('detecta revisão de possível importunação sexual entre pares', () => {
    const items = getCpcaCaseInconsistencies(
      {
        complaintType: 'SEXUAL',
        hierarchicalFunctionalRelation: 'MESMA_GRADUACAO',
      },
      referenceNow,
    );

    expect(items.map((item) => item.code)).toContain('ICA_32_II_IMPORTUNACAO');
    expect(items[0]?.referenceBody).toContain('art. 215-A');
  });
});
