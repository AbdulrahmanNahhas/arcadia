import { ar } from "@arcadia/i18n";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  GearSixIcon,
  LockKeyIcon,
  UsersThreeIcon,
  WarningCircleIcon,
  WifiHighIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useIsDesktopShell } from "@/features/library/play-button";
import { apiBaseUrl, apiBaseUrlDefault, pingServer, setApiUrlOverride } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

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
  const [testReason, setTestReason] = useState<string | null>(null);

  if (!isDesktop) return null;

  async function test() {
    setTestState("testing");
    setTestReason(null);

    const result = await pingServer(value);
    setTestState(result.ok ? "ok" : "failed");
    if (!result.ok) setTestReason(result.reason);
  }

  async function apply() {
    setError(null);
    setRestarting(true);

    try {
      new URL(value);
      await setApiUrlOverride(value);
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
        className="group mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <GearSixIcon
          size={15}
          className="transition-transform duration-300 group-hover:rotate-45"
        />
        <span>مشكلات الاتصال بالخادم؟</span>
      </button>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-border/50 bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <WifiHighIcon size={17} weight="duotone" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium">عنوان خادم أركاديا</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              عنوان الجهاز الذي يستضيف أركاديا، مثل{" "}
              <span dir="ltr" className="font-mono">
                http://192.168.1.50:23101
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="إغلاق"
        >
          <XIcon size={15} />
        </button>
      </div>

      <div className="mt-4">
        <Field>
          <FieldLabel htmlFor="server-address" className="sr-only">
            عنوان الخادم
          </FieldLabel>

          <Input
            id="server-address"
            dir="ltr"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setTestState("idle");
              setError(null);
            }}
            className="h-10 bg-background/80 font-mono text-[13px]"
            placeholder="http://192.168.1.50:23101"
          />
        </Field>
      </div>

      {testState === "ok" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-500">
          <CheckCircleIcon size={15} weight="fill" />
          الخادم يستجيب بشكل صحيح.
        </div>
      )}

      {testState === "failed" && (
        <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-destructive">
          <WarningCircleIcon size={15} weight="fill" className="mt-0.5" />
          <span>
            تعذّر الوصول إلى هذا العنوان. تحقّق من الشبكة والمنفذ.
            {testReason && (
              <span className="mt-1 block font-mono text-[11px] opacity-80">{testReason}</span>
            )}
          </span>
        </div>
      )}

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={test}
          disabled={testState === "testing" || restarting}
        >
          {testState === "testing" ? "جارٍ الاختبار…" : "اختبار الاتصال"}
        </Button>

        <Button type="button" size="sm" onClick={apply} disabled={restarting}>
          {restarting ? "جارٍ الحفظ…" : "حفظ وإعادة التحميل"}
        </Button>

        {value !== apiBaseUrlDefault && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(apiBaseUrlDefault);
              setTestState("idle");
              setError(null);
            }}
            disabled={restarting}
          >
            إعادة الضبط
          </Button>
        )}
      </div>
    </div>
  );
}

