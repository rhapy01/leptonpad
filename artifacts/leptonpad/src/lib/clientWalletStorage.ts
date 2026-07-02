import type { Hex } from "viem";

const DB_NAME = "leptonpad-wallet";
const DB_VERSION = 1;
const STORE = "keys";

interface StoredWallet {
  clerkId: string;
  ciphertext: string;
  iv: string;
  salt: string;
  address: Hex;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clerkId" });
      }
    };
  });
}

async function deriveAesKey(clerkId: string, salt: BufferSource): Promise<CryptoKey> {
  const pepper = import.meta.env.VITE_WALLET_KDF_PEPPER ?? "leptonpad-client-wallet-v1";
  const material = new TextEncoder().encode(`${pepper}:${clerkId}`);
  const baseKey = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function loadClientWallet(clerkId: string): Promise<{ privateKey: Hex; address: Hex } | null> {
  const db = await openDb();
  const row = await new Promise<StoredWallet | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(clerkId);
    req.onsuccess = () => resolve(req.result as StoredWallet | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!row) return null;

  const key = await deriveAesKey(clerkId, b64ToBuf(row.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(row.iv) },
    key,
    b64ToBuf(row.ciphertext),
  );
  const privateKey = new TextDecoder().decode(plain) as Hex;
  return { privateKey, address: row.address };
}

export async function saveClientWallet(clerkId: string, privateKey: Hex, address: Hex): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(clerkId, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(privateKey),
  );

  const row: StoredWallet = {
    clerkId,
    ciphertext: bufToB64(ciphertext),
    iv: bufToB64(iv),
    salt: bufToB64(salt),
    address,
    createdAt: new Date().toISOString(),
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function importLegacyClientWallet(
  clerkId: string,
  privateKey: Hex,
  address: Hex,
): Promise<void> {
  await saveClientWallet(clerkId, privateKey, address);
}

export async function clearClientWallet(clerkId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clerkId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
