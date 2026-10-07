import { ImageIcon, SearchIcon, UploadIcon } from "lucide-react";

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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChoiceField, DraftField } from "@/features/dashboard/draft-fields";
import { PageHeader } from "@/features/dashboard/page-header";
import { ServiceNotice } from "@/features/dashboard/service-notice";

export function ImagesPage() {
  return (
    <>
      <PageHeader
        title="مكتبة الصور"
        description="الملصقات والخلفيات والشعارات وصور الأشخاص. بحث، ربط، ومراجعة الصور غير المستخدمة."
        eyebrow="قاعدة البيانات / الوسائط"
        upcoming
        actions={
          <Button disabled>
            <UploadIcon data-icon="inline-start" />
            رفع صور
          </Button>
        }
      />
      <ServiceNotice />
      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">الصور المسجلة</TabsTrigger>
          <TabsTrigger value="assignment">ربط صورة</TabsTrigger>
          <TabsTrigger value="cleanup">الصور غير المستخدمة</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <Card>
            <CardHeader>
              <CardTitle>جميع الصور</CardTitle>
              <CardDescription>تصفية حسب الدور والسجل ووجود الملف على القرص.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                <div className="flex max-w-sm">
                  <InputGroup>
                    <InputGroupAddon>
                      <SearchIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      placeholder="ابحث باسم العمل أو الصورة"
                      disabled
                      aria-label="بحث الصور"
                    />
                  </InputGroup>
                </div>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ImageIcon />
                    </EmptyMedia>
                    <EmptyTitle>بانتظار خدمة الصور</EmptyTitle>
                    <EmptyDescription>
                      الصور الحالية محفوظة. ستظهر هنا معايناتها وارتباطاتها عند توصيل الخدمة.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled>
                فحص وجود الملفات
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="assignment">
          <Card>
            <CardHeader>
              <CardTitle>ربط صورة بسجل</CardTitle>
              <CardDescription>
                اختيار الصورة والدور وصاحبها، مع معاينة قبل تطبيق التغيير.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid sm:grid-cols-2">
                <ChoiceField
                  label="دور الصورة"
                  options={[
                    { value: "poster", label: "ملصق" },
                    { value: "banner", label: "خلفية" },
                    { value: "logo", label: "شعار" },
                    { value: "profile", label: "صورة شخصية" },
                  ]}
                />
                <DraftField label="السجل" placeholder="عمل، جزء، حلقة، أو شخص" />
                <DraftField label="معرّف الصورة" />
                <DraftField label="ملاحظات" />
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button disabled>معاينة الربط</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="cleanup">
          <Card>
            <CardHeader>
              <CardTitle>مراجعة الصور غير المرتبطة</CardTitle>
              <CardDescription>
                راجِع الاستخدام قبل الحذف، مع فصل الصور المفقودة عن الصور غير المستخدمة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>نتائج الفحص غير متاحة بعد</EmptyTitle>
                  <EmptyDescription>لا تجري هذه الشاشة أي حذف تلقائي.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled>
                بدء الفحص
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
