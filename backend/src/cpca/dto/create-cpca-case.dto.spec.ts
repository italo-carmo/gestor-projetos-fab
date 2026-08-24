import {
  CPCA_DETAILED_VIOLENCE_TYPES,
  CPCA_SELECTABLE_DETAILED_VIOLENCE_TYPES,
} from './create-cpca-case.dto';

describe('CPCA_DETAILED_VIOLENCE_TYPES', () => {
  it('inclui os novos tipos de violencia aceitos nas denuncias CPCA e SMIF', () => {
    expect(CPCA_DETAILED_VIOLENCE_TYPES).toContain(
      'VIOLENCIA_DOMESTICA_VICARIA',
    );
    expect(CPCA_DETAILED_VIOLENCE_TYPES).toContain('DISCRIMINACAO');
    expect(CPCA_DETAILED_VIOLENCE_TYPES).not.toContain('HOMOFOBIA');
  });

  it('limita as novas opções à natureza do relato definida para CPCA e SMIF', () => {
    expect(CPCA_SELECTABLE_DETAILED_VIOLENCE_TYPES).toEqual([
      'ASSEDIO_MORAL',
      'ASSEDIO_SEXUAL',
      'VIOLENCIA_DOMESTICA_FISICA',
      'VIOLENCIA_DOMESTICA_PSICOLOGICA',
      'VIOLENCIA_DOMESTICA_MORAL',
      'VIOLENCIA_DOMESTICA_PATRIMONIAL',
      'VIOLENCIA_DOMESTICA_SEXUAL',
      'VIOLENCIA_DOMESTICA_VICARIA',
      'IMPORTUNACAO_SEXUAL',
      'DISCRIMINACAO',
    ]);
  });
});
