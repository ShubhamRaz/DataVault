"use client";
/**
 * DataVault — Marketplace (spec §18, §53): federated model listings +
 * access requests. Models & collaboration, never raw datasets.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi, modelsApi } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { navigate } from "@/lib/client/router";
import { PageHeader, StatusBadge, fmt, EmptyState, PrivacyBadge } from "@/components/datavault/shared";
import { Breadcrumbs } from "@/components/datavault/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Store, Search, ArrowRight, Users, ShieldCheck, TrendingUp, Coins, Handshake, Loader2, MessageSquare } from "lucide-react";

interface Listing {
  id: string; modelId: string; title: string; description: string; useCase: string; industry: string;
  performance: number; privacyMethod: string; trainingRounds: number; price: number; accessPolicy: string;
  status: string; participants: string[]; createdAt: string;
  model?: { id: string; slug: string; taskType: string; currentAccuracy: number };
  accessRequests?: { id: string; organization: string; status: string; message: string | null; createdAt: string }[];
}

export function MarketplaceView() {
  const { user } = useAppStore();
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [privacyMethod, setPrivacyMethod] = useState("all");
  const [accessPolicy, setAccessPolicy] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", q, industry, privacyMethod, accessPolicy],
    queryFn: () => marketplaceApi.list({ q: q || undefined, industry, privacyMethod, accessPolicy }),
  });

  const listings = (data?.listings as Listing[]) ?? [];
  const canPublish = ["ADMIN", "ORG_ADMIN", "ML_OPERATOR"].includes(user?.role ?? "");

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Model Marketplace"
        subtitle="Federated models and AI collaboration opportunities. Organizations collaborate on models — raw personal datasets are never listed or sold."
        icon={<Store size={18} />}
        actions={canPublish ? <PublishDialog /> : undefined}
      />

      <div className="flex items-center gap-2 rounded-xl border border-teal-500/25 bg-teal-500/[0.05] p-3.5">
        <Handshake size={16} className="shrink-0 text-teal-300" />
        <p className="text-[12px] text-teal-200/90">
          <span className="font-semibold">DataVault is:</span> &quot;Collaborate on AI without transferring raw data.&quot; —
          <span className="font-semibold"> NOT:</span> &quot;Sell your customer data.&quot; Every listing shows performance, privacy method and contributors.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…" className="h-9 w-56 pl-8 bg-card" />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "Healthcare", "Finance", "Agriculture"].map((i) => <SelectItem key={i} value={i}>{i === "all" ? "All industries" : i}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={privacyMethod} onValueChange={setPrivacyMethod}>
          <SelectTrigger className="h-9 w-44 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "SECURE_AGGREGATION", "FEDERATED_AVERAGING", "HE + SECURE_AGG"].map((p) => <SelectItem key={p} value={p}>{p === "all" ? "All privacy methods" : p.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={accessPolicy} onValueChange={setAccessPolicy}>
          <SelectTrigger className="h-9 w-40 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "REQUEST_ACCESS", "OPEN", "INVITE_ONLY"].map((p) => <SelectItem key={p} value={p}>{p === "all" ? "All access policies" : p.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : listings.length === 0 ? (
        <EmptyState title="No listings found" hint="Publish a federated model to the marketplace." icon={<Store size={26} />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => (
            <Card key={l.id} className="group cursor-pointer transition-colors hover:border-teal-500/40" onClick={() => navigate("listing", l.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{l.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{l.industry} · {l.useCase.slice(0, 46)}{l.useCase.length > 46 ? "…" : ""}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>

                <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{l.description}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Performance</p>
                    <p className="font-mono text-[13px] font-semibold text-emerald-400">{l.model?.taskType === "REGRESSION" ? `R² ${l.performance.toFixed(2)}` : `${(l.performance * 100).toFixed(1)}%`}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 p-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Rounds</p>
                    <p className="font-mono text-[13px]">{l.trainingRounds}</p>
                  </div>
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Price</p>
                    <p className="font-mono text-[13px] font-semibold text-amber-300">{l.price === 0 ? "Free" : `${l.price} DATA`}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {l.participants.slice(0, 3).map((p) => (
                    <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] text-muted-foreground">{p}</span>
                  ))}
                  {l.participants.length > 3 && <span className="text-[9.5px] text-muted-foreground">+{l.participants.length - 3}</span>}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <PrivacyBadge mode={l.privacyMethod === "HE + SECURE_AGG" ? "ENCRYPTION" : "DEMO"} />
                  <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">{l.accessPolicy.replace(/_/g, " ").toLowerCase()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PublishDialog() {
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState("");
  const [price, setPrice] = useState("500");
  const [accessPolicy, setAccessPolicy] = useState("REQUEST_ACCESS");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const { data: modelsData } = useQuery({ queryKey: ["models-publish"], queryFn: () => modelsApi.list() });
  const unlisted = (modelsData?.models ?? []).filter((m) => !m.listing);

  const publish = async () => {
    setBusy(true);
    try {
      const m = unlisted.find((x) => x.id === modelId);
      await marketplaceApi.list; // keep import
      await import("@/lib/client/api").then((mod) =>
        mod.api.post("/marketplace", { modelId, price: Number(price), accessPolicy, description: description || m?.description })
      );
      toast.success("Listing published");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 bg-teal-500 text-[#03211d] hover:bg-teal-400"><TrendingUp size={14} /> Publish listing</Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader><DialogTitle>Publish a federated model</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger><SelectValue placeholder="Select a model" /></SelectTrigger>
              <SelectContent>
                {unlisted.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.participantCount} participants</SelectItem>)}
              </SelectContent>
            </Select>
            {unlisted.length === 0 && <p className="text-[10.5px] text-muted-foreground">All models already have listings.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Price (DATA)</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Access policy</Label>
              <Select value={accessPolicy} onValueChange={setAccessPolicy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["REQUEST_ACCESS", "OPEN", "INVITE_ONLY"].map((p) => <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Listing description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is this model for and what does it do?" rows={3} />
          </div>
          <Button disabled={busy || !modelId} onClick={publish} className="w-full bg-teal-500 text-[#03211d]">{busy ? <Loader2 size={13} className="animate-spin" /> : null} Publish listing</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Listing detail ───

export function ListingDetailView({ id }: { id: string }) {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["listing-detail", id], queryFn: () => marketplaceApi.detail(id) });

  const requestAccess = async () => {
    setBusy(true);
    try {
      await marketplaceApi.requestAccess(id, message || undefined);
      toast.success("Access request submitted");
      setRequestOpen(false);
      queryClient.invalidateQueries({ queryKey: ["listing-detail", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  }

  const listing = data.listing as Listing;
  const model = data.model as {
    id: string; name: string; taskType: string; currentAccuracy: number; baselineAccuracy: number; version: string;
    metrics: Record<string, number>; privacyMode: string; modelHash: string;
    versions: { version: string; accuracy: number; roundNumber: number; modelHash: string }[];
    participants: { name: string; slug: string; walletAddress: string | null; lifetimeScore: number; roundsParticipated: number }[];
  };
  const rounds = (data.rounds as { roundNumber: number; metricsAfter: number; improvement: number; encryptedUpdates: number }[]) ?? [];
  const accessRequests = (data.accessRequests as { id: string; organization: string; status: string; message: string | null; createdAt: string }[]) ?? [];

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Marketplace", route: "marketplace" }, { label: listing.title }]} />
      <PageHeader
        title={listing.title}
        subtitle={`${listing.industry} · ${listing.useCase}`}
        icon={<Store size={18} />}
        actions={
          <>
            <StatusBadge status={listing.status} />
            <Button size="sm" variant="outline" onClick={() => navigate("model", model.id)}>View model registry <ArrowRight size={13} /></Button>
            {listing.accessPolicy !== "OPEN" && (
              <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-teal-500 text-[#03211d] hover:bg-teal-400"><MessageSquare size={13} /> Request access</Button>
                </DialogTrigger>
                <DialogContent className="border-border bg-background sm:max-w-md">
                  <DialogHeader><DialogTitle>Request access — {listing.title}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Message to the coordinator</Label>
                      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Our organization would like to evaluate this model for…" />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">Request submitted as {user?.organizationName ?? user?.name ?? user?.email}.</p>
                    <Button disabled={busy} onClick={requestAccess} className="w-full bg-teal-500 text-[#03211d]">{busy ? "Submitting…" : "Submit request"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-[13px] leading-relaxed text-muted-foreground">{listing.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Performance" value={model.taskType === "REGRESSION" ? `R² ${listing.performance.toFixed(2)}` : `${(listing.performance * 100).toFixed(1)}%`} accent="emerald" />
                <Stat label="Privacy method" value={listing.privacyMethod.replace(/_/g, " ")} accent="cyan" />
                <Stat label="Training rounds" value={String(listing.trainingRounds)} />
                <Stat label="Price" value={listing.price === 0 ? "Free" : `${listing.price} DATA`} accent="amber" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Performance history (federation rounds)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-[11.5px]">
                <thead><tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Metric</th><th className="px-4 py-2.5">Δ</th><th className="px-4 py-2.5">Protected updates</th>
                </tr></thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.roundNumber} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-cyan-300">#{r.roundNumber}</td>
                      <td className="px-4 py-2.5 font-mono">{model.taskType === "REGRESSION" ? `R² ${r.metricsAfter.toFixed(3)}` : `${(r.metricsAfter * 100).toFixed(1)}%`}</td>
                      <td className={`px-4 py-2.5 font-mono ${r.improvement >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.improvement >= 0 ? "+" : ""}{(r.improvement * 100).toFixed(2)}</td>
                      <td className="px-4 py-2.5 font-mono">{r.encryptedUpdates > 0 ? `🔒 ${r.encryptedUpdates}` : "masked"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contributing organizations</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {model.participants.map((p) => (
                <button key={p.slug} className="rounded-lg border border-border/60 bg-background/40 p-3 text-left transition-colors hover:border-cyan-500/30" onClick={() => navigate("organization", p.slug)}>
                  <p className="text-[12.5px] font-medium">{p.name}</p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-mono">{p.walletAddress?.slice(0, 12)}…</span>
                    <span>{p.roundsParticipated} rounds · score {p.lifetimeScore.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><Coins size={14} className="text-amber-300" /> Reward information</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[11.5px] text-muted-foreground">
              <p>Contributors share a <span className="font-semibold text-amber-300">1000 DATA</span> reward pool per training round, split by normalized contribution score.</p>
              <p>Access may be requested by any verified organization; approvals are recorded in the audit log.</p>
              <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 font-mono text-[10px] text-muted-foreground">
                model hash: {fmt.hash(model.modelHash, 12, 6)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><Users size={14} className="text-cyan-300" /> Access requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {accessRequests.length === 0 && <p className="text-[11px] text-muted-foreground">No access requests yet.</p>}
              {accessRequests.map((ar) => (
                <div key={ar.id} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium">{ar.organization}</p>
                    <StatusBadge status={ar.status} />
                  </div>
                  {ar.message && <p className="mt-1 text-[10.5px] text-muted-foreground">{ar.message}</p>}
                  <p className="mt-0.5 text-[9px] text-muted-foreground/70">{fmt.date(ar.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/25 bg-emerald-500/[0.04]">
            <CardContent className="p-4">
              <div className="flex items-start gap-2 text-[11.5px] text-emerald-200/90">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                <p>This listing represents a federated model trained without any raw-data transfer. No personal or raw dataset information is included or transferable.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "cyan" | "amber" }) {
  const accents: Record<string, string> = {
    emerald: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-400",
    cyan: "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-300",
    amber: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
  };
  return (
    <div className={`rounded-lg border p-2.5 ${accent ? accents[accent] : "border-border bg-background/40"}`}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] font-semibold">{value}</p>
    </div>
  );
}
