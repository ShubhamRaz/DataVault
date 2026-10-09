"use client";
/**
 * DataVault — application root.
 * Single-page app at `/` with hash routing (sandbox constraint) — all views
 * mount here: landing, auth, dashboard, federation, models, organizations,
 * datasets, privacy, blockchain, rewards, marketplace, audit, admin, about.
 */
import { useEffect } from "react";
import { useHashRouter } from "@/lib/client/router";
import { useAppStore } from "@/lib/client/store";
import { AppShell } from "@/components/datavault/shell";
import { AppProviders } from "@/components/datavault/providers";
import { LandingView } from "@/components/datavault/views/landing";
import { LoginView } from "@/components/datavault/views/auth";
import { DashboardView } from "@/components/datavault/views/dashboard";
import { FederationView } from "@/components/datavault/views/federation";
import { ModelsView, ModelDetailView } from "@/components/datavault/views/models";
import { OrganizationsView, OrganizationDetailView } from "@/components/datavault/views/organizations";
import { DatasetsView } from "@/components/datavault/views/datasets";
import { PrivacyView } from "@/components/datavault/views/privacy";
import { BlockchainView } from "@/components/datavault/views/blockchain";
import { RewardsView } from "@/components/datavault/views/rewards";
import { MarketplaceView, ListingDetailView } from "@/components/datavault/views/marketplace";
import { AuditView } from "@/components/datavault/views/audit";
import { AdminView } from "@/components/datavault/views/admin";
import { SettingsView } from "@/components/datavault/views/settings";
import { AboutView } from "@/components/datavault/views/about";

export default function DataVaultApp() {
  return (
    <AppProviders>
      <DataVaultInner />
    </AppProviders>
  );
}

function DataVaultInner() {
  const { route, id, navigate } = useHashRouter();
  const { user, sessionLoading, loadSession, theme } = useAppStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route, id]);

  // public views (no auth required)
  if (route === "landing" || route === "about" || route === "login" || route === "register") {
    if (route === "about") return <AboutView />;
    if (route === "login" || route === "register")
      return <AuthGate route={route === "login" ? "login" : "register"} navigate={navigate} />;
    return <LandingView />;
  }

  // authenticated views
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          <p className="text-xs text-muted-foreground">Loading DataVault…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate route="login" navigate={navigate} />;
  }

  const view = (() => {
    switch (route) {
      case "dashboard":
        return <DashboardView />;
      case "federation":
        return <FederationView />;
      case "models":
        return <ModelsView />;
      case "model":
        return id ? <ModelDetailView id={id} /> : <ModelsView />;
      case "organizations":
        return <OrganizationsView />;
      case "organization":
        return id ? <OrganizationDetailView id={id} /> : <OrganizationsView />;
      case "datasets":
        return <DatasetsView />;
      case "privacy":
        return <PrivacyView />;
      case "blockchain":
        return <BlockchainView />;
      case "rewards":
        return <RewardsView />;
      case "marketplace":
        return <MarketplaceView />;
      case "listing":
        return id ? <ListingDetailView id={id} /> : <MarketplaceView />;
      case "audit":
        return <AuditView />;
      case "admin":
        return <AdminView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  })();

  if (route === "dashboard") {
    return <DashboardView />;
  }

  return <AppShell activeRoute={route}>{view}</AppShell>;
}

function AuthGate({ route, navigate }: { route: "login" | "register"; navigate: (r: "dashboard" | "landing") => void }) {
  if (route === "register") {
    return <LoginView mode="register" navigate={navigate} />;
  }
  return <LoginView mode="login" navigate={navigate} />;
}
