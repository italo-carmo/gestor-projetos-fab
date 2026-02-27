import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { DashboardNationalPage } from './pages/DashboardNationalPage';
import { DashboardLocalityPage } from './pages/DashboardLocalityPage';
import { DashboardExecutivePage } from './pages/DashboardExecutivePage';
import { TasksPage } from './pages/TasksPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { GanttPage } from './pages/GanttPage';
import { CalendarPage } from './pages/CalendarPage';
import { AdminRbacPage } from './pages/AdminRbacPage';
import { EloRolesPage } from './pages/EloRolesPage';
import { PostosPage } from './pages/PostosPage';
import { OmsAdminPage } from './pages/OmsAdminPage';
import { AdminPhasesPage } from './pages/AdminPhasesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { NoticesPage } from './pages/NoticesPage';
import { ChecklistsPage } from './pages/ChecklistsPage';
import { ElosPage } from './pages/ElosPage';
import { GsdRecruitsPage } from './pages/GsdRecruitsPage';
import { OrgChartPage } from './pages/OrgChartPage';
import { AuditPage } from './pages/AuditPage';
import { TaskTemplatesPage } from './pages/TaskTemplatesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { BiSurveyDashboardPage } from './pages/BiSurveyDashboardPage';
import { MissionsPage } from './pages/MissionsPage';
import { SocialCommunicationPage } from './pages/SocialCommunicationPage';
import { CpcaCasesPage } from './pages/CpcaCasesPage';
import { CpcaStatsPage } from './pages/CpcaStatsPage';
import { RequireAuth } from './app/RequireAuth';
import { RequireRoleAccess } from './app/RequireRoleAccess';
import {
  hasAnyRole,
  hasNationalManagementScope,
  ROLE_COMANDANTE_COMGEP,
  ROLE_CPCA,
  resolveHomePath,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from './app/roleAccess';
import { useMe } from './api/hooks';

function HomeRedirect() {
  const { data } = useMe();
  return <Navigate to={resolveHomePath(data)} replace />;
}

function RecruitsHistoryRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', 'historico');
  return <Navigate to={`/gsd-recruits?${params.toString()}`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route
                  path="/dashboard/national"
                  element={
                    <RequireRoleAccess allow={(user) => hasNationalManagementScope(user)}>
                      <DashboardNationalPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/dashboard/executive" element={<DashboardExecutivePage />} />
                <Route
                  path="/dashboard/bi"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
                      }
                    >
                      <BiSurveyDashboardPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/dashboard/locality/:id" element={<DashboardLocalityPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route
                  path="/cpca-cases"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP])
                      }
                    >
                      <CpcaCasesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-stats"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
                      }
                    >
                      <CpcaStatsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/missions"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
                      }
                    >
                      <MissionsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/gantt" element={<GanttPage />} />
                <Route
                  path="/calendar"
                  element={
                    <RequireRoleAccess allow={(user) => hasNationalManagementScope(user)}>
                      <CalendarPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/meetings"
                  element={
                    <RequireRoleAccess allow={(user) => hasNationalManagementScope(user)}>
                      <MeetingsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/gsd-recruits" element={<GsdRecruitsPage />} />
                <Route path="/recruits-history" element={<RecruitsHistoryRedirect />} />
                <Route path="/notices" element={<NoticesPage />} />
                <Route path="/checklists" element={<ChecklistsPage />} />
                <Route path="/templates" element={<TaskTemplatesPage />} />
                <Route path="/social-communication" element={<SocialCommunicationPage />} />
                <Route
                  path="/documents"
                  element={
                    <RequireRoleAccess allow={(user) => hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])}>
                      <DocumentsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/elos" element={<ElosPage />} />
                <Route path="/org-chart" element={<OrgChartPage />} />
                <Route
                  path="/audit"
                  element={
                    <RequireRoleAccess allow={(user) => hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])}>
                      <AuditPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/admin/rbac" element={<AdminRbacPage />} />
                <Route path="/admin/elo-roles" element={<EloRolesPage />} />
                <Route
                  path="/admin/oms"
                  element={
                    <RequireRoleAccess allow={(user) => hasAnyRole(user, [ROLE_TI])}>
                      <OmsAdminPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/admin/postos" element={<PostosPage />} />
                <Route path="/admin/phases" element={<AdminPhasesPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
