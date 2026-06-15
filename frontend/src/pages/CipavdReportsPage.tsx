import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { useToast } from "../app/toast";
import { useDebounce } from "../app/useDebounce";
import {
  useCipavdReportFolderOptions,
  useCipavdReports,
  useCreateCipavdReportFolder,
  useDeleteCipavdReportFile,
  useDeleteCipavdReportFolder,
  useDownloadCipavdReportFile,
  useMe,
  useUpdateCipavdReportFile,
  useUpdateCipavdReportFolder,
  useUploadCipavdReportFile,
  type CipavdReportFile,
  type CipavdReportFolder,
} from "../api/hooks";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type ViewMode = "list" | "grid";
type DriveTarget =
  | { type: "folder"; item: CipavdReportFolder }
  | { type: "file"; item: CipavdReportFile };

function formatBytes(value?: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fileExtension(file: CipavdReportFile) {
  return (
    String(file.name || file.fileName)
      .split(".")
      .pop()
      ?.toLowerCase() || ""
  );
}

function FileIcon({ file }: { file: CipavdReportFile }) {
  const extension = fileExtension(file);
  if (extension === "pdf") {
    return <PictureAsPdfRoundedIcon sx={{ color: "#D93025" }} />;
  }
  if (extension === "docx") {
    return <DescriptionRoundedIcon sx={{ color: "#1A73E8" }} />;
  }
  return <InsertDriveFileRoundedIcon sx={{ color: "text.secondary" }} />;
}

function Actions(props: {
  target: DriveTarget;
  canUpdate: boolean;
  canDelete: boolean;
  canDownload: boolean;
  onRename: (target: DriveTarget) => void;
  onMove: (target: DriveTarget) => void;
  onDelete: (target: DriveTarget) => void;
  onDownload: (file: CipavdReportFile) => void;
}) {
  const fileTarget = props.target.type === "file" ? props.target.item : null;
  return (
    <Stack direction="row" spacing={0.25} justifyContent="flex-end">
      {fileTarget && props.canDownload ? (
        <Tooltip title="Baixar">
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              props.onDownload(fileTarget);
            }}
          >
            <DownloadRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      {props.canUpdate ? (
        <>
          <Tooltip title="Renomear">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                props.onRename(props.target);
              }}
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Mover">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                props.onMove(props.target);
              }}
            >
              <DriveFileMoveRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ) : null}
      {props.canDelete ? (
        <Tooltip title="Excluir">
          <IconButton
            size="small"
            color="error"
            onClick={(event) => {
              event.stopPropagation();
              props.onDelete(props.target);
            }}
          >
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

export function CipavdReportsPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = String(searchParams.get("folderId") ?? "").trim();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<DriveTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveTarget, setMoveTarget] = useState<DriveTarget | null>(null);
  const [moveFolderId, setMoveFolderId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DriveTarget | null>(null);

  const reportsQuery = useCipavdReports({
    folderId: currentFolderId || undefined,
    q: debouncedSearch || undefined,
  });
  const folderOptionsQuery = useCipavdReportFolderOptions(
    moveTarget?.type === "folder" ? moveTarget.item.id : null,
    Boolean(moveTarget),
  );
  const createFolder = useCreateCipavdReportFolder();
  const updateFolder = useUpdateCipavdReportFolder();
  const deleteFolder = useDeleteCipavdReportFolder();
  const uploadFile = useUploadCipavdReportFile();
  const updateFile = useUpdateCipavdReportFile();
  const deleteFile = useDeleteCipavdReportFile();
  const downloadFile = useDownloadCipavdReportFile();

  const canCreate = can(me, "cipavd_reports", "create");
  const canUpdate = can(me, "cipavd_reports", "update");
  const canDelete = can(me, "cipavd_reports", "delete");
  const canUpload = can(me, "cipavd_reports", "upload");
  const canDownload = can(me, "cipavd_reports", "download");

  const folders = reportsQuery.data?.folders ?? [];
  const files = reportsQuery.data?.files ?? [];
  const breadcrumbs = reportsQuery.data?.breadcrumbs ?? [
    { id: null, name: "Relatórios" },
  ];
  const isEmpty = folders.length === 0 && files.length === 0;

  const currentFolderName = useMemo(() => {
    const last = breadcrumbs[breadcrumbs.length - 1];
    return last?.name ?? "Relatórios";
  }, [breadcrumbs]);

  const navigateToFolder = (folderId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (folderId) params.set("folderId", folderId);
    else params.delete("folderId");
    setSearch("");
    setSearchParams(params, { replace: false });
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.push({ message: "Informe o nome da pasta.", severity: "warning" });
      return;
    }
    try {
      const created = (await createFolder.mutateAsync({
        name,
        parentId: currentFolderId || null,
      })) as CipavdReportFolder;
      setFolderDialogOpen(false);
      setNewFolderName("");
      navigateToFolder(created.id);
      toast.push({ message: "Pasta criada.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao criar pasta.",
        severity: "error",
      });
    }
  };

  const handleUpload = async (filesToUpload: FileList | null) => {
    const selected = Array.from(filesToUpload ?? []);
    if (selected.length === 0) return;
    try {
      for (const file of selected) {
        await uploadFile.mutateAsync({
          file,
          folderId: currentFolderId || null,
        });
      }
      toast.push({
        message:
          selected.length === 1
            ? "Arquivo enviado."
            : `${selected.length} arquivos enviados.`,
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao enviar arquivo.",
        severity: "error",
      });
    }
  };

  const openRename = (target: DriveTarget) => {
    setRenameTarget(target);
    setRenameValue(target.item.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.push({ message: "Informe o novo nome.", severity: "warning" });
      return;
    }
    try {
      if (renameTarget.type === "folder") {
        await updateFolder.mutateAsync({
          id: renameTarget.item.id,
          payload: { name },
        });
      } else {
        await updateFile.mutateAsync({
          id: renameTarget.item.id,
          payload: { name },
        });
      }
      setRenameTarget(null);
      toast.push({ message: "Nome atualizado.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao renomear.",
        severity: "error",
      });
    }
  };

  const openMove = (target: DriveTarget) => {
    setMoveTarget(target);
    setMoveFolderId(
      target.type === "folder"
        ? (target.item.parentId ?? "")
        : (target.item.folderId ?? ""),
    );
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    const targetFolderId = moveFolderId || null;
    try {
      if (moveTarget.type === "folder") {
        await updateFolder.mutateAsync({
          id: moveTarget.item.id,
          payload: { parentId: targetFolderId },
        });
      } else {
        await updateFile.mutateAsync({
          id: moveTarget.item.id,
          payload: { folderId: targetFolderId },
        });
      }
      setMoveTarget(null);
      toast.push({ message: "Item movido.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao mover item.",
        severity: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "folder") {
        await deleteFolder.mutateAsync(deleteTarget.item.id);
      } else {
        await deleteFile.mutateAsync(deleteTarget.item.id);
      }
      setDeleteTarget(null);
      toast.push({ message: "Item excluído.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao excluir item.",
        severity: "error",
      });
    }
  };

  const handleDownload = async (file: CipavdReportFile) => {
    try {
      await downloadFile.mutateAsync({ id: file.id, fileName: file.name });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao baixar arquivo.",
        severity: "error",
      });
    }
  };

  if (reportsQuery.isLoading) return <SkeletonState />;
  if (reportsQuery.isError) {
    return (
      <ErrorState
        error={reportsQuery.error}
        onRetry={() => reportsQuery.refetch()}
      />
    );
  }

  return (
    <Stack spacing={2.25}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          borderColor: "#DADCE0",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 0.4 }}>
              Relatórios
            </Typography>
            <Breadcrumbs maxItems={5} aria-label="Caminho da pasta">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return isLast ? (
                  <Typography
                    key={item.id ?? "root"}
                    color="text.primary"
                    fontWeight={700}
                  >
                    {item.name}
                  </Typography>
                ) : (
                  <Link
                    key={item.id ?? "root"}
                    component="button"
                    underline="hover"
                    color="inherit"
                    onClick={() => navigateToFolder(item.id)}
                    sx={{ font: "inherit" }}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </Breadcrumbs>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => reportsQuery.refetch()}
            >
              Atualizar
            </Button>
            {canCreate ? (
              <Button
                variant="outlined"
                startIcon={<CreateNewFolderRoundedIcon />}
                onClick={() => setFolderDialogOpen(true)}
              >
                Nova pasta
              </Button>
            ) : null}
            {canUpload ? (
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadRoundedIcon />}
                sx={{ bgcolor: "#1A73E8", "&:hover": { bgcolor: "#1557B0" } }}
              >
                Upload
                <input
                  hidden
                  multiple
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => {
                    void handleUpload(event.target.files);
                    event.target.value = "";
                  }}
                />
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, borderColor: "#DADCE0" }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
          >
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar em ${currentFolderName}`}
              InputProps={{ startAdornment: <SearchRoundedIcon sx={{ mr: 1 }} /> }}
              sx={{ maxWidth: { md: 440 } }}
              fullWidth
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_event, value) => value && setViewMode(value)}
            >
              <ToggleButton value="list" aria-label="Lista">
                <ViewListRoundedIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="grid" aria-label="Ícones">
                <ViewModuleRoundedIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Divider />

          {isEmpty ? (
            <EmptyState
              title={search ? "Nenhum item encontrado" : "Pasta vazia"}
              description={
                search
                  ? "Ajuste o termo de busca para localizar outro relatório."
                  : "Crie uma pasta ou envie PDFs e DOCX para organizar o repositório."
              }
              actionLabel={canUpload ? "Enviar arquivo" : undefined}
              onAction={
                canUpload
                  ? () => {
                      const input = document.querySelector<HTMLInputElement>(
                        'input[type="file"][accept*=".pdf"]',
                      );
                      input?.click();
                    }
                  : undefined
              }
            />
          ) : viewMode === "list" ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Tamanho</TableCell>
                  <TableCell>Atualizado</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {folders.map((folder) => (
                  <TableRow
                    key={`folder-${folder.id}`}
                    hover
                    onDoubleClick={() => navigateToFolder(folder.id)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <FolderRoundedIcon sx={{ color: "#F4B400" }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>
                            {folder.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {folder.folderCount ?? 0} pasta(s) · {folder.fileCount ?? 0} arquivo(s)
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>Pasta</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{formatDate(folder.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <Actions
                        target={{ type: "folder", item: folder }}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        canDownload={canDownload}
                        onRename={openRename}
                        onMove={openMove}
                        onDelete={setDeleteTarget}
                        onDownload={handleDownload}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {files.map((file) => (
                  <TableRow key={`file-${file.id}`} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <FileIcon file={file} />
                        <Typography fontWeight={650} noWrap>
                          {file.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={fileExtension(file).toUpperCase() || "ARQ"}
                      />
                    </TableCell>
                    <TableCell>{formatBytes(file.fileSize)}</TableCell>
                    <TableCell>{formatDate(file.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <Actions
                        target={{ type: "file", item: file }}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        canDownload={canDownload}
                        onRename={openRename}
                        onMove={openMove}
                        onDelete={setDeleteTarget}
                        onDownload={handleDownload}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(3, minmax(0, 1fr))",
                  lg: "repeat(5, minmax(0, 1fr))",
                },
                gap: 1.4,
              }}
            >
              {folders.map((folder) => (
                <Card
                  key={`folder-card-${folder.id}`}
                  variant="outlined"
                  onDoubleClick={() => navigateToFolder(folder.id)}
                  sx={{
                    borderRadius: 2,
                    cursor: "pointer",
                    borderColor: "#DADCE0",
                    "&:hover": {
                      borderColor: "#1A73E8",
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.4, "&:last-child": { pb: 1.4 } }}>
                    <Stack spacing={1.2}>
                      <Stack direction="row" justifyContent="space-between">
                        <FolderRoundedIcon sx={{ color: "#F4B400", fontSize: 36 }} />
                        <Actions
                          target={{ type: "folder", item: folder }}
                          canUpdate={canUpdate}
                          canDelete={canDelete}
                          canDownload={canDownload}
                          onRename={openRename}
                          onMove={openMove}
                          onDelete={setDeleteTarget}
                          onDownload={handleDownload}
                        />
                      </Stack>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={750} noWrap>
                          {folder.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {folder.folderCount ?? 0} pasta(s) · {folder.fileCount ?? 0} arquivo(s)
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {files.map((file) => (
                <Card
                  key={`file-card-${file.id}`}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: "#DADCE0",
                    "&:hover": {
                      borderColor: "#1A73E8",
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.4, "&:last-child": { pb: 1.4 } }}>
                    <Stack spacing={1.2}>
                      <Stack direction="row" justifyContent="space-between">
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 1.2,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "#F8FAFD",
                          }}
                        >
                          <FileIcon file={file} />
                        </Box>
                        <Actions
                          target={{ type: "file", item: file }}
                          canUpdate={canUpdate}
                          canDelete={canDelete}
                          canDownload={canDownload}
                          onRename={openRename}
                          onMove={openMove}
                          onDelete={setDeleteTarget}
                          onDownload={handleDownload}
                        />
                      </Stack>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={750} noWrap>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatBytes(file.fileSize)} · {formatDate(file.updatedAt)}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Stack>
      </Paper>

      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nova pasta</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nome da pasta"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreateFolder}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Renomear</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nome"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleRename}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(moveTarget)} onClose={() => setMoveTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Mover item</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Destino"
            select
            value={moveFolderId}
            onChange={(event) => setMoveFolderId(event.target.value)}
            fullWidth
          >
            {(folderOptionsQuery.data?.items ?? []).map((option) => (
              <MenuItem key={option.id ?? "root"} value={option.id ?? ""}>
                {option.path}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveTarget(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleMove}>
            Mover
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir item"
        message={
          deleteTarget?.type === "folder"
            ? `A pasta "${deleteTarget.item.name}" e todo o seu conteúdo serão removidos.`
            : `O arquivo "${deleteTarget?.item.name ?? ""}" será removido.`
        }
        confirmLabel="Excluir"
        severity="error"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Stack>
  );
}
