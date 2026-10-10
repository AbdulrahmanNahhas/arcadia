import type { ReactNode } from "react";
import { useId } from "react";

import { useCardNavigation } from "../../components/card-navigation";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../components/ui/empty";
import { Separator } from "../../components/ui/separator";

export function FieldList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="flex min-w-0 flex-col text-sm leading-relaxed">
      {rows.map(([label, value]) => (
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
          key={label}
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 max-w-full text-end whitespace-pre-line wrap-anywhere">
            {value === null || value === undefined || value === "" ? "غير مسجّل" : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const heading = useId();
  return (
    <section className="mb-8 flex min-w-0 flex-col gap-5" aria-labelledby={heading}>
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold md:text-2xl" id={heading}>
          {title}
        </h2>
        {description && (
          <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      <Separator />
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function Disclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  const navigation = useCardNavigation();
  return (
    <details className="min-w-0 rounded-xl border border-border bg-card">
      <summary
        {...navigation}
        className="cursor-pointer rounded-xl px-4 py-3 text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {title}
      </summary>
      <div className="flex min-w-0 flex-col gap-4 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}

export function PanelEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
