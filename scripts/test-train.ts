import { participantFromDisk } from "../src/server/federation/participant-node";
import { PARTICIPANT_SPECS } from "../src/server/demo-specs";
import { MLPModel, trainLocal } from "../src/server/ml/mlp";

async function main() {
  for (const slug of ["hospital-a", "hospital-b", "hospital-c", "farm-a", "farm-b", "bank-a", "bank-b", "bank-c"]) {
    const node = participantFromDisk(slug, slug, PARTICIPANT_SPECS[slug]);
    const posRate = node.dataset.y.reduce((s: number, v: number) => s + v, 0) / node.dataset.y.length;
    // silo model
    const m = new MLPModel({ inputDim: node.dataset.featureCount, hiddenDim: 16, task: node.dataset.task, lr: 0.08, batchSize: 32, epochs: 25, l2: 0.0005, seed: 777 });
    m.setStandardizer(node.sharedStandardizer());
    trainLocal(m, node.splits.train.X, node.splits.train.y);
    const own = node.evaluateOnLocalTest(m);
    console.log(
      slug.padEnd(11), node.dataset.task.slice(0, 4),
      "mean(y)=" + posRate.toFixed(2),
      "siloPrimary=" + own.primary.toFixed(3),
      JSON.stringify(own.metrics)
    );
  }
}
main();
