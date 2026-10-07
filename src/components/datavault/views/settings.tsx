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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={15} className="text-emerald-300" /> Privacy mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-4">
                <div>
                  <Label className="text-[13px]">DEMO mode</Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Fast, deterministic rounds. Updates travel masked (zero-sum) without GCM sealing.</p>
                </div>
                <Switch checked={privacyMode === "DEMO"} onCheckedChange={(v) => setPrivacyMode(v ? "DEMO" : "ENCRYPTION")} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-4">
                <div>
                  <Label className="text-[13px]">ENCRYPTION mode</Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Updates additionally sealed with AES-256-GCM before leaving participants. Both modes use secure aggregation.</p>
                </div>
                <Switch checked={privacyMode === "ENCRYPTION"} onCheckedChange={(v) => setPrivacyMode(v ? "ENCRYPTION" : "DEMO")} />
              </div>
              <p className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-violet-300/90">
                Production deployments: the Python ml-service implements TenSEAL/CKKS homomorphic encryption on selected update tensors (spec §64). The TS demo engine preserves the same API boundaries.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Reward pool & system</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Round reward pool (DATA tokens)</Label>
                <Select value={rewardPool} onValueChange={setRewardPool}>
                  <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["500", "1000", "2000"].map((v) => <SelectItem key={v} value={v}>{v} DATA / round</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {(data?.settings ?? []).filter((s) => !["privacy_mode", "round_reward_pool"].includes(s.key)).map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-[11.5px]">
                    <div>
                      <p className="font-mono text-[10.5px] text-muted-foreground">{s.key}</p>
                      <p className="text-[9.5px] text-muted-foreground/70">{s.description}</p>
                    </div>
                    <span className="max-w-[180px] truncate text-right font-medium text-foreground">{s.value}</span>
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
