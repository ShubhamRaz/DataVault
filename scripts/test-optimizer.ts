import { participantFromDisk } from "../src/server/federation/participant-node";
import { PARTICIPANT_SPECS } from "../src/server/demo-specs";
import { MLPModel, trainLocal } from "../src/server/ml/mlp";
import { evaluateClassification } from "../src/server/ml/metrics";

async function main() {
  const node = participantFromDisk("hospital-a", "a", PARTICIPANT_SPECS["hospital-a"]);
  const m = new MLPModel({ inputDim: 12, hiddenDim: 16, task: "CLASSIFICATION", lr: 0.1, batchSize: 32, epochs: 60, l2: 0, seed: 42 });
  m.setStandardizer(node.sharedStandardizer());
  const logs = trainLocal(m, node.splits.train.X.slice(0, 300), node.splits.train.y.slice(0, 300));
  console.log("loss first/last:", logs[0].loss.toFixed(4), logs[logs.length - 1].loss.toFixed(4));
  const trainEval = evaluateClassification(m, node.splits.train.X.slice(0, 300), node.splits.train.y.slice(0, 300));
  console.log("TRAIN accuracy:", trainEval.accuracy.toFixed(3), "auc:", trainEval.rocAuc.toFixed(3));
  const valEval = evaluateClassification(m, node.splits.val.X, node.splits.val.y);
  console.log("VAL accuracy:", valEval.accuracy.toFixed(3), "auc:", valEval.rocAuc.toFixed(3));
}
main();
