const STORAGE_KEY = "leptonpad_device_id";

let sessionDeviceId: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Persistent per-browser device id sent with API calls for trust verification. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.length < 16) {
      id = sessionDeviceId ?? randomId();
      sessionDeviceId = id;
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      sessionDeviceId = id;
    }
    return id;
  } catch {
    if (!sessionDeviceId) sessionDeviceId = randomId();
    return sessionDeviceId;
  }
}
