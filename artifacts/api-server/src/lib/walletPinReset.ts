import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { consumeEmailOtpForPurpose, sendWalletPinResetEmail } from "./deviceTrust";
import { hashWalletPin, validateWalletPin } from "./walletPin";

export { sendWalletPinResetEmail };

export async function resetWalletPinWithEmailOtp(
  clerkId: string,
  emailCode: string,
  newPin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pinErr = validateWalletPin(newPin);
  if (pinErr) return { ok: false, error: pinErr };

  const [user] = await db
    .select({ walletPinHash: usersTable.walletPinHash })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!user?.walletPinHash) {
    return { ok: false, error: "No wallet PIN or password is set on this account" };
  }

  const emailOk = await consumeEmailOtpForPurpose(clerkId, emailCode, "wallet_reset");
  if (!emailOk) return { ok: false, error: "Invalid or expired email code" };

  const hash = await hashWalletPin(newPin);
  await db
    .update(usersTable)
    .set({ walletPinHash: hash })
    .where(eq(usersTable.clerkId, clerkId));

  return { ok: true };
}
