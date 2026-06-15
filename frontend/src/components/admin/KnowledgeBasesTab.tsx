import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SettingsBackupRestoreRoundedIcon from '@mui/icons-material/SettingsBackupRestoreRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseApiError } from '../../app/apiErrors';
import { useToast } from '../../app/toast';
import {
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useDeleteKnowledgeBaseDocument,
  useDownloadKnowledgeBaseDocument,
  useImportCipavdReportToKnowledgeBase,
  useKnowledgeBaseDocuments,
  useKnowledgeBaseCipavdReportFiles,
  useKnowledgeBases,
  useReindexKnowledgeBase,
  useReindexKnowledgeBaseDocument,
  useUpdateKnowledgeBase,
  useUpdateKnowledgeBaseDocument,
  useUploadKnowledgeBaseDocument,
  type AdminKnowledgeBase,
  type AdminKnowledgeBaseDocument,
  type AiKnowledgeBaseTheme,
  type CipavdReportFile,
} from '../../api/hooks';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { SkeletonState } from '../states/SkeletonState';

type KnowledgeBaseForm = {
  key: string;
  name: string;
  description: string;
  theme: AiKnowledgeBaseTheme;
  isActive: boolean;
  sortOrder: string;
};

const THEME_OPTIONS: Array<{
  value: AiKnowledgeBaseTheme;
  label: string;
  description: string;
}> = [
  {
    value: 'CIPAVD',
    label: 'CIPAVD',
    description: 'Normas, orientações e base documental do escopo CIPAVD.',
  },
  {
    value: 'SMIF',
    label: 'SMIF',
    description: 'Normas, protocolos e base documental do escopo SMIF.',
  },
  {
    value: 'CPCA',
    label: 'CPCA',
    description: 'Legislação, procedimentos e base documental da CPCA.',
  },
  {
    value: 'SHARED',
    label: 'Compartilhada',
    description: 'Base transversal, válida para mais de um tema.',
  },
] as const;

const buildDefaultForm = (): KnowledgeBaseForm => ({
  key: '',
  name: '',
  description: '',
  theme: 'SHARED',
  isActive: true,
  sortOrder: '0',
});

