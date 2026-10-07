import { KeyRoundIcon } from "lucide-react";

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

import { DraftField } from "./draft-fields";
import { PageHeader } from "./page-header";
import { ServiceNotice } from "./service-notice";
export function LoginPage() {
  return (
    <>
      <PageHeader
        title="تسجيل الدخول"
        description="الوصول إلى أدوات الإدارة مرتبط بحسابك وصلاحياتك. الحسابات الحالية ستبقى محفوظة عند انتقال الخدمة."
        eyebrow="الهوية والوصول"
        upcoming
      />
      <ServiceNotice />
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>حساب الإدارة</CardTitle>
            <CardDescription>واجهة تسجيل الدخول جاهزة؛ خدمة الهوية قيد التوصيل.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <DraftField label="اسم المستخدم" />
              <DraftField label="كلمة المرور" type="password" />
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button disabled>
              <KeyRoundIcon data-icon="inline-start" />
              تسجيل الدخول
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
