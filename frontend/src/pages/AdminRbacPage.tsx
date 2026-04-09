import { useMemo, useState } from "react";
import {
  Autocomplete,
  Avatar,
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
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { can } from "../app/rbac";
import {
  useLocalities,
  useLookupLdapUser,
  useMe,
  usePermissionsCatalog,
  usePostos,
  useRemoveUserRole,
  useRoles,
  useSpecialties,
  useUpdateUser,
  useSigpesPhoto,
  useSetRolePermissions,
  useUpsertLdapUser,
  useUsers,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import {
  CRUD_ACTIONS,
  KNOWN_PERMISSION_RESOURCES,
  type CrudAction,
  getPermissionActionLabel,
  getPermissionResourceMeta,
} from "../app/permissionMatrixMeta";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";

type PermissionEntryItem = { resource: string; action: string; scope: string };
type RoleItem = {
  id: string;
  name: string;
  wildcard?: boolean;
  description?: string | null;
  permissions?: PermissionEntryItem[];
};
type LocalityItem = { id: string; name: string; code: string };
type SpecialtyItem = { id: string; name: string };
type UserRoleItem = { role?: { id: string; name: string } | null };
type UserItem = {
  id: string;
  name: string;
  email: string;
  ldapUid?: string | null;
  ldapOm?: string | null;
  localityId?: string | null;
  specialtyId?: string | null;
  numeroOrdem?: string | null;
  roles?: UserRoleItem[];
};

function RbacUserPhotoAvatar({
  numeroOrdem,
  displayName,
}: {
  numeroOrdem: string | null | undefined;
  displayName: string;
}) {
  const sigpesPhotoQuery = useSigpesPhoto(numeroOrdem);
  const photoDataUrl = String(sigpesPhotoQuery.data?.dataUrl ?? "").trim();
  const initials =
    displayName.trim().length > 0
      ? displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
          .toUpperCase()
      : "?";

  if (photoDataUrl) {
    return (
      <Tooltip
        title={
          <Box
            component="img"
            src={photoDataUrl}
            alt=""
            sx={{
              display: "block",
              maxWidth: 320,
              maxHeight: 420,
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 1,
            }}
          />
        }
        enterDelay={250}
        leaveDelay={150}
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: "background.paper",
              p: 0.5,
              boxShadow: 6,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              maxWidth: "none",
            },
          },
        }}
      >
        <Avatar
          src={photoDataUrl}
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            cursor: "zoom-in",
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Avatar
      sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        bgcolor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      {initials}
    </Avatar>
  );
}
type LdapLookupResponse = {
  user?: {
    uid: string;
    dn: string;
    name: string | null;
    email: string | null;
    fabom: string | null;
  };
};

type MatrixRoleBadge = {
  roleId: string;
  roleName: string;
  explicit: boolean;
  fixed: boolean;
};

type MatrixExtraAction = {
  action: string;
  roles: MatrixRoleBadge[];
};

type PermissionMatrixRow = {
  resource: string;
  meta: ReturnType<typeof getPermissionResourceMeta>;
  crudRoles: Record<CrudAction, MatrixRoleBadge[]>;
  availableActions: string[];
  extraActions: MatrixExtraAction[];
};

function getUserRoles(user: UserItem) {
  return (user.roles ?? [])
    .map((entry) => entry?.role)
    .filter((role): role is { id: string; name: string } =>
      Boolean(role?.id && role?.name),
    );
}

function normalizeRoleName(roleName: string | null | undefined) {
  return String(roleName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const TI_ROLE_NAME_NORMALIZED = normalizeRoleName("TI");
const TI_BLOCKED_PERMISSION_KEYS = new Set(["audit_logs:delete"]);
const PERMISSION_SCOPE_PRIORITY: Record<string, number> = {
  LOCALITY: 0,
  LOCALITY_SPECIALTY: 1,
  SPECIALTY: 2,
  OWN: 3,
  NATIONAL: 4,
};

function isTiRoleName(roleName: string | null | undefined) {
  return normalizeRoleName(roleName) === TI_ROLE_NAME_NORMALIZED;
}

function permissionScopePriority(scope: string | null | undefined) {
  const normalized = String(scope ?? "")
    .trim()
    .toUpperCase();
  return PERMISSION_SCOPE_PRIORITY[normalized] ?? 999;
}

function isTiBlockedPermission(resource: string, action: string) {
  return TI_BLOCKED_PERMISSION_KEYS.has(`${resource}:${action}`);
}

function roleRequiresLocality(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);
  return (
    normalized === "admin especialidade local" ||
    normalized === "gsd localidade" ||
    normalized === "admin localidade" ||
    normalized === "administracao local" ||
    normalized === "cpca"
  );
}

function roleRequiresSpecialty(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);
  return (
    normalized === "admin especialidade local" ||
    normalized === "admin especialidade nacional"
  );
}

function roleIsCpca(roleName: string | null | undefined) {
  return normalizeRoleName(roleName) === "cpca";
}

/** Primeira palavra do nome (posto/código, ex.: TB, CAP). */
function firstNameToken(name: string | null | undefined) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] ?? ""
  );
}

