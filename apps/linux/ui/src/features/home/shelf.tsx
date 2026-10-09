import type { CatalogEntry, WorkSummary } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
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
}: {
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
  return (
    <section className={cn("mb-9", className)}>
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
      {result.isLoading && <p role="status">جارٍ تحميل المكتبة…</p>}
      <FittedRow
        items={result.data ?? []}
        render={({ work, entry }) => (
          <MediaCard key={work.id} work={work} entry={entry} mediaType={mediaType} />
        )}
      />
      {result.data?.length === 0 && <NoResults title="لا توجد أعمال هنا بعد" />}
    </section>
  );
}
