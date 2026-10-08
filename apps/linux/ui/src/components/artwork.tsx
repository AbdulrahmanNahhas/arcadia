import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";

import { gateway } from "../lib/bridge";
export function Artwork({
  id,
  alt,
  className = "",
}: {
  id?: string | null;
  alt: string;
  className?: string;
}) {
  const query = useQuery({
    queryKey: ["artwork", id],
    queryFn: ({ signal }) => gateway.artwork(id ?? "", signal),
    enabled: Boolean(id),
    staleTime: Infinity,
    gcTime: 600000,
  });
  return query.data ? (
    <img className={className} src={query.data} alt={alt} loading="lazy" />
  ) : (
    <span className={`artwork-placeholder ${className}`} role="img" aria-label={alt}>
      <Film aria-hidden="true" />
      <span>{query.isLoading ? "جارٍ تحميل الصورة" : "لا توجد صورة"}</span>
    </span>
  );
}
