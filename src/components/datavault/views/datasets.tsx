"use client";
/**
 * DataVault — Dataset registry (spec §15, §19): metadata only + the
 * raw-access privacy guard demo (RAW_ACCESS_BLOCKED).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { navigate } from "@/lib/client/router";
import { PageHeader, StatusBadge, fmt, EmptyState } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Database, Search, ShieldAlert, ShieldCheck, FileLock2, Users, Loader2 } from "lucide-react";

export function DatasetsView() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("all");
  const [guardResult, setGuardResult] = useState<{ reason: string; whatIsShared?: Record<string, string>; dataset?: { name: string; owner: string } } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["datasets", q, domain, status],
    queryFn: () => datasetsApi.list({ q: q || undefined, domain, status }),
  });

  const datasets = (data?.datasets as {
    id: string; name: string; owner: { name: string; slug: string; industry: string };
    industry: string; domain: string; sampleCount: number; featureCount: number; targetName: string;
    privacyClassification: string; status: string; lastRoundNumber: number; metadataHash: string; isDemo: boolean; createdAt: string;
  }[]) ?? [];

  const tryRawAccess = async (id: string) => {
    try {
      const r = await datasetsApi.tryRawAccess(id);
      setGuardResult(r as typeof guardResult);
      toast.error("Raw data access DENIED — blocked and logged by the privacy guard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Guard check failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dataset Registry"
        subtitle="Metadata only — sample counts, feature names and integrity hashes. Raw records are never stored centrally and can never be downloaded from this platform."
        icon={<Database size={18} />}
        actions={
          <>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search datasets…" className="h-9 w-52 pl-8 bg-card" />
            </div>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "HEALTHCARE", "FINANCE", "AGRICULTURE"].map((d) => <SelectItem key={d} value={d}>{d === "all" ? "All domains" : d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-44 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "LOCAL_ONLY", "ENCRYPTED_UPDATES_ONLY", "PARTICIPATING", "ARCHIVED"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All status" : s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
        <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
        <p className="text-[12px] text-emerald-200/90">
          <span className="font-semibold">Raw data never leaves the data owner.</span> Datasets live in participant-local environments
          (<span className="font-mono text-[11px]">data/participants/&lt;org&gt;/data.csv</span>) — the registry stores metadata only. Try the raw-access button to see the guard in action.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : datasets.length === 0 ? (
        <EmptyState title="No datasets found" hint="Generate synthetic data from Admin → Demo Controls." icon={<Database size={26} />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datasets.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold">{d.name}</p>
                    <button className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan-300" onClick={() => navigate("organization", d.owner.slug)}>
                      <Users size={10} /> {d.owner.name}
                    </button>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-background/40 p-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Records</p>
                    <p className="font-mono text-[13px]">{fmt.int(d.sampleCount)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 p-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Features</p>
                    <p className="font-mono text-[13px]">{d.featureCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 p-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Last round</p>
                    <p className="font-mono text-[13px]">{d.lastRoundNumber > 0 ? `#${d.lastRoundNumber}` : "—"}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span>target: <span className="font-mono text-foreground/80">{d.targetName}</span></span>
                  <span className={`rounded px-1.5 py-0.5 ${d.privacyClassification === "RESTRICTED" ? "bg-red-500/10 text-red-300" : d.privacyClassification === "CONFIDENTIAL" ? "bg-amber-500/10 text-amber-300" : "bg-teal-500/10 text-teal-300"}`}>
                    {d.privacyClassification}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] text-muted-foreground/70">sha {fmt.hash(d.metadataHash, 10, 4)}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-[10.5px] text-red-300/90 hover:bg-red-500/10 hover:text-red-300" onClick={() => tryRawAccess(d.id)}>
                    <FileLock2 size={11} /> Try raw access
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* privacy guard result dialog */}
      <Dialog open={!!guardResult} onOpenChange={(v) => !v && setGuardResult(null)}>
        <DialogContent className="border-red-500/30 bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400"><ShieldAlert size={16} /> {guardResult?.reason}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {guardResult?.dataset && <>Dataset <span className="font-medium text-foreground">{guardResult.dataset.name}</span> (owner: {guardResult.dataset.owner}) — </>}
              the DataVault privacy architecture blocks raw record access by design. This attempt has been logged as a privacy event and audit entry (RAW_ACCESS_BLOCKED).
            </p>
            {guardResult?.whatIsShared && (
              <div className="space-y-1.5">
                {Object.entries(guardResult.whatIsShared).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-card px-3 py-2 text-[11px]">
                    <span className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</span>{" "}
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => { setGuardResult(null); navigate("audit"); }}>
              View the audit entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
