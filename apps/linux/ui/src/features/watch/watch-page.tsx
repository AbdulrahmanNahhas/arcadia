import {
  ArrowLeft,
  Check,
  Download,
  Film,
  Hash,
  MonitorPlay,
  Search,
  ShieldCheck,
  Subtitles,
  Tv,
  Waves,
} from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";

const imdbSchema = z
  .string()
  .regex(/^tt\d{7,10}$/, "أدخل معرّف IMDb مثل tt1234567 أو رابط صفحة العنوان.");
function imdbId(value: string) {
  const trimmed = value.trim();
  if (/^tt\d{7,10}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (
      url.protocol === "https:" &&
      ["imdb.com", "www.imdb.com", "m.imdb.com"].includes(url.hostname)
    )
      return /^\/title\/(tt\d{7,10})(?:\/|$)/.exec(url.pathname)?.[1] ?? "";
  } catch {
    /* A bare IMDb identifier is validated below, not fetched as a URL. */
  }
  return "";
}
type RequestPreview = { id: string; kind: "movie" | "series"; season: number; episode: number };
export function WatchPage() {
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"movie" | "series">("movie");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [attempted, setAttempted] = useState(false);
  const [preview, setPreview] = useState<RequestPreview | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const parsed = imdbSchema.safeParse(imdbId(value));
  const seasonValid = /^\d+$/.test(season) && Number(season) <= 999;
  const episodeValid = /^\d+$/.test(episode) && Number(episode) >= 1 && Number(episode) <= 9999;
  const current =
    preview &&
    parsed.success &&
    preview.id === parsed.data &&
    preview.kind === kind &&
    (kind === "movie" || (preview.season === Number(season) && preview.episode === Number(episode)))
      ? preview
      : null;
  const series = kind === "series";
  return (
    <article
      className="watch-page max-w-380 mx-auto pt-12 px-10 pb-8 max-[720px]:py-7 max-[720px]:px-5"
      aria-label="صفحة المشاهدة المباشرة"
    >
      <header className="watch-page-header flex items-start justify-between gap-5 mb-9 [&_h1]:font-display [&_h1]:text-[42px] [&_h1]:font-semibold [&_h1]:leading-[1.6] [&_h1]:mt-2 [&_p:not(.watch-eyebrow)]:max-w-162.5 [&_p:not(.watch-eyebrow)]:mt-2.5 [&_p:not(.watch-eyebrow)]:text-muted-foreground [&_p:not(.watch-eyebrow)]:text-sm [&_p:not(.watch-eyebrow)]:leading-[1.9] max-[720px]:flex-col max-[720px]:mb-6 max-[720px]:[&_h1]:text-[30px] max-[720px]:[&_p:not(.watch-eyebrow)]:text-xs">
        <div>
          <p className="watch-eyebrow flex items-center gap-2 text-primary text-xs">
            <MonitorPlay className="size-4" aria-hidden="true" />
            المشاهدة المباشرة
          </p>
          <h1>حكايتك، بمعرّف واحد.</h1>
          <p>أدخل معرّف IMDb، وحدّد ما تريد مشاهدته. دون إضافته إلى المكتبة.</p>
        </div>
        <Badge variant="outline">معاينة التصميم</Badge>
      </header>
      <div className="watch-workspace grid grid-cols-[minmax(0,_0.85fr)_minmax(0,_1.15fr)] border border-border rounded-[24px] overflow-hidden mb-7 max-[1050px]:grid-cols-1">
        <section
          className="watch-request min-w-0 p-8 bg-card max-[720px]:p-5.5"
          aria-label="تحديد ما تريد مشاهدته"
        >
          <div className="watch-request-heading flex items-center gap-3.5 mb-7.5 [&_span]:text-primary [&_span]:text-xl [&_span]:font-bold [&_span]:tracking-[-1px] [&_p]:text-[17px] [&_p]:font-semibold">
            <span>IMDb</span>
            <p>ابدأ بالعنوان</p>
          </div>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setAttempted(true);
              if (!parsed.success) {
                input.current?.focus();
                return;
              }
              if (series && (!seasonValid || !episodeValid)) {
                event.currentTarget
                  .querySelector<HTMLInputElement>(
                    !seasonValid ? "#watch-season" : "#watch-episode",
                  )
                  ?.focus();
                return;
              }
              setValue(parsed.data);
              setPreview({
                id: parsed.data,
                kind,
                season: Number(season),
                episode: Number(episode),
              });
            }}
          >
            <FieldGroup>
              <Field data-invalid={attempted && !parsed.success}>
                <FieldLabel htmlFor="watch-imdb">معرّف IMDb أو رابط العنوان</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    ref={input}
                    id="watch-imdb"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="tt1234567"
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                    maxLength={256}
                    aria-invalid={attempted && !parsed.success}
                    aria-describedby="watch-imdb-help watch-imdb-error"
                  />
                  <InputGroupAddon>
                    <Hash />
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription id="watch-imdb-help">
                  الصق المعرّف، أو رابط imdb.com/title/…
                </FieldDescription>
                {attempted && !parsed.success && (
                  <FieldError id="watch-imdb-error">{parsed.error.issues[0]?.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel id="watch-kind-label">ماذا ستشاهد؟</FieldLabel>
                <ToggleGroup
                  aria-labelledby="watch-kind-label"
                  value={[kind]}
                  onValueChange={(values) => {
                    if (values[0] === "movie" || values[0] === "series") setKind(values[0]);
                  }}
                  variant="outline"
                  size="lg"
                >
                  <ToggleGroupItem value="movie">
                    <Film data-icon="inline-start" />
                    فيلم
                  </ToggleGroupItem>
                  <ToggleGroupItem value="series">
                    <Tv data-icon="inline-start" />
                    مسلسل
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
              {series && (
                <FieldGroup className="grid grid-cols-2 gap-4">
                  <Field data-invalid={attempted && !seasonValid}>
                    <FieldLabel htmlFor="watch-season">الموسم</FieldLabel>
                    <Input
                      id="watch-season"
                      type="number"
                      min={0}
                      max={999}
                      step={1}
                      value={season}
                      onChange={(event) => setSeason(event.target.value)}
                      aria-invalid={attempted && !seasonValid}
                      aria-describedby="watch-season-help"
                    />
                    <FieldDescription id="watch-season-help">0 للحلقات الخاصة</FieldDescription>
                    {attempted && !seasonValid && <FieldError>أدخل موسمًا من 0 إلى 999.</FieldError>}
                  </Field>
                  <Field data-invalid={attempted && !episodeValid}>
                    <FieldLabel htmlFor="watch-episode">الحلقة</FieldLabel>
                    <Input
                      id="watch-episode"
                      type="number"
                      min={1}
                      max={9999}
                      step={1}
                      value={episode}
                      onChange={(event) => setEpisode(event.target.value)}
                      aria-invalid={attempted && !episodeValid}
                    />
                    {attempted && !episodeValid && (
                      <FieldError>أدخل حلقة من 1 إلى 9999.</FieldError>
                    )}
                  </Field>
                </FieldGroup>
              )}
              <Button type="submit" size="lg">
                <Search data-icon="inline-start" />
                معاينة الطلب
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
          <p className="watch-request-note mt-5 text-muted-foreground text-[11px] leading-[1.9]">
            اختيار فيلم أو مسلسل يدوي في هذه المعاينة؛ لم نتحقق من نوع العنوان بعد.
          </p>
        </section>
        <section
          className="watch-stage flex min-w-0 flex-col bg-primary-foreground p-7 max-[720px]:p-5.5"
          aria-label="معاينة طلب المشاهدة"
          aria-live="polite"
        >
          <div className="watch-stage-top flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-[11px] [&_>_span:first-child]:flex [&_>_span:first-child]:items-center [&_>_span:first-child]:gap-2">
            <span>
              <span className="watch-stage-dot w-1.25 h-1.25 rounded-full bg-primary" />
              {current ? "تم تحديد الطلب" : "بانتظار اختيارك"}
            </span>
            <span>IMDb → {series ? "حلقة" : "فيلم"}</span>
          </div>
          <div className="watch-stage-body flex min-h-87.5 [flex:1] flex-col items-center justify-center gap-4.5 py-7 px-3 text-center [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:font-semibold [&_p:not(.watch-target-id)]:max-w-82.5 [&_p:not(.watch-target-id)]:text-muted-foreground [&_p:not(.watch-target-id)]:text-xs [&_p:not(.watch-target-id)]:leading-[2] max-[1050px]:min-h-70 max-[720px]:min-h-65">
            <span className="watch-stage-icon grid w-21 h-21 place-items-center border border-border rounded-[24px] text-primary bg-card [&_svg]:w-8 [&_svg]:h-8 [&_svg]:[stroke-width:1.3]">
              {series ? <Tv aria-hidden="true" /> : <Film aria-hidden="true" />}
            </span>
            {current ? (
              <>
                <p
                  className="watch-target-id max-w-full wrap-anywhere text-[32px] tabular-nums tracking-[-1px]"
                  dir="ltr"
                >
                  {current.id}
                </p>
                <h2>
                  {current.kind === "series"
                    ? `الموسم ${current.season} · الحلقة ${current.episode}`
                    : "فيلم"}
                </h2>
                <p>هذا معرّف طلبك، وليس عنوانًا تم جلبه من IMDb.</p>
                <Badge variant="secondary">
                  <Check data-icon="inline-start" />
                  صيغة المعرّف صحيحة
                </Badge>
              </>
            ) : (
              <>
                <h2>المشهد التالي لك.</h2>
                <p>
                  اختر عنوانًا لتجهيز طلبه.
                  <br />
                  لن نعرض مصادر أو تفاصيل غير مؤكدة.
                </p>
              </>
            )}
          </div>
          <div className="watch-stage-bottom flex items-start gap-2.5 text-muted-foreground text-[11px] leading-[1.9] pt-4 border-t border-border [&_svg]:shrink-0 [&_svg]:mt-0.5">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>لا يُضاف إلى المكتبة، ولا يبدأ تشغيلًا أو تنزيلًا تلقائيًا.</span>
          </div>
        </section>
      </div>
      <section
        className="watch-tools grid grid-cols-3 gap-4.5 max-[1050px]:grid-cols-1"
        aria-label="المصادر والتنزيل والترجمة"
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="watch-tool-title flex items-center gap-2.5 [&_svg]:w-4.5 [&_svg]:h-4.5 [&_svg]:text-primary">
                <Waves aria-hidden="true" />
                مصادر التورنت
              </h2>
            </CardTitle>
            <CardDescription>اختيار النسخة والجودة قبل التشغيل.</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Waves />
                </EmptyMedia>
                <EmptyTitle>لم يتم البحث عن مصادر</EmptyTitle>
                <EmptyDescription>
                  البحث بهذا المعرّف غير موصول بعد. لن نعرض نتائج تجريبية كأنها متاحة.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
          {/* TODO(WATCH-01): Resolve a validated IMDb target through the native source adapter; show real availability and errors before enabling playback. */}
          <CardFooter>
            <Button disabled className="w-full">
              <MonitorPlay data-icon="inline-start" />
              البحث عن المصادر
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="watch-tool-title flex items-center gap-2.5 [&_svg]:w-4.5 [&_svg]:h-4.5 [&_svg]:text-primary">
                <Download aria-hidden="true" />
                تنزيل إلى الجهاز
              </h2>
            </CardTitle>
            <CardDescription>نفس المصدر، للمشاهدة لاحقًا.</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Download />
                </EmptyMedia>
                <EmptyTitle>اختر مصدرًا أولًا</EmptyTitle>
                <EmptyDescription>
                  سيظهر حجم الملف وحالة التنزيل بعد توصيل طلب IMDb بالمصادر والتنزيلات.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
          {/* TODO(WATCH-02): Define external-title device metadata ownership and reuse the native download queue; do not manufacture a catalog UUID. */}
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              <Download data-icon="inline-start" />
              تنزيل الفيديو
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="watch-tool-title flex items-center gap-2.5 [&_svg]:w-4.5 [&_svg]:h-4.5 [&_svg]:text-primary">
                <Subtitles aria-hidden="true" />
                الترجمة
              </h2>
            </CardTitle>
            <CardDescription>لغة الترجمة ومطابقتها للنسخة.</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Subtitles />
                </EmptyMedia>
                <EmptyTitle>لا توجد ترجمة محددة</EmptyTitle>
                <EmptyDescription>
                  البحث عن ترجمة أو إرفاق ملف لهذه الصفحة يتطلب ربط طلب المشاهدة بالمشغّل.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
          {/* TODO(WATCH-03): Add provider-backed subtitle results and the scoped native subtitle file picker; preserve cancellation, provenance and file permissions. */}
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              <Subtitles data-icon="inline-start" />
              اختيار ترجمة
            </Button>
          </CardFooter>
        </Card>
      </section>
      <footer className="watch-footer mt-7 pt-5 border-t border-border text-muted-foreground text-[11px] leading-[2]">
        هذه الصفحة لمعاينة الواجهة فقط. استخدم مصادر تملك حق الوصول إليها. العناوين خارج المكتبة لا
        تحمل تصنيف العائلة التحريري.
      </footer>
    </article>
  );
}
