import {
  BookmarkSimpleIcon,
  GearSixIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "الرئيسية", icon: HouseIcon, exact: true },
  { to: "/browse", label: "تصفح", icon: SquaresFourIcon, exact: false },
  { to: "/archive", label: "مساحتي", icon: BookmarkSimpleIcon, exact: false },
  { to: "/search", label: "بحث", icon: MagnifyingGlassIcon, exact: false },
  { to: "/settings", label: "الإعدادات", icon: GearSixIcon, exact: false },
] as const;

/**
 * The Display Mode frame: a single row of large, filled-on-focus nav pills over a black canvas,
 * 5% safe-area margins, no dropdowns, no admin, no blur. Pages render full-bleed beneath it.
 */
export function DisplayShell({
  children,
  hideNav = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data } = useCurrentAccount();
  const account = data?.account;
  return (
    <div className="min-h-svh bg-black text-white">
      {!hideNav && (
        <header
          data-platform-header
          className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-6 bg-gradient-to-b from-black via-black/70 to-transparent px-[5vw] pb-10 pt-6"
        >
          <nav className="flex items-center gap-2" aria-label="التنقل">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-display-chrome
                  className={cn(
                    "flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold outline-none transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/60",
                  )}
                >
                  <item.icon size={22} weight={active ? "fill" : "regular"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {account && (
            <div className="flex items-center gap-3 text-base text-white/80">
              <span>{account.displayName}</span>
              <AccountAvatar
                avatarKey={account.avatarKey}
                label={account.displayName}
                className="size-11"
              />
            </div>
          )}
        </header>
      )}
      <main className={cn("relative", !hideNav && "pt-28")}>{children}</main>
    </div>
  );
}
