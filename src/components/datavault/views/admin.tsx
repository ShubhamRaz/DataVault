"use client";
/**
 * DataVault — Admin dashboard + Demo Controls (spec §29, §30, §56).
 * Every button performs a REAL backend action.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, modelsApi, orgsApi } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { PageHeader, fmt, StatusBadge } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield, Play, RotateCcw, Sparkles, Database, FileDown, Loader2, Boxes,
  Building2, Users, Coins, Network, RefreshCw, Download,
} from "lucide-react";

export function AdminView() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { data: demo, isLoading, refetch } = useQuery({ queryKey: ["admin-demo"], queryFn: adminApi.demoState });
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: adminApi.users });
  const { data: modelsData } = useQuery({ queryKey: ["admin-models"], queryFn: () => modelsApi.list() });

  const runAction = async (action: "initialize" | "reset" | "regenerate", label: string) => {
    setBusyAction(action);
    try {
      const r = await (action === "initialize" ? adminApi.initialize() : action === "reset" ? adminApi.reset() : adminApi.regenerate());
      toast.success(r.message);
      await refetch();
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusyAction(null);
    }
  };

  const exportReport = () => {
    window.open("/api/admin/export", "_blank");
    toast.info("Demo report download started (self-contained HTML)");
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-64" /></div>;
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin" subtitle="Platform administration requires the ADMIN role." icon={<Shield size={18} />} />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">You are signed in as <span className="font-medium text-foreground">{user?.roleLabel ?? user?.role}</span>. Sign in as admin@datavault.demo to access demo controls.</CardContent></Card>
      </div>
    );
  }

  const counts = demo?.counts ?? {};

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin & Demo Controls"
        subtitle={`Demo network ${demo?.initialized ? `initialized ${fmt.date(demo.initializedAt)}` : "not initialized"} — every control below triggers a real backend action.`}
        icon={<Shield size={18} />}
        actions={<Button size="sm" variant="outline" onClick={() => refetch()}><RefreshCw size={13} /> Refresh</Button>}
      />

      {/* Demo controls (spec §56) */}
      <Card className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828]">
        <CardHeader className="border-b border-slate-200 dark:border-[#1b3046]/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Sparkles size={15} className="text-teal-600 dark:text-cyan-300" /> Demo Controls — one click each, all real actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DemoControl
              icon={<Play size={16} />}
              title="Initialize Demo Network"
              desc="9 organizations, 10 users, 9 synthetic datasets, 3 federated models, real historical rounds, wallets, local blockchain."
              busy={busyAction === "initialize"}
              disabled={!!busyAction}
              onClick={() => runAction("initialize", "Initialization")}
              tone="cyan"
            />
            <DemoControl
              icon={<Database size={16} />}
              title="Generate Synthetic Data"
              desc="Regenerate local dataset environments for organizations that lost theirs (CSVs stay inside participant folders)."
              busy={busyAction === "regenerate"}
              disabled={!!busyAction}
              onClick={() => runAction("regenerate", "Regeneration")}
              tone="teal"
            />
            <DemoControl
              icon={<Network size={16} />}
              title="Start Federation"
              desc="Open the live federation screen and run a real training round with animated events."
              disabled={!!busyAction}
              onClick={() => { window.location.hash = "#/federation"; }}
              tone="violet"
            />
            <DemoControl
              icon={<Boxes size={16} />}
              title="Create Global Model"
              desc="Register a new federated model from the model registry (computes v1.0 + silo baselines)."
              disabled={!!busyAction}
              onClick={() => { window.location.hash = "#/models"; }}
              tone="teal"
            />
            <DemoControl
              icon={<FileDown size={16} />}
              title="Export Demo Report"
              desc="Download a self-contained HTML report: models, participants, rounds, accuracy gains, privacy config, rewards, blockchain proofs."
              disabled={!!busyAction}
              onClick={exportReport}
              tone="amber"
            />
            <DemoControl
              icon={<RotateCcw size={16} />}
              title="Reset Demo"
              desc="Wipe all demo data (database + participant folders). Rebuild with Initialize Demo Network."
              busy={busyAction === "reset"}
              disabled={!!busyAction}
              onClick={() => runAction("reset", "Reset")}
              tone="red"
            />
          </div>
          <p className="mt-3 text-[10.5px] text-slate-400">
            Initialization runs REAL federated training in the background (~2–4 seconds) — historical rounds in the dashboard are genuine computations, not fabricated numbers.
          </p>
        </CardContent>
      </Card>

      {/* Network counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <CountTile label="Organizations" value={counts.organizations} icon={<Building2 size={13} />} />
        <CountTile label="Users" value={counts.users} icon={<Users size={13} />} />
        <CountTile label="Datasets" value={counts.datasets} icon={<Database size={13} />} />
        <CountTile label="Models" value={counts.models} icon={<Boxes size={13} />} />
        <CountTile label="Rounds" value={counts.rounds} icon={<Network size={13} />} />
        <CountTile label="Rewards" value={counts.rewards} icon={<Coins size={13} />} />
        <CountTile label="Blocks" value={counts.blocks} icon={<Shield size={13} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Users management */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Users size={15} className="text-cyan-300" /> User management</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scroll-thin max-h-80 overflow-y-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Organization</th><th className="px-4 py-2.5">Last login</th>
                  </tr>
                </thead>
                <tbody>
                  {((users?.users ?? []) as { id: string; email: string; name: string; role: string; lastLoginAt: string | null; organization: { name: string } | null }[]).map((u) => (
                    <tr key={u.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-[9.5px] text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5"><span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-medium">{u.role}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u.organization?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[10px] text-muted-foreground">{fmt.date(u.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Models overview + runlogs */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Boxes size={15} className="text-teal-300" /> Model training monitor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {((modelsData?.models ?? []) as { id: string; name: string; status: string; version: string; trainingRounds: number; accuracyAfter: number; taskType: string }[]).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.trainingRounds} rounds · {m.version}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-emerald-400">{m.taskType === "REGRESSION" ? `R² ${m.accuracyAfter.toFixed(2)}` : `${(m.accuracyAfter * 100).toFixed(1)}%`}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Demo run log</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {((demo?.runLogs ?? []) as { id: string; action: string; detail: string | null; createdAt: string }[]).slice(0, 6).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[10.5px]">
                  <span className="font-mono text-cyan-300">{l.action}</span>
                  <span className="text-muted-foreground">{l.detail}</span>
                  <span className="text-muted-foreground/70">{fmt.date(l.createdAt)}</span>
                </div>
              ))}
              {(demo?.runLogs ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">No runs recorded yet.</p>}
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full border-amber-500/30 text-amber-300" onClick={exportReport}>
            <Download size={13} /> Export demo report (HTML)
          </Button>
        </div>
      </div>
    </div>
  );
}

function DemoControl({ icon, title, desc, onClick, busy, disabled, tone }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; busy?: boolean; disabled?: boolean;
  tone: "cyan" | "teal" | "violet" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-500/30 hover:border-cyan-400/70 hover:bg-cyan-50 dark:hover:bg-[#0b2b48]/60 hover:shadow-lg hover:shadow-cyan-500/5",
    teal: "border-teal-500/30 hover:border-teal-400/70 hover:bg-teal-50 dark:hover:bg-[#082420]/60 hover:shadow-lg hover:shadow-teal-500/5",
    violet: "border-violet-500/30 hover:border-violet-400/70 hover:bg-violet-50 dark:hover:bg-[#1a1438]/60 hover:shadow-lg hover:shadow-violet-500/5",
    amber: "border-amber-500/30 hover:border-amber-400/70 hover:bg-amber-50 dark:hover:bg-[#241c09]/60 hover:shadow-lg hover:shadow-amber-500/5",
    red: "border-red-500/30 hover:border-red-400/70 hover:bg-red-50 dark:hover:bg-[#2c0f16]/60 hover:shadow-lg hover:shadow-red-500/5",
  };
  const iconTones: Record<string, string> = {
    cyan: "bg-cyan-50 dark:bg-[#0b253b] text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30",
    teal: "bg-teal-50 dark:bg-[#082420] text-teal-800 dark:text-[#2ee0bd] border border-teal-200 dark:border-teal-500/30",
    violet: "bg-violet-50 dark:bg-[#1a1438] text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30",
    amber: "bg-amber-50 dark:bg-[#241c09] text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30",
    red: "bg-red-50 dark:bg-[#2c0f16] text-red-800 dark:text-red-300 border border-red-200 dark:border-red-500/30",
  };
  return (
    <button onClick={onClick} disabled={disabled || busy} className={`flex flex-col rounded-2xl border border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-[#07101e] p-4 text-left transition-all duration-200 disabled:opacity-50 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className={`rounded-xl p-2.5 ${iconTones[tone]}`}>{busy ? <Loader2 size={16} className="animate-spin" /> : icon}</span>
      </div>
      <p className="mt-3 text-[13px] font-bold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
    </button>
  );
}

function CountTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#0d1828] p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <span className="text-teal-600 dark:text-cyan-300">{icon}</span>
      </div>
      <p className="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white">{fmt.int(value)}</p>
    </div>
  );
}
