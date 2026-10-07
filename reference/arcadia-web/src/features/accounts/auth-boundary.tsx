import { CircleNotchIcon } from "@phosphor-icons/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { useThemeEffects } from "@/lib/theme";
import { useCurrentAccount } from "./api";

const offlinePlayerSearchSchema = z.object({ origin: z.string() }).partial();

export function AuthBoundary({ children }: { children: ReactNode }) {
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const navigate = useNavigate();
  const session = authClient.useSession();
  // "/offline" is the saved-library fallback reached from the login form when no family server
  // is reachable at all — there is no session to gate it behind (see offline-library-page.tsx).
  const offlinePlayerSearch = offlinePlayerSearchSchema.safeParse(location.search);
  const offlinePlayer =
    pathname.startsWith("/player/") &&
    (offlinePlayerSearch.data?.origin?.startsWith("/offline/") ?? false);
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/offline") ||
    offlinePlayer;

  useEffect(() => {
    if (!isPublic && !session.isPending && !session.data) {
      void navigate({ to: "/login", replace: true, search: { next: pathname } });
    }
    if (pathname === "/login" && !session.isPending && session.data) {
      void navigate({ to: "/", replace: true });
    }
  }, [isPublic, navigate, pathname, session.data, session.isPending]);

  if (isPublic) return children;
  if (session.isPending || !session.data) {
    return (
      <main className="platform-surface grid min-h-svh place-items-center px-6">
        <div className="text-center text-muted-foreground" aria-live="polite">
          <CircleNotchIcon className="mx-auto mb-4 size-7 animate-spin text-primary" />
          <p>جارٍ تحميل الصفحة، يرجى الإنتظار قليلاً.</p>
        </div>
      </main>
    );
  }
  return <SignedIn>{children}</SignedIn>;
}

/** Rendered only with a session, so the account query never fires on the public routes. */
function SignedIn({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  useThemeEffects(account.data?.account.preferences.theme);
  return children;
}