export function LoginPage() {
  const search = useSearch({ strict: false }) as { next?: string };
  const navigate = useNavigate();

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
      const result = await authClient.signIn.username({
        username,
        password,
        rememberMe: true,
      });

      if (result.error) {
        // Only a 401 is really a bad username/password. Anything else — a 500, a half-migrated
        // database, a reverse proxy answering instead of the API — is a server problem nobody
        // fixes by retyping their password, so don't blame the credentials for it.
        const status = result.error.status;
        setMessage(
          status === 401
            ? ar.auth.invalidCredentials
            : `تعذّر تسجيل الدخول (${status ?? "؟"}): ${result.error.message ?? "خطأ غير معروف"}`,
        );
        if (status !== 401) setServerPanelOpen(true);
        return;
      }

      // A hard `window.location.assign` reload here would tear down and remount the whole SPA,
      // racing the freshly-set session cookie against authClient.useSession()'s first fetch on
      // the new page — that's what was bouncing a correctly-authenticated login back to /login.
      // Client-side navigation keeps the session state better-auth just updated in memory.
      await navigate({ to: search.next?.startsWith("/") ? search.next : "/", replace: true });
    } catch (cause) {
      // Getting here means no HTTP response came back at all: wrong address, firewall, or a CSP
      // block. Naming the address it actually tried, and the underlying error, is the difference
      // between a five-minute fix and another round of guessing — "Load failed", "Connection
      // refused", and a CSP rejection all look identical behind a generic message.
      setMessage(
        `تعذّر الوصول إلى الخادم (${apiBaseUrl}): ${cause instanceof Error ? cause.message : "خطأ غير معروف"}`,
      );
      setServerPanelOpen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_42%)]" />
        <div className="absolute inset-x-0 bottom-0 h-80 bg-[radial-gradient(circle_at_50%_100%,color-mix(in_oklab,var(--chart-3)_7%,transparent),transparent_65%)]" />
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl items-center px-5 py-8 sm:px-8 lg:px-10">
        <section className="grid w-full overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-[0_24px_80px_-40px_hsl(var(--foreground)/0.35)] backdrop-blur-xl lg:grid-cols-[1fr_0.85fr]">
          {/* Brand panel */}
          <div className="relative hidden min-h-170 overflow-hidden lg:block">
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-40"
              style={{
                backgroundImage: "url('/media/account-avatar-sprite.webp')",
              }}
            />

            <div className="absolute inset-0 bg-linear-to-br from-background/20 via-background/55 to-background" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_35%)]" />

            <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-border/50 bg-background/50 text-primary backdrop-blur-md">
                  <UsersThreeIcon size={19} weight="duotone" />
                </div>

                <span className="text-sm font-medium tracking-tight">أركاديا</span>
              </div>

              <div className="max-w-md">
                <p className="mb-4 text-xs font-medium tracking-[0.18em] text-primary uppercase">
                  مدار العائلة
                </p>

                <h1 className="font-heading text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">
                  مكتبتكم،
                  <br />
                  وذكرياتكم،
                  <br />
                  في مكان واحد.
                </h1>

                <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
                  مساحة خاصة للعائلة الممتدة لاكتشاف الأعمال، مشاركة الانطباعات، والاحتفاظ بكل تجربة
                  في مدارها المناسب.
                </p>
              </div>
            </div>
          </div>

          {/* Login panel */}
          <div className="flex min-h-150 items-center bg-card/40 lg:min-h-170">
            <div className="w-full px-7 py-10 ">
              <div className="mx-auto w-full">
                {/* Mobile brand */}
                <div className="mb-10 flex items-center gap-2.5 lg:hidden">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <UsersThreeIcon size={18} weight="duotone" />
                  </div>

                  <span className="font-heading text-sm font-semibold tracking-tight">أركاديا</span>
                </div>

                {/* Header */}
                <div className="mb-8">
                  <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <LockKeyIcon size={21} weight="duotone" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-heading text-3xl font-semibold tracking-tight">
                      {ar.auth.title}
                    </h2>

                    <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                      سجّل الدخول إلى مكتبتكم العائلية وتابعوا من حيث توقفتم.
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={submit}>
                  <FieldGroup className="gap-5">
                    <Field>
                      <FieldLabel
                        htmlFor="username"
                        className="text-[12px] font-medium text-foreground/80"
                      >
                        {ar.auth.username}
                      </FieldLabel>

                      <Input
                        id="username"
                        name="username"
                        dir="ltr"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        disabled={!interactive || pending}
                        required
                        className="mt-2 h-10 border-border/60 bg-background/60 px-4 shadow-none transition-[border-color,box-shadow,background-color] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 rounded-full"
                      />
                    </Field>
                    <Field>
                      <div className="flex items-center justify-between gap-4">
                        <FieldLabel
                          htmlFor="password"
                          className="text-[12px] font-medium text-foreground/80"
                        >
                          {ar.auth.password}
                        </FieldLabel>

                        <span className="text-[11px] text-muted-foreground">مطلوب للتسجيل</span>
                      </div>

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
                        className="mt-2 h-10 border-border/60 bg-background/60 px-4 shadow-none transition-[border-color,box-shadow,background-color] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 rounded-full"
                      />

                      <FieldDescription className="mt-2 text-[11px]">
                        ثمانية أحرف على الأقل.
                      </FieldDescription>
                    </Field>
                    {message && (
                      <Alert
                        variant="destructive"
                        className="rounded-xl border-destructive/15 bg-destructive/5 px-4 py-3"
                      >
                        <WarningCircleIcon size={17} />
                        <AlertTitle className="text-sm">تعذّر الدخول</AlertTitle>
                        <AlertDescription className="text-xs leading-5">{message}</AlertDescription>
                      </Alert>
                    )}
                    <Button
                      type="submit"
                      size="lg"
                      className="mt-2 h-10 w-full rounded-xl text-sm font-medium shadow-sm"
                      disabled={pending || !interactive}
                      aria-busy={pending || !interactive}
                    >
                      <span>
                        {!interactive
                          ? "جارٍ تجهيز الدخول…"
                          : pending
                            ? "جارٍ الدخول…"
                            : ar.auth.signIn}
                      </span>

                      <ArrowLeftIcon data-icon="inline-end" size={17} />
                    </Button>
                  </FieldGroup>
                </form>

                {/* Secondary / recovery area */}
                <div className="">
                  <ServerAddressPanel open={serverPanelOpen} setOpen={setServerPanelOpen} />

                  {!serverPanelOpen && (
                    <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground/70">
                      الوصول إلى أركاديا متاح فقط للأجهزة الموجودة ضمن شبكتكم.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
