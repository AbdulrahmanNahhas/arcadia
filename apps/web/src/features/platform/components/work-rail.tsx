import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { WorkCard } from "./work-card";

const FADE_SIZE = 40;

/**
 * Edge fade for the horizontal rail, tracked with an IntersectionObserver instead of the
 * `scroll-fade-x` utility's `animation-timeline: scroll(self inline)`. That CSS-only approach
 * is still buggy for RTL scrollers in Chromium — the fade would randomly drop on hover/scroll
 * because the scroll-timeline progress doesn't map cleanly onto RTL `scrollLeft` semantics.
 * Watching whether the first/last card is actually visible is direction-agnostic and jank-free.
 */
function useEdgeFade() {
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

export function WorkRail({
  title,
  description,
  works,
  href,
  variant = "poster",
}: {
  title: string;
  description?: string;
  works: Work[];
  href?: { to: "/planets/$planetSlug"; params: { planetSlug: string } };
  variant?: "poster" | "banner";
}) {
  const { containerRef, style: fadeStyle } = useEdgeFade();
  if (!works.length) return null;
  return (
    <section className="scroll-mt-24 overflow-hidden" aria-labelledby={`rail-${title}`}>
      <header className="mx-auto mb-5 flex max-w-400 items-end justify-between gap-5 border-s-2 border-primary/50 ps-4 relative right-5">
        <div>
          <h2
            id={`rail-${title}`}
            className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {title}
          </h2>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <Link
            to={href.to}
            params={href.params}
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-primary! hover:border-primary/50! hover:bg-primary/10! duration-200 me-10",
              buttonVariants({ variant: "outline" }),
            )}
          >
            عرض الكل
            <ArrowLeftIcon />
          </Link>
        )}
      </header>
      <div
        ref={containerRef}
        style={fadeStyle}
        className={cn(
          "grid grid-flow-col overflow-x-auto overflow-y-visible overscroll-x-contain scrollbar-none px-4 pt-2",
          variant === "banner"
            ? "auto-cols-[86%] gap-3 pb-18 pt-2 sm:auto-cols-[55%] md:auto-cols-[42%] lg:auto-cols-[34%] xl:auto-cols-[28%]"
            : "auto-cols-[43%] gap-3 pb-5 sm:auto-cols-[28%] md:auto-cols-[21%] lg:auto-cols-[16%] xl:auto-cols-[13.5%]",
        )}
      >
        {works.map((work) => (
          <WorkCard
            key={[work.id, work.title, work.releaseStart ?? "undated"].join(":")}
            work={work}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
