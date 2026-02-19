import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  TextField,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TaskIcon from '@mui/icons-material/Task';
import TimelineIcon from '@mui/icons-material/Timeline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupsIcon from '@mui/icons-material/Groups';
import PeopleIcon from '@mui/icons-material/People';
import CampaignIcon from '@mui/icons-material/Campaign';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import HistoryIcon from '@mui/icons-material/History';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../app/useDebounce';
import { can } from '../app/rbac';
import {
  hasAnyRole,
  hasRole,
  hasNationalManagementScope,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../app/roleAccess';
import { useMe, useSearch } from '../api/hooks';
import { MEETING_STATUS_LABELS, NOTICE_PRIORITY_LABELS } from '../constants/enums';

const drawerExpandedWidth = 284;
const drawerCollapsedWidth = 92;

const navItems = [
  { label: 'Painel Nacional', to: '/dashboard/national', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Painel Exec.', to: '/dashboard/executive', icon: <DashboardIcon fontSize="small" /> },
  { label: 'BI Pesquisas', to: '/dashboard/bi', icon: <InsightsRoundedIcon fontSize="small" /> },
  { label: 'Atividades', to: '/activities', icon: <EventNoteIcon fontSize="small" /> },
  { label: 'Tarefas', to: '/tasks', icon: <TaskIcon fontSize="small" /> },
  { label: 'Modelos de tarefa', to: '/templates', icon: <TaskIcon fontSize="small" /> },
  { label: 'Acervo', to: '/documents', icon: <FolderOpenIcon fontSize="small" /> },
  { label: 'Cronograma', to: '/gantt', icon: <TimelineIcon fontSize="small" /> },
  { label: 'Calendário', to: '/calendar', icon: <CalendarMonthIcon fontSize="small" /> },
  { label: 'Reuniões', to: '/meetings', icon: <GroupsIcon fontSize="small" /> },
  { label: 'GSD e Recrutas', to: '/gsd-recruits', icon: <PeopleIcon fontSize="small" /> },
  { label: 'Histórico de recrutas', to: '/recruits-history', icon: <PeopleIcon fontSize="small" /> },
  { label: 'Avisos', to: '/notices', icon: <CampaignIcon fontSize="small" /> },
  { label: 'Checklists', to: '/checklists', icon: <ChecklistIcon fontSize="small" /> },
  { label: 'Elos', to: '/elos', icon: <ContactPhoneIcon fontSize="small" /> },
  { label: 'Organograma', to: '/org-chart', icon: <AccountTreeIcon fontSize="small" /> },
  { label: 'Auditoria', to: '/audit', icon: <HistoryIcon fontSize="small" /> },
  { label: 'Tipos de Elo', to: '/admin/elo-roles', icon: <ContactPhoneIcon fontSize="small" /> },
  { label: 'Postos', to: '/admin/postos', icon: <ContactPhoneIcon fontSize="small" /> },
  { label: 'Fases', to: '/admin/phases', icon: <SettingsIcon fontSize="small" /> },
  { label: 'Admin RBAC', to: '/admin/rbac', icon: <SettingsIcon fontSize="small" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const debounced = useDebounce(globalQuery, 300);
  const searchQuery = useSearch(debounced);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { data: me } = useMe();
  const currentRoleLabel = me?.roles?.[0]?.name ?? 'Sem papel';
  const contextFromQuery = searchParams.get('localityId');
  const localityFromPath = location.pathname.startsWith('/dashboard/locality/') ? location.pathname.split('/').pop() : null;
  const contextLocality = contextFromQuery ?? localityFromPath;
  const sidebarCollapsed = !isMobile && desktopSidebarCollapsed;
  const sidebarWidth = sidebarCollapsed ? drawerCollapsedWidth : drawerExpandedWidth;

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.assign('/login');
  };

  const visibleNavItems = navItems.filter((item) => {
    const isCoordCipavd = hasRole(me, ROLE_COORDENACAO_CIPAVD);
    const isNationalManager = hasNationalManagementScope(me);
    const isBiRole = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI]);

    if (item.to === '/dashboard/national') {
      return isNationalManager && can(me, 'dashboard', 'view');
    }
    if (item.to === '/admin/rbac') {
      return can(me, 'admin_rbac', 'export') || can(me, 'roles', 'view');
    }
    if (item.to === '/dashboard/executive') {
      return can(me, 'dashboard', 'view') && (me?.executive_hide_pii || can(me, 'roles', 'view'));
    }
    if (item.to === '/dashboard/bi') {
      return isBiRole && can(me, 'dashboard', 'view');
    }
    if (item.to === '/audit') {
      return can(me, 'audit_logs', 'view');
    }
    if (item.to === '/notices') {
      return can(me, 'notices', 'view');
    }
    if (item.to === '/checklists') {
      return can(me, 'checklists', 'view');
    }
    if (item.to === '/elos') {
      return can(me, 'elos', 'view');
    }
    if (item.to === '/org-chart') {
      return can(me, 'org_chart', 'view');
    }
    if (item.to === '/templates') {
      return can(me, 'task_templates', 'view');
    }
    if (item.to === '/documents') {
      return (isCoordCipavd || hasRole(me, ROLE_TI)) && can(me, 'search', 'view');
    }
    if (item.to === '/activities') {
      return can(me, 'task_instances', 'view');
    }
    if (item.to === '/meetings') {
      return isNationalManager && can(me, 'meetings', 'view');
    }
    if (item.to === '/gsd-recruits') {
      return can(me, 'localities', 'view') || (can(me, 'dashboard', 'view') && Boolean(me?.localityId));
    }
    if (item.to === '/recruits-history') {
      return can(me, 'dashboard', 'view');
    }
    if (item.to === '/admin/elo-roles') {
      return can(me, 'elo_roles', 'view');
    }
    if (item.to === '/admin/postos') {
      return can(me, 'postos', 'view');
    }
    if (item.to === '/admin/phases') {
      return can(me, 'phases', 'update');
    }
    return true;
  });

  const drawer = useMemo(
    () => (
      <Box sx={{ p: sidebarCollapsed ? 1 : 2, pt: sidebarCollapsed ? 1.2 : 2.4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', pb: 0.7 }}>
          {!sidebarCollapsed && (
            <Typography
              variant="overline"
              sx={{ display: 'block', px: 1.2, color: 'text.secondary', letterSpacing: '0.08em' }}
            >
              MÓDULOS
            </Typography>
          )}
          {!isMobile && (
            <Tooltip title={sidebarCollapsed ? 'Expandir menu' : 'Contrair menu'} placement={sidebarCollapsed ? 'right' : 'bottom'}>
              <IconButton
                size="small"
                onClick={() => setDesktopSidebarCollapsed((value) => !value)}
                sx={{ border: `1px solid ${alpha('#114259', 0.2)}`, bgcolor: alpha('#FFFFFF', 0.5) }}
              >
                {sidebarCollapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ChevronLeftRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <List disablePadding>
          {visibleNavItems.map((item) => {
            const selected = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            const button = (
              <ListItemButton
                key={item.to}
                component={Link}
                to={item.to}
                selected={selected}
                onClick={() => setMobileOpen(false)}
                sx={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', px: sidebarCollapsed ? 1 : undefined }}
              >
                <ListItemIcon sx={{ minWidth: sidebarCollapsed ? 0 : 34, color: selected ? 'primary.dark' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                {!sidebarCollapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: 13.5, fontWeight: selected ? 700 : 600, lineHeight: 1.22 }}
                  />
                )}
              </ListItemButton>
            );
            if (!sidebarCollapsed) return button;
            return (
              <Tooltip key={`tt-${item.to}`} title={item.label} placement="right">
                {button}
              </Tooltip>
            );
          })}
        </List>
      </Box>
    ),
    [isMobile, location.pathname, sidebarCollapsed, visibleNavItems],
  );

  const canSeeDocuments = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_TI]);
  const canSeeMeetings = hasNationalManagementScope(me);
  const totalSearchResults =
    (searchQuery.data?.tasks?.length ?? 0) +
    (searchQuery.data?.notices?.length ?? 0) +
    (canSeeMeetings ? (searchQuery.data?.meetings?.length ?? 0) : 0) +
    (searchQuery.data?.localities?.length ?? 0) +
    (canSeeDocuments ? (searchQuery.data?.documents?.length ?? 0) : 0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: 76, gap: 1.2 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen((v) => !v)} sx={{ mr: 0.3, color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 220 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                p: 0.4,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #0C657E 10%, #C56A2B 90%)',
                boxShadow: '0 10px 22px rgba(8, 54, 71, 0.22)',
              }}
            >
              <Avatar
                src="/brand/cipavd-7.png"
                alt="CIPAVD"
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: '#f8fafc',
                }}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                CIPAVD Gestão
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.1 }}>
                Comissão de Iniciação
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {can(me, 'search', 'view') && (
            <Box sx={{ display: { xs: 'none', lg: 'block' }, mr: 1.2 }}>
              <TextField
                size="small"
                placeholder="Busca global"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onFocus={(e) => setAnchorEl(e.currentTarget)}
                sx={{ minWidth: 330 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Popover
                open={Boolean(anchorEl) && Boolean(debounced)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                PaperProps={{
                  sx: {
                    borderRadius: 2,
                    width: 360,
                    border: `1px solid ${alpha('#114259', 0.16)}`,
                    boxShadow: '0 16px 32px rgba(10, 37, 51, 0.12)',
                  },
                }}
              >
                <Box sx={{ p: 1.2 }}>
                  <Typography variant="caption" sx={{ px: 1.2, color: 'text.secondary' }}>
                    Resultados
                  </Typography>
                  <List dense>
                    {(searchQuery.data?.tasks ?? []).map((task: any) => (
                      <ListItemButton
                        key={task.id}
                        component={Link}
                        to={`/tasks?q=${encodeURIComponent(task.title)}`}
                        onClick={() => setAnchorEl(null)}
                      >
                        <ListItemText primary={task.title} secondary={task.localityName ?? task.localityId} />
                      </ListItemButton>
                    ))}
                    {(searchQuery.data?.notices ?? []).map((notice: any) => (
                      <ListItemButton key={notice.id} component={Link} to="/notices" onClick={() => setAnchorEl(null)}>
                        <ListItemText
                          primary={notice.title}
                          secondary={`Aviso ${NOTICE_PRIORITY_LABELS[notice.priority] ?? notice.priority}`}
                        />
                      </ListItemButton>
                    ))}
                    {canSeeMeetings && (searchQuery.data?.meetings ?? []).map((meeting: any) => (
                      <ListItemButton key={meeting.id} component={Link} to="/meetings" onClick={() => setAnchorEl(null)}>
                        <ListItemText
                          primary={
                            meeting.scope ? (meeting.scope.length > 35 ? `${meeting.scope.slice(0, 35)}…` : meeting.scope) : 'Reunião'
                          }
                          secondary={MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
                        />
                      </ListItemButton>
                    ))}
                    {(searchQuery.data?.localities ?? []).map((loc: any) => (
                      <ListItemButton
                        key={loc.id}
                        component={Link}
                        to={`/dashboard/locality/${loc.id}`}
                        onClick={() => setAnchorEl(null)}
                      >
                        <ListItemText primary={loc.name} secondary={loc.code} />
                      </ListItemButton>
                    ))}
                    {canSeeDocuments && (searchQuery.data?.documents ?? []).map((doc: any) => (
                      <ListItemButton
                        key={doc.id}
                        component={Link}
                        to={`/documents?q=${encodeURIComponent(doc.title)}`}
                        onClick={() => setAnchorEl(null)}
                      >
                        <ListItemText
                          primary={doc.title}
                          secondary={doc.localityName ? `Acervo • ${doc.localityName}` : 'Acervo'}
                        />
                      </ListItemButton>
                    ))}
                    {totalSearchResults === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ px: 1.3, py: 1 }}>
                        Nenhum resultado.
                      </Typography>
                    )}
                  </List>
                </Box>
              </Popover>
            </Box>
          )}
          <Chip
            label={contextLocality ? `Localidade ${contextLocality}` : 'Contexto Brasil'}
            size="small"
            sx={{ display: { xs: 'none', md: 'inline-flex' }, bgcolor: alpha('#0C657E', 0.08), color: '#0A4A5E' }}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.6, display: { xs: 'none', md: 'block' } }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: { xs: 0.2, md: 0 } }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: alpha('#0C657E', 0.12), color: '#0A4D61', fontSize: 13 }}>
              {(me?.name ?? 'U').slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'grid' }, lineHeight: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {me?.name ?? 'Usuário'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
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
          transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
        }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: drawerExpandedWidth, lg: sidebarWidth },
              boxSizing: 'border-box',
              top: { lg: 76 },
              height: { lg: 'calc(100% - 76px)' },
              overflowX: 'hidden',
              transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, px: { xs: 1.5, md: 3 }, pb: 3.5 }}>
        <Toolbar sx={{ minHeight: 82 }} />
        <Box className="page-enter" sx={{ maxWidth: 1650, mx: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
