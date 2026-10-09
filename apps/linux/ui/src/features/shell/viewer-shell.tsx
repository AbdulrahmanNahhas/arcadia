import type { User } from "@nahhasio/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Home, Search, LogOut, Library, Orbit, Users, Building2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { CardNavigationProvider } from "../../components/card-navigation";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { gateway } from "../../lib/bridge";
import { BrowsePage } from "../catalog/browse-page";
import { HomePage } from "../home/home-page";
import { PeoplePage } from "../people/people-page";
import { PlanetsPage } from "../planets/planets-page";
import { SearchPage } from "../search/search-page";
import { StudiosPage } from "../studios/studios-page";
import { WorkPage } from "../work/work-page";
import { openSearch, useViewerRoute } from "./navigation";
const navigationItemClass =
  "relative flex min-h-15 w-full shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg px-0.5 py-2 text-center text-[10px] leading-normal text-muted-foreground hover:bg-card hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-primary aria-[current=page]:before:absolute aria-[current=page]:before:inset-s-0 aria-[current=page]:before:inset-y-5 aria-[current=page]:before:w-0.75 aria-[current=page]:before:rounded-lg aria-[current=page]:before:bg-primary aria-[current=page]:before:content-[''] focus-visible:-outline-offset-2 max-[520px]:text-[9px]";
const scrollPositions = new Map<string, number>();
export function ViewerShell({ user }: { user: User }) {
  const route = useViewerRoute();

  const [account, setAccount] = useState(false);
  const main = useRef<HTMLElement>(null);
  const previous = useRef(route.key);
  const shortcutSearchEntry = useRef(false);
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: gateway.logout,
    onSettled: () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(["session"], null);
    },
  });
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.isComposing &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        if (!event.repeat && !account) {
          shortcutSearchEntry.current = true;
          openSearch();
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [account]);
  useEffect(() => {
    let enterPath: string | undefined;
    const press = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.repeat && !event.isComposing)
        enterPath = window.location.hash.split("?")[0];
    };
    const release = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      // A new page may focus a button before keyup; don't activate it with the previous page's Enter.
      if (enterPath !== undefined && enterPath !== window.location.hash.split("?")[0]) {
        event.preventDefault();
        event.stopPropagation();
      }
      enterPath = undefined;
    };
    window.addEventListener("keydown", press, true);
    window.addEventListener("keyup", release, true);
    return () => {
      window.removeEventListener("keydown", press, true);
      window.removeEventListener("keyup", release, true);
    };
  }, []);
  useEffect(() => {
    if (main.current) {
      scrollPositions.set(previous.current, main.current.scrollTop);
      main.current.scrollTop = scrollPositions.get(route.key) ?? 0;
    }
    previous.current = route.key;
  }, [route.key]);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    if (shortcutSearchEntry.current && route.path === "/search") {
      window.dispatchEvent(new Event("nahhasio:focus-search"));
    }
    shortcutSearchEntry.current = false;
  }, [route.path]);
  const parts = route.path.split("/").filter(Boolean);
  const home = parts[0] === "home" || !parts[0];
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <nav
        className="flex w-24 shrink-0 flex-col items-center gap-4 border-e border-border bg-primary-foreground px-2 pt-5 pb-4 max-[800px]:w-20 max-[800px]:px-1.5 max-[520px]:w-18 max-[520px]:gap-3 max-[520px]:px-1 max-[520px]:pt-4 max-[520px]:pb-3"
        aria-label="التنقل الرئيسي"
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            window.dispatchEvent(new Event("nahhasio:focus-content"));
          }
        }}
      >
        <a
          href="#/home"
          className="flex shrink-0 flex-col items-center gap-1.5 text-xs font-semibold text-primary"
          aria-label="نحّاسيو الرئيسية"
          title="نحّاسيو"
        >
          <Library className="size-8" aria-hidden="true" />
          <span>نحّاسيو</span>
        </a>

        <div className="flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto p-1 [scrollbar-color:var(--line)_transparent] scrollbar-thin max-[520px]:gap-1">
          {[
            { href: "#/home", label: "الرئيسية", icon: Home, active: home },
            { href: "#/search", label: "البحث", icon: Search, active: parts[0] === "search" },
            {
              href: "#/browse",
              label: "تصفّح المكتبة",
              icon: Compass,
              active: parts[0] === "browse",
            },
            { href: "#/planets", label: "الكواكب", icon: Orbit, active: parts[0] === "planets" },
            { href: "#/people", label: "الصنّاع", icon: Users, active: parts[0] === "people" },
            {
              href: "#/studios",
              label: "الاستوديوهات",
              icon: Building2,
              active: parts[0] === "studios",
            },
          ].map((item) =>
            item.href === "#/search" ? (
              <button
                key={item.href}
                type="button"
                onClick={openSearch}
                className={navigationItemClass}
                aria-current={item.active ? "page" : undefined}
                aria-label="البحث"
                aria-keyshortcuts="Control+k Meta+k"
                title="البحث (Ctrl+K)"
              >
                <Search className="size-6 stroke-[1.65]" aria-hidden="true" />
                <span>البحث</span>
              </button>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className={navigationItemClass}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <item.icon className="size-6 stroke-[1.65]" aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            ),
          )}
        </div>
        <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-1.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="الملف والحساب"
            aria-haspopup="dialog"
            aria-expanded={account}
            title={user.name}
            onClick={() => setAccount(true)}
          >
            <Avatar>
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
          <span className="max-w-full truncate" title={user.name}>
            {user.name}
          </span>
        </div>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CardNavigationProvider key={route.path}>
          <main
            ref={main}
            tabIndex={-1}
            className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-p-4 [scrollbar-color:var(--line)_transparent] scrollbar-thin motion-reduce:scroll-auto **:data-card-navigation:scroll-m-2"
            id="main-content"
          >
            <button
              type="button"
              className="sr-only focus:not-sr-only focus:absolute focus:inset-s-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-primary focus:px-5 focus:py-3 focus:text-primary-foreground"
              onClick={() =>
                window.dispatchEvent(
                  new Event(
                    parts[0] === "search" ? "nahhasio:focus-search" : "nahhasio:focus-content",
                  ),
                )
              }
            >
              {home
                ? "الانتقال إلى العرض الرئيسي"
                : parts[0] === "search"
                  ? "الانتقال إلى البحث"
                  : "الانتقال إلى المحتوى"}
            </button>
            {home ? (
              <HomePage />
            ) : parts[0] === "search" ? (
              <SearchPage params={route.params} />
            ) : parts[0] === "browse" ? (
              <BrowsePage params={route.params} />
            ) : parts[0] === "planets" ? (
              <PlanetsPage key={parts[1] ?? "planets"} id={parts[1]} params={route.params} />
            ) : parts[0] === "people" ? (
              <PeoplePage key={parts[1] ?? "people"} id={parts[1]} params={route.params} />
            ) : parts[0] === "studios" ? (
              <StudiosPage key={parts[1] ?? "studios"} id={parts[1]} params={route.params} />
            ) : parts[0] === "titles" && parts[1] ? (
              <WorkPage
                key={parts[1]}
                id={parts[1]}
                installmentId={route.params.get("installment") ?? undefined}
              />
            ) : (
              <BrowsePage params={route.params} />
            )}
          </main>
        </CardNavigationProvider>
      </div>

      <Dialog open={account} onOpenChange={setAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user.name}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <p>مكتبة العائلة على هذا الخادم.</p>
          {logout.error && <p role="alert">{logout.error.message}</p>}
          <Button
            variant="outline"
            aria-label="تسجيل الخروج"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut data-icon="inline-start" />
            تسجيل الخروج
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
