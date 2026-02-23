import axios from "axios";

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const isLocalHostPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1|::1)(:\d+)?$/i;

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

export const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
