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
    <article className="watch-page" aria-label="صفحة المشاهدة المباشرة">
      <header className="watch-page-header">
        <div>
          <p className="watch-eyebrow">
            <MonitorPlay className="size-4" aria-hidden="true" />
            المشاهدة المباشرة
          </p>
          <h1>حكايتك، بمعرّف واحد.</h1>
          <p>أدخل معرّف IMDb، وحدّد ما تريد مشاهدته. دون إضافته إلى المكتبة.</p>
        </div>
        <Badge variant="outline">معاينة التصميم</Badge>
      </header>
      <div className="watch-workspace">
        <section className="watch-request" aria-label="تحديد ما تريد مشاهدته">
          <div className="watch-request-heading">
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
          <p className="watch-request-note">
            اختيار فيلم أو مسلسل يدوي في هذه المعاينة؛ لم نتحقق من نوع العنوان بعد.
          </p>
        </section>
        <section className="watch-stage" aria-label="معاينة طلب المشاهدة" aria-live="polite">
          <div className="watch-stage-top">
            <span>
              <span className="watch-stage-dot" />
              {current ? "تم تحديد الطلب" : "بانتظار اختيارك"}
            </span>
            <span>IMDb → {series ? "حلقة" : "فيلم"}</span>
          </div>
          <div className="watch-stage-body">
            <span className="watch-stage-icon">
              {series ? <Tv aria-hidden="true" /> : <Film aria-hidden="true" />}
            </span>
            {current ? (
              <>
                <p className="watch-target-id" dir="ltr">
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
          <div className="watch-stage-bottom">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>لا يُضاف إلى المكتبة، ولا يبدأ تشغيلًا أو تنزيلًا تلقائيًا.</span>
          </div>
        </section>
      </div>
      <section className="watch-tools" aria-label="المصادر والتنزيل والترجمة">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="watch-tool-title">
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
              <h2 className="watch-tool-title">
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
              <h2 className="watch-tool-title">
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
      <footer className="watch-footer">
        هذه الصفحة لمعاينة الواجهة فقط. استخدم مصادر تملك حق الوصول إليها. العناوين خارج المكتبة لا
        تحمل تصنيف العائلة التحريري.
      </footer>
    </article>
  );
}
