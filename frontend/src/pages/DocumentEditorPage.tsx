import {
  Box,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatUnderlinedRoundedIcon from "@mui/icons-material/FormatUnderlinedRounded";
import FormatAlignLeftRoundedIcon from "@mui/icons-material/FormatAlignLeftRounded";
import FormatAlignCenterRoundedIcon from "@mui/icons-material/FormatAlignCenterRounded";
import FormatAlignRightRoundedIcon from "@mui/icons-material/FormatAlignRightRounded";
import FormatAlignJustifyRoundedIcon from "@mui/icons-material/FormatAlignJustifyRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Color } from "@tiptap/extension-color";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Extension, type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import {
  useMe,
  useOnlineDocument,
  useOnlineDocumentPresence,
  useOnlineDocumentVersions,
  useSaveOnlineDocument,
  useTouchOnlineDocumentPresence,
} from "../api/hooks";
import { ACTIVE_ROLE_STORAGE_KEY } from "../api/client";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";

const FONT_FAMILIES = [
  "Arial",
  "Calibri",
  "Cambria",
  "Georgia",
  "Times New Roman",
  "Verdana",
];

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32];
const LINE_HEIGHTS = ["1", "1.15", "1.5", "2"];
const PAGE_WIDTH_CM = 21;
const MIN_PARAGRAPH_TEXT_WIDTH_CM = 2;

const DEFAULT_PAGE_SETTINGS = {
  marginTopCm: 2.5,
  marginRightCm: 2.5,
  marginBottomCm: 2.5,
  marginLeftCm: 2.5,
};

type PageSettings = typeof DEFAULT_PAGE_SETTINGS;

type CollaborationUser = {
  id?: string;
  name: string;
  email?: string;
  color: string;
};

type PresenceUser = CollaborationUser & {
  clientId: number | string;
};

type HttpPresenceItem = {
  userId?: string;
  name?: string;
  email?: string | null;
  color?: string | null;
  isCurrentUser?: boolean;
};

const COLLABORATION_DOCUMENT_PREFIX = "online-document.";
const PRESENCE_COLORS = [
  "#1a73e8",
  "#188038",
  "#d93025",
  "#9334e6",
  "#f9ab00",
  "#00897b",
  "#c5221f",
  "#5f6368",
];

