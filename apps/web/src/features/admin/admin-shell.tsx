import {
  BuildingsIcon,
  HouseIcon,
  PlanetIcon,
  ShieldWarningIcon,
  SquaresFourIcon,
  TreeStructureIcon,
  UserGearIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import { currentProfile, type DemoProfile } from "@/features/profiles/model";

const sections = [
  {
    label: "المكتبة",
    items: [
      { title: "نظرة عامة", to: "/admin", icon: HouseIcon, exact: true },
      { title: "الأعمال", to: "/admin/catalog", icon: SquaresFourIcon },
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
      { title: "الحسابات والسياسات", to: "/admin/profiles", icon: UserGearIcon },
      { title: "التحقق", to: "/admin/validation", icon: ShieldWarningIcon },
    ],
  },
] as const;

const pageTitles = new Map(
  sections.flatMap((section) => section.items.map((item) => [item.to, item.title] as const)),
);

export function AdminShell() {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  useEffect(() => setProfile(currentProfile()), []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageTitle =
    [...pageTitles.entries()].find(([path]) =>
      path === "/admin" ? pathname === path : pathname.startsWith(path),
    )?.[1] ?? "لوحة الإدارة";

  if (!profile) return <div className="min-h-svh bg-background" />;
  if (profile.accountKind !== "admin")
    return (
      <main className="flex min-h-svh items-center justify-center px-5" dir="rtl">
        <div className="max-w-lg rounded-3xl border bg-card p-8 text-center">
          <ShieldWarningIcon className="mx-auto size-10 text-primary" />
          <h1 className="mt-5 font-heading text-2xl font-semibold">
            لوحة الإدارة مقفلة لهذا الملف
          </h1>
          <p className="mt-3 leading-7 text-muted-foreground">
            اختر ملف مدير أركاديا وأدخل الرقم التجريبي أولاً. هذا حاجز محلي للتطوير وليس مصادقة
            إنتاجية.
          </p>
          <Button className="mt-6" nativeButton={false} render={<Link to="/profiles" />}>
            اختيار ملف المدير
          </Button>
        </div>
      </main>
    );
  return (
    <SidebarProvider dir="rtl">
      <AdminSidebar pathname={pathname} />
      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-4 bg-background z-10 rounded-full px-3">
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
        {/*<div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">*/}
        <Outlet />
        {/*</div>*/}
      </SidebarInset>
    </SidebarProvider>
  );
}

function AdminSidebar({ pathname }: { pathname: string }) {
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
        <p className="px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          PostgreSQL v2 · إدارة تجريبية بلا مصادقة
        </p>
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
