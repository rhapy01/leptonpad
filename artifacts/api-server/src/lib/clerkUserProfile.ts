import type { User as ClerkUser } from "@clerk/backend";

export type ClerkProfile = {
  primaryEmail: string;
  allEmails: string[];
  name: string;
  imageUrl: string | null;
};

export function parseInitialAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function extractClerkProfile(clerkUser: ClerkUser): ClerkProfile {
  const primaryEmail =
    clerkUser.emailAddresses
      .find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress?.trim()
      .toLowerCase() ??
    clerkUser.emailAddresses[0]?.emailAddress?.trim().toLowerCase() ??
    "";

  const allEmails = [
    ...new Set(
      clerkUser.emailAddresses
        .map((e) => e.emailAddress?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];

  const name =
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
    clerkUser.username ||
    primaryEmail.split("@")[0] ||
    "Anonymous";

  return {
    primaryEmail,
    allEmails,
    name,
    imageUrl: clerkUser.imageUrl ?? null,
  };
}

export function emailMatchesAdminAllowlist(
  email: string,
  allowlist: readonly string[],
): boolean {
  return allowlist.includes(email.trim().toLowerCase());
}

export function clerkMatchesAdminAllowlist(
  profile: ClerkProfile,
  allowlist: readonly string[],
): boolean {
  if (profile.allEmails.some((e) => emailMatchesAdminAllowlist(e, allowlist))) {
    return true;
  }
  return profile.primaryEmail
    ? emailMatchesAdminAllowlist(profile.primaryEmail, allowlist)
    : false;
}
