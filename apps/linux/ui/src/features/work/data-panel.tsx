// oxlint-disable react/no-array-index-key
import type {
  ArtworkAssignment,
  ExternalReference,
  MediaFile,
  WorkDetail,
} from "@nahhasio/api-contract";

import { Artwork } from "../../components/artwork";
import { entityLink } from "../shell/navigation";
import { FieldList, Section } from "./field-list";
import { dateLabel } from "./format";
export function References({ items }: { items: ExternalReference[] }) {
  return (
    <div>
      {items.map((item) => (
        <p className="text-xs leading-[2.2] wrap-anywhere" key={item.id}>
          <b>{item.provider}</b> · {item.externalId}
          {item.url && (
            <span className="block text-muted-foreground" dir="ltr">
              {" "}
              · {item.url}
            </span>
          )}
        </p>
      ))}
    </div>
  );
}
export function MediaFiles({ files }: { files: MediaFile[] }) {
  return (
    <div>
      {files.map((file) => (
        <details className="my-3 rounded-[14px] border border-border p-3.75" key={file.id}>
          <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
            {file.jellyfinLinked ? "فيديو مرتبط بـ Jellyfin" : "فيديو مسجّل"} ·{" "}
            {file.durationSeconds
              ? `${Math.round(file.durationSeconds / 60)} دقيقة`
              : "المدة غير معروفة"}
          </summary>
          <FieldList
            rows={[
              ["معرّف الملف", file.id],
              ["المدة بالثواني", file.durationSeconds],
              ["ارتباط Jellyfin", file.jellyfinLinked ? "نعم" : "لا"],
            ]}
          />
          {file.tracks.map((track) => (
            <FieldList
              key={track.id}
              rows={[
                ["نوع المسار", track.kind],
                ["اللغة", track.language],
                ["العنوان", track.title],
                ["الترميز", track.codec],
                ["رقم المسار", track.streamIndex],
                ["افتراضي", track.isDefault ? "نعم" : "لا"],
                ["إجباري", track.isForced ? "نعم" : "لا"],
              ]}
            />
          ))}
        </details>
      ))}
    </div>
  );
}
export function ArtworkGallery({ images }: { images: ArtworkAssignment[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5.5">
      {images.map((image, index) => (
        // oxlint-disable-next-line react/no-array-index-key
        <figure key={`${image.id}-${image.role}-${index}`}>
          <Artwork
            id={image.id}
            alt={image.originalFilename || image.role}
            className="h-47.5 w-full rounded-[15px] bg-card object-contain"
          />
          <figcaption className="my-3 text-xs">
            {image.role} {image.isPrimary ? "· رئيسية" : ""}
          </figcaption>
          <details className="my-3 rounded-[14px] border border-border p-3.75">
            <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
              معلومات الصورة
            </summary>
            <FieldList
              rows={[
                ["اسم الملف", image.originalFilename],
                ["الأبعاد", `${image.width ?? "؟"} × ${image.height ?? "؟"}`],
                ["حجم الملف", `${Math.round(image.byteSize / 1024)} KiB`],
                ["الصيغة", image.mimeType],
                ["موضع التركيز", `${image.focalX ?? "وسط"} · ${image.focalY ?? "وسط"}`],
                ["معرّف الصورة", image.id],
                ["بصمة الصورة", image.sha256],
                ["الرابط المسجّل", image.url],
              ]}
            />
          </details>
        </figure>
      ))}
    </div>
  );
}
export function DataPanel({ work }: { work: WorkDetail }) {
  return (
    <>
      <Section title="بطاقة السجل">
        <FieldList
          rows={[
            ["الاسم الأصلي", work.canonicalTitle],
            ["الاسم العربي", work.titleAr],
            ["اسم الترتيب", work.sortTitle],
            ["معرّف العمل", work.id],
            ["سنة الإصدار", work.releaseYear],
            ["الصيغة", work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"],
            ["الخصوصية", work.isPrivate ? "عمل خاص" : "عمل عام"],
            ["الأجزاء", work.installmentCount],
            ["الحلقات", work.episodeCount],
            ["اكتمال السجل", work.qualityScore],
            ["التحقق التحريري", dateLabel(work.verifiedAt)],
            ["أضيف في", dateLabel(work.createdAt)],
            ["آخر تحديث", dateLabel(work.updatedAt)],
          ]}
        />
      </Section>
      <Section title="الأسماء البديلة">
        {work.aliases.map((alias) => (
          <FieldList
            key={alias.id}
            rows={[
              ["الاسم", alias.title],
              ["اللغة", alias.language],
              ["نظام الكتابة", alias.script],
              ["اسم مفضّل", alias.isPreferred ? "نعم" : "لا"],
            ]}
          />
        ))}
        {work.aliases.length === 0 && (
          <p className="text-[13px] leading-[1.9] text-muted-foreground">
            لا توجد أسماء بديلة مسجّلة.
          </p>
        )}
      </Section>
      <Section title="تصنيفات الكتالوج">
        <div className="grid grid-cols-2 gap-6.25 [@media(max-width:750px)]:grid-cols-1">
          {[
            { label: "الأنواع الفنية", items: work.genres },
            { label: "الطابع", items: work.tones },
            { label: "الوسوم", items: work.tags },
            { label: "البلدان", items: work.countries },
          ].map((group) => (
            <section key={group.label}>
              <h3 className="text-[17px] font-semibold">{group.label}</h3>
              {group.items.map((item) => (
                <details className="my-3 rounded-[14px] border border-border p-3.75" key={item.id}>
                  <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
                    {item.labelAr || item.labelEn}
                  </summary>
                  <FieldList
                    rows={[
                      ["الاسم الأصلي", item.labelEn],
                      ["الاسم العربي", item.labelAr],
                      ["الوصف", item.descriptionAr || item.descriptionEn],
                      ["الرمز", item.slug],
                      ["المعرّف", item.id],
                    ]}
                  />
                </details>
              ))}
            </section>
          ))}
        </div>
      </Section>
      <Section title="الكواكب">
        {work.planets.map((planet) => (
          <details className="my-3 rounded-[14px] border border-border p-3.75" key={planet.id}>
            <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
              {planet.icon} {planet.nameAr}
            </summary>
            <p>{planet.description}</p>
            <FieldList
              rows={[
                ["الاسم الأصلي", planet.nameEn],
                ["ترتيب إبراز العمل", planet.featuredRank],
                ["الألوان", `${planet.primaryColor} · ${planet.secondaryColor}`],
                ["الرمز", planet.slug],
                ["المعرّف", planet.id],
              ]}
            />
            <a href={entityLink("planets", planet.slug)}>أعمال هذا الكوكب</a>
          </details>
        ))}
      </Section>
      <Section title="الجوائز والتكريمات">
        {work.awards.map((award) => (
          <article className="rounded-[20px] border border-border bg-card p-5.5" key={award.id}>
            <h3 className="text-[17px] font-semibold">
              {award.organizationName} · {award.category}
            </h3>
            <FieldList
              rows={[
                ["السنة", award.year],
                ["النتيجة", award.result === "winner" ? "فائز" : "مرشّح"],
                [
                  "جهة الجائزة",
                  award.organization?.nameAr ||
                    award.organization?.nameEn ||
                    award.organizationSlug,
                ],
                ["وصف الجهة", award.organization?.description],
                ["الفئة", award.awardCategory?.nameAr || award.awardCategory?.nameEn],
                ["وصف الفئة", award.awardCategory?.description],
                ["الحفل", award.ceremony?.label],
                ["تاريخ الحفل", dateLabel(award.ceremony?.heldOn)],
                ["الإصدار", award.ceremony?.edition],
                ["التكريم البارز", award.isFeatured ? "نعم" : "لا"],
                [
                  "الجزء المرتبط",
                  work.installments.find((i) => i.id === award.installmentId)?.title ??
                    award.installmentId,
                ],
                ["المصدر", award.sourceUrl],
                ["ملاحظات", award.notes],
                ["الترتيب", award.position],
                ["موقع الجهة", award.organization?.websiteUrl],
                ["مصدر الحفل", award.ceremony?.sourceUrl],
              ]}
            />
          </article>
        ))}
        {work.awards.length === 0 && (
          <p className="text-[13px] leading-[1.9] text-muted-foreground">
            لم تُسجّل جوائز لهذا العمل.
          </p>
        )}
      </Section>
      <Section title="المعرّفات والمراجع الخارجية">
        <FieldList rows={Object.entries(work.externalIds).map(([key, value]) => [key, value])} />
        <References items={work.externalReferences} />
      </Section>
      <Section title="الصور المحفوظة">
        <ArtworkGallery images={work.artwork} />
      </Section>
    </>
  );
}
