import { SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  ageChoices,
  audienceChoices,
  riskChoices,
} from "@/features/database/classification-choices";

import { ChoiceField, DraftField } from "./draft-fields";

const capabilities = [
  "تحرير الأعمال",
  "إدارة الصور",
  "تحرير الأشخاص",
  "تحرير الاستوديوهات",
  "تحرير الجوائز",
  "إدارة الحسابات",
  "إدارة السياسات",
  "مراجعة النشاط والإحصاءات",
];
export function AccessDraftCard({ section }: { section: "accounts" | "profiles" | "policies" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {section === "accounts"
            ? "هوية المستخدم وصلاحياته"
            : section === "profiles"
              ? "ملف مشاهدة جديد"
              : "سياسة المحتوى"}
        </CardTitle>
        <CardDescription>
          مسودة محلية؛ تطبيق الصلاحيات والتغييرات يحتاج خدمة الهوية والبيانات.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {section === "accounts" ? (
            <>
              <FieldGroup className="grid sm:grid-cols-2">
                <DraftField label="اسم المستخدم" />
                <DraftField label="الاسم المعروض" />
                <DraftField label="البريد الإلكتروني" />
                <DraftField label="كلمة مرور أولية" type="password" />
                <ChoiceField
                  label="الدور"
                  options={[
                    { value: "owner", label: "مالك" },
                    { value: "editor", label: "محرر" },
                    { value: "member", label: "عضو" },
                  ]}
                />
                <ChoiceField
                  label="الحالة"
                  options={[
                    { value: "active", label: "نشط" },
                    { value: "invited", label: "مدعو" },
                    { value: "suspended", label: "موقوف" },
                  ]}
                />
              </FieldGroup>
              <FieldSet>
                <FieldLegend>تفويض الصلاحيات</FieldLegend>
                <FieldGroup className="grid sm:grid-cols-2">
                  {capabilities.map((capability, index) => (
                    <Field key={capability} orientation="horizontal">
                      <Checkbox id={`capability-${index}`} />
                      <FieldLabel htmlFor={`capability-${index}`}>{capability}</FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            </>
          ) : (
            <>
              <FieldGroup className="grid sm:grid-cols-2">
                <DraftField label={section === "profiles" ? "اسم ملف المشاهدة" : "اسم السياسة"} />
                <DraftField label="المستخدم أو الملفات المستهدفة" />
                <ChoiceField label="الجمهور المسموح" options={audienceChoices} />
                <ChoiceField label="العمر المسموح" options={ageChoices} />
                <ChoiceField label="المحتوى الجنسي" options={riskChoices} />
                <ChoiceField label="المحتوى السلوكي" options={riskChoices} />
                <ChoiceField label="المحتوى العقدي" options={riskChoices} />
                <DraftField label="المكتبات المسموحة" />
              </FieldGroup>
              <FieldSet>
                <FieldLegend>قواعد إضافية</FieldLegend>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Checkbox id="explicit-allowlist" />
                    <FieldLabel htmlFor="explicit-allowlist">
                      الاكتفاء بالأعمال المسموحة صراحة
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox id="allow-server-downloads" />
                    <FieldLabel htmlFor="allow-server-downloads">
                      السماح بطلب تنزيلات إلى مكتبة المنزل
                    </FieldLabel>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </>
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button disabled>
          <SaveIcon data-icon="inline-start" />
          حفظ ومراجعة الصلاحيات
        </Button>
      </CardFooter>
    </Card>
  );
}
