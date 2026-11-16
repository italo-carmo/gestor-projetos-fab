import {
  getComplaintReportStatus,
  CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION,
  CPCA_JUDICIAL_ARCHIVE_SITUATION,
  isArchiveProcedureSituation,
  isJudicialArchiveProcedureSituation,
  syncWorkflowStatusWithProcedureSituation,
} from './cpca-workflow';

describe('cpca workflow helpers', () => {
  it('classifica todas as etapas abertas como em apuração e os fechamentos como concluídos', () => {
    for (const status of [
      'RECEIVED',
      'PROTECTION_MEASURES',
      'PRELIMINARY_ANALYSIS',
      'PROCEDURE_DEFINED',
      'INVESTIGATION',
    ]) {
      expect(getComplaintReportStatus({ status })).toBe('INVESTIGATION');
    }
    for (const status of ['CONCLUDED', 'ARCHIVED']) {
      expect(getComplaintReportStatus({ status })).toBe('CONCLUDED');
    }
    expect(
      syncWorkflowStatusWithProcedureSituation({
        status: 'ARCHIVED',
        procedureCurrentSituation: null,
      }),
    ).toBe('CONCLUDED');
    expect(
      getComplaintReportStatus({
        status: 'RECEIVED',
        procedureCurrentSituation: 'ARQUIVADO_PELA_JUSTICA',
      }),
    ).toBe('CONCLUDED');
  });
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

  it('sincroniza o status para concluído quando o resultado é de arquivamento', () => {
    expect(
      syncWorkflowStatusWithProcedureSituation({
        status: 'RECEIVED',
        procedureCurrentSituation: CPCA_JUDICIAL_ARCHIVE_SITUATION,
      }),
    ).toBe('CONCLUDED');
    expect(
      syncWorkflowStatusWithProcedureSituation({
        status: 'INVESTIGATION',
        procedureCurrentSituation: CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION,
      }),
    ).toBe('CONCLUDED');
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
