import { CircleNotchIcon } from "@phosphor-icons/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const session = authClient.useSession();
  const isPublic = pathname === "/login" || pathname.startsWith("/invite/");

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
          <p>جارٍ فتح مدارك في أركاديا…</p>
        </div>
      </main>
    );
  }
  return children;
}
