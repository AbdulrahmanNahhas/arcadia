import type { FamilyActivity } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Choice } from "../../components/choice";
import { MediaCard } from "../../components/media-card";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { gateway } from "../../lib/bridge";
import { emptyFilters } from "../catalog/filter-model";
import { workLink } from "../shell/navigation";
import { FittedRow } from "./fitted-row";
import { Hero } from "./hero";
import { Shelf } from "./shelf";
function Comment({ item }: { item: FamilyActivity }) {
  const [shown, setShown] = useState(false);
  return (
    <article className="flex gap-3.5 rounded-xl border border-border bg-card p-5 text-xs">
      <Avatar>
        <AvatarFallback>{item.authorName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <strong>{item.authorName}</strong>
        <time className="my-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>
          {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(item.createdAt))}
        </time>
        {item.containsSpoilers && !shown ? (
          <Button variant="outline" size="sm" onClick={() => setShown(true)}>
            إظهار تعليق يحتوي على حرق
          </Button>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">
            {item.body}
          </p>
        )}
        <a className="mt-3 block text-muted-foreground" href={workLink(item.work.id)}>
          {item.work.titleAr || item.work.canonicalTitle}
        </a>
      </div>
    </article>
  );
}
export function HomePage() {
  const filters = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const feed = useQuery({
    queryKey: ["catalog", "home"],
    queryFn: ({ signal }) => gateway.home(signal),
  });
  const recommendations = useQuery({
    queryKey: ["recommendations", undefined],
    queryFn: ({ signal }) => gateway.recommendations(undefined, signal),
  });
  const [planet, setPlanet] = useState("");
  const selected =
    filters.data?.planets.find((p) => p.slug === planet) ??
    filters.data?.planets.find((p) => p.count > 0);
  const upcomingLink = `#/browse?view=installments&filters=${encodeURIComponent(JSON.stringify({ ...emptyFilters(), facets: [{ key: "releaseStatuses", include: ["announced"], exclude: [] }] }))}`;
  return (
    <div className="stremio-home">
      <Hero />
      <div className="home-content">
        <Shelf
          title="آخر تحديثات المكتبة"
          query={{ sort: "updated-desc" }}
          href="#/browse?sort=updated-desc"
        />
        <section className="home-section">
          <div className="home-planet-heading">
            <h2>من عوالمنا</h2>
            <div className="home-planet-choice">
              <Choice
                label="اختر العالم"
                value={selected?.slug ?? ""}
                options={
                  filters.data?.planets.map((p) => ({
                    value: p.slug,
                    label: `${p.icon} ${p.nameAr}`,
                  })) ?? []
                }
                onChange={setPlanet}
              />
            </div>
          </div>
          {selected && (
            <Shelf
              title={`${selected.icon} ${selected.nameAr}`}
              query={{ planet: selected.slug, sort: "updated-desc" }}
              href={`#/planets/${selected.slug}`}
            />
          )}
        </section>
        <section className="home-section" aria-label="أحدث تعليقات العائلة">
          <header className="home-section-heading">
            <h2>أحدث تعليقات العائلة</h2>
          </header>
          <div className="home-comments">
            {feed.data?.comments.map((item) => (
              <Comment key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </div>
          {feed.data?.comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              لا توجد تعليقات أو مراجعات عامة من العائلة بعد.
            </p>
          )}
        </section>
        <section className="home-section" aria-label="الإصدارات القادمة">
          <header className="home-section-heading">
            <h2>الإصدارات القادمة</h2>
            <a href={upcomingLink}>كل القادم</a>
          </header>
          {feed.error && <p role="alert">{feed.error.message}</p>}
          <FittedRow
            items={feed.data?.upcoming ?? []}
            render={(unit) => <MediaCard key={unit.id} installment={unit} />}
          />
          {feed.data?.upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد إصدارات قادمة معلنة حاليًا.</p>
          )}
        </section>
        <section className="home-section" aria-label="التوصيات">
          <header className="home-section-heading">
            <h2>قد يعجبك أيضًا</h2>
            <a href="#/recommendations">عرض الكل</a>
          </header>
          <FittedRow
            items={recommendations.data?.items ?? []}
            render={(work) => <MediaCard key={work.id} work={work} />}
          />
        </section>
      </div>
    </div>
  );
}
