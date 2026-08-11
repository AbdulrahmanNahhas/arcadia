import { ShieldCheckIcon, UserCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoProfiles } from "@/features/profiles/model";
import { AdminPageHeader } from "../components/admin-page-header";

const labels = {
  audience: "الجمهور",
  age: "العمر",
  sexuality: "المحتوى الجنسي",
  behavioral: "السلوك والعنف",
  theology: "الموضوعات العقدية",
} as const;

export function AdminProfilesPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminPageHeader
        title="الحسابات والسياسات"
        description="معاينة حدود الملفات التجريبية قبل ربط نظام الهوية الحقيقي. القيود الإدارية المخفية لا تظهر في إعدادات العائلة."
      />
      <div className="grid gap-5 px-6 pb-12 lg:grid-cols-3">
        {demoProfiles.map((profile) => (
          <Card key={profile.id} className="border-white/8">
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCircleIcon />
              </div>
              <CardTitle>{profile.name}</CardTitle>
              <CardDescription>{profile.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={profile.accountKind === "admin" ? "default" : "secondary"}>
                {profile.accountKind === "admin"
                  ? "مدير"
                  : profile.accountKind === "family"
                    ? "عائلة"
                    : "فردي"}
              </Badge>
              <dl className="mt-5 space-y-3">
                {Object.entries(profile.policy).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 border-b border-white/6 pb-2 text-sm"
                  >
                    <dt className="text-muted-foreground">{labels[key as keyof typeof labels]}</dt>
                    <dd className="font-mono">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheckIcon /> بيانات تجريبية محلية؛ إدارة الاعتمادات TODO(auth).
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
