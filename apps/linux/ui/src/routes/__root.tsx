import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { z } from "zod";

import { App } from "../app/app";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";

const searchSchema = z.record(z.string(), z.string());
function MissingPage() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>الصفحة غير موجودة</EmptyTitle>
        <EmptyDescription>ارجع إلى المكتبة واختر الصفحة من التنقل.</EmptyDescription>
      </EmptyHeader>
      <Button onClick={() => window.history.back()}>العودة</Button>
    </Empty>
  );
}
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  validateSearch: (search) => searchSchema.parse(search),
  component: App,
  notFoundComponent: MissingPage,
  errorComponent: ({ error }) => (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>تعذّر فتح الصفحة</EmptyTitle>
        <EmptyDescription>
          {z.instanceof(Error).safeParse(error).data?.message ?? "أعد فتح الصفحة من المكتبة."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
});
