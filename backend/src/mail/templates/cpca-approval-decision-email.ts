export type CpcaApprovalDecisionStatus = 'APPROVED' | 'REJECTED';

export type CpcaApprovalDecisionEmailInput = {
  requestTypeLabel: string;
  recipientName?: string | null;
  status: CpcaApprovalDecisionStatus;
  locality?: {
    code?: string | null;
    name?: string | null;
  } | null;
  bulletinNumber?: string | null;
  attemptLabel?: string | null;
  requestedAsSubstitution?: boolean;
  nomineeName?: string | null;
  managedLocalitiesLabel?: string | null;
  decidedAt?: Date | string | null;
  decisionReason?: string | null;
  reasonLabel?: string | null;
  heading?: string | null;
  badgeLabel?: string | null;
  intro?: string | null;
  bodyText?: string | null;
  nextSteps?: string[];
  extraDetails?: Array<{
    label: string;
    value?: string | null;
  }>;
};

const SYSTEM_NAME = 'INTEGRA';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatLocalityLabel(
  locality:
    | {
        code?: string | null;
        name?: string | null;
      }
    | null
    | undefined,
) {
  const code = String(locality?.code ?? '').trim();
  const name = String(locality?.name ?? '').trim();
  if (code && name) {
    if (code.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0) {
      return code;
    }
    return `${code} · ${name}`;
  }
  return code || name || null;
}

