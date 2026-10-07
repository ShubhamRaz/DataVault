import { db } from "../src/lib/db";
async function main() {
  const model = await db.model.create({ data: { name: "T", slug: "t1", useCase: "u", industry: "i" } });
  const round = await db.federatedRound.create({ data: { modelId: model.id, roundNumber: 1, status: "RUNNING" } });
  const org = await db.organization.create({ data: { name: "O", slug: "o1", type: "Hospital", industry: "Healthcare", location: "x" } });
  try {
    await db.contribution.create({ data: { roundId: round.id, participantId: "p1", organizationId: org.id, roundNumber: 1, sampleCount: 10, rawScore: 0.5, normalizedScore: 0.3 } });
    console.log("OK contribution");
  } catch (e: any) {
    console.log("FAIL contribution:", e.message.split("\n")[0]);
  }
}
main().then(() => process.exit(0));
