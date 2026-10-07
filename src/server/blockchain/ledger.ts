/**
 * DataVault — LAYER 3: Blockchain ledger (spec §5 Layer 3, §22, §38, §39, §52).
 *
 * Sandbox/dev mode: a REAL SHA-256 hash-chain ledger ("Local Test Network")
 * — blocks with prev-hash chaining + proof-of-work (difficulty 3), transaction
 * records, and full chain verification. Mirrors the DataVaultRewards.sol
 * contract semantics (register / recordContribution / allocateReward / claim).
 *
 * Production mode (Docker): the same actions are submitted to the Solidity
 * contract on a Hardhat local node or Polygon testnet via ethers.js
 * (see contracts/ and services/api). Only hashes/proofs go on-chain — never
 * personal or raw dataset information (spec §52).
 */
import { createHash, createHmac } from "crypto";
import { db } from "@/lib/db";

const DIFFICULTY = 3; // leading zero hex chars — fast enough for demos, real PoW loop

export interface LedgerTxInput {
  fromAddress: string;
  toAddress: string;
  action: "REGISTER_PARTICIPANT" | "RECORD_CONTRIBUTION" | "ALLOCATE_REWARD" | "CLAIM_REWARD" | "RECORD_PROOF";
  amount: number;
  roundNumber?: number;
  modelName?: string;
  participantName?: string;
  metadata?: Record<string, unknown>;
}

export function txHashOf(input: LedgerTxInput, nonce: number): string {
  const h = createHash("sha256");
  h.update(
    JSON.stringify({
      f: input.fromAddress,
      t: input.toAddress,
      a: input.action,
      amt: input.amount,
      r: input.roundNumber,
      m: input.modelName,
      p: input.participantName,
      meta: input.metadata,
      nonce,
    })
  );
  return `0x${h.digest("hex")}`;
}

/** Deterministic, well-formed wallet address derived server-side (no private keys ever reach the frontend). */
export function deriveWalletAddress(orgSlug: string): string {
  const digest = createHmac("sha256", "datavault-wallet-derivation-v1").update(orgSlug).digest("hex");
  return `0x${digest.slice(0, 40)}`;
}

function mineBlock(header: string): { hash: string; nonce: number } {
  const target = "0".repeat(DIFFICULTY);
  let nonce = 0;
  while (true) {
    const hash = createHash("sha256").update(`${header}::${nonce}`).digest("hex");
    if (hash.startsWith(target)) return { hash: `0x${hash}`, nonce };
    nonce++;
  }
}

// serialize block appends so prev-hash chaining can never fork
const gLedger = globalThis as unknown as { __dvLedgerChain?: Promise<unknown> };
gLedger.__dvLedgerChain ??= Promise.resolve();

export class BlockchainService {
  /**
   * Append transactions as a new mined block. REAL PoW hash-chaining.
   */
  appendBlock(txs: LedgerTxInput[]): Promise<{ blockNumber: number; blockHash: string; txHashes: string[] }> {
    const run = (gLedger.__dvLedgerChain as Promise<unknown>).then(() => this._append(txs));
    gLedger.__dvLedgerChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async _append(txs: LedgerTxInput[]): Promise<{ blockNumber: number; blockHash: string; txHashes: string[] }> {
    const lastBlock = await db.blockchainBlock.findFirst({ orderBy: { number: "desc" } });
    const prevHash = lastBlock?.hash ?? "0x" + "0".repeat(64);
    const number = (lastBlock?.number ?? 0) + 1;

    // assign nonces deterministically per tx; sort tx hashes for canonical headers
    const prepared = txs.map((t, i) => ({ input: t, nonce: number * 1000 + i }));
    const txHashes = prepared.map(({ input, nonce }) => txHashOf(input, nonce));
    const sortedTxHashes = [...txHashes].sort();

    const ts = new Date();
    const header = JSON.stringify({ number, prevHash, txHashes: sortedTxHashes, ts: ts.getTime() });
    const { hash, nonce } = mineBlock(header);

    const block = await db.blockchainBlock.create({
      data: { number, prevHash, hash, nonce, txCount: txs.length, timestamp: ts },
    });

    await db.blockchainTransaction.createMany({
      data: prepared.map(({ input }, i) => ({
        hash: txHashes[i],
        blockId: block.id,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        action: input.action,
        amount: input.amount,
        roundNumber: input.roundNumber ?? null,
        modelName: input.modelName ?? null,
        participantName: input.participantName ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        status: "CONFIRMED",
      })),
    });

    return { blockNumber: number, blockHash: hash, txHashes };
  }

  /**
   * Full chain re-verification: recompute every block hash and link.
   */
  async verifyChain(): Promise<{ valid: boolean; blocks: number; checkedAt: string; brokenAt?: number }> {
    const blocks = await db.blockchainBlock.findMany({ orderBy: { number: "asc" } });
    let prevHash = "0x" + "0".repeat(64);
    for (const b of blocks) {
      const txs = await db.blockchainTransaction.findMany({ where: { blockId: b.id } });
      const sortedTxHashes = txs.map((t) => t.hash).sort();
      const header = JSON.stringify({ number: b.number, prevHash, txHashes: sortedTxHashes, ts: b.timestamp.getTime() });
      const recomputed = `0x${createHash("sha256").update(`${header}::${b.nonce}`).digest("hex")}`;
      if (recomputed !== b.hash || b.prevHash !== prevHash) {
        return { valid: false, blocks: blocks.length, checkedAt: new Date().toISOString(), brokenAt: b.number };
      }
      prevHash = b.hash;
    }
    return { valid: true, blocks: blocks.length, checkedAt: new Date().toISOString() };
  }

  async chainStats() {
    const [blocks, txs, rewardTxs, contribTxs] = await Promise.all([
      db.blockchainBlock.count(),
      db.blockchainTransaction.count(),
      db.blockchainTransaction.count({ where: { action: { in: ["ALLOCATE_REWARD", "CLAIM_REWARD"] } } }),
      db.blockchainTransaction.count({ where: { action: "RECORD_CONTRIBUTION" } }),
    ]);
    const latest = await db.blockchainBlock.findFirst({ orderBy: { number: "desc" } });
    return {
      network: "DataVault Local Test Network",
      chainId: 31337,
      blocks,
      transactions: txs,
      rewardTransactions: rewardTxs,
      contributionProofs: contribTxs,
      latestBlock: latest?.number ?? 0,
      latestBlockHash: latest?.hash ?? null,
      consensus: "PoW (difficulty 3, hash-chained ledger)",
    };
  }
}

export const blockchain = new BlockchainService();
