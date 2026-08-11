import type { Age, Audience, Classification, RiskLevel } from "@arcadia/domain";
import { useState } from "react";
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
import { currentProfile, readSettings, settingsKey } from "./model";

const audiences: Array<[Audience, string]> = [
  ["general", "عام"],
  ["teen", "يافعون"],
  ["young-adult", "شباب"],
  ["adult", "بالغون"],
];
const ages: Array<[Age, string]> = [
  ["all", "للجميع"],
  ["7+", "7+"],
  ["10+", "10+"],
  ["13+", "13+"],
  ["16+", "16+"],
  ["18+", "18+"],
];
const risks: Array<[RiskLevel, string]> = [
  ["none", "لا يوجد"],
  ["low", "منخفض"],
  ["medium", "متوسط"],
  ["high", "مرتفع"],
];

export function SettingsPage() {
  const profile = currentProfile();
  const initial = readSettings(profile.id);
  const [settings, setSettings] = useState({
    ...initial,
    policy: initial.policy ?? profile.policy,
  });
  const save = () => {
    window.localStorage.setItem(settingsKey(profile.id), JSON.stringify(settings));
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  };
  const setPolicy = <K extends keyof Classification>(key: K, value: Classification[K]) =>
    setSettings((current) => ({ ...current, policy: { ...current.policy, [key]: value } }));
  return (
    <PlatformShell>
      <section className="mx-auto max-w-4xl px-5 pb-28 pt-20">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary">ملف {profile.name}</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold">إعدادات المدار</h1>
        <p className="mt-3 text-muted-foreground">
          هذه التفضيلات محلية في مرحلة العرض ولا تُرسل كهوية إلى API.
        </p>
        <Tabs defaultValue="content" className="mt-10">
          <TabsList>
            <TabsTrigger value="profile">الملف</TabsTrigger>
            <TabsTrigger value="content">المحتوى</TabsTrigger>
            <TabsTrigger value="language">اللغة</TabsTrigger>
            <TabsTrigger value="appearance">المظهر</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="pt-5">
            <SettingsCard title="الملف الحالي" description={profile.description}>
              <p className="text-base font-medium">{profile.name}</p>
              <p className="mt-1 text-muted-foreground">نوع الحساب: {profile.accountKind}</p>
            </SettingsCard>
          </TabsContent>
          <TabsContent value="content" className="pt-5">
            <SettingsCard
              title="حدود المحتوى الظاهرة"
              description="يُطبّق الأشد بين هذه الحدود وقيود المدير المخفية. القيود المخفية لا تظهر هنا."
            >
              <FieldGroup>
                <PolicySelect
                  label="الجمهور الأقصى"
                  value={settings.policy.audience}
                  options={audiences}
                  onChange={(value) => setPolicy("audience", value as Audience)}
                />
                <PolicySelect
                  label="العمر الأقصى"
                  value={settings.policy.age}
                  options={ages}
                  onChange={(value) => setPolicy("age", value as Age)}
                />
                <FieldSet>
                  <FieldLegend>مستويات المخاطر القصوى</FieldLegend>
                  <FieldGroup>
                    <PolicySelect
                      label="المحتوى الجنسي"
                      value={settings.policy.sexuality}
                      options={risks}
                      onChange={(value) => setPolicy("sexuality", value as RiskLevel)}
                    />
                    <PolicySelect
                      label="السلوك والعنف"
                      value={settings.policy.behavioral}
                      options={risks}
                      onChange={(value) => setPolicy("behavioral", value as RiskLevel)}
                    />
                    <PolicySelect
                      label="الدين والغيبيات"
                      value={settings.policy.theology}
                      options={risks}
                      onChange={(value) => setPolicy("theology", value as RiskLevel)}
                    />
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </SettingsCard>
          </TabsContent>
          <TabsContent value="language" className="pt-5">
            <SettingsCard
              title="الصوت والترجمة"
              description="قواعد عربية أولاً جاهزة لملفات الوسائط المستقبلية."
            >
              <FieldGroup>
                <SwitchField
                  label="اشترط الصوت العربي"
                  description="يخفي لاحقاً الملفات التي لا تحمل مساراً عربياً."
                  checked={settings.arabicOnly}
                  onChange={(checked) =>
                    setSettings((current) => ({
                      ...current,
                      arabicOnly: checked,
                      subtitles: checked ? false : current.subtitles,
                      canSwitchTracks: checked ? false : current.canSwitchTracks,
                    }))
                  }
                />
                <SwitchField
                  label="السماح بالترجمة"
                  description="يمكن إيقافها بالكامل للملفات العربية فقط."
                  checked={settings.subtitles}
                  disabled={settings.arabicOnly}
                  onChange={(checked) =>
                    setSettings((current) => ({ ...current, subtitles: checked }))
                  }
                />
                <SwitchField
                  label="السماح بتبديل المسارات"
                  description="يتعطل تلقائياً عند فرض الصوت العربي."
                  checked={settings.canSwitchTracks}
                  disabled={settings.arabicOnly}
                  onChange={(checked) =>
                    setSettings((current) => ({ ...current, canSwitchTracks: checked }))
                  }
                />
              </FieldGroup>
            </SettingsCard>
          </TabsContent>
          <TabsContent value="appearance" className="pt-5">
            <SettingsCard
              title="المظهر"
              description="Arcadia مصمم للظلام السينمائي، مع خيار نهاري هادئ."
            >
              <PolicySelect
                label="السمة"
                value={settings.theme}
                options={[
                  ["dark", "داكن"],
                  ["light", "فاتح"],
                ]}
                onChange={(value) =>
                  setSettings((current) => ({ ...current, theme: value as "dark" | "light" }))
                }
              />
            </SettingsCard>
          </TabsContent>
        </Tabs>
        <div className="mt-6 flex justify-end">
          <Button onClick={save}>حفظ التغييرات</Button>
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
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" data-disabled={disabled}>
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  );
}
