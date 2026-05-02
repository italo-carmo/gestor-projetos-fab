export type BiDomesticViolenceImportMode = "INCREMENTAL" | "REPLACE";

export function resolveBiDomesticViolenceImportMode(
  replace: boolean,
): BiDomesticViolenceImportMode {
  return replace ? "REPLACE" : "INCREMENTAL";
}

export function getBiDomesticViolenceImportModeLabel(
  mode: BiDomesticViolenceImportMode,
) {
  return mode === "REPLACE" ? "Zerar base" : "Incremental";
}

export function getBiDomesticViolenceImportActionLabel(
  mode: BiDomesticViolenceImportMode,
) {
  return mode === "REPLACE" ? "Importar tudo da API" : "Buscar novos registros";
}
