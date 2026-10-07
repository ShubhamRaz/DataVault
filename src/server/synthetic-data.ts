/**
 * DataVault — Synthetic dataset generators.
 * Generates realistic-but-fake datasets for Healthcare (cancer risk),
 * Finance (fraud) and Agriculture (crop yield) federated demos.
 * All data is 100% synthetic. Seeded PRNG → deterministic runs.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

/** Deterministic PRNG (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number, mu = 0, sigma = 1) => {
  const u = Math.max(1e-9, r());
  const v = Math.max(1e-9, r());
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export interface DatasetSpec {
  domain: "HEALTHCARE" | "FINANCE" | "AGRICULTURE";
  featureNames: string[];
  targetName: string;
  task: "CLASSIFICATION" | "REGRESSION";
  samples: number;
  /** non-IID bias applied per participant */
  bias: { featureShifts: number[]; classPriorShift: number; noise: number };
  seed: number;
}

export interface GeneratedDataset {
  X: number[][]; // features
  y: number[]; // target
  featureNames: string[];
  targetName: string;
  task: "CLASSIFICATION" | "REGRESSION";
  domain: string;
  metadataHash: string;
  sampleCount: number;
  featureCount: number;
}

/** Generative weight vectors (the "ground truth" the MLP must learn) */
const GROUND_TRUTH: Record<string, { w: number[]; b: number; signal: number }> = {
  HEALTHCARE: { w: [0.9, 0.75, 0.62, 0.85, 1.25, 0.95, 1.05, 0.8, 1.1, 0.7, 0.55, 0.62], b: 0, signal: 0.5 },
  FINANCE: { w: [1.4, 0.6, 0.9, -0.5, 0.85, 1.05, 0.55, 1.2], b: -1.1, signal: 0.7 },
  AGRICULTURE: { w: [0.34, 0.46, -0.22, 0.38, 0.29, 0.0, 0.18], b: 0, signal: 1.25 },
};

/** Base feature ranges (unshifted) used for z-scoring the generative signal. */
const FEATURE_RANGES: Record<string, [number, number][]> = {
  HEALTHCARE: [
    [22, 85], [16, 42], [95, 165], [65, 210], [0.4, 8.5], [1, 12],
    [8, 32], [0, 1], [0, 1], [0, 4], [0, 3], [0, 3],
  ],
  FINANCE: [
    [5, 2400], [0, 1], [1, 40], [0, 12], [0, 1], [0, 1], [0, 24], [0, 1],
  ],
  AGRICULTURE: [
    [400, 1900], [0.12, 0.55], [4.8, 8.4], [16, 38], [20, 140], [0, 3], [0.4, 12],
  ],
};

const FEATURE_NAMES: Record<string, string[]> = {
  HEALTHCARE: [
    "age", "bmi", "blood_pressure", "glucose", "tumor_size", "cell_texture",
    "cell_radius", "family_risk", "smoking", "biomarker_a", "biomarker_b", "biomarker_c",
  ],
  FINANCE: [
    "amount", "merchant_risk", "txn_frequency", "account_age", "location_risk",
    "device_risk", "txn_hour", "prior_fraud_score",
  ],
  AGRICULTURE: ["rainfall", "soil_moisture", "soil_ph", "temperature", "fertilizer", "crop_type", "land_area"],
};

/**
 * Generate a synthetic dataset with realistic feature ranges + learnable signal.
 * Non-IID bias makes each participant's slice distributionally distinct —
 * which is exactly why federation beats data silos.
 */
export function generateDataset(spec: DatasetSpec): GeneratedDataset {
  const r = rng(spec.seed);
  const truth = GROUND_TRUTH[spec.domain];
  const ranges = FEATURE_RANGES[spec.domain];
  const n = spec.samples;
  const d = FEATURE_NAMES[spec.domain].length;
  const X: number[][] = [];
  const y: number[] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < d; j++) {
      const [lo, hi] = ranges[j];
      let v = lo + r() * (hi - lo);
      // non-IID shift: this participant's population genuinely differs
      v += (spec.bias.featureShifts[j] ?? 0) * r() * 0.5;
      row.push(v);
    }

    // z-score each feature against the GLOBAL base range, then combine into
    // a bounded signal (keeps p in a realistic 0.05–0.95 band → mixed labels)
    let z = truth.b;
    for (let j = 0; j < d; j++) {
      const [lo, hi] = ranges[j];
      const mid = (lo + hi) / 2;
      const span = (hi - lo) / 2;
      const zj = (row[j] - mid) / span; // [-1, 1]
      z += truth.signal * truth.w[j] * zj;
    }
    z += gauss(r, 0, spec.bias.noise) + spec.bias.classPriorShift;

    if (spec.task === "CLASSIFICATION") {
      // deterministic boundary + gaussian noise in z → realistic irreducible error
      y.push(z > 0 ? 1 : 0);
    } else {
      // regression: yield (t/ha), learnable signal + noise
      const yield_ = 3.2 + 2.4 * z + gauss(r, 0, 0.28 + spec.bias.noise * 0.2);
      y.push(Math.max(0.4, yield_));
    }
    X.push(row);
  }

  const metadataHash = hashDataset(X, y, spec.seed);
  return {
    X, y,
    featureNames: FEATURE_NAMES[spec.domain],
    targetName: spec.domain === "HEALTHCARE" ? "cancer_risk" : spec.domain === "FINANCE" ? "is_fraud" : "yield_t_per_ha",
    task: spec.task,
    domain: spec.domain,
    metadataHash,
    sampleCount: n,
    featureCount: d,
  };
}

export function hashDataset(X: number[][], y: number[], seed: number): string {
  const h = createHash("sha256");
  h.update(`seed=${seed};n=${X.length};d=${X[0]?.length ?? 0};`);
  // hash a deterministic sample of rows (cheap but integrity-representative)
  for (let i = 0; i < X.length; i += Math.max(1, Math.floor(X.length / 64))) {
    h.update(X[i].map((v) => v.toFixed(4)).join(",") + "|" + y[i]);
  }
  return h.digest("hex");
}

/** Standard participant environment: data physically written to its own folder. */
export function persistParticipantDataset(slug: string, name: string, ds: GeneratedDataset): string {
  const dir = join(process.cwd(), "data", "participants", slug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "data.csv");
  const header = [...ds.featureNames, ds.targetName].join(",");
  const rows = ds.X.map((row, i) => [...row.map((v) => v.toFixed(4)), ds.y[i]].join(","));
  writeFileSync(path, [header, ...rows].join("\n"), "utf-8");
  return path;
}

export function readParticipantDataset(slug: string): { header: string[]; rows: string[][] } | null {
  const path = join(process.cwd(), "data", "participants", slug, "data.csv");
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8").trim();
  const lines = content.split("\n");
  return { header: lines[0].split(","), rows: lines.slice(1).map((l) => l.split(",")) };
}

/** Train/val/test split performed INSIDE the participant environment. */
export function splitDataset(ds: GeneratedDataset, ratios = [0.7, 0.15, 0.15]) {
  const r = rng(ds.sampleCount + 7);
  const idx = ds.X.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nTrain = Math.floor(idx.length * ratios[0]);
  const nVal = Math.floor(idx.length * ratios[1]);
  const pick = (from: number, to: number) => {
    const X: number[][] = [];
    const y: number[] = [];
    for (let k = from; k < to; k++) {
      X.push(ds.X[idx[k]]);
      y.push(ds.y[idx[k]]);
    }
    return { X, y };
  };
  return { train: pick(0, nTrain), val: pick(nTrain, nTrain + nVal), test: pick(nTrain + nVal, idx.length) };
}
