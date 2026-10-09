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
  if (!item) return <p className="empty-copy">لا توجد أجزاء مسجّلة لهذا العمل.</p>;
  const episodes = item.episodes
    .filter((e) => `${e.number} ${e.title ?? ""} ${e.summary}`.includes(search))
    .toSorted((a, b) => (sort ? b.position - a.position : a.position - b.position));
  const rating = installmentRating(item.scores ?? {});
  return (
    <>
      <div className="installment-picker">
        {work.installments.map((unit) => (
          <Button
            variant="ghost"
            className={`flex h-auto w-full flex-col items-stretch gap-2 rounded-2xl p-2 text-start font-normal ${unit.id === item.id ? "bg-secondary" : "bg-transparent"}`}
            key={unit.id}
            aria-pressed={unit.id === item.id}
            onClick={() => {
              setSelected(unit.id);
              setSearch("");
            }}
          >
            <Artwork id={pickArtwork(unit.artwork, "poster")?.id ?? work.poster?.id} alt="" />
            <span>{unit.title}</span>
            <small>
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
        <div className="installment-meta">
          <ScoreBadge score={{ rating, scored: rating === null ? 0 : 1, total: 1 }} />
          <span>
            {statusLabels.get(item.status)} · {dateLabel(item.releaseDate)} ·{" "}
            {item.kind === "season" ? "موسم" : item.kind === "movie" ? "فيلم" : "إصدار خاص"}
          </span>
        </div>
        <p className="long-copy">{item.summary}</p>
        <details>
          <summary>بيانات الجزء وتصنيفه</summary>
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
          <div className="episode-controls">
            <Input
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
          <div className="episode-grid">
            {episodes.map((episode) => (
              <article className="episode-card" key={episode.id}>
                <Artwork
                  id={
                    pickArtwork(episode.artwork, "still")?.id ??
                    episode.artwork[0]?.id ??
                    pickArtwork(item.artwork, "banner")?.id
                  }
                  alt=""
                  className="episode-art"
                />
                <div>
                  <h3>
                    {episode.number} · {episode.title || "حلقة بلا عنوان"}
                  </h3>
                  <p className="long-copy">{episode.summary}</p>
                  <p className="muted-copy">
                    {dateLabel(episode.releaseDate)} ·{" "}
                    {episode.runtimeMinutes
                      ? `${episode.runtimeMinutes} دقيقة`
                      : "المدة غير معروفة"}{" "}
                    · {statusLabels.get(episode.releaseState)}
                  </p>
                  <Button variant="outline" disabled>
                    المشغّل في مرحلة لاحقة
                  </Button>
                  <details>
                    <summary>كل بيانات الحلقة</summary>
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
          {episodes.length === 0 && <p className="empty-copy">لا توجد حلقات مطابقة.</p>}
        </Section>
      )}
    </>
  );
}
