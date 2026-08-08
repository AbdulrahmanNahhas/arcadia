import { DatabaseIcon, HouseIcon, PlanetIcon, UserCircleIcon } from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";

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
          "sticky top-0 z-40 backdrop-blur-0",
          !immersive && " bg-background/72 mx-2 backdrop-blur-xl rounded-b-3xl border-t-0",
          immersive &&
            "fixed inset-x-0 bg-linear-to-b  from-background via-50% via-background/60 pb-10 to-background/0 border-transparent",
        )}
      >
        <div className="mx-auto flex container! h-14 max-w-400 items-center gap-4 p-3!">
          <Link to="/" className="me-2 flex shrink-0 items-center gap-2 font-heading font-semibold">
            <span className="relative flex size-8 items-center justify-center rounded-full border border-primary/50 text-primary">
              <span className="size-2 rounded-full bg-primary" />
              <span className="absolute h-px w-10 -rotate-20 bg-primary/60" />
            </span>
            <span className="hidden text-lg sm:block">طبيعاوي شاهد</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
            <NavLink to="/" active={pathname === "/"} icon={<HouseIcon />}>
              الرئيسية
            </NavLink>
            <NavLink to="/planets" active={pathname.startsWith("/planets")} icon={<PlanetIcon />}>
              الكواكب
            </NavLink>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <GlobalSearch />
            <Link
              to="/database"
              className="hidden size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/8 hover:text-foreground sm:flex"
            >
              <DatabaseIcon />
              <span className="sr-only">قاعدة البيانات</span>
            </Link>
            <Link
              to="/admin"
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <UserCircleIcon size={21} />
              <span className="sr-only">لوحة الإدارة</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex h-14 items-center justify-around rounded-xl border border-white/10 bg-background/90 px-2 shadow-2xl backdrop-blur-xl lg:hidden"
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
          to="/database"
          active={pathname.startsWith("/database")}
          icon={<DatabaseIcon />}
          label="البيانات"
        />
      </nav>
    </div>
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
        "rounded-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/6 hover:text-foreground",
        active && "bg-white/8 text-foreground",
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
