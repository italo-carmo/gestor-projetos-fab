import { Navigate, Route, Routes } from 'react-router-dom';
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
import { AdminPhasesPage } from './pages/AdminPhasesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { NoticesPage } from './pages/NoticesPage';
import { ChecklistsPage } from './pages/ChecklistsPage';
import { ElosPage } from './pages/ElosPage';
import { GsdRecruitsPage } from './pages/GsdRecruitsPage';
import { RecruitsHistoryPage } from './pages/RecruitsHistoryPage';
import { OrgChartPage } from './pages/OrgChartPage';
import { AuditPage } from './pages/AuditPage';
import { TaskTemplatesPage } from './pages/TaskTemplatesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { BiSurveyDashboardPage } from './pages/BiSurveyDashboardPage';
import { RequireAuth } from './app/RequireAuth';

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
                <Route path="/" element={<Navigate to="/dashboard/national" replace />} />
                <Route path="/dashboard/national" element={<DashboardNationalPage />} />
                <Route path="/dashboard/executive" element={<DashboardExecutivePage />} />
                <Route path="/dashboard/bi" element={<BiSurveyDashboardPage />} />
                <Route path="/dashboard/locality/:id" element={<DashboardLocalityPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/gantt" element={<GanttPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/meetings" element={<MeetingsPage />} />
                <Route path="/gsd-recruits" element={<GsdRecruitsPage />} />
                <Route path="/recruits-history" element={<RecruitsHistoryPage />} />
                <Route path="/notices" element={<NoticesPage />} />
                <Route path="/checklists" element={<ChecklistsPage />} />
                <Route path="/templates" element={<TaskTemplatesPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/elos" element={<ElosPage />} />
                <Route path="/org-chart" element={<OrgChartPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/admin/rbac" element={<AdminRbacPage />} />
                <Route path="/admin/elo-roles" element={<EloRolesPage />} />
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
