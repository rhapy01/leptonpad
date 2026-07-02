/**
 * Generate Arc testnet wallets for hackathon settlement setup.
 * Run from repo root: cd artifacts/api-server && node --input-type=module ../../scripts/src/hackathon-wallets.mjs
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const treasuryKey = generatePrivateKey();
const treasury = privateKeyToAccount(treasuryKey);
const platform = privateKeyToAccount(generatePrivateKey());

console.log(`
LeptonPad — Arc testnet settlement wallets
==========================================

Add these to your root .env:

GATEWAY_SELLER_ADDRESS=${platform.address}
TREASURY_PRIVATE_KEY=${treasuryKey}
MOCK_PAYMENTS=false

Fund treasury at https://faucet.circle.com/ → ${treasury.address}

Platform seller (seed content): ${platform.address}
`);
