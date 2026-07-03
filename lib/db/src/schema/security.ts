import { pgTable, text, serial, timestamp, index, uniqueIndex, integer, boolean } from "drizzle-orm/pg-core";

/** Browsers/devices explicitly approved after email OTP + TOTP. */
export const trustedDevicesTable = pgTable(
  "trusted_devices",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    deviceHash: text("device_hash").notNull(),
    label: text("label"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trusted_devices_clerk_device_uidx").on(t.clerkId, t.deviceHash),
    index("trusted_devices_clerk_idx").on(t.clerkId),
  ],
);

/** One-time codes emailed for device verification or wallet PIN reset. */
export const deviceOtpTable = pgTable(
  "device_otps",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    purpose: text("purpose").notNull().default("device"),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("device_otps_clerk_idx").on(t.clerkId)],
);

export type TrustedDevice = typeof trustedDevicesTable.$inferSelect;
export type DeviceOtp = typeof deviceOtpTable.$inferSelect;

/** WebAuthn passkeys for wallet unlock (fingerprint / Face ID / device PIN). */
export const walletPasskeysTable = pgTable(
  "wallet_passkeys",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type"),
    backedUp: boolean("backed_up"),
    transports: text("transports").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("wallet_passkeys_credential_uidx").on(t.credentialId),
    index("wallet_passkeys_clerk_idx").on(t.clerkId),
  ],
);

/** Short-lived WebAuthn challenges (serverless-safe). */
export const walletPasskeyChallengesTable = pgTable("wallet_passkey_challenges", {
  clerkId: text("clerk_id").primaryKey(),
  challenge: text("challenge").notNull(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type WalletPasskey = typeof walletPasskeysTable.$inferSelect;
