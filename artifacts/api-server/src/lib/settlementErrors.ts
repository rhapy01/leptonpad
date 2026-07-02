export class SettlementIncompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementIncompleteError";
  }
}

/** Paid content cannot be published — creator has no provisioned in-app wallet. */
export class CreatorWalletRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatorWalletRequiredError";
  }
}

export interface CreatorVerifyOnChainSync {
  /** Paid content registered on-chain using each item's publish-time verification snapshot */
  newlyRegistered: number[];
  failed: Array<{ contentId: number; reason: string }>;
}
