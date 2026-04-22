export const CPCA_PRESIDENT_BULLETIN_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const CPCA_PRESIDENT_BULLETIN_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

export type CpcaPresidentBulletinKind = "pdf" | "png" | "jpeg";

export type CpcaPresidentBulletinValidationResult =
  | {
      ok: true;
      kind: CpcaPresidentBulletinKind;
      mimeType: string;
      extension: string;
    }
  | {
      ok: false;
      message: string;
      reason:
        | "FILE_REQUIRED"
        | "FILE_TOO_LARGE"
        | "EXTENSION_INVALID"
        | "MIME_INVALID"
        | "MAGIC_INVALID"
        | "EXTENSION_MISMATCH"
        | "MIME_MISMATCH";
    };

const TYPE_CONFIG: Record<
  CpcaPresidentBulletinKind,
  {
    extension: string;
    extensions: string[];
    mimeType: string;
    mimeTypes: string[];
  }
> = {
  pdf: {
    extension: ".pdf",
    extensions: [".pdf"],
    mimeType: "application/pdf",
    mimeTypes: ["application/pdf"],
  },
  png: {
    extension: ".png",
    extensions: [".png"],
    mimeType: "image/png",
    mimeTypes: ["image/png"],
  },
  jpeg: {
    extension: ".jpg",
    extensions: [".jpg", ".jpeg"],
    mimeType: "image/jpeg",
    mimeTypes: ["image/jpeg", "image/pjpeg"],
  },
};

export async function validateCpcaPresidentBulletinFile(
  file: File | null | undefined,
): Promise<CpcaPresidentBulletinValidationResult> {
  if (!file) {
    return {
      ok: false,
      reason: "FILE_REQUIRED",
      message:
        "Envie o boletim publicado em PDF, PNG ou JPG antes de enviar a solicitação.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      reason: "FILE_REQUIRED",
      message: "O arquivo selecionado está vazio.",
    };
  }

  if (file.size > CPCA_PRESIDENT_BULLETIN_MAX_SIZE_BYTES) {
    return {
      ok: false,
      reason: "FILE_TOO_LARGE",
      message: "O boletim deve ter no máximo 10 MB.",
    };
  }

  const extension = getFileExtension(file.name);
  const mimeType = String(file.type ?? "")
    .trim()
    .toLowerCase();
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedKind = detectCpcaPresidentBulletinKind(header);

  if (!detectedKind) {
    return {
      ok: false,
      reason: "MAGIC_INVALID",
      message:
        "O arquivo não corresponde a um PDF, PNG ou JPG válido. Não basta renomear a extensão.",
    };
  }

  const config = TYPE_CONFIG[detectedKind];

  if (!config.extensions.includes(extension)) {
    return {
      ok: false,
      reason: "EXTENSION_MISMATCH",
      message:
        "A extensão do arquivo não corresponde ao conteúdo real do boletim.",
    };
  }

  if (!config.mimeTypes.includes(mimeType)) {
    return {
      ok: false,
      reason: "MIME_MISMATCH",
      message:
        "O tipo informado pelo navegador não corresponde ao conteúdo real do arquivo.",
    };
  }

  return {
    ok: true,
    kind: detectedKind,
    mimeType: config.mimeType,
    extension: config.extension,
  };
}

export function formatCpcaPresidentBulletinFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getCpcaPresidentBulletinPreviewKind(
  mimeType: string | null | undefined,
) {
  const normalized = String(mimeType ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized.startsWith("image/")) return "image";
  return "unknown";
}

function getFileExtension(value: string) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return normalized.slice(dotIndex);
}

function detectCpcaPresidentBulletinKind(
  header: Uint8Array,
): CpcaPresidentBulletinKind | null {
  if (
    header.length >= 5 &&
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  ) {
    return "pdf";
  }

  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "png";
  }

  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return "jpeg";
  }

  return null;
}
