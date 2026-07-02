import type { BatchEvmScheme } from "@circle-fin/x402-batching/client";

type PaymentRequired = {
  x402Version?: number;
  resource?: unknown;
  accepts: Array<Record<string, unknown>>;
};

function pickBatchingOption(accepts: PaymentRequired["accepts"], chainId: number) {
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

/** Browser x402 payment — signs locally, never sends private key to server. */
export async function payGatewayResource(
  url: string,
  scheme: BatchEvmScheme,
  chainId: number,
  init?: RequestInit,
): Promise<Response> {
  const baseInit: RequestInit = {
    credentials: "include",
    ...init,
    headers: new Headers(init?.headers),
  };

  let response = await fetch(url, baseInit);
  if (response.status !== 402) return response;

  const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    throw new Error("Server returned 402 but no PAYMENT-REQUIRED header");
  }

  const paymentRequired = JSON.parse(
    atob(paymentRequiredHeader),
  ) as PaymentRequired;

  if (!paymentRequired.accepts?.length) {
    throw new Error("No payment options in 402 response");
  }

  const batchingOption = pickBatchingOption(paymentRequired.accepts, chainId);
  if (!batchingOption) {
    throw new Error("No Gateway batching option in 402 response");
  }

  const paymentPayload = await scheme.createPaymentPayload(
    paymentRequired.x402Version ?? 2,
    batchingOption as unknown as Parameters<BatchEvmScheme["createPaymentPayload"]>[1],
  );

  const paymentHeader = btoa(
    JSON.stringify({
      ...paymentPayload,
      resource: paymentRequired.resource,
      accepted: batchingOption,
    }),
  );

  const retryHeaders = new Headers(baseInit.headers);
  retryHeaders.set("Payment-Signature", paymentHeader);

  return fetch(url, { ...baseInit, headers: retryHeaders });
}
