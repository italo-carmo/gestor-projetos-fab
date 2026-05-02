import { describe, expect, it } from "vitest";
import {
  getBiBestPracticesCycleImportActionLabel,
  getBiBestPracticesCycleImportModeLabel,
  resolveBiBestPracticesCycleImportMode,
} from "./biBestPracticesCycleImport";

describe("biBestPracticesCycleImport", () => {
  it("usa sincronização incremental como padrão operacional", () => {
    expect(resolveBiBestPracticesCycleImportMode(false)).toBe("INCREMENTAL");
    expect(getBiBestPracticesCycleImportModeLabel("INCREMENTAL")).toBe(
      "Incremental",
    );
    expect(getBiBestPracticesCycleImportActionLabel("INCREMENTAL")).toBe(
      "Buscar novos registros",
    );
  });

  it("usa substituição total quando o usuário escolhe zerar a base", () => {
    expect(resolveBiBestPracticesCycleImportMode(true)).toBe("REPLACE");
    expect(getBiBestPracticesCycleImportModeLabel("REPLACE")).toBe(
      "Zerar base",
    );
    expect(getBiBestPracticesCycleImportActionLabel("REPLACE")).toBe(
      "Importar tudo da API",
    );
  });
});
