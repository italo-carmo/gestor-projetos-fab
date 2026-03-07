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
import { AdminPage } from './pages/AdminPage';
import { OmsAdminPage } from './pages/OmsAdminPage';
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
import { LibraryPage } from './pages/LibraryPage';
import { BestPracticesPage } from './pages/BestPracticesPage';
import { LessonsLearnedPage } from './pages/LessonsLearnedPage';
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
                  path="/dashboard/smif"
                  element={
                    <RequireRoleAccess allow={(user) => hasNationalManagementScope(user)}>
                      <DashboardNationalPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/dashboard/national" element={<Navigate to="/dashboard/smif" replace />} />
                <Route path="/dashboard/cipavd" element={<DashboardExecutivePage />} />
                <Route path="/dashboard/executive" element={<Navigate to="/dashboard/cipavd" replace />} />
                <Route
                  path="/dashboard/cpca"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
                      }
                    >
                      <CpcaStatsPage />
                    </RequireRoleAccess>
                  }
                />
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
                        hasAnyRole(user, [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
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
                  path="/best-practices"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
                      }
                    >
                      <BestPracticesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route path="/library" element={<LibraryPage />} />
                <Route
                  path="/lessons-learned"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])
                      }
                    >
                      <LessonsLearnedPage />
                    </RequireRoleAccess>
                  }
                />
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
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/localities" element={<Navigate to="/admin?tab=localities" replace />} />
                <Route path="/admin/localidades" element={<Navigate to="/admin?tab=localities" replace />} />
                <Route path="/admin/postos" element={<Navigate to="/admin?tab=postos" replace />} />
                <Route path="/admin/phases" element={<Navigate to="/admin?tab=phases" replace />} />
                <Route path="/admin/elo-roles" element={<Navigate to="/admin?tab=elo-roles" replace />} />
                <Route
                  path="/admin/oms"
                  element={
                    <RequireRoleAccess allow={(user) => hasAnyRole(user, [ROLE_TI])}>
                      <OmsAdminPage />
                    </RequireRoleAccess>
                  }
                />
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
