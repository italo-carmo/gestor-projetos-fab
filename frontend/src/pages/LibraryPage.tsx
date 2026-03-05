import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
import EditRoundedIcon from "@mui/icons-material/EditRounded";
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
  fileUrl?: string | null; // Mantido para compatibilidade
  imageData?: string; // Base64 da imagem
  mimeType?: string | null; // Tipo MIME (ex: image/jpeg)
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

function getPhotoUrl(photo: LibraryPhoto): string {
  // Use base64 data URL if available, otherwise fallback to fileUrl
  if (photo.imageData) {
    const mimeType = photo.mimeType || 'image/jpeg';
    return `data:${mimeType};base64,${photo.imageData}`;
  }
  // Fallback for old photos that still use fileUrl
  if (photo.fileUrl) {
    return toApiUrl(photo.fileUrl);
  }
  return "";
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
  const [photoLocalityDrafts, setPhotoLocalityDrafts] = useState<Record<string, string>>({});
  const [documentTitleDrafts, setDocumentTitleDrafts] = useState<Record<string, string>>({});
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoLocalityId, setNewPhotoLocalityId] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [bulkLocalityId, setBulkLocalityId] = useState<string>("");

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

  useEffect(() => {
    const validIds = new Set(allPhotos.map((photo) => photo.id));
    setSelectedPhotoIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [allPhotos]);

  if (libraryQuery.isLoading) return <SkeletonState />;
  if (libraryQuery.isError) {
    return <ErrorState error={libraryQuery.error} onRetry={() => libraryQuery.refetch()} />;
  }

  const currentPhoto = photos[currentIndex] ?? null;

  const reorderPhotos = async (draggedId: string, targetId: string) => {
    if (!draggedId || !targetId || draggedId === targetId || updatePhoto.isPending) return;

    const fromIndex = allPhotos.findIndex((photo) => photo.id === draggedId);
    const toIndex = allPhotos.findIndex((photo) => photo.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...allPhotos];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const previousSortOrders = new Map(allPhotos.map((photo) => [photo.id, photo.sortOrder]));
    const updates = reordered
      .map((photo, index) => ({ id: photo.id, sortOrder: index }))
      .filter(({ id, sortOrder }) => previousSortOrders.get(id) !== sortOrder);

    if (updates.length === 0) return;

    try {
      for (const update of updates) {
        await updatePhoto.mutateAsync({
          id: update.id,
          payload: { sortOrder: update.sortOrder },
        });
      }
      toast.push({ message: "Ordem das fotos atualizada.", severity: "success" });
      await libraryQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao reordenar fotos.",
        severity: "error",
      });
    } finally {
      setDragPhotoId(null);
    }
  };

  const allPhotosSelected = allPhotos.length > 0 && selectedPhotoIds.length === allPhotos.length;

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId],
    );
  };

  const toggleSelectAllPhotos = () => {
    setSelectedPhotoIds((prev) => (prev.length === allPhotos.length ? [] : allPhotos.map((photo) => photo.id)));
  };

  const applyBulkLocality = async () => {
    if (selectedPhotoIds.length === 0) {
      toast.push({ message: "Selecione ao menos uma foto.", severity: "warning" });
      return;
    }

    try {
      for (const photoId of selectedPhotoIds) {
        await updatePhoto.mutateAsync({
          id: photoId,
          payload: { localityId: bulkLocalityId || null },
        });
      }
      toast.push({ message: "Localidade atualizada em massa.", severity: "success" });
      setSelectedPhotoIds([]);
      await libraryQuery.refetch();
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao aplicar localidade em massa.",
        severity: "error",
      });
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={1} mb={1.4}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="h4" fontWeight={700}>
              Biblioteca
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Acervo oficial da comissão com galeria de fotos e publicações institucionais.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            size="small"
            startIcon={<EditRoundedIcon fontSize="small" />}
            onClick={() => setDrawerOpen(true)}
            sx={{ alignSelf: { xs: "flex-end", md: "center" }, px: 2.2 }}
          >
            Editar
          </Button>
        )}
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
            {!currentPhoto ? (
              <Box
                sx={{
                  position: "relative",
                  borderRadius: 2,
                  overflow: "hidden",
                  width: "100%",
                  maxWidth: { xs: "100%", md: 920 },
                  mx: "auto",
                  aspectRatio: "16 / 9",
                  minHeight: { xs: 260, md: 360 },
                  bgcolor: "#0E2E3A",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Stack alignItems="center" spacing={1}>
                  <ImageRoundedIcon sx={{ color: "white", fontSize: 44, opacity: 0.8 }} />
                  <Typography sx={{ color: "white" }}>Sem fotos cadastradas</Typography>
                </Stack>
              </Box>
            ) : (
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  maxWidth: { xs: "100%", md: 1800 },
                  mx: "auto",
                  overflow: "hidden",
                  py: 2,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0,
                    height: { xs: 250, md: 480 },
                  }}
                >
                  {[-2, -1, 0, 1, 2].map((offset) => {
                    const idx = (currentIndex + offset + photos.length) % photos.length;
                    const photo = photos[idx];
                    if (!photo) return null;

                    const distance = Math.abs(offset);
                    const isActive = offset === 0;

                    // Tamanhos baseados na distância do centro em proporção de foto horizontal.
                    const sizeScale = isActive ? 1 : distance === 1 ? 0.7 : 0.5;
                    const opacity = isActive ? 1 : distance === 1 ? 0.8 : 0.6;
                    const zIndex = isActive ? 10 : 5 - distance;

                    return (
                      <Box
                        key={`${photo.id}-${offset}`}
                        onClick={() => setCurrentIndex(idx)}
                        sx={{
                          position: "relative",
                          borderRadius: 2,
                          overflow: "hidden",
                          aspectRatio: "4 / 3",
                          width: { xs: `${sizeScale * 100}%`, md: `${sizeScale * 640}px` },
                          maxWidth: { xs: "100%", md: "none" },
                          height: { xs: `${sizeScale * 100}%`, md: `${sizeScale * 480}px` },
                          flexShrink: 0,
                          mx: { xs: -0.5, md: distance === 1 ? -5 : -9 },
                          bgcolor: "#0E2E3A",
                          cursor: offset !== 0 ? "pointer" : "default",
                          opacity,
                          zIndex,
                          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                          transform: isActive ? "scale(1)" : `scale(${sizeScale})`,
                          boxShadow: isActive
                            ? "0 12px 32px rgba(0,0,0,0.4)"
                            : "0 4px 12px rgba(0,0,0,0.2)",
                          "&:hover": {
                            opacity: offset !== 0 ? 0.9 : 1,
                            transform: offset !== 0 ? `scale(${sizeScale * 1.05})` : "scale(1)",
                          },
                        }}
                      >
                        <Box
                          component="img"
                          src={getPhotoUrl(photo)}
                          alt={photo.title}
                          sx={{ width: "100%", height: "100%", objectFit: "contain", bgcolor: "#0E2E3A" }}
                        />
                      </Box>
                    );
                  })}
                </Box>
                {photos.length > 1 && (
                  <>
                    <IconButton
                      onClick={() => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)}
                      sx={{
                        position: "absolute",
                        left: { xs: 5, md: 10 },
                        top: "50%",
                        transform: "translateY(-50%)",
                        bgcolor: "rgba(255,255,255,0.92)",
                        zIndex: 20,
                        "&:hover": { bgcolor: "rgba(255,255,255,1)" },
                      }}
                    >
                      <ArrowBackIosNewRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      onClick={() => setCurrentIndex((prev) => (prev + 1) % photos.length)}
                      sx={{
                        position: "absolute",
                        right: { xs: 5, md: 10 },
                        top: "50%",
                        transform: "translateY(-50%)",
                        bgcolor: "rgba(255,255,255,0.92)",
                        zIndex: 20,
                        "&:hover": { bgcolor: "rgba(255,255,255,1)" },
                      }}
                    >
                      <ArrowForwardIosRoundedIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            )}
            {photos.length > 0 && (
              <Stack alignItems="center" spacing={0.8} mt={1.2}>
                <Typography variant="caption" color="text.secondary">
                  Foto {currentIndex + 1} de {photos.length}
                </Typography>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap justifyContent="center">
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
              </Stack>
            )}
            {currentPhoto && currentPhoto.title && (
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
            Publicações da Comissão
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
            Cartilhas, normativos e demais materiais institucionais para consulta rápida.
          </Typography>

          {documents.length === 0 ? (
            <EmptyState title="Nenhuma publicação" description="Inclua as publicações produzidas pela comissão." />
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
                      <Tooltip title="Abrir publicação">
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
                  Configure o carrossel de fotos e gerencie as publicações da comissão.
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
                      {uploadPhoto.isPending ? "Enviando..." : "Enviar foto(s)"}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        multiple
                        onChange={async (event) => {
                          const files = Array.from(event.target.files || []);
                          if (files.length === 0) return;
                          
                          const title = newPhotoTitle.trim() || undefined;
                          const localityId = newPhotoLocalityId || undefined;
                          
                          setNewPhotoTitle("");
                          setNewPhotoLocalityId("");
                          
                          let successCount = 0;
                          let errorCount = 0;
                          
                          for (const file of files) {
                            try {
                              await uploadPhoto.mutateAsync({
                                file,
                                title: files.length === 1 ? title : undefined, // Só usa título se for uma foto só
                                localityId,
                              });
                              successCount++;
                            } catch (error) {
                              errorCount++;
                              console.error("Erro ao enviar foto:", error);
                            }
                          }
                          
                          // Force immediate refetch
                          await libraryQuery.refetch();
                          
                          if (successCount > 0 && errorCount === 0) {
                            toast.push({ 
                              message: files.length === 1 ? "Foto adicionada." : `${successCount} foto(s) adicionada(s).`, 
                              severity: "success" 
                            });
                          } else if (successCount > 0 && errorCount > 0) {
                            toast.push({ 
                              message: `${successCount} foto(s) adicionada(s), ${errorCount} erro(s).`, 
                              severity: "warning" 
                            });
                          } else {
                            toast.push({
                              message: parseApiError(new Error("Erro ao enviar fotos.")).message ?? "Erro ao enviar fotos.",
                              severity: "error",
                            });
                          }
                          
                          event.target.value = "";
                        }}
                      />
                    </Button>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
                      <TextField
                        select
                        size="small"
                        label="Localidade em massa"
                        value={bulkLocalityId}
                        onChange={(event) => setBulkLocalityId(event.target.value)}
                        sx={{ minWidth: { xs: "100%", md: 260 } }}
                      >
                        <MenuItem value="">Sem localidade</MenuItem>
                        {localities.map((loc) => (
                          <MenuItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        disabled={updatePhoto.isPending || selectedPhotoIds.length === 0}
                        onClick={applyBulkLocality}
                      >
                        Aplicar aos selecionados ({selectedPhotoIds.length})
                      </Button>
                    </Stack>
                  </Stack>

                  {allPhotos.length === 0 ? (
                    <EmptyState title="Nenhuma foto" description="Adicione fotos para o carrossel da Biblioteca." />
                  ) : (
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: "primary.main" }}>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 56, py: 0.6 }}>
                              <Checkbox
                                checked={allPhotosSelected}
                                indeterminate={selectedPhotoIds.length > 0 && !allPhotosSelected}
                                onChange={toggleSelectAllPhotos}
                                sx={{ color: "white", "&.Mui-checked": { color: "white" }, "&.MuiCheckbox-indeterminate": { color: "white" } }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 88 }}>Preview</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: "38%" }}>Título</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: "32%" }}>Localidade</TableCell>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 138 }} align="right">Ações</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allPhotos.map((photo) => {
                            const titleDraft = photoTitleDrafts[photo.id] ?? photo.title;
                            const localityDraft = photoLocalityDrafts[photo.id] ?? photo.localityId ?? "";
                            return (
                              <TableRow
                                key={photo.id}
                                hover
                                draggable
                                onDragStart={(event) => {
                                  setDragPhotoId(photo.id);
                                  event.dataTransfer.setData("text/library-photo-id", photo.id);
                                  event.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const draggedId =
                                    event.dataTransfer.getData("text/library-photo-id") || dragPhotoId || "";
                                  void reorderPhotos(draggedId, photo.id);
                                }}
                                onDragEnd={() => setDragPhotoId(null)}
                                sx={{
                                  cursor: "move",
                                  opacity: dragPhotoId === photo.id ? 0.55 : 1,
                                }}
                              >
                                <TableCell sx={{ py: 0.6 }}>
                                  <Checkbox
                                    checked={selectedPhotoIds.includes(photo.id)}
                                    onChange={() => togglePhotoSelection(photo.id)}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                <Box
                                  component="img"
                                  src={getPhotoUrl(photo)}
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

              {/* Gestão de Publicações */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                    Gestão de Publicações
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.5 }}>
                    <TextField
                      size="small"
                      label="Título da nova publicação (opcional)"
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
                      {uploadDocument.isPending ? "Enviando..." : "Enviar publicação"}
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
                            toast.push({ message: "Publicação adicionada.", severity: "success" });
                            libraryQuery.refetch();
                          } catch (error) {
                            toast.push({
                              message: parseApiError(error).message ?? "Erro ao enviar publicação.",
                              severity: "error",
                            });
                          }
                          event.target.value = "";
                        }}
                      />
                    </Button>
                  </Stack>

                  {documents.length === 0 ? (
                    <EmptyState title="Nenhuma publicação" description="Inclua as publicações produzidas pela comissão." />
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
                                        toast.push({ message: "Publicação atualizada.", severity: "success" });
                                        libraryQuery.refetch();
                                      } catch (error) {
                                        toast.push({
                                          message: parseApiError(error).message ?? "Erro ao atualizar publicação.",
                                          severity: "error",
                                        });
                                      }
                                    }}
                                    disabled={updateDocument.isPending}
                                  >
                                    Salvar
                                  </Button>
                                  <Tooltip title="Excluir publicação">
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={async () => {
                                          try {
                                            await deleteDocument.mutateAsync(document.id);
                                            toast.push({ message: "Publicação excluída.", severity: "success" });
                                            libraryQuery.refetch();
                                          } catch (error) {
                                            toast.push({
                                              message: parseApiError(error).message ?? "Erro ao excluir publicação.",
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
