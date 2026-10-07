# DataVault — Hardhat node container ("Local Test Network")
#
# Runs the DataVaultRewards development chain:
#   JSON-RPC on 0.0.0.0:8545 · chainId 31337 · 20 pre-funded deterministic accounts
#
# Build from the repo root:  docker build -t datavault-hardhat ./contracts
# Or via docker-compose:     docker compose up hardhat

FROM node:20-alpine

WORKDIR /app

# install deterministic deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# compile the contract so the image starts ready-to-serve
COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts
RUN npx hardhat compile

EXPOSE 8545

# the local test network (hardhat node)
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
