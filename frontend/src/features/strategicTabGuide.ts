export type StrategicTabGuideConfig = {
  title: string;
  description: string;
  questions: string[];
  usageHint?: string;
};

export function buildStrategicTabGuideUiCopy(config: StrategicTabGuideConfig) {
  return {
    triggerLabel: "Guia da aba",
    badgeLabel: "Guia rápido",
    questionsTitle: "O que esta aba responde",
    usageTitle: "Como usar esta tela",
    title: config.title,
    description: config.description,
    questions: config.questions,
    usageHint: config.usageHint?.trim() || "",
    hasUsageHint: Boolean(config.usageHint?.trim()),
  };
}
