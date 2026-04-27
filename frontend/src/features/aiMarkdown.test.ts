import { describe, expect, it } from "vitest";
import { normalizeAiMarkdown } from "./aiMarkdown";

describe("aiMarkdown", () => {
  it("converte tags br em quebras de linha markdown", () => {
    expect(normalizeAiMarkdown("Linha 1<br>Linha 2")).toBe("Linha 1  \nLinha 2");
    expect(normalizeAiMarkdown("Linha 1<BR />Linha 2")).toBe("Linha 1  \nLinha 2");
    expect(normalizeAiMarkdown("Linha 1<br/>Linha 2")).toBe("Linha 1  \nLinha 2");
  });

  it("mantem textos sem br inalterados", () => {
    expect(normalizeAiMarkdown("Sem quebras HTML")).toBe("Sem quebras HTML");
  });
});
