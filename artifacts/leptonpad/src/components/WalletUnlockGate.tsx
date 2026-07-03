import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  fetchSecurityStatus,
  verifyWalletPin,
  requestWalletPinResetOtp,
  resetWalletPin,
  type SecurityStatus,
} from "@/lib/securityApi";
import { unlockWalletWithPasskey } from "@/lib/walletPasskeyClient";
import { isWebAuthnAvailable, WALLET_LOCK_SHORT } from "@/lib/walletLockCopy";

type Props = {
  children: ReactNode;
  onUnlocked?: () => void;
};

export function WalletUnlockGate({ children, onUnlocked }: Props) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [pin, setPin] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webAuthn = isWebAuthnAvailable();

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
    return <p className="text-sm theme-text-muted">Loading wallet…</p>;
  }

  if (!status) {
    return <p className="text-sm text-red-600">Could not load wallet security.</p>;
  }

  if (!status.deviceTrusted) {
    return (
      <p className="text-sm theme-text-secondary">
        Verify this device before opening your wallet.
      </p>
    );
  }

  if (!status.walletLockSet) {
    return (
      <div className="rounded-sm border p-5 theme-warning-surface">
        <p className="text-sm font-semibold theme-text">Set up wallet lock first</p>
        <p className="mt-2 text-sm theme-text-secondary">
          Add a {WALLET_LOCK_SHORT} in Settings before opening Wallet.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-block text-sm font-medium underline theme-text-accent"
        >
          Go to Security settings →
        </Link>
      </div>
    );
  }

  if (status.walletUnlocked) {
    return <>{children}</>;
  }

  const handleUnlockPin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await verifyWalletPin(pin);
      await refresh();
      onUnlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incorrect PIN or password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockPasskey = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await unlockWalletWithPasskey();
      await refresh();
      onUnlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey unlock failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetOtp = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestWalletPinResetOtp();
      setResetOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await resetWalletPin(emailCode, newPin);
      setResetMode(false);
      setResetOtpSent(false);
      setEmailCode("");
      setNewPin("");
      setPin("");
      await refresh();
      onUnlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset wallet lock");
    } finally {
      setSubmitting(false);
    }
  };

  if (resetMode && status.walletPinSet) {
    return (
      <div className="rounded-sm border p-6 max-w-sm theme-surface">
        <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted">
          Reset wallet lock
        </p>
        <h2 className="mt-1 mb-2 text-lg font-semibold homepage-display theme-text">
          Forgot your {WALLET_LOCK_SHORT}?
        </h2>
        <p className="mb-4 text-sm theme-text-secondary">
          We&apos;ll email you a code to set a new {WALLET_LOCK_SHORT}.
        </p>

        {!resetOtpSent ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSendResetOtp()}
            className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-50 theme-btn-primary"
          >
            {submitting ? "Sending…" : "Send code to my email"}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Email code"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className="w-full rounded-sm px-3 py-2.5 text-sm theme-input"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={`New ${WALLET_LOCK_SHORT}`}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full rounded-sm px-3 py-2.5 text-sm theme-input"
            />
            <button
              type="button"
              disabled={submitting || !emailCode || newPin.length < 6}
              onClick={() => void handleResetPin()}
              className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-50 theme-btn-accent"
            >
              {submitting ? "Saving…" : "Save new lock"}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => {
            setResetMode(false);
            setResetOtpSent(false);
            setEmailCode("");
            setNewPin("");
            setError(null);
          }}
          className="mt-4 text-sm underline theme-text-muted"
        >
          Back to unlock
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-sm border p-6 max-w-sm theme-surface">
      <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted">Wallet</p>
      <h2 className="mt-1 mb-2 text-lg font-semibold homepage-display theme-text">
        Unlock your wallet
      </h2>
      <p className="mb-4 text-sm theme-text-secondary">Use your {WALLET_LOCK_SHORT}.</p>

      {status.walletPasskeySet && webAuthn && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleUnlockPasskey()}
          className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold mb-4 disabled:opacity-50 theme-btn-accent"
        >
          {submitting ? "Unlocking…" : "Use passkey or fingerprint"}
        </button>
      )}

      {status.walletPinSet && (
        <>
          {status.walletPasskeySet && webAuthn && (
            <p className="mb-3 text-center text-xs theme-text-muted">or enter PIN / password</p>
          )}
          <input
            type="password"
            inputMode="text"
            autoComplete="current-password"
            placeholder="PIN or password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleUnlockPin()}
            className="w-full rounded-sm px-3 py-2.5 text-sm mb-3 theme-input"
          />
          <button
            type="button"
            disabled={submitting || pin.length < 6}
            onClick={() => void handleUnlockPin()}
            className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-50 theme-btn-primary"
          >
            {submitting ? "Unlocking…" : "Unlock"}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {status.walletPinSet && (
        <button
          type="button"
          onClick={() => {
            setResetMode(true);
            setError(null);
          }}
          className="mt-4 text-sm underline theme-text-muted"
        >
          Forgot {WALLET_LOCK_SHORT}?
        </button>
      )}
    </div>
  );
}
