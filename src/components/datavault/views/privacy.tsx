"use client";
/**
 * DataVault — Privacy Center (spec §20, §34): posture, counters,
 * architecture visualization, event log, disclaimers.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { privacyApi } from "@/lib/client/api";
import { PageHeader, fmt } from "@/components/datavault/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Lock, Network, Coins, Server, Database, ArrowDown, ShieldAlert } from "lucide-react";

export function PrivacyView() {
  const [type, setType] = useState("all");
  const { data: statusData, isLoading } = useQuery({ queryKey: ["privacy-status"], queryFn: privacyApi.status });
  const { data: eventsData } = useQuery({ queryKey: ["privacy-events", type], queryFn: () => privacyApi.events({ type }) });

  if (isLoading || !statusData) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  }

  const status = statusData.status as Record<string, boolean | string>;
  const counters = statusData.counters as Record<string, number>;
  const layers = statusData.layers as Record<string, { name: string; description: string; [k: string]: unknown }>;
  const events = (eventsData?.events as { id: string; type: string; organization: string | null; modelName: string | null; description: string; createdAt: string }[]) ?? [];
  const byType = eventsData?.byType ?? {};

  return (
    <div className="space-y-5">
      <PageHeader
        title="Privacy Center"
        subtitle="The privacy posture of the network — enforced by architecture, not policy. Raw data shared: 0 bytes, ever."
        icon={<ShieldCheck size={18} />}
      />

      {/* posture */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <PostureCard label="Raw data shared" value="0 bytes" ok />
        <PostureCard label="Encrypted updates" value={String(counters.encryptedUpdates)} ok />
        <PostureCard label="Model updates" value={String(counters.modelUpdates)} ok />
        <PostureCard label="Data owners" value={String(counters.dataOwners)} ok />
        <PostureCard label="Privacy events" value={String(counters.privacyEvents)} ok />
        <PostureCard label="Secure aggregation" value="ENABLED" ok />
        <PostureCard label="Blockchain audit" value="ENABLED" ok />
      </div>

      {/* architecture visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Privacy architecture — the path data never takes, and the path updates do</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <FlowColumn
              title="Data Owner"
              steps={[
                { icon: <Database size={13} />, label: "RAW DATA (local only)", tone: "red" },
                { icon: <Server size={13} />, label: "LOCAL TRAINING (real SGD)", tone: "teal" },
                { icon: <Lock size={13} />, label: "MASK + ENCRYPT UPDATE Δ", tone: "cyan" },
              ]}
            />
            <FlowColumn
              title="Privacy Layer"
              steps={[
                { icon: <Network size={13} />, label: "SECURE AGGREGATOR (masks cancel)", tone: "cyan" },
                { icon: <Server size={13} />, label: "FedAvg → NEW GLOBAL MODEL", tone: "cyan" },
                { icon: <ShieldCheck size={13} />, label: "METRICS ONLY (numbers travel)", tone: "teal" },
              ]}
            />
            <FlowColumn
              title="Trust Layer"
              steps={[
                { icon: <Coins size={13} />, label: "CONTRIBUTION SCORING", tone: "amber" },
                { icon: <Network size={13} />, label: "BLOCKCHAIN PROOFS (hashes only)", tone: "amber" },
                { icon: <ShieldCheck size={13} />, label: "AUDIT HASH-CHAIN", tone: "muted" },
              ]}
            />
          </div>
          <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-center text-[12px] text-red-300">
            🚫 RAW DATA PATH: BLOCKED — there is no pipe, API or export path for raw records. Attempts are denied and logged.
          </div>
          <p className="mt-3 text-center text-[13px] font-medium text-emerald-300">
            &quot;Your raw data remains inside your organization.&quot;
          </p>
        </CardContent>
      </Card>

      {/* three layers detail */}
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(layers).map(([key, layer]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-semibold text-cyan-300">{layer.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <p className="text-[12px] leading-relaxed text-muted-foreground">{layer.description}</p>
              {Object.entries(layer).filter(([k]) => !["name", "description"].includes(k)).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-[10.5px]">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-foreground">{String(v)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert size={15} className="text-emerald-300" /> Privacy events
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="ml-auto h-8 w-56 bg-card text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", ...Object.keys(byType)].map((t) => <SelectItem key={t} value={t}>{t === "all" ? "All types" : t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="scroll-thin max-h-80 overflow-y-auto">
            {events.map((e) => (
              <div key={e.id} className="border-b border-border/40 px-4 py-2.5 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-emerald-300">{e.type}</span>
                  <span className="text-[9.5px] text-muted-foreground">{fmt.date(e.createdAt)}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{e.description}</p>
              </div>
            ))}
            {events.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No privacy events recorded.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/25 bg-amber-500/[0.04]">
        <CardContent className="p-4">
          <p className="text-[11.5px] leading-relaxed text-amber-200/80">
            {String(statusData.disclaimer)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PostureCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-border bg-card"}`}>
      <p className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-[14px] font-semibold text-emerald-400">{value}</p>
    </div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  red: "border-red-500/30 bg-red-500/[0.07] text-red-200",
  teal: "border-teal-500/30 bg-teal-500/[0.07] text-teal-200",
  cyan: "border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-200",
  amber: "border-amber-500/30 bg-amber-500/[0.07] text-amber-200",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

function FlowColumn({ title, steps }: { title: string; steps: { icon: React.ReactNode; label: string; tone: string }[] }) {
  return (
    <div className="flex flex-col">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col items-stretch">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[10.5px] font-medium ${TONE_CLASSES[s.tone]}`}>
            {s.icon}
            {s.label}
          </div>
          {i < steps.length - 1 && <ArrowDown size={13} className="mx-auto my-0.5 text-cyan-500/50" />}
        </div>
      ))}
    </div>
  );
}
