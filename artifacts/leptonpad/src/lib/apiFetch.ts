/** Attach Clerk session JWT to same-origin API calls (required on Vercel with dev instances). */

type TokenGetter = () => Promise<string | null>;

let getClerkToken: TokenGetter | null = null;

export function setClerkTokenGetter(getter: TokenGetter | null) {
  getClerkToken = getter;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has("authorization") && getClerkToken) {
    try {
      const token = await getClerkToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
    } catch {
      // Unauthenticated request — server may still accept public routes.
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
