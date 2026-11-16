import {
  readComplaintVictims,
  resolveComplaintVictims,
} from './complaint-victims';

const first = {
  id: 'v1',
  victimRank: '2S',
  victimGender: 'FEMININO',
  victimAgeRange: '19_25',
  incidentFrequency: 'DUAS_VEZES',
  hierarchicalFunctionalRelation: 'SUPERIOR_HIERARQUICO',
  occurrenceForms: ['HUMILHACAO_PUBLICA'],
  isNotifier: true,
};
const second = {
  id: 'v2',
  victimRank: '1T',
  victimGender: 'MASCULINO',
  victimAgeRange: '31_35',
  incidentFrequency: 'UMA_VEZ',
  hierarchicalFunctionalRelation: 'MESMA_GRADUACAO',
  occurrenceForms: ['AMEACAS_INTIMIDACAO'],
  isNotifier: false,
};

describe('vítimas de um reporte', () => {
  it('preserva dados antigos como uma vítima, incluindo a forma de ocorrência única', () => {
    const victims = readComplaintVictims({
      id: 'case',
      victimRank: '2S',
      victimGender: 'FEMININO',
      incidentFrequency: 'DUAS_VEZES',
      occurrenceForm: 'HUMILHACAO_PUBLICA',
      victimIsNotifier: true,
    });
    expect(victims).toHaveLength(1);
    expect(victims[0]).toMatchObject({
      id: 'victim-case',
      victimRank: '2S',
      incidentFrequency: 'DUAS_VEZES',
      occurrenceForms: ['HUMILHACAO_PUBLICA'],
      isNotifier: true,
    });
  });
  it('mantém perfil e características de cada vítima independentes', () => {
    expect(resolveComplaintVictims({ victims: [first, second] })).toEqual([
      first,
      second,
    ]);
  });
  it('não perde vítimas adicionais quando um cliente antigo edita campos da primeira', () => {
    const victims = resolveComplaintVictims(
      { victimRank: 'CAP', incidentFrequency: 'TRES_VEZES' },
      { victims: [first, second], victimIsNotifier: true },
    );
    expect(victims[0]).toMatchObject({
      ...first,
      victimRank: 'CAP',
      incidentFrequency: 'TRES_VEZES',
    });
    expect(victims[1]).toEqual(second);
  });
  it('permite trocar a noticiante e remove a indicação quando o noticiante é externo', () => {
    const rows = [
      { ...first, isNotifier: false },
      { ...second, isNotifier: true },
    ];
    expect(resolveComplaintVictims({ victims: rows })[1].isNotifier).toBe(true);
    expect(
      resolveComplaintVictims({ victims: rows, victimIsNotifier: false }).every(
        (row) => !row.isNotifier,
      ),
    ).toBe(true);
  });
  it('escolhe a primeira vítima quando a vítima noticiante foi removida', () => {
    expect(resolveComplaintVictims({ victims: [second] })[0]).toEqual({
      ...second,
      isNotifier: true,
    });
  });
  it.each(
    [
      [],
      [null],
      [{ ...first, victimRank: '   ' }],
      [first, first],
      [first, { ...second, isNotifier: true }],
    ].map((victims) => ({ victims })),
  )('rejeita vítimas inválidas ou ambíguas: %j', ({ victims }) => {
    expect(() => resolveComplaintVictims({ victims })).toThrow();
  });
});
