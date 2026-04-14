import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Link as MuiLink,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import TextSnippetRoundedIcon from "@mui/icons-material/TextSnippetRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api/client";
import { useToast } from "../app/toast";

const mdStyles = (dark?: boolean) => ({
  "& h1": {
    color: dark ? "#fff" : "#1A3C6E",
    fontSize: "1.35rem",
    fontWeight: 800,
    mt: 2.5,
    mb: 1,
    pb: 0.5,
    borderBottom: "2px solid",
    borderColor: dark ? "rgba(255,255,255,0.15)" : "#E8EAF0",
    "&:first-of-type": { mt: 0 },
  },
  "& h2": {
    color: dark ? "#fff" : "#1A3C6E",
    fontSize: "1.15rem",
    fontWeight: 700,
    mt: 2,
    mb: 0.8,
    "&:first-of-type": { mt: 0 },
  },
  "& h3": {
    color: dark ? "rgba(255,255,255,0.9)" : "#2E5090",
    fontSize: "1.02rem",
    fontWeight: 700,
    mt: 1.5,
    mb: 0.5,
  },
  "& h4": {
    color: dark ? "rgba(255,255,255,0.85)" : "#3A6098",
    fontSize: "0.95rem",
    fontWeight: 600,
    mt: 1.2,
    mb: 0.4,
  },
  "& p": {
    my: 0.7,
    lineHeight: 1.75,
    fontSize: "0.875rem",
    color: dark ? "rgba(255,255,255,0.92)" : "inherit",
  },
  "& ul, & ol": { pl: 3, my: 0.8 },
  "& li": {
    mb: 0.4,
    fontSize: "0.875rem",
    lineHeight: 1.7,
    "& > p": { my: 0.2 },
  },
  "& li::marker": {
    color: dark ? "rgba(255,255,255,0.5)" : "#1A3C6E",
    fontWeight: 700,
  },
  "& strong": {
    fontWeight: 700,
    color: dark ? "#fff" : "#1A3C6E",
  },
  "& em": { fontStyle: "italic" },
  "& table": {
    width: "100%",
    borderCollapse: "collapse",
    my: 1.5,
    fontSize: "0.84rem",
    borderRadius: 1,
    overflow: "hidden",
  },
  "& th, & td": {
    border: "1px solid",
    borderColor: dark ? "rgba(255,255,255,0.15)" : "#DEE2E6",
    px: 1.2,
    py: 0.7,
    textAlign: "left",
  },
  "& th": {
    bgcolor: dark ? "rgba(255,255,255,0.08)" : "#1A3C6E",
    color: dark ? "#fff" : "#fff",
    fontWeight: 700,
    fontSize: "0.82rem",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  "& tbody tr:nth-of-type(even)": {
    bgcolor: dark ? "rgba(255,255,255,0.03)" : "#F8F9FA",
  },
  "& tbody tr:hover": {
    bgcolor: dark ? "rgba(255,255,255,0.06)" : "#EEF2F8",
  },
  "& code": {
    bgcolor: dark ? "rgba(255,255,255,0.1)" : "#EEF2F8",
    color: dark ? "#fff" : "#1A3C6E",
    px: 0.6,
    py: 0.1,
    borderRadius: 0.5,
    fontSize: "0.82rem",
    fontFamily: "'Fira Code', 'Consolas', monospace",
  },
  "& pre": {
    bgcolor: dark ? "rgba(0,0,0,0.35)" : "#F5F5F5",
    p: 1.5,
    borderRadius: 1.5,
    overflow: "auto",
    my: 1.5,
    border: "1px solid",
    borderColor: dark ? "rgba(255,255,255,0.08)" : "#E0E0E0",
    "& code": { bgcolor: "transparent", px: 0, py: 0 },
  },
  "& blockquote": {
    borderLeft: "4px solid",
    borderColor: dark ? "rgba(255,255,255,0.3)" : "#1A3C6E",
    bgcolor: dark ? "rgba(255,255,255,0.04)" : "#EEF2F8",
    pl: 2,
    pr: 1.5,
    py: 1,
    ml: 0,
    my: 1.5,
    borderRadius: "0 8px 8px 0",
    "& p": {
      color: dark ? "rgba(255,255,255,0.85)" : "#2E5090",
      fontStyle: "italic",
    },
  },
  "& hr": {
    border: "none",
    borderTop: "1px solid",
    borderColor: dark ? "rgba(255,255,255,0.12)" : "#DEE2E6",
    my: 2,
  },
  "& a": {
    color: dark ? "#90CAF9" : "#1565C0",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
});

function MdContent({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <Box sx={mdStyles(dark)}>
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
        {children}
      </ReactMarkdown>
    </Box>
  );
}

const ANALYSIS_CARDS: {
  type: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    type: "executive",
    title: "Resumo Executivo Completo",
    description:
      "Narrativa consolidada com dados situacionais, perfil de assédio, análise textual e distribuição geográfica.",
    icon: <AutoAwesomeRoundedIcon />,
    color: "#1A3C6E",
  },
  {
    type: "situational",
    title: "Análise Situacional",
    description:
      "Panorama dos indicadores-chave: pesquisas, denúncias, atividades e missões.",
    icon: <DashboardRoundedIcon />,
    color: "#2E7D32",
  },
  {
    type: "aggressor",
    title: "Perfil de Assédio e Violência",
    description:
      "Análise do perfil do agressor, vítima, tipos de violência e relações hierárquicas.",
    icon: <FingerprintRoundedIcon />,
    color: "#D32F2F",
  },
  {
    type: "text",
    title: "Análise Textual",
    description:
      "Termos mais citados, padrões e tendências nos textos livres do sistema.",
    icon: <TextSnippetRoundedIcon />,
    color: "#7B1FA2",
  },
  {
    type: "geo",
    title: "Distribuição Geográfica",
    description:
      "Concentração de ocorrências, atividades e missões por estado e localidade.",
    icon: <MapRoundedIcon />,
    color: "#ED6C02",
  },
];

type AnalysisState = {
  running: boolean;
  percent: number;
  stage: string;
  narrative: string;
  model: string;
  generatedAt: string;
  error: string;
};

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("accessToken");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const roleId = localStorage.getItem("activeRoleId");
  if (roleId) headers["x-active-role-id"] = roleId;
  return headers;
}

