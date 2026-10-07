"use client";
/**
 * DataVault — App shell: responsive sidebar, top navigation, notification
 * center, organization context (spec §8, §28).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/client/store";
import { navigate, type Route } from "@/lib/client/router";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  LayoutDashboard, Building2, Boxes, Network, ShieldCheck, Link2, Coins,
  Store, Database, ScrollText, Settings, Shield, Bell, LogOut, Menu, X, Vault,
  Sparkles, ChevronRight,
} from "lucide-react";

const NAV: { route: Route; label: string; icon: React.ReactNode; roles?: string[] }[] = [
  { route: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { route: "federation", label: "Federation", icon: <Network size={17} /> },
  { route: "models", label: "Models", icon: <Boxes size={17} /> },
  { route: "organizations", label: "Organizations", icon: <Building2 size={17} /> },
  { route: "datasets", label: "Datasets", icon: <Database size={17} /> },
  { route: "privacy", label: "Privacy Center", icon: <ShieldCheck size={17} /> },
  { route: "blockchain", label: "Blockchain", icon: <Link2 size={17} /> },
  { route: "rewards", label: "Rewards", icon: <Coins size={17} /> },
  { route: "marketplace", label: "Marketplace", icon: <Store size={17} /> },
  { route: "audit", label: "Audit Log", icon: <ScrollText size={17} /> },
];

const ADMIN_NAV: { route: Route; label: string; icon: React.ReactNode }[] = [
  { route: "admin", label: "Admin & Demo Controls", icon: <Shield size={17} /> },
  { route: "settings", label: "Settings", icon: <Settings size={17} /> },
];

export function AppShell({
  children,
  activeRoute,
}: {
  children: React.ReactNode;
  activeRoute: Route;
}) {
  const { user, logout, notifications, unread, refreshNotifications, markAllRead } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  // poll notifications every 20s while authenticated
  useEffect(() => {
    if (!user) return;
    refreshNotifications();
    const t = setInterval(refreshNotifications, 20000);
    return () => clearInterval(t);
  }, [user, refreshNotifications]);

  const nav = [...NAV, ...(user?.role === "ADMIN" ? ADMIN_NAV : [])];

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <button onClick={() => navigate("dashboard")} className="flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 p-1.5">
              <Vault size={16} className="text-[#04222b]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight text-foreground">DataVault</p>
              <p className="text-[10px] text-muted-foreground">Privacy-First AI Marketplace</p>
            </div>
          </button>
          <button className="ml-auto text-muted-foreground lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Platform</p>
          {nav.map((item) => (
            <button
              key={item.route}
              onClick={() => {
                navigate(item.route);
                setSidebarOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                activeRoute === item.route || (activeRoute === `${item.route}s` as Route)
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Public</p>
          <button
            onClick={() => { navigate("about"); setSidebarOpen(false); }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              activeRoute === "about" ? "bg-cyan-500/10 text-cyan-300" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <Sparkles size={17} />
            Architecture & About
          </button>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/40 to-teal-500/40 text-[11px] font-semibold text-cyan-100">
                {user?.name?.slice(0, 2).toUpperCase() ?? "DV"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{user?.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{user?.roleLabel ?? user?.role}</p>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  toast.success("Signed out");
                  navigate("landing");
                }}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                aria-label="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
            {user?.organizationName && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-teal-500/10 px-2 py-1.5 text-[10px] text-teal-300">
                <Building2 size={11} />
                <span className="truncate">{user.organizationName}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[9px] leading-relaxed text-muted-foreground/60">
            Research / Hackathon Demonstration<br />All data is synthetic
          </p>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          <button className="text-muted-foreground lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 sm:flex">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-300">Raw Data Never Leaves the Organization</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => navigate("federation")}
              className="hidden items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[12px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20 sm:flex"
            >
              <Network size={13} /> Live Federation
            </button>
            {/* Notification center */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen((v) => !v); if (!bellOpen && unread > 0) markAllRead(); }}
                className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-[#04222b]">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl sm:w-96">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">Notifications</p>
                    <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="scroll-thin max-h-96 overflow-y-auto">
                    {notifications.length === 0 && (
                      <p className="px-3 py-8 text-center text-xs text-muted-foreground">No notifications yet</p>
                    )}
                    {notifications.slice(0, 12).map((n) => (
                      <div key={n.id} className="border-b border-border/50 px-3 py-2.5 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12px] font-medium text-foreground">{n.title}</p>
                          <span className="shrink-0 text-[9px] text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
              <span className="text-cyan-300">●</span> {user?.email}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-background">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</div>
        </main>

        <footer className="border-t border-border bg-card/30 px-4 py-4 lg:pl-4">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
            <p>© 2026 DataVault — Train Together. Share Nothing.</p>
            <p className="text-center sm:text-right">
              Research / hackathon demonstration. Not compliance advice. Synthetic data only.
            </p>
          </div>
        </footer>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; route?: Route; id?: string }[] }) {
  return (
    <nav className="flex items-center gap-1 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} />}
          {item.route ? (
            <Link href={`#/${item.route}${item.id ? `/${item.id}` : ""}`} className="transition-colors hover:text-cyan-300">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
