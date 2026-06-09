import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAddCpcaCommissionMember,
  useAssignCpcaPresident,
  useCpcaCasePendingSummary,
  useCpcaChecklistLocality,
  useCpcaCommissionOverview,
  useCreateCpcaPresidentNominationRequest,
  useMe,
  useOmsCatalog,
  useRemoveCpcaCommissionMember,
  useSmifComplaintPendingSummary,
  useUpdateCpcaChecklist,
  useUpdateCpcaCommissionCoverage,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { can } from "../app/rbac";
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from "../app/roleAccess";
import { useToast } from "../app/toast";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { SkeletonState } from "../components/states/SkeletonState";
import {
  areCpcaChecklistDraftsEqual,
  buildCpcaChecklistDraft,
  buildCpcaChecklistDraftSummary,
  formatCpcaChecklistDate,
  getCpcaChecklistStatusTone,
  getCpcaChecklistFieldConfig,
  isCpcaChecklistDraftItemComplete,
  isCpcaChecklistBinaryQuestionItem,
  isCpcaChecklistHistoryItem,
  type CpcaChecklistDraftItem,
  type CpcaChecklistHistoryEntryDraft as ChecklistHistoryEntryDraft,
  type CpcaChecklistItem,
  type CpcaChecklistItemKey,
  type CpcaChecklistSummary,
  applyCpcaChecklistHistoryEntriesToDraftItem,
  prepareCpcaChecklistSave,
} from "../features/cpcaChecklist";
import {
  getComplaintPendencyBadge,
  sortComplaintPendingItems,
} from "../features/cpcaCipavdThreads";

type OmsCatalogItem = {
  id: string;
  code: string;
  name: string;
  hasCpca?: boolean;
  uf?: string | null;
};

type CommissionMemberItem = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    ldapUid?: string | null;
  };
  addedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type CommissionHistoryItem = {
  id: string;
  action: string;
  actionLabel: string;
  summary: string;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
};

type CoverageRequestItem = {
  id: string;
  status: string;
  createdAt: string;
  requestedByUser?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  requestedManagedLocalities?: OmsCatalogItem[];
};

type NominationRequestItem = {
  id: string;
  status: string;
  createdAt: string;
  requestedByUser?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  nominee?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  bulletinNumber?: string | null;
  requestedAsSubstitution?: boolean;
};

type ChecklistLocalityResponse = {
  locality: { id: string; code: string; name: string };
  checklist: {
    summary: CpcaChecklistSummary;
    items: CpcaChecklistItem[];
  };
  canEdit: boolean;
  userIsPresident: boolean;
};

type CommissionTab =
  | "resumo"
  | "checklist"
  | "cobertura"
  | "membros"
  | "pendencias"
  | "presidencia"
  | "historico";

function extractReason(error: unknown) {
  const responseData = (
    error as { response?: { data?: { details?: { reason?: string } } } }
  )?.response?.data;
  return String(responseData?.details?.reason ?? "").trim();
}

function formatOmLabel(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  const codeValue = String(code ?? "").trim();
  const nameValue = String(name ?? "").trim();
  if (codeValue && nameValue) {
    if (
      codeValue.localeCompare(nameValue, "pt-BR", { sensitivity: "base" }) === 0
    ) {
      return codeValue;
    }
    return `${codeValue} - ${nameValue}`;
  }
  return codeValue || nameValue;
}

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function createEmptyChecklistHistoryEntryDraft(): ChecklistHistoryEntryDraft {
  return {
    completedAt: "",
    details: "",
    speakerName: "",
  };
}

function resolveChecklistIcon(itemKey: CpcaChecklistItemKey) {
  if (itemKey === "EMAIL_DIRETO_RELATOS") {
    return <MailOutlineRoundedIcon fontSize="small" />;
  }
  if (itemKey === "LINK_INTRAER_CPCA") {
    return <LinkRoundedIcon fontSize="small" />;
  }
  if (itemKey === "PALESTRA") return <CampaignRoundedIcon fontSize="small" />;
  if (itemKey === "SEMINARIO_EVENTO") {
    return <EventAvailableRoundedIcon fontSize="small" />;
  }
  if (itemKey === "MATERIAIS_INFORMATIVOS") {
    return <DescriptionRoundedIcon fontSize="small" />;
  }
  if (itemKey === "COMPARTILHAMENTO_APLICATIVOS_MENSAGEM") {
    return <ShareRoundedIcon fontSize="small" />;
  }
  if (itemKey === "POP_US") return <TouchAppRoundedIcon fontSize="small" />;
  return <GroupRoundedIcon fontSize="small" />;
}

