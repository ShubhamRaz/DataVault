/**
 * DataVault — REAL neural network training (no simulation).
 * Small MLP: input → hidden (tanh) → output (sigmoid for classification / linear for regression).
 * Hand-written forward pass, backpropagation, mini-batch SGD.
 * Lightweight by design (hackathon performance budget, spec §50).
 */

export interface MLPConfig {
  inputDim: number;
  hiddenDim: number;
  task: "CLASSIFICATION" | "REGRESSION";
  lr: number;
  batchSize: number;
  epochs: number;
  l2: number;
  seed: number;
}

export interface Weights {
  W1: Float64Array; // hidden × input
  b1: Float64Array; // hidden
  W2: Float64Array; // 1 × hidden
  b2: number;
}

export interface Standardizer {
  mean: Float64Array;
  std: Float64Array;
}

export interface EpochLog {
  epoch: number;
  loss: number;
}

export class MLPModel {
  config: MLPConfig;
  weights: Weights;
  std: Standardizer | null = null;

  constructor(config: MLPConfig, weights?: Weights) {
    this.config = config;
    this.weights = weights ?? initWeights(config);
  }

  get paramCount() {
    return this.weights.W1.length + this.weights.b1.length + this.weights.W2.length + 1;
  }

  setStandardizer(std: Standardizer) {
    this.std = std;
  }

  forward(x: Float64Array): { hidden: Float64Array; out: number } {
    const { W1, b1, W2, b2 } = this.weights;
    const H = b1.length;
    const hidden = new Float64Array(H);
    for (let h = 0; h < H; h++) {
      let s = b1[h];
      const off = h * this.config.inputDim;
      for (let i = 0; i < x.length; i++) s += W1[off + i] * x[i];
      hidden[h] = Math.tanh(s);
    }
    let out = b2;
    for (let h = 0; h < H; h++) out += W2[h] * hidden[h];
    if (this.config.task === "CLASSIFICATION") out = 1 / (1 + Math.exp(-out));
    return { hidden, out };
  }

  predict(x: number[]): number {
    const xi = this.standardize(x);
    return this.forward(xi).out;
  }

  private standardize(x: number[]): Float64Array {
    const out = new Float64Array(x.length);
    if (!this.std) {
      for (let i = 0; i < x.length; i++) out[i] = x[i];
      return out;
    }
    for (let i = 0; i < x.length; i++) {
      out[i] = (x[i] - this.std.mean[i]) / (this.std.std[i] || 1);
    }
    return out;
  }

  serialize(): string {
    return JSON.stringify({
      config: { inputDim: this.config.inputDim, hiddenDim: this.config.hiddenDim, task: this.config.task },
      weights: {
        W1: Array.from(this.weights.W1),
        b1: Array.from(this.weights.b1),
        W2: Array.from(this.weights.W2),
        b2: this.weights.b2,
      },
      std: this.std ? { mean: Array.from(this.std.mean), std: Array.from(this.std.std) } : null,
    });
  }

  static deserialize(json: string): MLPModel {
    const obj = JSON.parse(json);
    const m = new MLPModel({
      ...obj.config,
      lr: 0.05, batchSize: 32, epochs: 1, l2: 0, seed: 1,
    }, {
      W1: Float64Array.from(obj.weights.W1),
      b1: Float64Array.from(obj.weights.b1),
      W2: Float64Array.from(obj.weights.W2),
      b2: obj.weights.b2,
    });
    if (obj.std) m.setStandardizer({ mean: Float64Array.from(obj.std.mean), std: Float64Array.from(obj.std.std) });
    return m;
  }

  clone(): MLPModel {
    return MLPModel.deserialize(this.serialize());
  }
}

function initWeights(config: MLPConfig): Weights {
  // Xavier-ish init with seeded rng for determinism
  let a = (config.seed || 42) >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const scale1 = Math.sqrt(2 / (config.inputDim + config.hiddenDim));
  const scale2 = Math.sqrt(2 / (config.hiddenDim + 1));
  return {
    W1: Float64Array.from({ length: config.hiddenDim * config.inputDim }, () => (rand() * 2 - 1) * scale1),
    b1: new Float64Array(config.hiddenDim),
    W2: Float64Array.from({ length: config.hiddenDim }, () => (rand() * 2 - 1) * scale2),
    b2: 0,
  };
}

export function fitStandardizer(X: number[][]): Standardizer {
  const d = X[0].length;
  const mean = new Float64Array(d);
  const std = new Float64Array(d);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= X.length;
  for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / X.length) || 1;
  return { mean, std };
}

/**
 * Train the model on data (runs INSIDE the participant environment).
 * Returns per-epoch losses — real gradient descent on real data.
 */
