export type StrategicTabGuideConfig = {
  title: string;
  description: string;
  questions: string[];
  usageHint?: string;
};

export function buildStrategicTabGuideUiCopy(config: StrategicTabGuideConfig) {
  return {
    triggerLabel: "O que essa tela responde?",
    badgeLabel: "Guia rápido",
    questionsTitle: "O que esta tela responde",
    usageTitle: "Como usar esta tela",
    title: config.title,
    description: config.description,
    questions: config.questions,
    usageHint: config.usageHint?.trim() || "",
    hasUsageHint: Boolean(config.usageHint?.trim()),
  };
}
