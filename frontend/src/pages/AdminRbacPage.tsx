import { useMemo, useState } from 'react';
import {
  Autocomplete,
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
import { can } from '../app/rbac';
import {
  useLocalities,
  useLookupLdapUser,
  useMe,
  useRemoveUserRole,
  useRoles,
  useSpecialties,
  useUpdateUser,
  useUpsertLdapUser,
  useUsers,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { useToast } from '../app/toast';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';

type RoleItem = { id: string; name: string };
type LocalityItem = { id: string; name: string; code: string };
type SpecialtyItem = { id: string; name: string };
type UserRoleItem = { role?: { id: string; name: string } | null };
type UserItem = {
  id: string;
  name: string;
  email: string;
  ldapUid?: string | null;
  localityId?: string | null;
  specialtyId?: string | null;
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
  const normalized = normalizeRoleName(roleName);
  return (
    normalized === 'admin especialidade local' ||
    normalized === 'gsd localidade' ||
    normalized === 'admin localidade' ||
    normalized === 'administracao local' ||
    normalized === 'cpca'
  );
}

function roleRequiresSpecialty(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);
  return normalized === 'admin especialidade local' || normalized === 'admin especialidade nacional';
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
  const specialtiesQuery = useSpecialties(can(me, 'specialties', 'view'));
  const updateUser = useUpdateUser();
  const removeUserRole = useRemoveUserRole();
  const ldapLookup = useLookupLdapUser();
  const upsertLdapUser = useUpsertLdapUser();

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editLocalityId, setEditLocalityId] = useState('');
  const [editSpecialtyId, setEditSpecialtyId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    userName: string;
    roleId: string;
    roleName: string;
  } | null>(null);

  const [ldapUid, setLdapUid] = useState('');
  const [ldapRoleIds, setLdapRoleIds] = useState<string[]>([]);
  const [ldapLocalityId, setLdapLocalityId] = useState('');
  const [ldapSpecialtyId, setLdapSpecialtyId] = useState('');
  const [ldapPreview, setLdapPreview] = useState<LdapLookupResponse['user'] | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [roleFilterId, setRoleFilterId] = useState('');
  const [localityFilterId, setLocalityFilterId] = useState('');

  const users = useMemo(
    () =>
      ((usersQuery.data?.items ?? []) as UserItem[])
        .filter((user) => getUserRoles(user).length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
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
  const specialties = useMemo(
    () =>
      ((specialtiesQuery.data?.items ?? []) as SpecialtyItem[]).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [specialtiesQuery.data?.items],
  );
  const specialtyById = useMemo(
    () => new Map(specialties.map((specialty) => [specialty.id, specialty])),
    [specialties],
  );
  const selectedEditRoles = useMemo(
    () => roles.filter((role) => editRoleIds.includes(role.id)),
    [editRoleIds, roles],
  );
  const selectedLdapRoles = useMemo(
    () => roles.filter((role) => ldapRoleIds.includes(role.id)),
    [ldapRoleIds, roles],
  );
  const editRoleNeedsLocality = selectedEditRoles.some((role) => roleRequiresLocality(role.name));
  const ldapRoleNeedsLocality = selectedLdapRoles.some((role) => roleRequiresLocality(role.name));
  const editRoleNeedsSpecialty = selectedEditRoles.some((role) => roleRequiresSpecialty(role.name));
  const ldapRoleNeedsSpecialty = selectedLdapRoles.some((role) => roleRequiresSpecialty(role.name));
  const filteredUsers = useMemo(() => {
    const nameTerm = nameFilter.trim().toLowerCase();
    const cpfTerm = cpfFilter.trim().toLowerCase();

    return users.filter((user) => {
      const rolesByUser = getUserRoles(user);

      if (nameTerm && !String(user.name ?? '').toLowerCase().includes(nameTerm)) {
        return false;
      }

      if (cpfTerm && !String(user.ldapUid ?? '').toLowerCase().includes(cpfTerm)) {
        return false;
      }

      if (roleFilterId && !rolesByUser.some((role) => role.id === roleFilterId)) {
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
    const rolesByUser = getUserRoles(user);
    setEditingUser(user);
    setEditRoleIds(rolesByUser.map((role) => role.id));
    setEditLocalityId(user.localityId ?? '');
    setEditSpecialtyId(user.specialtyId ?? '');
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (editRoleIds.length === 0) {
      toast.push({ message: 'Selecione ao menos um papel para salvar.', severity: 'warning' });
      return;
    }
    if (editRoleNeedsLocality && !editLocalityId) {
      toast.push({
        message: 'Este papel exige localidade obrigatória.',
        severity: 'warning',
      });
      return;
    }
    if (editRoleNeedsSpecialty && !editSpecialtyId) {
      toast.push({
        message: 'Este papel exige especialidade obrigatória.',
        severity: 'warning',
      });
      return;
    }

    try {
      await updateUser.mutateAsync({
        id: editingUser.id,
        roleIds: editRoleIds,
        localityId: editLocalityId || null,
        specialtyId: editSpecialtyId || null,
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
      toast.push({ message: 'Informe o CPF/UID FAB ou e-mail.', severity: 'warning' });
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
    if (ldapRoleIds.length === 0) {
      toast.push({ message: 'Selecione ao menos um papel do usuário.', severity: 'warning' });
      return;
    }
    if (ldapRoleNeedsLocality && !ldapLocalityId) {
      toast.push({
        message: 'Este papel exige localidade obrigatória.',
        severity: 'warning',
      });
      return;
    }
    if (ldapRoleNeedsSpecialty && !ldapSpecialtyId) {
      toast.push({
        message: 'Este papel exige especialidade obrigatória.',
        severity: 'warning',
      });
      return;
    }

    try {
      await upsertLdapUser.mutateAsync({
        uid: ldapPreview.uid,
        roleIds: ldapRoleIds,
        localityId: ldapLocalityId || null,
        specialtyId: ldapSpecialtyId || null,
        replaceExistingRoles: false,
      });
      toast.push({ message: 'Usuário LDAP vinculado com sucesso.', severity: 'success' });
      setLdapUid('');
      setLdapRoleIds([]);
      setLdapLocalityId('');
      setLdapSpecialtyId('');
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
                  label="CPF/UID FAB ou e-mail"
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
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) =>
                      (selected as string[])
                        .map((id) => roles.find((role) => role.id === id)?.name ?? id)
                        .join(', '),
                  }}
                  size="small"
                  label="Papéis"
                  value={ldapRoleIds}
                  onChange={(event) => {
                    const next = event.target.value;
                    setLdapRoleIds(
                      Array.isArray(next) ? next.map((value) => String(value)) : [],
                    );
                  }}
                  sx={{ minWidth: 230 }}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Autocomplete
                  size="small"
                  options={localities}
                  value={localities.find((locality) => locality.id === ldapLocalityId) ?? null}
                  onChange={(_event, value) => setLdapLocalityId(value?.id ?? '')}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  sx={{ minWidth: 260 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Localidade"
                      error={ldapRoleNeedsLocality && !ldapLocalityId}
                      helperText={
                        ldapRoleNeedsLocality && !ldapLocalityId
                          ? 'Obrigatória para este papel.'
                          : 'Digite para filtrar OMs.'
                      }
                    />
                  )}
                />
                <TextField
                  select
                  size="small"
                  label="Especialidade"
                  value={ldapSpecialtyId}
                  onChange={(event) => setLdapSpecialtyId(event.target.value)}
                  sx={{ minWidth: 230 }}
                  error={ldapRoleNeedsSpecialty && !ldapSpecialtyId}
                  helperText={
                    ldapRoleNeedsSpecialty && !ldapSpecialtyId
                      ? 'Obrigatória para este papel.'
                      : undefined
                  }
                >
                  <MenuItem value="">Sem especialidade</MenuItem>
                  {specialties.map((specialty) => (
                    <MenuItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  sx={{
                    color: '#fff',
                    fontWeight: 700,
                    '&.Mui-disabled': {
                      color: 'rgba(255,255,255,0.85)',
                    },
                  }}
                  onClick={() => {
                    void handleCreateFromLdap();
                  }}
                  disabled={
                    upsertLdapUser.isPending ||
                    !ldapPreview ||
                    ldapRoleIds.length === 0 ||
                    (ldapRoleNeedsLocality && !ldapLocalityId) ||
                    (ldapRoleNeedsSpecialty && !ldapSpecialtyId)
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
                    <TableCell sx={{ fontWeight: 700 }}>Especialidade</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 110 }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum usuário encontrado com os filtros selecionados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredUsers.map((user) => {
                    const rolesByUser = getUserRoles(user);
                    const localityName = user.localityId
                      ? (localityById.get(user.localityId)?.name ?? user.localityId)
                      : 'Sem localidade';
                    const specialtyName = user.specialtyId
                      ? (specialtyById.get(user.specialtyId)?.name ?? user.specialtyId)
                      : 'Sem especialidade';

                    return (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {user.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{user.ldapUid || user.email}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                            {rolesByUser.map((role) => (
                              <Chip
                                key={`${user.id}:${role.id}`}
                                size="small"
                                label={role.name}
                                color="primary"
                                variant="filled"
                                onDelete={
                                  canUpdateUsers
                                    ? () =>
                                        setRemoveTarget({
                                          userId: user.id,
                                          userName: user.name,
                                          roleId: role.id,
                                          roleName: role.name,
                                        })
                                    : undefined
                                }
                              />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>{localityName}</TableCell>
                        <TableCell>{specialtyName}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!canUpdateUsers}
                            onClick={() => openEditModal(user)}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
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
            Atualize os papéis e os dados do usuário selecionado.
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
              SelectProps={{
                multiple: true,
                renderValue: (selected) =>
                  (selected as string[])
                    .map((id) => roles.find((role) => role.id === id)?.name ?? id)
                    .join(', '),
              }}
              size="small"
              label="Papéis"
              value={editRoleIds}
              onChange={(event) => {
                const next = event.target.value;
                setEditRoleIds(
                  Array.isArray(next) ? next.map((value) => String(value)) : [],
                );
              }}
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              size="small"
              options={localities}
              value={localities.find((locality) => locality.id === editLocalityId) ?? null}
              onChange={(_event, value) => setEditLocalityId(value?.id ?? '')}
              getOptionLabel={(option) => `${option.name} (${option.code})`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Localidade"
                  error={editRoleNeedsLocality && !editLocalityId}
                  helperText={
                    editRoleNeedsLocality && !editLocalityId
                      ? 'Localidade obrigatória para este papel.'
                      : 'Digite para filtrar OMs.'
                  }
                />
              )}
            />
            <TextField
              select
              size="small"
              label="Especialidade"
              value={editSpecialtyId}
              onChange={(event) => setEditSpecialtyId(event.target.value)}
              error={editRoleNeedsSpecialty && !editSpecialtyId}
              helperText={
                editRoleNeedsSpecialty && !editSpecialtyId
                  ? 'Especialidade obrigatória para este papel.'
                  : undefined
              }
            >
              <MenuItem value="">Sem especialidade</MenuItem>
              {specialties.map((specialty) => (
                <MenuItem key={specialty.id} value={specialty.id}>
                  {specialty.name}
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
            disabled={
              updateUser.isPending ||
              editRoleIds.length === 0 ||
              (editRoleNeedsLocality && !editLocalityId) ||
              (editRoleNeedsSpecialty && !editSpecialtyId)
            }
          >
            {updateUser.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          void handleRemovePermission();
        }}
        title="Remover permissão"
        message="Confirma remover este papel do usuário selecionado?"
        highlightText={removeTarget ? `${removeTarget.roleName} -> ${removeTarget.userName}` : ''}
        note="A remoção entra em vigor imediatamente."
        confirmLabel={removeUserRole.isPending ? 'Removendo...' : 'Remover'}
        severity="error"
        confirmLoading={removeUserRole.isPending}
      />
    </Box>
  );
}
