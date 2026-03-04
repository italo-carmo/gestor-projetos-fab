import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useEffect, useMemo, useState } from "react";
import {
  useDeleteLibraryDocument,
  useDeleteLibraryPhoto,
  useLibrary,
  useLocalities,
  useMe,
  useUpdateLibraryDocument,
  useUpdateLibraryPhoto,
  useUpdateLibrarySettings,
  useUploadLibraryDocument,
  useUploadLibraryPhoto,
} from "../api/hooks";
import { api } from "../api/client";
import { ROLE_COORDENACAO_CIPAVD, ROLE_TI, hasAnyRole } from "../app/roleAccess";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import { selectTargetLocalities } from "../constants/localities";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type LibraryPhoto = {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
  localityId?: string | null;
  locality?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

type LibraryDocument = {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  createdAt: string;
};

function toApiUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = String(api.defaults.baseURL ?? "/api");
  if (!baseUrl || baseUrl === "/api") return path;
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const libraryQuery = useLibrary();
  const localitiesQuery = useLocalities();
  const updateSettings = useUpdateLibrarySettings();
  const uploadPhoto = useUploadLibraryPhoto();
  const updatePhoto = useUpdateLibraryPhoto();
  const deletePhoto = useDeleteLibraryPhoto();
  const uploadDocument = useUploadLibraryDocument();
  const updateDocument = useUpdateLibraryDocument();
  const deleteDocument = useDeleteLibraryDocument();
  const canManage = hasAnyRole(me, [ROLE_TI, ROLE_COORDENACAO_CIPAVD]);

  const allPhotos = useMemo(
    () => ((libraryQuery.data?.photos ?? []) as LibraryPhoto[]).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [libraryQuery.data?.photos],
  );

  const [selectedLocalityId, setSelectedLocalityId] = useState<string>("");

  const photos = useMemo(() => {
    if (!selectedLocalityId) return allPhotos;
    return allPhotos.filter((photo) => photo.localityId === selectedLocalityId);
  }, [allPhotos, selectedLocalityId]);

  const documents = useMemo(
    () => (libraryQuery.data?.documents ?? []) as LibraryDocument[],
    [libraryQuery.data?.documents],
  );
  const intervalFromApi = Number(libraryQuery.data?.settings?.carouselIntervalSeconds ?? 5);

  const localities = useMemo(() => {
    const items = (localitiesQuery.data?.items ?? []) as any[];
    return selectTargetLocalities(items).map((loc: any) => ({
      id: String(loc.id),
      name: String(loc.name ?? loc.code ?? loc.id),
      code: String(loc.code ?? ""),
    }));
  }, [localitiesQuery.data]);

  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [photoTitleDrafts, setPhotoTitleDrafts] = useState<Record<string, string>>({});
  const [photoOrderDrafts, setPhotoOrderDrafts] = useState<Record<string, number>>({});
  const [photoLocalityDrafts, setPhotoLocalityDrafts] = useState<Record<string, string>>({});
  const [documentTitleDrafts, setDocumentTitleDrafts] = useState<Record<string, string>>({});
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoLocalityId, setNewPhotoLocalityId] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");

  useEffect(() => {
    setIntervalSeconds(Math.max(2, Math.min(60, intervalFromApi)));
  }, [intervalFromApi]);

  useEffect(() => {
    if (!photos.length) {
      setCurrentIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, Math.max(2, intervalSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [photos.length, intervalSeconds]);

  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= photos.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, photos.length]);

  // Refetch when drawer closes to ensure data is fresh
  useEffect(() => {
    if (!drawerOpen) {
      libraryQuery.refetch();
    }
  }, [drawerOpen]);

  if (libraryQuery.isLoading) return <SkeletonState />;
  if (libraryQuery.isError) {
    return <ErrorState error={libraryQuery.error} onRetry={() => libraryQuery.refetch()} />;
  }

  const currentPhoto = photos[currentIndex] ?? null;

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={1} mb={1.4}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="h4" fontWeight={700}>
              Biblioteca
            </Typography>
            {canManage && (
              <Tooltip title="Gerenciar fotos e documentos">
                <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: "primary.main" }}>
                  <SettingsRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Acervo oficial da comissão com galeria de fotos e documentos institucionais.
          </Typography>
        </Box>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ flex: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} sx={{ mb: 1.5 }}>
              <Typography variant="h6" fontWeight={700}>
                Carrossel de Fotos
              </Typography>
              <TextField
                select
                size="small"
                label="Filtrar por localidade"
                value={selectedLocalityId}
                onChange={(e) => {
                  setSelectedLocalityId(e.target.value);
                  setCurrentIndex(0);
                }}
                sx={{ minWidth: { xs: "100%", sm: 240 } }}
              >
                <MenuItem value="">Todas as localidades</MenuItem>
                {localities.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Box
              sx={{
                position: "relative",
                borderRadius: 2,
                overflow: "hidden",
                minHeight: { xs: 220, md: 340 },
                bgcolor: "#0E2E3A",
                display: "grid",
                placeItems: "center",
              }}
            >
              {!currentPhoto ? (
                <Stack alignItems="center" spacing={1}>
                  <ImageRoundedIcon sx={{ color: "white", fontSize: 44, opacity: 0.8 }} />
                  <Typography sx={{ color: "white" }}>Sem fotos cadastradas</Typography>
                </Stack>
              ) : (
                <Box
                  component="img"
                  src={toApiUrl(currentPhoto.fileUrl)}
                  alt={currentPhoto.title}
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
              {photos.length > 1 && (
                <>
                  <IconButton
                    onClick={() => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)}
                    sx={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.86)" }}
                  >
                    <ArrowBackIosNewRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % photos.length)}
                    sx={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.86)" }}
                  >
                    <ArrowForwardIosRoundedIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
            <Stack direction="row" spacing={0.8} mt={1.2} flexWrap="wrap" useFlexGap>
              {photos.map((photo, index) => (
                <Chip
                  key={photo.id}
                  size="small"
                  label={String(index + 1)}
                  color={index === currentIndex ? "primary" : "default"}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </Stack>
            {currentPhoto && (
              <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 700 }}>
                {currentPhoto.title}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Documentos da Comissão
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
            Cartilhas, normativos e demais materiais institucionais para consulta rápida.
          </Typography>

          {documents.length === 0 ? (
            <EmptyState title="Nenhum documento" description="Inclua os documentos produzidos pela comissão." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Título</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Arquivo</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Tamanho</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Publicado em</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }} align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id} hover>
                    <TableCell sx={{ minWidth: 260, fontWeight: 500 }}>{document.title}</TableCell>
                    <TableCell>{document.fileName}</TableCell>
                    <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                    <TableCell>{new Date(document.createdAt).toLocaleString("pt-BR")}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Abrir documento">
                        <IconButton
                          size="small"
                          onClick={() => window.open(toApiUrl(document.fileUrl), "_blank")}
                          sx={{ color: "primary.main" }}
                        >
                          <OpenInNewRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Divider sx={{ my: 1.2 }} />
          <Typography variant="caption" color="text.secondary">
            Permissões de edição: TI e Coordenação CIPAVD. Demais perfis podem visualizar e abrir os arquivos.
          </Typography>
        </CardContent>
      </Card>

      {canManage && (
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: "100%", md: 800 },
              top: 76,
              height: "calc(100% - 76px)",
            },
          }}
        >
          <Box sx={{ height: "100%", overflowY: "auto", p: 3 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                  Gerenciar Biblioteca
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure o carrossel de fotos e gerencie os documentos da comissão.
                </Typography>
              </Box>

              {/* Configuração do Carrossel */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                    Configuração do Carrossel
                  </Typography>
                  <Stack spacing={1.2}>
                    <TextField
                      select
                      size="small"
                      label="Troca automática"
                      value={String(intervalSeconds)}
                      onChange={(event) => setIntervalSeconds(Number(event.target.value))}
                      fullWidth
                    >
                      {[2, 3, 5, 8, 10, 12, 15, 20, 30].map((seconds) => (
                        <MenuItem key={seconds} value={String(seconds)}>
                          {seconds} segundos
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<SaveRoundedIcon fontSize="small" />}
                      disabled={updateSettings.isPending || intervalSeconds === intervalFromApi}
                      onClick={async () => {
                        try {
                          await updateSettings.mutateAsync({ carouselIntervalSeconds: intervalSeconds });
                          toast.push({ message: "Intervalo atualizado.", severity: "success" });
                        } catch (error) {
                          toast.push({
                            message: parseApiError(error).message ?? "Erro ao salvar intervalo.",
                            severity: "error",
                          });
                        }
                      }}
                      fullWidth
                    >
                      Salvar intervalo
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {/* Gestão de Fotos */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                    Gestão de Fotos
                  </Typography>
                  <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <TextField
                        size="small"
                        label="Título da nova foto (opcional)"
                        value={newPhotoTitle}
                        onChange={(event) => setNewPhotoTitle(event.target.value)}
                        fullWidth
                      />
                      <TextField
                        select
                        size="small"
                        label="Localidade (opcional)"
                        value={newPhotoLocalityId}
                        onChange={(event) => setNewPhotoLocalityId(event.target.value)}
                        sx={{ minWidth: { xs: "100%", md: 240 } }}
                      >
                        <MenuItem value="">Sem localidade específica</MenuItem>
                        {localities.map((loc) => (
                          <MenuItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                    <Button
                      component="label"
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<UploadRoundedIcon fontSize="small" />}
                      disabled={uploadPhoto.isPending}
                      sx={{ alignSelf: { xs: "stretch", md: "flex-start" }, maxWidth: { md: 200 } }}
                    >
                      {uploadPhoto.isPending ? "Enviando..." : "Enviar foto"}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            const result = await uploadPhoto.mutateAsync({
                              file,
                              title: newPhotoTitle.trim() || undefined,
                              localityId: newPhotoLocalityId || undefined,
                            });
                            setNewPhotoTitle("");
                            setNewPhotoLocalityId("");
                            toast.push({ message: "Foto adicionada.", severity: "success" });
                            // Force immediate refetch - the mutation already invalidates, but we ensure it happens
                            await libraryQuery.refetch();
                          } catch (error) {
                            toast.push({
                              message: parseApiError(error).message ?? "Erro ao enviar foto.",
                              severity: "error",
                            });
                          }
                          event.target.value = "";
                        }}
                      />
                    </Button>
                  </Stack>

                  {allPhotos.length === 0 ? (
                    <EmptyState title="Nenhuma foto" description="Adicione fotos para o carrossel da Biblioteca." />
                  ) : (
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small" sx={{ minWidth: 800 }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: "primary.main" }}>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 100 }}>Preview</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, minWidth: 200 }}>Título</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, minWidth: 180 }}>Localidade</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 100 }}>Ordem</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 180 }} align="right">Ações</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allPhotos.map((photo) => {
                            const titleDraft = photoTitleDrafts[photo.id] ?? photo.title;
                            const orderDraft = photoOrderDrafts[photo.id] ?? photo.sortOrder;
                            const localityDraft = photoLocalityDrafts[photo.id] ?? photo.localityId ?? "";
                            return (
                              <TableRow key={photo.id} hover>
                                <TableCell>
                                  <Box
                                    component="img"
                                    src={toApiUrl(photo.fileUrl)}
                                    alt={photo.title}
                                    sx={{ width: 86, height: 56, borderRadius: 1, objectFit: "cover", border: "1px solid #D4E1EC" }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    value={titleDraft}
                                    onChange={(event) =>
                                      setPhotoTitleDrafts((prev) => ({ ...prev, [photo.id]: event.target.value }))
                                    }
                                    fullWidth
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    select
                                    size="small"
                                    value={localityDraft}
                                    onChange={(event) =>
                                      setPhotoLocalityDrafts((prev) => ({ ...prev, [photo.id]: event.target.value }))
                                    }
                                    sx={{ minWidth: 160 }}
                                  >
                                    <MenuItem value="">Sem localidade</MenuItem>
                                    {localities.map((loc) => (
                                      <MenuItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={String(orderDraft)}
                                    onChange={(event) =>
                                      setPhotoOrderDrafts((prev) => ({
                                        ...prev,
                                        [photo.id]: Number(event.target.value || 0),
                                      }))
                                    }
                                    sx={{ width: 80 }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Stack direction="row" spacing={0.8} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      onClick={async () => {
                                        try {
                                          await updatePhoto.mutateAsync({
                                            id: photo.id,
                                            payload: {
                                              title: titleDraft.trim(),
                                              sortOrder: orderDraft,
                                              localityId: localityDraft || null,
                                            },
                                          });
                                          toast.push({ message: "Foto atualizada.", severity: "success" });
                                          libraryQuery.refetch();
                                        } catch (error) {
                                          toast.push({
                                            message: parseApiError(error).message ?? "Erro ao atualizar foto.",
                                            severity: "error",
                                          });
                                        }
                                      }}
                                      disabled={updatePhoto.isPending}
                                    >
                                      Salvar
                                    </Button>
                                  <Tooltip title="Excluir foto">
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        disabled={deletePhoto.isPending}
                                        onClick={async () => {
                                          try {
                                            await deletePhoto.mutateAsync(photo.id);
                                            toast.push({ message: "Foto excluída.", severity: "success" });
                                            libraryQuery.refetch();
                                          } catch (error) {
                                            toast.push({
                                              message: parseApiError(error).message ?? "Erro ao excluir foto.",
                                              severity: "error",
                                            });
                                          }
                                        }}
                                      >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Gestão de Documentos */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                    Gestão de Documentos
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.5 }}>
                    <TextField
                      size="small"
                      label="Título do novo documento (opcional)"
                      value={newDocumentTitle}
                      onChange={(event) => setNewDocumentTitle(event.target.value)}
                      fullWidth
                    />
                    <Button
                      component="label"
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<UploadRoundedIcon fontSize="small" />}
                      disabled={uploadDocument.isPending}
                      sx={{ minWidth: { xs: "auto", md: 160 }, alignSelf: { xs: "stretch", md: "flex-start" } }}
                    >
                      {uploadDocument.isPending ? "Enviando..." : "Enviar documento"}
                      <input
                        type="file"
                        hidden
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            await uploadDocument.mutateAsync({
                              file,
                              title: newDocumentTitle.trim() || undefined,
                            });
                            setNewDocumentTitle("");
                            toast.push({ message: "Documento adicionado.", severity: "success" });
                            libraryQuery.refetch();
                          } catch (error) {
                            toast.push({
                              message: parseApiError(error).message ?? "Erro ao enviar documento.",
                              severity: "error",
                            });
                          }
                          event.target.value = "";
                        }}
                      />
                    </Button>
                  </Stack>

                  {documents.length === 0 ? (
                    <EmptyState title="Nenhum documento" description="Inclua os documentos produzidos pela comissão." />
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "primary.main" }}>
                          <TableCell sx={{ color: "white", fontWeight: 700 }}>Título</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: 700 }}>Arquivo</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: 700 }}>Tamanho</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: 700 }}>Publicado em</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: 700 }} align="right">Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {documents.map((document) => {
                          const titleDraft = documentTitleDrafts[document.id] ?? document.title;
                          return (
                            <TableRow key={document.id} hover>
                              <TableCell sx={{ minWidth: 260 }}>
                                <TextField
                                  size="small"
                                  value={titleDraft}
                                  onChange={(event) =>
                                    setDocumentTitleDrafts((prev) => ({
                                      ...prev,
                                      [document.id]: event.target.value,
                                    }))
                                  }
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>{document.fileName}</TableCell>
                              <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                              <TableCell>{new Date(document.createdAt).toLocaleString("pt-BR")}</TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.8} justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    onClick={async () => {
                                      try {
                                        await updateDocument.mutateAsync({
                                          id: document.id,
                                          payload: { title: titleDraft.trim() },
                                        });
                                        toast.push({ message: "Documento atualizado.", severity: "success" });
                                        libraryQuery.refetch();
                                      } catch (error) {
                                        toast.push({
                                          message: parseApiError(error).message ?? "Erro ao atualizar documento.",
                                          severity: "error",
                                        });
                                      }
                                    }}
                                    disabled={updateDocument.isPending}
                                  >
                                    Salvar
                                  </Button>
                                  <Tooltip title="Excluir documento">
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={async () => {
                                          try {
                                            await deleteDocument.mutateAsync(document.id);
                                            toast.push({ message: "Documento excluído.", severity: "success" });
                                            libraryQuery.refetch();
                                          } catch (error) {
                                            toast.push({
                                              message: parseApiError(error).message ?? "Erro ao excluir documento.",
                                              severity: "error",
                                            });
                                          }
                                        }}
                                        disabled={deleteDocument.isPending}
                                      >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Drawer>
      )}
    </Box>
  );
}
