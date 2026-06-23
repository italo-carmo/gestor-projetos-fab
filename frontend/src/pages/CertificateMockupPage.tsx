import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatAlignCenterRoundedIcon from "@mui/icons-material/FormatAlignCenterRounded";
import FormatAlignLeftRoundedIcon from "@mui/icons-material/FormatAlignLeftRounded";
import FormatAlignRightRoundedIcon from "@mui/icons-material/FormatAlignRightRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import TextFieldsRoundedIcon from "@mui/icons-material/TextFieldsRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { api } from "../api/client";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import "./CertificateMockupPage.css";

const COMGEP_LOGO_SRC = "/mockups/certificate/comgep.png";
const FAB_LOGO_SRC = "/mockups/certificate/fab.png";
const DEFAULT_SIGNATURE_SRC = "/mockups/certificate/assinatura.png";
const STORAGE_KEY = "certificate-template-editor-v1";
const TEMPLATE_WIDTH = 1123;
const TEMPLATE_HEIGHT = 794;
const SNAP_TOLERANCE_PX = 8;
const RECIPIENT_VARIABLE_KEY = "recipient_full_name";
const RECIPIENT_SAMPLE = "NOME COMPLETO DO PARTICIPANTE";

type CertificateElementType = "text" | "variable" | "image" | "line";
type TextAlign = "left" | "center" | "right";

type CertificateElementBase = {
  id: string;
  type: CertificateElementType;
  label: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
};

type CertificateTextElement = CertificateElementBase & {
  type: "text" | "variable";
  text: string;
  variableKey?: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  colorHex: string;
  textAlign: TextAlign;
  lineHeight: number;
};

type CertificateImageElement = CertificateElementBase & {
  type: "image";
  src: string;
  alt: string;
  mixBlendMode: "normal" | "multiply";
};

type CertificateLineElement = CertificateElementBase & {
  type: "line";
  colorHex: string;
  thicknessPx: number;
};

type CertificateElement =
  | CertificateTextElement
  | CertificateImageElement
  | CertificateLineElement;

type CertificateTemplate = {
  id: string;
  backendTemplateId?: string | null;
  name: string;
  description: string;
  backgroundColor: string;
  frameColor: string;
  elements: CertificateElement[];
  updatedAt: string;
};

type SnapGuide = {
  valuePct: number;
  kind: "page" | "element";
};

type SnapGuides = {
  x?: SnapGuide;
  y?: SnapGuide;
};

type DragState = {
  id: string;
  startX: number;
  startY: number;
  baseXPct: number;
  baseYPct: number;
  moved: boolean;
};

type ResizeState = {
  id: string;
  startX: number;
  baseWidthPct: number;
};

const colorPalette = [
  "#111111",
  "#3A3A3A",
  "#8E642A",
  "#0C657E",
  "#FFFFFF",
  "#B78232",
  "#1D4ED8",
  "#991B1B",
];

