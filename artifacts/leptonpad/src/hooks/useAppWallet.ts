import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  activateAppWallet,
  fetchAppWallet,
  fetchPaymentConfig,
  type AppWalletStatus,
  type PaymentConfig,
} from "@/lib/appWallet";

export function usePaymentConfig() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}

export function useAppWallet() {
  const { isSignedIn, isLoaded } = useAuth();
  const { config } = usePaymentConfig();
  const [wallet, setWallet] = useState<AppWalletStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLoaded) return null;
    if (!isSignedIn) {
      setWallet(null);
      return null;
    }
    setLoading(true);
    try {
      const status = await fetchAppWallet();
      setWallet(status);
      return status;
    } catch {
      setWallet(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [refresh, isLoaded]);

  const ensureReady = useCallback(async (): Promise<AppWalletStatus> => {
    if (!isLoaded) throw new Error("Loading your session…");
    if (!isSignedIn) throw new Error("Sign in to use your LeptonPad wallet");

    let status = wallet;
    if (!status) {
      try {
        status = (await refresh()) ?? null;
      } catch (err) {
        throw err instanceof Error ? err : new Error("Could not load wallet");
      }
    }
    if (!status) throw new Error("Could not load wallet — refresh and try again");

    if (config?.mockMode || status.gatewayReady) {
      return status;
    }

    setActivating(true);
    try {
      await activateAppWallet();
      status = (await refresh()) ?? status;
      if (!status.gatewayReady) {
        throw new Error("Wallet activation in progress — try again in a few seconds");
      }
      return status;
    } finally {
      setActivating(false);
    }
  }, [wallet, refresh, config?.mockMode, isLoaded, isSignedIn]);

  return { wallet, loading, activating, refresh, ensureReady };
}
