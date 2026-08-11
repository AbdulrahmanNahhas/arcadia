import { StarIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { kindLabels } from "../filtering";
import type { Work } from "../model";
import { progressUnitLabelAr } from "../translations";

const paletteClasses: Record<string, string> = {
  ember: "from-orange-950 via-rose-900 to-amber-600",
  forest: "from-emerald-950 via-teal-900 to-lime-700",
  ocean: "from-slate-950 via-blue-950 to-cyan-700",
  plum: "from-slate-950 via-violet-950 to-fuchsia-800",
  signal: "from-zinc-950 via-red-950 to-red-600",
};

export function progressText(work: Work) {
  if (work.status === "completed" && !work.progressTotal) return "مكتمل";
  if (!work.progressTotal) {
    return work.progress ? `${work.progress} ${progressUnitLabelAr(work.progressUnit)}` : "لم يبدأ";
  }
  return `${work.progress} / ${work.progressTotal} ${progressUnitLabelAr(work.progressUnit)}`;
}

export function usesProgress(work: Work) {
  return Boolean(work.progressUnit);
}

export function WorkArtwork({
  work,
  image = "poster",
  compact = false,
  showType = true,
  showRating = true,
  className,
}: {
  work: Work;
  image?: "poster" | "logo";
  compact?: boolean;
  showType?: boolean;
  showRating?: boolean;
  className?: string;
}) {
  const artworkType = image === "logo" && work.logoPath ? "logo" : "poster";
  const path = artworkType === "logo" ? work.logoPath : work.imagePath;

  return (
    <div
      className={cn(
        "group/art relative isolate overflow-hidden",
        artworkType === "logo" ? "aspect-square" : "aspect-2/3",
        artworkType === "logo" && path
          ? "bg-white/90 dark:bg-white/85"
          : cn("bg-linear-to-br", paletteClasses[work.palette] ?? paletteClasses.ocean),
        compact ? "rounded-lg" : "rounded-xl",
        className,
      )}
    >
      {path ? (
        <img
          src={path}
          alt=""
          className={cn(
            "size-full transition duration-500 group-hover/art:scale-[1.025]",
            artworkType === "logo" ? "object-contain p-6" : "object-cover",
          )}
        />
      ) : (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-1/4 -right-1/4 size-3/4 rounded-full border border-white/15" />
          <div className="absolute -bottom-1/3 -left-1/4 size-full rotate-12 rounded-[35%] bg-white/10 blur-sm" />
          <div className="absolute inset-x-5 bottom-6 h-px bg-white/25" />
        </div>
      )}

      {!path && (
        <div className="absolute inset-x-5 bottom-8 z-10 text-white">
          <p className="mb-1 text-[10px] font-medium tracking-[0.18em] text-white/65 uppercase">
            {work.creator || "أرشيف نحّاسينما"}
          </p>
          <p className="line-clamp-3 text-lg leading-tight font-semibold tracking-tight">
            {work.arabicTitle || work.title}
          </p>
        </div>
      )}

      {artworkType === "poster" && path && (
        <div className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-black/15" />
      )}

      {showType && (
        <Badge className="absolute top-2.5 left-2.5 border-white/15 bg-black/55 px-2 py-0.5 text-[10px] text-white shadow-sm backdrop-blur-md hover:bg-black/65">
          {kindLabels[work.kind]}
        </Badge>
      )}
      {showRating && work.calculatedRating !== null && (
        <Badge className="absolute top-2.5 right-2.5 gap-1 border-white/15 bg-black/55 px-2 py-0.5 text-[10px] text-white shadow-sm backdrop-blur-md hover:bg-black/65">
          <StarIcon className="size-2.5 text-amber-300" weight="fill" />
          {work.calculatedRating.toFixed(1)}
        </Badge>
      )}
    </div>
  );
}