export function buildCpcaApprovalDecisionEmail(
  input: CpcaApprovalDecisionEmailInput,
) {
  const recipientName = String(input.recipientName ?? '').trim() || 'militar';
  const localityLabel = formatLocalityLabel(input.locality);
  const decidedAtLabel = formatDateTime(input.decidedAt);
  const defaultHeading =
    input.status === 'APPROVED'
      ? `${input.requestTypeLabel} homologada`
      : `${input.requestTypeLabel} rejeitada`;
  const heading = String(input.heading ?? '').trim() || defaultHeading;
  const accentColor = input.status === 'APPROVED' ? '#0B7A3B' : '#B42318';
  const defaultBadgeLabel =
    input.status === 'APPROVED' ? 'Homologada' : 'Rejeitada';
  const badgeLabel = String(input.badgeLabel ?? '').trim() || defaultBadgeLabel;
  const defaultIntro =
    input.status === 'APPROVED'
      ? 'A gestão nacional concluiu a análise e homologou esta solicitação no sistema.'
      : 'A gestão nacional concluiu a análise e rejeitou esta solicitação no sistema.';
  const intro = String(input.intro ?? '').trim() || defaultIntro;
  const bodyText =
    String(input.bodyText ?? '').trim() ||
    'Este aviso confirma a decisão sobre a sua solicitação vinculada à comissão CPCA. Abaixo estão os principais detalhes para consulta rápida.';
  const reason =
    input.status === 'REJECTED'
      ? String(input.decisionReason ?? '').trim() || 'Motivo não informado.'
      : null;
  const reasonLabel =
    String(input.reasonLabel ?? '').trim() || 'Motivo informado';

  const details = [
    localityLabel ? { label: 'OM', value: localityLabel } : null,
    input.bulletinNumber
      ? { label: 'Boletim', value: String(input.bulletinNumber).trim() }
      : null,
    input.attemptLabel
      ? { label: 'Tentativa', value: String(input.attemptLabel).trim() }
      : null,
    input.requestedAsSubstitution
      ? { label: 'Modalidade', value: 'Substituição' }
      : null,
    input.nomineeName
      ? { label: 'Indicado', value: String(input.nomineeName).trim() }
      : null,
    input.managedLocalitiesLabel
      ? {
          label: 'Cobertura solicitada',
          value: String(input.managedLocalitiesLabel).trim(),
        }
      : null,
    decidedAtLabel ? { label: 'Decisão', value: decidedAtLabel } : null,
    ...((input.extraDetails ?? []).map((item) =>
      item.value ? { label: item.label, value: item.value } : null,
    ) as Array<{ label: string; value: string } | null>),
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item?.value),
  );

  const defaultNextSteps =
    input.status === 'APPROVED'
      ? [
          'A atualização já foi registrada no sistema.',
          'Se o acesso ou a tela não refletirem a mudança imediatamente, atualize a página e entre novamente.',
        ]
      : [
          'Revise o motivo informado abaixo.',
          'Ajuste os dados necessários e envie uma nova solicitação quando aplicável.',
          'Você pode acompanhar o andamento pela tela de login do sistema.',
        ];
  const nextSteps =
    input.nextSteps && input.nextSteps.length > 0
      ? input.nextSteps.map((step) => String(step ?? '').trim()).filter(Boolean)
      : defaultNextSteps;

  const detailsHtml = details
    .map(
      (item) => `
        <tr>
          <td style="padding: 0 0 8px; color: #475467; font-size: 13px; width: 140px;">${escapeHtml(item.label)}</td>
          <td style="padding: 0 0 8px; color: #101828; font-size: 13px; font-weight: 600;">${escapeHtml(item.value)}</td>
        </tr>`,
    )
    .join('');

  const nextStepsHtml = nextSteps
    .map(
      (step) =>
        `<li style="margin: 0 0 8px; color: #344054;">${escapeHtml(step)}</li>`,
    )
    .join('');

  const reasonHtml = reason
    ? `
      <div style="margin-top: 20px; padding: 16px; border-radius: 14px; background: #FEF3F2; border: 1px solid #FECDCA;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #B42318; margin-bottom: 8px;">${escapeHtml(reasonLabel)}</div>
        <div style="font-size: 14px; line-height: 1.6; color: #7A271A;">${escapeHtml(reason)}</div>
      </div>`
    : '';

  const subject = `${SYSTEM_NAME} | ${heading}${localityLabel ? ` | ${localityLabel}` : ''}`;
  const html = `
    <div style="margin: 0; padding: 24px; background: #F5F7FA; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 680px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 18px 40px rgba(16, 24, 40, 0.10);">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, ${accentColor} 0%, #0F172A 100%); color: #FFFFFF;">
          <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(SYSTEM_NAME)} • ${escapeHtml(badgeLabel)}</div>
          <h1 style="margin: 16px 0 8px; font-size: 28px; line-height: 1.2;">${escapeHtml(heading)}</h1>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.92);">${escapeHtml(intro)}</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 18px; color: #101828; font-size: 16px; line-height: 1.6;">Olá, <strong>${escapeHtml(recipientName)}</strong>.</p>
          <p style="margin: 0 0 24px; color: #344054; font-size: 15px; line-height: 1.7;">${escapeHtml(bodyText)}</p>
          <div style="padding: 20px; border-radius: 16px; background: #F8FAFC; border: 1px solid #E4E7EC;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              ${detailsHtml}
            </table>
          </div>
          ${reasonHtml}
          <div style="margin-top: 24px; padding: 20px; border-radius: 16px; background: #FCFCFD; border: 1px solid #EAECF0;">
            <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475467; margin-bottom: 12px;">Próximos passos</div>
            <ol style="margin: 0; padding-left: 20px;">
              ${nextStepsHtml}
            </ol>
          </div>
          <p style="margin: 28px 0 0; color: #475467; font-size: 13px; line-height: 1.7;">Este e-mail foi enviado automaticamente pelo ${escapeHtml(SYSTEM_NAME)}. Caso necessário, mantenha esta mensagem para consulta futura.</p>
        </div>
      </div>
    </div>`;

  const textLines = [
    heading,
    '',
    `Olá, ${recipientName}.`,
    intro,
    bodyText,
    '',
    ...details.map((item) => `${item.label}: ${item.value}`),
    reason ? '' : null,
    reason ? `${reasonLabel}: ${reason}` : null,
    '',
    'Próximos passos:',
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `Este e-mail foi enviado automaticamente pelo ${SYSTEM_NAME}.`,
  ].filter((line): line is string => line !== null);

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}
