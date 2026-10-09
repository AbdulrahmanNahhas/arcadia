import type { FamilyActivity } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Artwork } from "../../components/artwork";
import { MediaCard } from "../../components/media-card";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { gateway } from "../../lib/bridge";
function Comment({ item, onSelect }: { item: FamilyActivity; onSelect: (id: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <article className="flex gap-3.5 rounded-xl border border-border bg-card p-[18px]">
      <Artwork
        id={item.work.poster?.id}
        alt=""
        className="h-[92px] w-[62px] shrink-0 rounded-lg object-cover"
      />
      <div className="flex min-w-0 flex-col gap-2.5">
        <header className="flex flex-wrap items-center gap-2 text-xs">
          <Avatar size="sm">
            <AvatarFallback>{item.authorName.charAt(0)}</AvatarFallback>
          </Avatar>
          <b dir="auto">{item.authorName}</b>
          <time className="text-[10px] text-muted-foreground" dateTime={item.createdAt}>
            {new Intl.DateTimeFormat("ar", { dateStyle: "short" }).format(new Date(item.createdAt))}
          </time>
          {item.kind === "review" && <Badge variant="outline">مراجعة · {item.rating}/5</Badge>}
        </header>
        {item.containsSpoilers && !revealed ? (
          <Button variant="outline" size="sm" onClick={() => setRevealed(true)}>
            إظهار تعليق يحتوي على حرق
          </Button>
        ) : (
          <p dir="auto">{item.body}</p>
        )}
        <Button variant="link" size="sm" onClick={() => onSelect(item.work.id)}>
          {item.work.titleAr || item.work.canonicalTitle}
        </Button>
      </div>
    </article>
  );
}
export function HomeFeed({ onSelect }: { onSelect: (id: string, installmentId?: string) => void }) {
  const result = useQuery({
    queryKey: ["catalog", "home"],
    queryFn: ({ signal }) => gateway.home(signal),
  });
  return (
    <>
      <section className="mb-10" aria-label="أحدث تعليقات العائلة">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">أحدث تعليقات العائلة</h2>
        </header>
        {result.error && (
          <p
            className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
            role="alert"
          >
            {result.error.message}
            <Button variant="ghost" onClick={() => void result.refetch()}>
              إعادة المحاولة
            </Button>
          </p>
        )}
        {result.isLoading && (
          <p className="text-muted-foreground" role="status">
            جارٍ تحميل نشاط العائلة…
          </p>
        )}
        {result.data &&
          (result.data.comments.length ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              {result.data.comments.map((item) => (
                <Comment key={`${item.kind}-${item.id}`} item={item} onSelect={onSelect} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا توجد تعليقات أو مراجعات عامة من العائلة بعد.
            </p>
          ))}
      </section>
      <section className="mb-10" aria-label="أكثر الأعمال المرتقبة">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">أكثر الأعمال المرتقبة</h2>
          <span className="text-sm text-muted-foreground">الأقرب موعدًا أولًا</span>
        </header>
        {result.isLoading && (
          <p className="text-muted-foreground" role="status">
            جارٍ تحميل الإصدارات القادمة…
          </p>
        )}
        {result.data &&
          (result.data.upcoming.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-[18px] gap-y-6">
              {result.data.upcoming.map((item) => (
                <MediaCard key={item.id} installment={item} onSelect={onSelect} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا توجد أجزاء قادمة معلنة في المكتبة حاليًا.
            </p>
          ))}
      </section>
    </>
  );
}
