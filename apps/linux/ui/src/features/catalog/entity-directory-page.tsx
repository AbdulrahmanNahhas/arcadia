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
        <header
          className="entity-detail-header max-w-380 mx-auto pt-7 px-10 pb-3 [&[data-kind=studios]_.entity-detail-image]:w-45 [&[data-kind=studios]_.entity-detail-image]:h-30 [&[data-kind=studios]_.entity-detail-image]:p-5 [&[data-kind=studios]_.entity-detail-image]:object-contain max-[720px]:p-5 max-[720px]:[&[data-kind=studios]_.entity-detail-image]:w-25 max-[720px]:[&[data-kind=studios]_.entity-detail-image]:h-20 max-[720px]:[&[data-kind=studios]_.entity-detail-image]:p-3"
          data-kind={path}
        >
          <a
            href={`#/${path}`}
            className="entity-back inline-flex items-center gap-2 text-muted-foreground text-xs py-3 mb-5"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            العودة إلى {title}
          </a>
          <div className="entity-detail-intro [&_h1]:font-display [&_h1]:text-[42px] [&_h1]:font-semibold [&_h1]:leading-[1.6] [&_h1]:mt-2 flex items-center gap-7 min-w-0 [&_>_div]:min-w-0 [&_h1]:wrap-anywhere max-[720px]:[&_h1]:text-[30px] max-[720px]:gap-4.5 max-[720px]:items-start">
            <Artwork
              id={selected?.artworkId}
              alt={selected?.label ?? title}
              className="entity-detail-image flex w-30 h-37.5 shrink-0 rounded-[16px] object-cover [object-position:top] bg-card max-[720px]:w-20 max-[720px]:h-25"
              fallback={<Icon className="size-10" aria-hidden="true" />}
              priority
            />
            <div>
              <p className="entity-eyebrow flex items-center gap-2 text-primary text-xs">
                {people ? "من وراء الحكاية" : "من فكرة إلى الشاشة"}
              </p>
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
    <section
      className="entity-directory max-w-380 mx-auto pt-12 px-10 pb-8 [&[data-kind=studios]_.entity-directory-grid]:grid-cols-3 [&[data-kind=studios]_.entity-directory-image]:aspect-[16_/_9] [&[data-kind=studios]_.entity-directory-image]:object-contain [&[data-kind=studios]_.entity-directory-image]:p-7.5 max-[1050px]:[&[data-kind=studios]_.entity-directory-grid]:grid-cols-3 max-[1050px]:[&[data-kind=studios]_.entity-directory-grid]:gap-4.5 max-[720px]:py-7 max-[720px]:px-5 max-[720px]:[&[data-kind=studios]_.entity-directory-grid]:grid-cols-2 max-[720px]:[&[data-kind=studios]_.entity-directory-grid]:gt-4.5 max-[720px]:[&[data-kind=studios]_.entity-directory-grid]:gb-3 max-[720px]:[&[data-kind=studios]_.entity-directory-image]:p-4"
      data-kind={path}
      aria-label={`صفحة ${title}`}
    >
      <header className="entity-directory-header flex items-start justify-between gap-5 mb-9 [&_h1]:font-display [&_h1]:text-[42px] [&_h1]:font-semibold [&_h1]:leading-[1.6] [&_h1]:mt-2 [&_p:not(.entity-eyebrow)]:max-w-162.5 [&_p:not(.entity-eyebrow)]:mt-2.5 [&_p:not(.entity-eyebrow)]:text-muted-foreground [&_p:not(.entity-eyebrow)]:text-sm [&_p:not(.entity-eyebrow)]:leading-[1.9] max-[720px]:flex-col max-[720px]:mb-6 max-[720px]:[&_h1]:text-[30px] max-[720px]:[&_p:not(.entity-eyebrow)]:text-xs">
        <div>
          <p className="entity-eyebrow flex items-center gap-2 text-primary text-xs">
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
      <div className="entity-directory-toolbar grid grid-cols-[minmax(0,_1fr)_auto] items-center gap-6 border-y border-border py-5 mb-7 [&_>_[data-slot=input-group]]:max-w-130 max-[720px]:grid-cols-1 max-[720px]:gap-4 max-[720px]:[&_>_div]:min-w-0">
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
          <div className="entity-directory-grid grid grid-cols-4 gap-6 max-[1050px]:grid-cols-3 max-[1050px]:gap-4.5 max-[720px]:grid-cols-2 max-[720px]:gt-4.5 max-[720px]:gb-3">
            {matches.slice(0, limit).map((entity) => (
              <a
                {...navigation}
                key={entity.value}
                href={`#/${path}/${encodeURIComponent(entity.value)}`}
                className="entity-directory-card flex flex-col min-w-0 rounded-[18px] [&:hover_.entity-card-copy_>_svg]:[transform:translateX(-3px)] [&:hover_.entity-card-copy_>_svg]:text-primary [&:hover_.entity-image-frame]:border-muted-foreground"
              >
                <div className="entity-image-frame relative overflow-hidden bg-card border border-border rounded-[18px] [&_>_span.entity-directory-image]:flex [&_>_span.entity-directory-image]:text-muted-foreground [&_>_span.entity-directory-image]:bg-card">
                  <Artwork
                    id={entity.artworkId}
                    alt=""
                    className="entity-directory-image block w-full aspect-[4_/_5] object-cover [object-position:center_top]"
                    fallback={
                      people ? (
                        <span
                          className="entity-monogram font-display text-[72px] font-semibold text-muted-foreground"
                          aria-hidden="true"
                        >
                          {entity.label.charAt(0)}
                        </span>
                      ) : (
                        <Building2 className="size-12" aria-hidden="true" />
                      )
                    }
                  />
                </div>
                <div className="entity-card-copy flex items-center justify-between gap-3 py-4 px-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:leading-[1.6] [&_h2]:wrap-anywhere [&_p]:mt-1.25 [&_p]:text-muted-foreground [&_p]:text-[11px] [&_>_svg]:text-muted-foreground [&_>_svg]:[transition:transform_150ms] max-[720px]:[&_h2]:text-sm motion-reduce:[&_>_svg]:transition-none">
                  <div className="min-w-0">
                    <h2 dir="auto">{entity.label}</h2>
                    <p>{entity.count} عمل في المكتبة</p>
                  </div>
                  <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
          <div className="entity-directory-footer flex flex-wrap items-center justify-between gap-4 mt-6 text-muted-foreground text-xs">
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
