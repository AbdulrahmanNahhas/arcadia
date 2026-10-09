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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
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
    <div className="stremio-shell">
      <nav className="stremio-rail" aria-label="التنقل الرئيسي">
        <a href="#/home" className="stremio-brand" aria-label="نحّاسيو الرئيسية" title="نحّاسيو">
          <Library />
        </a>
        {[
          { href: "#/home", label: "الرئيسية", icon: Home, active: home },
          { href: "#/browse", label: "تصفّح المكتبة", icon: Compass, active: parts[0] === "browse" },
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
            className="stremio-rail-link"
            aria-current={item.active ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <item.icon aria-hidden="true" />
          </a>
        ))}
      </nav>
      <div className="stremio-body">
        <header className="stremio-topbar">
          <div className="stremio-search">
            <Button
              variant="secondary"
              size="lg"
              className="w-full justify-between"
              onClick={() => setSearch(true)}
              aria-label="ابحث في الأرشيف"
            >
              <span className="flex items-center gap-3">
                <Search data-icon="inline-start" />
                <span>ابحث في الأرشيف…</span>
              </span>
              <kbd className="hidden text-xs text-muted-foreground sm:block">Ctrl K</kbd>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="الملف والحساب"
            onClick={() => setAccount(true)}
          >
            <Avatar>
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
        </header>
        <main ref={main} className="stremio-main" id="main-content">
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
