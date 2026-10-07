import {
  accountKindLabels,
  accountRoleLabels,
  accountStatusLabels,
  ageOptions,
  ar,
  audienceOptions,
  riskOptions,
} from "@arcadia/i18n";
import {
  ArrowClockwiseIcon,
  BellIcon,
  CaretLeftIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
  EyeSlashIcon,
  GearSixIcon,
  PaletteIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SpeakerHighIcon,
  UsersThreeIcon,
  WarningCircleIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import { useIsDesktopShell } from "@/features/library/play-button";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  checkForUpdate,
  installUpdateAndRestart,
  type UpdateCheckResult,
} from "@/features/platform/updater";
import { apiBaseUrl, apiBaseUrlDefault, pingServer, setApiUrlOverride } from "@/lib/api";
import { signOut as clearSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

async function signOut() {
  // Goes through the auth-client helper so the bearer token is dropped too — clearing the
  // server session alone would leave a stale token behind that keeps the app looking signed in.
  await clearSession();
  window.location.assign("/login");
}

/** The stored value is an enum key (`general`, `16+`, `high`); the family reads Arabic. */
function labelFor(options: ReadonlyArray<readonly [string, string]>, value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value;
}

/**
 * Your own profile at a glance — not a family roster. Switching between family members and
 * managing their accounts is an owner/editor job that lives entirely in the admin dashboard;
 * this page only ever shows the signed-in account.
 */
export function AccountsPage() {
  const { data, isLoading } = useCurrentAccount();
  const account = data?.account;
  const canManageAccounts = account?.role === "owner" || account?.role === "editor";

  if (isLoading || !account) {
    return (
      <PlatformShell>
        <section className="mx-auto max-w-4xl px-5 pb-28 pt-20">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <Skeleton className="size-28 rounded-full" />
            <div className="w-full space-y-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </section>
      </PlatformShell>
    );
  }

  const { contentPolicy: policy, preferences } = account;

  return (
    <PlatformShell>
      <section className="mx-auto max-w-4xl px-5 pb-28 pt-14">
        {/* Identity */}
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm sm:p-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_45%)]" />
          </div>

          <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-start">
            <AccountAvatar
              avatarKey={account.avatarKey}
              label={`صورة ${account.displayName}`}
              className="size-24 shrink-0 ring-2 ring-primary/25 sm:size-28"
            />

            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {account.displayName}
              </h1>

              {account.username ? (
                <p className="mt-1.5 font-mono text-sm text-muted-foreground" dir="ltr">
                  @{account.username}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="secondary">{accountKindLabels[account.kind]}</Badge>
                <Badge variant="outline">{accountRoleLabels[account.role]}</Badge>
                {account.status === "active" ? (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
                    <SealCheckIcon data-icon="inline-start" weight="fill" />
                    {accountStatusLabels[account.status]}
                  </Badge>
                ) : (
                  <Badge variant="outline">{accountStatusLabels[account.status]}</Badge>
                )}
              </div>

              <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
                {account.bio || "لم تكتب نبذة عنك بعد — يمكنك إضافتها من الإعدادات."}
              </p>
            </div>

            <Link
              to="/settings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              <GearSixIcon data-icon="inline-start" />
              تعديل
            </Link>
          </div>
        </div>

        {/* Content limits */}
        <div className="mt-6 rounded-3xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheckIcon size={19} weight="duotone" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-semibold">حدود المحتوى</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                أقصى ما يظهر لك في أركاديا. تطبّق العائلة دائماً الحد الأكثر أماناً بين إعدادك
                وقواعدها.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <PolicyRow label="الجمهور" value={labelFor(audienceOptions, policy.audience)} />
            <PolicyRow label="العمر" value={labelFor(ageOptions, policy.age)} />
            <PolicyRow label="المحتوى الجنسي" value={labelFor(riskOptions, policy.sexuality)} />
            <PolicyRow label="السلوك والعنف" value={labelFor(riskOptions, policy.behavioral)} />
            <PolicyRow label="الدين والغيبيات" value={labelFor(riskOptions, policy.theology)} />
          </div>
        </div>

        {/* Preferences at a glance */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <GlanceCard
            icon={<SpeakerHighIcon size={17} weight="duotone" />}
            label="التشغيل التلقائي"
            value={preferences.autoplay ? "مفعّل" : "متوقف"}
          />
          <GlanceCard
            icon={<EyeSlashIcon size={17} weight="duotone" />}
            label="الحرق"
            value={
              preferences.hideSpoilers
                ? preferences.spoilerMode === "hide"
                  ? "مخفي تماماً"
                  : "مغطّى"
                : "ظاهر"
            }
          />
          <GlanceCard
            icon={<PaletteIcon size={17} weight="duotone" />}
            label="السمة"
            value={preferences.theme === "dark" ? "داكن" : "فاتح"}
          />
        </div>

        {/* Desktop app: which server this build talks to, and updating the app itself. Neither
            means anything in a browser tab, whose API origin is whatever served it and which
            updates by reloading — DesktopAppSection renders nothing there. */}
        <DesktopAppSection />

        {/* Actions */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-border/60">
          <ActionRow
            to="/settings"
            icon={<GearSixIcon size={18} weight="duotone" />}
            title="الإعدادات"
            description="الصورة والاسم وحدود المحتوى والتنبيهات والمظهر."
          />

          {canManageAccounts ? (
            <>
              <Separator />
              <ActionRow
                to="/admin/accounts"
                icon={<UsersThreeIcon size={18} weight="duotone" />}
                title="إدارة حسابات العائلة"
                description="إنشاء الحسابات ودعواتها وصلاحياتها من لوحة الإدارة."
              />
            </>
          ) : null}

          <Separator />

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-destructive/5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <SignOutIcon size={18} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-destructive">{ar.auth.signOut}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                ستحتاج إلى كلمة المرور للدخول مجدداً.
              </span>
            </span>
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground/70">
          <BellIcon size={13} />
          تُحفظ تفضيلاتك في حسابك وتنتقل معك بين الأجهزة.
        </p>
      </section>
    </PlatformShell>
  );
}

/**
 * Which server this build talks to, and updating the app itself — desktop shell only, and kept
 * on the main account page rather than tucked in the profile-editing settings, since both are
 * "about this install", not "about your profile". `useIsDesktopShell` keeps the first paint
 * agreeing with the prerendered HTML (see its doc comment in `play-button.tsx`), so this simply
 * isn't there yet on the very first render, then appears once the app confirms it's in Tauri.
 */
function DesktopAppSection() {
  const isDesktop = useIsDesktopShell();
  if (!isDesktop) return null;

  return (
    <div className="mt-6 space-y-4">
      <ServerAddressCard />
      <UpdateCard />
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/40 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/**
 * Lets one desktop build point at any server on the LAN without a rebuild (see
 * docs/deployment-and-release-roadmap.md §3) — `VITE_API_URL` is a sensible default, not the only
 * option once a family's server address can differ from what a given build was compiled against.
 */
function ServerAddressCard() {
  const [value, setValue] = useState(apiBaseUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "failed">("idle");
  const [testReason, setTestReason] = useState<string | null>(null);

  async function test() {
    setTestState("testing");
    setTestReason(null);

    const result = await pingServer(value);
    setTestState(result.ok ? "ok" : "failed");
    if (!result.ok) setTestReason(result.reason);
  }

  async function apply(url: string | null) {
    setError(null);
    setSaving(true);
    try {
      await setApiUrlOverride(url);
      // setApiUrlOverride reloads the page on success — this only resumes if the URL was invalid.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "عنوان الخادم غير صالح.");
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<WifiHighIcon size={19} weight="duotone" />}
      title="عنوان الخادم"
      description="عنوان جهاز العائلة الذي يستضيف قاعدة البيانات وواجهة أركاديا. تُعاد الصفحة بعد الحفظ."
    >
      <div className="flex flex-col gap-3">
        <Input
          dir="ltr"
          className="font-mono text-[13px]"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setTestState("idle");
            setError(null);
          }}
          placeholder={apiBaseUrlDefault}
        />

        {testState === "ok" && (
          <p className="flex items-center gap-2 text-sm text-emerald-500">
            <CheckCircleIcon size={15} weight="fill" />
            الخادم يستجيب بشكل صحيح.
          </p>
        )}

        {testState === "failed" && (
          <div className="flex items-start gap-2 text-sm leading-6 text-destructive">
            <WarningCircleIcon size={15} weight="fill" className="mt-1" />
            <span>
              تعذّر الوصول إلى هذا العنوان.
              {testReason && (
                <span className="mt-1 block font-mono text-[11px] opacity-80">{testReason}</span>
              )}
            </span>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={test} disabled={testState === "testing" || saving}>
            {testState === "testing" ? "جارٍ الاختبار…" : "اختبار الاتصال"}
          </Button>
          <Button onClick={() => apply(value)} disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ وإعادة التحميل"}
          </Button>
          {apiBaseUrl !== apiBaseUrlDefault && (
            <Button
              variant="ghost"
              onClick={() => {
                setValue(apiBaseUrlDefault);
                apply(null);
              }}
              disabled={saving}
            >
              إعادة الضبط الافتراضي
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function UpdateCard() {
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function runCheck() {
    setChecking(true);
    setResult(await checkForUpdate());
    setChecking(false);
  }

  async function runInstall() {
    setInstalling(true);
    setProgress(null);
    try {
      await installUpdateAndRestart(setProgress);
    } catch (error) {
      setResult({
        status: "failed",
        message: error instanceof Error ? error.message : "تعذّر تثبيت التحديث.",
      });
      setInstalling(false);
    }
    // On success the app restarts itself (relaunch()) before this ever resumes.
  }

  return (
    <SectionCard
      icon={<DownloadSimpleIcon size={19} weight="duotone" />}
      title="التحديثات"
      description="يتحقّق أركاديا من إصدار جديد عبر GitHub Releases."
    >
      <div className="flex flex-col gap-3">
        <div>
          <Button variant="outline" onClick={runCheck} disabled={checking || installing}>
            <ArrowClockwiseIcon
              data-icon="inline-start"
              className={checking ? "animate-spin" : undefined}
            />
            {checking ? "يتحقّق…" : "التحقق من التحديثات"}
          </Button>
        </div>

        {result?.status === "upToDate" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircleIcon size={15} weight="fill" className="text-emerald-500" />
            أركاديا محدّث لأحدث إصدار.
          </p>
        )}

        {result?.status === "failed" && (
          <p className="text-sm text-destructive">{result.message}</p>
        )}

        {result?.status === "available" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
            <p>
              يتوفّر إصدار جديد: <span className="font-medium">{result.version}</span> (الحالي{" "}
              {result.currentVersion})
            </p>
            {result.notes && (
              <p className="whitespace-pre-line text-xs leading-6 text-muted-foreground">
                {result.notes}
              </p>
            )}
            <div>
              <Button onClick={runInstall} disabled={installing}>
                {installing
                  ? progress !== null
                    ? `يُثبّت… ${progress}٪`
                    : "يُثبّت…"
                  : "تثبيت التحديث وإعادة التشغيل"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function GlanceCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function ActionRow({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      {/* RTL: the chevron points the way the page will move, which is leftward here. */}
      <CaretLeftIcon size={15} className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
