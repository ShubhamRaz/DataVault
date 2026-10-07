/**
 * DataVault — REAL model metrics (spec §35).
 * Classification: accuracy, precision, recall, F1, ROC-AUC, confusion matrix.
 * Regression: MAE, RMSE, R2.
 */
import type { MLPModel } from "./mlp";

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  loss: number;
  n: number;
}

export interface RegressionMetrics {
  mae: number;
  rmse: number;
  r2: number;
  n: number;
}

export function evaluateClassification(model: MLPModel, X: number[][], y: number[]): ClassificationMetrics {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  let loss = 0;
  const scores: { p: number; y: number }[] = [];
  for (let i = 0; i < X.length; i++) {
    const p = model.predict(X[i]);
    scores.push({ p, y: y[i] });
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 1 && y[i] === 0) fp++;
    else if (pred === 0 && y[i] === 0) tn++;
    else fn++;
    const pc = Math.min(Math.max(p, 1e-7), 1 - 1e-7);
    loss += -(y[i] * Math.log(pc) + (1 - y[i]) * Math.log(1 - pc));
  }
  const n = X.length || 1;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  return {
    accuracy: (tp + tn) / n,
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    rocAuc: rocAuc(scores),
    confusion: { tp, fp, tn, fn },
    loss: loss / n,
    n: X.length,
  };
}

function rocAuc(scores: { p: number; y: number }[]): number {
  const pos = scores.filter((s) => s.y === 1);
  const neg = scores.filter((s) => s.y === 0);
  if (pos.length === 0 || neg.length === 0) return 0.5;
  // Mann-Whitney U with tie handling
  const sorted = [...scores].sort((a, b) => a.p - b.p);
  const ranks = new Map<number, number>();
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].p === sorted[i].p) j++;
    const avgRank = (i + j + 1) / 2; // ranks are 1-based
    for (let k = i; k < j; k++) ranks.set(k, avgRank);
    i = j;
  }
  let sumPosRanks = 0;
  sorted.forEach((s, idx) => {
    if (s.y === 1) sumPosRanks += ranks.get(idx)!;
  });
  const u = sumPosRanks - (pos.length * (pos.length + 1)) / 2;
  return u / (pos.length * neg.length);
}

export function evaluateRegression(model: MLPModel, X: number[][], y: number[]): RegressionMetrics {
  let ae = 0, se = 0;
  const preds: number[] = [];
  for (let i = 0; i < X.length; i++) {
    const p = model.predict(X[i]);
    preds.push(p);
    ae += Math.abs(p - y[i]);
    se += (p - y[i]) ** 2;
  }
  const n = X.length || 1;
  const mean = y.reduce((s, v) => s + v, 0) / n;
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0) || 1;
  const ssRes = se;
  return { mae: ae / n, rmse: Math.sqrt(se / n), r2: 1 - ssRes / ssTot, n: X.length };
}

/** Primary metric selector: accuracy for classification, R2 for regression. */
export function primaryMetric(task: string, m: ClassificationMetrics | RegressionMetrics): number {
  if (task === "REGRESSION") return (m as RegressionMetrics).r2;
  return (m as ClassificationMetrics).accuracy;
}

export function metricsToDisplay(task: string, m: ClassificationMetrics | RegressionMetrics): Record<string, number> {
  if (task === "REGRESSION") {
    const r = m as RegressionMetrics;
    return { mae: round(r.mae, 3), rmse: round(r.rmse, 3), r2: round(r.r2, 4) };
  }
  const c = m as ClassificationMetrics;
  return {
    accuracy: round(c.accuracy, 4),
    precision: round(c.precision, 4),
    recall: round(c.recall, 4),
    f1: round(c.f1, 4),
    rocAuc: round(c.rocAuc, 4),
  };
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
