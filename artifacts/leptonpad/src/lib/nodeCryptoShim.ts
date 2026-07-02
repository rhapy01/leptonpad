/** Minimal Node `crypto.randomBytes` shim for browser bundles (x402 client). */
export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
