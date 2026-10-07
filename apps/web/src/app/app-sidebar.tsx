import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  LogInIcon,
  ServerIcon,
} from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { databaseTools, serverSections } from "@/features/dashboard/navigation";
import { collections } from "@/features/database/collections";

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const database = pathname.startsWith("/database");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const WorkspaceIcon = database ? DatabaseIcon : ServerIcon;

  return (
    <Sidebar
      side="right"
      dir="rtl"
      variant="floating"
      collapsible="icon"
      aria-label="التنقل الرئيسي"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" isActive={workspaceOpen} />}
                aria-label="اختيار مساحة العمل"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <WorkspaceIcon />
                </span>
                <span className="grid flex-1 text-start leading-tight">
                  <span className="truncate font-semibold text-sm">
                    {database ? "قاعدة البيانات" : "نحّاسيو"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {database ? "المحتوى والتحرير" : "إدارة الخادم"}
                  </span>
                </span>
                <ChevronDownIcon />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="bottom"
                align="start"
                className="w-(--anchor-width) min-w-56"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>مساحات العمل</DropdownMenuLabel>

                  <DropdownMenuItem render={<Link to="/" />}>
                    <ServerIcon />
                    <span className="flex-1 font-medium text-sm">إدارة الخادم</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem render={<Link to="/database" />}>
                    <DatabaseIcon />
                    <span className="flex-1 font-medium text-sm">قاعدة البيانات</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {database ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>قاعدة البيانات</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/database" || pathname === "/database/"}
                      tooltip="نظرة عامة"
                      render={<Link to="/database" />}
                    >
                      <LayoutDashboardIcon />
                      <span>نظرة عامة</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {collections.slice(0, 3).map((item) => (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(`/database/${item.slug}`)}
                        tooltip={item.title}
                        render={
                          <Link to="/database/$collection" params={{ collection: item.slug }} />
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>الكيانات والمعرفة</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.slice(3).map((item) => (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton
                        isActive={pathname === `/database/${item.slug}`}
                        tooltip={item.title}
                        render={
                          <Link to="/database/$collection" params={{ collection: item.slug }} />
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>أدوات البيانات</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {databaseTools.map((item) => (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton
                        isActive={pathname === `/database/${item.slug}`}
                        tooltip={item.title}
                        render={<Link to={`/database/${item.slug}`} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>مساحات العمل</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/"}
                      tooltip="لوحة التحكم"
                      render={<Link to="/" />}
                    >
                      <LayoutDashboardIcon />
                      <span>لوحة التحكم</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="قاعدة البيانات" render={<Link to="/database" />}>
                      <DatabaseIcon />
                      <span>قاعدة البيانات</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>الخادم والمكتبة</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {serverSections.map((item) => (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton
                        isActive={pathname === `/server/${item.slug}`}
                        tooltip={item.title}
                        render={<Link to="/server/$section" params={{ section: item.slug }} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {!database && (
              <SidebarMenuButton tooltip="تسجيل الدخول" render={<Link to="/login" />}>
                <LogInIcon />
                <span>تسجيل الدخول</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
