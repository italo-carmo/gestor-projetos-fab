import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Link,
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
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateDocumentSubcategory,
  useDeleteDocumentSubcategory,
  useDocumentContent,
  useDocuments,
  useDocumentsCoverage,
  useDocumentSubcategories,
  useDownloadDocument,
  useLocalities,
  useUpdateDocument,
  useUpdateDocumentSubcategory,
} from '../api/hooks';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'Geral',
  MISSION: 'Missoes',
  PRESENTATION: 'Apresentacoes',
  HISTORY: 'Historico',
  RESEARCH: 'Pesquisas',
  SMIF: 'SMIF',
  VISUAL_IDENTITY: 'Identidade visual',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS);

const PARSE_STATUS_LABEL: Record<string, string> = {
  EXTRACTED: 'Extraido',
  PARTIAL: 'Extracao parcial',
  NOT_SUPPORTED: 'Nao suportado',
  FAILED: 'Falha de extracao',
  PENDING: 'Pendente',
};

const LINK_ENTITY_LABEL: Record<string, string> = {
  TASK_INSTANCE: 'Tarefa',
  TASK_TEMPLATE: 'Modelo de tarefa',
  ACTIVITY: 'Atividade',
  MEETING: 'Reuniao',
  ELO: 'Elo',
  LOCALITY: 'Localidade',
};

type LocalityOption = {
  id: string;
  name: string;
};

type DocumentSubcategory = {
  id: string;
  category: string;
  name: string;
  parentId?: string | null;
  fullPath?: string;
  depth?: number;
  documentCount?: number;
  totalDocumentCount?: number;
  children?: DocumentSubcategory[];
};

type DocumentRow = {
  id: string;
  title: string;
  category: string;
  subcategoryId?: string | null;
  subcategory?: { id: string; name: string; category: string; parentId?: string | null } | null;
  sourcePath: string;
  fileName: string;
  fileSize?: number | null;
  localityId?: string | null;
  locality?: { id: string; code?: string; name: string } | null;
  content?: { parseStatus?: string | null } | null;
  _count?: { links?: number } | null;
  updatedAt?: string;
  canEdit?: boolean;
};

type DocumentsCoverage = {
  totalDocuments: number;
  linkedDocuments: number;
  documentsWithoutLinks: number;
  parseStatus: Array<{ parseStatus: string; count: number }>;
  byCategory?: Array<{ category: string; count: number }>;
  bySubcategory?: Array<{ id: string; name: string; category: string; parentId?: string | null; count: number }>;
};

type DocumentLinkItem = {
  id: string;
  entityType: string;
  entityId: string;
  label?: string | null;
  entityDisplayName?: string | null;
  createdAt?: string;
};

