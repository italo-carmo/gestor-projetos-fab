import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
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
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
  useActivities,
  useExportActivityReportPdf,
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
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = String(api.defaults.baseURL ?? "/api").replace(/\/$/, "");
  if (!baseUrl) return normalizedPath;
  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    return `${baseUrl}${normalizedPath}`;
  }
  if (normalizedPath.startsWith("/api/")) return normalizedPath;
  if (baseUrl.startsWith("/")) {
    return `${baseUrl}${normalizedPath}`;
  }
  return `${window.location.origin}/${baseUrl.replace(/^\//, "")}${normalizedPath}`;
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

function normalizePossiblyMojibake(value: string | null | undefined) {
  const text = String(value ?? "");
  if (!text) return "";
  if (!/[ÃÂÌ]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
    return decoded || text;
  } catch {
    return text;
  }
}

function getDocumentType(value: { fileName?: string | null; title?: string | null }) {
  const fromFileName = String(value.fileName ?? "")
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();
  const fromTitle = String(value.title ?? "")
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();
  const extension = fromFileName || fromTitle || "";
  if (!extension) return "Arquivo";
  return extension.slice(0, 6).toUpperCase();
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
  const activitiesQuery = useActivities({ pageSize: '1000' }); // Get all activities to filter those with reports
  const exportReportPdf = useExportActivityReportPdf();
  const canManage = hasAnyRole(me, [ROLE_TI, ROLE_COORDENACAO_CIPAVD]);

  const allPhotos = useMemo(
    () => ((libraryQuery.data?.photos ?? []) as LibraryPhoto[]).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [libraryQuery.data?.photos],
  );

  const documents = useMemo(
    () => (libraryQuery.data?.documents ?? []) as LibraryDocument[],
    [libraryQuery.data?.documents],
  );
  
  // Filter activities that have reports
  const activitiesWithReports = useMemo(() => {
    const items = (activitiesQuery.data?.items ?? []) as any[];
    return items.filter((activity) => activity.report != null).map((activity) => ({
      id: activity.id,
      title: activity.title,
      locality: activity.locality?.name ?? activity.locality?.code ?? '—',
      eventDate: activity.eventDate,
      reportDate: activity.report?.date,
      createdAt: activity.createdAt,
    }));
  }, [activitiesQuery.data?.items]);
  
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
  const [carouselIndicesByLocality, setCarouselIndicesByLocality] = useState<Record<string, number>>({});
  const [mainCarouselIndex, setMainCarouselIndex] = useState(0);
  const MAIN_VISIBLE_CARDS = 6;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"photos" | "documents">("photos");
  const [editingLocalityId, setEditingLocalityId] = useState<string>("");
  const [expandedLocalityId, setExpandedLocalityId] = useState<string | null>(null);
  const [expandedPhotoIndex, setExpandedPhotoIndex] = useState(0);
  const [photoTitleDrafts, setPhotoTitleDrafts] = useState<Record<string, string>>({});
  const [photoLocalityDrafts, setPhotoLocalityDrafts] = useState<Record<string, string>>({});
  const [documentTitleDrafts, setDocumentTitleDrafts] = useState<Record<string, string>>({});
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoLocalityId, setNewPhotoLocalityId] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [bulkLocalityId, setBulkLocalityId] = useState<string>("");
    const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
    const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => {
    setIntervalSeconds(Math.max(2, Math.min(60, intervalFromApi)));
  }, [intervalFromApi]);

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

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId],
    );
  };

  const toggleSelectAllPhotos = () => {
    const tableIds = tablePhotos.map((photo) => photo.id);
    const allSelected = tableIds.length > 0 && tableIds.every((id) => selectedPhotoIds.includes(id));
    setSelectedPhotoIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !tableIds.includes(id));
      }
      const merged = new Set([...prev, ...tableIds]);
      return Array.from(merged);
    });
  };

  const applyBulkLocality = async () => {
    if (selectedIdsForBulkAction.length === 0) {
      toast.push({ message: "Selecione ao menos uma foto.", severity: "warning" });
      return;
    }

    try {
      for (const photoId of selectedIdsForBulkAction) {
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
  const downloadDocument = async (doc: LibraryDocument) => {
    if (downloadingDocumentId === doc.id) return; // Prevent multiple clicks
    setDownloadingDocumentId(doc.id);
    toast.push({
      message: "Baixando arquivo...",
      severity: "info",
    });
    try {
      const response = await api.get(`/library/documents/${doc.id}/download`, { responseType: "blob" });
      const blob = response.data as Blob;
      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty file response");
      }
      const directUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = directUrl;
      link.download = String(doc.fileName || doc.title || "publicacao").trim();
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(directUrl), 1200);
      toast.push({
        message: "Download concluído.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Arquivo indisponível para download.",
        severity: "error",
      });
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const downloadActivityReport = async (activityId: string, activityTitle: string) => {
    if (downloadingReportId === activityId) return; // Prevent multiple clicks
    setDownloadingReportId(activityId);
    toast.push({
      message: "Baixando relatório...",
      severity: "info",
    });
    try {
      const response = await api.get(`/activities/${activityId}/report/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      if (!blob || blob.size === 0) {
        throw new Error("Empty file response");
      }
      const directUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = directUrl;
      const sanitizedTitle = String(activityTitle || "relatorio").trim().replace(/[^a-z0-9]/gi, "_");
      link.download = `${sanitizedTitle}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(directUrl), 1200);
      toast.push({
        message: "Download concluído.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Relatório indisponível para download.",
        severity: "error",
      });
    } finally {
      setDownloadingReportId(null);
    }
  };

  const photosByLocality = useMemo(() => {
    const grouped = new Map<string, LibraryPhoto[]>();
    for (const locality of localities) {
      grouped.set(locality.id, []);
    }
    for (const photo of allPhotos) {
      if (!photo.localityId) continue;
      if (!grouped.has(photo.localityId)) grouped.set(photo.localityId, []);
      grouped.get(photo.localityId)?.push(photo);
    }
    return grouped;
  }, [allPhotos, localities]);

  useEffect(() => {
    setCarouselIndicesByLocality((prev) => {
      const next: Record<string, number> = {};
      for (const locality of localities) {
        const count = photosByLocality.get(locality.id)?.length ?? 0;
        const prevIndex = prev[locality.id] ?? 0;
        next[locality.id] = count > 0 ? prevIndex % count : 0;
      }
      return next;
    });
  }, [localities, photosByLocality]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCarouselIndicesByLocality((prev) => {
        const next = { ...prev };
        for (const locality of localities) {
          const items = photosByLocality.get(locality.id) ?? [];
          if (items.length <= 1) continue;
          const current = next[locality.id] ?? 0;
          next[locality.id] = (current + 1) % items.length;
        }
        return next;
      });
    }, Math.max(2, intervalSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [intervalSeconds, localities, photosByLocality]);

  // Main carousel for localities: rotate one card to the left each tick (infinite loop)
  useEffect(() => {
    if (localities.length <= 1) return;
    const timer = window.setInterval(() => {
      setMainCarouselIndex((prev) => (prev + 1) % localities.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [localities.length]);

  const orderedLocalities = useMemo(() => {
    if (localities.length === 0) return [];
    return localities.map((_, offset) => {
      const index = (mainCarouselIndex + offset) % localities.length;
      return localities[index];
    });
  }, [localities, mainCarouselIndex]);

  const handleMainCarouselPrev = () => {
    if (localities.length <= 1) return;
    setMainCarouselIndex((prev) => (prev - 1 + localities.length) % localities.length);
  };

  const handleMainCarouselNext = () => {
    if (localities.length <= 1) return;
    setMainCarouselIndex((prev) => (prev + 1) % localities.length);
  };

  const tablePhotos = useMemo(() => {
    if (!editingLocalityId) return allPhotos;
    return allPhotos.filter((photo) => photo.localityId === editingLocalityId);
  }, [allPhotos, editingLocalityId]);

  const selectedInTableCount = useMemo(
    () => tablePhotos.filter((photo) => selectedPhotoIds.includes(photo.id)).length,
    [tablePhotos, selectedPhotoIds],
  );
  const selectedIdsForBulkAction = useMemo(() => {
    if (!editingLocalityId) return selectedPhotoIds;
    const tableIds = new Set(tablePhotos.map((photo) => photo.id));
    return selectedPhotoIds.filter((id) => tableIds.has(id));
  }, [editingLocalityId, tablePhotos, selectedPhotoIds]);

  const allPhotosSelected = tablePhotos.length > 0 && selectedInTableCount === tablePhotos.length;
  const expandedPhotos = useMemo(
    () => (expandedLocalityId ? photosByLocality.get(expandedLocalityId) ?? [] : []),
    [expandedLocalityId, photosByLocality],
  );
  const expandedLocality = useMemo(
    () => localities.find((loc) => loc.id === expandedLocalityId) ?? null,
    [localities, expandedLocalityId],
  );

  useEffect(() => {
    if (!expandedLocalityId) return;
    if (expandedPhotos.length === 0) {
      setExpandedPhotoIndex(0);
      return;
    }
    setExpandedPhotoIndex((prev) => prev % expandedPhotos.length);
  }, [expandedLocalityId, expandedPhotos.length]);

  useEffect(() => {
    if (!expandedLocalityId || expandedPhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setExpandedPhotoIndex((prev) => (prev + 1) % expandedPhotos.length);
    }, Math.max(2, intervalSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [expandedLocalityId, expandedPhotos.length, intervalSeconds]);

  if (libraryQuery.isLoading) return <SkeletonState />;
  if (libraryQuery.isError) {
    return <ErrorState error={libraryQuery.error} onRetry={() => libraryQuery.refetch()} />;
  }

  return (
    <Box sx={{ overflowX: "clip" }}>
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
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          {localities.length === 0 ? (
            <EmptyState title="Nenhuma localidade disponível" description="Cadastre localidade SMIF para gerar novos carrosséis." />
          ) : (
            <Box sx={{ position: 'relative' }}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'hidden',
                  scrollBehavior: 'smooth',
                  px: { xs: 4.5, md: 5.5 },
                  alignItems: 'stretch',
                }}
              >
                {orderedLocalities.map((locality) => {
                const localityPhotos = photosByLocality.get(locality.id) ?? [];
                const currentIndex = carouselIndicesByLocality[locality.id] ?? 0;
                const currentPhoto = localityPhotos[currentIndex] ?? null;
                return (
                  <Card
                    key={locality.id}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid rgba(17,66,89,0.14)",
                      overflow: "hidden",
                      position: "relative",
                      transition: "transform 160ms ease, box-shadow 160ms ease",
                      flex: {
                        xs: '0 0 100%',
                        sm: '0 0 calc(50% - 8px)',
                        md: '0 0 calc(33.333% - 10.67px)',
                        lg: `0 0 calc(${100 / MAIN_VISIBLE_CARDS}% - 13.34px)`,
                      },
                      minWidth: {
                        xs: '100%',
                        sm: 'calc(50% - 8px)',
                        md: 'calc(33.333% - 10.67px)',
                        lg: `calc(${100 / MAIN_VISIBLE_CARDS}% - 13.34px)`,
                      },
                      maxWidth: {
                        xs: '100%',
                        sm: 'calc(50% - 8px)',
                        md: 'calc(33.333% - 10.67px)',
                        lg: `calc(${100 / MAIN_VISIBLE_CARDS}% - 13.34px)`,
                      },
                      display: "flex",
                      flexDirection: "column",
                      height: 292,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 10px 24px rgba(17,66,89,0.16)",
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.2, pt: 1.2, pb: 0.6 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={700} noWrap>
                          {locality.code || locality.name}
              </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {locality.name}
                        </Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={0.6}>
                        <Chip
                size="small"
                          label={localityPhotos.length ? `${Math.min(currentIndex + 1, localityPhotos.length)}/${localityPhotos.length}` : "0/0"}
                          variant="outlined"
                        />
                        {canManage && (
                          <Tooltip title={`Editar fotos de ${locality.name}`}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setDrawerMode("photos");
                                setEditingLocalityId(locality.id);
                                setNewPhotoLocalityId(locality.id);
                                setDrawerOpen(true);
                }}
              >
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
            </Stack>
            <Box
              sx={{
                        height: 206,
                        backgroundColor: "#0E2E3A",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                overflow: "hidden",
                        cursor: currentPhoto ? "zoom-in" : "default",
              }}
                      onClick={() => {
                        if (!currentPhoto) return;
                        setExpandedLocalityId(locality.id);
                        setExpandedPhotoIndex(currentIndex);
                      }}
                    >
                      {currentPhoto ? (
                  <Box
                    component="img"
                    src={getPhotoUrl(currentPhoto)}
                          alt={currentPhoto.title || `Foto ${locality.name}`}
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "center",
                            display: "block",
                            transition: "opacity 220ms ease-in-out",
                          }}
                        />
                      ) : (
                        <Stack alignItems="center" spacing={0.8}>
                          <ImageRoundedIcon sx={{ color: "white", fontSize: 34, opacity: 0.88 }} />
                          <Typography sx={{ color: "white", fontSize: 12 }}>Sem fotos</Typography>
                        </Stack>
              )}
            </Box>
                    <CardContent sx={{ pt: 0.7, pb: 0.5, minHeight: 54 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          minHeight: 32,
                          fontWeight: 600,
                          fontSize: 13,
                          lineHeight: 1.2,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {currentPhoto?.title?.trim() || "Sem título"}
              </Typography>
                    </CardContent>
                  </Card>
                );
              })}
              </Box>
              {localities.length > 1 && (
                <>
                  <IconButton
                    size="small"
                    onClick={handleMainCarouselPrev}
                    sx={{
                      position: 'absolute',
                      left: 2,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                      bgcolor: 'rgba(17,66,89,0.12)',
                      '&:hover': { bgcolor: 'rgba(17,66,89,0.2)' },
                    }}
                  >
                    <ArrowBackIosNewRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleMainCarouselNext}
                    sx={{
                      position: 'absolute',
                      right: 2,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                      bgcolor: 'rgba(17,66,89,0.12)',
                      '&:hover': { bgcolor: 'rgba(17,66,89,0.2)' },
                    }}
                  >
                    <ArrowForwardIosRoundedIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={1} sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Publicações da Comissão
          </Typography>
            {canManage && (
              <Button
                variant="contained"
                size="small"
                startIcon={<EditRoundedIcon fontSize="small" />}
                onClick={() => {
                  setDrawerMode("documents");
                  setEditingLocalityId("");
                  setDrawerOpen(true);
                }}
                sx={{ alignSelf: { xs: "flex-end", md: "center" }, px: 2.2 }}
              >
                Editar
              </Button>
            )}
          </Stack>
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
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Tipo</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Tamanho</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Publicado em</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }} align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow
                    key={document.id}
                    hover
                    onClick={() => {
                      if (downloadingDocumentId !== document.id) {
                        void downloadDocument(document);
                      }
                    }}
                    sx={{ cursor: downloadingDocumentId === document.id ? "wait" : "pointer", opacity: downloadingDocumentId === document.id ? 0.6 : 1 }}
                  >
                    <TableCell sx={{ minWidth: 260, fontWeight: 500 }}>
                      {normalizePossiblyMojibake(document.title)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={getDocumentType(document)}
                      />
                    </TableCell>
                    <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                    <TableCell>{new Date(document.createdAt).toLocaleString("pt-BR")}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={downloadingDocumentId === document.id ? "Baixando..." : "Baixar publicação"}>
                        <span>
                        <IconButton
                          size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (downloadingDocumentId !== document.id) {
                                void downloadDocument(document);
                              }
                            }}
                            disabled={downloadingDocumentId === document.id}
                          sx={{ color: "primary.main" }}
                        >
                          <OpenInNewRoundedIcon fontSize="small" />
                        </IconButton>
                        </span>
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

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={1} sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Relatórios das Atividades
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
            Relatórios completos das atividades de campo realizadas pela comissão.
          </Typography>

          {activitiesQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">Carregando relatórios...</Typography>
          ) : activitiesWithReports.length === 0 ? (
            <EmptyState title="Nenhum relatório disponível" description="Os relatórios das atividades aparecerão aqui quando forem criados." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Atividade</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Localidade</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Data do Evento</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }}>Data do Relatório</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 700 }} align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activitiesWithReports.map((activity) => {
                  const formatDate = (dateStr: string | null | undefined) => {
                    if (!dateStr) return '—';
                    const date = new Date(dateStr);
                    const day = String(date.getUTCDate()).padStart(2, '0');
                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const year = date.getUTCFullYear();
                    return `${day}/${month}/${year}`;
                  };
                  return (
                    <TableRow
                      key={activity.id}
                      hover
                      onClick={() => {
                        if (downloadingReportId !== activity.id) {
                          void downloadActivityReport(activity.id, activity.title);
                        }
                      }}
                      sx={{ cursor: downloadingReportId === activity.id ? "wait" : "pointer", opacity: downloadingReportId === activity.id ? 0.6 : 1 }}
                    >
                      <TableCell sx={{ minWidth: 260, fontWeight: 500 }}>
                        {activity.title}
                      </TableCell>
                      <TableCell>{activity.locality}</TableCell>
                      <TableCell>{formatDate(activity.eventDate)}</TableCell>
                      <TableCell>{formatDate(activity.reportDate)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={downloadingReportId === activity.id ? "Baixando..." : "Baixar relatório"}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (downloadingReportId !== activity.id) {
                                  void downloadActivityReport(activity.id, activity.title);
                                }
                              }}
                              disabled={downloadingReportId === activity.id}
                              sx={{ color: "primary.main" }}
                            >
                              <OpenInNewRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
              width: { xs: "100%", md: drawerMode === "documents" ? 1080 : 1200 },
              top: 76,
              height: "calc(100% - 76px)",
            },
          }}
        >
          <Box sx={{ height: "100%", overflowY: "auto", p: 3 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                  {drawerMode === "photos" ? "Gerenciar Fotos da Biblioteca" : "Gerenciar Publicações da Comissão"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {drawerMode === "photos"
                    ? editingLocalityId
                      ? `Gerencie as fotos de ${localities.find((loc) => loc.id === editingLocalityId)?.name ?? "localidade selecionada"}.`
                      : "Configure o carrossel e gerencie as fotos."
                    : "Gerencie títulos e arquivos das publicações institucionais."}
                </Typography>
              </Box>

              {drawerMode === "photos" && (
                <>
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
                          setNewPhotoLocalityId(editingLocalityId || "");
                          
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
                        disabled={updatePhoto.isPending || selectedInTableCount === 0}
                        onClick={applyBulkLocality}
                      >
                        Aplicar aos selecionados ({selectedInTableCount})
                    </Button>
                    </Stack>
                  </Stack>

                  {tablePhotos.length === 0 ? (
                    <EmptyState title="Nenhuma foto" description="Adicione fotos para o carrossel da Biblioteca." />
                  ) : (
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: "primary.main" }}>
                            <TableCell sx={{ color: "white", fontWeight: 700, width: 56, py: 0.6 }}>
                              <Checkbox
                                checked={allPhotosSelected}
                                indeterminate={selectedInTableCount > 0 && !allPhotosSelected}
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
                          {tablePhotos.map((photo) => {
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
                </>
              )}

              {drawerMode === "documents" && (
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
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<UploadRoundedIcon fontSize="small" />}
                      disabled={uploadDocument.isPending}
                      sx={{
                        minWidth: { xs: "auto", md: 180 },
                        minHeight: 36,
                        height: 36,
                        px: 2,
                        alignSelf: { xs: "flex-start", md: "center" },
                        whiteSpace: "nowrap",
                      }}
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
              )}
            </Stack>
          </Box>
        </Drawer>
      )}
      <Dialog
        open={Boolean(expandedLocalityId)}
        onClose={() => setExpandedLocalityId(null)}
        maxWidth="xl"
        fullWidth
      >
        <Box sx={{ position: "relative", bgcolor: "#081E27" }}>
          <IconButton
            onClick={() => setExpandedLocalityId(null)}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 3,
              color: "white",
              bgcolor: "rgba(0,0,0,0.28)",
              "&:hover": { bgcolor: "rgba(0,0,0,0.46)" },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
          <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" spacing={1} sx={{ px: 2, pt: 1.2, pb: 1 }}>
            <Typography sx={{ color: "white", fontWeight: 700 }}>
              {expandedLocality?.name ?? "Localidade"}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.82)" }}>
              {expandedPhotos.length > 0 ? `Foto ${Math.min(expandedPhotoIndex + 1, expandedPhotos.length)} de ${expandedPhotos.length}` : "Sem fotos"}
            </Typography>
          </Stack>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: { xs: "58vh", md: "72vh" },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              px: { xs: 1.2, md: 2.4 },
              pb: 1.6,
            }}
          >
            {expandedPhotos.length > 0 ? (
              <Box
                component="img"
                src={getPhotoUrl(expandedPhotos[expandedPhotoIndex])}
                alt={expandedPhotos[expandedPhotoIndex]?.title || "Foto da localidade"}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  borderRadius: 1.5,
                  backgroundColor: "#0E2E3A",
                }}
              />
            ) : (
              <Stack alignItems="center" spacing={1}>
                <ImageRoundedIcon sx={{ color: "white", fontSize: 42, opacity: 0.86 }} />
                <Typography sx={{ color: "white" }}>Sem fotos nesta localidade</Typography>
              </Stack>
            )}
            {expandedPhotos.length > 1 && (
              <>
                <IconButton
                  onClick={() =>
                    setExpandedPhotoIndex((prev) => (prev - 1 + expandedPhotos.length) % expandedPhotos.length)
                  }
                  sx={{
                    position: "absolute",
                    left: { xs: 12, md: 24 },
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "white",
                    bgcolor: "rgba(0,0,0,0.32)",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                  }}
                >
                  <ArrowBackIosNewRoundedIcon />
                </IconButton>
                <IconButton
                  onClick={() =>
                    setExpandedPhotoIndex((prev) => (prev + 1) % expandedPhotos.length)
                  }
                  sx={{
                    position: "absolute",
                    right: { xs: 12, md: 24 },
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "white",
                    bgcolor: "rgba(0,0,0,0.32)",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                  }}
                >
                  <ArrowForwardIosRoundedIcon />
                </IconButton>
              </>
            )}
          </Box>
          {expandedPhotos.length > 0 && (
            <Typography
              variant="body2"
              sx={{
                px: 2,
                pb: 2,
                color: "rgba(255,255,255,0.92)",
                fontWeight: 600,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {expandedPhotos[expandedPhotoIndex]?.title?.trim() || "Sem título"}
            </Typography>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}
