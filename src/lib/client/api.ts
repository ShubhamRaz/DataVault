"use client";
/**
 * DataVault — frontend API client (same-origin fetch, cookie sessions).
 */

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "Network error" }))) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};

// ─── Typed API surface ───

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel?: string;
  organizationId: string | null;
  organizationName?: string | null;
}

export const authApi = {
  me: () => api.get<SessionUser | null>("/auth/me"),
  login: (email: string, password: string) => api.post<SessionUser>("/auth/login", { email, password }),
  register: (payload: { email: string; name: string; password: string; role?: string; organizationSlug?: string }) =>
    api.post<SessionUser>("/auth/register", payload),
  logout: () => api.post<{ loggedOut: boolean }>("/auth/logout"),
};

export interface DashboardStats {
  kpis: {
    organizations: number;
    activeModels: number;
    federationRounds: number;
    encryptedUpdates: number;
    totalContributions: number;
    rewardsDistributed: number;
    privacyEvents: number;
    modelAccuracy: number;
    participants: number;
    blocks: number;
    transactions: number;
    listings: number;
  };
  modelProgression: {
    modelId: string;
    name: string;
    taskType: string;
    industry: string;
    baseline: number;
    current: number;
    version: string;
    series: { round: number; value: number }[];
  }[];
  contributionByOrg: { org: string; industry: string; lifetimeScore: number; rewards: number }[];
  rewardsPerRound: { round: string; model: string; total: number; improvement: number; encryptedUpdates: number }[];
  privacyByType: Record<string, number>;
  activity: { date: string; rounds: number; updates: number }[];
  demo: { label: string; rawDataSharedBytes: number };
}

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/dashboard/stats"),
};

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  type: string;
  industry: string;
  location: string;
  status: string;
  verification: string;
  description: string | null;
  walletAddress: string | null;
  activeModels: number;
  trainingRounds: number;
  contributionScore: number;
  rewardBalance: number;
  datasets: number;
  createdAt: string;
}

export const orgsApi = {
  list: (params?: Record<string, string>) => api.get<{ organizations: OrganizationSummary[] }>(`/organizations${qs(params)}`),
  detail: (id: string) => api.get<Record<string, unknown>>(`/organizations/${id}`),
  update: (id: string, data: { status?: string; verification?: string }) => api.patch<{ organization: unknown }>(`/organizations/${id}`, data),
  create: (payload: Record<string, unknown>) => api.post<{ organization: unknown }>("/organizations", payload),
};

export interface ModelSummary {
  id: string;
  name: string;
  slug: string;
  useCase: string;
  industry: string;
  taskType: string;
  framework: string;
  status: string;
  privacyMode: string;
  description: string | null;
  version: string;
  accuracyBefore: number;
  accuracyAfter: number;
  metrics: Record<string, unknown>;
  participants: string[];
  participantCount: number;
  trainingRounds: number;
  versionCount: number;
  modelHash: string | null;
  listing: { id: string; price: number; status: string } | null;
  createdAt: string;
}

export const modelsApi = {
  list: (params?: Record<string, string>) => api.get<{ models: ModelSummary[] }>(`/models${qs(params)}`),
  detail: (id: string) => api.get<Record<string, unknown>>(`/models/${id}`),
  create: (payload: Record<string, unknown>) => api.post<{ model: unknown }>("/models", payload),
};

export const datasetsApi = {
  list: (params?: Record<string, string>) => api.get<{ datasets: unknown[]; notice: string }>(`/datasets${qs(params)}`),
  tryRawAccess: (id: string) => api.get<{ blocked: boolean; reason: string; whatIsShared?: Record<string, string> }>(`/datasets/${id}/raw`),
  generate: (payload: { organizationId: string; samples?: number }) => api.post<{ dataset: unknown }>("/datasets", payload),
};

export interface FederationNetwork {
  modelId: string;
  modelName: string;
  taskType: string;
  industry: string;
  version: string;
  currentAccuracy: number;
  baselineAccuracy: number;
  privacyMode: string;
  status: string;
  participants: {
    id: string;
    name: string;
    slug: string;
    status: string;
    walletAddress: string | null;
    lifetimeScore: number;
    roundsParticipated: number;
  }[];
}

