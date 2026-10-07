"use client";
/**
 * DataVault — shared display utilities & small building blocks.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const fmt = {
  int: (v: number) => (v ?? 0).toLocaleString("en-IN"),
  pct: (v: number, digits = 1) => `${((v ?? 0) * 100).toFixed(digits)}%`,
  data: (v: number) => `${Math.round(v ?? 0).toLocaleString("en-IN")} DATA`,
  hash: (h?: string | null, head = 10, tail = 6) =>
    h ? `${h.slice(0, head)}…${h.slice(-tail)}` : "—",
  date: (d?: string | Date | null) => {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  },
  ms: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`),
  bytes: (v: number) => (v >= 1024 ? `${(v / 1024).toFixed(1)} KB` : `${v} B`),
};

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ACTIVE: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Active" },
    COMPLETED: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Completed" },
    APPROVED: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Approved" },
    CLAIMED: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Claimed" },
    CONFIRMED: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Confirmed" },
    AVAILABLE: { cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", label: "Available" },
    RUNNING: { cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", label: "Running" },
    TRAINING: { cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", label: "Training" },
    PENDING: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Pending" },
    FAILED: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Failed" },
    SUSPENDED: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Suspended" },
    REJECTED: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Rejected" },
    BLOCKED: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Blocked" },
    VERIFIED: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Verified" },
    UNVERIFIED: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Unverified" },
    LOCAL_ONLY: { cls: "bg-teal-500/15 text-teal-300 border-teal-500/30", label: "Local Only" },
    ENCRYPTED_UPDATES_ONLY: { cls: "bg-violet-500/15 text-violet-300 border-violet-500/30", label: "Encrypted Updates Only" },
    PARTICIPATING: { cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", label: "Participating" },
    ARCHIVED: { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30", label: "Archived" },
    CREATED: { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30", label: "Created" },
  };
  const item = map[status] ?? { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30", label: status };
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", item.cls)}>
      {item.label}
    </Badge>
  );
}

export function PrivacyBadge({ mode }: { mode: string }) {
  const enc = mode === "ENCRYPTION";
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", enc ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-teal-500/15 text-teal-300 border-teal-500/30")}>
      {enc ? "🔒 AES-256-GCM" : "🛡 Masked Updates"}
    </Badge>
  );
}

export function MetricDelta({ value, suffix = " pts" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return (
    <span className={cn("font-mono text-xs", positive ? "text-emerald-400" : "text-red-400")}>
      {positive ? "+" : ""}
      {(value * 100).toFixed(2)}
      {suffix}
    </span>
  );
}

export function PrimaryMetric({ taskType, value }: { taskType: string; value: number }) {
  const isReg = taskType === "REGRESSION";
  return (
    <span className="font-mono">
      {isReg ? `R² ${value.toFixed(3)}` : `${(value * 100).toFixed(1)}%`}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">{icon}</div>}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 py-14 text-center">
      <div className="text-muted-foreground/60">{icon ?? "⌀"}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-md text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "cyan",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "cyan" | "teal" | "violet" | "amber" | "emerald";
}) {
  const accents: Record<string, string> = {
    cyan: "text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.07]",
    teal: "text-teal-300 border-teal-500/20 bg-teal-500/[0.07]",
    violet: "text-violet-300 border-violet-500/20 bg-violet-500/[0.07]",
    amber: "text-amber-300 border-amber-500/20 bg-amber-500/[0.07]",
    emerald: "text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.07]",
  };
  return (
    <div className={cn("rounded-xl border p-4 transition-colors hover:border-cyan-500/30", accents[accent], "bg-card")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="opacity-70">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
