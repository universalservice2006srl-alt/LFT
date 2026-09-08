"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  PenLine,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { authFetch } from "@/lib/session-client";
import type { SessionUserDTO } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  /** compact label for the mobile bottom bar */
  short: string;
  icon: React.ComponentType<{ className?: string }>;
};

function navFor(user: SessionUserDTO): NavItem[] {
  const items: NavItem[] = [];
  if (user.role !== "driver") {
    items.push({ href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard });
    items.push({ href: "/reports", label: "Log Report", short: "Report", icon: ClipboardCheck });
  }
  items.push({ href: "/drive", label: "Log Entry", short: "Log", icon: PenLine });
  if (user.role !== "driver") {
    items.push({ href: "/fleet", label: "Fleet", short: "Fleet", icon: CarFront });
    items.push({ href: "/people", label: "People", short: "People", icon: Users });
  }
  if (user.role !== "driver") {
    items.push({ href: "/audit", label: "Audit", short: "Audit", icon: ScrollText });
  }
  if (user.role === "super_admin") {
    items.push({ href: "/security", label: "Security", short: "Secure", icon: ShieldCheck });
  }
  return items;
}

export function AppShell({ user, children }: { user: SessionUserDTO; children: React.ReactNode }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const nav = navFor(user);

  const link = (href: string) => href;

  async function signOut() {
    setSigningOut(true);
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh min-w-0 overflow-x-clip bg-cream">
      {/* ------------------------ Desktop sidebar ------------------------ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy text-cream lg:flex">
        <Link href={link(user.role === "driver" ? "/drive" : "/dashboard")} className="flex items-center gap-3 px-6 pt-7 pb-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-navy shadow-lift">
            <Image
              src="/images/app-icon.jpg"
              alt="Lyca Fleet Tracker"
              width={44}
              height={44}
              className="h-full w-full rounded-xl object-cover"
            />
          </span>
          <span>
            <span className="block font-display text-[17px] font-bold leading-none tracking-tight">
              Lyca Fleet Tracker
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.22em] text-cream/50">
              Lyca Mobile
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 px-4">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={link(item.href)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all",
                  active
                    ? "bg-cream text-navy shadow-lift"
                    : "text-cream/60 hover:bg-cream/8 hover:text-cream"
                )}
              >
                <item.icon className={cn("h-4.5 w-4.5", active ? "text-blue" : "text-cream/45 group-hover:text-green")} />
                {item.label}
                {active && <span className="ml-auto h-2 w-2 rounded-full bg-green" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="rounded-2xl bg-navy-2 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.fullName} color={user.avatarColor} className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.fullName}</p>
                <p className="truncate text-[11px] text-cream/50">
                  {ROLE_LABELS[user.role]}
                  {user.branchName ? ` · ${user.branchName}` : ""}
                </p>
              </div>
              <button
                onClick={signOut}
                disabled={signingOut}
                title="Sign out"
                className="rounded-lg p-2 text-cream/45 transition-colors hover:bg-cream/10 hover:text-peach cursor-pointer disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ------------------------ Mobile top bar ------------------------ */}
      <header className="safe-top sticky top-0 z-40 border-b border-navy/8 bg-cream/92 backdrop-blur-xl lg:hidden">
        <div className="flex h-15 min-w-0 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-3.5">
          <Link
            href={link(user.role === "driver" ? "/drive" : "/dashboard")}
            className="flex min-w-0 items-center gap-2.5 rounded-xl py-1"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy text-cream shadow-tactile">
              <Image
                src="/images/app-icon.jpg"
                alt="Lyca Fleet Tracker"
                width={36}
                height={36}
                className="h-full w-full rounded-xl object-cover"
              />
            </span>
            <span className="min-w-0 max-w-[calc(100vw-9rem)]">
              <span className="block truncate font-display text-[15px] font-bold leading-none tracking-tight">
                Lyca Fleet Tracker
              </span>
              <span className="mt-1 block truncate text-[9px] font-bold uppercase tracking-[0.14em] text-navy/45">
                {user.branchName ?? "Fleet management"}
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="hidden min-[370px]:block text-right">
              <p className="max-w-28 truncate text-[11px] font-bold leading-none text-navy">
                {user.fullName}
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-navy/40">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <Avatar
              name={user.fullName}
              color={user.avatarColor}
              className="h-9 w-9 rounded-xl"
              textClassName="text-[10px]"
            />
            <button
              onClick={signOut}
              disabled={signingOut}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-navy/45 transition-colors active:bg-navy/10 disabled:opacity-50 cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------ Content ------------------------ */}
      <main className="min-w-0 overflow-x-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-64">
        <div className="mx-auto w-full min-w-0 max-w-7xl px-3.5 py-4 sm:px-6 sm:py-5 lg:px-9 lg:py-8">
          {children}
        </div>
      </main>

      {/* ------------------------ Mobile bottom nav ------------------------ */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-navy/10 bg-cream/95 shadow-[0_-8px_30px_-18px_rgba(33,38,78,0.45)] backdrop-blur-xl lg:hidden">
        <div className="no-scrollbar mx-auto flex h-17 max-w-2xl items-stretch overflow-x-auto px-1 sm:px-2">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={link(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-[52px] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[9px] font-bold leading-none transition-colors active:bg-navy/5",
                  active ? "text-blue" : "text-navy/45"
                )}
              >
                {active && (
                  <span className="absolute top-0 h-0.75 w-6 rounded-full bg-blue" aria-hidden />
                )}
                <span
                  className={cn(
                    "flex h-8 w-full max-w-10 items-center justify-center rounded-full transition-colors",
                    active && "bg-blue/12"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5" />
                </span>
                <span className="max-w-full truncate">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
