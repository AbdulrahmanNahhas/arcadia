import type { FamilyActivity } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, CalendarDays } from "lucide-react";
import { useState } from "react";

import { useCardNavigation } from "../../components/card-navigation";
import { MediaCard } from "../../components/media-card";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "../../components/ui/empty";
import { gateway } from "../../lib/bridge";
import { emptyFilters } from "../catalog/filter-model";
import { workLink } from "../shell/navigation";
import { FittedRow } from "./fitted-row";
import { Hero } from "./hero";
import { PlanetShelves } from "./planet-shelves";
import { Shelf } from "./shelf";
function Comment({ item }: { item: FamilyActivity }) {
  const navigation = useCardNavigation();
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
        <a
          {...navigation}
          className="mt-3 block text-muted-foreground"
          href={workLink(item.work.id)}
        >
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

  const upcomingLink = `#/browse?view=installments&filters=${encodeURIComponent(JSON.stringify({ ...emptyFilters(), facets: [{ key: "releaseStatuses", include: ["announced"], exclude: [] }] }))}`;

  return (
    <div className="min-w-0">
      <Hero />
      <div className="mx-auto max-w-[1700px] px-8.5 pt-7 pb-12.5 max-[800px]:px-5.5 max-[520px]:px-4 max-[520px]:pt-6 max-[520px]:pb-10">
        <Shelf
          title="آخر تحديثات المكتبة"
          catalogQuery={{
            view: "works",
            privacy: "public",
            sort: "updated-desc",
            filters: JSON.stringify(emptyFilters()),
          }}
          href="#/browse?sort=updated-desc"
        />
        <PlanetShelves planets={filters.data?.planets ?? []} />
        <section className="mb-9" aria-label="أحدث تعليقات العائلة">
          <header className="mb-5 flex items-center justify-between gap-4.5">
            <h2 className="text-[21px] leading-[1.6] font-semibold max-[520px]:text-lg">
              أحدث تعليقات العائلة
            </h2>
          </header>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
            {feed.data?.comments.map((item) => (
              <Comment key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </div>
          {feed.data?.comments.length === 0 && (
            <Empty className="border border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircle />
                </EmptyMedia>
                <EmptyTitle>لا توجد تعليقات بعد</EmptyTitle>
                <EmptyDescription>لا توجد تعليقات أو مراجعات عامة من العائلة بعد.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
        <section className="mb-9" aria-label="الإصدارات القادمة">
          <header className="mb-5 flex items-center justify-between gap-4.5">
            <h2 className="text-[21px] leading-[1.6] font-semibold max-[520px]:text-lg">
              الإصدارات القادمة
            </h2>
            <a
              className="inline-flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground"
              href={upcomingLink}
            >
              كل القادم
            </a>
          </header>
          {feed.error && <p role="alert">{feed.error.message}</p>}
          <FittedRow
            items={feed.data?.upcoming ?? []}
            render={(unit) => <MediaCard key={unit.id} installment={unit} />}
          />
          {feed.data?.upcoming.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>لا توجد إصدارات قادمة</EmptyTitle>
                <EmptyDescription>لا توجد إصدارات قادمة معلنة حاليًا.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
