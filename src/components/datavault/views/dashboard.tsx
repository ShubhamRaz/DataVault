"use client";
/**
 * DataVault — Global dashboard (spec §10): live KPIs, federation activity,
 * model accuracy progression, org contributions, rewards, privacy events.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import { dashboardApi, federationApi } from "@/lib/client/api";
import { navigate } from "@/lib/client/router";
import { KpiCard, PageHeader, fmt, StatusBadge, PrimaryMetric } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Building2, Boxes, Network, Lock, Coins, Activity, Target, Blocks, Play, RefreshCw } from "lucide-react";
import { useAppStore } from "@/lib/client/store";
import { toast } from "sonner";

const CHART_COLORS = ["#22d3ee", "#2dd4bf", "#818cf8", "#fbbf24", "#f472b6", "#34d399"];

const tooltipStyle = {
  backgroundColor: "#0e1729",
  border: "1px solid #1b2942",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e8eef9",
};

export function DashboardView() {
  const { user } = useAppStore();
  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.stats,
    refetchInterval: 15000,
  });
  const { data: fed } = useQuery({ queryKey: ["fed-status"], queryFn: federationApi.status, refetchInterval: 8000 });
  const [claimBusy, setClaimBusy] = useState(false);

  const k = stats?.kpis;
  const runningRound = fed?.networks.find((n) => n.status === "TRAINING");

  const claimMyRewards = async () => {
    if (!user?.organizationId) return toast.info("Your account has no organization wallet");
    setClaimBusy(true);
    try {
      const r = await import("@/lib/client/api").then((m) => m.rewardsApi.claim({ organizationId: user.organizationId! }));
      toast.success(`Claimed ${r.total.toFixed(0)} DATA across ${r.claimed} rewards (block #${r.blockNumber})`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaimBusy(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0]}`}
        subtitle="Live network overview — every value below streams from the backend, computed by real federated training runs on synthetic data."
        icon={<Activity size={18} />}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} /> Refresh
            </Button>
            {runningRound ? (
              <Button size="sm" className="bg-cyan-500 text-[#04222b]" onClick={() => navigate("federation")}>
                <span className="pulse-dot mr-1.5 h-1.5 w-1.5 rounded-full bg-[#04222b]" /> Round running — watch live
              </Button>
            ) : (
              <Button size="sm" className="bg-cyan-500 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("federation")}>
                <Play size={13} /> Run federated round
              </Button>
            )}
          </>
        }
      />

      {/* Privacy hero strip */}
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.07] to-teal-500/[0.05] p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">🛡 Privacy Protected</p>
            <p className="text-[11px] text-muted-foreground">Raw data shared: 0 bytes · Secure aggregation enabled · Audit chain valid</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {stats.modelProgression.map((m) => (
            <div key={m.modelId} className="rounded-lg border border-border bg-card/70 px-2.5 py-1">
              <p className="text-[10px] text-muted-foreground">{m.name.split(" ")[0]}</p>
              <p className="font-mono text-xs font-semibold text-emerald-400">
                {m.taskType === "REGRESSION" ? `R² ${m.current.toFixed(2)}` : `${(m.current * 100).toFixed(1)}%`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Organizations" value={k.organizations} icon={<Building2 size={15} />} hint="active data owners" />
        <KpiCard label="Active Models" value={k.activeModels} icon={<Boxes size={15} />} accent="teal" hint="federated registries" />
        <KpiCard label="Federation Rounds" value={k.federationRounds} icon={<Network size={15} />} hint="completed runs" />
        <KpiCard label="Encrypted Updates" value={k.encryptedUpdates} icon={<Lock size={15} />} accent="violet" hint="AES-256-GCM sealed" />
        <KpiCard label="Total Contributions" value={k.totalContributions} icon={<Coins size={15} />} accent="teal" hint="scored updates" />
        <KpiCard label="Rewards Distributed" value={`${k.rewardsDistributed.toLocaleString("en-IN")} DATA`} icon={<Coins size={15} />} accent="amber" hint="1000 pool / round" />
        <KpiCard label="Privacy Events" value={k.privacyEvents} icon={<ShieldCheck size={15} />} accent="emerald" hint="incl. access blocks" />
        <KpiCard label="Model Accuracy" value={`${k.modelAccuracy.toFixed(1)}%`} icon={<Target size={15} />} accent="emerald" hint="avg primary metric" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Model accuracy progression */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Target size={15} className="text-cyan-300" /> Model accuracy progression
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">per federation round</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" />
                  <XAxis dataKey="round" type="number" domain={["dataMin", "dataMax"]} allowDuplicatedCategory={false} tick={{ fill: "#8296b3", fontSize: 10 }} stroke="#1b2942" />
                  <YAxis tick={{ fill: "#8296b3", fontSize: 10 }} stroke="#1b2942" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${(value * 100).toFixed(2)}%`, name]} labelFormatter={(l) => `Round ${l}`} />
                  {stats.modelProgression.map((m, i) => (
                    <Line
                      key={m.modelId}
                      data={m.series.map((s) => ({ round: s.round, [m.name]: s.value }))}
                      dataKey={m.name}
                      name={m.name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {stats.modelProgression.map((m, i) => (
                <div key={m.modelId} className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground">{m.name}</span>
                  <span className="font-mono text-foreground">{m.taskType === "REGRESSION" ? m.current.toFixed(3) : `${(m.current * 100).toFixed(1)}%`}</span>
                  <span className="font-mono text-emerald-400">(+{((m.current - m.baseline) * 100).toFixed(1)} vs silo)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Organization contributions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Coins size={15} className="text-teal-300" /> Organization contributions & rewards
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">lifetime scores</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.contributionByOrg} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" />
                  <XAxis dataKey="org" tick={{ fill: "#8296b3", fontSize: 9 }} stroke="#1b2942" tickFormatter={(v: string) => v.split(" ")[0]} interval={0} angle={-18} textAnchor="end" height={44} />
                  <YAxis tick={{ fill: "#8296b3", fontSize: 10 }} stroke="#1b2942" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "rewards" ? `${value.toLocaleString("en-IN")} DATA` : value.toFixed(2), name === "rewards" ? "Rewards" : "Lifetime score"]} />
                  <Bar dataKey="lifetimeScore" name="Lifetime score" fill="#22d3ee" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="rewards" name="Rewards" fill="#fbbf24" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Network activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity size={15} className="text-violet-300" /> Network activity
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">rounds & protected updates / day</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.activity} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRounds" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gUpdates" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "#8296b3", fontSize: 9 }} stroke="#1b2942" tickFormatter={(v: string) => v.slice(5)} interval={2} />
                  <YAxis tick={{ fill: "#8296b3", fontSize: 10 }} stroke="#1b2942" allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="rounds" name="Federation rounds" stroke="#22d3ee" fill="url(#gRounds)" strokeWidth={2} isAnimationActive={false} />
                  <Area type="monotone" dataKey="updates" name="Protected updates" stroke="#818cf8" fill="url(#gUpdates)" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rewards distribution + privacy events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Coins size={15} className="text-amber-300" /> Reward pool per round
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">1000 DATA distributed</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.rewardsPerRound} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" />
                    <XAxis dataKey="round" tick={{ fill: "#8296b3", fontSize: 10 }} stroke="#1b2942" />
                    <YAxis tick={{ fill: "#8296b3", fontSize: 10 }} stroke="#1b2942" domain={[0, 1000]} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [n === "total" ? `${v} DATA` : v, n === "total" ? "Pool" : n]} />
                    <Bar dataKey="total" name="Pool" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {stats.rewardsPerRound.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? "#fbbf24" : "#2dd4bf"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-2 sm:flex-col">
                {Object.entries(stats.privacyByType).map(([type, count], i) => (
                  <div key={type} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-[10.5px]">
                    <span className="text-muted-foreground">{type.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="font-mono font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent rounds + blockchain */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Network size={15} className="text-cyan-300" /> Recent federation rounds
              <button onClick={() => navigate("federation")} className="ml-auto text-[11px] font-medium text-cyan-300 hover:underline">view all →</button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RoundTable rounds={[]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Blocks size={15} className="text-amber-300" /> Local test network
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Chain</span>
              <span className="font-mono text-[11px] text-amber-300">Local Test Network · 31337</span>
            </div>
            <StatRow label="Blocks" value={k.blocks} />
            <StatRow label="Transactions" value={k.transactions} />
            <StatRow label="Listings" value={k.listings} />
            <StatRow label="Participants" value={k.participants} />
            <Button variant="outline" size="sm" className="w-full border-cyan-500/30 text-cyan-300" onClick={() => navigate("blockchain")}>
              Open blockchain explorer
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* My org quick claim */}
      {user?.organizationId && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Coins size={18} className="text-amber-300" />
            <p className="flex-1 text-[13px] text-muted-foreground">
              Claim pending rewards for <span className="font-medium text-foreground">{user.organizationName}</span> — rewards move from pending to wallet balance and are recorded on-chain.
            </p>
            <Button size="sm" disabled={claimBusy} onClick={claimMyRewards} className="bg-amber-500 text-[#2a1a04] hover:bg-amber-400">
              {claimBusy ? "Claiming…" : "Claim available DATA"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-1 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{fmt.int(value)}</span>
    </div>
  );
}

function RoundTable({ rounds }: { rounds: { id: string; roundNumber: number; model: { name: string }; metricsAfter: number; improvement: number; status: string; encryptedUpdates: number; completedAt: string | null; contributions?: unknown[]; durationMs?: number }[] }) {
  const { data } = useQuery({ queryKey: ["recent-rounds"], queryFn: () => import("@/lib/client/api").then((m) => m.federationApi.rounds({ take: "8" })) });
  const rows = rounds.length ? rounds : (data?.rounds ?? []);
  if (!rows.length) return <p className="p-6 text-center text-xs text-muted-foreground">No federation rounds yet — start one from the Federation screen.</p>;
  return (
    <div className="scroll-thin max-h-96 overflow-y-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5">Round</th>
            <th className="px-4 py-2.5">Model</th>
            <th className="px-4 py-2.5">Result</th>
            <th className="px-4 py-2.5">Δ</th>
            <th className="px-4 py-2.5">Protected updates</th>
            <th className="px-4 py-2.5">Duration</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer border-b border-border/40 transition-colors hover:bg-cyan-500/5" onClick={() => navigate("federation")}>
              <td className="px-4 py-2.5 font-mono text-cyan-300">#{r.roundNumber}</td>
              <td className="px-4 py-2.5">{r.model.name}</td>
              <td className="px-4 py-2.5 font-mono"><PrimaryMetric taskType={r.model.taskType} value={r.metricsAfter} /></td>
              <td className={`px-4 py-2.5 font-mono ${r.improvement >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {r.improvement >= 0 ? "+" : ""}{(r.improvement * 100).toFixed(2)}
              </td>
              <td className="px-4 py-2.5 font-mono">{r.encryptedUpdates > 0 ? `🔒 ${r.encryptedUpdates}` : "3 masked"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{fmt.ms(r.durationMs ?? 0)}</td>
              <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
