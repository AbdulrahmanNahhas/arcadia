import { DirectionProvider } from "@base-ui/react";
import { ArrowClockwiseIcon, HouseIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthBoundary } from "@/features/accounts/auth-boundary";
import { SpatialNavigationRoot } from "@/features/platform/spatial-navigation";
import { themeRestoreScript } from "@/lib/theme";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "نحّاسينما — أركاديا" },
      { name: "description", content: "أرشيف عائلي للأفلام والمسلسلات والأنمي." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-8 pt-32">
      <h1 className="font-heading text-3xl">هذه المدار غير موجود</h1>
      <p className="mt-3 text-muted-foreground">ارجع إلى الأرشيف واختر مساراً آخر.</p>
    </main>
  ),
  errorComponent: FamilyRouteError,
  shellComponent: RootDocument,
});

function FamilyRouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-5 py-24">
      <Empty className="rounded-3xl border bg-card/60">
        <EmptyHeader>
          <WarningCircleIcon className="mx-auto size-9 text-destructive" />
          <EmptyTitle>تعذّر تحميل هذه الصفحة</EmptyTitle>
          <EmptyDescription>
            بقيت بياناتك المحفوظة آمنة. تحقق من اتصال خادم العائلة ثم أعد المحاولة.
            <span className="mt-2 block font-mono text-xs" dir="ltr">
              {message}
            </span>
          </EmptyDescription>
        </EmptyHeader>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.invalidate()}>
            <ArrowClockwiseIcon data-icon="inline-start" />
            إعادة المحاولة
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link to="/" />}>
            <HouseIcon data-icon="inline-start" />
            العودة إلى الرئيسية
          </Button>
        </div>
      </Empty>
    </main>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static preference restoration before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeRestoreScript }} />
        <HeadContent />
      </head>
      <body>
        <DirectionProvider direction="rtl">
          <SpatialNavigationRoot>
            <TooltipProvider>
              <AuthBoundary>{children}</AuthBoundary>
            </TooltipProvider>
          </SpatialNavigationRoot>
        </DirectionProvider>
        <Scripts />
      </body>
    </html>
  );
}
