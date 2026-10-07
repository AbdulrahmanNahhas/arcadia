import { ArrowLeftIcon, FilmIcon, ImageIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChoiceField, DraftField } from "@/features/dashboard/draft-fields";
import { PageHeader } from "@/features/dashboard/page-header";
import { ServiceNotice } from "@/features/dashboard/service-notice";

export function ImportsPage() {
  return (
    <>
      <PageHeader
        title="TMDB وFanart"
        description="ابحث، عاين البيانات والصور، واختر ما تريد دمجه. لا يُستبدل المحتوى التحريري دون مراجعتك."
        eyebrow="قاعدة البيانات / الاستيراد"
        upcoming
      />
      <ServiceNotice />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          ١. اختيار المصدر — ٢. النتائج — ٣. مقارنة التغييرات — ٤. تطبيق
        </p>
        <Progress value={25} aria-label="الخطوة الأولى من أربع خطوات للاستيراد" />
      </div>
      <Tabs defaultValue="tmdb">
        <TabsList>
          <TabsTrigger value="tmdb">بيانات TMDB</TabsTrigger>
          <TabsTrigger value="fanart">صور Fanart</TabsTrigger>
          <TabsTrigger value="episodes">مواسم وحلقات</TabsTrigger>
        </TabsList>
        <TabsContent value="tmdb">
          <ImportPanel provider="TMDB" />
        </TabsContent>
        <TabsContent value="fanart">
          <ImportPanel provider="Fanart" />
        </TabsContent>
        <TabsContent value="episodes">
          <Card>
            <CardHeader>
              <CardTitle>استيراد موسم وحلقاته</CardTitle>
              <CardDescription>
                مراجعة الأرقام والعناوين والصور مع الحفاظ على هويات الحلقات الحالية.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid sm:grid-cols-2">
                <DraftField label="معرّف المسلسل في TMDB" type="number" />
                <DraftField label="رقم الموسم" type="number" />
                <DraftField label="العمل المستهدف" />
                <ChoiceField
                  label="اللغة"
                  options={[
                    { value: "ar", label: "العربية أولاً" },
                    { value: "en", label: "الإنجليزية" },
                  ]}
                />
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button disabled>
                جلب المعاينة
                <ArrowLeftIcon data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
function ImportPanel({ provider }: { provider: "TMDB" | "Fanart" }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>البحث في {provider}</CardTitle>
          <CardDescription>
            {provider === "TMDB"
              ? "اسم العمل أو معرّفه الخارجي."
              : "معرّف العمل، ثم نوع الصور التي تحتاجها."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <DraftField
              label="اسم العمل أو المعرّف"
              placeholder={provider === "TMDB" ? "اسم فيلم أو مسلسل" : "معرّف TMDB أو TVDB"}
            />
            <ChoiceField
              label={provider === "TMDB" ? "نوع العمل" : "نوع الصورة"}
              options={
                provider === "TMDB"
                  ? [
                      { value: "tv", label: "مسلسل" },
                      { value: "movie", label: "فيلم" },
                    ]
                  : [
                      { value: "poster", label: "ملصق" },
                      { value: "background", label: "خلفية" },
                      { value: "logo", label: "شعار" },
                    ]
              }
            />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button disabled>
            <SearchIcon data-icon="inline-start" />
            البحث
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>معاينة النتائج</CardTitle>
          <CardDescription>التغييرات والصور ستظهر قبل إدخال أي شيء إلى المكتبة.</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {provider === "TMDB" ? <FilmIcon /> : <ImageIcon />}
              </EmptyMedia>
              <EmptyTitle>الخدمة قيد الربط</EmptyTitle>
              <EmptyDescription>
                لن تُحفظ بيانات أو صور حتى تختار النتيجة وتراجع عملية الدمج.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
        <CardFooter>
          <Button variant="outline" disabled>
            مقارنة مع السجل الحالي
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
