export type CertificateQuestionType = "TEXT" | "MULTIPLE_CHOICE" | "CHECKBOXES";

export const CERTIFICATE_QUESTION_TYPE_LABELS: Record<
  CertificateQuestionType,
  string
> = {
  TEXT: "Texto livre",
  MULTIPLE_CHOICE: "Multipla escolha",
  CHECKBOXES: "Caixa de selecao",
};

export function normalizeCertificateFullNameInput(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          const lower = part.toLocaleLowerCase("pt-BR");
          const first = lower.charAt(0).toLocaleUpperCase("pt-BR");
          return `${first}${lower.slice(1)}`;
        })
        .join("-"),
    )
    .join(" ");
}

export function isValidEmailInput(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function formatCertificateDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const [year, month, day] = raw.slice(0, 10).split("-");
  if (!year || !month || !day) return raw;
  return `${day}/${month}/${year}`;
}

export function formatCertificateDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("pt-BR");
}

export function certificateDeliveryStatusLabel(status: string | null | undefined) {
  if (status === "SENT") return "Enviado";
  if (status === "FAILED") return "Falhou";
  if (status === "QUEUED") return "Na fila";
  return "Nao enviado";
}

export function certificateDeliveryStatusColor(status: string | null | undefined) {
  if (status === "SENT") return "success" as const;
  if (status === "FAILED") return "error" as const;
  if (status === "QUEUED") return "warning" as const;
  return "default" as const;
}
