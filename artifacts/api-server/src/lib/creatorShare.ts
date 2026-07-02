/** Standard creator payout share (platform keeps the remainder). */
export const DEFAULT_CREATOR_SHARE = 0.95;

/** Verified creators receive 100% — no platform fee. */
export const VERIFIED_CREATOR_SHARE = 1;

export function creatorShareForVerified(verified: boolean): number {
  return verified ? VERIFIED_CREATOR_SHARE : DEFAULT_CREATOR_SHARE;
}

export function creatorShareLabel(verified: boolean): string {
  return verified ? "100%" : "95%";
}