export function AdminRbacPage() {
  const { data: me } = useMe();
  const toast = useToast();
  const canViewUsers = can(me, "users", "view");
  const canUpdateUsers = can(me, "users", "update");
  const canViewLocalities = can(me, "localities", "view");
  const canViewRoles = can(me, "roles", "view");
  const canEditRolePermissions = can(me, "roles", "permissions");
  const canViewMatrix = canViewRoles || canEditRolePermissions;
  const canAccessRbacPage = canViewUsers || canViewMatrix;

  const rolesQuery = useRoles();
  const permissionsCatalogQuery = usePermissionsCatalog();
  const usersQuery = useUsers(canViewUsers);
  const postosQuery = usePostos(canViewUsers);
  const localitiesQuery = useLocalities(canViewLocalities);
  const specialtiesQuery = useSpecialties(can(me, "specialties", "view"));
  const updateUser = useUpdateUser();
  const removeUserRole = useRemoveUserRole();
  const ldapLookup = useLookupLdapUser();
  const upsertLdapUser = useUpsertLdapUser();
  const setRolePermissions = useSetRolePermissions();

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editLocalityId, setEditLocalityId] = useState("");
  const [editSpecialtyId, setEditSpecialtyId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    userName: string;
    roleId: string;
    roleName: string;
  } | null>(null);

  const [ldapUid, setLdapUid] = useState("");
  const [ldapRoleIds, setLdapRoleIds] = useState<string[]>([]);
  const [ldapLocalityId, setLdapLocalityId] = useState("");
  const [ldapSpecialtyId, setLdapSpecialtyId] = useState("");
  const [ldapPreview, setLdapPreview] = useState<
    LdapLookupResponse["user"] | null
  >(null);
  const [nameFilter, setNameFilter] = useState("");
  const [cpfFilter, setCpfFilter] = useState("");
  const [roleFilterId, setRoleFilterId] = useState("");
  const [localityFilterId, setLocalityFilterId] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "matrix">("users");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixRoleIds, setMatrixRoleIds] = useState<string[]>([]);
  const [matrixModuleFilter, setMatrixModuleFilter] = useState("");
  const [matrixOnlyAssigned, setMatrixOnlyAssigned] = useState(false);
  const [matrixRemoveTarget, setMatrixRemoveTarget] = useState<{
    roleId: string;
    roleName: string;
    resource: string;
    action: string;
  } | null>(null);
  const [matrixAddTarget, setMatrixAddTarget] = useState<{
    resource: string;
    title: string;
    actions: string[];
  } | null>(null);
  const [matrixAddRoleId, setMatrixAddRoleId] = useState("");
  const [matrixAddActions, setMatrixAddActions] = useState<string[]>([]);

  const postoOrderByCode = useMemo(() => {
    const items = (postosQuery.data?.items ?? []) as Array<{
      code?: string;
      sortOrder?: number;
    }>;
    const map = new Map<string, number>();
    for (const p of items) {
      const code = String(p.code ?? "")
        .trim()
        .toUpperCase();
      if (code) map.set(code, Number(p.sortOrder ?? 0));
    }
    return map;
  }, [postosQuery.data?.items]);

  const users = useMemo(() => {
    const list = ((usersQuery.data?.items ?? []) as UserItem[])
      .filter((user) => String(user.ldapUid ?? "").trim().length > 0)
      .filter((user) => getUserRoles(user).length > 0);

    const UNKNOWN_POSTO_ORDER = 1_000_000;
    const postoRank = (name: string) => {
      const token = firstNameToken(name).toUpperCase();
      if (!token || postoOrderByCode.size === 0) return UNKNOWN_POSTO_ORDER;
      return postoOrderByCode.has(token)
        ? postoOrderByCode.get(token)!
        : UNKNOWN_POSTO_ORDER;
    };

    return [...list].sort((a, b) => {
      const ra = postoRank(a.name);
      const rb = postoRank(b.name);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [usersQuery.data?.items, postoOrderByCode]);
  const roles = useMemo(
    () =>
      ((rolesQuery.data?.items ?? []) as RoleItem[]).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    [rolesQuery.data?.items],
  );
  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );
  const localities = useMemo(
    () =>
      ((localitiesQuery.data?.items ?? []) as LocalityItem[]).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
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
        a.name.localeCompare(b.name, "pt-BR"),
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
  const editRoleNeedsLocality = selectedEditRoles.some((role) =>
    roleRequiresLocality(role.name),
  );
  const ldapRoleNeedsLocality = selectedLdapRoles.some((role) =>
    roleRequiresLocality(role.name),
  );
  const editHasCpcaRole = selectedEditRoles.some((role) =>
    roleIsCpca(role.name),
  );
  const ldapHasCpcaRole = selectedLdapRoles.some((role) =>
    roleIsCpca(role.name),
  );
  const editRoleNeedsSpecialty = selectedEditRoles.some((role) =>
    roleRequiresSpecialty(role.name),
  );
  const ldapRoleNeedsSpecialty = selectedLdapRoles.some((role) =>
    roleRequiresSpecialty(role.name),
  );
  const filteredUsers = useMemo(() => {
    const nameTerm = nameFilter.trim().toLowerCase();
    const cpfTerm = cpfFilter.trim().toLowerCase();

    return users.filter((user) => {
      const rolesByUser = getUserRoles(user);

      if (
        nameTerm &&
        !String(user.name ?? "")
          .toLowerCase()
          .includes(nameTerm)
      ) {
        return false;
      }

      if (
        cpfTerm &&
        !String(user.ldapUid ?? "")
          .toLowerCase()
          .includes(cpfTerm)
      ) {
        return false;
      }

      if (
        roleFilterId &&
        !rolesByUser.some((role) => role.id === roleFilterId)
      ) {
        return false;
      }

      if (localityFilterId) {
        if ((user.localityId ?? "") !== localityFilterId) {
          return false;
        }
      }

      return true;
    });
  }, [cpfFilter, localityFilterId, nameFilter, roleFilterId, users]);

  const permissionsCatalog = useMemo(
    () => (permissionsCatalogQuery.data?.items ?? []) as PermissionEntryItem[],
    [permissionsCatalogQuery.data?.items],
  );
  const catalogPermissionsByKey = useMemo(() => {
    const map = new Map<string, PermissionEntryItem>();
    for (const item of permissionsCatalog) {
      const key = `${item.resource}:${item.action}`;
      const current = map.get(key);
      if (!current) {
        map.set(key, item);
        continue;
      }

      if (permissionScopePriority(item.scope) < permissionScopePriority(current.scope)) {
        map.set(key, item);
      }
    }
    return map;
  }, [permissionsCatalog]);
  const catalogPermissionKeys = useMemo(() => {
    return new Set(catalogPermissionsByKey.keys());
  }, [catalogPermissionsByKey]);
  const rolePermissionKeysById = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const role of roles) {
      const keys = new Set<string>();
      for (const permission of role.permissions ?? []) {
        keys.add(`${permission.resource}:${permission.action}`);
      }
      map.set(role.id, keys);
    }
    return map;
  }, [roles]);
  const visibleMatrixRoles = useMemo(
    () =>
      matrixRoleIds.length > 0
        ? roles.filter((role) => matrixRoleIds.includes(role.id))
        : roles,
    [matrixRoleIds, roles],
  );

  const permissionMatrixBaseRows = useMemo<PermissionMatrixRow[]>(() => {
    const actionPriority = new Map<string, number>([
      ["view", 1],
      ["create", 2],
      ["update", 3],
      ["delete", 4],
    ]);
    const sortActions = (left: string, right: string) => {
      const leftPriority = actionPriority.get(left) ?? 999;
      const rightPriority = actionPriority.get(right) ?? 999;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return getPermissionActionLabel(left).localeCompare(
        getPermissionActionLabel(right),
        "pt-BR",
      );
    };

    const actionsByResource = new Map<string, Set<string>>();
    for (const permission of permissionsCatalog) {
      if (!actionsByResource.has(permission.resource)) {
        actionsByResource.set(permission.resource, new Set<string>());
      }
      actionsByResource.get(permission.resource)?.add(permission.action);
    }
    for (const role of roles) {
      for (const permission of role.permissions ?? []) {
        if (!actionsByResource.has(permission.resource)) {
          actionsByResource.set(permission.resource, new Set<string>());
        }
        actionsByResource.get(permission.resource)?.add(permission.action);
      }
    }
    for (const resource of KNOWN_PERMISSION_RESOURCES) {
      if (!actionsByResource.has(resource)) {
        actionsByResource.set(resource, new Set<string>());
      }
    }

    const hasRolePermission = (role: RoleItem, resource: string, action: string) => {
      const key = `${resource}:${action}`;
      const explicit = rolePermissionKeysById.get(role.id)?.has(key) ?? false;
      const tiGlobalPermission =
        isTiRoleName(role.name) &&
        !isTiBlockedPermission(resource, action) &&
        catalogPermissionKeys.has(key);
      return explicit || tiGlobalPermission;
    };
    const buildRoleBadges = (resource: string, action: string) =>
      visibleMatrixRoles
        .filter((role) => hasRolePermission(role, resource, action))
        .map((role) => {
          const key = `${resource}:${action}`;
          const explicit = rolePermissionKeysById.get(role.id)?.has(key) ?? false;
          return {
            roleId: role.id,
            roleName: role.name,
            explicit,
            fixed: isTiRoleName(role.name),
          };
        });

    const rows: PermissionMatrixRow[] = [];
    for (const [resource, actionSet] of actionsByResource.entries()) {
      const crudRoles = {
        view: [] as MatrixRoleBadge[],
        create: [] as MatrixRoleBadge[],
        update: [] as MatrixRoleBadge[],
        delete: [] as MatrixRoleBadge[],
      };

      for (const action of CRUD_ACTIONS) {
        crudRoles[action] = buildRoleBadges(resource, action);
      }

      const availableActions = Array.from(actionSet).sort(sortActions);
      const extraActions = availableActions
        .filter((action) => !CRUD_ACTIONS.includes(action as CrudAction))
        .map((action) => ({
          action,
          roles: buildRoleBadges(resource, action),
        }));

      rows.push({
        resource,
        meta: getPermissionResourceMeta(resource),
        crudRoles,
        availableActions,
        extraActions,
      });
    }

    return rows.sort((a, b) => a.meta.title.localeCompare(b.meta.title, "pt-BR"));
  }, [
    catalogPermissionKeys,
    permissionsCatalog,
    rolePermissionKeysById,
    roles,
    visibleMatrixRoles,
  ]);
  const matrixModuleOptions = useMemo(
    () =>
      Array.from(
        new Set(permissionMatrixBaseRows.map((row) => row.meta.title)),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [permissionMatrixBaseRows],
  );
  const permissionMatrixRows = useMemo(() => {
    const term = matrixSearch.trim().toLowerCase();

    return permissionMatrixBaseRows.filter((row) => {
      if (matrixModuleFilter && row.meta.title !== matrixModuleFilter) {
        return false;
      }

      const hasAnyRoleInCrud = CRUD_ACTIONS.some(
        (action) => row.crudRoles[action].length > 0,
      );
      const hasAnyRoleInExtra = row.extraActions.some(
        (action) => action.roles.length > 0,
      );
      const hasAnyAssignedRole = hasAnyRoleInCrud || hasAnyRoleInExtra;
      if (matrixOnlyAssigned && !hasAnyAssignedRole) {
        return false;
      }

      if (!term) return true;
      const searchBlob = [
        row.meta.title,
        row.meta.description,
        row.resource,
        row.meta.route ?? "",
        ...(row.meta.routeAliases ?? []),
        ...(row.meta.sidebarItems ?? []),
        ...row.availableActions.map((action) => getPermissionActionLabel(action)),
        ...CRUD_ACTIONS.flatMap((action) =>
          row.crudRoles[action].map((role) => role.roleName),
        ),
        ...row.extraActions.flatMap((action) => [
          action.action,
          ...action.roles.map((role) => role.roleName),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return searchBlob.includes(term);
    });
  }, [
    matrixModuleFilter,
    matrixOnlyAssigned,
    matrixSearch,
    permissionMatrixBaseRows,
  ]);

  const openEditModal = (user: UserItem) => {
    const rolesByUser = getUserRoles(user);
    setEditingUser(user);
    setEditRoleIds(rolesByUser.map((role) => role.id));
    setEditLocalityId(user.localityId ?? "");
    setEditSpecialtyId(user.specialtyId ?? "");
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (editRoleIds.length === 0) {
      toast.push({
        message: "Selecione ao menos um papel para salvar.",
        severity: "warning",
      });
      return;
    }
    if (editRoleNeedsLocality && !editLocalityId) {
      toast.push({
        message: editHasCpcaRole
          ? "Ao atribuir CPCA, selecione a OM obrigatória."
          : "Este papel exige localidade obrigatória.",
        severity: "warning",
      });
      return;
    }
    if (editRoleNeedsSpecialty && !editSpecialtyId) {
      toast.push({
        message: "Este papel exige especialidade obrigatória.",
        severity: "warning",
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
      toast.push({
        message: "Usuário atualizado com sucesso.",
        severity: "success",
      });
      setEditingUser(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao atualizar usuário",
        severity: "error",
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
      toast.push({
        message: "Permissão removida com sucesso.",
        severity: "success",
      });
      setRemoveTarget(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao remover permissão",
        severity: "error",
      });
    }
  };

  const handleLookupLdap = async () => {
    const uid = ldapUid.trim();
    if (!uid) {
      toast.push({
        message: "Informe o CPF/UID FAB ou e-mail.",
        severity: "warning",
      });
      return;
    }
    try {
      const result = (await ldapLookup.mutateAsync(uid)) as LdapLookupResponse;
      if (!result.user) {
        setLdapPreview(null);
        toast.push({
          message: "Usuário não encontrado no LDAP.",
          severity: "warning",
        });
        return;
      }
      setLdapPreview(result.user);
      toast.push({ message: "Usuário LDAP encontrado.", severity: "success" });
    } catch (error) {
      setLdapPreview(null);
      toast.push({
        message: parseApiError(error).message ?? "Erro ao consultar LDAP",
        severity: "error",
      });
    }
  };

  const handleCreateFromLdap = async () => {
    if (!ldapPreview) {
      toast.push({
        message: "Busque o usuário no LDAP antes de salvar.",
        severity: "warning",
      });
      return;
    }
    if (ldapRoleIds.length === 0) {
      toast.push({
        message: "Selecione ao menos um papel do usuário.",
        severity: "warning",
      });
      return;
    }
    if (ldapRoleNeedsLocality && !ldapLocalityId) {
      toast.push({
        message: ldapHasCpcaRole
          ? "Ao atribuir CPCA, selecione a OM obrigatória."
          : "Este papel exige localidade obrigatória.",
        severity: "warning",
      });
      return;
    }
    if (ldapRoleNeedsSpecialty && !ldapSpecialtyId) {
      toast.push({
        message: "Este papel exige especialidade obrigatória.",
        severity: "warning",
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
      toast.push({
        message: "Usuário LDAP vinculado com sucesso.",
        severity: "success",
      });
      setLdapUid("");
      setLdapRoleIds([]);
      setLdapLocalityId("");
      setLdapSpecialtyId("");
      setLdapPreview(null);
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao vincular usuário LDAP",
        severity: "error",
      });
    }
  };

  const handleConfirmRemoveMatrixPermission = async () => {
    if (!matrixRemoveTarget) return;
    const role = roleById.get(matrixRemoveTarget.roleId);
    if (!role) {
      setMatrixRemoveTarget(null);
      toast.push({
        message: "Papel não encontrado para remoção.",
        severity: "error",
      });
      return;
    }
    if (isTiRoleName(role.name)) {
      setMatrixRemoveTarget(null);
      toast.push({
        message:
          "O papel TI possui acesso global fixo (exceto apagar logs) e não pode ser editado por remoção.",
        severity: "warning",
      });
      return;
    }

    const key = `${matrixRemoveTarget.resource}:${matrixRemoveTarget.action}`;
    const nextPermissions = (role.permissions ?? [])
      .filter((permission) => `${permission.resource}:${permission.action}` !== key)
      .sort((left, right) =>
        `${left.resource}:${left.action}`.localeCompare(
          `${right.resource}:${right.action}`,
          "pt-BR",
        ),
      );

    try {
      await setRolePermissions.mutateAsync({
        roleId: role.id,
        permissions: nextPermissions,
      });
      toast.push({
        message: `Permissão removida: ${role.name} - ${getPermissionActionLabel(matrixRemoveTarget.action)} em ${matrixRemoveTarget.resource}.`,
        severity: "success",
      });
      setMatrixRemoveTarget(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao remover permissão",
        severity: "error",
      });
    }
  };

  const handleOpenMatrixAddModal = (row: PermissionMatrixRow) => {
    setMatrixAddTarget({
      resource: row.resource,
      title: row.meta.title,
      actions: row.availableActions,
    });
    setMatrixAddRoleId("");
    setMatrixAddActions([]);
  };

  const handleConfirmMatrixAddPermissions = async () => {
    if (!matrixAddTarget) return;
    if (!matrixAddRoleId || matrixAddActions.length === 0) {
      toast.push({
        message: "Selecione um papel e ao menos uma funcionalidade.",
        severity: "warning",
      });
      return;
    }

    const role = roleById.get(matrixAddRoleId);
    if (!role) {
      toast.push({
        message: "Papel selecionado não encontrado.",
        severity: "error",
      });
      return;
    }
    if (isTiRoleName(role.name)) {
      toast.push({
        message:
          "O papel TI já possui acesso global fixo (exceto apagar logs). Selecione outro papel.",
        severity: "warning",
      });
      return;
    }

    const nextByKey = new Map<string, PermissionEntryItem>();
    for (const permission of role.permissions ?? []) {
      nextByKey.set(`${permission.resource}:${permission.action}`, permission);
    }

    const missingActions: string[] = [];
    for (const action of matrixAddActions) {
      const key = `${matrixAddTarget.resource}:${action}`;
      const fromCatalog = catalogPermissionsByKey.get(key);
      if (!fromCatalog) {
        missingActions.push(action);
        continue;
      }
      nextByKey.set(key, fromCatalog);
    }

    const nextPermissions = Array.from(nextByKey.values()).sort((left, right) =>
      `${left.resource}:${left.action}`.localeCompare(
        `${right.resource}:${right.action}`,
        "pt-BR",
      ),
    );

    try {
      await setRolePermissions.mutateAsync({
        roleId: role.id,
        permissions: nextPermissions,
      });
      const addedCount = matrixAddActions.length - missingActions.length;
      toast.push({
        message:
          addedCount > 0
            ? `Papel ${role.name} adicionado em ${addedCount} funcionalidade(s) do módulo ${matrixAddTarget.title}.`
            : "Nenhuma funcionalidade foi adicionada (não encontrada no catálogo).",
        severity: addedCount > 0 ? "success" : "warning",
      });
      setMatrixAddTarget(null);
      setMatrixAddRoleId("");
      setMatrixAddActions([]);
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ?? "Erro ao incluir papel no módulo",
        severity: "error",
      });
    }
  };

  const requestRemoveFromBadge = (
    badge: MatrixRoleBadge,
    resource: string,
    action: string,
  ) => {
    if (!canEditRolePermissions) return;
    if (badge.fixed) {
      toast.push({
        message:
          "O papel TI possui acesso global fixo (exceto apagar logs) e não pode ser removido por badge.",
        severity: "warning",
      });
      return;
    }
    if (!badge.explicit) {
      toast.push({
        message:
          "Somente permissões explícitas podem ser removidas por badge.",
        severity: "warning",
      });
      return;
    }
    setMatrixRemoveTarget({
      roleId: badge.roleId,
      roleName: badge.roleName,
      resource,
      action,
    });
  };

  const renderRoleChips = (
    roleBadges: MatrixRoleBadge[],
    resource: string,
    action: string,
  ) => {
    if (roleBadges.length === 0) {
      return (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      );
    }
    return (
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {roleBadges.map((badge) => {
          const canRemoveBadge =
            canEditRolePermissions &&
            !badge.fixed &&
            badge.explicit &&
            !setRolePermissions.isPending;
          const chipColor = badge.fixed
            ? "secondary"
            : badge.explicit
              ? "primary"
              : "default";
          const chipVariant =
            badge.fixed || badge.explicit ? "filled" : "outlined";
          return (
            <Chip
              key={`${resource}:${action}:${badge.roleId}`}
              size="small"
              label={badge.roleName}
              color={chipColor}
              variant={chipVariant}
              onDelete={
                canRemoveBadge
                  ? () => requestRemoveFromBadge(badge, resource, action)
                  : undefined
              }
              deleteIcon={
                canRemoveBadge ? <CloseRoundedIcon fontSize="small" /> : undefined
              }
            />
          );
        })}
      </Stack>
    );
  };

  if (!canAccessRbacPage) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Usuários e Permissões
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  const selectedTab: "users" | "matrix" =
    activeTab === "users" && !canViewUsers
      ? "matrix"
      : activeTab === "matrix" && !canViewMatrix
        ? "users"
        : activeTab;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Usuários e Permissões
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gerencie usuários LDAP e permissões por módulo de forma centralizada.
      </Typography>

      <Tabs
        value={selectedTab}
        onChange={(_event, value: "users" | "matrix") => setActiveTab(value)}
        sx={{ mb: 2 }}
      >
        {canViewUsers && <Tab value="users" label="Usuários LDAP" />}
        {canViewMatrix && <Tab value="matrix" label="Matriz de permissões" />}
      </Tabs>

      {selectedTab === "users" && canViewUsers && (
        <Stack spacing={2.2}>
          {canUpdateUsers && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Adicionar usuário FAB (LDAP)
                </Typography>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.2}
                  sx={{ mb: 1.4 }}
                >
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
                    {ldapLookup.isPending ? "Buscando..." : "Buscar no LDAP"}
                  </Button>
                </Stack>

                {ldapPreview && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {ldapPreview.name || "Sem nome no LDAP"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      CPF/UID: {ldapPreview.uid}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Email: {ldapPreview.email || "Não informado"}
                    </Typography>
                  </Box>
                )}

                <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                  <TextField
                    select
                    SelectProps={{
                      multiple: true,
                      renderValue: (selected) =>
                        (selected as string[])
                          .map(
                            (id) =>
                              roles.find((role) => role.id === id)?.name ?? id,
                          )
                          .join(", "),
                    }}
                    size="small"
                    label="Papéis"
                    value={ldapRoleIds}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLdapRoleIds(
                        Array.isArray(next)
                          ? next.map((value) => String(value))
                          : [],
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
                  {ldapRoleNeedsLocality && (
                    <Autocomplete
                      size="small"
                      options={localities}
                      value={
                        localities.find(
                          (locality) => locality.id === ldapLocalityId,
                        ) ?? null
                      }
                      onChange={(_event, value) =>
                        setLdapLocalityId(value?.id ?? "")
                      }
                      getOptionLabel={(option) =>
                        `${option.name} (${option.code})`
                      }
                      isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                      }
                      sx={{ minWidth: 260 }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={
                            ldapHasCpcaRole
                              ? "OM (obrigatória para CPCA)"
                              : "OM / Localidade"
                          }
                          error={ldapRoleNeedsLocality && !ldapLocalityId}
                          helperText={
                            ldapRoleNeedsLocality && !ldapLocalityId
                              ? ldapHasCpcaRole
                                ? "CPCA sempre deve estar vinculado a uma OM."
                                : "Obrigatória para este papel."
                              : "Digite para filtrar OMs."
                          }
                        />
                      )}
                    />
                  )}
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
                        ? "Obrigatória para este papel."
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
                      color: "#fff",
                      fontWeight: 700,
                      "&.Mui-disabled": {
                        color: "rgba(255,255,255,0.85)",
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
                    {upsertLdapUser.isPending
                      ? "Salvando..."
                      : "Vincular usuário"}
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
                direction={{ xs: "column", md: "row" }}
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
                    setNameFilter("");
                    setCpfFilter("");
                    setRoleFilterId("");
                    setLocalityFilterId("");
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
                  {parseApiError(usersQuery.error).message ??
                    "Erro ao carregar usuários"}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Usuário</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CPF/Email</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Papel</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>OM</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        Especialidade
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 110 }}>
                        Ações
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography variant="body2" color="text.secondary">
                            Nenhum usuário encontrado com os filtros
                            selecionados.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredUsers.map((user) => {
                      const rolesByUser = getUserRoles(user);
                      const localityName = user.localityId
                        ? (localityById.get(user.localityId)?.name ??
                          user.localityId)
                        : "Sem localidade";
                      const localityCode = user.localityId
                        ? (localityById.get(user.localityId)?.code ?? "")
                        : "";
                      const ldapOm = String(user.ldapOm ?? "").trim();
                      const specialtyName = user.specialtyId
                        ? (specialtyById.get(user.specialtyId)?.name ??
                          user.specialtyId)
                        : "Sem especialidade";

                      return (
                        <TableRow key={user.id} hover>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={1.25}
                              alignItems="center"
                            >
                              <RbacUserPhotoAvatar
                                numeroOrdem={user.numeroOrdem}
                                displayName={user.name}
                              />
                              <Typography variant="body2" fontWeight={700}>
                                {user.name}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{user.ldapUid || user.email}</TableCell>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={0.6}
                              useFlexGap
                              flexWrap="wrap"
                            >
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
                          <TableCell>
                            {ldapOm ? (
                              ldapOm
                            ) : user.localityId ? (
                              <>
                                {localityName}
                                {localityCode && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                  >
                                    {localityCode}
                                  </Typography>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
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
      )}

      {selectedTab === "matrix" && canViewMatrix && (
        <Stack spacing={2.2}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={1}
                sx={{ mb: 1.5 }}
              >
                <Box>
                  <Typography variant="h6">Matriz de permissões por módulo</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Visualize e ajuste permissões por módulo, funcionalidade e
                    papel.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    color="primary"
                    label={`${permissionMatrixRows.length} módulos`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${visibleMatrixRoles.length} papéis visíveis`}
                  />
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <TextField
                  size="small"
                  label="Buscar módulo/funcionalidade/papel"
                  value={matrixSearch}
                  onChange={(event) => setMatrixSearch(event.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <TextField
                  select
                  size="small"
                  label="Filtrar por módulo"
                  value={matrixModuleFilter}
                  onChange={(event) => setMatrixModuleFilter(event.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {matrixModuleOptions.map((moduleName) => (
                    <MenuItem key={moduleName} value={moduleName}>
                      {moduleName}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Papéis em foco"
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) =>
                      (selected as string[])
                        .map(
                          (id) =>
                            roles.find((role) => role.id === id)?.name ?? id,
                        )
                        .join(", "),
                  }}
                  value={matrixRoleIds}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMatrixRoleIds(
                      Array.isArray(next)
                        ? next.map((item) => String(item))
                        : [],
                    );
                  }}
                  sx={{ minWidth: 280 }}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Switch
                      checked={matrixOnlyAssigned}
                      onChange={(_event, checked) =>
                        setMatrixOnlyAssigned(checked)
                      }
                    />
                  }
                  label="Somente módulos com papéis atribuídos"
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 0 }}>
              {rolesQuery.isLoading || permissionsCatalogQuery.isLoading ? (
                <Box p={2}>
                  <Typography variant="body2" color="text.secondary">
                    Carregando matriz de permissões...
                  </Typography>
                </Box>
              ) : rolesQuery.isError ? (
                <Box p={2}>
                  <Typography variant="body2" color="error.main">
                    {parseApiError(rolesQuery.error).message ??
                      "Erro ao carregar papéis"}
                  </Typography>
                </Box>
              ) : permissionsCatalogQuery.isError ? (
                <Box p={2}>
                  <Typography variant="body2" color="error.main">
                    {parseApiError(permissionsCatalogQuery.error).message ??
                      "Erro ao carregar catálogo de permissões"}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ width: "100%" }}>
                  <Table
                    size="small"
                    sx={{
                      tableLayout: "fixed",
                      width: "100%",
                      "& th, & td": { py: 0.9, px: 1 },
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: "22%" }}>
                          Módulo
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, width: "26%" }}>
                          Funcionalidades
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, width: "13%" }}>
                          Ver
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, width: "13%" }}>
                          Criar
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, width: "13%" }}>
                          Editar
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, width: "13%" }}>
                          Excluir
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {permissionMatrixRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography variant="body2" color="text.secondary">
                              Nenhum módulo encontrado com os filtros atuais.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {permissionMatrixRows.map((row) => (
                        <TableRow key={row.resource} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {row.meta.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {row.resource}
                            </Typography>
                            {row.meta.route && (
                              <Typography
                                variant="caption"
                                color="primary.main"
                                display="block"
                              >
                                {row.meta.route}
                              </Typography>
                            )}
                            {Array.isArray(row.meta.routeAliases) &&
                              row.meta.routeAliases.length > 0 && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                >
                                  {row.meta.routeAliases.join(" • ")}
                                </Typography>
                              )}
                            {canEditRolePermissions && (
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{ mt: 0.6 }}
                                disabled={
                                  setRolePermissions.isPending ||
                                  row.availableActions.length === 0
                                }
                                onClick={() => handleOpenMatrixAddModal(row)}
                              >
                                Incluir papel
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mb: 0.6 }}
                            >
                              {row.meta.description}
                            </Typography>
                            {Array.isArray(row.meta.sidebarItems) &&
                              row.meta.sidebarItems.length > 0 && (
                                <Stack
                                  direction="row"
                                  spacing={0.4}
                                  useFlexGap
                                  flexWrap="wrap"
                                  sx={{ mb: 0.6 }}
                                >
                                  {row.meta.sidebarItems.map((sidebarItem) => (
                                    <Chip
                                      key={`${row.resource}:${sidebarItem}`}
                                      size="small"
                                      variant="outlined"
                                      label={sidebarItem}
                                    />
                                  ))}
                                </Stack>
                              )}
                            <Stack
                              direction="row"
                              spacing={0.5}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              {row.availableActions.length === 0 ? (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Sem funcionalidades no catálogo.
                                </Typography>
                              ) : (
                                row.availableActions.map((action) => (
                                  <Chip
                                    key={`${row.resource}:${action}`}
                                    size="small"
                                    label={getPermissionActionLabel(action)}
                                    variant="outlined"
                                  />
                                ))
                              )}
                            </Stack>
                            {row.extraActions.length > 0 && (
                              <Stack spacing={0.6} sx={{ mt: 0.9 }}>
                                {row.extraActions.map((extraAction) => (
                                  <Box
                                    key={`${row.resource}:${extraAction.action}`}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: "block",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {getPermissionActionLabel(
                                        extraAction.action,
                                      )}
                                    </Typography>
                                    {renderRoleChips(
                                      extraAction.roles,
                                      row.resource,
                                      extraAction.action,
                                    )}
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderRoleChips(row.crudRoles.view, row.resource, "view")}
                          </TableCell>
                          <TableCell>
                            {renderRoleChips(
                              row.crudRoles.create,
                              row.resource,
                              "create",
                            )}
                          </TableCell>
                          <TableCell>
                            {renderRoleChips(
                              row.crudRoles.update,
                              row.resource,
                              "update",
                            )}
                          </TableCell>
                          <TableCell>
                            {renderRoleChips(
                              row.crudRoles.delete,
                              row.resource,
                              "delete",
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

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
              value={editingUser?.name ?? ""}
              disabled
            />
            <TextField
              select
              SelectProps={{
                multiple: true,
                renderValue: (selected) =>
                  (selected as string[])
                    .map(
                      (id) => roles.find((role) => role.id === id)?.name ?? id,
                    )
                    .join(", "),
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
            {editRoleNeedsLocality && (
              <Autocomplete
                size="small"
                options={localities}
                value={
                  localities.find(
                    (locality) => locality.id === editLocalityId,
                  ) ?? null
                }
                onChange={(_event, value) => setEditLocalityId(value?.id ?? "")}
                getOptionLabel={(option) => `${option.name} (${option.code})`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={
                      editHasCpcaRole
                        ? "OM (obrigatória para CPCA)"
                        : "OM / Localidade"
                    }
                    error={editRoleNeedsLocality && !editLocalityId}
                    helperText={
                      editRoleNeedsLocality && !editLocalityId
                        ? editHasCpcaRole
                          ? "CPCA sempre deve estar vinculado a uma OM."
                          : "Localidade obrigatória para este papel."
                        : "Digite para filtrar OMs."
                    }
                  />
                )}
              />
            )}
            <TextField
              select
              size="small"
              label="Especialidade"
              value={editSpecialtyId}
              onChange={(event) => setEditSpecialtyId(event.target.value)}
              error={editRoleNeedsSpecialty && !editSpecialtyId}
              helperText={
                editRoleNeedsSpecialty && !editSpecialtyId
                  ? "Especialidade obrigatória para este papel."
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
          <Button
            color="error"
            variant="outlined"
            onClick={() => setEditingUser(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
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
            {updateUser.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(matrixAddTarget)}
        onClose={() => {
          setMatrixAddTarget(null);
          setMatrixAddRoleId("");
          setMatrixAddActions([]);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Incluir papel em funcionalidades</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.8 }}>
            Selecione o papel e uma ou mais funcionalidades para incluir no
            módulo.
          </DialogContentText>
          <Stack spacing={1.4}>
            <TextField
              size="small"
              label="Módulo"
              value={matrixAddTarget?.title ?? ""}
              disabled
            />
            <TextField
              select
              size="small"
              label="Papel"
              value={matrixAddRoleId}
              onChange={(event) => setMatrixAddRoleId(event.target.value)}
            >
              <MenuItem value="">Selecione...</MenuItem>
              {roles.map((role) => (
                <MenuItem
                  key={role.id}
                  value={role.id}
                  disabled={isTiRoleName(role.name)}
                >
                  {isTiRoleName(role.name)
                    ? `${role.name} (acesso global fixo)`
                    : role.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Funcionalidades"
              SelectProps={{
                multiple: true,
                renderValue: (selected) =>
                  (selected as string[])
                    .map((action) => getPermissionActionLabel(action))
                    .join(", "),
              }}
              value={matrixAddActions}
              onChange={(event) => {
                const next = event.target.value;
                setMatrixAddActions(
                  Array.isArray(next) ? next.map((item) => String(item)) : [],
                );
              }}
            >
              {(matrixAddTarget?.actions ?? []).map((action) => (
                <MenuItem key={action} value={action}>
                  {getPermissionActionLabel(action)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setMatrixAddTarget(null);
              setMatrixAddRoleId("");
              setMatrixAddActions([]);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleConfirmMatrixAddPermissions();
            }}
            disabled={
              setRolePermissions.isPending ||
              !matrixAddRoleId ||
              matrixAddActions.length === 0
            }
          >
            {setRolePermissions.isPending ? "Salvando..." : "Incluir papel"}
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
        highlightText={
          removeTarget
            ? `${removeTarget.roleName} -> ${removeTarget.userName}`
            : ""
        }
        note="A remoção entra em vigor imediatamente."
        confirmLabel={removeUserRole.isPending ? "Removendo..." : "Remover"}
        severity="error"
        confirmLoading={removeUserRole.isPending}
      />

      <ConfirmDialog
        open={Boolean(matrixRemoveTarget)}
        onCancel={() => setMatrixRemoveTarget(null)}
        onConfirm={() => {
          void handleConfirmRemoveMatrixPermission();
        }}
        title="Remover papel da funcionalidade"
        message="Confirma remover este papel da funcionalidade selecionada?"
        highlightText={
          matrixRemoveTarget
            ? `${matrixRemoveTarget.roleName} -> ${matrixRemoveTarget.resource}:${getPermissionActionLabel(matrixRemoveTarget.action)}`
            : ""
        }
        note="A remoção será aplicada imediatamente no papel."
        confirmLabel={setRolePermissions.isPending ? "Removendo..." : "Remover"}
        severity="error"
        confirmLoading={setRolePermissions.isPending}
      />
    </Box>
  );
}
