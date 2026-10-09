"use client";
/**
 * DataVault — Audit log (spec §21): searchable/filterable hash-chained trail.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi, blockchainApi } from "@/lib/client/api";
import { PageHeader, StatusBadge, fmt, EmptyState } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ScrollText, Search, ShieldCheck, Loader2, Link2 } from "lucide-react";

export function AuditView() {
  const [q, setQ] = useState("");
  const [eventType, setEventType] = useState("all");
  const [status, setStatus] = useState("all");
  const [verifying, setVerifying] = useState(false);
  const [chainValid, setChainValid] = useState<boolean | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", q, eventType, status],
    queryFn: () => auditApi.list({ q: q || undefined, eventType, status }),
  });

  const entries = (data?.entries as {
    id: string; timestamp: string; actor: string; actorRole: string | null; organization: string | null;
    eventType: string; resource: string | null; status: string; metadata: Record<string, unknown> | null;
    hash: string; blockchainTxHash: string | null;
  }[]) ?? [];

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await blockchainApi.verify();
      setChainValid(r.auditChain.valid);
      toast[r.auditChain.valid ? "success" : "error"](`Audit chain ${r.auditChain.valid ? "valid" : "BROKEN"} — ${r.auditChain.entries} entries re-hashed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        subtitle="Every major system event, hash-chained for tamper evidence. Each entry links to the previous entry's hash; blockchain-anchored events carry transaction hashes."
        icon={<ScrollText size={18} />}
        actions={
          <Button size="sm" variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Verify audit chain
          </Button>
        }
      />

      {chainValid !== null && (
        <div className={`rounded-xl border p-3.5 text-[12px] ${chainValid ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
          {chainValid ? "✓ Audit hash chain verified — every entry recomputes correctly and links in sequence." : "✗ Audit chain integrity FAILURE detected."}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, resource, org…" className="h-9 w-60 pl-8 bg-card" />
        </div>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="h-9 w-64 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "ROUND_STARTED", "ROUND_COMPLETED", "UPDATE_SUBMITTED", "REWARD_CLAIMED", "USER_LOGIN", "USER_REGISTERED", "ORGANIZATION_REGISTERED", "ORGANIZATION_APPROVED", "MODEL_CREATED", "DATASET_GENERATED", "RAW_ACCESS_BLOCKED", "BLOCKCHAIN_RECORDED", "DEMO_INITIALIZED", "DEMO_RESET", "DEMO_EXPORTED", "ACCESS_REQUESTED", "SETTINGS_UPDATED", "AGGREGATION_COMPLETED"].map((t) => (
              <SelectItem key={t} value={t}>{t === "all" ? "All event types" : t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "SUCCESS", "FAILED", "BLOCKED"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All status" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : entries.length === 0 ? (
        <EmptyState title="No audit entries match" hint="Adjust filters." icon={<ScrollText size={24} />} />
      ) : (
        <Card className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828]">
          <CardHeader className="border-b border-slate-200 dark:border-[#1b3046]/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <ScrollText size={15} className="text-teal-600 dark:text-cyan-300" /> {entries.length} entries (latest first)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scroll-thin max-h-[560px] overflow-y-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e]/60 text-left text-[9.5px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Timestamp</th><th className="px-4 py-3 font-semibold">Actor</th><th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Resource</th><th className="px-4 py-3 font-semibold">Hash</th><th className="px-4 py-3 font-semibold">On-chain</th><th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 dark:border-[#1b3046]/40 transition-colors hover:bg-teal-500/[0.05]">
                      <td className="whitespace-nowrap px-4 py-2.5 text-[10px] text-slate-500 dark:text-slate-400">{fmt.date(e.timestamp)}</td>
                      <td className="px-4 py-2.5">
                        <p className="max-w-[160px] truncate font-semibold text-slate-900 dark:text-white">{e.actor}</p>
                        {e.organization && <p className="max-w-[160px] truncate text-[9px] text-slate-500 dark:text-slate-400">{e.organization}</p>}
                      </td>
                      <td className="px-4 py-2.5"><span className="rounded-md border border-teal-200 dark:border-cyan-500/20 bg-teal-50 dark:bg-[#0b253b] px-2 py-0.5 font-mono text-[9.5px] font-semibold text-teal-800 dark:text-cyan-300">{e.eventType}</span></td>
                      <td className="max-w-[140px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-400">{e.resource ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-[9.5px] text-slate-500 dark:text-slate-400">{fmt.hash(e.hash, 8, 4)}</td>
                      <td className="px-4 py-2.5 font-mono text-[9.5px] text-amber-700 dark:text-amber-300">{e.blockchainTxHash ? <span className="flex items-center gap-1"><Link2 size={9} /> {fmt.hash(e.blockchainTxHash, 8, 4)}</span> : "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
