const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** Returns normalized https URL or null if invalid/unsafe. */
export function safeHttpUrl(raw: string | null | undefined, opts?: { allowEmpty?: boolean }): string | null {
  if (raw == null || raw.trim() === "") {
    return opts?.allowEmpty ? null : null;
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) return null;
  return url.toString();
}

export function validateOptionalUrl(
  raw: string | undefined,
  field: string,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw.trim() === "") return null;
  const safe = safeHttpUrl(raw);
  if (!safe) throw new Error(`Invalid ${field} URL — use http:// or https://`);
  return safe;
}
