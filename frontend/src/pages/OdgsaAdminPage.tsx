import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useCreateOdgsa,
  useMe,
  useOdgsasAdmin,
  useUpdateOdgsa,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { useToast } from "../app/toast";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";

type OdgsaAdminItem = {
  id: string;
  code: string;
  name: string;
  usersCount: number;
  omsCount: number;
  role: { id: string; name: string; description?: string | null };
};

type EditorState =
  | { mode: "create"; item: null }
  | { mode: "edit"; item: OdgsaAdminItem }
  | null;

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function OdgsaAdminPage() {
  const toast = useToast();
  const { data: me } = useMe();
  const canView = can(me, "odgsa_admin", "view", "NATIONAL");
  const canCreate = can(me, "odgsa_admin", "create", "NATIONAL");
  const canUpdate = can(me, "odgsa_admin", "update", "NATIONAL");
  const query = useOdgsasAdmin(canView);
  const createOdgsa = useCreateOdgsa();
  const updateOdgsa = useUpdateOdgsa();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const items = useMemo(
    () => (query.data?.items ?? []) as OdgsaAdminItem[],
    [query.data?.items],
  );
  const filteredItems = useMemo(() => {
    const needle = normalize(search);
    if (!needle) return items;
    return items.filter((item) =>
      normalize(`${item.code} ${item.name} ${item.role?.name}`).includes(
        needle,
      ),
    );
  }, [items, search]);

  const openCreate = () => {
    setCode("");
    setName("");
    setEditor({ mode: "create", item: null });
  };

  const openEdit = (item: OdgsaAdminItem) => {
    setCode(item.code);
    setName(item.name);
    setEditor({ mode: "edit", item });
  };

  const closeEditor = () => {
    if (createOdgsa.isPending || updateOdgsa.isPending) return;
    setEditor(null);
  };

  const save = async () => {
    const payload = { code: code.trim(), name: name.trim() };
    if (!payload.code || !payload.name) {
      toast.push({
        message: "Informe o código e o nome do ODGSA.",
        severity: "warning",
      });
      return;
    }

    try {
      if (editor?.mode === "edit") {
        await updateOdgsa.mutateAsync({ id: editor.item.id, payload });
        toast.push({ message: "ODGSA atualizado.", severity: "success" });
      } else {
        await createOdgsa.mutateAsync(payload);
        toast.push({
          message: "ODGSA e papel de acesso criados.",
          severity: "success",
        });
      }
      setEditor(null);
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Não foi possível salvar o ODGSA.",
        severity: "error",
      });
    }
  };

  if (query.isLoading) return <SkeletonState />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <Stack spacing={2.5}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        flexDirection={{ xs: "column", sm: "row" }}
        gap={1.5}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Administração de ODGSA
          </Typography>
          <Typography color="text.secondary">
            Cadastre os ODGSA e gere seus papéis de acompanhamento CPCA.
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
          >
            Novo ODGSA
          </Button>
        )}
      </Box>

      <Alert
        severity="info"
        action={
          <Button
            component={RouterLink}
            to="/admin/rbac"
            color="inherit"
            size="small"
            startIcon={<ManageAccountsRoundedIcon />}
          >
            Atribuir a usuários
          </Button>
        }
      >
        Cada cadastro cria um papel sistêmico somente leitura. Atribua esse
        papel ao militar pelo fluxo LDAP em Usuários e Permissões.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <TextField
            fullWidth
            size="small"
            label="Buscar ODGSA"
            placeholder="Código, nome ou papel de acesso"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        {filteredItems.length === 0 ? (
          <EmptyState
            title={
              items.length === 0
                ? "Nenhum ODGSA cadastrado"
                : "Nenhum resultado"
            }
            description={
              items.length === 0
                ? "Crie o primeiro ODGSA para disponibilizar seu papel na administração de usuários."
                : "Ajuste o termo da busca."
            }
            actionLabel={
              items.length === 0 && canCreate ? "Criar ODGSA" : undefined
            }
            onAction={items.length === 0 && canCreate ? openCreate : undefined}
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>ODGSA</TableCell>
                  <TableCell>Papel gerado</TableCell>
                  <TableCell align="center">Usuários</TableCell>
                  <TableCell align="center">OMs</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Chip label={item.code} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {item.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.role.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Somente leitura dos acolhimentos e indicadores
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{item.usersCount}</TableCell>
                    <TableCell align="center">{item.omsCount}</TableCell>
                    <TableCell align="right">
                      {canUpdate && (
                        <Tooltip title="Editar ODGSA">
                          <IconButton
                            size="small"
                            onClick={() => openEdit(item)}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog
        open={Boolean(editor)}
        onClose={closeEditor}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editor?.mode === "edit" ? "Editar ODGSA" : "Novo ODGSA"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Código"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              inputProps={{ maxLength: 40 }}
              helperText="O papel será exibido como “ODGSA · CÓDIGO”."
            />
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ maxLength: 160 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={() => void save()}
            variant="contained"
            disabled={createOdgsa.isPending || updateOdgsa.isPending}
          >
            {createOdgsa.isPending || updateOdgsa.isPending
              ? "Salvando..."
              : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
