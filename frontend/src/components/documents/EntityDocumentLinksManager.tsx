import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  useCreateDocumentLink,
  useDeleteDocumentLink,
  useDocumentLinks,
  useDocuments,
  useUpdateDocumentLink,
} from '../../api/hooks';
import { useToast } from '../../app/toast';
import { parseApiError } from '../../app/apiErrors';

type LinkEntityType = 'TASK_INSTANCE' | 'ACTIVITY' | 'MEETING';

type DocumentOption = {
  id: string;
  title: string;
  fileName: string;
  category?: string;
  sourcePath?: string;
  subcategoryId?: string | null;
};

type LinkedDocumentItem = {
  id: string;
  entityType: string;
  entityId: string;
  documentId: string;
  label?: string | null;
  createdAt?: string;
  document?: DocumentOption | null;
};

type GroupedLinkItem = {
  key: string;
  primary: LinkedDocumentItem;
  duplicateIds: string[];
};

function buildDocumentSemanticKey(document?: {
  title?: string | null;
  fileName?: string | null;
  category?: string | null;
  sourcePath?: string | null;
}) {
  if (!document) return '';
  const title = (document.title ?? '').trim().toLowerCase();
  const fileName = (document.fileName ?? '').trim().toLowerCase();
  const category = (document.category ?? '').trim().toUpperCase();
  const sourcePath = (document.sourcePath ?? '').trim().toLowerCase();
  if (!title && !fileName && !sourcePath) return '';
  return `${title}|${fileName}|${category}|${sourcePath}`;
}

type EntityDocumentLinksManagerProps = {
  entityType: LinkEntityType;
  entityId?: string | null;
  canManage?: boolean;
  title?: string;
};

