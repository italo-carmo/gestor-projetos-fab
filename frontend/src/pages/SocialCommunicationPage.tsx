import {
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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import NewspaperRoundedIcon from "@mui/icons-material/NewspaperRounded";
import { useMemo, useState } from "react";
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

export function SocialCommunicationPage() {
  const toast = useToast();
  const { data: me } = useMe();

  const canEdit = hasAnyRole(me, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
    ROLE_TI,
  ]);

  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({ q: search.trim() || undefined }), [search]);

  const query = useSocialCommunication(filters);
  const createArticle = useCreateSocialCommunicationArticle();
  const updateArticle = useUpdateSocialCommunicationArticle();
  const deleteArticle = useDeleteSocialCommunicationArticle();
  const resolveMetadata = useResolveSocialCommunicationMetadata();

  const [previewing, setPreviewing] =
    useState<SocialCommunicationArticle | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SocialCommunicationArticle | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<SocialCommunicationArticle | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [form, setForm] = useState({
    url: "",
    title: "",
    coverImageUrl: "",
    summary: "",
    publishedAt: "",
  });

  const openCreate = () => {
    setEditing(null);
    setResolvedUrl("");
    setForm({
      url: "",
      title: "",
      coverImageUrl: "",
      summary: "",
      publishedAt: "",
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
        coverImageUrl:
          prev.coverImageUrl.trim() || metadata.coverImageUrl || "",
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
        publishedAt: form.publishedAt
          ? new Date(form.publishedAt).toISOString()
          : null,
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
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const items = (query.data?.items ?? []) as SocialCommunicationArticle[];

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
            Ultimas materias em formato de cards para leitura rapida.
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" onClick={openCreate}>
            Nova materia
          </Button>
        )}
      </Stack>

      <Card
        sx={{
          mb: 2.5,
          borderRadius: 3,
          background:
            "linear-gradient(135deg, rgba(17,66,89,0.06), rgba(255,255,255,0.9))",
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              size="small"
              fullWidth
              label="Pesquisar materia"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Chip
              icon={<LanguageRoundedIcon />}
              label={`${items.length} publicacao${items.length === 1 ? "" : "oes"}`}
              color="primary"
              variant="outlined"
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            />
          </Stack>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="Sem materias publicadas"
          description={
            canEdit
              ? "Cadastre um link para publicar a primeira materia."
              : "Aguardando publicacoes da comissao."
          }
        />
      ) : (
        <Box
          display="grid"
          gap={2}
          gridTemplateColumns={{
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          }}
        >
          {items.map((item) => (
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
                sx={{ alignItems: "stretch" }}
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
                  {item.coverProxyPath || item.coverImageUrl ? (
                    <Box
                      component="img"
                      src={
                        item.coverProxyPath
                          ? toApiUrl(item.coverProxyPath)
                          : (item.coverImageUrl ?? undefined)
                      }
                      alt={item.title}
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <NewspaperRoundedIcon
                      sx={{ color: "white", fontSize: 38 }}
                    />
                  )}
                </Box>
                <CardContent sx={{ minHeight: 165 }}>
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
                  <Stack
                    direction="row"
                    spacing={0.8}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Chip
                      label={sourceHost(item.sourceUrl)}
                      size="small"
                      variant="outlined"
                    />
                    {(item.publishedAt || item.createdAt) && (
                      <Chip
                        label={toDisplayDate(
                          item.publishedAt ?? item.createdAt,
                        )}
                        size="small"
                      />
                    )}
                  </Stack>
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
          ))}
        </Box>
      )}

      <Dialog
        open={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        fullWidth
        maxWidth="lg"
      >
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
              }}
            >
              <Box
                component="iframe"
                title={previewing.title}
                src={
                  previewing.contentProxyPath
                    ? toApiUrl(previewing.contentProxyPath)
                    : previewing.sourceUrl
                }
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
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

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? "Editar materia" : "Nova materia"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} mt={0.5}>
            <TextField
              label="Link da materia"
              size="small"
              required
              value={form.url}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, url: event.target.value }))
              }
              onBlur={() => {
                void applyMetadata(false);
              }}
              placeholder="https://..."
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="caption" color="text.secondary">
                O sistema tenta preencher titulo e capa automaticamente pelo
                link.
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
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
            <TextField
              label="URL da capa"
              size="small"
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  coverImageUrl: event.target.value,
                }))
              }
              placeholder="https://..."
            />
            <TextField
              label="Resumo"
              size="small"
              multiline
              minRows={3}
              value={form.summary}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, summary: event.target.value }))
              }
            />
            <TextField
              label="Data da publicacao"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.publishedAt}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  publishedAt: event.target.value,
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              !form.url.trim() ||
              createArticle.isPending ||
              updateArticle.isPending
            }
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
