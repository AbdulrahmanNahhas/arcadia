import { ArrowUpLeft, Users } from "lucide-react";
import { useState } from "react";

import { useCardNavigation } from "../../components/card-navigation";
import { Failure, NoResults } from "../../components/status";
import { Input } from "../../components/ui/input";
import { BrowsePage } from "../catalog/browse-page";
import { useEntityDirectory } from "../catalog/use-entity-directory";

export function PeoplePage({ id, params }: { id?: string; params: URLSearchParams }) {
  const navigation = useCardNavigation();
  const result = useEntityDirectory("contributors");
  const [search, setSearch] = useState("");
  const selected = result.entities.find((person) => person.value === id);
  if (id)
    return (
      <>
        <a className="m-6 inline-block text-sm text-muted-foreground" href="#/people">
          العودة إلى الصنّاع
        </a>
        <BrowsePage
          key={id}
          title={selected?.label ?? "أعمال الصانع"}
          path={`/people/${id}`}
          params={params}
          preset={{ key: "contributors", value: id }}
        />
      </>
    );
  const matches = result.entities.filter((person) =>
    person.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className="mx-auto max-w-400 px-6 py-8 sm:px-10" aria-label="صفحة الصنّاع">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <Users className="mb-3 size-7 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold">الصنّاع</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            الأسماء خلف الحكايات، وأعمالهم في مكتبتنا.
          </p>
        </div>
        <Input
          className="w-full sm:w-72"
          aria-label="ابحث في الصنّاع"
          placeholder="اسم الصانع…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <p role="status">جارٍ تحميل الصنّاع…</p>
      ) : matches.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((person) => (
            <a
              {...navigation}
              key={person.value}
              href={`#/people/${encodeURIComponent(person.value)}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span
                className="grid size-16 shrink-0 place-items-center rounded-full bg-secondary text-2xl text-primary"
                aria-hidden="true"
              >
                {person.label.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold" dir="auto">
                  {person.label}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{person.count} عمل في المكتبة</p>
              </div>
              <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : (
        <NoResults title="لا توجد أسماء مطابقة" />
      )}
    </section>
  );
}