type DocumentContentResponse = {
  links?: DocumentLinkItem[];
};

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [localityId, setLocalityId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState('');
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    subcategoryId: '',
    localityId: '',
    sourcePath: '',
  });

  const toast = useToast();

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      category: category || undefined,
      localityId: localityId || undefined,
      pageSize: 500,
    }),
    [q, category, localityId],
  );

  const documentsQuery = useDocuments(filters);
  const coverageQuery = useDocumentsCoverage();
  const subcategoriesQuery = useDocumentSubcategories({});
  const localitiesQuery = useLocalities();
  const downloadDocument = useDownloadDocument();
  const updateDocument = useUpdateDocument();
  const createSubcategory = useCreateDocumentSubcategory();
  const updateSubcategory = useUpdateDocumentSubcategory();
  const deleteSubcategory = useDeleteDocumentSubcategory();
  const contentQuery = useDocumentContent(selectedId ?? '');

  const localities = (localitiesQuery.data?.items ?? []) as LocalityOption[];
  const items = (documentsQuery.data?.items ?? []) as DocumentRow[];
  const coverage = coverageQuery.data as DocumentsCoverage | undefined;
  const allSubcategories = useMemo(
    () => (subcategoriesQuery.data?.items ?? []) as DocumentSubcategory[],
    [subcategoriesQuery.data?.items],
  );
  const selected = items.find((doc) => doc.id === selectedId) ?? null;
  const documentContent = contentQuery.data as DocumentContentResponse | undefined;

  const subcategoriesById = useMemo(() => {
    const map = new Map<string, DocumentSubcategory>();
    for (const item of allSubcategories) {
      map.set(item.id, item);
    }
    return map;
  }, [allSubcategories]);

  const subcategoriesOfCategory = useMemo(
    () => allSubcategories.filter((item) => item.category === category),
    [allSubcategories, category],
  );

  const folderPath = useMemo(() => {
    if (!currentFolderId) return [] as DocumentSubcategory[];
    const pathItems: DocumentSubcategory[] = [];
    const visited = new Set<string>();
    let cursor = currentFolderId;
    while (cursor) {
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const node = subcategoriesById.get(cursor);
      if (!node) break;
      pathItems.push(node);
      cursor = node.parentId ?? '';
    }
    return pathItems.reverse();
  }, [currentFolderId, subcategoriesById]);

  const currentChildFolders = useMemo(() => {
    const parent = currentFolderId || null;
    return subcategoriesOfCategory
      .filter((item) => (item.parentId ?? null) === parent)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subcategoriesOfCategory, currentFolderId]);

  const subcategoriesOfEditCategory = useMemo(
    () =>
      allSubcategories
        .filter((item) => item.category === editForm.category)
        .sort((a, b) => (a.fullPath ?? a.name).localeCompare(b.fullPath ?? b.name)),
    [allSubcategories, editForm.category],
  );

  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of coverage?.byCategory ?? []) {
      map.set(row.category, row.count);
    }
    return map;
  }, [coverage?.byCategory]);

  const folderPathById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allSubcategories) {
      map.set(item.id, item.fullPath ?? item.name);
    }
    return map;
  }, [allSubcategories]);

  const documentsInCurrentFolder =
    !category
      ? ([] as DocumentRow[])
      : currentFolderId
        ? items.filter((doc) => doc.category === category && (doc.subcategoryId ?? '') === currentFolderId)
        : items.filter((doc) => doc.category === category && !doc.subcategoryId);

  const openDetails = (doc: DocumentRow) => {
    setSelectedId(doc.id);
    setEditForm({
      title: doc.title ?? '',
      category: doc.category ?? '',
      subcategoryId: doc.subcategoryId ?? '',
      localityId: doc.localityId ?? '',
      sourcePath: doc.sourcePath ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!editForm.title.trim()) {
      toast.push({ message: 'Informe o titulo do documento.', severity: 'warning' });
      return;
    }

    try {
      await updateDocument.mutateAsync({
        id: selected.id,
        payload: {
          title: editForm.title.trim(),
          category: editForm.category,
          subcategoryId: editForm.subcategoryId || null,
          localityId: editForm.localityId || null,
          sourcePath: editForm.sourcePath.trim(),
        },
      });
      toast.push({ message: 'Documento atualizado com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar documento.', severity: 'error' });
    }
  };

  const handleCreateSubcategory = async () => {
    if (!category) {
      toast.push({ message: 'Selecione uma categoria para criar a subpasta.', severity: 'warning' });
      return;
    }
    const name = newFolderName.trim();
    if (!name) {
      toast.push({ message: 'Informe o nome da subpasta.', severity: 'warning' });
      return;
    }

    try {
      const created = await createSubcategory.mutateAsync({
        category,
        name,
        parentId: currentFolderId || null,
      });
      setNewFolderName('');
      if (created?.id) setCurrentFolderId(created.id);
      toast.push({ message: 'Subpasta criada com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao criar subpasta.', severity: 'error' });
    }
  };

  const handleStartRename = (folder: DocumentSubcategory) => {
    setRenamingFolderId(folder.id);
    setRenamingFolderName(folder.name);
  };

  const handleSaveRename = async () => {
    if (!renamingFolderId) return;
    const name = renamingFolderName.trim();
    if (!name) {
      toast.push({ message: 'Informe um nome valido para a pasta.', severity: 'warning' });
      return;
    }
    try {
      await updateSubcategory.mutateAsync({
        id: renamingFolderId,
        payload: { name },
      });
      toast.push({ message: 'Subpasta renomeada com sucesso.', severity: 'success' });
      setRenamingFolderId('');
      setRenamingFolderName('');
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao renomear subpasta.', severity: 'error' });
    }
  };

  const descendantsByFolder = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    for (const folder of allSubcategories) {
      const parent = folder.parentId ?? '';
      const current = childrenByParent.get(parent) ?? [];
      current.push(folder.id);
      childrenByParent.set(parent, current);
    }

    const map = new Map<string, Set<string>>();
    for (const folder of allSubcategories) {
      const ids = new Set<string>([folder.id]);
      const queue = [folder.id];
      while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const childId of childrenByParent.get(current) ?? []) {
          if (ids.has(childId)) continue;
          ids.add(childId);
          queue.push(childId);
        }
      }
      map.set(folder.id, ids);
    }
    return map;
  }, [allSubcategories]);

  const handleDeleteFolder = async (folder: DocumentSubcategory) => {
    const scopeCount = folder.totalDocumentCount ?? folder.documentCount ?? 0;
    const ok = window.confirm(
      `Excluir a subpasta "${folder.name}" e subpastas filhas? ${scopeCount} documento(s) serao movidos para a raiz da categoria.`,
    );
    if (!ok) return;

    try {
      await deleteSubcategory.mutateAsync(folder.id);
      const deletedScope = descendantsByFolder.get(folder.id) ?? new Set<string>([folder.id]);
      if (currentFolderId && deletedScope.has(currentFolderId)) {
        setCurrentFolderId(folder.parentId ?? '');
      }
      toast.push({ message: 'Subpasta excluida com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao excluir subpasta.', severity: 'error' });
    }
  };

  const selectedPathLabel =
    !category
      ? ''
      : folderPath.length === 0
        ? `${CATEGORY_LABELS[category] ?? category} / raiz`
        : `${CATEGORY_LABELS[category] ?? category} / ${folderPath.map((item) => item.name).join(' / ')}`;

  if (documentsQuery.isLoading) return <SkeletonState />;
  if (documentsQuery.isError) {
    return <ErrorState error={documentsQuery.error} onRetry={() => documentsQuery.refetch()} />;
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} mb={1}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Acervo de Documentos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Estrutura em pastas e subpastas (multi-nivel), com navegacao tipo drive e vinculos detalhados por arquivo.
          </Typography>
        </Box>
        <Button
          variant="text"
          onClick={() => {
            setQ('');
            setCategory('');
            setCurrentFolderId('');
            setLocalityId('');
          }}
        >
          Limpar filtros
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={1.4} sx={{ mb: 1.8 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Documentos
              </Typography>
              <Typography variant="h5">{coverage?.totalDocuments ?? '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Com vinculo operacional
              </Typography>
              <Typography variant="h5">{coverage?.linkedDocuments ?? '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Sem vinculo
              </Typography>
              <Typography variant="h5">{coverage?.documentsWithoutLinks ?? '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Extracao de conteudo
              </Typography>
              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                {(coverage?.parseStatus ?? []).map((row) => (
                  <Chip
                    key={row.parseStatus}
                    size="small"
                    variant="outlined"
                    label={`${PARSE_STATUS_LABEL[row.parseStatus] ?? row.parseStatus}: ${row.count}`}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mb: 1.5 }}>
            Extracao de conteudo e a tentativa automatica de ler texto do arquivo para facilitar busca e vinculacao.
          </Alert>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
            <TextField
              size="small"
              label="Buscar"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Titulo, origem ou nome de pasta"
              fullWidth
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(e) => setLocalityId(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localities.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={1.4}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Navegacao em pastas
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Selecione uma categoria e navegue por subpastas, como no Google Drive.
              </Typography>
            </Box>

            <Breadcrumbs aria-label="breadcrumb">
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={() => {
                  setCategory('');
                  setCurrentFolderId('');
                }}
              >
                Acervo
              </Link>
              {category && (
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => setCurrentFolderId('')}
                >
                  {CATEGORY_LABELS[category] ?? category}
                </Link>
              )}
              {folderPath.map((folder, index) => {
                const isLast = index === folderPath.length - 1;
                if (isLast) {
                  return (
                    <Typography key={folder.id} color="text.primary">
                      {folder.name}
                    </Typography>
                  );
                }
                return (
                  <Link
                    key={folder.id}
                    component="button"
                    type="button"
                    underline="hover"
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    {folder.name}
                  </Link>
                );
              })}
            </Breadcrumbs>

            {!category ? (
              <Grid container spacing={1.2}>
                {CATEGORY_OPTIONS.map(([key, label]) => (
                  <Grid key={key} size={{ xs: 12, md: 4 }}>
                    <Card
                      variant="outlined"
                      onClick={() => {
                        setCategory(key);
                        setCurrentFolderId('');
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <FolderOpenRoundedIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle2" fontWeight={700}>
                            {label}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {categoryCountMap.get(key) ?? 0} documentos
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ md: 'center' }}>
                  <TextField
                    size="small"
                    label="Nova subpasta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Ex: Plano de acao"
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    startIcon={<CreateNewFolderRoundedIcon fontSize="small" />}
                    onClick={handleCreateSubcategory}
                    disabled={createSubcategory.isPending}
                  >
                    Criar subpasta
                  </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary">
                  Pasta atual: {selectedPathLabel}
                </Typography>

                {currentChildFolders.length === 0 ? (
                  <Alert severity="info">Sem subpastas neste nivel.</Alert>
                ) : (
                  <Grid container spacing={1.2}>
                    {currentChildFolders.map((folder) => (
                      <Grid key={folder.id} size={{ xs: 12, md: 6, lg: 4 }}>
                        <Card
                          variant="outlined"
                          onClick={() => setCurrentFolderId(folder.id)}
                          sx={{ cursor: 'pointer', height: '100%' }}
                        >
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.8} alignItems="center">
                                  <FolderOpenRoundedIcon fontSize="small" color="primary" />
                                  <Typography variant="subtitle2" fontWeight={700} noWrap title={folder.name}>
                                    {folder.name}
                                  </Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {(folder.documentCount ?? 0)} diretos • {(folder.totalDocumentCount ?? folder.documentCount ?? 0)} total
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.2}>
                                <Tooltip title="Renomear subpasta">
                                  <IconButton
                                    size="small"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleStartRename(folder);
                                    }}
                                  >
                                    <EditRoundedIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Excluir subpasta">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeleteFolder(folder);
                                    }}
                                  >
                                    <DeleteOutlineRoundedIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Stack>

                            {renamingFolderId === folder.id && (
                              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.2 }}>
                                <TextField
                                  size="small"
                                  value={renamingFolderName}
                                  onChange={(e) => setRenamingFolderName(e.target.value)}
                                  fullWidth
                                />
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleSaveRename();
                                  }}
                                  disabled={updateSubcategory.isPending}
                                >
                                  Salvar
                                </Button>
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setRenamingFolderId('');
                                    setRenamingFolderName('');
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </Stack>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" mb={1.2}>
            <Typography variant="subtitle1" fontWeight={700}>
              {category ? `Arquivos em ${selectedPathLabel}` : 'Selecione uma categoria para navegar no acervo'}
            </Typography>
            {!category && (
              <Typography variant="caption" color="text.secondary">
                Clique em uma categoria para abrir a estrutura de pastas.
              </Typography>
            )}
          </Stack>

          {!category ? (
            <Alert severity="info">Selecione uma categoria para listar arquivos.</Alert>
          ) : documentsInCurrentFolder.length === 0 ? (
            <EmptyState title="Sem documentos" description="Nenhum documento encontrado nesta pasta com os filtros atuais." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Documento</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Pasta</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Origem</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Vinculos</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }} align="right">
                    Acoes
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documentsInCurrentFolder.map((doc) => (
                  <TableRow key={doc.id} hover onClick={() => openDetails(doc)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {doc.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.fileName} • {formatFileSize(doc.fileSize)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                        <Chip size="small" variant="outlined" label={CATEGORY_LABELS[doc.category] ?? doc.category} />
                        <Chip size="small" color="default" label={doc.subcategoryId ? folderPathById.get(doc.subcategoryId) ?? 'Subpasta' : 'Raiz'} />
                      </Stack>
                    </TableCell>
                    <TableCell>{doc.locality?.name ?? 'Sem vinculo'}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }} title={doc.sourcePath}>
                      <Typography
                        variant="caption"
                        sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                      >
                        {doc.sourcePath}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={PARSE_STATUS_LABEL[doc.content?.parseStatus ?? ''] ?? 'Sem extracao'}
                        />
                        <Chip size="small" label={`${doc._count?.links ?? 0} vinculos`} />
                        {doc.canEdit && <Chip size="small" color="success" variant="outlined" label="Editavel" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.8} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetails(doc);
                          }}
                        >
                          Abrir
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async (event) => {
                            event.stopPropagation();
                            try {
                              await downloadDocument.mutateAsync({ id: doc.id, fileName: doc.fileName });
                            } catch (error) {
                              const payload = parseApiError(error);
                              toast.push({ message: payload.message ?? 'Erro ao baixar documento.', severity: 'error' });
                            }
                          }}
                        >
                          Baixar
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 680 } } }}
      >
        <Box p={2.4} sx={{ height: '100%', overflowY: 'auto' }}>
          {!selected ? (
            <Typography variant="body2" color="text.secondary">
              Documento nao encontrado.
            </Typography>
          ) : (
            <Stack spacing={1.6}>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Detalhes do Documento
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Atualizado em {formatDate(selected.updatedAt)}
                </Typography>
              </Box>

              {!selected.canEdit && (
                <Alert severity="info">
                  Edicao disponivel apenas para perfis administrativos ou para quem criou o documento.
                </Alert>
              )}

              <Card variant="outlined">
                <CardContent sx={{ display: 'grid', gap: 1.1 }}>
                  <TextField
                    size="small"
                    label="Titulo"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    disabled={!selected.canEdit}
                    fullWidth
                  />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Categoria"
                      value={editForm.category}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        const hasCurrentSubcategory = allSubcategories.some(
                          (sub) => sub.category === nextCategory && sub.id === editForm.subcategoryId,
                        );
                        setEditForm({
                          ...editForm,
                          category: nextCategory,
                          subcategoryId: hasCurrentSubcategory ? editForm.subcategoryId : '',
                        });
                      }}
                      disabled={!selected.canEdit}
                      fullWidth
                    >
                      {CATEGORY_OPTIONS.map(([key, label]) => (
                        <MenuItem key={key} value={key}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      size="small"
                      label="Subpasta"
                      value={editForm.subcategoryId}
                      onChange={(e) => setEditForm({ ...editForm, subcategoryId: e.target.value })}
                      disabled={!selected.canEdit}
                      fullWidth
                    >
                      <MenuItem value="">Raiz da categoria</MenuItem>
                      {subcategoriesOfEditCategory.map((sub) => (
                        <MenuItem key={sub.id} value={sub.id}>
                          {sub.fullPath ?? sub.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <TextField
                    select
                    size="small"
                    label="Localidade"
                    value={editForm.localityId}
                    onChange={(e) => setEditForm({ ...editForm, localityId: e.target.value })}
                    disabled={!selected.canEdit}
                    fullWidth
                  >
                    <MenuItem value="">Sem vinculo</MenuItem>
                    {localities.map((loc) => (
                      <MenuItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Origem"
                    value={editForm.sourcePath}
                    onChange={(e) => setEditForm({ ...editForm, sourcePath: e.target.value })}
                    disabled={!selected.canEdit}
                    fullWidth
                  />
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent sx={{ display: 'grid', gap: 0.7 }}>
                  <Typography variant="subtitle2">Metadados</Typography>
                  <Divider />
                  <Typography variant="body2">
                    <strong>Arquivo:</strong> {selected.fileName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Tamanho:</strong> {formatFileSize(selected.fileSize)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Extração de conteúdo:</strong>{' '}
                    {PARSE_STATUS_LABEL[selected.content?.parseStatus ?? ''] ?? 'Sem extracao'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Vinculos:</strong> {selected._count?.links ?? 0}
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Vinculos do documento
                  </Typography>
                  {contentQuery.isLoading ? (
                    <Typography variant="body2" color="text.secondary">
                      Carregando vinculos...
                    </Typography>
                  ) : (documentContent?.links ?? []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Este documento ainda nao possui vinculos registrados.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Tipo</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Vinculado a</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>ID</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Criado em</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(documentContent?.links ?? []).map((link) => (
                          <TableRow key={link.id} hover>
                            <TableCell>{LINK_ENTITY_LABEL[link.entityType] ?? link.entityType}</TableCell>
                            <TableCell>{link.entityDisplayName ?? link.label ?? link.entityId}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{link.entityId}</TableCell>
                            <TableCell>{formatDate(link.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      await downloadDocument.mutateAsync({ id: selected.id, fileName: selected.fileName });
                    } catch (error) {
                      const payload = parseApiError(error);
                      toast.push({ message: payload.message ?? 'Erro ao baixar documento.', severity: 'error' });
                    }
                  }}
                >
                  Baixar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!selected.canEdit || updateDocument.isPending}
                >
                  Salvar alteracoes
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
