import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddWorksDialog } from "../components/add-works-dialog";
import { AdminPageHeader } from "../components/admin-page-header";

export function AdminNewWorkPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        title="إضافة عمل"
        description="أنشئ عملاً واحداً أو الصق مجموعة أعمال من نفس الواجهة، ثم أكمل التفاصيل من محرر الكتالوج."
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            فتح واجهة الإضافة
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>واجهة الإضافة الموحدة</CardTitle>
          <CardDescription>
            هذه الصفحة تستخدم نفس أداة الإضافة المتقدمة في الكتالوج: نموذج موجّه لعمل واحد أو لصق
            منظّم لعدة أعمال دفعة واحدة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => setOpen(true)}>
            إضافة أعمال
          </Button>
        </CardContent>
      </Card>
      <AddWorksDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["works"] });
          await navigate({ to: "/admin/catalog" });
        }}
      />
    </div>
  );
}
