import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
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
  href?: { to: "/planets/$planetSlug"; params: { planetSlug: string } };
  variant?: "poster" | "banner";
}) {
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
        className={cn(
          "grid grid-flow-col overflow-x-auto overflow-y-visible  overscroll-x-contain scrollbar-none px-4 pt-2",
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
