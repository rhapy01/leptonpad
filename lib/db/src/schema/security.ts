import { pgTable, text, serial, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

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

/** One-time codes emailed when signing in from a new device. */
export const deviceOtpTable = pgTable(
  "device_otps",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("device_otps_clerk_idx").on(t.clerkId)],
);

export type TrustedDevice = typeof trustedDevicesTable.$inferSelect;
export type DeviceOtp = typeof deviceOtpTable.$inferSelect;
