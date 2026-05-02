import { describe, expect, it } from "vitest";
import {
  getBiCpcaMeetingImportActionLabel,
  getBiCpcaMeetingImportModeLabel,
  resolveBiCpcaMeetingImportMode,
} from "./biCpcaMeetingImport";

describe("biCpcaMeetingImport", () => {
  it("usa importação incremental como padrão operacional", () => {
    expect(resolveBiCpcaMeetingImportMode(false)).toBe("INCREMENTAL");
    expect(getBiCpcaMeetingImportModeLabel("INCREMENTAL")).toBe("Incremental");
    expect(getBiCpcaMeetingImportActionLabel("INCREMENTAL")).toBe(
      "Buscar novos registros",
    );
  });

  it("usa substituição total quando o usuário escolhe zerar a base", () => {
    expect(resolveBiCpcaMeetingImportMode(true)).toBe("REPLACE");
    expect(getBiCpcaMeetingImportModeLabel("REPLACE")).toBe("Zerar base");
    expect(getBiCpcaMeetingImportActionLabel("REPLACE")).toBe(
      "Importar tudo da API",
    );
  });
});
