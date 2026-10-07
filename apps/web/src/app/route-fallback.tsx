import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function RouteFallback() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>تعذّر عرض هذه الصفحة</EmptyTitle>
        <EmptyDescription>ارجع إلى الصفحة الرئيسية وحاول مرة أخرى.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          الصفحة الرئيسية
        </Link>
      </EmptyContent>
    </Empty>
  );
}
