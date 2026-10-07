import { useId } from "react";
import { FocusContext, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import { cn } from "@/lib/utils";
import { DisplayCard, type DisplayCardItem } from "./display-card";

/**
 * A horizontal shelf of Display cards. One focus section per rail so left/right stay inside it
 * and up/down move between rails; the track scrolls the selected card into its safe area.
 */
export function DisplayRail({
  title,
  items,
  variant = "poster",
  onFocusItem,
  className,
}: {
  title: string;
  items: DisplayCardItem[];
  variant?: "poster" | "banner";
  onFocusItem?: (item: DisplayCardItem) => void;
  className?: string;
}) {
  const railId = useId();
  const { ref, focusKey } = useSpatialFocusable<object, HTMLElement>({
    trackChildren: true,
    preferredChildFocusKey: `${railId}:0`,
  });
  if (items.length === 0) return null;
  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} data-display-rail className={cn("flex flex-col gap-3", className)}>
        <h2 className="px-[5vw] font-heading text-xl font-semibold text-white/90">{title}</h2>
        <div
          data-spatial-rail
          className="flex snap-x gap-5 overflow-x-auto px-[5vw] pb-6 pt-3 [scrollbar-width:none]"
        >
          {items.map((item, index) => (
            <DisplayCard
              key={item.id}
              item={item}
              variant={variant}
              focusKey={`${railId}:${index}`}
              onFocus={onFocusItem}
            />
          ))}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
