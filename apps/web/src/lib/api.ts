import type { BrowseResponse, TitleDetail } from "@arcadia/contracts";
import type { paths } from "@arcadia/contracts/openapi";
import createClient from "openapi-fetch";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";
  if (typeof window === "undefined") return configured;

  const url = new URL(configured);
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (loopbackHosts.has(url.hostname) && loopbackHosts.has(window.location.hostname)) {
    url.hostname = window.location.hostname;
  }
  return url.origin;
}

export const apiBaseUrl = resolveApiBaseUrl();

async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: new Headers(init?.headers),
  });
}

const client = createClient<paths>({ baseUrl: apiBaseUrl, fetch: authenticatedFetch });

/** A single Zod validation issue, as the API returns it (see `adminErrorSchema` in contracts). */
export interface ApiErrorIssue {
  path: Array<string | number>;
  message: string;
}

/**
 * Thrown by `apiFetch` on any non-OK response. Carries the HTTP status and, when the API
 * returned structured Zod issues (most 400s from admin write routes), the per-field breakdown —
 * previously discarded here, leaving callers with only one flat message no matter how many
 * fields actually failed validation. `error instanceof Error` still holds for existing callers
 * that only check that.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiErrorIssue[] | undefined;

  constructor(message: string, status: number, issues?: ApiErrorIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: new Headers({ "Content-Type": "application/json", ...init?.headers }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      issues?: ApiErrorIssue[];
    } | null;
    throw new ApiError(
      body?.message ?? `Arcadia API request failed (${response.status})`,
      response.status,
      Array.isArray(body?.issues) ? body.issues : undefined,
    );
  }
  return (await response.json()) as T;
}

export async function browseTitles(query: Record<string, string | number> = {}) {
  const { data, error } = await client.GET("/api/v1/titles", { params: { query } });
  if (error || !data) throw new Error("تعذّر تحميل الأرشيف من واجهة Arcadia.");
  return data as BrowseResponse;
}

export async function getTitle(titleId: string) {
  const { data, error, response } = await client.GET("/api/v1/titles/{titleId}", {
    params: { path: { titleId } },
  });
  if (response.status === 404) return null;
  if (error || !data) throw new Error("تعذّر تحميل تفاصيل العنوان.");
  return data as TitleDetail;
}

export async function getPlanets() {
  const { data, error } = await client.GET("/api/v1/planets");
  if (error || !data) throw new Error("تعذّر تحميل الكواكب.");
  return data as Array<{
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    icon: string;
    description: string;
    primaryColor: string;
    secondaryColor: string;
  }>;
}
