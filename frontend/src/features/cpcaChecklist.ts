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

export type CpcaChecklistHistoryEntry = {
  id: string;
  completedAt: string;
  details: string | null;
  speakerName: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CpcaChecklistItem = {
  itemKey: CpcaChecklistItemKey;
  label: string;
  shortLabel: string;
  description: string;
  requiresSpeakerName: boolean;
  supportsHistory?: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  details: string | null;
  speakerName: string | null;
  historyCount?: number;
  historyEntries?: CpcaChecklistHistoryEntry[];
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
  supportsHistory: boolean;
  isCompleted: boolean;
  completedAt: string;
  details: string;
  speakerName: string;
  historyEntries: Array<{
    id?: string | null;
    completedAt: string;
    details: string;
    speakerName: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
};

export type CpcaChecklistHistoryEntryDraft =
  CpcaChecklistDraftItem["historyEntries"][number];

export type CpcaChecklistPendingHistoryDrafts = Partial<
  Record<CpcaChecklistItemKey, CpcaChecklistHistoryEntryDraft>
>;

export type CpcaChecklistSavePayloadItem = {
  itemKey: CpcaChecklistItemKey;
  isCompleted: boolean;
  completedAt?: string | null;
  details?: string | null;
  speakerName?: string | null;
  historyEntries?: Array<{
    id?: string | null;
    completedAt: string;
    details?: string | null;
    speakerName?: string | null;
  }>;
};

export type CpcaChecklistSavePreparation =
  | {
      ok: true;
      draft: CpcaChecklistDraftItem[];
      items: CpcaChecklistSavePayloadItem[];
    }
  | {
      ok: false;
      message: string;
      itemKey?: CpcaChecklistItemKey;
    };

type CpcaChecklistDraftPreparation =
  | {
      ok: true;
      draft: CpcaChecklistDraftItem[];
    }
  | {
      ok: false;
      message: string;
      itemKey?: CpcaChecklistItemKey;
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

export function isCpcaChecklistBinaryQuestionItem(
  itemKey: CpcaChecklistItemKey,
) {
  return itemKey === "EMAIL_DIRETO_RELATOS" || itemKey === "LINK_INTRAER_CPCA";
}

export function isCpcaChecklistHistoryItem(itemKey: CpcaChecklistItemKey) {
  return !isCpcaChecklistBinaryQuestionItem(itemKey);
}

function isCpcaChecklistItemKey(value: string): value is CpcaChecklistItemKey {
  return (CPCA_CHECKLIST_ITEM_ORDER as readonly string[]).includes(value);
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
  const raw = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  return raw.replace(
    /^(\d+\s*\/\s*\d+)\s*([A-Za-z].*)$/,
    (_match, prefix, suffix) => {
      const compactPrefix = String(prefix).replace(/\s+/g, "");
      return `${compactPrefix} ${String(suffix).trim()}`;
    },
  );
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
      background:
        "linear-gradient(135deg, rgba(46,125,50,0.14), rgba(102,187,106,0.08))",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      color: "warning" as const,
      background:
        "linear-gradient(135deg, rgba(245,124,0,0.14), rgba(255,183,77,0.08))",
    };
  }
  return {
    color: "default" as const,
    background:
      "linear-gradient(135deg, rgba(120,144,156,0.14), rgba(207,216,220,0.18))",
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
      supportsHistory: Boolean(
        item?.supportsHistory ?? isCpcaChecklistHistoryItem(itemKey),
      ),
      isCompleted: Boolean(item?.isCompleted),
      completedAt: item?.completedAt ? item.completedAt.slice(0, 10) : "",
      details: String(item?.details ?? ""),
      speakerName: String(item?.speakerName ?? ""),
      historyEntries: Array.isArray(item?.historyEntries)
        ? item.historyEntries.map((entry) => ({
            id: entry.id,
            completedAt: entry.completedAt
              ? entry.completedAt.slice(0, 10)
              : "",
            details: String(entry.details ?? ""),
            speakerName: String(entry.speakerName ?? ""),
            createdAt: entry.createdAt ?? null,
            updatedAt: entry.updatedAt ?? null,
          }))
        : [],
    };
  });
}

