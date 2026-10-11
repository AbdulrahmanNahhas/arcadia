import { ArrowLeft, ArrowRight, Building2, Search, Users } from "lucide-react";
import { useState } from "react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Choice } from "../../components/choice";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { BrowsePage } from "./browse-page";
import { useEntityDirectory } from "./use-entity-directory";

export function EntityDirectoryPage({
  type,
  id,
  params,
}: {
  type: "contributors" | "studios";
  id?: string;
  params: URLSearchParams;
}) {
  const people = type === "contributors";
  const path = people ? "people" : "studios";
  const title = people ? "الصنّاع" : "الاستوديوهات";
  const Icon = people ? Users : Building2;
  const result = useEntityDirectory(type);
  const navigation = useCardNavigation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("count");
  const [limit, setLimit] = useState(24);
  const selected = result.entities.find((entity) => entity.value === id);
  const matches = result.entities
    .filter((entity) =>
      entity.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    )
    .toSorted((a, b) =>
      sort === "name"
        ? a.label.localeCompare(b.label, "ar")
        : b.count - a.count || a.label.localeCompare(b.label, "ar"),
    );
  if (id)
    return (
      <article>
        <header className="entity-detail-header" data-kind={path}>
          <a href={`#/${path}`} className="entity-back">
            <ArrowRight className="size-4" aria-hidden="true" />
            العودة إلى {title}
          </a>
          <div className="entity-detail-intro">
            <Artwork
              id={selected?.artworkId}
              alt={selected?.label ?? title}
              className="entity-detail-image"
              fallback={<Icon className="size-10" aria-hidden="true" />}
              priority
            />
            <div>
              <p className="entity-eyebrow">{people ? "من وراء الحكاية" : "من فكرة إلى الشاشة"}</p>
              <h1 dir="auto">{selected?.label ?? (people ? "الصانع" : "الاستوديو")}</h1>
              {selected && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {selected.count} عمل عام في المكتبة
                </p>
              )}
            </div>
          </div>
          {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        </header>
        <BrowsePage
          key={id}
          title="الأعمال في المكتبة"
          path={`/${path}/${id}`}
          params={params}
          preset={{ key: type, value: id }}
        />
      </article>
    );
  return (
    <section className="entity-directory" data-kind={path} aria-label={`صفحة ${title}`}>
      <header className="entity-directory-header">
        <div>
          <p className="entity-eyebrow">
            <Icon className="size-4" aria-hidden="true" />
            {people ? "من وراء الحكاية" : "من فكرة إلى الشاشة"}
          </p>
          <h1>{title}</h1>
          <p>
            {people
              ? "وجوه وأسماء تصنع عوالمنا. اكتشف أعمالهم في مكتبتك."
              : "بيوت الحكايات. اكتشف بصمة كل استوديو وأعماله في مكتبتك."}
          </p>
        </div>
        {result.data && (
          <Badge variant="outline">
            {result.entities.length} {people ? "صانع" : "استوديو"}
          </Badge>
        )}
      </header>
      <div className="entity-directory-toolbar">
        <InputGroup>
          <InputGroupInput
            aria-label={`ابحث في ${title}`}
            placeholder={people ? "ابحث باسم الصانع…" : "ابحث باسم الاستوديو…"}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(24);
            }}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">الترتيب</span>
          <Choice
            label={`ترتيب ${title}`}
            value={sort}
            options={[
              { value: "count", label: "الأكثر أعمالًا" },
              { value: "name", label: "الاسم أبجديًا" },
            ]}
            onChange={(value) => {
              setSort(value);
              setLimit(24);
            }}
          />
        </div>
      </div>
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <p role="status" className="py-12 text-muted-foreground">
          جارٍ تحميل {title}…
        </p>
      ) : matches.length ? (
        <>
          <div className="entity-directory-grid">
            {matches.slice(0, limit).map((entity) => (
              <a
                {...navigation}
                key={entity.value}
                href={`#/${path}/${encodeURIComponent(entity.value)}`}
                className="entity-directory-card"
              >
                <div className="entity-image-frame">
                  <Artwork
                    id={entity.artworkId}
                    alt=""
                    className="entity-directory-image"
                    fallback={
                      people ? (
                        <span className="entity-monogram" aria-hidden="true">
                          {entity.label.charAt(0)}
                        </span>
                      ) : (
                        <Building2 className="size-12" aria-hidden="true" />
                      )
                    }
                  />
                </div>
                <div className="entity-card-copy">
                  <div className="min-w-0">
                    <h2 dir="auto">{entity.label}</h2>
                    <p>{entity.count} عمل في المكتبة</p>
                  </div>
                  <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
          <div className="entity-directory-footer">
            <p role="status">
              {Math.min(limit, matches.length)} من {matches.length} {people ? "صانع" : "استوديو"}
            </p>
            {limit < matches.length && (
              <Button variant="outline" onClick={() => setLimit((value) => value + 24)}>
                عرض المزيد
              </Button>
            )}
          </div>
        </>
      ) : (
        <NoResults
          title={people ? "لا توجد أسماء مطابقة" : "لا توجد استوديوهات مطابقة"}
          description="جرّب اسمًا آخر أو امسح البحث لعرض الجميع."
        />
      )}
    </section>
  );
}
