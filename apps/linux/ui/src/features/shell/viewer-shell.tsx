import type { User } from "@nahhasio/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Home,
  Orbit,
  Search,
  LogOut,
  Sparkles,
  Users,
  Building2,
  Library,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

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
import { DiscoveryPage } from "../discovery/discovery-page";
import { RecommendationsPage } from "../discovery/recommendations-page";
import { HomePage } from "../home/home-page";
import { WorkPage } from "../work/work-page";
import { useViewerRoute } from "./navigation";
import { SearchDialog } from "./search-dialog";
const scrollPositions = new Map<string, number>();
export function ViewerShell({ user }: { user: User }) {
  const route = useViewerRoute();
  const [search, setSearch] = useState(false);
  const [account, setAccount] = useState(false);
  const main = useRef<HTMLElement>(null);
  const previous = useRef(route.key);
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
        if (!event.repeat && !account) setSearch(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [account]);
  useEffect(() => {
    if (main.current) {
      scrollPositions.set(previous.current, main.current.scrollTop);
      main.current.scrollTop = scrollPositions.get(route.key) ?? 0;
    }
    previous.current = route.key;
  }, [route.key]);
  const parts = route.path.split("/").filter(Boolean);
  const home = parts[0] === "home" || !parts[0];
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <nav
        className="flex w-24 shrink-0 flex-col items-center gap-4 border-e border-border bg-primary-foreground px-2 pt-5 pb-4 max-[800px]:w-20 max-[800px]:px-1.5 max-[520px]:w-18 max-[520px]:gap-3 max-[520px]:px-1 max-[520px]:pt-4 max-[520px]:pb-3"
        aria-label="التنقل الرئيسي"
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
        <div className="flex w-full shrink-0 flex-col items-center gap-1.5 text-[11px] text-muted-foreground">
          <Button
            variant="secondary"
            size="icon-lg"
            onClick={() => setSearch(true)}
            aria-label="ابحث في الأرشيف"
            aria-keyshortcuts="Control+k Meta+k"
            aria-haspopup="dialog"
            aria-expanded={search}
            title="البحث (Ctrl+K)"
          >
            <Search data-icon="inline-start" />
          </Button>
          <span aria-hidden="true">البحث</span>
        </div>
        <div className="flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto p-1 [scrollbar-color:var(--line)_transparent] scrollbar-thin max-[520px]:gap-1">
          {[
            { href: "#/home", label: "الرئيسية", icon: Home, active: home },
            {
              href: "#/browse",
              label: "تصفّح المكتبة",
              icon: Compass,
              active: parts[0] === "browse",
            },
            { href: "#/planets", label: "الكواكب", icon: Orbit, active: parts[0] === "planets" },
            {
              href: "#/recommendations",
              label: "اكتشف",
              icon: Sparkles,
              active: parts[0] === "recommendations",
            },
            { href: "#/people", label: "الصنّاع", icon: Users, active: parts[0] === "people" },
            {
              href: "#/studios",
              label: "الاستوديوهات",
              icon: Building2,
              active: parts[0] === "studios",
            },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative flex min-h-15 w-full shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg px-0.5 py-2 text-center text-[10px] leading-normal text-muted-foreground hover:bg-card hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-primary aria-[current=page]:before:absolute aria-[current=page]:before:inset-s-0 aria-[current=page]:before:inset-y-5 aria-[current=page]:before:w-0.75 aria-[current=page]:before:rounded-lg aria-[current=page]:before:bg-primary aria-[current=page]:before:content-[''] focus-visible:-outline-offset-2 max-[520px]:text-[9px]"
              aria-current={item.active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon className="size-6 stroke-[1.65]" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          ))}
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
        <main
          ref={main}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-color:var(--line)_transparent] scrollbar-thin motion-reduce:scroll-auto"
          id="main-content"
        >
          {home ? (
            <HomePage />
          ) : parts[0] === "browse" ? (
            <BrowsePage params={route.params} />
          ) : parts[0] === "titles" && parts[1] ? (
            <WorkPage
              key={parts[1]}
              id={parts[1]}
              installmentId={route.params.get("installment") ?? undefined}
            />
          ) : parts[0] === "recommendations" ? (
            <RecommendationsPage />
          ) : ["planets", "people", "studios"].includes(parts[0]) ? (
            <DiscoveryPage type={parts[0]} id={parts[1]} params={route.params} />
          ) : (
            <BrowsePage params={route.params} />
          )}
        </main>
      </div>
      <SearchDialog open={search} onOpenChange={setSearch} />
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
