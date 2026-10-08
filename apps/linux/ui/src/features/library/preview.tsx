import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Artwork } from "../../components/artwork";
import { gateway } from "../../lib/bridge";
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
function Overview({ work }: { work: WorkDetail }) {
  return (
    <>
      <p className="work-summary" dir="auto">
        {work.summary || "لم تُضف نبذة لهذا العمل بعد."}
      </p>
      {work.genres.length > 0 && (
        <div className="tags">
          {work.genres.map((item) => (
            <span key={item.id}>{item.labelAr || item.labelEn}</span>
          ))}
        </div>
      )}
      {work.planets.length > 0 && (
        <section className="preview-section">
          <h3>العوالم</h3>
          <div className="tags">
            {work.planets.map((item) => (
              <span key={item.id}>{item.nameAr}</span>
            ))}
          </div>
        </section>
      )}
      {work.contributions.length > 0 && (
        <section className="preview-section">
          <h3>صنّاع العمل</h3>
          {work.contributions.slice(0, 8).map((item) => (
            <p className="credit" key={`${item.id}-${item.roleId}`}>
              <span dir="auto">{item.name}</span>
              <small>{item.roleLabelAr || item.roleLabelEn}</small>
            </p>
          ))}
        </section>
      )}
    </>
  );
}
function Family({ work }: { work: WorkDetail }) {
  return (
    <>
      <div className="family-audience">
        <Shield size={20} />
        <span>
          {audienceLabels[work.audience]} {work.age && `· ${work.age}`}
        </span>
      </div>
      <dl className="risk-list">
        {[
          ["المحتوى الجنسي", work.sexualityRisk],
          ["السلوك", work.behavioralRisk],
          ["العقيدة", work.theologyRisk],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{riskLabels.get(value) || value}</dd>
          </div>
        ))}
      </dl>
      {work.contentWarnings && (
        <section className="preview-section">
          <h3>تنبيهات المحتوى</h3>
          <p dir="auto">{work.contentWarnings}</p>
        </section>
      )}
      {work.analysisNotes && (
        <section className="preview-section">
          <h3>التحليل</h3>
          <p dir="auto">{work.analysisNotes}</p>
        </section>
      )}
      {work.curatorNotes && (
        <section className="preview-section">
          <h3>ملاحظات المحرر</h3>
          <p dir="auto">{work.curatorNotes}</p>
        </section>
      )}
    </>
  );
}
function Details({ work }: { work: WorkDetail }) {
  return (
    <>
      <dl className="risk-list">
        <div>
          <dt>الصيغة</dt>
          <dd>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</dd>
        </div>
        {work.releaseYear && (
          <div>
            <dt>سنة الإصدار</dt>
            <dd>{work.releaseYear}</dd>
          </div>
        )}
        <div>
          <dt>الأجزاء</dt>
          <dd>{work.installmentCount}</dd>
        </div>
        <div>
          <dt>الحلقات</dt>
          <dd>{work.episodeCount}</dd>
        </div>
      </dl>
      {work.installments.length > 0 && (
        <section className="preview-section">
          <h3>أجزاء العمل</h3>
          {work.installments.map((item) => (
            <div className="installment" key={item.id}>
              <span dir="auto">{item.title}</span>
              <small>
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
        <section className="preview-section">
          <h3>أسماء أخرى</h3>
          {work.aliases.map((item) => (
            <p key={item.id} dir="auto">
              {item.title}
            </p>
          ))}
        </section>
      )}
      {work.countries.length > 0 && (
        <section className="preview-section">
          <h3>البلدان</h3>
          <div className="tags">
            {work.countries.map((item) => (
              <span key={item.id}>{item.labelAr || item.labelEn}</span>
            ))}
          </div>
        </section>
      )}
      {work.tags.length > 0 && (
        <section className="preview-section">
          <h3>الوسوم</h3>
          <div className="tags">
            {work.tags.map((item) => (
              <span key={item.id}>{item.labelAr || item.labelEn}</span>
            ))}
          </div>
        </section>
      )}
      {work.relations.length > 0 && (
        <section className="preview-section">
          <h3>أعمال مرتبطة</h3>
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
export function Preview({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["work", id],
    queryFn: ({ signal }) => gateway.work(id, signal),
  });
  const [tab, setTab] = useState("overview");
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && window.matchMedia("(max-width: 800px)").matches) {
        const controls = panel.current?.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled):not([tabindex="-1"])',
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);
  const work = query.data;
  const banner =
    work?.artwork.find((item) => item.role === "banner" && item.isPrimary) ??
    work?.artwork.find((item) => item.role === "banner");
  return (
    <aside ref={panel} className="work-preview" aria-label="معاينة العمل">
      <div className="preview-cover">
        <Artwork id={banner?.id ?? work?.poster?.id} alt="" className="preview-backdrop" />
        <button
          ref={close}
          className="icon-button preview-close"
          aria-label="إغلاق المعاينة"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {work && (
          <div className="preview-heading">
            <p className="eyebrow">
              {work.releaseYear ?? ""} {work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
            </p>
            <h2 dir="auto">{work.titleAr || work.canonicalTitle}</h2>
            {work.titleAr && (
              <p className="original-title" dir="auto">
                {work.canonicalTitle}
              </p>
            )}
          </div>
        )}
      </div>
      {query.isLoading && (
        <p className="preview-body" role="status">
          جارٍ تحميل التفاصيل…
        </p>
      )}
      {query.error && (
        <div className="preview-body">
          <p className="error" role="alert">
            {query.error.message}
          </p>
          <button className="text-button" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        </div>
      )}
      {work && (
        <>
          <div className="preview-tabs" role="tablist" aria-label="تفاصيل العمل">
            {[
              ["overview", "نبذة"],
              ["family", "دليل العائلة"],
              ["details", "التفاصيل"],
            ].map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                onKeyDown={(event) => {
                  const tabs = ["overview", "family", "details"];
                  const index = tabs.indexOf(tab);
                  const next =
                    event.key === "ArrowLeft"
                      ? tabs[(index + 1) % 3]
                      : event.key === "ArrowRight"
                        ? tabs[(index + 2) % 3]
                        : event.key === "Home"
                          ? tabs[0]
                          : event.key === "End"
                            ? tabs[2]
                            : null;
                  if (next) {
                    event.preventDefault();
                    setTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
                aria-controls="preview-panel"
                id={`tab-${value}`}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="preview-body"
            role="tabpanel"
            id="preview-panel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "overview" ? (
              <Overview work={work} />
            ) : tab === "family" ? (
              <Family work={work} />
            ) : (
              <Details work={work} />
            )}
          </div>
          <footer className="preview-footer">
            <button className="primary-button" disabled>
              المشاهدة <ArrowLeft size={18} />
            </button>
            <p>المشغّل والتنزيلات في الخطوة القادمة</p>
          </footer>
        </>
      )}
    </aside>
  );
}
