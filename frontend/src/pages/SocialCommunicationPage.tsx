import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import NewspaperRoundedIcon from "@mui/icons-material/NewspaperRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { parseApiError } from "../app/apiErrors";
import { api } from "../api/client";
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from "../app/roleAccess";
import { useToast } from "../app/toast";
import {
  useCreateSocialCommunicationHighlight,
  useCreateSocialCommunicationArticle,
  useDeleteSocialCommunicationHighlight,
  useDeleteSocialCommunicationArticle,
  useLookupSocialCommunicationHighlightLdap,
  useMe,
  useLocalities,
  useResolveSocialCommunicationMetadata,
  useSocialCommunicationHighlights,
  useSocialCommunication,
  useUpdateSocialCommunicationHighlight,
  useUploadSocialCommunicationCover,
  useUpdateSocialCommunicationArticle,
} from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";

type SocialCommunicationArticle = {
  id: string;
  sourceUrl: string;
  title: string;
  coverImageUrl?: string | null;
  coverProxyPath?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  contentProxyPath?: string | null;
  tags?: string[];
  audience?: 'INTERNAL' | 'EXTERNAL';
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
};

type SocialCommunicationHighlight = {
  id: string;
  ldapUid?: string | null;
  militaryEmail: string;
  militaryName: string;
  highlightRole?: string | null;
  fabom?: string | null;
  photoMimeType?: string | null;
  photoBase64?: string | null;
  impact: "MULTIPLICADOR" | "SIMBOLICO";
  locality: { id: string; code: string; name: string };
  text: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
};

