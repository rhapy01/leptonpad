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
  return { status: res.status, body: await res.json() };
}

const users = await clerk("/users?limit=1");
const userId = users.body[0].id;
const sessionRes = await clerk("/sessions", { method: "POST", body: { user_id: userId } });
const token = (await clerk(`/sessions/${sessionRes.body.id}/tokens`, {
  method: "POST",
  body: { template: "default" },
})).body.jwt;

const base = "http://127.0.0.1:8787/api";
const headers = { Authorization: `Bearer ${token}` };
const paidId = 11;

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const body = await res.json();
  return { status: res.status, body };
}

for (let i = 0; i < 6; i++) {
  const retry = await api(`/payments/retry-split/${paidId}`, { method: "POST" });
  console.log(`retry ${i + 1}:`, retry.status, JSON.stringify(retry.body));
  const check = await api(`/payments/check/${paidId}`);
  console.log(`check:`, check.body);
  if (check.body.hasAccess) break;
  await new Promise((r) => setTimeout(r, 5000));
}

const detail = await api(`/content/${paidId}`);
console.log("content access:", detail.body.hasAccess, "bodyLen:", detail.body.body?.length ?? 0);

await clerk(`/sessions/${sessionRes.body.id}`, { method: "DELETE" });
