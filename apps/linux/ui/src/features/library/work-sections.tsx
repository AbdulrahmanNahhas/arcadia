import type { WorkDetail } from "@nahhasio/api-contract";
import { Shield } from "lucide-react";

const riskLabels = new Map([
  ["none", "لا يوجد"],
  ["low", "منخفض"],
  ["medium", "متوسط"],
  ["high", "مرتفع"],
]);
const audienceLabels = {
  general: "عام",
  teen: "للمراهقين",
  "young-adult": "للشباب",
  adult: "للبالغين",
};
export function Overview({ work }: { work: WorkDetail }) {
  return (
    <>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90" dir="auto">
        {work.summary || "لم تُضف نبذة لهذا العمل بعد."}
      </p>
      {work.genres.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {work.genres.map((item) => (
            <span
              className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground/85"
              key={item.id}
            >
              {item.labelAr || item.labelEn}
            </span>
          ))}
        </div>
      )}
      {work.planets.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">العوالم</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {work.planets.map((item) => (
              <span
                className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground/85"
                key={item.id}
              >
                {item.nameAr}
              </span>
            ))}
          </div>
        </section>
      )}
      {work.contributions.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">صنّاع العمل</h3>
          {work.contributions.map((item) => (
            <p
              className="flex items-baseline justify-between gap-3 border-b border-border py-2.5"
              key={`${item.id}-${item.roleId}`}
            >
              <span dir="auto">{item.name}</span>
              <small className="shrink-0 text-[10px] text-muted-foreground">
                {item.roleLabelAr || item.roleLabelEn}
              </small>
            </p>
          ))}
        </section>
      )}
    </>
  );
}
export function Family({ work }: { work: WorkDetail }) {
  return (
    <>
      <div className="mb-[22px] flex items-center gap-3 text-primary">
        <Shield size={20} />
        <span>
          {audienceLabels[work.audience]} {work.age && `· ${work.age}`}
        </span>
      </div>
      <dl className="m-0">
        {[
          ["المحتوى الجنسي", work.sexualityRisk],
          ["السلوك", work.behavioralRisk],
          ["العقيدة", work.theologyRisk],
        ].map(([label, value]) => (
          <div className="flex justify-between gap-4 border-b border-border py-3" key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0">{riskLabels.get(value) || value}</dd>
          </div>
        ))}
      </dl>
      {work.contentWarnings && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">تنبيهات المحتوى</h3>
          <p dir="auto">{work.contentWarnings}</p>
        </section>
      )}
      {work.analysisNotes && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">التحليل</h3>
          <p dir="auto">{work.analysisNotes}</p>
        </section>
      )}
      {work.curatorNotes && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">ملاحظات المحرر</h3>
          <p dir="auto">{work.curatorNotes}</p>
        </section>
      )}
    </>
  );
}
export function Details({ work }: { work: WorkDetail }) {
  return (
    <>
      <dl className="m-0">
        <div className="flex justify-between gap-4 border-b border-border py-3">
          <dt>الصيغة</dt>
          <dd>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</dd>
        </div>
        {work.releaseYear && (
          <div className="flex justify-between gap-4 border-b border-border py-3">
            <dt>سنة الإصدار</dt>
            <dd>{work.releaseYear}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-b border-border py-3">
          <dt>الأجزاء</dt>
          <dd>{work.installmentCount}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border py-3">
          <dt>الحلقات</dt>
          <dd>{work.episodeCount}</dd>
        </div>
      </dl>
      {work.installments.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">أجزاء العمل</h3>
          {work.installments.map((item) => (
            <div
              className="flex items-baseline justify-between gap-3 border-b border-border py-2.5"
              key={item.id}
            >
              <span dir="auto">{item.title}</span>
              <small className="shrink-0 text-[10px] text-muted-foreground">
                {item.episodes.length > 0
                  ? `${item.episodes.length} حلقة`
                  : item.kind === "movie"
                    ? "فيلم"
                    : "جزء"}
              </small>
            </div>
          ))}
        </section>
      )}
      {work.aliases.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">أسماء أخرى</h3>
          {work.aliases.map((item) => (
            <p key={item.id} dir="auto">
              {item.title}
            </p>
          ))}
        </section>
      )}
      {work.countries.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">البلدان</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {work.countries.map((item) => (
              <span
                className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground/85"
                key={item.id}
              >
                {item.labelAr || item.labelEn}
              </span>
            ))}
          </div>
        </section>
      )}
      {work.tags.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">الوسوم</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {work.tags.map((item) => (
              <span
                className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground/85"
                key={item.id}
              >
                {item.labelAr || item.labelEn}
              </span>
            ))}
          </div>
        </section>
      )}
      {work.relations.length > 0 && (
        <section className="mt-[26px]">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">أعمال مرتبطة</h3>
          {work.relations.map((item) => (
            <p key={item.id} dir="auto">
              {item.titleAr || item.canonicalTitle}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
