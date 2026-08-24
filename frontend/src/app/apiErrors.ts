import { AxiosError } from "axios";

export type ApiErrorPayload = {
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
};

const REASON_MESSAGES: Record<string, string> = {
  CONFIDENTIALITY_TERM_REQUIRED_FOR_SEXUAL:
    "Para assédio sexual, o Termo de Sigilo deve ser marcado na etapa 2 (Acolhimento e proteção) antes de salvar.",
  PRELIMINARY_REPORT_DATE_REQUIRES_FLAG:
    "Informe que o relatório preliminar foi gerado antes de definir a data.",
  PROCESS_NOT_OPENED_REASON_REQUIRED:
    "Justifique o motivo de não ter sido aberto um processo.",
  DETAILED_VIOLENCE_TYPE_NOT_SELECTABLE:
    "Selecione uma das opções disponíveis em Natureza do Relato.",
  SEPARATION_APPLIED_REQUIRES_EVALUATION:
    "Marque que a separação foi avaliada antes de aplicá-la.",
  CONTRACTOR_REFERRAL_REQUIRES_OUTSOURCED_FLAG:
    "Marque que o acusado é terceirizado antes de informar a data de encaminhamento.",
  OUTCOME_SUMMARY_REQUIRED_FOR_CLOSURE:
    "Preencha o resumo do desfecho para concluir/arquivar o caso.",
  ARCHIVE_REASON_REQUIRED_FOR_ARCHIVE:
    "Preencha o motivo do arquivamento antes de salvar o acolhimento como arquivado.",
  DEFENSE_CONFIRMATION_REQUIRED_FOR_CLOSURE:
    "Confirme que o direito de defesa do acusado foi assegurado antes de concluir/arquivar.",
  CPCA_NOT_ENABLED_FOR_LOCALITY:
    "A OM selecionada não está com CPCA habilitado no cadastro de OMs.",
  CPCA_LOCALITY_ALREADY_HAS_PRESIDENT:
    "Já existe presidente CPCA para esta OM. Confirme ciência para prosseguir com a troca.",
  CPCA_PRESIDENT_REQUEST_ALREADY_PENDING:
    "Já existe uma solicitação pendente para este militar nessa OM.",
  CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED:
    "Esta solicitação já foi processada anteriormente.",
  CPCA_PRESIDENT_REQUEST_RESUBMISSION_ONLY_AFTER_REJECTION:
    "Só é possível reenviar uma solicitação que tenha sido rejeitada.",
  CPCA_SELF_REGISTRATION_LOCALITY_REQUIRED:
    "Selecione a OM para a qual deseja solicitar homologação como presidente CPCA.",
  CPCA_SELF_REGISTRATION_LOCALITY_NOT_FOUND:
    "A OM selecionada não foi encontrada no cadastro do sistema.",
  CPCA_SELF_REGISTRATION_RESUBMISSION_LOCALITY_MISMATCH:
    "O reenvio deve manter a mesma OM da tentativa rejeitada. Para trocar a OM, envie uma nova solicitação.",
  CPCA_SELF_REGISTRATION_LOCALITY_MISMATCH:
    "A OM selecionada não corresponde à solicitação anterior.",
  CPCA_SELF_REGISTRATION_LDAP_LOCALITY_NOT_FOUND:
    "Não foi possível identificar sua OM no LDAP para validar o cadastro.",
  CPCA_SELF_REGISTRATION_LDAP_LOCALITY_WITHOUT_CPCA:
    "Sua OM no LDAP ainda não está habilitada com CPCA no sistema.",
  CPCA_PRESIDENT_BULLETIN_FILE_REQUIRED:
    "Envie o boletim publicado em PDF, PNG ou JPG antes de enviar a solicitação.",
  CPCA_PRESIDENT_BULLETIN_MAGIC_INVALID:
    "O arquivo enviado não corresponde a um PDF, PNG ou JPG autêntico.",
  CPCA_PRESIDENT_BULLETIN_EXTENSION_MISMATCH:
    "A extensão do arquivo não corresponde ao conteúdo real do boletim.",
  CPCA_PRESIDENT_BULLETIN_MIME_MISMATCH:
    "O tipo do arquivo não corresponde ao conteúdo real do boletim.",
  CPCA_PRESIDENT_BULLETIN_UNAVAILABLE:
    "O arquivo da publicação não está mais disponível para visualização.",
  CPCA_PRESIDENT_CANNOT_BE_MEMBER:
    "O presidente da comissão não pode ser adicionado como membro.",
  CPCA_COVERAGE_REQUEST_ALREADY_PENDING:
    "Já existe uma solicitação pendente de alteração de cobertura para esta OM.",
  CPCA_PRESIDENT_NOMINATION_ALREADY_PENDING:
    "Já existe uma solicitação pendente de sucessão da presidência para esta OM.",
  CPCA_CHECKLIST_EMAIL_REQUIRED:
    "Informe o e-mail direto da CPCA antes de salvar o checklist.",
  CPCA_CHECKLIST_INTRAER_URL_REQUIRED:
    "Informe a URL da página intraer antes de salvar o checklist.",
  CPCA_CHECKLIST_PALESTRA_DETAILS_REQUIRED:
    "Informe o detalhamento da palestra antes de salvar o checklist.",
  CPCA_CHECKLIST_HISTORY_DETAILS_REQUIRED:
    "Informe a descrição do registro antes de salvar o checklist.",
  CPCA_EMAIL_ATTACHMENT_REQUIRED:
    "Selecione um arquivo para anexar ao modelo de e-mail.",
  CPCA_EMAIL_ATTACHMENT_EXTENSION_INVALID:
    "Este tipo de anexo não é permitido para envio por e-mail.",
  CPCA_EMAIL_ATTACHMENT_TOO_LARGE:
    "O anexo excede o tamanho permitido para envio por e-mail.",
  CPCA_EMAIL_ATTACHMENT_FILE_UNAVAILABLE:
    "Um anexo do modelo não está mais disponível no servidor.",
  CPCA_EMAIL_RECIPIENTS_REQUIRED:
    "Selecione ao menos um presidente CPCA antes de enviar.",
  CPCA_CHECKLIST_PALESTRA_SPEAKER_REQUIRED:
    "Informe quem ministrou a palestra antes de salvar o checklist.",
  CPCA_CHECKLIST_ITEMS_REQUIRED:
    "Recarregue a página e tente salvar novamente. O checklist enviado está incompleto.",
  INVALID_CPCA_CHECKLIST_ITEM:
    "Recarregue a página e tente salvar novamente. Há um item de checklist inválido.",
  INVALID_CPCA_CHECKLIST_DATE:
    "Revise a data do registro antes de salvar o checklist.",
  INVALID_CPCA_CHECKLIST_EMAIL:
    "Informe um e-mail direto válido antes de salvar o checklist.",
  INVALID_CPCA_CHECKLIST_URL:
    "Informe uma URL intraer válida antes de salvar o checklist.",
  LOCALITY_HAS_LINKED_DATA:
    "Esta localidade não pode ser excluída porque possui dados vinculados. Remova ou ajuste esses vínculos antes de excluir.",
  OM_HAS_LINKED_DATA:
    "Esta OM não pode ser excluída porque possui dados vinculados. Remova ou ajuste esses vínculos antes de excluir.",
  NOTIFIER_RANK_REQUIRED_WHEN_DIFFERENT:
    "Quando noticiante e vítima forem pessoas diferentes, informe o posto/graduação do noticiante.",
  NOTIFIER_GENDER_REQUIRED_WHEN_DIFFERENT:
    "Quando noticiante e vítima forem pessoas diferentes, informe o sexo do noticiante.",
  AI_POSSIBLE_MILITARY_NAMES_DETECTED:
    "A Inteligência Artificial identificou a presença de possíveis nomes no texto.",
  ACTIVITY_TYPE_IN_USE:
    "Este tipo não pode ser excluído porque já possui atividades vinculadas.",
  INVALID_STATUS_TRANSITION: "Transição de status inválida.",
};

