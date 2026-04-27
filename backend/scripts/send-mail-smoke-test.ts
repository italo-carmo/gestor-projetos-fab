import { ConfigService } from '@nestjs/config';
import { MailService } from '../src/mail/mail.service';
import { buildCpcaApprovalDecisionEmail } from '../src/mail/templates/cpca-approval-decision-email';

async function main() {
  const to = String(process.argv[2] ?? '').trim();
  if (!to) {
    throw new Error(
      'Uso: npx ts-node --transpile-only scripts/send-mail-smoke-test.ts destinatario@fab.mil.br',
    );
  }

  const mail = new MailService(new ConfigService());
  const message = buildCpcaApprovalDecisionEmail({
    requestTypeLabel: 'Solicitação de presidência CPCA',
    recipientName: 'Italo',
    status: 'APPROVED',
    locality: {
      code: 'BACO',
      name: 'Base Aérea de Canoas',
    },
    bulletinNumber: 'BOL TESTE 001',
    attemptLabel: 'Tentativa 3',
    decidedAt: new Date(),
  });

  const info = await mail.sendMail({
    to,
    ...message,
  });

  console.log(
    JSON.stringify(
      {
        to,
        subject: message.subject,
        messageId: info.messageId ?? null,
        accepted: info.accepted ?? [],
        rejected: info.rejected ?? [],
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
