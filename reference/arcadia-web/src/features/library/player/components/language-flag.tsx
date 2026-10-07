import { cn } from "@/lib/utils";
import type { LanguageInfo } from "../languages";

/**
 * A flag in a fixed-size well so rows line up whether the emoji font renders wide, narrow, or —
 * on a machine without a colour emoji font — as two regional-indicator letters.
 */
export function LanguageFlag({
  language,
  size = "md",
  className,
}: {
  language: LanguageInfo;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-white/8 leading-none",
        size === "md" ? "size-9 text-xl" : "size-7 text-base",
        className,
      )}
    >
      {language.flag}
    </span>
  );
}
