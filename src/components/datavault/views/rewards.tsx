"use client";
/**
 * DataVault — Rewards view (spec §6): wallet summary, reward history,
 * transparent formula, claim flow.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rewardsApi, type RewardRow } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { navigate } from "@/lib/client/router";
import { PageHeader, StatusBadge, fmt, EmptyState } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, Search, Loader2, HandCoins, Info, Wallet, TrendingUp } from "lucide-react";

interface WalletRow {
  address: string; organization: string; slug: string; industry: string;
  balance: number; pending: number; claimed: number; totalEarned: number;
}

export function RewardsView() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [claimBusy, setClaimBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rewards", q, status, orgFilter],
    queryFn: () => rewardsApi.list({ q: q || undefined, status, organizationId: orgFilter !== "all" ? orgFilter : undefined }),
    refetchInterval: 15000,
  });

  const rewards = data?.rewards ?? [];
  const wallets = (data?.wallets as WalletRow[]) ?? [];
  const totals = data?.totals ?? { totalEarned: 0, available: 0, claimed: 0, poolPerRound: 1000 };
  const myWallet = wallets.find((w) => user?.organizationName === w.organization);

  const claim = async () => {
    if (!user?.organizationId) return toast.info("Your account has no organization wallet");
    setClaimBusy(true);
    try {
      const r = await rewardsApi.claim({ organizationId: user.organizationId });
      toast.success(`Claimed ${r.total.toFixed(0)} DATA across ${r.claimed} rewards — on-chain in block #${r.blockNumber}`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaimBusy(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-80" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rewards"
        subtitle="DATA tokens earned through verifiable contributions. Every value is computed by the backend reward engine from real contribution scores — pool of 1000 DATA per round."
        icon={<Coins size={18} />}
        actions={
          <>
            <FormulaDialog />
            {["ADMIN", "ORG_ADMIN", "PARTICIPANT"].includes(user?.role ?? "") && (
              <Button size="sm" className="h-9 bg-amber-500 text-[#2a1a04] hover:bg-amber-400" onClick={claim} disabled={claimBusy}>
                {claimBusy ? <Loader2 size={13} className="animate-spin" /> : <HandCoins size={13} />}
                Claim available DATA{myWallet ? ` (${myWallet.pending.toFixed(0)})` : ""}
              </Button>
            )}
          </>
        }
      />

      {/* wallet summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Earned (network)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-300">{totals.totalEarned?.toLocaleString("en-IN")} <span className="text-sm">DATA</span></p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Available Balance</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-cyan-300">{totals.available?.toLocaleString("en-IN")} <span className="text-sm">DATA</span></p>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Claimed Rewards</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400">{totals.claimed?.toLocaleString("en-IN")} <span className="text-sm">DATA</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Round Pool</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{totals.poolPerRound} <span className="text-sm">DATA</span></p>
        </div>
      </div>

      {myWallet && (
        <Card className="border-amber-500/25 bg-amber-500/[0.04]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Wallet size={18} className="text-amber-300" />
            <div className="flex-1">
              <p className="text-[13px] font-medium">{user?.organizationName} — wallet</p>
              <p className="font-mono text-[10px] text-muted-foreground">{myWallet.address}</p>
            </div>
            <div className="flex gap-4 text-[12px]">
              <span>pending <span className="font-mono text-cyan-300">{myWallet.pending.toFixed(0)}</span></span>
              <span>balance <span className="font-mono text-emerald-400">{myWallet.balance.toFixed(0)}</span></span>
              <span>claimed <span className="font-mono text-muted-foreground">{myWallet.claimed.toFixed(0)}</span></span>
              <span>earned <span className="font-mono text-amber-300">{myWallet.totalEarned.toFixed(0)}</span></span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Reward history */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Coins size={15} className="text-amber-300" /> Reward history
              <div className="ml-auto flex gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organization…" className="h-8 w-48 pl-7 text-[12px] bg-card" />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 w-32 bg-card text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["all", "AVAILABLE", "CLAIMED"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All status" : s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rewards.length === 0 ? (
              <EmptyState title="No rewards yet" hint="Run a federated round to allocate the reward pool." icon={<Coins size={22} />} />
            ) : (
              <div className="scroll-thin max-h-[460px] overflow-y-auto">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Organization</th><th className="px-4 py-2.5">Model</th>
                      <th className="px-4 py-2.5">Contribution</th><th className="px-4 py-2.5">Reward</th><th className="px-4 py-2.5">Transaction</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.map((r) => (
                      <tr key={r.id} className="border-b border-border/40 transition-colors hover:bg-amber-500/[0.04]">
                        <td className="px-4 py-2.5 font-mono text-cyan-300">{r.round}</td>
                        <td className="px-4 py-2.5">
                          <button className="font-medium hover:text-cyan-300" onClick={() => navigate("organization", r.organizationSlug)}>{r.organization}</button>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.model}</td>
                        <td className="px-4 py-2.5 font-mono text-teal-300">{(r.contribution * 100).toFixed(2)}%</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-amber-300">{r.reward.toFixed(0)} DATA</td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-amber-300/70">{r.txHash ? fmt.hash(r.txHash, 10, 4) : "—"}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* wallets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={15} className="text-teal-300" /> Organization wallets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wallets.map((w) => (
              <div key={w.address} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                <div className="flex items-center justify-between">
                  <button className="max-w-[150px] truncate text-[12px] font-medium hover:text-cyan-300" onClick={() => navigate("organization", w.slug)}>{w.organization}</button>
                  <span className="font-mono text-[12px] font-semibold text-amber-300">{w.totalEarned.toFixed(0)} DATA</span>
                </div>
                <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{w.address.slice(0, 22)}…</p>
                <div className="mt-1.5 flex gap-3 text-[9.5px] text-muted-foreground">
                  <span>pending <span className="font-mono text-cyan-300">{w.pending.toFixed(0)}</span></span>
                  <span>claimed <span className="font-mono text-emerald-400">{w.claimed.toFixed(0)}</span></span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FormulaDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9"><Info size={13} /> How rewards work</Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader><DialogTitle>Transparent contribution & reward formula</DialogTitle></DialogHeader>
        <div className="space-y-4 text-[12.5px] leading-relaxed text-muted-foreground">
          <div className="rounded-lg border border-border bg-card p-3 font-mono text-[11.5px] text-cyan-200">
            raw_score = 0.35·sample_share<br />
            &nbsp;&nbsp;+ 0.25·training_quality<br />
            &nbsp;&nbsp;+ 0.25·model_improvement<br />
            &nbsp;&nbsp;+ 0.15·participation_consistency
          </div>
          <div className="rounded-lg border border-border bg-card p-3 font-mono text-[11.5px] text-teal-200">
            normalized_score = raw_score / Σ raw_scores (per round)<br />
            participant_reward = 1000 DATA × normalized_score
          </div>
          <ul className="space-y-1.5">
            <li>• <span className="text-foreground">sample_share</span> — fraction of total training samples</li>
            <li>• <span className="text-foreground">training_quality</span> — local validation quality (accuracy / R²)</li>
            <li>• <span className="text-foreground">model_improvement</span> — local improvement vs the incoming global model (participant-reported)</li>
            <li>• <span className="text-foreground">participation_consistency</span> — rounds attended / rounds so far</li>
          </ul>
          <p>Example: scores 0.45 / 0.30 / 0.25 → rewards 450 / 300 / 250 DATA. The same allocation math is enforced by the DataVaultRewards.sol smart contract in production mode.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
