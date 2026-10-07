/**
 * DataVault — Hardhat configuration.
 *
 * Networks:
 *  - "hardhat"   : built-in in-process network used by `npx hardhat test`
 *                  (chainId 31337). `npx hardhat node` exposes the same chain
 *                  as a JSON-RPC endpoint on 0.0.0.0:8545.
 *  - "localhost" : connects to that local node (used by deploy/seed scripts
 *                  and by the backend api service in docker-compose).
 *  - "polygonAmoy": optional public testnet, configured purely via env vars
 *                  (PRIVATE_KEY + POLYGON_AMOY_RPC_URL). Never required for
 *                  the default demo.
 *
 * Secrets are read from contracts/.env (gitignored) — never hardcode keys.
 */
require("@nomicfoundation/hardhat-toolbox");

try {
  require("dotenv").config();
} catch {
  // dotenv not installed — plain `node scripts/*.js` without .env still works
}

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY || "";
const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "";
const LOCAL_RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: LOCAL_RPC_URL,
      chainId: 31337,
    },
    polygonAmoy: {
      url: POLYGON_AMOY_RPC_URL,
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
