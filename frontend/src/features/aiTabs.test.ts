import { describe, expect, it } from "vitest";
import { normalizeAiPageTab } from "./aiTabs";

describe("aiTabs", () => {
  it("mantem as abas suportadas do menu de IA", () => {
    expect(normalizeAiPageTab("analyses", false)).toBe("analyses");
    expect(normalizeAiPageTab("chatbot", false)).toBe("chatbot");
    expect(normalizeAiPageTab("assistant", false)).toBe("assistant");
  });

  it("libera a aba cpca somente com permissao nacional", () => {
    expect(normalizeAiPageTab("cpca", true)).toBe("cpca");
    expect(normalizeAiPageTab("cpca", false)).toBe("analyses");
  });

  it("normaliza valores invalidos para a aba padrao", () => {
    expect(normalizeAiPageTab("", true)).toBe("analyses");
    expect(normalizeAiPageTab("desconhecida", true)).toBe("analyses");
    expect(normalizeAiPageTab(null, true)).toBe("analyses");
  });
});
