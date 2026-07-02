import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  activateAppWallet,
  fetchAppWalletFull,
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
  const { isSignedIn, isLoaded, userId } = useAuth();
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
      const status = await fetchAppWalletFull(config?.chainName ?? "arcTestnet");
      setWallet(status);
      return status;
    } catch {
      setWallet(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, isLoaded, config?.chainName]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [refresh, isLoaded]);

  const ensureReady = useCallback(async (): Promise<AppWalletStatus> => {
    if (!isLoaded) throw new Error("Loading your session…");
    if (!isSignedIn || !userId) throw new Error("Sign in to use your LeptonPad wallet");

    let status = wallet;
    if (!status) {
      status = (await refresh()) ?? null;
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
  }, [wallet, refresh, config?.mockMode, isLoaded, isSignedIn, userId]);

  return { wallet, loading, activating, refresh, ensureReady, clientSide: wallet?.clientSide ?? config?.clientSideWallet };
}
