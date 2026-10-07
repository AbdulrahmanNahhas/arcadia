import { UnplugIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ServiceNotice() {
  return (
    <Alert>
      <UnplugIcon aria-hidden="true" />
      <AlertTitle>واجهة البيانات غير متصلة بهذه الشاشة بعد</AlertTitle>
      <AlertDescription>
        يمكنك استكشاف الواجهة والمسودات. الحفظ والاستيراد والحذف غير متاحة حالياً، وبياناتك الحالية
        محفوظة.
      </AlertDescription>
    </Alert>
  );
}
