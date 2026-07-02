import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const key = l.slice(0, i).trim();
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key, val];
    }),
);

const sk = env.CLERK_SECRET_KEY;
if (!sk) {
  console.error("CLERK_SECRET_KEY missing");
  process.exit(1);
}

async function clerk(path, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

const users = await clerk("/users?limit=1");
if (!Array.isArray(users.body) || users.body.length === 0) {
  console.log("NO_USERS — sign in once in the browser to seed a Clerk user");
  process.exit(0);
}

const userId = users.body[0].id;
const sessionRes = await clerk("/sessions", { method: "POST", body: { user_id: userId } });
const sessionId = sessionRes.body.id;
const tokenRes = await clerk(`/sessions/${sessionId}/tokens`, {
  method: "POST",
  body: { template: "default" },
});
let token = tokenRes.body.jwt;
const headers = { Authorization: `Bearer ${token}` };
const base = "http://127.0.0.1:8787/api";

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return { status: res.status, body };
}

console.log("=== Authenticated smoke (Clerk user)", userId, "===");
const me = await api("/users/me");
console.log("users/me:", me.status, me.body?.name ?? me.body?.error);

const wallet = await api("/wallet");
console.log("wallet:", wallet.status, JSON.stringify(wallet.body));

const activate = await api("/wallet/activate", { method: "POST" });
console.log("wallet/activate:", activate.status, JSON.stringify(activate.body));

const paidId = 11;
const checkBefore = await api(`/payments/check/${paidId}`);
console.log(`check/${paidId} before:`, checkBefore.status, JSON.stringify(checkBefore.body));

// Fresh token — activate can take >60s and Clerk JWTs are short-lived
const sessionRes2 = await clerk("/sessions", { method: "POST", body: { user_id: userId } });
const sessionId2 = sessionRes2.body.id;
const tokenRes2 = await clerk(`/sessions/${sessionId2}/tokens`, { method: "POST", body: { template: "default" } });
token = tokenRes2.body.jwt;
headers.Authorization = `Bearer ${token}`;

const unlock = await api(`/payments/unlock-app/${paidId}`, { method: "POST" });
console.log(`unlock-app/${paidId}:`, unlock.status, JSON.stringify(unlock.body));

const checkAfter = await api(`/payments/check/${paidId}`);
console.log(`check/${paidId} after:`, checkAfter.status, JSON.stringify(checkAfter.body));

const detail = await api(`/content/${paidId}`);
console.log(`content/${paidId} hasAccess:`, detail.body?.hasAccess, "bodyLen:", detail.body?.body?.length ?? 0);

const more = await api("/content?creatorId=system&limit=5");
console.log("sidebar same-creator items:", more.body?.items?.length ?? 0);

await clerk(`/sessions/${sessionId}`, { method: "DELETE" });
await clerk(`/sessions/${sessionId2}`, { method: "DELETE" }).catch(() => {});
console.log("done");
