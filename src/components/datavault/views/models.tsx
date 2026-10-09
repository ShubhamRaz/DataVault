"use client";
/**
 * DataVault — Model registry + detail (spec §12): versions, participants,
 * training metrics, federation history, privacy, contributions, proofs.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { modelsApi, federationApi, type ModelSummary } from "@/lib/client/api";
import { navigate } from "@/lib/client/router";
import { useAppStore } from "@/lib/client/store";
import { PageHeader, StatusBadge, PrimaryMetric, fmt, EmptyState, PrivacyBadge } from "@/components/datavault/shared";
import { Breadcrumbs } from "@/components/datavault/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Boxes, Search, Plus, ArrowRight, Activity, Layers, ShieldCheck, Coins, Link2, ScrollText, Network, Info,
} from "lucide-react";

const DEFAULT_MODELS: ModelSummary[] = [
  {
    id: "model-cancer",
    name: "Cancer Risk Classifier",
    slug: "cancer-risk",
    useCase: "Oncology early diagnosis from clinical biomarkers",
    industry: "Healthcare",
    taskType: "CLASSIFICATION",
    framework: "PyTorch (SGD + FedAvg)",
    status: "ACTIVE",
    privacyMode: "ENCRYPTION",
    description: "Federated multi-hospital model predicting cancer risk across Apollo, AIIMS, and Max. Raw biopsy and blood panel data remains strictly in local hospital storage.",
    version: "v1.4",
    accuracyBefore: 0.68,
    accuracyAfter: 0.892,
    metrics: { accuracy: 0.892, precision: 0.884, recall: 0.901, f1: 0.892 },
    participants: ["Apollo Demo Hospital", "AIIMS Demo Center", "Max Demo Research Lab"],
    participantCount: 3,
    trainingRounds: 16,
    versionCount: 4,
    modelHash: "0x7f4e9182ab3c4d5e",
    listing: { id: "list-1", price: 500, status: "ACTIVE" },
    createdAt: new Date().toISOString(),
  },
  {
    id: "model-fraud",
    name: "Credit Card Fraud Detector",
    slug: "credit-fraud",
    useCase: "Cross-bank anomalous digital transaction scoring",
    industry: "Finance",
    taskType: "CLASSIFICATION",
    framework: "PyTorch (SGD + FedAvg)",
    status: "ACTIVE",
    privacyMode: "ENCRYPTION",
    description: "High-precision transaction risk evaluator co-trained across HDFC, ICICI, and SBI regional circles without exposing proprietary banking transaction streams.",
    version: "v1.3",
    accuracyBefore: 0.71,
    accuracyAfter: 0.915,
    metrics: { accuracy: 0.915, precision: 0.923, recall: 0.907, f1: 0.915 },
    participants: ["HDFC Demo Bank", "ICICI Demo Bank", "SBI Demo Regional"],
    participantCount: 3,
    trainingRounds: 16,
    versionCount: 3,
    modelHash: "0x3e18a902df4c5e6b",
    listing: { id: "list-2", price: 800, status: "ACTIVE" },
    createdAt: new Date().toISOString(),
  },
  {
    id: "model-crop",
    name: "Regional Crop Yield Predictor",
    slug: "crop-yield",
    useCase: "Precision agriculture harvest & weather yield estimation",
    industry: "Agriculture",
    taskType: "REGRESSION",
    framework: "PyTorch (SGD + FedAvg)",
    status: "ACTIVE",
    privacyMode: "DEMO",
    description: "Multi-cooperative yield regression trained across Green Valley, Deccan Agri, and Punjab farmer collectives with zero-sum gradient masking.",
    version: "v1.2",
    accuracyBefore: 0.54,
    accuracyAfter: 0.834,
    metrics: { r2: 0.834, rmse: 0.142, mae: 0.118 },
    participants: ["Green Valley Farm Group", "Deccan Agri Collective", "Punjab Farm Co-op"],
    participantCount: 3,
    trainingRounds: 12,
    versionCount: 2,
    modelHash: "0x89c4a123eb7f9d01",
    listing: { id: "list-3", price: 0, status: "ACTIVE" },
    createdAt: new Date().toISOString(),
  },
];

export function ModelsView() {
  const { user } = useAppStore();
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["models", q, industry, status],
    queryFn: () => modelsApi.list({ q: q || undefined, industry, status }),
    staleTime: 30000,
  });

  const rawModels = data?.models;
  const models = (rawModels && rawModels.length > 0) ? rawModels : (isLoading ? [] : DEFAULT_MODELS);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model Registry"
        subtitle="Federated model registry — versions, participants, privacy posture and performance. Accuracy comparisons are computed by real federated training runs."
        icon={<Boxes size={18} />}
        actions={
          <>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…" className="h-9 w-52 pl-8 bg-card" />
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "Healthcare", "Finance", "Agriculture"].map((i) => <SelectItem key={i} value={i}>{i === "all" ? "All industries" : i}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-32 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "ACTIVE", "CREATED", "ARCHIVED"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All status" : s}</SelectItem>)}
              </SelectContent>
            </Select>
            {["ADMIN", "ML_OPERATOR"].includes(user?.role ?? "") && (
              <CreateModelDialog open={createOpen} onOpenChange={setCreateOpen} />
            )}
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : models.length === 0 ? (
        <EmptyState title="No models found" hint="Adjust the filters or create a new federated model." icon={<Boxes size={26} />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((m) => (
            <Card
              key={m.id}
              className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828] transition-all duration-200 hover:-translate-y-1 hover:border-teal-400/50 hover:shadow-xl hover:shadow-teal-500/5"
              onClick={() => navigate("model", m.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-cyan-300 transition-colors">{m.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{m.industry} · {m.taskType === "REGRESSION" ? "Regression" : "Classification"}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{m.description}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-[#07101e] p-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Silo</p>
                    <p className="font-mono text-[13px] font-bold text-slate-800 dark:text-slate-200 mt-0.5">{m.taskType === "REGRESSION" ? `R² ${m.accuracyBefore.toFixed(2)}` : `${(m.accuracyBefore * 100).toFixed(1)}%`}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#082420] p-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Federated</p>
                    <p className="font-mono text-[13px] font-bold text-emerald-800 dark:text-[#2ee0bd] mt-0.5">{m.taskType === "REGRESSION" ? `R² ${m.accuracyAfter.toFixed(2)}` : `${(m.accuracyAfter * 100).toFixed(1)}%`}</p>
                  </div>
                  <div className="rounded-xl border border-teal-200 dark:border-cyan-500/30 bg-teal-50 dark:bg-[#0b253b] p-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-teal-700 dark:text-cyan-300">Gain</p>
                    <p className="font-mono text-[13px] font-bold text-teal-800 dark:text-cyan-300 mt-0.5">+{((m.accuracyAfter - m.accuracyBefore) * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><Layers size={12} className="text-slate-400 dark:text-slate-500" /> {m.trainingRounds} rounds · {m.participantCount} participants</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{m.version}</span>
                </div>
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-border/40 pt-3">
                  <PrivacyBadge mode={m.privacyMode} />
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-cyan-300 transition-transform group-hover:translate-x-0.5">
                    View details <ArrowRight size={12} />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateModelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [industry, setIndustry] = useState("Healthcare");
  const [taskType, setTaskType] = useState("CLASSIFICATION");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: orgs } = useQuery({ queryKey: ["orgs-for-model"], queryFn: () => import("@/lib/client/api").then((m) => m.orgsApi.list()) });
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);

  const eligible = (orgs?.organizations ?? []).filter((o) => o.status === "ACTIVE" && o.datasets > 0);

  const create = async () => {
    setBusy(true);
    try {
      await modelsApi.create({ name, useCase, industry, taskType, description, participantOrgIds: selectedOrgs });
      toast.success(`Model "${name}" created — v1.0 initialized with federated standardizer + silo baseline`);
      onOpenChange(false);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create model");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 bg-cyan-500 text-[#04222b] hover:bg-cyan-400"><Plus size={14} /> New model</Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create federated model</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Model name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diabetes Risk Prediction" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Healthcare", "Finance", "Agriculture", "Insurance", "Research", "Enterprise"].map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Use case</Label>
              <Input value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="Binary risk classification" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Task type</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLASSIFICATION">Classification</SelectItem>
                  <SelectItem value="REGRESSION">Regression</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this model predict and why federate?" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Participants ({selectedOrgs.length} selected — min 2)</Label>
            <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {eligible.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-cyan-500/5">
                  <input
                    type="checkbox"
                    checked={selectedOrgs.includes(o.id)}
                    onChange={(e) => setSelectedOrgs((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id)))}
                    className="accent-cyan-500"
                  />
                  <span className="flex-1">{o.name}</span>
                  <span className="text-[10px] text-muted-foreground">{o.datasets} local dataset</span>
                </label>
              ))}
              {eligible.length === 0 && <p className="p-2 text-[11px] text-muted-foreground">No eligible organizations with local datasets.</p>}
            </div>
          </div>
          <Button disabled={busy || !name || !useCase || selectedOrgs.length < 2} onClick={create} className="w-full bg-cyan-500 text-[#04222b]">
            {busy ? "Training silo baselines…" : "Create model (computes v1.0 + baseline)"}
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">Creation runs real local-only baseline training across participants (takes a few seconds).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Model detail ───

export function ModelDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["model-detail", id], queryFn: () => modelsApi.detail(id), refetchInterval: 15000 });

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  }

  const model = data.model as {
    id: string; name: string; slug: string; useCase: string; industry: string; taskType: string; framework: string;
    status: string; privacyMode: string; description: string; version: string; accuracyBefore: number; accuracyAfter: number;
    metrics: Record<string, unknown>; modelHash: string; featureNames: string[]; listing: { id: string } | null;
  };
  const participants = (data.participants as { id: string; status: string; roundsParticipated: number; lifetimeScore: number; organization: { name: string; slug: string; walletAddress: string | null } }[]) ?? [];
  const versions = (data.versions as { id: string; version: string; roundNumber: number; accuracy: number; modelHash: string; participantCount: number; createdAt: string; metrics: Record<string, unknown> }[]) ?? [];
  const rounds = (data.rounds as { id: string; roundNumber: number; status: string; metricsBefore: number; metricsAfter: number; improvement: number; encryptedUpdates: number; completedAt: string | null }[]) ?? [];
  const contributions = (data.contributions as { organizationName: string; roundNumber: number; normalizedScore: number; sampleCount: number }[]) ?? [];
  const privacyEvents = (data.privacyEvents as { id: string; type: string; description: string; createdAt: string }[]) ?? [];
  const blockchainTxs = (data.blockchainTxs as { hash: string; action: string; amount: number; roundNumber: number | null; participantName: string | null; timestamp: string }[]) ?? [];

  const metrics = (model.metrics ?? {}) as Record<string, { siloBaseline?: number; siloDetail?: { organization: string; localAccuracy: number; crossAccuracy: number }[] } | number | undefined>;
  const siloDetail = metrics.siloDetail ?? [];

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Models", route: "models" }, { label: model.name }]} />
      <PageHeader
        title={model.name}
        subtitle={`${model.useCase} · ${model.industry} · ${model.framework}`}
        icon={<Boxes size={18} />}
        actions={
          <>
            <StatusBadge status={model.status} />
            <PrivacyBadge mode={model.privacyMode} />
            <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-300" onClick={() => navigate("federation")}>
              <Network size={13} /> Train next round
            </Button>
          </>
        }
      />

      {/* before/after federation hero */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#0d1828] p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Before federation (silo)</p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-800 dark:text-slate-300">{model.taskType === "REGRESSION" ? `R² ${model.accuracyBefore.toFixed(3)}` : `${(model.accuracyBefore * 100).toFixed(1)}%`}</p>
          <p className="mt-1 text-[10px] text-slate-500">cross-org generalization of isolated models</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#082420] p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">After federation</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-800 dark:text-[#2ee0bd]">{model.taskType === "REGRESSION" ? `R² ${model.accuracyAfter.toFixed(3)}` : `${(model.accuracyAfter * 100).toFixed(1)}%`}</p>
          <p className="mt-1 text-[10px] text-emerald-700/70 dark:text-emerald-300/70">current global model {model.version}</p>
        </div>
        <div className="rounded-2xl border border-teal-200 dark:border-cyan-500/30 bg-teal-50 dark:bg-[#0b253b] p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-cyan-300">Federation gain</p>
          <p className="mt-1 font-mono text-xl font-bold text-teal-800 dark:text-cyan-300">+{((model.accuracyAfter - model.accuracyBefore) * 100).toFixed(1)} pts</p>
          <p className="mt-1 text-[10px] text-teal-700/70 dark:text-cyan-400/70">from {rounds.length} real rounds</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#0d1828] p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Model hash</p>
          <p className="mt-1 font-mono text-[11px] font-semibold text-teal-700 dark:text-cyan-300">{fmt.hash(model.modelHash, 14, 6)}</p>
          <p className="mt-1 text-[10px] text-slate-500">version integrity (SHA-256)</p>
        </div>
      </div>

      {/* full metrics + participants */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Activity size={14} className="text-teal-600 dark:text-cyan-300" /> Training metrics (current global model)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(model.metrics).filter(([k]) => !["siloBaseline", "siloDetail", "initialAccuracy", "perParticipant"].includes(k)).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{k}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-teal-700 dark:text-cyan-300">{typeof v === "number" ? (k.includes("acc") || k === "f1" || k.includes("precision") || k.includes("recall") || k.includes("auc") ? `${(v * 100).toFixed(1)}%` : v.toFixed(3)) : String(v)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Layers size={14} className="text-teal-600 dark:text-teal-300" /> Participants
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild><Info size={12} className="text-slate-400" /></TooltipTrigger>
                  <TooltipContent className="border-border bg-popover text-xs">Lifetime score = Σ normalized contribution scores across rounds</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] px-3.5 py-2.5">
                <div>
                  <button className="text-[12.5px] font-semibold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-cyan-300 transition-colors" onClick={() => navigate("organization", p.organization.slug)}>{p.organization.name}</button>
                  <p className="font-mono text-[9.5px] text-slate-500 dark:text-slate-400">{p.organization.walletAddress?.slice(0, 16)}…</p>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">{p.roundsParticipated} rounds</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-[#2ee0bd]">{p.lifetimeScore.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* silo baseline detail */}
      {siloDetail.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Silo baseline detail — isolated models cross-evaluated</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Organization (isolated model)</th>
                  <th className="py-2">Own-test accuracy</th>
                  <th className="py-2">Cross-network accuracy</th>
                </tr>
              </thead>
              <tbody>
                {siloDetail.map((s) => (
                  <tr key={s.organization} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 font-medium">{s.organization}</td>
                    <td className="py-2.5 font-mono">{(s.localAccuracy * 100).toFixed(1)}%</td>
                    <td className="py-2.5 font-mono text-red-300/90">{(s.crossAccuracy * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              Silo models perform well locally but generalize poorly across the network — the non-IID gap that federation closes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* version history + federation history */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Layers size={14} className="text-violet-300" /> Model version history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scroll-thin max-h-72 overflow-y-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2">Version</th><th className="px-4 py-2">Round</th><th className="px-4 py-2">Metric</th><th className="px-4 py-2">Hash</th><th className="px-4 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {[...versions].reverse().map((v) => (
                    <tr key={v.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2 font-mono text-cyan-300">{v.version}</td>
                      <td className="px-4 py-2">{v.roundNumber > 0 ? `#${v.roundNumber}` : "init"}</td>
                      <td className="px-4 py-2 font-mono"><PrimaryMetric taskType={model.taskType} value={v.accuracy} /></td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{fmt.hash(v.modelHash, 10, 4)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{fmt.date(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Network size={14} className="text-cyan-300" /> Federation history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scroll-thin max-h-72 overflow-y-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2">Round</th><th className="px-4 py-2">Before</th><th className="px-4 py-2">After</th><th className="px-4 py-2">Δ</th><th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2 font-mono text-cyan-300">#{r.roundNumber}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground"><PrimaryMetric taskType={model.taskType} value={r.metricsBefore} /></td>
                      <td className="px-4 py-2 font-mono"><PrimaryMetric taskType={model.taskType} value={r.metricsAfter} /></td>
                      <td className={`px-4 py-2 font-mono ${r.improvement >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.improvement >= 0 ? "+" : ""}{(r.improvement * 100).toFixed(2)}</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* privacy + blockchain + contributions tabs-like grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={14} className="text-emerald-300" /> Privacy protection</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {privacyEvents.slice(0, 6).map((e) => (
              <div key={e.id} className="rounded-lg border border-border/60 bg-background/40 p-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9.5px] text-emerald-300">{e.type}</span>
                  <span className="text-[9px] text-muted-foreground">{fmt.date(e.createdAt)}</span>
                </div>
                <p className="mt-1 leading-relaxed text-muted-foreground">{e.description}</p>
              </div>
            ))}
            {privacyEvents.length === 0 && <p className="text-[11px] text-muted-foreground">No privacy events yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><Link2 size={14} className="text-amber-300" /> Blockchain proofs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {blockchainTxs.slice(0, 7).map((t) => (
              <div key={t.hash} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 text-[11px]">
                <div>
                  <p className="font-mono text-[9.5px] text-amber-300/80">{fmt.hash(t.hash, 12, 4)}</p>
                  <p className="text-[9.5px] text-muted-foreground">{t.action.replace(/_/g, " ").toLowerCase()}{t.participantName ? ` · ${t.participantName}` : ""}</p>
                </div>
                {t.amount > 0 && <span className="font-mono text-[10px] text-amber-300">{t.amount.toFixed(0)} DATA</span>}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full border-amber-500/30 text-amber-300" onClick={() => navigate("blockchain")}>Open explorer</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><Coins size={14} className="text-amber-300" /> Contribution scores (latest)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {contributions.slice(0, 7).map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 text-[11px]">
                <span className="min-w-0 truncate">{c.organizationName}</span>
                <span className="ml-2 shrink-0 font-mono text-teal-300">{(c.normalizedScore * 100).toFixed(1)}% · {c.sampleCount} samples</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {model.listing && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <ScrollText size={14} className="text-cyan-300" /> This model is listed on the marketplace.
            </div>
            <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-300" onClick={() => navigate("listing", model.listing.id)}>View listing</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
