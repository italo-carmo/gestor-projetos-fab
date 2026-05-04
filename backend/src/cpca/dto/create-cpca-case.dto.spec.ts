import { CPCA_DETAILED_VIOLENCE_TYPES } from './create-cpca-case.dto';

describe('CPCA_DETAILED_VIOLENCE_TYPES', () => {
  it('inclui os novos tipos de violencia aceitos nas denuncias CPCA e SMIF', () => {
    expect(CPCA_DETAILED_VIOLENCE_TYPES).toContain(
      'VIOLENCIA_DOMESTICA_VICARIA',
    );
    expect(CPCA_DETAILED_VIOLENCE_TYPES).toContain('HOMOFOBIA');
  });
});
