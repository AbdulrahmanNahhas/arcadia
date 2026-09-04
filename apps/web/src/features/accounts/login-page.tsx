import { ar } from "@arcadia/i18n";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  GearSixIcon,
  LockKeyIcon,
  UsersThreeIcon,
  WarningCircleIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useIsDesktopShell } from "@/features/library/play-button";
import { apiBaseUrl, apiBaseUrlDefault, setApiUrlOverride } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

/** `AbortSignal.timeout` keeps a wrong/unreachable address from hanging the test forever — the
 *  exact failure mode this whole panel exists to get out of. */
async function pingServer(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    const response = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Reachable *before* login on purpose. The equivalent setting in Settings (المظهر → عنوان
 * الخادم) is useless for exactly the situation that needs it most: a release built pointing at
 * the wrong server address, with no way to log in and therefore no way to reach Settings at all
 * to fix it. Same desktop-shell gating, same override mechanism (`setApiUrlOverride`) — just
 * reachable from the one screen that doesn't require already being logged in.
 */
function ServerAddressPanel({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const isDesktop = useIsDesktopShell();
  const [value, setValue] = useState(apiBaseUrl);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "failed">("idle");

  if (!isDesktop) return null;

  async function test() {
    setTestState("testing");
    setTestState((await pingServer(value)) ? "ok" : "failed");
  }

  async function apply() {
    setError(null);
    setRestarting(true);
    try {
      new URL(value); // throws on garbage input before setApiUrlOverride ever gets to it
      await setApiUrlOverride(value);
      // Relaunches the app on success — this only resumes running if that failed.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "عنوان الخادم غير صالح.");
      setRestarting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <GearSixIcon /> لا يعمل الدخول؟ إعداد الخادم ({apiBaseUrl})
      </button>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border/70 bg-card/50 p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <WifiHighIcon /> عنوان خادم أركاديا
      </div>
      <p className="text-xs text-muted-foreground">
        عنوان جهاز العائلة الذي يستضيف قاعدة البيانات وواجهة أركاديا، مثل{" "}
        <span dir="ltr">http://192.168.1.50:23101</span>.
      </p>
      <Field>
        <Input
          dir="ltr"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setTestState("idle");
          }}
        />
      </Field>
      {testState === "ok" && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-500">
          <CheckCircleIcon weight="fill" /> الخادم يستجيب على هذا العنوان.
        </p>
      )}
      {testState === "failed" && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <WarningCircleIcon weight="fill" /> تعذّر الوصول إلى هذا العنوان — تحقّق من الشبكة والمنفذ.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={test}
          disabled={testState === "testing" || restarting}
        >
          {testState === "testing" ? "يختبر…" : "اختبار الاتصال"}
        </Button>
        <Button type="button" size="sm" onClick={apply} disabled={restarting}>
          {restarting ? "يعيد التشغيل…" : "حفظ وإعادة التشغيل"}
        </Button>
        {value !== apiBaseUrlDefault && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(apiBaseUrlDefault);
              setTestState("idle");
            }}
            disabled={restarting}
          >
            إعادة الضبط الافتراضي
          </Button>
        )}
      </div>
    </div>
  );
}

export function LoginPage() {
  const search = useSearch({ strict: false }) as { next?: string };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [serverPanelOpen, setServerPanelOpen] = useState(false);

  useEffect(() => setInteractive(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await authClient.signIn.username({ username, password, rememberMe: true });
      if (result.error) {
        setMessage(ar.auth.invalidCredentials);
        return;
      }
      window.location.assign(search.next?.startsWith("/") ? search.next : "/");
    } catch {
      // The request never reached (or never returned from) the server at all — offline, wrong
      // address, or the address genuinely refuses the connection. Distinct from a *reachable*
      // server rejecting bad credentials, which resolves `result.error` above instead of
      // throwing. Opening the panel here is the whole point of building it: this is exactly the
      // moment "stuck on Loading forever with no way to fix it" used to happen.
      setMessage("تعذّر الوصول إلى الخادم. تحقّق من عنوان الخادم أدناه.");
      setServerPanelOpen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="platform-surface relative min-h-svh overflow-hidden px-5 py-10 sm:grid sm:place-items-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_34%),radial-gradient(circle_at_12%_90%,color-mix(in_oklab,var(--chart-3)_14%,transparent),transparent_38%)]" />
      <section className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-72 overflow-hidden p-8 sm:p-12 lg:min-h-160">
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center opacity-65 blur-md"
            style={{ backgroundImage: "url('/media/account-avatar-sprite.webp')" }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/55 to-background/10" />
          <div className="relative flex h-full flex-col justify-end">
            <div className="mt-36 max-w-md lg:mt-0">
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary">
                مدار العائلة
              </p>
              <h1 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
                مكتبتكم، وذكرياتكم، في مكان واحد.
              </h1>
              <p className="mt-5 max-w-sm leading-7 text-muted-foreground">
                أركاديا مساحة خاصة للعائلة الممتدة: اكتشفوا الأعمال، شاركوا الانطباعات، واحتفظوا بكل
                تجربة في مدارها المناسب.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center p-6 sm:p-0 h-full">
          <Card className="w-full border-0! bg-transparent shadow-none h-full p-10 flex flex-col justify-center">
            <CardHeader className="px-0">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UsersThreeIcon size={22} weight="duotone" />
              </div>
              <CardTitle className="font-heading text-2xl">{ar.auth.title}</CardTitle>
              <CardDescription>
                استخدم الحساب الذي أنشأه مدير العائلة أو رابط الدعوة.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="username">{ar.auth.username}</FieldLabel>
                    <Input
                      id="username"
                      name="username"
                      dir="ltr"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      disabled={!interactive || pending}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">{ar.auth.password}</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      dir="ltr"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={!interactive || pending}
                      required
                    />
                    <FieldDescription>ثمانية أحرف على الأقل.</FieldDescription>
                  </Field>
                  {message ? (
                    <Alert variant="destructive">
                      <LockKeyIcon />
                      <AlertTitle>تعذّر الدخول</AlertTitle>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={pending || !interactive}
                    aria-busy={pending || !interactive}
                  >
                    {!interactive ? "جارٍ تجهيز الدخول…" : pending ? "جارٍ الدخول…" : ar.auth.signIn}
                    <ArrowLeftIcon data-icon="inline-end" />
                  </Button>
                </FieldGroup>
              </form>
              <ServerAddressPanel open={serverPanelOpen} setOpen={setServerPanelOpen} />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
