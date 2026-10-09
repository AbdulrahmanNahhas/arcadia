import type { ReactNode } from "react";
export function FieldList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="text-xs leading-relaxed">
      {rows.map(([label, value]) => (
        <div
          className="flex items-baseline justify-between gap-5 border-b border-border py-3"
          key={label}
        >
          <dt className="shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-end wrap-anywhere">
            {value === null || value === undefined || value === "" ? "غير مسجّل" : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8.5">
      <h2 className="mb-5 border-s-[3px] border-foreground ps-3.5 text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
