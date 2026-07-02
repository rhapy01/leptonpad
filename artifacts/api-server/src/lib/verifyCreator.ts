import { registerPendingCreatorContentOnChain } from "./leptonSplit";

/** Flush any paid content still pending on-chain registration (uses publish-time snapshot). */
export async function afterCreatorVerifiedChange(clerkId: string) {
  return registerPendingCreatorContentOnChain(clerkId);
}
