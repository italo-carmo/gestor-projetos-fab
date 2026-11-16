import { describe, expect, it } from "vitest";
import {
  createComplaintVictim,
  getNotifyingVictim,
  readComplaintVictims,
  removeComplaintVictim,
} from "./complaintVictims";

describe("vítimas no formulário", () => {
  it("abre um reporte antigo sem perder os dados e ocorrências da vítima", () => {
    const victims = readComplaintVictims({
      id: "old",
      victimRank: "2S",
      victimGender: "FEMININO",
      occurrenceForm: "HUMILHACAO_PUBLICA",
      incidentFrequency: "DUAS_VEZES",
    });
    expect(victims).toHaveLength(1);
    expect(victims[0]).toMatchObject({
      id: "victim-old",
      victimRank: "2S",
      victimGender: "FEMININO",
      incidentFrequency: "DUAS_VEZES",
      occurrenceForms: ["HUMILHACAO_PUBLICA"],
      isNotifier: true,
    });
  });
  it("adiciona campos vazios e listas independentes", () => {
    const first = createComplaintVictim(true);
    const second = createComplaintVictim();
    first.occurrenceForms.push("HUMILHACAO_PUBLICA");
    first.incidentFrequency = "DUAS_VEZES";
    expect(second.id).not.toBe(first.id);
    expect(second.victimRank).toBe("");
    expect(second.incidentFrequency).toBe("");
    expect(second.occurrenceForms).toEqual([]);
  });
  it("identifica qualquer vítima como noticiante e reatribui ao removê-la", () => {
    const first = { ...createComplaintVictim(), victimRank: "2S" };
    const second = { ...createComplaintVictim(true), victimRank: "1T" };
    expect(getNotifyingVictim([first, second])).toBe(second);
    const remaining = removeComplaintVictim([first, second], second.id);
    expect(remaining).toEqual([{ ...first, isNotifier: true }]);
  });
  it("preserva o bloco restante e impede remover a última vítima", () => {
    const first = createComplaintVictim();
    const second = {
      ...createComplaintVictim(true),
      incidentFrequency: "UMA_VEZ",
      occurrenceForms: ["AMEACAS_INTIMIDACAO"],
    };
    const remaining = removeComplaintVictim([first, second], first.id);
    expect(remaining).toEqual([second]);
    expect(removeComplaintVictim(remaining, second.id)).toEqual([second]);
  });
});
