import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { can } from '../app/rbac';
import {
  useLocalities,
  useLookupLdapUser,
  useMe,
  useRemoveUserRole,
  useRoles,
  useUpdateUser,
  useUpsertLdapUser,
  useUsers,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';

type RoleItem = { id: string; name: string };
type LocalityItem = { id: string; name: string; code: string };
type UserRoleItem = { role?: { id: string; name: string } | null };
type UserItem = {
  id: string;
  name: string;
  email: string;
  ldapUid?: string | null;
  localityId?: string | null;
  roles?: UserRoleItem[];
};
type LdapLookupResponse = {
  user?: {
    uid: string;
    dn: string;
    name: string | null;
    email: string | null;
    fabom: string | null;
  };
};

function getUserRoles(user: UserItem) {
  return (user.roles ?? [])
    .map((entry) => entry?.role)
    .filter((role): role is { id: string; name: string } => Boolean(role?.id && role?.name));
}

function normalizeRoleName(roleName: string | null | undefined) {
  return String(roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function roleRequiresLocality(roleName: string | null | undefined) {
  return normalizeRoleName(roleName) === 'admin especialidade local';
}

export function AdminRbacPage() {
  const { data: me } = useMe();
  const toast = useToast();
  const canViewUsers = can(me, 'users', 'view');
  const canUpdateUsers = can(me, 'users', 'update');
  const canViewLocalities = can(me, 'localities', 'view');

  const rolesQuery = useRoles();
  const usersQuery = useUsers(canViewUsers);
  const localitiesQuery = useLocalities(canViewLocalities);
  const updateUser = useUpdateUser();
  const removeUserRole = useRemoveUserRole();
  const ldapLookup = useLookupLdapUser();
  const upsertLdapUser = useUpsertLdapUser();

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRoleId, setEditRoleId] = useState('');
  const [editLocalityId, setEditLocalityId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    userName: string;
    roleId: string;
    roleName: string;
  } | null>(null);

  const [ldapUid, setLdapUid] = useState('');
  const [ldapRoleId, setLdapRoleId] = useState('');
  const [ldapLocalityId, setLdapLocalityId] = useState('');
  const [ldapPreview, setLdapPreview] = useState<LdapLookupResponse['user'] | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [roleFilterId, setRoleFilterId] = useState('');
  const [localityFilterId, setLocalityFilterId] = useState('');

  const users = useMemo(
    () =>
      ((usersQuery.data?.items ?? []) as UserItem[]).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [usersQuery.data?.items],
  );
  const roles = useMemo(
    () =>
      ((rolesQuery.data?.items ?? []) as RoleItem[]).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [rolesQuery.data?.items],
  );
  const localities = useMemo(
    () =>
      ((localitiesQuery.data?.items ?? []) as LocalityItem[]).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [localitiesQuery.data?.items],
  );
  const localityById = useMemo(
    () => new Map(localities.map((locality) => [locality.id, locality])),
    [localities],
  );
  const selectedEditRole = useMemo(
    () => roles.find((role) => role.id === editRoleId) ?? null,
    [editRoleId, roles],
  );
  const selectedLdapRole = useMemo(
    () => roles.find((role) => role.id === ldapRoleId) ?? null,
    [ldapRoleId, roles],
  );
  const editRoleNeedsLocality = roleRequiresLocality(selectedEditRole?.name);
  const ldapRoleNeedsLocality = roleRequiresLocality(selectedLdapRole?.name);
  const filteredUsers = useMemo(() => {
    const nameTerm = nameFilter.trim().toLowerCase();
    const cpfTerm = cpfFilter.trim().toLowerCase();

    return users.filter((user) => {
      const role = getUserRoles(user)[0] ?? null;

      if (nameTerm && !String(user.name ?? '').toLowerCase().includes(nameTerm)) {
        return false;
      }

      if (cpfTerm && !String(user.ldapUid ?? '').toLowerCase().includes(cpfTerm)) {
        return false;
      }

      if (roleFilterId && role?.id !== roleFilterId) {
        return false;
      }

      if (localityFilterId) {
        if ((user.localityId ?? '') !== localityFilterId) {
          return false;
        }
      }

      return true;
    });
  }, [cpfFilter, localityFilterId, nameFilter, roleFilterId, users]);

  const openEditModal = (user: UserItem) => {
    const primaryRole = getUserRoles(user)[0];
    setEditingUser(user);
    setEditRoleId(primaryRole?.id ?? '');
    setEditLocalityId(user.localityId ?? '');
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!editRoleId) {
      toast.push({ message: 'Selecione um papel para salvar.', severity: 'warning' });
      return;
    }
    if (editRoleNeedsLocality && !editLocalityId) {
      toast.push({
        message: 'Para Admin Especialidade Local, a localidade é obrigatória.',
        severity: 'warning',
      });
      return;
    }

    try {
      await updateUser.mutateAsync({
        id: editingUser.id,
        roleId: editRoleId,
        localityId: editLocalityId || null,
      });
      toast.push({ message: 'Usuário atualizado com sucesso.', severity: 'success' });
      setEditingUser(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao atualizar usuário',
        severity: 'error',
      });
    }
  };

  const handleRemovePermission = async () => {
    if (!removeTarget) return;
    try {
      await removeUserRole.mutateAsync({
        userId: removeTarget.userId,
        roleId: removeTarget.roleId,
      });
      toast.push({ message: 'Permissão removida com sucesso.', severity: 'success' });
      setRemoveTarget(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao remover permissão',
        severity: 'error',
      });
    }
  };

  const handleLookupLdap = async () => {
    const uid = ldapUid.trim();
    if (!uid) {
      toast.push({ message: 'Informe o CPF/UID FAB.', severity: 'warning' });
      return;
    }
    try {
      const result = (await ldapLookup.mutateAsync(uid)) as LdapLookupResponse;
      if (!result.user) {
        setLdapPreview(null);
        toast.push({ message: 'Usuário não encontrado no LDAP.', severity: 'warning' });
        return;
      }
      setLdapPreview(result.user);
      toast.push({ message: 'Usuário LDAP encontrado.', severity: 'success' });
    } catch (error) {
      setLdapPreview(null);
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao consultar LDAP',
        severity: 'error',
      });
    }
  };

  const handleCreateFromLdap = async () => {
    if (!ldapPreview) {
      toast.push({ message: 'Busque o usuário no LDAP antes de salvar.', severity: 'warning' });
      return;
    }
    if (!ldapRoleId) {
      toast.push({ message: 'Selecione o papel do usuário.', severity: 'warning' });
      return;
    }
    if (ldapRoleNeedsLocality && !ldapLocalityId) {
      toast.push({
        message: 'Para Admin Especialidade Local, a localidade é obrigatória.',
        severity: 'warning',
      });
      return;
    }

    try {
      await upsertLdapUser.mutateAsync({
        uid: ldapPreview.uid,
        roleId: ldapRoleId,
        localityId: ldapLocalityId || null,
        replaceExistingRoles: true,
      });
      toast.push({ message: 'Usuário LDAP vinculado com sucesso.', severity: 'success' });
      setLdapUid('');
      setLdapRoleId('');
      setLdapLocalityId('');
      setLdapPreview(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao vincular usuário LDAP',
        severity: 'error',
      });
    }
  };

  if (!canViewUsers) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Admin RBAC
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin RBAC
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gerencie papéis e localidade dos usuários de forma centralizada.
      </Typography>

      <Stack spacing={2.2}>
        {canUpdateUsers && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Adicionar usuário FAB (LDAP)
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.4 }}>
                <TextField
                  size="small"
                  label="CPF/UID FAB"
                  value={ldapUid}
                  onChange={(event) => setLdapUid(event.target.value)}
                  sx={{ minWidth: 230 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    void handleLookupLdap();
                  }}
                  disabled={ldapLookup.isPending}
                >
                  {ldapLookup.isPending ? 'Buscando...' : 'Buscar no LDAP'}
                </Button>
              </Stack>

              {ldapPreview && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {ldapPreview.name || 'Sem nome no LDAP'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    CPF/UID: {ldapPreview.uid}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Email: {ldapPreview.email || 'Não informado'}
                  </Typography>
                </Box>
              )}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                <TextField
                  select
                  size="small"
                  label="Papel"
                  value={ldapRoleId}
                  onChange={(event) => setLdapRoleId(event.target.value)}
                  sx={{ minWidth: 230 }}
                >
                  <MenuItem value="">Selecionar</MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Localidade"
                  value={ldapLocalityId}
                  onChange={(event) => setLdapLocalityId(event.target.value)}
                  sx={{ minWidth: 230 }}
                  error={ldapRoleNeedsLocality && !ldapLocalityId}
                  helperText={
                    ldapRoleNeedsLocality && !ldapLocalityId
                      ? 'Obrigatória para este papel.'
                      : undefined
                  }
                >
                  <MenuItem value="">Sem localidade</MenuItem>
                  {localities.map((locality) => (
                    <MenuItem key={locality.id} value={locality.id}>
                      {locality.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  onClick={() => {
                    void handleCreateFromLdap();
                  }}
                  disabled={
                    upsertLdapUser.isPending ||
                    !ldapPreview ||
                    !ldapRoleId ||
                    (ldapRoleNeedsLocality && !ldapLocalityId)
                  }
                >
                  {upsertLdapUser.isPending ? 'Salvando...' : 'Vincular usuário'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Usuários cadastrados
            </Typography>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.2}
              sx={{ mb: 1.6 }}
            >
              <TextField
                size="small"
                label="Filtrar por nome"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                sx={{ minWidth: 220 }}
              />
              <TextField
                size="small"
                label="Filtrar por CPF"
                value={cpfFilter}
                onChange={(event) => setCpfFilter(event.target.value)}
                sx={{ minWidth: 190 }}
              />
              <TextField
                select
                size="small"
                label="Filtrar por papel"
                value={roleFilterId}
                onChange={(event) => setRoleFilterId(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Filtrar por localidade"
                value={localityFilterId}
                onChange={(event) => setLocalityFilterId(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {localities.map((locality) => (
                  <MenuItem key={locality.id} value={locality.id}>
                    {locality.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="text"
                onClick={() => {
                  setNameFilter('');
                  setCpfFilter('');
                  setRoleFilterId('');
                  setLocalityFilterId('');
                }}
              >
                Limpar filtros
              </Button>
            </Stack>

            {usersQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Carregando usuários...
              </Typography>
            ) : usersQuery.isError ? (
              <Typography variant="body2" color="error.main">
                {parseApiError(usersQuery.error).message ?? 'Erro ao carregar usuários'}
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Usuário</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>CPF/Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Papel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Localidade</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 110 }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum usuário encontrado com os filtros selecionados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredUsers.map((user) => {
                    const rolesByUser = getUserRoles(user);
                    const primaryRole = rolesByUser[0] ?? null;
                    const localityName = user.localityId
                      ? (localityById.get(user.localityId)?.name ?? user.localityId)
                      : 'Sem localidade';

                    return (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {user.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{user.ldapUid || user.email}</TableCell>
                        <TableCell>
                          {!primaryRole ? (
                            <Chip size="small" label="Sem papel" variant="outlined" />
                          ) : (
                            <Chip
                              size="small"
                              label={primaryRole.name}
                              color="primary"
                              variant="filled"
                            />
                          )}
                        </TableCell>
                        <TableCell>{localityName}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.2}>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={!canUpdateUsers}
                              onClick={() => openEditModal(user)}
                            >
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={!canUpdateUsers || !primaryRole}
                              onClick={() => {
                                if (!primaryRole) return;
                                setRemoveTarget({
                                  userId: user.id,
                                  userName: user.name,
                                  roleId: primaryRole.id,
                                  roleName: primaryRole.name,
                                });
                              }}
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
          </CardContent>
        </Card>
      </Stack>

      <Dialog
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar usuário</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.8 }}>
            Atualize o papel e a localidade do usuário selecionado.
          </DialogContentText>

          <Stack spacing={1.4}>
            <TextField
              size="small"
              label="Usuário"
              value={editingUser?.name ?? ''}
              disabled
            />
            <TextField
              select
              size="small"
              label="Papel"
              value={editRoleId}
              onChange={(event) => setEditRoleId(event.target.value)}
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Localidade"
              value={editLocalityId}
              onChange={(event) => setEditLocalityId(event.target.value)}
              error={editRoleNeedsLocality && !editLocalityId}
              helperText={
                editRoleNeedsLocality && !editLocalityId
                  ? 'Localidade obrigatória para este papel.'
                  : undefined
              }
            >
              <MenuItem value="">Sem localidade</MenuItem>
              {localities.map((locality) => (
                <MenuItem key={locality.id} value={locality.id}>
                  {locality.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingUser(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleSaveUser();
            }}
            disabled={updateUser.isPending || (editRoleNeedsLocality && !editLocalityId)}
          >
            {updateUser.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remover permissão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Confirma remover o papel <strong>{removeTarget?.roleName}</strong> do usuário{' '}
            <strong>{removeTarget?.userName}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              void handleRemovePermission();
            }}
            disabled={removeUserRole.isPending}
          >
            {removeUserRole.isPending ? 'Removendo...' : 'Remover'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
