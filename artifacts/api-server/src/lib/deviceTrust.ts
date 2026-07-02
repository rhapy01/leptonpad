import { eq, and, desc, gt } from "drizzle-orm";
import { db, trustedDevicesTable, deviceOtpTable, usersTable } from "@workspace/db";
import { hashDeviceId, hashOtpCode, generateOtpCode, encryptSecret, decryptSecret } from "./securityCrypto";
import { verifyTotp, generateTotpSecret } from "./totp";
import { sendEmail } from "./email";

export function readDeviceId(req: { headers: Record<string, unknown> }): string | null {
  const raw = req.headers["x-lepton-device-id"];
  if (typeof raw !== "string" || raw.length < 16 || raw.length > 128) return null;
  return raw;
}

export async function countTrustedDevices(clerkId: string): Promise<number> {
  const rows = await db
    .select({ id: trustedDevicesTable.id })
    .from(trustedDevicesTable)
    .where(eq(trustedDevicesTable.clerkId, clerkId));
  return rows.length;
}

export async function isDeviceTrusted(clerkId: string, deviceId: string): Promise<boolean> {
  const hash = hashDeviceId(deviceId);
  const rows = await db
    .select({ id: trustedDevicesTable.id })
    .from(trustedDevicesTable)
    .where(and(eq(trustedDevicesTable.clerkId, clerkId), eq(trustedDevicesTable.deviceHash, hash)))
    .limit(1);
  return rows.length > 0;
}

export async function trustDevice(clerkId: string, deviceId: string, label?: string): Promise<void> {
  const hash = hashDeviceId(deviceId);
  const existing = await db
    .select()
    .from(trustedDevicesTable)
    .where(and(eq(trustedDevicesTable.clerkId, clerkId), eq(trustedDevicesTable.deviceHash, hash)))
    .limit(1);

  if (existing.length) {
    await db
      .update(trustedDevicesTable)
      .set({ lastSeenAt: new Date(), ...(label ? { label } : {}) })
      .where(eq(trustedDevicesTable.id, existing[0].id));
    return;
  }

  await db.insert(trustedDevicesTable).values({
    clerkId,
    deviceHash: hash,
    label: label ?? null,
  });
}

export async function touchTrustedDevice(clerkId: string, deviceId: string): Promise<void> {
  const hash = hashDeviceId(deviceId);
  await db
    .update(trustedDevicesTable)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(trustedDevicesTable.clerkId, clerkId), eq(trustedDevicesTable.deviceHash, hash)));
}

/** First device on account is auto-trusted so users can enroll 2FA. */
export async function ensureFirstDeviceTrusted(clerkId: string, deviceId: string): Promise<boolean> {
  const count = await countTrustedDevices(clerkId);
  if (count > 0) return false;
  await trustDevice(clerkId, deviceId, "Primary device");
  return true;
}

export async function sendDeviceVerificationEmail(clerkId: string): Promise<{ sent: boolean; error?: string }> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  if (!user) return { sent: false, error: "User not found" };

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(deviceOtpTable).values({
    clerkId,
    codeHash: hashOtpCode(code),
    expiresAt,
  });

  const html = `
    <p>Hi ${user.name},</p>
    <p>Someone is signing in to your LeptonPad account from a new device. Your verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
    <p>This code expires in 10 minutes. If this wasn't you, secure your account immediately.</p>
  `;

  const sent = await sendEmail({
    to: user.email,
    recipientName: user.name,
    subject: "LeptonPad — new device verification code",
    html,
    text: `Your LeptonPad new-device code is ${code}. It expires in 10 minutes.`,
    idempotencyKey: `device-otp:${clerkId}:${Math.floor(Date.now() / 60_000)}`,
  });

  return { sent, error: sent ? undefined : "Email could not be sent" };
}

async function consumeEmailOtp(clerkId: string, code: string): Promise<boolean> {
  const hash = hashOtpCode(code.replace(/\s/g, ""));
  const now = new Date();
  const rows = await db
    .select()
    .from(deviceOtpTable)
    .where(and(eq(deviceOtpTable.clerkId, clerkId), eq(deviceOtpTable.codeHash, hash), gt(deviceOtpTable.expiresAt, now)))
    .orderBy(desc(deviceOtpTable.createdAt))
    .limit(1);

  if (!rows.length) return false;
  await db.delete(deviceOtpTable).where(eq(deviceOtpTable.id, rows[0].id));
  return true;
}

export async function verifyNewDevice(
  clerkId: string,
  deviceId: string,
  emailCode: string,
  totpCode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  if (!user) return { ok: false, error: "User not found" };

  if (!user.totpEnabled || !user.totpSecretEncrypted) {
    return {
      ok: false,
      error: "Enable Google Authenticator on your trusted device before signing in elsewhere",
    };
  }

  const emailOk = await consumeEmailOtp(clerkId, emailCode);
  if (!emailOk) return { ok: false, error: "Invalid or expired email code" };

  let secret: string;
  try {
    secret = decryptSecret(user.totpSecretEncrypted);
  } catch {
    return { ok: false, error: "Authenticator not configured" };
  }

  if (!verifyTotp(secret, totpCode)) {
    return { ok: false, error: "Invalid authenticator code" };
  }

  await trustDevice(clerkId, deviceId, "Verified device");
  return { ok: true };
}

export async function getTotpSetupSecret(clerkId: string): Promise<string> {
  const secret = generateTotpSecret();
  const encrypted = encryptSecret(secret);
  await db
    .update(usersTable)
    .set({ totpSecretEncrypted: encrypted, totpEnabled: false })
    .where(eq(usersTable.clerkId, clerkId));
  return secret;
}

export async function enableTotp(clerkId: string, totpCode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  if (!user?.totpSecretEncrypted) return { ok: false, error: "Start setup first" };

  let secret: string;
  try {
    secret = decryptSecret(user.totpSecretEncrypted);
  } catch {
    return { ok: false, error: "Setup expired — start again" };
  }

  if (!verifyTotp(secret, totpCode)) {
    return { ok: false, error: "Invalid authenticator code" };
  }

  await db
    .update(usersTable)
    .set({ totpEnabled: true })
    .where(eq(usersTable.clerkId, clerkId));
  return { ok: true };
}
