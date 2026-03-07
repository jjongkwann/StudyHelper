"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FolderKanban, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  {
    href: "/",
    label: "Dashboard",
    mobileLabel: "홈",
    icon: LayoutDashboard,
    match: (pathname: string) => pathname === "/",
  },
  {
    href: "/projects",
    label: "Projects",
    mobileLabel: "프로젝트",
    icon: FolderKanban,
    match: (pathname: string) => pathname.startsWith("/projects"),
  },
];

function isActive(pathname: string, href: string) {
  const item = primaryNavItems.find((navItem) => navItem.href === href);
  return item ? item.match(pathname) : false;
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-sidebar/80 md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border/60 px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          StudyHelper
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-8 px-4 py-6">
        <nav className="flex flex-col gap-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4 text-primary" />
            학습 흐름
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            프로젝트를 만들고, 학습과 복습을 한 흐름 안에서 이어가세요.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const pathname = usePathname();
  const currentItem =
    primaryNavItems.find((item) => item.match(pathname)) ?? primaryNavItems[0];

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur md:hidden">
      <div className="flex h-15 items-center justify-between px-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          StudyHelper
        </Link>
        <div className="rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
          {currentItem.mobileLabel}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/92 px-3 pb-3 pt-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-2xl px-3 py-2 text-xs transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="mb-1 size-4" />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
