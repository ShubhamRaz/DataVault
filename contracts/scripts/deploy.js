/**
 * DataVault — deploy DataVaultRewards to the CURRENT hardhat network.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js                       # in-process (throwaway)
 *   npx hardhat run scripts/deploy.js --network localhost   # local node at :8545
 *   npx hardhat run scripts/deploy.js --network polygonAmoy # public testnet
 *
 * Prints the deployed address — set it as REWARD_CONTRACT_ADDRESS in the
 * backend .env (or docker-compose environment) to wire up the api service.
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);

  console.log("──────────────────────────────────────────────────────");
  console.log("DataVaultRewards deployment");
  console.log(`  network  : ${hre.network.name} (chainId ${chainId})`);
  console.log(`  deployer : ${deployer.address}`);
  console.log(`  balance  : ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("  role     : deployer becomes the COORDINATOR (onlyCoordinator)");
  console.log("──────────────────────────────────────────────────────");

  if (hre.network.name === "polygonAmoy" && process.env.PRIVATE_KEY) {
    console.log("  ⚠ public testnet: make sure this key holds test MATIC only.");
  }

  const contract = await hre.ethers.deployContract("DataVaultRewards");
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`✓ DataVaultRewards deployed at ${address}`);
  console.log("");
  console.log("Wire it into the backend by setting these env vars:");
  console.log(`  REWARD_CONTRACT_ADDRESS=${address}`);
  console.log(`  BLOCKCHAIN_RPC_URL=${hre.network.name === "polygonAmoy" ? process.env.POLYGON_AMOY_RPC_URL || "<your amoy rpc url>" : "http://localhost:8545"}`);
  console.log(`  CHAIN_ID=${chainId}`);
}

main().catch((error) => {
  console.error("✗ deployment failed:", error);
  process.exitCode = 1;
});
