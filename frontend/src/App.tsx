import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { DashboardNationalPage } from "./pages/DashboardNationalPage";
import { DashboardLocalityPage } from "./pages/DashboardLocalityPage";
import { DashboardExecutivePage } from "./pages/DashboardExecutivePage";
import { TasksPage } from "./pages/TasksPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { GanttPage } from "./pages/GanttPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AdminRbacPage } from "./pages/AdminRbacPage";
import { AdminPage } from "./pages/AdminPage";
import { OmsAdminPage } from "./pages/OmsAdminPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LoginPage } from "./pages/LoginPage";
import { TwoFactorSetupPage } from "./pages/TwoFactorSetupPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { NoticesPage } from "./pages/NoticesPage";
import { ChecklistsPage } from "./pages/ChecklistsPage";
import { ElosPage } from "./pages/ElosPage";
import { GsdRecruitsPage } from "./pages/GsdRecruitsPage";
import { OrgChartPage } from "./pages/OrgChartPage";
import { AuditPage } from "./pages/AuditPage";
import { TaskTemplatesPage } from "./pages/TaskTemplatesPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { BusinessIntelligencePage } from "./pages/BusinessIntelligencePage";
import { StrategicDashboardPage } from "./pages/StrategicDashboardPage";
import { AiPage } from "./pages/AiPage";
import { ManualCipavdPage } from "./pages/ManualCipavdPage";
import { ComgepSituationRoomPage } from "./pages/ComgepSituationRoomPage";
import { MissionsPage } from "./pages/MissionsPage";
import { SocialCommunicationPage } from "./pages/SocialCommunicationPage";
import { CpcaCasesPage } from "./pages/CpcaCasesPage";
import { CpcaChecklistPage } from "./pages/CpcaChecklistPage";
import { CpcaCommissionPage } from "./pages/CpcaCommissionPage";
import { CpcaPresidentApprovalsPage } from "./pages/CpcaPresidentApprovalsPage";
import { CpcaStatsPage } from "./pages/CpcaStatsPage";
import { SmifComplaintsPage } from "./pages/SmifComplaintsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { BestPracticesPage } from "./pages/BestPracticesPage";
import { LessonsLearnedPage } from "./pages/LessonsLearnedPage";
import { CipavdReportsPage } from "./pages/CipavdReportsPage";
import { RequireAuth } from "./app/RequireAuth";
import { RequireRoleAccess } from "./app/RequireRoleAccess";
import { can, canAccessAdminCatalog } from "./app/rbac";
import { PageEntryGate } from "./components/states/PageEntryGate";
import {
  hasAnyRole,
  resolveHomePath,
  ROLE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from "./app/roleAccess";
import { useMe } from "./api/hooks";

function HomeRedirect() {
  const { data } = useMe();
  return <Navigate to={resolveHomePath(data)} replace />;
}

function RecruitsHistoryRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", "historico");
  return <Navigate to={`/gsd-recruits?${params.toString()}`} replace />;
}

