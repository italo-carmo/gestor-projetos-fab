import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import TroubleshootRoundedIcon from "@mui/icons-material/TroubleshootRounded";
import SummarizeRoundedIcon from "@mui/icons-material/SummarizeRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAiSettings, useSelectableKnowledgeBases } from "../api/hooks";
import { ACTIVE_ROLE_STORAGE_KEY, api } from "../api/client";
import { consumeJsonSseStream } from "../app/sse";
import { useToast } from "../app/toast";
import { StrategicTabGuideCard } from "../components/strategic/StrategicTabGuideCard";
import { normalizeAiMarkdown } from "../features/aiMarkdown";
import {
  buildCpcaAiScopeSummary,
  CPCA_AI_PROFILE,
  CPCA_AI_QUICK_PROMPTS,
  getCpcaAiReportFileName,
} from "../features/cpcaAi";

type CpcaAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  model?: string;
  suggestedLinks?: Array<{
    label: string;
    href: string;
    kind: "screen" | "record";
  }>;
};

const CPCA_AI_GUIDE_LABELS = {
  triggerLabel: "Como esta tela funciona?",
  questionsTitle: "O que você consegue fazer aqui",
  usageTitle: "Como usar esta tela",
  badgeLabel: "Guia rápido",
} as const;

const mdStyles = {
  "& p": { my: 0.75, lineHeight: 1.75 },
  "& h1, & h2, & h3, & h4": {
    color: "#7A1932",
    fontWeight: 800,
    mt: 1.5,
    mb: 0.75,
  },
  "& ul, & ol": { pl: 2.5, my: 0.75 },
  "& li": { my: 0.35 },
  "& table": {
    width: "100%",
    borderCollapse: "collapse",
    margin: "12px 0",
    fontSize: 14,
  },
  "& th, & td": {
    border: "1px solid #E6DCE0",
    padding: "8px 10px",
    textAlign: "left",
  },
  "& th": {
    backgroundColor: "#8B1E3F",
    color: "#fff",
    fontWeight: 700,
  },
  "& code": {
    backgroundColor: "#F8E8EE",
    padding: "1px 6px",
    borderRadius: 6,
    color: "#7A1932",
  },
  "& pre": {
    backgroundColor: "#FAF6F8",
    padding: 12,
    borderRadius: 8,
    overflow: "auto",
  },
  "& a": {
    color: "#7A1932",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
};

function MdContent({ children }: { children: string }) {
  return (
    <Box sx={mdStyles}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }: any) => {
            const to = String(href ?? "").trim();
            if (!to) return <>{children}</>;
            return (
              <MuiLink
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </MuiLink>
            );
          },
        }}
      >
        {normalizeAiMarkdown(children)}
      </ReactMarkdown>
    </Box>
  );
}

function getBaseUrl() {
  return String(api.defaults.baseURL ?? "/api").replace(/\/+$/, "");
}

function getAuthHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = localStorage.getItem("accessToken");
  if (token) headers.Authorization = `Bearer ${token}`;
  const activeRoleId = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY)?.trim();
  if (activeRoleId) headers["x-active-role-id"] = activeRoleId;
  return headers;
}

