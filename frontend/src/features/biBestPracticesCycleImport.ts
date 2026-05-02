export type BiBestPracticesCycleImportMode = "INCREMENTAL" | "REPLACE";

export function resolveBiBestPracticesCycleImportMode(
  replace: boolean,
): BiBestPracticesCycleImportMode {
  return replace ? "REPLACE" : "INCREMENTAL";
}

export function getBiBestPracticesCycleImportModeLabel(
  mode: BiBestPracticesCycleImportMode,
) {
  return mode === "REPLACE" ? "Zerar base" : "Incremental";
}

export function getBiBestPracticesCycleImportActionLabel(
  mode: BiBestPracticesCycleImportMode,
) {
  return mode === "REPLACE" ? "Importar tudo da API" : "Buscar novos registros";
}
