import type { Request } from "express";
import { BatchEvmScheme } from "@circle-fin/x402-batching/client";
import { getPaymentConfig } from "./gateway";

/** Forward session auth for server-side gateway hops (cookie and/or Bearer). */
export function gatewayAuthHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = req.headers.cookie;
  if (cookie) headers.cookie = cookie;
  const authorization = req.headers.authorization;
  if (authorization) headers.authorization = authorization;
  return headers;
}

type PaymentRequired = {
  x402Version?: number;
  resource?: unknown;
  accepts: Array<Record<string, unknown>>;
};

function pickBatchingOption(accepts: PaymentRequired["accepts"]) {
  const chainId = getPaymentConfig().chainId;
  const expectedNetwork = `eip155:${chainId}`;
  return accepts.find((opt) => {
    const extra = opt.extra as { name?: string; version?: string; verifyingContract?: string } | undefined;
    return (
      opt.network === expectedNetwork &&
      extra?.name === "GatewayWalletBatched" &&
      extra?.version === "1" &&
      typeof extra?.verifyingContract === "string"
    );
  });
}

/** Server-side x402 payment flow — mirrors Circle GatewayClient.pay(). */
export async function payGatewayResource(
  url: string,
  scheme: BatchEvmScheme,
  init?: RequestInit,
): Promise<Response> {
  const baseInit: RequestInit = {
    credentials: "include",
    ...init,
    headers: new Headers(init?.headers),
  };

  let response = await fetch(url, baseInit);

  if (response.status !== 402) {
    return response;
  }

  const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    throw new Error("Server returned 402 but no PAYMENT-REQUIRED header");
  }

  const paymentRequired = JSON.parse(
    Buffer.from(paymentRequiredHeader, "base64").toString("utf8"),
  ) as PaymentRequired;

  if (!paymentRequired.accepts?.length) {
    throw new Error("No payment options in 402 response");
  }

  const batchingOption = pickBatchingOption(paymentRequired.accepts);
  if (!batchingOption) {
    throw new Error("No Gateway batching option in 402 response");
  }

  const paymentPayload = await scheme.createPaymentPayload(
    paymentRequired.x402Version ?? 2,
    batchingOption as unknown as Parameters<BatchEvmScheme["createPaymentPayload"]>[1],
  );

  const paymentHeader = Buffer.from(
    JSON.stringify({
      ...paymentPayload,
      resource: paymentRequired.resource,
      accepted: batchingOption,
    }),
  ).toString("base64");

  const retryHeaders = new Headers(baseInit.headers);
  retryHeaders.set("Payment-Signature", paymentHeader);

  response = await fetch(url, {
    ...baseInit,
    headers: retryHeaders,
  });

  return response;
}

export function internalApiBase(): string {
  const explicit = process.env.PUBLIC_URL ?? process.env.APP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;
  if (vercelHost) {
    const host = vercelHost.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  const port = process.env.API_PORT ?? process.env.PORT ?? "8787";
  return `http://127.0.0.1:${port}`;
}
