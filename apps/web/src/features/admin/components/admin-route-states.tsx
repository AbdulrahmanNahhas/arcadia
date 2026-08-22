import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level fallback UI for admin pages — previously none of these routes had one, so a
 * failed initial load (403 from a capability gate, a network error) or a slow load had no
 * dedicated fallback, just whatever TanStack Router's built-in default renders.
 */
export function AdminRoutePending() {
  return (
    <div className="flex min-w-0 flex-col gap-6 p-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

export function AdminRouteError({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <div className="p-6">
      <Empty className="rounded-3xl border">
        <EmptyHeader>
          <WarningCircleIcon className="mx-auto size-8 text-destructive" />
          <EmptyTitle>تعذّر تحميل هذه الصفحة</EmptyTitle>
          <EmptyDescription>{error.message}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => router.invalidate()}>
          <ArrowClockwiseIcon data-icon="inline-start" /> إعادة المحاولة
        </Button>
      </Empty>
    </div>
  );
}
