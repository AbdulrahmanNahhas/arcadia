import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FADE_SIZE = 40;

/**
 * Edge fade for a horizontal rail, tracked with an IntersectionObserver instead of the
 * `scroll-fade-x` utility's `animation-timeline: scroll(self inline)`. That CSS-only approach
 * is still buggy for RTL scrollers in Chromium — the fade would randomly drop on hover/scroll
 * because the scroll-timeline progress doesn't map cleanly onto RTL `scrollLeft` semantics.
 * Watching whether the first/last card is actually visible is direction-agnostic and jank-free.
 */
export function useEdgeFade() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [{ atStart, atEnd, isRtl }, setEdges] = useState({
    atStart: true,
    atEnd: false,
    isRtl: true,
  });

  useEffect(() => {
    const container = containerRef.current;
    const first = container?.firstElementChild;
    const last = container?.lastElementChild;
    if (!container || !first || !last) return;
    const rtl = getComputedStyle(container).direction === "rtl";
    if (first === last) {
      setEdges({ atStart: true, atEnd: true, isRtl: rtl });
      return;
    }

    let startVisible = true;
    let endVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === first) startVisible = entry.isIntersecting;
          if (entry.target === last) endVisible = entry.isIntersecting;
        }
        setEdges({ atStart: startVisible, atEnd: endVisible, isRtl: rtl });
      },
      // Chromium has a long-standing bug where the trailing inline padding of an RTL overflow
      // container (our px-4) isn't fully scrollable into, so the last card can never quite hit a
      // 0.98 ratio and its edge flickered. rootMargin pads the intersection root by roughly that
      // padding so the last card counts as "reached" without needing pixel-perfect overlap.
      { root: container, rootMargin: "0px 24px 0px 24px", threshold: 0.9 },
    );
    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    atStart && atEnd
      ? undefined
      : (() => {
          const from = isRtl ? "to left" : "to right";
          const sSize = atStart ? 0 : FADE_SIZE;
          const eSize = atEnd ? 0 : FADE_SIZE;
          const mask = `linear-gradient(${from}, transparent 0, #000 ${sSize}px, #000 calc(100% - ${eSize}px), transparent 100%)`;
          return {
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            transition: "mask-image 300ms ease, -webkit-mask-image 300ms ease",
          };
        })();

  return { containerRef, style };
}

/**
 * The one heading treatment every home-page section shares: an accent rule, a title, an optional
 * supporting line, and an optional trailing action. Sections differ in what they lay out *below*
 * the heading (a scrolling rail, a fixed grid, a strip of logos), so only the heading is shared —
 * `railActionClass` keeps every "see all" affordance identical without forcing each section's
 * link through one over-generic typed-router prop.
 */
export function RailHeader({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mx-auto mb-5 px-4 flex max-w-400 items-end justify-between gap-5">
      <div className=" border-s-2 border-primary/50 ps-4">
        <h2 id={id} className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export const railActionClass = cn(
  "flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground transition duration-200 hover:border-primary/50! hover:bg-primary/10! hover:text-primary!",
  buttonVariants({ variant: "outline" }),
);

/** The one poster column-width ladder every rail of 2:3 cards shares (`WorkRail`'s `poster`
 *  variant and the home upcoming rail) — so "posters the same size as everywhere else" stays true
 *  by construction instead of by copies of the same numbers. */
export const posterTrackClass =
  "auto-cols-[43%] gap-3 pb-5 sm:auto-cols-[28%] md:auto-cols-[21%] lg:auto-cols-[16%] xl:auto-cols-[13.5%]";

/** The landscape counterpart for rails of 16:9 cards (the resume rail). Wider columns than the
 *  poster ladder on purpose: a 16:9 frame at poster width would be a stamp, and the whole reason
 *  a resume card is landscape is to give the progress bar and "يتبقى ..." line room to read. */
export const bannerTrackClass =
  "auto-cols-[78%] gap-3 pb-5 pt-2.5 sm:auto-cols-[50%] md:auto-cols-[38%] lg:auto-cols-[30%] xl:auto-cols-[25%]";

/** The scrolling track itself. `className` sets the per-rail column sizing and gap. */
export function RailScroller({ className, children }: { className?: string; children: ReactNode }) {
  const { containerRef, style } = useEdgeFade();
  return (
    <div
      ref={containerRef}
      style={style}
      data-spatial-rail
      className={cn(
        "grid grid-flow-col scroll-fade-x! overflow-x-auto overflow-y-visible overscroll-x-contain scrollbar-none px-4 pt-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
