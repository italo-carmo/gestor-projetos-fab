export const CPCA_CHECKLIST_ITEMS = [
  {
    key: 'EMAIL_DIRETO_RELATOS',
    label: 'A CPCA possui e-mail direto para relato das vítimas?',
    shortLabel: 'E-mail direto',
    description:
      'Confirma se a comissão mantém um e-mail direto para recebimento de relatos e permite registrar o endereço oficial.',
    requiresSpeakerName: false,
  },
  {
    key: 'LINK_INTRAER_CPCA',
    label:
      'Existe um link na página intraer da OM com função, membros, e-mail e acesso a relatos?',
    shortLabel: 'Link intraer',
    description:
      'Registra se a OM divulga a CPCA na Intraer e permite informar a URL da página institucional.',
    requiresSpeakerName: false,
  },
  {
    key: 'PALESTRA',
    label: 'Palestra',
    shortLabel: 'Palestra',
    description:
      'Registro de palestra institucional, com detalhamento do tema e identificação do palestrante.',
    requiresSpeakerName: true,
  },
  {
    key: 'SEMINARIO_EVENTO',
    label: 'Seminário e/ou outros eventos',
    shortLabel: 'Seminário',
    description:
      'Seminários, encontros ou eventos correlatos conduzidos pela comissão.',
    requiresSpeakerName: false,
  },
  {
    key: 'MATERIAIS_INFORMATIVOS',
    label: 'Materiais informativos',
    shortLabel: 'Materiais',
    description: 'Distribuição ou disponibilização de materiais informativos.',
    requiresSpeakerName: false,
  },
  {
    key: 'COMPARTILHAMENTO_APLICATIVOS_MENSAGEM',
    label: 'Compartilhamento de conteúdo em aplicativos de mensagens',
    shortLabel: 'Mensagens',
    description:
      'Envio de vídeos, reportagens, cartilhas ou orientações em aplicativos de mensagens.',
    requiresSpeakerName: false,
  },
  {
    key: 'POP_US',
    label: 'Pop-us',
    shortLabel: 'Pop-us',
    description: 'Ações de divulgação em formato pop-us.',
    requiresSpeakerName: false,
  },
  {
    key: 'REUNIAO_APRESENTACAO_MEMBROS',
    label: 'Reunião de apresentação dos membros da CPCA para o efetivo',
    shortLabel: 'Apresentação',
    description:
      'Reunião de apresentação dos membros da comissão ao efetivo da OM.',
    requiresSpeakerName: false,
  },
] as const;

export type CpcaChecklistItemKey = (typeof CPCA_CHECKLIST_ITEMS)[number]['key'];

export const CPCA_CHECKLIST_ITEM_KEYS = CPCA_CHECKLIST_ITEMS.map(
  (item) => item.key,
);

const CPCA_CHECKLIST_ITEM_KEY_SET = new Set<string>(CPCA_CHECKLIST_ITEM_KEYS);

export function isCpcaChecklistItemKey(
  value: string | null | undefined,
): value is CpcaChecklistItemKey {
  return CPCA_CHECKLIST_ITEM_KEY_SET.has(
    String(value ?? '')
      .trim()
      .toUpperCase(),
  );
}

export function getCpcaChecklistDefinition(itemKey: CpcaChecklistItemKey) {
  return CPCA_CHECKLIST_ITEMS.find((item) => item.key === itemKey) ?? null;
}

export function isCpcaChecklistDirectEmailItem(itemKey: CpcaChecklistItemKey) {
  return itemKey === 'EMAIL_DIRETO_RELATOS';
}

export function isCpcaChecklistIntraerLinkItem(itemKey: CpcaChecklistItemKey) {
  return itemKey === 'LINK_INTRAER_CPCA';
}
