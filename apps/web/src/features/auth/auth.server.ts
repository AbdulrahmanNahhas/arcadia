import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";

import { loginResponseSchema, loginSchema, sessionSchema, type LoginInput } from "./auth-model";
import { localApiBase, verifyDashboardOrigin } from "./auth-policy";

const cookieName = "nahhasio_owner_session";
function requestContext() {
  const request = getRequest();
  verifyDashboardOrigin(request);
  setResponseHeader("cache-control", "no-store");
  return request;
}
function cookieOptions() {
  return {
    httpOnly: true,
    secure: new URL(getRequest().url).protocol === "https:",
    sameSite: "strict" as const,
    path: "/",
  };
}
async function authRequest(
  path: "login" | "session" | "logout",
  method: "GET" | "POST",
  body?: string,
) {
  const base = localApiBase(process.env.NAHHASIO_API_URL ?? "http://127.0.0.1:23103");
  const token = getCookie(cookieName);
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const address = `${base}/api/v1/auth/${path}`;
  return method === "GET"
    ? fetch(address, { headers, signal: AbortSignal.timeout(15000), cache: "no-store" })
    : fetch(address, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
}
export async function ownerSession() {
  requestContext();
  if (!getCookie(cookieName)) return null;
  const response = await authRequest("session", "GET");
  if (response.status === 401) {
    deleteCookie(cookieName, cookieOptions());
    return null;
  }
  if (!response.ok) throw new Error("تعذّر التحقق من جلسة الدخول");
  const data: unknown = await response.json();
  return sessionSchema.parse(data);
}
export async function requireOwnerSession() {
  const session = await ownerSession();
  if (!session) throw new Error("تسجيل الدخول مطلوب");
  return session;
}
export async function ownerLogin(input: LoginInput) {
  requestContext();
  const credentials = loginSchema.parse(input);
  const response = await authRequest("login", "POST", JSON.stringify(credentials));
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
        : response.status === 429
          ? "محاولات كثيرة؛ أعد المحاولة بعد قليل"
          : "تعذّر تسجيل الدخول إلى الخادم",
    );
  const data: unknown = await response.json();
  const session = loginResponseSchema.parse(data);
  const maxAge = Math.min(
    7 * 24 * 60 * 60,
    Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000),
  );
  if (maxAge <= 0) throw new Error("انتهت صلاحية جلسة الدخول");
  setCookie(cookieName, session.token, { ...cookieOptions(), maxAge });
  // The token stays in the HttpOnly cookie; it is never serialized to the browser.
  return { user: session.user, expiresAt: session.expiresAt };
}
export async function ownerLogout() {
  requestContext();
  if (getCookie(cookieName)) {
    const response = await authRequest("logout", "POST");
    if (!response.ok && response.status !== 401)
      throw new Error("تعذّر إنهاء جلسة الخادم؛ أعد المحاولة");
  }
  deleteCookie(cookieName, cookieOptions());
}
