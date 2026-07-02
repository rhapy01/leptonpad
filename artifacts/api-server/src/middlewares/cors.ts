import type { CorsOptions } from "cors";

function normalizeOrigin(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("http") ? trimmed.replace(/\/$/, "") : `https://${trimmed.replace(/\/$/, "")}`;
}

export function allowedOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:25139",
    "http://127.0.0.1:25139",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  for (const key of ["PUBLIC_URL", "APP_URL", "VERCEL_URL", "VITE_APP_URL"]) {
    const value = process.env[key]?.trim();
    if (value) origins.add(normalizeOrigin(value));
  }

  const extra = process.env.CORS_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
  for (const o of extra) origins.add(normalizeOrigin(o));

  return [...origins];
}

export function corsOptions(): CorsOptions {
  const allowlist = allowedOrigins();
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = normalizeOrigin(origin);
      if (allowlist.includes(normalized)) {
        callback(null, true);
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
  };
}
