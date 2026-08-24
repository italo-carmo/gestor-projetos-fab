import { describe, expect, it } from "vitest";
import {
  filterOdgsaOms,
  getSelectableOdgsaOmIds,
  getSelectedOdgsaOmIdsForAction,
  type OdgsaOmItem,
} from "./odgsaOms";

const items: OdgsaOmItem[] = [
  {
    id: "1",
    code: "BASM",
    name: "Base Aérea de Santa Maria",
    uf: "RS",
    assignmentStatus: "OWN",
  },
  {
    id: "2",
    code: "ALA2",
    name: "Ala Dois",
    uf: "GO",
    assignmentStatus: "UNASSIGNED",
  },
  {
    id: "3",
    code: "BARF",
    name: "Base Aérea do Recife",
    uf: "PE",
    assignmentStatus: "OTHER",
  },
];

describe("odgsaOms", () => {
  it("filtra por texto sem exigir acentos, UF e situação", () => {
    expect(
      filterOdgsaOms(items, { query: "aerea", uf: "RS", status: "OWN" }),
    ).toEqual([items[0]]);
  });

  it("não permite selecionar em massa OMs de outro ODGSA", () => {
    expect(getSelectableOdgsaOmIds(items)).toEqual(["1", "2"]);
  });

  it("separa corretamente inclusões e exclusões na seleção mista", () => {
    const selected = ["1", "2", "3"];
    expect(getSelectedOdgsaOmIdsForAction(items, selected, "ASSIGN")).toEqual([
      "2",
    ]);
    expect(getSelectedOdgsaOmIdsForAction(items, selected, "UNASSIGN")).toEqual(
      ["1"],
    );
  });
});
