import {
  ActivityIcon,
  BooksIcon,
  GearIcon,
  MapTrifoldIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { AppHeader, HeaderActions, headerGhostButtonClassName } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

type LibraryHeaderProps = {
  compact?: boolean;
};

export function LibraryHeader({ compact = false }: LibraryHeaderProps) {
  return (
    <AppHeader compact={compact}>
      <Link
        to="/"
        className={cn(
          "group flex min-w-0 items-center gap-2.5 rounded-xl p-1",
          "outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label="العودة إلى نحّاسينما"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            "bg-foreground text-background shadow-sm",
            "transition-transform duration-200",
            "group-hover:-rotate-3 group-hover:scale-[1.03]",
          )}
        >
          <BooksIcon weight="duotone" />
        </span>

        <span className="min-w-0 leading-none">
          <strong className="block truncate text-sm font-semibold tracking-tight">نحّاسينما</strong>

          {!compact && (
            <span className="mt-1 block truncate text-[10px] text-muted-foreground">
              أرشيف القصص الشخصي
            </span>
          )}
        </span>
      </Link>

      <HeaderActions>
        <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
          <Link
            to="/entities"
            search={{}}
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "sm",
              }),
              headerGhostButtonClassName,
              "hidden sm:inline-flex",
            )}
          >
            <UsersThreeIcon data-icon="inline-start" />
            الصنّاع
          </Link>

          <Link
            to="/feed"
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "sm",
              }),
              headerGhostButtonClassName,
              "hidden md:inline-flex",
            )}
          >
            <ActivityIcon data-icon="inline-start" />
            النشاط
          </Link>

          <Link
            to="/graph"
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "sm",
              }),
              headerGhostButtonClassName,
              "hidden lg:inline-flex",
            )}
          >
            <MapTrifoldIcon data-icon="inline-start" />
            الخريطة
          </Link>

          <Link
            to="/admin"
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "sm",
              }),
              headerGhostButtonClassName,
              "hidden lg:inline-flex",
            )}
          >
            <GearIcon data-icon="inline-start" />
            الإدارة
          </Link>
        </nav>

        <div className="mx-0.5 h-5 w-px bg-border/70" aria-hidden="true" />

        <ThemeToggle />
      </HeaderActions>
    </AppHeader>
  );
}