export function CpcaCommissionPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const isApprover = hasAnyRole(me, [ROLE_TI, ROLE_COMGEP]);
  const ownLocalityId = String(me?.omId ?? "").trim();
  const omsCatalogQuery = useOmsCatalog(isApprover);

  const cpcaLocalities = useMemo(
    () =>
      ((omsCatalogQuery.data?.items ?? []) as OmsCatalogItem[])
        .filter((item) => Boolean(item.hasCpca))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [omsCatalogQuery.data?.items],
  );

  const [selectedLocalityId, setSelectedLocalityId] = useState("");
  const [presidentIdentifier, setPresidentIdentifier] = useState("");
  const [presidentBulletin, setPresidentBulletin] = useState("");
  const [presidentIsSubstitution, setPresidentIsSubstitution] = useState(true);
  const [nominationIdentifier, setNominationIdentifier] = useState("");
  const [nominationBulletin, setNominationBulletin] = useState("");
  const [nominationIsSubstitution, setNominationIsSubstitution] =
    useState(true);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [managedLocalityIds, setManagedLocalityIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<CommissionTab>("resumo");
  const [pendingPresidentOverwrite, setPendingPresidentOverwrite] = useState<{
    identifier: string;
    localityId: string;
    isSubstitution: boolean;
    designationBulletin: string;
  } | null>(null);
  const [memberToRemove, setMemberToRemove] =
    useState<CommissionMemberItem | null>(null);

  useEffect(() => {
    if (!isApprover) {
      setSelectedLocalityId("");
      return;
    }
  }, [isApprover]);

  useEffect(() => {
    if (isApprover) {
      if (
        selectedLocalityId &&
        cpcaLocalities.some((item) => item.id === selectedLocalityId)
      ) {
        return;
      }

      if (
        ownLocalityId &&
        cpcaLocalities.some((item) => item.id === ownLocalityId)
      ) {
        setSelectedLocalityId(ownLocalityId);
        return;
      }

      if (cpcaLocalities.length > 0) {
        setSelectedLocalityId(cpcaLocalities[0].id);
      }
      return;
    }

    if (ownLocalityId) {
      setSelectedLocalityId(ownLocalityId);
    }
  }, [cpcaLocalities, isApprover, me?.omId, ownLocalityId, selectedLocalityId]);

  const overviewQuery = useCpcaCommissionOverview(
    isApprover ? selectedLocalityId : undefined,
    Boolean(me?.id),
  );
  const overviewLocalityId = String(
    (overviewQuery.data as any)?.locality?.id ?? "",
  ).trim();
  const checklistLocalityId = String(
    isApprover ? selectedLocalityId : overviewLocalityId,
  ).trim();
  const checklistQuery = useCpcaChecklistLocality(
    checklistLocalityId,
    Boolean(me?.id) && Boolean(checklistLocalityId),
  );
  const cpcaPendingSummaryQuery = useCpcaCasePendingSummary(
    {
      localityId: checklistLocalityId || undefined,
      pageSize: "all",
    },
    Boolean(me?.id) && Boolean(checklistLocalityId),
  );
  const smifPendingSummaryQuery = useSmifComplaintPendingSummary(
    {
      localityId: checklistLocalityId || undefined,
      pageSize: "all",
    },
    Boolean(me?.id) &&
      Boolean(checklistLocalityId) &&
      can(me, "smif_complaints", "view"),
  );

  const assignPresidentMutation = useAssignCpcaPresident();
  const createNominationMutation = useCreateCpcaPresidentNominationRequest();
  const addMemberMutation = useAddCpcaCommissionMember();
  const removeMemberMutation = useRemoveCpcaCommissionMember();
  const updateCoverageMutation = useUpdateCpcaCommissionCoverage();
  const updateChecklistMutation = useUpdateCpcaChecklist();

  const [checklistDraft, setChecklistDraft] = useState<
    CpcaChecklistDraftItem[]
  >([]);
  const [checklistHistoryEntryDrafts, setChecklistHistoryEntryDrafts] =
    useState<Record<string, ChecklistHistoryEntryDraft>>({});
  const [checklistDraftLocalityId, setChecklistDraftLocalityId] = useState("");
  const [checklistAppliedVersion, setChecklistAppliedVersion] = useState("");

  const canManageMembers = Boolean(overviewQuery.data?.canManageMembers);
  const canAssignPresident = Boolean(overviewQuery.data?.canAssignPresident);
  const canNominatePresident = Boolean(
    overviewQuery.data?.canNominatePresident,
  );
  const canManagePresidentFlow = canAssignPresident || canNominatePresident;
  const canManageCoverage = Boolean(overviewQuery.data?.canManageCoverage);
  const managesCoverageByApproval = Boolean(
    overviewQuery.data?.managesCoverageByApproval,
  );
  const currentPresident = overviewQuery.data?.currentPresident as
    | {
        id: string;
        designationBulletin?: string | null;
        isSubstitution: boolean;
        assignedAt: string;
        assignmentSource?: string | null;
        assignmentSourceLabel?: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          ldapUid?: string | null;
        };
        assignedByUser?: { id: string; name: string; email: string } | null;
      }
    | null
    | undefined;
  const members = (overviewQuery.data?.members ?? []) as CommissionMemberItem[];
  const locality = overviewQuery.data?.locality as
    | { id: string; code: string; name: string }
    | null
    | undefined;
  const managedLocalities = (
    (overviewQuery.data?.managedLocalities ?? []) as OmsCatalogItem[]
  ).sort((a, b) =>
    formatOmLabel(a.code, a.name).localeCompare(
      formatOmLabel(b.code, b.name),
      "pt-BR",
    ),
  );
  const availableManagedLocalities = (
    (overviewQuery.data?.availableManagedLocalities ?? []) as OmsCatalogItem[]
  ).sort((a, b) =>
    formatOmLabel(a.code, a.name).localeCompare(
      formatOmLabel(b.code, b.name),
      "pt-BR",
    ),
  );
  const pendingCoverageRequest =
    (overviewQuery.data?.pendingCoverageRequest as
      | CoverageRequestItem
      | null
      | undefined) ?? null;
  const pendingPresidentNominationRequest =
    (overviewQuery.data?.pendingPresidentNominationRequest as
      | NominationRequestItem
      | null
      | undefined) ?? null;
  const history =
    (overviewQuery.data?.history as CommissionHistoryItem[] | undefined) ?? [];
  const checklistData = checklistQuery.data as
    | ChecklistLocalityResponse
    | undefined;
  const checklistSummary = checklistData?.checklist?.summary;
  const checklistItems = (checklistData?.checklist?.items ??
    []) as CpcaChecklistItem[];
  const canEditChecklist = Boolean(checklistData?.canEdit);
  const checklistVersion = String(
    checklistSummary?.lastUpdatedAt ??
      checklistSummary?.lastCompletedAt ??
      "empty",
  );

  useEffect(() => {
    if (isApprover) return;
    const resolvedLocalityId = String(locality?.id ?? ownLocalityId).trim();
    if (!resolvedLocalityId) return;
    if (resolvedLocalityId !== selectedLocalityId) {
      setSelectedLocalityId(resolvedLocalityId);
    }
  }, [isApprover, locality?.id, ownLocalityId, selectedLocalityId]);

  useEffect(() => {
    if (activeTab === "presidencia" && !canManagePresidentFlow) {
      setActiveTab("resumo");
    }
  }, [activeTab, canManagePresidentFlow]);

  useEffect(() => {
    setManagedLocalityIds(managedLocalities.map((item) => item.id));
  }, [locality?.id, managedLocalities]);

  useEffect(() => {
    if (!checklistLocalityId) return;
    if (
      checklistDraftLocalityId === checklistLocalityId &&
      checklistAppliedVersion === checklistVersion
    ) {
      return;
    }

    const nextDraft = buildCpcaChecklistDraft(checklistItems);
    setChecklistDraft(nextDraft);
    setChecklistHistoryEntryDrafts({});
    setChecklistDraftLocalityId(checklistLocalityId);
    setChecklistAppliedVersion(checklistVersion);
  }, [
    checklistAppliedVersion,
    checklistDraftLocalityId,
    checklistItems,
    checklistLocalityId,
    checklistVersion,
  ]);

  const selectedLocalityCode =
    locality?.code ??
    cpcaLocalities.find((item) => item.id === selectedLocalityId)?.code ??
    null;
  const selectedLocalityName =
    locality?.name ??
    cpcaLocalities.find((item) => item.id === selectedLocalityId)?.name ??
    null;
  const selectedLocalityLabel = formatOmLabel(
    selectedLocalityCode,
    selectedLocalityName,
  );
  const coveredOmCount = managedLocalityIds.length + 1;
  const checklistDirty = useMemo(() => {
    const persistedChanged = !areCpcaChecklistDraftsEqual(
      checklistDraft,
      buildCpcaChecklistDraft(checklistItems),
    );
    if (persistedChanged) return true;

    return Object.values(checklistHistoryEntryDrafts).some((draft) =>
      Boolean(
        String(draft.completedAt ?? "").trim() ||
        String(draft.details ?? "").trim() ||
        String(draft.speakerName ?? "").trim(),
      ),
    );
  }, [checklistDraft, checklistHistoryEntryDrafts, checklistItems]);
  const checklistDraftSummary = useMemo(
    () =>
      buildCpcaChecklistDraftSummary(
        checklistDraft,
        checklistHistoryEntryDrafts,
      ),
    [checklistDraft, checklistHistoryEntryDrafts],
  );
  const displayedChecklistSummary =
    checklistDraft.length > 0 ? checklistDraftSummary : checklistSummary;
  const checklistTone = getCpcaChecklistStatusTone(
    displayedChecklistSummary?.status ?? "NOT_STARTED",
  );
  const cpcaOpenPendingItems = (
    ((cpcaPendingSummaryQuery.data as any)?.openItems ?? []) as any[]
  ).map((item) => ({
    ...item,
    workflow: "CPCA",
    route: "/cpca-cases",
  }));
  const cpcaResolvedPendingItems = (
    ((cpcaPendingSummaryQuery.data as any)?.resolvedItems ?? []) as any[]
  ).map((item) => ({
    ...item,
    workflow: "CPCA",
    route: "/cpca-cases",
  }));
  const smifOpenPendingItems = (
    ((smifPendingSummaryQuery.data as any)?.openItems ?? []) as any[]
  ).map((item) => ({
    ...item,
    workflow: "SMIF",
    route: "/smif-complaints",
  }));
  const smifResolvedPendingItems = (
    ((smifPendingSummaryQuery.data as any)?.resolvedItems ?? []) as any[]
  ).map((item) => ({
    ...item,
    workflow: "SMIF",
    route: "/smif-complaints",
  }));
  const commissionOpenPendingItems = sortComplaintPendingItems([
    ...cpcaOpenPendingItems,
    ...smifOpenPendingItems,
  ]).slice(0, 8);
  const commissionResolvedPendingItems = sortComplaintPendingItems([
    ...cpcaResolvedPendingItems,
    ...smifResolvedPendingItems,
  ]).slice(0, 4);
  const commissionOpenPendingCount =
    Number(
      (cpcaPendingSummaryQuery.data as any)?.summary?.openPendingCount ?? 0,
    ) +
    Number(
      (smifPendingSummaryQuery.data as any)?.summary?.openPendingCount ?? 0,
    );
  const commissionResolvedPendingCount =
    Number(
      (cpcaPendingSummaryQuery.data as any)?.summary?.resolvedPendingCount ?? 0,
    ) +
    Number(
      (smifPendingSummaryQuery.data as any)?.summary?.resolvedPendingCount ?? 0,
    );
  const commissionPendingBadge = getComplaintPendencyBadge(
    {
      openPendingCount: commissionOpenPendingCount,
      resolvedPendingCount: commissionResolvedPendingCount,
    },
    { showResolved: true },
  );

  const handleSaveCoverage = async () => {
    const localityId = String(locality?.id ?? selectedLocalityId).trim();
    if (!localityId) {
      toast.push({
        message: "Selecione uma OM para configurar a cobertura.",
        severity: "warning",
      });
      return;
    }

    try {
      const response = await updateCoverageMutation.mutateAsync({
        localityId,
        managedLocalityIds,
      });
      toast.push({
        message:
          response?.mode === "REQUESTED"
            ? "Solicitação de cobertura enviada para homologação."
            : "Cobertura CPCA atualizada com sucesso.",
        severity: "success",
      });
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          "Erro ao atualizar a cobertura da comissão.",
        severity: "error",
      });
    }
  };

  const handleAssignPresident = async (args: {
    identifier: string;
    localityId: string;
    isSubstitution: boolean;
    designationBulletin: string;
    proceedWithExistingPresident?: boolean;
  }) => {
    try {
      await assignPresidentMutation.mutateAsync(args);
      toast.push({
        message: "Presidente CPCA designado com sucesso.",
        severity: "success",
      });
      setPresidentIdentifier("");
      setPresidentBulletin("");
      setPendingPresidentOverwrite(null);
    } catch (error) {
      const reason = extractReason(error);
      if (
        reason === "CPCA_LOCALITY_ALREADY_HAS_PRESIDENT" &&
        !args.proceedWithExistingPresident
      ) {
        setPendingPresidentOverwrite({
          identifier: args.identifier,
          localityId: args.localityId,
          isSubstitution: args.isSubstitution,
          designationBulletin: args.designationBulletin,
        });
        return;
      }
      toast.push({
        message: parseApiError(error).message ?? "Erro ao designar presidente.",
        severity: "error",
      });
    }
  };

  const handleCreateNomination = async () => {
    const identifier = nominationIdentifier.trim();
    if (!identifier) {
      toast.push({
        message: "Informe e-mail ou CPF do próximo presidente.",
        severity: "warning",
      });
      return;
    }

    try {
      await createNominationMutation.mutateAsync({
        identifier,
        localityId: isApprover ? selectedLocalityId : undefined,
        isSubstitution: nominationIsSubstitution,
        bulletinNumber: nominationBulletin.trim() || undefined,
      });
      toast.push({
        message: "Solicitação de sucessão enviada para homologação.",
        severity: "success",
      });
      setNominationIdentifier("");
      setNominationBulletin("");
    } catch (error) {
      toast.push({
        message:
          parseApiError(error).message ??
          "Erro ao solicitar sucessão de presidente.",
        severity: "error",
      });
    }
  };

  const handleAddMember = async () => {
    const identifier = memberIdentifier.trim();
    if (!identifier) {
      toast.push({
        message: "Informe e-mail ou CPF para adicionar membro.",
        severity: "warning",
      });
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        identifier,
        localityId: isApprover ? selectedLocalityId : undefined,
      });
      toast.push({
        message: "Membro adicionado à comissão CPCA.",
        severity: "success",
      });
      setMemberIdentifier("");
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao adicionar membro.",
        severity: "error",
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync(memberToRemove.id);
      toast.push({
        message: "Membro removido da comissão.",
        severity: "success",
      });
      setMemberToRemove(null);
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao remover membro.",
        severity: "error",
      });
    }
  };

  const handleChecklistFieldChange = (
    itemKey: CpcaChecklistItemKey,
    field: keyof CpcaChecklistDraftItem,
    value: string | boolean,
  ) => {
    setChecklistDraft((current) =>
      current.map((item) => {
        if (item.itemKey !== itemKey) return item;
        if (item.supportsHistory) return item;
        const nextItem = {
          ...item,
          [field]: value,
        } as CpcaChecklistDraftItem;

        if (field === "isCompleted" && value === false) {
          nextItem.completedAt = "";
          nextItem.details = "";
          nextItem.speakerName = "";
        }

        return nextItem;
      }),
    );
  };

  const handleChecklistHistoryDraftChange = (
    itemKey: CpcaChecklistItemKey,
    field: keyof ChecklistHistoryEntryDraft,
    value: string,
  ) => {
    setChecklistHistoryEntryDrafts((current) => ({
      ...current,
      [itemKey]: {
        ...(current[itemKey] ?? createEmptyChecklistHistoryEntryDraft()),
        [field]: value,
      },
    }));
  };

  const handleChecklistHistoryEntryChange = (
    itemKey: CpcaChecklistItemKey,
    entryIndex: number,
    field: keyof ChecklistHistoryEntryDraft,
    value: string,
  ) => {
    setChecklistDraft((current) =>
      current.map((item) => {
        if (item.itemKey !== itemKey || !item.supportsHistory) return item;
        const nextEntries = item.historyEntries.map((entry, index) =>
          index === entryIndex ? { ...entry, [field]: value } : entry,
        );
        return applyCpcaChecklistHistoryEntriesToDraftItem(item, nextEntries);
      }),
    );
  };

  const handleRemoveChecklistHistoryEntry = (
    itemKey: CpcaChecklistItemKey,
    entryIndex: number,
  ) => {
    setChecklistDraft((current) =>
      current.map((item) => {
        if (item.itemKey !== itemKey || !item.supportsHistory) return item;
        const nextEntries = item.historyEntries.filter(
          (_entry, index) => index !== entryIndex,
        );
        return applyCpcaChecklistHistoryEntriesToDraftItem(item, nextEntries);
      }),
    );
  };

  const clearChecklistHistoryDraft = (itemKey: CpcaChecklistItemKey) => {
    setChecklistHistoryEntryDrafts((current) => {
      if (!(itemKey in current)) return current;
      const next = { ...current };
      delete next[itemKey];
      return next;
    });
  };

  const handleAddChecklistHistoryEntry = (itemKey: CpcaChecklistItemKey) => {
    const draft =
      checklistHistoryEntryDrafts[itemKey] ??
      createEmptyChecklistHistoryEntryDraft();
    const completedAt = String(draft.completedAt ?? "").trim();
    const details = String(draft.details ?? "").trim();
    const speakerName = String(draft.speakerName ?? "").trim();

    if (!completedAt || !details) {
      toast.push({
        message: "Informe a data e a descrição do registro.",
        severity: "warning",
      });
      return;
    }
    if (itemKey === "PALESTRA" && !speakerName) {
      toast.push({
        message: "Informe quem ministrou a palestra.",
        severity: "warning",
      });
      return;
    }

    setChecklistDraft((current) =>
      current.map((item) => {
        if (item.itemKey !== itemKey) return item;
        return applyCpcaChecklistHistoryEntriesToDraftItem(item, [
          ...item.historyEntries,
          {
            id: null,
            completedAt,
            details,
            speakerName: itemKey === "PALESTRA" ? speakerName : "",
          },
        ]);
      }),
    );
    clearChecklistHistoryDraft(itemKey);
  };

  const handleResetChecklist = () => {
    const nextDraft = buildCpcaChecklistDraft(checklistItems);
    setChecklistDraft(nextDraft);
    setChecklistHistoryEntryDrafts({});
    setChecklistAppliedVersion(checklistVersion);
  };

  const handleSaveChecklist = async () => {
    if (!checklistLocalityId) {
      toast.push({
        message: "Selecione uma OM para preencher o checklist.",
        severity: "warning",
      });
      return;
    }

    try {
      const prepared = prepareCpcaChecklistSave(
        checklistDraft,
        checklistHistoryEntryDrafts,
      );
      if (!prepared.ok) {
        toast.push({
          message: prepared.message,
          severity: "warning",
        });
        return;
      }

      const response = await updateChecklistMutation.mutateAsync({
        localityId: checklistLocalityId,
        items: prepared.items,
      });
      const savedItems = (response?.checklist?.items ??
        []) as CpcaChecklistItem[];
      setChecklistDraft(buildCpcaChecklistDraft(savedItems));
      setChecklistHistoryEntryDrafts({});
      setChecklistAppliedVersion(
        String(
          response?.checklist?.summary?.lastUpdatedAt ??
            response?.checklist?.summary?.lastCompletedAt ??
            "empty",
        ),
      );
      toast.push({
        message: "Checklist da comissão salvo com sucesso.",
        severity: "success",
      });
    } catch (error) {
      const parsedError = parseApiError(error);
      const parsedMessage =
        typeof parsedError.message === "string"
          ? parsedError.message
          : undefined;
      const isGenericValidationMessage =
        parsedMessage === "Dados inválidos." || !parsedMessage;
      const fallbackMessage =
        parsedError.code === "VALIDATION_ERROR" && isGenericValidationMessage
          ? "Revise os campos do checklist. Verifique e-mail, URL, data, descrição e palestrante dos registros."
          : "Erro ao salvar o checklist da comissão.";
      const message =
        parsedError.code === "VALIDATION_ERROR" && isGenericValidationMessage
          ? fallbackMessage
          : (parsedMessage ?? fallbackMessage);
      toast.push({
        message,
        severity: "error",
      });
    }
  };

  if (
    overviewQuery.isLoading ||
    checklistQuery.isLoading ||
    (isApprover && omsCatalogQuery.isLoading)
  ) {
    return <SkeletonState />;
  }
  if (overviewQuery.isError) {
    return (
      <ErrorState
        error={overviewQuery.error}
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }
  if (checklistQuery.isError) {
    return (
      <ErrorState
        error={checklistQuery.error}
        onRetry={() => checklistQuery.refetch()}
      />
    );
  }
  if (isApprover && omsCatalogQuery.isError) {
    return (
      <ErrorState
        error={omsCatalogQuery.error}
        onRetry={() => omsCatalogQuery.refetch()}
      />
    );
  }
  if (!locality) {
    return (
      <EmptyState
        title="Nenhuma OM com CPCA habilitado"
        description="Ative 'Possui CPCA = Sim' em Administração > OMs para liberar o fluxo de comissão."
      />
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        <Card
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            boxShadow: "none",
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", lg: "flex-start" }}
              >
                <Box sx={{ maxWidth: 720 }}>
                  <Typography variant="h4" fontWeight={800}>
                    Comissão CPCA
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Operação da comissão: checklist, cobertura, membros e
                    histórico da OM selecionada.
                  </Typography>
                </Box>

                <TextField
                  select
                  label="OM"
                  size="small"
                  value={
                    isApprover
                      ? selectedLocalityId
                      : overviewLocalityId || selectedLocalityId
                  }
                  onChange={(event) => {
                    if (!isApprover) return;
                    setSelectedLocalityId(event.target.value);
                  }}
                  sx={{ minWidth: { xs: "100%", lg: 380 } }}
                  disabled={!isApprover}
                >
                  {isApprover ? (
                    cpcaLocalities.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {formatOmLabel(item.code, item.name)}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value={locality?.id ?? selectedLocalityId}>
                      {selectedLocalityLabel}
                    </MenuItem>
                  )}
                </TextField>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            boxShadow: "none",
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value as CommissionTab)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Áreas da comissão CPCA"
              sx={{
                minHeight: 52,
                px: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
                "& .MuiTab-root": {
                  minHeight: 52,
                  textTransform: "none",
                  fontWeight: 800,
                },
              }}
            >
              <Tab value="resumo" label="Resumo" />
              <Tab value="checklist" label="Checklist" />
              <Tab value="cobertura" label="Cobertura" />
              <Tab value="membros" label="Membros" />
              <Tab value="pendencias" label="Pendências" />
              {canManagePresidentFlow ? (
                <Tab value="presidencia" label="Presidência" />
              ) : null}
              <Tab value="historico" label="Histórico" />
            </Tabs>
            {activeTab === "resumo" ? (
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Visão geral da comissão
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Indicadores principais da OM selecionada.
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        xl: "repeat(4, minmax(0, 1fr))",
                      },
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        bgcolor: "background.default",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <WorkspacePremiumRoundedIcon
                          sx={{ color: "primary.main", fontSize: 20 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Presidência
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{ mt: 0.75 }}
                      >
                        {currentPresident?.user?.name ?? "Não designado"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentPresident?.designationBulletin
                          ? `Boletim ${currentPresident.designationBulletin}`
                          : "Boletim não informado"}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        bgcolor: "background.default",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Checklist
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{ mt: 0.75 }}
                      >
                        {displayedChecklistSummary?.completionRate ?? 0}%
                        concluído
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {displayedChecklistSummary?.completedCount ?? 0}/
                        {displayedChecklistSummary?.totalCount ??
                          checklistItems.length}{" "}
                        itens preenchidos
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        bgcolor: "background.default",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Comissão
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{ mt: 0.75 }}
                      >
                        {members.length} membro{members.length === 1 ? "" : "s"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {coveredOmCount} OM{coveredOmCount === 1 ? "" : "s"}{" "}
                        atendida{coveredOmCount === 1 ? "" : "s"}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        bgcolor: "background.default",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Denúncias
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{ mt: 0.75 }}
                      >
                        {commissionPendingBadge?.label ?? "Sem pendências"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Pendências da OM selecionada
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Box>
            ) : null}
          </CardContent>
        </Card>

        {activeTab === "checklist" ? (
          <Card
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "none",
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", lg: "center" }}
                >
                  <Box sx={{ maxWidth: 760 }}>
                    <Typography variant="h6" fontWeight={800}>
                      Checklist da Comissão
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Registre as ações executadas pela comissão. Cada item abre
                      individualmente para reduzir ruído e manter o
                      preenchimento focado.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={
                        displayedChecklistSummary?.statusLabel ?? "Não iniciado"
                      }
                      color={checklistTone.color}
                      sx={{
                        fontWeight: 700,
                        background: checklistTone.background,
                      }}
                    />
                    <Chip
                      label={`${displayedChecklistSummary?.completedCount ?? 0}/${displayedChecklistSummary?.totalCount ?? checklistItems.length} concluídos`}
                      variant="outlined"
                    />
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.default",
                  }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="caption" color="text.secondary">
                        Progresso do checklist
                      </Typography>
                      <Typography variant="caption" fontWeight={800}>
                        {displayedChecklistSummary?.completionRate ?? 0}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={displayedChecklistSummary?.completionRate ?? 0}
                      color={
                        checklistTone.color === "default"
                          ? "inherit"
                          : checklistTone.color
                      }
                      sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: "action.hover",
                      }}
                    />
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      sx={{ pt: 0.5 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Última ação:{" "}
                        <strong>
                          {formatCpcaChecklistDate(
                            checklistSummary?.lastUpdatedAt,
                          )}
                        </strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Última entrega:{" "}
                        <strong>
                          {formatCpcaChecklistDate(
                            checklistSummary?.lastCompletedAt,
                          )}
                        </strong>
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  {checklistItems.map((item) => {
                    const draftItem = checklistDraft.find(
                      (entry) => entry.itemKey === item.itemKey,
                    ) ?? {
                      itemKey: item.itemKey,
                      supportsHistory: isCpcaChecklistHistoryItem(item.itemKey),
                      isCompleted: Boolean(item.isCompleted),
                      completedAt: item.completedAt
                        ? item.completedAt.slice(0, 10)
                        : "",
                      details: String(item.details ?? ""),
                      speakerName: String(item.speakerName ?? ""),
                      historyEntries: Array.isArray(item.historyEntries)
                        ? item.historyEntries.map((entry) => ({
                            id: entry.id,
                            completedAt: entry.completedAt
                              ? entry.completedAt.slice(0, 10)
                              : "",
                            details: String(entry.details ?? ""),
                            speakerName: String(entry.speakerName ?? ""),
                            createdAt: entry.createdAt ?? null,
                            updatedAt: entry.updatedAt ?? null,
                          }))
                        : [],
                    };
                    const historyEntries = draftItem.historyEntries ?? [];
                    const fieldConfig = getCpcaChecklistFieldConfig(
                      item.itemKey,
                    );
                    const isBinaryQuestion = isCpcaChecklistBinaryQuestionItem(
                      item.itemKey,
                    );
                    const historyEntryDraft =
                      checklistHistoryEntryDrafts[item.itemKey] ??
                      createEmptyChecklistHistoryEntryDraft();
                    const itemCompleted = isCpcaChecklistDraftItemComplete(
                      draftItem,
                      historyEntryDraft,
                    );
                    return (
                      <Accordion
                        key={item.itemKey}
                        disableGutters
                        elevation={0}
                        slotProps={{ transition: { unmountOnExit: true } }}
                        sx={{
                          border: "1px solid",
                          borderColor: itemCompleted
                            ? "success.light"
                            : "divider",
                          borderRadius: 1.5,
                          bgcolor: "background.paper",
                          "&:before": { display: "none" },
                          "&.Mui-expanded": { margin: 0 },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreRoundedIcon />}
                          sx={{
                            minHeight: 64,
                            px: 1.5,
                            py: 0.75,
                            "& .MuiAccordionSummary-content": {
                              my: 0,
                              minWidth: 0,
                            },
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            sx={{ width: "100%", pr: 1, minWidth: 0 }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 1.5,
                                  display: "grid",
                                  placeItems: "center",
                                  bgcolor: itemCompleted
                                    ? "rgba(46,125,50,0.10)"
                                    : "action.hover",
                                  color: itemCompleted
                                    ? "success.main"
                                    : "text.secondary",
                                }}
                              >
                                {resolveChecklistIcon(item.itemKey)}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  variant="subtitle2"
                                  fontWeight={800}
                                >
                                  {item.label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {item.description}
                                </Typography>
                              </Box>
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              {draftItem.supportsHistory &&
                              historyEntries.length > 0 ? (
                                <Chip
                                  size="small"
                                  label={`${historyEntries.length} registro${historyEntries.length > 1 ? "s" : ""}`}
                                  variant="outlined"
                                />
                              ) : null}
                              {itemCompleted ? (
                                <CheckCircleRoundedIcon
                                  color="success"
                                  fontSize="small"
                                />
                              ) : (
                                <RadioButtonUncheckedRoundedIcon
                                  color="disabled"
                                  fontSize="small"
                                />
                              )}
                            </Stack>
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
                          <Stack spacing={1.25}>
                            {isBinaryQuestion ? (
                              <>
                                <Stack
                                  direction={{ xs: "column", md: "row" }}
                                  spacing={1.2}
                                  alignItems={{ xs: "stretch", md: "center" }}
                                >
                                  <TextField
                                    select
                                    label="Resposta"
                                    size="small"
                                    value={
                                      draftItem?.isCompleted
                                        ? "done"
                                        : "pending"
                                    }
                                    onChange={(event) =>
                                      handleChecklistFieldChange(
                                        item.itemKey,
                                        "isCompleted",
                                        event.target.value === "done",
                                      )
                                    }
                                    disabled={!canEditChecklist}
                                    sx={{ minWidth: { xs: "100%", md: 170 } }}
                                  >
                                    <MenuItem value="pending">
                                      {fieldConfig.statusPendingLabel}
                                    </MenuItem>
                                    <MenuItem value="done">
                                      {fieldConfig.statusDoneLabel}
                                    </MenuItem>
                                  </TextField>
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                  >
                                    <TodayRoundedIcon
                                      sx={{
                                        fontSize: 16,
                                        color: "text.secondary",
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Última atualização:{" "}
                                      {formatCpcaChecklistDate(item.updatedAt)}
                                    </Typography>
                                  </Stack>
                                </Stack>

                                <TextField
                                  label={fieldConfig.detailsLabel}
                                  size="small"
                                  multiline
                                  minRows={2}
                                  value={draftItem?.details ?? ""}
                                  onChange={(event) =>
                                    handleChecklistFieldChange(
                                      item.itemKey,
                                      "details",
                                      event.target.value,
                                    )
                                  }
                                  disabled={
                                    !canEditChecklist || !draftItem?.isCompleted
                                  }
                                  placeholder={fieldConfig.detailsPlaceholder}
                                  helperText={
                                    draftItem?.isCompleted
                                      ? fieldConfig.detailsHelperText
                                      : undefined
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <Stack
                                  direction={{ xs: "column", md: "row" }}
                                  spacing={1.2}
                                  alignItems={{ xs: "stretch", md: "center" }}
                                >
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                  >
                                    <HistoryRoundedIcon
                                      sx={{
                                        fontSize: 16,
                                        color: "text.secondary",
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Último registro:{" "}
                                      {formatCpcaChecklistDate(
                                        draftItem.completedAt,
                                      )}
                                    </Typography>
                                  </Stack>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Histórico acumulado da OM para este item.
                                  </Typography>
                                </Stack>

                                {canEditChecklist ? (
                                  <Box
                                    sx={{
                                      p: 1.5,
                                      borderRadius: 2.5,
                                      border: "1px dashed",
                                      borderColor: "rgba(25,118,210,0.24)",
                                      bgcolor: "rgba(25,118,210,0.03)",
                                    }}
                                  >
                                    <Stack spacing={1}>
                                      <Typography
                                        variant="subtitle2"
                                        fontWeight={800}
                                      >
                                        Adicionar registro
                                      </Typography>
                                      <Stack
                                        direction={{ xs: "column", md: "row" }}
                                        spacing={1}
                                      >
                                        <TextField
                                          label="Data"
                                          type="date"
                                          size="small"
                                          value={historyEntryDraft.completedAt}
                                          onChange={(event) =>
                                            handleChecklistHistoryDraftChange(
                                              item.itemKey,
                                              "completedAt",
                                              event.target.value,
                                            )
                                          }
                                          InputLabelProps={{ shrink: true }}
                                          sx={{
                                            minWidth: { xs: "100%", md: 170 },
                                          }}
                                        />
                                        {item.requiresSpeakerName ? (
                                          <TextField
                                            label="Quem ministrou a palestra"
                                            size="small"
                                            value={
                                              historyEntryDraft.speakerName
                                            }
                                            onChange={(event) =>
                                              handleChecklistHistoryDraftChange(
                                                item.itemKey,
                                                "speakerName",
                                                event.target.value,
                                              )
                                            }
                                            sx={{ flex: 1 }}
                                          />
                                        ) : null}
                                      </Stack>
                                      <TextField
                                        label={fieldConfig.detailsLabel}
                                        size="small"
                                        multiline
                                        minRows={2}
                                        value={historyEntryDraft.details}
                                        onChange={(event) =>
                                          handleChecklistHistoryDraftChange(
                                            item.itemKey,
                                            "details",
                                            event.target.value,
                                          )
                                        }
                                        placeholder={
                                          fieldConfig.detailsPlaceholder
                                        }
                                        helperText={
                                          fieldConfig.detailsHelperText ??
                                          "Cada novo registro entra no histórico da OM."
                                        }
                                      />
                                      <Box
                                        display="flex"
                                        justifyContent="flex-end"
                                      >
                                        <Button
                                          variant="contained"
                                          onClick={() =>
                                            handleAddChecklistHistoryEntry(
                                              item.itemKey,
                                            )
                                          }
                                        >
                                          Adicionar ao histórico
                                        </Button>
                                      </Box>
                                    </Stack>
                                  </Box>
                                ) : null}

                                <Stack spacing={1}>
                                  {historyEntries.length === 0 ? (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      Nenhum registro lançado para este item.
                                    </Typography>
                                  ) : (
                                    historyEntries.map((entry, index) => (
                                      <Box
                                        key={`${item.itemKey}-${entry.id ?? `draft-${index}`}`}
                                        sx={{
                                          p: 1.25,
                                          borderRadius: 2.25,
                                          border: "1px solid",
                                          borderColor: "divider",
                                          backgroundColor:
                                            index === 0
                                              ? "rgba(46,125,50,0.05)"
                                              : "rgba(15,23,42,0.02)",
                                        }}
                                      >
                                        {canEditChecklist ? (
                                          <Stack spacing={1}>
                                            <Stack
                                              direction={{
                                                xs: "column",
                                                md: "row",
                                              }}
                                              spacing={1}
                                              alignItems={{
                                                xs: "stretch",
                                                md: "center",
                                              }}
                                            >
                                              <TextField
                                                label="Data"
                                                type="date"
                                                size="small"
                                                value={entry.completedAt}
                                                onChange={(event) =>
                                                  handleChecklistHistoryEntryChange(
                                                    item.itemKey,
                                                    index,
                                                    "completedAt",
                                                    event.target.value,
                                                  )
                                                }
                                                InputLabelProps={{
                                                  shrink: true,
                                                }}
                                                sx={{
                                                  minWidth: {
                                                    xs: "100%",
                                                    md: 170,
                                                  },
                                                }}
                                              />
                                              {item.requiresSpeakerName ? (
                                                <TextField
                                                  label="Quem ministrou a palestra"
                                                  size="small"
                                                  value={entry.speakerName}
                                                  onChange={(event) =>
                                                    handleChecklistHistoryEntryChange(
                                                      item.itemKey,
                                                      index,
                                                      "speakerName",
                                                      event.target.value,
                                                    )
                                                  }
                                                  sx={{ flex: 1 }}
                                                />
                                              ) : null}
                                              <IconButton
                                                color="error"
                                                aria-label="Excluir registro"
                                                onClick={() =>
                                                  handleRemoveChecklistHistoryEntry(
                                                    item.itemKey,
                                                    index,
                                                  )
                                                }
                                              >
                                                <DeleteOutlineRoundedIcon fontSize="small" />
                                              </IconButton>
                                            </Stack>
                                            <TextField
                                              label={fieldConfig.detailsLabel}
                                              size="small"
                                              multiline
                                              minRows={2}
                                              value={entry.details}
                                              onChange={(event) =>
                                                handleChecklistHistoryEntryChange(
                                                  item.itemKey,
                                                  index,
                                                  "details",
                                                  event.target.value,
                                                )
                                              }
                                              placeholder={
                                                fieldConfig.detailsPlaceholder
                                              }
                                            />
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                            >
                                              Registrado em{" "}
                                              {formatCpcaChecklistDate(
                                                entry.updatedAt ??
                                                  entry.createdAt ??
                                                  entry.completedAt,
                                              )}
                                            </Typography>
                                          </Stack>
                                        ) : (
                                          <Stack spacing={0.5}>
                                            <Stack
                                              direction={{
                                                xs: "column",
                                                sm: "row",
                                              }}
                                              spacing={1}
                                              justifyContent="space-between"
                                            >
                                              <Typography
                                                variant="caption"
                                                fontWeight={800}
                                              >
                                                {formatCpcaChecklistDate(
                                                  entry.completedAt,
                                                )}
                                              </Typography>
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                Registrado em{" "}
                                                {formatCpcaChecklistDate(
                                                  entry.updatedAt ??
                                                    entry.createdAt ??
                                                    entry.completedAt,
                                                )}
                                              </Typography>
                                            </Stack>
                                            <Typography variant="body2">
                                              {entry.details}
                                            </Typography>
                                            {entry.speakerName ? (
                                              <Typography
                                                variant="caption"
                                                fontWeight={700}
                                              >
                                                Palestrante: {entry.speakerName}
                                              </Typography>
                                            ) : null}
                                          </Stack>
                                        )}
                                      </Box>
                                    ))
                                  )}
                                </Stack>
                              </>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <Typography variant="caption" color="text.secondary">
                    O checklist nacional consolida automaticamente estas
                    marcações para COMGEP e Coordenação CIPAVD.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="text"
                      color="inherit"
                      startIcon={<RestartAltRoundedIcon />}
                      onClick={handleResetChecklist}
                      disabled={!canEditChecklist || !checklistDirty}
                    >
                      Restaurar
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveRoundedIcon />}
                      onClick={handleSaveChecklist}
                      disabled={
                        !canEditChecklist ||
                        !checklistDirty ||
                        updateChecklistMutation.isPending
                      }
                    >
                      Salvar checklist
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "pendencias" ? (
          <Card
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "none",
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.25}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Pendências das denúncias
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Visão operacional das pendências abertas para a OM e,
                      quando disponível, das resoluções aguardando validação.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {commissionPendingBadge ? (
                      <Chip
                        label={commissionPendingBadge.label}
                        sx={{
                          fontWeight: 700,
                          color:
                            commissionPendingBadge.tone === "error"
                              ? "#B91C1C"
                              : "#166534",
                          bgcolor:
                            commissionPendingBadge.tone === "error"
                              ? "rgba(239, 68, 68, 0.12)"
                              : "rgba(34, 197, 94, 0.12)",
                          border: "1px solid",
                          borderColor:
                            commissionPendingBadge.tone === "error"
                              ? "rgba(239, 68, 68, 0.24)"
                              : "rgba(34, 197, 94, 0.24)",
                        }}
                      />
                    ) : (
                      <Chip label="Sem pendências" variant="outlined" />
                    )}
                  </Stack>
                </Stack>

                {commissionOpenPendingItems.length === 0 &&
                commissionResolvedPendingItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma pendência de denúncia encontrada para a OM
                    selecionada.
                  </Typography>
                ) : (
                  <Stack spacing={1.25}>
                    {commissionOpenPendingItems.map((item: any) => (
                      <Box
                        key={`${item.workflow}-${item.threadId}`}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Stack spacing={0.8}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", md: "center" }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Chip
                                size="small"
                                label={item.workflow}
                                variant="outlined"
                              />
                              <Typography fontWeight={700}>
                                {item.case.caseNumber}
                              </Typography>
                            </Stack>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() =>
                                navigate(
                                  `${item.route}?q=${encodeURIComponent(item.case.caseNumber)}`,
                                )
                              }
                            >
                              Abrir denúncia
                            </Button>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {formatOmLabel(
                              item.case.locality?.code ?? null,
                              item.case.locality?.name ?? null,
                            )}
                          </Typography>
                          <Typography variant="body2">
                            {item.lastMessage?.body ?? "Sem detalhe informado."}
                          </Typography>
                        </Stack>
                      </Box>
                    ))}

                    {commissionResolvedPendingItems.length > 0 && (
                      <Box sx={{ pt: 0.5 }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          Resolvidas aguardando validação
                        </Typography>
                        <Stack spacing={1}>
                          {commissionResolvedPendingItems.map((item: any) => (
                            <Box
                              key={`${item.workflow}-${item.threadId}`}
                              sx={{
                                p: 1.5,
                                borderRadius: 2.5,
                                border: "1px solid",
                                borderColor: "divider",
                                backgroundColor: "rgba(34, 197, 94, 0.04)",
                              }}
                            >
                              <Stack spacing={0.8}>
                                <Stack
                                  direction={{ xs: "column", md: "row" }}
                                  spacing={1}
                                  justifyContent="space-between"
                                  alignItems={{
                                    xs: "flex-start",
                                    md: "center",
                                  }}
                                >
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                  >
                                    <Chip
                                      size="small"
                                      label={item.workflow}
                                      variant="outlined"
                                    />
                                    <Typography fontWeight={700}>
                                      {item.case.caseNumber}
                                    </Typography>
                                  </Stack>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() =>
                                      navigate(
                                        `${item.route}?q=${encodeURIComponent(item.case.caseNumber)}`,
                                      )
                                    }
                                  >
                                    Revisar denúncia
                                  </Button>
                                </Stack>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {item.lastMessage?.body ??
                                    "Sem resolução registrada."}
                                </Typography>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "presidencia" && canAssignPresident ? (
          <Card
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              boxShadow: "none",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={700}>
                Designar Presidente CPCA
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Fluxo direto para a gestão nacional. O sistema localiza o
                militar e aplica a presidência imediatamente na OM selecionada.
              </Typography>

              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.2}
                alignItems={{ xs: "stretch", lg: "flex-end" }}
              >
                <TextField
                  size="small"
                  label="E-mail ou CPF"
                  value={presidentIdentifier}
                  onChange={(event) =>
                    setPresidentIdentifier(event.target.value)
                  }
                  fullWidth
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Boletim de designação"
                  value={presidentBulletin}
                  onChange={(event) => setPresidentBulletin(event.target.value)}
                  fullWidth
                  sx={{ flex: 1, maxWidth: { lg: 340 } }}
                />
                <TextField
                  select
                  size="small"
                  label="Substituição"
                  value={presidentIsSubstitution ? "SIM" : "NAO"}
                  onChange={(event) =>
                    setPresidentIsSubstitution(event.target.value === "SIM")
                  }
                  sx={{ minWidth: 150, flexShrink: 0 }}
                >
                  <MenuItem value="SIM">Sim</MenuItem>
                  <MenuItem value="NAO">Não</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  startIcon={<PersonSearchRoundedIcon />}
                  disabled={
                    !selectedLocalityId ||
                    !presidentIdentifier.trim() ||
                    !presidentBulletin.trim() ||
                    assignPresidentMutation.isPending
                  }
                  onClick={() =>
                    handleAssignPresident({
                      identifier: presidentIdentifier,
                      localityId: selectedLocalityId,
                      isSubstitution: presidentIsSubstitution,
                      designationBulletin: presidentBulletin,
                    })
                  }
                  sx={{
                    minHeight: 40,
                    height: { lg: 40 },
                    minWidth: { lg: 120 },
                    whiteSpace: "nowrap",
                    alignSelf: { xs: "stretch", lg: "flex-end" },
                    flexShrink: 0,
                  }}
                >
                  {assignPresidentMutation.isPending
                    ? "Salvando..."
                    : "Designar"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "presidencia" && canNominatePresident ? (
          <Card
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              boxShadow: "none",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={700}>
                Solicitar sucessão da presidência
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Use este fluxo quando a comissão precisar indicar o próximo
                presidente. A alteração só passa a valer após homologação da
                gestão nacional.
              </Typography>

              {pendingPresidentNominationRequest ? (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                  Existe uma solicitação pendente de sucessão para esta OM.
                  Candidato:{" "}
                  <strong>
                    {pendingPresidentNominationRequest.nominee?.displayName ||
                      "Não informado"}
                  </strong>
                  {pendingPresidentNominationRequest.bulletinNumber
                    ? ` • Boletim: ${pendingPresidentNominationRequest.bulletinNumber}`
                    : ""}
                  {pendingPresidentNominationRequest.requestedByUser?.name
                    ? ` • Enviada por ${pendingPresidentNominationRequest.requestedByUser.name}`
                    : ""}
                  {` • ${formatDateTime(pendingPresidentNominationRequest.createdAt)}`}
                </Alert>
              ) : null}

              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.2}
                alignItems={{ xs: "stretch", lg: "flex-end" }}
              >
                <TextField
                  size="small"
                  label="E-mail ou CPF do indicado"
                  value={nominationIdentifier}
                  onChange={(event) =>
                    setNominationIdentifier(event.target.value)
                  }
                  fullWidth
                  disabled={
                    Boolean(pendingPresidentNominationRequest) ||
                    createNominationMutation.isPending
                  }
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Boletim da sucessão"
                  value={nominationBulletin}
                  onChange={(event) =>
                    setNominationBulletin(event.target.value)
                  }
                  fullWidth
                  disabled={
                    Boolean(pendingPresidentNominationRequest) ||
                    createNominationMutation.isPending
                  }
                  sx={{ flex: 1, maxWidth: { lg: 340 } }}
                />
                <TextField
                  select
                  size="small"
                  label="Substituição"
                  value={nominationIsSubstitution ? "SIM" : "NAO"}
                  onChange={(event) =>
                    setNominationIsSubstitution(event.target.value === "SIM")
                  }
                  disabled={
                    Boolean(pendingPresidentNominationRequest) ||
                    createNominationMutation.isPending
                  }
                  sx={{ minWidth: 150, flexShrink: 0 }}
                >
                  <MenuItem value="SIM">Sim</MenuItem>
                  <MenuItem value="NAO">Não</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  disabled={
                    Boolean(pendingPresidentNominationRequest) ||
                    !nominationIdentifier.trim() ||
                    createNominationMutation.isPending
                  }
                  onClick={() => {
                    void handleCreateNomination();
                  }}
                  sx={{
                    minHeight: 40,
                    minWidth: { lg: 180 },
                    whiteSpace: "nowrap",
                  }}
                >
                  {createNominationMutation.isPending
                    ? "Enviando..."
                    : "Enviar para homologação"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "cobertura" || activeTab === "membros" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 2,
              alignItems: "start",
            }}
          >
            {activeTab === "cobertura" ? (
              <Card
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  boxShadow: "none",
                }}
              >
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Typography variant="h6" fontWeight={700}>
                    Cobertura da Comissão
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    {canAssignPresident
                      ? "A gestão nacional pode aplicar a cobertura imediatamente."
                      : managesCoverageByApproval
                        ? "A presidência propõe a cobertura e a alteração só vale após homologação da gestão nacional."
                        : "Consulte abaixo quais OMs esta comissão atende além da própria OM."}
                  </Typography>

                  {pendingCoverageRequest ? (
                    <Alert severity="info" sx={{ mb: 1.5 }}>
                      Existe uma solicitação pendente de cobertura para esta OM,
                      enviada em{" "}
                      {formatDateTime(pendingCoverageRequest.createdAt)}.
                      {pendingCoverageRequest.requestedByUser?.name
                        ? ` Responsável: ${pendingCoverageRequest.requestedByUser.name}.`
                        : ""}
                    </Alert>
                  ) : null}

                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={availableManagedLocalities}
                    value={availableManagedLocalities.filter((option) =>
                      managedLocalityIds.includes(option.id),
                    )}
                    onChange={(_, value) =>
                      setManagedLocalityIds(value.map((item) => item.id))
                    }
                    getOptionDisabled={(option) => Boolean(option.hasCpca)}
                    getOptionLabel={(option) =>
                      `${formatOmLabel(option.code, option.name)}${option.uf ? ` - ${option.uf}` : ""}`
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="OMs adicionais cobertas por esta comissão"
                        helperText="OMs com CPCA próprio ficam bloqueadas para evitar sobreposição de gestão."
                      />
                    )}
                    disabled={
                      !canManageCoverage ||
                      updateCoverageMutation.isPending ||
                      (!canAssignPresident && Boolean(pendingCoverageRequest))
                    }
                  />

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.2}
                    alignItems={{ xs: "stretch", md: "center" }}
                    sx={{ mt: 1.5 }}
                  >
                    <Chip
                      size="small"
                      color="primary"
                      label="A própria OM sempre permanece vinculada"
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${managedLocalityIds.length} OMs adicionais vinculadas`}
                    />
                    {canManageCoverage ? (
                      <Button
                        variant="contained"
                        onClick={handleSaveCoverage}
                        disabled={
                          updateCoverageMutation.isPending ||
                          (!canAssignPresident &&
                            Boolean(pendingCoverageRequest))
                        }
                        sx={{ minWidth: { md: 220 } }}
                      >
                        {updateCoverageMutation.isPending
                          ? "Enviando..."
                          : canAssignPresident
                            ? "Salvar cobertura"
                            : "Enviar para homologação"}
                      </Button>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            ) : null}

            {activeTab === "membros" ? (
              <Card
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  boxShadow: "none",
                }}
              >
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Typography variant="h6" fontWeight={700}>
                    Membros da Comissão
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    {canManageMembers
                      ? "Informe e-mail ou CPF. O sistema localiza o militar e inclui na comissão."
                      : "Somente o presidente da comissão ou a gestão nacional pode cadastrar ou remover membros."}
                  </Typography>

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.2}
                    alignItems={{ xs: "stretch", md: "flex-end" }}
                    sx={{ mb: 1.5 }}
                  >
                    <TextField
                      size="small"
                      label="E-mail ou CPF"
                      value={memberIdentifier}
                      onChange={(event) =>
                        setMemberIdentifier(event.target.value)
                      }
                      fullWidth
                      disabled={
                        !canManageMembers || addMemberMutation.isPending
                      }
                      sx={{ flex: 1 }}
                    />
                    <Button
                      variant="contained"
                      disabled={
                        !canManageMembers ||
                        !memberIdentifier.trim() ||
                        addMemberMutation.isPending
                      }
                      onClick={handleAddMember}
                      sx={{
                        minHeight: 40,
                        height: { md: 40 },
                        minWidth: { md: 170 },
                        whiteSpace: "nowrap",
                        alignSelf: { xs: "stretch", md: "flex-end" },
                        flexShrink: 0,
                      }}
                    >
                      {addMemberMutation.isPending
                        ? "Adicionando..."
                        : "Adicionar membro"}
                    </Button>
                  </Stack>

                  {members.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhum membro cadastrado nesta OM.
                    </Typography>
                  ) : (
                    <TableContainer
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Militar</TableCell>
                            <TableCell>E-mail</TableCell>
                            <TableCell>UID</TableCell>
                            <TableCell>Cadastrado por</TableCell>
                            <TableCell>Em</TableCell>
                            <TableCell align="right">Ações</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {members.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>{member.user.name}</TableCell>
                              <TableCell>{member.user.email}</TableCell>
                              <TableCell>
                                {member.user.ldapUid ?? "-"}
                              </TableCell>
                              <TableCell>
                                {member.addedByUser?.name ?? "-"}
                              </TableCell>
                              <TableCell>
                                {formatDateTime(member.createdAt)}
                              </TableCell>
                              <TableCell align="right">
                                <IconButton
                                  color="error"
                                  size="small"
                                  disabled={
                                    !canManageMembers ||
                                    removeMemberMutation.isPending
                                  }
                                  onClick={() => setMemberToRemove(member)}
                                >
                                  <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </Box>
        ) : null}

        {activeTab === "historico" ? (
          <Card
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              boxShadow: "none",
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <HistoryRoundedIcon color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight={700}>
                  Histórico da OM
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Todas as inclusões, exclusões e mudanças de presidência ou
                cobertura ficam registradas aqui com autor, data e hora.
              </Typography>
              {history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ainda não há eventos registrados para esta OM.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {history.map((item) => (
                    <Accordion key={item.id} disableGutters>
                      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                          sx={{ width: "100%", pr: 1 }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {item.actionLabel}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {item.summary}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {item.actor?.name ? `${item.actor.name} • ` : ""}
                            {formatDateTime(item.createdAt)}
                          </Typography>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            O que isso significa
                          </Typography>
                          <Typography variant="body2">
                            {item.summary}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Responsável: {item.actor?.name ?? "Sistema"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Data e hora: {formatDateTime(item.createdAt)}
                          </Typography>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        ) : null}
      </Stack>

      <ConfirmDialog
        open={Boolean(pendingPresidentOverwrite)}
        title="Substituir presidente atual?"
        message="Já existe presidente registrado nesta OM. Confirma ciência e deseja prosseguir com a alteração?"
        highlightText={
          currentPresident?.user?.name ?? "Presidente atual já registrado"
        }
        severity="warning"
        confirmLabel="Prosseguir"
        confirmLoading={assignPresidentMutation.isPending}
        onCancel={() => setPendingPresidentOverwrite(null)}
        onConfirm={() => {
          if (!pendingPresidentOverwrite) return;
          void handleAssignPresident({
            ...pendingPresidentOverwrite,
            proceedWithExistingPresident: true,
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="Remover membro da comissão"
        message="Tem certeza que deseja remover este militar da comissão CPCA desta OM?"
        highlightText={memberToRemove?.user?.name ?? ""}
        severity="error"
        confirmLabel="Remover"
        confirmLoading={removeMemberMutation.isPending}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={() => {
          void handleRemoveMember();
        }}
      />
    </Box>
  );
}
