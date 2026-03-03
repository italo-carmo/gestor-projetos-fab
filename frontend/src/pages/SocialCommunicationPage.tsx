import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import NewspaperRoundedIcon from "@mui/icons-material/NewspaperRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import { useEffect, useMemo, useState } from "react";
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
  useCreateSocialCommunicationArticle,
  useDeleteSocialCommunicationArticle,
  useMe,
  useResolveSocialCommunicationMetadata,
  useSocialCommunication,
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
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
};

function toDisplayDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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
  const [imageSrc, setImageSrc] = useState(
    coverProxyPath ? toApiUrl(coverProxyPath) : (coverImageUrl ?? undefined)
  );

  if (!coverProxyPath && !coverImageUrl) {
    return <NewspaperRoundedIcon sx={{ color: "white", fontSize: 38 }} />;
  }

  if (imageError) {
    return <NewspaperRoundedIcon sx={{ color: "white", fontSize: 38 }} />;
  }

  return (
    <Box
      component="img"
      src={imageSrc}
      alt={title}
      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={() => {
        // Se o proxy falhou e temos URL direta, tenta usar ela
        if (coverProxyPath && coverImageUrl && imageSrc.includes('/proxy/cover')) {
          setImageSrc(coverImageUrl);
          return;
        }
        // Caso contrário, mostra o ícone padrão
        setImageError(true);
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
  const [imageSrc, setImageSrc] = useState(
    coverProxyPath ? toApiUrl(coverProxyPath) : (coverImageUrl ?? undefined)
  );

  if (!coverProxyPath && !coverImageUrl) {
    return <NewspaperRoundedIcon sx={{ color: "#114259", fontSize: 32 }} />;
  }

  if (imageError) {
    return <NewspaperRoundedIcon sx={{ color: "#114259", fontSize: 32 }} />;
  }

  return (
    <Box
      component="img"
      src={imageSrc}
      alt={title}
      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={() => {
        // Se o proxy falhou e temos URL direta, tenta usar ela
        if (coverProxyPath && coverImageUrl && imageSrc.includes('/proxy/cover')) {
          setImageSrc(coverImageUrl);
          return;
        }
        // Caso contrário, mostra o ícone padrão
        setImageError(true);
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

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const filters = useMemo(() => ({ q: search.trim() || undefined }), [search]);

  const query = useSocialCommunication(filters);
  const createArticle = useCreateSocialCommunicationArticle();
  const updateArticle = useUpdateSocialCommunicationArticle();
  const deleteArticle = useDeleteSocialCommunicationArticle();
  const resolveMetadata = useResolveSocialCommunicationMetadata();

  const [previewing, setPreviewing] = useState<SocialCommunicationArticle | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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
  });

  useEffect(() => {
    if (!previewing) {
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
  }, [previewing]);

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
    });
    setEditorOpen(true);
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

  const handleSave = async () => {
    try {
      const payload = {
        url: form.url.trim(),
        title: form.title.trim() || undefined,
        coverImageUrl: form.coverImageUrl.trim() || null,
        summary: form.summary.trim() || null,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        tags: normalizeTags(form.tags),
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

  if (query.isLoading) return <SkeletonState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const items = (query.data?.items ?? []) as SocialCommunicationArticle[];
  const allTags = Array.from(
    new Set(items.flatMap((item) => normalizeTags(item.tags ?? []))),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const activeTags = normalizeTags(selectedTags);
  const visibleItems = activeTags.length
    ? items.filter((item) => {
        const itemTags = normalizeTags(item.tags ?? []);
        return activeTags.some((tag) => itemTags.includes(tag));
      })
    : items;

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
          <Typography variant="h4">Comunicacao Social</Typography>
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
              label={`${visibleItems.length} publicacao${visibleItems.length === 1 ? "" : "oes"}`}
              color="primary"
              variant="outlined"
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            />
          </Stack>
        </CardContent>
      </Card>

      {visibleItems.length === 0 ? (
        <EmptyState
          title="Sem materias publicadas"
          description={canEdit ? "Cadastre um link para publicar a primeira materia." : "Aguardando publicacoes da comissao."}
        />
      ) : viewMode === "cards" ? (
        <Box
          display="grid"
          gap={2}
          gridTemplateColumns={{
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          }}
        >
          {visibleItems.map((item) => {
            const tags = normalizeTags(item.tags ?? []);
            return (
              <Card
                key={item.id}
                sx={{
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
                  onClick={() => setPreviewing(item)}
                  sx={{ alignItems: "stretch", height: "100%", display: "flex", flexDirection: "column" }}
                >
                  <Box
                    sx={{
                      height: 156,
                      background: "linear-gradient(140deg, #114259 0%, #4D86A0 100%)",
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
                  <CardContent sx={{ minHeight: 200, width: "100%", display: "flex", flexDirection: "column", flexGrow: 1 }}>
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
                      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.1 }}>
                        <Chip label={sourceHost(item.sourceUrl)} size="small" variant="outlined" />
                        {(item.publishedAt || item.createdAt) && (
                          <Chip label={toDisplayDate(item.publishedAt ?? item.createdAt)} size="small" />
                        )}
                      </Stack>
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canEdit && (
                  <Stack direction="row" spacing={0.4} sx={{ position: "absolute", top: 8, right: 8, zIndex: 3 }}>
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
      ) : (
        <Stack spacing={1.5}>
          {visibleItems.map((item) => {
            const tags = normalizeTags(item.tags ?? []);
            return (
              <Card
                key={item.id}
                onClick={() => setPreviewing(item)}
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

      <Dialog open={Boolean(previewing)} onClose={() => setPreviewing(null)} fullWidth maxWidth="lg">
        {previewing && (
          <DialogContent dividers sx={{ p: 0, position: "relative" }}>
            <IconButton
              onClick={() => setPreviewing(null)}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 2,
                bgcolor: "rgba(255,255,255,0.9)",
                "&:hover": { bgcolor: "rgba(255,255,255,1)" },
              }}
            >
              <CloseRoundedIcon />
            </IconButton>
            <Box
              sx={{
                border: "1px solid rgba(17,66,89,0.16)",
                borderRadius: 0,
                overflow: "hidden",
                height: { xs: "75vh", md: "78vh" },
                position: "relative",
              }}
            >
              {previewLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(180deg, rgba(249,252,255,0.97) 0%, rgba(235,244,250,0.97) 100%)",
                  }}
                >
                  <Stack spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        bgcolor: "rgba(17,66,89,0.1)",
                        color: "#114259",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <AutoAwesomeRoundedIcon fontSize="small" />
                    </Box>
                    <CircularProgress size={28} thickness={5} sx={{ color: "#114259" }} />
                    <Typography variant="body2" fontWeight={600} sx={{ color: "#114259" }}>
                      Carregando matéria...
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Aguarde alguns segundos.
                    </Typography>
                  </Stack>
                </Box>
              )}
              <Box
                component="iframe"
                title={previewing.title}
                src={previewing.contentProxyPath ? toApiUrl(previewing.contentProxyPath) : previewing.sourceUrl}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                onLoad={() => setPreviewLoading(false)}
                onError={() => setPreviewLoading(false)}
                sx={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  bgcolor: "#fff",
                }}
              />
            </Box>
          </DialogContent>
        )}
      </Dialog>

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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title="Excluir materia"
        message="Deseja remover esta materia da Comunicacao Social?"
        highlightText={deleteTarget?.title ?? ""}
        note="A exclusão é permanente e será registrada em auditoria."
        confirmLabel="Excluir materia"
        severity="error"
        confirmLoading={deleteArticle.isPending}
      />
    </Box>
  );
}
