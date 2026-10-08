import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireOwnerSession } from "@/features/auth/auth.server";

export async function requireLocalAdmin() {
  const request = getRequest();
  const url = new URL(request.url);
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NAHHASIO_LOCAL_ADMIN !== "true" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw new Error("الإدارة المحلية غير مفعّلة");
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) throw new Error("الطلب من مصدر غير مسموح");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("الطلب من مصدر غير مسموح");
  await requireOwnerSession();
}
export async function databaseRequest(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: string,
) {
  await requireLocalAdmin();
  const token = process.env.NAHHASIO_LOCAL_ADMIN_TOKEN;
  if (!token) throw new Error("إعداد الإدارة المحلية غير مكتمل");
  const base = process.env.NAHHASIO_API_URL ?? "http://127.0.0.1:23103";
  const url = new URL(base);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("عنوان الخادم المحلي غير صالح");
  const headers = { "content-type": "application/json", "x-nahhasio-admin": token };
  const address = `${base}/api/database/${path}`;
  const response =
    method === "GET"
      ? await fetch(address, { headers, signal: AbortSignal.timeout(15000) })
      : await fetch(address, {
          method: method === "POST" ? "POST" : method === "PATCH" ? "PATCH" : "DELETE",
          headers,
          body,
          signal: AbortSignal.timeout(15000),
        });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(data);
    throw new Error(error.success ? error.data.message : "تعذّر تطبيق العملية");
  }
  return data;
}
