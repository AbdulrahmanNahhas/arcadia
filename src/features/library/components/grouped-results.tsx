import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { WorkGroup } from "../grouping";

export function GroupedResults({
  groups,
  grouped,
  children,
}: {
  groups: WorkGroup[];
  grouped: boolean;
  children: (group: WorkGroup) => React.ReactNode;
}) {
  if (!grouped) return <>{children(groups[0])}</>;

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${toDomId(group.key)}`}>
          <header className="mb-4 flex items-center gap-3">
            <h2 id={`group-${toDomId(group.key)}`} className="text-lg font-semibold tracking-tight">
              {group.label}
            </h2>
            <Badge variant="secondary" className="tabular-nums">
              {group.works.length}
            </Badge>
            <Separator className="flex-1" />
          </header>
          {children(group)}
        </section>
      ))}
    </div>
  );
}

function toDomId(value: string) {
  return encodeURIComponent(value).replaceAll("%", "-");
}
