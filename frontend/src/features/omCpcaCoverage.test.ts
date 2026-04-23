import { describe, expect, it } from "vitest";
import {
  buildOmCpcaCoverageSummary,
  hasOmCpcaPresident,
  isOmCoveredByCpca,
  matchesOmCpcaCoverageFilter,
  matchesOmCpcaPresidentFilter,
  resolveOmCpcaCoverageStatus,
  splitOmCpcaPresidentDisplayName,
} from "./omCpcaCoverage";

const ownCpca = {
  id: "om-1",
  hasCpca: true,
  cpcaManagedByLocality: null,
  currentPresident: {
    id: "pres-1",
    user: { name: "CAP JOAO SILVA BASV" },
  },
};

const managedByOther = {
  id: "om-2",
  hasCpca: false,
  cpcaManagedByLocality: { id: "manager-1", code: "BASV" },
  currentPresident: null,
};

const uncovered = {
  id: "om-3",
  hasCpca: false,
  cpcaManagedByLocality: null,
  currentPresident: null,
};

describe("omCpcaCoverage", () => {
  it("classifica corretamente a cobertura CPCA da OM", () => {
    expect(resolveOmCpcaCoverageStatus(ownCpca)).toBe("OWN_CPCA");
    expect(resolveOmCpcaCoverageStatus(managedByOther)).toBe(
      "MANAGED_BY_OTHER",
    );
    expect(resolveOmCpcaCoverageStatus(uncovered)).toBe("UNCOVERED");
    expect(isOmCoveredByCpca(ownCpca)).toBe(true);
    expect(isOmCoveredByCpca(managedByOther)).toBe(true);
    expect(isOmCoveredByCpca(uncovered)).toBe(false);
  });

  it("resume a cobertura real considerando CPCA propria e cobertura externa", () => {
    expect(
      buildOmCpcaCoverageSummary([ownCpca, managedByOther, uncovered]),
    ).toEqual({
      total: 3,
      ownCpca: 1,
      managedByOther: 1,
      covered: 2,
      uncovered: 1,
    });
  });

  it("filtra pela cobertura real da OM", () => {
    expect(matchesOmCpcaCoverageFilter(ownCpca, "ALL")).toBe(true);
    expect(matchesOmCpcaCoverageFilter(ownCpca, "COVERED")).toBe(true);
    expect(matchesOmCpcaCoverageFilter(ownCpca, "OWN_CPCA")).toBe(true);
    expect(matchesOmCpcaCoverageFilter(ownCpca, "MANAGED_BY_OTHER")).toBe(
      false,
    );
    expect(matchesOmCpcaCoverageFilter(managedByOther, "COVERED")).toBe(true);
    expect(
      matchesOmCpcaCoverageFilter(managedByOther, "MANAGED_BY_OTHER"),
    ).toBe(true);
    expect(matchesOmCpcaCoverageFilter(uncovered, "UNCOVERED")).toBe(true);
    expect(matchesOmCpcaCoverageFilter(uncovered, "COVERED")).toBe(false);
  });

  it("filtra por OMs com e sem presidente formalmente designado", () => {
    expect(hasOmCpcaPresident(ownCpca)).toBe(true);
    expect(hasOmCpcaPresident(managedByOther)).toBe(false);
    expect(matchesOmCpcaPresidentFilter(ownCpca, "ALL")).toBe(true);
    expect(matchesOmCpcaPresidentFilter(ownCpca, "WITH_PRESIDENT")).toBe(true);
    expect(matchesOmCpcaPresidentFilter(ownCpca, "WITHOUT_PRESIDENT")).toBe(
      false,
    );
    expect(matchesOmCpcaPresidentFilter(managedByOther, "WITH_PRESIDENT")).toBe(
      false,
    );
    expect(
      matchesOmCpcaPresidentFilter(managedByOther, "WITHOUT_PRESIDENT"),
    ).toBe(true);
  });

  it("separa posto e nome do presidente para renderizacao da tabela", () => {
    expect(splitOmCpcaPresidentDisplayName("CAP JOAO SILVA BASV")).toEqual({
      rank: "CAP",
      name: "JOAO SILVA",
      fullName: "CAP JOAO SILVA",
    });
    expect(splitOmCpcaPresidentDisplayName("JOAO SILVA")).toEqual({
      rank: null,
      name: "JOAO SILVA",
      fullName: "JOAO SILVA",
    });
  });
});
