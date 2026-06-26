import { describe, expect, it } from "vitest";
import { getPermissionResourceMeta } from "./permissionMatrixMeta";

describe("permissionMatrixMeta", () => {
  it("separa a cobertura CPCA em recurso proprio da matriz", () => {
    const meta = getPermissionResourceMeta("cpca_coverage");

    expect(meta.menu).toBe("CPCA");
    expect(meta.route).toBe("/cpca-coverage");
    expect(meta.routeAliases).toContain("/admin/oms");
    expect(meta.sidebarItems).toContain("Cobertura");
    expect(meta.expectedActions).toEqual([
      "view",
      "create",
      "update",
      "delete",
    ]);
  });

  it("remove /admin/oms do recurso generico de localidades", () => {
    const meta = getPermissionResourceMeta("localities");

    expect(meta.routeAliases).not.toContain("/admin/oms");
  });

  it("declara os relatórios CIPAVD na matriz", () => {
    const meta = getPermissionResourceMeta("cipavd_reports");

    expect(meta.route).toBe("/cipavd-reports");
    expect(meta.menu).toBe("Comando");
    expect(meta.sidebarItems).toContain("Relatórios");
    expect(meta.expectedActions).toEqual([
      "view",
      "create",
      "update",
      "delete",
      "upload",
      "download",
    ]);
  });
});
