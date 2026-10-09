"use client";
/**
 * DataVault — Settings view (admin): system settings incl. privacy mode.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import { PageHeader } from "@/components/datavault/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, ShieldCheck, Loader2, Save } from "lucide-react";

export function SettingsView() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [privacyMode, setPrivacyMode] = useState<string>("DEMO");
  const [rewardPool, setRewardPool] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminApi.settings,
    enabled: user?.role === "ADMIN",
  });

  if (!loaded && data) {
    const pm = data.settings.find((s) => s.key === "privacy_mode");
    if (pm) setPrivacyMode(pm.value);
    setLoaded(true);
  }

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.updateSetting("privacy_mode", privacyMode);
      await adminApi.updateSetting("round_reward_pool", rewardPool);
      toast.success("Settings saved — future federation rounds will use the new configuration");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["privacy-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" subtitle="System settings require the ADMIN role." icon={<Settings size={18} />} />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Sign in as admin@datavault.demo to manage system settings.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration — privacy mode and reward pool for future federation rounds."
        icon={<Settings size={18} />}
        actions={
          <Button size="sm" disabled={busy} onClick={save} className="bg-cyan-500 text-[#04222b] hover:bg-cyan-400">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save settings
          </Button>
        }
      />

      {isLoading ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828]">
            <CardHeader className="border-b border-slate-200 dark:border-[#1b3046]/60 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-300" /> Privacy mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e] p-4">
                <div>
                  <Label className="text-[13px] font-semibold text-slate-900 dark:text-white">DEMO mode</Label>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Fast, deterministic rounds. Updates travel masked (zero-sum) without GCM sealing.</p>
                </div>
                <Switch checked={privacyMode === "DEMO"} onCheckedChange={(v) => setPrivacyMode(v ? "DEMO" : "ENCRYPTION")} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1b3046] bg-slate-50 dark:bg-[#07101e] p-4">
                <div>
                  <Label className="text-[13px] font-semibold text-slate-900 dark:text-white">ENCRYPTION mode</Label>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Updates additionally sealed with AES-256-GCM before leaving participants. Both modes use secure aggregation.</p>
                </div>
                <Switch checked={privacyMode === "ENCRYPTION"} onCheckedChange={(v) => setPrivacyMode(v ? "ENCRYPTION" : "DEMO")} />
              </div>
              <p className="rounded-xl border border-violet-200 dark:border-violet-500/25 bg-violet-50 dark:bg-[#1a1438]/60 p-3.5 text-[11px] leading-relaxed text-violet-800 dark:text-violet-200">
                Production deployments: the Python ml-service implements TenSEAL/CKKS homomorphic encryption on selected update tensors (spec §64). The TS demo engine preserves the same API boundaries.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 dark:border-[#1b3046] bg-white dark:bg-[#0d1828]">
            <CardHeader className="border-b border-slate-200 dark:border-[#1b3046]/60 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">Reward pool & system</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Round reward pool (DATA tokens)</Label>
                <Select value={rewardPool} onValueChange={setRewardPool}>
                  <SelectTrigger className="bg-slate-50 dark:bg-[#07101e] border-slate-200 dark:border-[#1b3046] text-slate-800 dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0d1828] border-slate-200 dark:border-[#1b3046]">
                    {["500", "1000", "2000"].map((v) => <SelectItem key={v} value={v}>{v} DATA / round</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {(data?.settings ?? []).filter((s) => !["privacy_mode", "round_reward_pool"].includes(s.key)).map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-[#07101e] px-3.5 py-2.5 text-[11.5px]">
                    <div>
                      <p className="font-mono text-[10.5px] font-semibold text-cyan-700 dark:text-cyan-300">{s.key}</p>
                      <p className="text-[9.5px] text-slate-500 dark:text-slate-400">{s.description}</p>
                    </div>
                    <span className="max-w-[180px] truncate text-right font-mono font-medium text-slate-800 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
