import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useRouterState } from "@tanstack/react-router";

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
import { databaseTools, serverSectionFor } from "@/features/dashboard/navigation";
import { collectionFor } from "@/features/database/collections";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppShell,
});
function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const database = pathname.startsWith("/database");
  const segment = pathname.split("/")[2] ?? "";
  const title =
    pathname === "/login"
      ? "تسجيل الدخول"
      : pathname.endsWith("/works/new")
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
      <SidebarInset id="main-content" tabIndex={-1}>
        <header className="flex h-16 items-center gap-3 border-b px-6">
          <SidebarTrigger aria-label="إظهار أو إخفاء القائمة" />
          {/*<Separator orientation="vertical" className="h-16" />*/}
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
          <div className="ms-auto">
            <Badge variant="outline">واجهة معاينة</Badge>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-5 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
