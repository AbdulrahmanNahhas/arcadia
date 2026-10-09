import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import { useState } from "react";

import { Artwork } from "../../components/artwork";
import { ScoreBadge } from "../../components/media-card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ArtworkGallery, MediaFiles, References } from "./data-panel";
import { RiskRows } from "./family-panel";
import { FieldList, Section } from "./field-list";
import { dateLabel, pickArtwork, statusLabels } from "./format";
export function InstallmentsPanel({ work, initial }: { work: WorkDetail; initial?: string }) {
  const [selected, setSelected] = useState(initial ?? work.installments[0]?.id);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(false);
  const item = work.installments.find((unit) => unit.id === selected) ?? work.installments[0];
  if (!item)
    return (
      <p className="text-[13px] leading-[1.9] text-muted-foreground">
        لا توجد أجزاء مسجّلة لهذا العمل.
      </p>
    );
  const episodes = item.episodes
    .filter((e) => `${e.number} ${e.title ?? ""} ${e.summary}`.includes(search))
    .toSorted((a, b) => (sort ? b.position - a.position : a.position - b.position));
  const rating = installmentRating(item.scores ?? {});
  return (
    <>
      <div className="mb-6.25 grid auto-cols-36.25 grid-flow-col gap-4.5 overflow-x-auto pt-3 pb-5.5">
        {work.installments.map((unit) => (
          <Button
            variant="ghost"
            className="flex h-auto w-full flex-col items-stretch gap-2.25 rounded-2xl bg-transparent p-2 text-start font-normal aria-pressed:bg-secondary"
            key={unit.id}
            aria-pressed={unit.id === item.id}
            onClick={() => {
              setSelected(unit.id);
              setSearch("");
            }}
          >
            <Artwork
              id={pickArtwork(unit.artwork, "poster")?.id ?? work.poster?.id}
              alt=""
              className="aspect-2/3 w-full rounded-2xl object-cover [img&]:in-aria-pressed:outline-2 [img&]:in-aria-pressed:outline-offset-4 [img&]:in-aria-pressed:outline-foreground"
            />
            <span className="text-xs font-semibold">{unit.title}</span>
            <small className="text-[10px] text-muted-foreground">
              {unit.kind === "season"
                ? `${unit.episodes.length} حلقة`
                : unit.runtimeMinutes
                  ? `${unit.runtimeMinutes} دقيقة`
                  : "إصدار مستقل"}
            </small>
          </Button>
        ))}
      </div>
      <Section title={item.title}>
        <div className="mb-4.5 flex flex-wrap items-center gap-3.75 text-[13px]">
          <ScoreBadge score={{ rating, scored: rating === null ? 0 : 1, total: 1 }} />
          <span>
            {statusLabels.get(item.status)} · {dateLabel(item.releaseDate)} ·{" "}
            {item.kind === "season" ? "موسم" : item.kind === "movie" ? "فيلم" : "إصدار خاص"}
          </span>
        </div>
        <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">{item.summary}</p>
        <details className="my-3 rounded-[14px] border border-border p-3.75">
          <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
            بيانات الجزء وتصنيفه
          </summary>
          <FieldList
            rows={[
              ["الترتيب", item.position],
              ["المدة", item.runtimeMinutes],
              ["حالة تاريخ الإصدار", statusLabels.get(item.releaseState)],
              ["وجود فيديو مسجّل", item.hasMediaFile ? "نعم · التشغيل لم يُتحقق منه بعد" : "لا"],
              ["المعرّف", item.id],
              ["أضيف في", dateLabel(item.createdAt)],
              ["آخر تحديث", dateLabel(item.updatedAt)],
            ]}
          />
          <RiskRows classification={item.classification} />
          <FieldList
            rows={Object.entries(item.classificationOverrides).map(([key, value]) => [
              key,
              value ?? "موروث من العمل",
            ])}
          />
          <FieldList rows={Object.entries(item.externalIds).map(([key, value]) => [key, value])} />
          <References items={item.externalReferences} />
          <MediaFiles files={item.mediaFiles} />
          <ArtworkGallery images={item.artwork} />
        </details>
      </Section>
      {item.kind === "season" && (
        <Section title="الحلقات">
          <div className="mb-4.5 flex flex-wrap items-center gap-3.75 text-[13px]">
            <Input
              className="min-w-50 flex-1"
              aria-label="ابحث في الحلقات"
              placeholder="رقم الحلقة، اسمها أو ملخصها…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline" onClick={() => setSort(!sort)}>
              {sort ? "الأحدث أولًا" : "الأقدم أولًا"}
            </Button>
            <span>{episodes.length} حلقة</span>
          </div>
          <div className="grid grid-cols-2 gap-6 [@media(max-width:1100px)]:grid-cols-1">
            {episodes.map((episode) => (
              <article
                className="flex gap-4 rounded-[20px] border border-border bg-card p-4.5 [@media(max-width:750px)]:flex-col"
                key={episode.id}
              >
                <Artwork
                  id={
                    pickArtwork(episode.artwork, "still")?.id ??
                    episode.artwork[0]?.id ??
                    pickArtwork(item.artwork, "banner")?.id
                  }
                  alt=""
                  className="h-23.75 w-36.25 shrink-0 rounded-xl object-cover max-[750px]:h-40 max-[750px]:w-full"
                />
                <div className="min-w-0">
                  <h3 className="mb-2.5 text-[15px] leading-[1.8] font-semibold">
                    {episode.number} · {episode.title || "حلقة بلا عنوان"}
                  </h3>
                  <p className="text-xs leading-[2.1] whitespace-pre-line wrap-anywhere">
                    {episode.summary}
                  </p>
                  <p className="text-[13px] leading-[1.9] text-muted-foreground">
                    {dateLabel(episode.releaseDate)} ·{" "}
                    {episode.runtimeMinutes
                      ? `${episode.runtimeMinutes} دقيقة`
                      : "المدة غير معروفة"}{" "}
                    · {statusLabels.get(episode.releaseState)}
                  </p>
                  <Button className="mt-3" variant="outline" disabled>
                    المشغّل في مرحلة لاحقة
                  </Button>
                  <details className="my-3 rounded-[14px] border border-border p-3.75">
                    <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
                      كل بيانات الحلقة
                    </summary>
                    <FieldList
                      rows={[
                        ["رقم الحلقة", episode.number],
                        ["الترتيب", episode.position],
                        ["المعرّف", episode.id],
                        ["وجود فيديو مسجّل", episode.hasMediaFile ? "نعم" : "لا"],
                        ["أضيف في", dateLabel(episode.createdAt)],
                        ["آخر تحديث", dateLabel(episode.updatedAt)],
                      ]}
                    />
                    <RiskRows classification={episode.classification} />
                    <MediaFiles files={episode.mediaFiles} />
                    <ArtworkGallery images={episode.artwork} />
                  </details>
                </div>
              </article>
            ))}
          </div>
          {episodes.length === 0 && (
            <p className="text-[13px] leading-[1.9] text-muted-foreground">لا توجد حلقات مطابقة.</p>
          )}
        </Section>
      )}
    </>
  );
}
