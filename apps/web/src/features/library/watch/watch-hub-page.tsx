import { FilmSlateIcon, MonitorPlayIcon, PlayIcon, TelevisionIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { cn } from "@/lib/utils";
import { useIsDesktopShell } from "../play-button";
import { parseImdbInput } from "./api";

type Kind = "movie" | "series";

/**
 * `/watch` — play anything by IMDb id, outside the catalog. Deliberately minimal: an id, a
 * film/series switch, season + episode for a series, and the regular player. No artwork, no
 * saving, no downloads; the point is "I have a tt… id, show it to me".
 */
export function WatchHubPage() {
  const navigate = useNavigate();
  const desktop = useIsDesktopShell();
  const [raw, setRaw] = useState("");
  const [kind, setKind] = useState<Kind>("movie");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const imdbId = parseImdbInput(raw);
  const seasonNumber = Number.parseInt(season, 10);
  const episodeNumber = Number.parseInt(episode, 10);
  const seriesValid =
    kind === "movie" ||
    (Number.isInteger(seasonNumber) &&
      seasonNumber >= 0 &&
      Number.isInteger(episodeNumber) &&
      episodeNumber >= 1);
  const ready = Boolean(imdbId) && seriesValid && desktop;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!imdbId) {
      setError("أدخل معرّف IMDb بصيغة tt0133093 أو رابط الصفحة على IMDb.");
      return;
    }
    if (!seriesValid) {
      setError("رقم الموسم والحلقة يجب أن يكونا أعداداً صحيحة.");
      return;
    }
    setError(null);
    void navigate({
      to: "/player/watch",
      search: {
        imdbId,
        season: kind === "series" ? seasonNumber : null,
        episode: kind === "series" ? episodeNumber : null,
        origin: "/watch",
      },
    });
  };

  return (
    <PlatformShell>
      <div className="mx-auto max-w-xl px-5 py-10 sm:px-8">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary">
            <MonitorPlayIcon size={16} weight="fill" />
            <span>خارج الأرشيف</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            مركز المشاهدة
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            الصق معرّف IMDb (أو رابط الصفحة) وشغّله في المشغّل نفسه — المصادر والترجمات ومسارات الصوت
            كما في أي عمل. لا يُحفظ شيء ولا يُنزَّل.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex flex-col gap-2 text-sm">
            <label htmlFor="watch-imdb" className="font-medium">
              معرّف IMDb
            </label>
            <Input
              id="watch-imdb"
              dir="ltr"
              placeholder="tt0133093 أو https://www.imdb.com/title/tt0133093/"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              autoFocus
              className="font-mono"
              aria-invalid={raw.length > 0 && !imdbId ? true : undefined}
            />
            {raw.length > 0 && (
              <span
                className={cn("text-xs", imdbId ? "text-muted-foreground" : "text-destructive")}
              >
                {imdbId ? `سيُشغَّل: ${imdbId}` : "لم يُتعرَّف على معرّف صالح بعد"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <KindButton
              active={kind === "movie"}
              onClick={() => setKind("movie")}
              icon={<FilmSlateIcon size={18} />}
              label="فيلم"
              hint="المعرّف يكفي"
            />
            <KindButton
              active={kind === "series"}
              onClick={() => setKind("series")}
              icon={<TelevisionIcon size={18} />}
              label="مسلسل"
              hint="موسم وحلقة"
            />
          </div>

          {kind === "series" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2 text-sm">
                <label htmlFor="watch-season" className="font-medium">
                  الموسم
                </label>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  id="watch-season"
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <label htmlFor="watch-episode" className="font-medium">
                  الحلقة
                </label>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  id="watch-episode"
                  value={episode}
                  onChange={(event) => setEpisode(event.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={!ready} className="w-full">
            <PlayIcon weight="fill" data-icon="inline-start" /> شاهد الآن
          </Button>
          {!desktop && (
            <p className="text-center text-xs text-muted-foreground">
              التشغيل متاح في تطبيق سطح المكتب فقط.
            </p>
          )}
        </form>
      </div>
    </PlatformShell>
  );
}

function KindButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <span className={cn(active ? "text-primary" : "")}>{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs">{hint}</span>
      </span>
    </button>
  );
}
