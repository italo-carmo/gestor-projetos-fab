export type BiCpcaMeetingImportMode = "INCREMENTAL" | "REPLACE";

export function resolveBiCpcaMeetingImportMode(
  replace: boolean,
): BiCpcaMeetingImportMode {
  return replace ? "REPLACE" : "INCREMENTAL";
}

export function getBiCpcaMeetingImportModeLabel(mode: BiCpcaMeetingImportMode) {
  return mode === "REPLACE" ? "Zerar base" : "Incremental";
}

export function getBiCpcaMeetingImportActionLabel(
  mode: BiCpcaMeetingImportMode,
) {
  return mode === "REPLACE" ? "Importar tudo da API" : "Buscar novos registros";
}
