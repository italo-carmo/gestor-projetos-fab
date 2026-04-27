export type CpcaSelfRegistrationNotificationEmailInput = {
  applicantName: string;
  applicantEmail?: string | null;
  applicantUid?: string | null;
  locality?: {
    code?: string | null;
    name?: string | null;
  } | null;
  bulletinNumber?: string | null;
  requestedAsSubstitution?: boolean;
  attemptNumber?: number | null;
  createdAt?: Date | string | null;
};

const SYSTEM_NAME = 'Gestor CIPAVD';

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

export function buildCpcaSelfRegistrationNotificationEmail(
  input: CpcaSelfRegistrationNotificationEmailInput,
) {
  const applicantName =
    String(input.applicantName ?? '').trim() || 'Militar não identificado';
  const applicantEmail = String(input.applicantEmail ?? '').trim();
  const applicantUid = String(input.applicantUid ?? '').trim();
  const localityLabel = formatLocalityLabel(input.locality);
  const createdAtLabel = formatDateTime(input.createdAt);
  const heading = 'Novo cadastro de presidente CPCA';
  const subject = `${SYSTEM_NAME} | ${heading}${localityLabel ? ` | ${localityLabel}` : ''}`;

  const details = [
    { label: 'Militar', value: applicantName },
    applicantEmail ? { label: 'E-mail', value: applicantEmail } : null,
    applicantUid ? { label: 'Identificador FAB', value: applicantUid } : null,
    localityLabel ? { label: 'OM', value: localityLabel } : null,
    input.bulletinNumber
      ? { label: 'Boletim', value: String(input.bulletinNumber).trim() }
      : null,
    {
      label: 'Substituição',
      value: input.requestedAsSubstitution ? 'Sim' : 'Não',
    },
    input.attemptNumber
      ? { label: 'Tentativa', value: String(input.attemptNumber) }
      : null,
    createdAtLabel ? { label: 'Cadastro', value: createdAtLabel } : null,
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item?.value),
  );

  const detailsHtml = details
    .map(
      (item) => `
        <tr>
          <td style="padding: 0 0 8px; color: #475467; font-size: 13px; width: 150px;">${escapeHtml(item.label)}</td>
          <td style="padding: 0 0 8px; color: #101828; font-size: 13px; font-weight: 600;">${escapeHtml(item.value)}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <div style="margin: 0; padding: 24px; background: #F5F7FA; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 680px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 18px 40px rgba(16, 24, 40, 0.10);">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #0C657E 0%, #0F172A 100%); color: #FFFFFF;">
          <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(SYSTEM_NAME)} • CPCA</div>
          <h1 style="margin: 16px 0 8px; font-size: 28px; line-height: 1.2;">${escapeHtml(heading)}</h1>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.92);">Um usuário se cadastrou como presidente CPCA e a solicitação aguarda análise no sistema.</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 24px; color: #344054; font-size: 15px; line-height: 1.7;">Confira os dados principais do cadastro recebido.</p>
          <div style="padding: 20px; border-radius: 16px; background: #F8FAFC; border: 1px solid #E4E7EC;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              ${detailsHtml}
            </table>
          </div>
          <p style="margin: 28px 0 0; color: #475467; font-size: 13px; line-height: 1.7;">Este e-mail foi enviado automaticamente pelo ${escapeHtml(SYSTEM_NAME)}.</p>
        </div>
      </div>
    </div>`;

  const textLines = [
    heading,
    '',
    'Um usuário se cadastrou como presidente CPCA e a solicitação aguarda análise no sistema.',
    '',
    ...details.map((item) => `${item.label}: ${item.value}`),
    '',
    `Este e-mail foi enviado automaticamente pelo ${SYSTEM_NAME}.`,
  ];

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}
