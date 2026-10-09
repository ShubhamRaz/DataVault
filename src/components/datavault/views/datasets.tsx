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

const DEFAULT_DATASETS = [
  {
    id: "ds-apollo",
    name: "Apollo Oncology Biomarker Panel",
    owner: { name: "Apollo Demo Hospital", slug: "hospital-a", industry: "Healthcare" },
    industry: "Healthcare",
    domain: "HEALTHCARE",
    sampleCount: 1420,
    featureCount: 30,
    targetName: "malignancy_risk",
    privacyClassification: "ENCRYPTED_UPDATES_ONLY",
    status: "ACTIVE",
    lastRoundNumber: 16,
    metadataHash: "0x4b7f92a10c8e3d",
    isDemo: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ds-aiims",
    name: "AIIMS Clinical Diagnostic Markers",
    owner: { name: "AIIMS Demo Center", slug: "hospital-b", industry: "Healthcare" },
    industry: "Healthcare",
    domain: "HEALTHCARE",
    sampleCount: 1680,
    featureCount: 30,
    targetName: "malignancy_risk",
    privacyClassification: "ENCRYPTED_UPDATES_ONLY",
    status: "ACTIVE",
    lastRoundNumber: 16,
    metadataHash: "0x89e2c4f107b3a9",
    isDemo: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ds-hdfc",
    name: "HDFC Card Transaction Risk Stream",
    owner: { name: "HDFC Demo Bank", slug: "bank-a", industry: "Finance" },
    industry: "Finance",
    domain: "FINANCE",
    sampleCount: 5200,
    featureCount: 28,
    targetName: "fraud_score",
    privacyClassification: "LOCAL_ONLY",
    status: "ACTIVE",
    lastRoundNumber: 16,
    metadataHash: "0x2e91b4c78a05f3",
    isDemo: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ds-green",
    name: "Green Valley Soil & Weather Yield Log",
    owner: { name: "Green Valley Farm Group", slug: "farm-a", industry: "Agriculture" },
    industry: "Agriculture",
    domain: "AGRICULTURE",
    sampleCount: 840,
    featureCount: 18,
    targetName: "yield_quintals_per_ha",
    privacyClassification: "LOCAL_ONLY",
    status: "ACTIVE",
    lastRoundNumber: 12,
    metadataHash: "0x6f38a901bd4e2c",
    isDemo: true,
    createdAt: new Date().toISOString(),
  },
];

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
    staleTime: 30000,
  });

  const rawDatasets = data?.datasets as typeof DEFAULT_DATASETS | undefined;
  const datasets = (rawDatasets && rawDatasets.length > 0) ? rawDatasets : (isLoading ? [] : DEFAULT_DATASETS);

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
        <ShieldCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-[12px] text-emerald-800 dark:text-emerald-200/90">
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
            <Card key={d.id} className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828] transition-all hover:border-teal-400/40">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{d.name}</p>
                    <button className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-cyan-300" onClick={() => navigate("organization", d.owner.slug)}>
                      <Users size={11} /> {d.owner.name}
                    </button>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] p-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">Records</p>
                    <p className="font-mono text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">{fmt.int(d.sampleCount)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] p-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">Features</p>
                    <p className="font-mono text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">{d.featureCount}</p>
                  </div>
                  <div className="rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-[#082223] p-2">
                    <p className="text-[9px] font-semibold uppercase text-teal-700 dark:text-teal-400">Last round</p>
                    <p className="font-mono text-[13px] font-bold text-teal-800 dark:text-[#2ee0bd]">{d.lastRoundNumber > 0 ? `#${d.lastRoundNumber}` : "—"}</p>
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