export function areCpcaChecklistDraftsEqual(
  left: CpcaChecklistDraftItem[],
  right: CpcaChecklistDraftItem[],
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sortCpcaChecklistHistoryEntryDrafts(
  entries: CpcaChecklistHistoryEntryDraft[],
) {
  return [...entries].sort((left, right) =>
    String(right.completedAt ?? "").localeCompare(
      String(left.completedAt ?? ""),
    ),
  );
}

export function applyCpcaChecklistHistoryEntriesToDraftItem(
  item: CpcaChecklistDraftItem,
  entries: CpcaChecklistHistoryEntryDraft[],
): CpcaChecklistDraftItem {
  const nextEntries = sortCpcaChecklistHistoryEntryDrafts(entries);
  const latestEntry = nextEntries[0];
  return {
    ...item,
    supportsHistory: true,
    isCompleted: nextEntries.length > 0,
    completedAt: latestEntry?.completedAt ?? "",
    details: latestEntry?.details ?? "",
    speakerName: latestEntry?.speakerName ?? "",
    historyEntries: nextEntries,
  };
}

function trimChecklistText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function isBlankHistoryEntryDraft(
  entry: CpcaChecklistHistoryEntryDraft | null | undefined,
) {
  return (
    !trimChecklistText(entry?.completedAt) &&
    !trimChecklistText(entry?.details) &&
    !trimChecklistText(entry?.speakerName)
  );
}

function isValidChecklistDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidChecklistEmail(value: string) {
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(
    value.trim().toLowerCase(),
  );
}

function isValidChecklistUrl(value: string) {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) return false;
  try {
    const parsed = new URL(normalizeCpcaChecklistUrl(raw));
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function mergePendingHistoryDrafts(
  draftItems: CpcaChecklistDraftItem[],
  pendingHistoryDrafts: CpcaChecklistPendingHistoryDrafts,
): CpcaChecklistDraftPreparation {
  let nextDraft = draftItems.map((item) => ({
    ...item,
    historyEntries: [...item.historyEntries],
  }));

  for (const [rawItemKey, draft] of Object.entries(pendingHistoryDrafts)) {
    if (
      !isCpcaChecklistItemKey(rawItemKey) ||
      !isCpcaChecklistHistoryItem(rawItemKey)
    ) {
      continue;
    }
    if (isBlankHistoryEntryDraft(draft)) continue;

    const completedAt = trimChecklistText(draft?.completedAt);
    const details = trimChecklistText(draft?.details);
    const speakerName = trimChecklistText(draft?.speakerName);

    if (!completedAt || !details) {
      return {
        ok: false,
        itemKey: rawItemKey,
        message: "Informe a data e a descrição do registro antes de salvar.",
      };
    }
    if (!isValidChecklistDate(completedAt)) {
      return {
        ok: false,
        itemKey: rawItemKey,
        message: "Revise a data do registro antes de salvar.",
      };
    }
    if (rawItemKey === "PALESTRA" && !speakerName) {
      return {
        ok: false,
        itemKey: rawItemKey,
        message: "Informe quem ministrou a palestra antes de salvar.",
      };
    }

    nextDraft = nextDraft.map((item) => {
      if (item.itemKey !== rawItemKey) return item;
      return applyCpcaChecklistHistoryEntriesToDraftItem(item, [
        ...item.historyEntries,
        {
          id: null,
          completedAt,
          details,
          speakerName: rawItemKey === "PALESTRA" ? speakerName : "",
        },
      ]);
    });
  }

  return { ok: true, draft: nextDraft };
}

function validateBinaryChecklistItem(item: CpcaChecklistDraftItem) {
  if (!item.isCompleted) return null;

  const completedAt = trimChecklistText(item.completedAt);
  const details = trimChecklistText(item.details);

  if (!completedAt) {
    return "Informe a data do registro antes de salvar.";
  }
  if (!isValidChecklistDate(completedAt)) {
    return "Revise a data do registro antes de salvar.";
  }
  if (item.itemKey === "EMAIL_DIRETO_RELATOS") {
    if (!details) return "Informe o e-mail direto da CPCA antes de salvar.";
    if (!isValidChecklistEmail(details)) {
      return "Informe um e-mail direto válido antes de salvar.";
    }
  }
  if (item.itemKey === "LINK_INTRAER_CPCA") {
    if (!details) return "Informe a URL da página intraer antes de salvar.";
    if (!isValidChecklistUrl(details)) {
      return "Informe uma URL intraer válida antes de salvar.";
    }
  }

  return null;
}

function validateHistoryChecklistEntry(
  itemKey: CpcaChecklistItemKey,
  entry: CpcaChecklistHistoryEntryDraft,
) {
  const completedAt = trimChecklistText(entry.completedAt);
  const details = trimChecklistText(entry.details);
  const speakerName = trimChecklistText(entry.speakerName);

  if (!completedAt || !details) {
    return "Informe a data e a descrição do registro antes de salvar.";
  }
  if (!isValidChecklistDate(completedAt)) {
    return "Revise a data do registro antes de salvar.";
  }
  if (itemKey === "PALESTRA" && !speakerName) {
    return "Informe quem ministrou a palestra antes de salvar.";
  }

  return null;
}

export function prepareCpcaChecklistSave(
  draftItems: CpcaChecklistDraftItem[],
  pendingHistoryDrafts: CpcaChecklistPendingHistoryDrafts = {},
): CpcaChecklistSavePreparation {
  const merged = mergePendingHistoryDrafts(draftItems, pendingHistoryDrafts);
  if (!merged.ok) return merged;

  const items: CpcaChecklistSavePayloadItem[] = [];

  for (const item of merged.draft) {
    if (item.supportsHistory) {
      const historyEntries = sortCpcaChecklistHistoryEntryDrafts(
        item.historyEntries,
      ).map((entry) => ({
        id: trimChecklistText(entry.id) || null,
        completedAt: trimChecklistText(entry.completedAt),
        details: trimChecklistText(entry.details) || null,
        speakerName: trimChecklistText(entry.speakerName) || null,
      }));

      for (const entry of historyEntries) {
        const error = validateHistoryChecklistEntry(item.itemKey, {
          id: entry.id,
          completedAt: entry.completedAt,
          details: entry.details ?? "",
          speakerName: entry.speakerName ?? "",
        });
        if (error) {
          return { ok: false, itemKey: item.itemKey, message: error };
        }
      }

      const latestEntry = historyEntries[0];
      items.push({
        itemKey: item.itemKey,
        isCompleted: historyEntries.length > 0,
        completedAt: latestEntry?.completedAt ?? null,
        details: latestEntry?.details ?? null,
        speakerName:
          item.itemKey === "PALESTRA"
            ? (latestEntry?.speakerName ?? null)
            : null,
        historyEntries,
      });
      continue;
    }

    const error = validateBinaryChecklistItem(item);
    if (error) return { ok: false, itemKey: item.itemKey, message: error };

    items.push({
      itemKey: item.itemKey,
      isCompleted: item.isCompleted,
      completedAt: item.isCompleted
        ? trimChecklistText(item.completedAt)
        : null,
      details: item.isCompleted
        ? trimChecklistText(item.details) || null
        : null,
      speakerName: item.isCompleted
        ? trimChecklistText(item.speakerName) || null
        : null,
    });
  }

  return {
    ok: true,
    draft: merged.draft,
    items,
  };
}
