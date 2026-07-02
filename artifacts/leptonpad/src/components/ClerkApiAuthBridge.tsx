import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { setClerkTokenGetter } from "@/lib/apiFetch";
import { setClerkUserIdGetter } from "@/lib/appWallet";

/** Wires Clerk session tokens into API client + manual fetch helpers. */
export function ClerkApiAuthBridge() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoaded) return;

    const getter = async () => {
      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    };

    setAuthTokenGetter(getter);
    setClerkTokenGetter(getter);
    setClerkUserIdGetter(() => userId ?? null);

    return () => {
      setAuthTokenGetter(null);
      setClerkTokenGetter(null);
      setClerkUserIdGetter(null);
    };
  }, [getToken, isLoaded, userId]);

  // Refetch unlock/access queries once the session token is available.
  useEffect(() => {
    if (!isLoaded) return;

    void queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    if (!isSignedIn) return;

    void queryClient.invalidateQueries({ queryKey: ["/api/users/me/purchases"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", "reader"] });
    void queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        q.queryKey[0].startsWith("/api/payments/check/"),
    });
    void queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        q.queryKey[0].startsWith("/api/content/"),
    });
  }, [isLoaded, isSignedIn, queryClient]);

  return null;
}