export function EntityDocumentLinksManager({
  entityType,
  entityId,
  canManage = true,
  title = 'Documentos vinculados',
}: EntityDocumentLinksManagerProps) {
  const toast = useToast();
  const [docSearch, setDocSearch] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentOption | null>(
    null,
  );
  const [newLabel, setNewLabel] = useState('');
  const [editingLinkId, setEditingLinkId] = useState('');
  const [editingLabel, setEditingLabel] = useState('');

  const linksQuery = useDocumentLinks({
    entityType,
    entityId: entityId ?? undefined,
    pageSize: 200,
  });
  const documentsQuery = useDocuments({
    q: docSearch.trim() || undefined,
    pageSize: 40,
  });

  const createLink = useCreateDocumentLink();
  const updateLink = useUpdateDocumentLink();
  const deleteLink = useDeleteDocumentLink();

  const links = useMemo(
    () => (linksQuery.data?.items ?? []) as LinkedDocumentItem[],
    [linksQuery.data?.items],
  );
  const groupedLinks = useMemo(() => {
    const makeKey = (link: LinkedDocumentItem) => {
      const semanticKey = buildDocumentSemanticKey(link.document);
      if (semanticKey) return `meta:${semanticKey}`;
      return `doc:${link.documentId}`;
    };

    const groups = new Map<string, LinkedDocumentItem[]>();
    for (const link of links) {
      const key = makeKey(link);
      const current = groups.get(key) ?? [];
      current.push(link);
      groups.set(key, current);
    }

    const toTime = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
        return {
          key,
          primary: sorted[0],
          duplicateIds: items.map((item) => item.id),
        } as GroupedLinkItem;
      })
      .sort((a, b) => toTime(b.primary.createdAt) - toTime(a.primary.createdAt));
  }, [links]);
  const linkedDocumentIds = useMemo(
    () => new Set(links.map((item) => item.documentId)),
    [links],
  );
  const linkedDocumentSemanticKeys = useMemo(
    () =>
      new Set(
        groupedLinks
          .map((group) => buildDocumentSemanticKey(group.primary.document))
          .filter((value) => value.length > 0),
      ),
    [groupedLinks],
  );
  const documentOptions = ((documentsQuery.data?.items ?? []) as DocumentOption[])
    .filter((item) => {
      if (linkedDocumentIds.has(item.id)) return false;
      const semanticKey = buildDocumentSemanticKey(item);
      if (!semanticKey) return true;
      return !linkedDocumentSemanticKeys.has(semanticKey);
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

  const handleCreateLink = async () => {
    if (!entityId) return;
    if (!selectedDocument?.id) {
      toast.push({
        message: 'Selecione um documento para vincular.',
        severity: 'warning',
      });
      return;
    }

    try {
      await createLink.mutateAsync({
        documentId: selectedDocument.id,
        entityType,
        entityId,
        label: newLabel.trim() || undefined,
      });
      setSelectedDocument(null);
      setNewLabel('');
      toast.push({ message: 'Documento vinculado com sucesso.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao vincular documento.',
        severity: 'error',
      });
    }
  };

  const startEditLabel = (link: LinkedDocumentItem) => {
    setEditingLinkId(link.id);
    setEditingLabel(link.label ?? '');
  };

  const handleSaveLabel = async (linkId: string) => {
    try {
      await updateLink.mutateAsync({
        id: linkId,
        payload: { label: editingLabel.trim() || null },
      });
      setEditingLinkId('');
      setEditingLabel('');
      toast.push({ message: 'Vínculo atualizado.', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao atualizar vínculo.',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (linkIds: string[]) => {
    try {
      for (const linkId of linkIds) {
        await deleteLink.mutateAsync(linkId);
        if (editingLinkId === linkId) {
          setEditingLinkId('');
          setEditingLabel('');
        }
      }
      toast.push({
        message: linkIds.length > 1 ? 'Vínculos duplicados removidos.' : 'Vínculo removido.',
        severity: 'success',
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao remover vínculo.',
        severity: 'error',
      });
    }
  };

  if (!entityId) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            Salve este item para gerenciar documentos vinculados.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'grid', gap: 1.2 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <Autocomplete
            size="small"
            fullWidth
            value={selectedDocument}
            onChange={(_event, value) => setSelectedDocument(value)}
            options={documentOptions}
            loading={documentsQuery.isLoading}
            getOptionLabel={(option) =>
              option.title ? `${option.title} (${option.fileName})` : option.fileName
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Documento"
                placeholder="Busque por título ou caminho"
                onChange={(event) => setDocSearch(event.target.value)}
              />
            )}
          />
          <TextField
            size="small"
            label="Nota do vínculo (opcional)"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            sx={{ minWidth: { md: 220 } }}
          />
          <Button
            variant="contained"
            onClick={handleCreateLink}
            disabled={!canManage || createLink.isPending}
          >
            Vincular
          </Button>
        </Stack>

        {linksQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Carregando vínculos...
          </Typography>
        ) : groupedLinks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum documento vinculado.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {groupedLinks.map((group) => {
              const link = group.primary;
              const openTarget = (() => {
                if (!link.document?.id) return '/documents';
                const params = new URLSearchParams();
                params.set('documentId', link.document.id);
                if (link.document.category) params.set('category', link.document.category);
                if (link.document.subcategoryId) {
                  params.set('subcategoryId', link.document.subcategoryId);
                }
                if (link.document.title || link.document.fileName) {
                  params.set(
                    'q',
                    link.document.title ?? link.document.fileName ?? '',
                  );
                }
                return `/documents?${params.toString()}`;
              })();
              return (
                <Box
                  key={link.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.2,
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {link.document?.title ?? link.document?.fileName ?? 'Documento'}
                      </Typography>
                      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
                        {link.document?.category && (
                          <Chip
                            size="small"
                            label={link.document.category}
                            variant="outlined"
                          />
                        )}
                        {group.duplicateIds.length > 1 && (
                          <Chip
                            size="small"
                            color="warning"
                            label={`${group.duplicateIds.length} duplicados`}
                          />
                        )}
                        {link.createdAt && (
                          <Typography variant="caption" color="text.secondary">
                            Vinculado em {new Date(link.createdAt).toLocaleString('pt-BR')}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Button
                        size="small"
                        component={RouterLink}
                        to={openTarget}
                        variant="text"
                        disabled={!link.document?.id}
                      >
                        Abrir
                      </Button>
                      {editingLinkId === link.id ? (
                        <>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              setEditingLinkId('');
                              setEditingLabel('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              void handleSaveLabel(link.id);
                            }}
                            disabled={!canManage || updateLink.isPending}
                          >
                            Salvar nota
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => startEditLabel(link)}
                          disabled={!canManage}
                        >
                          Editar nota
                        </Button>
                      )}
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => {
                          void handleDelete(group.duplicateIds);
                        }}
                        disabled={!canManage || deleteLink.isPending}
                      >
                        Remover
                      </Button>
                    </Stack>
                  </Stack>
                  <Box sx={{ mt: 1 }}>
                    {editingLinkId === link.id ? (
                      <TextField
                        size="small"
                        fullWidth
                        label="Nota do vínculo"
                        value={editingLabel}
                        onChange={(event) => setEditingLabel(event.target.value)}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {link.label?.trim() ? link.label : 'Sem nota de vínculo.'}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