function toDisplayDate(value?: string | null) {
  const isoDate = toInputDate(value);
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  const raw = String(value).trim();
  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function toApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = String(api.defaults.baseURL ?? "/api");
  if (/^https?:\/\//i.test(baseUrl)) {
    return `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
  }
  const normalizedBase = `/${baseUrl.replace(/^\/+/, "").replace(/\/$/, "")}`;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeTags(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const clean = String(value ?? "").trim().toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
    if (normalized.length >= 30) break;
  }
  return normalized;
}

const QUICK_TAGS = ["smif", "cipavd", "cpca"] as const;
const HIGHLIGHT_IMPACT_OPTIONS = [
  { value: "MULTIPLICADOR" as const, label: "Multiplicador" },
  { value: "SIMBOLICO" as const, label: "Simbólico" },
];

function normalizeEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSigpesNumeroOrdem(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d+[.,]\d+$/.test(raw)) {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
      return String(parsed);
    }
  }

  const trailingZeroSuffix = raw.match(/^(\d+)[-\s]0+$/);
  if (trailingZeroSuffix) {
    return trailingZeroSuffix[1];
  }

  const onlyDigits = raw.replace(/\D/g, "");
  return onlyDigits || raw;
}

function normalizeHighlightPhotoBase64(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function buildHighlightPhotoDataUrl(
  photoBase64?: string | null,
  photoMimeType?: string | null,
) {
  const normalizedBase64 = normalizeHighlightPhotoBase64(photoBase64);
  if (!normalizedBase64) return "";
  const mimeType = String(photoMimeType ?? "").trim() || "image/jpeg";
  return `data:${mimeType};base64,${normalizedBase64}`;
}

function ArticleCoverImage({
  coverProxyPath,
  coverImageUrl,
  title,
  toApiUrl,
}: {
  coverProxyPath?: string | null;
  coverImageUrl?: string | null;
  title: string;
  toApiUrl: (path: string) => string;
}) {
  const [imageError, setImageError] = useState(false);
  const proxySrc = coverProxyPath ? toApiUrl(coverProxyPath) : null;
  const directSrc = coverImageUrl
    ? /^https?:\/\//i.test(coverImageUrl)
      ? coverImageUrl
      : toApiUrl(coverImageUrl)
    : null;
  const [imageSrc, setImageSrc] = useState<string | null>(
    proxySrc || directSrc
  );

  // Reset state when props change
  useEffect(() => {
    setImageError(false);
    setImageSrc(proxySrc || directSrc);
  }, [coverProxyPath, coverImageUrl]);

  if (!coverProxyPath && !coverImageUrl) {
    return <NewspaperRoundedIcon sx={{ color: "white", fontSize: 38 }} />;
  }

  if (imageError || !imageSrc) {
    return <NewspaperRoundedIcon sx={{ color: "white", fontSize: 38 }} />;
  }

  return (
    <Box
      component="img"
      src={imageSrc}
      alt={title}
      referrerPolicy="no-referrer"
      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={() => {
        if (directSrc && proxySrc && imageSrc === proxySrc) {
          // Tenta URL direta apenas se o proxy falhar.
          setImageSrc(directSrc);
          setImageError(false);
          return;
        }
        setImageError(true);
      }}
      onLoad={() => {
        setImageError(false);
      }}
    />
  );
}

function ArticleCoverImageSmall({
  coverProxyPath,
  coverImageUrl,
  title,
  toApiUrl,
}: {
  coverProxyPath?: string | null;
  coverImageUrl?: string | null;
  title: string;
  toApiUrl: (path: string) => string;
}) {
  const [imageError, setImageError] = useState(false);
  const proxySrc = coverProxyPath ? toApiUrl(coverProxyPath) : null;
  const directSrc = coverImageUrl
    ? /^https?:\/\//i.test(coverImageUrl)
      ? coverImageUrl
      : toApiUrl(coverImageUrl)
    : null;
  const [imageSrc, setImageSrc] = useState<string | null>(
    proxySrc || directSrc
  );

  // Reset state when props change
  useEffect(() => {
    setImageError(false);
    setImageSrc(proxySrc || directSrc);
  }, [coverProxyPath, coverImageUrl]);

  if (!coverProxyPath && !coverImageUrl) {
    return <NewspaperRoundedIcon sx={{ color: "#114259", fontSize: 32 }} />;
  }

  if (imageError || !imageSrc) {
    return <NewspaperRoundedIcon sx={{ color: "#114259", fontSize: 32 }} />;
  }

  return (
    <Box
      component="img"
      src={imageSrc}
      alt={title}
      referrerPolicy="no-referrer"
      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={() => {
        if (directSrc && proxySrc && imageSrc === proxySrc) {
          // Tenta URL direta apenas se o proxy falhar.
          setImageSrc(directSrc);
          setImageError(false);
          return;
        }
        setImageError(true);
      }}
      onLoad={() => {
        setImageError(false);
      }}
    />
  );
}

export function SocialCommunicationPage() {
  const toast = useToast();
  const { data: me } = useMe();

  const canEdit = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
    ROLE_TI,
  ]);
  const canEditHighlights = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]);

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const filters = useMemo(() => ({ q: search.trim() || undefined }), [search]);

  const query = useSocialCommunication(filters);
  const highlightsQuery = useSocialCommunicationHighlights(filters);
  const omsCatalogQuery = useLocalities();
  const createArticle = useCreateSocialCommunicationArticle();
  const updateArticle = useUpdateSocialCommunicationArticle();
  const deleteArticle = useDeleteSocialCommunicationArticle();
  const createHighlight = useCreateSocialCommunicationHighlight();
  const updateHighlight = useUpdateSocialCommunicationHighlight();
  const deleteHighlight = useDeleteSocialCommunicationHighlight();
  const lookupHighlightLdap = useLookupSocialCommunicationHighlightLdap();
  const resolveMetadata = useResolveSocialCommunicationMetadata();
  const uploadCover = useUploadSocialCommunicationCover();
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SocialCommunicationArticle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SocialCommunicationArticle | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [form, setForm] = useState({
    url: "",
    title: "",
    coverImageUrl: "",
    summary: "",
    publishedAt: "",
    tags: [] as string[],
    audience: "INTERNAL" as "INTERNAL" | "EXTERNAL",
  });
  const [highlightEditorOpen, setHighlightEditorOpen] = useState(false);
  const [highlightEditing, setHighlightEditing] =
    useState<SocialCommunicationHighlight | null>(null);
  const [highlightDeleteTarget, setHighlightDeleteTarget] =
    useState<SocialCommunicationHighlight | null>(null);
  const [highlightReadingTarget, setHighlightReadingTarget] =
    useState<SocialCommunicationHighlight | null>(null);
  const [highlightForm, setHighlightForm] = useState({
    ldapEmail: "",
    ldapUid: "",
    militaryName: "",
    highlightRole: "",
    fabom: "",
    numeroOrdem: "",
    photoMimeType: "",
    photoBase64: "",
    impact: "MULTIPLICADOR" as "MULTIPLICADOR" | "SIMBOLICO",
    localityId: "",
    text: "",
  });
  const [highlightLookupBusy, setHighlightLookupBusy] = useState(false);
  const highlightMultiplicadorCarouselRef = useRef<HTMLDivElement | null>(null);
  const highlightSimbolicoCarouselRef = useRef<HTMLDivElement | null>(null);
  const internalCarouselRef = useRef<HTMLDivElement | null>(null);
  const externalCarouselRef = useRef<HTMLDivElement | null>(null);
  const highlightPhotoPreviewUrl = useMemo(
    () =>
      buildHighlightPhotoDataUrl(
        highlightForm.photoBase64,
        highlightForm.photoMimeType,
      ),
    [highlightForm.photoBase64, highlightForm.photoMimeType],
  );

  const openPreview = (item: SocialCommunicationArticle) => {
    const url =
      item.sourceUrl?.trim() ||
      (item.contentProxyPath ? toApiUrl(item.contentProxyPath) : "");
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openCreate = () => {
    setEditing(null);
    setResolvedUrl("");
    setForm({
      url: "",
      title: "",
      coverImageUrl: "",
      summary: "",
      publishedAt: "",
      tags: [],
      audience: "INTERNAL",
    });
    setEditorOpen(true);
  };

  const openEdit = (item: SocialCommunicationArticle) => {
    setEditing(item);
    setResolvedUrl(item.sourceUrl);
    setForm({
      url: item.sourceUrl,
      title: item.title ?? "",
      coverImageUrl: item.coverImageUrl ?? "",
      summary: item.summary ?? "",
      publishedAt: toInputDate(item.publishedAt),
      tags: normalizeTags(item.tags ?? []),
      audience: item.audience ?? "INTERNAL",
    });
    setEditorOpen(true);
  };

  const omOptions = useMemo(
    () => {
      const mapped = ((omsCatalogQuery.data?.items ?? []) as Array<any>)
        .map((item) => ({
          id: String(item?.id ?? "").trim(),
          code: String(item?.code ?? "").trim(),
          name: String(item?.name ?? "").trim(),
        }))
        .filter((item) => item.id && item.code && item.name);
      const uniqueById = new Map<string, { id: string; code: string; name: string }>();
      mapped.forEach((item) => {
        if (!uniqueById.has(item.id)) uniqueById.set(item.id, item);
      });
      return [...uniqueById.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );
    },
    [omsCatalogQuery.data?.items],
  );

  const openCreateHighlight = () => {
    setHighlightEditing(null);
    setHighlightForm({
      ldapEmail: "",
      ldapUid: "",
      militaryName: "",
      highlightRole: "",
      fabom: "",
      numeroOrdem: "",
      photoMimeType: "",
      photoBase64: "",
      impact: "MULTIPLICADOR",
      localityId: "",
      text: "",
    });
    setHighlightEditorOpen(true);
  };

  const openEditHighlight = (item: SocialCommunicationHighlight) => {
    setHighlightEditing(item);
    setHighlightForm({
      ldapEmail: normalizeEmail(item.militaryEmail),
      ldapUid: String(item.ldapUid ?? "").trim(),
      militaryName: String(item.militaryName ?? "").trim(),
      highlightRole: String(item.highlightRole ?? "").trim(),
      fabom: String(item.fabom ?? "").trim(),
      numeroOrdem: "",
      photoMimeType: String(item.photoMimeType ?? "").trim(),
      photoBase64: normalizeHighlightPhotoBase64(item.photoBase64),
      impact: item.impact,
      localityId: String(item.locality?.id ?? "").trim(),
      text: String(item.text ?? "").trim(),
    });
    setHighlightEditorOpen(true);
  };

  const handleLookupHighlightLdap = async () => {
    const email = normalizeEmail(highlightForm.ldapEmail);
    if (!email) {
      toast.push({ message: "Informe o e-mail Zimbra para buscar", severity: "warning" });
      return;
    }
    setHighlightLookupBusy(true);
    try {
      const profile = await lookupHighlightLdap.mutateAsync(email);
      const numeroOrdem = normalizeSigpesNumeroOrdem(profile?.numeroOrdem);
      let photoBase64 = "";
      let photoMimeType = "";

      if (numeroOrdem) {
        try {
          const photoResponse = (
            await api.get(`/auth/fotoes/${encodeURIComponent(numeroOrdem)}`)
          ).data;
          photoBase64 = normalizeHighlightPhotoBase64(photoResponse?.base64);
          photoMimeType = photoBase64
            ? String(photoResponse?.mimeType ?? "").trim() || "image/jpeg"
            : "";
        } catch {
          photoBase64 = "";
          photoMimeType = "";
        }
      }

      setHighlightForm((prev) => {
        const fabom = String(profile?.fabom ?? "").trim();
        const matchedOm = fabom
          ? omOptions.find(
              (item) => item.code.toLowerCase() === fabom.toLowerCase(),
            )
          : undefined;
        return {
          ...prev,
          ldapEmail: normalizeEmail(profile?.email ?? email),
          ldapUid: String(profile?.uid ?? "").trim(),
          militaryName: String(profile?.name ?? "").trim(),
          fabom,
          numeroOrdem,
          photoBase64,
          photoMimeType,
          localityId: prev.localityId || matchedOm?.id || "",
        };
      });
      toast.push({
        message: photoBase64
          ? "Dados LDAP e foto carregados com sucesso"
          : "Dados LDAP carregados (foto indisponivel)",
        severity: photoBase64 ? "success" : "warning",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Nao foi possivel buscar o militar no LDAP",
        severity: "error",
      });
    } finally {
      setHighlightLookupBusy(false);
    }
  };

  const handleSaveHighlight = async () => {
    const normalizedPhotoBase64 = normalizeHighlightPhotoBase64(
      highlightForm.photoBase64,
    );
    const payload = {
      ldapUid: highlightForm.ldapUid.trim() || null,
      militaryEmail: normalizeEmail(highlightForm.ldapEmail),
      militaryName: highlightForm.militaryName.trim(),
      highlightRole: highlightForm.highlightRole.trim() || null,
      fabom: highlightForm.fabom.trim() || null,
      photoMimeType: normalizedPhotoBase64
        ? highlightForm.photoMimeType.trim() || "image/jpeg"
        : null,
      photoBase64: normalizedPhotoBase64 || null,
      impact: highlightForm.impact,
      localityId: highlightForm.localityId,
      text: highlightForm.text.trim(),
    };

    if (!payload.militaryEmail || !payload.militaryName || !payload.localityId || !payload.text) {
      toast.push({
        message: "Preencha e-mail Zimbra, nome, impacto, OM e texto do destaque",
        severity: "warning",
      });
      return;
    }

    try {
      if (highlightEditing) {
        await updateHighlight.mutateAsync({ id: highlightEditing.id, payload });
        toast.push({ message: "Destaque atualizado", severity: "success" });
      } else {
        await createHighlight.mutateAsync(payload);
        toast.push({ message: "Destaque criado", severity: "success" });
      }
      setHighlightEditorOpen(false);
      setHighlightEditing(null);
    } catch (error) {
      const response = parseApiError(error);
      toast.push({
        message: response.message ?? "Erro ao salvar destaque",
        severity: "error",
      });
    }
  };

  const handleConfirmHighlightDelete = async () => {
    if (!highlightDeleteTarget) return;
    try {
      await deleteHighlight.mutateAsync(highlightDeleteTarget.id);
      setHighlightDeleteTarget(null);
      toast.push({ message: "Destaque removido", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao remover destaque",
        severity: "error",
      });
    }
  };

  const applyMetadata = async (force = false) => {
    const url = form.url.trim();
    if (!url) return;
    if (!force && resolvedUrl === url) return;

    try {
      const metadata = await resolveMetadata.mutateAsync(url);
      setResolvedUrl(metadata.url ?? url);
      setForm((prev) => ({
        ...prev,
        url: metadata.url ?? prev.url,
        title: prev.title.trim() || metadata.title || "",
        coverImageUrl: prev.coverImageUrl.trim() || metadata.coverImageUrl || "",
        summary: prev.summary.trim() || metadata.summary || "",
        publishedAt: prev.publishedAt || toInputDate(metadata.publishedAt),
      }));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Nao foi possivel ler dados do link",
        severity: "error",
      });
    }
  };

  const handleUploadCoverFile = async (file: File | null) => {
    if (!file) return;
    try {
      const response = await uploadCover.mutateAsync(file);
      if (!response.coverImageUrl) {
        toast.push({ message: "Nao foi possivel enviar a imagem", severity: "error" });
        return;
      }
      setForm((prev) => ({ ...prev, coverImageUrl: response.coverImageUrl ?? "" }));
      toast.push({ message: "Capa enviada com sucesso", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao enviar capa",
        severity: "error",
      });
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        url: form.url.trim(),
        title: form.title.trim() || undefined,
        coverImageUrl: form.coverImageUrl.trim() || null,
        summary: form.summary.trim() || null,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        tags: normalizeTags(form.tags),
        audience: form.audience,
      };

      if (editing) {
        await updateArticle.mutateAsync({ id: editing.id, payload });
        toast.push({ message: "Materia atualizada", severity: "success" });
      } else {
        await createArticle.mutateAsync(payload);
        toast.push({ message: "Materia publicada", severity: "success" });
      }
      setEditorOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao salvar materia",
        severity: "error",
      });
    }
  };

  const handleDelete = (item: SocialCommunicationArticle) => {
    setDeleteTarget(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteArticle.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      toast.push({ message: "Materia removida", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao remover materia",
        severity: "error",
      });
    }
  };

  const items = [...((query.data?.items ?? []) as SocialCommunicationArticle[])].sort((a, b) => {
    const leftTimestamp = Date.parse(a.publishedAt ?? a.createdAt);
    const rightTimestamp = Date.parse(b.publishedAt ?? b.createdAt);
    const left = Number.isNaN(leftTimestamp) ? 0 : leftTimestamp;
    const right = Number.isNaN(rightTimestamp) ? 0 : rightTimestamp;
    return right - left;
  });
  const allTags = Array.from(
    new Set(items.flatMap((item) => normalizeTags(item.tags ?? []))),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const activeTags = normalizeTags(selectedTags);
  const filteredByTags = activeTags.length
    ? items.filter((item) => {
        const itemTags = normalizeTags(item.tags ?? []);
        return activeTags.some((tag) => itemTags.includes(tag));
      })
    : items;

  const highlightItems = [
    ...((highlightsQuery.data?.items ?? []) as SocialCommunicationHighlight[]),
  ].sort((a, b) => {
    const left = Date.parse(a.updatedAt ?? a.createdAt);
    const right = Date.parse(b.updatedAt ?? b.createdAt);
    return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
  });
  const multiplicadorHighlights = highlightItems.filter(
    (item) => item.impact === "MULTIPLICADOR",
  );
  const simbolicoHighlights = highlightItems.filter(
    (item) => item.impact === "SIMBOLICO",
  );

  const internalItems = filteredByTags.filter((item) => (item.audience ?? 'INTERNAL') === 'INTERNAL');
  const externalItems = filteredByTags.filter((item) => (item.audience ?? 'INTERNAL') === 'EXTERNAL');

  const scrollCarouselByCard = useCallback(
    (carouselRef: RefObject<HTMLDivElement | null>, direction: 1 | -1) => {
      const container = carouselRef.current;
      if (!container) return;

      const firstCard = container.querySelector<HTMLElement>("[data-carousel-card='true']");
      const step = firstCard
        ? firstCard.getBoundingClientRect().width + 16
        : container.clientWidth * 0.9;
      const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
      const atStart = container.scrollLeft <= 4;
      const atEnd = container.scrollLeft >= maxScroll - 4;

      if (direction === 1) {
        if (atEnd) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          container.scrollBy({ left: step, behavior: "smooth" });
        }
        return;
      }

      if (atStart) {
        container.scrollTo({ left: maxScroll, behavior: "smooth" });
      } else {
        container.scrollBy({ left: -step, behavior: "smooth" });
      }
    },
    [],
  );

  useEffect(() => {
    const carouselRefs = [
      highlightMultiplicadorCarouselRef,
      highlightSimbolicoCarouselRef,
      internalCarouselRef,
      externalCarouselRef,
    ];
    const intervalIds = carouselRefs
      .map((carouselRef) => {
        const container = carouselRef.current;
        if (!container) return null;
        if (container.scrollWidth <= container.clientWidth + 8) return null;
        return window.setInterval(() => {
          scrollCarouselByCard(carouselRef, 1);
        }, 6500);
      })
      .filter((value): value is number => value !== null);

    return () => {
      intervalIds.forEach((id) => window.clearInterval(id));
    };
  }, [
    externalItems.length,
    internalItems.length,
    multiplicadorHighlights.length,
    simbolicoHighlights.length,
    scrollCarouselByCard,
  ]);

  const renderTags = (tags: string[], limit = 4) => {
    if (!tags.length) return null;
    const visible = tags.slice(0, limit);
    const remaining = tags.length - visible.length;
    return (
      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
        {visible.map((tag) => (
          <Chip key={tag} label={`#${tag}`} size="small" variant="outlined" />
        ))}
        {remaining > 0 && <Chip label={`+${remaining}`} size="small" />}
      </Stack>
    );
  };

  const renderHighlightCarousel = (
    carouselItems: SocialCommunicationHighlight[],
    impact: "MULTIPLICADOR" | "SIMBOLICO",
  ) => {
    const carouselRef =
      impact === "MULTIPLICADOR"
        ? highlightMultiplicadorCarouselRef
        : highlightSimbolicoCarouselRef;
    const impactLabel =
      impact === "MULTIPLICADOR" ? "Impacto Multiplicador" : "Impacto Simbólico";
    const theme =
      impact === "MULTIPLICADOR"
        ? {
            accent: "#2B78B8",
            accentSoft: "rgba(43, 120, 184, 0.14)",
            buttonBg: "rgba(43, 120, 184, 0.14)",
            buttonHoverBg: "rgba(43, 120, 184, 0.22)",
            trackBg: "rgba(43, 120, 184, 0.12)",
            thumbBg: "rgba(43, 120, 184, 0.28)",
            cardBorder: "rgba(17, 66, 89, 0.16)",
            avatarBg: "#E8F4FC",
            avatarBorder: "rgba(43, 120, 184, 0.44)",
            avatarColor: "#0E4F7D",
            titleColor: "#1D4562",
            textColor: "#4E6678",
            cardBackground:
              "linear-gradient(155deg, rgba(223,238,248,0.96) 0%, rgba(255,255,255,0.95) 56%, rgba(205,228,243,0.92) 100%)",
            chipBorder: "rgba(43, 120, 184, 0.34)",
            chipColor: "#245A84",
            impactChipBg: "rgba(43, 120, 184, 0.16)",
            impactChipColor: "#0E4F7D",
            actionButtonBg: "rgba(255,255,255,0.92)",
            hoverShadow: "0 14px 24px rgba(17, 66, 89, 0.16)",
          }
        : {
            accent: "#2E8B57",
            accentSoft: "rgba(46, 139, 87, 0.14)",
            buttonBg: "rgba(46, 139, 87, 0.14)",
            buttonHoverBg: "rgba(46, 139, 87, 0.24)",
            trackBg: "rgba(46, 139, 87, 0.12)",
            thumbBg: "rgba(46, 139, 87, 0.28)",
            cardBorder: "rgba(17, 66, 89, 0.16)",
            avatarBg: "#EAF8F1",
            avatarBorder: "rgba(46, 139, 87, 0.44)",
            avatarColor: "#206346",
            titleColor: "#245C43",
            textColor: "#4A6A5B",
            cardBackground:
              "linear-gradient(155deg, rgba(227,247,236,0.96) 0%, rgba(255,255,255,0.95) 56%, rgba(205,237,220,0.92) 100%)",
            chipBorder: "rgba(46, 139, 87, 0.34)",
            chipColor: "#2A654B",
            impactChipBg: "rgba(46, 139, 87, 0.16)",
            impactChipColor: "#206346",
            actionButtonBg: "rgba(255,255,255,0.92)",
            hoverShadow: "0 14px 24px rgba(17, 66, 89, 0.16)",
          };

    return (
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="flex-end" spacing={0.7}>
          <IconButton
            size="small"
            onClick={() => scrollCarouselByCard(carouselRef, -1)}
            sx={{ bgcolor: theme.buttonBg, "&:hover": { bgcolor: theme.buttonHoverBg } }}
            aria-label={`Voltar carrossel de ${impactLabel}`}
          >
            <ArrowBackIosNewRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scrollCarouselByCard(carouselRef, 1)}
            sx={{ bgcolor: theme.buttonBg, "&:hover": { bgcolor: theme.buttonHoverBg } }}
            aria-label={`Avançar carrossel de ${impactLabel}`}
          >
            <ArrowForwardIosRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box
          ref={carouselRef}
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            scrollBehavior: "smooth",
            scrollSnapType: "x mandatory",
            pb: 0.5,
            px: 0.2,
            "&::-webkit-scrollbar": {
              height: 8,
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: theme.trackBg,
              borderRadius: 999,
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: theme.thumbBg,
              borderRadius: 999,
            },
          }}
        >
          {carouselItems.map((item) => {
            const photoDataUrl = buildHighlightPhotoDataUrl(
              item.photoBase64,
              item.photoMimeType,
            );
            const initials = item.militaryName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("");
            return (
              <Card
                key={item.id}
                data-carousel-card="true"
                sx={{
                  flex: "0 0 auto",
                  width: {
                    xs: "calc(100% - 2px)",
                    sm: "calc((100% - 16px) / 2)",
                    md: "calc((100% - 32px) / 3)",
                    lg: "calc((100% - 48px) / 4)",
                  },
                  scrollSnapAlign: "start",
                  borderRadius: 3,
                  border: `1px solid ${theme.cardBorder}`,
                  background: theme.cardBackground,
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 160ms ease, box-shadow 160ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: theme.hoverShadow,
                  },
                }}
              >
                <CardContent
                  sx={{
                    minHeight: 250,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.1,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      pt: 0.6,
                    }}
                  >
                    <Box
                      sx={{
                        width: 74,
                        height: 74,
                        borderRadius: "50%",
                        bgcolor: theme.avatarBg,
                        border: `2px solid ${theme.avatarBorder}`,
                        color: theme.avatarColor,
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                        fontWeight: 800,
                        fontSize: 20,
                      }}
                    >
                      {photoDataUrl ? (
                        <Box
                          component="img"
                          src={photoDataUrl}
                          alt={item.militaryName}
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        initials || <PersonRoundedIcon fontSize="small" />
                      )}
                    </Box>
                  </Box>
                  <Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{
                        textAlign: "center",
                        minHeight: 50,
                        color: theme.titleColor,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.militaryName}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.7}
                      justifyContent="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 0.6 }}
                    >
                      <Chip
                        size="small"
                        icon={<BadgeRoundedIcon />}
                        label={item.locality?.code || item.locality?.name || "OM"}
                        variant="outlined"
                        sx={{
                          bgcolor: theme.accentSoft,
                          borderColor: theme.chipBorder,
                          color: theme.chipColor,
                        }}
                      />
                      <Chip
                        size="small"
                        icon={<MilitaryTechRoundedIcon />}
                        label={
                          impact === "MULTIPLICADOR" ? "Multiplicador" : "Simbólico"
                        }
                        sx={{
                          bgcolor: theme.impactChipBg,
                          color: theme.impactChipColor,
                        }}
                      />
                      {item.highlightRole && (
                        <Chip
                          size="small"
                          icon={<PersonRoundedIcon />}
                          label={item.highlightRole}
                          sx={{
                            bgcolor: "rgba(255,255,255,0.98)",
                            borderColor: theme.chipBorder,
                            color: theme.chipColor,
                            borderWidth: 1,
                            borderStyle: "solid",
                            maxWidth: "100%",
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: "auto",
                      color: theme.textColor,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                    onClick={() => setHighlightReadingTarget(item)}
                  >
                    {item.text}
                  </Typography>
                </CardContent>
                {canEditHighlights && (
                  <Stack
                    direction="row"
                    spacing={0.4}
                    sx={{ position: "absolute", top: 8, right: 8, zIndex: 3 }}
                  >
                    <IconButton
                      size="small"
                      sx={{ bgcolor: theme.actionButtonBg }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditHighlight(item);
                      }}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      sx={{ bgcolor: theme.actionButtonBg }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setHighlightDeleteTarget(item);
                      }}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Card>
            );
          })}
        </Box>
      </Stack>
    );
  };

  const renderCarouselCards = (
    carouselItems: SocialCommunicationArticle[],
    audience: "INTERNAL" | "EXTERNAL",
  ) => {
    const carouselRef =
      audience === "INTERNAL" ? internalCarouselRef : externalCarouselRef;
    const buttonBg =
      audience === "INTERNAL"
        ? "rgba(17,66,89,0.13)"
        : "rgba(77,134,160,0.2)";
    const buttonHoverBg =
      audience === "INTERNAL"
        ? "rgba(17,66,89,0.22)"
        : "rgba(77,134,160,0.3)";

    return (
      <Stack spacing={1.1}>
        <Stack direction="row" justifyContent="flex-end" spacing={0.7}>
          <IconButton
            size="small"
            onClick={() => scrollCarouselByCard(carouselRef, -1)}
            sx={{ bgcolor: buttonBg, "&:hover": { bgcolor: buttonHoverBg } }}
            aria-label={`Voltar carrossel de público ${
              audience === "INTERNAL" ? "interno" : "externo"
            }`}
          >
            <ArrowBackIosNewRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scrollCarouselByCard(carouselRef, 1)}
            sx={{ bgcolor: buttonBg, "&:hover": { bgcolor: buttonHoverBg } }}
            aria-label={`Avançar carrossel de público ${
              audience === "INTERNAL" ? "interno" : "externo"
            }`}
          >
            <ArrowForwardIosRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box
          ref={carouselRef}
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            scrollBehavior: "smooth",
            scrollSnapType: "x mandatory",
            pb: 0.5,
            px: 0.2,
            "&::-webkit-scrollbar": {
              height: 8,
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "rgba(17,66,89,0.08)",
              borderRadius: 999,
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(17,66,89,0.24)",
              borderRadius: 999,
            },
          }}
        >
          {carouselItems.map((item) => {
            const tags = normalizeTags(item.tags ?? []);
            return (
              <Card
                key={item.id}
                data-carousel-card="true"
                sx={{
                  flex: "0 0 auto",
                  width: {
                    xs: "calc(100% - 2px)",
                    sm: "calc((100% - 16px) / 2)",
                    md: "calc((100% - 32px) / 3)",
                    lg: "calc((100% - 48px) / 4)",
                  },
                  scrollSnapAlign: "start",
                  borderRadius: 3,
                  border: "1px solid rgba(17, 66, 89, 0.14)",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 160ms ease, box-shadow 160ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 10px 24px rgba(17, 66, 89, 0.16)",
                  },
                }}
              >
                <CardActionArea
                  onClick={() => openPreview(item)}
                  sx={{
                    alignItems: "stretch",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      height: 156,
                      background:
                        "linear-gradient(140deg, #114259 0%, #4D86A0 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <ArticleCoverImage
                      coverProxyPath={item.coverProxyPath}
                      coverImageUrl={item.coverImageUrl}
                      title={item.title}
                      toApiUrl={toApiUrl}
                    />
                  </Box>
                  <CardContent
                    sx={{
                      minHeight: 200,
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      flexGrow: 1,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        sx={{
                          mb: 0.8,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.title}
                      </Typography>
                      {item.summary && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 1.3,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.summary}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ mt: "auto" }}>
                      {renderTags(tags, 3)}
                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 1.1 }}
                      >
                        <Chip
                          label={sourceHost(item.sourceUrl)}
                          size="small"
                          variant="outlined"
                        />
                        {(item.publishedAt || item.createdAt) && (
                          <Chip
                            label={toDisplayDate(item.publishedAt ?? item.createdAt)}
                            size="small"
                          />
                        )}
                      </Stack>
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canEdit && (
                  <Stack
                    direction="row"
                    spacing={0.4}
                    sx={{ position: "absolute", top: 8, right: 8, zIndex: 3 }}
                  >
                    <IconButton
                      size="small"
                      sx={{ bgcolor: "rgba(255,255,255,0.92)" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      sx={{ bgcolor: "rgba(255,255,255,0.92)" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(item);
                      }}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Card>
            );
          })}
        </Box>
      </Stack>
    );
  };

  if (query.isLoading || highlightsQuery.isLoading) return <SkeletonState />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }
  if (highlightsQuery.isError) {
    return (
      <ErrorState
        error={highlightsQuery.error}
        onRetry={() => highlightsQuery.refetch()}
      />
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1.5}
        mb={2.5}
      >
        <Box>
          <Typography variant="h4">Impacto Positivo</Typography>
          <Typography variant="body2" color="text.secondary">
            Visualize as matérias em cards ou em lista e filtre por tags.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            size="small"
            onChange={(_, value) => {
              if (value) setViewMode(value);
            }}
          >
            <ToggleButton value="cards">
              <ViewModuleRoundedIcon fontSize="small" sx={{ mr: 0.6 }} /> Cards
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListRoundedIcon fontSize="small" sx={{ mr: 0.6 }} /> Lista
            </ToggleButton>
          </ToggleButtonGroup>
          {canEdit && (
            <Button variant="contained" onClick={openCreate}>
              Nova materia
            </Button>
          )}
        </Stack>
      </Stack>

      <Card
        sx={{
          mb: 2.5,
          borderRadius: 3.4,
          border: "1px solid rgba(17,66,89,0.16)",
          background:
            "linear-gradient(155deg, rgba(231,242,249,0.94) 0%, rgba(255,255,255,0.98) 56%, rgba(228,244,236,0.9) 100%)",
          boxShadow: "0 10px 24px rgba(17,66,89,0.12)",
        }}
      >
        <CardContent sx={{ py: 2.2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 1.8 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Militares Destaques
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Destaques institucionais com impacto Multiplicador e Simbólico.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Chip
                size="small"
                label={`${highlightItems.length} destaque${
                  highlightItems.length === 1 ? "" : "s"
                }`}
                sx={{
                  bgcolor: "rgba(17,66,89,0.12)",
                  color: "#114259",
                  fontWeight: 700,
                  border: "1px solid rgba(17,66,89,0.2)",
                }}
              />
              {canEditHighlights && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={openCreateHighlight}
                >
                  Novo destaque
                </Button>
              )}
            </Stack>
          </Stack>

          {canEditHighlights && highlightEditorOpen && (
            <Card
              sx={{
                mb: 2,
                borderRadius: 2.4,
                border: "1px solid rgba(17,66,89,0.15)",
                backgroundColor: "rgba(246, 251, 253, 0.94)",
              }}
            >
              <CardContent sx={{ py: 1.7 }}>
                <Stack spacing={1.2}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", md: "center" }}
                  >
                    <TextField
                      size="small"
                      label="E-mail Zimbra"
                      fullWidth
                      value={highlightForm.ldapEmail}
                      onChange={(event) =>
                        setHighlightForm((prev) => ({
                          ...prev,
                          ldapEmail: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SearchRoundedIcon fontSize="small" />}
                      onClick={() => {
                        void handleLookupHighlightLdap();
                      }}
                      disabled={highlightLookupBusy}
                    >
                      {highlightLookupBusy ? "Buscando..." : "Buscar"}
                    </Button>
                  </Stack>

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.2}
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Box
                      sx={{
                        width: 86,
                        height: 86,
                        borderRadius: "50%",
                        bgcolor: "#CDECF7",
                        border: "2px solid rgba(77,134,160,0.34)",
                        color: "#114259",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {highlightPhotoPreviewUrl ? (
                        <Box
                          component="img"
                          src={highlightPhotoPreviewUrl}
                          alt={highlightForm.militaryName || "Foto do militar"}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <PersonRoundedIcon />
                      )}
                    </Box>
                    <Stack spacing={0.6} flex={1}>
                      <TextField
                        size="small"
                        label="Numero de Ordem"
                        value={highlightForm.numeroOrdem}
                        InputProps={{ readOnly: true }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        A foto e carregada automaticamente quando houver numero de ordem no LDAP.
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Nome do militar"
                      fullWidth
                      value={highlightForm.militaryName}
                      onChange={(event) =>
                        setHighlightForm((prev) => ({
                          ...prev,
                          militaryName: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      size="small"
                      label="Funcao no destaque"
                      fullWidth
                      value={highlightForm.highlightRole}
                      onChange={(event) =>
                        setHighlightForm((prev) => ({
                          ...prev,
                          highlightRole: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      size="small"
                      label="OM"
                      sx={{ minWidth: { md: 220 } }}
                      value={highlightForm.fabom}
                      onChange={(event) =>
                        setHighlightForm((prev) => ({
                          ...prev,
                          fabom: event.target.value,
                        }))
                      }
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      select
                      label="Impacto"
                      value={highlightForm.impact}
                      sx={{ minWidth: { md: 220 } }}
                      onChange={(event) =>
                        setHighlightForm((prev) => ({
                          ...prev,
                          impact: event.target.value as "MULTIPLICADOR" | "SIMBOLICO",
                        }))
                      }
                    >
                      {HIGHLIGHT_IMPACT_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      label="OM"
                      value={highlightForm.localityId}
                      onChange={(event) =>
                        setHighlightForm((prev) => ({
                          ...prev,
                          localityId: event.target.value,
                        }))
                      }
                    >
                      {omOptions.map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                          {option.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>

                  <TextField
                    size="small"
                    label="Texto do destaque"
                    multiline
                    minRows={3}
                    value={highlightForm.text}
                    onChange={(event) =>
                      setHighlightForm((prev) => ({
                        ...prev,
                        text: event.target.value,
                      }))
                    }
                  />

                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        setHighlightEditorOpen(false);
                        setHighlightEditing(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => {
                        void handleSaveHighlight();
                      }}
                      disabled={createHighlight.isPending || updateHighlight.isPending}
                    >
                      {highlightEditing ? "Atualizar destaque" : "Salvar destaque"}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Stack
            spacing={2.9}
            sx={{ mt: highlightEditorOpen ? 0.5 : 1.6 }}
          >
            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={1}
                sx={{ mb: 0.2 }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  Impacto Multiplicador
                </Typography>
                <Chip
                  size="small"
                  label={`${multiplicadorHighlights.length} destaque${
                    multiplicadorHighlights.length === 1 ? "" : "s"
                  }`}
                  sx={{ bgcolor: "rgba(43, 120, 184, 0.16)", color: "#0E4F7D" }}
                />
              </Stack>
              {multiplicadorHighlights.length === 0 ? (
                <EmptyState
                  title="Sem destaques multiplicadores"
                  description="Cadastre destaques para mostrar neste carrossel."
                />
              ) : (
                renderHighlightCarousel(multiplicadorHighlights, "MULTIPLICADOR")
              )}
            </Box>

            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={1}
                sx={{ mb: 0.2 }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  Impacto Simbólico
                </Typography>
                <Chip
                  size="small"
                  label={`${simbolicoHighlights.length} destaque${
                    simbolicoHighlights.length === 1 ? "" : "s"
                  }`}
                  sx={{ bgcolor: "rgba(46, 139, 87, 0.16)", color: "#206346" }}
                />
              </Stack>
              {simbolicoHighlights.length === 0 ? (
                <EmptyState
                  title="Sem destaques simbólicos"
                  description="Cadastre destaques para mostrar neste carrossel."
                />
              ) : (
                renderHighlightCarousel(simbolicoHighlights, "SIMBOLICO")
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card
        sx={{
          mb: 2.5,
          borderRadius: 3,
          background: "linear-gradient(135deg, rgba(17,66,89,0.06), rgba(255,255,255,0.9))",
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              size="small"
              fullWidth
              label="Pesquisar materia"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Autocomplete
              multiple
              size="small"
              options={allTags}
              value={activeTags}
              onChange={(_, value) => setSelectedTags(normalizeTags(value))}
              filterSelectedOptions
              sx={{ minWidth: { xs: "100%", md: 300 } }}
              renderInput={(params) => <TextField {...params} label="Filtrar por tags" placeholder="Selecione" />}
            />
            <Chip
              icon={<LanguageRoundedIcon />}
              label={`${filteredByTags.length} publicacao${filteredByTags.length === 1 ? "" : "oes"}`}
              color="primary"
              variant="outlined"
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            />
          </Stack>
        </CardContent>
      </Card>

      {filteredByTags.length === 0 ? (
        <EmptyState
          title="Sem materias publicadas"
          description={canEdit ? "Cadastre um link para publicar a primeira materia." : "Aguardando publicacoes da comissao."}
        />
      ) : (
        <Stack spacing={4}>
          {/* Público Interno */}
          <Box
            sx={{
              p: { xs: 1.8, md: 2.4 },
              borderRadius: 3.2,
              border: "1px solid rgba(27,94,133,0.26)",
              background:
                "linear-gradient(145deg, rgba(27,94,133,0.16) 0%, rgba(246,251,255,0.97) 48%, rgba(220,235,245,0.92) 100%)",
              boxShadow: "0 14px 28px rgba(17,66,89,0.12)",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 1.6 }}
            >
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "#1B5E85",
                  }}
                />
                <Typography variant="h6" fontWeight={700}>
                  Público Interno
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={`${internalItems.length} matéria${internalItems.length === 1 ? "" : "s"}`}
                sx={{
                  bgcolor: "rgba(27,94,133,0.18)",
                  color: "#1B5E85",
                  fontWeight: 700,
                  border: "1px solid rgba(27,94,133,0.26)",
                }}
              />
            </Stack>
            {internalItems.length === 0 ? (
              <EmptyState
                title="Sem matérias para público interno"
                description="Nenhuma matéria cadastrada para público interno."
              />
            ) : viewMode === "cards" ? (
              renderCarouselCards(internalItems, "INTERNAL")
            ) : (
        <Stack spacing={1.5}>
          {internalItems.map((item) => {
            const tags = normalizeTags(item.tags ?? []);
            return (
              <Card
                key={item.id}
                onClick={() => openPreview(item)}
                sx={{
                  borderRadius: 3,
                  border: "1px solid rgba(17,66,89,0.14)",
                  cursor: "pointer",
                  transition: "box-shadow 160ms ease, transform 160ms ease",
                  "&:hover": {
                    boxShadow: "0 8px 18px rgba(17,66,89,0.14)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                <CardContent>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                    <Box
                      sx={{
                        width: { xs: "100%", md: 180 },
                        minWidth: { xs: "100%", md: 180 },
                        height: 108,
                        borderRadius: 2,
                        overflow: "hidden",
                        bgcolor: "rgba(17,66,89,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ArticleCoverImageSmall
                        coverProxyPath={item.coverProxyPath}
                        coverImageUrl={item.coverImageUrl}
                        title={item.title}
                        toApiUrl={toApiUrl}
                      />
                    </Box>

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.6 }}>
                        {item.title}
                      </Typography>
                      {item.summary && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {item.summary}
                        </Typography>
                      )}
                      {renderTags(tags, 8)}
                      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.1 }}>
                        <Chip label={sourceHost(item.sourceUrl)} size="small" variant="outlined" />
                        {(item.publishedAt || item.createdAt) && (
                          <Chip label={toDisplayDate(item.publishedAt ?? item.createdAt)} size="small" />
                        )}
                      </Stack>
                    </Box>

                    {canEdit && (
                      <Stack direction="row" spacing={0.6}>
                        <IconButton
                          size="small"
                          sx={{ bgcolor: "rgba(17,66,89,0.07)" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          sx={{ bgcolor: "rgba(255,0,0,0.06)" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(item);
                          }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
          </Box>

          {/* Público Externo */}
          <Box
            sx={{
              p: { xs: 1.8, md: 2.4 },
              borderRadius: 3.2,
              border: "1px solid rgba(39,125,161,0.26)",
              background:
                "linear-gradient(145deg, rgba(39,125,161,0.17) 0%, rgba(246,253,255,0.97) 50%, rgba(211,236,244,0.92) 100%)",
              boxShadow: "0 14px 28px rgba(17,66,89,0.12)",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 1.6 }}
            >
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "#277DA1",
                  }}
                />
                <Typography variant="h6" fontWeight={700}>
                  Público Externo
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={`${externalItems.length} matéria${externalItems.length === 1 ? "" : "s"}`}
                sx={{
                  bgcolor: "rgba(39,125,161,0.18)",
                  color: "#1C5D78",
                  fontWeight: 700,
                  border: "1px solid rgba(39,125,161,0.28)",
                }}
              />
            </Stack>
            {externalItems.length === 0 ? (
              <EmptyState
                title="Sem matérias para público externo"
                description="Nenhuma matéria cadastrada para público externo."
              />
            ) : viewMode === "cards" ? (
              renderCarouselCards(externalItems, "EXTERNAL")
            ) : (
        <Stack spacing={1.5}>
          {externalItems.map((item) => {
            const tags = normalizeTags(item.tags ?? []);
            return (
              <Card
                key={item.id}
                onClick={() => openPreview(item)}
                sx={{
                  borderRadius: 3,
                  border: "1px solid rgba(17,66,89,0.14)",
                  cursor: "pointer",
                  transition: "box-shadow 160ms ease, transform 160ms ease",
                  "&:hover": {
                    boxShadow: "0 8px 18px rgba(17,66,89,0.14)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                <CardContent>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                    <Box
                      sx={{
                        width: { xs: "100%", md: 180 },
                        minWidth: { xs: "100%", md: 180 },
                        height: 108,
                        borderRadius: 2,
                        overflow: "hidden",
                        bgcolor: "rgba(17,66,89,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ArticleCoverImageSmall
                        coverProxyPath={item.coverProxyPath}
                        coverImageUrl={item.coverImageUrl}
                        title={item.title}
                        toApiUrl={toApiUrl}
                      />
                    </Box>

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.6 }}>
                        {item.title}
                      </Typography>
                      {item.summary && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {item.summary}
                        </Typography>
                      )}
                      {renderTags(tags, 8)}
                      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.1 }}>
                        <Chip label={sourceHost(item.sourceUrl)} size="small" variant="outlined" />
                        {(item.publishedAt || item.createdAt) && (
                          <Chip label={toDisplayDate(item.publishedAt ?? item.createdAt)} size="small" />
                        )}
                      </Stack>
                    </Box>

                    {canEdit && (
                      <Stack direction="row" spacing={0.6}>
                        <IconButton
                          size="small"
                          sx={{ bgcolor: "rgba(17,66,89,0.07)" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          sx={{ bgcolor: "rgba(255,0,0,0.06)" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(item);
                          }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
          </Box>
        </Stack>
      )}

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar materia" : "Nova materia"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} mt={0.5}>
            <TextField
              label="Link da materia"
              size="small"
              required
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              onBlur={() => {
                void applyMetadata(false);
              }}
              placeholder="https://..."
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                O sistema tenta preencher titulo e capa automaticamente pelo link.
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoAwesomeRoundedIcon fontSize="small" />}
                disabled={resolveMetadata.isPending || !form.url.trim()}
                onClick={() => {
                  void applyMetadata(true);
                }}
              >
                Carregar dados
              </Button>
            </Stack>
            <TextField
              label="Titulo"
              size="small"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <TextField
              label="URL da capa"
              size="small"
              value={form.coverImageUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))}
              placeholder="https://..."
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<UploadFileRoundedIcon fontSize="small" />}
                disabled={uploadCover.isPending}
                onClick={() => coverFileInputRef.current?.click()}
              >
                {uploadCover.isPending ? "Enviando..." : "Enviar capa por arquivo"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                PNG/JPG/WebP ate 5MB.
              </Typography>
            </Stack>
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleUploadCoverFile(file);
                event.currentTarget.value = "";
              }}
            />
            <TextField
              label="Resumo"
              size="small"
              multiline
              minRows={3}
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            />
            <Autocomplete
              multiple
              freeSolo
              options={allTags}
              value={form.tags}
              onChange={(_, value) => setForm((prev) => ({ ...prev, tags: normalizeTags(value as string[]) }))}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => <Chip {...getTagProps({ index })} key={option} size="small" label={`#${option}`} />)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Tags"
                  placeholder="Digite e pressione Enter"
                  helperText="Você pode adicionar quantas tags quiser."
                />
              )}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.6 }}>
                Tags rápidas
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {QUICK_TAGS.map((tag) => {
                  const selected = form.tags.includes(tag);
                  return (
                    <Chip
                      key={tag}
                      label={`#${tag}`}
                      clickable
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() => {
                        setForm((prev) => {
                          const next = prev.tags.includes(tag)
                            ? prev.tags.filter((value) => value !== tag)
                            : [...prev.tags, tag];
                          return { ...prev, tags: normalizeTags(next) };
                        });
                      }}
                      sx={{
                        borderRadius: 1.6,
                        fontWeight: 700,
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
            <TextField
              label="Público"
              select
              size="small"
              value={form.audience}
              onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value as "INTERNAL" | "EXTERNAL" }))}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="INTERNAL">Interno</MenuItem>
              <MenuItem value="EXTERNAL">Externo</MenuItem>
            </TextField>
            <TextField
              label="Data da publicacao"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.publishedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, publishedAt: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="outlined" onClick={() => setEditorOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={!form.url.trim() || createArticle.isPending || updateArticle.isPending}
            onClick={() => {
              void handleSave();
            }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(highlightReadingTarget)}
        onClose={() => setHighlightReadingTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Detalhes do Destaque</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Box
              sx={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                bgcolor: "#CDECF7",
                border: "2px solid rgba(77,134,160,0.34)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
              }}
            >
              {buildHighlightPhotoDataUrl(
                highlightReadingTarget?.photoBase64,
                highlightReadingTarget?.photoMimeType,
              ) ? (
                <Box
                  component="img"
                  src={buildHighlightPhotoDataUrl(
                    highlightReadingTarget?.photoBase64,
                    highlightReadingTarget?.photoMimeType,
                  )}
                  alt={highlightReadingTarget?.militaryName ?? "Militar"}
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <PersonRoundedIcon />
              )}
            </Box>
            <Typography variant="h6" fontWeight={700}>
              {highlightReadingTarget?.militaryName ?? "Militar"}
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {highlightReadingTarget?.locality?.code && (
                <Chip
                  size="small"
                  icon={<BadgeRoundedIcon />}
                  label={highlightReadingTarget.locality.code}
                  variant="outlined"
                />
              )}
              {highlightReadingTarget?.highlightRole && (
                <Chip
                  size="small"
                  icon={<PersonRoundedIcon />}
                  label={highlightReadingTarget.highlightRole}
                  variant="outlined"
                />
              )}
              {highlightReadingTarget?.impact && (
                <Chip
                  size="small"
                  icon={<MilitaryTechRoundedIcon />}
                  label={
                    highlightReadingTarget.impact === "MULTIPLICADOR"
                      ? "Multiplicador"
                      : "Simbólico"
                  }
                />
              )}
            </Stack>
            <Typography
              variant="body1"
              sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
            >
              {highlightReadingTarget?.text ?? ""}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHighlightReadingTarget(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(highlightDeleteTarget)}
        onCancel={() => setHighlightDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmHighlightDelete();
        }}
        title="Excluir destaque"
        message="Deseja remover este destaque de militar?"
        highlightText={highlightDeleteTarget?.militaryName ?? ""}
        note="A exclusão é permanente e será registrada em auditoria."
        confirmLabel="Excluir destaque"
        severity="error"
        confirmLoading={deleteHighlight.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title="Excluir materia"
        message="Deseja remover esta materia de Impacto Positivo?"
        highlightText={deleteTarget?.title ?? ""}
        note="A exclusão é permanente e será registrada em auditoria."
        confirmLabel="Excluir materia"
        severity="error"
        confirmLoading={deleteArticle.isPending}
      />
    </Box>
  );
}
