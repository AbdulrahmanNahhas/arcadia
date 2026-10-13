import { DownloadQueue } from "./download-queue";

export function DownloadsPage() {
  return (
    <section
      className="mx-auto flex max-w-5xl flex-col gap-7 px-10 py-10 max-[720px]:px-5 max-[720px]:py-7"
      aria-labelledby="downloads-heading"
    >
      <header className="flex flex-col gap-3">
        <h1 id="downloads-heading" className="font-display text-3xl font-semibold">
          التنزيلات
        </h1>
        <p className="text-sm text-muted-foreground">
          التنزيلات على هذا الجهاز، مع التقدم وحالة الحفظ والإيقاف والاستئناف.
        </p>
      </header>
      <DownloadQueue />
    </section>
  );
}
