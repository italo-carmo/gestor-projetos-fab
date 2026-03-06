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
  TextField,
  Typography,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import { useMemo, useState } from "react";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { hasRole, ROLE_COORDENACAO_CIPAVD } from "../app/roleAccess";
import { useToast } from "../app/toast";
import { selectTargetLocalities } from "../constants/localities";
import {
  useBestPractices,
  useCreateBestPractice,
  useDeleteBestPractice,
  useLocalities,
  useMe,
  useUpdateBestPractice,
} from "../api/hooks";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

const BEST_PRACTICES_BLUE_CARD_SX = {
  backgroundColor: "rgb(83, 127, 151) !important",
};

const REPLICATION_PRACTICES_CARD_SX = {
  backgroundColor: "rgb(56, 114, 146) !important",
};

type BestPracticePost = {
  id: string;
  title: string;
  content: string;
  isCommission: boolean;
  localityId: string | null;
  authorLabel: string | null;
  createdAt: string;
  locality?: { id: string; name: string; code?: string | null } | null;
};

export function BestPracticesPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const localitiesQuery = useLocalities();
  const [q, setQ] = useState("");
  const [localityFilter, setLocalityFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BestPracticePost | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    target: "commission",
  });

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      localityId: localityFilter || undefined,
    }),
    [q, localityFilter],
  );

  const postsQuery = useBestPractices(filters);
  const createBestPractice = useCreateBestPractice();
  const updateBestPractice = useUpdateBestPractice();
  const deleteBestPractice = useDeleteBestPractice();

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
        {canCreate && (
          <Button variant="contained" onClick={openCreate}>
            Nova postagem
          </Button>
        )}
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
                    display: section.key === "__commission__" ? "flex" : "grid",
                    flexDirection: section.key === "__commission__" ? "column" : undefined,
                    gridTemplateColumns: section.key === "__commission__" ? undefined : {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1.4,
                  }}
                >
                  {section.posts.map((post) => {
                    const isCommission = section.key === "__commission__";
                    const cardSx = isCommission ? REPLICATION_PRACTICES_CARD_SX : BEST_PRACTICES_BLUE_CARD_SX;
                    return (
                    <Card
                      key={post.id}
                      variant="outlined"
                      sx={{
                        ...cardSx,
                        height: "100%",
                        borderRadius: 2,
                        borderColor: isCommission ? "rgba(56, 114, 146, 0.9)" : "rgba(83, 127, 151, 0.9)",
                        boxShadow: "0 12px 24px rgba(22, 60, 82, 0.3)",
                        width: isCommission ? "100%" : undefined,
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
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#F4FAFD" }}>
                            {post.title}
                          </Typography>
                          {(canUpdate || canDelete) && (
                            <Stack direction="row" spacing={0}>
                              {canUpdate && (
                                <IconButton size="small" sx={{ color: "#F4FAFD" }} onClick={() => openEdit(post)}>
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              )}
                              {canDelete && (
                                <IconButton size="small" sx={{ color: "#FFD5D8" }} onClick={() => handleDelete(post.id)}>
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
                            color: "rgba(244, 250, 253, 0.94)",
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {post.content}
                        </Typography>
                        <Divider sx={{ my: 1.1, borderColor: "rgba(255,255,255,0.24)" }} />
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={0.8}
                          justifyContent="space-between"
                        >
                          <Typography variant="caption" sx={{ color: "rgba(236, 248, 252, 0.92)" }}>
                            Autor: {post.authorLabel || "Coordenação CIPAVD"}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "rgba(236, 248, 252, 0.9)" }}>
                            {new Date(post.createdAt).toLocaleString("pt-BR")}
                          </Typography>
                        </Stack>
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
    </Box>
  );
}