const formatBytes = (value?: number | null) => {
  if (!value || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
};

const statusColor = (status: AdminKnowledgeBaseDocument['status']) => {
  switch (status) {
    case 'READY':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'INDEXING':
      return 'warning';
    default:
      return 'default';
  }
};

export function KnowledgeBasesTab() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const updateKnowledgeBase = useUpdateKnowledgeBase();
  const deleteKnowledgeBase = useDeleteKnowledgeBase();
  const uploadDocument = useUploadKnowledgeBaseDocument();
  const updateDocument = useUpdateKnowledgeBaseDocument();
  const deleteDocument = useDeleteKnowledgeBaseDocument();
  const reindexKnowledgeBase = useReindexKnowledgeBase();
  const reindexDocument = useReindexKnowledgeBaseDocument();
  const downloadDocument = useDownloadKnowledgeBaseDocument();
  const importCipavdReport = useImportCipavdReportToKnowledgeBase();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<AdminKnowledgeBase | null>(null);
  const [baseToDelete, setBaseToDelete] = useState<AdminKnowledgeBase | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<AdminKnowledgeBaseDocument | null>(null);
  const [form, setForm] = useState<KnowledgeBaseForm>(buildDefaultForm());
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [reportSearch, setReportSearch] = useState('');
  const [reportImportTitleDrafts, setReportImportTitleDrafts] = useState<Record<string, string>>({});

  const knowledgeBases = useMemo(
    () => (knowledgeBasesQuery.data?.items ?? []) as AdminKnowledgeBase[],
    [knowledgeBasesQuery.data],
  );
  const requestedBaseId = String(searchParams.get('baseId') ?? '').trim();
  const highlightedDocumentId = String(searchParams.get('docId') ?? '').trim();
  const selectedBaseId = useMemo(() => {
    if (!knowledgeBases.length) return '';
    if (requestedBaseId && knowledgeBases.some((item) => item.id === requestedBaseId)) {
      return requestedBaseId;
    }
    return knowledgeBases[0]?.id ?? '';
  }, [knowledgeBases, requestedBaseId]);

  useEffect(() => {
    const currentBaseId = requestedBaseId;
    if (!selectedBaseId) {
      if (!currentBaseId && !searchParams.get('docId')) return;
      const next = new URLSearchParams(searchParams);
      next.delete('baseId');
      next.delete('docId');
      setSearchParams(next, { replace: true });
      return;
    }
    if (currentBaseId === selectedBaseId) return;
    const next = new URLSearchParams(searchParams);
    next.set('baseId', selectedBaseId);
    next.delete('docId');
    setSearchParams(next, { replace: true });
  }, [requestedBaseId, searchParams, selectedBaseId, setSearchParams]);

  const selectBase = (baseId: string, options?: { replace?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    if (!baseId) {
      next.delete('baseId');
      next.delete('docId');
    } else {
      next.set('baseId', baseId);
      next.delete('docId');
    }
    setSearchParams(next, { replace: options?.replace ?? false });
  };

  const selectedBase = knowledgeBases.find((item) => item.id === selectedBaseId) ?? null;

  const documentsQuery = useKnowledgeBaseDocuments(selectedBaseId, Boolean(selectedBaseId));
  const documents = useMemo(
    () => (documentsQuery.data?.items ?? []) as AdminKnowledgeBaseDocument[],
    [documentsQuery.data],
  );
  const cipavdReportFilesQuery = useKnowledgeBaseCipavdReportFiles(
    reportSearch,
    Boolean(selectedBaseId),
  );
  const cipavdReportFiles = useMemo(
    () => (cipavdReportFilesQuery.data?.items ?? []) as CipavdReportFile[],
    [cipavdReportFilesQuery.data],
  );

  useEffect(() => {
    setTitleDrafts(
      documents.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.title ?? '';
        return acc;
      }, {}),
    );
  }, [documents]);

  const openCreate = () => {
    setEditingBase(null);
    setForm(buildDefaultForm());
    setDrawerOpen(true);
  };

  const openEdit = (item: AdminKnowledgeBase) => {
    setEditingBase(item);
    setForm({
      key: item.key ?? '',
      name: item.name ?? '',
      description: item.description ?? '',
      theme: item.theme ?? 'SHARED',
      isActive: item.isActive ?? true,
      sortOrder: String(item.sortOrder ?? 0),
    });
    setDrawerOpen(true);
  };

  const handleSaveBase = async () => {
    const payload = {
      key: form.key.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim() || null,
      theme: form.theme,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder || 0),
    };
    if (!payload.name) {
      toast.push({ message: 'Informe o nome da base.', severity: 'warning' });
      return;
    }

    try {
      if (editingBase) {
        await updateKnowledgeBase.mutateAsync({
          id: editingBase.id,
          payload,
        });
        toast.push({ message: 'Base atualizada com sucesso.', severity: 'success' });
      } else {
        const created = (await createKnowledgeBase.mutateAsync(payload)) as AdminKnowledgeBase;
        selectBase(created.id, { replace: true });
        toast.push({ message: 'Base criada com sucesso.', severity: 'success' });
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao salvar base.',
        severity: 'error',
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedBase) {
      toast.push({ message: 'Selecione uma base de conhecimento.', severity: 'warning' });
      return;
    }
    if (!uploadFile) {
      toast.push({ message: 'Selecione um documento para enviar.', severity: 'warning' });
      return;
    }

    try {
      await uploadDocument.mutateAsync({
        knowledgeBaseId: selectedBase.id,
        file: uploadFile,
        title: uploadTitle.trim() || undefined,
      });
      setUploadFile(null);
      setUploadTitle('');
      toast.push({
        message: 'Documento enviado e indexado para o RAG.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao enviar documento.',
        severity: 'error',
      });
    }
  };

  const handleSaveDocumentTitle = async (document: AdminKnowledgeBaseDocument) => {
    const title = String(titleDrafts[document.id] ?? '').trim();
    if (!title || title === document.title) return;
    try {
      await updateDocument.mutateAsync({
        id: document.id,
        knowledgeBaseId: document.knowledgeBaseId,
        payload: { title },
      });
      toast.push({ message: 'Título do documento atualizado.', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao atualizar documento.',
        severity: 'error',
      });
    }
  };

  const handleImportCipavdReport = async (report: CipavdReportFile) => {
    if (!selectedBase) return;
    try {
      await importCipavdReport.mutateAsync({
        knowledgeBaseId: selectedBase.id,
        fileId: report.id,
        title: reportImportTitleDrafts[report.id]?.trim() || undefined,
      });
      setReportImportTitleDrafts((prev) => ({ ...prev, [report.id]: '' }));
      toast.push({
        message: 'Relatório importado e indexado na base.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? 'Erro ao importar relatório CIPAVD.',
        severity: 'error',
      });
    }
  };

  const handleReindexBase = async () => {
    if (!selectedBase) return;
    try {
      await reindexKnowledgeBase.mutateAsync(selectedBase.id);
      toast.push({
        message: 'Reindexação da base iniciada/concluída.',
        severity: 'success',
      });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao reindexar base.',
        severity: 'error',
      });
    }
  };

  if (knowledgeBasesQuery.isLoading) return <SkeletonState />;
  if (knowledgeBasesQuery.isError) {
    return (
      <ErrorState
        error={knowledgeBasesQuery.error}
        onRetry={() => knowledgeBasesQuery.refetch()}
      />
    );
  }

  return (
    <Stack spacing={2.5}>
      <Paper
        variant="outlined"
        sx={{
          p: 2.4,
          borderRadius: 2.5,
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.16),
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Bases de conhecimento para RAG
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Cadastre bases temáticas, envie documentos normativos e mantenha a
              indexação vetorial que será usada por chatbot, análises e copilotos.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => knowledgeBasesQuery.refetch()}
            >
              Atualizar
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={openCreate}
              sx={{ bgcolor: '#1A3C6E', '&:hover': { bgcolor: '#122B4E' } }}
            >
              Nova base
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {knowledgeBases.length === 0 ? (
        <EmptyState
          title="Nenhuma base cadastrada"
          description="Crie a primeira base de conhecimento para começar a indexar documentos do RAG."
          actionLabel="Criar base"
          onAction={openCreate}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' },
            gap: 2,
          }}
        >
          <Stack spacing={1.25}>
            {knowledgeBases.map((item) => {
              const selected = item.id === selectedBaseId;
              const statusSummary = item.documentStatusSummary;
              return (
                <Card
                  key={item.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.5,
                    borderColor: selected ? '#1A3C6E' : '#DDE5EF',
                    boxShadow: selected ? '0 10px 28px rgba(17, 39, 68, 0.12)' : 'none',
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip size="small" color="primary" label={item.theme} />
                            <Chip
                              size="small"
                              variant={item.isActive ? 'filled' : 'outlined'}
                              color={item.isActive ? 'success' : 'default'}
                              label={item.isActive ? 'Ativa' : 'Inativa'}
                            />
                          </Stack>
                          <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.key}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.25}>
                          <Tooltip title="Editar base">
                            <IconButton size="small" onClick={() => openEdit(item)}>
                              <SettingsBackupRestoreRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir base">
                            <IconButton size="small" onClick={() => setBaseToDelete(item)}>
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {item.description?.trim() || 'Sem descrição cadastrada.'}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${item._count?.documents ?? 0} documento(s)`}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${item._count?.chunks ?? 0} chunk(s)`}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          color={(statusSummary?.failed ?? 0) > 0 ? 'error' : 'default'}
                          label={`${statusSummary?.ready ?? 0} pronto(s)`}
                        />
                      </Stack>
                      <Button
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => selectBase(item.id)}
                        sx={
                          selected
                            ? { bgcolor: '#1A3C6E', '&:hover': { bgcolor: '#122B4E' } }
                            : undefined
                        }
                      >
                        {selected ? 'Base selecionada' : 'Selecionar'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          <Paper variant="outlined" sx={{ borderRadius: 2.5, p: 2.25 }}>
            {!selectedBase ? (
              <EmptyState
                title="Selecione uma base"
                description="Escolha uma base de conhecimento para visualizar documentos e status de indexação."
              />
            ) : (
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ md: 'center' }}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      {selectedBase.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedBase.description?.trim() || 'Base sem descrição.'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshRoundedIcon />}
                      onClick={handleReindexBase}
                      disabled={reindexKnowledgeBase.isPending}
                    >
                      Reindexar base
                    </Button>
                  </Stack>
                </Stack>

                <Alert severity="info" variant="outlined">
                  Documentos enviados aqui são processados localmente, fragmentados
                  em chunks e indexados para recuperação semântica e lexical.
                </Alert>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      Enviar documento para a base
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                      <TextField
                        size="small"
                        label="Título opcional"
                        value={uploadTitle}
                        onChange={(event) => setUploadTitle(event.target.value)}
                        fullWidth
                      />
                      <Button variant="outlined" component="label" startIcon={<CloudUploadRoundedIcon />}>
                        {uploadFile ? uploadFile.name : 'Selecionar arquivo'}
                        <input
                          hidden
                          type="file"
                          onChange={(event) =>
                            setUploadFile(event.target.files?.[0] ?? null)
                          }
                        />
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AutoStoriesRoundedIcon />}
                        onClick={handleUpload}
                        disabled={uploadDocument.isPending}
                        sx={{ bgcolor: '#1A3C6E', '&:hover': { bgcolor: '#122B4E' } }}
                      >
                        {uploadDocument.isPending ? 'Processando...' : 'Enviar e indexar'}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.6,
                    borderRadius: 2,
                    borderColor: '#DDE5EF',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={1.2}
                      alignItems={{ md: 'center' }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800}>
                          Importar do Acervo CIPAVD
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          PDFs e DOCX do acervo restrito podem virar documentos indexados desta base.
                        </Typography>
                      </Box>
                      <TextField
                        size="small"
                        label="Buscar arquivo"
                        value={reportSearch}
                        onChange={(event) => setReportSearch(event.target.value)}
                        sx={{ minWidth: { md: 280 } }}
                      />
                    </Stack>

                    {cipavdReportFilesQuery.isLoading ? (
                      <SkeletonState />
                    ) : cipavdReportFilesQuery.isError ? (
                      <ErrorState
                        error={cipavdReportFilesQuery.error}
                        onRetry={() => cipavdReportFilesQuery.refetch()}
                      />
                    ) : cipavdReportFiles.length === 0 ? (
                      <EmptyState
                        title="Nenhum arquivo disponível"
                        description="Envie arquivos no menu Acervo do bloco COMANDO para importá-los aqui."
                      />
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Arquivo</TableCell>
                            <TableCell>Origem</TableCell>
                            <TableCell>Tamanho</TableCell>
                            <TableCell>Título na base</TableCell>
                            <TableCell align="right">Ação</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cipavdReportFiles.slice(0, 8).map((report) => (
                            <TableRow key={report.id} hover>
                              <TableCell sx={{ minWidth: 220 }}>
                                <Typography variant="body2" fontWeight={700}>
                                  {report.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Atualizado em {formatDateTime(report.updatedAt)}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ maxWidth: 300 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {report.folderPath ?? report.path ?? 'Acervo'}
                                </Typography>
                              </TableCell>
                              <TableCell>{formatBytes(report.fileSize)}</TableCell>
                              <TableCell sx={{ minWidth: 220 }}>
                                <TextField
                                  size="small"
                                  placeholder="Usar nome do arquivo"
                                  value={reportImportTitleDrafts[report.id] ?? ''}
                                  onChange={(event) =>
                                    setReportImportTitleDrafts((prev) => ({
                                      ...prev,
                                      [report.id]: event.target.value,
                                    }))
                                  }
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<DriveFileMoveRoundedIcon />}
                                  onClick={() => void handleImportCipavdReport(report)}
                                  disabled={importCipavdReport.isPending}
                                >
                                  Importar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Stack>
                </Paper>

                {documentsQuery.isLoading ? (
                  <SkeletonState />
                ) : documentsQuery.isError ? (
                  <ErrorState
                    error={documentsQuery.error}
                    onRetry={() => documentsQuery.refetch()}
                  />
                ) : documents.length === 0 ? (
                  <EmptyState
                    title="Nenhum documento na base"
                    description="Envie o primeiro documento para iniciar a indexação vetorial desta base."
                  />
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Documento</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Chunks</TableCell>
                        <TableCell>Tamanho</TableCell>
                        <TableCell>Última indexação</TableCell>
                        <TableCell align="right">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {documents.map((document) => (
                        <TableRow
                          key={document.id}
                          hover
                          selected={highlightedDocumentId === document.id}
                          sx={
                            highlightedDocumentId === document.id
                              ? {
                                  '& td': {
                                    bgcolor: (theme) =>
                                      alpha(theme.palette.primary.main, 0.08),
                                  },
                                }
                              : undefined
                          }
                        >
                          <TableCell sx={{ minWidth: 280 }}>
                            <Stack spacing={0.8}>
                              <TextField
                                size="small"
                                value={titleDrafts[document.id] ?? document.title}
                                onChange={(event) =>
                                  setTitleDrafts((prev) => ({
                                    ...prev,
                                    [document.id]: event.target.value,
                                  }))
                                }
                              />
                              <Typography variant="caption" color="text.secondary">
                                {document.fileName}
                              </Typography>
                              {document.indexError ? (
                                <Typography variant="caption" color="error.main">
                                  {document.indexError}
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={statusColor(document.status) as any}
                              variant={document.status === 'READY' ? 'filled' : 'outlined'}
                              label={document.status}
                            />
                          </TableCell>
                          <TableCell>{document._count?.chunks ?? document.chunkCount ?? 0}</TableCell>
                          <TableCell>{formatBytes(document.fileSize)}</TableCell>
                          <TableCell>{formatDateTime(document.lastIndexedAt ?? document.updatedAt)}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.4} justifyContent="flex-end">
                              <Tooltip title="Salvar título">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => void handleSaveDocumentTitle(document)}
                                    disabled={updateDocument.isPending}
                                  >
                                    <SaveRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Baixar documento">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      void downloadDocument.mutateAsync({
                                        id: document.id,
                                        fileName: document.fileName,
                                      })
                                    }
                                  >
                                    <DownloadRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Reindexar documento">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      void reindexDocument.mutateAsync({
                                        id: document.id,
                                        knowledgeBaseId: document.knowledgeBaseId,
                                      })
                                    }
                                    disabled={reindexDocument.isPending}
                                  >
                                    <RefreshRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Excluir documento">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => setDocumentToDelete(document)}
                                  >
                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, p: 2.2 } }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={800}>
              {editingBase ? 'Editar base de conhecimento' : 'Nova base de conhecimento'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Organize as bases documentais que serão usadas pelo RAG dos perfis de IA.
            </Typography>
          </Box>
          <Divider />
          <TextField
            size="small"
            label="Nome da base"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label="Chave técnica"
            value={form.key}
            onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
            placeholder="Ex.: legislacao-cpca"
            helperText="Opcional. Se vazio, o backend deriva a chave a partir do nome."
            fullWidth
          />
          <TextField
            size="small"
            label="Tema"
            select
            value={form.theme}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                theme: event.target.value as AiKnowledgeBaseTheme,
              }))
            }
            fullWidth
          >
            {THEME_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Descrição"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            multiline
            minRows={4}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              size="small"
              label="Ordem"
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, sortOrder: event.target.value }))
              }
              fullWidth
            />
            <TextField
              size="small"
              label="Ativa"
              select
              value={form.isActive ? 'true' : 'false'}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  isActive: event.target.value === 'true',
                }))
              }
              fullWidth
            >
              <MenuItem value="true">Sim</MenuItem>
              <MenuItem value="false">Não</MenuItem>
            </TextField>
          </Stack>
          <Box sx={{ mt: 'auto' }}>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setDrawerOpen(false)} color="inherit">
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleSaveBase()}
                disabled={createKnowledgeBase.isPending || updateKnowledgeBase.isPending}
                sx={{ bgcolor: '#1A3C6E', '&:hover': { bgcolor: '#122B4E' } }}
              >
                {createKnowledgeBase.isPending || updateKnowledgeBase.isPending
                  ? 'Salvando...'
                  : 'Salvar base'}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Drawer>

      <ConfirmDialog
        open={Boolean(baseToDelete)}
        title="Excluir base de conhecimento"
        message="Essa ação remove a base, seus documentos e todos os chunks indexados."
        highlightText={baseToDelete?.name}
        confirmLabel="Excluir base"
        severity="error"
        confirmLoading={deleteKnowledgeBase.isPending}
        onCancel={() => setBaseToDelete(null)}
        onConfirm={async () => {
          if (!baseToDelete) return;
          try {
            await deleteKnowledgeBase.mutateAsync(baseToDelete.id);
            toast.push({ message: 'Base excluída com sucesso.', severity: 'success' });
            setBaseToDelete(null);
          } catch (error) {
            toast.push({
              message: parseApiError(error).message ?? 'Erro ao excluir base.',
              severity: 'error',
            });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(documentToDelete)}
        title="Excluir documento da base"
        message="O arquivo será removido do armazenamento e os chunks indexados serão descartados."
        highlightText={documentToDelete?.title}
        confirmLabel="Excluir documento"
        severity="error"
        confirmLoading={deleteDocument.isPending}
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={async () => {
          if (!documentToDelete) return;
          try {
            await deleteDocument.mutateAsync({
              id: documentToDelete.id,
              knowledgeBaseId: documentToDelete.knowledgeBaseId,
            });
            toast.push({ message: 'Documento excluído.', severity: 'success' });
            setDocumentToDelete(null);
          } catch (error) {
            toast.push({
              message: parseApiError(error).message ?? 'Erro ao excluir documento.',
              severity: 'error',
            });
          }
        }}
      />
    </Stack>
  );
}
