import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { MediaCard } from "../../components/media-card";
import { Failure } from "../../components/status";
import { gateway } from "../../lib/bridge";
import type { LibraryQuery } from "../../lib/bridge";
import { FittedRow } from "./fitted-row";
export function Shelf({
  title,
  description,
  query,
  href,
}: {
  title: string;
  description?: string;
  query: LibraryQuery;
  href?: string;
}) {
  const result = useQuery({
    queryKey: ["home", "shelf", query],
    queryFn: ({ signal }) => gateway.works({ ...query, pageSize: 12 }, signal),
  });
  return (
    <section className="mb-9">
      <header className="mb-5 flex items-center justify-between gap-4.5">
        <div>
          <h2 className="text-[21px] leading-[1.6] font-semibold max-[520px]:text-lg">{title}</h2>
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
        items={result.data?.items ?? []}
        render={(work) => <MediaCard key={work.id} work={work} />}
      />
    </section>
  );
}