export function parseApiError(error: unknown): ApiErrorPayload {
  const err = error as AxiosError<ApiErrorPayload>;
  if (err?.response?.data?.message) {
    const data = err.response.data;
    const field =
      typeof data.details?.field === "string" ? data.details.field : undefined;
    const reasonRaw = data.details?.reason;
    const reason = typeof reasonRaw === "string" ? reasonRaw : undefined;
    if (data.code === "CONFLICT_UNIQUE" && field === "code") {
      return {
        ...data,
        message: "Já existe um cadastro com esse código.",
      };
    }
    if (reason === "ACTIVITY_TYPE_IN_USE") {
      const count =
        typeof data.details?.count === "number"
          ? data.details.count
          : Number(data.details?.count ?? 0);
      const name =
        typeof data.details?.name === "string" ? data.details.name.trim() : "";
      if (Number.isFinite(count) && count > 0) {
        return {
          ...data,
          message: `O tipo${name ? ` "${name}"` : ""} não pode ser excluído porque já possui ${count} atividade(s) vinculada(s).`,
        };
      }
    }
    if (
      (reason === "LOCALITY_HAS_LINKED_DATA" ||
        reason === "OM_HAS_LINKED_DATA") &&
      (Array.isArray(data.details?.linkedResources) ||
        Array.isArray(data.details?.labels))
    ) {
      const labelsSource = Array.isArray(data.details?.linkedResources)
        ? data.details.linkedResources
        : data.details?.labels;
      const labels = (
        labelsSource as Array<
          | string
          | {
              label?: unknown;
              count?: unknown;
            }
        >
      )
        .map((item) => {
          if (typeof item === "string") return item.trim() || null;
          const label =
            typeof item?.label === "string" ? item.label.trim() : "";
          const count =
            typeof item?.count === "number"
              ? item.count
              : Number(item?.count ?? 0);
          if (!label) return null;
          if (!Number.isFinite(count) || count <= 0) return label;
          return `${label} (${count})`;
        })
        .filter((item): item is string => Boolean(item))
        .join(", ");
      if (labels) {
        const entityLabel =
          reason === "LOCALITY_HAS_LINKED_DATA" ? "Esta localidade" : "Esta OM";
        return {
          ...data,
          message: `${entityLabel} não pode ser excluída porque possui vínculos: ${labels}`,
        };
      }
    }
    if (reason && REASON_MESSAGES[reason]) {
      return { ...data, message: REASON_MESSAGES[reason] };
    }
    return data;
  }
  if (err?.request && !err?.response) {
    return {
      message:
        "Não foi possível conectar ao servidor. Verifique se o backend está rodando (porta 3000).",
    };
  }
  if (err?.message) {
    return { message: err.message };
  }
  return { message: "Erro inesperado" };
}
