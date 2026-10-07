import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BracesIcon, ImageIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChoiceField, DraftField } from "@/features/dashboard/draft-fields";
import { PageHeader } from "@/features/dashboard/page-header";
import {
  ageChoices,
  audienceChoices,
  riskChoices,
} from "@/features/database/classification-choices";
import { databaseKeys } from "@/features/database/database.queries";
import { applyWork } from "@/features/database/work.functions";

const scoreCriteria = ["القصة", "الشخصيات", "العمق", "بناء العالم", "الأصالة", "الصنعة"];
export function WorkEditorPage() {
  const [result, setResult] = useState<string | null>(null);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: (json: string) => applyWork({ data: { json, dryRun: false, createOnly: true } }),
    onSuccess: async (outcome) => {
      setResult(`حُفظ العمل · ${outcome.titleId}`);
      await client.invalidateQueries({ queryKey: databaseKeys.all });
    },
  });
  function submit(form: FormData) {
    const text = (key: string) => String(form.get(key) ?? "");
    const list = (key: string) =>
      text(key)
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean);
    const optionalNumber = (key: string) => (text(key) ? Number(text(key)) : null);
    const document = {
      canonicalTitle: text("العنوان الأصلي"),
      titleAr: text("العنوان العربي"),
      releaseYear: optionalNumber("سنة الإصدار"),
      format: text("الشكل") || "animated",
      workflowStatus: text("حالة التحرير") || "draft",
      summary: text("الملخص"),
      aliases: list("الأسماء البديلة"),
      genres: list("الأنواع"),
      audience: text("الجمهور") || "general",
      age: text("العمر") || "all",
      sexualityRisk: text("المحتوى الجنسي") || "none",
      behavioralRisk: text("المحتوى السلوكي") || "none",
      theologyRisk: text("المحتوى العقدي") || "none",
      contentWarnings: text("تنبيهات المحتوى"),
      analysisNotes: text("الملاحظات العقدية والتحليلية"),
      tmdbId: optionalNumber("TMDB"),
      imdbId: text("IMDb") || null,
    };
    save.mutate(JSON.stringify(document));
  }
  return (
    <>
      <PageHeader
        title="عمل جديد"
        description="مسودة محلية، مقسمة إلى أقسام واضحة. لا يُرسل شيء إلى قاعدة البيانات قبل المراجعة والحفظ."
        eyebrow="قاعدة البيانات / الأعمال / مسودة"
        actions={
          <>
            <Link to="/database/json" className={buttonVariants({ variant: "outline" })}>
              <BracesIcon data-icon="inline-start" />
              JSON
            </Link>
            <Button type="submit" form="new-work-form" disabled={save.isPending}>
              <SaveIcon data-icon="inline-start" />
              حفظ العمل
            </Button>
          </>
        }
      />
      {save.isError && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر حفظ العمل</AlertTitle>
          <AlertDescription>{save.error.message}</AlertDescription>
        </Alert>
      )}
      {result && (
        <Alert>
          <AlertTitle>حُفظ العمل</AlertTitle>
          <AlertDescription>{result}</AlertDescription>
        </Alert>
      )}
      <form
        id="new-work-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <Tabs defaultValue="identity">
          <TabsList variant="line">
            <TabsTrigger value="identity">الهوية</TabsTrigger>
            <TabsTrigger value="structure">الأجزاء والحلقات</TabsTrigger>
            <TabsTrigger value="guidance">المحتوى العائلي</TabsTrigger>
            <TabsTrigger value="scores">التقييم والتحليل</TabsTrigger>
            <TabsTrigger value="images">الصور</TabsTrigger>
            <TabsTrigger value="links">العلاقات والمراجع</TabsTrigger>
          </TabsList>
          <TabsContent keepMounted value="identity">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>هوية العمل</CardTitle>
                  <CardDescription>الأسماء واللغة والشكل وحالة التحرير.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="grid sm:grid-cols-2">
                    <DraftField label="العنوان الأصلي" />
                    <DraftField label="العنوان العربي" />
                    <DraftField label="سنة الإصدار" type="number" />
                    <ChoiceField
                      label="الشكل"
                      options={[
                        { value: "animated", label: "رسوم متحركة" },
                        { value: "live-action", label: "تصوير حي" },
                      ]}
                    />
                    <ChoiceField
                      label="حالة التحرير"
                      options={[
                        { value: "draft", label: "مسودة" },
                        { value: "in_review", label: "قيد المراجعة" },
                        { value: "published", label: "منشور" },
                      ]}
                    />
                    <DraftField label="الأسماء البديلة" placeholder="اسم واحد في كل سطر" multiline />
                  </FieldGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>الوصف والتصنيف</CardTitle>
                  <CardDescription>ملخص واضح، ثم مفردات تضبط البحث والعلاقات.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <DraftField label="الملخص" multiline />
                    <DraftField label="الأنواع" placeholder="اختر من المفردات المعتمدة" />
                    <DraftField disabled label="النبرات والوسوم" />
                    <DraftField disabled label="البلدان والعوالم" />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent keepMounted value="structure">
            <Card>
              <CardHeader>
                <CardTitle>بنية العمل</CardTitle>
                <CardDescription>
                  المواسم والأفلام والعروض الخاصة والحلقات، مع الحفاظ على هوياتها عند تعديلها.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PlusIcon />
                    </EmptyMedia>
                    <EmptyTitle>أضف أول جزء للعمل</EmptyTitle>
                    <EmptyDescription>
                      تظهر الحلقات داخل موسمها، مع أدوات ترتيب وتحرير واستيراد منفصلة.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
              <CardFooter>
                <div className="flex gap-2">
                  <Button disabled>إضافة موسم</Button>
                  <Button variant="outline" disabled>
                    إضافة فيلم أو عرض خاص
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent keepMounted value="guidance">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>التصنيف العائلي</CardTitle>
                  <CardDescription>
                    قيود واضحة لكل محور، دون خلط تقييم الجودة بسلامة المحتوى.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="grid sm:grid-cols-2">
                    <ChoiceField label="الجمهور" options={audienceChoices} />
                    <ChoiceField label="العمر" options={ageChoices} />
                    <ChoiceField label="المحتوى الجنسي" options={riskChoices} />
                    <ChoiceField label="المحتوى السلوكي" options={riskChoices} />
                    <ChoiceField label="المحتوى العقدي" options={riskChoices} />
                  </FieldGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>ملاحظات المحتوى</CardTitle>
                  <CardDescription>ما تحتاج العائلة إلى معرفته قبل المشاهدة.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <DraftField label="تنبيهات المحتوى" multiline />
                    <DraftField label="الملاحظات العقدية والتحليلية" multiline />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent keepMounted value="scores">
            <Card>
              <CardHeader>
                <CardTitle>المعايير الستة</CardTitle>
                <CardDescription>
                  تقييمات الأجزاء وملاحظات التحرير؛ لكل معيار نطاق من صفر إلى عشرة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
                  {scoreCriteria.map((criterion) => (
                    <DraftField
                      key={criterion}
                      disabled
                      label={criterion}
                      type="number"
                      step="0.1"
                      min={0}
                      max={10}
                      placeholder="0 – 10"
                    />
                  ))}
                  <DraftField disabled label="ملاحظات التحليل" multiline />
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <Badge variant="outline">تحتاج التقييمات إلى جزء محدد عند الحفظ</Badge>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent keepMounted value="images">
            <div className="grid gap-4 md:grid-cols-3">
              {["الملصق", "الخلفية", "الشعار"].map((kind) => (
                <Card key={kind}>
                  <CardHeader>
                    <CardTitle>{kind}</CardTitle>
                    <CardDescription>اختيار من المكتبة أو جلب من مصادر الصور.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <ImageIcon />
                        </EmptyMedia>
                        <EmptyTitle>لم تُختر صورة</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" disabled>
                      اختيار صورة
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent keepMounted value="links">
            <Card>
              <CardHeader>
                <CardTitle>المراجع والعلاقات</CardTitle>
                <CardDescription>
                  المعرّفات الخارجية، الأشخاص والاستوديوهات، وربط الأعمال ببعضها.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid sm:grid-cols-2">
                  <DraftField label="TMDB" />
                  <DraftField label="IMDb" />
                  <DraftField disabled label="AniList / MAL" />
                  <DraftField disabled label="المساهمات والأدوار" />
                  <DraftField disabled label="الأعمال المرتبطة" />
                  <DraftField disabled label="المراجع والمعلومات الإضافية" multiline />
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </>
  );
}
