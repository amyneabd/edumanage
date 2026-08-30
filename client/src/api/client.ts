import axios from "axios";
import { toast } from "sonner";
import { queryClient } from "../lib/queryClient";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface ApiErrorBody {
  error: string;
}

export function extractErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error) return body.error;
  }
  return fallback;
}

// Endpoints that already render their own inline error (login/register forms), or
// whose failures are an expected, silent part of the flow (the /me probe on first
// load before the user is signed in). Toasting these too would be redundant noise.
const SILENT_ERROR_PREFIXES = [
  "/auth/me",
  "/auth/login",
  "/auth/register",
  "/auth/change-password",
  "/auth/forgot-password",
  "/auth/reset-password",
];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err?.config?.url ?? "";
    const silent = SILENT_ERROR_PREFIXES.some((p) => url.startsWith(p));

    if (!silent) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        // Session expired or was revoked mid-use — clear the cached identity so
        // the route guards redirect to /login instead of the app silently failing.
        toast.error("Your session has expired. Please sign in again.");
        queryClient.setQueryData(["me"], undefined);
      } else if (axios.isAxiosError(err) && !err.response) {
        toast.error("Can't reach the server. Check your connection and try again.");
      } else {
        toast.error(extractErrorMessage(err));
      }
    }

    return Promise.reject(err);
  }
);
