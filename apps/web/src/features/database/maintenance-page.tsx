import { CheckCheckIcon, CircleAlertIcon, MergeIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/features/dashboard/page-header";
import { RecordTable } from "@/features/dashboard/record-table";
import { ServiceNotice } from "@/features/dashboard/service-notice";

const checks = [
  {
    title: "اكتمال البيانات",
    description: "العناوين العربية، الصور، المراجع، والتصنيف العائلي.",
    icon: CheckCheckIcon,
  },
  {
    title: "سلامة العلاقات",
    description: "الأجزاء والحلقات والمفاتيح الخارجية وهويات السجلات.",
    icon: CircleAlertIcon,
  },
  {
    title: "السجلات المتشابهة",
    description: "مقارنة المرشحين للدمج وتحديد السجل الذي سيبقى.",
    icon: MergeIcon,
  },
];
export function MaintenancePage() {
  return (
    <>
      <PageHeader
        title="التحقق والصيانة"
        description="نتائج واضحة، إصلاحات قابلة للمراجعة، ودمج يحافظ على البيانات والروابط."
        eyebrow="قاعدة البيانات / الجودة"
        upcoming
      />
      <ServiceNotice />
      <div className="grid gap-4 md:grid-cols-3">
        {checks.map((check) => (
          <Card key={check.title}>
            <CardHeader>
              <CardTitle>{check.title}</CardTitle>
              <CardDescription>{check.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <check.icon />
              </span>
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled>
                <PlayIcon data-icon="inline-start" />
                بدء الفحص
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <RecordTable
        title="نتائج الفحص"
        columns={["الشدة", "السجل", "المشكلة", "الإصلاح المقترح", "الحالة"]}
      />
    </>
  );
}
