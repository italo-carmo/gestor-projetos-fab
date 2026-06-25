import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import FormatAlignCenterRoundedIcon from "@mui/icons-material/FormatAlignCenterRounded";
import FormatAlignJustifyRoundedIcon from "@mui/icons-material/FormatAlignJustifyRounded";
import FormatAlignLeftRoundedIcon from "@mui/icons-material/FormatAlignLeftRounded";
import FormatAlignRightRoundedIcon from "@mui/icons-material/FormatAlignRightRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatClearRoundedIcon from "@mui/icons-material/FormatClearRounded";
import FormatColorFillRoundedIcon from "@mui/icons-material/FormatColorFillRounded";
import FormatColorTextRoundedIcon from "@mui/icons-material/FormatColorTextRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded";
import FormatUnderlinedRoundedIcon from "@mui/icons-material/FormatUnderlinedRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import {
  type CpcaEmailDelivery,
  type CpcaEmailRecipient,
  type CpcaEmailTemplate,
  useCpcaEmailDispatches,
  useCpcaEmailRecipients,
  useCpcaEmailTemplates,
  useCreateCpcaEmailTemplate,
  useDeleteCpcaEmailAttachment,
  useDeleteCpcaEmailTemplate,
  useSendCpcaEmail,
  useUpdateCpcaEmailTemplate,
  useUploadCpcaEmailAttachment,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";

type EmailDraft = {
  name: string;
  subject: string;
  bodyHtml: string;
};

type SendConfirmMode = "selected" | "all" | null;

const EMPTY_DRAFT: EmailDraft = {
  name: "",
  subject: "",
  bodyHtml: "<p></p>",
};

const FONT_SIZES = [
  { value: "2", label: "12" },
  { value: "3", label: "14" },
  { value: "4", label: "16" },
  { value: "5", label: "18" },
  { value: "6", label: "24" },
  { value: "7", label: "32" },
];

