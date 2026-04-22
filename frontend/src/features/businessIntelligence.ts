type BusinessIntelligenceTabDefinition = {
  key: string;
  label: string;
  legacyPath: string;
  restricted?: boolean;
};

export const BUSINESS_INTELLIGENCE_TABS = [
  {
    key: "domestic-violence",
    label: "Violência Doméstica",
    legacyPath: "/dashboard/bi-violencia-domestica",
    restricted: false,
  },
  {
    key: "schools",
    label: "Escolas",
    legacyPath: "/dashboard/bi",
    restricted: false,
  },
  {
    key: "recruits",
    label: "Recrutas",
    legacyPath: "/dashboard/bi-recrutas",
    restricted: true,
  },
  {
    key: "best-practices-cycle",
    label: "Ciclo de Boas Práticas",
    legacyPath: "/dashboard/bi-ciclo-boas-praticas",
    restricted: false,
  },
  {
    key: "cpca-meeting",
    label: "Encontro CPCA",
    legacyPath: "/dashboard/bi-encontro-cpca",
    restricted: false,
  },
  {
    key: "gsd-evaluation",
    label: "Avaliação GSD",
    legacyPath: "/dashboard/bi-avaliacao-gsd",
    restricted: false,
  },
] as const satisfies readonly BusinessIntelligenceTabDefinition[];

export type BusinessIntelligenceTabKey =
  (typeof BUSINESS_INTELLIGENCE_TABS)[number]["key"];

export const DEFAULT_BUSINESS_INTELLIGENCE_TAB: BusinessIntelligenceTabKey =
  "domestic-violence";

export function getBusinessIntelligenceTabs(canAccessRestrictedTabs: boolean) {
  return BUSINESS_INTELLIGENCE_TABS.filter(
    (tab) => !tab.restricted || canAccessRestrictedTabs,
  );
}

export function isBusinessIntelligenceTabKey(
  value: string | null | undefined,
): value is BusinessIntelligenceTabKey {
  return BUSINESS_INTELLIGENCE_TABS.some((tab) => tab.key === value);
}

export function resolveBusinessIntelligenceTab(
  requestedTab: string | null | undefined,
  canAccessRestrictedTabs: boolean,
): BusinessIntelligenceTabKey {
  if (!isBusinessIntelligenceTabKey(requestedTab)) {
    return DEFAULT_BUSINESS_INTELLIGENCE_TAB;
  }
  const availableTabs = getBusinessIntelligenceTabs(canAccessRestrictedTabs);
  return (
    availableTabs.find((tab) => tab.key === requestedTab)?.key ??
    DEFAULT_BUSINESS_INTELLIGENCE_TAB
  );
}

export function getBusinessIntelligenceQueryPath(
  tab: BusinessIntelligenceTabKey,
) {
  return `/dashboard/bi?tab=${encodeURIComponent(tab)}`;
}

export function countActiveBusinessIntelligenceFilters(
  value: unknown,
  ignoreKeys: string[] = [],
) {
  const ignored = new Set(ignoreKeys);

  const visit = (node: unknown, key?: string): number => {
    if (key && ignored.has(key)) return 0;
    if (node == null) return 0;
    if (typeof node === "string") {
      return node.trim() ? 1 : 0;
    }
    if (typeof node === "number") {
      return Number.isFinite(node) && node !== 0 ? 1 : 0;
    }
    if (typeof node === "boolean") {
      return node ? 1 : 0;
    }
    if (Array.isArray(node)) {
      return node.length > 0 ? 1 : 0;
    }
    if (typeof node === "object") {
      return Object.entries(node as Record<string, unknown>).reduce(
        (sum, [childKey, childValue]) => sum + visit(childValue, childKey),
        0,
      );
    }
    return 0;
  };

  return visit(value);
}