function BusinessIntelligenceLegacyRedirect(props: { tab: string }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", props.tab);
  return <Navigate to={`/dashboard/bi?${params.toString()}`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/2fa-setup" element={<TwoFactorSetupPage />} />
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
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "dashboard", "view", "NATIONAL")
                      }
                    >
                      <DashboardNationalPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/national"
                  element={<Navigate to="/dashboard/smif" replace />}
                />
                <Route
                  path="/dashboard/cipavd"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "dashboard", "view") &&
                        (Boolean(user?.executive_hide_pii) ||
                          can(user, "roles", "view"))
                      }
                    >
                      <DashboardExecutivePage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/executive"
                  element={<Navigate to="/dashboard/cipavd" replace />}
                />
                <Route
                  path="/dashboard/cpca"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "cpca_dashboard", "view")}
                    >
                      <CpcaStatsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/bi"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "bi", "view")}
                    >
                      <BusinessIntelligencePage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/bi-violencia-domestica"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "bi", "view")}
                    >
                      <BusinessIntelligenceLegacyRedirect tab="domestic-violence" />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/bi-recrutas"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "bi", "view") &&
                        hasAnyRole(user, [ROLE_TI, ROLE_COMGEP])
                      }
                    >
                      <BusinessIntelligenceLegacyRedirect tab="recruits" />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/bi-ciclo-boas-praticas"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "bi", "view")}
                    >
                      <BusinessIntelligenceLegacyRedirect tab="best-practices-cycle" />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/bi-encontro-cpca"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "bi", "view")}
                    >
                      <BusinessIntelligenceLegacyRedirect tab="cpca-meeting" />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/bi-avaliacao-gsd"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "bi", "view")}
                    >
                      <BusinessIntelligenceLegacyRedirect tab="gsd-evaluation" />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/comgep"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "strategic_dashboard", "view")}
                    >
                      <ComgepSituationRoomPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/estrategico"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "strategic_dashboard", "view")}
                    >
                      <StrategicDashboardPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/ai"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "ai", "view")}
                    >
                      <AiPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/manual-cipavd"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        hasAnyRole(user, [
                          ROLE_TI,
                          ROLE_COMGEP,
                          ROLE_COORDENACAO_CIPAVD,
                        ])
                      }
                    >
                      <ManualCipavdPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/dashboard/locality/:id"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "dashboard", "view") ||
                        can(user, "localities", "view")
                      }
                    >
                      <DashboardLocalityPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "task_instances", "view")}
                    >
                      <TasksPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/smif-complaints"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "smif_complaints", "view")}
                    >
                      <SmifComplaintsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-cases"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "cpca_cases", "view")}
                    >
                      <CpcaCasesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-ai"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "ai", "view") &&
                        can(user, "cpca_cases", "view", "NATIONAL")
                      }
                    >
                      <Navigate to="/ai?tab=cpca" replace />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-commission"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "cpca_cases", "view")}
                    >
                      <CpcaCommissionPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-checklist"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "cpca_checklist", "view") &&
                        hasAnyRole(user, [
                          ROLE_TI,
                          ROLE_COMGEP,
                          ROLE_COORDENACAO_CIPAVD,
                        ])
                      }
                    >
                      <CpcaChecklistPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-president-approvals"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "cpca_cases", "view") &&
                        hasAnyRole(user, [ROLE_TI, ROLE_COMGEP])
                      }
                    >
                      <CpcaPresidentApprovalsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cpca-stats"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "cpca_dashboard", "view")}
                    >
                      <CpcaStatsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/missions"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "missions", "view")}
                    >
                      <MissionsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/activities"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "task_instances", "view")}
                    >
                      <ActivitiesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/activities-cipavd"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "task_instances", "view")}
                    >
                      <ActivitiesPage scope="cipavd" />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/cipavd-reports"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "cipavd_reports", "view") &&
                        hasAnyRole(user, [ROLE_TI, ROLE_COMGEP])
                      }
                    >
                      <PageEntryGate
                        title="Carregando Acervo"
                        description="Preparando pastas e arquivos do acervo CIPAVD."
                      >
                        <CipavdReportsPage />
                      </PageEntryGate>
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/gantt"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "gantt", "view")}
                    >
                      <GanttPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "calendar", "view")}
                    >
                      <CalendarPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/meetings"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "meetings", "view")}
                    >
                      <MeetingsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/gsd-recruits"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "localities", "view") ||
                        can(user, "dashboard", "view")
                      }
                    >
                      <GsdRecruitsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/recruits-history"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "localities", "view") ||
                        can(user, "dashboard", "view")
                      }
                    >
                      <RecruitsHistoryRedirect />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/notices"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "notices", "view")}
                    >
                      <NoticesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/checklists"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "checklists", "view")}
                    >
                      <ChecklistsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/templates"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "task_templates", "view")}
                    >
                      <TaskTemplatesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/social-communication"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "social_communication", "view")
                      }
                    >
                      <PageEntryGate
                        title="Carregando Impacto Positivo"
                        description="Preparando matérias, destaques institucionais e filtros da comunicação."
                      >
                        <SocialCommunicationPage />
                      </PageEntryGate>
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/best-practices"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "best_practices", "view")}
                    >
                      <BestPracticesPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/library"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "library", "view")}
                    >
                      <PageEntryGate
                        title="Carregando Biblioteca"
                        description="Preparando galeria, documentos e relatórios institucionais da biblioteca."
                      >
                        <LibraryPage />
                      </PageEntryGate>
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/lessons-learned"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "lessons_learned", "view")}
                    >
                      <LessonsLearnedPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "documents", "view")}
                    >
                      <DocumentsPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/elos"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "elos", "view")}
                    >
                      <ElosPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/org-chart"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "org_chart", "view")}
                    >
                      <OrgChartPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/audit"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "audit_logs", "view")}
                    >
                      <AuditPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/admin/rbac"
                  element={
                    <RequireRoleAccess
                      allow={(user) =>
                        can(user, "users", "view") ||
                        can(user, "roles", "view") ||
                        can(user, "roles", "permissions")
                      }
                    >
                      <AdminRbacPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireRoleAccess
                      allow={(user) => canAccessAdminCatalog(user)}
                    >
                      <AdminPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/admin/localities"
                  element={<Navigate to="/admin?tab=localities" replace />}
                />
                <Route
                  path="/admin/localidades"
                  element={<Navigate to="/admin?tab=localities" replace />}
                />
                <Route
                  path="/admin/localities-cipavd"
                  element={
                    <Navigate to="/admin?tab=localities-cipavd" replace />
                  }
                />
                <Route
                  path="/admin/localidades-cipavd"
                  element={
                    <Navigate to="/admin?tab=localities-cipavd" replace />
                  }
                />
                <Route
                  path="/admin/postos"
                  element={<Navigate to="/admin?tab=postos" replace />}
                />
                <Route
                  path="/admin/phases"
                  element={<Navigate to="/admin?tab=phases" replace />}
                />
                <Route
                  path="/admin/elo-roles"
                  element={<Navigate to="/admin?tab=elo-roles" replace />}
                />
                <Route
                  path="/cpca-coverage"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "cpca_coverage", "view")}
                    >
                      <OmsAdminPage />
                    </RequireRoleAccess>
                  }
                />
                <Route
                  path="/admin/oms"
                  element={
                    <RequireRoleAccess
                      allow={(user) => can(user, "cpca_coverage", "view")}
                    >
                      <Navigate to="/cpca-coverage" replace />
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
