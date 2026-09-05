import type { AccountPreferences, AvatarKey } from "@arcadia/contracts";
import type { Classification } from "@arcadia/domain";
import { ageOptions, ar, audienceOptions, avatarLabels, riskOptions } from "@arcadia/i18n";
import {
  ArrowCounterClockwiseIcon,
  BellIcon,
  CheckCircleIcon,
  FilmSlateIcon,
  FloppyDiskIcon,
  PaletteIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { accountKeys, updateCurrentAccount, useCurrentAccount } from "@/features/accounts/api";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { cn } from "@/lib/utils";

type SettingsDraft = {
  displayName: string;
  bio: string;
  avatarKey: AvatarKey;
  preferences: AccountPreferences;
  contentPolicy: Classification;
};

const avatarKeys = Object.keys(avatarLabels) as AvatarKey[];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useCurrentAccount();
  const account = data?.account;
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (account) {
      setDraft({
        displayName: account.displayName,
        bio: account.bio,
        avatarKey: account.avatarKey,
        preferences: account.preferences,
        contentPolicy: account.contentPolicy,
      });
    }
  }, [account]);

  const mutation = useMutation({
    mutationFn: updateCurrentAccount,
    onSuccess: async (updated) => {
      window.localStorage.setItem("arcadia:theme", updated.preferences.theme);
      document.documentElement.classList.toggle("dark", updated.preferences.theme === "dark");
      await queryClient.invalidateQueries({ queryKey: accountKeys.current });
      await queryClient.invalidateQueries({ queryKey: accountKeys.family });
      setSaved(true);
    },
  });

  if (!account || !draft) {
    return (
      <PlatformShell>
        <section className="mx-auto max-w-5xl px-5 pb-28 pt-14">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-4 h-4 w-full max-w-lg" />
          <Skeleton className="mt-8 h-11 w-full rounded-full" />
          <Skeleton className="mt-6 h-80 w-full rounded-3xl" />
        </section>
      </PlatformShell>
    );
  }

  // Comparing against the account the server last confirmed is what makes the save bar honest:
  // it appears only when something would actually change, and disappears again if the family
  // undoes an edit by hand rather than staying armed for the rest of the visit.
  const pristine: SettingsDraft = {
    displayName: account.displayName,
    bio: account.bio,
    avatarKey: account.avatarKey,
    preferences: account.preferences,
    contentPolicy: account.contentPolicy,
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(pristine);
  const nameTooShort = draft.displayName.trim().length < 2;

  const setPolicy = <K extends keyof Classification>(key: K, value: Classification[K]) =>
    setDraft((current) =>
      current ? { ...current, contentPolicy: { ...current.contentPolicy, [key]: value } } : current,
    );
  const setPreference = <K extends keyof AccountPreferences>(
    key: K,
    value: AccountPreferences[K],
  ) =>
    setDraft((current) =>
      current ? { ...current, preferences: { ...current.preferences, [key]: value } } : current,
    );

  return (
    <PlatformShell>
      <section className="mx-auto max-w-5xl px-5 pb-28 pt-14">
        <header className="flex items-start gap-4">
          <AccountAvatar
            avatarKey={draft.avatarKey}
            label={`صورة ${draft.displayName}`}
            className="hidden size-16 shrink-0 ring-2 ring-primary/20 sm:block"
          />
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              الإعدادات
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              تُحفظ تفضيلاتك في حسابك وتنتقل معك بين الأجهزة. تطبّق أركاديا دائماً الحد الأكثر أماناً
              بين إعدادك وقواعد العائلة.
            </p>
          </div>
        </header>

        <Tabs defaultValue="profile" className="mt-8">
          <TabsList className="w-full max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="profile">
              <UserCircleIcon data-icon="inline-start" weight="duotone" />
              الحساب
            </TabsTrigger>
            <TabsTrigger value="content">
              <ShieldCheckIcon data-icon="inline-start" weight="duotone" />
              المحتوى
            </TabsTrigger>
            <TabsTrigger value="playback">
              <FilmSlateIcon data-icon="inline-start" weight="duotone" />
              المشاهدة
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <BellIcon data-icon="inline-start" weight="duotone" />
              التنبيهات
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <PaletteIcon data-icon="inline-start" weight="duotone" />
              المظهر
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="pt-6">
            <SettingsSection
              icon={<UserCircleIcon size={19} weight="duotone" />}
              title="هويتك في العائلة"
              description="الاسم والنبذة والصورة التي يراها بقية أفراد العائلة."
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="display-name">الاسم الظاهر</FieldLabel>
                  <Input
                    id="display-name"
                    value={draft.displayName}
                    maxLength={80}
                    aria-invalid={nameTooShort}
                    onChange={(event) =>
                      setDraft(
                        (current) => current && { ...current, displayName: event.target.value },
                      )
                    }
                  />
                  <FieldDescription>
                    {nameTooShort ? (
                      <span className="text-destructive">حرفان على الأقل.</span>
                    ) : (
                      "الاسم الذي يظهر على مراجعاتك ونشاطك."
                    )}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="bio">نبذة عنك</FieldLabel>
                  <Textarea
                    id="bio"
                    rows={3}
                    value={draft.bio}
                    maxLength={280}
                    placeholder="ما الذي تحب مشاهدته؟"
                    onChange={(event) =>
                      setDraft((current) => current && { ...current, bio: event.target.value })
                    }
                  />
                  <FieldDescription>{draft.bio.length}/280 حرف.</FieldDescription>
                </Field>
              </FieldGroup>
            </SettingsSection>

            <SettingsSection
              className="mt-6"
              icon={<PaletteIcon size={19} weight="duotone" />}
              title="صورتك"
              description="اختر واحدة من هويات أركاديا الخمس."
            >
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {avatarKeys.map((avatarKey) => {
                  const selected = draft.avatarKey === avatarKey;
                  return (
                    <button
                      key={avatarKey}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((current) => current && { ...current, avatarKey })}
                      className={cn(
                        "rounded-2xl border p-3 outline-none transition hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected ? "border-primary bg-primary/8" : "border-border/60",
                      )}
                    >
                      <AccountAvatar
                        avatarKey={avatarKey}
                        label={avatarLabels[avatarKey]}
                        className="mx-auto size-16"
                      />
                      <span className="mt-2 block text-xs">{avatarLabels[avatarKey]}</span>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="content" className="pt-6">
            <SettingsSection
              icon={<ShieldCheckIcon size={19} weight="duotone" />}
              title="حدود المحتوى التي تختارها"
              description="يمكنك جعل تجربتك أكثر تحفظاً. قواعد العائلة الوقائية تعمل تلقائياً ولا تكشف تفاصيلها."
            >
              <FieldGroup>
                <PolicySelect
                  label="الجمهور الأقصى"
                  value={draft.contentPolicy.audience}
                  options={audienceOptions}
                  onChange={(value) => setPolicy("audience", value as Classification["audience"])}
                />
                <PolicySelect
                  label="العمر الأقصى"
                  value={draft.contentPolicy.age}
                  options={ageOptions}
                  onChange={(value) => setPolicy("age", value as Classification["age"])}
                />
                <FieldSet>
                  <FieldLegend>مستويات المخاطر القصوى</FieldLegend>
                  <FieldGroup>
                    {(
                      [
                        ["sexuality", "المحتوى الجنسي"],
                        ["behavioral", "السلوك والعنف"],
                        ["theology", "الدين والغيبيات"],
                      ] as const
                    ).map(([key, label]) => (
                      <PolicySelect
                        key={key}
                        label={label}
                        value={draft.contentPolicy[key]}
                        options={riskOptions}
                        onChange={(value) => setPolicy(key, value as Classification[typeof key])}
                      />
                    ))}
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="playback" className="pt-6">
            <SettingsSection
              icon={<FilmSlateIcon size={19} weight="duotone" />}
              title="الصوت والمشاهدة"
              description="كيف يتصرّف المشغّل، وأي مصادر يفضّلها عند توفّر أكثر من خيار."
            >
              <FieldGroup>
                <SwitchField
                  label="التشغيل التلقائي"
                  description="انتقل إلى الحلقة التالية تلقائياً عند توفر تشغيل الوسائط."
                  checked={draft.preferences.autoplay}
                  onChange={(value) => setPreference("autoplay", value)}
                />
                <SwitchField
                  label="السماح بتبديل المسارات"
                  description="اختيار الصوت والترجمة من المشغّل مستقبلاً."
                  checked={draft.preferences.canSwitchTracks}
                  onChange={(value) => setPreference("canSwitchTracks", value)}
                />
                <PreferredAudioField
                  value={draft.preferences.preferredAudio}
                  onChange={(value) => setPreference("preferredAudio", value)}
                />
                <SwitchField
                  label="إخفاء الحرق"
                  description="تغطية نصوص المراجعات والتعليقات الموسومة بالحرق."
                  checked={draft.preferences.hideSpoilers}
                  onChange={(value) => setPreference("hideSpoilers", value)}
                />
                <PolicySelect
                  label="طريقة عرض الحرق"
                  value={draft.preferences.spoilerMode}
                  options={[
                    ["cover", "تغطية مع إمكانية الكشف"],
                    ["hide", "إخفاء كامل"],
                    ["show", "عرض مباشر"],
                  ]}
                  onChange={(value) =>
                    setPreference("spoilerMode", value as AccountPreferences["spoilerMode"])
                  }
                />
              </FieldGroup>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="notifications" className="pt-6">
            <SettingsSection
              icon={<BellIcon size={19} weight="duotone" />}
              title="تنبيهات العائلة"
              description="اختر ما يستحق الوصول إلى صندوقك."
            >
              <FieldGroup>
                <SwitchField
                  label="نشاط العائلة"
                  description="المراجعات والإضافات الجديدة المهمة."
                  checked={draft.preferences.notifyFamilyActivity}
                  onChange={(value) => setPreference("notifyFamilyActivity", value)}
                />
                <SwitchField
                  label="الردود والتفاعلات"
                  description="عندما يرد أحد على نقاشك أو يتفاعل معه."
                  checked={draft.preferences.notifyReplies}
                  onChange={(value) => setPreference("notifyReplies", value)}
                />
              </FieldGroup>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="appearance" className="pt-6">
            <SettingsSection
              icon={<PaletteIcon size={19} weight="duotone" />}
              title="المظهر"
              description="ظلام سينمائي أو ضوء هادئ."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["dark", "داكن", "مناسب لغرفة المشاهدة."],
                    ["light", "فاتح", "أوضح في الإضاءة العالية."],
                  ] as const
                ).map(([theme, label, hint]) => {
                  const selected = draft.preferences.theme === theme;
                  return (
                    <button
                      key={theme}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPreference("theme", theme)}
                      className={cn(
                        "rounded-2xl border p-4 text-start outline-none transition hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected ? "border-primary bg-primary/8" : "border-border/60",
                      )}
                    >
                      <div
                        className={cn(
                          "h-14 w-full rounded-lg border",
                          theme === "dark"
                            ? "border-white/10 bg-neutral-900"
                            : "border-black/10 bg-neutral-100",
                        )}
                      />
                      <p className="mt-3 flex items-center gap-2 text-sm font-medium">
                        {label}
                        {selected && (
                          <CheckCircleIcon size={15} weight="fill" className="text-primary" />
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
          </TabsContent>
        </Tabs>

        {/* Only ever in the way when there is something to save. */}
        {dirty && (
          <div className="sticky bottom-4 z-20 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur-md">
              <p className="ps-2 text-sm text-muted-foreground">لديك تغييرات غير محفوظة.</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft(pristine)}
                  disabled={mutation.isPending}
                >
                  <ArrowCounterClockwiseIcon data-icon="inline-start" />
                  تراجع
                </Button>
                <Button
                  size="sm"
                  disabled={mutation.isPending || nameTooShort}
                  onClick={() => {
                    setSaved(false);
                    mutation.mutate({
                      displayName: draft.displayName.trim(),
                      bio: draft.bio.trim(),
                      avatarKey: draft.avatarKey,
                      preferences: draft.preferences,
                      contentPolicy: draft.contentPolicy,
                    });
                  }}
                >
                  <FloppyDiskIcon data-icon="inline-start" />
                  {mutation.isPending ? ar.common.loading : ar.common.save}
                </Button>
              </div>
            </div>
          </div>
        )}

        {mutation.isError && (
          <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <WarningCircleIcon size={16} weight="fill" />
            {mutation.error instanceof Error ? mutation.error.message : "تعذّر حفظ الإعدادات."}
          </p>
        )}

        {saved && !dirty && (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-500" aria-live="polite">
            <CheckCircleIcon size={16} weight="fill" />
            حُفظت الإعدادات
          </p>
        )}
      </section>
    </PlatformShell>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-3xl border border-border/60 bg-card/40 p-6", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** English/Arabic/Spanish/Japanese — the same curated set the player's own audio-track picker
 *  already limits itself to (`knownLanguageTracks` in `desktop-player.ts`). */
const audioLanguageOptions = [
  ["none", "بدون"],
  ["en", "الإنجليزية"],
  ["ar", "العربية"],
  ["es", "الإسبانية"],
  ["ja", "اليابانية"],
] as const;

/**
 * Priority order for `preferredAudio` — read by the streams route to rank a torrent candidate
 * whose detected language matches ahead of others (`languagePriorityScore` in
 * `torrent-source.ts`). Doesn't gate anything: leaving it empty (the default for every new
 * profile) just keeps today's plain English-first ranking; setting an order only nudges which
 * candidate is *tried first* when more than one language is actually available; the family can
 * always switch the embedded audio track manually from the player regardless of this setting.
 */
function PreferredAudioField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const tiers = [value[0] ?? "none", value[1] ?? "none", value[2] ?? "none"];
  const setTier = (index: number, language: string) => {
    const next = [...tiers];
    next[index] = language;
    onChange(next.filter((item) => item !== "none"));
  };
  return (
    <FieldSet>
      <FieldLegend>ترتيب المسار الصوتي المفضّل</FieldLegend>
      <FieldDescription>
        يرتّب مصادر التشغيل عند توفر أكثر من لغة صوت — لا يمنع لغات أخرى ولا يبدّل الصوت تلقائياً داخل
        الملف نفسه، فقط يفضّل أي مصدر يحمل إحدى هذه اللغات عند البحث عنه.
      </FieldDescription>
      <FieldGroup>
        <PolicySelect
          label="الأولوية الأولى"
          value={tiers[0]}
          options={audioLanguageOptions}
          onChange={(next) => setTier(0, next)}
        />
        <PolicySelect
          label="الأولوية الثانية"
          value={tiers[1]}
          options={audioLanguageOptions}
          onChange={(next) => setTier(1, next)}
        />
        <PolicySelect
          label="الأولوية الثالثة"
          value={tiers[2]}
          options={audioLanguageOptions}
          onChange={(next) => setTier(2, next)}
        />
      </FieldGroup>
    </FieldSet>
  );
}

function PolicySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <Field orientation="responsive">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => onChange(next as string)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([option, text]) => (
              <SelectItem key={option} value={option}>
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}
