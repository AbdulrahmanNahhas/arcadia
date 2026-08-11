import {
  DatabaseIcon,
  GearIcon,
  HouseIcon,
  PlanetIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PlatformShell({
  children,
  immersive = false,
}: {
  children: ReactNode;
  immersive?: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="platform-surface min-h-svh">
      <a
        href="#main-content"
        className="fixed inset-s-4 top-2 z-100 -translate-y-20 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0"
      >
        انتقل إلى المحتوى
      </a>
      <header
        className={cn(
          "sticky top-0 z-40",
          immersive
            ? "fixed inset-x-0 border-transparent bg-linear-to-b from-background via-background/70 to-transparent pb-10"
            : "mx-2 rounded-b-3xl border-t-0 bg-background/72 backdrop-blur-xl",
        )}
      >
        <div className="container mx-auto flex h-14 max-w-400 items-center gap-4 p-3">
          <Link to="/" className="me-2 flex shrink-0 items-center gap-2 font-heading font-semibold">
            <OrbitMark />
            <span className="hidden text-lg sm:block">نحّاسينما</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
            <NavLink to="/" active={pathname === "/"} icon={<HouseIcon />}>
              الرئيسية
            </NavLink>
            <NavLink to="/planets" active={pathname.startsWith("/planets")} icon={<PlanetIcon />}>
              الكواكب
            </NavLink>
            <NavLink to="/browse" active={pathname.startsWith("/browse")} icon={<DatabaseIcon />}>
              تصفّح
            </NavLink>
          </nav>
          <Badge variant="secondary" className="hidden lg:inline-flex">
            عرض تجريبي — بلا حماية
          </Badge>
          <div className="ms-auto flex items-center gap-1">
            <Link
              to="/settings"
              aria-label="الإعدادات"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <GearIcon />
            </Link>
            <Link
              to="/profiles"
              aria-label="اختيار الملف"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
            >
              <UserCircleIcon />
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex h-14 items-center justify-around rounded-xl border border-border bg-background/90 px-2 shadow-2xl backdrop-blur-xl lg:hidden"
        aria-label="التنقل على الهاتف"
      >
        <MobileLink to="/" active={pathname === "/"} icon={<HouseIcon />} label="الرئيسية" />
        <MobileLink
          to="/planets"
          active={pathname.startsWith("/planets")}
          icon={<PlanetIcon />}
          label="الكواكب"
        />
        <MobileLink
          to="/browse"
          active={pathname.startsWith("/browse")}
          icon={<DatabaseIcon />}
          label="تصفّح"
        />
        <MobileLink
          to="/profiles"
          active={pathname.startsWith("/profiles")}
          icon={<UserCircleIcon />}
          label="الملفات"
        />
      </nav>
    </div>
  );
}

function OrbitMark() {
  return (
    <span
      className="relative flex size-8 items-center justify-center rounded-full border border-primary/50 text-primary"
      aria-hidden="true"
    >
      <span className="size-2 rounded-full bg-primary" />
      <span className="absolute h-px w-10 -rotate-20 bg-primary/60" />
    </span>
  );
}
function NavLink({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
function MobileLink({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-w-14 flex-col items-center gap-0.5 text-[10px] text-muted-foreground",
        active && "text-primary",
      )}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}
