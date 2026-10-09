import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Film } from "lucide-react";
import { useEffect, useState } from "react";

import { gateway } from "../lib/bridge";
export function Artwork({
  id,
  alt,
  className = "",
  priority = false,
}: {
  id?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [element, setElement] = useState<Element | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  const query = useQuery({
    queryKey: ["artwork", id],
    queryFn: ({ signal }) => gateway.artwork(id ?? "", signal),
    enabled: Boolean(id) && (priority || near),
    staleTime: Infinity,
    gcTime: 600000,
  });

  return query.data ? (
    <img
      ref={setElement}
      className={className}
      src={query.data}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  ) : (
    <span
      ref={setElement}
      className={cn(
        className,
        "flex flex-col items-center justify-center gap-2.5 bg-secondary text-center text-xs text-muted-foreground",
      )}
      role="img"
      aria-label={alt}
    >
      <Film className="size-7 opacity-50" aria-hidden="true" />
      <span>{query.isLoading ? "جارٍ تحميل الصورة" : "لا توجد صورة"}</span>
    </span>
  );
}
