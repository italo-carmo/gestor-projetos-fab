import { buildCpcaApprovalDecisionEmail } from './cpca-approval-decision-email';

describe('buildCpcaApprovalDecisionEmail', () => {
  it('nao duplica a sigla da OM no assunto quando codigo e nome sao iguais', () => {
    const message = buildCpcaApprovalDecisionEmail({
      requestTypeLabel: 'Solicitação de presidência CPCA',
      recipientName: '1T DENISE',
      status: 'APPROVED',
      locality: {
        code: 'CCA BR',
        name: 'CCA BR',
      },
      decidedAt: new Date('2026-04-27T14:44:21.504Z'),
    });

    expect(message.subject).toBe(
      'CPCA COMGEP | Solicitação de presidência CPCA homologada | CCA BR',
    );
    expect(message.subject).not.toContain('CCA BR · CCA BR');
  });
});
