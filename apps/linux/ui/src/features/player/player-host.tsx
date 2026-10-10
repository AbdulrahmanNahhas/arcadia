import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  FolderOpen,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { PlayerSnapshot, PlayerTrack } from "./bridge";
import { PlayerSlider } from "./player-slider";
import type { PlayerController } from "./use-player-snapshot";

import "./player.css";

export type PlayerEpisode = { id: string; title: string; detail?: string; current?: boolean };
type Panel = "source" | "audio" | "subtitle" | "settings" | "episodes";

export function playerTime(seconds: number) {
  const value = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours ? `${hours}:` : ""}${hours ? String(minutes).padStart(2, "0") : minutes}:${String(value % 60).padStart(2, "0")}`;
}

export function trackLabel(track: PlayerTrack) {
  let language = track.language;
  if (language) {
    try {
      language = new Intl.DisplayNames(["ar"], { type: "language" }).of(language) ?? language;
    } catch {
      /* Unknown native language tags remain visible verbatim. */
    }
  }
  return (
    [language, track.title, track.codec, track.external ? "ملف خارجي" : null]
      .filter(Boolean)
      .join(" · ") || `مسار ${track.id}`
  );
}

/** The caller owns library/player switching and native transparency. No video element. */
export function PlayerHost({
  player,
  episodes,
  onSelectEpisode,
  sourcePanel,
}: {
  player: PlayerController;
  episodes?: readonly PlayerEpisode[];
  onSelectEpisode?: (episode: PlayerEpisode) => void;
  sourcePanel?: ReactNode;
}) {
  const snapshot = player.snapshot;
  if (!snapshot?.active || !snapshot.sessionId) return null;
  return (
    <ActivePlayer
      key={snapshot.sessionId}
      player={player}
      snapshot={snapshot}
      episodes={episodes}
      onSelectEpisode={onSelectEpisode}
      sourcePanel={sourcePanel}
    />
  );
}

function ActivePlayer({
  player,
  snapshot: s,
  episodes,
  onSelectEpisode,
  sourcePanel,
}: {
  player: PlayerController;
  snapshot: PlayerSnapshot;
  episodes?: readonly PlayerEpisode[];
  onSelectEpisode?: (episode: PlayerEpisode) => void;
  sourcePanel?: ReactNode;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [idle, setIdle] = useState(false);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = s.sessionId!;
  const hasSource = s.sourceKind !== null;
  const keepVisible =
    s.paused ||
    s.ended ||
    Boolean(s.error || player.error) ||
    Boolean(panel) ||
    focused ||
    player.pending;
  const seekable = s.seekable && s.duration > 0;
  const seek = (seconds: number, relative: boolean) =>
    player.command({
      command: "player.seek",
      payload: {
        sessionId,
        seconds: relative ? seconds : Math.min(s.duration, Math.max(0, seconds)),
        relative,
      },
    });
  const pause = () => {
    if (!hasSource) return;
    if (s.ended && !seekable) return;
    if (s.ended && seekable) seek(0, false);
    player.command({
      command: "player.pause",
      payload: { sessionId, paused: s.ended ? false : !s.paused },
    });
  };
  const mute = () => {
    if (hasSource)
      player.command({ command: "player.mute", payload: { sessionId, muted: !s.muted } });
  };
  const fullscreen = () =>
    player.command({ command: "player.fullscreen", payload: { enabled: !s.fullscreen } });
  const close = () => player.command({ command: "player.close", payload: { sessionId } });
  function wake() {
    setIdle(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdle(true), 3000);
  }
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
    timer.current = setTimeout(() => setIdle(true), 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  // Escape is handled on keydown, before a panel can close and accidentally exit playback.
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (panel) setPanel(null);
        else if (s.fullscreen) fullscreen();
        else close();
        return;
      }
      if (
        panel ||
        (event.target instanceof Element &&
          event.target.closest(
            "button,a,input,select,textarea,[contenteditable=true],[role=slider],[role=menu],[role=dialog],[role=combobox]",
          ))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k") pause();
      else if ((key === "j" || key === "arrowleft") && seekable) seek(-10, true);
      else if ((key === "l" || key === "arrowright") && seekable) seek(10, true);
      else if (key === "m") mute();
      else if (key === "f") fullscreen();
      else return;
      event.preventDefault();
      wake();
    }
    window.addEventListener("keydown", keyboard, true);
    return () => window.removeEventListener("keydown", keyboard, true);
  });
  const hidden = idle && !keepVisible;
  function panelButton(id: Panel, title: string, icon: ReactNode, children: ReactNode) {
    return (
      <Popover
        open={panel === id}
        onOpenChange={(open) => {
          setPanel(open ? id : null);
          wake();
        }}
      >
        <PopoverTrigger
          render={<Button variant="ghost" size="icon-lg" aria-label={title} title={title} />}
        >
          {icon}
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="player-panel" dir="rtl">
          <PopoverHeader>
            <PopoverTitle>{title}</PopoverTitle>
          </PopoverHeader>
          {children}
        </PopoverContent>
      </Popover>
    );
  }
  const trackPicker = (kind: "audio" | "subtitle") => {
    const tracks = s.tracks.filter((track) => track.kind === kind);
    return (
      <>
        <fieldset className="player-track-list" disabled={!hasSource}>
          <legend className="sr-only">{kind === "audio" ? "مسار الصوت" : "مسار الترجمة"}</legend>
          {kind === "subtitle" && (
            <label className="player-track">
              <input
                type="radio"
                name={kind}
                checked={!tracks.some((track) => track.selected)}
                onChange={() =>
                  player.command({
                    command: "player.track",
                    payload: { sessionId, kind, trackId: null },
                  })
                }
              />
              إيقاف الترجمة
            </label>
          )}
          {tracks.map((track) => (
            <label key={track.id} className="player-track">
              <input
                type="radio"
                name={kind}
                checked={track.selected}
                onChange={() =>
                  player.command({
                    command: "player.track",
                    payload: { sessionId, kind, trackId: track.id },
                  })
                }
              />
              <span>{trackLabel(track)}</span>
              {track.selected && <Check aria-hidden="true" />}
            </label>
          ))}
        </fieldset>
        {!tracks.length && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {kind === "audio" ? "لا توجد مسارات صوت" : "لا توجد ترجمة مرفقة"}
              </EmptyTitle>
              <EmptyDescription>
                {kind === "audio"
                  ? hasSource
                    ? "لم يوفّر الملف مسارًا صوتيًا."
                    : "تُقرأ المسارات بعد اختيار مصدر الفيديو."
                  : hasSource
                    ? "يمكنك اختيار ملف ترجمة من جهازك."
                    : "تظهر الترجمات المرفقة بعد فتح الفيديو."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {kind === "subtitle" && (
          <Button
            variant="outline"
            disabled={!hasSource || player.pending}
            onClick={() =>
              player.command({ command: "player.pickSubtitle", payload: { sessionId } })
            }
          >
            <FolderOpen data-icon="inline-start" />
            إضافة ملف ترجمة
          </Button>
        )}
        <FieldGroup>
          <Setting
            label={kind === "audio" ? "تأخير الصوت (ثانية)" : "تأخير الترجمة (ثانية)"}
            value={kind === "audio" ? s.audioDelay : s.subtitleDelay}
            min={-600}
            max={600}
            step={0.1}
            disabled={!hasSource}
            commit={(seconds) =>
              player.command({ command: "player.delay", payload: { sessionId, kind, seconds } })
            }
          />
          {kind === "subtitle" && (
            <>
              <Setting
                label="حجم الترجمة"
                value={s.subtitleSize}
                min={10}
                max={120}
                disabled={!hasSource || player.pending}
                commit={(size) =>
                  player.command({
                    command: "player.subtitleStyle",
                    payload: { sessionId, size, position: s.subtitlePosition },
                  })
                }
              />
              <Setting
                label="موضع الترجمة"
                value={s.subtitlePosition}
                max={100}
                disabled={!hasSource || player.pending}
                commit={(position) =>
                  player.command({
                    command: "player.subtitleStyle",
                    payload: { sessionId, size: s.subtitleSize, position },
                  })
                }
              />
            </>
          )}
        </FieldGroup>
      </>
    );
  };
  return (
    <section
      ref={root}
      className="player-host"
      dir="rtl"
      tabIndex={-1}
      aria-label="مشغّل الفيديو"
      data-controls-hidden={hidden}
      onPointerMove={wake}
      onPointerDown={wake}
      onFocusCapture={(event) => {
        setFocused(event.target !== root.current);
        wake();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <header className="player-top">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="إغلاق المشغّل"
          title="إغلاق المشغّل"
          onClick={close}
        >
          <ArrowRight data-icon="inline-start" />
        </Button>
        <div className="player-title">
          <h1>{s.title || "فيديو محلي"}</h1>
          <p>
            {episodes?.find((episode) => episode.current)?.detail ??
              (s.sourceKind === "local"
                ? "ملف من جهازك"
                : hasSource
                  ? "تشغيل الفيديو"
                  : "معاينة المشغّل · لم يبدأ التشغيل")}
          </p>
        </div>
      </header>
      {!hasSource && !sourcePanel && (
        <div className="player-message">
          <Alert>
            <AlertTitle>اختر مصدر الفيديو</AlertTitle>
            <AlertDescription>
              هذه معاينة واجهة المشغّل. التقدم الحقيقي يبدأ عند فتح فيديو؛ لا تُسجّل هذه المعاينة
              مشاهدة.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {!hasSource && sourcePanel && (
        <section className="player-picker" aria-label="اختيار مصدر المشاهدة">
          <h2 className="text-lg font-semibold">مصادر المشاهدة</h2>
          {sourcePanel}
        </section>
      )}
      {(s.error || player.error) && (
        <div className="player-message">
          <Alert variant="destructive">
            <AlertTitle>تعذّر إكمال التشغيل</AlertTitle>
            <AlertDescription>{s.error ?? player.error?.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {s.buffering && !s.error && (
        <div className="player-buffering" role="status">
          جارٍ تحميل الفيديو…
        </div>
      )}
      <footer className="player-bottom">
        {s.ended && <p className="player-ended">انتهى الفيديو</p>}
        <div className="player-timeline" dir="ltr">
          <PlayerSlider
            label="موضع التشغيل"
            value={s.position}
            max={Math.min(2592000, s.duration) || 1}
            disabled={!seekable}
            format={playerTime}
            commit={(seconds) => seek(seconds, false)}
          />
        </div>
        <div className="player-controls">
          <div className="player-transport" dir="ltr">
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="رجوع 10 ثوانٍ"
              disabled={!seekable}
              onClick={() => seek(-10, true)}
            >
              <RotateCcw data-icon="inline-start" />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={s.ended ? "إعادة التشغيل" : s.paused ? "تشغيل" : "إيقاف مؤقت"}
              disabled={!hasSource || (s.ended && !seekable)}
              onClick={pause}
            >
              {s.paused || s.ended ? (
                <Play data-icon="inline-start" />
              ) : (
                <Pause data-icon="inline-start" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="تقديم 10 ثوانٍ"
              disabled={!seekable}
              onClick={() => seek(10, true)}
            >
              <RotateCw data-icon="inline-start" />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={s.muted ? "إلغاء كتم الصوت" : "كتم الصوت"}
              disabled={!hasSource}
              onClick={mute}
            >
              {s.muted ? (
                <VolumeX data-icon="inline-start" />
              ) : (
                <Volume2 data-icon="inline-start" />
              )}
            </Button>
            <div className="player-volume">
              <PlayerSlider
                label="مستوى الصوت"
                value={s.volume}
                max={100}
                disabled={!hasSource}
                commit={(volume) =>
                  player.command({ command: "player.volume", payload: { sessionId, volume } })
                }
              />
            </div>
            <span className="player-time">
              {playerTime(s.position)} / {s.duration > 0 ? playerTime(s.duration) : "—"}
            </span>
          </div>
          <nav className="player-tools" aria-label="خيارات التشغيل">
            {panelButton(
              "episodes",
              "الحلقات",
              <ListVideo data-icon="inline-start" />,
              episodes?.length ? (
                <div className="player-episodes">
                  {episodes.map((episode) => (
                    <Button
                      key={episode.id}
                      variant={episode.current ? "secondary" : "ghost"}
                      disabled={!onSelectEpisode || episode.current}
                      onClick={() => {
                        onSelectEpisode?.(episode);
                        setPanel(null);
                      }}
                    >
                      {episode.title}
                      {episode.detail && <span>{episode.detail}</span>}
                    </Button>
                  ))}
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>هذا الملف غير مرتبط بحلقات</EmptyTitle>
                    <EmptyDescription>
                      قائمة الحلقات تظهر عند تشغيل عمل مرتبط بالمكتبة.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ),
            )}
            {panelButton(
              "source",
              "مصدر الفيديو",
              <FolderOpen data-icon="inline-start" />,
              <>
                <p className="player-source-title">{s.title}</p>
                <p>
                  {s.sourceKind === "local"
                    ? "ملف محلي اختير من جهازك."
                    : "اختر مصدرًا لبدء التشغيل."}
                </p>
                <Button
                  variant="outline"
                  disabled={player.pending}
                  onClick={() => player.command({ command: "player.pickVideo", payload: {} })}
                >
                  <FolderOpen data-icon="inline-start" />
                  اختيار فيديو آخر
                </Button>
                {hasSource ? (
                  (sourcePanel ?? (
                    <p className="player-note">مصادر الشبكة غير متاحة في هذا الإصدار.</p>
                  ))
                ) : (
                  <p className="player-note">اختر من لوحة المصادر الظاهرة فوق الفيديو.</p>
                )}
              </>,
            )}
            {panelButton(
              "audio",
              "الصوت",
              <AudioLines data-icon="inline-start" />,
              trackPicker("audio"),
            )}
            {panelButton(
              "subtitle",
              "الترجمة",
              <Captions data-icon="inline-start" />,
              trackPicker("subtitle"),
            )}
            {panelButton(
              "settings",
              "إعدادات التشغيل",
              <Settings2 data-icon="inline-start" />,
              <>
                <FieldGroup>
                  <Setting
                    label="سرعة التشغيل"
                    value={s.speed}
                    min={0.25}
                    max={4}
                    step={0.25}
                    disabled={!hasSource}
                    commit={(speed) =>
                      player.command({ command: "player.speed", payload: { sessionId, speed } })
                    }
                  />
                </FieldGroup>
                <dl className="player-diagnostics">
                  <dt>ترميز الفيديو</dt>
                  <dd>{s.videoCodec ?? "غير متاح"}</dd>
                  <dt>فك الترميز العتادي</dt>
                  <dd>{s.hwdec ?? "غير متاح"}</dd>
                </dl>
                <p className="player-note">
                  البث إلى جهاز آخر والمشاهدة الجماعية والنافذة العائمة غير متاحة.
                </p>
              </>,
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={s.fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
              onClick={fullscreen}
            >
              {s.fullscreen ? (
                <Minimize data-icon="inline-start" />
              ) : (
                <Maximize data-icon="inline-start" />
              )}
            </Button>
          </nav>
        </div>
      </footer>
    </section>
  );
}

function Setting({
  label,
  value,
  min = 0,
  max,
  step,
  disabled = false,
  commit,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  commit: (value: number) => void;
}) {
  return (
    <Field data-disabled={disabled}>
      <FieldLabel>
        {label} <bdi>{value}</bdi>
      </FieldLabel>
      <div dir="ltr">
        <PlayerSlider
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          commit={commit}
        />
      </div>
    </Field>
  );
}
