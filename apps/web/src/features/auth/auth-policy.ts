// Browser-origin checks apply before reading cookies or sending private requests.
export function verifyDashboardOrigin(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("الطلب من مصدر غير مسموح");
  if (request.method !== "GET" && request.method !== "HEAD" && origin !== url.origin)
    throw new Error("الطلب من مصدر غير مسموح");
}
export function localApiBase(base: string) {
  const url = new URL(base);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("عنوان الخادم المحلي غير صالح");
  return url.origin;
}
