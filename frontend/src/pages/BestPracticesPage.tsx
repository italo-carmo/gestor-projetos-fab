import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import { useMemo, useState } from "react";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { hasAnyRole, hasRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from "../app/roleAccess";
import { useToast } from "../app/toast";
import { selectTargetLocalities } from "../constants/localities";
import {
  useBestPractices,
  useBestPracticeTypes,
  useCreateBestPractice,
  useCreateBestPracticeType,
  useDeleteBestPractice,
  useDeleteBestPracticeType,
  useLocalities,
  useMe,
  useUpdateBestPractice,
  useUpdateBestPracticeType,
} from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

const BEST_PRACTICES_BLUE_CARD_SX = {
  backgroundColor: "rgb(83, 127, 151) !important",
};

const REPLICATION_PRACTICES_CARD_SX = {
  backgroundColor: "rgb(102, 133, 114) !important",
};

type BestPracticeType = {
  id: string;
  name: string;
  colorHex: string;
  textColorHex?: string | null;
};

type BestPracticePost = {
  id: string;
  title: string;
  content: string;
  isCommission: boolean;
  localityId: string | null;
  typeId?: string | null;
  authorLabel: string | null;
  createdAt: string;
  locality?: { id: string; name: string; code?: string | null } | null;
  type?: BestPracticeType | null;
};

export function BestPracticesPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const localitiesQuery = useLocalities();
  const [q, setQ] = useState("");
  const [localityFilter, setLocalityFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BestPracticePost | null>(null);
  const [readingPost, setReadingPost] = useState<BestPracticePost | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    target: "commission",
  });
  const [typesSectionOpen, setTypesSectionOpen] = useState(false);
  const [typeForm, setTypeForm] = useState({ id: "", name: "", colorHex: "#537F97", textColorHex: "#FFFFFF" });

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      localityId: localityFilter || undefined,
    }),
    [q, localityFilter],
  );

  const postsQuery = useBestPractices(filters);
  const typesQuery = useBestPracticeTypes();
  const createBestPractice = useCreateBestPractice();
  const updateBestPractice = useUpdateBestPractice();
  const deleteBestPractice = useDeleteBestPractice();
  const createType = useCreateBestPracticeType();
  const updateType = useUpdateBestPracticeType();
  const deleteType = useDeleteBestPracticeType();
  
  const canManageTypes = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]) && can(me, "best_practices", "create");

  if (postsQuery.isLoading) return <SkeletonState />;
  if (postsQuery.isError) {
    return (
      <ErrorState
        error={postsQuery.error}
        onRetry={() => postsQuery.refetch()}
      />
    );
  }

  const localities = selectTargetLocalities(
    (localitiesQuery.data?.items ?? []) as Array<{
      id: string;
      name: string;
      recruitsFemaleCountCurrent?: number | null;
      updatedAt?: string | Date | null;
    }>,
  ).map((item) => ({
    id: String(item.id),
    name: String(item.name ?? ""),
  }));
  const posts = (postsQuery.data?.items ?? []) as BestPracticePost[];
  const types = (typesQuery.data?.items ?? []) as BestPracticeType[];
  const typeById = useMemo(() => new Map(types.map((item) => [item.id, item])), [types]);
  const canCreate =
    hasRole(me, ROLE_COORDENACAO_CIPAVD) && can(me, "best_practices", "create");
  const canUpdate =
    hasRole(me, ROLE_COORDENACAO_CIPAVD) && can(me, "best_practices", "update");
  const canDelete =
    hasRole(me, ROLE_COORDENACAO_CIPAVD) && can(me, "best_practices", "delete");

  const postsByLocalityId = new Map<string, BestPracticePost[]>();
  for (const item of posts.filter((entry) => !entry.isCommission && entry.localityId)) {
    const list = postsByLocalityId.get(String(item.localityId)) ?? [];
    list.push(item);
    postsByLocalityId.set(String(item.localityId), list);
  }
  const commissionPosts = posts.filter((item) => item.isCommission);

  const sections = [
    {
      key: "__commission__",
      title: "Práticas com potencial de replicação",
      subtitle: "Boas práticas de aplicação geral da comissão",
      icon: <LightbulbRoundedIcon fontSize="small" />,
      posts: commissionPosts,
    },
    ...localities
      .map((locality) => ({
        key: locality.id,
        title: locality.name,
        subtitle: "Boas práticas da localidade",
        icon: <ApartmentRoundedIcon fontSize="small" />,
        posts: postsByLocalityId.get(locality.id) ?? [],
      }))
      .filter((section) => {
        if (localityFilter === "__commission__") return false;
        if (localityFilter) return section.key === localityFilter;
        return section.posts.length > 0;
      }),
  ].filter((section) => {
    if (localityFilter === "__commission__") return section.key === "__commission__";
    return true;
  });

  const resetForm = () => {
    setEditing(null);
    setForm({
      title: "",
      content: "",
      target: "commission",
    });
  };

  const openCreate = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (post: BestPracticePost) => {
    setEditing(post);
    setForm({
      title: post.title ?? "",
      content: post.content ?? "",
      target: post.isCommission ? "commission" : String(post.localityId ?? ""),
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const isCommission = form.target === "commission";
      const payload = {
        title: form.title,
        content: form.content,
        isCommission,
        localityId: isCommission ? null : form.target,
      };
      if (editing) {
        await updateBestPractice.mutateAsync({ id: editing.id, payload });
        toast.push({ message: "Postagem atualizada", severity: "success" });
      } else {
        await createBestPractice.mutateAsync(payload);
        toast.push({ message: "Postagem criada", severity: "success" });
      }
      setDrawerOpen(false);
      resetForm();
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao salvar postagem",
        severity: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("Deseja remover esta boa prática?");
    if (!ok) return;
    try {
      await deleteBestPractice.mutateAsync(id);
      toast.push({ message: "Postagem removida", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao remover postagem",
        severity: "error",
      });
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1.5}
        mb={2}
      >
        <Box>
          <Typography variant="h4">Boas Práticas</Typography>
          <Typography variant="body2" color="text.secondary">
            Compartilhe ações efetivas por localidade e práticas com potencial de replicação.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {canManageTypes && (
            <IconButton
              size="small"
              onClick={() => setTypesSectionOpen(!typesSectionOpen)}
              sx={{ color: "primary.main" }}
              title="Gerenciar tipos"
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          )}
          {canCreate && (
            <Button variant="contained" onClick={openCreate}>
              Nova postagem
            </Button>
          )}
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              size="small"
              label="Buscar"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Título, conteúdo, autor ou localidade"
              fullWidth
            />
            <TextField
              select
              size="small"
              label="Origem"
              value={localityFilter}
              onChange={(event) => setLocalityFilter(event.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="__commission__">Práticas com potencial de replicação</MenuItem>
              {localities.map((locality) => (
                <MenuItem key={locality.id} value={locality.id}>
                  {locality.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {canManageTypes && (
        <Collapse in={typesSectionOpen}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
                Gerenciar Tipos de Boas Práticas
              </Typography>
              <Stack spacing={2}>
                {types.map((type) => {
                  const isEditing = typeForm.id === type.id;
                  return (
                    <Card key={type.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={1.5}>
                          {isEditing ? (
                            <>
                              <TextField
                                size="small"
                                label="Nome do tipo"
                                value={typeForm.name}
                                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                                fullWidth
                              />
                              <Stack direction="row" spacing={1}>
                                <TextField
                                  size="small"
                                  type="color"
                                  label="Cor do card"
                                  value={typeForm.colorHex}
                                  onChange={(e) => setTypeForm({ ...typeForm, colorHex: e.target.value })}
                                  InputLabelProps={{ shrink: true }}
                                  sx={{ flex: 1 }}
                                />
                                <TextField
                                  size="small"
                                  type="color"
                                  label="Cor da fonte"
                                  value={typeForm.textColorHex}
                                  onChange={(e) => setTypeForm({ ...typeForm, textColorHex: e.target.value })}
                                  InputLabelProps={{ shrink: true }}
                                  sx={{ flex: 1 }}
                                />
                              </Stack>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={async () => {
                                    try {
                                      await updateType.mutateAsync({
                                        id: type.id,
                                        payload: {
                                          name: typeForm.name,
                                          colorHex: typeForm.colorHex,
                                          textColorHex: typeForm.textColorHex,
                                        },
                                      });
                                      toast.push({ message: "Tipo atualizado.", severity: "success" });
                                      setTypeForm({ id: "", name: "", colorHex: "#537F97", textColorHex: "#FFFFFF" });
                                      await typesQuery.refetch();
                                    } catch (error) {
                                      toast.push({
                                        message: parseApiError(error).message ?? "Erro ao atualizar tipo.",
                                        severity: "error",
                                      });
                                    }
                                  }}
                                >
                                  Salvar
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => setTypeForm({ id: "", name: "", colorHex: "#537F97", textColorHex: "#FFFFFF" })}
                                >
                                  Cancelar
                                </Button>
                              </Stack>
                            </>
                          ) : (
                            <>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 1,
                                    backgroundColor: type.colorHex,
                                    border: "1px solid rgba(0,0,0,0.1)",
                                  }}
                                />
                                <Typography variant="body1" fontWeight={600}>
                                  {type.name}
                                </Typography>
                                <Box sx={{ flex: 1 }} />
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setTypeForm({
                                      id: type.id,
                                      name: type.name,
                                      colorHex: type.colorHex,
                                      textColorHex: type.textColorHex || "#FFFFFF",
                                    })
                                  }
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={async () => {
                                    if (!window.confirm(`Deseja remover o tipo "${type.name}"?`)) return;
                                    try {
                                      await deleteType.mutateAsync(type.id);
                                      toast.push({ message: "Tipo removido.", severity: "success" });
                                      await typesQuery.refetch();
                                    } catch (error) {
                                      toast.push({
                                        message: parseApiError(error).message ?? "Erro ao remover tipo.",
                                        severity: "error",
                                      });
                                    }
                                  }}
                                >
                                  <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
                {typeForm.id === "" && (
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Novo tipo
                        </Typography>
                        <TextField
                          size="small"
                          label="Nome do tipo"
                          value={typeForm.name}
                          onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                          fullWidth
                        />
                        <Stack direction="row" spacing={1}>
                          <TextField
                            size="small"
                            type="color"
                            label="Cor do card"
                            value={typeForm.colorHex}
                            onChange={(e) => setTypeForm({ ...typeForm, colorHex: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            size="small"
                            type="color"
                            label="Cor da fonte"
                            value={typeForm.textColorHex}
                            onChange={(e) => setTypeForm({ ...typeForm, textColorHex: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                          />
                        </Stack>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={async () => {
                            if (!typeForm.name.trim()) {
                              toast.push({ message: "Preencha o nome do tipo.", severity: "warning" });
                              return;
                            }
                            try {
                              await createType.mutateAsync({
                                name: typeForm.name,
                                colorHex: typeForm.colorHex,
                                textColorHex: typeForm.textColorHex,
                              });
                              toast.push({ message: "Tipo criado.", severity: "success" });
                              setTypeForm({ id: "", name: "", colorHex: "#537F97", textColorHex: "#FFFFFF" });
                              await typesQuery.refetch();
                            } catch (error) {
                              toast.push({
                                message: parseApiError(error).message ?? "Erro ao criar tipo.",
                                severity: "error",
                              });
                            }
                          }}
                        >
                          Criar tipo
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Collapse>
      )}

      {sections.length === 0 && (
        <EmptyState
          title="Sem boas práticas"
          description="Ainda não há conteúdo para o filtro aplicado."
        />
      )}

      <Stack spacing={2}>
        {sections.map((section) => (
          <Card key={section.key} sx={{ borderRadius: 2.5 }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={0.7}
                mb={1.4}
              >
                <Box>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>
                      {section.icon}
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {section.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${section.posts.length} post${section.posts.length === 1 ? "" : "s"}`}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {section.subtitle}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ mb: 1.4 }} />

              {section.posts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma postagem nesta seção.
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1.4,
                  }}
                >
                  {section.posts.map((post) => {
                    const isCommission = section.key === "__commission__";
                    const type = post.typeId ? typeById.get(post.typeId) : null;
                    const cardSx = type
                      ? { backgroundColor: `${type.colorHex} !important` }
                      : isCommission
                        ? REPLICATION_PRACTICES_CARD_SX
                        : BEST_PRACTICES_BLUE_CARD_SX;
                    const textColor = type?.textColorHex || "#F4FAFD";
                    return (
                    <Card
                      key={post.id}
                      variant="outlined"
                      onClick={() => setReadingPost(post)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setReadingPost(post);
                        }
                      }}
                      sx={{
                        ...cardSx,
                        height: "100%",
                        borderRadius: 2,
                        borderColor: type ? `${type.colorHex}CC` : isCommission ? "rgba(102, 133, 114, 0.9)" : "rgba(83, 127, 151, 0.9)",
                        boxShadow: "0 12px 24px rgba(22, 60, 82, 0.3)",
                        cursor: "pointer",
                        transition: "transform 160ms ease, box-shadow 160ms ease",
                        "&:hover": {
                          transform: "translateY(-1px)",
                          boxShadow: "0 16px 28px rgba(22, 60, 82, 0.34)",
                        },
                      }}
                    >
                      <CardContent
                        sx={{
                          ...cardSx,
                          p: 1.5,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          spacing={1}
                        >
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: textColor }}>
                            {post.title}
                          </Typography>
                          {(canUpdate || canDelete) && (
                            <Stack direction="row" spacing={0}>
                              {canUpdate && (
                                <IconButton
                                  size="small"
                                  sx={{ color: textColor }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEdit(post);
                                  }}
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              )}
                              {canDelete && (
                                <IconButton
                                  size="small"
                                  sx={{ color: textColor }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDelete(post.id);
                                  }}
                                >
                                  <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Stack>
                          )}
                        </Stack>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mt: 0.8,
                            color: `${textColor}F0`,
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {post.content}
                        </Typography>
                        <Divider sx={{ my: 1.1, borderColor: `${textColor}40` }} />
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={0.8}
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Chip
                            size="small"
                            label={post.authorLabel || "Coordenação CIPAVD"}
                            sx={{
                              bgcolor: "rgba(255,255,255,0.15)",
                              color: textColor,
                              border: `1px solid ${textColor}40`,
                              height: 20,
                              fontSize: "0.7rem",
                            }}
                          />
                          <Typography variant="caption" sx={{ color: `${textColor}E6` }}>
                            {new Date(post.createdAt).toLocaleString("pt-BR")}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: `${textColor}E0`, mt: 0.8, display: "block" }}>
                          Clique para ler o texto completo
                        </Typography>
                      </CardContent>
                    </Card>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", md: 520 } } }}
      >
        <Box p={3} pt={5} display="flex" flexDirection="column" gap={2}>
          <Typography variant="h5" sx={{ mt: 4 }}>
            {editing ? "Editar boa prática" : "Nova boa prática"}
          </Typography>
          <TextField
            size="small"
            label="Título"
            sx={{ mt: 0.5 }}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <TextField
            size="small"
            label="Texto curto"
            multiline
            minRows={4}
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
          />
          <TextField
            select
            size="small"
            label="Relacionar a"
            value={form.target}
            onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
          >
            <MenuItem value="commission">Práticas com potencial de replicação</MenuItem>
            {localities.map((locality) => (
              <MenuItem key={locality.id} value={locality.id}>
                {locality.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" onClick={handleSave}>
              Salvar
            </Button>
            <Button variant="outlined" color="error" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Dialog
        open={Boolean(readingPost)}
        onClose={() => setReadingPost(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          {readingPost?.title || "Boa prática"}
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            variant="body1"
            sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
          >
            {readingPost?.content || "-"}
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            sx={{ mt: 2 }}
          >
            <Chip
              size="small"
              label={readingPost?.authorLabel || "Coordenação CIPAVD"}
              sx={{
                bgcolor: "rgba(0,0,0,0.08)",
                border: "1px solid rgba(0,0,0,0.12)",
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {readingPost ? new Date(readingPost.createdAt).toLocaleString("pt-BR") : "-"}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReadingPost(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


