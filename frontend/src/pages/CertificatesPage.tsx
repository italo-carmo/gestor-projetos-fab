import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Link as MuiLink,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { api } from "../api/client";
import {
  useCertificateEvent,
  useCertificateEvents,
  useCertificateTemplates,
  useCreateCertificateEvent,
  useCreateCertificateTemplate,
  useDeleteCertificateEvent,
  useDeleteCertificateTemplate,
  useDownloadCertificatePdf,
  useSendCertificateEmails,
  useUpdateCertificateEvent,
  useUpdateCertificateForm,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import {
  certificateDeliveryStatusColor,
  certificateDeliveryStatusLabel,
  CERTIFICATE_QUESTION_TYPE_LABELS,
  formatCertificateDate,
  formatCertificateDateTime,
  type CertificateQuestionType,
} from "../certificates/certificateHelpers";
import { createDefaultCertificateLayout } from "../certificates/defaultCertificateLayout";

type CertificateTemplateItem = {
  id: string;
  name: string;
  description?: string | null;
  layoutJson?: Record<string, unknown> | null;
  isActive?: boolean;
  updatedAt?: string;
};

type CertificateQuestionItem = {
  id: string;
  label: string;
  type: CertificateQuestionType;
  required: boolean;
  options?: string[];
};

type CertificateResponseItem = {
  id: string;
  fullName: string;
  email: string;
  answers?: Record<string, unknown>;
  submittedAt: string;
  latestDelivery?: {
    status?: string | null;
    errorMessage?: string | null;
    sentAt?: string | null;
    createdAt?: string | null;
  } | null;
};

type CertificateEventSummary = {
  id: string;
  name: string;
  location: string;
  eventDate: string;
  eventTime: string;
  description?: string | null;
  publicSlug: string;
  formIsPublished: boolean;
  formTitle?: string | null;
  certificateTemplateId?: string | null;
  certificateTemplate?: { id: string; name: string } | null;
  questionsCount?: number;
  responsesCount?: number;
};

type CertificateEventDetail = CertificateEventSummary & {
  formDescription?: string | null;
  questions?: CertificateQuestionItem[];
  responses?: CertificateResponseItem[];
};

type QuestionDraft = {
  localId: string;
  label: string;
  type: CertificateQuestionType;
  required: boolean;
  optionsText: string;
};

const EMPTY_EVENT_DRAFT = {
  name: "",
  location: "",
  eventDate: "",
  eventTime: "08:00",
  description: "",
  certificateTemplateId: "",
};
const VISUAL_EDITOR_STORAGE_KEY = "certificate-template-editor-v1";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function createLocalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function createEmptyQuestionDraft(): QuestionDraft {
  return {
    localId: createLocalId(),
    label: "",
    type: "TEXT",
    required: false,
    optionsText: "",
  };
}

function normalizeQuestionDrafts(
  questions: CertificateQuestionItem[] | undefined,
): QuestionDraft[] {
  return (questions ?? []).map((question) => ({
    localId: question.id || createLocalId(),
    label: question.label ?? "",
    type: question.type ?? "TEXT",
    required: question.required === true,
    optionsText: (question.options ?? []).join("\n"),
  }));
}

function normalizeLayoutJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : (createDefaultCertificateLayout() as Record<string, unknown>);
}

function extractEditorTemplateLayout(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!Array.isArray(value.elements)) return null;
  return {
    backgroundColor: value.backgroundColor ?? "#F8F4EC",
    frameColor: value.frameColor ?? "#8E642A",
    elements: value.elements,
  };
}

