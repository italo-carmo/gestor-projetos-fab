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
    expect(message.text).not.toContain('CCA BR - CCA BR');
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

  it('permite reutilizar o modelo para notificar cadastro de membro sem duplicar OM', () => {
    const message = buildCpcaApprovalDecisionEmail({
      requestTypeLabel: 'Cadastro como membro da CPCA',
      recipientName: '2S MARIA',
      status: 'APPROVED',
      locality: {
        code: 'CCA BR',
        name: 'CCA BR',
      },
      heading: 'Cadastro como membro da CPCA registrado',
      badgeLabel: 'Cadastro registrado',
      intro: 'Você foi cadastrado como membro da CPCA desta OM no sistema.',
      bodyText:
        'Este aviso confirma o seu cadastro como membro da comissão CPCA.',
      nextSteps: ['Acesse novamente o sistema.'],
      extraDetails: [{ label: 'Cadastrado por', value: 'Presidente CPCA' }],
    });

    expect(message.subject).toBe(
      'Gestor CIPAVD | Cadastro como membro da CPCA registrado | CCA BR',
    );
    expect(message.html).toContain('Cadastro registrado');
    expect(message.html).toContain(
      'Você foi cadastrado como membro da CPCA desta OM no sistema.',
    );
    expect(message.text).toContain('Cadastrado por: Presidente CPCA');
    expect(message.subject).not.toContain('CCA BR · CCA BR');
    expect(message.html).not.toContain('CCA BR · CCA BR');
    expect(message.text).not.toContain('CCA BR · CCA BR');
    expect(message.subject).not.toContain('CCA BR - CCA BR');
    expect(message.html).not.toContain('CCA BR - CCA BR');
    expect(message.text).not.toContain('CCA BR - CCA BR');
  });
});
