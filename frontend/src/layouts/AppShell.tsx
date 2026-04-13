import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AppBar,
  Avatar,
  Button,
  Box,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import DashboardIcon from "@mui/icons-material/Dashboard";
import TaskIcon from "@mui/icons-material/Task";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupsIcon from "@mui/icons-material/Groups";
import PeopleIcon from "@mui/icons-material/People";
import BusinessIcon from "@mui/icons-material/Business";
import CampaignIcon from "@mui/icons-material/Campaign";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import EventNoteIcon from "@mui/icons-material/EventNote";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import NewspaperRoundedIcon from "@mui/icons-material/NewspaperRounded";
import LogoutIcon from "@mui/icons-material/Logout";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import StackedBarChartRoundedIcon from "@mui/icons-material/StackedBarChartRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GradingRoundedIcon from "@mui/icons-material/GradingRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useDebounce } from "../app/useDebounce";
import { can, canAccessAdminCatalog } from "../app/rbac";
import {
  canonicalRoleName,
  hasAnyRole,
  normalizeRoleName,
  ROLE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from "../app/roleAccess";
import {
  useLocalities,
  useMarkMenuUpdateSeen,
  useMe,
  useMenuUpdates,
  useMyFabProfile,
  useSearch,
  useSigpesPhoto,
} from "../api/hooks";
import {
  ACTIVE_ROLE_STORAGE_KEY,
  GLOBAL_LOCALITY_STORAGE_KEY,
} from "../api/client";
import { selectTargetLocalities } from "../constants/localities";
import {
  MEETING_STATUS_LABELS,
  NOTICE_PRIORITY_LABELS,
} from "../constants/enums";

const drawerExpandedWidth = 284;
const drawerCollapsedWidth = 92;
const headerHeight = 76;
const GLOBAL_LOCALITY_QUERY_PARAM = "globalLocalityId";

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
  menuKey?: string;
};
type NavSection = { id: string; label?: string; items: NavItem[] };

