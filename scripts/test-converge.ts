import { participantFromDisk } from "../src/server/federation/participant-node";
import { PARTICIPANT_SPECS } from "../src/server/demo-specs";
import { MLPModel, trainLocal, weightDelta, applyDelta, fedAvg } from "../src/server/ml/mlp";

async function main() {
  const slugs = ["hospital-a", "hospital-b", "hospital-c"];
  const nodes = slugs.map((s) => participantFromDisk(s, s, PARTICIPANT_SPECS[s]));
  const stats = nodes.map((n) => n.localFeatureStats());
  const totalN = stats.reduce((s, x) => s + x.n, 0);
  const d = 12;
  const mean = new Float64Array(d), std = new Float64Array(d);
  stats.forEach((st) => { const w = st.n / totalN; for (let j = 0; j < d; j++) { mean[j] += st.mean[j] * w; std[j] += st.std[j] * w; } });

  for (const epochs of [40, 100, 200]) {
    const m = new MLPModel({ inputDim: d, hiddenDim: 16, task: "CLASSIFICATION", lr: 0.12, batchSize: 32, epochs, l2: 0.0002, seed: 42 });
    m.setStandardizer({ mean, std });
    trainLocal(m, nodes[0].splits.train.X, nodes[0].splits.train.y);
    const ev = nodes[0].evaluateOnLocalTest(m);
    console.log(`single-org E${epochs}: acc=${ev.primary.toFixed(3)} auc=${ev.metrics.rocAuc}`);
  }

  // federated with strong local training
  for (const [rounds, epochs, lr] of [[6, 15, 0.15], [8, 12, 0.12]]) {
    const global = new MLPModel({ inputDim: d, hiddenDim: 16, task: "CLASSIFICATION", lr, batchSize: 32, epochs, l2: 0.0002, seed: 42 });
    global.setStandardizer({ mean, std });
    const allTestN = nodes.reduce((s, n) => s + n.splits.test.X.length, 0);
    for (let r = 1; r <= rounds; r++) {
      const deltas = nodes.map((n) => {
        const local = global.clone();
        local.config = { ...local.config, epochs, lr };
        trainLocal(local, n.splits.train.X, n.splits.train.y);
        return { delta: weightDelta(local.weights, global.weights), n: n.splits.train.X.length };
      });
      global.weights = applyDelta(global.weights, fedAvg(deltas.map((x) => x.delta), deltas.map((x) => x.n)));
      let acc = 0, auc = 0;
      for (const n of nodes) { const ev = n.evaluateOnLocalTest(global); acc += ev.primary * (ev.n / allTestN); auc += (ev.metrics.rocAuc ?? 0) * (ev.n / allTestN); }
      console.log(`  fed R${rounds}/E${epochs} round ${r}: acc=${acc.toFixed(4)} auc=${auc.toFixed(4)}`);
    }
  }
}
main();
