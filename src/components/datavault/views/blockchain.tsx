"use client";
/**
 * DataVault — Internal blockchain explorer (spec §22).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { blockchainApi } from "@/lib/client/api";
import { PageHeader, StatusBadge, fmt, EmptyState } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link2, ShieldCheck, Search, Blocks, Coins, FileCheck2, Loader2, RefreshCw } from "lucide-react";

interface Tx {
  hash: string; from: string; to: string; action: string; amount: number; round: number | null;
  modelName: string | null; participantName: string | null; status: string; timestamp: string;
}

export function BlockchainView() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ledger: { valid: boolean; blocks: number }; auditChain: { valid: boolean; entries: number }; allValid: boolean } | null>(null);

  const { data: overview, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["bc-overview"], queryFn: blockchainApi.overview, refetchInterval: 12000 });
  const { data: txsData } = useQuery({ queryKey: ["bc-txs", q, action], queryFn: () => blockchainApi.transactions({ q: q || undefined, action }) });

  const stats = overview?.stats as Record<string, string | number> | undefined;
  const blocks = (overview?.blocks as { number: number; hash: string; prevHash: string; nonce: number; txCount: number; timestamp: string; transactions: { hash: string }[] }[]) ?? [];
  const contributions = (overview?.contributionRecords as { hash: string; participantName: string | null; roundNumber: number | null; modelName: string | null; metadata: { score?: number; samples?: number } | null; timestamp: string }[]) ?? [];
  const txs = (txsData?.transactions as Tx[]) ?? [];

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await blockchainApi.verify();
      setVerifyResult(r);
      if (r.allValid) toast.success(`Ledger chain valid (${r.ledger.blocks} blocks) · audit chain valid (${r.auditChain.entries} entries)`);
      else toast.error("Chain verification FAILED — integrity broken");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-80" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blockchain Explorer"
        subtitle="DataVault Local Test Network — SHA-256 hash-chained ledger with proof-of-work blocks. Contribution proofs and reward allocations are anchored here; raw data NEVER goes on-chain."
        icon={<Link2 size={18} />}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button size="sm" className="bg-amber-500 text-[#2a1a04] hover:bg-amber-400" onClick={verify} disabled={verifying}>
              {verifying ? <Loader2 size={13} className="animate-spin" /> : <FileCheck2 size={13} />} Verify chain integrity
            </Button>
          </>
        }
      />

      {verifyResult && (
        <div className={`rounded-xl border p-4 ${verifyResult.allValid ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-red-500/40 bg-red-500/10"}`}>
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <span className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={15} className={verifyResult.allValid ? "text-emerald-400" : "text-red-400"} />
              {verifyResult.allValid ? "All chains verified" : "INTEGRITY FAILURE DETECTED"}
            </span>
            <span className="text-muted-foreground">Ledger: <span className={verifyResult.ledger.valid ? "text-emerald-400" : "text-red-400"}>{verifyResult.ledger.valid ? "valid" : "broken"}</span> ({verifyResult.ledger.blocks} blocks re-hashed)</span>
            <span className="text-muted-foreground">Audit chain: <span className={verifyResult.auditChain.valid ? "text-emerald-400" : "text-red-400"}>{verifyResult.auditChain.valid ? "valid" : "broken"}</span> ({verifyResult.auditChain.entries} entries re-hashed)</span>
          </div>
        </div>
      )}

      {/* network stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <NetStat label="Network" value="Local Test" icon={<Blocks size={13} />} />
        <NetStat label="Chain ID" value={String(stats?.chainId ?? 31337)} icon={<Link2 size={13} />} />
        <NetStat label="Latest Block" value={String(stats?.latestBlock ?? 0)} icon={<Blocks size={13} />} />
        <NetStat label="Transactions" value={String(stats?.transactions ?? 0)} icon={<Link2 size={13} />} />
        <NetStat label="Reward Txs" value={String(stats?.rewardTransactions ?? 0)} icon={<Coins size={13} />} />
        <NetStat label="Contribution Proofs" value={String(stats?.contributionProofs ?? 0)} icon={<ShieldCheck size={13} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Transaction table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Link2 size={15} className="text-amber-300" /> Transactions
              <div className="ml-auto flex gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hash, org, model…" className="h-8 w-52 pl-7 text-[12px] bg-card" />
                </div>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="h-8 w-40 bg-card text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["all", "REGISTER_PARTICIPANT", "RECORD_CONTRIBUTION", "ALLOCATE_REWARD", "CLAIM_REWARD"].map((a) => (
                      <SelectItem key={a} value={a}>{a === "all" ? "All actions" : a.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {txs.length === 0 ? (
              <EmptyState title="No transactions match" hint="Try different filters." icon={<Link2 size={22} />} />
            ) : (
              <div className="scroll-thin max-h-[480px] overflow-y-auto">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5">Hash</th><th className="px-4 py-2.5">To</th><th className="px-4 py-2.5">Action</th>
                      <th className="px-4 py-2.5">Amount</th><th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Time</th><th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t) => (
                      <tr key={t.hash} className="border-b border-border/40 transition-colors hover:bg-amber-500/[0.04]">
                        <td className="px-4 py-2.5 font-mono text-[10px] text-amber-300/90">{fmt.hash(t.hash, 12, 4)}</td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{fmt.hash(t.to, 8, 4)}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-medium text-foreground/80">{t.action.replace(/_/g, " ")}</span>
                          {t.participantName && <p className="mt-0.5 text-[9px] text-muted-foreground">{t.participantName}</p>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-amber-300">{t.amount > 0 ? `${t.amount.toFixed(0)} DATA` : "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-cyan-300">{t.round ? `#${t.round}` : "—"}</td>
                        <td className="px-4 py-2.5 text-[10px] text-muted-foreground">{fmt.date(t.timestamp)}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest blocks + contributions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Latest blocks</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {blocks.slice(0, 6).map((b) => (
                <div key={b.number} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-semibold text-amber-300">Block #{b.number}</span>
                    <span className="text-[9.5px] text-muted-foreground">{b.txCount} txs · nonce {b.nonce}</span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground">{b.hash.slice(0, 34)}…</p>
                  <p className="font-mono text-[8.5px] text-muted-foreground/60">prev {b.prevHash.slice(0, 22)}…</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contribution records</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {contributions.slice(0, 5).map((c) => (
                <div key={c.hash} className="rounded-lg border border-border/60 bg-background/40 p-2.5 text-[11px]">
                  <p className="font-medium">{c.participantName}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{c.modelName} · round #{c.roundNumber}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-teal-300">score {c.metadata?.score !== undefined ? (c.metadata.score * 100).toFixed(0) : "—"}%</span>
                    <span className="font-mono text-[9px] text-amber-300/70">{fmt.hash(c.hash, 10, 4)}</span>
                  </div>
                </div>
              ))}
              {contributions.length === 0 && <p className="text-[11px] text-muted-foreground">No contribution proofs yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-amber-300">Production mode:</span> the same actions (register, recordContribution, allocateReward, claimReward) are submitted to the
                <span className="font-mono text-foreground"> DataVaultRewards.sol </span>
                contract on an EVM chain via ethers.js — see <span className="font-mono text-foreground">contracts/</span>. Only hashes and proofs go on-chain, never personal or raw dataset information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NetStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#0d1828] p-3.5 transition-all hover:border-amber-500/40">
      <div className="flex items-center justify-between">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <span className="text-amber-500 dark:text-amber-400">{icon}</span>
      </div>
      <p className="mt-1 font-mono text-[16px] font-extrabold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
