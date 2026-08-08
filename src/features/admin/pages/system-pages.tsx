import { BracketsCurlyIcon, DownloadSimpleIcon, LockKeyIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "../components/admin-page-header";

export function ImportExportPage() {
  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="الاستيراد والتصدير"
        description="أدوات نقل البيانات مع إبقاء المعرّفات المستقرة والمراجع تحت التحقق."
      />
      <div className="grid gap-4 md:grid-cols-2 p-6 pt-0 pr-4">
        <Card>
          <CardHeader>
            <CardTitle>تحرير السجلات</CardTitle>
            <CardDescription>راجع الحزم بصيغة JSON واحفظ التغييرات بعد التحقق.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link to="/admin/json" />}>
              <BracketsCurlyIcon data-icon="inline-start" /> فتح محرر JSON
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>نسخة قاعدة البيانات</CardTitle>
            <CardDescription>
              التصدير الكامل المباشر سيضاف بعد تثبيت عقدة النسخ؛ قاعدة SQLite الأصلية لا تُعدل من هذه
              الشاشة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              <DownloadSimpleIcon data-icon="inline-start" /> تصدير آمن — قريباً
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="الإعدادات"
        description="حدود الإصدار الحالي ونقاط التوسعة المستقبلية."
      />
      <div className="grid gap-4 md:grid-cols-2 p-6 pr-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>الملف المحلي الافتراضي</CardTitle>
            <CardDescription>
              الإصدار 1.0 يعمل بمستخدم محلي واحد، مع فصل بيانات المتابعة عن بيانات الكتالوج.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyIcon /> المصادقة والملفات المتعددة غير مفعّلة.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>تكاملات الوسائط</CardTitle>
            <CardDescription>
              معرّفات المزود الخارجي مستقلة عن معرّفات أركاديا الأساسية.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Jellyfin والتشغيل والمزامنة خارج نطاق الإصدار 1.0.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
