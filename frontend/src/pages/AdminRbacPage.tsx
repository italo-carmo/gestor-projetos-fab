import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  useMe,
  usePermissionsCatalog,
  useRbacSimulate,
  useRoles,
  useUsers,
  useUpdateUser,
  useEloRoles,
  useUserModuleAccess,
  useUpdateUserModuleAccess,
  useSetRolePermissions,
  useLookupLdapUser,
  useUpsertLdapUser,
  useLocalities,
  useSpecialties,
} from '../api/hooks';
import { can } from '../app/rbac';
import { useMemo, useState } from 'react';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';

type PermissionItem = { resource: string; action: string; scope: string };
type RoleItem = { id: string; name: string };
type UserItem = {
  id: string;
  name: string;
  email: string;
  ldapUid?: string | null;
  eloRoleId?: string | null;
  roles?: Array<{ id: string; name: string }>;
};
type EloRoleItem = { id: string; code: string; name: string };
type LocalityItem = { id: string; name: string; code: string };
type SpecialtyItem = { id: string; name: string };
type SimulateResponse = { permissions?: PermissionItem[]; wildcard?: boolean };
type UserModuleAccessItem = {
  resource: string;
  baseEnabled: boolean;
  enabled: boolean;
  isOverridden: boolean;
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

function formatModuleLabel(resource: string) {
  return resource
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupPermissionsByModule(items: PermissionItem[]) {
  const grouped = new Map<string, Set<string>>();
  for (const item of items) {
    const set = grouped.get(item.resource) ?? new Set<string>();
    set.add(item.action);
    grouped.set(item.resource, set);
  }

  return Array.from(grouped.entries())
    .map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.resource.localeCompare(b.resource));
}

export function AdminRbacPage() {
  const { data: me } = useMe();
  const toast = useToast();

  const rolesQuery = useRoles();
  const usersQuery = useUsers();
  const permissionsQuery = usePermissionsCatalog();
  const updateUser = useUpdateUser();
  const eloRolesQuery = useEloRoles();
  const setRolePermissions = useSetRolePermissions();
  const ldapLookup = useLookupLdapUser();
  const upsertLdapUser = useUpsertLdapUser();
  const canReadLocalities = can(me, 'localities', 'view');
  const canReadSpecialties = can(me, 'specialties', 'view');
  const localitiesQuery = useLocalities(canReadLocalities);
  const specialtiesQuery = useSpecialties(canReadSpecialties);

  const [editRoleId, setEditRoleId] = useState('');
  const [updatingRoleResource, setUpdatingRoleResource] = useState('');

  const [simUserId, setSimUserId] = useState('');
  const [simRoleId, setSimRoleId] = useState('');

  const [moduleUserId, setModuleUserId] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [updatingModuleResource, setUpdatingModuleResource] = useState('');

  const [ldapUid, setLdapUid] = useState('');
  const [ldapRoleId, setLdapRoleId] = useState('');
  const [ldapLocalityId, setLdapLocalityId] = useState('');
  const [ldapSpecialtyId, setLdapSpecialtyId] = useState('');
  const [ldapEloRoleId, setLdapEloRoleId] = useState('');
  const [ldapReplaceRoles, setLdapReplaceRoles] = useState(false);
  const [ldapUserPreview, setLdapUserPreview] = useState<LdapLookupResponse['user'] | null>(null);

  const roleEditorQuery = useRbacSimulate({ roleId: editRoleId || undefined });
  const simulateQuery = useRbacSimulate({
    userId: simUserId || undefined,
    roleId: simRoleId || undefined,
  });
  const userModuleAccessQuery = useUserModuleAccess(moduleUserId || undefined);
  const updateUserModuleAccess = useUpdateUserModuleAccess();

  const roles = ((rolesQuery.data?.items ?? []) as RoleItem[]).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  const users = ((usersQuery.data?.items ?? []) as UserItem[]).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  const eloRoles = ((eloRolesQuery.data?.items ?? []) as EloRoleItem[]).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  const localities = ((localitiesQuery.data?.items ?? []) as LocalityItem[]).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  const specialties = ((specialtiesQuery.data?.items ?? []) as SpecialtyItem[]).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  const permissionCatalog = useMemo(
    () => (permissionsQuery.data?.items ?? []) as PermissionItem[],
    [permissionsQuery.data?.items],
  );

  const permissionsByResource = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const item of permissionCatalog) {
      const list = map.get(item.resource) ?? [];
      list.push(item);
      map.set(item.resource, list);
    }
    return map;
  }, [permissionCatalog]);

  const allResources = useMemo(
    () => Array.from(permissionsByResource.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [permissionsByResource],
  );

  const roleEditorData = roleEditorQuery.data as SimulateResponse | undefined;
  const roleEditorPermissions = useMemo(
    () => roleEditorData?.permissions ?? [],
    [roleEditorData?.permissions],
  );
  const roleEditorPermissionKeys = useMemo(
    () =>
      new Set(
        roleEditorPermissions.map(
          (perm) => `${perm.resource}:${perm.action}:${perm.scope}`,
        ),
      ),
    [roleEditorPermissions],
  );
  const roleIsWildcard = Boolean(roleEditorData?.wildcard);

  const simulatorData = simulateQuery.data as SimulateResponse | undefined;
  const simulatorPermissions = useMemo(
    () => simulatorData?.permissions ?? [],
    [simulatorData?.permissions],
  );
  const simulatorModules = useMemo(
    () => groupPermissionsByModule(simulatorPermissions),
    [simulatorPermissions],
  );

  const catalogModules = useMemo(
    () => groupPermissionsByModule(permissionCatalog),
    [permissionCatalog],
  );

  const userModules = useMemo(
    () => ((userModuleAccessQuery.data?.modules as UserModuleAccessItem[] | undefined) ?? []),
    [userModuleAccessQuery.data?.modules],
  );
  const filteredUserModules = useMemo(() => {
    const term = moduleSearch.trim().toLowerCase();
    const sorted = [...userModules].sort((a, b) =>
      formatModuleLabel(a.resource).localeCompare(formatModuleLabel(b.resource), 'pt-BR'),
    );
    if (!term) return sorted;
    return sorted.filter((module) => {
      const label = formatModuleLabel(module.resource).toLowerCase();
      return label.includes(term);
    });
  }, [moduleSearch, userModules]);

  const handleToggleRoleModule = async (resource: string, enabled: boolean) => {
    if (!editRoleId) return;
    if (roleIsWildcard) {
      toast.push({
        message:
          'Este papel está como curinga (*). Ajuste o papel para não curinga antes de editar por módulo.',
        severity: 'warning',
      });
      return;
    }

    const currentPermissions = roleEditorPermissions;
    const modulePermissions = permissionsByResource.get(resource) ?? [];
    let nextPermissions = currentPermissions;

    if (enabled) {
      const toAdd = modulePermissions.filter(
        (perm) => !roleEditorPermissionKeys.has(`${perm.resource}:${perm.action}:${perm.scope}`),
      );
      nextPermissions = [...currentPermissions, ...toAdd];
    } else {
      nextPermissions = currentPermissions.filter((perm) => perm.resource !== resource);
    }

    try {
      setUpdatingRoleResource(resource);
      await setRolePermissions.mutateAsync({
        roleId: editRoleId,
        permissions: nextPermissions,
      });
      await roleEditorQuery.refetch();
      toast.push({ message: 'Permissões do papel atualizadas', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao atualizar permissões do papel',
        severity: 'error',
      });
    } finally {
      setUpdatingRoleResource('');
    }
  };

  const handleToggleUserModule = async (resource: string, enabled: boolean) => {
    if (!moduleUserId) return;
    try {
      setUpdatingModuleResource(resource);
      await updateUserModuleAccess.mutateAsync({
        userId: moduleUserId,
        resource,
        enabled,
      });
      toast.push({ message: 'Módulo atualizado', severity: 'success' });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao atualizar módulo',
        severity: 'error',
      });
    } finally {
      setUpdatingModuleResource('');
    }
  };

  const handleLookupLdapUser = async () => {
    const uid = ldapUid.trim();
    if (!uid) {
      toast.push({ message: 'Informe o CPF/UID FAB.', severity: 'warning' });
      return;
    }

    try {
      const data = (await ldapLookup.mutateAsync(uid)) as LdapLookupResponse;
      if (!data?.user) {
        toast.push({ message: 'Usuário não encontrado no LDAP.', severity: 'warning' });
        setLdapUserPreview(null);
        return;
      }
      setLdapUserPreview(data.user);
      toast.push({ message: 'Usuário encontrado no LDAP.', severity: 'success' });
    } catch (error) {
      setLdapUserPreview(null);
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao consultar LDAP',
        severity: 'error',
      });
    }
  };

  const handleUpsertLdapUser = async () => {
    if (!ldapUserPreview) {
      toast.push({ message: 'Busque o usuário no LDAP antes de vincular.', severity: 'warning' });
      return;
    }
    if (!ldapRoleId) {
      toast.push({ message: 'Selecione um papel.', severity: 'warning' });
      return;
    }

    try {
      await upsertLdapUser.mutateAsync({
        uid: ldapUserPreview.uid,
        roleId: ldapRoleId,
        localityId: ldapLocalityId || null,
        specialtyId: ldapSpecialtyId || null,
        eloRoleId: ldapEloRoleId || null,
        replaceExistingRoles: ldapReplaceRoles,
      });
      toast.push({ message: 'Usuário LDAP vinculado com sucesso.', severity: 'success' });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? 'Erro ao vincular usuário LDAP',
        severity: 'error',
      });
    }
  };

  if (!can(me, 'roles', 'view') && !can(me, 'users', 'view')) {
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
        Gerencie permissões por seleção visual de módulos, sem JSON.
      </Typography>

      <Stack spacing={2}>
        {can(me, 'roles', 'view') && can(me, 'roles', 'permissions') && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Permissões por módulo (papel)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selecione um papel e ligue/desligue os módulos. Isso altera o acesso padrão de todos os usuários desse papel.
              </Typography>

              <TextField
                select
                size="small"
                label="Papel"
                value={editRoleId}
                onChange={(e) => setEditRoleId(e.target.value)}
                sx={{ minWidth: 280, mb: 2 }}
              >
                <MenuItem value="">Selecionar</MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>

              {!editRoleId ? (
                <Typography variant="body2" color="text.secondary">
                  Selecione um papel para editar módulos.
                </Typography>
              ) : roleEditorQuery.isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Carregando permissões do papel...
                </Typography>
              ) : roleEditorQuery.isError ? (
                <Typography variant="body2" color="error.main">
                  {parseApiError(roleEditorQuery.error).message ?? 'Erro ao carregar permissões do papel.'}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Módulo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Acesso</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Permissões do módulo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Observação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allResources.map((resource) => {
                      const enabled = roleIsWildcard
                        ? true
                        : roleEditorPermissions.some((perm) => perm.resource === resource);
                      const modulePerms = permissionsByResource.get(resource) ?? [];
                      return (
                        <TableRow key={resource}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {formatModuleLabel(resource)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {resource}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={enabled}
                              disabled={
                                (setRolePermissions.isPending &&
                                  updatingRoleResource === resource) ||
                                roleIsWildcard
                              }
                              onChange={(_evt, checked) => {
                                void handleToggleRoleModule(resource, checked);
                              }}
                            />
                          </TableCell>
                          <TableCell>{modulePerms.length}</TableCell>
                          <TableCell>
                            {roleIsWildcard ? (
                              <Chip
                                size="small"
                                label="Papel curinga (*)"
                                color="warning"
                                variant="outlined"
                              />
                            ) : enabled ? (
                              'Ativo'
                            ) : (
                              'Inativo'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Simulador de permissão
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                size="small"
                label="Usuário"
                value={simUserId}
                onChange={(e) => {
                  setSimUserId(e.target.value);
                  setSimRoleId('');
                }}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">Selecionar</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name} ({user.ldapUid || user.email})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Papel"
                value={simRoleId}
                onChange={(e) => {
                  setSimRoleId(e.target.value);
                  setSimUserId('');
                }}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">Selecionar</MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Módulos efetivos
            </Typography>
            {!simUserId && !simRoleId ? (
              <Typography variant="body2" color="text.secondary">
                Selecione usuário ou papel para visualizar as permissões efetivas.
              </Typography>
            ) : simulateQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Carregando simulação...
              </Typography>
            ) : simulateQuery.isError ? (
              <Typography variant="body2" color="error.main">
                {parseApiError(simulateQuery.error).message ?? 'Erro ao simular permissões.'}
              </Typography>
            ) : simulatorModules.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sem módulos habilitados para o recorte selecionado.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Módulo</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {simulatorModules.map((item) => (
                    <TableRow key={item.resource}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {formatModuleLabel(item.resource)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.resource}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.actions.includes('*') ? 'Todas' : item.actions.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {can(me, 'users', 'view') && can(me, 'users', 'update') && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Vincular usuário FAB (LDAP)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Busque o militar no LDAP da FAB e atribua o papel no sistema.
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  label="CPF/UID FAB"
                  value={ldapUid}
                  onChange={(e) => setLdapUid(e.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    void handleLookupLdapUser();
                  }}
                  disabled={ldapLookup.isPending}
                >
                  {ldapLookup.isPending ? 'Consultando...' : 'Buscar no LDAP'}
                </Button>
              </Stack>

              {ldapUserPreview && (
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    {ldapUserPreview.name || 'Sem nome no LDAP'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    UID: {ldapUserPreview.uid}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Email: {ldapUserPreview.email || 'Não informado'}
                  </Typography>
                  {ldapUserPreview.fabom && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      OM: {ldapUserPreview.fabom}
                    </Typography>
                  )}
                </Box>
              )}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                <TextField
                  select
                  size="small"
                  label="Papel"
                  value={ldapRoleId}
                  onChange={(e) => setLdapRoleId(e.target.value)}
                  sx={{ minWidth: 260 }}
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
                  label="Localidade (opcional)"
                  value={ldapLocalityId}
                  onChange={(e) => setLdapLocalityId(e.target.value)}
                  sx={{ minWidth: 260 }}
                >
                  <MenuItem value="">Sem localidade</MenuItem>
                  {localities.map((locality) => (
                    <MenuItem key={locality.id} value={locality.id}>
                      {locality.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                  select
                  size="small"
                  label="Especialidade (opcional)"
                  value={ldapSpecialtyId}
                  onChange={(e) => setLdapSpecialtyId(e.target.value)}
                  sx={{ minWidth: 260 }}
                >
                  <MenuItem value="">Sem especialidade</MenuItem>
                  {specialties.map((specialty) => (
                    <MenuItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Elo responsável (opcional)"
                  value={ldapEloRoleId}
                  onChange={(e) => setLdapEloRoleId(e.target.value)}
                  sx={{ minWidth: 260 }}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {eloRoles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                <Chip
                  size="small"
                  color={ldapReplaceRoles ? 'warning' : 'default'}
                  variant={ldapReplaceRoles ? 'filled' : 'outlined'}
                  label={ldapReplaceRoles ? 'Substituir papéis atuais' : 'Manter papéis atuais'}
                  onClick={() => setLdapReplaceRoles((current) => !current)}
                />
                <Button
                  variant="contained"
                  onClick={() => {
                    void handleUpsertLdapUser();
                  }}
                  disabled={upsertLdapUser.isPending || !ldapUserPreview || !ldapRoleId}
                >
                  {upsertLdapUser.isPending ? 'Vinculando...' : 'Vincular usuário LDAP'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {can(me, 'users', 'view') && can(me, 'users', 'update') && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Acesso por módulo por usuário
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selecione um usuário e ligue/desligue os módulos permitidos para ele.
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  select
                  size="small"
                  label="Usuário"
                  value={moduleUserId}
                  onChange={(e) => {
                    setModuleUserId(e.target.value);
                    setModuleSearch('');
                  }}
                  sx={{ minWidth: 280 }}
                >
                  <MenuItem value="">Selecionar</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} ({user.ldapUid || user.email})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Buscar módulo"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  sx={{ minWidth: 240 }}
                  disabled={!moduleUserId}
                />
              </Stack>

              {!moduleUserId ? (
                <Typography variant="body2" color="text.secondary">
                  Selecione um usuário para ajustar os módulos.
                </Typography>
              ) : userModuleAccessQuery.isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Carregando módulos...
                </Typography>
              ) : userModuleAccessQuery.isError ? (
                <Typography variant="body2" color="error.main">
                  {parseApiError(userModuleAccessQuery.error).message ?? 'Erro ao carregar módulos.'}
                </Typography>
              ) : filteredUserModules.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum módulo encontrado para o filtro atual.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {filteredUserModules.map((module) => (
                    <Box
                      key={module.resource}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        px: 2,
                        py: 1.25,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {formatModuleLabel(module.resource)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Padrão do papel: {module.baseEnabled ? 'ligado' : 'desligado'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {module.isOverridden && (
                          <Chip size="small" label="Personalizado" color="warning" variant="outlined" />
                        )}
                        <Chip
                          size="small"
                          label={module.enabled ? 'Ligado' : 'Desligado'}
                          color={module.enabled ? 'success' : 'default'}
                          variant={module.enabled ? 'filled' : 'outlined'}
                        />
                        <Switch
                          checked={Boolean(module.enabled)}
                          disabled={
                            updateUserModuleAccess.isPending &&
                            updatingModuleResource === module.resource
                          }
                          onChange={(_evt, checked) => {
                            void handleToggleUserModule(module.resource, checked);
                          }}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        )}

        {can(me, 'users', 'view') && can(me, 'users', 'update') && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Responsáveis por Elo (nível Brasil)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Atribua o Elo que cada usuário acompanha a nível nacional (ex.: Psicologia, SSO). Esses usuários verão apenas os checklists do respectivo Elo.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Elo responsável</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.ldapUid || user.email}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={user.eloRoleId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateUser.mutate(
                              { id: user.id, eloRoleId: val || null },
                              {
                                onSuccess: () =>
                                  toast.push({ message: 'Elo atualizado', severity: 'success' }),
                                onError: (err) =>
                                  toast.push({
                                    message:
                                      parseApiError(err).message ?? 'Erro ao atualizar',
                                    severity: 'error',
                                  }),
                              },
                            );
                          }}
                          disabled={updateUser.isPending}
                          sx={{ minWidth: 220 }}
                        >
                          <MenuItem value="">Nenhum</MenuItem>
                          {eloRoles.map((role) => (
                            <MenuItem key={role.id} value={role.id}>
                              {role.name} ({role.code})
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Catálogo de módulos
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Referência visual dos módulos e ações disponíveis no sistema.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Módulo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalogModules.map((item) => (
                  <TableRow key={item.resource}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {formatModuleLabel(item.resource)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.resource}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.actions.includes('*') ? 'Todas' : item.actions.join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
