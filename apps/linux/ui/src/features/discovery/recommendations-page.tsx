import { useQuery } from "@tanstack/react-query";

import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { gateway } from "../../lib/bridge";
export function Recommendations({ workId }: { workId?: string }) {
  const result = useQuery({
    queryKey: ["recommendations", workId],
    queryFn: ({ signal }) => gateway.recommendations(workId, signal),
  });
  return (
    <section
      className="my-14 [content-visibility:auto] [contain-intrinsic-size:auto_400px] max-[750px]:my-10"
      aria-label="التوصيات"
    >
      <header className="mb-6 flex items-center justify-between gap-6.25 max-[750px]:items-start max-[750px]:gap-3.75">
        <div>
          <h2 className="border-s-[3px] border-foreground ps-3.5 text-[clamp(23px,2.1vw,32px)] leading-normal font-bold">
            {workId ? "قد يعجبك أيضًا" : "ما الذي تكتشفه بعد ذلك؟"}
          </h2>
          <p className="mt-2.25 text-[13px] leading-[1.9] text-muted-foreground max-[750px]:text-[11px]">
            {result.data?.basis === "personal"
              ? "تصنيفات وكواكب مشتركة مع مفضّلتك وتقييماتك الشخصية."
              : result.data?.basis === "related"
                ? "أعمال تتقاطع مع تصنيفات هذا العمل وكواكبه."
                : "اختيارات من تقييمات الكتالوج؛ لم تُسجّل تفضيلات شخصية لهذا الحساب بعد."}
          </p>
        </div>
      </header>
      {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
      {result.isLoading && <p role="status">جارٍ إعداد الاقتراحات…</p>}
      <div className="my-7 grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-x-5.5 gap-y-7.5 max-[750px]:grid-cols-2 max-[750px]:gap-x-3.5 max-[750px]:gap-y-6">
        {result.data?.items.map((work) => (
          <MediaCard key={work.id} work={work} />
        ))}
      </div>
      {result.data?.items.length === 0 && (
        <NoResults
          title="لا توجد اقتراحات بعد"
          description="تظهر الاقتراحات حين تتوفر أعمال عامة في الكتالوج."
        />
      )}
    </section>
  );
}
export function RecommendationsPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-[clamp(20px,4vw,64px)] pt-33.75 pb-17.5 max-[750px]:pt-40">
      <header className="mb-8 flex items-center justify-between gap-6 max-[750px]:flex-col max-[750px]:items-start max-[750px]:gap-3.5">
        <h1 className="text-[clamp(28px,3vw,42px)] leading-[1.7] font-bold">
          اكتشف حكايتك التالية
        </h1>
      </header>
      <Recommendations />
    </div>
  );
}
