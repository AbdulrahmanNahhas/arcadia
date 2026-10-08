import { DownloadIcon, PlusIcon, SaveIcon } from "lucide-react";

import { DraftField, ChoiceField } from "@/components/dashboard/draft-fields";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecordTable } from "@/components/dashboard/record-table";
import { ServiceNotice } from "@/components/dashboard/service-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { serverSections } from "@/features/dashboard/shell/navigation";
import { AccessDraftCard } from "@/features/server/overview/access-draft-card";

interface ServerSectionPageProps {
  section: (typeof serverSections)[number];
}
const connectionSettings = [
  { name: "TMDB", description: "العناوين، المواسم، الحلقات، والهويات الخارجية." },
  { name: "Fanart", description: "الخلفيات والشعارات والصور البديلة للأعمال." },
  { name: "OpenSubtitles", description: "البحث عن الترجمات وربط اللغات بالمصادر." },
  { name: "Jellyfin", description: "فهرسة ملفات مكتبة المنزل وتشغيلها على الأجهزة." },
  { name: "مصادر التشغيل", description: "إضافات المصادر، المرشّحات، واختبار الاتصال." },
];

export function ServerSectionPage({ section }: ServerSectionPageProps) {
  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        eyebrow="إدارة الخادم"
        upcoming
        actions={
          <Button disabled>
            <PlusIcon data-icon="inline-start" />
            {section.slug === "backups"
              ? "نسخة جديدة"
              : section.slug === "updates"
                ? "فحص التحديثات"
                : "إضافة"}
          </Button>
        }
      />
      <ServiceNotice />
      {section.slug === "integrations" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {connectionSettings.map((connection) => (
            <Card key={connection.name}>
              <CardHeader>
                <CardTitle>{connection.name}</CardTitle>
                <CardDescription>{connection.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <DraftField
                    label={connection.name === "Jellyfin" ? "عنوان الخادم" : "مفتاح الاتصال"}
                    type={connection.name === "Jellyfin" ? "url" : "password"}
                    placeholder={
                      connection.name === "Jellyfin" ? "http://…" : "لن يُعرض المفتاح بعد حفظه"
                    }
                  />
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <div className="flex gap-2">
                  <Button variant="outline" disabled>
                    اختبار الاتصال
                  </Button>
                  <Button disabled>
                    <SaveIcon data-icon="inline-start" />
                    حفظ
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="records">
          <TabsList>
            <TabsTrigger value="records">
              {section.slug === "settings" ? "الإعدادات العامة" : "السجلات"}
            </TabsTrigger>
            <TabsTrigger value="configuration">الإعدادات والخيارات</TabsTrigger>
          </TabsList>
          <TabsContent value="records">
            <RecordTable title={section.title} columns={section.columns} />
          </TabsContent>
          <TabsContent value="configuration">
            {section.slug === "accounts" ||
            section.slug === "profiles" ||
            section.slug === "policies" ? (
              <AccessDraftCard section={section.slug} />
            ) : (
              <ConfigurationCard section={section.slug} />
            )}
          </TabsContent>
        </Tabs>
      )}
      {(section.slug === "backups" || section.slug === "updates") && (
        <Card>
          <CardHeader>
            <CardTitle>
              {section.slug === "backups" ? "الاستعادة والتحقق" : "تحديث آمن وقابل للرجوع"}
            </CardTitle>
            <CardDescription>
              {section.slug === "backups"
                ? "اختر نسخة، راجع محتواها، ثم اختبر الاستعادة قبل استخدامها."
                : "مراجعة الإصدار، التحقق من التوافق، ثم تحديث الخادم ومراقبة النتيجة."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <DraftField
                label={section.slug === "backups" ? "ملف النسخة" : "الإصدار المستهدف"}
                placeholder={
                  section.slug === "backups" ? "اختر نسخة من السجل" : "اختر إصداراً متاحاً"
                }
              />
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled>
              <DownloadIcon data-icon="inline-start" />
              {section.slug === "backups" ? "اختبار الاستعادة" : "مراجعة خطة التحديث"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
function ConfigurationCard({ section }: { section: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>خيارات الخدمة</CardTitle>
        <CardDescription>
          مسودة إعدادات محلية. تطبيقها يتطلب اتصال الخدمة والصلاحية المناسبة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid sm:grid-cols-2">
          <DraftField
            label={section === "library" || section === "downloads" ? "مسار مكتبة الملفات" : "الاسم"}
            placeholder={section === "library" ? "/path/to/library" : "اسم واضح"}
          />
          <DraftField label={section === "accounts" ? "اسم المستخدم" : "الوصف"} />
          <ChoiceField
            label="النطاق"
            options={[
              { value: "family", label: "العائلة" },
              { value: "personal", label: "شخصي" },
            ]}
          />
          <DraftField label="ملاحظات" multiline />
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button disabled>
          <SaveIcon data-icon="inline-start" />
          حفظ الإعدادات
        </Button>
      </CardFooter>
    </Card>
  );
}
