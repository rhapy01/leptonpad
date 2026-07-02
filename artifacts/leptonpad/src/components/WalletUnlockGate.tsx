import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  fetchSecurityStatus,
  verifyWalletPin,
  type SecurityStatus,
} from "@/lib/securityApi";

type Props = {
  children: ReactNode;
  onUnlocked?: () => void;
};

export function WalletUnlockGate({ children, onUnlocked }: Props) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchSecurityStatus();
      setStatus(s);
      if (s.walletUnlocked) onUnlocked?.();
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [onUnlocked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "#78716C" }}>
        Loading wallet security…
      </p>
    );
  }

  if (!status) {
    return <p className="text-sm text-red-600">Could not load wallet security.</p>;
  }

  if (!status.deviceTrusted) {
    return (
      <p className="text-sm" style={{ color: "#57534E" }}>
        Verify this device before opening your wallet.
      </p>
    );
  }

  if (!status.walletPinSet) {
    return (
      <div className="rounded-sm border bg-amber-50 p-5" style={{ borderColor: "rgba(200,150,12,0.35)" }}>
        <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>
          Set a wallet password first
        </p>
        <p className="mt-2 text-sm" style={{ color: "#57534E" }}>
          Like fintech apps, your wallet needs its own password — separate from sign-in.
          Enable 2FA in settings, then create your wallet password.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-block text-sm font-medium underline"
          style={{ color: "#92400E" }}
        >
          Go to Security settings →
        </Link>
      </div>
    );
  }

  if (status.walletUnlocked) {
    return <>{children}</>;
  }

  const handleUnlock = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await verifyWalletPin(pin);
      await refresh();
      onUnlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incorrect password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-sm border bg-white p-6 max-w-sm" style={{ borderColor: "rgba(28,25,23,0.12)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#78716C" }}>
        Step 3 — Wallet password
      </p>
      <h2
        className="mt-1 mb-2 text-lg font-semibold"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
      >
        Unlock your wallet
      </h2>
      <p className="mb-4 text-sm" style={{ color: "#57534E" }}>
        Enter your wallet-specific password to view balances and move funds.
      </p>
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Wallet password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void handleUnlock()}
        className="w-full rounded-sm border px-3 py-2.5 text-sm mb-3"
        style={{ borderColor: "rgba(28,25,23,0.18)" }}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={submitting || pin.length < 6}
        onClick={() => void handleUnlock()}
        className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "#1C1917" }}
      >
        {submitting ? "Unlocking…" : "Unlock wallet"}
      </button>
    </div>
  );
}
