import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { apiBaseUrl, readSessionToken, setSessionToken } from "./api";

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
    // The session cookie is unusable from the desktop shell, whose page origin is a different
    // *site* from the server's LAN address (see `setSessionToken` in api.ts). The API's bearer
    // plugin returns the session in `set-auth-token` on sign-in; capturing it here and replaying
    // it as an `Authorization` header is what keeps the session alive across reloads, since a
    // cross-site `SameSite=Lax` cookie is accepted by the browser and then never sent back.
    onSuccess: (context) => {
      const token = context.response.headers.get("set-auth-token");
      if (token) setSessionToken(token);
    },
    auth: {
      type: "Bearer",
      token: () => readSessionToken() ?? undefined,
    },
  },
  plugins: [usernameClient()],
});

/** Signs out server-side, then drops the local token so a failed round trip can't strand it. */
export async function signOut() {
  try {
    await authClient.signOut();
  } finally {
    setSessionToken(null);
  }
}