function getBaseUrl(): string {
  return (api.defaults.baseURL as string) ?? "/api";
}

function useAnalysisSSE() {
  const [states, setStates] = useState<Record<string, AnalysisState>>({});
  const abortRef = useRef<Record<string, AbortController>>({});

  const start = useCallback((type: string) => {
    if (abortRef.current[type]) abortRef.current[type].abort();
    const controller = new AbortController();
    abortRef.current[type] = controller;

    setStates((prev) => ({
      ...prev,
      [type]: {
        running: true,
        percent: 0,
        stage: "Iniciando...",
        narrative: "",
        model: "",
        generatedAt: "",
        error: "",
      },
    }));

    (async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/ai/analyze`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ type }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          let msg = `Erro HTTP ${res.status}`;
          try { msg = JSON.parse(text)?.message ?? msg; } catch {}
          setStates((prev) => ({
            ...prev,
            [type]: { ...prev[type], running: false, error: msg },
          }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === "progress") {
                  setStates((prev) => ({
                    ...prev,
                    [type]: {
                      ...prev[type],
                      percent: data.percent ?? prev[type].percent,
                      stage: data.stage ?? prev[type].stage,
                    },
                  }));
                } else if (currentEvent === "token") {
                  setStates((prev) => ({
                    ...prev,
                    [type]: {
                      ...prev[type],
                      narrative: prev[type].narrative + (data.text ?? ""),
                      percent: data.percent ?? prev[type].percent,
                    },
                  }));
                } else if (currentEvent === "done") {
                  setStates((prev) => ({
                    ...prev,
                    [type]: {
                      ...prev[type],
                      running: false,
                      percent: 100,
                      narrative: data.narrative ?? prev[type].narrative,
                      model: data.model ?? "",
                      generatedAt: data.generatedAt ?? new Date().toISOString(),
                    },
                  }));
                } else if (currentEvent === "error") {
                  setStates((prev) => ({
                    ...prev,
                    [type]: { ...prev[type], running: false, error: data.message ?? "Erro desconhecido" },
                  }));
                }
              } catch {}
            }
          }
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setStates((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            running: false,
            error: e.message ?? "Erro de rede",
          },
        }));
      }
    })();
  }, []);

  return { states, start };
}

function AnalysisCard({
  card,
  state,
  onStart,
  onExportPdf,
  exportingPdf,
}: {
  card: (typeof ANALYSIS_CARDS)[number];
  state?: AnalysisState;
  onStart: () => void;
  onExportPdf: () => void;
  exportingPdf?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(state?.narrative ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `4px solid ${card.color}`,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Box sx={{ color: card.color }}>{card.icon}</Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {card.title}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {card.description}
        </Typography>

        {state?.running && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {state.stage}
              </Typography>
              <Typography variant="caption" fontWeight={700}>
                {state.percent}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={state.percent}
              sx={{
                height: 8,
                borderRadius: 4,
                "& .MuiLinearProgress-bar": { bgcolor: card.color },
              }}
            />
          </Box>
        )}

        {state?.narrative && (
          <Box
            sx={{
              bgcolor: "#F8F9FA",
              borderRadius: 2,
              p: 2.5,
              mb: 2,
              maxHeight: 600,
              overflow: "auto",
              flexGrow: 1,
              border: "1px solid #E8EAF0",
            }}
          >
            <MdContent>{state.narrative}</MdContent>
            {state.model && !state.running && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
                <Chip
                  label={`Modelo: ${state.model}`}
                  size="small"
                  variant="outlined"
                />
                {state.generatedAt && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(state.generatedAt).toLocaleString("pt-BR")}
                  </Typography>
                )}
                <IconButton size="small" onClick={handleCopy} title="Copiar texto">
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
                {copied && (
                  <Typography variant="caption" color="success.main">
                    Copiado!
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        )}

        {state?.error && (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {state.error}
          </Typography>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: "auto" }}>
          <Button
            variant="contained"
            onClick={onStart}
            disabled={state?.running}
            sx={{
              bgcolor: card.color,
              "&:hover": { bgcolor: card.color, filter: "brightness(0.9)" },
            }}
          >
            {state?.running
              ? "Gerando..."
              : state?.narrative
                ? "Gerar Novamente"
                : "Gerar Análise"}
          </Button>
          <Button
            variant="outlined"
            onClick={onExportPdf}
            disabled={!state?.narrative || state?.running || exportingPdf}
            startIcon={<PictureAsPdfRoundedIcon />}
            sx={{ borderColor: card.color, color: card.color }}
          >
            {exportingPdf ? "Exportando PDF..." : "Exportar PDF"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AnalysesTab() {
  const { states, start } = useAnalysisSSE();
  const [exportingByType, setExportingByType] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const exportPdf = useCallback(
    async (cardType: string, state?: AnalysisState) => {
      if (!state?.narrative?.trim()) {
        toast.push({ message: "Gere a análise antes de exportar o PDF.", severity: "warning" });
        return;
      }

      setExportingByType((prev) => ({ ...prev, [cardType]: true }));
      try {
        const response = await fetch(`${getBaseUrl()}/ai/analyze/pdf`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            type: cardType,
            narrative: state.narrative,
            model: state.model,
            generatedAt: state.generatedAt,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          let message = `Erro HTTP ${response.status}`;
          try {
            message = JSON.parse(text)?.message ?? message;
          } catch {
            // resposta pode não vir em JSON
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const datePart = (state.generatedAt ? new Date(state.generatedAt) : new Date())
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-");
        anchor.href = url;
        anchor.download = `analise-ia-${cardType}-${datePart}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        toast.push({ message: "PDF exportado com sucesso.", severity: "success" });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Falha ao exportar PDF.";
        toast.push({
          message,
          severity: "error",
        });
      } finally {
        setExportingByType((prev) => ({ ...prev, [cardType]: false }));
      }
    },
    [toast],
  );

  return (
    <Grid container spacing={2}>
      {ANALYSIS_CARDS.map((card) => (
        <Grid key={card.type} size={{ xs: 12 }}>
          <AnalysisCard
            card={card}
            state={states[card.type]}
            onStart={() => start(card.type)}
            onExportPdf={() => exportPdf(card.type, states[card.type])}
            exportingPdf={Boolean(exportingByType[card.type])}
          />
        </Grid>
      ))}
    </Grid>
  );
}

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

function ChatbotTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: ChatMsg = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...messages, userMsg].slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${getBaseUrl()}/ai/chat`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const t = await res.text();
        let errMsg = `Erro HTTP ${res.status}`;
        try { errMsg = JSON.parse(t)?.message ?? errMsg; } catch {}
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `Erro: ${errMsg}` };
          return copy;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "token" && data.text) {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content + data.text,
                  };
                  return copy;
                });
              } else if (currentEvent === "error") {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    role: "assistant",
                    content: `Erro: ${data.message}`,
                  };
                  return copy;
                });
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `Erro: ${e.message ?? "Falha de rede"}`,
          };
          return copy;
        });
      }
    }
    setStreaming(false);
  }, [input, streaming, messages]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 280px)",
        minHeight: 400,
        maxHeight: 800,
      }}
    >
      <Box
        ref={scrollRef}
        sx={{
          flexGrow: 1,
          overflow: "auto",
          px: 2,
          py: 1,
          bgcolor: "#F8F9FA",
          borderRadius: 2,
          mb: 2,
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <SmartToyRoundedIcon sx={{ fontSize: 48, color: "#1A3C6E", mb: 1 }} />
            <Typography variant="h6" color="#1A3C6E" fontWeight={700}>
              Assistente de IA — CIPAVD/SMIF
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: "auto", mt: 1 }}>
              Olá! Posso responder perguntas sobre os dados de pesquisas, denúncias, atividades e
              missões do sistema. Faça uma pergunta para começar.
            </Typography>
          </Box>
        )}
        {messages.map((msg, i) => (
          <Stack
            key={i}
            direction="row"
            spacing={1}
            sx={{
              mb: 1.5,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "assistant" && (
              <SmartToyRoundedIcon
                sx={{ fontSize: 28, color: "#1A3C6E", mt: 0.5, flexShrink: 0 }}
              />
            )}
            <Box
              sx={{
                maxWidth: msg.role === "assistant" ? "85%" : "75%",
                px: 2,
                py: 1.2,
                borderRadius: 2,
                bgcolor: msg.role === "user" ? "#1A3C6E" : "#FFFFFF",
                color: msg.role === "user" ? "#fff" : "text.primary",
                boxShadow: 1,
                ...(msg.role === "assistant" && {
                  border: "1px solid #E8EAF0",
                }),
              }}
            >
              {msg.role === "assistant" ? (
                msg.content ? (
                  <MdContent>{msg.content}</MdContent>
                ) : streaming && i === messages.length - 1 ? (
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>...</Typography>
                ) : null
              ) : (
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
                >
                  {msg.content}
                </Typography>
              )}
            </Box>
            {msg.role === "user" && (
              <PersonRoundedIcon
                sx={{ fontSize: 28, color: "#1A3C6E", mt: 0.5, flexShrink: 0 }}
              />
            )}
          </Stack>
        ))}
      </Box>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          placeholder="Faça uma pergunta sobre os dados do sistema..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={streaming}
          multiline
          maxRows={3}
        />
        <IconButton
          onClick={send}
          disabled={streaming || !input.trim()}
          sx={{
            bgcolor: "#1A3C6E",
            color: "#fff",
            "&:hover": { bgcolor: "#122B4E" },
            "&.Mui-disabled": { bgcolor: "#E0E0E0" },
            width: 48,
            height: 40,
          }}
        >
          <SendRoundedIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}

export function AiPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 32, color: "#1A3C6E" }} />
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1A3C6E">
            Inteligência Artificial
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Análises automatizadas e chatbot baseado nos dados do CIPAVD/SMIF
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Análises"
          icon={<AutoAwesomeRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Chatbot"
          icon={<SmartToyRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
      </Tabs>

      {tab === 0 && <AnalysesTab />}
      {tab === 1 && <ChatbotTab />}
    </Box>
  );
}
