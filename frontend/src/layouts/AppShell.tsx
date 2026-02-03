import { ReactNode, useMemo } from 'react';
import { AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TaskIcon from '@mui/icons-material/Task';
import TimelineIcon from '@mui/icons-material/Timeline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignIcon from '@mui/icons-material/Campaign';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import HistoryIcon from '@mui/icons-material/History';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMe } from '../api/hooks';
import { can } from '../app/rbac';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';

const drawerWidth = 240;

const navItems = [
  { label: 'Dashboard', to: '/dashboard/national', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Tarefas', to: '/tasks', icon: <TaskIcon fontSize="small" /> },
  { label: 'Gantt', to: '/gantt', icon: <TimelineIcon fontSize="small" /> },
  { label: 'Calendario', to: '/calendar', icon: <CalendarMonthIcon fontSize="small" /> },
  { label: 'Reunioes', to: '/meetings', icon: <GroupsIcon fontSize="small" /> },
  { label: 'Avisos', to: '/notices', icon: <CampaignIcon fontSize="small" /> },
  { label: 'Checklists', to: '/checklists', icon: <ChecklistIcon fontSize="small" /> },
  { label: 'Elos', to: '/elos', icon: <ContactPhoneIcon fontSize="small" /> },
  { label: 'Organograma', to: '/org-chart', icon: <AccountTreeIcon fontSize="small" /> },
  { label: 'Auditoria', to: '/audit', icon: <HistoryIcon fontSize="small" /> },
  { label: 'Admin RBAC', to: '/admin/rbac', icon: <SettingsIcon fontSize="small" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: me } = useMe();
  const contextFromQuery = searchParams.get('localityId');
  const localityFromPath = location.pathname.startsWith('/dashboard/locality/')
    ? location.pathname.split('/').pop()
    : null;
  const contextLocality = contextFromQuery ?? localityFromPath;

  const visibleNavItems = navItems.filter((item) => {
    if (item.to === '/admin/rbac') {
      return can(me, 'admin_rbac', 'export') || can(me, 'roles', 'view');
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
    return true;
  });

  const drawer = useMemo(
    () => (
      <Box sx={{ paddingTop: 2 }}>
        <Typography variant="h6" sx={{ px: 2, pb: 1, color: 'primary.main', fontWeight: 700 }}>
          SMIF Gestao
        </Typography>
        <List>
          {visibleNavItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={Link}
              to={item.to}
              selected={location.pathname.startsWith(item.to)}
              onClick={() => setMobileOpen(false)}
              sx={{ mx: 1, borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    ),
    [location.pathname],
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen((v) => !v)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            SMIF Gestao - Comissao de Iniciacao
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ mr: 2 }}>
            Contexto: {contextLocality ? `Localidade ${contextLocality}` : 'Brasil'}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {me?.name ?? 'Usuario'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              background: '#FFFFFF',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
