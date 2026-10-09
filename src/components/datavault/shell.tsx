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
  const { user, logout, notifications, unread, refreshNotifications, markAllRead, theme, setTheme } = useAppStore();
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 dark:border-sidebar-border bg-white/95 dark:bg-[#07101e] backdrop-blur-md transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-200 dark:border-border/60 px-5">
          <button onClick={() => navigate("dashboard")} className="flex items-center gap-2.5 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-lg font-black text-white shadow-lg shadow-cyan-500/20">
              ⬡
            </div>
            <div>
              <p className="text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">DataVault</p>
              <p className="text-[10px] text-muted-foreground/80">Privacy-First AI Marketplace</p>
            </div>
          </button>
          <button className="ml-auto text-muted-foreground lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3.5 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Platform</p>
          {nav.map((item) => {
            const isActive = activeRoute === item.route || (activeRoute === `${item.route}s` as Route);
            return (
              <button
                key={item.route}
                onClick={() => {
                  navigate(item.route);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-r from-[#d9fbf3] to-[#e5f7ff] text-[#087f78] dark:bg-[#0b2b48] dark:text-[#38e1cf] shadow-sm font-bold"
                    : "text-slate-600 hover:bg-[#edf7f9] hover:text-[#087e83] dark:text-slate-400 dark:hover:bg-[#0c1f36] dark:hover:text-slate-200"
                )}
              >
                <span className={cn(
                  "transition-colors",
                  isActive ? "text-[#087f78] dark:text-[#38e1cf]" : "text-slate-500 dark:text-slate-400 group-hover:text-[#087e83] dark:group-hover:text-slate-200"
                )}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
          
          <div className="my-3 border-t border-slate-200 dark:border-border/50" />
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Public</p>
          <button
            onClick={() => { navigate("about"); setSidebarOpen(false); }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-150",
              activeRoute === "about"
                ? "bg-gradient-to-r from-[#d9fbf3] to-[#e5f7ff] text-[#087f78] dark:bg-[#0b2b48] dark:text-[#38e1cf] shadow-sm font-bold"
                : "text-slate-600 hover:bg-[#edf7f9] hover:text-[#087e83] dark:text-slate-400 dark:hover:bg-[#0c1f36] dark:hover:text-slate-200"
            )}
          >
            <Sparkles size={17} className={activeRoute === "about" ? "text-[#087f78] dark:text-[#38e1cf]" : "text-slate-500 dark:text-slate-400 group-hover:text-[#087e83] dark:group-hover:text-slate-200"} />
            <span>Architecture &amp; About</span>
          </button>
        </nav>

        {/* Privacy mini banner */}
        <div className="mx-3.5 mb-3 rounded-xl border border-[#cdece7] dark:border-teal-500/20 bg-gradient-to-br from-[#effdfa] to-[#f5fbff] dark:from-[#08222d] dark:to-[#071929] p-3 text-left">
          <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[#d8f8ef] dark:bg-teal-500/20 text-[#078b79] dark:text-teal-300">
            <ShieldCheck size={16} />
          </div>
          <p className="text-[11px] font-bold leading-snug text-slate-900 dark:text-white">Raw Data Never<br />Leaves the Organization</p>
          <p className="mt-1 text-[9px] text-teal-700 dark:text-teal-200/70">Secure · Private · Federated</p>
        </div>

        <div className="border-t border-slate-200 dark:border-sidebar-border/60 p-3">
          <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/80 dark:bg-card/60 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/40 to-teal-500/40 text-[11px] font-semibold text-cyan-800 dark:text-cyan-100">
                {user?.name?.slice(0, 2).toUpperCase() ?? "DV"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-foreground">{user?.name}</p>
                <p className="truncate text-[10px] text-slate-500 dark:text-muted-foreground">{user?.roleLabel ?? user?.role}</p>
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
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-teal-500/10 px-2 py-1.5 text-[10px] text-teal-700 dark:text-teal-300">
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 dark:border-border/60 bg-white/90 dark:bg-[#07101e]/90 px-6 backdrop-blur-md">
          <button className="text-muted-foreground lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          
          <div className="relative hidden w-72 md:block">
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">⌕</span>
            <input
              type="text"
              placeholder="Search models, datasets, organizations..."
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-border/70 bg-white dark:bg-[#0d1828] pl-8 pr-3 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-500/50 focus:outline-none"
            />
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-teal-500/25 bg-teal-50 dark:bg-teal-500/10 px-3.5 py-1 sm:flex ml-2">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#18ddb2]" />
            <span className="text-[11px] font-semibold text-teal-700 dark:text-[#38e1cf]">Raw Data Never Leaves the Organization</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Theme Toggle matching Gurjot design */}
            <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#1b3046] bg-slate-100 dark:bg-[#0d1828] p-1">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                  theme === "light"
                    ? "bg-[#087f78] text-white shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
                title="Light mode"
              >
                ☼
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                  theme === "dark"
                    ? "bg-[#0b2b48] text-[#38e1cf] shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
                title="Dark mode"
              >
                ●
              </button>
            </div>

            <button
              onClick={() => navigate("federation")}
              className="flex items-center gap-1.5 rounded-lg border border-[#bcefe4] dark:border-teal-500/40 bg-[#f1fffb] dark:bg-[#0b2b2b] px-3.5 py-1.5 text-[12px] font-bold text-[#087c6d] dark:text-[#2ee0bd] transition-all hover:bg-[#e0fbf4] dark:hover:bg-[#0f3c3c]"
            >
              Live Federation
            </button>
            {/* Notification center */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen((v) => !v); if (!bellOpen && unread > 0) markAllRead(); }}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-border/70 bg-white dark:bg-[#0d1828] text-slate-600 dark:text-slate-300 transition-colors hover:text-slate-900 dark:hover:text-white"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[9px] font-bold text-[#04222b]">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-[#0d1828] shadow-2xl sm:w-96">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-border/60 px-4 py-2.5">
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
                      <div key={n.id} className="border-b border-slate-100 dark:border-border/40 px-4 py-3 last:border-0 hover:bg-slate-50 dark:hover:bg-[#101e33]">
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

            {/* Profile badge in topbar */}
            <div
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-border/70 bg-white dark:bg-[#0d1828] px-2.5 py-1.5 cursor-pointer hover:border-teal-500/40"
              onClick={async () => {
                await logout();
                toast.success("Signed out");
                navigate("landing");
              }}
              title="Click to sign out"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 text-[11px] font-bold text-[#04222b]">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "DV"}
              </div>
              <div className="hidden text-left sm:block">
                <p className="truncate text-[12px] font-bold text-slate-800 dark:text-slate-100">{user?.name || "Alice Rao"} ⌄</p>
                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{user?.role || "ORG_ADMIN"} · {user?.organizationName || "Apollo Demo Hospital"}</p>
              </div>
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
