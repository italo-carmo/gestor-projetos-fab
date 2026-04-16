import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api/client";
import { consumeJsonSseStream } from "../app/sse";
import { useToast } from "../app/toast";
import { useAiActionAgents } from "../api/hooks";

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

const OPERATIONAL_QUICK_ACTIONS = [
  {
    id: "create_mission",
    title: "Criar missão",
    description:
      "Fluxo assistido para cadastrar missão SMIF ou CIPAVD com confirmação final.",
    icon: <RocketLaunchRoundedIcon />,
    color: "#1A3C6E",
  },
  {
    id: "create_activity",
    title: "Criar atividade de campo",
    description:
      "Pede os dados essenciais da atividade e grava apenas após confirmação.",
    icon: <EventAvailableRoundedIcon />,
    color: "#2E7D32",
  },
  {
    id: "create_task",
    title: "Criar tarefa",
    description:
      "Monta uma tarefa manual com fase, prazo, prioridade e localidades.",
    icon: <AddTaskRoundedIcon />,
    color: "#ED6C02",
  },
  {
    id: "create_mission_schedule",
    title: "Criar cronograma em missão",
    description:
      "Inclui um item de cronograma em missão já existente, passo a passo.",
    icon: <PlaylistAddCheckRoundedIcon />,
    color: "#7B1FA2",
  },
] as const;

type AnalysisState = {
  running: boolean;
  percent: number;
  stage: string;
  narrative: string;
  model: string;
  generatedAt: string;
  error: string;
};

type AssistantOption = {
  value: string;
  label: string;
  description?: string | null;
};

type AssistantField = {
  field: string;
  label: string;
  inputType:
    | "text"
    | "textarea"
    | "date"
    | "datetime"
    | "number"
    | "single_select"
    | "multi_select"
    | "boolean";
  placeholder?: string;
  helperText?: string;
  optional?: boolean;
  options?: AssistantOption[];
  min?: number;
  max?: number;
  multiple?: boolean;
};

type AssistantWorkflow = {
  intent: string;
  title: string;
  description: string;
  status: "collecting" | "confirming" | "completed";
  draft: Record<string, any>;
  summary: Array<{ label: string; value: string }>;
  currentField: AssistantField | null;
  readyToConfirm: boolean;
  confirmLabel: string;
};

type CopilotEvidence = {
  id: string;
  omId: string | null;
  omCode: string;
  omName: string;
  title: string;
  uf: string;
  score: number;
  reason: string;
  link: string;
  source: string;
  coverageType?: string | null;
};

type UnifiedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  origin: "assistant" | "copilot";
  evidences?: CopilotEvidence[];
  createdItem?: {
    entityType: string;
    id: string;
    title: string;
    url: string;
  } | null;
};

function getBaseUrl(): string {
  return (api.defaults.baseURL as string) ?? "/api";
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("accessToken");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const roleId = localStorage.getItem("activeRoleId");
  if (roleId) headers["x-active-role-id"] = roleId;
  return headers;
}

