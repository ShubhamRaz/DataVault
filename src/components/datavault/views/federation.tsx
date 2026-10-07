"use client";
/**
 * DataVault — Federated training UI (spec §13, §32) — the core demo screen.
 * Live network visualization + real-time SSE event stream + round controls.
 * All state transitions originate from actual backend training events.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { federationApi, type FederationNetwork, type FederationRoundSummary } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { navigate } from "@/lib/client/router";
import { PageHeader, StatusBadge, PrimaryMetric, fmt, EmptyState, PrivacyBadge } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Network, Play, Loader2, Lock, Upload, ShieldCheck, Boxes, Coins, Link2,
  ArrowRight, RefreshCw, Radio, Layers, Sparkles,
} from "lucide-react";

interface LiveEvent {
  type: string;
  roundId?: string;
  roundNumber?: number;
  modelName?: string;
  participantId?: string;
  participantName?: string;
  progress?: number;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

type ParticipantPhase = "idle" | "distributed" | "training" | "generated" | "encrypting" | "submitted" | "done";

const PHASES = [
  { key: "ROUND_STARTED", label: "Round Started", icon: <Play size={13} /> },
  { key: "MODEL_DISTRIBUTED", label: "Model Distributed", icon: <Boxes size={13} /> },
  { key: "PARTICIPANT_TRAINING", label: "Local Training", icon: <Layers size={13} /> },
  { key: "LOCAL_UPDATE_GENERATED", label: "Update Generated", icon: <ArrowRight size={13} /> },
  { key: "UPDATE_ENCRYPTED", label: "Encrypting", icon: <Lock size={13} /> },
  { key: "UPDATE_SUBMITTED", label: "Uploading Update", icon: <Upload size={13} /> },
  { key: "SECURE_AGGREGATION", label: "Secure Aggregation", icon: <ShieldCheck size={13} /> },
  { key: "GLOBAL_MODEL_UPDATED", label: "Global Model Updated", icon: <Network size={13} /> },
  { key: "REWARD_CALCULATED", label: "Reward Calculation", icon: <Coins size={13} /> },
  { key: "BLOCKCHAIN_RECORDED", label: "Blockchain Recording", icon: <Link2 size={13} /> },
  { key: "ROUND_COMPLETED", label: "Training Complete", icon: <Sparkles size={13} /> },
];

const PHASE_MAP: Record<string, number> = {
  ROUND_STARTED: 0, MODEL_DISTRIBUTED: 1, PARTICIPANT_TRAINING: 2, LOCAL_UPDATE_GENERATED: 3,
  UPDATE_ENCRYPTED: 4, UPDATE_SUBMITTED: 5, SECURE_AGGREGATION: 6, GLOBAL_MODEL_UPDATED: 7,
  REWARD_CALCULATED: 8, BLOCKCHAIN_RECORDED: 9, ROUND_COMPLETED: 10,
};

export function FederationView() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const { data: fed, isLoading: fedLoading } = useQuery({
    queryKey: ["fed-status"],
    queryFn: federationApi.status,
    refetchInterval: 6000,
  });
  const { data: roundsData } = useQuery({
    queryKey: ["fed-rounds"],
    queryFn: () => federationApi.rounds({ take: "14" }),
    refetchInterval: 10000,
  });

  const networks = fed?.networks ?? [];
  const [modelId, setModelId] = useState<string>("");
  const [privacyMode, setPrivacyMode] = useState<"DEMO" | "ENCRYPTION">("DEMO");
  const [roundsToRun, setRoundsToRun] = useState("1");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [livePhase, setLivePhase] = useState(-1);
  const [running, setRunning] = useState(false);
  const [participantStates, setParticipantStates] = useState<Record<string, { phase: ParticipantPhase; progress: number }>>({});
  const [roundDetailId, setRoundDetailId] = useState<string | null>(null);
  const eventsRef = useRef<HTMLDivElement>(null);

  const effectiveModelId = modelId || networks[0]?.modelId || "";
  const selected = networks.find((n) => n.modelId === effectiveModelId) ?? networks[0];

  // ── SSE subscription ──
  useEffect(() => {
    const es = new EventSource("/api/federation/events");
    es.onmessage = (msg) => {
      try {
        const e = JSON.parse(msg.data) as LiveEvent;
        if (e.type === "STREAM_CONNECTED") return;
        setEvents((prev) => [...prev.slice(-199), e]);
        const phaseIdx = PHASE_MAP[e.type];
        if (phaseIdx !== undefined) setLivePhase(phaseIdx);
        if (e.participantId) {
          setParticipantStates((prev) => {
            const cur = prev[e.participantId!] ?? { phase: "idle", progress: 0 };
            let next: ParticipantPhase = cur.phase;
            switch (e.type) {
              case "MODEL_DISTRIBUTED": next = "distributed"; break;
              case "PARTICIPANT_TRAINING": next = "training"; break;
              case "LOCAL_UPDATE_GENERATED": next = "generated"; break;
              case "UPDATE_ENCRYPTED": next = "encrypting"; break;
              case "UPDATE_SUBMITTED": next = "submitted"; break;
            }
            return { ...prev, [e.participantId!]: { phase: next, progress: e.type === "PARTICIPANT_TRAINING" ? (e.progress ?? cur.progress) : cur.progress } };
          });
        }
        if (e.type === "ROUND_COMPLETED" || e.type === "ROUND_FAILED") {
          setRunning(false);
          queryClient.invalidateQueries({ queryKey: ["fed-rounds"] });
          queryClient.invalidateQueries({ queryKey: ["fed-status"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["recent-rounds"] });
          if (e.type === "ROUND_COMPLETED") toast.success(e.message);
          else toast.error(e.message);
        }
      } catch {
        // ignore malformed frames
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [queryClient]);

  // auto-scroll event log
  useEffect(() => {
    if (eventsRef.current) eventsRef.current.scrollTop = eventsRef.current.scrollHeight;
  }, [events.length, running]);

  const startRound = useCallback(async () => {
    if (!effectiveModelId || running) return;
    setRunning(true);
    setParticipantStates({});
    setLivePhase(-1);
    try {
      const numRounds = Number(roundsToRun);
      await federationApi.start({
        modelId: effectiveModelId,
        rounds: numRounds,
        privacyMode,
        pacingMs: numRounds > 1 ? 220 : 420,
        epochs: 5,
      });
      await queryClient.invalidateQueries({ queryKey: ["fed-rounds"] });
      await queryClient.invalidateQueries({ queryKey: ["fed-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start round");
      setRunning(false);
    }
  }, [effectiveModelId, running, roundsToRun, privacyMode, queryClient]);

  if (fedLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      </div>
    );
  }

  if (!networks.length) {
    return (
      <div className="space-y-4">
        <PageHeader title="Federated Training" subtitle="No federated models yet." icon={<Network size={18} />} />
        <EmptyState
          title="No models registered"
          hint="Initialize the demo network from Admin → Demo Controls, or create a model from the Models page."
          icon={<Boxes size={28} />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Federated Training"
        subtitle="Run a real federated round: the global model is distributed, participants train locally, only protected updates travel. Watch every phase live."
        icon={<Network size={18} />}
        actions={
          <>
            <Select value={effectiveModelId} onValueChange={setModelId}>
              <SelectTrigger className="h-9 w-56 bg-card"><SelectValue placeholder="Select model" /></SelectTrigger>
              <SelectContent>
                {networks.map((n) => (
                  <SelectItem key={n.modelId} value={n.modelId}>
                    {n.modelName} · {n.participants.length} participants
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={running}
              onClick={startRound}
              className="h-9 bg-cyan-500 font-semibold text-[#04222b] hover:bg-cyan-400"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? "Round in progress…" : roundsToRun === "1" ? "Start Federated Round" : `Run ${roundsToRun} Rounds`}
            </Button>
          </>
        }
      />

      {/* Model summary + controls */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{selected?.modelName}</p>
              <StatusBadge status={running ? "RUNNING" : selected?.status ?? "ACTIVE"} />
              <PrivacyBadge mode={privacyMode} />
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{selected?.version}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12px]">
              <span className="text-muted-foreground">Silo baseline <span className="font-mono text-foreground">{selected?.taskType === "REGRESSION" ? `R² ${selected?.baselineAccuracy.toFixed(3)}` : `${((selected?.baselineAccuracy ?? 0) * 100).toFixed(1)}%`}</span></span>
              <span className="text-muted-foreground">Federated <span className="font-mono text-emerald-400">{selected?.taskType === "REGRESSION" ? `R² ${selected?.currentAccuracy.toFixed(3)}` : `${((selected?.currentAccuracy ?? 0) * 100).toFixed(1)}%`}</span></span>
              <span className="font-mono text-[10px] text-emerald-400">
                +{(((selected?.currentAccuracy ?? 0) - (selected?.baselineAccuracy ?? 0)) * 100).toFixed(1)} pts from federation
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">Rounds</Label>
              <Select value={roundsToRun} onValueChange={setRoundsToRun} disabled={running}>
                <SelectTrigger className="h-8 w-16 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1", "3", "5"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="privacy-mode" checked={privacyMode === "ENCRYPTION"} onCheckedChange={(v) => setPrivacyMode(v ? "ENCRYPTION" : "DEMO")} disabled={running} />
              <div>
                <Label htmlFor="privacy-mode" className="text-[11px]">{privacyMode === "ENCRYPTION" ? "ENCRYPTION (AES-256-GCM)" : "DEMO (masked)"}</Label>
                <p className="text-[9px] text-muted-foreground">both modes use zero-sum secure aggregation</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        {/* Network visualization */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Network size={15} className="text-cyan-300" /> Live network
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal text-muted-foreground">
                <Radio size={11} className={running ? "text-cyan-300 animate-pulse" : "text-muted-foreground"} />
                {running ? "streaming live events" : "idle — start a round"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NetworkDiagram
              network={selected}
              participantStates={participantStates}
              running={running}
            />
          </CardContent>
        </Card>

        {/* Event stream */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Radio size={15} className={running ? "animate-pulse text-cyan-300" : "text-muted-foreground"} /> Live event stream
              <span className="ml-auto font-mono text-[10px] font-normal text-muted-foreground">{events.length} events</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <div ref={eventsRef} className="scroll-thin h-80 overflow-y-auto border-t border-border/60 bg-background/40 px-3 py-2 font-mono text-[11px] leading-relaxed">
              {events.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">Waiting for federation events… start a round to begin.</p>
              )}
              <AnimatePresence initial={false}>
                {events.slice(-80).map((e, i) => (
                  <motion.div
                    key={`${e.timestamp}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2 border-b border-border/30 py-1 last:border-0"
                  >
                    <span className="shrink-0 text-muted-foreground/60">{new Date(e.timestamp).toLocaleTimeString("en-IN", { hour12: false })}</span>
                    <span className={`shrink-0 font-semibold ${eventColor(e.type)}`}>{e.type}</span>
                    <span className="min-w-0 flex-1 text-foreground/80">{e.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phase timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Round phases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 lg:grid-cols-11">
            {PHASES.map((p, i) => {
              const active = running && livePhase === i;
              const done = (running && livePhase > i) || (!running && livePhase >= 0 && livePhase >= i && events.length > 0 && events[events.length - 1]?.type === "ROUND_COMPLETED" && livePhase >= i);
              return (
                <div
                  key={p.key}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all ${
                    active
                      ? "border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                      : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span className={active ? "text-cyan-300" : done ? "text-emerald-400" : "text-muted-foreground/50"}>{p.icon}</span>
                  <span className="text-[9.5px] font-medium leading-tight">{p.label}</span>
                  {done && !active && <span className="text-[8px] text-emerald-400">✓</span>}
                  {active && <span className="pulse-dot h-1 w-1 rounded-full bg-cyan-300" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Round history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers size={15} className="text-cyan-300" /> Round history
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">click a round for details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {roundsData?.rounds?.length ? (
            <div className="scroll-thin max-h-96 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Round</th>
                    <th className="px-4 py-2.5">Model</th>
                    <th className="px-4 py-2.5">Before</th>
                    <th className="px-4 py-2.5">After</th>
                    <th className="px-4 py-2.5">Δ</th>
                    <th className="px-4 py-2.5">Contributions</th>
                    <th className="px-4 py-2.5">Rewards</th>
                    <th className="px-4 py-2.5">Mode</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roundsData.rounds.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setRoundDetailId(r.id)}
                      className="cursor-pointer border-b border-border/40 transition-colors hover:bg-cyan-500/5"
                    >
                      <td className="px-4 py-2.5 font-mono text-cyan-300">#{r.roundNumber}</td>
                      <td className="px-4 py-2.5">{r.model.name}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground"><PrimaryMetric taskType={r.model.taskType} value={r.metricsBefore} /></td>
                      <td className="px-4 py-2.5 font-mono"><PrimaryMetric taskType={r.model.taskType} value={r.metricsAfter} /></td>
                      <td className={`px-4 py-2.5 font-mono ${r.improvement >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.improvement >= 0 ? "+" : ""}{(r.improvement * 100).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.contributions.length} scored</td>
                      <td className="px-4 py-2.5 font-mono text-amber-300">{r.rewards.reduce((s, w) => s + w.amount, 0).toFixed(0)} DATA</td>
                      <td className="px-4 py-2.5"><PrivacyBadge mode={r.encryptedUpdates > 0 ? "ENCRYPTION" : "DEMO"} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No rounds yet" hint="Start your first federated round above." icon={<Network size={22} />} />
          )}
        </CardContent>
      </Card>

      {/* Demo storyline guide */}
      <DemoStoryline running={running} phase={livePhase} />

      <RoundDetailSheet roundId={roundDetailId} onClose={() => setRoundDetailId(null)} />
    </div>
  );
}

// ─── Network diagram ───

function NetworkDiagram({
  network,
  participantStates,
  running,
}: {
  network?: FederationNetwork;
  participantStates: Record<string, { phase: ParticipantPhase; progress: number }>;
  running: boolean;
}) {
  if (!network) return null;
  const parts = network.participants;
  const angles = parts.map((_, i) => (2 * Math.PI * i) / parts.length - Math.PI / 2);
  const cx = 50, cy = 46, rx = 33, ry = 30;

  const phaseLabel: Record<ParticipantPhase, string> = {
    idle: "Ready",
    distributed: "Model received",
    training: "Local training",
    generated: "Update generated",
    encrypting: "Encrypting update",
    submitted: "Update submitted",
    done: "Complete",
  };

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="grid-bg absolute inset-0 opacity-40" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 62">
        {parts.map((p, i) => {
          const x = cx + rx * Math.cos(angles[i]);
          const y = cy + ry * Math.sin(angles[i]);
          const state = participantStates[p.id]?.phase ?? "idle";
          const active = running && (state === "training" || state === "encrypting" || state === "submitted");
          return (
            <g key={p.id}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={active ? "rgba(34,211,238,0.7)" : "rgba(34,211,238,0.25)"} strokeWidth={active ? 0.6 : 0.35} className={active ? "dash-flow" : ""} />
            </g>
          );
        })}
      </svg>

      {/* center global model */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
        <div className={`rounded-xl border px-4 py-2.5 text-center transition-all ${running ? "border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_36px_rgba(34,211,238,0.35)]" : "border-cyan-500/40 bg-cyan-500/10"}`}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-cyan-300">Global Model</p>
          <p className="font-mono text-sm font-bold text-cyan-100">
            {network.taskType === "REGRESSION" ? `R² ${network.currentAccuracy.toFixed(3)}` : `${(network.currentAccuracy * 100).toFixed(1)}%`}
          </p>
          <p className="font-mono text-[8.5px] text-muted-foreground">{network.version} · hash on-chain</p>
        </div>
      </div>
      {/* aggregator */}
      <div className="absolute left-1/2 top-[70%] -translate-x-1/2">
        <div className="rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-center">
          <p className="text-[9px] font-semibold text-teal-200">🔒 Secure Aggregator</p>
          <p className="text-[7.5px] text-muted-foreground">zero-sum masks cancel · FedAvg</p>
        </div>
      </div>

      {/* participants */}
      {parts.map((p, i) => {
        const x = cx + rx * Math.cos(angles[i]);
        const y = cy + ry * Math.sin(angles[i]);
        const state = participantStates[p.id] ?? { phase: "idle" as ParticipantPhase, progress: 0 };
        const active = running && state.phase !== "idle";
        return (
          <div
            key={p.id}
            className="absolute w-32 -translate-x-1/2 -translate-y-1/2 sm:w-36"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className={`rounded-xl border bg-background/85 p-2.5 backdrop-blur transition-all ${active ? "border-cyan-400/50 shadow-[0_0_24px_rgba(34,211,238,0.2)]" : "border-border"}`}>
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-[10px] font-semibold text-foreground">{p.name}</p>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-cyan-400 pulse-dot" : "bg-emerald-400/70"}`} />
              </div>
              <p className="mt-0.5 truncate font-mono text-[8px] text-muted-foreground">{p.walletAddress?.slice(0, 8)}…</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-medium ${active ? "bg-cyan-500/20 text-cyan-200" : "bg-emerald-500/10 text-emerald-300/80"}`}>
                  {phaseLabel[state.phase]}
                </span>
                {state.phase === "training" && (
                  <span className="font-mono text-[8.5px] text-cyan-300">{state.progress ?? 0}%</span>
                )}
              </div>
              {state.phase === "training" && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all" style={{ width: `${state.progress ?? 0}%` }} />
                </div>
              )}
              <p className="mt-1 text-[7.5px] text-muted-foreground">🛡 local data · {p.roundsParticipated} rounds · score {p.lifetimeScore.toFixed(2)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Demo storyline (spec §32) ───

const STORY = [
  "Three hospitals join a privacy-preserving network",
  "The global AI model is distributed",
  "Each hospital trains locally",
  "Raw patient data remains local",
  "Model updates are encrypted",
  "Secure aggregation creates the new model",
  "The model improves",
  "Contributions are scored",
  "Blockchain records contributions",
  "Rewards are distributed",
];

function DemoStoryline({ running, phase }: { running: boolean; phase: number }) {
  // map live phase → story step (steps 2..9 map to phases 1..8, completion → 10)
  const activeStep = running
    ? phase <= 0 ? 0 : phase >= 10 ? 10 : Math.min(10, phase + 1)
    : -1;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-cyan-300" /> DataVault Federated AI Demo — guided storyline
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">{running ? "follow the highlighted step" : "starts when a round runs"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STORY.map((step, i) => {
            const n = i + 1;
            const active = activeStep === n || (running && activeStep > n && n === 10);
            const completed = running && activeStep > n;
            return (
              <div
                key={n}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
                  active ? "border-cyan-400/60 bg-cyan-500/15" : completed ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-card"
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? "bg-cyan-400 text-[#04222b]" : completed ? "bg-emerald-500/30 text-emerald-300" : "bg-muted text-muted-foreground"
                }`}>
                  {completed ? "✓" : n}
                </span>
                <p className={`text-[10.5px] leading-tight ${active ? "text-cyan-100" : completed ? "text-emerald-200/80" : "text-muted-foreground"}`}>{step}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Round detail sheet ───

function RoundDetailSheet({ roundId, onClose }: { roundId: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["round-detail", roundId],
    queryFn: () => federationApi.roundDetail(roundId!),
    enabled: !!roundId,
  });

  const round = data?.round as Record<string, unknown> | undefined;
  const updates = (data?.updates ?? []) as Record<string, unknown>[];
  const contributions = (data?.contributions ?? []) as Record<string, unknown>[];
  const rewards = (data?.rewards ?? []) as Record<string, unknown>[];
  const model = round?.model as { name: string; taskType: string } | undefined;

  return (
    <Sheet open={!!roundId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Network size={16} className="text-cyan-300" />
            Round #{round?.roundNumber as number} — {model?.name}
            {round && <StatusBadge status={round.status as string} />}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-8">
          {/* metrics */}
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Before" value={round ? (model?.taskType === "REGRESSION" ? `R² ${(round.metricsBefore as number).toFixed(3)}` : `${((round.metricsBefore as number) * 100).toFixed(1)}%`) : "—"} />
            <Metric label="After" value={round ? (model?.taskType === "REGRESSION" ? `R² ${(round.metricsAfter as number).toFixed(3)}` : `${((round.metricsAfter as number) * 100).toFixed(1)}%`) : "—"} highlight />
            <Metric label="Improvement" value={round ? `${(round.improvement as number) >= 0 ? "+" : ""}${((round.improvement as number) * 100).toFixed(2)} pts` : "—"} />
          </div>

          {/* per-participant table */}
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Participant training runs & protected updates</p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Participant</th>
                    <th className="px-3 py-2">Samples</th>
                    <th className="px-3 py-2">Update hash</th>
                    <th className="px-3 py-2">Protection</th>
                    <th className="px-3 py-2">Local metrics</th>
                  </tr>
                </thead>
                <tbody>
                  {updates.map((u) => (
                    <tr key={u.id as string} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 font-medium">{u.organizationName as string}</td>
                      <td className="px-3 py-2 font-mono">{u.sampleCount as number}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-cyan-300">{fmt.hash(u.updateHash as string, 12, 4)}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px]">{(u.encrypted as boolean) ? "🔒 AES-256-GCM + mask" : "zero-sum mask"}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {Object.entries((u.metrics as Record<string, number>) ?? {}).slice(0, 3).map(([k, v]) => `${k} ${typeof v === "number" ? v.toFixed(3) : v}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* contributions */}
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Contribution scores & rewards</p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Organization</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Quality</th>
                    <th className="px-3 py-2">Improvement</th>
                    <th className="px-3 py-2">Reward</th>
                    <th className="px-3 py-2">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c, i) => {
                    const reward = rewards[i] as Record<string, unknown> | undefined;
                    return (
                      <tr key={c.id as string} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 font-medium">{c.organizationName as string}</td>
                        <td className="px-3 py-2 font-mono text-cyan-300">{((c.normalizedScore as number) * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2 font-mono">{((c.qualityScore as number) * 100).toFixed(0)}%</td>
                        <td className="px-3 py-2 font-mono">{((c.improvementScore as number) * 100).toFixed(0)}%</td>
                        <td className="px-3 py-2 font-mono text-amber-300">{(reward?.amount as number)?.toFixed(0)} DATA</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-amber-300/70">{fmt.hash(reward?.txHash as string, 10, 4)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={() => navigate("blockchain")} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-[12px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20">
            <Link2 size={13} /> View proofs on the blockchain explorer
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-card"}`}>
      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${highlight ? "text-emerald-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function eventColor(type: string): string {
  if (type.includes("COMPLETED") || type.includes("UPDATED")) return "text-emerald-400";
  if (type.includes("ENCRYPTED")) return "text-violet-300";
  if (type.includes("BLOCKCHAIN")) return "text-amber-300";
  if (type.includes("REWARD")) return "text-amber-300";
  if (type.includes("TRAINING")) return "text-cyan-300";
  if (type.includes("FAILED")) return "text-red-400";
  return "text-cyan-200";
}