function buildCollaborationUrl() {
  const configured = (
    import.meta.env.VITE_DOCUMENT_COLLAB_URL as string | undefined
  )?.trim();
  const toAbsoluteWebSocketUrl = (value: string) => {
    if (typeof window === "undefined" || !value.startsWith("/")) return value;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}${value}`;
  };
  const fallback = (() => {
    if (typeof window === "undefined") return "ws://localhost:3011";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}://${hostname}:3011`;
    }
    return `${protocol}://${window.location.host}/api/document-collaboration`;
  })();
  const baseUrl = configured ? toAbsoluteWebSocketUrl(configured) : fallback;
  const activeRoleId = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY)?.trim();
  if (!activeRoleId) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}activeRoleId=${encodeURIComponent(activeRoleId)}`;
}

function colorFromString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function renderCollaborationCaret(user: Record<string, unknown>) {
  const color = String(user.color ?? "#1a73e8");
  const name = String(user.name ?? "Usuario");
  const cursor = document.createElement("span");
  cursor.classList.add("collaboration-carets__caret");
  cursor.setAttribute("style", `border-color: ${color}`);

  const label = document.createElement("div");
  label.classList.add("collaboration-carets__label");
  label.setAttribute("style", `background-color: ${color}`);
  label.appendChild(document.createTextNode(name));
  cursor.appendChild(label);
  return cursor;
}

function readPresenceUsers(provider: HocuspocusProvider): PresenceUser[] {
  const states = provider.awareness?.getStates?.();
  const users: PresenceUser[] = [];
  if (!states) return users;

  for (const [clientId, state] of states.entries()) {
    const user =
      state && typeof state === "object"
        ? (state as { user?: Partial<CollaborationUser> }).user
        : null;
    if (!user?.name) continue;
    users.push({
      clientId,
      id: user.id,
      name: user.name,
      email: user.email,
      color: user.color ?? colorFromString(user.name),
    });
  }

  return users;
}

function presenceSessionId(documentId: string) {
  const key = `document-editor-presence:${documentId}`;
  try {
    const existing = window.sessionStorage.getItem(key)?.trim();
    if (existing) return existing;
    const next =
      window.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const ParagraphLayout = Extension.create({
  name: "paragraphLayout",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
          paragraphSpacingAfter: {
            default: null,
            parseHTML: (element) => element.style.marginBottom || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphSpacingAfter) return {};
              return {
                style: `margin-bottom: ${attributes.paragraphSpacingAfter}`,
              };
            },
          },
          paragraphMarginLeft: {
            default: null,
            parseHTML: (element) => element.style.marginLeft || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphMarginLeft) return {};
              return { style: `margin-left: ${attributes.paragraphMarginLeft}` };
            },
          },
          paragraphMarginRight: {
            default: null,
            parseHTML: (element) => element.style.marginRight || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphMarginRight) return {};
              return {
                style: `margin-right: ${attributes.paragraphMarginRight}`,
              };
            },
          },
          paragraphFirstLineIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphFirstLineIndent) return {};
              return {
                style: `text-indent: ${attributes.paragraphFirstLineIndent}`,
              };
            },
          },
        },
      },
    ];
  },
});

type OnlineDocumentResponse = {
  document: {
    id: string;
    title: string;
    updatedAt?: string;
    canEdit?: boolean;
  };
  content?: {
    contentJson?: JSONContent;
    plainText?: string | null;
    pageSettingsJson?: Record<string, unknown> | null;
    savedRevision?: number;
    updatedAt?: string;
  };
};

type VersionItem = {
  id: string;
  revision: number;
  title?: string | null;
  plainText?: string | null;
  createdAt?: string;
  createdBy?: { name?: string; email?: string } | null;
};

function normalizePageSettings(value: unknown): PageSettings {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof PageSettings, unknown>>)
      : {};
  return {
    marginTopCm: normalizeMargin(source.marginTopCm),
    marginRightCm: normalizeMargin(source.marginRightCm),
    marginBottomCm: normalizeMargin(source.marginBottomCm),
    marginLeftCm: normalizeMargin(source.marginLeftCm),
  };
}

function normalizeMargin(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2.5;
  return Math.min(6, Math.max(0.5, Number(parsed.toFixed(1))));
}

function parseCm(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (raw.endsWith("cm")) {
    const parsed = Number(raw.replace("cm", ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCm(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.05) return null;
  return `${rounded.toFixed(1).replace(/\.0$/, "")}cm`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function contentWidthCm(pageSettings: PageSettings) {
  return Math.max(
    MIN_PARAGRAPH_TEXT_WIDTH_CM,
    PAGE_WIDTH_CM - pageSettings.marginLeftCm - pageSettings.marginRightCm,
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function closeEditor(documentId: string) {
  window.close();
  window.location.href = `/documents?docId=${encodeURIComponent(documentId)}`;
}

export function DocumentEditorPage() {
  const { id = "" } = useParams();
  const documentQuery = useOnlineDocument(id);

  if (!id) {
    return <EmptyState title="Documento nao encontrado" />;
  }

  if (documentQuery.isLoading) return <SkeletonState />;
  if (documentQuery.isError) {
    return (
      <ErrorState
        error={documentQuery.error}
        onRetry={() => documentQuery.refetch()}
      />
    );
  }

  const payload = documentQuery.data as OnlineDocumentResponse | undefined;
  if (!payload?.document) {
    return <EmptyState title="Documento nao encontrado" />;
  }

  return <DocumentEditor documentId={id} initialPayload={payload} />;
}

function DocumentEditor(props: {
  documentId: string;
  initialPayload: OnlineDocumentResponse;
}) {
  const { documentId, initialPayload } = props;
  const toast = useToast();
  const meQuery = useMe();
  const saveDocument = useSaveOnlineDocument();
  const versionsQuery = useOnlineDocumentVersions(documentId);
  const presenceQuery = useOnlineDocumentPresence(documentId);
  const touchPresence = useTouchOnlineDocumentPresence();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [marginsAnchorEl, setMarginsAnchorEl] =
    useState<HTMLElement | null>(null);
  const [toolbarVersion, setToolbarVersion] = useState(0);
  const [saveSignal, setSaveSignal] = useState(0);
  const [collaborationStatus, setCollaborationStatus] = useState<
    "connecting" | "connected" | "disconnected" | "synced" | "auth-error"
  >("connecting");
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [httpFallback, setHttpFallback] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialPayload.content?.updatedAt ??
      initialPayload.document.updatedAt ??
      null,
  );
  const [pageSettings, setPageSettings] = useState<PageSettings>(() =>
    normalizePageSettings(initialPayload.content?.pageSettingsJson),
  );
  const collaborationSyncedRef = useRef(false);
  const readyToSaveRef = useRef(false);
  const changeVersionRef = useRef(0);
  const initialEditorContent = useMemo(
    () =>
      (initialPayload.content?.contentJson ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      }) as JSONContent,
    [initialPayload.content?.contentJson],
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const presenceSessionIdValue = useMemo(
    () => presenceSessionId(documentId),
    [documentId],
  );
  const canEdit = Boolean(initialPayload.document.canEdit);
  const localUser = useMemo<CollaborationUser>(() => {
    const source = meQuery.data as
      | { id?: string; name?: string; email?: string }
      | undefined;
    const name = String(source?.name ?? source?.email ?? "Usuario").trim();
    const seed = String(source?.id ?? source?.email ?? name);
    return {
      id: source?.id,
      name: name || "Usuario",
      email: source?.email,
      color: colorFromString(seed || documentId),
    };
  }, [documentId, meQuery.data]);
  const collaboration = useMemo(() => {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: buildCollaborationUrl(),
      name: `${COLLABORATION_DOCUMENT_PREFIX}${documentId}`,
      document: ydoc,
      token: () => localStorage.getItem("accessToken") ?? "",
      onAuthenticationFailed: () => setCollaborationStatus("auth-error"),
      onAuthenticated: () => setCollaborationStatus("connected"),
      onStatus: ({ status }) => {
        if (status === "connected") setCollaborationStatus("connected");
        if (status === "connecting") setCollaborationStatus("connecting");
        if (status === "disconnected") setCollaborationStatus("disconnected");
      },
      onSynced: ({ state }) => {
        if (state) setCollaborationStatus("synced");
      },
    });
    return { provider, ydoc };
  }, [documentId]);
  const { provider, ydoc } = collaboration;

  useEffect(() => {
    collaborationSyncedRef.current = collaborationStatus === "synced";
  }, [collaborationStatus]);

  useEffect(() => {
    readyToSaveRef.current = httpFallback || collaborationStatus === "synced";
  }, [collaborationStatus, httpFallback]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!collaborationSyncedRef.current) {
        setHttpFallback(true);
      }
    }, 4_000);
    return () => window.clearTimeout(timeout);
  }, [documentId]);

  useEffect(() => {
    if (!httpFallback) return;
    provider.destroy();
    setPresenceUsers([]);
  }, [httpFallback, provider]);

  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  useEffect(() => {
    if (httpFallback) {
      setPresenceUsers([]);
      return;
    }
    const updatePresence = () => setPresenceUsers(readPresenceUsers(provider));
    updatePresence();
    provider.awareness?.on("change", updatePresence);
    provider.awareness?.on("update", updatePresence);
    return () => {
      provider.awareness?.off("change", updatePresence);
      provider.awareness?.off("update", updatePresence);
    };
  }, [httpFallback, provider]);

  const editorExtensions = useMemo(() => {
    const extensions: any[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        undoRedo: false,
      }),
    ];

    if (!httpFallback) {
      extensions.push(
        Collaboration.configure({
          document: ydoc,
          field: "default",
          provider,
        }),
        CollaborationCaret.configure({
          provider,
          user: localUser,
          render: renderCollaborationCaret,
        }),
      );
    }

    extensions.push(
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Underline,
      ParagraphLayout,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: true }),
    );

    return extensions;
  }, [httpFallback, localUser, provider, ydoc]);
  const editorContentReady =
    httpFallback || collaborationStatus === "synced";
  const editorReadyToEdit = canEdit && editorContentReady;

  const editor = useEditor(
    {
      editable: editorReadyToEdit,
      content: httpFallback ? initialEditorContent : undefined,
      extensions: editorExtensions,
      editorProps: {
        attributes: {
          class: "gestor-document-editor",
        },
      },
      onUpdate: () => {
        if (!readyToSaveRef.current) return;
        changeVersionRef.current += 1;
        setToolbarVersion((value) => value + 1);
        setSaveStatus("dirty");
        setSaveSignal((value) => value + 1);
      },
      onSelectionUpdate: () => setToolbarVersion((value) => value + 1),
    },
    [documentId, canEdit, httpFallback, editorExtensions],
  );

  useEffect(() => {
    editor?.setEditable(editorReadyToEdit);
  }, [editor, editorReadyToEdit]);

  useEffect(() => {
    if (httpFallback) return;
    provider.setAwarenessField("user", localUser);
    editor?.commands.updateUser(localUser);
  }, [editor, httpFallback, localUser, provider]);

  useEffect(() => {
    const sendPresence = () => {
      touchPresence.mutate({
        id: documentId,
        payload: {
          sessionId: presenceSessionIdValue,
          color: localUser.color,
        },
      });
    };
    sendPresence();
    const interval = window.setInterval(sendPresence, 10_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sendPresence();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    documentId,
    localUser.color,
    presenceSessionIdValue,
    touchPresence.mutate,
  ]);

  const saveNow = useCallback(
    async (versionTitle?: string | null) => {
      if (!editor || !editorReadyToEdit) return;
      const saveVersion = changeVersionRef.current;
      setSaveStatus("saving");
      try {
        const result = await saveDocument.mutateAsync({
          id: documentId,
          payload: {
            contentJson: editor.getJSON() as Record<string, unknown>,
            plainText: editor.getText(),
            pageSettingsJson: pageSettings,
            versionTitle: versionTitle ?? null,
          },
        });
        setLastSavedAt(result?.content?.updatedAt ?? new Date().toISOString());
        if (changeVersionRef.current === saveVersion) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("dirty");
          setSaveSignal((value) => value + 1);
        }
      } catch (error) {
        const payload = parseApiError(error);
        toast.push({
          message: payload.message ?? "Erro ao salvar documento.",
          severity: "error",
        });
        setSaveStatus("error");
      }
    },
    [documentId, editor, editorReadyToEdit, pageSettings, saveDocument, toast],
  );

  useEffect(() => {
    if (!editor || !editorReadyToEdit || saveStatus !== "dirty") return;
    const timeout = window.setTimeout(() => {
      void saveNow();
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [editor, editorReadyToEdit, saveNow, saveSignal, saveStatus]);

  const setPageMargin = (field: keyof PageSettings, value: string) => {
    if (!editorReadyToEdit) return;
    changeVersionRef.current += 1;
    const nextValue = normalizeMargin(value);
    setPageSettings((current) => ({
      ...current,
      [field]: nextValue,
    }));
    setSaveStatus("dirty");
    setSaveSignal((current) => current + 1);
  };

  const currentFont = String(
    editor?.getAttributes("textStyle").fontFamily ?? "Arial",
  );
  const currentFontSize = String(
    editor?.getAttributes("textStyle").fontSize?.replace("px", "") ?? "12",
  );
  const currentLineHeight = String(
    editor?.getAttributes("paragraph").lineHeight ??
      editor?.getAttributes("heading").lineHeight ??
      "1.15",
  );
  const activeBlockAttributes = editor?.isActive("heading")
    ? (editor.getAttributes("heading") as Record<string, unknown>)
    : ((editor?.getAttributes("paragraph") ?? {}) as Record<string, unknown>);
  const paragraphContentWidthCm = contentWidthCm(pageSettings);
  const currentParagraphLayout = {
    leftCm: clamp(
      parseCm(activeBlockAttributes.paragraphMarginLeft),
      0,
      Math.max(0, paragraphContentWidthCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
    ),
    rightCm: clamp(
      parseCm(activeBlockAttributes.paragraphMarginRight),
      0,
      Math.max(0, paragraphContentWidthCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
    ),
    firstLineCm: parseCm(activeBlockAttributes.paragraphFirstLineIndent),
  };
  void toolbarVersion;

  const setFontSize = (size: string) => {
    editor
      ?.chain()
      .focus()
      .setMark("textStyle", { fontSize: `${size}px` })
      .run();
  };

  const setLineHeight = (lineHeight: string) => {
    if (!editor) return;
    if (editor.isActive("heading")) {
      editor.chain().focus().updateAttributes("heading", { lineHeight }).run();
      return;
    }
    editor.chain().focus().updateAttributes("paragraph", { lineHeight }).run();
  };

  const setParagraphSpacing = (spacingPx: string) => {
    if (!editor) return;
    if (editor.isActive("heading")) {
      editor
        .chain()
        .focus()
        .updateAttributes("heading", { paragraphSpacingAfter: spacingPx })
        .run();
      return;
    }
    editor
      .chain()
      .focus()
      .updateAttributes("paragraph", { paragraphSpacingAfter: spacingPx })
      .run();
  };

  const setParagraphMargins = (next: {
    leftCm?: number;
    rightCm?: number;
    firstLineCm?: number;
  }) => {
    if (!editor || !editorReadyToEdit) return;
    const contentWidth = paragraphContentWidthCm;
    let leftCm = currentParagraphLayout.leftCm;
    let rightCm = currentParagraphLayout.rightCm;
    let firstLineCm = currentParagraphLayout.firstLineCm;

    if (typeof next.leftCm === "number") {
      leftCm = clamp(
        next.leftCm,
        0,
        Math.max(0, contentWidth - rightCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
      );
    }
    if (typeof next.rightCm === "number") {
      rightCm = clamp(
        next.rightCm,
        0,
        Math.max(0, contentWidth - leftCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
      );
    }
    if (typeof next.firstLineCm === "number") {
      firstLineCm = next.firstLineCm;
    }

    firstLineCm = clamp(
      firstLineCm,
      -leftCm,
      Math.max(0, contentWidth - leftCm - rightCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
    );

    const attrs = {
      paragraphMarginLeft: formatCm(leftCm),
      paragraphMarginRight: formatCm(rightCm),
      paragraphFirstLineIndent: formatCm(firstLineCm),
    };
    const target = editor.isActive("heading") ? "heading" : "paragraph";
    editor.chain().focus().updateAttributes(target, attrs).run();
  };

  const resetParagraphMargins = () => {
    setParagraphMargins({ leftCm: 0, rightCm: 0, firstLineCm: 0 });
  };

  const handleImageSelected = (file?: File | null) => {
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      if (!src) return;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };

  const displayPresenceUsers = useMemo(() => {
    const byKey = new Map<string, PresenceUser>();
    const addUser = (user: PresenceUser) => {
      const keys = [
        user.id,
        user.email?.toLowerCase(),
        user.name,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
      const existingKey = keys.find((key) => byKey.has(key));
      if (existingKey) {
        const existing = byKey.get(existingKey);
        if (existing && !existing.id && user.id) {
          const merged = { ...existing, id: user.id };
          for (const key of keys) byKey.set(key, merged);
        }
        return;
      }
      if (keys.length === 0) return;
      for (const key of keys) byKey.set(key, user);
    };

    addUser({
      ...localUser,
      clientId: "local",
    });

    const httpUsers = (presenceQuery.data?.items ?? []) as HttpPresenceItem[];
    for (const item of httpUsers) {
      const name = String(item.name ?? item.email ?? "Usuario").trim();
      if (!name) continue;
      addUser({
        clientId: `http:${item.userId ?? item.email ?? name}`,
        id: item.userId,
        name,
        email: item.email ?? undefined,
        color: item.color ?? colorFromString(item.userId ?? item.email ?? name),
      });
    }

    for (const user of presenceUsers) addUser(user);

    return Array.from(new Set(byKey.values())).sort((first, second) => {
      const firstIsLocal =
        first.id === localUser.id || first.email === localUser.email;
      const secondIsLocal =
        second.id === localUser.id || second.email === localUser.email;
      if (firstIsLocal && !secondIsLocal) return -1;
      if (!firstIsLocal && secondIsLocal) return 1;
      return first.name.localeCompare(second.name, "pt-BR");
    });
  }, [localUser, presenceQuery.data?.items, presenceUsers]);

  const versions = (versionsQuery.data?.items ?? []) as VersionItem[];
  const statusLabel = useMemo(() => {
    if (!canEdit) return "Somente leitura";
    if (saveStatus === "saving" || saveDocument.isPending) return "Salvando...";
    if (saveStatus === "dirty") return "Alteracoes pendentes";
    if (saveStatus === "error") return "Erro ao salvar";
    if (httpFallback) {
      return lastSavedAt
        ? `Salvo ${formatDate(lastSavedAt)}`
        : "Modo sem tempo real";
    }
    if (collaborationStatus === "auth-error")
      return "Sem permissao para colaboracao";
    if (collaborationStatus === "connecting") return "Conectando...";
    if (collaborationStatus === "connected") return "Sincronizando...";
    if (collaborationStatus === "disconnected") return "Reconectando...";
    if (lastSavedAt) return `Salvo ${formatDate(lastSavedAt)}`;
    return "Salvo";
  }, [
    canEdit,
    collaborationStatus,
    httpFallback,
    lastSavedAt,
    saveDocument.isPending,
    saveStatus,
  ]);
  const editorIsPreparing =
    !editorContentReady && collaborationStatus !== "auth-error";
  const marginsOpen = Boolean(marginsAnchorEl);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f1f3f4",
        color: "#202124",
        "& .gestor-document-editor": {
          outline: "none",
          minHeight: "calc(297mm - 5cm)",
          fontFamily: "Arial, sans-serif",
          fontSize: "12px",
          lineHeight: 1.15,
        },
        "& .gestor-document-editor p": {
          marginTop: 0,
        },
        "& .gestor-document-editor img": {
          maxWidth: "100%",
          height: "auto",
        },
        "& .gestor-document-editor h1, & .gestor-document-editor h2, & .gestor-document-editor h3":
          {
            marginTop: "0.6em",
          },
        "& .collaboration-carets__caret": {
          borderLeft: "2px solid",
          borderRight: "2px solid transparent",
          marginLeft: "-1px",
          marginRight: "-1px",
          position: "relative",
          pointerEvents: "none",
          wordBreak: "normal",
        },
        "& .collaboration-carets__label": {
          borderRadius: "4px 4px 4px 0",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          left: "-2px",
          lineHeight: 1,
          maxWidth: 180,
          overflow: "hidden",
          px: 0.6,
          py: 0.4,
          position: "absolute",
          textOverflow: "ellipsis",
          top: "-1.6em",
          whiteSpace: "nowrap",
          zIndex: 30,
        },
      }}
    >
      <Paper
        elevation={0}
        square
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid #dadce0",
          bgcolor: "#fff",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.2}
          sx={{ px: 1.2, py: 0.8 }}
        >
          <Tooltip title="Voltar">
            <IconButton onClick={() => closeEditor(documentId)} size="small">
              <ArrowBackRoundedIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {initialPayload.document.title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {statusLabel}
              </Typography>
              <Tooltip title="Sincronizacao em tempo real">
                <SyncRoundedIcon
                  sx={{
                    fontSize: 15,
                    color:
                      collaborationStatus === "synced" ||
                      collaborationStatus === "connected"
                        ? "success.main"
                        : "text.disabled",
                  }}
                />
              </Tooltip>
              <Chip
                size="small"
                label="DOC online"
                color="primary"
                variant="outlined"
              />
            </Stack>
          </Box>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            aria-label={`Pessoas online: ${displayPresenceUsers.length}`}
          >
            <Tooltip title="Pessoas no documento">
              <GroupRoundedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
            </Tooltip>
            <Stack direction="row" spacing={-0.8}>
              {displayPresenceUsers.slice(0, 5).map((user) => (
                <Tooltip
                  key={`${user.clientId}-${user.id ?? user.name}`}
                  title={user.email ? `${user.name} (${user.email})` : user.name}
                >
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: user.color,
                      border: "2px solid #fff",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {initials(user.name)}
                  </Avatar>
                </Tooltip>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {displayPresenceUsers.length}
            </Typography>
          </Stack>
          <Tooltip title="Salvar agora">
            <span>
              <IconButton
                onClick={() => {
                  void saveNow("Salvamento manual");
                }}
                disabled={!editorReadyToEdit || saveDocument.isPending}
                size="small"
              >
                {saveDocument.isPending ? (
                  <CircularProgress size={18} />
                ) : (
                  <SaveRoundedIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Historico">
            <IconButton onClick={() => setHistoryOpen(true)} size="small">
              <HistoryRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider />

        <Stack
          direction="row"
          spacing={0.6}
          alignItems="center"
          sx={{ px: 1.2, py: 0.8, overflowX: "auto" }}
        >
          <ToolbarButton
            title="Desfazer"
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <UndoRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Refazer"
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <RedoRoundedIcon fontSize="small" />
          </ToolbarButton>
          <Divider orientation="vertical" flexItem />
          <TextField
            select
            size="small"
            value={currentFont}
            onChange={(event) =>
              editor?.chain().focus().setFontFamily(event.target.value).run()
            }
            disabled={!editor || !editorReadyToEdit}
            sx={{ width: 170 }}
          >
            {FONT_FAMILIES.map((font) => (
              <MenuItem key={font} value={font}>
                {font}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={
              FONT_SIZES.map(String).includes(currentFontSize)
                ? currentFontSize
                : "12"
            }
            onChange={(event) => setFontSize(event.target.value)}
            disabled={!editor || !editorReadyToEdit}
            sx={{ width: 82 }}
          >
            {FONT_SIZES.map((size) => (
              <MenuItem key={size} value={String(size)}>
                {size}
              </MenuItem>
            ))}
          </TextField>
          <ToolbarButton
            title="Negrito"
            active={editor?.isActive("bold")}
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <FormatBoldRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Italico"
            active={editor?.isActive("italic")}
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <FormatItalicRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Sublinhado"
            active={editor?.isActive("underline")}
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <FormatUnderlinedRoundedIcon fontSize="small" />
          </ToolbarButton>
          <TextField
            type="color"
            size="small"
            value={String(
              editor?.getAttributes("textStyle").color ?? "#202124",
            )}
            onChange={(event) =>
              editor?.chain().focus().setColor(event.target.value).run()
            }
            disabled={!editor || !editorReadyToEdit}
            sx={{ width: 54 }}
          />
          <Divider orientation="vertical" flexItem />
          <ToolbarButton
            title="Alinhar a esquerda"
            active={editor?.isActive({ textAlign: "left" })}
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          >
            <FormatAlignLeftRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Centralizar"
            active={editor?.isActive({ textAlign: "center" })}
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          >
            <FormatAlignCenterRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Alinhar a direita"
            active={editor?.isActive({ textAlign: "right" })}
            disabled={!editor || !editorReadyToEdit}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          >
            <FormatAlignRightRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Justificar"
            active={editor?.isActive({ textAlign: "justify" })}
            disabled={!editor || !editorReadyToEdit}
            onClick={() =>
              editor?.chain().focus().setTextAlign("justify").run()
            }
          >
            <FormatAlignJustifyRoundedIcon fontSize="small" />
          </ToolbarButton>
          <TextField
            select
            size="small"
            value={
              LINE_HEIGHTS.includes(currentLineHeight)
                ? currentLineHeight
                : "1.15"
            }
            onChange={(event) => setLineHeight(event.target.value)}
            disabled={!editor || !editorReadyToEdit}
            sx={{ width: 92 }}
          >
            {LINE_HEIGHTS.map((lineHeight) => (
              <MenuItem key={lineHeight} value={lineHeight}>
                {lineHeight}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value="0"
            onChange={(event) => setParagraphSpacing(`${event.target.value}px`)}
            disabled={!editor || !editorReadyToEdit}
            sx={{ width: 118 }}
          >
            <MenuItem value="0">Paragrafo</MenuItem>
            <MenuItem value="8">+ 8px</MenuItem>
            <MenuItem value="12">+ 12px</MenuItem>
            <MenuItem value="18">+ 18px</MenuItem>
          </TextField>
          <ToolbarButton
            title="Inserir imagem"
            disabled={!editor || !editorReadyToEdit}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageRoundedIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title="Margens"
            disabled={!editorReadyToEdit}
            onClick={(event) => setMarginsAnchorEl(event.currentTarget)}
          >
            <TuneRoundedIcon fontSize="small" />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              handleImageSelected(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </Stack>

        <ParagraphRuler
          contentWidthCm={paragraphContentWidthCm}
          disabled={!editorReadyToEdit}
          firstLineCm={currentParagraphLayout.firstLineCm}
          leftCm={currentParagraphLayout.leftCm}
          onChange={setParagraphMargins}
          onReset={resetParagraphMargins}
          rightCm={currentParagraphLayout.rightCm}
        />
      </Paper>

      <Popover
        open={marginsOpen}
        anchorEl={marginsAnchorEl}
        onClose={() => setMarginsAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 1,
              boxShadow: "0 8px 24px rgba(60, 64, 67, 0.18)",
              maxWidth: "calc(100vw - 24px)",
              p: 1.2,
            },
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <MarginField
            label="Superior"
            value={pageSettings.marginTopCm}
            onChange={(value) => setPageMargin("marginTopCm", value)}
          />
          <MarginField
            label="Direita"
            value={pageSettings.marginRightCm}
            onChange={(value) => setPageMargin("marginRightCm", value)}
          />
          <MarginField
            label="Inferior"
            value={pageSettings.marginBottomCm}
            onChange={(value) => setPageMargin("marginBottomCm", value)}
          />
          <MarginField
            label="Esquerda"
            value={pageSettings.marginLeftCm}
            onChange={(value) => setPageMargin("marginLeftCm", value)}
          />
        </Stack>
      </Popover>

      <Box sx={{ py: 3, px: { xs: 1, md: 4 }, overflowX: "auto" }}>
        <Paper
          elevation={3}
          sx={{
            position: "relative",
            width: "210mm",
            minHeight: "297mm",
            mx: "auto",
            bgcolor: "#fff",
            borderRadius: 0,
            p: `${pageSettings.marginTopCm}cm ${pageSettings.marginRightCm}cm ${pageSettings.marginBottomCm}cm ${pageSettings.marginLeftCm}cm`,
          }}
        >
          {editorIsPreparing && (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1.4}
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "#fff",
                color: "text.secondary",
                zIndex: 1,
              }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2" fontWeight={600}>
                Carregando documento...
              </Typography>
              <Typography variant="caption">
                Sincronizando as informacoes do arquivo.
              </Typography>
            </Stack>
          )}
          <Box
            sx={{
              opacity: editorIsPreparing ? 0 : 1,
              pointerEvents: editorIsPreparing ? "none" : "auto",
            }}
          >
            <EditorContent editor={editor} />
          </Box>
        </Paper>
      </Box>

      <Drawer
        anchor="right"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      >
        <Box sx={{ width: { xs: 320, sm: 420 }, p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            mb={1}
          >
            <Typography variant="h6" fontWeight={700}>
              Historico
            </Typography>
            <IconButton onClick={() => setHistoryOpen(false)} size="small">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          {versionsQuery.isLoading ? (
            <SkeletonState />
          ) : versions.length === 0 ? (
            <EmptyState title="Sem versoes" />
          ) : (
            <List dense>
              {versions.map((version) => (
                <ListItem key={version.id} divider alignItems="flex-start">
                  <ListItemText
                    primary={version.title ?? `Versao ${version.revision}`}
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="caption"
                          display="block"
                        >
                          {formatDate(version.createdAt)}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          display="block"
                        >
                          {version.createdBy?.name ?? "Sistema"}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}

function ParagraphRuler(props: {
  contentWidthCm: number;
  disabled: boolean;
  firstLineCm: number;
  leftCm: number;
  onChange: (next: {
    leftCm?: number;
    rightCm?: number;
    firstLineCm?: number;
  }) => void;
  onReset: () => void;
  rightCm: number;
}) {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const safeContentWidthCm = Math.max(
    MIN_PARAGRAPH_TEXT_WIDTH_CM,
    props.contentWidthCm,
  );
  const leftCm = clamp(
    props.leftCm,
    0,
    Math.max(0, safeContentWidthCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
  );
  const rightCm = clamp(
    props.rightCm,
    0,
    Math.max(0, safeContentWidthCm - leftCm - MIN_PARAGRAPH_TEXT_WIDTH_CM),
  );
  const firstLineCm = clamp(
    props.firstLineCm,
    -leftCm,
    Math.max(
      0,
      safeContentWidthCm - leftCm - rightCm - MIN_PARAGRAPH_TEXT_WIDTH_CM,
    ),
  );
  const leftPercent = (leftCm / safeContentWidthCm) * 100;
  const rightPercent = ((safeContentWidthCm - rightCm) / safeContentWidthCm) * 100;
  const firstLinePercent =
    ((leftCm + firstLineCm) / safeContentWidthCm) * 100;
  const tickCount = Math.floor(safeContentWidthCm);

  const positionToCm = (clientX: number) => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect?.width) return 0;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(ratio * safeContentWidthCm * 10) / 10;
  };

  const startDrag =
    (kind: "left" | "right" | "firstLine") =>
    (event: ReactPointerEvent<HTMLElement>) => {
      if (props.disabled) return;
      event.preventDefault();

      const apply = (clientX: number) => {
        const cm = positionToCm(clientX);
        if (kind === "left") {
          props.onChange({ leftCm: cm });
          return;
        }
        if (kind === "right") {
          props.onChange({ rightCm: safeContentWidthCm - cm });
          return;
        }
        props.onChange({ firstLineCm: cm - leftCm });
      };

      apply(event.clientX);
      const handleMove = (moveEvent: PointerEvent) =>
        apply(moveEvent.clientX);
      const handleUp = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        borderTop: "1px solid #edf0f2",
        height: 42,
        minHeight: 42,
        overflowX: "auto",
        px: 1.2,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ flex: "0 0 auto", fontWeight: 600 }}
      >
        Paragrafo
      </Typography>
      <Box
        ref={rulerRef}
        sx={{
          bgcolor: "#f8fafd",
          border: "1px solid #dadce0",
          borderRadius: 1,
          flex: "1 0 420px",
          height: 30,
          maxWidth: 820,
          minWidth: 360,
          position: "relative",
        }}
      >
        {Array.from({ length: tickCount + 1 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              bgcolor: "#bdc1c6",
              height: index % 2 === 0 ? 10 : 6,
              left: `${(index / safeContentWidthCm) * 100}%`,
              position: "absolute",
              top: 0,
              width: 1,
            }}
          />
        ))}
        <Box
          sx={{
            bgcolor: "rgba(26, 115, 232, 0.08)",
            bottom: 0,
            left: `${leftPercent}%`,
            pointerEvents: "none",
            position: "absolute",
            right: `${100 - rightPercent}%`,
            top: 12,
          }}
        />
        <RulerHandle
          disabled={props.disabled}
          label="Recuo da primeira linha"
          leftPercent={firstLinePercent}
          onPointerDown={startDrag("firstLine")}
          variant="firstLine"
        />
        <RulerHandle
          disabled={props.disabled}
          label="Margem esquerda do paragrafo"
          leftPercent={leftPercent}
          onPointerDown={startDrag("left")}
          variant="left"
        />
        <RulerHandle
          disabled={props.disabled}
          label="Margem direita do paragrafo"
          leftPercent={rightPercent}
          onPointerDown={startDrag("right")}
          variant="right"
        />
      </Box>
      <Tooltip title="Zerar recuos do paragrafo">
        <span>
          <IconButton
            disabled={props.disabled}
            onClick={props.onReset}
            size="small"
            sx={{ flex: "0 0 auto" }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

function RulerHandle(props: {
  disabled: boolean;
  label: string;
  leftPercent: number;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  variant: "left" | "right" | "firstLine";
}) {
  const color = props.disabled ? "#9aa0a6" : "#1a73e8";
  const isFirstLine = props.variant === "firstLine";
  return (
    <Tooltip title={props.label}>
      <Box
        aria-label={props.label}
        onPointerDown={props.onPointerDown}
        role="button"
        sx={{
          alignItems: "center",
          cursor: props.disabled ? "default" : "ew-resize",
          display: "flex",
          height: 28,
          justifyContent: "center",
          left: `${props.leftPercent}%`,
          pointerEvents: props.disabled ? "none" : "auto",
          position: "absolute",
          top: isFirstLine ? 0 : 8,
          transform: "translateX(-50%)",
          width: 20,
          zIndex: 2,
        }}
        tabIndex={props.disabled ? -1 : 0}
      >
        <Box
          sx={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: isFirstLine ? `8px solid ${color}` : "none",
            borderBottom: isFirstLine ? "none" : `8px solid ${color}`,
            height: 0,
            width: 0,
          }}
        />
        {!isFirstLine && (
          <Box
            sx={{
              bgcolor: color,
              borderRadius: "2px 2px 0 0",
              height: 10,
              mt: 1,
              position: "absolute",
              top: 8,
              width: 6,
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}

function ToolbarButton(props: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <Tooltip title={props.title}>
      <span>
        <IconButton
          size="small"
          disabled={props.disabled}
          onClick={props.onClick}
          sx={{
            width: 34,
            height: 34,
            bgcolor: props.active ? "rgba(26, 115, 232, 0.12)" : "transparent",
            color: props.active ? "#174ea6" : "inherit",
            borderRadius: 1,
          }}
        >
          {props.children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function MarginField(props: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      size="small"
      type="number"
      label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      inputProps={{ min: 0.5, max: 6, step: 0.1 }}
      sx={{ width: 118 }}
    />
  );
}
