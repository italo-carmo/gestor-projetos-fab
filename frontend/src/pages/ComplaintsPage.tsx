import { Tab, Tabs } from "@mui/material";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMe } from "../api/hooks";
import { can } from "../app/rbac";
import {
  buildComplaintWorkflowParams,
  resolveComplaintWorkflow,
  setComplaintWorkflowParam,
  type ComplaintWorkflow,
} from "../features/complaintsNavigation";
import { CpcaCasesPage } from "./CpcaCasesPage";

export function ComplaintsPage() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const canViewCpca = can(me, "cpca_cases", "view");
  const canViewSmif = can(me, "smif_complaints", "view");
  const workflow = resolveComplaintWorkflow({
    requestedScope: params.get("scope"),
    canViewCpca,
    canViewSmif,
  });

  useEffect(() => {
    const expectedScope = workflow === "SMIF" ? "SMIF" : null;
    if (params.get("scope") === expectedScope) return;
    setParams(setComplaintWorkflowParam(params, workflow), { replace: true });
  }, [params, setParams, workflow]);

  const handleWorkflowChange = (_event: unknown, value: ComplaintWorkflow) => {
    if (value === "CPCA" && !canViewCpca) return;
    if (value === "SMIF" && !canViewSmif) return;
    setParams(buildComplaintWorkflowParams(params, value), { replace: true });
  };

  const workflowNavigation = (
    <Tabs value={workflow} onChange={handleWorkflowChange} sx={{ mb: 2 }}>
      <Tab value="CPCA" label="CPCA" disabled={!canViewCpca} />
      <Tab value="SMIF" label="SMIF" disabled={!canViewSmif} />
    </Tabs>
  );

  return (
    <CpcaCasesPage
      key={workflow}
      workflow={workflow}
      workflowNavigation={workflowNavigation}
    />
  );
}
