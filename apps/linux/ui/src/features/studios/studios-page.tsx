import { ArrowUpLeft, Building2 } from "lucide-react";
import { useState } from "react";

import { useCardNavigation } from "../../components/card-navigation";
import { Failure, NoResults } from "../../components/status";
import { Input } from "../../components/ui/input";
import { BrowsePage } from "../catalog/browse-page";
import { useEntityDirectory } from "../catalog/use-entity-directory";

export function StudiosPage({ id, params }: { id?: string; params: URLSearchParams }) {
  const navigation = useCardNavigation();
  const result = useEntityDirectory("studios");
  const [search, setSearch] = useState("");
  const selected = result.entities.find((studio) => studio.value === id);
  if (id)
    return (
      <>
        <a className="m-6 inline-block text-sm text-muted-foreground" href="#/studios">
          العودة إلى الاستوديوهات
        </a>
        <BrowsePage
          key={id}
          title={selected?.label ?? "أعمال الاستوديو"}
          path={`/studios/${id}`}
          params={params}
          preset={{ key: "studios", value: id }}
        />
      </>
    );
  const matches = result.entities
    .filter((studio) =>
      studio.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    )
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"));
  return (
    <section className="mx-auto max-w-400 px-6 py-8 sm:px-10" aria-label="صفحة الاستوديوهات">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <Building2 className="mb-3 size-7 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold">الاستوديوهات</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            دور الإنتاج واستوديوهاتها، مرتبة بعدد أعمالها في المكتبة.
          </p>
        </div>
        <Input
          className="w-full sm:w-72"
          aria-label="ابحث في الاستوديوهات"
          placeholder="اسم الاستوديو…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <p role="status">جارٍ تحميل الاستوديوهات…</p>
      ) : matches.length ? (
        <div className="grid gap-3">
          {matches.map((studio) => (
            <a
              {...navigation}
              key={studio.value}
              href={`#/studios/${encodeURIComponent(studio.value)}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-5 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                <Building2 className="size-6" aria-hidden="true" />
              </span>
              <h2 className="min-w-0 flex-1 truncate text-lg font-semibold" dir="auto">
                {studio.label}
              </h2>
              <span className="shrink-0 text-sm text-muted-foreground">{studio.count} عمل</span>
              <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : (
        <NoResults title="لا توجد استوديوهات مطابقة" />
      )}
    </section>
  );
}
