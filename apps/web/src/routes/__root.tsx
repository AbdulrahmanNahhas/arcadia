import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Scripts, redirect } from "@tanstack/react-router";
import { createRootRouteWithContext, Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppSidebar } from "@/app/app-sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getOwnerSession } from "@/features/auth/auth.functions";
import { LogoutButton } from "@/features/auth/logout-button";
import { databaseTools, serverSectionFor } from "@/features/dashboard/shell/navigation";
import { dashboardSearch } from "@/features/dashboard/shell/search";
import { collectionFor } from "@/features/database/records/collections";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  validateSearch: dashboardSearch,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login") return;
    if (!(await getOwnerSession())) throw redirect({ to: "/login", replace: true });
  },
  component: AppShell,
  ssr: false,
  shellComponent: RootDocument,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "نحّاسيو — لوحة الإدارة" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
});
function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/login") return <Outlet />;
  const database = pathname.startsWith("/database");
  const segment = pathname.split("/")[2] ?? "";
  const title = pathname.endsWith("/works/new")
    ? "عمل جديد"
    : database
      ? (collectionFor(segment)?.title ??
        databaseTools.find((tool) => tool.slug === segment)?.title ??
        "نظرة عامة")
      : (serverSectionFor(segment)?.title ?? "لوحة التحكم");
  return (
    <SidebarProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only">
        انتقل إلى المحتوى
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0" id="main-content" tabIndex={-1}>
        <header className="flex h-16 items-center gap-3 border-b px-6">
          <SidebarTrigger aria-label="إظهار أو إخفاء القائمة" />
          <Breadcrumb aria-label="مسار الصفحة">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to={database ? "/database" : "/"} />}>
                  {database ? "قاعدة البيانات" : "الخادم"}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ms-auto flex items-center gap-2">
            <Badge variant="outline">إدارة محلية</Badge>
            <LogoutButton />
          </div>
        </header>
        <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-6 p-5 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        <DirectionProvider direction="rtl">
          <TooltipProvider>{children}</TooltipProvider>
        </DirectionProvider>
        <Scripts />
      </body>
    </html>
  );
}
