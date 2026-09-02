import {
  CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION,
  CPCA_JUDICIAL_ARCHIVE_SITUATION,
  isArchiveProcedureSituation,
  isJudicialArchiveProcedureSituation,
  syncWorkflowStatusWithProcedureSituation,
} from './cpca-workflow';

describe('cpca workflow helpers', () => {
  it('reconhece a situação arquivado pela justiça', () => {
    expect(
      isJudicialArchiveProcedureSituation(CPCA_JUDICIAL_ARCHIVE_SITUATION),
    ).toBe(true);
    expect(isJudicialArchiveProcedureSituation('arquivado_pela_justica')).toBe(
      true,
    );
    expect(isJudicialArchiveProcedureSituation('EM_ANDAMENTO')).toBe(false);
  });

  it('reconhece os resultados de arquivamento judicial e administrativo', () => {
    expect(isArchiveProcedureSituation(CPCA_JUDICIAL_ARCHIVE_SITUATION)).toBe(
      true,
    );
    expect(
      isArchiveProcedureSituation(CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION),
    ).toBe(true);
    expect(isArchiveProcedureSituation('MEDIDA_DISCIPLINAR_APLICADA')).toBe(
      false,
    );
  });

  it('sincroniza o status para archived quando a situação já for arquivado pela justiça', () => {
    expect(
      syncWorkflowStatusWithProcedureSituation({
        status: 'RECEIVED',
        procedureCurrentSituation: CPCA_JUDICIAL_ARCHIVE_SITUATION,
      }),
    ).toBe('ARCHIVED');
    expect(
      syncWorkflowStatusWithProcedureSituation({
        status: 'INVESTIGATION',
        procedureCurrentSituation: CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION,
      }),
    ).toBe('ARCHIVED');
  });

  it('mantém o status original quando a situação não exige sincronização', () => {
    expect(
      syncWorkflowStatusWithProcedureSituation({
        status: 'INVESTIGATION',
        procedureCurrentSituation: 'EM_ANDAMENTO',
      }),
    ).toBe('INVESTIGATION');
  });
});
