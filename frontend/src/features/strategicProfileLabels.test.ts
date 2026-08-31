import { describe, expect, it } from "vitest";
import { formatStrategicProfileLabel } from "./strategicProfileLabels";

describe("formatStrategicProfileLabel", () => {
  it.each([
    ["Terceiro-Sargento", "Terceiro Sargento"],
    ["ASSEDIO_MORAL", "Assédio moral"],
    ["IMPORTUNACAO_SEXUAL", "Importunação sexual"],
    ["MAIOR_CINCO", "Maior que cinco vezes"],
    ["EXCLUSAO_ISOLAMENTO", "Exclusão/Isolamento"],
  ])("transforma %s em um rótulo legível", (value, expected) => {
    expect(formatStrategicProfileLabel(value)).toBe(expected);
  });

  it("formata os demais códigos usados nos gráficos", () => {
    expect(formatStrategicProfileLabel("31_35")).toBe("31 a 35 anos");
    expect(formatStrategicProfileLabel("INTERIOR_OM")).toBe("Interior da OM");
    expect(formatStrategicProfileLabel("CONTATO_FISICO_INDESEJADO")).toBe(
      "Contato físico indesejado",
    );
  });

  it("mantém texto comum e siglas sem deformá-los", () => {
    expect(formatStrategicProfileLabel("Não informado")).toBe("Não informado");
    expect(formatStrategicProfileLabel("OM")).toBe("OM");
  });
});
