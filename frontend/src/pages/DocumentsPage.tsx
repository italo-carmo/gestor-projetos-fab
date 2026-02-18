import {
  Alert,
  Autocomplete,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  useCreateDocumentSubcategory,
  useCreateDocumentLink,
  useDeleteDocumentLink,
  useDeleteDocumentSubcategory,
  useDocumentContent,
  useDocumentLinkCandidates,
  useDocuments,
  useDocumentsCoverage,
  useDocumentSubcategories,
  useDownloadDocument,
  useLocalities,
  useUpdateDocumentLink,
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
  SMIF: 'CIPAVD',
  VISUAL_IDENTITY: 'Identidade visual',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS);
const CATEGORY_KEYS = new Set(CATEGORY_OPTIONS.map(([key]) => key));

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
  documentId?: string;
  entityType: string;
  entityId: string;
  label?: string | null;
  entityDisplayName?: string | null;
  createdAt?: string;
};

type DocumentLinkCandidateItem = {
  id: string;
  label: string;
  subtitle?: string | null;
  extra?: string | null;
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

function getFileExtension(fileName?: string | null) {
  if (!fileName) return '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return fileName.slice(dotIndex + 1).toUpperCase();
}

function getLinkedEntityPath(link: DocumentLinkItem) {
  if (link.entityType === 'TASK_INSTANCE') return `/tasks?taskId=${link.entityId}`;
  if (link.entityType === 'ACTIVITY') return `/activities?activityId=${link.entityId}`;
  if (link.entityType === 'MEETING') return `/meetings?meetingId=${link.entityId}`;
  return null;
}

export function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [currentFolderId, setCurrentFolderId] = useState(searchParams.get('subcategoryId') ?? '');
  const [localityId, setLocalityId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState('');
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const [newLinkEntityType, setNewLinkEntityType] = useState<'TASK_INSTANCE' | 'ACTIVITY' | 'MEETING'>('ACTIVITY');
  const [newLinkSearch, setNewLinkSearch] = useState('');
  const [newLinkTargetId, setNewLinkTargetId] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [editingLinkId, setEditingLinkId] = useState('');
  const [editingLinkLabel, setEditingLinkLabel] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveDocIds, setMoveDocIds] = useState<string[]>([]);
  const [moveForm, setMoveForm] = useState({
    category: '',
    subcategoryId: '',
  });
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    subcategoryId: '',
    localityId: '',
    sourcePath: '',
  });

  const toast = useToast();
  const hasValidCategory = CATEGORY_KEYS.has(category);

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      category: hasValidCategory ? category : undefined,
      subcategoryId: currentFolderId || undefined,
      localityId: localityId || undefined,
      pageSize: 500,
    }),
    [q, category, hasValidCategory, currentFolderId, localityId],
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
  const createDocumentLink = useCreateDocumentLink();
  const updateDocumentLink = useUpdateDocumentLink();
  const deleteDocumentLink = useDeleteDocumentLink();
  const contentQuery = useDocumentContent(selectedId ?? '');
  const linkCandidatesQuery = useDocumentLinkCandidates({
    entityType: selectedId ? newLinkEntityType : undefined,
    q: newLinkSearch.trim() || undefined,
    pageSize: 40,
  });

  const localities = (localitiesQuery.data?.items ?? []) as LocalityOption[];
  const items = useMemo(
    () => (documentsQuery.data?.items ?? []) as DocumentRow[],
    [documentsQuery.data?.items],
  );
  const coverage = coverageQuery.data as DocumentsCoverage | undefined;
  const allSubcategories = useMemo(
    () => (subcategoriesQuery.data?.items ?? []) as DocumentSubcategory[],
    [subcategoriesQuery.data?.items],
  );
  const selected = items.find((doc) => doc.id === selectedId) ?? null;
  const moveDocuments = useMemo(
    () => items.filter((doc) => moveDocIds.includes(doc.id)),
    [items, moveDocIds],
  );
  const moveDocument = moveDocuments[0] ?? null;
  const documentContent = contentQuery.data as DocumentContentResponse | undefined;
  const linkCandidates = (linkCandidatesQuery.data?.items ?? []) as DocumentLinkCandidateItem[];

  const subcategoriesById = useMemo(() => {
    const map = new Map<string, DocumentSubcategory>();
    for (const item of allSubcategories) {
      map.set(item.id, item);
    }
    return map;
  }, [allSubcategories]);

  const subcategoriesOfCategory = useMemo(
    () => allSubcategories.filter((item) => item.category === (hasValidCategory ? category : '')),
    [allSubcategories, category, hasValidCategory],
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
  const subcategoriesOfMoveCategory = useMemo(
    () =>
      allSubcategories
        .filter((item) => item.category === moveForm.category)
        .sort((a, b) => (a.fullPath ?? a.name).localeCompare(b.fullPath ?? b.name)),
    [allSubcategories, moveForm.category],
  );
  const moveDestinationOption = useMemo(
    () =>
      subcategoriesOfMoveCategory.map((sub) => ({
        id: sub.id,
        label: sub.fullPath ?? sub.name,
      })),
    [subcategoriesOfMoveCategory],
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

  const documentsInCurrentFolder = useMemo(() => {
    if (currentFolderId) {
      return items.filter((doc) => (doc.subcategoryId ?? '') === currentFolderId);
    }
    if (!hasValidCategory) return [] as DocumentRow[];
    return items.filter((doc) => doc.category === category && !doc.subcategoryId);
  }, [category, currentFolderId, hasValidCategory, items]);

  const editableDocumentsInCurrentFolderIds = useMemo(
    () => documentsInCurrentFolder.filter((doc) => doc.canEdit).map((doc) => doc.id),
    [documentsInCurrentFolder],
  );
  const selectedDocumentsInCurrentFolder = useMemo(
    () => documentsInCurrentFolder.filter((doc) => selectedDocIds.includes(doc.id) && doc.canEdit),
    [documentsInCurrentFolder, selectedDocIds],
  );
  const allCurrentFolderSelected =
    editableDocumentsInCurrentFolderIds.length > 0 &&
    selectedDocumentsInCurrentFolder.length === editableDocumentsInCurrentFolderIds.length;
  const someCurrentFolderSelected =
    selectedDocumentsInCurrentFolder.length > 0 &&
    selectedDocumentsInCurrentFolder.length < editableDocumentsInCurrentFolderIds.length;
  const titleCountInCurrentFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documentsInCurrentFolder) {
      const key = (doc.title ?? '').trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [documentsInCurrentFolder]);

  const openDetails = (doc: DocumentRow) => {
    setSelectedId(doc.id);
    setEditForm({
      title: doc.title ?? '',
      category: doc.category ?? '',
      subcategoryId: doc.subcategoryId ?? '',
      localityId: doc.localityId ?? '',
      sourcePath: doc.sourcePath ?? '',
    });
    setNewLinkEntityType('ACTIVITY');
    setNewLinkSearch('');
    setNewLinkTargetId('');
    setNewLinkLabel('');
    setEditingLinkId('');
    setEditingLinkLabel('');
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

  const openMoveDialog = (doc: DocumentRow) => {
    setMoveDocIds([doc.id]);
    setMoveForm({
      category: doc.category,
      subcategoryId: doc.subcategoryId ?? '',
    });
    setMoveDialogOpen(true);
  };

  const openMoveSelectedDialog = () => {
    if (selectedDocumentsInCurrentFolder.length === 0) {
      toast.push({ message: 'Selecione ao menos um documento para mover.', severity: 'warning' });
      return;
    }
    const first = selectedDocumentsInCurrentFolder[0];
    setMoveDocIds(selectedDocumentsInCurrentFolder.map((doc) => doc.id));
    setMoveForm({
      category: first.category,
      subcategoryId: first.subcategoryId ?? '',
    });
    setMoveDialogOpen(true);
  };

  const handleConfirmMove = async () => {
    if (moveDocIds.length === 0) return;
    const targetCategory = moveForm.category || moveDocument?.category || '';
    if (!targetCategory) {
      toast.push({ message: 'Selecione uma categoria de destino.', severity: 'warning' });
      return;
    }
    try {
      await Promise.all(
        moveDocIds.map((docId) =>
          updateDocument.mutateAsync({
            id: docId,
            payload: {
              category: targetCategory,
              subcategoryId: moveForm.subcategoryId || null,
            },
          }),
        ),
      );
      toast.push({
        message: moveDocIds.length > 1 ? `${moveDocIds.length} documentos movidos com sucesso.` : 'Documento movido com sucesso.',
        severity: 'success',
      });
      setMoveDialogOpen(false);
      setMoveDocIds([]);
      setSelectedDocIds((prev) => prev.filter((id) => !moveDocIds.includes(id)));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao mover documento.', severity: 'error' });
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    if (!editableDocumentsInCurrentFolderIds.includes(docId)) return;
    setSelectedDocIds((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
  };

  const toggleSelectAllInCurrentFolder = () => {
    if (allCurrentFolderSelected) {
      setSelectedDocIds((prev) => prev.filter((id) => !editableDocumentsInCurrentFolderIds.includes(id)));
      return;
    }
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      for (const id of editableDocumentsInCurrentFolderIds) {
        next.add(id);
      }
      return Array.from(next);
    });
  };

  const handleCreateLink = async () => {
    if (!selected) return;
    if (!newLinkTargetId) {
      toast.push({ message: 'Selecione o item para vincular.', severity: 'warning' });
      return;
    }
    try {
      await createDocumentLink.mutateAsync({
        documentId: selected.id,
        entityType: newLinkEntityType,
        entityId: newLinkTargetId,
        label: newLinkLabel.trim() || undefined,
      });
      setNewLinkTargetId('');
      setNewLinkLabel('');
      setNewLinkSearch('');
      toast.push({ message: 'Vínculo criado com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao criar vínculo.', severity: 'error' });
    }
  };

  const startEditLink = (link: DocumentLinkItem) => {
    setEditingLinkId(link.id);
    setEditingLinkLabel(link.label ?? '');
  };

  const handleSaveLinkLabel = async (linkId: string) => {
    try {
      await updateDocumentLink.mutateAsync({
        id: linkId,
        payload: { label: editingLinkLabel.trim() || null },
      });
      setEditingLinkId('');
      setEditingLinkLabel('');
      toast.push({ message: 'Vínculo atualizado com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao atualizar vínculo.', severity: 'error' });
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteDocumentLink.mutateAsync(linkId);
      if (editingLinkId === linkId) {
        setEditingLinkId('');
        setEditingLinkLabel('');
      }
      toast.push({ message: 'Vínculo removido com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro ao remover vínculo.', severity: 'error' });
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
  const currentFolderMeta = currentFolderId
    ? subcategoriesById.get(currentFolderId) ?? null
    : null;
  const hasActiveListFilters = Boolean(q.trim() || localityId);
  const folderHasHiddenDocuments =
    Boolean(currentFolderMeta) &&
    (currentFolderMeta?.documentCount ?? 0) > 0 &&
    documentsInCurrentFolder.length === 0 &&
    hasActiveListFilters;

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
                    size="small"
                    variant="contained"
                    startIcon={<CreateNewFolderRoundedIcon fontSize="small" />}
                    onClick={handleCreateSubcategory}
                    disabled={createSubcategory.isPending}
                    sx={{ whiteSpace: 'nowrap' }}
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

          {category && documentsInCurrentFolder.length > 0 && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" mb={1.2}>
              <Typography variant="caption" color="text.secondary">
                {selectedDocumentsInCurrentFolder.length > 0
                  ? `${selectedDocumentsInCurrentFolder.length} selecionado(s)`
                  : 'Selecione documentos para mover em lote'}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={openMoveSelectedDialog}
                  disabled={selectedDocumentsInCurrentFolder.length === 0}
                >
                  Mover selecionados
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setSelectedDocIds([])}
                  disabled={selectedDocumentsInCurrentFolder.length === 0}
                >
                  Limpar selecao
                </Button>
              </Stack>
            </Stack>
          )}

          {!category ? (
            <Alert severity="info">Selecione uma categoria para listar arquivos.</Alert>
          ) : documentsInCurrentFolder.length === 0 ? (
            folderHasHiddenDocuments ? (
              <Alert
                severity="warning"
                action={
                  <Button
                    size="small"
                    onClick={() => {
                      setQ('');
                      setLocalityId('');
                    }}
                  >
                    Limpar filtros
                  </Button>
                }
              >
                Esta pasta possui {currentFolderMeta?.documentCount ?? 0} arquivo(s), mas eles estao ocultos pelos filtros atuais.
              </Alert>
            ) : (
              <EmptyState title="Sem documentos" description="Nenhum documento encontrado nesta pasta com os filtros atuais." />
            )
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell padding="checkbox" sx={{ color: 'white', fontWeight: 700 }}>
                    <Checkbox
                      size="small"
                      checked={allCurrentFolderSelected}
                      indeterminate={someCurrentFolderSelected}
                      onChange={toggleSelectAllInCurrentFolder}
                      disabled={editableDocumentsInCurrentFolderIds.length === 0}
                      sx={{ color: 'white', '&.Mui-checked': { color: 'white' }, '&.MuiCheckbox-indeterminate': { color: 'white' } }}
                      inputProps={{ 'aria-label': 'Selecionar todos os documentos da pasta' }}
                    />
                  </TableCell>
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
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selectedDocIds.includes(doc.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        disabled={!doc.canEdit}
                        inputProps={{ 'aria-label': `Selecionar ${doc.title}` }}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const key = (doc.title ?? '').trim().toLowerCase();
                        const sameTitleCount = titleCountInCurrentFolder.get(key) ?? 1;
                        const hasVariants = sameTitleCount > 1;
                        const ext = getFileExtension(doc.fileName);
                        return (
                          <>
                            <Typography variant="body2" fontWeight={700}>
                              {doc.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {doc.fileName} • {formatFileSize(doc.fileSize)}
                            </Typography>
                            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
                              {ext && <Chip size="small" variant="outlined" color="info" label={ext} />}
                              {hasVariants && <Chip size="small" variant="outlined" label={`${sameTitleCount} versoes`} />}
                            </Stack>
                          </>
                        );
                      })()}
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
                        <Button
                          size="small"
                          variant="contained"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMoveDialog(doc);
                          }}
                          disabled={!doc.canEdit}
                        >
                          Mover
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
        PaperProps={{
          sx: {
            width: { xs: '100%', md: 680 },
            top: 76,
            height: 'calc(100% - 76px)',
          },
        }}
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
                  {getFileExtension(selected.fileName) && (
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <Typography variant="body2">
                        <strong>Formato:</strong>
                      </Typography>
                      <Chip size="small" color="info" variant="outlined" label={getFileExtension(selected.fileName)} />
                    </Stack>
                  )}
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
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1.2 }}>
                    <TextField
                      select
                      size="small"
                      label="Tipo de vínculo"
                      value={newLinkEntityType}
                      onChange={(e) => {
                        setNewLinkEntityType(e.target.value as 'TASK_INSTANCE' | 'ACTIVITY' | 'MEETING');
                        setNewLinkTargetId('');
                      }}
                      sx={{ minWidth: 180 }}
                    >
                      <MenuItem value="TASK_INSTANCE">Tarefa</MenuItem>
                      <MenuItem value="ACTIVITY">Atividade</MenuItem>
                      <MenuItem value="MEETING">Reunião</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      label="Buscar item"
                      value={newLinkSearch}
                      onChange={(e) => setNewLinkSearch(e.target.value)}
                      sx={{ minWidth: 220 }}
                    />
                    <TextField
                      select
                      size="small"
                      label="Vincular a"
                      value={newLinkTargetId}
                      onChange={(e) => setNewLinkTargetId(e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">Selecione</MenuItem>
                      {linkCandidates.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.label}
                          {item.subtitle ? ` — ${item.subtitle}` : ''}
                          {item.extra ? ` (${item.extra})` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1.8 }}>
                    <TextField
                      size="small"
                      label="Nota do vínculo (opcional)"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      onClick={handleCreateLink}
                      disabled={!selected.canEdit || createDocumentLink.isPending}
                    >
                      Vincular
                    </Button>
                  </Stack>
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
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Nota</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Criado em</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(documentContent?.links ?? []).map((link) => {
                          const linkedPath = getLinkedEntityPath(link);
                          return (
                            <TableRow key={link.id} hover>
                              <TableCell>{LINK_ENTITY_LABEL[link.entityType] ?? link.entityType}</TableCell>
                              <TableCell>
                                {linkedPath ? (
                                  <Link component={RouterLink} to={linkedPath} underline="hover">
                                    {link.entityDisplayName ?? link.label ?? link.entityId}
                                  </Link>
                                ) : (
                                  link.entityDisplayName ?? link.label ?? link.entityId
                                )}
                              </TableCell>
                              <TableCell>
                                {editingLinkId === link.id ? (
                                  <TextField
                                    size="small"
                                    value={editingLinkLabel}
                                    onChange={(e) => setEditingLinkLabel(e.target.value)}
                                    fullWidth
                                  />
                                ) : (
                                  link.label ?? '—'
                                )}
                              </TableCell>
                              <TableCell>{formatDate(link.createdAt)}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5}>
                                  {editingLinkId === link.id ? (
                                    <>
                                      <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => {
                                          setEditingLinkId('');
                                          setEditingLinkLabel('');
                                        }}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                          void handleSaveLinkLabel(link.id);
                                        }}
                                        disabled={!selected.canEdit || updateDocumentLink.isPending}
                                      >
                                        Salvar
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="small"
                                      variant="text"
                                      onClick={() => startEditLink(link)}
                                      disabled={!selected.canEdit}
                                    >
                                      Editar
                                    </Button>
                                  )}
                                  <Button
                                    size="small"
                                    variant="text"
                                    color="error"
                                    onClick={() => {
                                      void handleDeleteLink(link.id);
                                    }}
                                    disabled={!selected.canEdit || deleteDocumentLink.isPending}
                                  >
                                    Excluir
                                  </Button>
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

      <Dialog
        open={moveDialogOpen}
        onClose={() => {
          setMoveDialogOpen(false);
          setMoveDocIds([]);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{moveDocIds.length > 1 ? 'Mover documentos' : 'Mover documento'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.2, pt: '12px !important' }}>
          {moveDocIds.length > 1 ? (
            <Typography variant="body2" color="text.secondary">
              Documentos selecionados: <strong>{moveDocIds.length}</strong>
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Documento: <strong>{moveDocument?.title ?? '—'}</strong>
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Origem:{' '}
            {moveDocument?.subcategoryId
              ? folderPathById.get(moveDocument.subcategoryId) ?? 'Subpasta'
              : 'Raiz da categoria'}
          </Typography>
          <TextField
            select
            size="small"
            label="Categoria destino"
            value={moveForm.category}
            onChange={(e) =>
              setMoveForm({
                category: e.target.value,
                subcategoryId: '',
              })
            }
            fullWidth
          >
            {CATEGORY_OPTIONS.map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            size="small"
            options={moveDestinationOption}
            value={moveDestinationOption.find((option) => option.id === moveForm.subcategoryId) ?? null}
            onChange={(_event, value) =>
              setMoveForm({
                ...moveForm,
                subcategoryId: value?.id ?? '',
              })
            }
            getOptionLabel={(option) => option.label}
            noOptionsText="Nenhuma subpasta para esta categoria."
            renderInput={(params) => (
              <TextField
                {...params}
                label="Subpasta destino"
                placeholder="Digite para buscar por caminho da subpasta"
              />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() =>
                setMoveForm({
                  ...moveForm,
                  subcategoryId: '',
                })
              }
            >
              Enviar para raiz
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() =>
                setMoveForm({
                  category: category || moveForm.category,
                  subcategoryId: currentFolderId,
                })
              }
              disabled={!category}
            >
              Usar pasta aberta
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Destino final: {moveForm.subcategoryId ? folderPathById.get(moveForm.subcategoryId) ?? 'Subpasta' : 'Raiz da categoria'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMoveDialogOpen(false);
              setMoveDocIds([]);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleConfirmMove();
            }}
            disabled={!moveDocument || updateDocument.isPending}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
