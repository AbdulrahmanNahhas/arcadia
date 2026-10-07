import { ArchiveRestoreIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/features/dashboard/page-header";
import { RecordTable } from "@/features/dashboard/record-table";
export function RevisionsPage() {
  return (
    <>
      <PageHeader
        title="السجل وسلة المحذوفات"
        description="من غيّر ماذا، مقارنة النسخ، واستعادة السجلات المحذوفة مع مراجعة روابطها."
        eyebrow="قاعدة البيانات / التاريخ"
        actions={
          <Button variant="outline" disabled>
            <ArchiveRestoreIcon data-icon="inline-start" />
            استعادة المحدد
          </Button>
        }
      />

      <Tabs defaultValue="revisions">
        <TabsList>
          <TabsTrigger value="revisions">نسخ السجلات</TabsTrigger>
          <TabsTrigger value="audit">سجل العمليات</TabsTrigger>
          <TabsTrigger value="trash">سلة المحذوفات</TabsTrigger>
        </TabsList>
        <TabsContent value="revisions">
          <RecordTable
            table="editorial_revisions"
            title="تاريخ التعديلات"
            columns={["السجل", "الإصدار", "التغيير", "الكاتب", "الوقت"]}
          />
        </TabsContent>
        <TabsContent value="audit">
          <RecordTable
            table="audit_logs"
            title="سجل العمليات"
            columns={["العملية", "الهدف", "المستخدم", "النتيجة", "الوقت"]}
          />
        </TabsContent>
        <TabsContent value="trash">
          <RecordTable
            table="audit_logs"
            filters={{ action: "local.delete" }}
            title="السجلات المحذوفة"
            columns={["السجل", "النوع", "حُذف بواسطة", "التاريخ", "الاستعادة"]}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
