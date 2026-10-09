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
    <section className="home-section">
      <header className="home-section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {href && (
          <a href={href}>
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
