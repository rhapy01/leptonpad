import { useAuth } from "@clerk/react";

/** True once Clerk has loaded — use to gate authenticated API queries. */
export function useAuthReady() {
  const { isLoaded, isSignedIn } = useAuth();
  return { isLoaded, isSignedIn, authReady: isLoaded };
}