const mdStyles = {
  "& h1, & h2, & h3": { color: "#1A3C6E", fontWeight: 800, mt: 1.6 },
  "& p": { my: 0.7, lineHeight: 1.75, fontSize: "0.875rem" },
  "& ul, & ol": { pl: 3, my: 0.8 },
  "& li": { mb: 0.4, lineHeight: 1.65 },
  "& strong": { color: "#102C57" },
  "& table": {
    width: "100%",
    borderCollapse: "collapse",
    my: 1.5,
    fontSize: "0.84rem",
  },
  "& th, & td": {
    border: "1px solid #DEE2E6",
    padding: "8px 10px",
    textAlign: "left",
  },
  "& th": {
    backgroundColor: "#1A3C6E",
    color: "#fff",
    fontWeight: 700,
  },
  "& code": {
    backgroundColor: "#EEF2F8",
    padding: "1px 6px",
    borderRadius: 6,
    color: "#1A3C6E",
  },
  "& pre": {
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    overflow: "auto",
  },
  "& a": {
    color: "#1565C0",
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
        {children}
      </ReactMarkdown>
    </Box>
  );
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
          try {
            msg = JSON.parse(text)?.message ?? msg;
          } catch {}
          setStates((prev) => ({
            ...prev,
            [type]: { ...prev[type], running: false, error: msg },
          }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setStates((prev) => ({
            ...prev,
            [type]: {
              ...prev[type],
              running: false,
              error: "O servidor não retornou um stream válido para a análise.",
            },
          }));
          return;
        }

        let sawTerminalEvent = false;
        await consumeJsonSseStream(reader, (event, data) => {
          if (event === "progress") {
            setStates((prev) => ({
              ...prev,
              [type]: {
                ...prev[type],
                percent: data.percent ?? prev[type].percent,
                stage: data.stage ?? prev[type].stage,
              },
            }));
            return;
          }

          if (event === "token") {
            setStates((prev) => ({
              ...prev,
              [type]: {
                ...prev[type],
                narrative: prev[type].narrative + (data.text ?? ""),
                percent: data.percent ?? prev[type].percent,
              },
            }));
            return;
          }

          if (event === "done") {
            sawTerminalEvent = true;
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
            return;
          }

          if (event === "error") {
            sawTerminalEvent = true;
            setStates((prev) => ({
              ...prev,
              [type]: {
                ...prev[type],
                running: false,
                error: data.message ?? "Erro desconhecido",
              },
            }));
          }
        });

        if (!sawTerminalEvent) {
          setStates((prev) => ({
            ...prev,
            [type]: {
              ...prev[type],
              running: false,
              error:
                prev[type].narrative.trim() || prev[type].error
                  ? prev[type].error
                  : "A análise foi encerrada sem resposta final.",
            },
          }));
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
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center" flexWrap="wrap" useFlexGap>
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
                    Copiado
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
                ? "Gerar novamente"
                : "Gerar análise"}
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
        toast.push({
          message: "Gere a análise antes de exportar o PDF.",
          severity: "warning",
        });
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
          } catch {}
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
        toast.push({ message, severity: "error" });
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

function AssistantQuickActionCard({
  title,
  description,
  icon,
  color,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      variant="outlined"
      onClick={disabled ? undefined : onClick}
      sx={{
        height: "100%",
        cursor: disabled ? "default" : "pointer",
        borderRadius: 3,
        borderTop: `4px solid ${color}`,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        "&:hover": disabled
          ? undefined
          : {
              transform: "translateY(-2px)",
              boxShadow: "0 14px 28px rgba(15, 35, 64, 0.10)",
            },
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ color, mt: 0.2 }}>{icon}</Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.65 }}>
              {description}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function buildUserMessageLabel(
  workflow: AssistantWorkflow | null,
  text: string,
  field?: AssistantField | null,
  selectedOptions?: AssistantOption[],
  selectedSingleOption?: AssistantOption | null,
) {
  if (!field) return text;
  if (field.inputType === "multi_select" && selectedOptions?.length) {
    return `${field.label}: ${selectedOptions.map((item) => item.label).join(", ")}`;
  }
  if (field.inputType === "single_select" && selectedSingleOption) {
    return `${field.label}: ${selectedSingleOption.label}`;
  }
  if (field.inputType === "boolean") return `${field.label}: ${text}`;
  return workflow ? `${field.label}: ${text}` : text;
}

function AssistantTab() {
  const toast = useToast();
  const agentsQuery = useAiActionAgents();
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [conversationKind, setConversationKind] = useState<"assistant" | "copilot" | null>(null);
  const [assistantSessionId, setAssistantSessionId] = useState<string | null>(null);
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<AssistantWorkflow | null>(null);
  const [copilotMode, setCopilotMode] = useState<"executive" | "analyst">("executive");
  const [textInput, setTextInput] = useState("");
  const [singleOption, setSingleOption] = useState<AssistantOption | null>(null);
  const [multiOptions, setMultiOptions] = useState<AssistantOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, statusText, workflow]);

  useEffect(() => {
    setTextInput("");
    setSingleOption(null);
    setMultiOptions([]);
  }, [workflow?.currentField?.field, conversationKind]);

  const appendMessage = useCallback((message: UnifiedMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const resetConversation = useCallback(async () => {
    if (assistantSessionId) {
      try {
        await api.post("/ai/assistant/reset", { sessionId: assistantSessionId });
      } catch {
        // best effort
      }
    }
    setMessages([]);
    setWorkflow(null);
    setConversationKind(null);
    setAssistantSessionId(null);
    setCopilotSessionId(null);
    setRunning(false);
    setStatusText("");
    setTextInput("");
    setSingleOption(null);
    setMultiOptions([]);
  }, [assistantSessionId]);

  const handleAssistantResponse = useCallback(
    (data: any) => {
      setConversationKind("assistant");
      setAssistantSessionId(String(data.sessionId ?? ""));
      setWorkflow((data.workflow as AssistantWorkflow | null) ?? null);
      appendMessage({
        id: String(data.message?.id ?? `assistant-${Date.now()}`),
        role: "assistant",
        content: String(data.message?.content ?? ""),
        createdAt: String(data.message?.createdAt ?? new Date().toISOString()),
        origin: "assistant",
        createdItem: data.createdItem ?? null,
      });
      if (data.createdItem?.url) {
        toast.push({
          message: "Ação executada com sucesso.",
          severity: "success",
        });
      }
    },
    [appendMessage, toast],
  );

  const postAssistant = useCallback(
    async (payload: Record<string, unknown>, userContent?: string) => {
      setRunning(true);
      setStatusText("Assistente preparando o próximo passo...");
      try {
        if (userContent) {
          appendMessage({
            id: `user-${Date.now()}`,
            role: "user",
            content: userContent,
            createdAt: new Date().toISOString(),
            origin: "assistant",
          });
        }
        const data = (await api.post("/ai/assistant/message", {
          sessionId: assistantSessionId,
          ...payload,
        })).data;
        handleAssistantResponse(data);
      } catch (error: any) {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          "Falha ao conversar com o assistente.";
        appendMessage({
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `Erro: ${message}`,
          createdAt: new Date().toISOString(),
          origin: "assistant",
        });
        toast.push({ message, severity: "error" });
      } finally {
        setRunning(false);
        setStatusText("");
      }
    },
    [appendMessage, assistantSessionId, handleAssistantResponse, toast],
  );

  const startCopilot = useCallback(
    async (type: string, title: string) => {
      setRunning(true);
      setStatusText("Inicializando copiloto gerencial...");
      setConversationKind("copilot");
      setWorkflow(null);
      appendMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: `Executar ${title}`,
        createdAt: new Date().toISOString(),
        origin: "copilot",
      });

      try {
        const res = await fetch(`${getBaseUrl()}/ai/action-agents/run`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ type, mode: copilotMode }),
        });

        if (!res.ok) {
          const text = await res.text();
          let message = `Erro HTTP ${res.status}`;
          try {
            message = JSON.parse(text)?.message ?? message;
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
          if (event === "done") {
            sawTerminalEvent = true;
            setCopilotSessionId(String(data.sessionId ?? ""));
            appendMessage({
              id: String(data.messageId ?? `assistant-${Date.now()}`),
              role: "assistant",
              content: String(data.narrative ?? ""),
              createdAt: String(data.generatedAt ?? new Date().toISOString()),
              origin: "copilot",
              evidences: (data.evidences ?? []) as CopilotEvidence[],
            });
            return;
          }
          if (event === "error") {
            sawTerminalEvent = true;
            appendMessage({
              id: `assistant-error-${Date.now()}`,
              role: "assistant",
              content: `Erro: ${String(data.message ?? "Falha na execução do copiloto.")}`,
              createdAt: new Date().toISOString(),
              origin: "copilot",
            });
          }
        });

        if (!sawTerminalEvent) {
          appendMessage({
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: "A execução do copiloto foi encerrada sem resposta final.",
            createdAt: new Date().toISOString(),
            origin: "copilot",
          });
        }
      } catch (error: any) {
        const message = error?.message ?? "Falha ao iniciar o copiloto.";
        appendMessage({
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `Erro: ${message}`,
          createdAt: new Date().toISOString(),
          origin: "copilot",
        });
        toast.push({ message, severity: "error" });
      } finally {
        setRunning(false);
        setStatusText("");
      }
    },
    [appendMessage, copilotMode, toast],
  );

  const sendCopilotFollowUp = useCallback(
    async (text: string) => {
      if (!copilotSessionId) {
        toast.push({
          message: "Execute um copiloto gerencial antes do follow-up.",
          severity: "warning",
        });
        return;
      }
      setRunning(true);
      setStatusText("Copiloto reavaliando contexto...");
      appendMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        origin: "copilot",
      });

      try {
        const res = await fetch(`${getBaseUrl()}/ai/action-agents/follow-up`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            sessionId: copilotSessionId,
            message: text,
            mode: copilotMode,
          }),
        });

        if (!res.ok) {
          const content = await res.text();
          let message = `Erro HTTP ${res.status}`;
          try {
            message = JSON.parse(content)?.message ?? message;
          } catch {}
          throw new Error(message);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("O servidor não retornou um stream válido.");

        let sawTerminalEvent = false;
        await consumeJsonSseStream(reader, (event, data) => {
          if (event === "progress") {
            setStatusText(String(data.stage ?? "Processando..."));
            return;
          }
          if (event === "done") {
            sawTerminalEvent = true;
            appendMessage({
              id: String(data.messageId ?? `assistant-${Date.now()}`),
              role: "assistant",
              content: String(data.narrative ?? ""),
              createdAt: String(data.generatedAt ?? new Date().toISOString()),
              origin: "copilot",
              evidences: (data.evidences ?? []) as CopilotEvidence[],
            });
            return;
          }
          if (event === "error") {
            sawTerminalEvent = true;
            appendMessage({
              id: `assistant-error-${Date.now()}`,
              role: "assistant",
              content: `Erro: ${String(data.message ?? "Falha no follow-up do copiloto.")}`,
              createdAt: new Date().toISOString(),
              origin: "copilot",
            });
          }
        });

        if (!sawTerminalEvent) {
          appendMessage({
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: "O follow-up foi encerrado sem resposta final.",
            createdAt: new Date().toISOString(),
            origin: "copilot",
          });
        }
      } catch (error: any) {
        const message = error?.message ?? "Falha no follow-up do copiloto.";
        appendMessage({
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `Erro: ${message}`,
          createdAt: new Date().toISOString(),
          origin: "copilot",
        });
        toast.push({ message, severity: "error" });
      } finally {
        setRunning(false);
        setStatusText("");
      }
    },
    [appendMessage, copilotMode, copilotSessionId, toast],
  );

  const submitCurrentStep = useCallback(async () => {
    if (running) return;
    const field = workflow?.currentField;
    if (workflow?.readyToConfirm) {
      await postAssistant(
        { confirmExecution: true },
        workflow.confirmLabel,
      );
      return;
    }
    if (!field) {
      const text = textInput.trim();
      if (!text) return;
      await postAssistant({ message: text }, text);
      setTextInput("");
      return;
    }

    if (field.inputType === "single_select") {
      if (!singleOption) {
        toast.push({
          message: `Selecione ${field.label.toLowerCase()}.`,
          severity: "warning",
        });
        return;
      }
      await postAssistant(
        {
          fieldInput: { field: field.field, value: singleOption.value },
        },
        buildUserMessageLabel(workflow, singleOption.label, field, [], singleOption),
      );
      return;
    }

    if (field.inputType === "multi_select") {
      if (!multiOptions.length) {
        toast.push({
          message: `Selecione ao menos uma opção para ${field.label.toLowerCase()}.`,
          severity: "warning",
        });
        return;
      }
      await postAssistant(
        {
          fieldInput: {
            field: field.field,
            value: multiOptions.map((item) => item.value),
          },
        },
        buildUserMessageLabel(workflow, "", field, multiOptions, null),
      );
      return;
    }

    const text = textInput.trim();
    if (!text && !field.optional) {
      toast.push({
        message: `Informe ${field.label.toLowerCase()}.`,
        severity: "warning",
      });
      return;
    }
    await postAssistant(
      {
        fieldInput: { field: field.field, value: text },
      },
      buildUserMessageLabel(workflow, text || "Não informar", field),
    );
    setTextInput("");
  }, [multiOptions, postAssistant, running, singleOption, textInput, toast, workflow]);

  const handleSend = useCallback(async () => {
    if (running) return;
    const text = textInput.trim();
    if (conversationKind === "copilot" && copilotSessionId) {
      if (!text) return;
      setTextInput("");
      await sendCopilotFollowUp(text);
      return;
    }
    await submitCurrentStep();
  }, [conversationKind, copilotSessionId, running, sendCopilotFollowUp, submitCurrentStep, textInput]);

  const currentField = workflow?.currentField ?? null;
  const copilotCards = (agentsQuery.data ?? []).map((item: any) => ({
    type: String(item.type),
    title: String(item.title),
    description: String(item.description),
  }));

  return (
    <Stack spacing={2}>
      <Alert
        severity="info"
        sx={{
          borderRadius: 3,
          alignItems: "flex-start",
          "& .MuiAlert-message": { width: "100%" },
        }}
      >
        <Typography variant="subtitle1" fontWeight={800}>
          Assistente virtual centralizado
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.65 }}>
          Esta área concentra os copilotos gerenciais e os fluxos operacionais
          assistidos. Para ações de escrita, o sistema trabalha em modo guiado:
          coleta só os campos essenciais, mostra opções válidas do sistema e só
          executa após confirmação explícita.
        </Typography>
      </Alert>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} color="#1A3C6E">
                Copilotos gerenciais
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Use estes copilotos para briefing, priorização e governança CPCA.
                O follow-up permanece na mesma conversa.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">
                Modo:
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={copilotMode}
                onChange={(_, value) => {
                  if (value) setCopilotMode(value);
                }}
              >
                <ToggleButton value="executive">Executivo</ToggleButton>
                <ToggleButton value="analyst">Analista</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Grid container spacing={1.5}>
              {copilotCards.map((item: any) => (
                <Grid key={item.type} size={{ xs: 12, md: 4 }}>
                  <AssistantQuickActionCard
                    title={item.title}
                    description={item.description}
                    icon={<ShieldRoundedIcon />}
                    color="#1A3C6E"
                    onClick={() => startCopilot(item.type, item.title)}
                    disabled={running}
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} color="#1A3C6E">
                Ações assistidas
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Use ações rápidas ou descreva o que deseja criar. O assistente
                conduz um passo por vez e confirma a gravação antes de escrever.
              </Typography>
            </Box>
            <Grid container spacing={1.5}>
              {OPERATIONAL_QUICK_ACTIONS.map((item) => (
                <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                  <AssistantQuickActionCard
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                    color={item.color}
                    onClick={() => postAssistant({ quickAction: item.id }, item.title)}
                    disabled={running}
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {workflow ? (
        <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "#FAFBFD" }}>
          <CardContent>
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} color="#1A3C6E">
                    {workflow.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {workflow.description}
                  </Typography>
                </Box>
                <Chip
                  label={
                    workflow.readyToConfirm
                      ? "Pronto para confirmar"
                      : "Coletando dados"
                  }
                  color={workflow.readyToConfirm ? "success" : "info"}
                  variant="outlined"
                />
              </Stack>
              <Grid container spacing={1}>
                {workflow.summary.map((item) => (
                  <Grid key={item.label} size={{ xs: 12, md: 6 }}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.2, borderRadius: 2, bgcolor: "#fff" }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}
                      >
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.35, lineHeight: 1.55 }}>
                        {item.value || "—"}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {workflow.readyToConfirm ? (
                  <Button
                    variant="contained"
                    onClick={() => handleSend()}
                    disabled={running}
                    sx={{
                      bgcolor: "#1A3C6E",
                      "&:hover": { bgcolor: "#122B4E" },
                    }}
                  >
                    {workflow.confirmLabel}
                  </Button>
                ) : null}
                {currentField?.optional ? (
                  <Button
                    variant="outlined"
                    onClick={() =>
                      postAssistant(
                        { skipCurrentField: true },
                        `Pular ${currentField.label.toLowerCase()}`,
                      )
                    }
                    disabled={running}
                  >
                    Pular campo opcional
                  </Button>
                ) : null}
                <Button
                  variant="text"
                  color="inherit"
                  onClick={() =>
                    postAssistant({ cancelWorkflow: true }, "Cancelar fluxo")
                  }
                  disabled={running}
                >
                  Cancelar fluxo
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={800} color="#1A3C6E">
                Conversa
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {conversationKind === "copilot"
                  ? "Sessão analítica com memória de follow-up."
                  : conversationKind === "assistant"
                    ? "Sessão operacional guiada com rascunho e confirmação."
                    : "Escolha uma ação rápida ou escreva o que deseja criar."}
              </Typography>
            </Box>
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

          <Box
            ref={scrollRef}
            sx={{
              minHeight: 340,
              maxHeight: 700,
              overflow: "auto",
              p: 1.5,
              bgcolor: "#F8F9FA",
              borderRadius: 2.5,
              border: "1px solid #E8EAF0",
            }}
          >
            {!messages.length ? (
              <Box sx={{ textAlign: "center", py: 7 }}>
                <SmartToyRoundedIcon sx={{ fontSize: 48, color: "#1A3C6E", mb: 1 }} />
                <Typography variant="h6" color="#1A3C6E" fontWeight={700}>
                  Assistente virtual CIPAVD/SMIF
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 560, mx: "auto", mt: 1, lineHeight: 1.7 }}
                >
                  Use os copilotos gerenciais para briefing e priorização ou
                  inicie um fluxo assistido para criar missão, atividade de
                  campo, tarefa ou cronograma em missão.
                </Typography>
              </Box>
            ) : null}

            <Stack spacing={1.5}>
              {messages.map((msg) => (
                <Stack
                  key={msg.id}
                  direction="row"
                  spacing={1}
                  justifyContent={msg.role === "user" ? "flex-end" : "flex-start"}
                >
                  {msg.role === "assistant" ? (
                    <SmartToyRoundedIcon
                      sx={{ fontSize: 28, color: "#1A3C6E", mt: 0.5, flexShrink: 0 }}
                    />
                  ) : null}
                  <Box
                    sx={{
                      maxWidth: msg.role === "assistant" ? "85%" : "75%",
                      px: 2,
                      py: 1.35,
                      borderRadius: 2.5,
                      bgcolor: msg.role === "user" ? "#163A6B" : "#FFFFFF",
                      color:
                        msg.role === "user" ? "rgba(248, 251, 255, 0.98)" : "text.primary",
                      boxShadow: 1,
                      border:
                        msg.role === "assistant" ? "1px solid #E2E8F0" : undefined,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
                      <Chip
                        size="small"
                        label={msg.role === "assistant" ? "Assistente" : "Você"}
                        color={msg.role === "assistant" ? "primary" : "default"}
                        sx={
                          msg.role === "user"
                            ? {
                                bgcolor: "rgba(255,255,255,0.18)",
                                color: "rgba(248, 251, 255, 0.98)",
                                borderColor: "rgba(255,255,255,0.22)",
                              }
                            : undefined
                        }
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={msg.origin === "copilot" ? "Copiloto gerencial" : "Ação assistida"}
                        sx={
                          msg.role === "user"
                            ? {
                                color: "rgba(248, 251, 255, 0.98)",
                                borderColor: "rgba(255,255,255,0.24)",
                              }
                            : undefined
                        }
                      />
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
                    {msg.createdItem?.url ? (
                      <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          href={msg.createdItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<OpenInNewRoundedIcon />}
                        >
                          Abrir item criado
                        </Button>
                      </Stack>
                    ) : null}
                    {msg.evidences?.length ? (
                      <Stack spacing={1} sx={{ mt: 1.2 }}>
                        {msg.evidences.slice(0, 4).map((evidence) => (
                          <Paper
                            key={evidence.id}
                            variant="outlined"
                            sx={{ p: 1.1, borderRadius: 2, bgcolor: "#FAFBFD" }}
                          >
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                            >
                              <Box>
                                <Typography variant="body2" fontWeight={700}>
                                  {evidence.omCode || evidence.omName || evidence.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  UF {evidence.uf || "—"} • Score {evidence.score ?? 0}
                                </Typography>
                              </Box>
                              {evidence.link ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  href={evidence.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<OpenInNewRoundedIcon />}
                                >
                                  Evidência
                                </Button>
                              ) : null}
                            </Stack>
                            <Typography variant="body2" sx={{ mt: 0.8, lineHeight: 1.6 }}>
                              {evidence.reason}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    ) : null}
                  </Box>
                  {msg.role === "user" ? (
                    <PersonRoundedIcon
                      sx={{ fontSize: 28, color: "#1A3C6E", mt: 0.5, flexShrink: 0 }}
                    />
                  ) : null}
                </Stack>
              ))}
              {running || statusText ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <SmartToyRoundedIcon sx={{ fontSize: 28, color: "#1A3C6E" }} />
                  <Paper variant="outlined" sx={{ px: 2, py: 1.2, borderRadius: 2.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {statusText || "Processando..."}
                    </Typography>
                  </Paper>
                </Stack>
              ) : null}
            </Stack>
          </Box>

          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            {currentField?.inputType === "single_select" ? (
              <Autocomplete
                value={singleOption}
                onChange={(_, value) => setSingleOption(value)}
                options={currentField.options ?? []}
                getOptionLabel={(option) => option.label}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={currentField.label}
                    helperText={currentField.helperText}
                    placeholder={currentField.placeholder}
                    size="small"
                  />
                )}
              />
            ) : null}

            {currentField?.inputType === "multi_select" ? (
              <Autocomplete
                multiple
                value={multiOptions}
                onChange={(_, value) => setMultiOptions(value)}
                options={currentField.options ?? []}
                getOptionLabel={(option) => option.label}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={currentField.label}
                    helperText={
                      currentField.helperText ??
                      "Você pode selecionar uma ou mais opções."
                    }
                    size="small"
                  />
                )}
              />
            ) : null}

            {currentField?.inputType === "boolean" ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setTextInput("Sim");
                    postAssistant(
                      { fieldInput: { field: currentField.field, value: "Sim" } },
                      `${currentField.label}: Sim`,
                    );
                  }}
                  disabled={running}
                >
                  Sim
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setTextInput("Não");
                    postAssistant(
                      { fieldInput: { field: currentField.field, value: "Não" } },
                      `${currentField.label}: Não`,
                    );
                  }}
                  disabled={running}
                >
                  Não
                </Button>
              </Stack>
            ) : null}

            {!currentField ||
            ["text", "textarea", "date", "datetime", "number"].includes(
              currentField.inputType,
            ) ? (
              <TextField
                fullWidth
                size="small"
                label={currentField?.label ?? "Mensagem"}
                placeholder={
                  currentField?.placeholder ??
                  (conversationKind === "copilot"
                    ? "Faça um follow-up sobre a análise..."
                    : "Descreva o que deseja criar ou responda ao passo atual...")
                }
                helperText={currentField?.helperText}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && currentField?.inputType !== "textarea") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                multiline={currentField?.inputType === "textarea" || !currentField}
                maxRows={currentField?.inputType === "textarea" || !currentField ? 4 : 1}
                type={
                  currentField?.inputType === "date"
                    ? "date"
                    : currentField?.inputType === "datetime"
                      ? "datetime-local"
                      : currentField?.inputType === "number"
                        ? "number"
                        : "text"
                }
                InputLabelProps={
                  currentField?.inputType === "date" ||
                  currentField?.inputType === "datetime"
                    ? { shrink: true }
                    : undefined
                }
                disabled={running}
              />
            ) : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={
                  running ||
                  (currentField?.inputType === "single_select"
                    ? !singleOption
                    : currentField?.inputType === "multi_select"
                      ? !multiOptions.length
                      : currentField?.inputType === "boolean"
                        ? true
                        : !textInput.trim() && !workflow?.readyToConfirm)
                }
                startIcon={<SendRoundedIcon />}
                sx={{
                  bgcolor: "#1A3C6E",
                  "&:hover": { bgcolor: "#122B4E" },
                }}
              >
                {workflow?.readyToConfirm
                  ? workflow.confirmLabel
                  : conversationKind === "copilot"
                    ? "Enviar follow-up"
                    : "Enviar"}
              </Button>
              {currentField?.optional ? (
                <Button
                  variant="outlined"
                  onClick={() =>
                    postAssistant(
                      { skipCurrentField: true },
                      `Pular ${currentField.label.toLowerCase()}`,
                    )
                  }
                  disabled={running}
                >
                  Pular campo opcional
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export function AiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = String(searchParams.get("tab") ?? "analyses");
  const [tab, setTab] = useState(tabParam === "assistant" ? 1 : 0);

  useEffect(() => {
    setTab(tabParam === "assistant" ? 1 : 0);
  }, [tabParam]);

  const handleTabChange = (_: unknown, nextValue: number) => {
    setTab(nextValue);
    const next = new URLSearchParams(searchParams);
    if (nextValue === 1) {
      next.set("tab", "assistant");
    } else {
      next.delete("tab");
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 32, color: "#1A3C6E" }} />
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1A3C6E">
            Inteligência Artificial
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Análises automatizadas, copilotos gerenciais e assistente virtual operacional
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Análises"
          icon={<AutoAwesomeRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
        <Tab
          label="Assistente virtual"
          icon={<SmartToyRoundedIcon />}
          iconPosition="start"
          sx={{ textTransform: "none" }}
        />
      </Tabs>

      {tab === 0 && <AnalysesTab />}
      {tab === 1 && <AssistantTab />}
    </Box>
  );
}
