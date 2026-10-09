import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { gateway } from "../../lib/bridge";
import { workLink } from "./navigation";
export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 200);
    return () => clearTimeout(timer);
  }, [text]);
  const works = useQuery({
    queryKey: ["search", q],
    enabled: open && q.length > 0,
    queryFn: ({ signal }) => gateway.works({ q, pageSize: 8 }, signal),
  });
  const facets = useQuery({
    queryKey: ["search", "entities"],
    enabled: open,
    queryFn: ({ signal }) => gateway.facets({ view: "works", privacy: "public" }, signal),
  });
  const related =
    facets.data?.groups
      .filter((g) => ["contributors", "studios", "planets"].includes(g.key))
      .flatMap((g) =>
        g.options
          .filter((o) => q && o.label.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
          .slice(0, 5)
          .map((o) => ({ group: g, ...o })),
      ) ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={input}>
        <DialogHeader>
          <DialogTitle>البحث الشامل</DialogTitle>
          <DialogDescription>
            الأعمال، الأسماء البديلة، الصنّاع والاستوديوهات والكواكب.
          </DialogDescription>
        </DialogHeader>
        <Input
          ref={input}
          aria-label="البحث الشامل"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب ما تبحث عنه…"
        />
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {works.isLoading && <p role="status">جارٍ البحث…</p>}
          {works.error && <p role="alert">{works.error.message}</p>}
          {works.data?.items.map((work) => (
            <a
              className="grid gap-1.25 rounded-xl p-3.25 hover:bg-secondary"
              key={work.id}
              href={workLink(work.id)}
              onClick={() => onOpenChange(false)}
            >
              <strong>{work.titleAr || work.canonicalTitle}</strong>
              <small className="text-[11px] text-muted-foreground">
                {work.canonicalTitle} · {work.releaseYear}
              </small>
            </a>
          ))}
          {related.map((item) => (
            <a
              className="grid gap-1.25 rounded-xl p-3.25 hover:bg-secondary"
              key={`${item.group.key}-${item.value}`}
              href={
                item.group.key === "planets"
                  ? `#/planets/${encodeURIComponent(item.value)}`
                  : `#/${item.group.key === "studios" ? "studios" : "people"}/${encodeURIComponent(item.value)}`
              }
              onClick={() => onOpenChange(false)}
            >
              <strong>{item.label}</strong>
              <small className="text-[11px] text-muted-foreground">
                {item.group.label} · {item.count} عمل
              </small>
            </a>
          ))}
          {q && works.data?.items.length === 0 && related.length === 0 && (
            <p>لا توجد نتائج مطابقة.</p>
          )}
          <a
            className="grid gap-1.25 rounded-xl p-3.25 hover:bg-secondary"
            href={`#/browse?q=${encodeURIComponent(text)}`}
            onClick={() => onOpenChange(false)}
          >
            عرض نتائج المكتبة كاملة
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
