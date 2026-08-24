export type CpcaCaseInconsistency = {
  code: string;
  badgeLabel: string;
  headline: string;
  summary: string;
  referenceTitle: string;
  referenceBody: string;
  tone: 'warning' | 'info';
};

type MinimalCpcaCase = {
  complaintType?: string | null;
  detailedViolenceType?: string | null;
  incidentFrequency?: string | null;
  hierarchicalFunctionalRelation?: string | null;
  reportedAt?: string | Date | null;
  incidentDate?: string | Date | null;
};

const ICA_ARTS_25_26_BODY = [
  'Art. 25. O assédio moral é uma forma de violência psicológica que ocorre no ambiente de trabalho, caracterizada por comportamentos abusivos, humilhantes, constrangedores ou vexatórios, que acontecem repetidamente com o intuito de desestabilizar emocionalmente a vítima.',
  'Art. 26. É importante compreender que o assédio moral é um processo que exige a habitualidade dos comportamentos assediadores. Uma ação isolada, embora possa ser grave e gerar responsabilização nas esferas cível, penal e administrativa, não será caracterizada como assédio moral devido à ausência de repetição sistemática.',
].join('\n\n');

const ICA_ART_32_II_AND_CP_215A_BODY = [
  'ICA 30-13, art. 32, II. O assédio sexual horizontal ocorre quando não há distinção hierárquica entre a pessoa que assedia e aquela que é assediada, a exemplo do constrangimento verificado entre colegas de trabalho. Essa forma de assédio sexual não é o crime de assédio previsto no Código Penal, mas pode ser entendida como o crime de importunação sexual previsto no art. 215-A.',
  'Código Penal, art. 215-A. Praticar contra alguém e sem a sua anuência ato libidinoso com o objetivo de satisfazer a própria lascívia ou a de terceiro.',
].join('\n\n');

function toDateKey(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function formatDateKey(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pt-BR');
}

export function getCpcaCaseInconsistencies(
  item: MinimalCpcaCase,
  referenceNow = new Date(),
): CpcaCaseInconsistency[] {
  const inconsistencies: CpcaCaseInconsistency[] = [];
  const complaintType = String(item.complaintType ?? '').trim().toUpperCase();
  const detailedViolenceType = String(item.detailedViolenceType ?? '')
    .trim()
    .toUpperCase();
  const incidentFrequency = String(item.incidentFrequency ?? '')
    .trim()
    .toUpperCase();
  const hierarchicalRelation = String(
    item.hierarchicalFunctionalRelation ?? '',
  )
    .trim()
    .toUpperCase();
  const todayKey = toDateKey(referenceNow);
  const reportedAtKey = toDateKey(item.reportedAt);
  const incidentDateKey = toDateKey(item.incidentDate);
  const futureFields: string[] = [];

  if (todayKey && reportedAtKey && reportedAtKey > todayKey) {
    futureFields.push(`recebimento em ${formatDateKey(reportedAtKey)}`);
  }
  if (todayKey && incidentDateKey && incidentDateKey > todayKey) {
    futureFields.push(`ocorrido em ${formatDateKey(incidentDateKey)}`);
  }

  if (futureFields.length > 0) {
    inconsistencies.push({
      code: 'DATE_IN_FUTURE',
      badgeLabel: 'Data futura',
      headline: 'Data lançada no futuro',
      summary: `O cadastro contém data futura: ${futureFields.join(' e ')}.`,
      referenceTitle: 'Revisão cronológica do cadastro',
      referenceBody:
        'Revise as datas informadas no acolhimento. Datas de recebimento ou do ocorrido posteriores à data atual normalmente indicam erro de lançamento ou de importação.',
      tone: 'warning',
    });
  }

  if (reportedAtKey && incidentDateKey && incidentDateKey > reportedAtKey) {
    inconsistencies.push({
      code: 'INCIDENT_AFTER_REPORT',
      badgeLabel: 'Cronologia',
      headline: 'Ocorrido posterior ao recebimento',
      summary: `A data do ocorrido (${formatDateKey(incidentDateKey)}) está posterior à data de recebimento do acolhimento (${formatDateKey(reportedAtKey)}).`,
      referenceTitle: 'Revisão cronológica do cadastro',
      referenceBody:
        'Revise a ordem das datas informadas. Em regra, a data do fato não deve ficar posterior à data em que o acolhimento foi recebido ou registrado.',
      tone: 'warning',
    });
  }

  if (
    detailedViolenceType === 'ASSEDIO_MORAL' &&
    incidentFrequency === 'UMA_VEZ'
  ) {
    inconsistencies.push({
      code: 'ICA_25_26',
      badgeLabel: 'Art. 25/26',
      headline: 'Possível inconsistência de enquadramento',
      summary:
        'O caso foi lançado como assédio moral, mas a frequência está marcada como ocorrência única. Pela ICA 30-13, assédio moral exige reiteração.',
      referenceTitle: 'ICA 30-13, arts. 25 e 26',
      referenceBody: ICA_ARTS_25_26_BODY,
      tone: 'warning',
    });
  }

  if (
    complaintType === 'SEXUAL' &&
    hierarchicalRelation === 'MESMA_GRADUACAO'
  ) {
    inconsistencies.push({
      code: 'ICA_32_II_IMPORTUNACAO',
      badgeLabel: 'Revisar art. 32, II',
      headline: 'Revisar possível importunação sexual',
      summary:
        'Quando o fato sexual ocorre entre pares do mesmo nível hierárquico, a ICA 30-13 trata isso como assédio sexual horizontal e aponta revisão para possível importunação sexual.',
      referenceTitle: 'ICA 30-13, art. 32, II, e Código Penal, art. 215-A',
      referenceBody: ICA_ART_32_II_AND_CP_215A_BODY,
      tone: 'info',
    });
  }

  return inconsistencies;
}
