export type StrategicTabGuideConfig = {
  title: string;
  description: string;
  questions: string[];
  usageHint?: string;
  labels?: {
    triggerLabel?: string;
    badgeLabel?: string;
    questionsTitle?: string;
    usageTitle?: string;
  };
};

export function buildStrategicTabGuideUiCopy(config: StrategicTabGuideConfig) {
  return {
    triggerLabel:
      config.labels?.triggerLabel?.trim() || "O que essa tela responde?",
    badgeLabel: config.labels?.badgeLabel?.trim() || "Guia rápido",
    questionsTitle:
      config.labels?.questionsTitle?.trim() || "O que esta tela responde",
    usageTitle: config.labels?.usageTitle?.trim() || "Como usar esta tela",
    title: config.title,
    description: config.description,
    questions: config.questions,
    usageHint: config.usageHint?.trim() || "",
    hasUsageHint: Boolean(config.usageHint?.trim()),
  };
}
