export type AiPageTab = "analyses" | "chatbot" | "assistant" | "cpca";

export function normalizeAiPageTab(
  value: string | null | undefined,
  canSeeCpcaAgent: boolean,
): AiPageTab {
  if (value === "chatbot") return "chatbot";
  if (value === "assistant") return "assistant";
  if (value === "cpca" && canSeeCpcaAgent) return "cpca";
  return "analyses";
}
