import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import type { Work } from "@/features/library/model";
import { FocusContext, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import { posterTrackClass, RailHeader, RailScroller, railActionClass } from "./rail";
import { WorkCard } from "./work-card";

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
  href?:
    | { to: "/planets/$planetSlug"; params: { planetSlug: string } }
    | { to: "/awards/$organizationSlug"; params: { organizationSlug: string } };
  variant?: "poster" | "banner";
}) {
  const railId = useId();
  const firstCardFocusKey = `${railId}:card:0`;
  const { ref: sectionRef, focusKey } = useSpatialFocusable<object, HTMLElement>({
    trackChildren: true,
    preferredChildFocusKey: firstCardFocusKey,
  });
  if (!works.length) return null;
  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={sectionRef} className="scroll-mt-24" aria-labelledby={`rail-${title}`}>
        <RailHeader
          id={`rail-${title}`}
          title={title}
          description={description}
          action={
            href && (
              <Link to={href.to} params={href.params} className={railActionClass}>
                عرض الكل
                <ArrowLeftIcon />
              </Link>
            )
          }
        />
        <RailScroller
          className={
            variant === "banner"
              ? "auto-cols-[86%] gap-3 pb-18 pt-2 sm:auto-cols-[55%] md:auto-cols-[42%] lg:auto-cols-[34%] xl:auto-cols-[28%]"
              : posterTrackClass
          }
        >
          {works.map((work, index) => (
            <WorkCard
              key={[work.id, work.title, work.releaseStart ?? "undated"].join(":")}
              work={work}
              variant={variant}
              spatialFocusKey={`${railId}:card:${index}`}
            />
          ))}
        </RailScroller>
      </section>
    </FocusContext.Provider>
  );
}
