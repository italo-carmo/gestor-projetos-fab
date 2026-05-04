export const qk = {
  me: ["auth", "me"] as const,
  myFabProfile: ["auth", "me", "fab-profile"] as const,
  sigpesPhoto: (numeroOrdem: string) =>
    ["auth", "sigpesPhoto", numeroOrdem] as const,
  tasks: (filters: Record<string, any>) => ["tasks", filters] as const,
  taskAssignees: (localityId: string) => ["taskAssignees", localityId] as const,
  taskComments: (taskId: string) => ["taskComments", taskId] as const,
  activityComments: (activityId: string) =>
    ["activityComments", activityId] as const,
  activitySchedule: (activityId: string) =>
    ["activitySchedule", activityId] as const,
  activityTypes: (scope: string) => ["activityTypes", scope] as const,
  missions: (filters: Record<string, any>) => ["missions", filters] as const,
  mission: (id: string) => ["mission", id] as const,
  missionSchedule: (missionId: string) =>
    ["missionSchedule", missionId] as const,
  missionBannerPreview: (missionId: string, bannerId: string) =>
    ["missionBannerPreview", missionId, bannerId] as const,
  missionChecklist: (missionId: string) =>
    ["missionChecklist", missionId] as const,
  missionChecklistConfig: ["missionChecklistConfig"] as const,
  missionChecklistMapping: (filters: Record<string, any>) =>
    ["missionChecklistMapping", filters] as const,
  activities: (filters: Record<string, any>) =>
    ["activities", filters] as const,
  activity: (id: string) => ["activity", id] as const,
  task: (id: string) => ["task", id] as const,
  gantt: (filters: Record<string, any>) => ["gantt", filters] as const,
  calendarYear: (year: number, filters: Record<string, any>) =>
    ["calendar", year, filters] as const,
  localityProgress: (id: string) => ["localityProgress", id] as const,
  dashboardNational: (filters: Record<string, any>) =>
    ["dashboardNational", filters] as const,
  dashboardRecruits: (filters: Record<string, any>) =>
    ["dashboardRecruits", filters] as const,
  roles: ["rbac", "roles"] as const,
  permissions: ["rbac", "permissions"] as const,
  userModuleAccess: (userId: string) =>
    ["rbac", "userModuleAccess", userId] as const,
  taskTemplates: ["taskTemplates"] as const,
  notices: (filters: Record<string, any>) => ["notices", filters] as const,
  socialCommunication: (filters: Record<string, any>) =>
    ["socialCommunication", filters] as const,
  socialCommunicationHighlights: (filters: Record<string, any>) =>
    ["socialCommunicationHighlights", filters] as const,
  bestPractices: (filters: Record<string, any>) =>
    ["bestPractices", filters] as const,
  lessonsLearned: (filters: Record<string, any>) =>
    ["lessonsLearned", filters] as const,
  lessonLearnedTypes: ["lessonLearnedTypes"] as const,
  library: (filters: Record<string, any>) => ["library", filters] as const,
  meetings: (filters: Record<string, any>) => ["meetings", filters] as const,
  checklists: (filters: Record<string, any>) =>
    ["checklists", filters] as const,
  elos: (filters: Record<string, any>) => ["elos", filters] as const,
  orgChart: (filters: Record<string, any>) => ["orgChart", filters] as const,
  orgChartCommissionMembers: (filters: Record<string, any>) =>
    ["orgChart", "commissionMembers", filters] as const,
  orgChartCommissionCandidates: (filters: Record<string, any>) =>
    ["orgChart", "commissionCandidates", filters] as const,
  auditLogs: (filters: Record<string, any>) => ["auditLogs", filters] as const,
  auditLastLogins: ["auditLogs", "lastLogins"] as const,
  menuUpdates: (menuKeys: string[]) => ["menuUpdates", menuKeys] as const,
  localities: ["localities"] as const,
  oms: ["oms"] as const,
  cipavdLocalities: ["cipavdLocalities"] as const,
  cipavdLocalitiesCatalog: ["cipavdLocalitiesCatalog"] as const,
  omsCatalog: ["omsCatalog"] as const,
  recruitDesignations: (localityId: string) =>
    ["recruitDesignations", localityId] as const,
  specialties: ["specialties"] as const,
  eloRoles: ["eloRoles"] as const,
  postos: ["postos"] as const,
  postosOptions: ["postos", "options"] as const,
  search: (q: string) => ["search", q] as const,
  documents: (filters: Record<string, any>) => ["documents", filters] as const,
  documentSubcategories: (filters: Record<string, any>) =>
    ["documents", "subcategories", filters] as const,
  documentCoverage: ["documents", "coverage"] as const,
  documentContent: (id: string) => ["documents", id, "content"] as const,
  documentLinks: (filters: Record<string, any>) =>
    ["documents", "links", filters] as const,
  documentLinkCandidates: (filters: Record<string, any>) =>
    ["documents", "link-candidates", filters] as const,
  executiveDashboard: (filters: Record<string, any>) =>
    ["dashboardExecutive", filters] as const,
  comgepSituationRoom: ["strategic", "comgepRoom"] as const,
  comgepRecommendations: (limit: number) =>
    ["strategic", "comgepRecommendations", limit] as const,
  kpiDashboard: (filters: Record<string, any>) =>
    ["kpiDashboard", filters] as const,
  biSurveyDashboard: (filters: Record<string, any>) =>
    ["biSurvey", "dashboard", filters] as const,
  biSurveyResponses: (filters: Record<string, any>) =>
    ["biSurvey", "responses", filters] as const,
  biSurveyImports: (filters: Record<string, any>) =>
    ["biSurvey", "imports", filters] as const,
  biSurveyQuestions: (filters: Record<string, any>) =>
    ["biSurvey", "questions", filters] as const,
  biSurveyCardSettings: () => ["biSurvey", "cardSettings"] as const,
  biDomesticViolenceDashboard: (filters: Record<string, any>) =>
    ["biDomesticViolence", "dashboard", filters] as const,
  biDomesticViolenceResponses: (filters: Record<string, any>) =>
    ["biDomesticViolence", "responses", filters] as const,
  biDomesticViolenceImports: (filters: Record<string, any>) =>
    ["biDomesticViolence", "imports", filters] as const,
  biDomesticViolenceCardSettings: () =>
    ["biDomesticViolence", "cardSettings"] as const,
  biRecruitsDashboard: (filters: Record<string, any>) =>
    ["biRecruits", "dashboard", filters] as const,
  biRecruitsResponses: (filters: Record<string, any>) =>
    ["biRecruits", "responses", filters] as const,
  biRecruitsImports: (filters: Record<string, any>) =>
    ["biRecruits", "imports", filters] as const,
  biRecruitsCardSettings: () => ["biRecruits", "cardSettings"] as const,
  biBestPracticesCycleDashboard: (filters: Record<string, any>) =>
    ["biBestPracticesCycle", "dashboard", filters] as const,
  biBestPracticesCycleResponses: (filters: Record<string, any>) =>
    ["biBestPracticesCycle", "responses", filters] as const,
  biBestPracticesCycleImports: (filters: Record<string, any>) =>
    ["biBestPracticesCycle", "imports", filters] as const,
  biBestPracticesCycleCardSettings: () =>
    ["biBestPracticesCycle", "cardSettings"] as const,
  biCpcaMeetingDashboard: (filters: Record<string, any>) =>
    ["biCpcaMeeting", "dashboard", filters] as const,
  biCpcaMeetingResponses: (filters: Record<string, any>) =>
    ["biCpcaMeeting", "responses", filters] as const,
  biCpcaMeetingImports: (filters: Record<string, any>) =>
    ["biCpcaMeeting", "imports", filters] as const,
  biCpcaMeetingCardSettings: () => ["biCpcaMeeting", "cardSettings"] as const,
  biGsdEvaluationDashboard: (filters: Record<string, any>) =>
    ["biGsdEvaluation", "dashboard", filters] as const,
  biGsdEvaluationResponses: (filters: Record<string, any>) =>
    ["biGsdEvaluation", "responses", filters] as const,
  biGsdEvaluationImports: (filters: Record<string, any>) =>
    ["biGsdEvaluation", "imports", filters] as const,
  biGsdEvaluationCardSettings: () =>
    ["biGsdEvaluation", "cardSettings"] as const,
  cpcaCases: (filters: Record<string, any>) => ["cpcaCases", filters] as const,
  cpcaCaseLocalityOptions: () => ["cpcaCases", "localityOptions"] as const,
  cpcaCase: (id: string) => ["cpcaCase", id] as const,
  cpcaCaseStats: (filters: Record<string, any>) =>
    ["cpcaCaseStats", filters] as const,
  cpcaCasePendingSummary: (filters: Record<string, any>) =>
    ["cpcaCasePendingSummary", filters] as const,
  cpcaCommissionOverview: (localityId: string) =>
    ["cpcaCommission", "overview", localityId] as const,
  cpcaChecklistLocality: (localityId: string) =>
    ["cpcaChecklist", "locality", localityId] as const,
  cpcaChecklistNational: (filters: Record<string, any>) =>
    ["cpcaChecklist", "national", filters] as const,
  cpcaPresidentRequests: (filters: Record<string, any>) =>
    ["cpcaCommission", "presidentRequests", filters] as const,
  cpcaPresidentRequestsPendingCount: () =>
    ["cpcaCommission", "presidentRequests", "pendingCount"] as const,
  cpcaSelfRegistrationLocalities: () =>
    ["cpcaCommission", "selfRegistration", "localities"] as const,
  smifComplaints: (filters: Record<string, any>) =>
    ["smifComplaints", filters] as const,
  smifComplaintCase: (id: string) => ["smifComplaintCase", id] as const,
  smifComplaintPendingSummary: (filters: Record<string, any>) =>
    ["smifComplaintPendingSummary", filters] as const,
  knowledgeBases: ["admin", "knowledgeBases"] as const,
  knowledgeBasesSelectable: ["admin", "knowledgeBases", "selectable"] as const,
  knowledgeBaseDocuments: (knowledgeBaseId: string) =>
    ["admin", "knowledgeBases", knowledgeBaseId, "documents"] as const,
  aiSettings: ["admin", "aiSettings"] as const,
  emailSettings: ["admin", "emailSettings"] as const,
  comgepSettings: ["admin", "comgepSettings"] as const,
  biNormalizationOverview: ["bi", "normalization", "overview"] as const,
  biNormalizationReview: (sourceType?: string | null) =>
    ["bi", "normalization", "review", sourceType ?? "all"] as const,
  aiActionAgents: ["ai", "actionAgents"] as const,
};
