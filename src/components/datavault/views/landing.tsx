"use client";
/**
 * DataVault — Landing page (spec §9).
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { navigate } from "@/lib/client/router";
import { useAppStore } from "@/lib/client/store";
import { dashboardApi, type DashboardStats } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Vault, ShieldCheck, Network, Lock, Coins, ArrowRight, Play, Building2, Landmark, Wheat, Database, TrendingUp, Globe, ChevronDown } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55 },
};

export function LandingView() {
  const { user } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const k = stats?.kpis;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 p-1.5">
              <Vault size={18} className="text-[#04222b]" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">DataVault</p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Privacy-First AI Marketplace</p>
            </div>
          </div>
          <nav className="ml-6 hidden items-center gap-6 text-[13px] text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#architecture" className="transition-colors hover:text-foreground">Architecture</a>
            <a href="#usecases" className="transition-colors hover:text-foreground">Use cases</a>
            <a href="#marketplace" className="transition-colors hover:text-foreground">Marketplace</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button size="sm" className="bg-cyan-500 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("dashboard")}>
                Open Dashboard <ArrowRight size={14} />
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => navigate("login")}>
                  Sign in
                </Button>
                <Button size="sm" className="bg-cyan-500 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("login")}>
                  Launch Demo <Play size={14} />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3.5 py-1.5 text-[12px] font-medium text-cyan-300">
              <ShieldCheck size={13} />
              Raw data never leaves the data owner
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              Train AI together.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-200 bg-clip-text text-transparent text-glow">Keep your data.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              DataVault enables organizations to collaboratively build AI models without sharing raw data.
              Federated learning, secure aggregation and blockchain-verified rewards — designed for privacy-conscious
              collaborative AI in India&apos;s data-rich but siloed ecosystem.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-11 bg-cyan-500 px-6 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("login")}>
                <Play size={16} /> Launch Demo
              </Button>
              <Button size="lg" variant="outline" className="h-11 border-cyan-500/30 bg-cyan-500/5 px-6 text-cyan-300 hover:bg-cyan-500/10" onClick={() => navigate("about")}>
                Explore Architecture
              </Button>
              <Button size="lg" variant="ghost" className="h-11 px-6 text-muted-foreground" onClick={() => navigate("login")}>
                <Network size={15} /> View Live Network
              </Button>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground/70">
              Research / Hackathon Demonstration · 100% synthetic demo data
            </p>
          </motion.div>

          {/* Live stats bar */}
          <motion.div {...fadeUp} className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <LiveStat label="Organizations" value={k ? k.organizations : "—"} icon={<Building2 size={14} />} />
            <LiveStat label="Federation Rounds" value={k ? k.federationRounds : "—"} icon={<Network size={14} />} />
            <LiveStat label="Protected Updates" value={k ? k.encryptedUpdates + k.totalContributions : "—"} icon={<Lock size={14} />} />
            <LiveStat label="Rewards Distributed" value={k ? `${k.rewardsDistributed.toLocaleString("en-IN")} DATA` : "—"} icon={<Coins size={14} />} />
          </motion.div>

          {/* Hero diagram */}
          <motion.div {...fadeUp} className="mt-14">
            <HeroDiagram stats={stats} />
          </motion.div>
        </div>
        <div className="flex justify-center pb-6 text-muted-foreground/50">
          <ChevronDown size={20} className="animate-bounce" />
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-border/60 bg-card/20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">The Problem</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Why data silos matter</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Organizations sit on valuable data but cannot share it — privacy regulations, security concerns,
              competitive sensitivity and data ownership make centralizing raw data impossible. The result:
              every organization trains weaker models alone.
            </p>
          </motion.div>
          <motion.div {...fadeUp} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Privacy regulations", d: "DPDP, HIPAA-style and sectoral rules restrict raw data movement across organizational boundaries." },
              { t: "Security & compliance", d: "Centralizing sensitive records creates honeypots and breach liability no one wants to own." },
              { t: "Competitive sensitivity", d: "Customer records, transactions and field data are strategic assets organizations won't hand over." },
              { t: "Data ownership", d: "Legal ownership and consent chains must remain with the data controller — not a third party." },
              { t: "Siloed learning", d: "Models trained on one organization's slice inherit its bias and generalize poorly across the network." },
              { t: "No fair incentives", d: "Without verifiable contribution tracking, collaborative AI has no trust or reward layer." },
            ].map((item) => (
              <div key={item.t} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-cyan-500/30">
                <p className="text-sm font-semibold text-foreground">{item.t}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.d}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">How DataVault Works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Three privacy layers, one network</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              A global model travels to each organization. Only privacy-protected model updates travel back.
              Contributions are proven on-chain and rewarded in DATA tokens.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <LayerCard
              step="Layer 1"
              icon={<Network size={20} />}
              title="Federated Learning"
              points={["Global model distributed to participants", "Local training on each organization's data", "Only model weight updates are produced", "FedAvg aggregation creates the next global model"]}
            />
            <LayerCard
              step="Layer 2"
              icon={<Lock size={20} />}
              title="Privacy Computing"
              points={["Pairwise zero-sum masking on every update", "Masks cancel — aggregator sees only the aggregate", "AES-256-GCM encryption in ENCRYPTION mode", "Production path: TenSEAL CKKS homomorphic encryption"]}
            />
            <LayerCard
              step="Layer 3"
              icon={<Coins size={20} />}
              title="Blockchain Incentives"
              points={["SHA-256 hash-chained contribution proofs", "Transparent contribution scoring formula", "1000 DATA reward pool per round", "DataVaultRewards.sol smart contract for EVM chains"]}
            />
          </div>

          <motion.div {...fadeUp} className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Problem → Data Silos", "→ Local Training", "→ Encrypted Updates", "→ Secure Aggregation",
              "→ Better AI", "→ Contribution Proof", "→ Token Rewards", "→ Verified Trust",
            ].map((s, i) => (
              <div key={i} className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.05] px-4 py-3 text-center text-[12px] font-medium text-cyan-200">
                {s}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Architecture snapshot */}
      <section id="architecture" className="border-t border-border/60 bg-card/20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Architecture</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Privacy-preserving by construction</h2>
          </motion.div>
          <motion.div {...fadeUp} className="mt-10 overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
            <ArchFlow />
          </motion.div>
        </div>
      </section>

      {/* Use cases */}
      <section id="usecases" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Use Cases</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Built for India&apos;s data ecosystem</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Healthcare, banking, agriculture, insurance, research and the public sector — data-rich, siloed, privacy-first.
            </p>
          </motion.div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <UseCase
              icon={<Building2 size={20} />}
              title="Healthcare"
              headline="Federated Cancer Prediction Network"
              body="Hospitals co-train a cancer-risk classifier across synthetic biomarker datasets. Raw patient records never leave the hospital environment."
              metric={stats?.modelProgression[0] ? `${(stats.modelProgression[0].current * 100).toFixed(1)}% accuracy` : null}
              baseline={stats?.modelProgression[0] ? `vs ${(stats.modelProgression[0].baseline * 100).toFixed(1)}% siloed` : null}
              action={() => navigate("federation")}
            />
            <UseCase
              icon={<Landmark size={20} />}
              title="Finance"
              headline="Cross-Bank Fraud Detection"
              body="Banks detect fraud patterns across institutions without exposing transaction streams. Precision, recall, F1 and ROC-AUC tracked per round."
              metric={stats?.modelProgression[1] ? `${(stats.modelProgression[1].current * 100).toFixed(1)}% accuracy` : null}
              baseline={stats?.modelProgression[1] ? `vs ${(stats.modelProgression[1].baseline * 100).toFixed(1)}% siloed` : null}
              action={() => navigate("login")}
            />
            <UseCase
              icon={<Wheat size={20} />}
              title="Agriculture"
              headline="Crop Yield Prediction"
              body="Farmer collectives predict yields from soil and weather telemetry. Rewards redeem for seed & fertilizer subsidies (demo concept)."
              metric={stats?.modelProgression[2] ? `R² ${stats.modelProgression[2].current.toFixed(2)}` : null}
              baseline={stats?.modelProgression[2] ? `vs R² ${stats.modelProgression[2].baseline.toFixed(2)} siloed` : null}
              action={() => navigate("login")}
            />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-t border-border/60 bg-card/20 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Security & Privacy</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Your raw data remains inside your organization</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              DataVault is architected so that exposing raw records is not an option, not a policy.
              Raw data shared: <span className="font-semibold text-emerald-400">0 bytes</span> — enforced by design
              and verified by the audit layer.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Raw Data: NOT SHARED — physically stays in participant environments",
                "Model Updates: SHARED — privacy-protected (masked + encrypted) only",
                "Secure Aggregation: ENABLED — individual updates never visible",
                "Blockchain Audit: ENABLED — hash-chained contribution proofs",
                "RBAC + JWT sessions + rate limiting + input validation",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5 text-[13px] text-foreground/90">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                  {line}
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-300/90">
              DataVault is a research and hackathon demonstration. It is not legal or regulatory compliance advice.
              Production deployments must undergo organization-specific privacy, security, legal, and regulatory review.
            </p>
          </motion.div>
          <motion.div {...fadeUp} className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold">Live privacy posture</p>
            <div className="mt-4 space-y-2.5">
              {[
                { label: "Raw data shared", value: "0 bytes" },
                { label: "Encrypted updates", value: k ? k.encryptedUpdates.toLocaleString("en-IN") : "—" },
                { label: "Data owners", value: k ? k.participants : "—" },
                { label: "Privacy events", value: k ? k.privacyEvents : "—" },
                { label: "Encryption", value: "AES-256-GCM available" },
                { label: "Secure aggregation", value: "Zero-sum masking" },
                { label: "Blockchain audit", value: k ? `${k.blocks} blocks` : "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3.5 py-2.5">
                  <span className="text-[12px] text-muted-foreground">{row.label}</span>
                  <span className="font-mono text-[12px] font-medium text-emerald-400">{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Marketplace + rewards */}
      <section id="marketplace" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Marketplace & Rewards</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Collaborate on AI — never sell data</h2>
          </motion.div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <motion.div {...fadeUp} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-cyan-300"><Database size={16} /><p className="text-sm font-semibold text-foreground">What DataVault IS NOT</p></div>
              <p className="mt-3 text-2xl font-semibold text-red-400/90">“Sell your customer data.”</p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                No raw datasets are ever listed, transferable or downloadable. The privacy guard blocks and logs every raw-access attempt.
              </p>
              <div className="mt-5 flex items-center gap-2 text-teal-300"><TrendingUp size={16} /><p className="text-sm font-semibold text-foreground">What DataVault IS</p></div>
              <p className="mt-2 text-lg font-semibold text-teal-300">“Collaborate on AI without transferring raw data.”</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Federated models, training collaborations and privacy-preserving computation services — with
                performance, privacy method and contributors visible on every listing.
              </p>
            </motion.div>
            <motion.div {...fadeUp} className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-semibold text-foreground">Transparent token rewards</p>
              <p className="mt-1 text-[12px] text-muted-foreground">reward = pool × normalized contribution score</p>
              <div className="mt-5 space-y-3">
                {(stats?.contributionByOrg ?? []).slice(0, 5).map((c) => {
                  const max = Math.max(...(stats?.contributionByOrg ?? [{ rewards: 1 }]).map((x) => x.rewards), 1);
                  return (
                    <div key={c.org}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="truncate text-foreground/90">{c.org}</span>
                        <span className="font-mono text-cyan-300">{c.rewards.toLocaleString("en-IN")} DATA</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-400" style={{ width: `${(c.rewards / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!stats && <p className="text-xs text-muted-foreground">Loading live reward distribution…</p>}
              </div>
              <Button variant="outline" size="sm" className="mt-5 w-full border-cyan-500/30 bg-cyan-500/5 text-cyan-300" onClick={() => navigate(user ? "marketplace" : "login")}>
                Explore the marketplace <ArrowRight size={14} />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border/60 py-24">
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div {...fadeUp}>
            <Globe size={28} className="mx-auto text-cyan-300" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Train Together. Share Nothing.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Spin up the demo network, run a live federated round in seconds, watch updates get encrypted,
              aggregated, proven on-chain and rewarded — all on synthetic data.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="h-11 bg-cyan-500 px-7 text-[#04222b] hover:bg-cyan-400" onClick={() => navigate("login")}>
                <Play size={16} /> Launch the demo
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-7" onClick={() => navigate("about")}>
                Read the architecture
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/30 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-[11px] text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Vault size={13} className="text-cyan-400" />
            <span>© 2026 DataVault — Privacy-First AI Collaboration Marketplace</span>
          </div>
          <p>Research / Hackathon Demonstration · Synthetic data only · Not compliance advice</p>
        </div>
      </footer>
    </div>
  );
}

function LiveStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">{icon}</div>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function LayerCard({ step, icon, title, points }: { step: string; icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <motion.div {...fadeUp} className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-cyan-500/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">{step}</span>
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-2 text-cyan-300 transition-transform group-hover:scale-110">{icon}</div>
      </div>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <ul className="mt-3 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400" />
            {p}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function UseCase({ icon, title, headline, body, metric, baseline, action }: {
  icon: React.ReactNode; title: string; headline: string; body: string;
  metric: string | null; baseline: string | null; action: () => void;
}) {
  return (
    <motion.div {...fadeUp} className="flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-teal-500/40">
      <div className="flex items-center gap-2 text-teal-300">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">{title}</span>
      </div>
      <p className="mt-3 text-base font-semibold leading-snug">{headline}</p>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      {metric && (
        <div className="mt-4 flex items-baseline gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
          <span className="font-mono text-lg font-semibold text-emerald-400">{metric}</span>
          {baseline && <span className="text-[10px] text-muted-foreground">{baseline}</span>}
        </div>
      )}
      <button onClick={action} className="mt-4 flex items-center gap-1 text-[12px] font-medium text-cyan-300 transition-colors hover:text-cyan-200">
        View live model <ArrowRight size={13} />
      </button>
    </motion.div>
  );
}

const ARCH_TONES = {
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  teal: "border-teal-500/30 bg-teal-500/10 text-teal-200",
  muted: "border-border bg-muted/50 text-muted-foreground",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

function ArchBox({ label, tone }: { label: string; tone: "cyan" | "teal" | "muted" | "amber" }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center text-[10.5px] font-medium leading-tight ${ARCH_TONES[tone]}`}>
      {label}
    </div>
  );
}

const ArchArrow = () => <div className="mx-auto my-1 h-4 w-px bg-gradient-to-b from-cyan-500/50 to-transparent" />;

function ArchFlow() {
  const Box = ArchBox;
  const Arrow = ArchArrow;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Data Owner Side</p>
        <Box label="ORGANIZATION · local raw data (never leaves)" tone="muted" />
        <Arrow />
        <Box label="LOCAL TRAINING (real SGD)" tone="teal" />
        <Arrow />
        <Box label="MODEL UPDATE Δ (weights only)" tone="teal" />
        <Arrow />
        <Box label="MASKING + AES-256-GCM" tone="cyan" />
        <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-center text-[9.5px] text-red-300">raw data: 0 bytes transferred</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Platform Side</p>
        <Box label="SECURE AGGREGATOR (masks cancel)" tone="cyan" />
        <Arrow />
        <Box label="FedAvg → GLOBAL MODEL vNext" tone="cyan" />
        <Arrow />
        <Box label="MODEL REGISTRY + VERSION HASHES" tone="muted" />
        <Arrow />
        <Box label="CONTRIBUTION SCORING" tone="teal" />
        <p className="mt-2 text-center text-[9.5px] text-muted-foreground">PostgreSQL · Audit hash-chain · RBAC</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trust Layer</p>
        <Box label="BLOCKCHAIN LEDGER (SHA-256 chain)" tone="amber" />
        <Arrow />
        <Box label="CONTRIBUTION PROOFS on-chain" tone="amber" />
        <Arrow />
        <Box label="DATA TOKEN REWARDS (1000/round)" tone="amber" />
        <Arrow />
        <Box label="WALLETS + CLAIM TRANSACTIONS" tone="muted" />
        <p className="mt-2 text-center text-[9.5px] text-muted-foreground">Solidity: DataVaultRewards.sol (EVM)</p>
      </div>
    </div>
  );
}

function HeroDiagram({ stats }: { stats: DashboardStats | null }) {
  const participants = stats?.contributionByOrg.slice(0, 3) ?? [];
  const names = participants.length ? participants.map((p) => p.org.split(" ")[0]) : ["Apollo", "AIIMS", "Max"];
  const positions = [
    { x: 12, y: 8 }, { x: 78, y: 8 }, { x: 45, y: 78 },
  ];
  return (
    <div className="relative mx-auto aspect-[16/9] max-w-3xl overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="grid-bg absolute inset-0 opacity-60" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {positions.map((p, i) => (
          <line key={i} x1="50" y1="42" x2={p.x + 11} y2={p.y + 8} stroke="rgba(34,211,238,0.35)" strokeWidth="0.5" className="dash-flow" />
        ))}
        <line x1="50" y1="42" x2="50" y2="58" stroke="rgba(45,212,191,0.5)" strokeWidth="0.7" />
      </svg>
      <div className="absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-center shadow-[0_0_30px_rgba(34,211,238,0.25)]">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">Global Model</p>
          <p className="font-mono text-sm font-semibold text-cyan-200">{stats ? `${stats.kpis.modelAccuracy.toFixed(1)}%` : "—"}</p>
        </div>
      </div>
      <div className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-[10px] font-medium text-teal-200">
          🔒 Secure Aggregator
        </div>
      </div>
      {positions.map((p, i) => (
        <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x + 11}%`, top: `${p.y + 8}%` }}>
          <div className="rounded-xl border border-border bg-background/80 px-3 py-1.5 text-center backdrop-blur">
            <p className="text-[10px] font-medium text-foreground/90">{names[i]}</p>
            <p className="text-[8.5px] text-muted-foreground">🛡 local data · encrypted Δ</p>
          </div>
        </div>
      ))}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[9px] text-amber-300">
        on-chain proofs · {stats ? stats.kpis.blocks : "—"} blocks · {stats ? stats.kpis.rewardsDistributed.toLocaleString("en-IN") : "—"} DATA rewarded
      </div>
    </div>
  );
}
