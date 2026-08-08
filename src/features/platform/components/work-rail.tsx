import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { Work } from "@/features/library/model";
import { WorkCard } from "./work-card";

export function WorkRail({
  title,
  description,
  works,
  href,
}: {
  title: string;
  description?: string;
  works: Work[];
  href?: { to: "/planets/$planetSlug"; params: { planetSlug: string } };
}) {
  if (!works.length) return null;
  return (
    <section className="scroll-mt-24" aria-labelledby={`rail-${title}`}>
      <header className="max-w-400 mx-auto mb-5 flex items-end justify-between gap-5">
        <div>
          <h2 id={`rail-${title}`} className="font-heading text-xl font-semibold sm:text-2xl">
            {title}
          </h2>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <Link
            to={href.to}
            params={href.params}
            className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition hover:text-foreground"
          >
            عرض الكل
            <ArrowLeftIcon />
          </Link>
        )}
      </header>
      <div className="grid grid-flow-col auto-cols-[42%] gap-4 overflow-x-auto overscroll-x-contain pb-5 sm:auto-cols-[27%] md:auto-cols-[20%] lg:auto-cols-[15.5%] xl:auto-cols-[13.2%]">
        {works.map((work) => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>
    </section>
  );
}
