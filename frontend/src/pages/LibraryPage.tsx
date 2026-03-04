import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
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
import { useEffect, useMemo, useState } from "react";
import {
  useDeleteLibraryDocument,
  useDeleteLibraryPhoto,
  useLibrary,
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
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type LibraryPhoto = {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
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
  const updateSettings = useUpdateLibrarySettings();
  const uploadPhoto = useUploadLibraryPhoto();
  const updatePhoto = useUpdateLibraryPhoto();
  const deletePhoto = useDeleteLibraryPhoto();
  const uploadDocument = useUploadLibraryDocument();
  const updateDocument = useUpdateLibraryDocument();
  const deleteDocument = useDeleteLibraryDocument();
  const canManage = hasAnyRole(me, [ROLE_TI, ROLE_COORDENACAO_CIPAVD]);

  const photos = useMemo(
    () => ((libraryQuery.data?.photos ?? []) as LibraryPhoto[]).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [libraryQuery.data?.photos],
  );
  const documents = useMemo(
    () => (libraryQuery.data?.documents ?? []) as LibraryDocument[],
    [libraryQuery.data?.documents],
  );
  const intervalFromApi = Number(libraryQuery.data?.settings?.carouselIntervalSeconds ?? 5);

  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoTitleDrafts, setPhotoTitleDrafts] = useState<Record<string, string>>({});
  const [photoOrderDrafts, setPhotoOrderDrafts] = useState<Record<string, number>>({});
  const [documentTitleDrafts, setDocumentTitleDrafts] = useState<Record<string, string>>({});
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
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

  if (libraryQuery.isLoading) return <SkeletonState />;
  if (libraryQuery.isError) {
    return <ErrorState error={libraryQuery.error} onRetry={() => libraryQuery.refetch()} />;
  }

  const currentPhoto = photos[currentIndex] ?? null;

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1} mb={1.4}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Biblioteca
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Acervo oficial da comissão com galeria de fotos e documentos institucionais.
          </Typography>
        </Box>
        {canManage && (
          <Chip
            color="success"
            variant="outlined"
            label="Perfil com permissão de gestão"
            sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
          />
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Carrossel de Fotos
              </Typography>
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

            {canManage && (
              <Box sx={{ width: { xs: "100%", lg: 320 } }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  Configuração
                </Typography>
                <Stack spacing={1.2}>
                  <TextField
                    select
                    size="small"
                    label="Troca automática"
                    value={String(intervalSeconds)}
                    onChange={(event) => setIntervalSeconds(Number(event.target.value))}
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
                    disabled={!canManage || updateSettings.isPending || intervalSeconds === intervalFromApi}
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
                  >
                    Salvar intervalo
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Gestão de Fotos
          </Typography>
          {canManage && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.2 }}>
              <TextField
                size="small"
                label="Título da nova foto (opcional)"
                value={newPhotoTitle}
                onChange={(event) => setNewPhotoTitle(event.target.value)}
                fullWidth
              />
              <Button
                component="label"
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<UploadRoundedIcon fontSize="small" />}
                disabled={uploadPhoto.isPending}
                sx={{ alignSelf: { xs: "stretch", md: "flex-start" }, minWidth: { xs: "auto", md: 140 } }}
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
                      await uploadPhoto.mutateAsync({ file, title: newPhotoTitle.trim() || undefined });
                      setNewPhotoTitle("");
                      toast.push({ message: "Foto adicionada.", severity: "success" });
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
          )}

          {photos.length === 0 ? (
            <EmptyState title="Nenhuma foto" description="Adicione fotos para o carrossel da Biblioteca." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Preview</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Título</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700, width: 120 }}>Ordem</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }} align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {photos.map((photo) => {
                  const titleDraft = photoTitleDrafts[photo.id] ?? photo.title;
                  const orderDraft = photoOrderDrafts[photo.id] ?? photo.sortOrder;
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
                          disabled={!canManage}
                          fullWidth
                        />
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
                          disabled={!canManage}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.8} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={async () => {
                              try {
                                await updatePhoto.mutateAsync({
                                  id: photo.id,
                                  payload: { title: titleDraft.trim(), sortOrder: orderDraft },
                                });
                                toast.push({ message: "Foto atualizada.", severity: "success" });
                              } catch (error) {
                                toast.push({
                                  message: parseApiError(error).message ?? "Erro ao atualizar foto.",
                                  severity: "error",
                                });
                              }
                            }}
                            disabled={!canManage || updatePhoto.isPending}
                          >
                            Salvar
                          </Button>
                          <Tooltip title="Excluir foto">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={!canManage || deletePhoto.isPending}
                                onClick={async () => {
                                  try {
                                    await deletePhoto.mutateAsync(photo.id);
                                    toast.push({ message: "Foto excluída.", severity: "success" });
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
          )}
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

          {canManage && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.2 }}>
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
                sx={{ alignSelf: { xs: "stretch", md: "flex-start" }, minWidth: { xs: "auto", md: 160 } }}
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
          )}

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
                          disabled={!canManage}
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
                            onClick={() => window.open(toApiUrl(document.fileUrl), "_blank")}
                          >
                            Abrir
                          </Button>
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
                              } catch (error) {
                                toast.push({
                                  message: parseApiError(error).message ?? "Erro ao atualizar documento.",
                                  severity: "error",
                                });
                              }
                            }}
                            disabled={!canManage || updateDocument.isPending}
                          >
                            Salvar
                          </Button>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              try {
                                await deleteDocument.mutateAsync(document.id);
                                toast.push({ message: "Documento excluído.", severity: "success" });
                              } catch (error) {
                                toast.push({
                                  message: parseApiError(error).message ?? "Erro ao excluir documento.",
                                  severity: "error",
                                });
                              }
                            }}
                            disabled={!canManage || deleteDocument.isPending}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <Divider sx={{ my: 1.2 }} />
          <Typography variant="caption" color="text.secondary">
            Permissões de edição: TI e Coordenação CIPAVD. Demais perfis podem visualizar e abrir os arquivos.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

