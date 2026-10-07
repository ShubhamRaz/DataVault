import { ParticipantNode, participantFromDisk } from "../src/server/federation/participant-node";
import { PARTICIPANT_SPECS } from "../src/server/demo-specs";
import { MLPModel, trainLocal, fedAvg, weightDelta, applyDelta, serializeWeights, deserializeWeights } from "../src/server/ml/mlp";

async function main() {
  const slugs = ["hospital-a", "hospital-b", "hospital-c"];
  const nodes: ParticipantNode[] = slugs.map((s) => participantFromDisk(s, s, PARTICIPANT_SPECS[s]));

  // federated standardizer
  const stats = nodes.map((n) => n.localFeatureStats());
  const totalN = stats.reduce((s, x) => s + x.n, 0);
  const d = stats[0].mean.length;
  const mean = new Float64Array(d), std = new Float64Array(d);
  stats.forEach((st) => { const w = st.n / totalN; for (let j = 0; j < d; j++) { mean[j] += st.mean[j] * w; std[j] += st.std[j] * w; } });

  // silo baseline (cross-eval)
  const silos = nodes.map((n) => {
    const m = new MLPModel({ inputDim: d, hiddenDim: 16, task: "CLASSIFICATION", lr: 0.08, batchSize: 32, epochs: 25, l2: 0.0005, seed: 777 + n.dataset.sampleCount });
    m.setStandardizer({ mean, std });
    trainLocal(m, n.splits.train.X, n.splits.train.y);
    return m;
  });
  let baseline = 0;
  const allTestN = nodes.reduce((s, n) => s + n.splits.test.X.length, 0);
  for (const sm of silos) {
    let acc = 0;
    for (const n of nodes) { const ev = n.evaluateOnLocalTest(sm); acc += ev.primary * (ev.n / allTestN); }
    baseline += acc / silos.length;
  }
  console.log(`silo baseline (cross-eval): ${baseline.toFixed(4)}`);

  // centralized upper bound (train on pooled data — for reference only)
  const pooled = { X: nodes.flatMap((n) => n.splits.train.X), y: nodes.flatMap((n) => n.splits.train.y) };
  const cent = new MLPModel({ inputDim: d, hiddenDim: 16, task: "CLASSIFICATION", lr: 0.08, batchSize: 32, epochs: 40, l2: 0.0005, seed: 42 });
  cent.setStandardizer({ mean, std });
  trainLocal(cent, pooled.X, pooled.y);
  let centAcc = 0;
  for (const n of nodes) { const ev = n.evaluateOnLocalTest(cent); centAcc += ev.primary * (ev.n / allTestN); }
  console.log(`centralized upper bound:   ${centAcc.toFixed(4)}`);

  // federated: R rounds × E epochs
  for (const [rounds, epochs, lr] of [[8, 5, 0.08], [10, 6, 0.1], [12, 8, 0.12]]) {
    const global = new MLPModel({ inputDim: d, hiddenDim: 16, task: "CLASSIFICATION", lr, batchSize: 32, epochs, l2: 0.0005, seed: 42 });
    global.setStandardizer({ mean, std });
    let last = 0;
    for (let r = 1; r <= rounds; r++) {
      const deltas = nodes.map((n) => {
        const local = global.clone();
        local.config = { ...local.config, epochs, lr };
        trainLocal(local, n.splits.train.X, n.splits.train.y);
        return { delta: weightDelta(local.weights, global.weights), n: n.splits.train.X.length };
      });
      const agg = fedAvg(deltas.map((x) => x.delta), deltas.map((x) => x.n));
      global.weights = applyDelta(global.weights, agg);
      let acc = 0;
      for (const n of nodes) { const ev = n.evaluateOnLocalTest(global); acc += ev.primary * (ev.n / allTestN); }
      last = acc;
      if (r === 1 || r === Math.floor(rounds / 2) || r === rounds) console.log(`  R${rounds}/E${epochs}/lr${lr} round ${r}: ${acc.toFixed(4)}`);
    }
    console.log(`federated R${rounds}/E${epochs}/lr${lr}: final ${last.toFixed(4)} (baseline ${baseline.toFixed(4)}, +${((last - baseline) * 100).toFixed(1)} pts, ${(100 * (last - baseline) / Math.max(0.001, centAcc - baseline)).toFixed(0)}% of centralized gain)`);
  }
}
main();
