import { createGatewayMiddleware, BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import type { Request, Response, NextFunction } from "express";

/** Arc Testnet CAIP-2 network id (chain ID 5042002). */
export const ARC_TESTNET_NETWORK = "eip155:5042002";

export interface GatewayPaymentInfo {
  verified: boolean;
  payer: string;
  amount: string;
  network: string;
  transaction?: string;
}

export type PaidRequest = Request & { payment?: GatewayPaymentInfo };

export interface PaymentConfig {
  enabled: boolean;
  mockMode: boolean;
  chainId: number;
  network: string;
  chainName: string;
  facilitatorUrl: string;
  sellerAddress: string | null;
}

const gatewayMiddlewareBySeller = new Map<string, ReturnType<typeof createGatewayMiddleware>>();
let facilitatorClient: BatchFacilitatorClient | null = null;

/** Mock mode is opt-in only — hackathon/demo uses real Circle Gateway on Arc testnet. */
export function isMockPayments(): boolean {
  return process.env.MOCK_PAYMENTS === "true";
}

export function getPaymentConfig(): PaymentConfig {
  const sellerAddress =
    process.env.LEPTON_SPLIT_CONTRACT ?? process.env.GATEWAY_SELLER_ADDRESS ?? null;
  const mockMode = isMockPayments();

  return {
    enabled: !mockMode,
    mockMode,
    chainId: Number(process.env.GATEWAY_CHAIN_ID ?? "5042002"),
    network: process.env.GATEWAY_NETWORK ?? ARC_TESTNET_NETWORK,
    chainName: process.env.GATEWAY_CHAIN_NAME ?? "arcTestnet",
    facilitatorUrl:
      process.env.GATEWAY_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com",
    sellerAddress,
  };
}

export function getFacilitator(): BatchFacilitatorClient {
  if (!facilitatorClient) {
    const { facilitatorUrl } = getPaymentConfig();
    facilitatorClient = new BatchFacilitatorClient({ url: facilitatorUrl });
  }
  return facilitatorClient;
}

export function getGatewayMiddlewareForSeller(sellerAddress: string) {
  const config = getPaymentConfig();
  const cached = gatewayMiddlewareBySeller.get(sellerAddress);
  if (cached) return cached;

  const middleware = createGatewayMiddleware({
    sellerAddress,
    facilitatorUrl: config.facilitatorUrl,
    networks: [config.network],
    description: "LeptonPad USDC settlement",
  });
  gatewayMiddlewareBySeller.set(sellerAddress, middleware);
  return middleware;
}

/** @deprecated Use getGatewayMiddlewareForSeller with creator wallet address. */
export function getGatewayMiddleware() {
  const config = getPaymentConfig();
  if (!config.sellerAddress) return null;
  return getGatewayMiddlewareForSeller(config.sellerAddress);
}

/**
 * x402 Gateway middleware — price and seller (LeptonSplit contract) resolved per request.
 * USDC settles on Arc to the split contract via Circle Gateway batching.
 */
export function requireGatewaySettlement(
  resolve: (req: Request) => Promise<{ price: string; sellerAddress: string } | null>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isMockPayments()) {
      next();
      return;
    }

    const settlement = await resolve(req);
    if (!settlement) {
      next();
      return;
    }

    const gateway = getGatewayMiddlewareForSeller(settlement.sellerAddress);
    gateway.require(settlement.price)(req, res, next);
  };
}

/** Format a numeric USDC price for gateway.require() — supports sub-cent amounts. */
export function formatGatewayPrice(priceUsdc: number): string {
  if (priceUsdc < 0.01) {
    return `$${priceUsdc.toFixed(6).replace(/\.?0+$/, "")}`;
  }
  return `$${priceUsdc.toFixed(2)}`;
}
