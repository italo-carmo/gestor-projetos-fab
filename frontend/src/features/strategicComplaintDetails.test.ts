import { describe, expect, it } from "vitest";
import {
  EMPTY_STRATEGIC_COMPLAINT_FILTERS,
  filterStrategicComplaints,
  getStrategicComplaintProcedures,
  summarizeStrategicComplaints,
  type StrategicComplaintDetailItem,
} from "./strategicComplaintDetails";

const caseWithInquiry: StrategicComplaintDetailItem = {
  id: "moral-1",
  title: "Reporte MORAL-001",
  caseNumber: "MORAL-001",
  complaintType: "MORAL",
  workflowScope: "CPCA",
  status: "INVESTIGATION",
  omId: "om-a",
  omLabel: "OM A - Organização de ensino",
  processOpened: true,
  procedureType: "SINDICANCIA",
  subsequentProcedureOpened: true,
  subsequentProcedureType: "IPM",
};
const caseWithoutProcedure: StrategicComplaintDetailItem = {
  ...caseWithInquiry,
  id: "moral-2",
  title: "Reporte MORAL-002",
  caseNumber: "MORAL-002",
  omId: "om-b",
  omLabel: "OM B",
  workflowScope: "SMIF",
  status: "RECEIVED",
  processOpened: false,
  subsequentProcedureOpened: false,
};
const items = [caseWithInquiry, caseWithoutProcedure];

describe("procedimentos dos casos no painel estratégico", () => {
  it("conta o procedimento principal e o desdobramento sem duplicar casos", () => {
    expect(summarizeStrategicComplaints(items)).toEqual({
      procedureCount: 2,
      casesWithProcedure: 1,
      byProcedure: [
        { type: "SINDICANCIA", count: 1 },
        { type: "IPM", count: 1 },
      ],
    });
  });

  it("não conta tipos selecionados sem instauração confirmada", () => {
    for (const processOpened of [false, null]) {
      expect(
        getStrategicComplaintProcedures({ ...caseWithInquiry, processOpened }),
      ).toEqual([]);
    }
  });

  it("não considera não definido, não houve ou desdobramento sem instauração", () => {
    for (const procedureType of ["NOT_DEFINED", "NAO_HOUVE", ""]) {
      expect(
        getStrategicComplaintProcedures({ ...caseWithInquiry, procedureType }),
      ).toEqual([]);
      expect(
        getStrategicComplaintProcedures({
          ...caseWithInquiry,
          subsequentProcedureType: procedureType,
        }),
      ).toEqual(["SINDICANCIA"]);
    }
    expect(
      getStrategicComplaintProcedures({
        ...caseWithInquiry,
        subsequentProcedureOpened: false,
      }),
    ).toEqual(["SINDICANCIA"]);
  });
});

describe("filtros dos casos no painel estratégico", () => {
  it("combina OM, desdobramento, escopo e situação", () => {
    const result = filterStrategicComplaints(items, {
      ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
      omId: "om-a",
      procedure: "IPM",
      workflowScope: "CPCA",
      status: "INVESTIGATION",
    });
    expect(result.map((item) => item.id)).toEqual(["moral-1"]);
    expect(summarizeStrategicComplaints(result).procedureCount).toBe(2);
    expect(
      filterStrategicComplaints(items, {
        ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
        omId: "om-b",
        procedure: "IPM",
      }),
    ).toEqual([]);
  });

  it("filtra casos com e sem procedimento instaurado", () => {
    expect(
      filterStrategicComplaints(items, {
        ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
        procedure: "WITH_PROCEDURE",
      }),
    ).toEqual([caseWithInquiry]);
    expect(
      filterStrategicComplaints(items, {
        ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
        procedure: "WITHOUT_PROCEDURE",
      }),
    ).toEqual([caseWithoutProcedure]);
  });

  it("busca por reporte, OM, situação e procedimento sem exigir acentos", () => {
    for (const search of [" moral-001 ", "organizacao", "sindicancia", "IPM"]) {
      expect(
        filterStrategicComplaints(items, {
          ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
          search,
        }),
      ).toEqual([caseWithInquiry]);
    }
    expect(
      filterStrategicComplaints(items, {
        ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
        search: "em apuracao",
      }),
    ).toEqual(items);
    expect(
      filterStrategicComplaints(items, {
        ...EMPTY_STRATEGIC_COMPLAINT_FILTERS,
        search: "não existe",
      }),
    ).toEqual([]);
  });

  it("restaura todos os casos e os totais ao limpar os filtros", () => {
    expect(
      filterStrategicComplaints(items, EMPTY_STRATEGIC_COMPLAINT_FILTERS),
    ).toEqual(items);
    expect(summarizeStrategicComplaints([])).toEqual({
      procedureCount: 0,
      casesWithProcedure: 0,
      byProcedure: [],
    });
  });
});
