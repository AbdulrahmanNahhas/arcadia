import { StarIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * A clickable 1–5 star rating. Clicking the currently-set value clears it. Shared by every
 * surface that lets a family member rate a title — the My Space library grid
 * (`archive/components/library-panel.tsx`) and the per-card action menu
 * (`work-card-actions.tsx`) — so the same
 * gesture and icon always mean the same thing (see the "predictable affordances" product rule in
 * `docs/v0.3-roadmap.md`).
 */
export function RatingStars({
  value,
  onRate,
  disabled,
  size = "base",
  className,
}: {
  value: number | null;
  onRate: (next: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "base";
  className?: string;
}) {
  return (
    <fieldset className={cn("flex items-center", className)}>
      <legend className="sr-only">تقييمك الشخصي</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`${n} من 5 نجوم`}
          disabled={disabled}
          onClick={() => onRate(value === n ? null : n)}
          className={
            size === "sm"
              ? "flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              : "flex size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          }
        >
          <StarIcon
            weight={value !== null && n <= value ? "fill" : "regular"}
            className={value !== null && n <= value ? "text-primary" : undefined}
          />
        </button>
      ))}
    </fieldset>
  );
}