const FONT_FAMILIES = [
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Verdana",
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatFileSize(value: number | null | undefined) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatOmLabel(item: {
  omCode?: string | null;
  omName?: string | null;
}) {
  const code = String(item.omCode ?? "").trim();
  const name = String(item.omName ?? "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
}

function stripHtmlToText(html: string | null | undefined) {
  const element = document.createElement("div");
  element.innerHTML = String(html ?? "");
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusChip(status: string) {
  if (status === "SENT") {
    return (
      <Chip
        size="small"
        color="success"
        icon={<CheckCircleRoundedIcon />}
        label="Enviado"
      />
    );
  }
  if (status === "PARTIAL") {
    return (
      <Chip
        size="small"
        color="warning"
        icon={<ErrorOutlineRoundedIcon />}
        label="Parcial"
      />
    );
  }
  if (status === "FAILED") {
    return (
      <Chip
        size="small"
        color="error"
        icon={<ErrorOutlineRoundedIcon />}
        label="Falha"
      />
    );
  }
  return <Chip size="small" color="default" label="Na fila" />;
}

function EmailRichEditor({
  value,
  onChange,
  disabled,
  onWarning,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onWarning: (message: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef("");
  const [fontSize, setFontSize] = useState("4");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontColor, setFontColor] = useState("#1F2937");
  const [highlightColor, setHighlightColor] = useState("#FFF7CC");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = value || "";
    if (document.activeElement !== editor && next !== lastValueRef.current) {
      editor.innerHTML = next;
      lastValueRef.current = next;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    const next = editorRef.current?.innerHTML ?? "";
    lastValueRef.current = next;
    onChange(next);
  }, [onChange]);

  const applyCommand = useCallback(
    (command: string, commandValue?: string) => {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand(command, false, commandValue);
      emitChange();
    },
    [disabled, emitChange],
  );

  const insertImage = useCallback(
    (file: File | null | undefined) => {
      if (!file || disabled) return;
      if (!file.type.startsWith("image/")) {
        onWarning("Selecione uma imagem PNG ou JPG.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        onWarning("Use imagens de até 2 MB no corpo do e-mail.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result ?? "");
        if (!src) return;
        editorRef.current?.focus();
        document.execCommand(
          "insertHTML",
          false,
          `<img src="${src}" alt="${escapeAttribute(file.name)}" style="max-width:100%;height:auto;border-radius:6px;" />`,
        );
        emitChange();
      };
      reader.readAsDataURL(file);
    },
    [disabled, emitChange, onWarning],
  );

  const insertLink = useCallback(() => {
    if (disabled) return;
    const url = window.prompt("URL do link");
    if (!url) return;
    const normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized) && !/^mailto:/i.test(normalized)) {
      onWarning("Informe uma URL iniciada por http://, https:// ou mailto:.");
      return;
    }
    applyCommand("createLink", normalized);
  }, [applyCommand, disabled, onWarning]);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "#fff",
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        flexWrap="wrap"
        alignItems="center"
        sx={{
          p: 1,
          gap: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "#F8FAFC",
        }}
      >
        <TextField
          select
          size="small"
          label="Fonte"
          value={fontFamily}
          onChange={(event) => {
            const next = event.target.value;
            setFontFamily(next);
            applyCommand("fontName", next);
          }}
          disabled={disabled}
          sx={{ width: 150 }}
        >
          {FONT_FAMILIES.map((family) => (
            <MenuItem key={family} value={family}>
              {family}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Tamanho"
          value={fontSize}
          onChange={(event) => {
            const next = event.target.value;
            setFontSize(next);
            applyCommand("fontSize", next);
          }}
          disabled={disabled}
          sx={{ width: 112 }}
        >
          {FONT_SIZES.map((size) => (
            <MenuItem key={size.value} value={size.value}>
              {size.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Formato"
          defaultValue="P"
          onChange={(event) => applyCommand("formatBlock", event.target.value)}
          disabled={disabled}
          sx={{ width: 132 }}
        >
          <MenuItem value="P">Parágrafo</MenuItem>
          <MenuItem value="H2">Título</MenuItem>
          <MenuItem value="H3">Subtítulo</MenuItem>
          <MenuItem value="BLOCKQUOTE">Citação</MenuItem>
        </TextField>
        <Divider orientation="vertical" flexItem />
        <Tooltip title="Negrito">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("bold")}
              disabled={disabled}
            >
              <FormatBoldRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Itálico">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("italic")}
              disabled={disabled}
            >
              <FormatItalicRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Sublinhado">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("underline")}
              disabled={disabled}
            >
              <FormatUnderlinedRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cor da letra">
          <span>
            <IconButton component="label" size="small" disabled={disabled}>
              <FormatColorTextRoundedIcon
                fontSize="small"
                sx={{ color: fontColor }}
              />
              <input
                type="color"
                hidden
                value={fontColor}
                onChange={(event) => {
                  const next = event.target.value;
                  setFontColor(next);
                  applyCommand("foreColor", next);
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Realce">
          <span>
            <IconButton component="label" size="small" disabled={disabled}>
              <FormatColorFillRoundedIcon
                fontSize="small"
                sx={{ color: highlightColor }}
              />
              <input
                type="color"
                hidden
                value={highlightColor}
                onChange={(event) => {
                  const next = event.target.value;
                  setHighlightColor(next);
                  applyCommand("backColor", next);
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Limpar formatação">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("removeFormat")}
              disabled={disabled}
            >
              <FormatClearRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem />
        <Tooltip title="Alinhar à esquerda">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("justifyLeft")}
              disabled={disabled}
            >
              <FormatAlignLeftRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Centralizar">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("justifyCenter")}
              disabled={disabled}
            >
              <FormatAlignCenterRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Alinhar à direita">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("justifyRight")}
              disabled={disabled}
            >
              <FormatAlignRightRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Justificar">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("justifyFull")}
              disabled={disabled}
            >
              <FormatAlignJustifyRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem />
        <Tooltip title="Lista com marcadores">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("insertUnorderedList")}
              disabled={disabled}
            >
              <FormatListBulletedRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Lista numerada">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("insertOrderedList")}
              disabled={disabled}
            >
              <FormatListNumberedRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Imagem">
          <span>
            <IconButton component="label" size="small" disabled={disabled}>
              <ImageRoundedIcon fontSize="small" />
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(event) => {
                  insertImage(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Link">
          <span>
            <IconButton size="small" onClick={insertLink} disabled={disabled}>
              <LinkRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem />
        <Tooltip title="Desfazer">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("undo")}
              disabled={disabled}
            >
              <UndoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Refazer">
          <span>
            <IconButton
              size="small"
              onClick={() => applyCommand("redo")}
              disabled={disabled}
            >
              <RedoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Box
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        sx={{
          minHeight: 420,
          p: 2.2,
          outline: "none",
          bgcolor: disabled ? "#F8FAFC" : "#fff",
          color: "text.primary",
          overflow: "auto",
          "&:focus": {
            boxShadow: "inset 0 0 0 2px rgba(12, 101, 126, 0.24)",
          },
          "& p": { my: 1 },
          "& h2, & h3": { mt: 2, mb: 1 },
          "& ul, & ol": { pl: 3 },
          "& img": { maxWidth: "100%", height: "auto" },
          "& blockquote": {
            borderLeft: "4px solid #B8D7E2",
            m: 0,
            my: 1.4,
            pl: 1.5,
            color: "text.secondary",
          },
        }}
      />
    </Box>
  );
}

export function CpcaEmailsPage() {
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [draftMode, setDraftMode] = useState<"existing" | "new">("existing");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<EmailDraft>(EMPTY_DRAFT);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [deleteTemplateTarget, setDeleteTemplateTarget] =
    useState<CpcaEmailTemplate | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientOmIds, setSelectedRecipientOmIds] = useState<
    string[]
  >([]);
  const [sendConfirmMode, setSendConfirmMode] =
    useState<SendConfirmMode>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(
    null,
  );

  const templatesQuery = useCpcaEmailTemplates();
  const recipientsQuery = useCpcaEmailRecipients();
  const dispatchesQuery = useCpcaEmailDispatches({ limit: 14 });
  const createTemplate = useCreateCpcaEmailTemplate();
  const updateTemplate = useUpdateCpcaEmailTemplate();
  const deleteTemplate = useDeleteCpcaEmailTemplate();
  const uploadAttachment = useUploadCpcaEmailAttachment();
  const deleteAttachment = useDeleteCpcaEmailAttachment();
  const sendEmail = useSendCpcaEmail();

  const templates = useMemo(
    () => templatesQuery.data?.items ?? [],
    [templatesQuery.data?.items],
  );
  const recipients = useMemo(
    () => recipientsQuery.data?.items ?? [],
    [recipientsQuery.data?.items],
  );
  const dispatches = useMemo(
    () => dispatchesQuery.data?.items ?? [],
    [dispatchesQuery.data?.items],
  );
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const selectedDispatch = useMemo(
    () =>
      dispatches.find((item) => item.id === selectedDispatchId) ??
      dispatches[0] ??
      null,
    [dispatches, selectedDispatchId],
  );

  useEffect(() => {
    if (draftMode === "new") return;
    if (selectedTemplateId && selectedTemplate) return;
    setSelectedTemplateId(templates[0]?.id ?? null);
  }, [draftMode, selectedTemplate, selectedTemplateId, templates]);

  useEffect(() => {
    if (draftMode === "new") {
      setDraft(EMPTY_DRAFT);
      return;
    }
    if (!selectedTemplate) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft({
      name: selectedTemplate.name,
      subject: selectedTemplate.subject,
      bodyHtml: selectedTemplate.bodyHtml || "<p></p>",
    });
    setPendingFiles([]);
  }, [draftMode, selectedTemplate?.id]);

  useEffect(() => {
    if (!selectedDispatchId && dispatches[0]?.id) {
      setSelectedDispatchId(dispatches[0].id);
    }
  }, [dispatches, selectedDispatchId]);

  const filteredRecipients = useMemo(() => {
    const term = recipientSearch.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter((item) => {
      const haystack = [
        item.omCode,
        item.omName,
        item.presidentName,
        item.presidentEmail,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [recipientSearch, recipients]);

  const selectedRecipientSet = useMemo(
    () => new Set(selectedRecipientOmIds),
    [selectedRecipientOmIds],
  );
  const selectedRecipients = useMemo(
    () => recipients.filter((item) => selectedRecipientSet.has(item.omId)),
    [recipients, selectedRecipientSet],
  );
  const allFilteredSelected =
    filteredRecipients.length > 0 &&
    filteredRecipients.every((item) => selectedRecipientSet.has(item.omId));
  const isBusy =
    createTemplate.isPending ||
    updateTemplate.isPending ||
    deleteTemplate.isPending ||
    uploadAttachment.isPending ||
    deleteAttachment.isPending ||
    sendEmail.isPending;

  const openNewTemplate = () => {
    setDraftMode("new");
    setSelectedTemplateId(null);
    setPendingFiles([]);
    setTab(0);
  };

  const selectTemplate = (template: CpcaEmailTemplate) => {
    setDraftMode("existing");
    setSelectedTemplateId(template.id);
    setPendingFiles([]);
  };

  const handleSaveTemplate = async () => {
    const name = draft.name.trim();
    const subject = draft.subject.trim();
    const bodyHtml = draft.bodyHtml.trim();
    if (!name || !subject || (!stripHtmlToText(bodyHtml) && !/<img\b/i.test(bodyHtml))) {
      toast.push({
        severity: "warning",
        message: "Preencha nome, assunto e conteúdo do e-mail.",
      });
      return;
    }

    try {
      const payload = { name, subject, bodyHtml };
      const result =
        draftMode === "new" || !selectedTemplate
          ? await createTemplate.mutateAsync(payload)
          : await updateTemplate.mutateAsync({
              id: selectedTemplate.id,
              payload,
            });
      const saved = result.item;
      for (const file of pendingFiles) {
        await uploadAttachment.mutateAsync({ templateId: saved.id, file });
      }
      setDraftMode("existing");
      setSelectedTemplateId(saved.id);
      setPendingFiles([]);
      toast.push({
        severity: "success",
        message:
          pendingFiles.length > 0
            ? "Modelo salvo com anexos."
            : "Modelo salvo.",
      });
    } catch (error) {
      toast.push({
        severity: "error",
        message: parseApiError(error).message ?? "Falha ao salvar modelo.",
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return;
    try {
      await deleteTemplate.mutateAsync(deleteTemplateTarget.id);
      setDeleteTemplateTarget(null);
      if (selectedTemplateId === deleteTemplateTarget.id) {
        setSelectedTemplateId(null);
      }
      toast.push({ severity: "success", message: "Modelo excluído." });
    } catch (error) {
      toast.push({
        severity: "error",
        message: parseApiError(error).message ?? "Falha ao excluir modelo.",
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedTemplate) return;
    try {
      await deleteAttachment.mutateAsync({
        templateId: selectedTemplate.id,
        attachmentId,
      });
      toast.push({ severity: "success", message: "Anexo removido." });
    } catch (error) {
      toast.push({
        severity: "error",
        message: parseApiError(error).message ?? "Falha ao remover anexo.",
      });
    }
  };

  const toggleRecipient = (recipient: CpcaEmailRecipient) => {
    setSelectedRecipientOmIds((current) => {
      if (current.includes(recipient.omId)) {
        return current.filter((id) => id !== recipient.omId);
      }
      return [...current, recipient.omId];
    });
  };

  const toggleAllFilteredRecipients = () => {
    const filteredIds = filteredRecipients.map((item) => item.omId);
    setSelectedRecipientOmIds((current) => {
      const currentSet = new Set(current);
      if (allFilteredSelected) {
        for (const id of filteredIds) currentSet.delete(id);
      } else {
        for (const id of filteredIds) currentSet.add(id);
      }
      return Array.from(currentSet);
    });
  };

  const requestSend = (mode: Exclude<SendConfirmMode, null>) => {
    if (!selectedTemplate) {
      toast.push({
        severity: "warning",
        message: "Selecione um modelo antes de enviar.",
      });
      return;
    }
    if (mode === "selected" && selectedRecipients.length === 0) {
      toast.push({
        severity: "warning",
        message: "Selecione ao menos um presidente CPCA.",
      });
      return;
    }
    if (mode === "all" && recipients.length === 0) {
      toast.push({
        severity: "warning",
        message: "Não há OMs com presidente CPCA cadastrado.",
      });
      return;
    }
    setSendConfirmMode(mode);
  };

  const handleSendConfirmed = async () => {
    if (!selectedTemplate || !sendConfirmMode) return;
    try {
      const result = await sendEmail.mutateAsync({
        templateId: selectedTemplate.id,
        all: sendConfirmMode === "all",
        recipientOmIds:
          sendConfirmMode === "selected" ? selectedRecipientOmIds : undefined,
      });
      setSendConfirmMode(null);
      setSelectedDispatchId(result.item.id);
      setTab(2);
      toast.push({
        severity:
          result.item.failedCount > 0
            ? result.item.sentCount > 0
              ? "warning"
              : "error"
            : "success",
        message: `Envio concluído: ${result.item.sentCount} enviados, ${result.item.failedCount} falhas.`,
      });
    } catch (error) {
      toast.push({
        severity: "error",
        message: parseApiError(error).message ?? "Falha ao enviar e-mails.",
      });
    }
  };

  return (
    <Stack spacing={2.2}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        gap={1.5}
      >
        <Box>
          <Typography variant="h4" sx={{ mb: 0.4 }}>
            Enviar E-mails
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Modelos e disparos para presidentes CPCA vinculados às OMs.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            color="primary"
            variant="outlined"
            icon={<EmailRoundedIcon />}
            label={`${templates.length} modelos`}
          />
          <Chip
            color="secondary"
            variant="outlined"
            icon={<MarkEmailReadRoundedIcon />}
            label={`${recipients.length} OMs com presidente`}
          />
        </Stack>
      </Stack>

      {(templatesQuery.isFetching ||
        recipientsQuery.isFetching ||
        dispatchesQuery.isFetching ||
        isBusy) && <LinearProgress />}

      <Card>
        <CardContent sx={{ p: { xs: 1.5, md: 2.2 } }}>
          <Tabs
            value={tab}
            onChange={(_, next) => setTab(next)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2 }}
          >
            <Tab icon={<EditRoundedIcon />} iconPosition="start" label="Modelo" />
            <Tab icon={<SendRoundedIcon />} iconPosition="start" label="Envio" />
            <Tab
              icon={<MarkEmailReadRoundedIcon />}
              iconPosition="start"
              label="Histórico"
            />
          </Tabs>

          {tab === 0 && (
            <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
              <Box sx={{ width: { xs: "100%", lg: 320 }, flexShrink: 0 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="h6">Modelos</Typography>
                  <Tooltip title="Novo modelo">
                    <IconButton color="primary" onClick={openNewTemplate}>
                      <AddRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack spacing={1}>
                  {templates.length === 0 && draftMode !== "new" ? (
                    <Alert severity="info">
                      Nenhum modelo criado. Clique no botão de adicionar.
                    </Alert>
                  ) : null}
                  {draftMode === "new" ? (
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "primary.main",
                        borderRadius: 1,
                        p: 1.2,
                        bgcolor: alpha("#0C657E", 0.06),
                      }}
                    >
                      <Typography variant="subtitle2">Novo modelo</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Em edição
                      </Typography>
                    </Box>
                  ) : null}
                  {templates.map((template) => {
                    const selected =
                      draftMode === "existing" &&
                      selectedTemplateId === template.id;
                    return (
                      <Button
                        key={template.id}
                        variant={selected ? "contained" : "outlined"}
                        color={selected ? "primary" : "inherit"}
                        onClick={() => selectTemplate(template)}
                        sx={{
                          justifyContent: "flex-start",
                          minHeight: 58,
                          textAlign: "left",
                          px: 1.3,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            noWrap
                            sx={{ maxWidth: 250 }}
                          >
                            {template.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              display: "block",
                              opacity: selected ? 0.86 : 0.74,
                            }}
                            noWrap
                          >
                            {template.subject}
                          </Typography>
                        </Box>
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack spacing={1.4}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.2}
                  >
                    <TextField
                      label="Nome do modelo"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <TextField
                      label="Assunto"
                      value={draft.subject}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          subject: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </Stack>

                  <EmailRichEditor
                    value={draft.bodyHtml}
                    onChange={(bodyHtml) =>
                      setDraft((current) => ({ ...current, bodyHtml }))
                    }
                    disabled={isBusy}
                    onWarning={(message) =>
                      toast.push({ severity: "warning", message })
                    }
                  />

                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.4,
                      bgcolor: "#F8FAFC",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "stretch", md: "center" }}
                      gap={1}
                    >
                      <Box>
                        <Typography variant="subtitle2">Anexos</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Arquivos anexados ao modelo serão enviados junto com o e-mail.
                        </Typography>
                      </Box>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<AttachFileRoundedIcon />}
                        disabled={isBusy}
                      >
                        Adicionar anexos
                        <input
                          type="file"
                          hidden
                          multiple
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            setPendingFiles((current) => [...current, ...files]);
                            event.target.value = "";
                          }}
                        />
                      </Button>
                    </Stack>
                    <Stack spacing={0.8} sx={{ mt: 1.2 }}>
                      {(selectedTemplate?.attachments ?? []).map((attachment) => (
                        <Stack
                          key={attachment.id}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            px: 1,
                            py: 0.7,
                            bgcolor: "#fff",
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {attachment.fileName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatFileSize(attachment.fileSize)}
                            </Typography>
                          </Box>
                          <Tooltip title="Remover anexo">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              disabled={isBusy}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ))}
                      {pendingFiles.map((file, index) => (
                        <Stack
                          key={`${file.name}-${file.size}-${index}`}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                          sx={{
                            border: "1px dashed",
                            borderColor: "primary.main",
                            borderRadius: 1,
                            px: 1,
                            py: 0.7,
                            bgcolor: alpha("#0C657E", 0.05),
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {file.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatFileSize(file.size)} pendente
                            </Typography>
                          </Box>
                          <Tooltip title="Remover anexo pendente">
                            <IconButton
                              size="small"
                              onClick={() =>
                                setPendingFiles((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index),
                                )
                              }
                              disabled={isBusy}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                    gap={1}
                  >
                    <Button
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      disabled={!selectedTemplate || draftMode === "new" || isBusy}
                      onClick={() => setDeleteTemplateTarget(selectedTemplate)}
                    >
                      Excluir modelo
                    </Button>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={openNewTemplate}
                        startIcon={<AddRoundedIcon />}
                        disabled={isBusy}
                      >
                        Novo
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleSaveTemplate}
                        startIcon={<SaveRoundedIcon />}
                        disabled={isBusy}
                      >
                        Salvar modelo
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1.6}>
              <Alert severity="info" icon={<MarkEmailReadRoundedIcon />}>
                Esta tela lista somente OMs que possuem presidente CPCA cadastrado.
              </Alert>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", lg: "center" }}
                gap={1.2}
              >
                <TextField
                  select
                  label="Modelo para envio"
                  value={selectedTemplateId ?? ""}
                  onChange={(event) => {
                    const template = templates.find(
                      (item) => item.id === event.target.value,
                    );
                    if (template) selectTemplate(template);
                  }}
                  sx={{ minWidth: { xs: "100%", lg: 360 } }}
                >
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Buscar OM, presidente ou e-mail"
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  sx={{ minWidth: { xs: "100%", lg: 340 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
                gap={1}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={`${filteredRecipients.length} visíveis`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`${selectedRecipients.length} selecionados`}
                    color="secondary"
                    variant="outlined"
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={toggleAllFilteredRecipients}
                    disabled={filteredRecipients.length === 0 || isBusy}
                  >
                    {allFilteredSelected ? "Limpar visíveis" : "Selecionar visíveis"}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SendRoundedIcon />}
                    onClick={() => requestSend("selected")}
                    disabled={isBusy || selectedRecipients.length === 0}
                  >
                    Enviar selecionados
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<EmailRoundedIcon />}
                    onClick={() => requestSend("all")}
                    disabled={isBusy || recipients.length === 0}
                  >
                    Enviar para todos
                  </Button>
                </Stack>
              </Stack>

              <TableContainer
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  maxHeight: 560,
                }}
              >
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={
                            !allFilteredSelected &&
                            filteredRecipients.some((item) =>
                              selectedRecipientSet.has(item.omId),
                            )
                          }
                          onChange={toggleAllFilteredRecipients}
                        />
                      </TableCell>
                      <TableCell>OM</TableCell>
                      <TableCell>Presidente CPCA</TableCell>
                      <TableCell>E-mail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRecipients.map((recipient) => {
                      const selected = selectedRecipientSet.has(recipient.omId);
                      return (
                        <TableRow
                          key={recipient.omId}
                          hover
                          selected={selected}
                          onClick={() => toggleRecipient(recipient)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={selected} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {recipient.omCode}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {recipient.omName}
                              {recipient.omUf ? ` · ${recipient.omUf}` : ""}
                            </Typography>
                          </TableCell>
                          <TableCell>{recipient.presidentName}</TableCell>
                          <TableCell>{recipient.presidentEmail}</TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredRecipients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Box sx={{ py: 4, textAlign: "center" }}>
                            <Typography color="text.secondary">
                              Nenhuma OM com presidente CPCA encontrada.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}

          {tab === 2 && (
            <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
              <Box sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Disparos recentes
                </Typography>
                <Stack spacing={1}>
                  {dispatches.map((dispatch) => {
                    const selected = selectedDispatch?.id === dispatch.id;
                    return (
                      <Button
                        key={dispatch.id}
                        variant={selected ? "contained" : "outlined"}
                        color={selected ? "primary" : "inherit"}
                        onClick={() => setSelectedDispatchId(dispatch.id)}
                        sx={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          p: 1.2,
                          minHeight: 76,
                        }}
                      >
                        <Stack spacing={0.4} sx={{ minWidth: 0, width: "100%" }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1}
                          >
                            <Typography variant="subtitle2" noWrap>
                              {dispatch.subject}
                            </Typography>
                            {statusChip(dispatch.status)}
                          </Stack>
                          <Typography
                            variant="caption"
                            sx={{ opacity: selected ? 0.86 : 0.72 }}
                            noWrap
                          >
                            {formatDateTime(dispatch.createdAt)}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ opacity: selected ? 0.86 : 0.72 }}
                          >
                            {dispatch.sentCount} enviados · {dispatch.failedCount} falhas
                          </Typography>
                        </Stack>
                      </Button>
                    );
                  })}
                  {dispatches.length === 0 && (
                    <Alert severity="info">Nenhum disparo registrado.</Alert>
                  )}
                </Stack>
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                {selectedDispatch ? (
                  <Stack spacing={1.4}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                      gap={1}
                    >
                      <Box>
                        <Typography variant="h6">
                          {selectedDispatch.subject}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedDispatch.template?.name ?? "Modelo removido"} ·{" "}
                          {formatDateTime(selectedDispatch.createdAt)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {statusChip(selectedDispatch.status)}
                        <Chip
                          label={`${selectedDispatch.totalRecipients} destinatários`}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                    <TableContainer
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        maxHeight: 560,
                      }}
                    >
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Status</TableCell>
                            <TableCell>OM</TableCell>
                            <TableCell>Presidente</TableCell>
                            <TableCell>Falha</TableCell>
                            <TableCell>Data</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedDispatch.deliveries.map((delivery) => (
                            <DeliveryRow key={delivery.id} delivery={delivery} />
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                ) : (
                  <Alert severity="info">Selecione um disparo para ver detalhes.</Alert>
                )}
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTemplateTarget)}
        title="Excluir modelo"
        message="O modelo será excluído e não poderá ser usado em novos envios."
        highlightText={deleteTemplateTarget?.name}
        confirmLabel="Excluir"
        severity="error"
        confirmLoading={deleteTemplate.isPending}
        onCancel={() => setDeleteTemplateTarget(null)}
        onConfirm={handleDeleteTemplate}
      />

      <ConfirmDialog
        open={Boolean(sendConfirmMode)}
        title="Confirmar envio"
        message={
          sendConfirmMode === "all"
            ? "O e-mail será enviado para todos os presidentes CPCA exibidos na tela de destinatários."
            : "O e-mail será enviado para os presidentes CPCA selecionados."
        }
        highlightText={
          sendConfirmMode === "all"
            ? `${recipients.length} destinatários`
            : `${selectedRecipients.length} destinatários`
        }
        confirmLabel="Enviar"
        severity="warning"
        confirmLoading={sendEmail.isPending}
        onCancel={() => setSendConfirmMode(null)}
        onConfirm={handleSendConfirmed}
      />
    </Stack>
  );
}

function DeliveryRow({ delivery }: { delivery: CpcaEmailDelivery }) {
  return (
    <TableRow hover>
      <TableCell>{statusChip(delivery.status)}</TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={700}>
          {formatOmLabel(delivery)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{delivery.recipientName}</Typography>
        <Typography variant="caption" color="text.secondary">
          {delivery.recipientEmail}
        </Typography>
      </TableCell>
      <TableCell sx={{ maxWidth: 360 }}>
        {delivery.errorMessage ? (
          <Typography variant="caption" color="error" sx={{ whiteSpace: "pre-wrap" }}>
            {delivery.errorMessage}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            -
          </Typography>
        )}
      </TableCell>
      <TableCell>{formatDateTime(delivery.sentAt ?? delivery.updatedAt)}</TableCell>
    </TableRow>
  );
}