export function CpcaAiPage() {
  const toast = useToast();
  const settingsQuery = useAiSettings();
  const knowledgeBasesQuery = useSelectableKnowledgeBases();
  const [messages, setMessages] = useState<CpcaAiMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const settings = settingsQuery.data;
  const knowledgeBases = knowledgeBasesQuery.data?.items ?? [];
  const scopeSummary = useMemo(
    () =>
      buildCpcaAiScopeSummary({
        sourceIds: settings?.analysisSources?.[CPCA_AI_PROFILE] ?? [],
        featureIds: settings?.analysisFeatures?.[CPCA_AI_PROFILE] ?? [],
        knowledgeBaseIds:
          settings?.analysisKnowledgeBases?.[CPCA_AI_PROFILE] ?? [],
        knowledgeBases,
      }),
    [
      knowledgeBases,
      settings?.analysisFeatures,
      settings?.analysisKnowledgeBases,
      settings?.analysisSources,
    ],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, statusText]);

  const appendMessage = useCallback((message: CpcaAiMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setInput("");
    setRunning(false);
    setStatusText("");
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const safeText = text.trim();
      if (!safeText || running) return;

      const history = messages.map((item) => ({
        role: item.role,
        content: item.content,
      }));

      appendMessage({
        id: `cpca-ai-user-${Date.now()}`,
        role: "user",
        content: safeText,
        createdAt: new Date().toISOString(),
      });
      setInput("");
      setRunning(true);
      setStatusText(
        "Carregando contexto CPCA, reportes e bases documentais...",
      );

      let partialText = "";
      try {
        const res = await fetch(`${getBaseUrl()}/ai/chat`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            message: safeText,
            history,
            profile: CPCA_AI_PROFILE,
          }),
        });

        if (!res.ok) {
          const raw = await res.text();
          let message = `Erro HTTP ${res.status}`;
          try {
            message = JSON.parse(raw)?.message ?? message;
          } catch {}
          throw new Error(message);
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("O servidor não retornou um stream válido.");
        }

        let sawTerminalEvent = false;
        await consumeJsonSseStream(reader, (event, data) => {
          if (event === "progress") {
            setStatusText(String(data.stage ?? "Processando..."));
            return;
          }
          if (event === "token") {
            partialText += String(data.text ?? "");
            return;
          }
          if (event === "done") {
            sawTerminalEvent = true;
            appendMessage({
              id: `cpca-ai-assistant-${Date.now()}`,
              role: "assistant",
              content: String(data.narrative ?? partialText ?? ""),
              createdAt: String(data.generatedAt ?? new Date().toISOString()),
              model: String(data.model ?? ""),
              suggestedLinks: Array.isArray(data.suggestedLinks)
                ? data.suggestedLinks
                : [],
            });
            return;
          }
          if (event === "error") {
            sawTerminalEvent = true;
            appendMessage({
              id: `cpca-ai-error-${Date.now()}`,
              role: "assistant",
              content: `Erro: ${String(data.message ?? "Falha ao responder.")}`,
              createdAt: new Date().toISOString(),
            });
          }
        });

        if (!sawTerminalEvent) {
          appendMessage({
            id: `cpca-ai-error-${Date.now()}`,
            role: "assistant",
            content: "A conversa foi encerrada sem resposta final.",
            createdAt: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        const message = error?.message ?? "Falha ao conversar com a IA CPCA.";
        appendMessage({
          id: `cpca-ai-error-${Date.now()}`,
          role: "assistant",
          content: `Erro: ${message}`,
          createdAt: new Date().toISOString(),
        });
        toast.push({ message, severity: "error" });
      } finally {
        setRunning(false);
        setStatusText("");
      }
    },
    [appendMessage, messages, running, toast],
  );

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((item) => item.role === "assistant"),
    [messages],
  );
  const latestUserMessage = useMemo(
    () => [...messages].reverse().find((item) => item.role === "user"),
    [messages],
  );
  const scopeSections = useMemo(
    () => [
      {
        key: "sources",
        title: "Fontes liberadas",
        emptyState: "Nenhuma fonte estruturada configurada para este perfil.",
        labels: scopeSummary.sourceLabels,
        accent: "#EEF4FF",
      },
      {
        key: "features",
        title: "Features ativas",
        emptyState: "Nenhuma feature configurada para este perfil.",
        labels: scopeSummary.featureLabels,
        accent: "#FAF2F5",
      },
      {
        key: "knowledge-bases",
        title: "Bases documentais",
        emptyState: "Nenhuma base documental selecionada para este perfil.",
        labels: scopeSummary.knowledgeBaseLabels,
        accent: "#F7F3FF",
      },
    ],
    [
      scopeSummary.featureLabels,
      scopeSummary.knowledgeBaseLabels,
      scopeSummary.sourceLabels,
    ],
  );

  const downloadPdf = useCallback(async () => {
    if (!latestAssistantMessage) return;
    setGeneratingPdf(true);
    try {
      const response = await api.post(
        "/ai/chat/pdf",
        {
          profile: CPCA_AI_PROFILE,
          narrative: latestAssistantMessage.content,
          model: latestAssistantMessage.model,
          generatedAt: latestAssistantMessage.createdAt,
          question: latestUserMessage?.content,
        },
        { responseType: "blob" },
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const href = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = getCpcaAiReportFileName(
        latestAssistantMessage.createdAt,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(href);
    } catch (error: any) {
      toast.push({
        severity: "error",
        message: error?.message ?? "Falha ao gerar o PDF da resposta.",
      });
    } finally {
      setGeneratingPdf(false);
    }
  }, [latestAssistantMessage, latestUserMessage, toast]);

  return (
    <Stack spacing={2.5}>
      <StrategicTabGuideCard
        title="IA CPCA especializada"
        description="Conversa dedicada para reportes CPCA, workflow, inconsistências, leitura normativa, bases documentais e produção de briefings ou relatórios com rastreabilidade."
        questions={[
          "Como esta tela cruza reportes CPCA, features habilitadas, fontes estruturadas e bases documentais liberadas para o perfil.",
          "Quais análises a IA consegue entregar aqui, como inconsistências, leitura de workflow, interpretação normativa e respostas executivas.",
          "Onde visualizar o contexto ativo do perfil, usar prompts rápidos e exportar a resposta final em PDF quando a análise estiver pronta.",
        ]}
        usageHint="Comece pelos prompts rápidos ou faça uma pergunta direta sobre um caso, regra ou padrão. Consulte o bloco de contexto disponível para entender as bases e features ativas antes de aprofundar a conversa."
        accentColor="#7A1932"
        icon={<SmartToyRoundedIcon />}
        labels={CPCA_AI_GUIDE_LABELS}
      />

      <Card
        sx={{
          borderRadius: 4,
          border: "1px solid #E9D8DE",
          background:
            "linear-gradient(135deg, rgba(255,250,251,1) 0%, rgba(252,245,247,1) 56%, rgba(248,238,242,1) 100%)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "#8B1E3F",
                      color: "#fff",
                      boxShadow: "0 14px 34px rgba(139, 30, 63, 0.16)",
                    }}
                  >
                    <SmartToyRoundedIcon />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" fontWeight={900} color="#7A1932">
                      IA CPCA
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Conversa especializada para analisar reportes, apontar
                      inconsistências e consolidar respostas e relatórios.
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<TroubleshootRoundedIcon />}
                    label="Workflow e inconsistências"
                    sx={{ bgcolor: "#FFFFFF", borderColor: "#D8C0C9" }}
                    variant="outlined"
                  />
                  <Chip
                    icon={<PolicyRoundedIcon />}
                    label="Leitura normativa e rastreabilidade"
                    sx={{ bgcolor: "#FFFFFF", borderColor: "#D8C0C9" }}
                    variant="outlined"
                  />
                  <Chip
                    icon={<SummarizeRoundedIcon />}
                    label="Briefings e relatórios"
                    sx={{ bgcolor: "#FFFFFF", borderColor: "#D8C0C9" }}
                    variant="outlined"
                  />
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<PictureAsPdfRoundedIcon />}
                  disabled={!latestAssistantMessage || generatingPdf}
                  onClick={() => void downloadPdf()}
                >
                  {generatingPdf ? "Gerando PDF..." : "Exportar PDF"}
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<RestartAltRoundedIcon />}
                  onClick={resetConversation}
                  disabled={running && !messages.length}
                >
                  Nova conversa
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<PolicyRoundedIcon />}
                label={`${scopeSummary.counts.sources} fonte(s) estruturadas`}
                sx={{ bgcolor: "#FFFFFF", borderColor: "#D8C0C9" }}
                variant="outlined"
              />
              <Chip
                icon={<AutoAwesomeRoundedIcon />}
                label={`${scopeSummary.counts.features} feature(s) ativas`}
                sx={{ bgcolor: "#FFFFFF", borderColor: "#D8C0C9" }}
                variant="outlined"
              />
              <Chip
                icon={<SummarizeRoundedIcon />}
                label={`${scopeSummary.counts.knowledgeBases} base(s) de conhecimento`}
                sx={{ bgcolor: "#FFFFFF", borderColor: "#D8C0C9" }}
                variant="outlined"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Accordion
        disableGutters
        sx={{
          borderRadius: 3,
          border: "1px solid #E8DDE2",
          bgcolor: "#FFFFFF",
          boxShadow: "none",
          "&::before": { display: "none" },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreRoundedIcon />}
          sx={{ px: 2.5, py: 0.5 }}
        >
          <Stack spacing={1} sx={{ width: "100%", pr: 1 }}>
            <Typography variant="subtitle1" fontWeight={800} color="#7A1932">
              Contexto disponível para a conversa
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fontes, features e bases documentais liberadas para este perfil.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={`${scopeSummary.counts.sources} fontes`}
              />
              <Chip
                size="small"
                label={`${scopeSummary.counts.features} features`}
              />
              <Chip
                size="small"
                label={`${scopeSummary.counts.knowledgeBases} bases documentais`}
              />
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            {scopeSections.map((section) => (
              <Paper
                key={section.key}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2.5,
                  borderColor: "#E8DDE2",
                  bgcolor: "#FCFAFB",
                }}
              >
                <Stack spacing={1.2}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={800}
                    color="#7A1932"
                  >
                    {section.title}
                  </Typography>
                  {section.labels.length ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {section.labels.map((label) => (
                        <Chip
                          key={label}
                          size="small"
                          label={label}
                          sx={{ bgcolor: section.accent }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {section.emptyState}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ lg: "center" }}
            >
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={800}
                  color="#7A1932"
                >
                  Conversa CPCA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Perguntas abertas, leitura de inconsistências e respostas com
                  rastreabilidade.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {CPCA_AI_QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outlined"
                    color="inherit"
                    disabled={running}
                    onClick={() => void sendMessage(prompt)}
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      borderRadius: 2.5,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    {prompt}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Box
              ref={scrollRef}
              sx={{
                minHeight: { xs: 420, md: 520 },
                maxHeight: 760,
                overflow: "auto",
                p: { xs: 1.25, md: 1.75 },
                bgcolor: "#FCFAFB",
                borderRadius: 2.5,
                border: "1px solid #EFE2E7",
              }}
            >
              {!messages.length ? (
                <Box sx={{ textAlign: "center", py: { xs: 7, md: 10 } }}>
                  <SmartToyRoundedIcon
                    sx={{ fontSize: 52, color: "#8B1E3F", mb: 1 }}
                  />
                  <Typography variant="h6" color="#7A1932" fontWeight={800}>
                    Aguardando sua pergunta
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ maxWidth: 640, mx: "auto", mt: 1, lineHeight: 1.75 }}
                  >
                    Use esta IA para analisar reportes CPCA, cruzar o workflow
                    com a base normativa e produzir relatórios com
                    rastreabilidade.
                  </Typography>
                </Box>
              ) : null}

              <Stack spacing={1.5}>
                {messages.map((msg) => (
                  <Stack
                    key={msg.id}
                    direction="row"
                    spacing={1}
                    justifyContent={
                      msg.role === "user" ? "flex-end" : "flex-start"
                    }
                  >
                    {msg.role === "assistant" ? (
                      <SmartToyRoundedIcon
                        sx={{
                          fontSize: 28,
                          color: "#8B1E3F",
                          mt: 0.5,
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <Box
                      sx={{
                        maxWidth: msg.role === "assistant" ? "96%" : "88%",
                        px: 2,
                        py: 1.35,
                        borderRadius: 2.5,
                        bgcolor: msg.role === "user" ? "#173C6F" : "#FFFFFF",
                        color:
                          msg.role === "user"
                            ? "rgba(248, 251, 255, 0.98)"
                            : "text.primary",
                        boxShadow: 1,
                        border:
                          msg.role === "assistant"
                            ? "1px solid #ECD9E0"
                            : undefined,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mb: 0.8 }}
                      >
                        <Chip
                          size="small"
                          label={msg.role === "assistant" ? "IA CPCA" : "Você"}
                          sx={
                            msg.role === "assistant"
                              ? { bgcolor: "#F8E8EE", color: "#7A1932" }
                              : {
                                  bgcolor: "rgba(255,255,255,0.18)",
                                  color: "rgba(248, 251, 255, 0.98)",
                                }
                          }
                        />
                        {msg.model ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={msg.model}
                          />
                        ) : null}
                      </Stack>
                      {msg.role === "assistant" ? (
                        <MdContent>{msg.content}</MdContent>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                            color: "rgba(248, 251, 255, 0.98)",
                            fontWeight: 500,
                          }}
                        >
                          {msg.content}
                        </Typography>
                      )}
                      {msg.role === "assistant" &&
                      msg.suggestedLinks?.length ? (
                        <Stack spacing={1} sx={{ mt: 1.2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Links úteis
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {msg.suggestedLinks.map((item) => (
                              <Button
                                key={`${msg.id}-${item.href}`}
                                size="small"
                                variant="outlined"
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                startIcon={<OpenInNewRoundedIcon />}
                              >
                                {item.label}
                              </Button>
                            ))}
                          </Stack>
                        </Stack>
                      ) : null}
                    </Box>
                  </Stack>
                ))}

                {running || statusText ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SmartToyRoundedIcon
                      sx={{ fontSize: 28, color: "#8B1E3F" }}
                    />
                    <Paper
                      variant="outlined"
                      sx={{ px: 2, py: 1.2, borderRadius: 2.5 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={14} sx={{ color: "#8B1E3F" }} />
                        <Typography variant="body2" color="text.secondary">
                          {statusText || "Processando..."}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Stack>
                ) : null}
              </Stack>
            </Box>

            <Stack spacing={1.25}>
              <TextField
                fullWidth
                size="small"
                label="Pergunta"
                placeholder="Ex.: Aponte inconsistências normativas nos reportes CPCA abertos."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                multiline
                maxRows={5}
                disabled={running}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  onClick={() => void sendMessage(input)}
                  disabled={running || !input.trim()}
                  startIcon={<SendRoundedIcon />}
                  sx={{
                    bgcolor: "#8B1E3F",
                    "&:hover": { bgcolor: "#6E1733" },
                  }}
                >
                  Enviar
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  href="/cpca-cases"
                  startIcon={<PolicyRoundedIcon />}
                >
                  Abrir reportes CPCA
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
