import {
  BuildingsIcon,
  ChartBarIcon,
  HouseIcon,
  ImagesIcon,
  PlanetIcon,
  PulseIcon,
  ShieldWarningIcon,
  SquaresFourIcon,
  TranslateIcon,
  TreeStructureIcon,
  UserGearIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentAccount } from "@/features/accounts/api";

const sections = [
  {
    label: "المكتبة",
    items: [
      { title: "نظرة عامة", to: "/admin", icon: HouseIcon, exact: true },
      { title: "عمليات الأرشيف", to: "/admin/archive", icon: PulseIcon },
      { title: "الإحصاءات", to: "/admin/statistics", icon: ChartBarIcon },
      { title: "الأعمال", to: "/admin/catalog", icon: SquaresFourIcon },
      { title: "مكتبة الوسائط", to: "/admin/media", icon: ImagesIcon },
      { title: "المفردات والترجمات", to: "/admin/vocabularies", icon: TranslateIcon },
    ],
  },
  {
    label: "الكيانات والمعرفة",
    items: [
      { title: "الأشخاص", to: "/admin/people", icon: UsersThreeIcon },
      { title: "الاستوديوهات", to: "/admin/studios", icon: BuildingsIcon },
      { title: "الكواكب", to: "/admin/planets", icon: PlanetIcon },
      { title: "العلاقات والسلالة", to: "/admin/relationships", icon: TreeStructureIcon },
    ],
  },
  {
    label: "الحسابات والنظام",
    items: [
      { title: "الحسابات والسياسات", to: "/admin/accounts", icon: UserGearIcon },
      { title: "التحقق", to: "/admin/validation", icon: ShieldWarningIcon },
    ],
  },
] as const;

const pageTitles = new Map(
  sections.flatMap((section) => section.items.map((item) => [item.to, item.title] as const)),
);

export function AdminShell() {
  const { data, isPending } = useCurrentAccount();
  const account = data?.account;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageTitle =
    [...pageTitles.entries()].find(([path]) =>
      path === "/admin" ? pathname === path : pathname.startsWith(path),
    )?.[1] ?? "لوحة الإدارة";

  if (isPending)
    return (
      <div className="grid min-h-svh grid-cols-[18rem_1fr] gap-6 bg-background p-6" dir="rtl">
        <Skeleton className="h-full rounded-3xl" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-48 rounded-3xl" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  if (!account || (account.role !== "owner" && account.role !== "editor"))
    return (
      <main className="flex min-h-svh items-center justify-center px-5" dir="rtl">
        <Empty className="max-w-lg rounded-3xl border bg-card p-8">
          <EmptyHeader>
            <ShieldWarningIcon />
            <EmptyTitle>لوحة الإدارة مقفلة لهذا الحساب</EmptyTitle>
            <EmptyDescription>
              هذا الحساب عضو في العائلة ولا يملك صلاحيات تحرير. يستطيع المالك تفويض صلاحيات دقيقة من
              صفحة الحسابات.
            </EmptyDescription>
          </EmptyHeader>
          <Button nativeButton={false} render={<Link to="/accounts" />}>
            العودة إلى الحسابات
          </Button>
        </Empty>
      </main>
    );
  return (
    <SidebarProvider dir="rtl" defaultOpen>
      <AdminSidebar pathname={pathname} displayName={account.displayName} role={account.role} />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <SidebarTrigger className="-me-1 rotate-180" variant={"outline"} size={"icon-lg"} />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink render={<Link to="/admin" />}>الإدارة</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:list-item" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/" />}
            className="ms-auto"
          >
            <HouseIcon data-icon="inline-start" />
            <span className="hidden sm:inline">المنصة</span>
          </Button>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

function AdminSidebar({
  pathname,
  displayName,
  role,
}: {
  pathname: string;
  displayName: string;
  role: string;
}) {
  return (
    <Sidebar side="right" dir="rtl" collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/admin" />}
              tooltip="مركز إدارة نحّاسينما"
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                أ
              </span>
              <span className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-heading font-semibold">نحّاسينما</span>
                <span className="truncate text-xs text-muted-foreground">مركز إدارة الأرشيف</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavItem
                    key={item.to}
                    item={item}
                    active={
                      "exact" in item && item.exact
                        ? pathname === item.to
                        : pathname.startsWith(item.to)
                    }
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/accounts" />} tooltip={displayName}>
              <Avatar>
                <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {role === "owner" ? "مالك · PostgreSQL v2" : "محرر · PostgreSQL v2"}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { readonly title: string; readonly to: string; readonly icon: ComponentType };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} tooltip={item.title} render={<Link to={item.to} />}>
        <Icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
