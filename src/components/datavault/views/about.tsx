"use client";
/**
 * DataVault — Architecture & About page (public, spec §9, §44, §55).
 */
import { navigate } from "@/lib/client/router";
import { Button } from "@/components/ui/button";
import { Vault, Network, Lock, Coins, ArrowDown, Play, ShieldCheck, Building2, Landmark, Wheat, Globe, Server, Database, ScrollText } from "lucide-react";

export function AboutView() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate("landing")} className="flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 p-1.5">
              <Vault size={18} className="text-[#04222b]" />
            </div>
            <p className="text-[15px] font-semibold tracking-tight">DataVault</p>
          </button>
          <Button size="sm" className="bg-cyan-500 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("login")}>
            <Play size={13} /> Launch Demo
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Architecture</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy-First AI Collaboration Marketplace</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Three privacy layers — federated learning, privacy computing, and blockchain incentives —
            working end-to-end so organizations can train AI together without any raw-data transfer.
          </p>
        </div>

        {/* Full stack flow */}
        <section className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828] p-6 sm:p-8 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">End-to-end flow of a federated round</h2>
          <div className="mt-6 grid gap-3">
            {[
              { icon: <Building2 size={14} />, tone: "muted", label: "FRONTEND (Next.js 16) — role-based dashboards, live federation view, marketplace" },
              { icon: <Server size={14} />, tone: "cyan", label: "API GATEWAY / BACKEND — REST + SSE, JWT auth, RBAC, rate limiting" },
              { icon: <Network size={14} />, tone: "cyan", label: "FEDERATED LEARNING ORCHESTRATOR — round lifecycle, FedAvg, model registry & versioning" },
              { icon: <Database size={14} />, tone: "teal", label: "PARTICIPANT TRAINING ENVIRONMENTS — Hospital A · B · C (raw data physically local)" },
              { icon: <Lock size={14} />, tone: "violet", label: "ENCRYPTED MODEL UPDATES — pairwise zero-sum masks + AES-256-GCM (ENCRYPTION mode)" },
              { icon: <ShieldCheck size={14} />, tone: "cyan", label: "PRIVACY LAYER — secure aggregation (masks cancel), privacy events, raw-access guard" },
              { icon: <Server size={14} />, tone: "cyan", label: "SECURE AGGREGATOR — FedAvg weighted combination → new global model" },
              { icon: <Boxes />, tone: "muted", label: "GLOBAL MODEL REGISTRY — versions + SHA-256 model hashes" },
              { icon: <Coins size={14} />, tone: "amber", label: "BLOCKCHAIN REWARD ENGINE — contribution proofs, 1000 DATA pool per round" },
              { icon: <Globe size={14} />, tone: "amber", label: "BLOCKCHAIN NETWORK — local hash-chain ledger / DataVaultRewards.sol on EVM" },
            ].map((row, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-[12px] font-medium ${
                  row.tone === "cyan" ? "border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-[#0b253b] text-cyan-800 dark:text-cyan-200"
                  : row.tone === "teal" ? "border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-[#082420] text-teal-800 dark:text-[#2ee0bd]"
                  : row.tone === "violet" ? "border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-[#1a1438] text-violet-800 dark:text-violet-200"
                  : row.tone === "amber" ? "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-[#241c09] text-amber-800 dark:text-amber-200"
                  : "border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e] text-slate-700 dark:text-slate-300"
                }`}>
                  {row.icon}
                  {row.label}
                </div>
                {i < 9 && <ArrowDown size={13} className="my-1 text-cyan-400/50" />}
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-2 text-center text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e] py-2.5 font-mono">PostgreSQL / SQLite — 20+ entities</div>
            <div className="rounded-xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e] py-2.5 font-mono">Redis — production caching layer</div>
            <div className="rounded-xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e] py-2.5 font-mono">Audit hash-chain — tamper-evident trail</div>
          </div>
        </section>

        {/* The three layers */}
        <section className="grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: <Network size={20} />, title: "Layer 1 — Federated Learning",
              points: ["Global model distributed to participants each round", "Real local training (MLP + SGD on local data)", "Only weight deltas (updates) are produced", "FedAvg weighted aggregation, model versioning", "PyTorch engine in services/ml-service (production mode)"],
            },
            {
              icon: <Lock size={20} />, title: "Layer 2 — Privacy Computing",
              points: ["Pairwise zero-sum masks: Σ masks = 0 (exactly)", "Aggregator sees only masked vectors", "AES-256-GCM sealing in ENCRYPTION mode", "TenSEAL CKKS path in the Python service (spec §64)", "Privacy events + RAW_ACCESS_BLOCKED guard"],
            },
            {
              icon: <Coins size={20} />, title: "Layer 3 — Blockchain Incentives",
              points: ["SHA-256 hash-chained PoW ledger (Local Test Network)", "Contribution proofs + reward allocations on-chain", "Transparent scoring: 0.35/0.25/0.25/0.15 formula", "1000 DATA pool per round, claim transactions", "DataVaultRewards.sol for EVM deployment"],
            },
          ].map((layer) => (
            <div key={layer.title} className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828] p-6 shadow-sm">
              <div className="rounded-xl border border-teal-200 dark:border-cyan-500/30 bg-teal-50 dark:bg-[#0b253b] p-2.5 text-teal-700 dark:text-cyan-300 w-fit">{layer.icon}</div>
              <p className="mt-4 text-[15px] font-bold text-slate-900 dark:text-white">{layer.title}</p>
              <ul className="mt-3 space-y-2">
                {layer.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500 dark:bg-[#2ee0bd]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Sectors */}
        <section>
          <h2 className="text-center text-lg font-bold text-slate-900 dark:text-white">Designed for India&apos;s data ecosystem</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[13px] text-slate-600 dark:text-slate-400">
            Privacy-conscious collaborative AI for a data-rich but siloed ecosystem — healthcare, banking & finance,
            agriculture, insurance, research, government and enterprise.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <Building2 size={16} />, label: "Healthcare" },
              { icon: <Landmark size={16} />, label: "Banking & Finance" },
              { icon: <Wheat size={16} />, label: "Agriculture" },
              { icon: <ScrollText size={16} />, label: "Research" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828] p-4 text-center">
                <span className="text-teal-600 dark:text-[#2ee0bd]">{s.icon}</span>
                <span className="text-[12px] font-semibold text-slate-800 dark:text-white">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Honest labels */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-[#241c09]/80 p-4 text-[11.5px] leading-relaxed text-amber-900 dark:text-amber-200/90 shadow-sm">
            <p className="font-bold text-amber-800 dark:text-amber-300">Research / Hackathon Demonstration.</p>
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              DataVault is a research and hackathon demonstration. It is not legal or regulatory compliance advice.
              Production deployments must undergo organization-specific privacy, security, legal, and regulatory review.
              All datasets in this demo are synthetic; no real patient, financial or farm records are used.
              Privacy-preserving architecture designed to minimize raw-data exposure — no certification claims (HIPAA, DPDP or otherwise) are made.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#0d1828] p-4 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400 shadow-sm">
            <p className="font-semibold text-slate-900 dark:text-white">Demo-grade engineering choices (documented per spec §64):</p>
            <ul className="mt-2 space-y-1.5">
              <li>• The sandbox preview runs the embedded TypeScript FL engine (real SGD + FedAvg); the Python PyTorch service ships for Docker/production mode with the same semantics.</li>
              <li>• TenSEAL CKKS homomorphic encryption is implemented in the Python service as the ENCRYPTION-mode path; the TS engine uses real AES-256-GCM + zero-sum masking.</li>
              <li>• The sandbox blockchain is a genuine SHA-256 PoW hash-chain ledger labeled &quot;Local Test Network&quot;; the Solidity contract ships for Hardhat/EVM deployment.</li>
              <li>• Demo pacing delays animate the live view; all underlying state transitions come from real computation.</li>
            </ul>
          </div>
        </section>

        <div className="flex justify-center pb-8">
          <Button size="lg" className="bg-cyan-500 px-8 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("login")}>
            <Play size={16} /> Experience the live demo
          </Button>
        </div>
      </div>
    </div>
  );
}

function Boxes() {
  return <Database size={14} />;
}
