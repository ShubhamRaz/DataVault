"use client";
/**
 * DataVault — Login / Register views (spec §26).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { navigate } from "@/lib/client/router";
import { useAppStore } from "@/lib/client/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Vault, ShieldCheck, Lock, ArrowRight, Loader2, Play } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "admin@datavault.demo", label: "Platform Admin", desc: "Full demo controls" },
  { email: "alice@apollo.demo", label: "Hospital Org Admin", desc: "Apollo Demo Hospital" },
  { email: "raj@datavault.demo", label: "ML Operator", desc: "Runs federation rounds" },
  { email: "viewer@datavault.demo", label: "Marketplace Viewer", desc: "Read-only access" },
];

export function LoginView({ mode, navigate: nav }: { mode: "login" | "register"; navigate: (r: "dashboard" | "landing") => void }) {
  const { login, register } = useAppStore();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [orgSlug, setOrgSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome back to DataVault");
      } else {
        await register({ email, name, password, role, organizationSlug: orgSlug || undefined });
        toast.success("Account created — welcome to DataVault");
      }
      nav("dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const quickDemo = async () => {
    setBusy(true);
    try {
      await login("admin@datavault.demo", "demo1234");
      toast.success("Signed in as demo admin");
      nav("dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="grid-bg absolute inset-0" />
      <div className="absolute left-1/2 top-1/3 h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[110px]" />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative grid w-full max-w-4xl gap-6 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between rounded-2xl border border-border bg-card/60 p-8 lg:flex">
          <div>
            <button onClick={() => nav("landing")} className="flex items-center gap-2.5">
              <div className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 p-1.5">
                <Vault size={18} className="text-[#04222b]" />
              </div>
              <p className="text-lg font-semibold tracking-tight">DataVault</p>
            </button>
            <h2 className="mt-8 text-2xl font-bold leading-tight">
              Train together.
              <br />
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-cyan-300 dark:to-teal-300 bg-clip-text text-transparent">Share nothing.</span>
            </h2>
            <div className="mt-6 space-y-3">
              {[
                "Raw data never leaves your organization",
                "Federated learning with secure aggregation",
                "Blockchain-verified contribution rewards",
                "100% synthetic demo data — zero risk",
              ].map((line) => (
                <div key={line} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {line}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground/60">
            Research / Hackathon Demonstration. Not compliance advice.
          </p>
        </div>

        {/* Form panel */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
              <Lock size={14} />
            </div>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mode === "login" ? "Access the DataVault federated network" : "Join the privacy-first AI collaboration network"}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. A. Sharma" required minLength={2} className="h-10 bg-background/60" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.demo" required className="h-10 bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "Min 8 characters" : "••••••••"} required minLength={mode === "register" ? 8 : 1} className="h-10 bg-background/60" />
            </div>
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">Marketplace Viewer</SelectItem>
                      <SelectItem value="PARTICIPANT">Participant</SelectItem>
                      <SelectItem value="ML_OPERATOR">ML Operator</SelectItem>
                      <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Join organization (slug)</Label>
                  <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="hospital-a" className="h-10 bg-background/60" />
                </div>
              </div>
            )}
            <Button type="submit" disabled={busy} className="h-10 w-full bg-cyan-500 font-medium text-[#04222b] hover:bg-cyan-400">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {mode === "login" && (
            <>
              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> demo accounts <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword("demo1234"); }}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-left transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5"
                  >
                    <div>
                      <p className="text-[12px] font-medium text-foreground">{acc.label}</p>
                      <p className="text-[10px] text-muted-foreground">{acc.email} · {acc.desc}</p>
                    </div>
                    <ArrowRight size={13} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
              <Button type="button" variant="outline" disabled={busy} onClick={quickDemo} className="mt-4 h-10 w-full border-cyan-500/40 bg-cyan-500/10 text-teal-700 dark:text-cyan-300 hover:bg-cyan-500/20">
                <Play size={14} /> One-click demo login (admin)
              </Button>
            </>
          )}

          <p className="mt-5 text-center text-[12px] text-muted-foreground">
            {mode === "login" ? (
              <>New to DataVault? <button onClick={() => (window.location.hash = "#/register")} className="font-medium text-teal-600 dark:text-cyan-300 hover:underline">Create an account</button></>
            ) : (
              <>Already registered? <button onClick={() => (window.location.hash = "#/login")} className="font-medium text-teal-600 dark:text-cyan-300 hover:underline">Sign in</button></>
            )}
          </p>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            <button onClick={() => nav("landing")} className="hover:text-foreground">← Back to landing page</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
