export type BiRecruitsImportMode = "INCREMENTAL" | "REPLACE";

export function resolveBiRecruitsImportMode(
  replace: boolean,
): BiRecruitsImportMode {
  return replace ? "REPLACE" : "INCREMENTAL";
}

export function getBiRecruitsImportModeLabel(mode: BiRecruitsImportMode) {
  return mode === "REPLACE" ? "Zerar base" : "Incremental";
}

export function getBiRecruitsImportActionLabel(mode: BiRecruitsImportMode) {
  return mode === "REPLACE" ? "Importar tudo da API" : "Buscar novos registros";
}
