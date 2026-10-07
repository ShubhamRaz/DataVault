"use client";
/**
 * DataVault — hash-based SPA router.
 * The sandbox preview serves the single `/` route; all views live behind
 * `#/route` hashes (dashboard, models, federation, …) so browser back/forward
 * and deep links still work exactly like a multi-page app.
 * useSyncExternalStore keeps SSR/hydration consistent by design.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

export type Route =
  | "landing"
  | "login"
  | "register"
  | "dashboard"
  | "organizations"
  | "organization"
  | "models"
  | "model"
  | "federation"
  | "privacy"
  | "blockchain"
  | "rewards"
  | "marketplace"
  | "listing"
  | "datasets"
  | "audit"
  | "settings"
  | "admin"
  | "about";

export interface ParsedRoute {
  route: Route;
  id: string | null;
}

const ROUTES: Route[] = [
  "landing", "login", "register", "dashboard", "organizations", "organization",
  "models", "model", "federation", "privacy", "blockchain", "rewards",
  "marketplace", "listing", "datasets", "audit", "settings", "admin", "about",
];

export function parseHash(hash: string): ParsedRoute {
  const clean = hash.replace(/^#\/?/, "").split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  const base = (parts[0] ?? "landing") as Route;
  const route = ROUTES.includes(base) ? base : "landing";
  const id = parts[1] ?? null;
  return { route, id };
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

const getSnapshot = () => window.location.hash;
const getServerSnapshot = () => "";

export function useHashRouter() {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const parsed = useMemo<ParsedRoute>(() => {
    if (typeof window === "undefined") return { route: "landing", id: null };
    return parseHash(window.location.hash);
  }, [hash]);

  const navigate = useCallback((route: Route, id?: string) => {
    const next = `#/${route}${id ? `/${id}` : ""}`;
    if (window.location.hash === next) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = next;
    }
  }, []);

  return { ...parsed, navigate };
}

export function navigate(route: Route, id?: string) {
  window.location.hash = `#/${route}${id ? `/${id}` : ""}`;
}
