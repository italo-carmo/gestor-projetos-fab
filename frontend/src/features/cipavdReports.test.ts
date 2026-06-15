import { describe, expect, it } from "vitest";
import {
  canPreviewCipavdReportPdf,
  getCipavdReportFileExtension,
} from "./cipavdReports";

describe("cipavdReports helpers", () => {
  it("identifica PDFs por extensao ou mime type", () => {
    expect(canPreviewCipavdReportPdf({ name: "relatorio.pdf" })).toBe(true);
    expect(
      canPreviewCipavdReportPdf({
        name: "relatorio",
        mimeType: "application/pdf",
      }),
    ).toBe(true);
    expect(canPreviewCipavdReportPdf({ name: "relatorio.docx" })).toBe(false);
  });

  it("extrai extensao usando nome exibido ou nome armazenado", () => {
    expect(getCipavdReportFileExtension({ name: "Ata.Final.PDF" })).toBe("pdf");
    expect(
      getCipavdReportFileExtension({
        name: "",
        fileName: "arquivo-gerado.docx",
      }),
    ).toBe("docx");
    expect(getCipavdReportFileExtension({ name: "relatorio" })).toBe("");
  });
});