function buildPublicFormLink(slug: string | null | undefined) {
  const normalized = String(slug ?? "").trim();
  if (!normalized) return "";
  const path = `/certificados/forms/${normalized}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function formatPdfFileName(eventName: string, fullName: string) {
  const normalize = (value: string) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  return `certificado-${normalize(eventName)}-${normalize(fullName)}.pdf`;
}

function readCertificateElements(layoutJson: Record<string, unknown>) {
  const raw = layoutJson.elements;
  return Array.isArray(raw) ? raw : [];
}

function CertificateLayoutPreview(props: {
  layoutJson: Record<string, unknown>;
  fullName?: string;
}) {
  const elements = readCertificateElements(props.layoutJson);
  const backgroundColor = String(props.layoutJson.backgroundColor ?? "#F8F4EC");
  const frameColor = String(props.layoutJson.frameColor ?? "#8E642A");

  return (
    <Box
      sx={{
        bgcolor: "#f6f7f8",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1,
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "1123 / 794",
          overflow: "hidden",
          bgcolor: backgroundColor,
          border: `2px solid ${frameColor}`,
          boxShadow: "inset 0 0 0 10px rgba(255,255,255,0.55)",
        }}
      >
        {elements.map((rawElement, index) => {
          const element = rawElement as Record<string, unknown>;
          if (element.visible === false) return null;
          const type = String(element.type ?? "");
          const xPct = Number(element.xPct ?? 0);
          const yPct = Number(element.yPct ?? 0);
          const widthPct = Number(element.widthPct ?? 0.2);
          const commonSx = {
            position: "absolute",
            left: `${xPct * 100}%`,
            top: `${yPct * 100}%`,
            width: `${widthPct * 100}%`,
            opacity: Number(element.opacity ?? 1),
            zIndex: Number(element.zIndex ?? index),
          };
          if (type === "image") {
            return (
              <Box
                key={String(element.id ?? index)}
                component="img"
                src={String(element.src ?? "")}
                alt={String(element.label ?? "Imagem")}
                sx={{ ...commonSx, display: "block" }}
              />
            );
          }
          if (type === "line") {
            return (
              <Box
                key={String(element.id ?? index)}
                sx={{
                  ...commonSx,
                  borderTop: `${Number(element.thicknessPx ?? 2) * 0.45}px solid ${String(
                    element.colorHex ?? "#111",
                  )}`,
                }}
              />
            );
          }
          const text =
            type === "variable" &&
            String(element.variableKey ?? "") === "recipient_full_name"
              ? props.fullName ?? "NOME COMPLETO DO PARTICIPANTE"
              : String(element.text ?? "");
          return (
            <Box
              key={String(element.id ?? index)}
              sx={{
                ...commonSx,
                color: String(element.colorHex ?? "#111"),
                fontFamily: String(element.fontFamily ?? "serif"),
                fontSize: `${Math.max(6, Number(element.fontSizePx ?? 18) * 0.24)}px`,
                fontStyle: String(element.fontStyle ?? "normal"),
                fontWeight: Number(element.fontWeight ?? 400),
                lineHeight: Number(element.lineHeight ?? 1.2),
                textAlign: String(element.textAlign ?? "left"),
                whiteSpace: "pre-wrap",
              }}
            >
              {text}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function fixedFieldCard(label: string, helper: string) {
  return (
    <Box
      sx={{
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle2">{label}</Typography>
        <Chip size="small" label="Obrigatorio" color="primary" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {helper}
      </Typography>
    </Box>
  );
}

export function CertificatesPage() {
  const toast = useToast();
  const templatesQuery = useCertificateTemplates();
  const eventsQuery = useCertificateEvents();
  const createTemplate = useCreateCertificateTemplate();
  const deleteTemplate = useDeleteCertificateTemplate();
  const createEvent = useCreateCertificateEvent();
  const updateEvent = useUpdateCertificateEvent();
  const deleteEvent = useDeleteCertificateEvent();
  const updateForm = useUpdateCertificateForm();
  const sendEmails = useSendCertificateEmails();
  const downloadPdf = useDownloadCertificatePdf();

  const [tab, setTab] = useState<"events" | "templates">("events");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [eventDraft, setEventDraft] = useState(() => ({
    ...EMPTY_EVENT_DRAFT,
    eventDate: todayInputValue(),
  }));
  const [eventEditDraft, setEventEditDraft] = useState(EMPTY_EVENT_DRAFT);
  const [formDraft, setFormDraft] = useState({
    formTitle: "",
    formDescription: "",
    formIsPublished: false,
  });
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>([]);
  const [selectedResponseIds, setSelectedResponseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [templateDraft, setTemplateDraft] = useState({
    name: "Modelo padrao COMGEP",
    description: "Modelo base com campo dinamico de nome completo.",
  });

  const templates = useMemo(
    () =>
      ((templatesQuery.data?.items ?? []) as CertificateTemplateItem[]).filter(
        (template) => template.isActive !== false,
      ),
    [templatesQuery.data?.items],
  );
  const events = useMemo(
    () => (eventsQuery.data?.items ?? []) as CertificateEventSummary[],
    [eventsQuery.data?.items],
  );
  const activeEventId = selectedEventId || events[0]?.id || "";
  const eventQuery = useCertificateEvent(activeEventId, Boolean(activeEventId));
  const selectedEvent = eventQuery.data as CertificateEventDetail | undefined;
  const activeTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates[0] ??
    null;
  const publicFormLink = buildPublicFormLink(selectedEvent?.publicSlug);
  const responses = selectedEvent?.responses ?? [];

  useEffect(() => {
    if (!selectedEvent) return;
    setEventEditDraft({
      name: selectedEvent.name ?? "",
      location: selectedEvent.location ?? "",
      eventDate: String(selectedEvent.eventDate ?? "").slice(0, 10),
      eventTime: selectedEvent.eventTime ?? "",
      description: selectedEvent.description ?? "",
      certificateTemplateId: selectedEvent.certificateTemplateId ?? "",
    });
    setFormDraft({
      formTitle: selectedEvent.formTitle ?? selectedEvent.name ?? "",
      formDescription: selectedEvent.formDescription ?? "",
      formIsPublished: selectedEvent.formIsPublished === true,
    });
    setQuestionDrafts(normalizeQuestionDrafts(selectedEvent.questions));
    setSelectedResponseIds(new Set());
  }, [selectedEvent]);

  const handleCreateTemplate = async () => {
    if (!templateDraft.name.trim()) {
      toast.push({ message: "Informe o nome do modelo.", severity: "warning" });
      return;
    }
    try {
      const created = (await createTemplate.mutateAsync({
        name: templateDraft.name.trim(),
        description: templateDraft.description.trim() || null,
        layoutJson: createDefaultCertificateLayout() as Record<string, unknown>,
      })) as CertificateTemplateItem;
      setSelectedTemplateId(created.id);
      toast.push({ message: "Modelo salvo.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao salvar modelo.",
        severity: "error",
      });
    }
  };

  const handleDuplicateTemplate = async (template: CertificateTemplateItem) => {
    try {
      const created = (await createTemplate.mutateAsync({
        name: `${template.name} - copia`,
        description: template.description ?? null,
        layoutJson: normalizeLayoutJson(template.layoutJson),
      })) as CertificateTemplateItem;
      setSelectedTemplateId(created.id);
      toast.push({ message: "Modelo duplicado.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao duplicar modelo.",
        severity: "error",
      });
    }
  };

  const handleImportEditorTemplates = async () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(VISUAL_EDITOR_STORAGE_KEY);
    if (!raw) {
      toast.push({
        message: "Nenhum modelo salvo no editor visual deste navegador.",
        severity: "warning",
      });
      return;
    }

    let parsed: Array<Record<string, unknown>>;
    try {
      parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    } catch {
      toast.push({
        message: "Nao foi possivel ler os modelos do editor visual.",
        severity: "error",
      });
      return;
    }

    const importable = parsed
      .map((item) => ({
        name: String(item.name ?? "Modelo importado").trim() || "Modelo importado",
        description:
          String(item.description ?? "").trim() ||
          "Importado do editor visual de certificados.",
        layoutJson: extractEditorTemplateLayout(item),
      }))
      .filter((item) => item.layoutJson);

    if (importable.length === 0) {
      toast.push({
        message: "Nenhum layout valido foi encontrado no editor visual.",
        severity: "warning",
      });
      return;
    }

    try {
      let lastCreatedId = "";
      for (const item of importable) {
        const created = (await createTemplate.mutateAsync({
          name: item.name,
          description: item.description,
          layoutJson: item.layoutJson as Record<string, unknown>,
        })) as CertificateTemplateItem;
        lastCreatedId = created.id;
      }
      setSelectedTemplateId(lastCreatedId);
      toast.push({
        message: `${importable.length} modelo(s) importado(s).`,
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao importar modelos.",
        severity: "error",
      });
    }
  };

  const handleDeleteTemplate = async (template: CertificateTemplateItem) => {
    if (!window.confirm(`Inativar o modelo "${template.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      if (selectedTemplateId === template.id) setSelectedTemplateId("");
      toast.push({ message: "Modelo inativado.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao inativar modelo.",
        severity: "error",
      });
    }
  };

  const handleCreateEvent = async () => {
    if (
      !eventDraft.name.trim() ||
      !eventDraft.location.trim() ||
      !eventDraft.eventDate ||
      !eventDraft.eventTime
    ) {
      toast.push({
        message: "Preencha nome, local, data e hora do evento.",
        severity: "warning",
      });
      return;
    }
    try {
      const created = (await createEvent.mutateAsync({
        name: eventDraft.name.trim(),
        location: eventDraft.location.trim(),
        eventDate: eventDraft.eventDate,
        eventTime: eventDraft.eventTime,
        description: eventDraft.description.trim() || null,
        certificateTemplateId: eventDraft.certificateTemplateId || null,
      })) as CertificateEventDetail;
      setSelectedEventId(created.id);
      setEventDraft({ ...EMPTY_EVENT_DRAFT, eventDate: todayInputValue() });
      toast.push({ message: "Evento criado.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao criar evento.",
        severity: "error",
      });
    }
  };

  const handleUpdateEvent = async () => {
    if (!activeEventId) return;
    try {
      await updateEvent.mutateAsync({
        id: activeEventId,
        payload: {
          name: eventEditDraft.name.trim(),
          location: eventEditDraft.location.trim(),
          eventDate: eventEditDraft.eventDate,
          eventTime: eventEditDraft.eventTime,
          description: eventEditDraft.description.trim() || null,
          certificateTemplateId: eventEditDraft.certificateTemplateId || null,
        },
      });
      toast.push({ message: "Evento atualizado.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao atualizar evento.",
        severity: "error",
      });
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    if (!window.confirm(`Excluir o evento "${selectedEvent.name}"?`)) return;
    try {
      await deleteEvent.mutateAsync(selectedEvent.id);
      setSelectedEventId("");
      toast.push({ message: "Evento excluido.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao excluir evento.",
        severity: "error",
      });
    }
  };

  const handleAddQuestion = () => {
    setQuestionDrafts((current) => [...current, createEmptyQuestionDraft()]);
  };

  const handleRemoveQuestion = (localId: string) => {
    setQuestionDrafts((current) =>
      current.filter((question) => question.localId !== localId),
    );
  };

  const handleSaveForm = async () => {
    if (!activeEventId) return;
    const questions = questionDrafts
      .map((question) => ({
        label: question.label.trim(),
        type: question.type,
        required: question.required,
        options:
          question.type === "TEXT"
            ? []
            : question.optionsText
                .split("\n")
                .map((option) => option.trim())
                .filter(Boolean),
      }))
      .filter((question) => question.label);
    const invalidOptions = questions.some(
      (question) => question.type !== "TEXT" && question.options.length < 2,
    );
    if (invalidOptions) {
      toast.push({
        message: "Perguntas de escolha precisam ter pelo menos duas opcoes.",
        severity: "warning",
      });
      return;
    }
    try {
      await updateForm.mutateAsync({
        eventId: activeEventId,
        payload: {
          formTitle: formDraft.formTitle.trim() || null,
          formDescription: formDraft.formDescription.trim() || null,
          formIsPublished: formDraft.formIsPublished,
          questions,
        },
      });
      toast.push({ message: "Formulario salvo.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao salvar formulario.",
        severity: "error",
      });
    }
  };

  const handleCopyLink = async () => {
    if (!publicFormLink) return;
    try {
      await navigator.clipboard.writeText(publicFormLink);
      toast.push({ message: "Link copiado.", severity: "success" });
    } catch {
      toast.push({
        message: "Nao foi possivel copiar automaticamente.",
        severity: "warning",
      });
    }
  };

  const toggleResponseSelection = (responseId: string) => {
    setSelectedResponseIds((current) => {
      const next = new Set(current);
      if (next.has(responseId)) next.delete(responseId);
      else next.add(responseId);
      return next;
    });
  };

  const toggleAllResponses = () => {
    setSelectedResponseIds((current) => {
      if (current.size === responses.length) return new Set();
      return new Set(responses.map((response) => response.id));
    });
  };

  const handleSendEmails = async (mode: "selected" | "all") => {
    if (!activeEventId) return;
    const responseIds =
      mode === "selected" ? Array.from(selectedResponseIds) : [];
    if (mode === "selected" && responseIds.length === 0) {
      toast.push({
        message: "Selecione pelo menos uma resposta.",
        severity: "warning",
      });
      return;
    }
    try {
      const result = (await sendEmails.mutateAsync({
        eventId: activeEventId,
        responseIds,
      })) as { sent?: number; failed?: number };
      toast.push({
        message: `Envio concluido: ${result.sent ?? 0} enviado(s), ${
          result.failed ?? 0
        } falha(s).`,
        severity: result.failed ? "warning" : "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao enviar certificados.",
        severity: "error",
      });
    }
  };

  const handleDownloadPdf = async (response: CertificateResponseItem) => {
    if (!selectedEvent) return;
    try {
      await downloadPdf.mutateAsync({
        eventId: selectedEvent.id,
        responseId: response.id,
        fileName: formatPdfFileName(selectedEvent.name, response.fullName),
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao baixar certificado.",
        severity: "error",
      });
    }
  };

  const isLoading =
    eventsQuery.isLoading || templatesQuery.isLoading || eventQuery.isLoading;
  const selectedCount = selectedResponseIds.size;

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" component="h1">
            TI - Certificados
          </Typography>
          <Typography color="text.secondary">
            Eventos, formularios publicos, modelos e envio em lote.
          </Typography>
        </Box>
        <Button
          component="a"
          href="/certificate-layout-preview"
          target="_blank"
          rel="noreferrer"
          startIcon={<OpenInNewRoundedIcon />}
          variant="outlined"
        >
          Abrir editor visual
        </Button>
      </Stack>

      {isLoading ? <LinearProgress /> : null}

      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="events" label="Eventos" />
        <Tab value="templates" label="Modelos" />
      </Tabs>

      {tab === "events" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" },
            gap: 2,
          }}
        >
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Novo evento</Typography>
                  <TextField
                    label="Nome"
                    value={eventDraft.name}
                    onChange={(event) =>
                      setEventDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="Local"
                    value={eventDraft.location}
                    onChange={(event) =>
                      setEventDraft((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    fullWidth
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      label="Data"
                      type="date"
                      value={eventDraft.eventDate}
                      onChange={(event) =>
                        setEventDraft((current) => ({
                          ...current,
                          eventDate: event.target.value,
                        }))
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                    />
                    <TextField
                      label="Hora"
                      type="time"
                      value={eventDraft.eventTime}
                      onChange={(event) =>
                        setEventDraft((current) => ({
                          ...current,
                          eventTime: event.target.value,
                        }))
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label="Descricao breve"
                    value={eventDraft.description}
                    onChange={(event) =>
                      setEventDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    multiline
                    minRows={3}
                    fullWidth
                  />
                  <TextField
                    label="Modelo de certificado"
                    value={eventDraft.certificateTemplateId}
                    onChange={(event) =>
                      setEventDraft((current) => ({
                        ...current,
                        certificateTemplateId: event.target.value,
                      }))
                    }
                    select
                    fullWidth
                  >
                    <MenuItem value="">Sem modelo ainda</MenuItem>
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={handleCreateEvent}
                    disabled={createEvent.isPending}
                  >
                    Criar evento
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Eventos</Typography>
                  {events.length === 0 ? (
                    <Typography color="text.secondary">
                      Nenhum evento cadastrado.
                    </Typography>
                  ) : null}
                  {events.map((event) => (
                    <Button
                      key={event.id}
                      variant={event.id === activeEventId ? "contained" : "outlined"}
                      color={event.id === activeEventId ? "primary" : "inherit"}
                      onClick={() => setSelectedEventId(event.id)}
                      sx={{
                        justifyContent: "flex-start",
                        textAlign: "left",
                        textTransform: "none",
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2">{event.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCertificateDate(event.eventDate)} as{" "}
                          {event.eventTime} · {event.responsesCount ?? 0} resposta(s)
                        </Typography>
                      </Box>
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          {selectedEvent ? (
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="h6">Administracao do evento</Typography>
                        <Typography color="text.secondary">
                          {responses.length} resposta(s) recebida(s)
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          startIcon={<SaveRoundedIcon />}
                          variant="contained"
                          onClick={handleUpdateEvent}
                          disabled={updateEvent.isPending}
                        >
                          Salvar evento
                        </Button>
                        <Button
                          color="error"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={handleDeleteEvent}
                          disabled={deleteEvent.isPending}
                        >
                          Excluir
                        </Button>
                      </Stack>
                    </Stack>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 2,
                      }}
                    >
                      <TextField
                        label="Nome"
                        value={eventEditDraft.name}
                        onChange={(event) =>
                          setEventEditDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        fullWidth
                      />
                      <TextField
                        label="Local"
                        value={eventEditDraft.location}
                        onChange={(event) =>
                          setEventEditDraft((current) => ({
                            ...current,
                            location: event.target.value,
                          }))
                        }
                        fullWidth
                      />
                      <TextField
                        label="Data"
                        type="date"
                        value={eventEditDraft.eventDate}
                        onChange={(event) =>
                          setEventEditDraft((current) => ({
                            ...current,
                            eventDate: event.target.value,
                          }))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                      />
                      <TextField
                        label="Hora"
                        type="time"
                        value={eventEditDraft.eventTime}
                        onChange={(event) =>
                          setEventEditDraft((current) => ({
                            ...current,
                            eventTime: event.target.value,
                          }))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                      />
                      <TextField
                        label="Modelo de certificado"
                        value={eventEditDraft.certificateTemplateId}
                        onChange={(event) =>
                          setEventEditDraft((current) => ({
                            ...current,
                            certificateTemplateId: event.target.value,
                          }))
                        }
                        select
                        fullWidth
                      >
                        <MenuItem value="">Sem modelo</MenuItem>
                        {templates.map((template) => (
                          <MenuItem key={template.id} value={template.id}>
                            {template.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Descricao breve"
                        value={eventEditDraft.description}
                        onChange={(event) =>
                          setEventEditDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        multiline
                        minRows={3}
                        fullWidth
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="h6">Formulario publico</Typography>
                        <Typography color="text.secondary">
                          O link fica aberto sem autenticacao quando publicado.
                        </Typography>
                      </Box>
                      <Button
                        startIcon={<SaveRoundedIcon />}
                        variant="contained"
                        onClick={handleSaveForm}
                        disabled={updateForm.isPending}
                      >
                        Salvar formulario
                      </Button>
                    </Stack>

                    <Alert severity={formDraft.formIsPublished ? "success" : "info"}>
                      {formDraft.formIsPublished
                        ? "Formulario publicado."
                        : "Formulario salvo como rascunho."}
                    </Alert>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <TextField
                        label="Titulo do forms"
                        value={formDraft.formTitle}
                        onChange={(event) =>
                          setFormDraft((current) => ({
                            ...current,
                            formTitle: event.target.value,
                          }))
                        }
                        fullWidth
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formDraft.formIsPublished}
                            onChange={(event) =>
                              setFormDraft((current) => ({
                                ...current,
                                formIsPublished: event.target.checked,
                              }))
                            }
                          />
                        }
                        label="Publicado"
                      />
                    </Stack>
                    <TextField
                      label="Descricao do forms"
                      value={formDraft.formDescription}
                      onChange={(event) =>
                        setFormDraft((current) => ({
                          ...current,
                          formDescription: event.target.value,
                        }))
                      }
                      multiline
                      minRows={2}
                      fullWidth
                    />

                    <Stack spacing={1}>
                      {fixedFieldCard(
                        "Nome completo",
                        "Sempre coletado e padronizado com primeira letra maiuscula em cada palavra.",
                      )}
                      {fixedFieldCard(
                        "E-mail",
                        "Sempre coletado com validacao de formato para envio do certificado.",
                      )}
                    </Stack>

                    <Divider />

                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="subtitle1">Perguntas</Typography>
                        <Button
                          startIcon={<AddRoundedIcon />}
                          onClick={handleAddQuestion}
                        >
                          Adicionar pergunta
                        </Button>
                      </Stack>
                      {questionDrafts.length === 0 ? (
                        <Typography color="text.secondary">
                          Adicione perguntas extras quando precisar coletar mais
                          dados dos participantes.
                        </Typography>
                      ) : null}
                      {questionDrafts.map((question, index) => (
                        <Box
                          key={question.localId}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            p: 2,
                          }}
                        >
                          <Stack spacing={1.5}>
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography variant="subtitle2">
                                Pergunta {index + 1}
                              </Typography>
                              <Tooltip title="Remover pergunta">
                                <IconButton
                                  color="error"
                                  onClick={() =>
                                    handleRemoveQuestion(question.localId)
                                  }
                                >
                                  <DeleteOutlineRoundedIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                            <TextField
                              label="Texto da pergunta"
                              value={question.label}
                              onChange={(event) =>
                                setQuestionDrafts((current) =>
                                  current.map((item) =>
                                    item.localId === question.localId
                                      ? { ...item, label: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              fullWidth
                            />
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                              <TextField
                                label="Tipo de resposta"
                                value={question.type}
                                onChange={(event) =>
                                  setQuestionDrafts((current) =>
                                    current.map((item) =>
                                      item.localId === question.localId
                                        ? {
                                            ...item,
                                            type: event.target
                                              .value as CertificateQuestionType,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                select
                                fullWidth
                              >
                                {Object.entries(CERTIFICATE_QUESTION_TYPE_LABELS).map(
                                  ([value, label]) => (
                                    <MenuItem key={value} value={value}>
                                      {label}
                                    </MenuItem>
                                  ),
                                )}
                              </TextField>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={question.required}
                                    onChange={(event) =>
                                      setQuestionDrafts((current) =>
                                        current.map((item) =>
                                          item.localId === question.localId
                                            ? {
                                                ...item,
                                                required: event.target.checked,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                }
                                label="Obrigatoria"
                              />
                            </Stack>
                            {question.type !== "TEXT" ? (
                              <TextField
                                label="Opcoes, uma por linha"
                                value={question.optionsText}
                                onChange={(event) =>
                                  setQuestionDrafts((current) =>
                                    current.map((item) =>
                                      item.localId === question.localId
                                        ? { ...item, optionsText: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                multiline
                                minRows={3}
                                fullWidth
                              />
                            ) : null}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>

                    <Divider />

                    <Stack spacing={1}>
                      <Typography variant="subtitle1">Link aberto</Typography>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                        <TextField value={publicFormLink} fullWidth disabled />
                        <Button
                          startIcon={<LinkRoundedIcon />}
                          onClick={handleCopyLink}
                          disabled={!publicFormLink}
                        >
                          Copiar
                        </Button>
                        {publicFormLink ? (
                          <Button
                            component="a"
                            href={publicFormLink}
                            target="_blank"
                            rel="noreferrer"
                            startIcon={<OpenInNewRoundedIcon />}
                          >
                            Abrir
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="h6">Respostas e envios</Typography>
                        <Typography color="text.secondary">
                          Selecione uma ou mais respostas, ou envie para todos.
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                          startIcon={<EmailRoundedIcon />}
                          variant="contained"
                          onClick={() => handleSendEmails("selected")}
                          disabled={
                            selectedCount === 0 ||
                            sendEmails.isPending ||
                            !selectedEvent.certificateTemplateId
                          }
                        >
                          Enviar selecionados ({selectedCount})
                        </Button>
                        <Button
                          startIcon={<EmailRoundedIcon />}
                          onClick={() => handleSendEmails("all")}
                          disabled={
                            responses.length === 0 ||
                            sendEmails.isPending ||
                            !selectedEvent.certificateTemplateId
                          }
                        >
                          Enviar todos
                        </Button>
                      </Stack>
                    </Stack>

                    {!selectedEvent.certificateTemplateId ? (
                      <Alert severity="warning">
                        Relacione um modelo de certificado ao evento antes de
                        enviar por e-mail.
                      </Alert>
                    ) : null}

                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={
                                  responses.length > 0 &&
                                  selectedResponseIds.size === responses.length
                                }
                                indeterminate={
                                  selectedResponseIds.size > 0 &&
                                  selectedResponseIds.size < responses.length
                                }
                                onChange={toggleAllResponses}
                              />
                            </TableCell>
                            <TableCell>Nome completo</TableCell>
                            <TableCell>E-mail</TableCell>
                            <TableCell>Cadastro</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Acoes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {responses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6}>
                                <Typography color="text.secondary">
                                  Nenhuma resposta recebida ainda.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : null}
                          {responses.map((response) => {
                            const status = response.latestDelivery?.status;
                            return (
                              <TableRow key={response.id} hover>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={selectedResponseIds.has(response.id)}
                                    onChange={() =>
                                      toggleResponseSelection(response.id)
                                    }
                                  />
                                </TableCell>
                                <TableCell>{response.fullName}</TableCell>
                                <TableCell>{response.email}</TableCell>
                                <TableCell>
                                  {formatCertificateDateTime(response.submittedAt)}
                                </TableCell>
                                <TableCell>
                                  <Tooltip
                                    title={
                                      response.latestDelivery?.errorMessage ?? ""
                                    }
                                  >
                                    <Chip
                                      size="small"
                                      label={certificateDeliveryStatusLabel(status)}
                                      color={certificateDeliveryStatusColor(status)}
                                    />
                                  </Tooltip>
                                </TableCell>
                                <TableCell align="right">
                                  <Tooltip title="Baixar certificado">
                                    <span>
                                      <IconButton
                                        onClick={() => handleDownloadPdf(response)}
                                        disabled={
                                          downloadPdf.isPending ||
                                          !selectedEvent.certificateTemplateId
                                        }
                                      >
                                        <DownloadRoundedIcon />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          ) : (
            <Alert severity="info">Crie ou selecione um evento.</Alert>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "420px 1fr" },
            gap: 2,
          }}
        >
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Novo modelo</Typography>
                  <TextField
                    label="Nome do modelo"
                    value={templateDraft.name}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="Descricao"
                    value={templateDraft.description}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    multiline
                    minRows={3}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveRoundedIcon />}
                    onClick={handleCreateTemplate}
                    disabled={createTemplate.isPending}
                  >
                    Salvar modelo
                  </Button>
                  <Button
                    startIcon={<UploadFileRoundedIcon />}
                    onClick={handleImportEditorTemplates}
                    disabled={createTemplate.isPending}
                  >
                    Importar do editor visual
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Modelos salvos</Typography>
                  {templates.length === 0 ? (
                    <Typography color="text.secondary">
                      Nenhum modelo salvo.
                    </Typography>
                  ) : null}
                  {templates.map((template) => (
                    <Box
                      key={template.id}
                      sx={{
                        border: "1px solid",
                        borderColor:
                          template.id === activeTemplate?.id
                            ? "primary.main"
                            : "divider",
                        borderRadius: 2,
                        p: 1.5,
                      }}
                    >
                      <Stack spacing={1}>
                        <Button
                          onClick={() => setSelectedTemplateId(template.id)}
                          sx={{
                            justifyContent: "flex-start",
                            p: 0,
                            textAlign: "left",
                            textTransform: "none",
                          }}
                        >
                          <Box>
                            <Typography variant="subtitle2">
                              {template.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {template.description || "Sem descricao"}
                            </Typography>
                          </Box>
                        </Button>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Duplicar modelo">
                            <IconButton
                              size="small"
                              onClick={() => handleDuplicateTemplate(template)}
                            >
                              <ContentCopyRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Inativar modelo">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTemplate(template)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Pre-visualizacao do modelo</Typography>
                  <Typography color="text.secondary">
                    O campo do lote aparece como{" "}
                    <MuiLink underline="hover">NOME COMPLETO DO PARTICIPANTE</MuiLink>{" "}
                    e sera substituido pelo nome informado no forms.
                  </Typography>
                </Box>
                <CertificateLayoutPreview
                  layoutJson={normalizeLayoutJson(activeTemplate?.layoutJson)}
                />
                <Alert severity="info">
                  Para ajustar posicao, fontes, cores e imagens, use o editor
                  visual. O layout salvo usa o mesmo JSON do certificado gerado
                  em lote.
                </Alert>
                <Button
                  component="a"
                  href="/certificate-layout-preview"
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<OpenInNewRoundedIcon />}
                  variant="outlined"
                >
                  Abrir editor visual em nova aba
                </Button>
                <Button
                  onClick={async () => {
                    if (!activeTemplate) return;
                    try {
                      const preview = await api.get(
                        `/certificates/templates/${activeTemplate.id}/preview`,
                        { responseType: "blob" },
                      );
                      const url = URL.createObjectURL(new Blob([preview.data]));
                      window.open(url, "_blank", "noopener,noreferrer");
                      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
                    } catch (error) {
                      toast.push({
                        message:
                          parseApiError(error).message ??
                          "Erro ao gerar pre-visualizacao.",
                        severity: "error",
                      });
                    }
                  }}
                  disabled={!activeTemplate}
                >
                  Abrir PNG gerado pelo backend
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