export function trainLocal(
  model: MLPModel,
  X: number[][],
  y: number[],
  onEpoch?: (log: EpochLog) => void
): EpochLog[] {
  const { lr, batchSize, epochs, l2, task, inputDim, hiddenDim } = model.config;
  const logs: EpochLog[] = [];
  const n = X.length;
  const std = model.std ?? fitStandardizer(X);
  model.setStandardizer(std);

  // pre-standardize training matrix
  const Xs: Float64Array[] = X.map((row) => {
    const xi = new Float64Array(inputDim);
    for (let j = 0; j < inputDim; j++) xi[j] = (row[j] - std.mean[j]) / (std.std[j] || 1);
    return xi;
  });

  // deterministic shuffle order
  let a = (model.config.seed * 31 + n) >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let epochLoss = 0;
    let batches = 0;

    for (let start = 0; start < n; start += batchSize) {
      const batch = order.slice(start, Math.min(start + batchSize, n));
      // gradients accumulators
      const gW1 = new Float64Array(hiddenDim * inputDim);
      const gb1 = new Float64Array(hiddenDim);
      const gW2 = new Float64Array(hiddenDim);
      let gb2 = 0;
      let batchLoss = 0;

      for (const idx of batch) {
        const xi = Xs[idx];
        const yi = y[idx];
        const { hidden, out } = model.forward(xi);

        let delta2: number;
        if (task === "CLASSIFICATION") {
          const p = Math.min(Math.max(out, 1e-7), 1 - 1e-7);
          batchLoss += -(yi * Math.log(p) + (1 - yi) * Math.log(1 - p));
          delta2 = out - yi; // dL/dz2 for sigmoid+BCE
        } else {
          batchLoss += 0.5 * (out - yi) ** 2;
          delta2 = out - yi; // dL/dz2 for linear+MSE
        }

        // output layer grads
        for (let h = 0; h < hiddenDim; h++) gW2[h] += delta2 * hidden[h];
        gb2 += delta2;

        // hidden layer grads (tanh')
        for (let h = 0; h < hiddenDim; h++) {
          const dh = delta2 * model.weights.W2[h] * (1 - hidden[h] * hidden[h]);
          gb1[h] += dh;
          const off = h * inputDim;
          for (let j = 0; j < inputDim; j++) gW1[off + j] += dh * xi[j];
        }
      }

      // SGD update (+ L2)
      const m = batch.length;
      const scale = lr / m;
      for (let k = 0; k < model.weights.W1.length; k++)
        model.weights.W1[k] -= scale * gW1[k] + l2 * model.weights.W1[k];
      for (let h = 0; h < hiddenDim; h++) {
        model.weights.b1[h] -= scale * gb1[h];
        model.weights.W2[h] -= scale * gW2[h] + l2 * model.weights.W2[h];
      }
      model.weights.b2 -= scale * gb2;

      epochLoss += batchLoss / m;
      batches++;
    }

    const log = { epoch, loss: epochLoss / Math.max(1, batches) };
    logs.push(log);
    onEpoch?.(log);
  }
  return logs;
}

/** Weight delta = local weights − global weights (the model update). */
export function weightDelta(local: Weights, global: Weights): Weights {
  const sub = (a: Float64Array, b: Float64Array) => {
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
    return out;
  };
  return { W1: sub(local.W1, global.W1), b1: sub(local.b1, global.b1), W2: sub(local.W2, global.W2), b2: local.b2 - global.b2 };
}

/** Weighted average of deltas — REAL FedAvg (spec §14, §65). */
export function fedAvg(deltas: Weights[], weights: number[]): Weights {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const first = deltas[0];
  const acc = {
    W1: new Float64Array(first.W1.length),
    b1: new Float64Array(first.b1.length),
    W2: new Float64Array(first.W2.length),
    b2: 0,
  };
  deltas.forEach((d, i) => {
    const w = weights[i] / total;
    for (let k = 0; k < d.W1.length; k++) acc.W1[k] += d.W1[k] * w;
    for (let k = 0; k < d.b1.length; k++) acc.b1[k] += d.b1[k] * w;
    for (let k = 0; k < d.W2.length; k++) acc.W2[k] += d.W2[k] * w;
    acc.b2 += d.b2 * w;
  });
  return acc;
}

export function applyDelta(global: Weights, delta: Weights): Weights {
  const add = (a: Float64Array, b: Float64Array) => {
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
    return out;
  };
  return { W1: add(global.W1, delta.W1), b1: add(global.b1, delta.b1), W2: add(global.W2, delta.W2), b2: global.b2 + delta.b2 };
}

export function weightsNorm(w: Weights): number {
  let s = 0;
  for (const arr of [w.W1, w.b1, w.W2]) for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
  s += w.b2 * w.b2;
  return Math.sqrt(s);
}

export function serializeWeights(w: Weights): string {
  return JSON.stringify({ W1: Array.from(w.W1), b1: Array.from(w.b1), W2: Array.from(w.W2), b2: w.b2 });
}

export function deserializeWeights(json: string): Weights {
  const o = JSON.parse(json);
  return { W1: Float64Array.from(o.W1), b1: Float64Array.from(o.b1), W2: Float64Array.from(o.W2), b2: o.b2 };
}

export function hashWeights(w: Weights, extra = ""): string {
  // integrity hash — imported lazily to keep this module edge-free
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
  const h = createHash("sha256");
  h.update(extra);
  for (const arr of [w.W1, w.b1, w.W2]) h.update(Float64Array.from(arr).buffer as ArrayBuffer);
  h.update(new Float64Array([w.b2]).buffer as ArrayBuffer);
  return h.digest("hex");
}
