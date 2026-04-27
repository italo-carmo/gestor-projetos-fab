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
      'Gestor CIPAVD | Solicitação de presidência CPCA homologada | CCA BR',
    );
    expect(message.subject).not.toContain('CCA BR · CCA BR');
    expect(message.html).toContain('Gestor CIPAVD');
    expect(message.html).not.toContain('CCA BR · CCA BR');
    expect(message.text).toContain('OM: CCA BR');
    expect(message.text).not.toContain('CCA BR · CCA BR');
  });

  it('usa a nova marca no email de rejeicao', () => {
    const message = buildCpcaApprovalDecisionEmail({
      requestTypeLabel: 'Solicitação de presidência CPCA',
      recipientName: 'Maj Silva',
      status: 'REJECTED',
      locality: {
        code: 'CCA BR',
        name: 'CCA BR',
      },
      decisionReason: 'Ajustar o boletim informado.',
    });

    expect(message.subject).toBe(
      'Gestor CIPAVD | Solicitação de presidência CPCA rejeitada | CCA BR',
    );
    expect(message.html).toContain('Gestor CIPAVD');
    expect(message.html).toContain('Ajustar o boletim informado.');
    expect(message.text).toContain(
      'Este e-mail foi enviado automaticamente pelo Gestor CIPAVD.',
    );
    expect(message.text).not.toContain('CPCA COMGEP');
  });
});
