import type { BrowseResponse, TitleDetail } from "@arcadia/contracts";
import type { paths } from "@arcadia/contracts/openapi";
import createClient from "openapi-fetch";

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001",
});

export const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Arcadia API request failed (${response.status})`);
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