export interface FederationRoundSummary {
  id: string;
  roundNumber: number;
  status: string;
  model: { id: string; name: string; industry: string; taskType: string };
  metricsBefore: number;
  metricsAfter: number;
  improvement: number;
  durationMs: number;
  encryptedUpdates: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  config: { epochs?: number; lr?: number; privacyMode?: string } | null;
  aggregateMetrics: { perParticipant?: { organization: string; primary: number }[] } | null;
  contributions: { organizationName: string; normalizedScore: number; sampleCount: number }[];
  rewards: { organizationName: string; amount: number; txHash: string | null; status: string }[];
}

export const federationApi = {
  status: () => api.get<{ networks: FederationNetwork[]; lastRound: unknown; recentEvents: unknown[] }>("/federation/status"),
  rounds: (params?: Record<string, string>) => api.get<{ rounds: FederationRoundSummary[] }>(`/federation/rounds${qs(params)}`),
  roundDetail: (id: string) => api.get<Record<string, unknown>>(`/federation/rounds/${id}`),
  start: (payload: {
    modelId: string;
    rounds?: number;
    epochs?: number;
    lr?: number;
    privacyMode?: "DEMO" | "ENCRYPTION";
    pacingMs?: number;
  }) => api.post<{ started: boolean; rounds: number; result?: { roundId: string; accuracyAfter: number; improvement: number } }>("/federation/rounds", payload),
};

export const privacyApi = {
  status: () => api.get<Record<string, unknown>>("/privacy/status"),
  events: (params?: Record<string, string>) => api.get<{ events: unknown[]; byType: Record<string, number> }>(`/privacy/events${qs(params)}`),
};

export interface RewardRow {
  id: string;
  round: string;
  model: string;
  organization: string;
  organizationSlug: string;
  contribution: number;
  reward: number;
  txHash: string | null;
  status: string;
  claimedAt: string | null;
  createdAt: string;
  walletAddress: string | null;
}

export const rewardsApi = {
  list: (params?: Record<string, string>) => api.get<{ rewards: RewardRow[]; wallets: unknown[]; totals: Record<string, number>; rewardFormula: Record<string, string> }>(`/rewards${qs(params)}`),
  claim: (payload: { organizationId?: string }) => api.post<{ claimed: number; total: number; blockNumber: number; txHashes: string[] }>("/rewards/claim", payload),
};

export const blockchainApi = {
  overview: () => api.get<Record<string, unknown>>("/blockchain/overview"),
  transactions: (params?: Record<string, string>) => api.get<{ transactions: unknown[]; network: string }>(`/blockchain/transactions${qs(params)}`),
  verify: () => api.get<{ ledger: { valid: boolean; blocks: number }; auditChain: { valid: boolean; entries: number }; allValid: boolean }>("/blockchain/verify"),
};

export const marketplaceApi = {
  list: (params?: Record<string, string>) => api.get<{ listings: unknown[]; principle: string }>(`/marketplace${qs(params)}`),
  detail: (id: string) => api.get<Record<string, unknown>>(`/marketplace/${id}`),
  requestAccess: (id: string, message?: string) => api.post<{ request?: unknown; autoGranted?: boolean }>(`/marketplace/${id}/access-requests`, { message }),
};

export const auditApi = {
  list: (params?: Record<string, string>) => api.get<{ entries: unknown[]; byType: Record<string, number> }>(`/audit${qs(params)}`),
};

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: () => api.get<{ notifications: NotificationRow[]; unread: number }>("/notifications"),
  markRead: (ids?: string[]) => api.post<{ updated: number | string }>("/notifications", ids?.length ? { ids } : { all: true }),
};

export const adminApi = {
  demoState: () => api.get<{ initialized: boolean; initializedAt: string | null; counts: Record<string, number>; runLogs: unknown[] }>("/admin/demo"),
  initialize: () => api.post<{ message: string; ms: number }>("/admin/demo", { action: "initialize" }),
  reset: () => api.post<{ message: string }>("/admin/demo", { action: "reset" }),
  regenerate: () => api.post<{ message: string; regenerated: number }>("/admin/demo", { action: "regenerate" }),
  users: () => api.get<{ users: unknown[] }>("/admin/users"),
  settings: () => api.get<{ settings: { key: string; value: string; description: string | null }[] }>("/admin/settings"),
  updateSetting: (key: string, value: string) => api.patch<{ key: string; value: string }>("/admin/settings", { key, value }),
};

export const contributionsApi = {
  list: (params?: Record<string, string>) => api.get<{ contributions: unknown[]; formula: Record<string, string> }>(`/contributions${qs(params)}`),
};

function qs(params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return "";
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "all"));
  return search.toString() ? `?${search.toString()}` : "";
}
