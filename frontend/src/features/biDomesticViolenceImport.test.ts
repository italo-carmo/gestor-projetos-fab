import { describe, expect, it } from "vitest";
import {
  getBiDomesticViolenceImportActionLabel,
  getBiDomesticViolenceImportModeLabel,
  resolveBiDomesticViolenceImportMode,
} from "./biDomesticViolenceImport";

describe("biDomesticViolenceImport", () => {
  it("resolve o modo incremental como padrão operacional", () => {
    expect(resolveBiDomesticViolenceImportMode(false)).toBe("INCREMENTAL");
    expect(getBiDomesticViolenceImportModeLabel("INCREMENTAL")).toBe(
      "Incremental",
    );
    expect(getBiDomesticViolenceImportActionLabel("INCREMENTAL")).toBe(
      "Buscar novos registros",
    );
  });

  it("resolve o modo de substituição total quando o usuário escolhe zerar", () => {
    expect(resolveBiDomesticViolenceImportMode(true)).toBe("REPLACE");
    expect(getBiDomesticViolenceImportModeLabel("REPLACE")).toBe("Zerar base");
    expect(getBiDomesticViolenceImportActionLabel("REPLACE")).toBe(
      "Importar tudo da API",
    );
  });
});
