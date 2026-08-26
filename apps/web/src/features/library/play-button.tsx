import { PlayIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isDesktopShell } from "./desktop-player";

/**
 * Detects the Tauri shell after mount rather than during render.
 *
 * The same bundle prerenders to static HTML and runs in a plain browser under Playwright, where
 * `window` either does not exist or carries no Tauri globals. Reading it during the first render
 * would make the server and client disagree and produce a hydration mismatch, so the first paint
 * always assumes "browser" and the desktop affordance appears an instant later.
 */
const neverChanges = () => () => {};

export function useIsDesktopShell() {
  // The server snapshot is always `false`, so the prerendered HTML and the first client render
  // agree; the real answer arrives on the next commit. Whether we are inside Tauri never changes
  // during a session, so the subscription is a no-op.
  return useSyncExternalStore(neverChanges, isDesktopShell, () => false);
}

/**
 * The one way into the player. In a browser it degrades to a disabled button that says why,
 * which is also what keeps the existing e2e suite green.
 */
export function PlayFilmButton({
  installmentId,
  titleId,
  label = "تشغيل الفيلم",
  size = "default",
  className,
}: {
  installmentId: string;
  titleId: string;
  label?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const desktop = useIsDesktopShell();

  if (!desktop) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Button size={size} className={className} disabled />}>
          <PlayIcon weight="fill" data-icon="inline-start" /> {label}
        </TooltipTrigger>
        <TooltipContent>متاح في تطبيق سطح المكتب</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to="/player/$installmentId" // TODO: CHANGE!!! to $installmentId
      params={{ installmentId }}
      search={{ titleId }}
      className={cn(buttonVariants({ size }), className)}
    >
      <PlayIcon weight="fill" data-icon="inline-start" /> {label}
    </Link>
  );
}