const fontOptions = [
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Sora", value: '"Sora", "Manrope", sans-serif' },
  { label: "Manrope", value: '"Manrope", "Segoe UI", sans-serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times", value: '"Times New Roman", Times, serif' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isTextElement(
  element: CertificateElement | null | undefined,
): element is CertificateTextElement {
  return element?.type === "text" || element?.type === "variable";
}

function isImageElement(
  element: CertificateElement | null | undefined,
): element is CertificateImageElement {
  return element?.type === "image";
}

function isLineElement(
  element: CertificateElement | null | undefined,
): element is CertificateLineElement {
  return element?.type === "line";
}

function normalizeHexColorInput(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(prefixed);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toUpperCase()}`;
  }
  return prefixed.toUpperCase();
}

function createDefaultElements(): CertificateElement[] {
  return [
    {
      id: "watermark-fab",
      type: "image",
      label: "Marca d'água FAB",
      src: FAB_LOGO_SRC,
      alt: "Marca d'água da Força Aérea Brasileira",
      xPct: 0.37,
      yPct: 0.31,
      widthPct: 0.28,
      zIndex: 1,
      visible: true,
      locked: false,
      opacity: 0.08,
      mixBlendMode: "normal",
    },
    {
      id: "logo-comgep",
      type: "image",
      label: "Logo COMGEP",
      src: COMGEP_LOGO_SRC,
      alt: "Comando-Geral do Pessoal",
      xPct: 0.105,
      yPct: 0.12,
      widthPct: 0.085,
      zIndex: 8,
      visible: true,
      locked: false,
      opacity: 1,
      mixBlendMode: "normal",
    },
    {
      id: "logo-fab",
      type: "image",
      label: "Logo FAB",
      src: FAB_LOGO_SRC,
      alt: "Força Aérea Brasileira",
      xPct: 0.79,
      yPct: 0.115,
      widthPct: 0.125,
      zIndex: 8,
      visible: true,
      locked: false,
      opacity: 1,
      mixBlendMode: "normal",
    },
    {
      id: "institution",
      type: "text",
      label: "Órgão",
      text: "COMANDO-GERAL DO PESSOAL",
      xPct: 0.355,
      yPct: 0.115,
      widthPct: 0.29,
      zIndex: 9,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 13,
      fontWeight: 800,
      fontStyle: "normal",
      colorHex: "#4E5960",
      textAlign: "center",
      lineHeight: 1.1,
    },
    {
      id: "title",
      type: "text",
      label: "Título",
      text: "CERTIFICADO",
      xPct: 0.295,
      yPct: 0.15,
      widthPct: 0.41,
      zIndex: 10,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSizePx: 46,
      fontWeight: 500,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 0.96,
    },
    {
      id: "title-line-left",
      type: "line",
      label: "Ornamento esquerdo",
      xPct: 0.338,
      yPct: 0.266,
      widthPct: 0.14,
      zIndex: 7,
      visible: true,
      locked: false,
      opacity: 1,
      colorHex: "#B78232",
      thicknessPx: 1,
    },
    {
      id: "title-line-right",
      type: "line",
      label: "Ornamento direito",
      xPct: 0.52,
      yPct: 0.266,
      widthPct: 0.14,
      zIndex: 7,
      visible: true,
      locked: false,
      opacity: 1,
      colorHex: "#B78232",
      thicknessPx: 1,
    },
    {
      id: "body-intro",
      type: "text",
      label: "Texto antes do nome",
      text: "Certifico que",
      xPct: 0.18,
      yPct: 0.365,
      widthPct: 0.64,
      zIndex: 10,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 25,
      fontWeight: 400,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 1.28,
    },
    {
      id: "recipient-name",
      type: "variable",
      label: "Nome completo do lote",
      text: RECIPIENT_SAMPLE,
      variableKey: RECIPIENT_VARIABLE_KEY,
      xPct: 0.18,
      yPct: 0.425,
      widthPct: 0.64,
      zIndex: 11,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 27,
      fontWeight: 700,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 1.18,
    },
    {
      id: "body-details",
      type: "text",
      label: "Texto depois do nome",
      text: "ministrou, no COMGEP, a palestra com o tema Assédio Sexual na FAB.",
      xPct: 0.18,
      yPct: 0.505,
      widthPct: 0.64,
      zIndex: 10,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 24,
      fontWeight: 400,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 1.28,
    },
    {
      id: "signature",
      type: "image",
      label: "Assinatura",
      src: DEFAULT_SIGNATURE_SRC,
      alt: "Assinatura",
      xPct: 0.423,
      yPct: 0.698,
      widthPct: 0.21,
      zIndex: 12,
      visible: true,
      locked: false,
      opacity: 1,
      mixBlendMode: "multiply",
    },
    {
      id: "signature-line",
      type: "line",
      label: "Linha da assinatura",
      xPct: 0.335,
      yPct: 0.802,
      widthPct: 0.34,
      zIndex: 11,
      visible: true,
      locked: false,
      opacity: 1,
      colorHex: "#111111",
      thicknessPx: 2,
    },
    {
      id: "signer-name",
      type: "text",
      label: "Nome do assinante",
      text: "Regilânio Isaías Aguiar de Melo Cel Av",
      xPct: 0.335,
      yPct: 0.823,
      widthPct: 0.34,
      zIndex: 10,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 16,
      fontWeight: 800,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 1.12,
    },
    {
      id: "signer-role",
      type: "text",
      label: "Cargo do assinante",
      text: "Comandante do CINDacta II",
      xPct: 0.335,
      yPct: 0.852,
      widthPct: 0.34,
      zIndex: 10,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 14,
      fontWeight: 600,
      fontStyle: "normal",
      colorHex: "#4E5960",
      textAlign: "center",
      lineHeight: 1.12,
    },
    {
      id: "date",
      type: "text",
      label: "Data",
      text: "Brasília, 19 de junho de 2026.",
      xPct: 0.68,
      yPct: 0.782,
      widthPct: 0.24,
      zIndex: 10,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 16,
      fontWeight: 500,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "right",
      lineHeight: 1.2,
    },
  ];
}

function createDefaultTemplate(name = "Modelo clássico COMGEP"): CertificateTemplate {
  return {
    id: makeId("cert-template"),
    name,
    description: "Modelo A4 paisagem com logos COMGEP e FAB, assinatura e campo de lote.",
    backgroundColor: "#F8F4EC",
    frameColor: "#8E642A",
    elements: createDefaultElements(),
    updatedAt: nowIso(),
  };
}

function cloneTemplate(template: CertificateTemplate, name: string): CertificateTemplate {
  return {
    ...template,
    id: makeId("cert-template"),
    backendTemplateId: null,
    name,
    elements: template.elements.map((element) => ({
      ...element,
      id: makeId(element.type),
    })),
    updatedAt: nowIso(),
  };
}

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createDefaultTemplate()];
    const parsed = JSON.parse(raw) as CertificateTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [createDefaultTemplate()];
    return parsed;
  } catch {
    return [createDefaultTemplate()];
  }
}

function buildBackendTemplatePayload(template: CertificateTemplate) {
  return {
    name: template.name.trim() || "Modelo sem nome",
    description: template.description.trim() || null,
    layoutJson: {
      backgroundColor: template.backgroundColor,
      frameColor: template.frameColor,
      elements: template.elements,
    },
  };
}

async function saveTemplateInBackend(template: CertificateTemplate) {
  const payload = buildBackendTemplatePayload(template);
  const backendTemplateId = String(template.backendTemplateId ?? "").trim();
  if (!backendTemplateId) {
    return (await api.post("/certificates/templates", payload)).data as {
      id?: string;
    };
  }

  try {
    return (
      await api.put(`/certificates/templates/${backendTemplateId}`, payload)
    ).data as { id?: string };
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status !== 404) {
      throw error;
    }
    return (await api.post("/certificates/templates", payload)).data as {
      id?: string;
    };
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CertificateMockupPage() {
  const toast = useToast();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const suppressNextClickRef = useRef(false);
  const [templates, setTemplates] = useState<CertificateTemplate[]>(() => loadTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedElementId, setSelectedElementId] = useState("recipient-name");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({});
  const [dirty, setDirty] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ??
      templates[0] ??
      createDefaultTemplate(),
    [selectedTemplateId, templates],
  );

  const selectedElement = useMemo(
    () =>
      selectedTemplate.elements.find((element) => element.id === selectedElementId) ??
      null,
    [selectedElementId, selectedTemplate.elements],
  );

  const scale = canvasSize.width > 0 ? canvasSize.width / TEMPLATE_WIDTH : 1;

  useEffect(() => {
    if (!selectedTemplateId && templates[0]) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      setCanvasSize({
        width,
        height: width * (TEMPLATE_HEIGHT / TEMPLATE_WIDTH),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const updateSelectedTemplate = useCallback(
    (updater: (template: CertificateTemplate) => CertificateTemplate) => {
      setTemplates((current) =>
        current.map((template) =>
          template.id === selectedTemplate.id
            ? {
                ...updater(template),
                updatedAt: nowIso(),
              }
            : template,
        ),
      );
      setDirty(true);
    },
    [selectedTemplate.id],
  );

  const updateElement = useCallback(
    (elementId: string, patch: Partial<CertificateElement>) => {
      updateSelectedTemplate((template) => ({
        ...template,
        elements: template.elements.map((element) =>
          element.id === elementId
            ? ({
                ...element,
                ...patch,
              } as CertificateElement)
            : element,
        ),
      }));
    },
    [updateSelectedTemplate],
  );

  const getElementMetrics = useCallback((elementId: string) => {
    const element = elementRefs.current[elementId];
    const canvas = canvasRef.current;
    if (!element || !canvas) return null;
    const elementRect = element.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
    return {
      widthPct: elementRect.width / canvasRect.width,
      heightPct: elementRect.height / canvasRect.height,
    };
  }, []);

  const resolveSnappedPlacement = useCallback(
    (movingElement: CertificateElement, proposedXPct: number, proposedYPct: number) => {
      const movingMetrics = getElementMetrics(movingElement.id) ?? {
        widthPct: movingElement.widthPct,
        heightPct: 0.06,
      };
      const toleranceXPct = SNAP_TOLERANCE_PX / Math.max(canvasSize.width, 1);
      const toleranceYPct = SNAP_TOLERANCE_PX / Math.max(canvasSize.height, 1);
      let snappedX = proposedXPct;
      let snappedY = proposedYPct;
      let bestXDistance = Number.POSITIVE_INFINITY;
      let bestYDistance = Number.POSITIVE_INFINITY;
      let bestXGuide: SnapGuide | undefined;
      let bestYGuide: SnapGuide | undefined;

      const considerX = (
        proposedReferencePct: number,
        targetReferencePct: number,
        targetLeftPct: number,
        guide: SnapGuide,
      ) => {
        const distance = Math.abs(proposedReferencePct - targetReferencePct);
        if (distance <= toleranceXPct && distance < bestXDistance) {
          bestXDistance = distance;
          snappedX = clamp(targetLeftPct, 0.015, 0.985 - movingMetrics.widthPct);
          bestXGuide = guide;
        }
      };

      const considerY = (
        proposedReferencePct: number,
        targetReferencePct: number,
        targetTopPct: number,
        guide: SnapGuide,
      ) => {
        const distance = Math.abs(proposedReferencePct - targetReferencePct);
        if (distance <= toleranceYPct && distance < bestYDistance) {
          bestYDistance = distance;
          snappedY = clamp(targetTopPct, 0.015, 0.985 - movingMetrics.heightPct);
          bestYGuide = guide;
        }
      };

      const movingRight = proposedXPct + movingMetrics.widthPct;
      const movingCenterX = proposedXPct + movingMetrics.widthPct / 2;
      const movingBottom = proposedYPct + movingMetrics.heightPct;
      const movingCenterY = proposedYPct + movingMetrics.heightPct / 2;

      considerX(movingCenterX, 0.5, 0.5 - movingMetrics.widthPct / 2, {
        valuePct: 0.5,
        kind: "page",
      });
      considerY(movingCenterY, 0.5, 0.5 - movingMetrics.heightPct / 2, {
        valuePct: 0.5,
        kind: "page",
      });

      for (const element of selectedTemplate.elements) {
        if (element.id === movingElement.id || !element.visible) continue;
        const metrics = getElementMetrics(element.id) ?? {
          widthPct: element.widthPct,
          heightPct: 0.06,
        };
        const left = element.xPct;
        const right = element.xPct + metrics.widthPct;
        const centerX = element.xPct + metrics.widthPct / 2;
        const top = element.yPct;
        const bottom = element.yPct + metrics.heightPct;
        const centerY = element.yPct + metrics.heightPct / 2;

        considerX(proposedXPct, left, left, { valuePct: left, kind: "element" });
        considerX(movingRight, right, right - movingMetrics.widthPct, {
          valuePct: right,
          kind: "element",
        });
        considerX(movingCenterX, centerX, centerX - movingMetrics.widthPct / 2, {
          valuePct: centerX,
          kind: "element",
        });

        considerY(proposedYPct, top, top, { valuePct: top, kind: "element" });
        considerY(movingBottom, bottom, bottom - movingMetrics.heightPct, {
          valuePct: bottom,
          kind: "element",
        });
        considerY(movingCenterY, centerY, centerY - movingMetrics.heightPct / 2, {
          valuePct: centerY,
          kind: "element",
        });
      }

      return {
        xPct: snappedX,
        yPct: snappedY,
        guides: {
          x: bestXGuide,
          y: bestYGuide,
        },
      };
    },
    [canvasSize.height, canvasSize.width, getElementMetrics, selectedTemplate.elements],
  );

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();

      if (dragStateRef.current) {
        const element = selectedTemplate.elements.find(
          (item) => item.id === dragStateRef.current?.id,
        );
        if (!element) return;
        const metrics = getElementMetrics(element.id) ?? {
          widthPct: element.widthPct,
          heightPct: 0.06,
        };
        const deltaX = event.clientX - dragStateRef.current.startX;
        const deltaY = event.clientY - dragStateRef.current.startY;
        if (
          !dragStateRef.current.moved &&
          (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)
        ) {
          dragStateRef.current.moved = true;
        }
        const proposedX = clamp(
          dragStateRef.current.baseXPct + deltaX / rect.width,
          0.015,
          0.985 - metrics.widthPct,
        );
        const proposedY = clamp(
          dragStateRef.current.baseYPct + deltaY / rect.height,
          0.015,
          0.985 - metrics.heightPct,
        );
        const snapped = resolveSnappedPlacement(element, proposedX, proposedY);
        setSnapGuides(snapped.guides);
        updateElement(element.id, {
          xPct: snapped.xPct,
          yPct: snapped.yPct,
        });
        return;
      }

      if (resizeStateRef.current) {
        const element = selectedTemplate.elements.find(
          (item) => item.id === resizeStateRef.current?.id,
        );
        if (!element) return;
        const deltaX = event.clientX - resizeStateRef.current.startX;
        updateElement(element.id, {
          widthPct: clamp(
            resizeStateRef.current.baseWidthPct + deltaX / rect.width,
            element.type === "line" ? 0.035 : 0.045,
            0.9,
          ),
        });
      }
    };

    const handleUp = () => {
      if (dragStateRef.current?.moved) {
        suppressNextClickRef.current = true;
      }
      dragStateRef.current = null;
      resizeStateRef.current = null;
      setSnapGuides({});
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    getElementMetrics,
    resolveSnappedPlacement,
    selectedTemplate.elements,
    updateElement,
  ]);

  const startDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    element: CertificateElement,
  ) => {
    if (element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    dragStateRef.current = {
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      baseXPct: element.xPct,
      baseYPct: element.yPct,
      moved: false,
    };
  };

  const startResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: CertificateElement,
  ) => {
    if (element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    resizeStateRef.current = {
      id: element.id,
      startX: event.clientX,
      baseWidthPct: element.widthPct,
    };
  };

  const saveTemplates = async () => {
    setSavingTemplate(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      toast.push({
        message: "Nao foi possivel salvar o modelo neste navegador.",
        severity: "error",
      });
      setSavingTemplate(false);
      return;
    }

    try {
      const saved = await saveTemplateInBackend(selectedTemplate);
      const backendTemplateId = String(saved?.id ?? "").trim();
      if (backendTemplateId) {
        const nextTemplates = templates.map((template) =>
          template.id === selectedTemplate.id
            ? { ...template, backendTemplateId }
            : template,
        );
        setTemplates(nextTemplates);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTemplates));
      }
      setDirty(false);
      toast.push({
        message: "Modelo salvo no sistema e disponível em TI - Certificados.",
        severity: "success",
      });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      setDirty(false);
      toast.push({
        message:
          status === 401 || status === 403
            ? "Modelo salvo neste navegador. Entre com perfil COMGEP ou TI para salvar no sistema."
            : parseApiError(error).message ??
              "Modelo salvo neste navegador, mas nao foi salvo no sistema.",
        severity: status === 401 || status === 403 ? "warning" : "error",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const createTemplate = () => {
    const next = createDefaultTemplate(`Novo modelo ${templates.length + 1}`);
    setTemplates((current) => [...current, next]);
    setSelectedTemplateId(next.id);
    setSelectedElementId("recipient-name");
    setDirty(true);
  };

  const duplicateTemplate = () => {
    const next = cloneTemplate(
      selectedTemplate,
      `${selectedTemplate.name || "Modelo"} - cópia`,
    );
    setTemplates((current) => [...current, next]);
    setSelectedTemplateId(next.id);
    setSelectedElementId(next.elements[0]?.id ?? "");
    setDirty(true);
  };

  const deleteTemplate = () => {
    if (templates.length <= 1) return;
    const nextTemplates = templates.filter((template) => template.id !== selectedTemplate.id);
    setTemplates(nextTemplates);
    setSelectedTemplateId(nextTemplates[0]?.id ?? "");
    setSelectedElementId(nextTemplates[0]?.elements[0]?.id ?? "");
    setDirty(true);
  };

  const resetTemplate = () => {
    const reset = createDefaultTemplate(selectedTemplate.name);
    updateSelectedTemplate((template) => ({
      ...reset,
      id: template.id,
      name: template.name,
      description: template.description,
    }));
    setSelectedElementId("recipient-name");
  };

  const addTextElement = () => {
    const next: CertificateTextElement = {
      id: makeId("text"),
      type: "text",
      label: "Novo texto",
      text: "Novo texto",
      xPct: 0.38,
      yPct: 0.34,
      widthPct: 0.24,
      zIndex: Math.max(...selectedTemplate.elements.map((element) => element.zIndex), 0) + 1,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 24,
      fontWeight: 500,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 1.2,
    };
    updateSelectedTemplate((template) => ({
      ...template,
      elements: [...template.elements, next],
    }));
    setSelectedElementId(next.id);
  };

  const addRecipientVariable = () => {
    const next: CertificateTextElement = {
      id: makeId("variable"),
      type: "variable",
      label: "Nome completo do lote",
      text: RECIPIENT_SAMPLE,
      variableKey: RECIPIENT_VARIABLE_KEY,
      xPct: 0.22,
      yPct: 0.46,
      widthPct: 0.56,
      zIndex: Math.max(...selectedTemplate.elements.map((element) => element.zIndex), 0) + 1,
      visible: true,
      locked: false,
      opacity: 1,
      fontFamily: '"Sora", "Manrope", sans-serif',
      fontSizePx: 26,
      fontWeight: 800,
      fontStyle: "normal",
      colorHex: "#111111",
      textAlign: "center",
      lineHeight: 1.18,
    };
    updateSelectedTemplate((template) => ({
      ...template,
      elements: [...template.elements, next],
    }));
    setSelectedElementId(next.id);
  };

  const addImageElement = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    const next: CertificateImageElement = {
      id: makeId("image"),
      type: "image",
      label: file.name.replace(/\.[^.]+$/, "") || "Imagem",
      src,
      alt: file.name,
      xPct: 0.42,
      yPct: 0.42,
      widthPct: 0.16,
      zIndex: Math.max(...selectedTemplate.elements.map((element) => element.zIndex), 0) + 1,
      visible: true,
      locked: false,
      opacity: 1,
      mixBlendMode: "normal",
    };
    updateSelectedTemplate((template) => ({
      ...template,
      elements: [...template.elements, next],
    }));
    setSelectedElementId(next.id);
  };

  const replaceSelectedImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isImageElement(selectedElement)) return;
    const src = await readFileAsDataUrl(file);
    updateElement(selectedElement.id, {
      src,
      alt: file.name,
      label: selectedElement.label || file.name.replace(/\.[^.]+$/, ""),
    });
  };

  const removeSelectedElement = () => {
    if (!selectedElement) return;
    updateSelectedTemplate((template) => ({
      ...template,
      elements: template.elements.filter((element) => element.id !== selectedElement.id),
    }));
    setSelectedElementId("");
  };

  const duplicateSelectedElement = () => {
    if (!selectedElement) return;
    const next = {
      ...selectedElement,
      id: makeId(selectedElement.type),
      label: `${selectedElement.label} - cópia`,
      xPct: clamp(selectedElement.xPct + 0.03, 0.015, 0.92),
      yPct: clamp(selectedElement.yPct + 0.03, 0.015, 0.92),
      zIndex: Math.max(...selectedTemplate.elements.map((element) => element.zIndex), 0) + 1,
    } as CertificateElement;
    updateSelectedTemplate((template) => ({
      ...template,
      elements: [...template.elements, next],
    }));
    setSelectedElementId(next.id);
  };

  const nudgeSelectedElement = (deltaXPct: number, deltaYPct: number) => {
    if (!selectedElement || selectedElement.locked) return;
    updateElement(selectedElement.id, {
      xPct: clamp(selectedElement.xPct + deltaXPct, 0.015, 0.98),
      yPct: clamp(selectedElement.yPct + deltaYPct, 0.015, 0.98),
    });
  };

  const moveLayer = (direction: "front" | "back" | "up" | "down") => {
    if (!selectedElement) return;
    const zIndexes = selectedTemplate.elements.map((element) => element.zIndex);
    const max = Math.max(...zIndexes, selectedElement.zIndex);
    const min = Math.min(...zIndexes, selectedElement.zIndex);
    const nextZIndex =
      direction === "front"
        ? max + 1
        : direction === "back"
          ? min - 1
          : direction === "up"
            ? selectedElement.zIndex + 1
            : selectedElement.zIndex - 1;
    updateElement(selectedElement.id, { zIndex: nextZIndex });
  };

  const updateTextElement = (patch: Partial<CertificateTextElement>) => {
    if (!isTextElement(selectedElement)) return;
    updateElement(selectedElement.id, patch as Partial<CertificateElement>);
  };

  const updateImageElement = (patch: Partial<CertificateImageElement>) => {
    if (!isImageElement(selectedElement)) return;
    updateElement(selectedElement.id, patch as Partial<CertificateElement>);
  };

  const updateLineElement = (patch: Partial<CertificateLineElement>) => {
    if (!isLineElement(selectedElement)) return;
    updateElement(selectedElement.id, patch as Partial<CertificateElement>);
  };

  const renderElement = (element: CertificateElement) => {
    if (!element.visible) return null;
    const isSelected = element.id === selectedElementId;
    const commonStyle: CSSProperties = {
      left: `${element.xPct * 100}%`,
      top: `${element.yPct * 100}%`,
      width: `${element.widthPct * 100}%`,
      zIndex: element.zIndex,
      opacity: element.opacity,
    };

    return (
      <div
        key={element.id}
        ref={(node) => {
          elementRefs.current[element.id] = node;
        }}
        className={[
          "certificate-canvas-element",
          `certificate-canvas-element--${element.type}`,
          isSelected ? "is-selected" : "",
          element.locked ? "is-locked" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={commonStyle}
        onPointerDown={(event) => startDrag(event, element)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }
          setSelectedElementId(element.id);
        }}
      >
        {isTextElement(element) ? (
          <div
            className="certificate-canvas-text"
            style={{
              fontFamily: element.fontFamily,
              fontSize: `${element.fontSizePx * scale}px`,
              fontWeight: element.fontWeight,
              fontStyle: element.fontStyle,
              color: element.colorHex,
              textAlign: element.textAlign,
              lineHeight: element.lineHeight,
            }}
          >
            {element.text}
          </div>
        ) : null}

        {isImageElement(element) ? (
          <img
            className="certificate-canvas-image"
            src={element.src}
            alt={element.alt}
            draggable={false}
            style={{ mixBlendMode: element.mixBlendMode }}
          />
        ) : null}

        {isLineElement(element) ? (
          <span
            className="certificate-canvas-line"
            style={{
              height: `${Math.max(1, element.thicknessPx * scale)}px`,
              backgroundColor: element.colorHex,
            }}
          />
        ) : null}

        {isSelected ? (
          <button
            className="certificate-resize-handle"
            type="button"
            aria-label="Redimensionar item"
            onPointerDown={(event) => startResize(event, element)}
          />
        ) : null}
      </div>
    );
  };

  const selectedKindLabel = selectedElement
    ? selectedElement.type === "variable"
      ? "Campo variável"
      : selectedElement.type === "image"
        ? "Imagem"
        : selectedElement.type === "line"
          ? "Linha"
          : "Texto"
    : "Nenhum item";

  return (
    <main className="certificate-editor-page page-enter">
      <header className="certificate-editor-header">
        <div>
          <span className="certificate-page-kicker">Editor de certificado</span>
          <h1>Modelos dinâmicos de certificado</h1>
          <p>
            Monte o certificado em formato A4 paisagem, personalize textos e imagens,
            posicione o campo de nome completo para geração em lote e salve quantos
            modelos forem necessários.
          </p>
        </div>
        <button
          className="certificate-primary-button"
          type="button"
          onClick={saveTemplates}
          disabled={savingTemplate}
        >
          <SaveRoundedIcon fontSize="small" />
          {savingTemplate ? "Salvando..." : "Salvar modelo"}
        </button>
      </header>

      <section className="certificate-editor-shell">
        <aside className="certificate-sidebar certificate-sidebar--models">
          <div className="certificate-panel-title-row">
            <div>
              <span className="certificate-control-title">Modelos</span>
              <p className="certificate-panel-subtitle">
                {dirty ? "Alterações não salvas" : "Tudo salvo neste navegador"}
              </p>
            </div>
            <button className="certificate-icon-button" type="button" onClick={createTemplate}>
              <AddRoundedIcon fontSize="small" />
            </button>
          </div>

          <label className="certificate-field">
            <span>Nome do modelo</span>
            <input
              value={selectedTemplate.name}
              onChange={(event) =>
                updateSelectedTemplate((template) => ({
                  ...template,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <div className="certificate-template-actions">
            <button type="button" onClick={duplicateTemplate}>
              <ContentCopyRoundedIcon fontSize="small" />
              Duplicar
            </button>
            <button type="button" onClick={resetTemplate}>
              <RestartAltRoundedIcon fontSize="small" />
              Resetar
            </button>
            <button type="button" onClick={deleteTemplate} disabled={templates.length <= 1}>
              <DeleteOutlineRoundedIcon fontSize="small" />
              Excluir
            </button>
          </div>

          <div className="certificate-template-list">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`certificate-template-card${
                  template.id === selectedTemplate.id ? " is-active" : ""
                }`}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setSelectedElementId(template.elements[0]?.id ?? "");
                }}
              >
                <strong>{template.name || "Modelo sem nome"}</strong>
                <span>
                  {template.elements.length} itens ·{" "}
                  {new Date(template.updatedAt).toLocaleDateString("pt-BR")}
                </span>
              </button>
            ))}
          </div>

          <div className="certificate-variable-note">
            <span>Campo do lote</span>
            <strong>{"{{nome_completo}}"}</strong>
            <p>
              Esse item mostra exatamente onde o nome completo da pessoa será
              inserido quando o certificado for gerado em lote.
            </p>
          </div>
        </aside>

        <section className="certificate-canvas-workbench">
          <div className="certificate-toolbar">
            <button type="button" onClick={addTextElement}>
              <TextFieldsRoundedIcon fontSize="small" />
              Texto
            </button>
            <button type="button" onClick={addRecipientVariable}>
              <AddRoundedIcon fontSize="small" />
              Nome do lote
            </button>
            <label className="certificate-toolbar-upload">
              <AddPhotoAlternateRoundedIcon fontSize="small" />
              Imagem
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={addImageElement}
              />
            </label>
            <span className="certificate-toolbar-divider" />
            <button type="button" onClick={() => moveLayer("front")} disabled={!selectedElement}>
              Frente
            </button>
            <button type="button" onClick={() => moveLayer("back")} disabled={!selectedElement}>
              Fundo
            </button>
            <button type="button" onClick={duplicateSelectedElement} disabled={!selectedElement}>
              <ContentCopyRoundedIcon fontSize="small" />
            </button>
            <button type="button" onClick={removeSelectedElement} disabled={!selectedElement}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </button>
          </div>

          <div className="certificate-stage-shell">
            <div
              ref={canvasRef}
              className="certificate-editor-canvas"
              style={
                {
                  "--certificate-frame-color": selectedTemplate.frameColor,
                  "--certificate-background-color": selectedTemplate.backgroundColor,
                } as CSSProperties
              }
              onClick={() => setSelectedElementId("")}
            >
              <div className="certificate-editor-paper-texture" aria-hidden="true" />
              <div className="certificate-editor-frame" aria-hidden="true" />
              <span className="certificate-editor-corner certificate-editor-corner--tl" />
              <span className="certificate-editor-corner certificate-editor-corner--tr" />
              <span className="certificate-editor-corner certificate-editor-corner--bl" />
              <span className="certificate-editor-corner certificate-editor-corner--br" />

              {snapGuides.x ? (
                <span
                  className={`certificate-snap-guide certificate-snap-guide--x certificate-snap-guide--${snapGuides.x.kind}`}
                  style={{ left: `${snapGuides.x.valuePct * 100}%` }}
                />
              ) : null}
              {snapGuides.y ? (
                <span
                  className={`certificate-snap-guide certificate-snap-guide--y certificate-snap-guide--${snapGuides.y.kind}`}
                  style={{ top: `${snapGuides.y.valuePct * 100}%` }}
                />
              ) : null}

              <span className="certificate-page-center-guide certificate-page-center-guide--x" />
              <span className="certificate-page-center-guide certificate-page-center-guide--y" />

              {selectedTemplate.elements
                .slice()
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(renderElement)}
            </div>
          </div>

          <div className="certificate-element-strip">
            {selectedTemplate.elements.map((element) => (
              <button
                key={element.id}
                type="button"
                className={element.id === selectedElementId ? "is-active" : ""}
                onClick={() => setSelectedElementId(element.id)}
              >
                {element.visible ? (
                  <VisibilityRoundedIcon fontSize="small" />
                ) : (
                  <VisibilityOffRoundedIcon fontSize="small" />
                )}
                {element.label}
              </button>
            ))}
          </div>
        </section>

        <aside className="certificate-sidebar certificate-sidebar--properties">
          <div className="certificate-panel-title-row">
            <div>
              <span className="certificate-control-title">Propriedades</span>
              <p className="certificate-panel-subtitle">{selectedKindLabel}</p>
            </div>
            {selectedElement ? (
              <button
                className="certificate-icon-button"
                type="button"
                onClick={() =>
                  updateElement(selectedElement.id, { locked: !selectedElement.locked })
                }
              >
                {selectedElement.locked ? (
                  <LockRoundedIcon fontSize="small" />
                ) : (
                  <LockOpenRoundedIcon fontSize="small" />
                )}
              </button>
            ) : null}
          </div>

          {!selectedElement ? (
            <div className="certificate-empty-properties">
              Selecione um texto, imagem ou linha no certificado para editar.
            </div>
          ) : (
            <>
              <label className="certificate-field">
                <span>Nome do item</span>
                <input
                  value={selectedElement.label}
                  onChange={(event) =>
                    updateElement(selectedElement.id, { label: event.target.value })
                  }
                />
              </label>

              <div className="certificate-property-grid">
                <label className="certificate-field">
                  <span>X</span>
                  <input
                    type="number"
                    value={Math.round(selectedElement.xPct * 1000) / 10}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        xPct: clamp(Number(event.target.value) / 100, 0.015, 0.98),
                      })
                    }
                  />
                </label>
                <label className="certificate-field">
                  <span>Y</span>
                  <input
                    type="number"
                    value={Math.round(selectedElement.yPct * 1000) / 10}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        yPct: clamp(Number(event.target.value) / 100, 0.015, 0.98),
                      })
                    }
                  />
                </label>
                <label className="certificate-field">
                  <span>Largura</span>
                  <input
                    type="number"
                    value={Math.round(selectedElement.widthPct * 1000) / 10}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        widthPct: clamp(Number(event.target.value) / 100, 0.035, 0.9),
                      })
                    }
                  />
                </label>
                <label className="certificate-field">
                  <span>Opacidade</span>
                  <input
                    type="number"
                    value={Math.round(selectedElement.opacity * 100)}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        opacity: clamp(Number(event.target.value) / 100, 0, 1),
                      })
                    }
                  />
                </label>
              </div>

              <div className="certificate-toggle-row">
                <button
                  type="button"
                  className={selectedElement.visible ? "is-active" : ""}
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      visible: !selectedElement.visible,
                    })
                  }
                >
                  {selectedElement.visible ? (
                    <VisibilityRoundedIcon fontSize="small" />
                  ) : (
                    <VisibilityOffRoundedIcon fontSize="small" />
                  )}
                  Visível
                </button>
                <button
                  type="button"
                  className={selectedElement.locked ? "is-active" : ""}
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      locked: !selectedElement.locked,
                    })
                  }
                >
                  {selectedElement.locked ? (
                    <LockRoundedIcon fontSize="small" />
                  ) : (
                    <LockOpenRoundedIcon fontSize="small" />
                  )}
                  Bloqueado
                </button>
              </div>

              <div className="certificate-nudge-row">
                <button type="button" onClick={() => nudgeSelectedElement(-0.005, 0)}>
                  ←
                </button>
                <button type="button" onClick={() => nudgeSelectedElement(0, -0.005)}>
                  ↑
                </button>
                <button type="button" onClick={() => nudgeSelectedElement(0, 0.005)}>
                  ↓
                </button>
                <button type="button" onClick={() => nudgeSelectedElement(0.005, 0)}>
                  →
                </button>
              </div>

              <div className="certificate-layer-row">
                <button type="button" onClick={() => moveLayer("up")}>
                  <LayersRoundedIcon fontSize="small" />
                  Subir
                </button>
                <button type="button" onClick={() => moveLayer("down")}>
                  <LayersRoundedIcon fontSize="small" />
                  Descer
                </button>
              </div>

              {isTextElement(selectedElement) ? (
                <section className="certificate-property-section">
                  <span className="certificate-control-title">Texto</span>
                  <label className="certificate-field">
                    <span>
                      {selectedElement.type === "variable"
                        ? "Texto de exemplo"
                        : "Conteúdo"}
                    </span>
                    <textarea
                      value={selectedElement.text}
                      onChange={(event) =>
                        updateTextElement({ text: event.target.value })
                      }
                    />
                  </label>
                  {selectedElement.type === "variable" ? (
                    <p className="certificate-helper-text">
                      Variável vinculada a <strong>{"{{nome_completo}}"}</strong>.
                      Na geração em lote, o exemplo será substituído pelo nome real.
                    </p>
                  ) : null}

                  <label className="certificate-field">
                    <span>Fonte</span>
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(event) =>
                        updateTextElement({ fontFamily: event.target.value })
                      }
                    >
                      {fontOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="certificate-font-row">
                    <button
                      type="button"
                      onClick={() =>
                        updateTextElement({
                          fontSizePx: clamp(selectedElement.fontSizePx - 1, 8, 160),
                        })
                      }
                    >
                      <RemoveRoundedIcon fontSize="small" />
                    </button>
                    <label className="certificate-field">
                      <span>Tamanho</span>
                      <input
                        type="number"
                        min={8}
                        max={160}
                        value={selectedElement.fontSizePx}
                        onChange={(event) =>
                          updateTextElement({
                            fontSizePx: clamp(Number(event.target.value), 8, 160),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateTextElement({
                          fontSizePx: clamp(selectedElement.fontSizePx + 1, 8, 160),
                        })
                      }
                    >
                      <AddRoundedIcon fontSize="small" />
                    </button>
                  </div>

                  <div className="certificate-toggle-row">
                    <button
                      type="button"
                      className={selectedElement.fontWeight >= 700 ? "is-active" : ""}
                      onClick={() =>
                        updateTextElement({
                          fontWeight: selectedElement.fontWeight >= 700 ? 400 : 800,
                        })
                      }
                    >
                      <FormatBoldRoundedIcon fontSize="small" />
                      Negrito
                    </button>
                    <button
                      type="button"
                      className={selectedElement.fontStyle === "italic" ? "is-active" : ""}
                      onClick={() =>
                        updateTextElement({
                          fontStyle:
                            selectedElement.fontStyle === "italic" ? "normal" : "italic",
                        })
                      }
                    >
                      <FormatItalicRoundedIcon fontSize="small" />
                      Itálico
                    </button>
                  </div>

                  <div className="certificate-align-row">
                    {[
                      ["left", <FormatAlignLeftRoundedIcon fontSize="small" />],
                      ["center", <FormatAlignCenterRoundedIcon fontSize="small" />],
                      ["right", <FormatAlignRightRoundedIcon fontSize="small" />],
                    ].map(([align, icon]) => (
                      <button
                        key={align as string}
                        type="button"
                        className={
                          selectedElement.textAlign === align ? "is-active" : ""
                        }
                        onClick={() =>
                          updateTextElement({ textAlign: align as TextAlign })
                        }
                      >
                        {icon}
                      </button>
                    ))}
                  </div>

                  <label className="certificate-field">
                    <span>Cor</span>
                    <div className="certificate-color-input-row">
                      <input
                        type="color"
                        value={normalizeHexColorInput(selectedElement.colorHex) ?? "#111111"}
                        onChange={(event) =>
                          updateTextElement({
                            colorHex:
                              normalizeHexColorInput(event.target.value) ?? "#111111",
                          })
                        }
                      />
                      <input
                        value={selectedElement.colorHex}
                        onChange={(event) => {
                          const normalized = normalizeHexColorInput(event.target.value);
                          updateTextElement({
                            colorHex: normalized ?? selectedElement.colorHex,
                          });
                        }}
                      />
                    </div>
                  </label>
                  <div className="certificate-color-palette">
                    {colorPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        style={{ backgroundColor: color }}
                        className={
                          selectedElement.colorHex.toUpperCase() === color ? "is-active" : ""
                        }
                        onClick={() => updateTextElement({ colorHex: color })}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {isImageElement(selectedElement) ? (
                <section className="certificate-property-section">
                  <span className="certificate-control-title">Imagem</span>
                  <label className="certificate-upload-button">
                    <UploadFileRoundedIcon fontSize="small" />
                    Trocar imagem
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={replaceSelectedImage}
                    />
                  </label>
                  <label className="certificate-field">
                    <span>Mesclagem</span>
                    <select
                      value={selectedElement.mixBlendMode}
                      onChange={(event) =>
                        updateImageElement({
                          mixBlendMode: event.target.value as "normal" | "multiply",
                        })
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiplicar</option>
                    </select>
                  </label>
                </section>
              ) : null}

              {isLineElement(selectedElement) ? (
                <section className="certificate-property-section">
                  <span className="certificate-control-title">Linha</span>
                  <label className="certificate-field">
                    <span>Espessura</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={selectedElement.thicknessPx}
                      onChange={(event) =>
                        updateLineElement({
                          thicknessPx: clamp(Number(event.target.value), 1, 12),
                        })
                      }
                    />
                  </label>
                  <label className="certificate-field">
                    <span>Cor</span>
                    <input
                      type="color"
                      value={selectedElement.colorHex}
                      onChange={(event) =>
                        updateLineElement({
                          colorHex:
                            normalizeHexColorInput(event.target.value) ?? "#111111",
                        })
                      }
                    />
                  </label>
                </section>
              ) : null}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
