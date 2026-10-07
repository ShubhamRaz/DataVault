/**
 * DataVault — ParticipantNode (spec §14).
 *
 * Simulates an organization's LOCAL training environment. Raw data is loaded
 * from data/participants/<slug>/data.csv and NEVER leaves this class —
 * only model updates, sample counts and metrics are returned.
 * (In production Docker mode this boundary is a separate process/container
 * per organization; here it is a strict API boundary within the demo.)
 */
import {
  MLPModel, trainLocal, fitStandardizer, weightDelta, serializeWeights, deserializeWeights,
  type Weights, type EpochLog,
} from "../ml/mlp";
import { evaluateClassification, evaluateRegression, metricsToDisplay, primaryMetric } from "../ml/metrics";
import { splitDataset, generateDataset, persistParticipantDataset, readParticipantDataset, type GeneratedDataset, type DatasetSpec } from "../synthetic-data";
import { flattenWeights } from "../privacy/privacy-engine";

export interface ParticipantLocalData {
  X: number[][];
  y: number[];
}

export interface LocalTrainingResult {
  /** masked (+ optionally encrypted) serialized update — what actually leaves the node */
  updateVector: Float64Array;
  serializedDelta: string;
  delta: Weights;
  sampleCount: number;
  localMetrics: Record<string, number>;
  localPrimary: number;
  epochs: number;
  durationMs: number;
  epochLosses: EpochLog[];
  testMetrics: Record<string, number>; // local evaluation of the NEW global candidate
  testPrimary: number;
}

export class ParticipantNode {
  slug: string;
  name: string;
  dataset: GeneratedDataset;
  splits: ReturnType<typeof splitDataset>;

  constructor(slug: string, name: string, dataset: GeneratedDataset) {
    this.slug = slug;
    this.name = name;
    this.dataset = dataset;
    this.splits = splitDataset(dataset);
  }

  /** Ensure the participant's raw dataset is persisted in ITS OWN environment folder. */
  persist(): string {
    return persistParticipantDataset(this.slug, this.name, this.dataset);
  }

  /**
   * Train the global model locally (real SGD on real local data).
   * `globalModel` enters; only deltas and metrics leave.
   */
  trainLocally(globalModel: MLPModel, config: { epochs: number; batchSize: number; lr: number }, onEpoch?: (log: EpochLog) => void): LocalTrainingResult {
    const t0 = Date.now();
    const localModel = globalModel.clone();
    localModel.config = { ...localModel.config, epochs: config.epochs, batchSize: config.batchSize, lr: config.lr };
    localModel.std = globalModel.std; // shared federated standardizer

    const epochLosses = trainLocal(localModel, this.splits.train.X, this.splits.train.y, onEpoch);

    // local validation metrics (numbers only — safe to share)
    const task = this.dataset.task;
    const valMetrics = task === "CLASSIFICATION"
      ? metricsToDisplay("CLASSIFICATION", evaluateClassification(localModel, this.splits.val.X, this.splits.val.y))
      : metricsToDisplay("REGRESSION", evaluateRegression(localModel, this.splits.val.X, this.splits.val.y));
    const valPrimary = task === "CLASSIFICATION"
      ? primaryMetric(task, evaluateClassification(localModel, this.splits.val.X, this.splits.val.y))
      : primaryMetric(task, evaluateRegression(localModel, this.splits.val.X, this.splits.val.y));
    const testMetrics = task === "CLASSIFICATION"
      ? metricsToDisplay("CLASSIFICATION", evaluateClassification(localModel, this.splits.test.X, this.splits.test.y))
      : metricsToDisplay("REGRESSION", evaluateRegression(localModel, this.splits.test.X, this.splits.test.y));
    const testPrimary = task === "CLASSIFICATION"
      ? primaryMetric(task, evaluateClassification(localModel, this.splits.test.X, this.splits.test.y))
      : primaryMetric(task, evaluateRegression(localModel, this.splits.test.X, this.splits.test.y));

    const delta = weightDelta(localModel.weights, globalModel.weights);
    const serializedDelta = serializeWeights(delta);
    const durationMs = Date.now() - t0;

    return {
      updateVector: flattenWeights(delta),
      serializedDelta,
      delta,
      sampleCount: this.splits.train.X.length,
      localMetrics: valMetrics,
      localPrimary: valPrimary,
      epochs: config.epochs,
      durationMs,
      epochLosses,
      testMetrics,
      testPrimary,
    };
  }

  /** Evaluate a (global) model on the LOCAL test split — returns metrics only. */
  evaluateOnLocalTest(model: MLPModel): { metrics: Record<string, number>; primary: number; n: number } {
    const task = this.dataset.task;
    const m = task === "CLASSIFICATION"
      ? evaluateClassification(model, this.splits.test.X, this.splits.test.y)
      : evaluateRegression(model, this.splits.test.X, this.splits.test.y);
    return { metrics: metricsToDisplay(task, m), primary: primaryMetric(task, m), n: this.splits.test.X.length };
  }

  /** Train a silo (local-only) model from scratch — the "no federation" baseline. */
  trainSiloBaseline(epochs = 30): { metrics: Record<string, number>; primary: number } {
    const model = new MLPModel({
      inputDim: this.dataset.featureCount,
      hiddenDim: 16,
      task: this.dataset.task,
      lr: 0.08,
      batchSize: 32,
      epochs,
      l2: 0.0005,
      seed: 100 + this.dataset.sampleCount,
    });
    model.setStandardizer(this.sharedStandardizer());
    trainLocal(model, this.splits.train.X, this.splits.train.y);
    return this.evaluateOnLocalTest(model);
  }

  /** Local feature statistics (metadata only — not raw records). */
  localFeatureStats(): { mean: number[]; std: number[]; n: number } {
    const std = fitStandardizer(this.splits.train.X);
    return { mean: Array.from(std.mean), std: Array.from(std.std), n: this.splits.train.X.length };
  }

  sharedStandardizer() {
    return fitStandardizer(this.splits.train.X);
  }
}

/**
 * Create a participant node from its persisted local CSV — proves raw data
 * is read from the participant's own environment, not a central store.
 */
export function participantFromDisk(slug: string, name: string, spec: DatasetSpec): ParticipantNode {
  const persisted = readParticipantDataset(slug);
  if (persisted) {
    const featureCount = persisted.header.length - 1;
    const X = persisted.rows.map((r) => r.slice(0, featureCount).map(Number));
    const y = persisted.rows.map((r) => Number(r[featureCount]));
    const ds: GeneratedDataset = {
      X, y,
      featureNames: persisted.header.slice(0, featureCount),
      targetName: persisted.header[featureCount],
      task: spec.task,
      domain: spec.domain,
      metadataHash: `from-disk:${slug}`,
      sampleCount: X.length,
      featureCount,
    };
    return new ParticipantNode(slug, name, ds);
  }
  const ds = generateDataset(spec);
  const node = new ParticipantNode(slug, name, ds);
  node.persist();
  return node;
}

export function deserializeModelWeights(json: string): Weights {
  return deserializeWeights(json);
}
