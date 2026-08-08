import { ArrowRightIcon } from "@phosphor-icons/react";

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  compact?: boolean;
};

export function AppHeader({
  children,
  className,
  contentClassName,
  compact = false,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-2 z-50 mx-auto w-[calc(100%-1rem)] max-w-7xl",
        "rounded-2xl border border-border/60",
        "bg-background/85 shadow-sm backdrop-blur-xl",
        "supports-backdrop-filter:bg-background/75",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-2 sm:px-3",
          compact ? "min-h-12" : "min-h-14",
          contentClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}

type PageHeaderTitleProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  icon?: ReactNode;
};

export function PageHeaderTitle({
  title,
  subtitle,
  backTo = "/",
  backLabel = "العودة إلى المكتبة",
  icon,
}: PageHeaderTitleProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link to={backTo} />}
        className="shrink-0 rounded-xl"
      >
        <span className="sr-only">{backLabel}</span>
        <ArrowRightIcon />
      </Button>

      {icon && (
        <span
          className={cn(
            "hidden size-9 shrink-0 items-center justify-center sm:flex",
            "rounded-xl bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <div className="min-w-0">
        <h1 className="truncate font-heading text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

type HeaderActionsProps = {
  children: ReactNode;
  className?: string;
};

export function HeaderActions({ children, className }: HeaderActionsProps) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-1.5", className)}>
      {children}
    </div>
  );
}

export const headerButtonClassName = cn(
  "h-9 rounded-xl px-3",
  "gap-1.5 text-xs font-medium shadow-none",
);

export const headerGhostButtonClassName = cn(
  headerButtonClassName,
  "hover:bg-accent hover:text-accent-foreground",
);

export const headerOutlineButtonClassName = cn(
  headerButtonClassName,
  "border-border/60 bg-background/50",
  "hover:bg-accent hover:text-accent-foreground",
);

export const headerPrimaryButtonClassName = cn(headerButtonClassName, "shadow-xs");
