import type { CatalogEntry, WorkSummary } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";
import { gateway } from "../../lib/bridge";
import type { CatalogQuery, LibraryQuery } from "../../lib/bridge";
import { FittedRow } from "./fitted-row";
export function Shelf({
  title,
  description,
  query,
  href,
  className,
  heading,
  catalogQuery,
  mediaType,
  layout = "poster",
  showProgress = false,
  hideEmpty = false,
}: {
  layout?: "poster" | "banner";
  showProgress?: boolean;
  hideEmpty?: boolean;
  title?: string;
  description?: string;
  query?: LibraryQuery;
  catalogQuery?: CatalogQuery;
  heading?: ReactNode;
  mediaType?: "movies" | "series";
  href?: string;
  className?: string;
}) {
  const result = useQuery({
    queryKey: ["home", "shelf", catalogQuery ?? query],
    queryFn: async ({ signal }): Promise<Array<{ work: WorkSummary; entry?: CatalogEntry }>> => {
      if (catalogQuery) {
        const page = await gateway.browse({ ...catalogQuery, page: 1, pageSize: 12 }, signal);
        return page.items.map((entry) => ({ work: entry.work, entry }));
      }
      const page = await gateway.works({ ...query, pageSize: 12 }, signal);
      return page.items.map((work) => ({ work, entry: undefined }));
    },
  });
  if (hideEmpty && result.data?.length === 0) return null;
  return (
    <section className={cn("min-w-0", className)}>
      <header className="mb-5 flex items-center justify-between gap-4.5">
        <div>
          {heading ?? (
            <h2 className="text-[21px] leading-[1.6] font-semibold max-[520px]:text-lg">{title}</h2>
          )}
          {description && <p className="mt-1.25 text-xs text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <a
            className="inline-flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground"
            href={href}
          >
            عرض الكل <ArrowLeft size={16} />
          </a>
        )}
      </header>
      {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
      {result.isLoading && (
        <div
          className="grid grid-cols-3 gap-4 sm:grid-cols-6"
          role="status"
          aria-label="جارٍ تحميل المكتبة"
        >
          <Skeleton className="aspect-2/3" />
          <Skeleton className="aspect-2/3" />
          <Skeleton className="aspect-2/3" />
        </div>
      )}
      <FittedRow
        layout={layout}
        items={result.data ?? []}
        render={({ work, entry }) => (
          <div key={work.id} className={cn("min-w-0", showProgress)}>
            <MediaCard
              work={work}
              entry={entry}
              mediaType={mediaType}
              layout={layout}
              showScore={!showProgress}
              showStatus={!showProgress}
            />
            {showProgress && entry?.watchProgress && entry.watchProgress.releasedUnits > 0 && (
              <div className="mt-3 space-y-2 px-1 pb-1">
                <Progress
                  value={Math.min(
                    100,
                    (entry.watchProgress.watchedReleasedUnits / entry.watchProgress.releasedUnits) *
                      100,
                  )}
                  aria-label={`تقدم مشاهدة ${work.titleAr || work.canonicalTitle}`}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {entry.watchProgress.watchedReleasedUnits} من {entry.watchProgress.releasedUnits}{" "}
                  حلقات وإصدارات
                </p>
              </div>
            )}
          </div>
        )}
      />
      {result.data?.length === 0 && <NoResults title="لا توجد أعمال هنا بعد" />}
    </section>
  );
}
