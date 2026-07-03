import { eq, sql } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { db, walletPasskeysTable, walletPasskeyChallengesTable } from "@workspace/db";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function webAuthnConfig() {
  const raw = process.env.PUBLIC_URL ?? process.env.APP_URL ?? "http://localhost:25139";
  const origin = raw.replace(/\/$/, "");
  const { hostname } = new URL(origin);
  return {
    rpName: "LeptonPad",
    rpID: hostname,
    origin,
  };
}

async function saveChallenge(clerkId: string, challenge: string, purpose: "register" | "auth"): Promise<void> {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await db
    .insert(walletPasskeyChallengesTable)
    .values({ clerkId, challenge, purpose, expiresAt })
    .onConflictDoUpdate({
      target: walletPasskeyChallengesTable.clerkId,
      set: { challenge, purpose, expiresAt },
    });
}

async function consumeChallenge(clerkId: string, purpose: "register" | "auth"): Promise<string> {
  const [row] = await db
    .select()
    .from(walletPasskeyChallengesTable)
    .where(eq(walletPasskeyChallengesTable.clerkId, clerkId))
    .limit(1);

  if (!row || row.purpose !== purpose || row.expiresAt.getTime() < Date.now()) {
    throw new Error("Passkey challenge expired — try again");
  }

  await db.delete(walletPasskeyChallengesTable).where(eq(walletPasskeyChallengesTable.clerkId, clerkId));
  return row.challenge;
}

function rowToCredential(row: typeof walletPasskeysTable.$inferSelect): WebAuthnCredential {
  return {
    id: row.credentialId,
    publicKey: Buffer.from(row.publicKey, "base64url"),
    counter: row.counter,
    transports: (row.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
  };
}

export async function countWalletPasskeys(clerkId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(walletPasskeysTable)
    .where(eq(walletPasskeysTable.clerkId, clerkId));
  return row?.count ?? 0;
}

export async function createWalletPasskeyRegistrationOptions(clerkId: string) {
  const { rpName, rpID } = webAuthnConfig();
  const existing = await db
    .select({ credentialId: walletPasskeysTable.credentialId })
    .from(walletPasskeysTable)
    .where(eq(walletPasskeysTable.clerkId, clerkId));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: clerkId,
    userDisplayName: "LeptonPad wallet",
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: ["internal", "hybrid", "usb", "ble", "nfc"] as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  await saveChallenge(clerkId, options.challenge, "register");
  return options;
}

export async function verifyWalletPasskeyRegistration(
  clerkId: string,
  response: Parameters<typeof verifyRegistrationResponse>[0]["response"],
) {
  const { rpID, origin } = webAuthnConfig();
  const expectedChallenge = await consumeChallenge(clerkId, "register");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration failed");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await db.insert(walletPasskeysTable).values({
    clerkId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports ?? null,
  });

  return { registered: true };
}

export async function createWalletPasskeyAuthOptions(clerkId: string) {
  const { rpID } = webAuthnConfig();
  const rows = await db
    .select()
    .from(walletPasskeysTable)
    .where(eq(walletPasskeysTable.clerkId, clerkId));

  if (!rows.length) {
    throw new Error("No passkey registered for this account");
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: rows.map((row) => ({
      id: row.credentialId,
      transports: (row.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    userVerification: "preferred",
  });

  await saveChallenge(clerkId, options.challenge, "auth");
  return options;
}

export async function verifyWalletPasskeyAuthentication(
  clerkId: string,
  response: Parameters<typeof verifyAuthenticationResponse>[0]["response"],
) {
  const { rpID, origin } = webAuthnConfig();
  const expectedChallenge = await consumeChallenge(clerkId, "auth");

  const [row] = await db
    .select()
    .from(walletPasskeysTable)
    .where(eq(walletPasskeysTable.credentialId, response.id))
    .limit(1);

  if (!row || row.clerkId !== clerkId) {
    throw new Error("Unknown passkey");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: rowToCredential(row),
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new Error("Passkey verification failed");
  }

  const { newCounter } = verification.authenticationInfo;
  await db
    .update(walletPasskeysTable)
    .set({ counter: newCounter })
    .where(eq(walletPasskeysTable.id, row.id));

  return { verified: true };
}
