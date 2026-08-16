import type { AccountPreferences, AvatarKey } from "@arcadia/contracts";
import type { Classification } from "@arcadia/domain";
import { ageOptions, ar, audienceOptions, avatarLabels, riskOptions } from "@arcadia/i18n";
import { CheckCircleIcon, FloppyDiskIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PlatformShell } from "@/components/platform-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { accountKeys, updateCurrentAccount, useCurrentAccount } from "@/features/accounts/api";
import { cn } from "@/lib/utils";

type SettingsDraft = {
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
        <div className="mx-auto max-w-4xl px-5 py-32 text-muted-foreground">
          جارٍ تحميل إعداداتك…
        </div>
      </PlatformShell>
    );
  }

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
      <section className="mx-auto max-w-4xl px-5 pb-28 pt-20">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary">
          حساب {account.displayName}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-semibold">إعدادات المدار</h1>
        <p className="mt-3 text-muted-foreground">
          تُحفظ تفضيلاتك في حسابك وتنتقل معك بين الأجهزة. تطبّق أركاديا دائماً الحد الأكثر أماناً.
        </p>
        <Tabs defaultValue="profile" className="mt-10">
          <TabsList>
            <TabsTrigger value="profile">الحساب</TabsTrigger>
            <TabsTrigger value="content">المحتوى</TabsTrigger>
            <TabsTrigger value="playback">المشاهدة</TabsTrigger>
            <TabsTrigger value="notifications">التنبيهات</TabsTrigger>
            <TabsTrigger value="appearance">المظهر</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="pt-5">
            <SettingsCard title="صورتك في العائلة" description="اختر واحدة من هويات أركاديا الخمس.">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {avatarKeys.map((avatarKey) => (
                  <button
                    key={avatarKey}
                    type="button"
                    onClick={() => setDraft((current) => current && { ...current, avatarKey })}
                    className={cn(
                      "rounded-2xl border p-3 outline-none transition hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                      draft.avatarKey === avatarKey && "border-primary bg-primary/8",
                    )}
                  >
                    <AccountAvatar
                      avatarKey={avatarKey}
                      label={avatarLabels[avatarKey]}
                      className="mx-auto size-16"
                    />
                    <span className="mt-2 block text-xs">{avatarLabels[avatarKey]}</span>
                  </button>
                ))}
              </div>
            </SettingsCard>
          </TabsContent>
          <TabsContent value="content" className="pt-5">
            <SettingsCard
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
            </SettingsCard>
          </TabsContent>
          <TabsContent value="playback" className="pt-5">
            <SettingsCard title="الصوت والمشاهدة" description="تفضيلات جاهزة لملفات الوسائط لاحقاً.">
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
            </SettingsCard>
          </TabsContent>
          <TabsContent value="notifications" className="pt-5">
            <SettingsCard title="تنبيهات العائلة" description="اختر ما يستحق الوصول إلى صندوقك.">
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
            </SettingsCard>
          </TabsContent>
          <TabsContent value="appearance" className="pt-5">
            <SettingsCard title="المظهر" description="ظلام سينمائي أو ضوء هادئ.">
              <PolicySelect
                label="السمة"
                value={draft.preferences.theme}
                options={[
                  ["dark", "داكن"],
                  ["light", "فاتح"],
                ]}
                onChange={(value) => setPreference("theme", value as "dark" | "light")}
              />
            </SettingsCard>
          </TabsContent>
        </Tabs>
        <div className="mt-6 flex items-center justify-end gap-3">
          {saved ? (
            <span className="flex items-center gap-2 text-sm text-emerald-500">
              <CheckCircleIcon /> حُفظت الإعدادات
            </span>
          ) : null}
          <Button
            onClick={() => {
              setSaved(false);
              mutation.mutate({
                avatarKey: draft.avatarKey,
                preferences: draft.preferences,
                contentPolicy: draft.contentPolicy,
              });
            }}
            disabled={mutation.isPending}
          >
            <FloppyDiskIcon data-icon="inline-start" />
            {mutation.isPending ? ar.common.loading : ar.common.save}
          </Button>
        </div>
      </section>
    </PlatformShell>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
