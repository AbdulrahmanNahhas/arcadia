import { PageHeader } from "@/features/dashboard/page-header";

import { ArtworkSearchPanel } from "./artwork-search-panel";
export function ImportsPage() {
  return (
    <>
      <PageHeader
        title="TMDB وFanart"
        description="بحث في الصور ومعاينة المواسم من المصادر الحالية؛ حفظ الصور بعد اختيارها."
        eyebrow="قاعدة البيانات / الاستيراد"
      />
      <ArtworkSearchPanel />
    </>
  );
}
