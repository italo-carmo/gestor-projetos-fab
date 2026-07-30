import axios from "axios";

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const isLocalHostPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1|::1)(:\d+)?$/i;
export const GLOBAL_LOCALITY_STORAGE_KEY = "globalLocalityId";
export const ACTIVE_ROLE_STORAGE_KEY = "activeRoleId";
const GLOBAL_LOCALITY_QUERY_PARAM = "globalLocalityId";

const shouldForceRelativeApiBase = () => {
  if (typeof window === "undefined") return false;
  const isBrowserLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (isBrowserLocalHost) return false;
  return Boolean(configuredBaseUrl && isLocalHostPattern.test(configuredBaseUrl));
};

const apiBaseUrl = shouldForceRelativeApiBase()
  ? "/api"
  : configuredBaseUrl && configuredBaseUrl.length > 0
    ? configuredBaseUrl
    : "/api";

const resolveGlobalLocalityIdFromUrl = () => {
  if (typeof window === "undefined") return "";
  try {
    return (
      new URLSearchParams(window.location.search)
        .get(GLOBAL_LOCALITY_QUERY_PARAM)
        ?.trim() ?? ""
    );
  } catch {
    return "";
  }
};

export const api = axios.create({
  baseURL: apiBaseUrl,
});

const shouldAttachGlobalLocality = (url: string, method?: string) => {
  if (String(method ?? "get").toLowerCase() !== "get") return false;
  const normalized = String(url ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (
    normalized.startsWith("/auth") ||
    normalized.startsWith("/admin/rbac") ||
    normalized.startsWith("/roles") ||
    normalized.startsWith("/permissions") ||
    normalized.startsWith("/users") ||
    normalized.startsWith("/institutional")
  ) {
    return false;
  }
  return true;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const activeRoleId = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY)?.trim();
  if (activeRoleId) {
    config.headers["x-active-role-id"] = activeRoleId;
  }

  const localityId = resolveGlobalLocalityIdFromUrl();
  const url = String(config.url ?? "");
  if (!localityId || !shouldAttachGlobalLocality(url, config.method)) {
    return config;
  }

  const hasLocalityInUrl = /[?&]localityId=/.test(url);
  if (hasLocalityInUrl) {
    return config;
  }

  if (config.params instanceof URLSearchParams) {
    if (!config.params.has("localityId")) {
      config.params.set("localityId", localityId);
    }
    return config;
  }

  const paramsObject =
    config.params && typeof config.params === "object" ? { ...config.params } : {};

  if (!("localityId" in paramsObject)) {
    (paramsObject as Record<string, unknown>).localityId = localityId;
    config.params = paramsObject;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken });
    if (data?.accessToken) localStorage.setItem("accessToken", data.accessToken);
    if (data?.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
    return data?.accessToken ?? null;
  } catch {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !String(original.url ?? "").includes("/auth/login") &&
      !String(original.url ?? "").includes("/auth/refresh") &&
      !String(original.url ?? "").includes("/auth/2fa/")
    ) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
