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
      <Card className="border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.05] to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-cyan-300" /> Demo Controls — one click each, all real actions</CardTitle>
        </CardHeader>
        <CardContent>
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
          <p className="mt-3 text-[10.5px] text-muted-foreground">
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
    cyan: "border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/[0.07]",
    teal: "border-teal-500/30 hover:border-teal-400/60 hover:bg-teal-500/[0.07]",
    violet: "border-violet-500/30 hover:border-violet-400/60 hover:bg-violet-500/[0.07]",
    amber: "border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/[0.07]",
    red: "border-red-500/30 hover:border-red-400/60 hover:bg-red-500/[0.07]",
  };
  const iconTones: Record<string, string> = {
    cyan: "bg-cyan-500/15 text-cyan-300", teal: "bg-teal-500/15 text-teal-300",
    violet: "bg-violet-500/15 text-violet-300", amber: "bg-amber-500/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
  };
  return (
    <button onClick={onClick} disabled={disabled || busy} className={`flex flex-col rounded-xl border bg-card p-4 text-left transition-all disabled:opacity-50 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className={`rounded-lg p-2 ${iconTones[tone]}`}>{busy ? <Loader2 size={16} className="animate-spin" /> : icon}</span>
      </div>
      <p className="mt-3 text-[13px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
    </button>
  );
}

function CountTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="text-cyan-300/70">{icon}</span>
      </div>
      <p className="mt-1 font-mono text-xl font-semibold">{fmt.int(value)}</p>
    </div>
  );
}
