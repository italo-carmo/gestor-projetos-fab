export const CPCA_CHECKLIST_ITEM_ORDER = [
  "EMAIL_DIRETO_RELATOS",
  "LINK_INTRAER_CPCA",
  "PALESTRA",
  "SEMINARIO_EVENTO",
  "MATERIAIS_INFORMATIVOS",
  "COMPARTILHAMENTO_APLICATIVOS_MENSAGEM",
  "POP_US",
  "REUNIAO_APRESENTACAO_MEMBROS",
] as const;

export type CpcaChecklistItemKey = (typeof CPCA_CHECKLIST_ITEM_ORDER)[number];
export type CpcaChecklistStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type CpcaChecklistItem = {
  itemKey: CpcaChecklistItemKey;
  label: string;
  shortLabel: string;
  description: string;
  requiresSpeakerName: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  details: string | null;
  speakerName: string | null;
  updatedAt?: string | null;
};

export type CpcaChecklistSummary = {
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number;
  status: CpcaChecklistStatus;
  statusLabel: string;
  lastCompletedAt?: string | null;
  lastUpdatedAt?: string | null;
};

export type CpcaChecklistSnapshot = {
  summary: CpcaChecklistSummary;
  items: CpcaChecklistItem[];
};

export type CpcaChecklistDraftItem = {
  itemKey: CpcaChecklistItemKey;
  isCompleted: boolean;
  completedAt: string;
  details: string;
  speakerName: string;
};

type CpcaChecklistFieldConfig = {
  statusDoneLabel: string;
  statusPendingLabel: string;
  detailsLabel: string;
  detailsPlaceholder: string;
  detailsHelperText?: string;
};

export function getCpcaChecklistFieldConfig(
  itemKey: CpcaChecklistItemKey,
): CpcaChecklistFieldConfig {
  if (itemKey === "EMAIL_DIRETO_RELATOS") {
    return {
      statusDoneLabel: "Sim",
      statusPendingLabel: "Não",
      detailsLabel: "E-mail direto da CPCA",
      detailsPlaceholder: "Informe o e-mail oficial para relatos",
      detailsHelperText:
        "Use o endereço que a vítima pode acionar diretamente para relatar o caso.",
    };
  }

  if (itemKey === "LINK_INTRAER_CPCA") {
    return {
      statusDoneLabel: "Sim",
      statusPendingLabel: "Não",
      detailsLabel: "URL da página intraer da CPCA",
      detailsPlaceholder: "Informe a URL interna de divulgação da CPCA",
      detailsHelperText:
        "Inclua a página onde aparecem a função da CPCA, os membros, o e-mail e o acesso para relatos.",
    };
  }

  if (itemKey === "PALESTRA") {
    return {
      statusDoneLabel: "Concluído",
      statusPendingLabel: "Pendente",
      detailsLabel: "Detalhamento da palestra",
      detailsPlaceholder: "Informe o tema, público atingido e contexto.",
    };
  }

  return {
    statusDoneLabel: "Concluído",
    statusPendingLabel: "Pendente",
    detailsLabel: "Qual ação foi executada",
    detailsPlaceholder: "Descreva o que foi feito nesta entrega.",
  };
}

export function isCpcaChecklistBinaryQuestionItem(itemKey: CpcaChecklistItemKey) {
  return itemKey === "EMAIL_DIRETO_RELATOS" || itemKey === "LINK_INTRAER_CPCA";
}

export function getCpcaChecklistReadOnlyStatusLabel(
  itemKey: CpcaChecklistItemKey,
  isCompleted: boolean,
) {
  if (isCpcaChecklistBinaryQuestionItem(itemKey)) {
    return isCompleted ? "Sim" : "Não";
  }

  return isCompleted ? "Concluído" : "Pendente";
}

export function normalizeCpcaChecklistUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

export function formatCpcaChecklistDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

export function normalizeCpcaChecklistOmCode(value: string | null | undefined) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.replace(/^(\d+\s*\/\s*\d+)\s*([A-Za-z].*)$/, (_match, prefix, suffix) => {
    const compactPrefix = String(prefix).replace(/\s+/g, "");
    return `${compactPrefix} ${String(suffix).trim()}`;
  });
}

export function formatCpcaChecklistOmLabel(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  const normalizedCode = normalizeCpcaChecklistOmCode(code);
  const normalizedName = normalizeCpcaChecklistOmCode(name);

  if (normalizedCode && normalizedName) {
    if (
      normalizedCode.localeCompare(normalizedName, "pt-BR", {
        sensitivity: "base",
      }) === 0
    ) {
      return normalizedCode;
    }
    return `${normalizedCode} - ${normalizedName}`;
  }

  return normalizedCode || normalizedName || "-";
}

export function getCpcaChecklistStatusTone(status: CpcaChecklistStatus) {
  if (status === "COMPLETED") {
    return {
      color: "success" as const,
      background: "linear-gradient(135deg, rgba(46,125,50,0.14), rgba(102,187,106,0.08))",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      color: "warning" as const,
      background: "linear-gradient(135deg, rgba(245,124,0,0.14), rgba(255,183,77,0.08))",
    };
  }
  return {
    color: "default" as const,
    background: "linear-gradient(135deg, rgba(120,144,156,0.14), rgba(207,216,220,0.18))",
  };
}

export function buildCpcaChecklistDraft(
  items: CpcaChecklistItem[] | undefined,
): CpcaChecklistDraftItem[] {
  const itemsByKey = new Map(
    (items ?? []).map((item) => [item.itemKey, item] as const),
  );

  return CPCA_CHECKLIST_ITEM_ORDER.map((itemKey) => {
    const item = itemsByKey.get(itemKey);
    return {
      itemKey,
      isCompleted: Boolean(item?.isCompleted),
      completedAt: item?.completedAt ? item.completedAt.slice(0, 10) : "",
      details: String(item?.details ?? ""),
      speakerName: String(item?.speakerName ?? ""),
    };
  });
}

export function areCpcaChecklistDraftsEqual(
  left: CpcaChecklistDraftItem[],
  right: CpcaChecklistDraftItem[],
) {
  return JSON.stringify(left) === JSON.stringify(right);
}
