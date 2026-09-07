import { ar } from "@arcadia/i18n";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  GearSixIcon,
  LockKeyIcon,
  WarningCircleIcon,
  WifiHighIcon,
  WifiSlashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { type DeviceProfile, readDeviceProfiles } from "@/features/accounts/device-profiles";
import { useIsDesktopShell } from "@/features/library/play-button";
import { apiBaseUrl, apiBaseUrlDefault, pingServer, setApiUrlOverride } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

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
      if (!URL.parse(value)) throw new Error("عنوان الخادم غير صالح.");
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
        className="group inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <GearSixIcon
          size={14}
          weight="regular"
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
  const search = useSearch({ from: "/login" });
  const navigate = useNavigate();

  const [username, setUsername] = useState(search.profile ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [serverPanelOpen, setServerPanelOpen] = useState(false);
  const profiles: DeviceProfile[] = interactive ? readDeviceProfiles(window.localStorage) : [];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const remembered = readDeviceProfiles(window.localStorage);
      if (!search.profile && remembered[0]) setUsername(remembered[0].username);
      setInteractive(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [search.profile]);

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
    <main className="relative min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-md items-center px-5 py-10">
        <section className="w-full">
          {/* Header */}
          <div className="mb-7">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LockKeyIcon size={20} weight="duotone" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                {ar.auth.title}
              </h1>

              <p className="text-sm leading-6 text-muted-foreground">
                سجّل الدخول إلى مكتبتكم العائلية وتابعوا من حيث توقفتم.
              </p>
            </div>
          </div>

          {/* Existing profiles */}
          {profiles.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">من يشاهد الآن؟</p>

                <button
                  type="button"
                  onClick={() => {
                    setUsername("");
                    setPassword("");
                    setMessage(null);
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  حساب آخر
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {profiles.slice(0, 3).map((profile) => {
                  const selected = profile.username === username;

                  return (
                    <button
                      key={profile.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setUsername(profile.username);
                        setPassword("");
                        setMessage(null);
                      }}
                      className={cn(
                        "group flex min-w-0 flex-col items-center gap-2 rounded-xl p-2.5",
                        "bg-muted/40 transition-colors",
                        "hover:bg-muted",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        selected && "bg-primary/8 ring-1 ring-primary/30",
                      )}
                    >
                      <AccountAvatar
                        avatarKey={profile.avatarKey}
                        label={`ملف ${profile.displayName}`}
                        className="size-14 ring-2 ring-background transition-transform group-hover:scale-[1.03]"
                      />

                      <span className="w-full truncate text-xs font-medium">
                        {profile.displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit}>
            <FieldGroup className="gap-4">
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
                  className="mt-2 h-10 rounded-lg bg-background shadow-none ltr"
                />
              </Field>

              <Field>
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel htmlFor="password">{ar.auth.password}</FieldLabel>

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
                  className="mt-2 h-10 rounded-lg bg-background shadow-none ltr"
                />

                <FieldDescription className="mt-1.5 text-[11px]">
                  ثمانية أحرف على الأقل.
                </FieldDescription>
              </Field>

              {message && (
                <Alert variant="destructive" className="rounded-lg px-3.5 py-3">
                  <WarningCircleIcon size={16} />

                  <AlertTitle className="text-sm">تعذّر الدخول</AlertTitle>

                  <AlertDescription className="text-xs leading-5">{message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                size="lg"
                className="mt-1 h-10 w-full rounded-lg text-sm font-medium"
                disabled={pending || !interactive}
                aria-busy={pending || !interactive}
              >
                <span>
                  {!interactive ? "جارٍ تجهيز الدخول…" : pending ? "جارٍ الدخول…" : ar.auth.signIn}
                </span>

                <ArrowLeftIcon data-icon="inline-end" size={16} />
              </Button>
            </FieldGroup>
          </form>

          {/* Secondary actions */}
          <div className="mt-4 flex flex-col items-center gap-4">
            {!serverPanelOpen && (
              <p className="text-[10px] text-muted-foreground/45">
                متاح فقط للأجهزة المتصلة بشبكتكم المحلية.
              </p>
            )}

            <div className="flex items-center gap-4 ">
              <ServerAddressPanel open={serverPanelOpen} setOpen={setServerPanelOpen} />

              {!serverPanelOpen && (
                <Link
                  to="/offline"
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <WifiSlashIcon size={14} />
                  <span>مشاهدة المحفوظات دون اتصال</span>
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
