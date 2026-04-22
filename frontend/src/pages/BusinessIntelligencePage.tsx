import { useEffect, useMemo, type ReactElement } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GradingRoundedIcon from "@mui/icons-material/GradingRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import { alpha } from "@mui/material/styles";
import { useSearchParams } from "react-router-dom";
import { useMe } from "../api/hooks";
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from "../app/roleAccess";
import {
  DEFAULT_BUSINESS_INTELLIGENCE_TAB,
  type BusinessIntelligenceTabKey,
  getBusinessIntelligenceTabs,
  resolveBusinessIntelligenceTab,
} from "../features/businessIntelligence";
import { BiBestPracticesCycleDashboardPage } from "./BiBestPracticesCycleDashboardPage";
import { BiCpcaMeetingDashboardPage } from "./BiCpcaMeetingDashboardPage";
import { BiDomesticViolenceDashboardPage } from "./BiDomesticViolenceDashboardPage";
import { BiGsdEvaluationDashboardPage } from "./BiGsdEvaluationDashboardPage";
import { BiRecruitsDashboardPage } from "./BiRecruitsDashboardPage";
import { BiSurveyDashboardPage } from "./BiSurveyDashboardPage";

const TAB_ICONS: Record<BusinessIntelligenceTabKey, ReactElement> = {
  "domestic-violence": <SecurityRoundedIcon fontSize="small" />,
  schools: <SchoolRoundedIcon fontSize="small" />,
  recruits: <GroupAddRoundedIcon fontSize="small" />,
  "best-practices-cycle": <AutorenewRoundedIcon fontSize="small" />,
  "cpca-meeting": <ForumRoundedIcon fontSize="small" />,
  "gsd-evaluation": <GradingRoundedIcon fontSize="small" />,
};

function renderBusinessIntelligenceTab(tab: BusinessIntelligenceTabKey) {
  switch (tab) {
    case "schools":
      return <BiSurveyDashboardPage />;
    case "recruits":
      return <BiRecruitsDashboardPage />;
    case "best-practices-cycle":
      return <BiBestPracticesCycleDashboardPage />;
    case "cpca-meeting":
      return <BiCpcaMeetingDashboardPage />;
    case "gsd-evaluation":
      return <BiGsdEvaluationDashboardPage />;
    case "domestic-violence":
    default:
      return <BiDomesticViolenceDashboardPage />;
  }
}

export function BusinessIntelligencePage() {
  const { data: me } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const canAccessRestrictedTabs = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);
  const availableTabs = useMemo(
    () => getBusinessIntelligenceTabs(canAccessRestrictedTabs),
    [canAccessRestrictedTabs],
  );
  const requestedTab = String(
    searchParams.get("tab") ?? DEFAULT_BUSINESS_INTELLIGENCE_TAB,
  ).trim();
  const activeTab = resolveBusinessIntelligenceTab(
    requestedTab,
    canAccessRestrictedTabs,
  );

  useEffect(() => {
    if (requestedTab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, requestedTab, searchParams, setSearchParams]);

  return (
    <Box>
      <Card
        sx={{
          mb: 2.2,
          borderRadius: 4,
          border: "1px solid",
          borderColor: alpha("#1E4F91", 0.16),
          background:
            "linear-gradient(135deg, rgba(30,79,145,0.10), rgba(15,23,42,0.03))",
          boxShadow: "0 20px 46px rgba(15, 23, 42, 0.08)",
        }}
      >
        <CardContent sx={{ pb: "18px !important" }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", lg: "center" }}
              gap={1.2}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BarChartRoundedIcon sx={{ color: "#1E4F91" }} />
                  <Typography variant="overline" sx={{ letterSpacing: 1.2 }}>
                    Análise consolidada
                  </Typography>
                </Stack>
                <Typography variant="h5" fontWeight={800}>
                  Business Intelligence
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mt: 0.4 }}
                >
                  Os painéis de pesquisa agora ficam centralizados em abas, com
                  navegação mais limpa e acesso rápido por contexto.
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${availableTabs.length} painéis disponíveis`}
                sx={{
                  bgcolor: alpha("#1E4F91", 0.1),
                  color: "#1E4F91",
                  fontWeight: 700,
                }}
              />
            </Stack>

            <Tabs
              value={activeTab}
              onChange={(_event, nextTab: BusinessIntelligenceTabKey) => {
                const next = new URLSearchParams(searchParams);
                next.set("tab", nextTab);
                setSearchParams(next);
              }}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 52,
                "& .MuiTabs-indicator": {
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: "#1E4F91",
                },
              }}
            >
              {availableTabs.map((tab) => (
                <Tab
                  key={tab.key}
                  value={tab.key}
                  icon={TAB_ICONS[tab.key]}
                  iconPosition="start"
                  label={tab.label}
                  sx={{
                    minHeight: 52,
                    alignItems: "center",
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    minWidth: "fit-content",
                  }}
                />
              ))}
            </Tabs>
          </Stack>
        </CardContent>
      </Card>

      {renderBusinessIntelligenceTab(activeTab)}
    </Box>
  );
}
