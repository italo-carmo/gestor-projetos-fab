export type CipavdReportFileLike = {
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export function getCipavdReportFileExtension(file: CipavdReportFileLike) {
  const fileName = String(file.name || file.fileName || "").trim();
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) return "";
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

export function canPreviewCipavdReportPdf(file: CipavdReportFileLike) {
  const extension = getCipavdReportFileExtension(file);
  const mimeType = String(file.mimeType ?? "").toLowerCase();
  return extension === "pdf" || mimeType === "application/pdf";
}
