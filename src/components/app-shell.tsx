"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Clock3,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PanelLeft,
  RadioTower,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "概览", icon: LayoutDashboard },
  { href: "/articles", label: "文章", icon: FilePenLine },
  { href: "/drafts", label: "微信草稿", icon: MessageSquareText },
  { href: "/menu", label: "菜单", icon: Menu },
  { href: "/history", label: "发布记录", icon: Clock3 },
];

type AppShellProps = {
  children: ReactNode;
  appName: string;
  appSubtitle: string;
  accountName: string;
};

function Brand({ appName, appSubtitle }: Pick<AppShellProps, "appName" | "appSubtitle">) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <BookOpenText className="h-5 w-5" />
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30" />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">{appName}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">
          {appSubtitle}
        </p>
      </div>
    </Link>
  );
}

function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1.5">
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="font-medium">{item.label}</span>
            {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ accountName }: Pick<AppShellProps, "accountName">) {
  return (
    <div>
      <Separator className="mb-4 bg-sidebar-border" />
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
          <RadioTower className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-sidebar-foreground">{accountName}</p>
          <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">单账号 · 内部使用</p>
        </div>
      </div>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </Button>
      </form>
    </div>
  );
}

function SidebarContent(props: Omit<AppShellProps, "children">) {
  return (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="px-2 py-2">
        <Brand appName={props.appName} appSubtitle={props.appSubtitle} />
      </div>
      <Separator className="my-5 bg-sidebar-border" />
      <Navigation />
      <div className="mt-auto pt-6">
        <SidebarFooter accountName={props.accountName} />
      </div>
    </div>
  );
}

export function AppShell({ children, ...branding }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[258px] border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent {...branding} />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="打开导航">
              <PanelLeft className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[278px] border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">导航菜单</SheetTitle>
            <SidebarContent {...branding} />
          </SheetContent>
        </Sheet>
        <div className="ml-3">
          <p className="text-sm font-semibold">{branding.appName}</p>
          <p className="text-[10px] text-muted-foreground">公众号发布系统</p>
        </div>
      </header>

      <main className="lg:pl-[258px]">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-9">
          {children}
        </div>
      </main>
    </div>
  );
}