function toPathOnly(value: string) {
  const [path] = String(value ?? "").split("?");
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function pathMatches(currentPath: string, itemPath: string) {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

const navSections: NavSection[] = [
  {
    id: "command",
    label: "COMANDO",
    items: [
      {
        label: "Painel Estratégico",
        to: "/dashboard/estrategico",
        icon: <ShieldRoundedIcon fontSize="small" />,
      },
      {
        label: "Inteligência Artificial",
        to: "/ai",
        icon: <AutoAwesomeRoundedIcon fontSize="small" />,
      },
      {
        label: "SMIF",
        to: "/dashboard/smif",
        icon: <DashboardIcon fontSize="small" />,
      },
      {
        label: "CIPAVD",
        to: "/dashboard/cipavd",
        icon: <InsightsRoundedIcon fontSize="small" />,
      },
      {
        label: "Impacto Positivo",
        to: "/social-communication",
        icon: <NewspaperRoundedIcon fontSize="small" />,
        menuKey: "social_communication",
      },
      {
        label: "Biblioteca",
        to: "/library",
        icon: <PhotoLibraryRoundedIcon fontSize="small" />,
        menuKey: "library",
      },
      {
        label: "CPCA",
        to: "/dashboard/cpca",
        icon: <PolicyRoundedIcon fontSize="small" />,
        menuKey: "cpca_cases",
      },
    ],
  },
  {
    id: "smif",
    label: "SMIF",
    items: [
      {
        label: "Atividades de Campo",
        to: "/activities",
        icon: <EventNoteIcon fontSize="small" />,
        menuKey: "activities_smif",
      },
      {
        label: "Denúncias",
        to: "/smif-complaints",
        icon: <PolicyRoundedIcon fontSize="small" />,
        menuKey: "smif_complaints",
      },
      {
        label: "GSD e Recrutas",
        to: "/gsd-recruits",
        icon: <PeopleIcon fontSize="small" />,
        menuKey: "gsd_recruits",
      },
      {
        label: "Elos",
        to: "/elos",
        icon: <ContactPhoneIcon fontSize="small" />,
        menuKey: "elos",
      },
      {
        label: "Boas Práticas",
        to: "/best-practices",
        icon: <LightbulbRoundedIcon fontSize="small" />,
        menuKey: "best_practices",
      },
    ],
  },
  {
    id: "cipavd",
    label: "CIPAVD",
    items: [
      {
        label: "Tarefas",
        to: "/tasks",
        icon: <TaskIcon fontSize="small" />,
        menuKey: "tasks",
      },
      {
        label: "Reuniões",
        to: "/meetings",
        icon: <GroupsIcon fontSize="small" />,
        menuKey: "meetings",
      },
      {
        label: "Organograma",
        to: "/org-chart",
        icon: <AccountTreeIcon fontSize="small" />,
        menuKey: "org_chart",
      },
      {
        label: "Cronograma",
        to: "/gantt",
        icon: <TaskIcon fontSize="small" />,
        menuKey: "tasks",
      },
      {
        label: "Calendário",
        to: "/calendar",
        icon: <EventNoteIcon fontSize="small" />,
        menuKey: "tasks",
      },
      {
        label: "Missões",
        to: "/missions",
        icon: <FlagRoundedIcon fontSize="small" />,
        menuKey: "missions",
      },
      {
        label: "Atividades de Campo",
        to: "/activities-cipavd",
        icon: <EventNoteIcon fontSize="small" />,
        menuKey: "activities_cipavd",
      },
      {
        label: "Avisos",
        to: "/notices",
        icon: <CampaignIcon fontSize="small" />,
        menuKey: "notices",
      },
    ],
  },
  {
    id: "pesquisas",
    label: "PESQUISAS",
    items: [
      {
        label: "Escolas",
        to: "/dashboard/bi",
        icon: <BarChartRoundedIcon fontSize="small" />,
        menuKey: "bi",
      },
      {
        label: "Violência Doméstica",
        to: "/dashboard/bi-violencia-domestica",
        icon: <StackedBarChartRoundedIcon fontSize="small" />,
        menuKey: "bi",
      },
      {
        label: "Recrutas",
        to: "/dashboard/bi-recrutas",
        icon: <GroupAddRoundedIcon fontSize="small" />,
        menuKey: "bi",
      },
      {
        label: "Ciclo de Boas Práticas",
        to: "/dashboard/bi-ciclo-boas-praticas",
        icon: <AutorenewRoundedIcon fontSize="small" />,
        menuKey: "bi",
      },
      {
        label: "Encontro CPCA",
        to: "/dashboard/bi-encontro-cpca",
        icon: <ForumRoundedIcon fontSize="small" />,
        menuKey: "bi",
      },
      {
        label: "Avaliação GSD",
        to: "/dashboard/bi-avaliacao-gsd",
        icon: <GradingRoundedIcon fontSize="small" />,
        menuKey: "bi",
      },
    ],
  },
  {
    id: "cpca",
    label: "CPCA",
    items: [
      {
        label: "Denúncias",
        to: "/cpca-cases",
        icon: <PolicyRoundedIcon fontSize="small" />,
        menuKey: "cpca_cases",
      },
    ],
  },
  {
    id: "ti",
    label: "TI",
    items: [
      {
        label: "Usuários e Permissões",
        to: "/admin/rbac",
        icon: <PeopleIcon fontSize="small" />,
        menuKey: "admin_rbac",
      },
      {
        label: "Logs",
        to: "/audit",
        icon: <InsightsRoundedIcon fontSize="small" />,
      },
      {
        label: "Administração",
        to: "/admin",
        icon: <SettingsIcon fontSize="small" />,
        menuKey: "admin_catalog",
      },
      {
        label: "OMs",
        to: "/admin/oms",
        icon: <BusinessIcon fontSize="small" />,
        menuKey: "admin_oms",
      },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const debounced = useDebounce(globalQuery, 300);
  const searchQuery = useSearch(debounced);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { data: me } = useMe();
  const fabProfileQuery = useMyFabProfile();
  const numeroOrdem = String(fabProfileQuery.data?.numeroOrdem ?? "").trim();
  const sigpesPhotoQuery = useSigpesPhoto(numeroOrdem);
  const userPhotoDataUrl = String(sigpesPhotoQuery.data?.dataUrl ?? "").trim();
  const localitiesQuery = useLocalities();
  const roleOptions = useMemo(() => {
    const optionsByKey = new Map<
      string,
      { id: string; name: string; roleId: string | null }
    >();

    for (const raw of (me?.roles ?? []) as Array<any>) {
      const source = raw?.role ?? raw;
      const roleId = String(source?.id ?? "").trim();
      const roleName = canonicalRoleName(source?.name ?? raw?.name ?? "");
      if (!roleName) continue;
      const key = roleId || `name:${normalizeRoleName(roleName)}`;
      if (!optionsByKey.has(key)) {
        optionsByKey.set(key, {
          id: key,
          name: roleName,
          roleId: roleId || null,
        });
      }
    }

    const activeRoleName = canonicalRoleName(me?.activeRole?.name ?? "");
    const activeRoleId = String(
      me?.activeRole?.id ?? me?.activeRoleId ?? "",
    ).trim();
    if (activeRoleName) {
      const key = activeRoleId || `name:${normalizeRoleName(activeRoleName)}`;
      if (!optionsByKey.has(key)) {
        optionsByKey.set(key, {
          id: key,
          name: activeRoleName,
          roleId: activeRoleId || null,
        });
      }
    }

    return Array.from(optionsByKey.values());
  }, [me?.activeRole?.id, me?.activeRole?.name, me?.activeRoleId, me?.roles]);
  const currentRoleLabel = canonicalRoleName(
    me?.activeRole?.name ?? me?.roles?.[0]?.name ?? "Sem papel",
  );
  const activeRoleId =
    String(me?.activeRole?.id ?? me?.activeRoleId ?? "").trim() ||
    roleOptions[0]?.id ||
    "";
  const selectedRoleOption =
    roleOptions.find((role) => role.id === activeRoleId) ??
    roleOptions[0] ??
    null;
  const selectedRoleValue = selectedRoleOption?.id ?? "";
  const switchableRoleCount = roleOptions.filter((role) =>
    Boolean(role.roleId),
  ).length;
  const canUseGlobalLocalityFilter =
    can(me, "dashboard", "view", "NATIONAL") ||
    can(me, "localities", "view", "NATIONAL");
  const availableGlobalLocalities = useMemo(
    () =>
      selectTargetLocalities((localitiesQuery.data?.items ?? []) as any[])
        .filter(
          (locality: any) =>
            Number(locality?.recruitsFemaleCountCurrent ?? 0) > 0,
        )
        .map((locality: any) => ({
          id: String(locality.id),
          name: String(locality.name),
        })),
    [localitiesQuery.data?.items],
  );
  const localityNameById = useMemo(
    () =>
      new Map(
        availableGlobalLocalities.map((locality) => [
          locality.id,
          locality.name,
        ]),
      ),
    [availableGlobalLocalities],
  );
  const globalLocalityId = searchParams.get(GLOBAL_LOCALITY_QUERY_PARAM) ?? "";
  const contextFromQuery = searchParams.get(GLOBAL_LOCALITY_QUERY_PARAM);
  const localityFromPath = location.pathname.startsWith("/dashboard/locality/")
    ? location.pathname.split("/").pop()
    : null;
  const contextLocality = contextFromQuery ?? localityFromPath;
  const sidebarCollapsed = !isMobile && desktopSidebarCollapsed;
  const sidebarWidth = sidebarCollapsed
    ? drawerCollapsedWidth
    : drawerExpandedWidth;
  const isTasksPath =
    location.pathname === "/tasks" || location.pathname.startsWith("/tasks/");

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    window.location.assign("/login");
  };

  const canSeeNavItem = (item: NavItem) => {
    if (item.to === "/dashboard/estrategico") {
      return hasAnyRole(me, [ROLE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_TI]);
    }
    if (item.to === "/ai") {
      return can(me, "bi", "view");
    }
    if (item.to === "/dashboard/smif") {
      return can(me, "dashboard", "view", "NATIONAL");
    }
    if (item.to === "/dashboard/cipavd") {
      return (
        can(me, "dashboard", "view") &&
        (me?.executive_hide_pii || can(me, "roles", "view"))
      );
    }
    if (item.to === "/dashboard/cpca") {
      return can(me, "cpca_cases", "view");
    }
    if (item.to === "/dashboard/bi") {
      return can(me, "bi", "view");
    }
    if (item.to === "/dashboard/bi-violencia-domestica") {
      return can(me, "bi", "view");
    }
    if (item.to === "/dashboard/bi-recrutas") {
      return can(me, "bi", "view") && hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);
    }
    if (item.to === "/dashboard/bi-ciclo-boas-praticas") {
      return can(me, "bi", "view");
    }
    if (item.to === "/dashboard/bi-encontro-cpca") {
      return can(me, "bi", "view");
    }
    if (item.to === "/dashboard/bi-avaliacao-gsd") {
      return can(me, "bi", "view");
    }
    if (item.to === "/smif-complaints") {
      return can(me, "smif_complaints", "view");
    }
    if (item.to === "/missions") {
      return can(me, "missions", "view");
    }
    if (item.to === "/cpca-cases") {
      return can(me, "cpca_cases", "view");
    }
    if (item.to === "/cpca-stats") {
      return can(me, "cpca_cases", "view");
    }
    if (item.to === "/notices") {
      return can(me, "notices", "view");
    }
    if (item.to === "/elos") {
      return can(me, "elos", "view");
    }
    if (item.to === "/org-chart") {
      return can(me, "org_chart", "view");
    }
    if (item.to === "/social-communication") {
      return can(me, "social_communication", "view");
    }
    if (item.to === "/library") {
      return can(me, "library", "view");
    }
    if (item.to === "/best-practices") {
      return can(me, "best_practices", "view");
    }
    if (item.to === "/activities" || item.to === "/activities-cipavd") {
      return can(me, "task_instances", "view");
    }
    if (item.to === "/meetings") {
      return can(me, "meetings", "view");
    }
    if (item.to === "/tasks") {
      return can(me, "task_instances", "view");
    }
    if (item.to === "/gantt") {
      return can(me, "gantt", "view");
    }
    if (item.to === "/calendar") {
      return can(me, "calendar", "view");
    }
    if (item.to === "/gsd-recruits") {
      return can(me, "localities", "view") || can(me, "dashboard", "view");
    }
    if (item.to === "/admin/oms") {
      return can(me, "localities", "view");
    }
    if (item.to === "/admin") {
      return canAccessAdminCatalog(me);
    }
    if (
      item.to === "/admin/rbac" ||
      item.to === "/admin/postos" ||
      item.to === "/admin/phases" ||
      item.to === "/admin/elo-roles"
    ) {
      return (
        can(me, "users", "view") ||
        can(me, "roles", "view") ||
        can(me, "roles", "permissions")
      );
    }
    if (item.to === "/audit") {
      return can(me, "audit_logs", "view");
    }
    return true;
  };

  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(canSeeNavItem),
    }))
    .filter((section) => section.items.length > 0);

  const pathnameOnly = toPathOnly(location.pathname);

  const activeNavItemPath = useMemo(() => {
    let bestMatch = "";
    let bestLength = -1;

    for (const section of visibleNavSections) {
      for (const item of section.items) {
        const itemPath = toPathOnly(item.to);
        if (!pathMatches(pathnameOnly, itemPath)) continue;
        if (itemPath.length > bestLength) {
          bestMatch = itemPath;
          bestLength = itemPath.length;
        }
      }
    }

    return bestMatch;
  }, [pathnameOnly, visibleNavSections]);

  const menuKeysToTrack = useMemo(
    () =>
      Array.from(
        new Set(
          visibleNavSections
            .flatMap((section) => section.items)
            .map((item) => String(item.menuKey ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [visibleNavSections],
  );

  const menuUpdatesQuery = useMenuUpdates(
    menuKeysToTrack,
    Boolean(me?.id) && menuKeysToTrack.length > 0,
  );
  const markMenuUpdateSeen = useMarkMenuUpdateSeen();

  const unreadMenuCountByKey = useMemo(() => {
    const map = new Map<string, number>();
    (
      (menuUpdatesQuery.data?.items ?? []) as Array<{
        menuKey?: string | null;
        unreadCount?: number | null;
        hasUnread?: boolean;
      }>
    ).forEach((item) => {
      const key = String(item?.menuKey ?? "").trim();
      if (!key) return;
      const parsedCount = Number(item?.unreadCount ?? 0);
      const safeCount = Number.isFinite(parsedCount)
        ? Math.max(0, Math.floor(parsedCount))
        : 0;
      const fallbackCount = item?.hasUnread ? 1 : 0;
      const unreadCount = safeCount > 0 ? safeCount : fallbackCount;
      if (unreadCount > 0) {
        map.set(key, unreadCount);
      }
    });
    return map;
  }, [menuUpdatesQuery.data?.items]);

  const activeNavItem = useMemo(() => {
    for (const section of visibleNavSections) {
      const found = section.items.find(
        (item) => toPathOnly(item.to) === activeNavItemPath,
      );
      if (found) return found;
    }
    return null;
  }, [activeNavItemPath, visibleNavSections]);

  const markMenuAsSeen = useCallback(
    (menuKeyRaw: string | null | undefined) => {
      const menuKey = String(menuKeyRaw ?? "").trim();
      if (!menuKey) return;
      if ((unreadMenuCountByKey.get(menuKey) ?? 0) <= 0) return;
      markMenuUpdateSeen.mutate(menuKey);
    },
    [markMenuUpdateSeen, unreadMenuCountByKey],
  );

  useEffect(() => {
    markMenuAsSeen(activeNavItem?.menuKey);
  }, [activeNavItem?.menuKey, markMenuAsSeen]);

  useEffect(() => {
    const fromUrl = (
      searchParams.get(GLOBAL_LOCALITY_QUERY_PARAM) ?? ""
    ).trim();

    if (!canUseGlobalLocalityFilter) {
      localStorage.removeItem(GLOBAL_LOCALITY_STORAGE_KEY);
      if (fromUrl) {
        const next = new URLSearchParams(searchParams);
        next.delete(GLOBAL_LOCALITY_QUERY_PARAM);
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (fromUrl) {
      localStorage.setItem(GLOBAL_LOCALITY_STORAGE_KEY, fromUrl);
      return;
    }

    // Sem valor na URL => sem filtro global ativo (evita filtro "fantasma" por localStorage antigo).
    localStorage.removeItem(GLOBAL_LOCALITY_STORAGE_KEY);
  }, [canUseGlobalLocalityFilter, searchParams, setSearchParams]);

  useEffect(() => {
    const roles = (me?.roles ?? []) as Array<{ id?: string | null }>;
    if (!roles.length) {
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      return;
    }
    const roleIds = new Set(
      roles.map((role) => String(role.id ?? "").trim()).filter(Boolean),
    );
    const desiredRoleId = String(
      me?.activeRole?.id ?? me?.activeRoleId ?? roles[0]?.id ?? "",
    ).trim();
    const storedRoleId =
      localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY)?.trim() ?? "";

    if (storedRoleId && !roleIds.has(storedRoleId)) {
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    }
    if (desiredRoleId && desiredRoleId !== storedRoleId) {
      localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, desiredRoleId);
    }
  }, [me]);

  const drawer = useMemo(
    () => (
      <Box
        sx={{ p: sidebarCollapsed ? 1 : 2, pt: sidebarCollapsed ? 1.2 : 2.4 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            pb: 0.7,
          }}
        >
          {!sidebarCollapsed && (
            <Typography
              variant="overline"
              sx={{
                display: "block",
                px: 1.2,
                color: "text.secondary",
                letterSpacing: "0.08em",
              }}
            >
              NAVEGAÇÃO
            </Typography>
          )}
          {!isMobile && (
            <Tooltip
              title={sidebarCollapsed ? "Expandir menu" : "Contrair menu"}
              placement={sidebarCollapsed ? "right" : "bottom"}
            >
              <IconButton
                size="small"
                onClick={() => setDesktopSidebarCollapsed((value) => !value)}
                sx={{
                  border: `1px solid ${alpha("#114259", 0.2)}`,
                  bgcolor: alpha("#FFFFFF", 0.5),
                }}
              >
                {sidebarCollapsed ? (
                  <ChevronRightRoundedIcon fontSize="small" />
                ) : (
                  <ChevronLeftRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {visibleNavSections.map((section, sectionIndex) => (
          <Box key={section.id}>
            {!sidebarCollapsed && section.label && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.2,
                  pt: sectionIndex === 0 ? 0.6 : 1.4,
                  pb: 0.6,
                  color: "text.secondary",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                {section.label}
              </Typography>
            )}
            <List disablePadding>
              {section.items.map((item) => {
                const selected = toPathOnly(item.to) === activeNavItemPath;
                const unreadCount =
                  unreadMenuCountByKey.get(String(item.menuKey ?? "").trim()) ??
                  0;
                const showUnreadBadge = !sidebarCollapsed && unreadCount > 0;
                const unreadLabel =
                  unreadCount > 99 ? "99+" : String(unreadCount);
                const button = (
                  <ListItemButton
                    key={item.to}
                    component={Link}
                    to={
                      canUseGlobalLocalityFilter &&
                      globalLocalityId &&
                      section.id !== "cipavd"
                        ? `${item.to}?${GLOBAL_LOCALITY_QUERY_PARAM}=${encodeURIComponent(globalLocalityId)}`
                        : item.to
                    }
                    selected={selected}
                    onClick={() => {
                      markMenuAsSeen(item.menuKey);
                      setMobileOpen(false);
                    }}
                    sx={{
                      justifyContent: sidebarCollapsed
                        ? "center"
                        : "flex-start",
                      px: sidebarCollapsed ? 1 : undefined,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: sidebarCollapsed ? 0 : 34,
                        color: selected ? "primary.dark" : "text.secondary",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!sidebarCollapsed && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          minWidth: 0,
                          flexGrow: 1,
                          gap: 0.8,
                        }}
                      >
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: 13.5,
                            fontWeight: selected ? 700 : 600,
                            lineHeight: 1.22,
                          }}
                          sx={{ minWidth: 0 }}
                        />
                        {showUnreadBadge ? (
                          <Box
                            component="span"
                            aria-label="Novidades não visualizadas"
                            sx={{
                              minWidth: 18,
                              height: 18,
                              px: 0.5,
                              borderRadius: 9,
                              bgcolor: "#D24B4B",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              lineHeight: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {unreadLabel}
                          </Box>
                        ) : null}
                      </Box>
                    )}
                  </ListItemButton>
                );
                if (!sidebarCollapsed) return button;
                return (
                  <Tooltip
                    key={`tt-${item.to}`}
                    title={item.label}
                    placement="right"
                  >
                    {button}
                  </Tooltip>
                );
              })}
            </List>
            {sectionIndex < visibleNavSections.length - 1 && (
              <Divider
                sx={{
                  my: 1.1,
                  mx: sidebarCollapsed ? 0.6 : 0.8,
                  opacity: 0.45,
                }}
              />
            )}
          </Box>
        ))}
      </Box>
    ),
    [
      canUseGlobalLocalityFilter,
      globalLocalityId,
      activeNavItemPath,
      isMobile,
      markMenuAsSeen,
      sidebarCollapsed,
      unreadMenuCountByKey,
      visibleNavSections,
    ],
  );

  const canSeeNotices = can(me, "notices", "view");
  const canSeeMeetings = can(me, "meetings", "view");
  const canSeeDocuments = can(me, "documents", "view");
  const totalSearchResults =
    (searchQuery.data?.tasks?.length ?? 0) +
    (canSeeNotices ? (searchQuery.data?.notices?.length ?? 0) : 0) +
    (canSeeMeetings ? (searchQuery.data?.meetings?.length ?? 0) : 0) +
    (searchQuery.data?.localities?.length ?? 0) +
    (canSeeDocuments ? (searchQuery.data?.documents?.length ?? 0) : 0);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ zIndex: theme.zIndex.drawer + 1, height: `${headerHeight}px` }}
      >
        <Toolbar
          sx={{
            minHeight: `${headerHeight}px !important`,
            height: `${headerHeight}px`,
            gap: 1.2,
          }}
        >
          {isMobile && (
            <IconButton
              edge="start"
              onClick={() => setMobileOpen((v) => !v)}
              sx={{ mr: 0.3, color: "text.primary" }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              minWidth: 220,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                p: 0.4,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #0C657E 10%, #C56A2B 90%)",
                boxShadow: "0 10px 22px rgba(8, 54, 71, 0.22)",
              }}
            >
              <Avatar
                src="/brand/cipavd-7.png"
                alt="CIPAVD"
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: "#f8fafc",
                }}
              />
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 800, lineHeight: 1.1 }}
              >
                CIPAVD Gestão
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", lineHeight: 1.1 }}
              >
                SMIF e CPCA
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {can(me, "search", "view") && (
            <Box sx={{ mr: 0.6 }}>
              <Tooltip title="Busca global">
                <IconButton
                  onClick={(event) => setAnchorEl(event.currentTarget)}
                  sx={{
                    border: `1px solid ${alpha("#114259", 0.2)}`,
                    bgcolor: alpha("#FFFFFF", 0.45),
                  }}
                >
                  <SearchIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                PaperProps={{
                  sx: {
                    borderRadius: 2,
                    width: 380,
                    border: `1px solid ${alpha("#114259", 0.16)}`,
                    boxShadow: "0 16px 32px rgba(10, 37, 51, 0.12)",
                  },
                }}
              >
                <Box sx={{ p: 1.2 }}>
                  <TextField
                    size="small"
                    placeholder="Buscar no sistema..."
                    autoFocus
                    value={globalQuery}
                    onChange={(e) => setGlobalQuery(e.target.value)}
                    fullWidth
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      px: 0.4,
                      pt: 1.2,
                      pb: 0.6,
                      color: "text.secondary",
                      display: "block",
                    }}
                  >
                    Resultados
                  </Typography>
                  {!debounced ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ px: 0.4, pb: 0.8 }}
                    >
                      Digite para buscar tarefas, avisos, reuniões, localidades
                      e documentos.
                    </Typography>
                  ) : (
                    <List dense>
                      {(searchQuery.data?.tasks ?? []).map((task: any) => (
                        <ListItemButton
                          key={task.id}
                          component={Link}
                          to={`/tasks?q=${encodeURIComponent(task.title)}`}
                          onClick={() => setAnchorEl(null)}
                        >
                          <ListItemText
                            primary={task.title}
                            secondary={task.localityName ?? task.localityId}
                          />
                        </ListItemButton>
                      ))}
                      {canSeeNotices &&
                        (searchQuery.data?.notices ?? []).map((notice: any) => (
                          <ListItemButton
                            key={notice.id}
                            component={Link}
                            to="/notices"
                            onClick={() => setAnchorEl(null)}
                          >
                            <ListItemText
                              primary={notice.title}
                              secondary={`Aviso ${NOTICE_PRIORITY_LABELS[notice.priority] ?? notice.priority}`}
                            />
                          </ListItemButton>
                        ))}
                      {canSeeMeetings &&
                        (searchQuery.data?.meetings ?? []).map(
                          (meeting: any) => (
                            <ListItemButton
                              key={meeting.id}
                              component={Link}
                              to="/meetings"
                              onClick={() => setAnchorEl(null)}
                            >
                              <ListItemText
                                primary={
                                  meeting.scope
                                    ? meeting.scope.length > 35
                                      ? `${meeting.scope.slice(0, 35)}…`
                                      : meeting.scope
                                    : "Reunião"
                                }
                                secondary={
                                  MEETING_STATUS_LABELS[meeting.status] ??
                                  meeting.status
                                }
                              />
                            </ListItemButton>
                          ),
                        )}
                      {(searchQuery.data?.localities ?? []).map((loc: any) => (
                        <ListItemButton
                          key={loc.id}
                          component={Link}
                          to={`/dashboard/locality/${loc.id}`}
                          onClick={() => setAnchorEl(null)}
                        >
                          <ListItemText
                            primary={loc.name}
                            secondary={loc.code}
                          />
                        </ListItemButton>
                      ))}
                      {canSeeDocuments &&
                        (searchQuery.data?.documents ?? []).map((doc: any) => (
                          <ListItemButton
                            key={doc.id}
                            component={Link}
                            to={`/documents?q=${encodeURIComponent(doc.title)}`}
                            onClick={() => setAnchorEl(null)}
                          >
                            <ListItemText
                              primary={doc.title}
                              secondary={
                                doc.localityName
                                  ? `Impacto Positivo • ${doc.localityName}`
                                  : "Impacto Positivo"
                              }
                            />
                          </ListItemButton>
                        ))}
                      {totalSearchResults === 0 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ px: 0.4, py: 0.8 }}
                        >
                          Nenhum resultado.
                        </Typography>
                      )}
                    </List>
                  )}
                </Box>
              </Popover>
            </Box>
          )}
          {canUseGlobalLocalityFilter && !isTasksPath && (
            <TextField
              select
              size="small"
              label="Filtro global"
              value={globalLocalityId}
              onChange={(event) => {
                const value = event.target.value;
                const next = new URLSearchParams(searchParams);
                if (value) {
                  next.set(GLOBAL_LOCALITY_QUERY_PARAM, value);
                  localStorage.setItem(GLOBAL_LOCALITY_STORAGE_KEY, value);
                } else {
                  next.delete(GLOBAL_LOCALITY_QUERY_PARAM);
                  localStorage.removeItem(GLOBAL_LOCALITY_STORAGE_KEY);
                }
                setSearchParams(next);
              }}
              sx={{
                minWidth: 160,
                maxWidth: 190,
                display: { xs: "none", xl: "inline-flex" },
              }}
            >
              <MenuItem value="">Sem filtro</MenuItem>
              {availableGlobalLocalities.map((locality) => (
                <MenuItem key={locality.id} value={locality.id}>
                  {locality.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {roleOptions.length > 0 && (
            <TextField
              select
              size="small"
              label="Papel ativo"
              value={selectedRoleValue}
              onChange={(event) => {
                const nextValue = String(event.target.value ?? "").trim();
                if (!nextValue) return;
                const option = roleOptions.find(
                  (role) => role.id === nextValue,
                );
                const nextRoleId = String(option?.roleId ?? "").trim();
                if (!nextRoleId) return;
                localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, nextRoleId);
                window.location.reload();
              }}
              disabled={switchableRoleCount < 2}
              sx={{
                minWidth: { xs: 104, sm: 124, md: 142 },
                maxWidth: { md: 176 },
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Chip
            label={
              contextLocality
                ? `Localidade ${localityNameById.get(contextLocality) ?? contextLocality}`
                : "Contexto Brasil"
            }
            size="small"
            sx={{
              display: { xs: "none", xl: "inline-flex" },
              bgcolor: alpha("#0C657E", 0.08),
              color: "#0A4A5E",
            }}
          />
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: 0.6, display: { xs: "none", md: "block" } }}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pl: { xs: 0.2, md: 0 },
            }}
          >
            <Avatar
              src={userPhotoDataUrl || undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: alpha("#0C657E", 0.12),
                color: "#0A4D61",
                fontSize: 13,
              }}
            >
              {(me?.name ?? "U").slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ display: { xs: "none", sm: "grid" }, lineHeight: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {me?.name ?? "Usuário"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: 600 }}
              >
                {currentRoleLabel}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutIcon fontSize="small" />}
              onClick={handleLogout}
              sx={{ ml: 0.4 }}
            >
              Sair
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { lg: sidebarWidth },
          flexShrink: { lg: 0 },
          transition: theme.transitions.create("width", {
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: { xs: drawerExpandedWidth, lg: sidebarWidth },
              boxSizing: "border-box",
              top: { lg: `${headerHeight}px` },
              height: { lg: `calc(100% - ${headerHeight}px)` },
              overflowX: "hidden",
              transition: theme.transitions.create("width", {
                duration: theme.transitions.duration.shorter,
              }),
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "hidden",
          px: { xs: 1.5, md: 3 },
          pb: 3.5,
        }}
      >
        <Toolbar
          sx={{
            minHeight: `${headerHeight}px !important`,
            height: `${headerHeight}px`,
          }}
        />
        <Box
          className="page-enter"
          sx={{
            width: "100%",
            minWidth: 0,
            maxWidth: 1650,
            mx: "auto",
            pt: { xs: 1.2, md: 1.8 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
