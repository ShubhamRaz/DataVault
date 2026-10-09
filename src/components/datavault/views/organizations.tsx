"use client";
/**
 * DataVault — Organization management (spec §11): list + detail with
 * overview/models/federation/contributions/rewards/privacy/audit tabs.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orgsApi, type OrganizationSummary } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { navigate } from "@/lib/client/router";
import { PageHeader, StatusBadge, fmt, EmptyState } from "@/components/datavault/shared";
import { Breadcrumbs } from "@/components/datavault/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Search, Plus, MapPin, Coins, Network, ShieldCheck, ScrollText, Boxes, Loader2, BadgeCheck, Ban, Check } from "lucide-react";

const DEFAULT_ORGS: OrganizationSummary[] = [
  {
    id: "org-apollo",
    name: "Apollo Demo Hospital",
    slug: "hospital-a",
    type: "Hospital",
    industry: "Healthcare",
    location: "Chennai, IN",
    status: "ACTIVE",
    verification: "VERIFIED",
    description: "Synthetic demo hospital network with an oncology research division.",
    walletAddress: "0x4a7e93f821c0b3d1",
    activeModels: 3,
    trainingRounds: 16,
    contributionScore: 1.9,
    rewardBalance: 3200,
    datasets: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "org-aiims",
    name: "AIIMS Demo Center",
    slug: "hospital-b",
    type: "Hospital",
    industry: "Healthcare",
    location: "New Delhi, IN",
    status: "ACTIVE",
    verification: "VERIFIED",
    description: "Synthetic demo medical research center focused on diagnostic biomarkers.",
    walletAddress: "0x8f2d1e04a79b3c58",
    activeModels: 3,
    trainingRounds: 16,
    contributionScore: 1.28,
    rewardBalance: 2800,
    datasets: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "org-max",
    name: "Max Demo Research Lab",
    slug: "hospital-c",
    type: "Research Institution",
    industry: "Healthcare",
    location: "Mumbai, IN",
    status: "ACTIVE",
    verification: "VERIFIED",
    description: "Synthetic demo clinical research lab for patient record evaluation.",
    walletAddress: "0x12c4b8e930f7a5d1",
    activeModels: 3,
    trainingRounds: 16,
    contributionScore: 0.98,
    rewardBalance: 2100,
    datasets: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "org-hdfc",
    name: "HDFC Demo Bank",
    slug: "bank-a",
    type: "Bank",
    industry: "Finance",
    location: "Mumbai, IN",
    status: "ACTIVE",
    verification: "VERIFIED",
    description: "Synthetic demo retail bank monitoring card fraud telemetry.",
    walletAddress: "0x99a3e210b48c7f3e",
    activeModels: 3,
    trainingRounds: 16,
    contributionScore: 1.21,
    rewardBalance: 2450,
    datasets: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "org-icici",
    name: "ICICI Demo Bank",
    slug: "bank-b",
    type: "Bank",
    industry: "Finance",
    location: "Hyderabad, IN",
    status: "ACTIVE",
    verification: "VERIFIED",
    description: "Synthetic demo universal bank with digital payments telemetry.",
    walletAddress: "0x53d820f4c91a3b7e",
    activeModels: 3,
    trainingRounds: 16,
    contributionScore: 2.04,
    rewardBalance: 3600,
    datasets: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "org-green",
    name: "Green Valley Farm Group",
    slug: "farm-a",
    type: "Agricultural Organization",
    industry: "Agriculture",
    location: "Nashik, IN",
    status: "ACTIVE",
    verification: "VERIFIED",
    description: "Synthetic demo farmer collective optimizing regional crop yield.",
    walletAddress: "0x37e90c812d4b6a1f",
    activeModels: 2,
    trainingRounds: 12,
    contributionScore: 0.64,
    rewardBalance: 1400,
    datasets: 1,
    createdAt: new Date().toISOString(),
  },
];

export function OrganizationsView() {
  const { user } = useAppStore();
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [status, setStatus] = useState("all");
  const [verification, setVerification] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["orgs", q, industry, status, verification],
    queryFn: () => orgsApi.list({ q: q || undefined, industry, status, verification }),
    staleTime: 30000,
  });

  const rawOrgs = data?.organizations;
  const orgs = (rawOrgs && rawOrgs.length > 0) ? rawOrgs : (isLoading ? [] : DEFAULT_ORGS);
  const canCreate = user?.role === "ADMIN";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizations"
        subtitle="Data owners in the network. Each organization keeps its raw data inside its own environment — the platform holds metadata only."
        icon={<Building2 size={18} />}
        actions={
          <>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations…" className="h-9 w-52 pl-8 bg-card" />
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "Healthcare", "Finance", "Agriculture", "Research"].map((i) => <SelectItem key={i} value={i}>{i === "all" ? "All industries" : i}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={verification} onValueChange={setVerification}>
              <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "VERIFIED", "UNVERIFIED"].map((v) => <SelectItem key={v} value={v}>{v === "all" ? "All verification" : v}</SelectItem>)}
              </SelectContent>
            </Select>
            {canCreate && <CreateOrgDialog />}
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : orgs.length === 0 ? (
        <EmptyState title="No organizations found" hint="Adjust filters or register a new organization." icon={<Building2 size={26} />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((o) => (
            <Card
              key={o.id}
              className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828] transition-all duration-200 hover:-translate-y-1 hover:border-teal-400/50 hover:shadow-xl hover:shadow-teal-500/5"
              onClick={() => navigate("organization", o.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-cyan-300 transition-colors">{o.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"><MapPin size={10} /> {o.location} · {o.industry}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] p-2.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Active models</span>
                    <span className="font-mono text-[13px] font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{o.activeModels}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] p-2.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Training rounds</span>
                    <span className="font-mono text-[13px] font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{o.trainingRounds}</span>
                  </div>
                  <div className="rounded-xl border border-teal-200 dark:border-teal-500/25 bg-teal-50 dark:bg-[#082223] p-2.5">
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 block font-medium">Contribution</span>
                    <span className="font-mono text-[13px] font-bold text-teal-800 dark:text-[#2ee0bd] mt-0.5 block">{o.contributionScore.toFixed(2)}</span>
                  </div>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-[#241c09] p-2.5">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">Rewards</span>
                    <span className="font-mono text-[13px] font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">{o.rewardBalance.toFixed(0)} DATA</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-border/40 pt-3">
                  <div className="flex items-center gap-1.5">
                    {o.verification === "VERIFIED" ? (
                      <span className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400"><BadgeCheck size={13} /> Verified</span>
                    ) : (
                      <span className="text-[10.5px] font-medium text-amber-600 dark:text-amber-400">{o.verification.toLowerCase()}</span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{o.walletAddress?.slice(0, 12)}…</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateOrgDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("Hospital");
  const [industry, setIndustry] = useState("Healthcare");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await orgsApi.create({ name, type, industry, location, description, adminEmail: adminEmail || undefined, adminName: adminName || undefined, adminPassword: adminPassword || undefined });
      toast.success(`${name} registered (PENDING) with a derived wallet address`);
      setOpen(false);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to register organization");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 bg-cyan-500 text-[#04222b] hover:bg-cyan-400"><Plus size={14} /> Add organization</Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader><DialogTitle>Register organization</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunrise Demo Hospital" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Pune, IN" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Hospital", "Bank", "Agricultural Organization", "Research Institution", "Enterprise", "Insurance"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Healthcare", "Finance", "Agriculture", "Research", "Insurance", "Enterprise"].map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Synthetic demo organization" /></div>
          <p className="pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Optional org admin account</p>
          <div className="grid grid-cols-3 gap-2">
            <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Admin name" />
            <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@org.demo" />
            <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password" />
          </div>
          <Button disabled={busy || !name} onClick={create} className="w-full bg-cyan-500 text-[#04222b]">{busy ? <Loader2 size={13} className="animate-spin" /> : null} Register (PENDING approval)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Organization detail ───

export function OrganizationDetailView({ id }: { id: string }) {
  const { user } = useAppStore();
  const { data, isLoading } = useQuery({ queryKey: ["org-detail", id], queryFn: () => orgsApi.detail(id) });

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32" /><Skeleton className="h-72" /></div>;
  }

  const org = data.organization as OrganizationSummary & {
    wallet: { address: string; balance: number; pending: number; claimed: number; totalEarned: number } | null;
    users: { id: string; name: string; email: string; role: string; lastLoginAt: string | null }[];
    datasets: { id: string; name: string; sampleCount: number; status: string; privacyClassification: string }[];
    description: string | null;
    trainingRuns: number;
    createdAt: string;
  };
  const participants = (data.participants as { id: string; status: string; roundsParticipated: number; lifetimeScore: number; lastRoundAt: string | null; model: { id: string; name: string; currentAccuracy: number; taskType: string } }[]) ?? [];
  const contributions = (data.contributions as { id: string; roundNumber: number; sampleCount: number; normalizedScore: number; qualityScore: number; improvementScore: number; round: { modelName: string } }[]) ?? [];
  const rewards = (data.rewards as { id: string; roundNumber: number; amount: number; status: string; txHash: string | null; createdAt: string; round: { modelName: string } }[]) ?? [];
  const privacyEvents = (data.privacyEvents as { id: string; type: string; description: string; createdAt: string }[]) ?? [];
  const auditEvents = (data.auditEvents as { id: string; eventType: string; resource: string | null; status: string; createdAt: string; entryHash: string }[]) ?? [];

  const approve = async (status: string) => {
    try {
      await orgsApi.update(id, { status });
      toast.success(`${org.name} → ${status}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Organizations", route: "organizations" }, { label: org.name }]} />
      <PageHeader
        title={org.name}
        subtitle={`${org.type} · ${org.industry} · ${org.location} — ${org.description ?? ""}`}
        icon={<Building2 size={18} />}
        actions={
          <>
            <StatusBadge status={org.status} />
            {user?.role === "ADMIN" && org.status !== "ACTIVE" && (
              <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-300" onClick={() => approve("ACTIVE")}><Check size={13} /> Approve</Button>
            )}
            {user?.role === "ADMIN" && org.status === "ACTIVE" && (
              <Button size="sm" variant="outline" className="border-red-500/30 text-red-300" onClick={() => approve("SUSPENDED")}><Ban size={13} /> Suspend</Button>
            )}
          </>
        }
      />

      {/* overview stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <OrgStat label="Active models" value={String(participants.filter((p) => p.status === "ACTIVE").length)} />
        <OrgStat label="Training rounds" value={String(org.trainingRuns)} />
        <OrgStat label="Contribution score" value={contributions.reduce((s, c) => s + c.normalizedScore, 0).toFixed(2)} />
        <OrgStat label="Total earned" value={`${(org.wallet?.totalEarned ?? 0).toFixed(0)} DATA`} />
        <OrgStat label="Pending rewards" value={`${(org.wallet?.pending ?? 0).toFixed(0)} DATA`} />
        <OrgStat label="Local datasets" value={String(org.datasets.length)} />
      </div>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList className="bg-card">
          <TabsTrigger value="models" className="text-[12px]">Models</TabsTrigger>
          <TabsTrigger value="federation" className="text-[12px]">Federation activity</TabsTrigger>
          <TabsTrigger value="contributions" className="text-[12px]">Contributions</TabsTrigger>
          <TabsTrigger value="rewards" className="text-[12px]">Rewards</TabsTrigger>
          <TabsTrigger value="privacy" className="text-[12px]">Privacy</TabsTrigger>
          <TabsTrigger value="audit" className="text-[12px]">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <Card><CardContent className="p-4">
            {participants.length === 0 ? <p className="text-xs text-muted-foreground">Not participating in any model yet.</p> : (
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 hover:border-cyan-500/30" onClick={() => navigate("model", p.model.id)}>
                    <div>
                      <p className="text-[12.5px] font-medium">{p.model.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.roundsParticipated} rounds · last {fmt.date(p.lastRoundAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11.5px]">
                      <span className="font-mono text-emerald-400">{p.model.taskType === "REGRESSION" ? `R² ${p.model.currentAccuracy.toFixed(2)}` : `${(p.model.currentAccuracy * 100).toFixed(1)}%`}</span>
                      <span className="font-mono text-teal-300">{p.lifetimeScore.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="federation">
          <Card><CardContent className="p-0">
            <table className="w-full text-[11.5px]">
              <thead><tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Model</th><th className="px-4 py-2.5">Samples</th><th className="px-4 py-2.5">Score</th>
              </tr></thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-cyan-300">#{c.roundNumber}</td>
                    <td className="px-4 py-2.5">{c.round.modelName}</td>
                    <td className="px-4 py-2.5 font-mono">{c.sampleCount}</td>
                    <td className="px-4 py-2.5 font-mono text-teal-300">{(c.normalizedScore * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contributions">
          <Card><CardContent className="p-0">
            <table className="w-full text-[11.5px]">
              <thead><tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Model</th><th className="px-4 py-2.5">Raw score</th><th className="px-4 py-2.5">Quality</th><th className="px-4 py-2.5">Improvement</th>
              </tr></thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-cyan-300">#{c.roundNumber}</td>
                    <td className="px-4 py-2.5">{c.round.modelName}</td>
                    <td className="px-4 py-2.5 font-mono">{(c.normalizedScore * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2.5 font-mono">{(c.qualityScore * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2.5 font-mono">{(c.improvementScore * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rewards">
          <Card><CardContent className="p-0">
            <table className="w-full text-[11.5px]">
              <thead><tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Model</th><th className="px-4 py-2.5">Amount</th><th className="px-4 py-2.5">TX</th><th className="px-4 py-2.5">Status</th>
              </tr></thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-cyan-300">#{r.roundNumber}</td>
                    <td className="px-4 py-2.5">{r.round.modelName}</td>
                    <td className="px-4 py-2.5 font-mono text-amber-300">{r.amount.toFixed(0)} DATA</td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-amber-300/70">{fmt.hash(r.txHash, 10, 4)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-[11.5px] text-emerald-300">
              <ShieldCheck size={14} /> Raw data shared: 0 bytes — datasets stay inside this organization&apos;s environment
            </div>
            <div className="space-y-2">
              {org.datasets.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-[11.5px]">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-[9.5px] text-muted-foreground">{d.sampleCount} samples · {d.privacyClassification.toLowerCase()}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
              {privacyEvents.slice(0, 6).map((e) => (
                <div key={e.id} className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="font-mono text-[9.5px] text-emerald-300">{e.type}</span> — {e.description}
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card><CardContent className="p-4">
            <div className="space-y-1.5">
              {auditEvents.slice(0, 20).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-[11px]">
                  <span className="font-mono text-[9.5px] text-cyan-300">{e.eventType}</span>
                  <span className="text-muted-foreground">{e.resource ?? ""}</span>
                  <StatusBadge status={e.status} />
                  <span className="text-[9px] text-muted-foreground">{fmt.date(e.createdAt)}</span>
                </div>
              ))}
              {auditEvents.length === 0 && <p className="text-xs text-muted-foreground">No audit events.</p>}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <p className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Coins size={13} className="text-amber-300" /> Wallet <span className="font-mono text-foreground">{org.wallet?.address}</span>
            <span className="ml-3">balance <span className="font-mono text-emerald-400">{(org.wallet?.balance ?? 0).toFixed(0)}</span></span>
            <span className="ml-2">pending <span className="font-mono text-cyan-300">{(org.wallet?.pending ?? 0).toFixed(0)}</span></span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function OrgStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#0d1828] p-3.5 shadow-sm">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-[16px] font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
